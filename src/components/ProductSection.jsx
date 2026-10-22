import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import {
  SHOP_DEPARTMENTS,
  catalogOptions,
  catalogProducts,
  filterProducts,
  matchesCategory,
  matchesSubcategory,
  normalizeCatalogText,
  productDepartment,
} from "../utils/catalog.js";

import ProductCard from "./ProductCard.jsx";
import Modal from "./Modal.jsx";

const PAGE_SIZE = 12;

const MULTI_VALUE_FILTERS = [
  "category",
  "size",
  "color",
  "brand",
  "gender",
];

const COLLECTIONS = {
  featured: "Trending",
  bestsellers: "Bestsellers",
  new: "New arrivals",
};

const splitValues = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const same = (a, b) =>
  normalizeCatalogText(a) === normalizeCatalogText(b);

function chipLabel(key, value) {
  if (key === "search") {
    return `Search: “${value}”`;
  }

  if (key === "department") {
    return (
      SHOP_DEPARTMENTS.find(
        (item) => item.id === value,
      )?.title || value
    );
  }

  if (key === "minPrice") {
    return `From ₹${value}`;
  }

  if (key === "maxPrice") {
    return `Up to ₹${value}`;
  }

  if (key === "size") {
    return `Size ${value}`;
  }

  if (key === "rating") {
    return `${value}★ & above`;
  }

  if (key === "discount") {
    return `${value}%+ off`;
  }

  if (key === "availability") {
    return value === "in-stock"
      ? "In stock"
      : "Out of stock";
  }

  if (key === "collection") {
    return Object.prototype.hasOwnProperty.call(
      COLLECTIONS,
      value,
    )
      ? COLLECTIONS[value]
      : value;
  }

  return value;
}

function Filters({
  params,
  change,
  reset,
  products,
}) {
  const minParam = params.get("minPrice") || "";
  const maxParam = params.get("maxPrice") || "";

  const [min, setMin] = useState(minParam);
  const [max, setMax] = useState(maxParam);
  const [error, setError] = useState("");

  useEffect(() => {
    setMin(minParam);
    setMax(maxParam);
  }, [minParam, maxParam]);

  const department = params.get("department");

  const selectedCategories = splitValues(
    params.get("category"),
  );

  const departmentProducts = products.filter(
    (product) =>
      !department ||
      productDepartment(product) === department,
  );

  const categoryOptions = catalogOptions(
    departmentProducts,
    "category",
    selectedCategories,
  );

  const scoped = departmentProducts.filter(
    (product) =>
      !selectedCategories.length ||
      selectedCategories.some((category) =>
        matchesCategory(product, category),
      ),
  );

  const selectedType =
    params.get("subcategory") || "";

  const subcategories = catalogOptions(
    scoped,
    "subcategory",
    selectedType ? [selectedType] : [],
  );

  function toggle(key, value) {
    const current = splitValues(params.get(key));

    const selected = current.some((item) =>
      same(item, value),
    );

    change({
      [key]: (
        selected
          ? current.filter(
              (item) => !same(item, value),
            )
          : [...current, value]
      ).join(","),
    });
  }

  function applyPrice(event) {
    event.preventDefault();

    const low = min === "" ? null : Number(min);
    const high = max === "" ? null : Number(max);

    if (
      (low != null &&
        (!Number.isFinite(low) || low < 0)) ||
      (high != null &&
        (!Number.isFinite(high) || high < 0))
    ) {
      setError("Enter valid prices.");
      return;
    }

    if (
      low != null &&
      high != null &&
      low > high
    ) {
      setError("Minimum must be below maximum.");
      return;
    }

    setError("");

    change({
      minPrice: min,
      maxPrice: max,
    });
  }

  return (
    <div className="filter-content">
      <div className="filter-heading">
        <strong>FILTERS</strong>

        <button
          type="button"
          className="text-link"
          onClick={reset}
        >
          Clear all
        </button>
      </div>

      {categoryOptions.length > 0 && (
        <fieldset>
          <legend>CATEGORIES</legend>

          {categoryOptions.map((category) => {
            const selected =
              selectedCategories.some((value) =>
                same(value, category),
              );

            const count =
              departmentProducts.filter((product) =>
                matchesCategory(product, category),
              ).length;

            return (
              <label
                className="check"
                key={category}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const next = selected
                      ? selectedCategories.filter(
                          (value) =>
                            !same(value, category),
                        )
                      : [
                          ...selectedCategories,
                          category,
                        ];

                    change({
                      category: next.join(","),
                      subcategory: "",
                      size: "",
                      color: "",
                    });
                  }}
                />

                <span>{category}</span>
                <small>({count})</small>
              </label>
            );
          })}
        </fieldset>
      )}

      {subcategories.length > 0 && (
        <fieldset>
          <legend>PRODUCT TYPE</legend>

          {subcategories.map((value) => (
            <label
              className="check"
              key={value}
            >
              <input
                type="radio"
                name="subcategory"
                checked={same(selectedType, value)}
                onChange={() =>
                  change({
                    subcategory: value,
                  })
                }
              />

              <span>{value}</span>

              <small>
                (
                {
                  scoped.filter((product) =>
                    matchesSubcategory(product, value),
                  ).length
                }
                )
              </small>
            </label>
          ))}

          {selectedType && (
            <button
              type="button"
              className="text-link"
              onClick={() =>
                change({
                  subcategory: "",
                })
              }
            >
              Clear product type
            </button>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>PRICE</legend>

        <div className="filter-quick-options">
          {[
            ["Under ₹500", "", "499"],
            ["₹500–₹999", "500", "999"],
            ["₹1,000+", "1000", ""],
          ].map(([label, low, high]) => (
            <button
              type="button"
              className="text-link"
              key={label}
              onClick={() => {
                setMin(low);
                setMax(high);
                setError("");

                change({
                  minPrice: low,
                  maxPrice: high,
                });
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          className="price-filter"
          onSubmit={applyPrice}
        >
          <div className="price-inputs">
            <label>
              Min ₹

              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label="Minimum price"
                value={min}
                onChange={(event) =>
                  setMin(event.target.value)
                }
              />
            </label>

            <label>
              Max ₹

              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label="Maximum price"
                value={max}
                onChange={(event) =>
                  setMax(event.target.value)
                }
              />
            </label>
          </div>

          {error && (
            <p
              className="field-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="button secondary compact full"
          >
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
        const selected = splitValues(
          params.get(key),
        );

        const options = catalogOptions(
          scoped,
          field,
          selected,
        );

        if (!options.length) return null;

        return (
          <fieldset key={key}>
            <legend>{label}</legend>

            {options.map((value) => {
              const count = scoped.filter(
                (product) =>
                  (
                    Array.isArray(product[field])
                      ? product[field]
                      : [product[field]]
                  ).some((item) =>
                    same(item, value),
                  ),
              ).length;

              return (
                <label
                  className="check"
                  key={value}
                >
                  <input
                    type="checkbox"
                    checked={selected.some((item) =>
                      same(item, value),
                    )}
                    onChange={() =>
                      toggle(key, value)
                    }
                  />

                  <span>{value}</span>
                  <small>({count})</small>
                </label>
              );
            })}
          </fieldset>
        );
      })}

      <fieldset>
        <legend>AVAILABILITY</legend>

        <label className="check">
          <input
            type="checkbox"
            checked={
              params.get("availability") ===
              "in-stock"
            }
            onChange={() =>
              change({
                availability:
                  params.get("availability") ===
                  "in-stock"
                    ? ""
                    : "in-stock",
              })
            }
          />

          <span>In stock only</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>CUSTOMER RATING</legend>

        {[4, 3].map((rating) => (
          <label
            className="check"
            key={rating}
          >
            <input
              type="radio"
              name="rating"
              checked={
                params.get("rating") ===
                String(rating)
              }
              onChange={() =>
                change({
                  rating: String(rating),
                })
              }
            />

            <span>{rating} ★ & above</span>
          </label>
        ))}

        {params.get("rating") && (
          <button
            type="button"
            className="text-link"
            onClick={() =>
              change({
                rating: "",
              })
            }
          >
            Clear rating
          </button>
        )}
      </fieldset>

      <fieldset>
        <legend>DISCOUNT</legend>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(
              params.get("discount"),
            )}
            onChange={() =>
              change({
                discount: params.get("discount")
                  ? ""
                  : "10",
              })
            }
          />

          <span>10% and above</span>
        </label>
      </fieldset>
    </div>
  );
}

export default function ProductSection() {
  const {
    products: catalogue,
    loading,
    error: loadError,
    refreshProducts,
  } = useCatalog();

  const [params, setParams] =
    useSearchParams();

  const [drawer, setDrawer] =
    useState(false);

  const products = useMemo(
    () => catalogProducts(catalogue),
    [catalogue],
  );

  const result = useMemo(
    () => filterProducts(products, params),
    [products, params],
  );

  const pages = Math.max(
    1,
    Math.ceil(result.length / PAGE_SIZE),
  );

  const page = Math.min(
    pages,
    Math.max(
      1,
      Number.parseInt(
        params.get("page") || "1",
        10,
      ) || 1,
    ),
  );

  const startIndex = result.length
    ? (page - 1) * PAGE_SIZE + 1
    : 0;

  const endIndex = Math.min(
    page * PAGE_SIZE,
    result.length,
  );

  const searchQuery =
    params.get("search") || "";

  const department =
    params.get("department") || "";

  const categoryQuery =
    params.get("category") || "";

  const collection =
    params.get("collection") || "";

  const chips = [...params.entries()]
    .flatMap(([key, value]) =>
      MULTI_VALUE_FILTERS.includes(key)
        ? splitValues(value).map((item) => [
            key,
            item,
          ])
        : [[key, value]],
    )
    .filter(
      ([key, value]) =>
        value &&
        !["page", "sort"].includes(key),
    );

  const activeFilterCount = chips.filter(
    ([key]) =>
      ![
        "search",
        "collection",
        "department",
      ].includes(key),
  ).length;

  function change(values) {
    const next = new URLSearchParams(params);

    next.delete("page");

    for (const [key, value] of Object.entries(values)) {
      if (value !== "" && value != null) {
        next.set(key, String(value));
      } else {
        next.delete(key);
      }
    }

    setParams(next);

    if (values.page) {
      document
        .getElementById("shop-results")
        ?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
    }
  }

  function reset() {
    const next = new URLSearchParams();

    if (searchQuery) {
      next.set("search", searchQuery);
    }

    if (department) {
      next.set("department", department);
    }

    setParams(next);
  }

  function removeChip(key, value) {
    if (MULTI_VALUE_FILTERS.includes(key)) {
      change({
        [key]: splitValues(params.get(key))
          .filter((item) => item !== value)
          .join(","),

        ...(key === "category"
          ? {
              subcategory: "",
              size: "",
              color: "",
            }
          : {}),
      });
    } else {
      change({
        [key]: "",
      });
    }
  }

  function collectionPath(value) {
    const next = new URLSearchParams();

    if (department) {
      next.set("department", department);
    }

    if (categoryQuery) {
      next.set("category", categoryQuery);
    }

    next.set("collection", value);

    return `/shop?${next}`;
  }

  let title =
    SHOP_DEPARTMENTS.find(
      (item) => item.id === department,
    )?.title || "All workout essentials";

  if (searchQuery) {
    title = `Results for “${searchQuery}”`;
  } else if (categoryQuery) {
    title = categoryQuery.replaceAll(
      ",",
      " & ",
    );
  } else if (
    collection &&
    Object.prototype.hasOwnProperty.call(
      COLLECTIONS,
      collection,
    )
  ) {
    title = department
      ? `${title} · ${COLLECTIONS[collection]}`
      : COLLECTIONS[collection];
  }

  const filters = {
    params,
    change,
    reset,
    products,
  };

  const errorMessage =
    typeof loadError === "string"
      ? loadError
      : typeof loadError?.message === "string"
        ? loadError.message
        : "Please try loading the products again.";

  return (
    <div className="shop-page">
      <nav
        className="breadcrumb"
        aria-label="Breadcrumb"
      >
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Shop</span>
      </nav>

      <div className="shop-title">
        <div>
          <h1>{title}</h1>

          {!loading && !loadError && (
            <p
              className="muted"
              role="status"
            >
              {result.length === 0
                ? "No matching products"
                : result.length <= PAGE_SIZE
                  ? `${result.length} ${
                      result.length === 1
                        ? "product"
                        : "products"
                    }`
                  : `Showing ${startIndex}–${endIndex} of ${result.length} products`}
            </p>
          )}
        </div>

        {searchQuery && (
          <button
            type="button"
            className="text-link"
            onClick={() =>
              change({
                search: "",
              })
            }
          >
            Clear search
          </button>
        )}
      </div>

      {searchQuery &&
        !loading &&
        !loadError &&
        result.length > 0 && (
          <div className="notice">
            <strong>
              {result.length}{" "}
              {result.length === 1
                ? "match"
                : "matches"}{" "}
              found
            </strong>

            {" for “"}
            {searchQuery}
            {"”"}
          </div>
        )}

      <div className="shop-toolbar">
        <button
          type="button"
          className="button secondary mobile-filter"
          onClick={() => setDrawer(true)}
        >
          Filters
          {activeFilterCount > 0
            ? ` (${activeFilterCount})`
            : ""}
        </button>

        <div
          className="collection-links"
          aria-label="Popular collections"
        >
          {Object.entries(COLLECTIONS).map(
            ([value, label]) => (
              <Link
                key={value}
                to={collectionPath(value)}
                aria-current={
                  collection === value
                    ? "page"
                    : undefined
                }
              >
                {label}
              </Link>
            ),
          )}
        </div>

        <label className="sort-label">
          Sort by:{" "}

          <select
            value={
              params.get("sort") ||
              "recommended"
            }
            onChange={(event) =>
              change({
                sort: event.target.value,
              })
            }
          >
            <option value="recommended">
              Recommended
            </option>

            <option value="bestseller">
              Bestsellers
            </option>

            <option value="rating">
              Customer rating
            </option>

            <option value="discount">
              Best discount
            </option>

            <option value="price-low">
              Price: Low to high
            </option>

            <option value="price-high">
              Price: High to low
            </option>

            <option value="newest">
              New arrivals
            </option>
          </select>
        </label>
      </div>

      <div className="shop-layout">
        <aside
          className="desktop-filters"
          aria-label="Product filters"
        >
          <Filters {...filters} />
        </aside>

        <div
          className="shop-results"
          id="shop-results"
          aria-busy={loading}
        >
          {chips.length > 0 && (
            <div className="active-filter-area">
              <div className="filter-chips">
                {chips.map(([key, value]) => (
                  <button
                    type="button"
                    key={`${key}-${value}`}
                    onClick={() =>
                      removeChip(key, value)
                    }
                    aria-label={`Remove ${key} filter: ${chipLabel(
                      key,
                      value,
                    )}`}
                  >
                    {chipLabel(key, value)}

                    <span aria-hidden="true">
                      ×
                    </span>
                  </button>
                ))}
              </div>

              {activeFilterCount > 1 && (
                <button
                  type="button"
                  className="text-link"
                  onClick={reset}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="empty-state">
              <h2>Loading products...</h2>

              <p>
                Getting the latest GymDrobe products.
              </p>
            </div>
          )}

          {!loading && loadError && (
            <div
              className="empty-state"
              role="alert"
            >
              <h2>Unable to load products</h2>

              <p>{errorMessage}</p>

              <button
                type="button"
                className="button"
                onClick={() => refreshProducts()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading &&
            !loadError &&
            result.length > 0 && (
              <>
                <div className="shop-results-head">
                  <span className="muted">
                    {startIndex}–{endIndex} of{" "}
                    {result.length}
                  </span>
                </div>

                <div className="product-grid">
                  {result
                    .slice(
                      (page - 1) * PAGE_SIZE,
                      page * PAGE_SIZE,
                    )
                    .map((product) => (
                      <ProductCard
                        key={
                          product.id ||
                          product._id
                        }
                        product={product}
                      />
                    ))}
                </div>

                {pages > 1 && (
                  <nav
                    className="pagination"
                    aria-label="Product pages"
                  >
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() =>
                        change({
                          page: String(page - 1),
                        })
                      }
                    >
                      Previous
                    </button>

                    <span>
                      Page{" "}
                      <strong>{page}</strong>{" "}
                      of{" "}
                      <strong>{pages}</strong>
                    </span>

                    <button
                      type="button"
                      disabled={page === pages}
                      onClick={() =>
                        change({
                          page: String(page + 1),
                        })
                      }
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}

          {!loading &&
            !loadError &&
            result.length === 0 && (
              <div className="empty-state">
                <h2>
                  {products.length === 0
                    ? "No products are available yet"
                    : searchQuery
                      ? `No results for “${searchQuery}”`
                      : "No products match your filters"}
                </h2>

                <p>
                  {products.length === 0
                    ? "Products added to GymDrobe will appear here."
                    : "Try another category or remove some filters to explore the collection."}
                </p>

                {products.length > 0 && (
                  <div className="empty-actions">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        className="button"
                        onClick={reset}
                      >
                        Clear filters
                      </button>
                    )}

                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setParams({})
                      }
                    >
                      Browse all products
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {drawer && (
        <Modal
          title={
            activeFilterCount > 0
              ? `Filters (${activeFilterCount})`
              : "Filter products"
          }
          className="filter-modal"
          onClose={() => setDrawer(false)}
        >
          <Filters {...filters} />

          <div className="mobile-filter-actions">
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="button secondary full"
                onClick={reset}
              >
                Clear filters
              </button>
            )}

            <button
              type="button"
              className="button full"
              onClick={() => setDrawer(false)}
            >
              Show {result.length}{" "}
              {result.length === 1
                ? "product"
                : "products"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}