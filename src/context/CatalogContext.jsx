import { allOrders } from "../utils/customerData.js";
import { applyReservations, reservedQuantity } from "../utils/inventory.js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import seedProducts from "../data/products.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { getTotalStock } from "../utils/cartUtils.js";
const CatalogContext = createContext(null);
const KEY = "gymdrobe-catalog-preview-v3";

function restore() {
  const saved = readStorage(KEY, []);
  if (!Array.isArray(saved)) return seedProducts;
  const edits = new Map(
    saved
      .filter(
        (p) =>
          p &&
          p.id &&
          typeof p.name === "string" &&
          Number.isFinite(p.price) &&
          p.price >= 0,
      )
      .map((p) => [String(p.id), p]),
  );
  const merged = seedProducts.map((p) => ({
    ...p,
    ...(edits.get(String(p.id)) || {}),
    image: edits.get(String(p.id))?.customImage || p.image,
    images: edits.get(String(p.id))?.customImage
      ? [edits.get(String(p.id)).customImage]
      : p.images,
  }));
  return [
    ...merged,
    ...[...edits.values()].filter(
      (p) => !seedProducts.some((s) => String(s.id) === String(p.id)),
    ),
  ];
}
export default function CatalogProvider({ children }) {
  const [baseProducts, setProducts] = useState(restore);
  const [revision, setRevision] = useState(0);
  const products = useMemo(
    () => applyReservations(baseProducts, allOrders()),
    [baseProducts, revision],
  );
  useEffect(() => {
    const sync = (event) => {
      if (event.key === KEY || event.key === null) setProducts(restore());
      if (event.key === "gymdrobe-orders" || event.key === null) setRevision((n) => n + 1);
    };
    const update = () => setRevision((n) => n + 1);
    window.addEventListener("gymdrobe-orders-updated", update);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("gymdrobe-orders-updated", update);
    };
  }, []);
  function saveProduct(product) {
    if (
      !product.id ||
      !String(product.name || "").trim() ||
      !Number.isFinite(product.price) ||
      product.price < 0 ||
      !Number.isFinite(product.discount) ||
      product.discount < 0 ||
      product.discount > 100
    )
      return false;
    const stockValid = (value) =>
      value && typeof value === "object"
        ? Object.values(value).every(stockValid)
        : Number.isSafeInteger(value) && value >= 0;
    if (!stockValid(product.variants || product.stock)) return false;
    const nextProduct = {
      ...product,
      variants: product.variants
        ? structuredClone(product.variants)
        : undefined,
    };
    // The editor accepts available stock. Restore the ledger base before applying reservations again.
    const orders = allOrders();
    if (nextProduct.variants) {
      for (const color of product.colors?.length ? product.colors : [null]) {
        for (const size of product.sizes?.length ? product.sizes : [null]) {
          const group = color
            ? nextProduct.variants[color]
            : nextProduct.variants;
          if (group && typeof group === "object") {
            const key = size || "default";
            group[key] =
              Number(group[key] || 0) +
              reservedQuantity(orders, product, size, color);
          }
        }
      }
    } else nextProduct.stock += reservedQuantity(orders, product, null, null);
    nextProduct.stock = getTotalStock(nextProduct);
    const next = baseProducts.some((p) => String(p.id) === String(product.id))
      ? baseProducts.map((p) =>
          String(p.id) === String(product.id) ? nextProduct : p,
        )
      : [...baseProducts, nextProduct];
    if (!writeStorage(KEY, next)) return false;
    setProducts(next);
    return true;
  }
  return (
    <CatalogContext.Provider value={{ products, saveProduct, getLatestProducts: () => applyReservations(restore(), allOrders()) }}>
      {children}
    </CatalogContext.Provider>
  );
}
export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("CatalogProvider is missing.");
  return context;
}