import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useCatalog } from "./CatalogContext.jsx";
import { useStore } from "./StoreContext.jsx";
import { readStorage, writeStorage } from "../utils/storage.js";
import { getCartItemKey, getTotalStock } from "../utils/cartUtils.js";
import { getDiscountedPrice } from "../utils/productPricing.js";
const ToolsContext = createContext(null);
const array = (key) => {
  const value = readStorage(key, []);
  return Array.isArray(value) ? value.filter(Boolean) : [];
};
function selection(key) {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) || "[]",
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
export default function ShoppingToolsProvider({ children }) {
  const { products } = useCatalog(),
    { cart, setCart, addToCart, notify, shoppingKey, latestCart } = useStore();
  const [compareIds, setCompareIds] = useState(() =>
    array(shoppingKey("gymdrobe-compare")).map(String).slice(0, 4),
  );
  const [savedItems, setSavedItems] = useState(() =>
    array(shoppingKey("gymdrobe-saved-for-later")).filter(
      (item) =>
        item.id != null &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0,
    ),
  );
  const savedRef = useRef(savedItems);
  const [watches, setWatches] = useState(() =>
    array(shoppingKey("gymdrobe-product-watches")).filter(
      (w) =>
        w.id != null && Number.isFinite(w.price) && Number.isFinite(w.stock),
    ),
  );
  const [checkoutKeys, setCheckoutKeys] = useState(() => selection(shoppingKey("gymdrobe-checkout-selection")));
  useEffect(() => {
    function sync(event) {
      if (event.key === shoppingKey("gymdrobe-compare") || event.key === null)
        setCompareIds(array(shoppingKey("gymdrobe-compare")).map(String).slice(0, 4));
      if (event.key === shoppingKey("gymdrobe-saved-for-later") || event.key === null) {
        const next = array(shoppingKey("gymdrobe-saved-for-later")).filter(item => item.id != null && Number.isSafeInteger(item.quantity) && item.quantity > 0);
        savedRef.current = next; setSavedItems(next);
      }
      if (event.key === shoppingKey("gymdrobe-product-watches") || event.key === null)
        setWatches(array(shoppingKey("gymdrobe-product-watches")).filter(item => item.id != null && Number.isFinite(item.price) && Number.isFinite(item.stock)));
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [shoppingKey("gymdrobe-compare")]);
  const compared = compareIds
    .map((id) => products.find((p) => String(p.id) === id))
    .filter(Boolean);
  function toggleCompare(product) {
    const id = String(product.id),
      exists = compareIds.includes(id);
    if (!exists && compared.length >= 4) {
      notify("Compare up to 4 products. Remove one to add another.", "info");
      return;
    }
    const next = exists
      ? compareIds.filter((v) => v !== id)
      : [...compared.map((p) => String(p.id)), id];
    setCompareIds(next);
    writeStorage(shoppingKey("gymdrobe-compare"), next);
    notify(exists ? "Removed from comparison." : "Added to comparison.");
  }
  function commitSaved(next) {
    if (!writeStorage(shoppingKey("gymdrobe-saved-for-later"), next)) {
      notify("Could not save these items. Your bag has been kept.", "error");
      return false;
    }
    savedRef.current = next;
    setSavedItems(next);
    return true;
  }
  function saveForLater(keys) {
    const chosen = new Set(keys),
      moving = latestCart().filter((item) => chosen.has(getCartItemKey(item)));
    if (!moving.length) return;
    const rows = new Map(
      array(shoppingKey("gymdrobe-saved-for-later")).map((item) => [getCartItemKey(item), item]),
    );
    moving.forEach((item) => {
      const key = getCartItemKey(item),
        previous = rows.get(key);
      rows.set(key, {
        ...item,
        quantity: (previous?.quantity || 0) + item.quantity,
      });
    });
    if (commitSaved([...rows.values()])) {
      setCart(current => current.filter((item) => !chosen.has(getCartItemKey(item))));
      notify("Saved for later.");
    }
  }
  function removeSaved(key) {
    commitSaved(
      savedRef.current.filter((item) => getCartItemKey(item) !== key),
    );
  }
  function moveSavedToBag(item) {
    const product = products.find((p) => String(p.id) === String(item.id));
    if (
      addToCart(product, item.quantity, item.selectedSize, item.selectedColor)
    )
      removeSaved(getCartItemKey(item));
  }
  function watchProduct(product) {
    const exists = watches.some((w) => String(w.id) === String(product.id));
    const next = exists
      ? watches.filter((w) => String(w.id) !== String(product.id))
      : [
          ...watches,
          {
            id: product.id,
            price: getDiscountedPrice(product),
            stock: getTotalStock(product),
            createdAt: new Date().toISOString(),
          },
        ];
    if (!writeStorage(shoppingKey("gymdrobe-product-watches"), next)) {
      notify("Unable to save this watch.", "error");
      return;
    }
    setWatches(next);
    notify(
      exists
        ? "Product watch removed."
        : "Watching price and availability on this device.",
    );
  }
  function startSelection(keys) {
    const next = [...new Set(keys)];
    setCheckoutKeys(next);
    try {
      sessionStorage.setItem(
        shoppingKey("gymdrobe-checkout-selection"),
        JSON.stringify(next),
      );
    } catch {
      /* Works for this visit. */
    }
  }
  return (
    <ToolsContext.Provider
      value={{
        compared,
        toggleCompare,
        savedItems,
        saveForLater,
        removeSaved,
        moveSavedToBag,
        watches,
        watchProduct,
        checkoutKeys,
        startSelection,
      }}
    >
      {children}
    </ToolsContext.Provider>
  );
}
export const useShoppingTools = () => {
  const context = useContext(ToolsContext);
  if (!context) throw new Error("ShoppingToolsProvider is missing.");
  return context;
};