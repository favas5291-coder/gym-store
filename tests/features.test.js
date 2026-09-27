import test from "node:test";
import assert from "node:assert/strict";
import {
  changeBagVariant,
  selectedBag,
  productSpecs,
  rankRelated,
  watchChanges,
  returnEligibility,
  validateReturnItems,
  csvCell,
} from "../src/utils/commerce.js";
import { applyReservations, advanceOrder } from "../src/utils/inventory.js";
import {
  getCartItemKey,
  getVariantStock,
  normalizeCartItem,
} from "../src/utils/cartUtils.js";
import { filterProducts } from "../src/utils/catalog.js";
const p = {
  id: 1,
  name: "Training Tee",
  price: 1000,
  discount: 10,
  category: "Workout Clothes",
  subcategory: "T-Shirts",
  brand: "GymDrobe",
  gender: "Men",
  sizes: ["S", "M"],
  colors: ["Black", "Blue"],
  variants: { Black: { S: 5, M: 3 }, Blue: { S: 0, M: 2 } },
  highlights: ["Breathable"],
  specifications: { Fit: "Regular" },
  careInstructions: ["Cold wash"],
  whatsIncluded: "One tee",
};
const item = (size, quantity = 1, color = "Black") =>
  normalizeCartItem(p, quantity, size, color);
test("variant edits merge existing rows atomically and reject aggregate overstock", () => {
  const cart = [item("S", 2), item("M", 1)],
    key = getCartItemKey(cart[0]);
  const result = changeBagVariant(cart, key, p, "M", "Black");
  assert.equal(result.cart.length, 1);
  assert.equal(result.cart[0].quantity, 3);
  assert.equal(result.cart[0].price, 900);
  const tooMany = [item("S", 3), item("M", 1)];
  assert.match(
    changeBagVariant(tooMany, getCartItemKey(tooMany[0]), p, "M", "Black")
      .error,
    /Only 3/,
  );
  assert.equal(tooMany.length, 2);
});
test("selected checkout keeps only explicit variant keys", () => {
  const cart = [item("S"), item("M")];
  assert.deepEqual(selectedBag(cart, [getCartItemKey(cart[1])]), [cart[1]]);
  assert.deepEqual(selectedBag(cart, null), []);
});
test("preview order reservations reduce exactly the matching variants and cancellation releases them", () => {
  const order = {
    status: "confirmed",
    metadata: { inventoryReserved: true },
    items: [item("S", 2)],
  };
  const [reserved] = applyReservations([p], [order]);
  assert.equal(getVariantStock(reserved, "S", "Black"), 3);
  assert.equal(getVariantStock(reserved, "M", "Black"), 3);
  assert.equal(p.variants.Black.S, 5);
  assert.equal(
    getVariantStock(
      applyReservations([p], [{ ...order, status: "cancelled" }])[0],
      "S",
      "Black",
    ),
    5,
  );
  assert.equal(
    getVariantStock(
      applyReservations([p], [{ ...order, metadata: {} }])[0],
      "S",
      "Black",
    ),
    5,
  );
});
test("order progress cannot skip shipping or fabricate payment collection", () => {
  const order = {
    status: "confirmed",
    payment: { status: "pending" },
    tracking: { events: [] },
  };
  assert.throws(() => advanceOrder(order, "delivered"), /transition/);
  const processing = advanceOrder(order, "processing");
  assert.throws(() => advanceOrder(processing, "shipped"), /carrier/);
  const shipped = advanceOrder(processing, "shipped", {
    carrier: "Test carrier",
    trackingNumber: "TEST-1",
  });
  const delivered = advanceOrder(
    advanceOrder(shipped, "out-for-delivery"),
    "delivered",
    {},
    "2026-09-26T12:00:00.000Z",
  );
  assert.equal(delivered.payment.status, "pending");
  assert.equal(delivered.deliveredAt, "2026-09-26T12:00:00.000Z");
  assert.equal(delivered.tracking.events.length, 4);
});
test("return window uses confirmed delivery date and rejects missing, future, expired and duplicate requests", () => {
  const now = Date.parse("2026-09-26T12:00:00Z"),
    order = { status: "delivered", deliveredAt: "2026-09-23T12:00:00Z" };
  assert.equal(returnEligibility(order, now).eligible, true);
  for (const testOrder of [
    { status: "confirmed" },
    { status: "delivered" },
    { ...order, deliveredAt: "2026-10-01" },
    { ...order, deliveredAt: "2026-09-01" },
    { ...order, returnRequest: { status: "requested" } },
  ])
    assert.equal(returnEligibility(testOrder, now).eligible, false);
});
test("item-level exchange validates chosen replacement and quantities", () => {
  const order = { items: [item("S", 2)] };
  assert.equal(
    validateReturnItems(
      order,
      [{ index: 0, quantity: 1, size: "M", color: "Black" }],
      [p],
      "exchange",
    ),
    "",
  );
  assert.match(
    validateReturnItems(
      order,
      [{ index: 0, quantity: 1, size: "S", color: "Black" }],
      [p],
      "exchange",
    ),
    /different/,
  );
  assert.match(
    validateReturnItems(
      order,
      [{ index: 0, quantity: 1, size: "S", color: "Blue" }],
      [p],
      "exchange",
    ),
    /out of stock/,
  );
  assert.match(
    validateReturnItems(order, [{ index: 0, quantity: 3 }], [p], "return"),
    /quantities/,
  );
  assert.match(
    validateReturnItems(
      order,
      [
        { index: 0, quantity: 1 },
        { index: 0, quantity: 1 },
      ],
      [p],
      "return",
    ),
    /quantities/,
  );
});
test("in-stock filters require an available colour-size combination", () => {
  assert.equal(
    filterProducts(
      [p],
      new URLSearchParams("availability=in-stock&size=S&color=Blue"),
    ).length,
    0,
  );
  assert.equal(
    filterProducts(
      [p],
      new URLSearchParams("availability=in-stock&size=M&color=Blue&gender=Men"),
    ).length,
    1,
  );
});
test("product watches identify actual price drops and stock restoration", () => {
  const [update] = watchChanges([{ id: 1, price: 1000, stock: 0 }], [p]);
  assert.deepEqual(update.updates, ["Back in stock", "Price dropped"]);
  assert.equal(
    watchChanges([{ id: 1, price: 900, stock: 10 }], [p])[0].updates.length,
    0,
  );
});
test("complete supplied specifications and related relevance are retained", () => {
  assert.ok(
    productSpecs(p).some(
      ([key, value]) => key === "In the box" && value === "One tee",
    ),
  );
  const related = rankRelated(p, [
    { id: 2, name: "Bottle", category: "Bottles" },
    { ...p, id: 3 },
  ]);
  assert.equal(related[0].id, 3);
});
test("CSV export quotes embedded delimiters and neutralizes formula-leading cells", () => {
  assert.equal(csvCell('A,"B"'), '"A,""B"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell("  +SUM(1,2)"), '"\'  +SUM(1,2)"');
});