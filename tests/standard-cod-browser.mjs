import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";

process.env.VITE_STANDARD_COD_ENABLED = "true";
process.env.VITE_API_URL = "http://127.0.0.1:4296/api";
const fixture = await startStorefrontFixture(4296);
const browser = await chromium.launch({
  executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mock = await mockStorefront(context, fixture.products);
  const gatewayRequests = [];
  context.on("request", request => {
    const url = new URL(request.url());
    if (url.hostname.endsWith(".razorpay.com") || url.pathname.includes("/api/payments/razorpay/")) {
      gatewayRequests.push(url.href);
    }
  });
  const submitted = [];
  const order = {
    ...mock.order, user: null, isGuestOrder: true, status: "confirmed",
    metadata: { version: "cod-1" },
    payment: {
      method: "cod", status: "pending", amountPaid: 0,
      amountDue: mock.order.pricing.finalTotal, totalAmount: mock.order.pricing.finalTotal,
    },
  };
  await context.route("**/api/payments/cod/order", route => {
    submitted.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, order } });
  });
  await context.route("**/api/orders/GD-PREVIEW-001", route =>
    route.fulfill({ json: { success: true, order } }));
  await context.addInitScript(product => {
    if (sessionStorage.getItem("cod-test")) return;
    localStorage.setItem("gymdrobe-cart", JSON.stringify([{
      ...product, selectedSize: "M", selectedColor: "Black", quantity: 1,
    }]));
    sessionStorage.setItem("cod-test", "seeded");
  }, fixture.products[0]);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(fixture.url + "/checkout");
  await page.getByRole("radio", { name: /Cash on delivery/ }).check();
  for (const key of ["fullName", "email", "phone", "addressLine", "pincode", "city", "state"]) {
    await page.locator('input[name="' + key + '"]').fill(mock.address[key]);
  }
  const submit = page.getByRole("button", { name: "Place cash-on-delivery order" });
  await submit.click();
  await page.waitForURL(/order-success/);
  await page.getByRole("heading", { name: "Your order is confirmed!" }).waitFor();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].paymentMethod, "cod");
  assert.equal(submitted[0].expectedTotal, order.payment.amountDue);
  assert.deepEqual(gatewayRequests, []);
  assert.equal(await page.getByText(/your payment is received/i).count(), 0);
  console.log("PASS: guest COD quote and order confirmation at 390 px with no gateway request");
} finally {
  await browser.close();
  await fixture.server.close();
}
