import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useCatalog } from "../context/CatalogContext.jsx";
import categories from "../data/categories.js";
import { filterProducts } from "../utils/catalog.js";

import ProductCard from "./ProductCard.jsx";
import Modal from "./Modal.jsx";

const PAGE_SIZE = 12;

function Filters({
  params,
  change,
  reset,
  products,
}) {
  const minParam =
    params.get("minPrice") || "";

  const maxParam =
    params.get("maxPrice") || "";

  const [min, setMin] =
    useState(minParam);

  const [max, setMax] =
    useState(maxParam);

  const [error, setError] =
    useState("");

  useEffect(() => {
    setMin(minParam);
    setMax(maxParam);
  }, [minParam, maxParam]);

  const selectedCategories = (
    params.get("category") || ""
  )
    .split(",")
    .filter(Boolean);

  const scoped = products.filter(
    (product) =>
      selectedCategories.length === 0 ||
      selectedCategories.includes(
        product.category
      )
  );

  function toggle(key, value) {
    const list = (
      params.get(key) || ""
    )
      .split(",")
      .filter(Boolean);

    change({
      [key]: list.includes(value)
        ? list
            .filter(
              (item) =>
                item !== value
            )
            .join(",")
        : [...list, value].join(","),
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

      {/* CATEGORIES */}

      <fieldset>
        <legend>CATEGORIES</legend>

        {categories.map((cat) => {
          const selected =
            selectedCategories.includes(
              cat.name
            );

          const count =
            products.filter(
              (product) =>
                product.category ===
                cat.name
            ).length;

          return (
            <label
              className="check"
              key={cat.name}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => {
                  change({
                    category: selected
                      ? selectedCategories
                          .filter(
                            (name) =>
                              name !==
                              cat.name
                          )
                          .join(",")
                      : [
                          ...selectedCategories,
                          cat.name,
                        ].join(","),

                    subcategory: "",
                    size: "",
                    color: "",
                  });
                }}
              />

              <span>
                {cat.name}
              </span>

              <small>
                ({count})
              </small>
            </label>
          );
        })}
      </fieldset>

      {/* PRODUCT TYPE */}

      <fieldset>
        <legend>
          PRODUCT TYPE
        </legend>

        {[
          ...new Set(
            scoped
              .map(
                (product) =>
                  product.subcategory
              )
              .filter(Boolean)
          ),
        ].map((value) => (
          <label
            className="check"
            key={value}
          >
            <input
              type="checkbox"
              checked={
                params.get(
                  "subcategory"
                ) === value
              }
              onChange={() =>
                change({
                  subcategory:
                    params.get(
                      "subcategory"
                    ) === value
                      ? ""
                      : value,
                })
              }
            />

            <span>
              {value}
            </span>

            <small>
              (
              {
                scoped.filter(
                  (product) =>
                    product.subcategory ===
                    value
                ).length
              }
              )
            </small>
          </label>
        ))}
      </fieldset>

      {/* PRICE */}

      <fieldset>
        <legend>PRICE</legend>

        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (
              min !== "" &&
              max !== "" &&
              Number(min) >
                Number(max)
            ) {
              setError(
                "Minimum must be below maximum."
              );

              return;
            }

            setError("");

            change({
              minPrice: min,
              maxPrice: max,
            });
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
                onChange={(event) =>
                  setMin(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Max ₹

              <input
                aria-label="Maximum price"
                type="number"
                min="0"
                value={max}
                onChange={(event) =>
                  setMax(
                    event.target.value
                  )
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

      {/* DYNAMIC FILTERS */}

      {[
        [
          "brand",
          "BRAND",
          "brand",
        ],
        [
          "gender",
          "FOR",
          "gender",
        ],
        [
          "size",
          "SIZE",
          "sizes",
        ],
        [
          "color",
          "COLOUR",
          "colors",
        ],
      ].map(
        ([key, label, field]) => {
          const options = [
            ...new Set(
              scoped
                .flatMap(
                  (product) => {
                    const value =
                      product[field];

                    return Array.isArray(
                      value
                    )
                      ? value.map(String)
                      : [value];
                  }
                )
                .filter(Boolean)
            ),
          ];

          if (!options.length) {
            return null;
          }

          return (
            <fieldset key={key}>
              <legend>
                {label}
              </legend>

              {options.map(
                (value) => {
                  const selected = (
                    params.get(key) || ""
                  )
                    .split(",")
                    .includes(value);

                  const count =
                    scoped.filter(
                      (product) => {
                        const fieldValue =
                          product[field];

                        return Array.isArray(
                          fieldValue
                        )
                          ? fieldValue
                              .map(String)
                              .includes(
                                value
                              )
                          : String(
                              fieldValue
                            ) === value;
                      }
                    ).length;

                  return (
                    <label
                      className="check"
                      key={value}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected
                        }
                        onChange={() =>
                          toggle(
                            key,
                            value
                          )
                        }
                      />

                      <span>
                        {value}
                      </span>

                      <small>
                        ({count})
                      </small>
                    </label>
                  );
                }
              )}
            </fieldset>
          );
        }
      )}

      {/* AVAILABILITY */}

      <fieldset>
        <legend>
          AVAILABILITY
        </legend>

        <label className="check">
          <input
            type="checkbox"
            checked={
              params.get(
                "availability"
              ) === "in-stock"
            }
            onChange={() =>
              change({
                availability:
                  params.get(
                    "availability"
                  )
                    ? ""
                    : "in-stock",
              })
            }
          />

          In stock only
        </label>
      </fieldset>

      {/* RATING */}

      <fieldset>
        <legend>RATING</legend>

        {[4, 3].map(
          (number) => (
            <label
              className="check"
              key={number}
            >
              <input
                type="radio"
                name="minimum-rating"
                checked={
                  params.get(
                    "rating"
                  ) ===
                  String(number)
                }
                onChange={() =>
                  change({
                    rating:
                      String(number),
                  })
                }
              />

              {number} ★ & above
            </label>
          )
        )}
      </fieldset>

      {/* DISCOUNT */}

      <fieldset>
        <legend>
          DISCOUNT
        </legend>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(
              params.get(
                "discount"
              )
            )}
            onChange={() =>
              change({
                discount:
                  params.get(
                    "discount"
                  )
                    ? ""
                    : "10",
              })
            }
          />

          10% and above
        </label>
      </fieldset>
    </div>
  );
}

export default function ProductSection() {
  const {
    products,
    loading,
    error: loadError,
    refreshProducts,
  } = useCatalog();

  const [
    params,
    setParams,
  ] = useSearchParams();

  const [
    drawer,
    setDrawer,
  ] = useState(false);

  const result =
    filterProducts(
      products,
      params
    );

  const pages = Math.max(
    1,
    Math.ceil(
      result.length /
        PAGE_SIZE
    )
  );

  const page = Math.min(
    pages,

    Math.max(
      1,

      Number.parseInt(
        params.get("page") ||
          "1",
        10
      ) || 1
    )
  );

  function change(values) {
    const next =
      new URLSearchParams(
        params
      );

    next.delete("page");

    for (
      const [key, value]
      of Object.entries(values)
    ) {
      if (value) {
        next.set(
          key,
          value
        );
      } else {
        next.delete(key);
      }
    }

    setParams(next);

    if (values.page) {
      document
        .getElementById(
          "shop-results"
        )
        ?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
    }
  }

  const reset = () => {
    const search =
      params.get("search");

    if (search) {
      setParams({
        search,
      });
    } else {
      setParams({});
    }
  };

  const chips = [
    ...params.entries(),
  ]
    .flatMap(
      ([key, value]) => {
        const multipleKeys = [
          "category",
          "size",
          "color",
          "brand",
          "gender",
        ];

        if (
          multipleKeys.includes(
            key
          )
        ) {
          return value
            .split(",")
            .filter(Boolean)
            .map((item) => [
              key,
              item,
            ]);
        }

        return [
          [key, value],
        ];
      }
    )
    .filter(
      ([key]) =>
        ![
          "page",
          "sort",
        ].includes(key)
    );

  const filters = {
    params,
    change,
    reset,
    products,
  };

  return (
    <div className="shop-page">
      {/* BREADCRUMB */}

      <nav
        className="breadcrumb"
        aria-label="Breadcrumb"
      >
        <Link to="/">
          Home
        </Link>

        <span>/</span>

        <span>
          Shop
        </span>
      </nav>

      {/* TITLE */}

      <div className="shop-title">
        <h1>
          {params.get("search")
            ? `Results for “${params.get(
                "search"
              )}”`
            : params
                .get("category")
                ?.replaceAll(
                  ",",
                  " & "
                ) ||
              "All workout essentials"}
        </h1>

        {!loading && (
          <span>
            {result.length}{" "}
            {result.length ===
            1
              ? "item"
              : "items"}
          </span>
        )}
      </div>

      {/* TOOLBAR */}

      <div className="shop-toolbar">
        <button
          type="button"
          className="button secondary mobile-filter"
          onClick={() =>
            setDrawer(true)
          }
        >
          Filters{" "}
          {chips.length
            ? `(${chips.length})`
            : ""}
        </button>

        <div className="collection-links">
          <Link to="/shop?collection=featured">
            Trending
          </Link>

          <Link to="/shop?collection=bestsellers">
            Bestsellers
          </Link>

          <Link to="/shop?collection=new">
            New arrivals
          </Link>
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
                sort:
                  event.target
                    .value,
              })
            }
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

            <option value="discount">
              Best discount
            </option>

            <option value="newest">
              New arrivals
            </option>

            <option value="bestseller">
              Bestsellers
            </option>
          </select>
        </label>
      </div>

      <div className="shop-layout">
        {/* FILTER SIDEBAR */}

        <aside
          className="desktop-filters"
          aria-label="Product filters"
        >
          <Filters
            {...filters}
          />
        </aside>

        {/* RESULTS */}

        <div
          className="shop-results"
          id="shop-results"
        >
          {/* FILTER CHIPS */}

          {chips.length > 0 && (
            <div className="filter-chips">
              {chips.map(
                ([key, value]) => (
                  <button
                    type="button"
                    key={`${key}-${value}`}
                    onClick={() => {
                      const multiKeys = [
                        "category",
                        "size",
                        "color",
                        "brand",
                        "gender",
                      ];

                      const nextValue =
                        multiKeys.includes(
                          key
                        )
                          ? (
                              params.get(
                                key
                              ) || ""
                            )
                              .split(",")
                              .filter(
                                (
                                  item
                                ) =>
                                  item !==
                                  value
                              )
                              .join(",")
                          : "";

                      change({
                        [key]:
                          nextValue,

                        ...(key ===
                        "category"
                          ? {
                              subcategory:
                                "",

                              size: "",

                              color: "",
                            }
                          : {}),
                      });
                    }}
                    aria-label={`Remove ${key} filter: ${value}`}
                  >
                    {key}:{" "}
                    {value}

                    <span
                      aria-hidden="true"
                    >
                      ×
                    </span>
                  </button>
                )
              )}
            </div>
          )}

          {/* LOADING */}

          {loading && (
            <div className="empty-state">
              <h2>
                Loading
                products...
              </h2>

              <p>
                Getting the
                latest GymDrobe
                products.
              </p>
            </div>
          )}

          {/* ERROR */}

          {!loading &&
            loadError && (
              <div className="empty-state">
                <h2>
                  Unable to load
                  products
                </h2>

                <p>
                  {loadError}
                </p>

                <button
                  type="button"
                  className="button"
                  onClick={
                    refreshProducts
                  }
                >
                  Try again
                </button>
              </div>
            )}

          {/* PRODUCTS */}

          {!loading &&
            !loadError &&
            result.length >
              0 && (
              <>
                <div className="product-grid">
                  {result
                    .slice(
                      (page - 1) *
                        PAGE_SIZE,

                      page *
                        PAGE_SIZE
                    )
                    .map(
                      (
                        product
                      ) => (
                        <ProductCard
                          key={
                            product.id ||
                            product._id
                          }
                          product={
                            product
                          }
                        />
                      )
                    )}
                </div>

                {pages > 1 && (
                  <nav
                    className="pagination"
                    aria-label="Product pages"
                  >
                    <button
                      type="button"
                      disabled={
                        page === 1
                      }
                      onClick={() =>
                        change({
                          page:
                            String(
                              page -
                                1
                            ),
                        })
                      }
                    >
                      Previous
                    </button>

                    <span>
                      Page {page}{" "}
                      of {pages}
                    </span>

                    <button
                      type="button"
                      disabled={
                        page ===
                        pages
                      }
                      onClick={() =>
                        change({
                          page:
                            String(
                              page +
                                1
                            ),
                        })
                      }
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}

          {/* EMPTY */}

          {!loading &&
            !loadError &&
            result.length ===
              0 && (
              <div className="empty-state">
                <h2>
                  {products.length ===
                  0
                    ? "No products are available yet"
                    : "No products match these filters"}
                </h2>

                <p>
                  {products.length ===
                  0
                    ? "Products added to MongoDB will appear here."
                    : "Try another search or explore the full collection."}
                </p>

                {products.length >
                  0 && (
                  <button
                    type="button"
                    className="button"
                    onClick={
                      reset
                    }
                  >
                    Clear all
                    filters
                  </button>
                )}

                {params.get(
                  "search"
                ) && (
                  <p>
                    <Link
                      className="text-link"
                      to="/shop"
                    >
                      Browse all
                      products
                    </Link>
                  </p>
                )}
              </div>
            )}
        </div>
      </div>

      {/* MOBILE FILTER */}

      {drawer && (
        <Modal
          title="Filter products"
          className="filter-modal"
          onClose={() =>
            setDrawer(false)
          }
        >
          <Filters
            {...filters}
          />

          <button
            type="button"
            className="button full"
            onClick={() =>
              setDrawer(false)
            }
          >
            Show{" "}
            {result.length}{" "}
            products
          </button>
        </Modal>
      )}
    </div>
  );
}