import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useCatalog } from "./CatalogContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import { getCartItemKey, normalizeCartItem, revalidateCart, validateCartItem } from "../utils/cartUtils.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { shoppingKey, readSession, writeSession } from "../utils/shopperStorage.js";
import { resolveCoupon } from "../utils/orderCalculations.js";
const StoreContext = createContext(null);

export default function StoreProvider({ children }) {
  const { products, getLatestProducts } = useCatalog();
  const { user } = useAuth();
  const key = (name) => shoppingKey(name, user);
  const cartKey = key("gymdrobe-cart"), wishlistKey = key("gymdrobe-wishlist"), couponKey = key("gymdrobe-coupon"), buyNowKey = key("gymdrobe-buy-now");
  const restoreCart = () => revalidateCart(readStorage(cartKey, []), products);
  const restoreWishlist = () => {
    const saved = readStorage(wishlistKey, []);
    const ids = new Set((Array.isArray(saved) ? saved : []).filter(Boolean).map(item => String(item.id ?? item)));
    return products.filter(p => ids.has(String(p.id)));
  };
  const [restored] = useState(restoreCart);
  const [cart, setCartState] = useState(restored.cart), cartRef = useRef(cart);
  const [wishlist, setWishlistState] = useState(restoreWishlist);
  const wishlistRef = useRef(wishlist), wishlistMemory = useRef(false);
  const [coupon, setCouponState] = useState(() => resolveCoupon(readStorage(couponKey, null)));
  const [buyNowItem, setBuyNowItem] = useState(() => revalidateCart(readSession(buyNowKey, []), products).cart[0] || null);
  const [toast, setToast] = useState(null), toastId = useRef(0), memoryOnly = useRef(false);
  function notify(message, type = "success") { setToast({ message, type, id: ++toastId.current }); }
  useEffect(() => {
    if (restored.changes.length) notify("Your bag was updated to current prices and available stock.", "info");
  }, [restored]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast?.id]);
  function commitCart(next) {
    const saved = writeStorage(cartKey, next);
    memoryOnly.current = !saved;
    cartRef.current = next;
    setCartState(next);
    if (!saved) notify("Bag updated for this visit. Browser storage is unavailable.", "warning");
    return saved;
  }
  function latestCart() {
    return revalidateCart(memoryOnly.current ? cartRef.current : readStorage(cartKey, cartRef.current), getLatestProducts()).cart;
  }
  useEffect(() => {
    const checked = revalidateCart(cartRef.current, products);
    cartRef.current = checked.cart;
    setCartState(checked.cart);
    if (checked.changes.length) {
      commitCart(checked.cart);
      notify("Your bag was updated to current prices and stock.", "info");
    }
    const next = wishlistRef.current.map(item => products.find(p => String(p.id) === String(item.id))).filter(Boolean);
    wishlistRef.current = next;
    setWishlistState(next);
    setBuyNowItem(current => current ? revalidateCart([current], products).cart[0] || null : null);
  }, [products]);
  useEffect(() => { writeSession(buyNowKey, buyNowItem ? [buyNowItem] : []); }, [buyNowItem, buyNowKey]);
  useEffect(() => {
    function sync(event) {
      if (event.key === cartKey || event.key === null) {
        const next = restoreCart().cart;
        cartRef.current = next; setCartState(next); memoryOnly.current = false;
      }
      if (event.key === wishlistKey || event.key === null) {
        const next = restoreWishlist(); wishlistRef.current = next; setWishlistState(next);
      }
      if (event.key === couponKey || event.key === null) setCouponState(resolveCoupon(readStorage(couponKey, null)));
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [products, cartKey, wishlistKey, couponKey]);
  function setCart(value) {
    const next = typeof value === "function" ? value(latestCart()) : value;
    return commitCart(revalidateCart(next, getLatestProducts()).cart);
  }
  function addToCart(product, quantity = 1, size = null, color = null) {
    const canonical = getLatestProducts().find(p => String(p.id) === String(product?.id));
    const basic = validateCartItem(canonical, quantity, size, color);
    if (!basic.valid) { notify(basic.message, "error"); return false; }
    const rows = latestCart();
    const itemKey = getCartItemKey({ id: canonical.id, selectedSize: size, selectedColor: color });
    const existing = rows.find(row => getCartItemKey(row) === itemKey);
    const total = Number(quantity) + (existing?.quantity || 0);
    const validation = validateCartItem(canonical, total, size, color);
    if (!validation.valid) { notify(validation.message, "error"); return false; }
    const item = normalizeCartItem(canonical, total, size, color);
    commitCart(existing ? rows.map(row => getCartItemKey(row) === itemKey ? item : row) : [...rows, item]);
    notify("Added to your bag.");
    return true;
  }
  function updateQuantity(itemKey, quantity) {
    const rows = latestCart(), row = rows.find(item => getCartItemKey(item) === itemKey);
    if (!row) return;
    const product = getLatestProducts().find(p => String(p.id) === String(row.id));
    const result = validateCartItem(product, quantity, row.selectedSize, row.selectedColor);
    if (!result.valid) { notify(result.message, "error"); return; }
    commitCart(rows.map(item => getCartItemKey(item) === itemKey ? normalizeCartItem(product, Number(quantity), row.selectedSize, row.selectedColor) : item));
  }
  function removeFromCart(itemKey) {
    commitCart(latestCart().filter(item => getCartItemKey(item) !== itemKey));
    notify("Removed from your bag.", "info");
  }
  function toggleWishlist(product) {
    const canonical = products.find(p => String(p.id) === String(product?.id));
    if (!canonical) return false;
    const rows = wishlistMemory.current ? wishlistRef.current : restoreWishlist();
    const exists = rows.some(p => String(p.id) === String(canonical.id));
    const next = exists ? rows.filter(p => String(p.id) !== String(canonical.id)) : [...rows, canonical];
    wishlistRef.current = next; setWishlistState(next);
    const saved = writeStorage(wishlistKey, next.map(({id}) => ({id})));
    wishlistMemory.current = !saved;
    notify(saved ? exists ? "Removed from wishlist." : "Saved to wishlist." : "Wishlist updated for this visit. Browser storage is unavailable.", saved ? "success" : "warning");
    return saved;
  }
  function setCoupon(value) {
    const next = resolveCoupon(value); setCouponState(next);
    writeStorage(couponKey, next ? {code: next.code} : null);
  }
  function buyNow(product, quantity, size, color) {
    const canonical = getLatestProducts().find(p => String(p.id) === String(product?.id));
    const result = validateCartItem(canonical, quantity, size, color);
    if (!result.valid) { notify(result.message, "error"); return false; }
    const item = normalizeCartItem(canonical, quantity, size, color);
    setBuyNowItem(item); writeSession(buyNowKey, [item]); return true;
  }
  function refreshBuyNow(item) { setBuyNowItem(item || null); writeSession(buyNowKey, item ? [item] : []); }
  function clearBuyNow() { refreshBuyNow(null); }
  return <StoreContext.Provider value={{cart, setCart, addToCart, updateQuantity, removeFromCart, wishlist, toggleWishlist, coupon, setCoupon, buyNowItem, buyNow, clearBuyNow, refreshBuyNow, notify, toast, closeToast: () => setToast(null), shoppingKey: key, latestCart}}>{children}</StoreContext.Provider>;
}
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("StoreProvider is missing.");
  return value;
}