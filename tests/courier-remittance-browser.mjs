import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startMarketplaceFixture } from "./marketplace-fixture.mjs";

const fixture = await startMarketplaceFixture();
let browser;
try {
  const { S, Order, admin } = fixture;
  await S.M.Collection.create({ order: new Order()._id, requestKey: "isolated-remittance-1234", amount: 50000,
    reference: "TEST-COL-100", collectedAt: new Date(), reason: "Disposable collection fixture", actor: admin._id });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(token => localStorage.setItem("gymdrobe-auth-token", token), fixture.token(admin));
  await page.goto(fixture.url + "/admin/marketplace/reporting");
  const input = page.getByLabel("Statement rows", { exact: true });
  await input.fill("TEST-COL-100\t470\t30\nUNKNOWN\t20\t0\nREPEAT\t10\t0\nREPEAT\t10\t0");
  const submit = page.getByRole("button", { name: "Compare statement" });
  await submit.click();
  const table = page.getByRole("table", { name: "Courier statement results" });
  await table.waitFor();
  const rows = table.getByRole("row");
  assert.deepEqual(await rows.nth(1).getByRole("cell").allTextContents(), ["Matched", "₹470.00", "₹30.00", "₹500.00", "₹0.00"]);
  assert.equal(await rows.nth(2).getByRole("cell").first().innerText(), "Unknown reference");
  assert.equal(await rows.nth(3).getByRole("cell").first().innerText(), "Duplicate reference");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await input.fill("TEST-COL-100\t460\t30");
  assert.equal(await table.count(), 0);
  await submit.click();
  await page.getByRole("cell", { name: "-₹10.00" }).waitFor();
  await input.fill("TEST-COL-100\t470");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: /tab-separated amounts/ }).waitFor();
  assert.equal(await table.count(), 0);
  assert.equal(await S.M.Collection.countDocuments(), 1);
  assert.equal(await S.M.Ledger.countDocuments(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS 390px courier statement comparison with a real marketplace collection record");
} finally {
  await browser?.close();
  await fixture.close();
}
