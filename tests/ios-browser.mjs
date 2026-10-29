// WebKit UI/adapters with isolated provider, Keychain and catalogue fixtures.
// This complements the actual Xcode build; it does not replace a signed-device test.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";
const { webkit } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
process.env.VITE_GOOGLE_IOS_CLIENT_ID = "123-fixture.apps.googleusercontent.com";
process.env.VITE_APPLE_SIGN_IN_ENABLED = "true";
const f = await startStorefrontFixture(4228);
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const fixture = await mockStorefront(context, f.products);
await context.route("**/api/auth/apple/challenge", route => route.fulfill({ json: { success: true, nonce: "a".repeat(64), challenge: "fixture-challenge" } }));
let authorization;
await context.route("**/api/auth/apple", route => {
  authorization = route.request().postDataJSON();
  return route.fulfill({ json: { success: true, token: "ios-session-fixture", user: fixture.user } });
});
await context.addInitScript(() => {
  window.webkit ||= {}; window.webkit.messageHandlers ||= {}; window.webkit.messageHandlers.bridge = {};
  window.__nativeListeners = {};
  window.__calls = [];
  const plugins = { App: ["getLaunchUrl"], Keyboard: ["hide"], SplashScreen: ["hide"], SocialLogin: ["initialize", "login", "logout"], GymDrobeSecureSession: ["read", "write", "clear"], GymDrobeAppleSignIn: ["signIn"], Share: ["share"], Browser: ["open"] };
  window.Capacitor = {
    PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({ name, methods: [...methods.map(name => ({ name, rtype: "promise" })), { name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "promise" }] })),
    nativeCallback(plugin, method, options, callback) { if (method === "addListener") window.__nativeListeners[options.eventName] = callback; return options.eventName; },
    async nativePromise(plugin, method, options) {
      window.__calls.push({ plugin, method, options });
      if (plugin === "GymDrobeSecureSession") {
        if (method === "read") return { token: sessionStorage.getItem("fixture-keychain") };
        if (method === "write") sessionStorage.setItem("fixture-keychain", options.token);
        if (method === "clear") sessionStorage.removeItem("fixture-keychain");
      }
      if (plugin === "GymDrobeAppleSignIn") return { code: "single-use-fixture", name: "Preview Customer" };
      return {};
    },
  };
});
const page = await context.newPage();
const errors = [], results = [];
page.on("pageerror", error => errors.push(error.message));
await fs.mkdir("test-results/ios-browser", { recursive: true });
async function check(name, operation) {
  try { await operation(); results.push({ name, passed: true }); console.log("PASS", name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error("FAIL", name, error.stack); }
}
try {
  await check("iPhone navigation provides five tabs, categories and search without overflow", async () => {
    await page.goto(f.url + "/categories");
    const tabs = page.getByRole("navigation", { name: "App navigation" });
    assert.equal(await tabs.getByRole("link").count(), 5);
    await page.getByRole("heading", { name: "Shop by category" }).waitFor();
    await tabs.getByRole("link", { name: "Search", exact: true }).click();
    await page.getByLabel("Search GymDrobe", { exact: true }).fill("shoes");
    await page.getByRole("button", { name: "Search products" }).click();
    await page.waitForURL(/\/shop\?search=shoes$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "test-results/ios-browser/search-results.png" });
  });
  await check("native Apple authorization reaches the existing session flow and Keychain adapter", async () => {
    await page.goto(f.url + "/login");
    await page.getByRole("button", { name: "Continue with Apple" }).click();
    await page.waitForURL(/\/account$/);
    assert.deepEqual(authorization, { code: "single-use-fixture", name: "Preview Customer", challenge: "fixture-challenge" });
    assert.equal(await page.evaluate(() => localStorage.getItem("gymdrobe-auth-token")), null);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("fixture-keychain")), "ios-session-fixture");
    await page.reload();
    await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  });
  await check("offline messaging preserves the session and app links reject payment results", async () => {
    await context.setOffline(true);
    await page.getByText(/You’re offline/).waitFor();
    await context.setOffline(false);
    const before = page.url();
    await page.waitForFunction(() => Boolean(window.__nativeListeners.appUrlOpen));
    await page.evaluate(() => window.__nativeListeners.appUrlOpen({ url: "gymdrobe://app/order-success?paid=true" }));
    assert.equal(page.url(), before);
    await page.evaluate(() => window.__nativeListeners.appUrlOpen({ url: "gymdrobe://app/categories" }));
    await page.waitForURL(/\/categories$/);
  });
  await check("logout removes the secure session", async () => {
    await page.goto(f.url + "/account");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(/\/login/);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("fixture-keychain")), null);
  });
  assert.deepEqual(errors, []);
} finally {
  await fs.writeFile("test-results/ios-browser/results.json", JSON.stringify({ results, errors }, null, 2));
  await browser.close(); await f.server.close();
}
if (results.some(result => !result.passed) || errors.length) process.exitCode = 1;
