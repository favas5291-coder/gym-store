import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mockStorefront, startStorefrontFixture } from "./storefront-fixture.mjs";

const port = 4396;
process.env.VITE_API_URL = "http://127.0.0.1:" + port + "/api";
const fixture = await startStorefrontFixture(port);
const browser = await chromium.launch({
  executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mockStorefront(context, fixture.products);
  await context.addInitScript(product => {
    localStorage.setItem("gymdrobe-cart", JSON.stringify([{
      ...product, quantity: 1, selectedSize: "M", selectedColor: "Black",
    }]));
  }, fixture.products[0]);

  const page = await context.newPage();
  let releaseCatalog;
  const pendingCatalog = new Promise(resolve => { releaseCatalog = resolve; });
  await page.route("**/api/products", async route => {
    await pendingCatalog;
    await route.fallback();
  });

  await page.goto(fixture.url + "/cart", { waitUntil: "domcontentloaded" });
  const row = page.locator(".cart-row").first();
  const coupon = page.locator(".coupon-box");
  await coupon.waitFor();
  const pendingRow = await row.boundingBox();
  const pendingCoupon = await coupon.boundingBox();
  releaseCatalog();
  const extras = page.getByRole("region", { name: "Complete your workout essentials" });
  await extras.waitFor();
  await page.locator(".cart-checkout").filter({ hasText: /^Checkout$/ }).waitFor();
  const readyRow = await row.boundingBox();
  const readyCoupon = await coupon.boundingBox();
  assert.ok(Math.abs(readyRow.y - pendingRow.y) <= 4, "The catalog response moved the first cart row");
  assert.ok(Math.abs(readyCoupon.y - pendingCoupon.y) <= 64, "The catalog response displaced the coupon");
  assert.ok((await extras.boundingBox()).y >= readyCoupon.y + readyCoupon.height);

  await page.setViewportSize({ width: 1280, height: 960 });
  const desktopRow = await row.boundingBox();
  const desktopCoupon = await coupon.boundingBox();
  assert.ok(desktopCoupon.x >= desktopRow.x + desktopRow.width);
  assert.ok(Math.abs((await extras.boundingBox()).x - desktopRow.x) <= 2);
  console.log("PASS populated cart stays stable across a delayed catalog response and preserves the desktop summary column.");
} finally {
  await browser.close();
  await fixture.server.close();
}
