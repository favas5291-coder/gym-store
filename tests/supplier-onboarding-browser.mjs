import assert from "node:assert/strict";
import { startSupplierPortalFixture } from "./supplier-portal-fixture.mjs";

const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
const fixture = await startSupplierPortalFixture();
let browser;
try {
  const name = "Fixture Athletics";
  await fixture.service.apply(fixture.users.supplier, {
    profile: {
      legalName: name, contactName: "Fixture Owner", phone: "+919876543210",
      dispatchAddress: { addressLine: "14 Fixture Lane", city: "Pune", state: "Maharashtra", pincode: "411001", country: "IN" },
    },
  });
  browser = await chromium.launch({ executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined });
  const page = await browser.newPage();
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto(fixture.url + "/__fixture/login/admin");
  const filter = page.getByRole("combobox", { name: /^Application status/ });
  await filter.selectOption("pending-verification");
  const review = page.getByRole("button", { name: "Review " + name });
  await review.click();
  await page.getByRole("combobox", { name: /^Review decision/ }).selectOption("rejected");
  await page.getByLabel(/^Review reason/).fill("Please update your dispatch address.");
  await page.getByRole("button", { name: "Save review decision" }).click();
  await page.getByText("Review decision recorded.", { exact: true }).waitFor();
  await page.getByText("No supplier applications match this view.", { exact: true }).waitFor();
  assert.equal(await review.count(), 0);
  await filter.selectOption("rejected");
  await review.waitFor();
  assert.match(await page.locator(".gd-supplier-card").innerText(), /Rejected/);
  console.log("PASS a saved supplier decision moves the application between status filters");
  await review.click();
  await page.route(url => url.pathname.endsWith("/admin/workspaces"), route => route.abort(), { times: 1 });
  await page.getByRole("combobox", { name: /^Review decision/ }).selectOption("inactive");
  await page.getByLabel(/^Review reason/).fill("Fixture supplier closed its application.");
  await page.getByRole("button", { name: "Save review decision" }).click();
  await page.getByRole("alert").filter({ hasText: "Your change was saved." }).waitFor();
  await page.getByRole("button", { name: "Reload latest records" }).click();
  await page.getByText("No supplier applications match this view.", { exact: true }).waitFor();
  await filter.selectOption("inactive");
  await review.waitFor();
  assert.match(await page.locator(".gd-supplier-card").innerText(), /Inactive/);
  console.log("PASS a failed list refresh can be retried after a confirmed save");
} finally {
  await browser?.close();
  await fixture.close();
}
