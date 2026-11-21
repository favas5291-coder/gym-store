import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startMarketplaceFixture } from "./marketplace-fixture.mjs";

const fixture = await startMarketplaceFixture();
let browser;
try {
  const { account } = await fixture.S.createAccount(fixture.admin, {
    email: "settlement@example.test", business: fixture.fixtures.business("Settlement fixture"), terms: fixture.fixtures.terms,
  });
  const supplier = await fixture.S.M.Account.findById(account.id);
  const order = new fixture.Order();
  const snapshot = { accountId: account.id, supplierPayablePaise: 50000, quantity: 1, terms: { settlementHoldHours: 24 } };
  const deliveredAt = new Date("2020-01-01");
  await fixture.Order.collection.insertOne({
    _id: order._id, orderNumber: "TEST-SETTLEMENT", status: "delivered", delivery: { deliveredAt },
    pricing: { finalTotal: 550 }, payment: { status: "paid", amountsReconciled: true, grossCollected: 550, amountDue: 0 },
    items: [{ name: "Fixture shirt", quantity: 1, marketplace: snapshot }],
  });
  const relation = { supplier: supplier._id, order: order._id };
  await fixture.S.M.Entitlement.collection.insertOne({
    ...relation, itemIndex: 0, snapshot, targetAmount: 0, pendingAmount: 50000, reversedAmount: 0, reservedAmount: 0, paidAmount: 0,
  });
  await fixture.S.M.Fulfilment.collection.insertOne({ ...relation, itemIndices: [0], status: "delivered", deliveredAt });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [], errors = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("request", req => { if (req.url().endsWith("/settlement-review")) requests.push(req.method()); });
  await page.addInitScript(token => localStorage.setItem("gymdrobe-auth-token", token), fixture.token(fixture.admin));
  await page.goto(fixture.url + "/admin/marketplace/suppliers/" + account.id + "?view=orders");
  const control = page.getByText("Review order settlement", { exact: true });
  await control.waitFor();
  assert.deepEqual(requests, []);
  await control.click();
  const table = page.getByRole("table", { name: "Supplier earnings across this order" });
  await table.waitFor();
  assert.deepEqual(await table.getByRole("row").nth(1).getByRole("cell").allTextContents().then(cells => cells.slice(0, 4)),
    ["₹500.00", "₹0.00", "₹500.00", "₹0.00"]);
  await page.getByRole("list", { name: "Settlement differences" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  const refresh = page.getByRole("button", { name: "Refresh settlement review" });
  const malformed = route => route.fulfill({ json: { success: true, review: { orderId: "wrong-order" } } });
  await page.route("**/settlement-review", malformed);
  await refresh.click();
  await page.getByText("The settlement review could not be verified for this order.").waitFor();
  assert.equal(await table.count(), 0);
  await page.unroute("**/settlement-review", malformed);
  await refresh.click();
  await table.waitFor();
  assert.ok(requests.length >= 3);
  assert.ok(requests.every(method => method === "GET"));
  await fixture.S.M.Account.updateOne({ _id: supplier._id }, { $set: { owner: fixture.customer._id, status: "active" } });
  const supplierPage = await browser.newPage();
  await supplierPage.addInitScript(token => localStorage.setItem("gymdrobe-auth-token", token), fixture.token(fixture.customer));
  await supplierPage.goto(fixture.url + "/supplier/orders");
  await supplierPage.getByRole("heading", { name: "TEST-SETTLEMENT" }).waitFor();
  assert.equal(await supplierPage.getByText("Review order settlement", { exact: true }).count(), 0);
  assert.equal(await fixture.S.M.Ledger.countDocuments(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS mobile admin order settlement, on-demand reads, mismatch and refresh");
} finally {
  await browser?.close();
  await fixture.close();
}
