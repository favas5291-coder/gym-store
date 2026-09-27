import { number, roundMoney } from "./productPricing.js";
export const FREE_SHIPPING_LIMIT = 500;
export const STANDARD_SHIPPING = 99;
export const EXPRESS_SHIPPING = 199;
export const COUPONS = Object.freeze({
  MIDLAJ: { code: "MIDLAJ", type: "percentage", value: 10, minimum: 1000 },
  NISHAD: { code: "NISHAD", type: "fixed", value: 200, minimum: 1500 },
  FAVAS: { code: "FAVAS", type: "percentage", value: 15, minimum: 2500 },
});
export function resolveCoupon(coupon) {
  return (
    COUPONS[
      String(typeof coupon === "string" ? coupon : coupon?.code || "")
        .trim()
        .toUpperCase()
    ] || null
  );
}
export function calculateSubtotal(cart = []) {
  return roundMoney(
    (Array.isArray(cart) ? cart : []).reduce((sum, item) => {
      const quantity = number(item?.quantity);
      return (
        sum +
        (Number.isSafeInteger(quantity) && quantity > 0
          ? Math.max(0, number(item?.price)) * quantity
          : 0)
      );
    }, 0),
  );
}
export function calculateCouponDiscount(subtotal, coupon) {
  const valid = resolveCoupon(coupon),
    amount = Math.max(0, number(subtotal));
  if (!valid || amount < valid.minimum) return 0;
  return roundMoney(
    Math.min(
      amount,
      valid.type === "fixed" ? valid.value : (amount * valid.value) / 100,
    ),
  );
}
export function calculateShipping(
  amountAfterCoupon,
  deliveryMethod = "standard",
) {
  return deliveryMethod === "express"
    ? EXPRESS_SHIPPING
    : number(amountAfterCoupon) >= FREE_SHIPPING_LIMIT
      ? 0
      : STANDARD_SHIPPING;
}
export function calculateOrderPricing({
  cart = [],
  coupon = null,
  deliveryMethod = "standard",
} = {}) {
  const subtotal = calculateSubtotal(cart),
    couponDiscount = calculateCouponDiscount(subtotal, coupon);
  const totalAfterCoupon = roundMoney(Math.max(0, subtotal - couponDiscount));
  const shipping =
    Array.isArray(cart) && cart.length
      ? calculateShipping(totalAfterCoupon, deliveryMethod)
      : 0;
  return {
    subtotal,
    couponDiscount,
    totalAfterCoupon,
    shipping,
    finalTotal: roundMoney(totalAfterCoupon + shipping),
  };
}