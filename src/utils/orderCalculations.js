export const FREE_SHIPPING_LIMIT = 500;
export const STANDARD_SHIPPING = 99;
export const EXPRESS_SHIPPING = 199;

export const COUPONS = {
  MIDLAJ: {
    code: "MIDLAJ",
    type: "percentage",
    value: 10,
    minimum: 1000,
  },

  NISHAD: {
    code: "NISHAD",
    type: "fixed",
    value: 200,
    minimum: 1500,
  },

  FAVAS: {
    code: "FAVAS",
    type: "percentage",
    value: 15,
    minimum: 2500,
  },
};

export function calculateSubtotal(cart) {
  return cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );
}

export function calculateCouponDiscount(
  subtotal,
  coupon
) {
  if (!coupon) {
    return 0;
  }

  if (subtotal < coupon.minimum) {
    return 0;
  }

  let discount = 0;

  if (coupon.type === "percentage") {
    discount =
      (subtotal * coupon.value) / 100;
  }

  if (coupon.type === "fixed") {
    discount = coupon.value;
  }

  return Math.min(discount, subtotal);
}

export function calculateShipping(
  amountAfterCoupon,
  deliveryMethod = "standard"
) {
  if (deliveryMethod === "express") {
    return EXPRESS_SHIPPING;
  }

  return amountAfterCoupon >=
    FREE_SHIPPING_LIMIT
    ? 0
    : STANDARD_SHIPPING;
}

export function calculateOrderPricing({
  cart,
  coupon = null,
  deliveryMethod = "standard",
}) {
  const subtotal = calculateSubtotal(cart);

  const couponDiscount =
    calculateCouponDiscount(
      subtotal,
      coupon
    );

  const totalAfterCoupon =
    Math.max(
      subtotal - couponDiscount,
      0
    );

  const shipping = calculateShipping(
    totalAfterCoupon,
    deliveryMethod
  );

  const finalTotal =
    totalAfterCoupon + shipping;

  return {
    subtotal,
    couponDiscount,
    totalAfterCoupon,
    shipping,
    finalTotal,
  };
}