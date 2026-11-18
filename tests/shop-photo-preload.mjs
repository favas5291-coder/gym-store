import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";

process.env.VITE_API_URL = "http://127.0.0.1:4436/api";
const fixture = await startStorefrontFixture(4436);
const browser = await chromium.launch({
  executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"], headless: true,
});
try {
  for (const [path, expectHint] of [["/shop", true], ["/shop?sort=price-low", false], ["/cart", false]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const { requests } = await mockStorefront(context, fixture.products);
    let releaseRoute;
    const gate = new Promise(resolve => { releaseRoute = resolve; });
    const module = path === "/cart" ? "CartPage" : "Shop";
    const pattern = new RegExp("/src/pages/" + module + "\\.jsx(?:\\?|$)");
    await context.route(pattern, async route => {
      await gate;
      await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    try {
      await Promise.all([
        page.waitForRequest(pattern, { timeout:8000 }),
        page.goto(fixture.url + path, { waitUntil:"domcontentloaded" }),
      ]);
      const hint = page.locator("link[rel=preload][as=image][fetchpriority=high]");
      if (expectHint) {
        await hint.waitFor({state:"attached"});
        assert.equal(await page.locator(".gm-product-card").count(),0);
      } else {
        await page.waitForFunction(() => document.querySelector("main [role=status]") || document.querySelector("main [aria-busy]"));
        assert.equal(await hint.count(),0);
      }
      releaseRoute();
      if (path.startsWith("/shop")) {
        const first = page.locator(".gm-product-image img").first();
        await first.waitFor();
        if (expectHint) {
          assert.equal(await hint.getAttribute("href"),await first.getAttribute("src"));
          const src = await first.evaluate(node => node.currentSrc);
          await page.waitForFunction(url => performance.getEntriesByName(url).length > 0,src);
          assert.equal(await page.evaluate(url => performance.getEntriesByName(url).length,src),1);
        } else assert.equal(await hint.count(),0);
        assert.equal(requests.filter(r => r.path==="/api/products" && r.method==="GET").length,1);
      } else assert.equal(await hint.count(),0);
    } finally {
      releaseRoute();
      await context.close();
    }
  }
  console.log("PASS live first-card image is requested once during route loading, filtered Shop and Cart skip the hint.");
} finally {
  await browser.close();
  await fixture.server.close();
}
