import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  readStorage,
  writeStorage,
} from "../utils/storage.js";

import ProductRow from "./ProductRow.jsx";

function readHistory(key) {
  const saved = readStorage(key, []);

  if (!Array.isArray(saved)) {
    return [];
  }

  return [
    ...new Set(
      saved
        .filter(
          (value) =>
            typeof value === "string" ||
            typeof value === "number",
        )
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

export default function RecentlyViewed({ exclude }) {
  const { shoppingKey, notify } = useStore();
  const { products } = useCatalog();
  const { pathname } = useLocation();

  const storageKey = shoppingKey(
    "gymdrobe-recently-viewed",
  );

  const [history, setHistory] = useState(() => ({
    key: storageKey,
    ids: readHistory(storageKey),
  }));

  useEffect(() => {
    function refresh() {
      const nextIds = readHistory(storageKey);

      setHistory((current) => {
        const unchanged =
          current.key === storageKey &&
          current.ids.length === nextIds.length &&
          current.ids.every(
            (value, index) => value === nextIds[index],
          );

        return unchanged
          ? current
          : { key: storageKey, ids: nextIds };
      });
    }

    // Read after the page's effects have recorded the visit.
    const timer = window.setTimeout(refresh, 0);

    function handleStorage(event) {
      if (
        event.key === storageKey ||
        event.key === null
      ) {
        refresh();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(
        "storage",
        handleStorage,
      );
    };
  }, [storageKey, pathname, exclude]);

  const items = useMemo(() => {
    if (history.key !== storageKey) {
      return [];
    }

    const catalog = new Map();

    for (const product of Array.isArray(products)
      ? products
      : []) {
      if (product && product.id != null) {
        catalog.set(String(product.id), product);
      }
    }

    const excludedId =
      exclude == null ? null : String(exclude);

    return history.ids
      .filter((id) => id !== excludedId)
      .map((id) => catalog.get(id))
      .filter(Boolean);
  }, [history, storageKey, products, exclude]);

  function clearHistory() {
    const saved = writeStorage(storageKey, []);

    if (!saved) {
      notify(
        "Recently viewed could not be cleared. Browser storage is unavailable.",
        "warning",
      );
      return;
    }

    setHistory({
      key: storageKey,
      ids: [],
    });
  }

  if (!items.length) {
    return null;
  }

  return (
    <section className="recent-wrapper">
      <div className="recent-clear">
        <button
          type="button"
          className="text-link"
          onClick={clearHistory}
        >
          Clear recently viewed
        </button>
      </div>

      <ProductRow
        title="RECENTLY VIEWED"
        products={items}
      />
    </section>
  );
}