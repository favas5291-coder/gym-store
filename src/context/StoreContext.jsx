import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useCatalog } from "./CatalogContext.jsx";
import {
  getCartItemKey,
  normalizeCartItem,
  revalidateCart,
  validateCartItem,
} from "../utils/cartUtils.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { resolveCoupon } from "../utils/orderCalculations.js";
const StoreContext = createContext(null);
const initial = (products) =>
  revalidateCart(readStorage("gymdrobe-cart", []), products);
function savedWishlist(products) {
  const saved = readStorage("gymdrobe-wishlist", []);
  const ids = new Set(
    (Array.isArray(saved) ? saved : [])
      .filter(Boolean)
      .map((item) => String(item.id ?? item)),
  );
  return products.filter((item) => ids.has(String(item.id)));
}
function savedBuyNow(products) {
  try {
    return (
      revalidateCart(
        JSON.parse(sessionStorage.getItem("gymdrobe-buy-now") || "[]"),
        products,
      ).cart[0] || null
    );
  } catch {
    return null;
  }
}
export default function StoreProvider({ children }) {
  const { products } = useCatalog();
  const [restored] = useState(() => initial(products));
  const [cart, setCartState] = useState(restored.cart),
    cartRef = useRef(cart);
  const [wishlist, setWishlistState] = useState(() => savedWishlist(products)),
    wishlistRef = useRef(wishlist);
  const [coupon, setCouponState] = useState(() =>
    resolveCoupon(readStorage("gymdrobe-coupon", null)),
  );
  const [buyNowItem, setBuyNowItem] = useState(() => savedBuyNow(products));
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);
  function notify(message, type = "success") {
    setToast({ message, type, id: ++toastId.current });
  }
  useEffect(() => {
    if (restored.changes.length)
      notify(
        "Your bag was updated to current prices and available stock.",
        "info",
      );
  }, [restored]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast?.id]);
  function commitCart(next) {
    cartRef.current = next;
    setCartState(next);
    if (!writeStorage("gymdrobe-cart", next))
      notify(
        "Bag updated for this visit. Browser storage is unavailable.",
        "warning",
      );
  }
  useEffect(() => {
    const checked = revalidateCart(cartRef.current, products);
    if (checked.changes.length) {
      commitCart(checked.cart);
      notify("Your bag was updated to current prices and stock.", "info");
    }
    const nextWishlist = wishlistRef.current
      .map((item) => products.find((p) => String(p.id) === String(item.id)))
      .filter(Boolean);
    wishlistRef.current = nextWishlist;
    setWishlistState(nextWishlist);
  }, [products]);
  function setCart(value) {
    const next = typeof value === "function" ? value(cartRef.current) : value;
    commitCart(revalidateCart(next, products).cart);
  }
  function addToCart(product, quantity = 1, size = null, color = null) {
    const canonical = products.find(
      (p) => String(p.id) === String(product?.id),
    );
    const basic = validateCartItem(canonical, quantity, size, color);
    if (!basic.valid) {
      notify(basic.message, "error");
      return false;
    }
    const key = getCartItemKey({
      id: canonical.id,
      selectedSize: size,
      selectedColor: color,
    });
    const existing = cartRef.current.find(
      (item) => getCartItemKey(item) === key,
    );
    const total = Number(quantity) + (existing?.quantity || 0);
    const validation = validateCartItem(canonical, total, size, color);
    if (!validation.valid) {
      notify(validation.message, "error");
      return false;
    }
    const item = normalizeCartItem(canonical, total, size, color);
    commitCart(
      existing
        ? cartRef.current.map((row) =>
            getCartItemKey(row) === key ? item : row,
          )
        : [...cartRef.current, item],
    );
    notify("Added to your bag.");
    return true;
  }
  function updateQuantity(key, quantity) {
    const row = cartRef.current.find((item) => getCartItemKey(item) === key);
    if (!row) return;
    const product = products.find((p) => String(p.id) === String(row.id));
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
      cartRef.current.map((item) =>
        getCartItemKey(item) === key
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
  function removeFromCart(key) {
    commitCart(cartRef.current.filter((item) => getCartItemKey(item) !== key));
    notify("Removed from your bag.", "info");
  }
  function toggleWishlist(product) {
    const canonical = products.find(
      (p) => String(p.id) === String(product?.id),
    );
    if (!canonical) return;
    const exists = wishlistRef.current.some(
      (p) => String(p.id) === String(canonical.id),
    );
    const next = exists
      ? wishlistRef.current.filter((p) => String(p.id) !== String(canonical.id))
      : [...wishlistRef.current, canonical];
    wishlistRef.current = next;
    setWishlistState(next);
    const saved = writeStorage(
      "gymdrobe-wishlist",
      next.map(({ id }) => ({ id })),
    );
    notify(
      saved
        ? exists
          ? "Removed from wishlist."
          : "Saved to wishlist."
        : "Wishlist updated for this visit. Browser storage is unavailable.",
      saved ? "success" : "warning",
    );
  }
  function setCoupon(value) {
    const next = resolveCoupon(value);
    setCouponState(next);
    writeStorage("gymdrobe-coupon", next ? { code: next.code } : null);
  }
  function buyNow(product, quantity, size, color) {
    const canonical = products.find(
      (p) => String(p.id) === String(product?.id),
    );
    const result = validateCartItem(canonical, quantity, size, color);
    if (!result.valid) {
      notify(result.message, "error");
      return false;
    }
    const item = normalizeCartItem(canonical, quantity, size, color);
    setBuyNowItem(item);
    try {
      sessionStorage.setItem("gymdrobe-buy-now", JSON.stringify([item]));
    } catch {
      /* This visit still works. */
    }
    return true;
  }
  function clearBuyNow() {
    setBuyNowItem(null);
    try {
      sessionStorage.removeItem("gymdrobe-buy-now");
    } catch {
      /* No persisted item. */
    }
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
        notify,
        toast,
        closeToast: () => setToast(null),
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("StoreProvider is missing.");
  return value;
}