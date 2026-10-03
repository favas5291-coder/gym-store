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

import categories from "../data/categories.js";

import {
  filterProducts,
} from "../utils/catalog.js";

import ProductCard from "./ProductCard.jsx";
import Modal from "./Modal.jsx";


// ======================================================
// CONFIG
// ======================================================

const PAGE_SIZE =
  12;


const MULTI_VALUE_FILTERS = [
  "category",
  "size",
  "color",
  "brand",
  "gender",
];


// ======================================================
// HELPERS
// ======================================================

function splitValues(
  value
) {
  return String(
    value ||
      ""
  )
    .split(",")
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(
      Boolean
    );
}


function titleCase(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        letter
      ) =>
        letter.toUpperCase()
    );
}


function chipLabel(
  key,
  value
) {
  if (
    key ===
    "search"
  ) {
    return `Search: “${value}”`;
  }


  if (
    key ===
    "category"
  ) {
    return value;
  }


  if (
    key ===
    "subcategory"
  ) {
    return value;
  }


  if (
    key ===
    "brand"
  ) {
    return value;
  }


  if (
    key ===
    "gender"
  ) {
    return value;
  }


  if (
    key ===
    "size"
  ) {
    return `Size ${value}`;
  }


  if (
    key ===
    "color"
  ) {
    return value;
  }


  if (
    key ===
    "minPrice"
  ) {
    return `From ₹${value}`;
  }


  if (
    key ===
    "maxPrice"
  ) {
    return `Up to ₹${value}`;
  }


  if (
    key ===
    "availability"
  ) {
    return value ===
      "in-stock"
      ? "In stock"
      : titleCase(
          value
        );
  }


  if (
    key ===
    "rating"
  ) {
    return `${value}★ & above`;
  }


  if (
    key ===
    "discount"
  ) {
    return `${value}%+ off`;
  }


  if (
    key ===
    "collection"
  ) {
    const labels = {
      featured:
        "Trending",
      bestsellers:
        "Bestsellers",
      new:
        "New arrivals",
    };


    return (
      labels[
        value
      ] ||
      titleCase(
        value
      )
    );
  }


  return `${titleCase(
    key
  )}: ${value}`;
}


// ======================================================
// FILTERS
// ======================================================

function Filters({
  params,
  change,
  reset,
  products,
}) {
  const minParam =
    params.get(
      "minPrice"
    ) ||
    "";


  const maxParam =
    params.get(
      "maxPrice"
    ) ||
    "";


  const [
    min,
    setMin,
  ] =
    useState(
      minParam
    );


  const [
    max,
    setMax,
  ] =
    useState(
      maxParam
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  // ====================================================
  // SYNC PRICE FIELDS
  // ====================================================

  useEffect(
    () => {
      setMin(
        minParam
      );


      setMax(
        maxParam
      );
    },

    [
      minParam,
      maxParam,
    ]
  );


  // ====================================================
  // CATEGORY SCOPE
  // ====================================================

  const selectedCategories =
    splitValues(
      params.get(
        "category"
      )
    );


  const scoped =
    products.filter(
      (
        product
      ) =>
        selectedCategories.length ===
          0 ||
        selectedCategories.includes(
          product.category
        )
    );


  // ====================================================
  // MULTI VALUE TOGGLE
  // ====================================================

  function toggle(
    key,
    value
  ) {
    const list =
      splitValues(
        params.get(
          key
        )
      );


    change({
      [key]:
        list.includes(
          value
        )
          ? list
              .filter(
                (
                  item
                ) =>
                  item !==
                  value
              )
              .join(
                ","
              )

          : [
              ...list,
              value,
            ].join(
              ","
            ),
    });
  }


  // ====================================================
  // APPLY PRICE
  // ====================================================

  function applyPrice(
    event
  ) {
    event.preventDefault();


    const minNumber =
      min ===
      ""
        ? null
        : Number(
            min
          );


    const maxNumber =
      max ===
      ""
        ? null
        : Number(
            max
          );


    if (
      (
        minNumber !==
          null &&
        (
          !Number.isFinite(
            minNumber
          ) ||
          minNumber <
            0
        )
      ) ||
      (
        maxNumber !==
          null &&
        (
          !Number.isFinite(
            maxNumber
          ) ||
          maxNumber <
            0
        )
      )
    ) {
      setError(
        "Enter valid prices."
      );


      return;
    }


    if (
      minNumber !==
        null &&
      maxNumber !==
        null &&
      minNumber >
        maxNumber
    ) {
      setError(
        "Minimum must be below maximum."
      );


      return;
    }


    setError(
      ""
    );


    change({
      minPrice:
        min,

      maxPrice:
        max,
    });
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="filter-content">
      {/* ===============================================
          HEADING
      =============================================== */}

      <div className="filter-heading">
        <strong>
          FILTERS
        </strong>


        <button
          type="button"
          className="text-link"
          onClick={
            reset
          }
        >
          Clear all
        </button>
      </div>


      {/* ===============================================
          CATEGORIES
      =============================================== */}

      <fieldset>
        <legend>
          CATEGORIES
        </legend>


        {categories.map(
          (
            cat
          ) => {
            const selected =
              selectedCategories.includes(
                cat.name
              );


            const count =
              products.filter(
                (
                  product
                ) =>
                  product.category ===
                  cat.name
              ).length;


            return (
              <label
                className="check"
                key={
                  cat.name
                }
              >
                <input
                  type="checkbox"
                  checked={
                    selected
                  }
                  onChange={() => {
                    change({
                      category:
                        selected
                          ? selectedCategories
                              .filter(
                                (
                                  name
                                ) =>
                                  name !==
                                  cat.name
                              )
                              .join(
                                ","
                              )

                          : [
                              ...selectedCategories,
                              cat.name,
                            ].join(
                              ","
                            ),

                      subcategory:
                        "",

                      size:
                        "",

                      color:
                        "",
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
          }
        )}
      </fieldset>


      {/* ===============================================
          PRODUCT TYPE
      =============================================== */}

      {[
        ...new Set(
          scoped
            .map(
              (
                product
              ) =>
                product.subcategory
            )
            .filter(
              Boolean
            )
        ),
      ].length >
        0 && (
        <fieldset>
          <legend>
            PRODUCT TYPE
          </legend>


          {[
            ...new Set(
              scoped
                .map(
                  (
                    product
                  ) =>
                    product.subcategory
                )
                .filter(
                  Boolean
                )
            ),
          ].map(
            (
              value
            ) => (
              <label
                className="check"
                key={
                  value
                }
              >
                <input
                  type="radio"
                  name="subcategory"
                  checked={
                    params.get(
                      "subcategory"
                    ) ===
                    value
                  }
                  onChange={() =>
                    change({
                      subcategory:
                        params.get(
                          "subcategory"
                        ) ===
                        value
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
                      (
                        product
                      ) =>
                        product.subcategory ===
                        value
                    ).length
                  }
                  )
                </small>
              </label>
            )
          )}


          {params.get(
            "subcategory"
          ) && (
            <button
              type="button"
              className="text-link"
              onClick={() =>
                change({
                  subcategory:
                    "",
                })
              }
            >
              Clear product type
            </button>
          )}
        </fieldset>
      )}


      {/* ===============================================
          PRICE
      =============================================== */}

      <fieldset>
        <legend>
          PRICE
        </legend>


        {/* QUICK PRICE FILTERS */}

        <div className="filter-quick-options">
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setMin(
                ""
              );

              setMax(
                "499"
              );

              setError(
                ""
              );

              change({
                minPrice:
                  "",

                maxPrice:
                  "499",
              });
            }}
          >
            Under ₹500
          </button>


          <button
            type="button"
            className="text-link"
            onClick={() => {
              setMin(
                "500"
              );

              setMax(
                "999"
              );

              setError(
                ""
              );

              change({
                minPrice:
                  "500",

                maxPrice:
                  "999",
              });
            }}
          >
            ₹500–₹999
          </button>


          <button
            type="button"
            className="text-link"
            onClick={() => {
              setMin(
                "1000"
              );

              setMax(
                ""
              );

              setError(
                ""
              );

              change({
                minPrice:
                  "1000",

                maxPrice:
                  "",
              });
            }}
          >
            ₹1,000+
          </button>
        </div>


        <form
          onSubmit={
            applyPrice
          }
        >
          <div className="price-inputs">
            <label>
              Min ₹


              <input
                aria-label="Minimum price"
                type="number"
                min="0"
                inputMode="numeric"
                value={
                  min
                }
                onChange={(
                  event
                ) =>
                  setMin(
                    event.target
                      .value
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
                inputMode="numeric"
                value={
                  max
                }
                onChange={(
                  event
                ) =>
                  setMax(
                    event.target
                      .value
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


      {/* ===============================================
          DYNAMIC FILTERS
      =============================================== */}

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
        (
          [
            key,
            label,
            field,
          ]
        ) => {
          const options = [
            ...new Set(
              scoped
                .flatMap(
                  (
                    product
                  ) => {
                    const value =
                      product[
                        field
                      ];


                    return Array.isArray(
                      value
                    )
                      ? value.map(
                          String
                        )
                      : [
                          value,
                        ];
                  }
                )
                .filter(
                  Boolean
                )
            ),
          ];


          if (
            !options.length
          ) {
            return null;
          }


          return (
            <fieldset
              key={
                key
              }
            >
              <legend>
                {label}
              </legend>


              {options.map(
                (
                  value
                ) => {
                  const selected =
                    splitValues(
                      params.get(
                        key
                      )
                    ).includes(
                      value
                    );


                  const count =
                    scoped.filter(
                      (
                        product
                      ) => {
                        const fieldValue =
                          product[
                            field
                          ];


                        return Array.isArray(
                          fieldValue
                        )
                          ? fieldValue
                              .map(
                                String
                              )
                              .includes(
                                value
                              )

                          : String(
                              fieldValue
                            ) ===
                            value;
                      }
                    ).length;


                  return (
                    <label
                      className="check"
                      key={
                        value
                      }
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


      {/* ===============================================
          AVAILABILITY
      =============================================== */}

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
              ) ===
              "in-stock"
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


          <span>
            In stock only
          </span>
        </label>
      </fieldset>


      {/* ===============================================
          RATING
      =============================================== */}

      <fieldset>
        <legend>
          CUSTOMER RATING
        </legend>


        {[
          4,
          3,
        ].map(
          (
            number
          ) => (
            <label
              className="check"
              key={
                number
              }
            >
              <input
                type="radio"
                name="minimum-rating"
                checked={
                  params.get(
                    "rating"
                  ) ===
                  String(
                    number
                  )
                }
                onChange={() =>
                  change({
                    rating:
                      params.get(
                        "rating"
                      ) ===
                      String(
                        number
                      )
                        ? ""
                        : String(
                            number
                          ),
                  })
                }
              />


              <span>
                {number} ★ & above
              </span>
            </label>
          )
        )}
      </fieldset>


      {/* ===============================================
          DISCOUNT
      =============================================== */}

      <fieldset>
        <legend>
          DISCOUNT
        </legend>


        <label className="check">
          <input
            type="checkbox"
            checked={
              Boolean(
                params.get(
                  "discount"
                )
              )
            }
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


          <span>
            10% and above
          </span>
        </label>
      </fieldset>
    </div>
  );
}


// ======================================================
// PRODUCT SECTION
// ======================================================

export default function ProductSection() {
  const {
    products,
    loading,
    error:
      loadError,
    refreshProducts,
  } =
    useCatalog();


  const [
    params,
    setParams,
  ] =
    useSearchParams();


  const [
    drawer,
    setDrawer,
  ] =
    useState(
      false
    );


  // ====================================================
  // FILTERED PRODUCTS
  // ====================================================

  const result =
    filterProducts(
      products,
      params
    );


  // ====================================================
  // PAGINATION
  // ====================================================

  const pages =
    Math.max(
      1,

      Math.ceil(
        result.length /
          PAGE_SIZE
      )
    );


  const page =
    Math.min(
      pages,

      Math.max(
        1,

        Number.parseInt(
          params.get(
            "page"
          ) ||
            "1",
          10
        ) ||
          1
      )
    );


  const startIndex =
    result.length
      ? (
          page -
          1
        ) *
          PAGE_SIZE +
        1
      : 0;


  const endIndex =
    Math.min(
      page *
        PAGE_SIZE,

      result.length
    );


  // ====================================================
  // QUERY VALUES
  // ====================================================

  const searchQuery =
    params.get(
      "search"
    ) ||
    "";


  const categoryQuery =
    params.get(
      "category"
    ) ||
    "";


  const collection =
    params.get(
      "collection"
    ) ||
    "";


  // ====================================================
  // CHANGE URL FILTERS
  // ====================================================

  function change(
    values
  ) {
    const next =
      new URLSearchParams(
        params
      );


    next.delete(
      "page"
    );


    for (
      const [
        key,
        value,
      ] of
      Object.entries(
        values
      )
    ) {
      if (
        value
      ) {
        next.set(
          key,
          value
        );

      } else {
        next.delete(
          key
        );
      }
    }


    setParams(
      next
    );


    if (
      values.page
    ) {
      document
        .getElementById(
          "shop-results"
        )
        ?.scrollIntoView({
          block:
            "start",

          behavior:
            "smooth",
        });
    }
  }


  // ====================================================
  // RESET FILTERS
  //
  // Keeps current search query.
  // ====================================================

  function reset() {
    if (
      searchQuery
    ) {
      setParams({
        search:
          searchQuery,
      });

    } else {
      setParams({});
    }
  }


  // ====================================================
  // RESET EVERYTHING
  // ====================================================

  function browseAll() {
    setParams({});
  }


  // ====================================================
  // FILTER CHIPS
  // ====================================================

  const chips =
    useMemo(
      () =>
        [
          ...params.entries(),
        ]
          .flatMap(
            (
              [
                key,
                value,
              ]
            ) => {
              if (
                MULTI_VALUE_FILTERS.includes(
                  key
                )
              ) {
                return splitValues(
                  value
                ).map(
                  (
                    item
                  ) => [
                    key,
                    item,
                  ]
                );
              }


              return [
                [
                  key,
                  value,
                ],
              ];
            }
          )
          .filter(
            (
              [
                key,
              ]
            ) =>
              ![
                "page",
                "sort",
              ].includes(
                key
              )
          ),

      [
        params,
      ]
    );


  const activeFilterCount =
    chips.filter(
      (
        [
          key,
        ]
      ) =>
        ![
          "search",
          "collection",
        ].includes(
          key
        )
    ).length;


  // ====================================================
  // REMOVE CHIP
  // ====================================================

  function removeChip(
    key,
    value
  ) {
    if (
      MULTI_VALUE_FILTERS.includes(
        key
      )
    ) {
      const nextValue =
        splitValues(
          params.get(
            key
          )
        )
          .filter(
            (
              item
            ) =>
              item !==
              value
          )
          .join(
            ","
          );


      change({
        [key]:
          nextValue,

        ...(
          key ===
          "category"
            ? {
                subcategory:
                  "",

                size:
                  "",

                color:
                  "",
              }
            : {}
        ),
      });


      return;
    }


    change({
      [key]:
        "",
    });
  }


  // ====================================================
  // PAGE TITLE
  // ====================================================

  let title =
    "All workout essentials";


  if (
    searchQuery
  ) {
    title =
      `Results for “${searchQuery}”`;

  } else if (
    categoryQuery
  ) {
    title =
      categoryQuery.replaceAll(
        ",",
        " & "
      );

  } else if (
    collection ===
    "featured"
  ) {
    title =
      "Trending now";

  } else if (
    collection ===
    "bestsellers"
  ) {
    title =
      "Bestsellers";

  } else if (
    collection ===
    "new"
  ) {
    title =
      "New arrivals";
  }


  // ====================================================
  // FILTER PROPS
  // ====================================================

  const filters = {
    params,
    change,
    reset,
    products,
  };


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="shop-page">
      {/* ===============================================
          BREADCRUMB
      =============================================== */}

      <nav
        className="breadcrumb"
        aria-label="Breadcrumb"
      >
        <Link to="/">
          Home
        </Link>


        <span>
          /
        </span>


        <span>
          Shop
        </span>
      </nav>


      {/* ===============================================
          TITLE
      =============================================== */}

      <div className="shop-title">
        <div>
          <h1>
            {title}
          </h1>


          {!loading &&
            !loadError && (
            <p className="muted">
              {result.length ===
              0
                ? "No matching products"

                : result.length <=
                    PAGE_SIZE
                  ? `${result.length} ${
                      result.length ===
                      1
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
                search:
                  "",
              })
            }
          >
            Clear search
          </button>
        )}
      </div>


      {/* ===============================================
          SEARCH RESULT MESSAGE
      =============================================== */}

      {searchQuery &&
        !loading &&
        !loadError &&
        result.length >
          0 && (
        <div className="notice">
          <strong>
            {result.length}{" "}
            {result.length ===
            1
              ? "match"
              : "matches"}{" "}
            found
          </strong>

          {" for "}

          <span>
            “{searchQuery}”
          </span>
        </div>
      )}


      {/* ===============================================
          TOOLBAR
      =============================================== */}

      <div className="shop-toolbar">
        {/* MOBILE FILTER */}

        <button
          type="button"
          className="button secondary mobile-filter"
          onClick={() =>
            setDrawer(
              true
            )
          }
        >
          Filters

          {activeFilterCount >
            0
            ? ` (${activeFilterCount})`
            : ""}
        </button>


        {/* COLLECTION SHORTCUTS */}

        <div
          className="collection-links"
          aria-label="Popular collections"
        >
          <Link
            to="/shop?collection=featured"
            aria-current={
              collection ===
              "featured"
                ? "page"
                : undefined
            }
          >
            Trending
          </Link>


          <Link
            to="/shop?collection=bestsellers"
            aria-current={
              collection ===
              "bestsellers"
                ? "page"
                : undefined
            }
          >
            Bestsellers
          </Link>


          <Link
            to="/shop?collection=new"
            aria-current={
              collection ===
              "new"
                ? "page"
                : undefined
            }
          >
            New arrivals
          </Link>
        </div>


        {/* SORT */}

        <label className="sort-label">
          Sort by:{" "}


          <select
            value={
              params.get(
                "sort"
              ) ||
              "recommended"
            }
            onChange={(
              event
            ) =>
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


      {/* ===============================================
          SHOP
      =============================================== */}

      <div className="shop-layout">
        {/* DESKTOP FILTERS */}

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
          {/* ===========================================
              FILTER CHIPS
          ============================================ */}

          {chips.length >
            0 && (
            <div className="active-filter-area">
              <div className="filter-chips">
                {chips.map(
                  (
                    [
                      key,
                      value,
                    ]
                  ) => (
                    <button
                      type="button"
                      key={`${key}-${value}`}
                      onClick={() =>
                        removeChip(
                          key,
                          value
                        )
                      }
                      aria-label={`Remove ${chipLabel(
                        key,
                        value
                      )}`}
                    >
                      {chipLabel(
                        key,
                        value
                      )}


                      <span aria-hidden="true">
                        ×
                      </span>
                    </button>
                  )
                )}
              </div>


              {activeFilterCount >
                1 && (
                <button
                  type="button"
                  className="text-link"
                  onClick={
                    reset
                  }
                >
                  Clear filters
                </button>
              )}
            </div>
          )}


          {/* ===========================================
              LOADING
          ============================================ */}

          {loading && (
            <div className="empty-state">
              <h2>
                Loading products...
              </h2>


              <p>
                Getting the latest GymDrobe products.
              </p>
            </div>
          )}


          {/* ===========================================
              ERROR
          ============================================ */}

          {!loading &&
            loadError && (
            <div className="empty-state">
              <h2>
                Unable to load products
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


          {/* ===========================================
              PRODUCT GRID
          ============================================ */}

          {!loading &&
            !loadError &&
            result.length >
              0 && (
            <>
              <div className="shop-results-head">
                <span className="muted">
                  {startIndex}–
                  {endIndex} of{" "}
                  {result.length}
                </span>
              </div>


              <div className="product-grid">
                {result
                  .slice(
                    (
                      page -
                      1
                    ) *
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


              {/* =======================================
                  PAGINATION
              ======================================== */}

              {pages >
                1 && (
                <nav
                  className="pagination"
                  aria-label="Product pages"
                >
                  <button
                    type="button"
                    disabled={
                      page ===
                      1
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
                    Page{" "}
                    <strong>
                      {page}
                    </strong>{" "}
                    of{" "}
                    <strong>
                      {pages}
                    </strong>
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


          {/* ===========================================
              EMPTY STATE
          ============================================ */}

          {!loading &&
            !loadError &&
            result.length ===
              0 && (
            <div className="empty-state">
              <h2>
                {products.length ===
                0
                  ? "No products are available yet"

                  : searchQuery
                    ? `No results for “${searchQuery}”`

                    : "No products match your filters"}
              </h2>


              <p>
                {products.length ===
                0
                  ? "Products added to GymDrobe will appear here."

                  : searchQuery
                    ? "Try a different product name, brand or category, or remove some filters."

                    : "Remove a filter or explore the complete GymDrobe collection."}
              </p>


              {products.length >
                0 && (
                <div className="empty-actions">
                  {chips.length >
                    0 && (
                    <button
                      type="button"
                      className="button"
                      onClick={
                        reset
                      }
                    >
                      Clear filters
                    </button>
                  )}


                  <button
                    type="button"
                    className="button secondary"
                    onClick={
                      browseAll
                    }
                  >
                    Browse all products
                  </button>
                </div>
              )}


              {searchQuery && (
                <p>
                  Try popular sections:{" "}

                  <Link
                    className="text-link"
                    to="/shop?collection=bestsellers"
                  >
                    Bestsellers
                  </Link>

                  {" · "}

                  <Link
                    className="text-link"
                    to="/shop?collection=featured"
                  >
                    Trending
                  </Link>

                  {" · "}

                  <Link
                    className="text-link"
                    to="/shop?collection=new"
                  >
                    New arrivals
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>


      {/* ===============================================
          MOBILE FILTER MODAL
      =============================================== */}

      {drawer && (
        <Modal
          title={
            activeFilterCount >
            0
              ? `Filters (${activeFilterCount})`
              : "Filter products"
          }
          className="filter-modal"
          onClose={() =>
            setDrawer(
              false
            )
          }
        >
          <Filters
            {...filters}
          />


          <div className="mobile-filter-actions">
            {activeFilterCount >
              0 && (
              <button
                type="button"
                className="button secondary full"
                onClick={
                  reset
                }
              >
                Clear filters
              </button>
            )}


            <button
              type="button"
              className="button full"
              onClick={() =>
                setDrawer(
                  false
                )
              }
            >
              Show{" "}
              {result.length}{" "}
              {result.length ===
              1
                ? "product"
                : "products"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}