import { useId, useMemo, useState } from "react";

import { useCatalog } from "../context/CatalogContext.jsx";
import { filterProducts } from "../utils/catalog.js";

import ProductCard from "./ProductCard.jsx";

const PAGE_SIZE = 8;

const COLLECTIONS = [
  ["", "All gear"],
  ["featured", "Featured"],
  ["bestsellers", "Bestsellers"],
  ["new", "New arrivals"],
];

export default function CollectionBrowser() {
  const { products } = useCatalog();

  const [collection, setCollection] = useState("");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);

  const generatedId = useId();
  const headingId = `${generatedId}-heading`;
  const resultsId = `${generatedId}-results`;

  const result = useMemo(
    () =>
      filterProducts(
        Array.isArray(products) ? products : [],
        new URLSearchParams({ collection, sort }),
      ),
    [products, collection, sort],
  );

  const pages = Math.max(
    1,
    Math.ceil(result.length / PAGE_SIZE),
  );

  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const visibleProducts = result.slice(
    start,
    start + PAGE_SIZE,
  );

  function chooseCollection(value) {
    setCollection(value);
    setPage(1);
  }

  function changeSort(event) {
    setSort(event.target.value);
    setPage(1);
  }

  return (
    <section
      className="gm-section collection-browser"
      aria-labelledby={headingId}
    >
      <div className="gm-section-head">
        <h2 id={headingId}>
          FIND YOUR NEXT FAVOURITE
        </h2>
      </div>

      <div className="browse-controls">
        <div
          className="choice-tabs"
          role="group"
          aria-label="Choose a collection"
        >
          {COLLECTIONS.map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={collection === value}
              aria-controls={resultsId}
              onClick={() => chooseCollection(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="sort-label">
          Sort by{" "}
          <select
            value={sort}
            onChange={changeSort}
            aria-controls={resultsId}
          >
            <option value="recommended">
              Recommended
            </option>
            <option value="price-low">
              Price: Low to high
            </option>
            <option value="price-high">
              Price: High to low
            </option>
            <option value="rating">
              Customer rating
            </option>
            <option value="newest">
              New arrivals
            </option>
          </select>
        </label>
      </div>

      <p
        className="muted"
        role="status"
        aria-atomic="true"
      >
        {result.length
          ? `Showing ${start + 1}–${
              start + visibleProducts.length
            } of ${result.length} products. Page ${current} of ${pages}.`
          : "No products in this collection yet."}
      </p>

      <div id={resultsId}>
        {visibleProducts.length > 0 && (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <nav
          className="pagination"
          aria-label="Collection pages"
        >
          <button
            type="button"
            disabled={current === 1}
            aria-controls={resultsId}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>

          <span>
            {current} / {pages}
          </span>

          <button
            type="button"
            disabled={current === pages}
            aria-controls={resultsId}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}