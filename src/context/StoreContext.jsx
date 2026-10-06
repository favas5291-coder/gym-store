import { commercePayload, trackEvent } from "../utils/analytics.js";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useCatalog } from "./CatalogContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import {
  getCartItemKey,
  normalizeCartItem,
  revalidateCart,
  validateCartItem,
} from "../utils/cartUtils.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import {
  shoppingKey,
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";
import { resolveCoupon } from "../utils/orderCalculations.js";
const StoreContext = createContext(null);
function readArray(key) {
  const saved = readStorage(key, []);
  return Array.isArray(saved) ? saved.filter(Boolean) : [];
}
function readBuyNow(key) {
  const saved = readSession(key, []);
  return Array.isArray(saved) ? saved[0] || null : null;
}
function resolveWishlist(saved, products) {
  const ids = new Set(
    saved.filter(Boolean).map((item) => String(item.id ?? item)),
  );
  return products.filter((product) =>
    [product.id, product._id, product.legacyId]
      .filter((id) => id != null)
      .some((id) => ids.has(String(id))),
  );
}
export default function StoreProvider({ children }) {
  const { products, loading, error, getLatestProducts } = useCatalog();
  const { user } = useAuth();
  const key = (name) => shoppingKey(name, user);
  const cartKey = key("gymdrobe-cart");
  const wishlistKey = key("gymdrobe-wishlist");
  const couponKey = key("gymdrobe-coupon");
  const buyNowKey = key("gymdrobe-buy-now");
  const catalogReady = !loading && !error;
  // Restore saved data without checking an unfinished catalog.
  const [cart, setCartState] = useState(() => readArray(cartKey));
  const cartRef = useRef(cart);
  const memoryOnly = useRef(false);
  const [wishlist, setWishlistState] = useState([]);
  const wishlistRef = useRef(wishlist);
  const wishlistMemory = useRef(false);
  const [coupon, setCouponState] = useState(() =>
    resolveCoupon(readStorage(couponKey, null)),
  );
  const [buyNowItem, setBuyNowItem] = useState(() => readBuyNow(buyNowKey));
  const buyNowRef = useRef(buyNowItem);
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);
  function notify(message, type = "success") {
    setToast({ message, type, id: ++toastId.current });
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast?.id]);
  function requireCatalog() {
    if (catalogReady) return true;
    notify(
      error
        ? "Products could not be loaded. Please retry before changing your bag."
        : "Products are loading. Please wait a moment.",
      error ? "error" : "info",
    );
    return false;
  }
  function commitCart(next) {
    const saved = writeStorage(cartKey, next);
    memoryOnly.current = !saved;
    cartRef.current = next;
    setCartState(next);
    if (!saved) {
      notify(
        "Bag updated for this visit. Browser storage is unavailable.",
        "warning",
      );
    }
    return saved;
  }
  function latestCart() {
    const saved = memoryOnly.current
      ? cartRef.current
      : readStorage(cartKey, cartRef.current);
    const rows = Array.isArray(saved) ? saved.filter(Boolean) : [];
    // A failed or pending catalog must not remove saved items.
    if (!catalogReady) return rows;
    return revalidateCart(rows, getLatestProducts()).cart;
  }
  function refreshBuyNow(item) {
    const next = item || null;
    buyNowRef.current = next;
    setBuyNowItem(next);
    writeSession(buyNowKey, next ? [next] : []);
  }
  function clearBuyNow() {
    refreshBuyNow(null);
  }
  // Reconcile only after a successful catalog response.
  // A successfully loaded empty catalog is still authoritative.
  useEffect(() => {
    if (!catalogReady) return;
    const savedCart = memoryOnly.current
      ? cartRef.current
      : readStorage(cartKey, cartRef.current);
    const checked = revalidateCart(savedCart, products);
    cartRef.current = checked.cart;
    setCartState(checked.cart);
    if (checked.changes.length) {
      if (commitCart(checked.cart)) {
        notify(
          "Your bag was updated to current prices and available stock.",
          "info",
        );
      }
    }
    const savedWishlist = wishlistMemory.current
      ? wishlistRef.current
      : readArray(wishlistKey);
    const nextWishlist = resolveWishlist(savedWishlist, products);
    wishlistRef.current = nextWishlist;
    setWishlistState(nextWishlist);
    const nextBuyNow = buyNowRef.current
      ? revalidateCart([buyNowRef.current], products).cart[0] || null
      : null;
    refreshBuyNow(nextBuyNow);
  }, [catalogReady, products, cartKey, wishlistKey, buyNowKey]);
  // Keep other browser tabs in sync without validating against
  // a catalog that is still loading.
  useEffect(() => {
    function sync(event) {
      if (event.key === cartKey || event.key === null) {
        const saved = readArray(cartKey);
        const checked = catalogReady
          ? revalidateCart(saved, products)
          : { cart: saved, changes: [] };
        memoryOnly.current = false;
        cartRef.current = checked.cart;
        setCartState(checked.cart);
        if (catalogReady && checked.changes.length) {
          commitCart(checked.cart);
        }
      }
      if (event.key === wishlistKey || event.key === null) {
        wishlistMemory.current = false;
        if (catalogReady) {
          const next = resolveWishlist(readArray(wishlistKey), products);
          wishlistRef.current = next;
          setWishlistState(next);
        }
      }
      if (event.key === couponKey || event.key === null) {
        setCouponState(resolveCoupon(readStorage(couponKey, null)));
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [catalogReady, products, cartKey, wishlistKey, couponKey]);
  function setCart(value) {
    if (!requireCatalog()) return false;
    const next = typeof value === "function" ? value(latestCart()) : value;
    return commitCart(revalidateCart(next, getLatestProducts()).cart);
  }
  function addToCart(product, quantity = 1, size = null, color = null) {
    if (!requireCatalog()) return false;
    const canonical = getLatestProducts().find(
      (item) => String(item.id) === String(product?.id),
    );
    const basic = validateCartItem(canonical, quantity, size, color);
    if (!basic.valid) {
      notify(basic.message, "error");
      return false;
    }
    const rows = latestCart();
    const itemKey = getCartItemKey({
      id: canonical.id,
      selectedSize: size,
      selectedColor: color,
    });
    const existing = rows.find((row) => getCartItemKey(row) === itemKey);
    const total = Number(quantity) + (existing?.quantity || 0);
    const validation = validateCartItem(canonical, total, size, color);
    if (!validation.valid) {
      notify(validation.message, "error");
      return false;
    }
    const item = normalizeCartItem(canonical, total, size, color);
    const saved = commitCart(
      existing
        ? rows.map((row) => (getCartItemKey(row) === itemKey ? item : row))
        : [...rows, item],
    );
    trackEvent(
      "add_to_cart",
      commercePayload([{ ...item, quantity: Number(quantity) }]),
    );
    if (saved) notify("Added to your bag.");
    // Adding still succeeds in memory if browser storage fails.
    return true;
  }
  function updateQuantity(itemKey, quantity) {
    if (!requireCatalog()) return;
    const rows = latestCart();
    const row = rows.find((item) => getCartItemKey(item) === itemKey);
    if (!row) return;
    const product = getLatestProducts().find(
      (item) => String(item.id) === String(row.id),
    );
    const result = validateCartItem(
      product,
      quantity,
      row.selectedSize,
      row.selectedColor,
    );
    if (!result.valid) {
      notify(result.message, "error");
      return;
    }
    commitCart(
      rows.map((item) =>
        getCartItemKey(item) === itemKey
          ? normalizeCartItem(
              product,
              Number(quantity),
              row.selectedSize,
              row.selectedColor,
            )
          : item,
      ),
    );
  }
  function removeFromCart(itemKey) {
    if (!requireCatalog()) return;
    if (
      commitCart(
        latestCart().filter((item) => getCartItemKey(item) !== itemKey),
      )
    ) {
      notify("Removed from your bag.", "info");
    }
  }
  function toggleWishlist(product) {
    if (!requireCatalog()) return false;
    const latestProducts = getLatestProducts();
    const canonical = latestProducts.find(
      (item) => String(item.id) === String(product?.id),
    );
    if (!canonical) return false;
    const rows = wishlistMemory.current
      ? wishlistRef.current
      : resolveWishlist(readArray(wishlistKey), latestProducts);
    const exists = rows.some(
      (item) => String(item.id) === String(canonical.id),
    );
    const next = exists
      ? rows.filter((item) => String(item.id) !== String(canonical.id))
      : [...rows, canonical];
    wishlistRef.current = next;
    setWishlistState(next);
    const saved = writeStorage(
      wishlistKey,
      next.map(({ id }) => ({ id })),
    );
    wishlistMemory.current = !saved;
    notify(
      saved
        ? exists
          ? "Removed from wishlist."
          : "Saved to wishlist."
        : "Wishlist updated for this visit. Browser storage is unavailable.",
      saved ? "success" : "warning",
    );
    return saved;
  }
  function setCoupon(value) {
    const next = resolveCoupon(value);
    setCouponState(next);
    writeStorage(couponKey, next ? { code: next.code } : null);
  }
  function buyNow(product, quantity, size, color) {
    if (!requireCatalog()) return false;
    const canonical = getLatestProducts().find(
      (item) => String(item.id) === String(product?.id),
    );
    const result = validateCartItem(canonical, quantity, size, color);
    if (!result.valid) {
      notify(result.message, "error");
      return false;
    }
    refreshBuyNow(normalizeCartItem(canonical, quantity, size, color));
    return true;
  }
  return (
    <StoreContext.Provider
      value={{
        cart,
        setCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        wishlist,
        toggleWishlist,
        coupon,
        setCoupon,
        buyNowItem,
        buyNow,
        clearBuyNow,
        refreshBuyNow,
        notify,
        toast,
        closeToast: () => setToast(null),
        shoppingKey: key,
        latestCart,
        catalogReady,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("StoreProvider is missing.");
  }
  return value;
}
