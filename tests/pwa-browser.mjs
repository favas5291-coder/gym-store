// Run against a production build: service workers are deliberately disabled in dev.
// API, payment, authentication and analytics requests use local fixtures only.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { preview } from "vite";

const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
const startServer = () => preview({ preview: { host: "127.0.0.1", port: 4215, strictPort: true } });
let server = await startServer();
const origin = "http://127.0.0.1:4215";
const output = path.resolve("test-results/pwa");
await fs.mkdir(output, { recursive: true });
const launchOptions = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"], ...(process.env.GYMDROBE_CHROMIUM_PATH ? { executablePath: process.env.GYMDROBE_CHROMIUM_PATH } : {}) };
const browser = await chromium.launch(launchOptions);
const errors = [];
const results = [];
const workerPath = path.resolve("dist/sw.js");
const originalWorker = await fs.readFile(workerPath, "utf8");
const check = async (name, run) => {
  try { await run(); results.push({ name, passed: true }); console.log("PASS", name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error("FAIL", name, error.stack); }
};

async function context({ regularProfile = false, ...options } = {}) {
  const settings = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", ...(options.isMobile === false ? {} : { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36" }), ...options };
  // Installation is disabled in Incognito. An empty userDataDir gives this
  // check a fresh regular profile that Playwright removes on context close.
  const c = regularProfile
    ? await chromium.launchPersistentContext("", { ...launchOptions, ...settings })
    : await browser.newContext(settings);
  // Leave same-origin documents/assets unrouted so offline emulation reaches
  // the real worker/network. Mock only APIs and block other remote services.
  await c.route("https://**/*", (route) => route.abort());
  await c.route("**/api/**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ success: true, products: [], total: 0, config: { enabled: false }, settings: { enabled: false } }),
  }));
  const page = await c.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  return { c, page };
}

async function visit(page) {
  await page.goto(origin + "/install");
  await page.getByRole("heading", { name: "Your next workout. One tap away." }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

async function simulatePrompt(page, outcome) {
  return page.evaluate((outcome) => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    window.__installCalls = 0;
    event.prompt = async () => { window.__installCalls++; };
    event.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, outcome);
}

try {
  await check("failed homepage bundle leaves a usable recovery action", async () => {
    const { c, page } = await context({ serviceWorkers: "block" });
    const entry = "**/assets/index-*.js";
    try {
      await c.route(entry, route => route.abort());
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      const fallback = page.locator("#home-boot-shell");
      const reload = fallback.getByRole("link", { name: "Reload storefront" });
      await reload.waitFor({ state: "visible" });
      await page.locator("#gymdrobe-opening").waitFor({ state: "detached" });
      assert.equal(await fallback.getByRole("link", { name: "Women’s", exact: true }).getAttribute("href"), "/shop?gender=Women");
      await c.unroute(entry);
      await reload.click();
      await page.locator("#app .department-tile").first().waitFor();
      await fallback.waitFor({ state: "detached" });
      assert.equal(await page.locator("#gymdrobe-opening").count(), 0);
    } finally {
      await c.close();
    }
  });
  await check("production manifest, versioned worker and real installability", async () => {
    const install = await context({ regularProfile: true });
    try {
      await visit(install.page);
      assert.ok(!originalWorker.includes("__GYMDROBE_PWA_VERSION__"));
      const cdp = await install.c.newCDPSession(install.page);
      const manifest = await cdp.send("Page.getAppManifest");
      assert.deepEqual(manifest.errors, []);
      const data = JSON.parse(manifest.data);
      assert.equal(data.id, "/");
      assert.equal(data.display, "standalone");
      assert.equal(data.icons.filter((i) => i.purpose === "maskable").length, 1);
      const installability = await cdp.send("Page.getInstallabilityErrors");
      assert.deepEqual(installability.installabilityErrors, []);
    } finally {
      await install.c.close();
    }
  });

  const mobile = await context();
  await check("mobile layout and browser-menu instructions", async () => {
    await visit(mobile.page);
    assert.ok(await mobile.page.getByText("Add GymDrobe using your browser menu.", { exact: false }).isVisible());
    const size = await mobile.page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(size.content <= size.viewport, JSON.stringify(size));
    assert.equal(await mobile.page.title(), "GymDrobe App | Add to Your Home Screen");
    await mobile.page.screenshot({ path: path.join(output, "install-390.png"), fullPage: true });
  });

  await check("dismissed installation is single-use and never claims success", async () => {
    assert.equal(await simulatePrompt(mobile.page, "dismissed"), true);
    await mobile.page.getByRole("button", { name: "Install GymDrobe", exact: true }).click();
    await mobile.page.getByText("Installation dismissed.", { exact: false }).waitFor();
    assert.equal(await mobile.page.evaluate(() => window.__installCalls), 1);
    assert.equal(await mobile.page.getByRole("button", { name: "Install GymDrobe", exact: true }).count(), 0);
    assert.equal(await mobile.page.getByText("GymDrobe is running as an app.", { exact: true }).count(), 0);
  });

  await check("accepted prompt waits for the browser installation event", async () => {
    await simulatePrompt(mobile.page, "accepted");
    await mobile.page.getByRole("button", { name: "Install GymDrobe", exact: true }).click();
    await mobile.page.getByText("Follow your browser’s instructions", { exact: false }).waitFor();
    assert.equal(await mobile.page.getByText("GymDrobe is running as an app.", { exact: true }).count(), 0);
    await mobile.page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await mobile.page.getByText("GymDrobe is running as an app.", { exact: true }).waitFor();
  });

  await check("offline deep links recover at the original URL", async () => {
    const failedDocument = origin + "/install?resume=1";
    // Older Chromium does not propagate offline emulation to service workers.
    // Stop the local server too, producing a real network failure for the worker.
    server.httpServer.closeAllConnections();
    await new Promise((resolve) => server.httpServer.close(resolve));
    try {
      await mobile.c.setOffline(true);
      const response = await mobile.page.goto(failedDocument);
      assert.equal(response.fromServiceWorker(), true);
      await mobile.page.screenshot({ path: path.join(output, "offline-390.png"), fullPage: true });
      await mobile.page.getByRole("heading", { name: "You’re offline." }).waitFor();
      assert.equal(mobile.page.url(), origin + "/install?resume=1");
      // A server outage does not necessarily change navigator.onLine. Both
      // browser-reported states must retain a usable, explicit retry action.
      assert.match(await mobile.page.locator("#connection").textContent(), /Waiting for an internet connection|Connection available/);
      const image = await mobile.page.locator("main img").evaluate((image) => image.complete && image.naturalWidth === 512);
      assert.equal(image, true);
      await mobile.page.screenshot({ path: path.join(output, "offline-390.png"), fullPage: true });
    } finally {
      server = await startServer();
      await mobile.c.setOffline(false);
    }
    await mobile.page.getByText("Connection available.", { exact: false }).waitFor();
    await mobile.page.getByRole("button", { name: "Try again" }).click();
    await mobile.page.getByRole("heading", { name: "Your next workout. One tap away." }).waitFor();
  });

  await check("only public offline assets enter the service worker cache", async () => {
    // Exercise API GET/POST and HTML navigation through the active worker.
    await mobile.page.evaluate(async () => {
      for (const endpoint of ["auth/me", "orders", "addresses", "payments/status"]) {
        await fetch(`/api/${endpoint}`, { headers: { Authorization: "Bearer fixture-not-a-real-token" } });
      }
      await fetch("/api/payments/pwa-test", { method: "POST", body: "{}" });
    });
    const entries = await mobile.page.evaluate(async () => {
      const names = (await caches.keys()).filter((name) => name.startsWith("gymdrobe-offline-"));
      return Promise.all(names.map(async (name) => ({ name, urls: (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname) })));
    });
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].urls.sort(), ["/brand/external/gymdrobe-maskable-512.png", "/offline.html", "/offline.js"]);
  });

  await check("updates wait for an explicit action instead of reloading a session", async () => {
    await visit(mobile.page);
    const updated = originalWorker.replace(/gymdrobe-offline-([a-f0-9]+)/, "gymdrobe-offline-$1-test");
    await mobile.page.evaluate(() => { window.__sessionPreserved = "active-shopping-session"; });
    await fs.writeFile(workerPath, updated);
    await mobile.page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await mobile.page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
    await mobile.page.getByRole("button", { name: "Update GymDrobe" }).waitFor();
    assert.equal(await mobile.page.evaluate(() => window.__sessionPreserved), "active-shopping-session");
    await Promise.all([
      mobile.page.waitForEvent("load"),
      mobile.page.getByRole("button", { name: "Update GymDrobe" }).click(),
    ]);
    await mobile.page.getByRole("heading", { name: "Your next workout. One tap away." }).waitFor();
    assert.equal(await mobile.page.evaluate(() => window.__sessionPreserved), undefined);
    await mobile.page.waitForFunction(async () => (await caches.keys()).some((key) => key.endsWith("-test")));
    assert.equal(await mobile.page.getByRole("button", { name: "Update GymDrobe" }).count(), 0);
  });
  await mobile.c.close();

  await check("iPhone instructions and 320px layout", async () => {
    const ios = await context({ viewport: { width: 320, height: 740 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
    await visit(ios.page);
    assert.equal(await ios.page.locator("details").first().getAttribute("open"), "");
    const width = await ios.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(width, true);
    await ios.page.screenshot({ path: path.join(output, "install-320.png"), fullPage: true });
    await ios.c.close();
  });

  await check("standalone mode avoids another installation prompt", async () => {
    const standalone = await context();
    await standalone.c.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
    await visit(standalone.page);
    await standalone.page.getByText("GymDrobe is running as an app.", { exact: true }).waitFor();
    await simulatePrompt(standalone.page, "accepted");
    assert.equal(await standalone.page.getByRole("button", { name: "Install GymDrobe", exact: true }).count(), 0);
    await standalone.c.close();
  });

  await check("downloaded campaign waits for decoding before the first tap", async () => {
    const home = await context({ serviceWorkers: "block" });
    try {
      await home.page.addInitScript(() => {
        const decode = HTMLImageElement.prototype.decode;
        const held = new Promise(resolve => { window.releaseCampaignDecode = resolve; });
        HTMLImageElement.prototype.decode = function () {
          const decoded = decode.call(this);
          return this.matches("#app .department-tile:first-child img")
            ? decoded.then(() => held)
            : decoded;
        };
      });
      await home.page.goto(origin, { waitUntil: "domcontentloaded" });
      const tile = home.page.locator('#app .department-tile[href="/shop?gender=Women"]');
      await home.page.waitForFunction(() => {
        const mark = performance.getEntriesByName("gymdrobe-logo-visible")[0];
        const image = document.querySelector("#app .department-tile img");
        return mark && performance.now() - mark.startTime >= 3100 && image?.complete && image.naturalWidth > 0;
      });
      assert.ok(await home.page.locator("#gymdrobe-opening").isVisible());
      await home.page.evaluate(() => window.releaseCampaignDecode());
      await home.page.locator("#gymdrobe-opening").waitFor({ state: "detached", timeout: 1500 });
      await tile.tap();
      await home.page.waitForURL("**/shop?gender=Women");
    } finally {
      await home.c.close();
    }
  });

  await check("typing during a returning Home startup survives the handoff", async () => {
    const { c, page } = await context({ serviceWorkers: "block" });
    let start;
    const bundle = new Promise(resolve => { start = resolve; });
    try {
      await page.addInitScript(() => localStorage.setItem("gymdrobe.web-opening.seen.v1", "1"));
      await c.route("**/assets/index-*.js", async route => { await bundle; await route.continue(); });
      await page.goto(origin, { waitUntil: "commit" });
      const shellInput = page.locator("[data-boot-search] input");
      await shellInput.tap();
      await shellInput.fill("black gym tee");
      const firstBox = await shellInput.boundingBox();
      start();
      await page.locator("#home-boot-shell").waitFor({ state: "detached" });
      const input = page.locator("input[data-storefront-search]");
      assert.equal(await input.inputValue(), "black gym tee");
      assert.ok(await input.evaluate(element => document.activeElement === element));
      assert.ok(Math.abs((await input.boundingBox()).y - firstBox.y) <= 2);
      await input.press("Enter");
      await page.waitForURL(url => url.pathname === "/shop" && url.searchParams.get("search") === "black gym tee");
    } finally {
      start();
      await c.close();
    }
  });

  await check("desktop layout and footer installation entry", async () => {
    const desktop = await context({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });
    await visit(desktop.page);
    assert.equal(await desktop.page.getByRole("link", { name: "Install GymDrobe", exact: true }).getAttribute("href"), "/install");
    assert.equal(await desktop.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await desktop.page.screenshot({ path: path.join(output, "install-1440.png"), fullPage: true });
    await desktop.c.close();
  });
  await check("no uncaught browser errors", async () => assert.deepEqual(errors, []));
} finally {
  await fs.writeFile(workerPath, originalWorker);
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
