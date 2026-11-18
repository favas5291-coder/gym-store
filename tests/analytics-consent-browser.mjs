import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  configFile: false, server: {host:"127.0.0.1",port:0}, logLevel:"error",
  define: {"import.meta.env.VITE_GA_MEASUREMENT_ID": JSON.stringify("G-SYNTHETIC")}
});
await server.listen();
const origin = "http://127.0.0.1:" + server.httpServer.address().port;
const browser = await chromium.launch({executablePath:process.env.GYMDROBE_CHROMIUM_PATH || undefined,headless:true});
try {
  const context = await browser.newContext();
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === "/blank") {
      return route.fulfill({contentType:"text/html",body:"<!doctype html><title>Consent fixture</title>"});
    }
    if (url.origin === origin) return route.continue();
    // Never contact any analytics provider. The data layer is the asserted boundary.
    return route.abort();
  });
  const tabs = await Promise.all([context.newPage(),context.newPage()]);
  for (const page of tabs) {
    await page.goto(origin+"/blank");
    await page.evaluate(async () => { window.fixtureAnalytics = await import("/src/utils/analytics.js"); });
  }
  const [first, second] = tabs;
  const choose = (page, value) => page.evaluate(v=>window.fixtureAnalytics.setAnalyticsConsent(v),value);
  const record = page => page.evaluate(()=>window.fixtureAnalytics.trackEvent("fixture_action"));
  const count = page => page.evaluate(()=>(window.dataLayer || []).filter(row=>row[0]==="event").length);
  assert.equal(await record(first), false);
  await choose(first,"granted");
  await choose(second,"granted");
  assert.equal(await record(first), true);
  const before = await count(first);
  await choose(second,"denied");
  assert.equal(await record(first), false, "A previously opted-in tab must honor withdrawal from another tab.");
  assert.equal(await count(first), before);
  assert.equal(await first.evaluate(()=>window["ga-disable-G-SYNTHETIC"]), true);
  await choose(second,"granted");
  assert.equal(await record(first), true);
  await second.evaluate(()=>localStorage.clear());
  assert.equal(await record(first), false, "Clearing the saved choice restores the unconsented state.");
  await choose(first, "granted");
  await first.evaluate(()=>{ Storage.prototype.setItem = () => { throw new Error("Storage blocked"); }; });
  await choose(first, "denied");
  assert.equal(await record(first), false, "A failed preference write must preserve the current tab's explicit denial.");
  assert.equal(await first.evaluate(()=>window.fixtureAnalytics.getAnalyticsConsent()), "denied");
  console.log("PASS no-consent startup, cross-tab withdrawal/regrant, preference clearing and failed preference write");
} finally {
  await browser.close();
  await server.close();
}
