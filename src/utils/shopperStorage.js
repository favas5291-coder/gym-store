import { readStorage, writeStorage, removeStorage, userKey } from "./storage.js";
import { getCartItemKey } from "./cartUtils.js";

// Guest keys stay compatible with older GymDrobe installations.
export const shoppingKey = (base, user) => user ? userKey(base, user) : base;
export const SHOPPING_KEYS = [
  "gymdrobe-cart", "gymdrobe-wishlist", "gymdrobe-coupon",
  "gymdrobe-saved-for-later", "gymdrobe-compare", "gymdrobe-product-watches",
  "gymdrobe-recently-viewed", "gymdrobe-delivery-pincode",
];

// Transfer guest picks only after successful authentication. Keep the guest copy
// if saving fails; never silently discard a customer's shopping list.
export function importGuestShopping(user) {
  if (!user) return;
  for (const base of SHOPPING_KEYS) {
    const guest = readStorage(base, null);
    if (guest == null) continue;
    const account = readStorage(shoppingKey(base, user), null);
    let value = guest;
    if (Array.isArray(guest) && Array.isArray(account)) {
      value = [...account, ...guest];
      if (base === "gymdrobe-cart" || base === "gymdrobe-saved-for-later") {
        const rows = new Map();
        for (const item of value) {
          if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1) continue;
          const key = getCartItemKey(item);
          rows.set(key, {...item, quantity: item.quantity + (rows.get(key)?.quantity || 0)});
        }
        value = [...rows.values()];
      } else {
        value = [...new Map(value.filter(Boolean).map(item => [String(item?.id ?? item), item])).values()];
      }
      if (base === "gymdrobe-compare") value = value.slice(0, 4);
      if (base === "gymdrobe-recently-viewed") value = value.slice(0, 8);
    } else if (account != null) value = account;
    if (writeStorage(shoppingKey(base, user), value)) removeStorage(base);
  }
}

export function readSession(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
export function writeSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}