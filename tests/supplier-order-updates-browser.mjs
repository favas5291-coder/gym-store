import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fixtureOrderId, fixtureProductId, mockStorefront, startStorefrontFixture } from "./storefront-fixture.mjs";
const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
process.env.VITE_API_URL = "http://127.0.0.1:4262/api";
const fixture = await startStorefrontFixture(4262);
const output = process.env.GYMDROBE_QA_OUTPUT || "test-results/supplier-order-updates";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.GYMDROBE_CHROMIUM ? { executablePath: process.env.GYMDROBE_CHROMIUM, args: ["--no-sandbox"] } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const products = fixture.products.map((p, index) => index === 0 ? { ...p, publicFulfilmentName: "Fixture Athletics" } : p);
  const { order } = await mockStorefront(context, products, { signedIn: true });
  await context.route("**/api/payments/checkout/quote", async route => {
    const payload = route.request().postDataJSON();
    const subtotal = 550 * payload.items.reduce((sum, row) => sum + row.quantity, 0);
    const shipping = 79;
    const finalTotal = subtotal + shipping;
    const advance = payload.paymentMethod === "cod-partial" ? subtotal / 10 : finalTotal;
    return route.fulfill({ json: { success: true, quote: {
      previewOnly: true, purchaseEnabled: false, inventoryReserved: false, shippingIsEstimate: true,
      method: payload.deliveryMethod, items: payload.items.map(row => ({
        product: row.id, selectedSize: row.selectedSize, selectedColor: row.selectedColor,
        quantity: row.quantity, name: "Training shirt", price: 550, publicFulfilmentName: "Fixture Athletics",
        priceAllocation: { quantity: row.quantity, lineSubtotalPaise: 55000 * row.quantity,
          kitDiscountPaise: 0, couponDiscountPaise: 0, linePaidPaise: 55000 * row.quantity,
          unitBasePaise: 55000, extraPaiseUnits: 0 },
      })), kitSnapshots: [],
      pricing: { currency: "INR", subtotal, kitDiscount: 0, couponDiscount: 0, totalAfterCoupon: subtotal, shipping, finalTotal },
      payment: { method: payload.paymentMethod, amountToPayNow: advance, amountDue: finalTotal - advance, advancePercentage: payload.paymentMethod === "cod-partial" ? 10 : 0 },
      deliveryReview: { ready: true, items: [] },
    } } });
  });
  const orderUpdates = [
    { id: "package-shipped", at: "2026-11-12T09:00:00Z", message: "Fixture Athletics has shipped your training shirt via Fixture Courier.", unread: true, orderNumber: order.orderNumber },
    { id: "confirmed", at: "2026-11-11T09:00:00Z", message: "Your GymDrobe order is confirmed. See your order details for confirmed package assignments.", unread: false, orderNumber: order.orderNumber },
  ];
  const split = {
    ...order, items: [...order.items, { ...order.items[0], name: "Training bag" }],
    supplierShipments: [
      { key: "a", itemIndices: [0], publicFulfilmentName: "Fixture Athletics", status: "shipped", carrier: "Fixture Courier", trackingNumber: "FIXTURE001", trackingUrl: "https://example.test/track", estimatedDeliveryAt: "2026-11-16T00:00:00Z" },
      { key: "b", itemIndices: [1], publicFulfilmentName: "Fixture Bags", status: "preparing" },
    ], orderUpdates,
  };
  let legacy = false;
  await context.route("**/api/orders/updates", route => route.fulfill({ json: { success: true, updates: orderUpdates } }));
  await context.route(`**/api/orders/${fixtureOrderId}`, route => route.fulfill({ json: { success: true, order: legacy ? order : split } }));
  await context.route(`**/api/orders/${order.orderNumber}/updates/read`, route => {
    assert.equal(route.request().method(), "PUT");
    assert.equal(route.request().postDataJSON().eventId, "package-shipped");
    orderUpdates[0].unread = false;
    return route.fulfill({ json: { success: true } });
  });
  const page = await context.newPage();
  await page.goto(`${fixture.url}/product/${fixtureProductId}`);
  await page.getByText("Ships from Fixture Athletics").waitFor();
  await page.locator("#delivery-returns").screenshot({ path: output + "/product-supplier.png" });
  await page.getByRole("button", { name: "Colour Black", exact: true }).first().click();
  await page.getByRole("button", { name: "Size M", exact: true }).first().click();
  await page.getByRole("button", { name: "Buy Now", exact: true }).click();
  await page.waitForURL("**/checkout?mode=buy-now");
  await page.getByLabel("Pincode", { exact: true }).fill("673001");
  await page.getByText("Ships from Fixture Athletics").waitFor();
  await page.goto(`${fixture.url}/orders/${fixtureOrderId}/track`);
  const shipment = page.getByRole("region", { name: "Shipment details" });
  await shipment.getByText("Shipped by Fixture Athletics").waitFor();
  await shipment.getByText("Ships from Fixture Bags").waitFor();
  assert.equal(await shipment.getByRole("link", { name: "Track this shipment" }).getAttribute("href"), "https://example.test/track");
  await shipment.screenshot({ path: output + "/split-order-tracking.png" });
  const timeline = page.getByRole("region", { name: "Order updates" });
  await timeline.getByText(/has shipped your training shirt/).waitFor();
  await timeline.screenshot({ path: output + "/order-timeline.png" });
  await page.goto(`${fixture.url}/notifications`);
  const inbox = page.getByRole("region", { name: "Order inbox" });
  await inbox.getByText("New", { exact: true }).waitFor();
  await inbox.getByRole("button", { name: "Mark read through this update" }).click();
  await inbox.getByText("New", { exact: true }).waitFor({ state: "hidden" });
  legacy = true;
  await page.goto(`${fixture.url}/orders/${fixtureOrderId}/track`);
  await page.getByText("Supplier details unavailable.").waitFor();
  console.log("PASS product supplier, split package tracking, order timeline, inbox read state and legacy fallback");
} finally {
  await browser.close();
  await fixture.server.close();
}
