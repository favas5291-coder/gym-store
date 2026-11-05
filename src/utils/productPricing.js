export function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
export function roundMoney(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100;
}
export function marketplaceVariantPrice(product,size,color){
  if(!Array.isArray(product?.variantPrices)||!product.variantPrices.length)return null;
  size=size===undefined?product.selectedSize:size;color=color===undefined?product.selectedColor:color;
  const row=size===undefined&&color===undefined?[...product.variantPrices].sort((a,b)=>a.customerUnitAmount-b.customerUnitAmount)[0]:product.variantPrices.find(r=>(r.size||null)===(size||null)&&(r.color||null)===(color||null));
  return row&&Number.isSafeInteger(row.customerUnitAmount)&&row.customerUnitAmount>0?row:null;
}
export function getOriginalPrice(product,size,color) {
  const variant=marketplaceVariantPrice(product,size,color);if(variant)return (variant.mrpUnitAmount??variant.customerUnitAmount)/100;
  return Math.max(0, Math.round(number(product?.price)));
}
export function getDiscountPercentage(product,size,color) {
  const variant=marketplaceVariantPrice(product,size,color);if(variant)return variant.mrpUnitAmount?Math.max(0,100*(1-variant.customerUnitAmount/variant.mrpUnitAmount)):0;
  return Math.min(100, Math.max(0, number(product?.discount)));
}
// Product prices round to whole rupees, preserving your existing catalogue pricing.
export function getDiscountedPrice(product,size,color) {
  const variant=marketplaceVariantPrice(product,size,color);if(variant)return variant.customerUnitAmount/100;
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
