// ==========================================
// PRODUCT PRICING UTILITIES
// ==========================================

// ------------------------------------------
// GET DISCOUNTED / SELLING PRICE
// ------------------------------------------

export function getDiscountedPrice(product) {
  const price = Number(product?.price || 0);
  const discount = Number(product?.discount || 0);

  if (price <= 0) {
    return 0;
  }

  if (discount <= 0) {
    return Math.round(price);
  }

  const discountedPrice =
    price - (price * discount) / 100;

  return Math.round(discountedPrice);
}

// ------------------------------------------
// GET ORIGINAL PRICE
// ------------------------------------------

export function getOriginalPrice(product) {
  return Math.round(
    Number(product?.price || 0)
  );
}

// ------------------------------------------
// GET DISCOUNT AMOUNT
// ------------------------------------------

export function getDiscountAmount(product) {
  const originalPrice =
    getOriginalPrice(product);

  const sellingPrice =
    getDiscountedPrice(product);

  return Math.max(
    originalPrice - sellingPrice,
    0
  );
}

// ------------------------------------------
// GET DISCOUNT PERCENTAGE
// ------------------------------------------

export function getDiscountPercentage(product) {
  return Math.max(
    Number(product?.discount || 0),
    0
  );
}