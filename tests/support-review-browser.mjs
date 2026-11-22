import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mockStorefront, startStorefrontFixture } from "./storefront-fixture.mjs";

process.env.VITE_API_URL = "http://127.0.0.1:4386/api";
const fixture = await startStorefrontFixture(4386);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { user } = await mockStorefront(context, fixture.products, { signedIn: true });
  let role = "admin";
  await context.route("**/api/auth/me", route =>
    route.fulfill({ json: { success: true, user: { ...user, role } } }));
  let supportsReview = true;
  const requests = [];
  await context.route("**/api/support/admin/tickets**", async route => {
    const request = route.request();
    const query = new URL(request.url()).searchParams;
    requests.push(query.toString());
    assert.equal(request.method(), "GET");
    assert.equal(request.headers().authorization, "Bearer fixture-token-not-a-real-credential");
    assert.ok(!(query.has("review") && query.has("status")));
    const review = supportsReview && query.get("review");
    const subject = review === "first-reply" ? "Awaiting first reply" : "Ordinary ticket";
    const tickets = review === "unresolved-month" ? [] : [{
      id: "a".repeat(24), subject, category: "other", email: "fixture@example.test",
      status: "open", createdAt: "2026-01-10T02:30:00Z", updatedAt: "2026-01-13T02:30:00Z",
    }];
    return route.fulfill({ json: { success: true, review, tickets, pages: 1 } });
  });
  const page = await context.newPage();
  await page.goto(fixture.url + "/admin/support");
  const view = page.getByLabel("Inbox view");
  await page.getByRole("heading", { name: "Ordinary ticket" }).waitFor();
  await view.selectOption("review:first-reply");
  await page.getByRole("heading", { name: "Awaiting first reply" }).waitFor();
  await page.getByText(/^Opened /).waitFor();
  assert.equal(requests.at(-1), "page=1&review=first-reply");
  await view.selectOption("review:unresolved-month");
  await page.getByText("No requests in this view.").waitFor();
  assert.equal(requests.at(-1), "page=1&review=unresolved-month");
  supportsReview = false;
  await view.selectOption("review:first-reply");
  await page.getByRole("alert").filter({ hasText: "selected support review queue" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Ordinary ticket" }).count(), 0);
  await view.selectOption("open");
  await page.getByRole("heading", { name: "Ordinary ticket" }).waitFor();
  assert.equal(requests.at(-1), "page=1&status=open");
  role = "customer";
  const previous = requests.length;
  await page.goto(fixture.url + "/admin/support");
  await page.waitForURL(fixture.url + "/");
  assert.equal(await view.count(), 0);
  assert.equal(requests.length, previous);
  console.log("PASS support inbox review queues, empty state, legacy API, regular statuses and admin access.");
} finally {
  await browser.close();
  await fixture.server.close();
}
