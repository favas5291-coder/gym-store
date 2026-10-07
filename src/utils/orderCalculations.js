import { number, roundMoney } from "./productPricing.js";

export const FREE_SHIPPING_LIMIT = 500;
export const STANDARD_SHIPPING = 99;
export const EXPRESS_SHIPPING = 199;

export const COUPONS = Object.freeze({
  GYM10: Object.freeze({
    code: "GYM10",
    type: "percentage",
    value: 10,
    minimum: 1000,
  }),

  GEAR200: Object.freeze({
    code: "GEAR200",
    type: "fixed",
    value: 200,
    minimum: 1500,
  }),

  TRAIN15: Object.freeze({
    code: "TRAIN15",
    type: "percentage",
    value: 15,
    minimum: 2500,
  }),
});

export function resolveCoupon(coupon) {
  const code = String(
    typeof coupon === "string"
      ? coupon
      : coupon?.code || ""
  )
    .trim()
    .toUpperCase();

  return Object.prototype.hasOwnProperty.call(COUPONS, code)
    ? COUPONS[code]
    : null;
}

export function calculateSubtotal(cart = []) {
  const items = Array.isArray(cart) ? cart : [];

  return roundMoney(
    items.reduce((sum, item) => {
      const quantity = number(item?.quantity);

      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        return sum;
      }

      return (
        sum +
        Math.max(0, number(item?.price)) * quantity
      );
    }, 0)
  );
}

export function calculateCouponDiscount(subtotal, coupon) {
  const valid = resolveCoupon(coupon);
  const amount = Math.max(0, number(subtotal));

  if (!valid || amount < valid.minimum) {
    return 0;
  }

  const discount =
    valid.type === "fixed"
      ? valid.value
      : (amount * valid.value) / 100;

  return roundMoney(Math.min(amount, discount));
}

export function calculateShipping(
  amountAfterCoupon,
  deliveryMethod = "standard"
) {
  if (deliveryMethod === "express") {
    return EXPRESS_SHIPPING;
  }

  return number(amountAfterCoupon) >= FREE_SHIPPING_LIMIT
    ? 0
    : STANDARD_SHIPPING;
}

export function calculateOrderPricing({
  cart = [],
  coupon = null,
  deliveryMethod = "standard",
} = {}) {
  const subtotal = calculateSubtotal(cart);

  const couponDiscount = calculateCouponDiscount(
    subtotal,
    coupon
  );

  const totalAfterCoupon = roundMoney(
    Math.max(0, subtotal - couponDiscount)
  );

  const shipping =
    Array.isArray(cart) && cart.length > 0
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