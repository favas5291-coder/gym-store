import assert from "node:assert/strict";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";

const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
const fixture = await startStorefrontFixture(Number(process.env.VARIANT_TEST_PORT || 4397));
const browser = await chromium.launch({
  executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const shirt = {
  ...fixture.products[0],
  price: 550, discount: 0, sizes: ["M", "L", "XL"], colors: ["Black"], stock: 5,
  variants: { Black: { M: 2, L: 3, XL: 0 } },
  variantPrices: [
    { size: "M", color: "Black", customerUnitAmount: 55009, mrpUnitAmount: 60000 },
    { size: "L", color: "Black", customerUnitAmount: 65000, mrpUnitAmount: 70000 },
    { size: "XL", color: "Black", customerUnitAmount: 69000, mrpUnitAmount: 75000 },
  ],
};

async function verify(width) {
  const context = await browser.newContext({ viewport: {width, height: 900}, reducedMotion: "reduce" });
  try {
    await mockStorefront(context, [shirt]);
    await context.addInitScript(() => {
      localStorage.setItem("gymdrobe.web-opening.seen.v1", "1");
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === window.rejectedStorageKey) {
          // Simulate another tab adding a different variant between copy and rollback.
          if (window.concurrentBagRow) {
            const bag = JSON.parse(localStorage.getItem("gymdrobe-cart") || "[]");
            write.call(this, "gymdrobe-cart", JSON.stringify([...bag, window.concurrentBagRow]));
            window.concurrentBagRow = null;
          }
          throw new DOMException("Storage unavailable", "QuotaExceededError");
        }
        return write.call(this, key, value);
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(fixture.url + "/product/" + shirt.id);
    const buy = page.locator(".product-options").first();
    await buy.getByRole("button", {name: "Size L", exact: true}).click();
    assert.equal(await buy.locator(".detail-price strong").innerText(), "₹650.00");
    assert.ok(await buy.getByRole("button", {name: /Size XL/}).isDisabled());
    await buy.getByRole("button", {name: /^Add to cart$/i}).click();
    await buy.getByRole("link", {name: /View bag/i}).click();
    await page.waitForURL("**/cart");
    const line = page.locator(".cart-price").first();
    const quantity = page.locator(".cart-row select").first();
    assert.match(await line.innerText(), /650\.00/);
    assert.ok(await page.locator(".cart-checkout").isEnabled());

    async function editSize(size, unitPrice) {
      await page.getByRole("button", {name: /^Edit .*size/i}).click();
      const modal = page.getByRole("dialog");
      await modal.getByLabel("Size", {exact: true}).selectOption(size);
      assert.ok((await modal.innerText()).includes(unitPrice + " each"));
      await modal.getByRole("button", {name: "Save options"}).click();
      await modal.waitFor({state: "hidden"});
    }
    await editSize("M", "₹550.09");
    await page.reload();
    assert.match(await line.innerText(), /550\.09/);
    await editSize("L", "₹650.00");
    await quantity.selectOption("2");
    await page.reload();
    assert.match(await line.innerText(), /1,300\.00/);
    assert.equal(await quantity.inputValue(), "2");

    const save = page.getByRole("button", {name: "Save for later", exact: true});
    // Refuse only the second write. The customer must retain their original bag.
    await page.evaluate(() => { window.rejectedStorageKey = "gymdrobe-cart"; });
    await save.click();
    await page.reload();
    assert.match(await line.innerText(), /1,300\.00/);
    assert.equal(await page.getByRole("link", {name: /View saved items/}).count(), 0);

    await save.click();
    await page.getByRole("link", {name: /View saved items/}).click();
    await page.waitForURL("**/saved");
    await page.reload();
    const saved = page.locator("article.bag-item");
    assert.match(await saved.innerText(), /650.00/);
    assert.match(await saved.innerText(), /L \/ Black[\s\S]*Qty 2/);

    const restore = saved.getByRole("button", {name: "Move to bag"});
    await page.evaluate(() => {
      const [large] = JSON.parse(localStorage.getItem("gymdrobe-saved-for-later"));
      window.concurrentBagRow = { ...large, selectedSize: "M", quantity: 1, price: 550.09 };
      window.rejectedStorageKey = "gymdrobe-saved-for-later";
    });
    await restore.click();
    await page.reload();
    assert.match(await saved.innerText(), /Qty 2/);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("gymdrobe-cart")).map(row => [row.selectedSize, row.quantity])), [["M", 1]]);
    await page.evaluate(() => {
      const [saved] = JSON.parse(localStorage.getItem("gymdrobe-saved-for-later"));
      localStorage.setItem("gymdrobe-cart", JSON.stringify([{ ...saved, quantity: 2 }]));
    });
    await restore.click();
    await page.getByText(/Only 3 available for this selection/).waitFor();
    assert.equal(await restore.isVisible(), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("gymdrobe-cart"))[0].quantity), 2);
    await page.evaluate(() => localStorage.setItem("gymdrobe-cart", "[]"));
    await restore.click();
    await page.getByRole("link", {name: "Open your bag"}).click();
    await page.waitForURL("**/cart");
    assert.match(await line.innerText(), /1,300\.00/);
    await page.locator(".cart-checkout").click();
    await page.waitForURL("**/checkout");
    await page.getByRole("heading", {name: /complete your order/i}).waitFor();
    assert.match(await page.locator("main").innerText(), /Quantity: 2 · ₹1,300\.00/);
    console.log(`PASS ${width}px variant price, stock, edits, saved transfers, storage recovery and checkout`);
  } finally {
    await context.close();
  }
}

try {
  for (const width of [390, 1440]) await verify(width);
} finally {
  await browser.close();
  await fixture.server.close();
}
