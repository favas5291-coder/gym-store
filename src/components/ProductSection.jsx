import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "react-router-dom";

import ProductCard from "./ProductCard";
import products from "../data/products";

/* =========================================================
   HELPERS
========================================================= */

function getArrayFromParam(searchParams, key) {
  const value = searchParams.get(key);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDiscountedPrice(product) {
  const price = Number(product?.price || 0);
  const discount = Number(product?.discount || 0);

  if (!Number.isFinite(price)) {
    return 0;
  }

  if (
    !Number.isFinite(discount) ||
    discount <= 0
  ) {
    return Math.round(price);
  }

  return Math.round(
    price - (price * discount) / 100
  );
}

/* =========================================================
   STOCK

   Variant stock is the preferred source because your
   products can have stock separated by size/color.
========================================================= */

function getProductStock(product) {
  if (!product) {
    return 0;
  }

  if (
    product.variants &&
    typeof product.variants === "object"
  ) {
    let totalStock = 0;

    Object.values(
      product.variants
    ).forEach((variantGroup) => {
      if (
        typeof variantGroup === "number" &&
        Number.isFinite(variantGroup)
      ) {
        totalStock += variantGroup;
        return;
      }

      if (
        variantGroup &&
        typeof variantGroup === "object"
      ) {
        Object.values(
          variantGroup
        ).forEach((value) => {
          const stock =
            Number(value);

          if (
            Number.isFinite(stock)
          ) {
            totalStock += stock;
          }
        });
      }
    });

    return Math.max(
      totalStock,
      0
    );
  }

  const directStock =
    Number(product.stock);

  if (
    Number.isFinite(directStock)
  ) {
    return Math.max(
      directStock,
      0
    );
  }

  return 0;
}

function getSearchableText(product) {
  return [
    product?.name,
    product?.category,
    product?.subcategory,
    product?.brand,
    product?.gender,
    product?.material,
    product?.description,
    product?.sku,
    product?.badge,
    ...(product?.tags || []),
    ...(product?.colors || []),
    ...(product?.sizes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueValues(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

/* =========================================================
   SIZE SORTING
========================================================= */

function sortSizes(values) {
  const sizeOrder = [
    "XXS",
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "XXXL",
  ];

  return [...values].sort(
    (first, second) => {
      const firstNumber =
        Number(first);

      const secondNumber =
        Number(second);

      if (
        Number.isFinite(firstNumber) &&
        Number.isFinite(secondNumber)
      ) {
        return (
          firstNumber -
          secondNumber
        );
      }

      const firstIndex =
        sizeOrder.indexOf(
          String(first)
        );

      const secondIndex =
        sizeOrder.indexOf(
          String(second)
        );

      if (
        firstIndex !== -1 &&
        secondIndex !== -1
      ) {
        return (
          firstIndex -
          secondIndex
        );
      }

      if (firstIndex !== -1) {
        return -1;
      }

      if (secondIndex !== -1) {
        return 1;
      }

      return String(
        first
      ).localeCompare(
        String(second)
      );
    }
  );
}

/* =========================================================
   COLOR DOTS
========================================================= */

function getColorHex(color) {
  const colors = {
    Black: "#111111",
    White: "#ffffff",
    Blue: "#2563eb",
    Grey: "#9ca3af",
    Gray: "#9ca3af",
    Red: "#dc2626",
    Green: "#16a34a",
    Orange: "#f97316",
    Yellow: "#eab308",
    Pink: "#ec4899",
    Purple: "#9333ea",
    Navy: "#172554",
    Brown: "#78350f",
    Beige: "#d6c5a8",
    Graphite: "#374151",
  };

  return (
    colors[color] ||
    "#d1d5db"
  );
}

/* =========================================================
   FILTER SECTION
========================================================= */

function FilterSection({
  title,
  children,
}) {
  return (
    <div
      className="
        border-b
        border-[#eaeaec]
        px-5
        py-5
      "
    >
      <h3
        className="
          mb-4
          text-[12px]
          font-bold
          uppercase
          tracking-[0.04em]
          text-[#282c3f]
        "
      >
        {title}
      </h3>

      {children}
    </div>
  );
}

/* =========================================================
   FILTER CHECKBOX
========================================================= */

function FilterCheckbox({
  checked,
  onChange,
  label,
  count,
  color,
}) {
  return (
    <label
      className="
        flex
        cursor-pointer
        items-center
        gap-3
        py-[5px]
        text-[13px]
        text-[#282c3f]
      "
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="
          h-[15px]
          w-[15px]
          shrink-0
          cursor-pointer
          accent-orange-600
        "
      />

      {color && (
        <span
          className="
            h-3
            w-3
            shrink-0
            rounded-full
            border
            border-gray-300
          "
          style={{
            backgroundColor:
              getColorHex(
                color
              ),
          }}
        />
      )}

      <span
        className="
          min-w-0
          truncate
        "
      >
        {label}
      </span>

      {count !== undefined && (
        <span
          className="
            ml-auto
            text-[10px]
            text-[#94969f]
          "
        >
          ({count})
        </span>
      )}
    </label>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function ProductSection({
  wishlist = [],
  toggleWishlist,
}) {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [
    isFilterOpen,
    setIsFilterOpen,
  ] = useState(false);

  const [
    visibleCount,
    setVisibleCount,
  ] = useState(15);

  /* =======================================================
     URL VALUES
  ======================================================= */

  const search =
    searchParams.get(
      "search"
    ) || "";

  const selectedCategory =
    searchParams.get(
      "category"
    ) || "";

  const selectedSubcategory =
    searchParams.get(
      "subcategory"
    ) || "";

  const selectedBrands =
    getArrayFromParam(
      searchParams,
      "brand"
    );

  const selectedSizes =
    getArrayFromParam(
      searchParams,
      "size"
    );

  const selectedColors =
    getArrayFromParam(
      searchParams,
      "color"
    );

  const availability =
    searchParams.get(
      "availability"
    ) || "";

  const sort =
    searchParams.get(
      "sort"
    ) || "default";

  const minPrice =
    searchParams.get(
      "minPrice"
    ) || "";

  const maxPrice =
    searchParams.get(
      "maxPrice"
    ) || "";

  const minRating =
    searchParams.get(
      "rating"
    ) || "";

  const minDiscount =
    searchParams.get(
      "discount"
    ) || "";

  /* =======================================================
     RESET PAGINATION WHEN FILTER CHANGES
  ======================================================= */

  const filterKey =
    searchParams.toString();

  useEffect(() => {
    setVisibleCount(15);
  }, [filterKey]);

  /* =======================================================
     URL HELPERS
  ======================================================= */

  function updateParam(
    key,
    value
  ) {
    const next =
      new URLSearchParams(
        searchParams
      );

    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      next.delete(key);
    } else {
      next.set(
        key,
        String(value)
      );
    }

    setSearchParams(next);
  }

  function updateMultipleParams(
    updates
  ) {
    const next =
      new URLSearchParams(
        searchParams
      );

    Object.entries(
      updates
    ).forEach(
      ([key, value]) => {
        if (
          value === "" ||
          value === null ||
          value === undefined
        ) {
          next.delete(key);
        } else {
          next.set(
            key,
            String(value)
          );
        }
      }
    );

    setSearchParams(next);
  }

  function toggleMultiValue(
    key,
    value
  ) {
    const current =
      getArrayFromParam(
        searchParams,
        key
      );

    const exists =
      current.includes(value);

    const updated = exists
      ? current.filter(
          (item) =>
            item !== value
        )
      : [
          ...current,
          value,
        ];

    updateParam(
      key,
      updated.join(",")
    );
  }

  /* =======================================================
     CLEAR FILTERS

     Keep search + sorting because they are not sidebar
     filters.
  ======================================================= */

  function clearFilters() {
    const next =
      new URLSearchParams();

    if (search) {
      next.set(
        "search",
        search
      );
    }

    if (
      sort &&
      sort !== "default"
    ) {
      next.set(
        "sort",
        sort
      );
    }

    setSearchParams(next);
  }

  function selectCategory(
    category
  ) {
    updateMultipleParams({
      category,
      subcategory: "",
      brand: "",
      size: "",
      color: "",
    });
  }

  /* =======================================================
     CATEGORY OPTIONS
  ======================================================= */

  const categories =
    useMemo(() => {
      return uniqueValues(
        products.map(
          (product) =>
            product.category
        )
      ).sort((a, b) =>
        String(
          a
        ).localeCompare(
          String(b)
        )
      );
    }, []);

  /* =======================================================
     SUBCATEGORY OPTIONS
  ======================================================= */

  const subcategories =
    useMemo(() => {
      if (
        !selectedCategory
      ) {
        return [];
      }

      return uniqueValues(
        products
          .filter(
            (product) =>
              product.category ===
              selectedCategory
          )
          .map(
            (product) =>
              product.subcategory
          )
      ).sort((a, b) =>
        String(
          a
        ).localeCompare(
          String(b)
        )
      );
    }, [
      selectedCategory,
    ]);

  /* =======================================================
     FILTER BASE PRODUCTS

     Brand/size/color options now change based on selected
     category/subcategory instead of showing unrelated
     options.
  ======================================================= */

  const filterBaseProducts =
    useMemo(() => {
      let result = [
        ...products,
      ];

      if (
        selectedCategory
      ) {
        result =
          result.filter(
            (product) =>
              product.category ===
              selectedCategory
          );
      }

      if (
        selectedSubcategory
      ) {
        result =
          result.filter(
            (product) =>
              product.subcategory ===
              selectedSubcategory
          );
      }

      return result;
    }, [
      selectedCategory,
      selectedSubcategory,
    ]);

  const brands =
    useMemo(() => {
      return uniqueValues(
        filterBaseProducts.map(
          (product) =>
            product.brand
        )
      ).sort((a, b) =>
        String(
          a
        ).localeCompare(
          String(b)
        )
      );
    }, [
      filterBaseProducts,
    ]);

  const sizes =
    useMemo(() => {
      return sortSizes(
        uniqueValues(
          filterBaseProducts.flatMap(
            (product) =>
              product.sizes || []
          )
        )
      );
    }, [
      filterBaseProducts,
    ]);

  const colors =
    useMemo(() => {
      return uniqueValues(
        filterBaseProducts.flatMap(
          (product) =>
            product.colors || []
        )
      ).sort((a, b) =>
        String(
          a
        ).localeCompare(
          String(b)
        )
      );
    }, [
      filterBaseProducts,
    ]);

  /* =======================================================
     COUNTS
  ======================================================= */

  function countCategory(
    category
  ) {
    return products.filter(
      (product) =>
        product.category ===
        category
    ).length;
  }

  function countBrand(
    brand
  ) {
    return filterBaseProducts.filter(
      (product) =>
        product.brand ===
        brand
    ).length;
  }

  function countColor(
    color
  ) {
    return filterBaseProducts.filter(
      (product) =>
        product.colors?.includes(
          color
        )
    ).length;
  }

  function countSize(
    size
  ) {
    return filterBaseProducts.filter(
      (product) =>
        product.sizes?.includes(
          size
        )
    ).length;
  }

  /* =======================================================
     FILTER PRODUCTS
  ======================================================= */

  const filteredProducts =
    useMemo(() => {
      let result = [
        ...products,
      ];

      /* CATEGORY */

      if (
        selectedCategory
      ) {
        result =
          result.filter(
            (product) =>
              product.category ===
              selectedCategory
          );
      }

      /* SUBCATEGORY */

      if (
        selectedSubcategory
      ) {
        result =
          result.filter(
            (product) =>
              product.subcategory ===
              selectedSubcategory
          );
      }

      /* SEARCH */

      const searchText =
        search
          .trim()
          .toLowerCase();

      if (searchText) {
        result =
          result.filter(
            (product) =>
              getSearchableText(
                product
              ).includes(
                searchText
              )
          );
      }

      /* BRAND */

      if (
        selectedBrands.length >
        0
      ) {
        result =
          result.filter(
            (product) =>
              selectedBrands.includes(
                product.brand
              )
          );
      }

      /* SIZE */

      if (
        selectedSizes.length >
        0
      ) {
        result =
          result.filter(
            (product) =>
              selectedSizes.some(
                (size) =>
                  product.sizes?.includes(
                    size
                  )
              )
          );
      }

      /* COLOR */

      if (
        selectedColors.length >
        0
      ) {
        result =
          result.filter(
            (product) =>
              selectedColors.some(
                (color) =>
                  product.colors?.includes(
                    color
                  )
              )
          );
      }

      /* AVAILABILITY */

      if (
        availability ===
        "in-stock"
      ) {
        result =
          result.filter(
            (product) =>
              getProductStock(
                product
              ) > 0
          );
      }

      if (
        availability ===
        "out-of-stock"
      ) {
        result =
          result.filter(
            (product) =>
              getProductStock(
                product
              ) <= 0
          );
      }

      /* MIN PRICE */

      if (
        minPrice !== ""
      ) {
        const value =
          Number(minPrice);

        if (
          Number.isFinite(value)
        ) {
          result =
            result.filter(
              (product) =>
                getDiscountedPrice(
                  product
                ) >= value
            );
        }
      }

      /* MAX PRICE */

      if (
        maxPrice !== ""
      ) {
        const value =
          Number(maxPrice);

        if (
          Number.isFinite(value)
        ) {
          result =
            result.filter(
              (product) =>
                getDiscountedPrice(
                  product
                ) <= value
            );
        }
      }

      /* RATING */

      if (
        minRating !== ""
      ) {
        const value =
          Number(minRating);

        result =
          result.filter(
            (product) =>
              Number(
                product.rating ||
                  0
              ) >= value
          );
      }

      /* DISCOUNT */

      if (
        minDiscount !== ""
      ) {
        const value =
          Number(
            minDiscount
          );

        result =
          result.filter(
            (product) =>
              Number(
                product.discount ||
                  0
              ) >= value
          );
      }

      /* =============================================
         SORTING
      ============================================= */

      if (
        sort ===
        "price-low"
      ) {
        result.sort(
          (a, b) =>
            getDiscountedPrice(
              a
            ) -
            getDiscountedPrice(
              b
            )
        );
      }

      if (
        sort ===
        "price-high"
      ) {
        result.sort(
          (a, b) =>
            getDiscountedPrice(
              b
            ) -
            getDiscountedPrice(
              a
            )
        );
      }

      if (
        sort === "rating"
      ) {
        result.sort(
          (a, b) =>
            Number(
              b.rating || 0
            ) -
            Number(
              a.rating || 0
            )
        );
      }

      if (
        sort === "discount"
      ) {
        result.sort(
          (a, b) =>
            Number(
              b.discount || 0
            ) -
            Number(
              a.discount || 0
            )
        );
      }

      if (
        sort === "newest"
      ) {
        result.sort(
          (a, b) =>
            Number(
              Boolean(
                b.isNew
              )
            ) -
            Number(
              Boolean(
                a.isNew
              )
            )
        );
      }

      if (
        sort ===
        "best-selling"
      ) {
        result.sort(
          (a, b) => {
            const bestsellerDifference =
              Number(
                Boolean(
                  b.isBestSeller
                )
              ) -
              Number(
                Boolean(
                  a.isBestSeller
                )
              );

            if (
              bestsellerDifference !==
              0
            ) {
              return bestsellerDifference;
            }

            return (
              Number(
                b.rating || 0
              ) -
              Number(
                a.rating || 0
              )
            );
          }
        );
      }

      return result;
    }, [
      search,
      selectedCategory,
      selectedSubcategory,
      selectedBrands,
      selectedSizes,
      selectedColors,
      availability,
      minPrice,
      maxPrice,
      minRating,
      minDiscount,
      sort,
    ]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const visibleProducts =
    filteredProducts.slice(
      0,
      visibleCount
    );

  const hasMoreProducts =
    visibleCount <
    filteredProducts.length;

  /* =======================================================
     ACTIVE FILTER COUNT
  ======================================================= */

  const activeFilterCount =
    (selectedCategory
      ? 1
      : 0) +
    (selectedSubcategory
      ? 1
      : 0) +
    selectedBrands.length +
    selectedSizes.length +
    selectedColors.length +
    (availability
      ? 1
      : 0) +
    (minPrice
      ? 1
      : 0) +
    (maxPrice
      ? 1
      : 0) +
    (minRating
      ? 1
      : 0) +
    (minDiscount
      ? 1
      : 0);

  /* =======================================================
     PAGE TITLE
  ======================================================= */

  let pageTitle =
    "All Products";

  if (
    selectedCategory
  ) {
    pageTitle =
      selectedCategory;
  }

  if (
    selectedSubcategory
  ) {
    pageTitle =
      selectedSubcategory;
  }

  if (search) {
    pageTitle =
      `Search Results For "${search}"`;
  }

  /* =======================================================
     FILTER CONTENT
  ======================================================= */

  function Filters() {
    return (
      <>
        {/* =============================================
            CATEGORIES
        ============================================= */}

        <FilterSection title="Categories">
          <div className="space-y-1">
            {categories.map(
              (category) => (
                <FilterCheckbox
                  key={category}
                  checked={
                    selectedCategory ===
                    category
                  }
                  onChange={() =>
                    selectCategory(
                      selectedCategory ===
                        category
                        ? ""
                        : category
                    )
                  }
                  label={category}
                  count={countCategory(
                    category
                  )}
                />
              )
            )}
          </div>
        </FilterSection>

        {/* =============================================
            SUBCATEGORIES
        ============================================= */}

        {selectedCategory &&
          subcategories.length >
            0 && (
            <FilterSection title="Subcategories">
              <div className="space-y-1">
                {subcategories.map(
                  (
                    subcategory
                  ) => (
                    <FilterCheckbox
                      key={
                        subcategory
                      }
                      checked={
                        selectedSubcategory ===
                        subcategory
                      }
                      onChange={() =>
                        updateParam(
                          "subcategory",
                          selectedSubcategory ===
                            subcategory
                            ? ""
                            : subcategory
                        )
                      }
                      label={
                        subcategory
                      }
                    />
                  )
                )}
              </div>
            </FilterSection>
          )}

        {/* =============================================
            BRAND
        ============================================= */}

        {brands.length > 0 && (
          <FilterSection title="Brand">
            <div className="space-y-1">
              {brands.map(
                (brand) => (
                  <FilterCheckbox
                    key={brand}
                    checked={
                      selectedBrands.includes(
                        brand
                      )
                    }
                    onChange={() =>
                      toggleMultiValue(
                        "brand",
                        brand
                      )
                    }
                    label={brand}
                    count={countBrand(
                      brand
                    )}
                  />
                )
              )}
            </div>
          </FilterSection>
        )}

        {/* =============================================
            PRICE
        ============================================= */}

        <FilterSection title="Price">
          <div
            className="
              grid
              grid-cols-2
              gap-2
            "
          >
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) =>
                updateParam(
                  "minPrice",
                  event.target.value
                )
              }
              placeholder="Min"
              className="
                min-w-0
                border
                border-[#d4d5d9]
                bg-white
                px-3
                py-2
                text-xs
                text-[#282c3f]
                outline-none
                focus:border-orange-500
              "
            />

            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) =>
                updateParam(
                  "maxPrice",
                  event.target.value
                )
              }
              placeholder="Max"
              className="
                min-w-0
                border
                border-[#d4d5d9]
                bg-white
                px-3
                py-2
                text-xs
                text-[#282c3f]
                outline-none
                focus:border-orange-500
              "
            />
          </div>
        </FilterSection>

        {/* =============================================
            COLOR
        ============================================= */}

        {colors.length > 0 && (
          <FilterSection title="Color">
            <div className="space-y-1">
              {colors.map(
                (color) => (
                  <FilterCheckbox
                    key={color}
                    checked={
                      selectedColors.includes(
                        color
                      )
                    }
                    onChange={() =>
                      toggleMultiValue(
                        "color",
                        color
                      )
                    }
                    label={color}
                    color={color}
                    count={countColor(
                      color
                    )}
                  />
                )
              )}
            </div>
          </FilterSection>
        )}

        {/* =============================================
            SIZE
        ============================================= */}

        {sizes.length > 0 && (
          <FilterSection title="Size">
            <div className="space-y-1">
              {sizes.map(
                (size) => (
                  <FilterCheckbox
                    key={size}
                    checked={
                      selectedSizes.includes(
                        size
                      )
                    }
                    onChange={() =>
                      toggleMultiValue(
                        "size",
                        size
                      )
                    }
                    label={size}
                    count={countSize(
                      size
                    )}
                  />
                )
              )}
            </div>
          </FilterSection>
        )}

        {/* =============================================
            CUSTOMER RATING
        ============================================= */}

        <FilterSection title="Customer Rating">
          <div className="space-y-1">
            {[
              {
                value: "4.5",
                label:
                  "4.5 ★ & above",
              },
              {
                value: "4",
                label:
                  "4 ★ & above",
              },
            ].map(
              (option) => (
                <FilterCheckbox
                  key={
                    option.value
                  }
                  checked={
                    minRating ===
                    option.value
                  }
                  onChange={() =>
                    updateParam(
                      "rating",
                      minRating ===
                        option.value
                        ? ""
                        : option.value
                    )
                  }
                  label={
                    option.label
                  }
                />
              )
            )}
          </div>
        </FilterSection>

        {/* =============================================
            DISCOUNT
        ============================================= */}

        <FilterSection title="Discount Range">
          <div className="space-y-1">
            {[
              10,
              20,
              30,
              50,
            ].map(
              (discount) => (
                <FilterCheckbox
                  key={
                    discount
                  }
                  checked={
                    minDiscount ===
                    String(
                      discount
                    )
                  }
                  onChange={() =>
                    updateParam(
                      "discount",
                      minDiscount ===
                        String(
                          discount
                        )
                        ? ""
                        : discount
                    )
                  }
                  label={`${discount}% and above`}
                />
              )
            )}
          </div>
        </FilterSection>

        {/* =============================================
            AVAILABILITY
        ============================================= */}

        <FilterSection title="Availability">
          <div className="space-y-1">
            <FilterCheckbox
              checked={
                availability ===
                "in-stock"
              }
              onChange={() =>
                updateParam(
                  "availability",
                  availability ===
                    "in-stock"
                    ? ""
                    : "in-stock"
                )
              }
              label="In Stock"
            />

            <FilterCheckbox
              checked={
                availability ===
                "out-of-stock"
              }
              onChange={() =>
                updateParam(
                  "availability",
                  availability ===
                    "out-of-stock"
                    ? ""
                    : "out-of-stock"
                )
              }
              label="Out Of Stock"
            />
          </div>
        </FilterSection>
      </>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section
      id="products"
      className="
        shop-page
        min-h-screen
        bg-white
        text-[#282c3f]
      "
    >
      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div
        className="
          mx-auto
          max-w-[1600px]
          px-4
          pb-5
          pt-7
          sm:px-6
          lg:px-8
        "
      >
        {/* BREADCRUMB */}

        <div
          className="
            mb-5
            flex
            flex-wrap
            items-center
            gap-2
            text-[11px]
            text-[#696b79]
          "
        >
          <span>Home</span>

          <span>/</span>

          <span>Shop</span>

          {selectedCategory && (
            <>
              <span>/</span>

              <span
                className="
                  font-semibold
                  text-[#282c3f]
                "
              >
                {
                  selectedCategory
                }
              </span>
            </>
          )}

          {selectedSubcategory && (
            <>
              <span>/</span>

              <span
                className="
                  font-semibold
                  text-[#282c3f]
                "
              >
                {
                  selectedSubcategory
                }
              </span>
            </>
          )}
        </div>

        {/* PAGE TITLE */}

        <div
          className="
            flex
            flex-col
            gap-1
            sm:flex-row
            sm:items-end
            sm:gap-2
          "
        >
          <h1
            className="
              text-[20px]
              font-bold
              text-[#282c3f]
            "
          >
            {pageTitle}
          </h1>

          <p
            className="
              pb-[2px]
              text-[13px]
              text-[#878b94]
            "
          >
            -{" "}
            {
              filteredProducts.length
            }{" "}
            item
            {filteredProducts.length !==
            1
              ? "s"
              : ""}
          </p>
        </div>
      </div>

      {/* =================================================
          DESKTOP FILTER / SORT TOOLBAR
      ================================================= */}

      <div
        className="
          border-y
          border-[#eaeaec]
          bg-white
        "
      >
        <div
          className="
            mx-auto
            hidden
            h-[62px]
            max-w-[1600px]
            items-center
            lg:grid
            lg:grid-cols-[260px_1fr]
          "
        >
          {/* FILTER TITLE */}

          <div
            className="
              flex
              h-full
              items-center
              justify-between
              border-r
              border-[#eaeaec]
              px-5
            "
          >
            <span
              className="
                text-[12px]
                font-bold
                uppercase
              "
            >
              Filters
            </span>

            {activeFilterCount >
              0 && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  text-orange-600
                  hover:text-orange-700
                "
              >
                Clear All
              </button>
            )}
          </div>

          {/* SORT */}

          <div
            className="
              flex
              h-full
              items-center
              justify-end
              px-6
            "
          >
            <label
              className="
                flex
                h-[40px]
                min-w-[250px]
                items-center
                border
                border-[#d4d5d9]
                bg-white
                px-3
                text-xs
              "
            >
              <span
                className="
                  mr-2
                  shrink-0
                  text-[#696b79]
                "
              >
                Sort by:
              </span>

              <select
                value={sort}
                onChange={(event) =>
                  updateParam(
                    "sort",
                    event.target
                      .value ===
                      "default"
                      ? ""
                      : event.target
                          .value
                  )
                }
                className="
                  min-w-0
                  flex-1
                  cursor-pointer
                  bg-transparent
                  font-semibold
                  text-[#282c3f]
                  outline-none
                "
              >
                <option value="default">
                  Recommended
                </option>

                <option value="best-selling">
                  Best Selling
                </option>

                <option value="newest">
                  Newest
                </option>

                <option value="rating">
                  Customer Rating
                </option>

                <option value="discount">
                  Better Discount
                </option>

                <option value="price-low">
                  Price: Low to High
                </option>

                <option value="price-high">
                  Price: High to Low
                </option>
              </select>
            </label>
          </div>
        </div>

        {/* =================================================
            MOBILE FILTER/SORT BAR
        ================================================= */}

        <div
          className="
            grid
            grid-cols-2
            divide-x
            divide-[#eaeaec]
            lg:hidden
          "
        >
          <button
            type="button"
            onClick={() =>
              setIsFilterOpen(
                true
              )
            }
            className="
              flex
              h-[52px]
              items-center
              justify-center
              gap-2
              text-xs
              font-bold
              uppercase
            "
          >
            Filters

            {activeFilterCount >
              0 && (
              <span
                className="
                  flex
                  h-5
                  min-w-5
                  items-center
                  justify-center
                  rounded-full
                  bg-orange-600
                  px-1
                  text-[9px]
                  text-white
                "
              >
                {
                  activeFilterCount
                }
              </span>
            )}
          </button>

          <select
            value={sort}
            onChange={(event) =>
              updateParam(
                "sort",
                event.target
                  .value ===
                  "default"
                  ? ""
                  : event.target
                      .value
              )
            }
            className="
              h-[52px]
              w-full
              cursor-pointer
              bg-white
              px-4
              text-center
              text-xs
              font-bold
              uppercase
              outline-none
            "
          >
            <option value="default">
              Recommended
            </option>

            <option value="best-selling">
              Best Selling
            </option>

            <option value="newest">
              Newest
            </option>

            <option value="rating">
              Rating
            </option>

            <option value="discount">
              Discount
            </option>

            <option value="price-low">
              Price Low
            </option>

            <option value="price-high">
              Price High
            </option>
          </select>
        </div>
      </div>

      {/* =================================================
          MAIN SHOP BODY
      ================================================= */}

      <div
        className="
          mx-auto
          max-w-[1600px]
          lg:grid
          lg:grid-cols-[260px_minmax(0,1fr)]
        "
      >
        {/* =================================================
            DESKTOP FILTER SIDEBAR
        ================================================= */}

        <aside
          className="
            hidden
            border-r
            border-[#eaeaec]
            bg-white
            lg:block
          "
        >
          <Filters />
        </aside>

        {/* =================================================
            PRODUCTS
        ================================================= */}

        <main
          className="
            min-w-0
            bg-white
            px-3
            py-6
            sm:px-5
            lg:px-6
          "
        >
          {visibleProducts.length >
          0 ? (
            <>
              {/* PRODUCT GRID */}

              <div
                className="
                  grid
                  grid-cols-2
                  gap-x-2
                  gap-y-8

                  sm:gap-x-4

                  md:grid-cols-3

                  lg:grid-cols-4
                  lg:gap-x-4

                  xl:grid-cols-5
                  xl:gap-x-5
                "
              >
                {visibleProducts.map(
                  (product) => {
                    const isWishlisted =
                      wishlist.some(
                        (item) =>
                          String(
                            item.id
                          ) ===
                          String(
                            product.id
                          )
                      );

                    return (
                      <ProductCard
                        key={
                          product.id
                        }
                        id={
                          product.id
                        }
                        name={
                          product.name
                        }
                        category={
                          product.category
                        }
                        brand={
                          product.brand
                        }
                        price={
                          product.price
                        }
                        rating={
                          product.rating
                        }
                        reviewCount={
                          product.reviewCount
                        }
                        discount={
                          product.discount
                        }
                        image={
                          product.image
                        }
                        badge={
                          product.badge
                        }
                        stock={getProductStock(
                          product
                        )}
                        wishlist={
                          isWishlisted
                        }
                        onWishlist={() =>
                          toggleWishlist?.(
                            product
                          )
                        }
                      />
                    );
                  }
                )}
              </div>

              {/* LOAD MORE */}

              {hasMoreProducts && (
                <div
                  className="
                    mt-12
                    flex
                    flex-col
                    items-center
                  "
                >
                  <p
                    className="
                      mb-3
                      text-[11px]
                      text-[#696b79]
                    "
                  >
                    Showing{" "}
                    {
                      visibleProducts.length
                    }{" "}
                    of{" "}
                    {
                      filteredProducts.length
                    }{" "}
                    products
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount(
                        (
                          current
                        ) =>
                          current +
                          15
                      )
                    }
                    className="
                      border
                      border-[#282c3f]
                      bg-white
                      px-8
                      py-3
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-[#282c3f]
                      transition
                      hover:bg-[#282c3f]
                      hover:text-white
                    "
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ===========================================
               EMPTY STATE
            =========================================== */

            <div
              className="
                flex
                min-h-[430px]
                flex-col
                items-center
                justify-center
                px-5
                text-center
              "
            >
              <div className="text-4xl">
                🔍
              </div>

              <h2
                className="
                  mt-4
                  text-lg
                  font-bold
                  text-[#282c3f]
                "
              >
                No products found
              </h2>

              <p
                className="
                  mt-2
                  max-w-sm
                  text-sm
                  leading-6
                  text-[#696b79]
                "
              >
                Try changing or
                removing some of your
                filters.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="
                  mt-5
                  border
                  border-orange-600
                  px-5
                  py-2.5
                  text-xs
                  font-bold
                  uppercase
                  text-orange-600
                  transition
                  hover:bg-orange-600
                  hover:text-white
                "
              >
                Clear Filters
              </button>
            </div>
          )}
        </main>
      </div>

      {/* =================================================
          MOBILE FILTER DRAWER
      ================================================= */}

      {isFilterOpen && (
        <div
          className="
            fixed
            inset-0
            z-[250]
            lg:hidden
          "
        >
          {/* OVERLAY */}

          <button
            type="button"
            aria-label="Close filters"
            onClick={() =>
              setIsFilterOpen(
                false
              )
            }
            className="
              absolute
              inset-0
              bg-black/50
            "
          />

          {/* DRAWER */}

          <div
            className="
              absolute
              bottom-0
              left-0
              top-0
              w-[88%]
              max-w-[360px]
              overflow-y-auto
              bg-white
            "
          >
            {/* DRAWER HEADER */}

            <div
              className="
                sticky
                top-0
                z-20
                flex
                h-[64px]
                items-center
                justify-between
                border-b
                border-[#eaeaec]
                bg-white
                px-5
              "
            >
              <div>
                <p
                  className="
                    text-sm
                    font-bold
                    uppercase
                    text-[#282c3f]
                  "
                >
                  Filters
                </p>

                <p
                  className="
                    mt-0.5
                    text-[10px]
                    text-[#696b79]
                  "
                >
                  {
                    filteredProducts.length
                  }{" "}
                  product
                  {filteredProducts.length !==
                  1
                    ? "s"
                    : ""}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() =>
                  setIsFilterOpen(
                    false
                  )
                }
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  text-2xl
                  text-[#282c3f]
                "
              >
                ×
              </button>
            </div>

            {/* FILTER CONTENT */}

            <Filters />

            {/* FILTER ACTIONS */}

            <div
              className="
                sticky
                bottom-0
                z-20
                grid
                grid-cols-2
                border-t
                border-[#eaeaec]
                bg-white
              "
            >
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="
                  h-[56px]
                  text-xs
                  font-bold
                  uppercase
                  text-[#282c3f]
                "
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() =>
                  setIsFilterOpen(
                    false
                  )
                }
                className="
                  h-[56px]
                  bg-orange-600
                  text-xs
                  font-bold
                  uppercase
                  text-white
                "
              >
                Apply (
                {
                  filteredProducts.length
                })
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProductSection;