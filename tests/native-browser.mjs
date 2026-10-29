// Exercise real UI/native adapters with a fake Capacitor bridge; no real login or charge.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";
const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
const f = await startStorefrontFixture(4216);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.GYMDROBE_CHROMIUM_PATH ? { executablePath: process.env.GYMDROBE_CHROMIUM_PATH } : {}) });
const output = path.resolve("test-results/android-browser");
await fs.mkdir(output, { recursive: true });
const results = [], errors = [];
const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const fixture = await mockStorefront(c, f.products);
await c.route("**/api/auth/google/challenge", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, nonce: "native-nonce-fixture", challenge: "signed-challenge-fixture" }) }));
let loginPayload;
await c.route("**/api/auth/google", (route) => {
  loginPayload = route.request().postDataJSON();
  return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, token: "native-fixture-token", user: fixture.user }) });
});
await c.addInitScript(() => {
  window.androidBridge = {};
  window.__nativeCalls = [];
  window.__nativeListeners = {};
  const plugins = {
    App: ["getLaunchUrl", "minimizeApp"], Browser: ["open"], Keyboard: ["hide"], SplashScreen: ["hide"],
    SocialLogin: ["initialize", "login", "logout"], GymDrobeCheckout: ["open"],
  };
  window.Capacitor = {
    PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({ name, methods: [...methods.map((name) => ({ name, rtype: "promise" })), { name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "promise" }] })),
    nativeCallback(plugin, method, options, callback) {
      if (method === "addListener") window.__nativeListeners[options.eventName] = callback;
      return Promise.resolve(options.eventName);
    },
    async nativePromise(plugin, method, options) {
      window.__nativeCalls.push({ plugin, method, options });
      if (method === "getLaunchUrl") return {};
      if (plugin === "SocialLogin" && method === "login") return { provider: "google", result: { idToken: "native-id-token-fixture" } };
      if (plugin === "GymDrobeCheckout") {
        if (window.__paymentMode === "cancel") throw Object.assign(new Error("Payment cancelled"), { code: "RAZORPAY_CANCELLED" });
        if (window.__paymentMode === "hold") await new Promise((resolve) => { window.__completePayment = resolve; });
        return { razorpay_order_id: window.__paymentMode === "mismatch" ? "order_wrong" : options.order_id, razorpay_payment_id: "pay_fixture", razorpay_signature: "a".repeat(64) };
      }
      return {};
    },
  };
});
const page = await c.newPage();
page.setDefaultTimeout(10000);
page.on("pageerror", (error) => errors.push(error.message));
const check = async (name, run) => {
  try { await run(); results.push({ name, passed: true }); console.log("PASS", name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error("FAIL", name, error.stack); }
};

try {
  await check("native login uses an Android button and avoids the embedded Google web flow", async () => {
    await page.goto(f.url + "/login");
    await page.getByRole("button", { name: "Continue with Google" }).waitFor();
    await page.waitForFunction(() => Boolean(window.__nativeListeners.backButton));
    assert.equal(await page.locator('script[src*="accounts.google.com/gsi"]').count(), 0);
    assert.equal(await page.getByRole("link", { name: "Install GymDrobe", exact: true }).count(), 0);
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, "android-login-390.png"), fullPage: true });
  });

  await check("native Google token and challenge reach the existing backend verification endpoint", async () => {
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForURL(/\/account/);
    assert.deepEqual(loginPayload, { credential: "native-id-token-fixture", challenge: "signed-challenge-fixture" });
    const call = await page.evaluate(() => window.__nativeCalls.find((call) => call.plugin === "SocialLogin" && call.method === "login"));
    assert.equal(call.options.options.nonce, "native-nonce-fixture");
    const init = await page.evaluate(() => window.__nativeCalls.find((call) => call.plugin === "SocialLogin" && call.method === "initialize"));
    assert.ok(init.options.google.webClientId.endsWith(".apps.googleusercontent.com"));
  });

  await check("app links reject foreign destinations and navigate only to allowed customer pages", async () => {
    const before = page.url();
    await page.evaluate(() => window.__nativeListeners.appUrlOpen({ url: "https://evil.test/orders" }));
    assert.equal(page.url(), before);
    await page.evaluate(() => window.__nativeListeners.appUrlOpen({ url: "gymdrobe://app/shop?search=shoes&token=ignored" }));
    await page.waitForURL(/\/shop\?search=shoes$/);
    await page.getByRole("heading").first().waitFor();
  });

  await check("external links open outside the bridged WebView", async () => {
    await page.evaluate(() => { const a = document.createElement("a"); a.href = "https://example.test/support"; a.textContent = "External support fixture"; document.body.appendChild(a); a.click(); a.remove(); });
    await page.waitForFunction(() => window.__nativeCalls.some((call) => call.plugin === "Browser" && call.options?.url === "https://example.test/support"));
    assert.ok(page.url().startsWith(f.url));
  });

  await check("native payments retain server-verifiable fields and reject another order's response", async () => {
    const result = await page.evaluate(async () => {
      const { openRazorpayCheckout } = await import("/src/utils/razorpay.js");
      const options = { key: "rzp_test_fixture", order_id: "order_fixture", amount: 100, currency: "INR" };
      const response = await openRazorpayCheckout(options);
      window.__paymentMode = "mismatch";
      let code;
      try { await openRazorpayCheckout(options); } catch (error) { code = error.code; }
      window.__paymentMode = "cancel";
      let cancelled;
      try { await openRazorpayCheckout(options); } catch (error) { cancelled = error.code; }
      window.__paymentMode = "";
      return { response, code, cancelled, webSdkLoaded: Boolean(document.querySelector('script[src*="checkout.razorpay.com"]')) };
    });
    assert.equal(result.response.razorpay_order_id, "order_fixture");
    assert.equal(result.response.razorpay_signature.length, 64);
    assert.equal(result.code, "RAZORPAY_RESPONSE_INVALID");
    assert.equal(result.cancelled, "RAZORPAY_CANCELLED");
    assert.equal(result.webSdkLoaded, false);
  });

  await check("Android back cannot navigate away while a native payment is open", async () => {
    await page.evaluate(async () => {
      window.__paymentMode = "hold";
      const { openRazorpayCheckout } = await import("/src/utils/razorpay.js");
      window.__pendingPayment = openRazorpayCheckout({ key: "rzp_test_fixture", order_id: "order_fixture", amount: 100, currency: "INR" });
    });
    await page.waitForFunction(() => Boolean(window.__completePayment));
    const before = page.url();
    await page.evaluate(() => window.__nativeListeners.backButton({ canGoBack: true }));
    assert.equal(page.url(), before);
    await page.evaluate(async () => { window.__completePayment(); await window.__pendingPayment; window.__paymentMode = ""; });
    await page.evaluate(() => window.__nativeListeners.backButton({ canGoBack: true }));
    await page.waitForURL(/\/account/);
  });

  await check("restored payment activity opens saved checkout recovery without trusting a callback", async () => {
    const before = await page.evaluate(() => window.__nativeCalls.filter((call) => call.plugin === "GymDrobeCheckout").length);
    await page.evaluate(() => window.__nativeListeners.appRestoredResult({ pluginId: "GymDrobeCheckout", data: { paid: true } }));
    await page.waitForURL(/\/checkout/);
    const after = await page.evaluate(() => window.__nativeCalls.filter((call) => call.plugin === "GymDrobeCheckout").length);
    assert.equal(after, before);
  });
  await check("no uncaught native-adapter UI errors", async () => assert.deepEqual(errors, []));
} finally {
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  await f.server.close();
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
