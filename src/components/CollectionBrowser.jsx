import { useState } from "react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { filterProducts } from "../utils/catalog.js";
import ProductCard from "./ProductCard.jsx";
export default function CollectionBrowser() {
  const { products } = useCatalog();
  const [collection, setCollection] = useState(""),
    [sort, setSort] = useState("recommended"),
    [page, setPage] = useState(1);
  const result = filterProducts(
      products,
      new URLSearchParams({ collection, sort }),
    ),
    pages = Math.max(1, Math.ceil(result.length / 8)),
    current = Math.min(page, pages);
  return (
    <section
      className="gm-section collection-browser"
      aria-labelledby="collection-browser-title"
    >
      <div className="gm-section-head">
        <h2 id="collection-browser-title">FIND YOUR NEXT FAVOURITE</h2>
      </div>
      <div className="browse-controls">
        <div className="choice-tabs" aria-label="Choose a collection">
          {[
            ["", "All gear"],
            ["featured", "Featured"],
            ["bestsellers", "Bestsellers"],
            ["new", "New arrivals"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={collection === value}
              onClick={() => {
                setCollection(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="sort-label">
          Sort by{" "}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="recommended">Recommended</option>
            <option value="price-low">Price: Low to high</option>
            <option value="price-high">Price: High to low</option>
            <option value="rating">Customer rating</option>
            <option value="newest">New arrivals</option>
          </select>
        </label>
      </div>
      <p className="muted" aria-live="polite">
        {result.length} products in this collection
      </p>
      {result.length ? (
        <div className="product-grid">
          {result.slice((current - 1) * 8, current * 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p>No products in this collection yet.</p>
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="Collection pages">
          <button disabled={current === 1} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}