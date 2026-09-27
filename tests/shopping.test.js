import test from "node:test";
import assert from "node:assert/strict";
import {
  getTotalStock,
  getVariantStock,
  normalizeCartItem,
  revalidateCart,
  validateCartItem,
} from "../src/utils/cartUtils.js";
import { getDiscountedPrice } from "../src/utils/productPricing.js";
import {
  calculateOrderPricing,
  calculateCouponDiscount,
  calculateShipping,
} from "../src/utils/orderCalculations.js";
import { filterProducts } from "../src/utils/catalog.js";
import {
  addressErrors,
  getOrders,
  ownerKey,
  persistOrder,
} from "../src/utils/customerData.js";
const tee = {
  id: 1,
  name: "Training tee",
  category: "Clothing",
  brand: "GymDrobe",
  price: 799,
  discount: 10,
  stock: 999,
  sizes: ["S", "M"],
  colors: ["Black", "White"],
  variants: { Black: { S: 3, M: 0 }, White: { S: 2, M: 5 } },
  isBestSeller: true,
};
const shoes = {
  id: 2,
  name: "Gym shoes",
  category: "Shoes",
  brand: "GymDrobe",
  price: 2499,
  discount: 10,
  stock: 8,
  isNew: true,
};
test("variant stock overrides stale product totals and unavailable options", () => {
  assert.equal(getTotalStock(tee), 10);
  assert.equal(getVariantStock(tee, "M", "Black"), 0);
  assert.equal(getVariantStock(tee, "S", "Black"), 3);
  assert.equal(getTotalStock({ ...tee, stockStatus: "out-of-stock" }), 0);
});
test("cart rejects fractional, infinite, empty and over-stock quantities", () => {
  for (const n of [0, -1, 1.5, Infinity, NaN, ""])
    assert.equal(validateCartItem(tee, n, "S", "Black").valid, false);
  assert.equal(validateCartItem(tee, 4, "S", "Black").valid, false);
  assert.equal(validateCartItem(tee, 3, "S", "Black").valid, true);
});
test("revalidation reprices from catalogue once and is stable across refreshes", () => {
  const first = normalizeCartItem(tee, 2, "S", "Black");
  assert.equal(first.price, 719);
  const once = revalidateCart([first], [tee]).cart;
  const twice = revalidateCart(once, [tee]).cart;
  assert.deepEqual(once, twice);
  assert.equal(twice[0].price, 719);
  assert.equal(calculateOrderPricing({ cart: twice }).subtotal, 1438);
});
test("duplicate variant rows are merged and aggregate quantity is capped", () => {
  const rows = [
    normalizeCartItem(tee, 2, "S", "Black"),
    normalizeCartItem(tee, 2, "S", "Black"),
  ];
  const result = revalidateCart(rows, [tee]);
  assert.equal(result.cart.length, 1);
  assert.equal(result.cart[0].quantity, 3);
  assert.ok(result.changes.length);
});
test("malformed and retired bag rows cannot reach checkout", () => {
  const result = revalidateCart(
    [
      null,
      {},
      { id: 999, quantity: 1 },
      { ...normalizeCartItem(tee, 1, "M", "Black") },
      { ...normalizeCartItem(tee, 1, "S", "Black"), quantity: 1.5 },
    ],
    [tee],
  );
  assert.deepEqual(result.cart, []);
});
test("cart and checkout use the same canonical coupon and cent rounding", () => {
  const cart = [normalizeCartItem(tee, 2, "S", "Black")];
  const result = calculateOrderPricing({
    cart,
    coupon: { code: "MIDLAJ", value: 100 },
  });
  assert.equal(result.couponDiscount, 143.8);
  assert.equal(result.finalTotal, 1294.2);
  assert.equal(calculateCouponDiscount(999, "MIDLAJ"), 0);
  assert.equal(calculateCouponDiscount(1000, "NOT_REAL"), 0);
});
test("shipping thresholds use the total after coupons, express is separate and empty bags cost zero", () => {
  assert.equal(calculateShipping(499.99), 99);
  assert.equal(calculateShipping(500), 0);
  assert.equal(calculateShipping(500, "express"), 199);
  assert.equal(calculateOrderPricing({ cart: [] }).finalTotal, 0);
});
test("invalid prices and discounts cannot produce negative or nonfinite prices", () => {
  assert.equal(getDiscountedPrice({ price: 100, discount: 200 }), 0);
  assert.equal(getDiscountedPrice({ price: 100, discount: -10 }), 100);
  assert.equal(getDiscountedPrice({ price: "bad", discount: 10 }), 0);
});
test("bestseller and new-arrival links follow flags, and price sorting follows selling prices", () => {
  const data = [tee, shoes];
  assert.deepEqual(
    filterProducts(data, new URLSearchParams("collection=bestsellers")).map(
      (p) => p.id,
    ),
    [1],
  );
  assert.deepEqual(
    filterProducts(data, new URLSearchParams("collection=new")).map(
      (p) => p.id,
    ),
    [2],
  );
  assert.deepEqual(
    filterProducts(data, new URLSearchParams("sort=price-high")).map(
      (p) => p.id,
    ),
    [2, 1],
  );
  assert.deepEqual(
    filterProducts(data, new URLSearchParams("search=gym%20shoes")).map(
      (p) => p.id,
    ),
    [2],
  );
});
test("delivery form catches invalid Indian phone and pincode formats", () => {
  const address = {
    fullName: "Demo customer",
    email: "customer@example.com",
    phone: "9876543210",
    addressLine: "123 Example Street",
    city: "Kozhikode",
    state: "Kerala",
    pincode: "673001",
  };
  assert.deepEqual(addressErrors(address), {});
  assert.ok(
    addressErrors({ ...address, phone: "123", pincode: "000000" }).phone,
  );
  assert.ok(addressErrors({ ...address, pincode: "000000" }).pincode);
});
test("order lists keep separate account and guest records", () => {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
  const alice = { id: "alice", email: "alice@example.com" },
    bob = { id: "bob", email: "bob@example.com" };
  const base = {
    createdAt: "2026-01-01",
    items: [{ id: 1, name: "Tee", quantity: 1, price: 719 }],
  };
  persistOrder({ ...base, id: "a", ownerKey: ownerKey(alice) });
  persistOrder({ ...base, id: "b", ownerKey: ownerKey(bob) });
  persistOrder({ ...base, id: "g", ownerKey: ownerKey(null) });
  assert.deepEqual(
    getOrders(alice).map((o) => o.id),
    ["a"],
  );
  assert.deepEqual(
    getOrders(bob).map((o) => o.id),
    ["b"],
  );
  assert.deepEqual(
    getOrders(null).map((o) => o.id),
    ["g"],
  );
  delete globalThis.localStorage;
});