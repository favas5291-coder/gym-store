import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useCatalog } from "./CatalogContext.jsx";
import { useStore } from "./StoreContext.jsx";
import { readStorage, writeStorage } from "../utils/storage.js";
import { getCartItemKey, getTotalStock } from "../utils/cartUtils.js";
import { latestPurchaseProduct } from "../utils/productPurchase.js";
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
    { changeBagForTransfer, notify, shoppingKey, latestCart } = useStore();
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
  function readSaved() {
    const rows = readStorage(shoppingKey("gymdrobe-saved-for-later"), savedRef.current);
    return Array.isArray(rows) ? rows.filter(item => item && Number.isSafeInteger(item.quantity) && item.quantity > 0) : savedRef.current;
  }
  function commitSaved(next) {
    if (!writeStorage(shoppingKey("gymdrobe-saved-for-later"), next)) {
      notify("Could not update Saved for later. Check browser storage and retry.", "error");
      return false;
    }
    savedRef.current = next;
    setSavedItems(next);
    return true;
  }
  function changeSavedQuantity(item, expected, quantity) {
    const key = getCartItemKey(item);
    const rows = readSaved();
    const current = rows.find(row => getCartItemKey(row) === key);
    if ((current?.quantity || 0) !== expected) {
      notify("The saved quantity changed. Review it before moving this item.", "info");
      return false;
    }
    if (!quantity) return commitSaved(rows.filter(row => getCartItemKey(row) !== key));
    const updated = { ...item, quantity };
    return commitSaved(current
      ? rows.map(row => getCartItemKey(row) === key ? updated : row)
      : [...rows, updated]);
  }
  function removeSaved(key) {
    return commitSaved(readSaved().filter(item => getCartItemKey(item) !== key));
  }
  async function transfer(item, toSaved) {
    if (item.kitGroup || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return;
    const product = latestPurchaseProduct(products, item);
    if (!product) return;
    const savedKey = getCartItemKey(item);
    const bagKey = getCartItemKey({ ...item, id: product.id });
    const move = () => {
      const bag = latestCart().find(row => getCartItemKey(row) === bagKey);
      const saved = readSaved().find(row => getCartItemKey(row) === savedKey);
      const source = toSaved ? bag : saved;
      const destination = toSaved ? saved : bag;
      if (source?.quantity !== item.quantity) {
        notify("This item changed. Review the updated quantity and try again.", "info");
        return;
      }
      const previous = destination?.quantity || 0;
      const total = previous + source.quantity;
      if (!Number.isSafeInteger(total)) {
        notify("The combined quantity is too large.", "error");
        return;
      }
      const updateDestination = toSaved ? changeSavedQuantity : changeBagForTransfer;
      const updateSource = toSaved ? changeBagForTransfer : changeSavedQuantity;
      if (!updateDestination(source, previous, total)) return;
      if (!updateSource(source, source.quantity, 0)) {
        // Compensate just the copied quantity; retain unrelated tab edits.
        const restored = updateDestination(source, total, previous);
        notify(restored
          ? "The move could not be completed. Your item is still in its original list."
          : "This item changed during the move. Review its quantity in both lists before retrying.", "error");
        return;
      }
      notify(toSaved ? "Saved for later." : "Moved to your bag.");
    };
    // Serialize transfers from this account's tabs when Web Locks are available.
    try {
      if (navigator.locks) await navigator.locks.request(shoppingKey("gymdrobe-saved-transfer"), move);
      else move();
    } catch {
      notify("The move was interrupted. Review your bag and saved items before retrying.", "error");
    }
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
        saveForLater: item => transfer(item, true),
        removeSaved,
        moveSavedToBag: item => transfer(item, false),
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