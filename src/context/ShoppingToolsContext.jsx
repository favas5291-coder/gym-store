import { createContext, useContext, useState } from "react";
import { useCatalog } from "./CatalogContext.jsx";
import { useStore } from "./StoreContext.jsx";
import { getCartItemKey } from "../utils/cartUtils.js";
import { readStorage, writeStorage } from "../utils/storage.js";

const ShoppingToolsContext = createContext(null);

function productsByIds(ids, products) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => products.find((product) => String(product.id) === String(id)))
    .filter(Boolean);
}

export default function ShoppingToolsProvider({ children }) {
  const { products } = useCatalog();
  const store = useStore();
  const [comparedIds, setComparedIds] = useState(() =>
    readStorage("gymdrobe-compared", []).map(String),
  );
  const [savedItems, setSavedItems] = useState(() =>
    readStorage("gymdrobe-saved-items", []),
  );
  const [watches, setWatches] = useState(() =>
    readStorage("gymdrobe-watches", []),
  );
  const [checkoutKeys, setCheckoutKeys] = useState([]);
  const compared = productsByIds(comparedIds, products);

  function persist(key, value) {
    writeStorage(key, value);
  }
  function toggleCompare(product) {
    const id = String(product?.id);
    if (!id || id === "undefined") return;
    const next = comparedIds.includes(id)
      ? comparedIds.filter((value) => value !== id)
      : comparedIds.length < 4
        ? [...comparedIds, id]
        : comparedIds;
    setComparedIds(next);
    persist("gymdrobe-compared", next);
  }
  function watchProduct(product) {
    const id = String(product?.id);
    const next = watches.some((watch) => String(watch.id) === id)
      ? watches.filter((watch) => String(watch.id) !== id)
      : [
          ...watches,
          { id, price: Number(product.price || 0), stock: Number(product.stock || 0) },
        ];
    setWatches(next);
    persist("gymdrobe-watches", next);
  }
  function saveForLater(keys) {
    const selected = store.cart.filter((item) =>
      (Array.isArray(keys) ? keys : []).includes(getCartItemKey(item)),
    );
    if (!selected.length) return;
    const next = [
      ...savedItems.filter(
        (item) => !selected.some((row) => getCartItemKey(row) === getCartItemKey(item)),
      ),
      ...selected,
    ];
    setSavedItems(next);
    persist("gymdrobe-saved-items", next);
    store.setCart((cart) =>
      cart.filter((item) => !selected.some((row) => getCartItemKey(row) === getCartItemKey(item))),
    );
    store.notify("Saved for later.");
  }
  function removeSaved(key) {
    const next = savedItems.filter((item) => getCartItemKey(item) !== key);
    setSavedItems(next);
    persist("gymdrobe-saved-items", next);
  }
  function moveSavedToBag(item) {
    if (!store.addToCart(item, item.quantity, item.selectedSize, item.selectedColor)) return;
    removeSaved(getCartItemKey(item));
  }
  function startSelection(keys) {
    setCheckoutKeys(Array.isArray(keys) ? keys : []);
  }
  return (
    <ShoppingToolsContext.Provider
      value={{
        compared,
        toggleCompare,
        watches,
        watchProduct,
        savedItems,
        saveForLater,
        removeSaved,
        moveSavedToBag,
        checkoutKeys,
        startSelection,
      }}
    >
      {children}
    </ShoppingToolsContext.Provider>
  );
}

export function useShoppingTools() {
  const value = useContext(ShoppingToolsContext);
  if (!value) throw new Error("ShoppingToolsProvider is missing.");
  return value;
}
