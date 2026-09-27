import {
  getCartItemKey,
  normalizeCartItem,
  validateCartItem,
  getTotalStock,
} from "./cartUtils.js";
import { getDiscountedPrice } from "./productPricing.js";

// Validate the merged destination before changing either variant row.
export function changeBagVariant(cart, key, product, size, color) {
  const old = cart.find((row) => getCartItemKey(row) === key);
  if (!old || String(old.id) !== String(product?.id))
    return { error: "This bag item is no longer available." };
  const nextKey = getCartItemKey({
    id: product.id,
    selectedSize: size,
    selectedColor: color,
  });
  const other =
    nextKey === key
      ? null
      : cart.find((row) => getCartItemKey(row) === nextKey);
  const quantity = old.quantity + (other?.quantity || 0);
  const check = validateCartItem(product, quantity, size, color);
  if (!check.valid) return { error: check.message };
  const item = normalizeCartItem(product, quantity, size, color);
  return {
    cart: [
      ...cart.filter((row) => ![key, nextKey].includes(getCartItemKey(row))),
      item,
    ],
  };
}

export function selectedBag(cart, keys) {
  const selected = new Set(Array.isArray(keys) ? keys : []);
  return cart.filter((item) => selected.has(getCartItemKey(item)));
}

export function productSpecs(product) {
  return Object.entries({
    Brand: product.brand,
    Category: product.category,
    Style: product.subcategory,
    Material: product.material,
    For: product.gender,
    ...(product.specifications || {}),
    SKU: product.sku,
    "In the box": product.whatsIncluded,
  }).filter(([, value]) => value != null && String(value).trim());
}

export function rankRelated(product, catalogue) {
  const score = (item) =>
    5 * Number(item.category === product.category) +
    3 *
      Number(
        Boolean(item.subcategory) && item.subcategory === product.subcategory,
      ) +
    (item.tags || []).filter((tag) => (product.tags || []).includes(tag))
      .length +
    Number(item.brand === product.brand) +
    Number(getTotalStock(item) > 0);
  return catalogue
    .filter((item) => String(item.id) !== String(product.id))
    .sort((a, b) => score(b) - score(a));
}

export function watchChanges(watches, catalogue) {
  return watches.flatMap((watch) => {
    const product = catalogue.find(
      (item) => String(item.id) === String(watch.id),
    );
    if (!product) return [];
    const price = getDiscountedPrice(product);
    const stock = getTotalStock(product);
    const updates = [];
    if (watch.stock === 0 && stock > 0) updates.push("Back in stock");
    if (price < watch.price) updates.push("Price dropped");
    return [{ ...watch, product, priceNow: price, stockNow: stock, updates }];
  });
}

export function deliveredAt(order) {
  const event = [...(order.tracking?.events || [])]
    .reverse()
    .find((e) => e.status === "delivered");
  return (
    order.deliveredAt || order.delivery?.deliveredAt || event?.timestamp || null
  );
}

// A delivered timestamp is required; an order's creation date is not its delivery date.
export function returnEligibility(order, now = Date.now()) {
  if (order.status !== "delivered")
    return {
      eligible: false,
      message: "Returns and exchanges open after delivery.",
    };
  if (
    order.returnRequest?.status &&
    order.returnRequest.status !== "not-requested" &&
    order.returnRequest.status !== "rejected"
  )
    return {
      eligible: false,
      message:
        "A return or exchange request is already recorded for this order.",
    };
  const start = Date.parse(deliveredAt(order));
  if (!Number.isFinite(start) || start > now)
    return {
      eligible: false,
      message:
        "Contact support to confirm the delivery date and return eligibility.",
    };
  const end = start + 7 * 86400000;
  return now <= end
    ? { eligible: true, deadline: new Date(end).toISOString() }
    : {
        eligible: false,
        message:
          "The 7-day request window has ended. Contact support for help.",
      };
}

export function validateReturnItems(order, requested, catalogue, type) {
  if (!Array.isArray(requested) || !requested.length)
    return "Select at least one item.";
  const seen = new Set();
  for (const row of requested) {
    const item = order.items[row.index];
    if (
      !Number.isSafeInteger(row.index) ||
      !item ||
      seen.has(row.index) ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > item.quantity
    )
      return "Choose valid item quantities.";
    if (type === "exchange") {
      const product = catalogue.find((p) => String(p.id) === String(item.id));
      const check = validateCartItem(
        product,
        row.quantity,
        row.size,
        row.color,
      );
      if (!check.valid) return `${item.name}: ${check.message}`;
      if (
        (row.size ?? null) === (item.selectedSize ?? null) &&
        (row.color ?? null) === (item.selectedColor ?? null)
      )
        return "Choose a different size or colour for an exchange.";
    }
    seen.add(row.index);
  }
  return "";
}

export function csvCell(value) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@-]/.test(text) ? "'" : "") +
    text.replaceAll('"', '""') +
    '"'
  );
}

export function downloadText(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}