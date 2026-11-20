import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { mockStorefront, startStorefrontFixture } from "./storefront-fixture.mjs";

process.env.VITE_AUTOMATION_ENGINE_ENABLED = "true";
process.env.VITE_API_URL = "http://127.0.0.1:4377/api";
const fixture = await startStorefrontFixture(4377);
const browser = await chromium.launch({
  headless: true, executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { user } = await mockStorefront(ctx, fixture.products, { signedIn: true });
  let role = "admin";
  await ctx.route("**/api/auth/me", route => route.fulfill({ json: { success: true, user: { ...user, role } } }));
  const id = "AAAAAAAAAAAAAAAAAAAAAAAA".toLowerCase();
  const orderId = "BBBBBBBBBBBBBBBBBBBBBBBB".toLowerCase();
  const stamp = "2026-01-01T10:00:00Z";
  const template = {
    id, orderId, type: "order.fulfilment.check.v1", status: "needs_review", attempts: 1,
    createdAt: stamp, updatedAt: stamp, lastError: "FULFILMENT_MISMATCH",
  };
  const completed = { ...template, id: "c".repeat(24), orderId: "d".repeat(24), status: "completed", lastError: "" };
  const jobs = [template, completed];
  let enabled = true;
  let errorStatus = 0;
  const requests = [];
  await ctx.route("**/api/admin/automation**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    assert.equal(req.headers().authorization, "Bearer fixture-token-not-a-real-credential");
    requests.push({ path: url.pathname, method: req.method(), query: url.searchParams.toString() });
    if (req.method() === "POST") {
      if (errorStatus) return route.fulfill({ status: errorStatus, json: { success: false, message: "Check already requeued." } });
      if (url.pathname === "/api/admin/automation/process") return route.fulfill({ json: { success: true, processed: 1 } });
      if (url.pathname === "/api/admin/automation/orders/" + orderId + "/reconcile") {
        return route.fulfill({ json: { success: true, queued: true } });
      }
      assert.equal(url.pathname, "/api/admin/automation/jobs/" + id + "/retry");
      template.status = "queued";
      template.lastError = "";
      return route.fulfill({ json: { success: true, queued: true } });
    }
    let pageJobs = jobs.filter(job => !url.searchParams.has("status") || job.status === url.searchParams.get("status"));
    if (url.searchParams.has("before")) pageJobs = [];
    const counts = { needs_review: 0, failed: 0, completed: 0, running: 0, queued: 0 };
    jobs.forEach(job => counts[job.status]++);
    await route.fulfill({ json: {
      success: true, enabled, workerEnabled: false, counts, lastSuccessAt: stamp,
      jobs: enabled ? pageJobs : [], nextCursor: pageJobs.length === 2 ? completed.id : null,
    } });
  });
  const page = await ctx.newPage();
  const go = () => page.goto(fixture.url + "/admin/automation");
  await go();
  await page.getByRole("heading", { name: "Order checks" }).waitFor();
  await page.getByText(/supplier fulfilment records differ/).waitFor();
  assert.equal(await page.getByRole("button", { name: /Recheck order/ }).count(), 1);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "overflow at " + width);
  }
  if (process.env.AUTOMATION_SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 1440, height: 1800 });
    await page.evaluate(() => scrollTo(0, 0));
    const dir = path.resolve(process.env.AUTOMATION_SCREENSHOT_DIR);
    await fs.mkdir(dir, { recursive: true });
    await page.locator(".automation-page").screenshot({ path: path.join(dir, "automation-queue.png") });
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("No checks in this view.").waitFor();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("needs_review");
  await page.getByRole("button", { name: /Recheck order/ }).waitFor();
  errorStatus = 409;
  await page.getByRole("button", { name: /Recheck order/ }).click();
  await page.getByRole("alert").filter({hasText: "Check already requeued."}).waitFor();
  errorStatus = 0;
  await page.getByRole("button", { name: /Recheck order/ }).click();
  await page.getByText("Order check queued.").waitFor();
  await page.getByText("No checks in this view.").waitFor();
  await page.getByRole("button", { name: "Process pending checks" }).click();
  await page.getByText("1 check processed.").waitFor();
  await page.getByText("Check an existing order", {exact:true}).click();
  await page.getByLabel("Order database ID").fill(orderId);
  await page.getByRole("button", {name:"Queue order check"}).click();
  await page.getByText("Order check queued.").waitFor();
  assert.equal(requests.filter(x => x.method === "POST").length, 4);
  enabled = false;
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.getByText("Automation is turned off on the server.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Process pending checks" }).count(), 0);
  const count = requests.length;
  role = "customer";
  await go();
  await page.waitForURL(fixture.url + "/");
  assert.equal(requests.length, count);
  console.log("PASS status filtering, pagination, manual processing, scoped retry, stale action recovery, disabled state, non-admin route and responsive layout.");
} finally {
  await browser.close();
  await fixture.server.close();
}
