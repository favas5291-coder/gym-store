import assert from "node:assert/strict";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";

const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
const port = Number(process.env.STOREFRONT_TEST_PORT || 4276);
process.env.VITE_API_URL = `http://127.0.0.1:${port}/api`;
const fixture = await startStorefrontFixture(port);
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const width of [320, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    await mockStorefront(context, fixture.products);
    let offline = true;
    await context.route("**/api/products", route => offline
      ? route.fulfill({ status: 503, json: { success: false, message: "Fixture unavailable" } })
      : route.fallback());

    const page = await context.newPage();
    await page.goto(fixture.url + "/search");
    const field = page.getByRole("combobox", { name: "Search GymDrobe" });
    await field.fill("tee");
    const retry = page.getByRole("button", { name: "Retry loading products" });
    await retry.waitFor();
    offline = false;
    await retry.click();
    const list = page.getByRole("listbox", { name: "Matching products and categories" });
    const options = list.getByRole("option");
    await list.waitFor();
    assert.ok(await options.count() > 1);
    assert.ok(await field.evaluate(element => document.activeElement === element));
    await field.press("ArrowUp");
    assert.equal(await field.getAttribute("aria-activedescendant"), await options.last().getAttribute("id"));
    await field.press("Escape");
    await list.waitFor({ state: "hidden" });
    assert.equal(await field.inputValue(), "tee");
    assert.equal(await field.getAttribute("aria-expanded"), "false");
    await field.press("ArrowDown");
    const product = options.first();
    const path = await product.getAttribute("href");
    assert.match(path, /^\/product\//);
    assert.equal(await product.getAttribute("aria-selected"), "true");
    assert.notEqual(await product.evaluate(element => getComputedStyle(element).outlineStyle), "none");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await field.press("Enter");
    await page.waitForURL(fixture.url + path);
    await page.getByRole("heading", { name: fixture.products[0].name, exact: true }).waitFor();
    await page.goBack();
    await list.waitFor();
    assert.equal(await field.inputValue(), "tee");
    await page.reload();
    await list.waitFor();
    assert.equal(await field.inputValue(), "tee");
    await field.fill("zzzzzzzzzz");
    await page.getByText(/No product suggestions/).waitFor();

    offline = true;
    await page.goto(fixture.url + "/categories");
    const retryCategories = page.getByRole("button", { name: "Retry loading collections" });
    await retryCategories.waitFor();
    offline = false;
    await retryCategories.click();
    await page.getByRole("link", { name: fixture.products[0].category, exact: true }).first().waitFor();
    assert.ok(await page.getByRole("heading", { name: "Shop by category" }).evaluate(element => document.activeElement === element));
    await page.evaluate(() => localStorage.setItem("gymdrobe-recent-searches", JSON.stringify(["tee"])));
    await page.goto(fixture.url + "/");
    const headerSearch = page.getByRole("combobox", { name: "Search products" });
    await headerSearch.focus();
    const clearHistory = page.getByRole("button", { name: "Clear all", exact: true });
    await clearHistory.focus();
    await clearHistory.press("Enter");
    await clearHistory.waitFor({ state: "hidden" });
    assert.ok(await headerSearch.evaluate(element => document.activeElement === element));
    assert.equal(await page.evaluate(() => localStorage.getItem("gymdrobe-recent-searches")), null);
    await context.close();
    console.log(width + "px: search retry, keyboard selection and dismissal, product details, Back, reload, no matches, category retry, and keyboard focus after clearing search history passed");
  }

  const empty = await browser.newContext();
  await mockStorefront(empty, fixture.products.map(product => ({ ...product, isActive: false })));
  const page = await empty.newPage();
  await page.goto(fixture.url + "/categories");
  await page.getByText("No collections are available yet.").waitFor();
  assert.equal(await page.locator(".native-collection").count(), 0);
  await empty.close();
  console.log("An unpublished catalogue shows the empty collections state.");
} finally {
  await browser?.close();
  await fixture.server.close();
}
