import { getCartItemKey, revalidateCart } from "./cartUtils.js";
import { calculateOrderPricing } from "./orderCalculations.js";
import { allOrders, ownerKey, persistOrder } from "./customerData.js";
import { readStorage } from "./storage.js";

export function checkoutSignature(items, coupon, deliveryMethod) {
  return JSON.stringify({
    items: items.map(item => [getCartItemKey(item), item.quantity, item.price]).sort((a,b) => a[0].localeCompare(b[0])),
    pricing: calculateOrderPricing({cart: items, coupon, deliveryMethod}),
    deliveryMethod,
  });
}

// This lock coordinates tabs on this browser only. A live shop must move this
// validation, idempotency check and stock reservation to a database transaction.
export async function commitCheckout(order, getLatestProducts) {
  const commit = () => {
    if (order.ownerKey !== ownerKey(readStorage("gymdrobe-user", null)))
      throw new Error("Your sign-in changed. Review checkout again with the current account.");
    const existing = allOrders().find(item => item.ownerKey === order.ownerKey && item.metadata?.checkoutToken === order.metadata?.checkoutToken);
    if (existing) return {order: existing, existing: true};
    const checked = revalidateCart(order.items, getLatestProducts());
    if (!checked.cart.length || checked.changes.length)
      return {cart: checked.cart, error: "Prices or availability changed. Your selection is updated below. Review it before placing your order."};
    const pricing = calculateOrderPricing({cart: checked.cart, coupon: order.coupon, deliveryMethod: order.deliveryMethod});
    if (pricing.finalTotal !== order.pricing.finalTotal)
      return {cart: checked.cart, error: "Your total changed. Please review the updated order."};
    if (!persistOrder(order)) throw new Error("Your order could not be saved. Your bag has been kept. Enable browser storage and try again.");
    return {order};
  };
  if (globalThis.navigator?.locks?.request)
    return navigator.locks.request("gymdrobe-order-checkout", commit);
  // No async work between validation and write; this also supports unit tests.
  return commit();
}