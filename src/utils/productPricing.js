export function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
export function roundMoney(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100;
}
// Before all options are chosen, show the lowest price matching the current
// selection. Once both axes are set, only that variant can supply its price.
export function marketplaceVariantPrice(product, size = product?.selectedSize, color = product?.selectedColor) {
  const prices = product?.variantPrices;
  if (!Array.isArray(prices)) return null;

  function matches(selected, value, options) {
    if (selected === undefined) return true;
    if (selected === null || selected === "") return !value || Boolean(options?.length);
    return value === selected;
  }

  let lowest = null;
  for (const row of prices) {
    const amount = row?.customerUnitAmount;
    const mrp = row?.mrpUnitAmount ?? amount;
    if (!Number.isSafeInteger(amount) || amount <= 0 ||
        !Number.isSafeInteger(mrp) || mrp < amount) continue;
    if (!matches(size, row.size, product.sizes) || !matches(color, row.color, product.colors)) continue;
    if (!lowest || amount < lowest.customerUnitAmount) lowest = row;
  }
  return lowest;
}

export function getOriginalPrice(product, size, color) {
  if (product?.variantPrices?.length) {
    const variant = marketplaceVariantPrice(product, size, color);
    return variant ? (variant.mrpUnitAmount ?? variant.customerUnitAmount) / 100 : NaN;
  }
  return Math.max(0, Math.round(number(product?.price)));
}

export function getDiscountPercentage(product, size, color) {
  if (product?.variantPrices?.length) {
    const variant = marketplaceVariantPrice(product, size, color);
    if (!variant?.mrpUnitAmount) return 0;
    const savings = Math.max(0, variant.mrpUnitAmount - variant.customerUnitAmount);
    return Math.round(savings * 10000 / variant.mrpUnitAmount) / 100;
  }
  return Math.min(100, Math.max(0, number(product?.discount)));
}

export function getDiscountedPrice(product, size, color) {
  if (product?.variantPrices?.length) {
    const variant = marketplaceVariantPrice(product, size, color);
    return variant ? variant.customerUnitAmount / 100 : NaN;
  }
  // Legacy catalogue prices round to whole rupees.
  return Math.round(getOriginalPrice(product) * (1 - getDiscountPercentage(product) / 100));
}
export function getDiscountAmount(product) {
  return getOriginalPrice(product) - getDiscountedPrice(product);
}
export function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(number(value));
}
