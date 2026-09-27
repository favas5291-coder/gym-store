import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import categories from "../data/categories.js";
import { filterProducts } from "../utils/catalog.js";
import ProductCard from "./ProductCard.jsx";
import Modal from "./Modal.jsx";
const PAGE_SIZE = 12;
function Filters({ params, change, reset }) {
  const { products } = useCatalog();
  const [min, setMin] = useState(params.get("minPrice") || ""),
    [max, setMax] = useState(params.get("maxPrice") || ""),
    [error, setError] = useState("");
  useEffect(() => {
    setMin(params.get("minPrice") || "");
    setMax(params.get("maxPrice") || "");
  }, [params.get("minPrice"), params.get("maxPrice")]);
  const scoped = products.filter(
    (p) => !params.get("category") || p.category === params.get("category"),
  );
  function toggle(key, value) {
    const list = (params.get(key) || "").split(",").filter(Boolean);
    change({
      [key]: list.includes(value)
        ? list.filter((v) => v !== value).join(",")
        : [...list, value].join(","),
    });
  }
  return (
    <div className="filter-content">
      <div className="filter-heading">
        <strong>FILTERS</strong>
        <button type="button" className="text-link" onClick={reset}>
          Clear all
        </button>
      </div>
      <fieldset>
        <legend>CATEGORIES</legend>
        {categories.map((cat) => (
          <label className="check" key={cat.name}>
            <input
              type="checkbox"
              checked={params.get("category") === cat.name}
              onChange={() =>
                change({
                  category: params.get("category") === cat.name ? "" : cat.name,
                  subcategory: "",
                  size: "",
                  color: "",
                })
              }
            />
            <span>{cat.name}</span>
            <small>
              ({products.filter((p) => p.category === cat.name).length})
            </small>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>PRODUCT TYPE</legend>
        {[...new Set(scoped.map((p) => p.subcategory).filter(Boolean))].map(
          (value) => (
            <label className="check" key={value}>
              <input
                type="checkbox"
                checked={params.get("subcategory") === value}
                onChange={() =>
                  change({
                    subcategory:
                      params.get("subcategory") === value ? "" : value,
                  })
                }
              />
              <span>{value}</span>
              <small>
                ({scoped.filter((p) => p.subcategory === value).length})
              </small>
            </label>
          ),
        )}
      </fieldset>
      <fieldset>
        <legend>PRICE</legend>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (min !== "" && max !== "" && Number(min) > Number(max)) {
              setError("Minimum must be below maximum.");
              return;
            }
            setError("");
            change({ minPrice: min, maxPrice: max });
          }}
        >
          <div className="price-inputs">
            <label>
              Min ₹
              <input
                aria-label="Minimum price"
                type="number"
                min="0"
                value={min}
                onChange={(event) => setMin(event.target.value)}
              />
            </label>
            <label>
              Max ₹
              <input
                aria-label="Maximum price"
                type="number"
                min="0"
                value={max}
                onChange={(event) => setMax(event.target.value)}
              />
            </label>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button secondary compact full">
            Apply price
          </button>
        </form>
      </fieldset>
      {[
        ["brand", "BRAND", "brand"],
        ["gender", "FOR", "gender"],
        ["size", "SIZE", "sizes"],
        ["color", "COLOUR", "colors"],
      ].map(([key, label, field]) => {
        const options = [
          ...new Set(
            scoped
              .flatMap((p) =>
                Array.isArray(p[field]) ? p[field].map(String) : [p[field]],
              )
              .filter(Boolean),
          ),
        ];
        return (
          options.length > 0 && (
            <fieldset key={key}>
              <legend>{label}</legend>
              {options.map((value) => (
                <label className="check" key={value}>
                  <input
                    type="checkbox"
                    checked={(params.get(key) || "").split(",").includes(value)}
                    onChange={() => toggle(key, value)}
                  />
                  <span>{value}</span>
                  <small>
                    (
                    {
                      scoped.filter((p) =>
                        Array.isArray(p[field])
                          ? p[field].map(String).includes(value)
                          : p[field] === value,
                      ).length
                    }
                    )
                  </small>
                </label>
              ))}
            </fieldset>
          )
        );
      })}
      <fieldset>
        <legend>AVAILABILITY</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={params.get("availability") === "in-stock"}
            onChange={() =>
              change({
                availability: params.get("availability") ? "" : "in-stock",
              })
            }
          />
          In stock only
        </label>
      </fieldset>
      <fieldset>
        <legend>RATING</legend>
        {[4, 3].map((n) => (
          <label className="check" key={n}>
            <input
              type="radio"
              name="minimum-rating"
              checked={params.get("rating") === String(n)}
              onChange={() => change({ rating: String(n) })}
            />
            {n} ★ & above
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>DISCOUNT</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(params.get("discount"))}
            onChange={() =>
              change({ discount: params.get("discount") ? "" : "10" })
            }
          />
          10% and above
        </label>
      </fieldset>
    </div>
  );
}
export default function ProductSection() {
  const { products } = useCatalog();
  const [params, setParams] = useSearchParams(),
    [drawer, setDrawer] = useState(false);
  const result = filterProducts(products, params),
    pages = Math.max(1, Math.ceil(result.length / PAGE_SIZE));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1),
  );
  function change(values) {
    const next = new URLSearchParams(params);
    next.delete("page");
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key);
    setParams(next);
  }
  const reset = () => setParams({});
  const chips = [...params.entries()].filter(
    ([key]) => !["page", "sort"].includes(key),
  );
  const filters = { params, change, reset };
  return (
    <div className="shop-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Shop</span>
      </nav>
      <div className="shop-title">
        <h1>
          {params.get("search")
            ? `Results for “${params.get("search")}”`
            : params.get("category") || "All workout essentials"}
        </h1>
        <span>
          {result.length} {result.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="shop-toolbar">
        <button
          type="button"
          className="button secondary mobile-filter"
          onClick={() => setDrawer(true)}
        >
          Filters {chips.length ? `(${chips.length})` : ""}
        </button>
        <div className="collection-links">
          <Link to="/shop?collection=featured">Trending</Link>
          <Link to="/shop?collection=bestsellers">Bestsellers</Link>
          <Link to="/shop?collection=new">New arrivals</Link>
        </div>
        <label className="sort-label">
          Sort by:{" "}
          <select
            value={params.get("sort") || "recommended"}
            onChange={(event) => change({ sort: event.target.value })}
          >
            <option value="recommended">Recommended</option>
            <option value="price-low">Price: Low to high</option>
            <option value="price-high">Price: High to low</option>
            <option value="rating">Customer rating</option>
            <option value="discount">Best discount</option>
            <option value="newest">New arrivals</option>
            <option value="bestseller">Bestsellers</option>
          </select>
        </label>
      </div>
      <div className="shop-layout">
        <aside className="desktop-filters" aria-label="Product filters">
          <Filters {...filters} />
        </aside>
        <div className="shop-results">
          {chips.length > 0 && (
            <div className="filter-chips">
              {chips.map(([key, value]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() =>
                    change({
                      [key]: "",
                      ...(key === "category"
                        ? { subcategory: "", size: "", color: "" }
                        : {}),
                    })
                  }
                  aria-label={`Remove ${key} filter: ${value}`}
                >
                  {key}: {value}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
          {result.length ? (
            <>
              <div className="product-grid">
                {result
                  .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
              </div>
              {pages > 1 && (
                <nav className="pagination" aria-label="Product pages">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => change({ page: String(page - 1) })}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {pages}
                  </span>
                  <button
                    type="button"
                    disabled={page === pages}
                    onClick={() => change({ page: String(page + 1) })}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <h2>No products match these filters</h2>
              <p>Try another search or explore the full collection.</p>
              <button type="button" className="button" onClick={reset}>
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
      {drawer && (
        <Modal
          title="Filter products"
          className="filter-modal"
          onClose={() => setDrawer(false)}
        >
          <Filters {...filters} />
          <button
            type="button"
            className="button full"
            onClick={() => setDrawer(false)}
          >
            Show {result.length} products
          </button>
        </Modal>
      )}
    </div>
  );
}