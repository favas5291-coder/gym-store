// React UI + actual JWT notification routes/domain, isolated in-memory database
// and fake native bridge. No identity/push provider or customer message is used.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";
process.env.VITE_PUSH_ENABLED = "true";
process.env.VITE_API_URL = "http://127.0.0.1:4234/api";
const dir = path.resolve(process.env.GYMDROBE_SHOPPING_BACKEND_DIR || "../gym-backend-audit");
const require = createRequire(path.join(dir, "package.json"));
const { startNotificationFixture } = require("./tests/helpers/notificationFixture.cjs");
const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
const output = path.resolve("test-results/notifications"), results = [], errors = [];
await fs.mkdir(output, { recursive: true });
let backend, fixture, browser, rollback;
const check = async (name, work) => { try { await work(); results.push({ name, passed: true }); console.log("PASS", name); } catch (error) { results.push({ name, passed: false, error: error.stack }); throw error; } };
try {
  backend = await startNotificationFixture(); fixture = await startStorefrontFixture(4234);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.GYMDROBE_CHROMIUM_PATH ? { executablePath: process.env.GYMDROBE_CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const mock = await mockStorefront(context, fixture.products);
  await context.route("**/api/auth/me", route => {
    const bob = route.request().headers().authorization === `Bearer ${backend.tokens.bob}`;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, user: { ...mock.user, id: bob ? backend.ids.bob : backend.ids.alice, _id: bob ? backend.ids.bob : backend.ids.alice } }) });
  });
  await context.route("**/api/notifications/**", async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postData();
    const res = await fetch(backend.url + url.pathname, { method: req.method(), headers: { Authorization: req.headers().authorization || "", "Content-Type": "application/json" }, ...(body ? { body } : {}) });
    await route.fulfill({ status: res.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: await res.text() });
  });
  await context.addInitScript(({ token }) => {
    if (!localStorage.getItem("push-fixture-initialized")) { localStorage.setItem("gymdrobe-auth-token", token); localStorage.setItem("push-fixture-initialized", "1"); }
    window.androidBridge = {}; window.__pushCalls = []; window.__pushListeners = {};
    const plugins = { App: ["getLaunchUrl", "minimizeApp"], Browser: ["open"], Keyboard: ["hide"], SplashScreen: ["hide"], SocialLogin: ["initialize", "logout"], PushNotifications: ["checkPermissions", "requestPermissions", "register", "unregister", "createChannel"] };
    window.Capacitor = {
      PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({ name, methods: [...methods.map(name => ({ name, rtype: "promise" })), { name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "promise" }] })),
      nativeCallback(_plugin, method, options, callback) { if (method === "addListener") window.__pushListeners[options.eventName] = callback; return Promise.resolve(options.eventName); },
      async nativePromise(plugin, method, options) {
        window.__pushCalls.push({ plugin, method, options });
        if (plugin === "PushNotifications" && method === "checkPermissions") return { receive: window.__permission || "prompt" };
        if (plugin === "PushNotifications" && method === "requestPermissions") { window.__permission = "granted"; return { receive: "granted" }; }
        return {};
      },
    };
  }, { token: backend.tokens.alice });
  const page = await context.newPage(); page.setDefaultTimeout(20000); page.on("pageerror", error => errors.push(error.message));
  await check("startup presents a clear choice without requesting native permission", async () => {
    await page.goto(fixture.url + "/notifications");
    await page.getByText("Order updates are off for this device.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__pushCalls.some(call => ["register", "requestPermissions"].includes(call.method))), false);
  });
  await check("explicit opt-in reaches the actual authenticated notification API", async () => {
    await page.getByRole("button", { name: "Enable order updates", exact: true }).click();
    await page.waitForFunction(() => window.__pushCalls.some(call => call.method === "register"));
    await page.evaluate(() => window.__pushListeners.registration({ value: "fixture_FCM_token_012345678901234567890123456789" }));
    await page.getByText("Order updates are on for this device.", { exact: true }).waitFor();
    assert.equal(backend.devices(backend.ids.alice).filter(device => device.enabled).length, 1);
    assert.deepEqual(backend.devices(backend.ids.bob), []);
    assert.equal(await page.evaluate(() => JSON.stringify(Object.values(localStorage)).includes("fixture_FCM_token")), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, "order-updates-choice-mobile.png"), fullPage: true });
  });
  await check("token rotation and foreground restoration retain one current binding", async () => {
    const before = backend.devices(backend.ids.alice)[0].binding;
    await page.evaluate(() => window.__pushListeners.registration({ value: "rotated_FCM_token_012345678901234567890123456789" }));
    await page.getByText("Order updates are on for this device.", { exact: true }).waitFor();
    await page.evaluate(() => window.__pushListeners.appStateChange({ isActive: true }));
    await page.waitForFunction(() => window.__pushCalls.filter(call => call.method === "register").length === 2);
    await page.evaluate(() => window.__pushListeners.registration({ value: "rotated_FCM_token_012345678901234567890123456789" }));
    await page.getByText("Order updates are on for this device.", { exact: true }).waitFor();
    assert.equal(backend.devices(backend.ids.alice)[0].binding, before);
    assert.equal(backend.devices(backend.ids.alice).length, 1);
  });
  await check("sign-out disables this phone and another account receives no inherited preference", async () => {
    await page.goto(fixture.url + "/account");
    // Restore existing consent without prompting. Supply the native callback.
    await page.waitForFunction(() => Boolean(window.__pushListeners.registration));
    await page.evaluate(() => { window.__permission = "granted"; });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(/\/login/);
    for (let i = 0; i < 50 && backend.devices(backend.ids.alice).some(device => device.enabled); i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(backend.devices(backend.ids.alice).some(device => device.enabled), false);
    await page.evaluate(token => localStorage.setItem("gymdrobe-auth-token", token), backend.tokens.bob);
    await page.goto(fixture.url + "/notifications");
    await page.getByText("Order updates are off for this device.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__pushCalls.some(call => call.method === "requestPermissions")), false);
    assert.deepEqual(backend.devices(backend.ids.bob), []);
  });
  await check("notification controls cause no payment request or uncaught UI error", async () => {
    assert.equal(mock.requests.some(request => request.path.startsWith("/api/payments/")), false); assert.deepEqual(errors, []);
  });
  await check("a build with push disabled still clears an older binding on sign-out", async () => {
    const claimAt = Date.now() + 1000;
    async function bind(name) {
      const input = { installationId: crypto.randomUUID(), binding: crypto.randomUUID(), claimAt, refresh: false,
        platform: "android", environment: "production", orderUpdates: true, token: `${name}_rollback_FCM_token_012345678901234567890123456789` };
      const response = await fetch(backend.url + "/api/notifications/devices", { method: "POST", headers: { Authorization: `Bearer ${backend.tokens[name]}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
      assert.equal(response.status, 200);
      return { owner: backend.ids[name], installationId: input.installationId, binding: input.binding, claimAt, registered: true, optedIn: true, device: (await response.json()).device };
    }
    const saved = await bind("alice"), other = await bind("bob");
    process.env.VITE_PUSH_ENABLED = "false";
    process.env.VITE_API_URL = "http://127.0.0.1:4236/api";
    rollback = await startStorefrontFixture(4236);
    const disabled = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mockStorefront(disabled, rollback.products);
    await disabled.route("**/api/notifications/**", async route => {
      const req = route.request(), response = await fetch(backend.url + new URL(req.url()).pathname, { method: req.method(), headers: { Authorization: req.headers().authorization || "", "Content-Type": "application/json" }, body: req.postData() || undefined });
      await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
    });
    await disabled.addInitScript(({ token, saved }) => {
      localStorage.setItem("gymdrobe-auth-token", token); localStorage.setItem(`gymdrobe-order-push:${saved.owner}`, JSON.stringify(saved));
      window.androidBridge = {}; window.__disabledCalls = [];
      window.Capacitor = {
        PluginHeaders: ["App", "Browser", "Keyboard", "SplashScreen", "SocialLogin"].map(name => ({ name, methods: [{ name: "addListener", rtype: "callback" }, ...["getLaunchUrl", "hide", "open", "logout", "removeListener"].map(name => ({ name, rtype: "promise" }))] })),
        nativeCallback(_plugin, _method, options) { return Promise.resolve(options.eventName); },
        async nativePromise(plugin, method) { window.__disabledCalls.push({ plugin, method }); return {}; },
      };
    }, { token: backend.tokens.alice, saved });
    const phone = await disabled.newPage(); phone.on("pageerror", error => errors.push(error.message));
    await phone.goto(rollback.url + "/account"); await phone.getByRole("button", { name: "Sign out", exact: true }).click(); await phone.waitForURL(/\/login/);
    for (let i = 0; i < 50 && backend.devices(backend.ids.alice).some(row => row._id === saved.device && row.enabled); i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(backend.devices(backend.ids.alice).find(row => row._id === saved.device).enabled, false);
    assert.equal(backend.devices(backend.ids.bob).find(row => row._id === other.device).enabled, true);
    assert.equal(await phone.evaluate(() => window.__disabledCalls.some(call => call.plugin === "PushNotifications")), false);
    assert.equal(await phone.evaluate(id => JSON.parse(localStorage.getItem(`gymdrobe-order-push:${id}`)).optedIn, backend.ids.alice), false);
    assert.deepEqual(errors, []); await disabled.close();
  });
} finally {
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ results, errors, note: "Actual React/JWT/router/domain with isolated repository and native bridge. No Mongo/provider/physical-device delivery claim." }, null, 2));
  await browser?.close(); await fixture?.server.close(); await rollback?.server.close(); await backend?.close();
}
