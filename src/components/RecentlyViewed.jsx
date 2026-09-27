import { useStore } from "../context/StoreContext.jsx";
import { useState } from "react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { readStorage, writeStorage } from "../utils/storage.js";
import ProductRow from "./ProductRow.jsx";
export default function RecentlyViewed({ exclude }) {
  const { shoppingKey } = useStore();
  const { products } = useCatalog();
  const [ids, setIds] = useState(() => {
    const saved = readStorage(shoppingKey("gymdrobe-recently-viewed"), []);
    return Array.isArray(saved) ? saved.map(String) : [];
  });
  const items = ids
    .filter((id) => id !== String(exclude))
    .map((id) => products.find((p) => String(p.id) === id))
    .filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="recent-wrapper">
      <div className="recent-clear">
        <button
          type="button"
          className="text-link"
          onClick={() => {
            if (writeStorage(shoppingKey("gymdrobe-recently-viewed"), [])) setIds([]);
          }}
        >
          Clear recently viewed
        </button>
      </div>
      <ProductRow title="RECENTLY VIEWED" products={items} />
    </section>
  );
}