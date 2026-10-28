import test from "node:test";
import assert from "node:assert/strict";
import { nativeRouteFromUrl } from "../src/native/platform.js";
import { verifiedNativePaymentShape } from "../src/native/payment.js";

test("native links accept customer pages and retain allowed shop filters", () => {
  assert.equal(nativeRouteFromUrl("gymdrobe://app/product/item-1"), "/product/item-1");
  assert.equal(nativeRouteFromUrl("https://www.gymdrobe.com/orders/order-1/track"), "/orders/order-1/track");
  assert.equal(nativeRouteFromUrl("https://gymdrobe.com/shop?search=shoes&category=Footwear&token=secret&next=https://evil.test"), "/shop?search=shoes&category=Footwear");
  assert.equal(nativeRouteFromUrl("gymdrobe://app/account?token=secret#credentials"), "/account");
});

test("native links cannot inject credentials, checkout results, staff routes or external destinations", () => {
  for (const value of ["javascript:alert(1)", "https://evil.test/orders", "https://gymdrobe.com.evil.test/cart", "https://user@gymdrobe.com/cart", "https://gymdrobe.com:8080/cart", "gymdrobe://evil/cart", "gymdrobe://app/admin", "gymdrobe://app/supplier", "gymdrobe://app/checkout?paid=true", "gymdrobe://app/order-success", "gymdrobe://app/product/a%2fb", "https://gymdrobe.com/product/%5cadmin", "not a URL"]) {
    assert.equal(nativeRouteFromUrl(value), null, value);
  }
});

test("native payment results must belong to the exact gateway order", () => {
  const response = { razorpay_order_id: "order_expected", razorpay_payment_id: "pay_123", razorpay_signature: "a".repeat(64), paid: true, untrusted: "ignored" };
  assert.deepEqual(verifiedNativePaymentShape(response, "order_expected"), { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature });
  assert.throws(() => verifiedNativePaymentShape(response, "order_other"), { code: "RAZORPAY_RESPONSE_INVALID" });
  for (const value of [null, {}, { ...response, razorpay_signature: "" }, { ...response, razorpay_payment_id: 1 }]) {
    assert.throws(() => verifiedNativePaymentShape(value, "order_expected"), { code: "RAZORPAY_RESPONSE_INVALID" });
  }
});
