import {
  getDiscountedPrice,
  getOriginalPrice,
  number,
} from "./productPricing.js";
export { getDiscountedPrice } from "./productPricing.js";
const count = (value) => Math.max(0, Math.floor(number(value)));
const own = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);
export function getTotalStock(product) {
  if (!product || product.stockStatus === "out-of-stock") return 0;
  const sum = (value) =>
    value && typeof value === "object"
      ? Object.values(value).reduce((n, child) => n + sum(child), 0)
      : count(value);
  return product.variants ? sum(product.variants) : count(product.stock);
}
export function getVariantStock(
  product,
  selectedSize = null,
  selectedColor = null,
) {
  if (!product || product.stockStatus === "out-of-stock") return 0;
  const sizes = (product.sizes || []).map(String),
    colors = (product.colors || []).map(String);
  if (sizes.length && (!selectedSize || !sizes.includes(String(selectedSize))))
    return 0;
  if (
    colors.length &&
    (!selectedColor || !colors.includes(String(selectedColor)))
  )
    return 0;
  if (!product.variants) return count(product.stock);
  let group = product.variants;
  if (colors.length) {
    if (!own(group, selectedColor)) return 0;
    group = group[selectedColor];
  }
  if (sizes.length)
    return own(group, selectedSize) ? count(group[selectedSize]) : 0;
  return typeof group === "object" ? count(group?.default) : count(group);
}
export function firstOptions(product) {
  for (const color of product?.colors?.length ? product.colors : [null]) {
    for (const size of product?.sizes?.length ? product.sizes : [null]) {
      if (getVariantStock(product, size, color) > 0)
        return { selectedColor: color, selectedSize: size };
    }
  }
  return {
    selectedColor: product?.colors?.[0] || null,
    selectedSize: product?.sizes?.[0] || null,
  };
}
export function getCartItemKey(item) {
  return JSON.stringify([
    String(item?.id ?? ""),
    item?.selectedSize == null ? null : String(item.selectedSize),
    item?.selectedColor == null ? null : String(item.selectedColor),
  ]);
}
export function isSameCartItem(a, b) {
  return getCartItemKey(a) === getCartItemKey(b);
}
export function normalizeCartItem(
  product,
  quantity = 1,
  selectedSize = null,
  selectedColor = null,
) {
  return {
    ...product,
    originalPrice: getOriginalPrice(product),
    price: getDiscountedPrice(product),
    quantity: Math.max(1, Math.floor(number(quantity, 1))),
    selectedSize,
    selectedColor,
  };
}
export function validateCartItem(product, quantity, size = null, color = null) {
  const stock = getVariantStock(product, size, color),
    qty = Number(quantity);
  if (!Number.isSafeInteger(qty) || qty < 1)
    return {
      valid: false,
      stock,
      message: "Choose a whole-number quantity of at least 1.",
    };
  if (!stock)
    return {
      valid: false,
      stock,
      message:
        "Choose an available size and colour. This selection is out of stock.",
    };
  if (qty > stock)
    return {
      valid: false,
      stock,
      message: `Only ${stock} available for this selection.`,
    };
  return { valid: true, stock, message: "" };
}
export function revalidateCart(cart, products) {
  const catalogue = new Map(
    (Array.isArray(products) ? products : [])
      .filter(Boolean)
      .map((p) => [String(p.id), p]),
  );
  const rows = new Map(),
    changes = [];
  for (const item of Array.isArray(cart) ? cart : []) {
    if (!item || typeof item !== "object") {
      changes.push({ type: "removed", reason: "Invalid bag item." });
      continue;
    }
    const product = catalogue.get(String(item.id));
    const stock = getVariantStock(
      product,
      item.selectedSize,
      item.selectedColor,
    );
    if (!product || !stock) {
      changes.push({
        type: "removed",
        item,
        reason: "This selection is no longer available.",
      });
      continue;
    }
    const qty = Number(item.quantity);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      changes.push({ type: "removed", item, reason: "Invalid quantity." });
      continue;
    }
    const key = getCartItemKey(item),
      previous = rows.get(key);
    const quantity = Math.min(stock, qty + (previous?.quantity || 0));
    const normalized = normalizeCartItem(
      product,
      quantity,
      item.selectedSize ?? null,
      item.selectedColor ?? null,
    );
    if (previous || quantity !== qty || normalized.price !== item.price)
      changes.push({
        type: "updated",
        item,
        reason: "Bag updated to current price and available stock.",
      });
    rows.set(key, normalized);
  }
  return { cart: [...rows.values()], changes };
}