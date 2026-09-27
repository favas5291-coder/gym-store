export function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
export function roundMoney(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100;
}
export function getOriginalPrice(product) {
  return Math.max(0, Math.round(number(product?.price)));
}
export function getDiscountPercentage(product) {
  return Math.min(100, Math.max(0, number(product?.discount)));
}
// Product prices round to whole rupees, preserving your existing catalogue pricing.
export function getDiscountedPrice(product) {
  return Math.round(
    getOriginalPrice(product) * (1 - getDiscountPercentage(product) / 100),
  );
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