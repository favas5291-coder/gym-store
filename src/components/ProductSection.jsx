import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import ProductCard from "./ProductCard";
import products from "../data/products";

// =====================================================
// HELPERS
// =====================================================

function getProductStock(product) {
  if (!product) {
    return 0;
  }

  // If variants exist, calculate stock from variants.
  if (
    product.variants &&
    typeof product.variants === "object"
  ) {
    let totalStock = 0;

    Object.values(product.variants).forEach(
      (variantGroup) => {
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
            if (
              typeof value === "number" &&
              Number.isFinite(value)
            ) {
              totalStock += value;
            }
          });
        }
      }
    );

    return Math.max(0, totalStock);
  }

  // Fallback to direct stock.
  if (
    typeof product.stock === "number" &&
    Number.isFinite(product.stock)
  ) {
    return Math.max(0, product.stock);
  }

  return 0;
}

// -----------------------------------------------------

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
    return price;
  }

  return Math.round(
    price - (price * discount) / 100
  );
}

// -----------------------------------------------------

function getSearchableText(product) {
  return [
    product?.name,
    product?.category,
    product?.subcategory,
    product?.brand,
    product?.description,
    product?.gender,
    product?.material,
    product?.sku,
    product?.badge,
    ...(product?.colors || []),
    ...(product?.sizes || []),
    ...(product?.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// -----------------------------------------------------

function getArrayFromParam(
  searchParams,
  key
) {
  const value = searchParams.get(key);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// -----------------------------------------------------

function getSalesValue(product) {
  return Number(
    product?.soldCount ??
      product?.sales ??
      product?.orders ??
      product?.popularity ??
      0
  );
}

// =====================================================
// COMPONENT
// =====================================================

function ProductSection({
  wishlist = [],
  toggleWishlist,
}) {
  const [searchParams, setSearchParams] =
    useSearchParams();

  // ===================================================
  // URL VALUES
  // ===================================================

  const urlSearch =
    searchParams.get("search") || "";

  const selectedCategory =
    searchParams.get("category") || "";

  const selectedSubcategory =
    searchParams.get("subcategory") || "";

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
    searchParams.get("availability") || "";

  const urlSort =
    searchParams.get("sort") || "default";

  const urlMinPrice =
    searchParams.get("minPrice") || "";

  const urlMaxPrice =
    searchParams.get("maxPrice") || "";

  const urlMinRating =
    searchParams.get("rating") || "";

  const urlMinDiscount =
    searchParams.get("discount") || "";

  // ===================================================
  // STATE
  // ===================================================

  const [search, setSearch] =
    useState(urlSearch);

  const [sort, setSort] =
    useState(urlSort);

  const [minPrice, setMinPrice] =
    useState(urlMinPrice);

  const [maxPrice, setMaxPrice] =
    useState(urlMaxPrice);

  const [minRating, setMinRating] =
    useState(urlMinRating);

  const [minDiscount, setMinDiscount] =
    useState(urlMinDiscount);

  const [isFilterOpen, setIsFilterOpen] =
    useState(false);

  const [recentSearches, setRecentSearches] =
    useState([]);

  const [visibleCount, setVisibleCount] =
    useState(12);

  // ===================================================
  // LOAD RECENT SEARCHES
  // ===================================================

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(
          "gymdrobe-recent-searches"
        );

      if (!stored) {
        return;
      }

      const parsed =
        JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setRecentSearches(parsed);
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  // ===================================================
  // SYNC LOCAL STATE WITH URL
  // ===================================================

  useEffect(() => {
    setSearch(urlSearch);
    setSort(urlSort);
    setMinPrice(urlMinPrice);
    setMaxPrice(urlMaxPrice);
    setMinRating(urlMinRating);
    setMinDiscount(urlMinDiscount);
  }, [
    urlSearch,
    urlSort,
    urlMinPrice,
    urlMaxPrice,
    urlMinRating,
    urlMinDiscount,
  ]);

  // ===================================================
  // URL UPDATE HELPER
  // ===================================================

  function updateParam(
    key,
    value
  ) {
    const newParams =
      new URLSearchParams(
        searchParams
      );

    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      newParams.delete(key);
    } else {
      newParams.set(
        key,
        value
      );
    }

    setSearchParams(newParams);
  }

  // ===================================================
  // UPDATE MULTIPLE PARAMS
  // ===================================================

  function updateParams(
    updates
  ) {
    const newParams =
      new URLSearchParams(
        searchParams
      );

    Object.entries(updates).forEach(
      ([key, value]) => {
        if (
          value === "" ||
          value === null ||
          value === undefined
        ) {
          newParams.delete(key);
        } else {
          newParams.set(
            key,
            value
          );
        }
      }
    );

    setSearchParams(newParams);
  }

  // ===================================================
  // SEARCH
  // ===================================================

  function updateSearch(value) {
    setSearch(value);

    const newParams =
      new URLSearchParams(
        searchParams
      );

    const cleanValue =
      value.trim();

    if (cleanValue) {
      newParams.set(
        "search",
        cleanValue
      );
    } else {
      newParams.delete("search");
    }

    setSearchParams(newParams);
  }

  // ===================================================
  // SAVE RECENT SEARCH
  // ===================================================

  function saveRecentSearch(
    value
  ) {
    const cleanValue =
      value.trim();

    if (!cleanValue) {
      return;
    }

    const updated = [
      cleanValue,
      ...recentSearches.filter(
        (item) =>
          item.toLowerCase() !==
          cleanValue.toLowerCase()
      ),
    ].slice(0, 5);

    setRecentSearches(updated);

    try {
      localStorage.setItem(
        "gymdrobe-recent-searches",
        JSON.stringify(updated)
      );
    } catch {
      // Ignore storage errors.
    }
  }

  // ===================================================
  // REMOVE RECENT SEARCH
  // ===================================================

  function removeRecentSearch(
    value
  ) {
    const updated =
      recentSearches.filter(
        (item) => item !== value
      );

    setRecentSearches(updated);

    try {
      localStorage.setItem(
        "gymdrobe-recent-searches",
        JSON.stringify(updated)
      );
    } catch {
      // Ignore storage errors.
    }
  }

  // ===================================================
  // CLEAR RECENT SEARCHES
  // ===================================================

  function clearRecentSearches() {
    setRecentSearches([]);

    try {
      localStorage.removeItem(
        "gymdrobe-recent-searches"
      );
    } catch {
      // Ignore storage errors.
    }
  }

  // ===================================================
  // SEARCH SUBMIT
  // ===================================================

  function handleSearchSubmit() {
    if (!search.trim()) {
      return;
    }

    saveRecentSearch(search);

    setIsFilterOpen(false);
  }

  // ===================================================
  // SEARCH SUGGESTIONS
  // ===================================================

  const searchSuggestions =
    useMemo(() => {
      const text =
        search.trim().toLowerCase();

      if (!text) {
        return [];
      }

      return products
        .filter((product) =>
          getSearchableText(
            product
          ).includes(text)
        )
        .slice(0, 6);
    }, [search]);

  // ===================================================
  // CATEGORY OPTIONS
  // ===================================================

  const categories =
    useMemo(() => {
      return [
        ...new Set(
          products
            .map(
              (product) =>
                product.category
            )
            .filter(Boolean)
        ),
      ].sort();
    }, []);

  // ===================================================
  // SUBCATEGORY OPTIONS
  // ===================================================

  const subcategories =
    useMemo(() => {
      const source =
        selectedCategory
          ? products.filter(
              (product) =>
                product.category ===
                selectedCategory
            )
          : products;

      return [
        ...new Set(
          source
            .map(
              (product) =>
                product.subcategory
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [selectedCategory]);

  // ===================================================
  // BRAND OPTIONS
  // ===================================================

  const brands =
    useMemo(() => {
      return [
        ...new Set(
          products
            .map(
              (product) =>
                product.brand
            )
            .filter(Boolean)
        ),
      ].sort();
    }, []);

  // ===================================================
  // SIZE OPTIONS
  // ===================================================

  const sizes =
    useMemo(() => {
      const sizeSet =
        new Set();

      products.forEach(
        (product) => {
          (
            product.sizes || []
          ).forEach((size) => {
            sizeSet.add(size);
          });
        }
      );

      return [...sizeSet].sort(
        (a, b) =>
          String(a).localeCompare(
            String(b),
            undefined,
            {
              numeric: true,
            }
          )
      );
    }, []);

  // ===================================================
  // COLOR OPTIONS
  // ===================================================

  const colors =
    useMemo(() => {
      const colorSet =
        new Set();

      products.forEach(
        (product) => {
          (
            product.colors || []
          ).forEach((color) => {
            colorSet.add(color);
          });
        }
      );

      return [...colorSet].sort();
    }, []);

  // ===================================================
  // TOGGLE ARRAY FILTER
  // ===================================================

  function toggleArrayFilter(
    key,
    currentValues,
    value
  ) {
    let updated;

    if (
      currentValues.includes(value)
    ) {
      updated =
        currentValues.filter(
          (item) =>
            item !== value
        );
    } else {
      updated = [
        ...currentValues,
        value,
      ];
    }

    updateParam(
      key,
      updated.join(",")
    );
  }

  // ===================================================
  // FILTER PRODUCTS
  // ===================================================

  const filteredProducts =
    useMemo(() => {
      let result = [...products];

      // CATEGORY
      if (selectedCategory) {
        result =
          result.filter(
            (product) =>
              product.category ===
              selectedCategory
          );
      }

      // SUBCATEGORY
      if (selectedSubcategory) {
        result =
          result.filter(
            (product) =>
              product.subcategory ===
              selectedSubcategory
          );
      }

      // SEARCH
      const searchText =
        search.trim().toLowerCase();

      if (searchText) {
        result =
          result.filter(
            (product) =>
              getSearchableText(
                product
              ).includes(searchText)
          );
      }

      // BRAND
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

      // SIZE
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

      // COLOR
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

      // AVAILABILITY
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

      // MIN PRICE
      if (minPrice !== "") {
        const minimum =
          Number(minPrice);

        if (
          Number.isFinite(
            minimum
          )
        ) {
          result =
            result.filter(
              (product) =>
                getDiscountedPrice(
                  product
                ) >= minimum
            );
        }
      }

      // MAX PRICE
      if (maxPrice !== "") {
        const maximum =
          Number(maxPrice);

        if (
          Number.isFinite(
            maximum
          )
        ) {
          result =
            result.filter(
              (product) =>
                getDiscountedPrice(
                  product
                ) <= maximum
            );
        }
      }

      // RATING
      if (minRating !== "") {
        const rating =
          Number(minRating);

        if (
          Number.isFinite(
            rating
          )
        ) {
          result =
            result.filter(
              (product) =>
                Number(
                  product.rating || 0
                ) >= rating
            );
        }
      }

      // DISCOUNT
      if (
        minDiscount !== ""
      ) {
        const discount =
          Number(minDiscount);

        if (
          Number.isFinite(
            discount
          )
        ) {
          result =
            result.filter(
              (product) =>
                Number(
                  product.discount || 0
                ) >= discount
            );
        }
      }

      // =================================================
      // SORT
      // =================================================

      if (
        sort === "price-low"
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
        sort === "price-high"
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
          (a, b) => {
            const dateA =
              new Date(
                a.createdAt ||
                  a.dateAdded ||
                  a.updatedAt ||
                  0
              ).getTime();

            const dateB =
              new Date(
                b.createdAt ||
                  b.dateAdded ||
                  b.updatedAt ||
                  0
              ).getTime();

            if (
              Number.isFinite(
                dateA
              ) &&
              Number.isFinite(
                dateB
              ) &&
              dateA !== dateB
            ) {
              return (
                dateB - dateA
              );
            }

            return (
              Number(
                b.id || 0
              ) -
              Number(
                a.id || 0
              )
            );
          }
        );
      }

      if (
        sort ===
        "best-selling"
      ) {
        result.sort(
          (a, b) =>
            getSalesValue(
              b
            ) -
            getSalesValue(
              a
            )
        );
      }

      // RECOMMENDED
      if (
        sort === "default"
      ) {
        result.sort(
          (a, b) => {
            const featuredA =
              a.isFeatured
                ? 1
                : 0;

            const featuredB =
              b.isFeatured
                ? 1
                : 0;

            if (
              featuredA !==
              featuredB
            ) {
              return (
                featuredB -
                featuredA
              );
            }

            const bestsellerA =
              a.isBestSeller
                ? 1
                : 0;

            const bestsellerB =
              b.isBestSeller
                ? 1
                : 0;

            if (
              bestsellerA !==
              bestsellerB
            ) {
              return (
                bestsellerB -
                bestsellerA
              );
            }

            const ratingDifference =
              Number(
                b.rating || 0
              ) -
              Number(
                a.rating || 0
              );

            if (
              ratingDifference !==
              0
            ) {
              return ratingDifference;
            }

            return (
              Number(
                b.reviewCount || 0
              ) -
              Number(
                a.reviewCount || 0
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
      selectedBrands.join(","),
      selectedSizes.join(","),
      selectedColors.join(","),
      availability,
      minPrice,
      maxPrice,
      minRating,
      minDiscount,
      sort,
    ]);

  // ===================================================
  // RESET PAGINATION
  // ===================================================

  useEffect(() => {
    setVisibleCount(12);
  }, [
    search,
    selectedCategory,
    selectedSubcategory,
    selectedBrands.join(","),
    selectedSizes.join(","),
    selectedColors.join(","),
    availability,
    minPrice,
    maxPrice,
    minRating,
    minDiscount,
    sort,
  ]);

  // ===================================================
  // VISIBLE PRODUCTS
  // ===================================================

  const visibleProducts =
    filteredProducts.slice(
      0,
      visibleCount
    );

  const hasMoreProducts =
    visibleCount <
    filteredProducts.length;

  // ===================================================
  // LOAD MORE
  // ===================================================

  function handleLoadMore() {
    setVisibleCount(
      (current) =>
        current + 12
    );
  }

  // ===================================================
  // CLEAR ALL
  // ===================================================

  function clearFilters() {
    setSearch("");
    setSort("default");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
    setMinDiscount("");

    setVisibleCount(12);
    setIsFilterOpen(false);

    const newParams =
      new URLSearchParams(
        searchParams
      );

    const filterKeys = [
      "search",
      "category",
      "subcategory",
      "brand",
      "size",
      "color",
      "availability",
      "sort",
      "minPrice",
      "maxPrice",
      "rating",
      "discount",
    ];

    filterKeys.forEach(
      (key) => {
        newParams.delete(key);
      }
    );

    setSearchParams(
      newParams
    );
  }

  // ===================================================
  // CATEGORY CHANGE
  // ===================================================

  function handleCategoryChange(
    value
  ) {
    updateParams({
      category: value,
      subcategory: "",
    });
  }

  // ===================================================
  // CLEAR CATEGORY
  // ===================================================

  function clearCategory() {
    updateParams({
      category: "",
      subcategory: "",
    });
  }

  // ===================================================
  // CLEAR SUBCATEGORY
  // ===================================================

  function clearSubcategory() {
    updateParam(
      "subcategory",
      ""
    );
  }

  // ===================================================
  // CLEAR SEARCH
  // ===================================================

  function clearSearch() {
    setSearch("");

    updateParam(
      "search",
      ""
    );
  }

  // ===================================================
  // CLEAR ARRAY FILTER
  // ===================================================

  function clearArrayFilter(
    key
  ) {
    updateParam(key, "");
  }

  // ===================================================
  // PRICE
  // ===================================================

  function handleMinPriceChange(
    value
  ) {
    if (value === "") {
      setMinPrice("");
      updateParam(
        "minPrice",
        ""
      );
      return;
    }

    const number =
      Number(value);

    if (
      Number.isFinite(
        number
      ) &&
      number >= 0
    ) {
      setMinPrice(value);
      updateParam(
        "minPrice",
        value
      );
    }
  }

  function handleMaxPriceChange(
    value
  ) {
    if (value === "") {
      setMaxPrice("");
      updateParam(
        "maxPrice",
        ""
      );
      return;
    }

    const number =
      Number(value);

    if (
      Number.isFinite(
        number
      ) &&
      number >= 0
    ) {
      setMaxPrice(value);
      updateParam(
        "maxPrice",
        value
      );
    }
  }

  // ===================================================
  // RATING
  // ===================================================

  function handleRatingChange(
    value
  ) {
    setMinRating(value);

    updateParam(
      "rating",
      value
    );
  }

  // ===================================================
  // DISCOUNT
  // ===================================================

  function handleDiscountChange(
    value
  ) {
    setMinDiscount(value);

    updateParam(
      "discount",
      value
    );
  }

  // ===================================================
  // SORT
  // ===================================================

  function handleSortChange(
    value
  ) {
    setSort(value);

    updateParam(
      "sort",
      value === "default"
        ? ""
        : value
    );
  }

  // ===================================================
  // SEARCH SUGGESTION
  // ===================================================

  function handleSearchSuggestion(
    product
  ) {
    updateSearch(
      product.name
    );

    saveRecentSearch(
      product.name
    );

    setIsFilterOpen(false);
  }

  // ===================================================
  // RECENT SEARCH
  // ===================================================

  function handleRecentSearch(
    value
  ) {
    updateSearch(value);

    saveRecentSearch(value);

    setIsFilterOpen(false);
  }

  // ===================================================
  // ACTIVE FILTERS
  // ===================================================

  const hasSearch =
    search.trim() !== "";

  const hasActiveFilters =
    hasSearch ||
    selectedCategory !== "" ||
    selectedSubcategory !== "" ||
    selectedBrands.length > 0 ||
    selectedSizes.length > 0 ||
    selectedColors.length > 0 ||
    availability !== "" ||
    sort !== "default" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    minRating !== "" ||
    minDiscount !== "";

  const activeFilterCount =
    (hasSearch ? 1 : 0) +
    (selectedCategory
      ? 1
      : 0) +
    (selectedSubcategory
      ? 1
      : 0) +
    (selectedBrands.length
      ? 1
      : 0) +
    (selectedSizes.length
      ? 1
      : 0) +
    (selectedColors.length
      ? 1
      : 0) +
    (availability
      ? 1
      : 0) +
    (sort !== "default"
      ? 1
      : 0) +
    (minPrice !== ""
      ? 1
      : 0) +
    (maxPrice !== ""
      ? 1
      : 0) +
    (minRating !== ""
      ? 1
      : 0) +
    (minDiscount !== ""
      ? 1
      : 0);

  // ===================================================
  // SORT LABEL
  // ===================================================

  function getSortLabel() {
    if (
      sort === "price-low"
    ) {
      return "Price: Low → High";
    }

    if (
      sort === "price-high"
    ) {
      return "Price: High → Low";
    }

    if (
      sort === "rating"
    ) {
      return "Highest Rated";
    }

    if (
      sort === "discount"
    ) {
      return "Biggest Discount";
    }

    if (
      sort === "newest"
    ) {
      return "Newest";
    }

    if (
      sort === "best-selling"
    ) {
      return "Best Selling";
    }

    return "";
  }

  // ===================================================
  // INVALID PRICE RANGE
  // ===================================================

  const invalidPriceRange =
    minPrice !== "" &&
    maxPrice !== "" &&
    Number(minPrice) >
      Number(maxPrice);

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <section
      id="products"
      className="
        shop-page
        w-full
        overflow-hidden
        bg-[#f5f5f6]
        px-3
        py-10
        sm:px-6
        sm:py-14
        md:py-20
      "
    >
      <div className="mx-auto w-full max-w-7xl">

        {/* HEADER */}

        <div className="mb-6 sm:mb-8">

          <p
            className="
              mb-2
              text-[11px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-orange-600
              sm:text-xs
            "
          >
            gGYM COLLECTION
          </p>

          <div
            className="
              flex
              flex-col
              gap-3
              sm:flex-row
              sm:items-end
              sm:justify-between
            "
          >
            <div className="min-w-0">

              <h2
                className="
                  text-2xl
                  font-bold
                  tracking-[-0.04em]
                  text-black
                  sm:text-3xl
                  md:text-[2.2rem]
                "
              >
                {selectedSubcategory ||
                  selectedCategory ||
                  "Featured Products"}
              </h2>

              <p
                className="
                  mt-2
                  max-w-xl
                  text-sm
                  leading-6
                  text-gray-500
                "
              >
                Discover performance
                essentials built for
                every workout.
              </p>

            </div>

            <p
              className="
                shrink-0
                text-sm
                text-gray-500
              "
            >
              {filteredProducts.length}{" "}
              product
              {filteredProducts.length !==
              1
                ? "s"
                : ""}
            </p>

          </div>
        </div>

        {/* SEARCH */}

        <div className="mb-4">

          <div
            className="
              relative
              flex
              w-full
              flex-col
              gap-2
              sm:flex-row
              sm:gap-3
            "
          >

            <div
              className="
                relative
                min-w-0
                flex-1
              "
            >

              <span
                className="
                  pointer-events-none
                  absolute
                  left-4
                  top-1/2
                  z-10
                  -translate-y-1/2
                  text-base
                  text-gray-400
                "
              >
                🔍
              </span>

              <input
                type="search"
                value={search}
                onChange={(e) =>
                  updateSearch(
                    e.target.value
                  )
                }
                onFocus={() =>
                  setIsFilterOpen(
                    false
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    handleSearchSubmit();
                  }
                }}
                placeholder="Search products, categories, brands..."
                aria-label="Search products"
                className="
                  w-full
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  py-3.5
                  pl-11
                  pr-10
                  text-sm
                  outline-none
                  transition
                  focus:border-gray-400
                  focus:ring-2
                  focus:ring-gray-100
                "
              />

              {hasSearch && (
                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  aria-label="Clear search"
                  className="
                    absolute
                    right-3
                    top-1/2
                    flex
                    h-7
                    w-7
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-full
                    bg-gray-100
                    text-xs
                    text-gray-500
                    hover:bg-gray-200
                  "
                >
                  ✕
                </button>
              )}

              {/* SEARCH SUGGESTIONS */}

              {search.trim() !== "" &&
                searchSuggestions.length >
                  0 && (
                  <div
                    className="
                      absolute
                      left-0
                      right-0
                      top-full
                      z-50
                      mt-2
                      overflow-hidden
                      rounded-2xl
                      border
                      border-gray-100
                      bg-white
                      shadow-2xl
                    "
                  >

                    <div className="p-3">

                      <p
                        className="
                          px-2
                          pb-2
                          text-xs
                          font-bold
                          uppercase
                          tracking-wider
                          text-gray-400
                        "
                      >
                        Products
                      </p>

                      <div className="space-y-1">

                        {searchSuggestions.map(
                          (product) => (
                            <button
                              key={
                                product.id
                              }
                              type="button"
                              onClick={() =>
                                handleSearchSuggestion(
                                  product
                                )
                              }
                              className="
                                flex
                                w-full
                                items-center
                                gap-3
                                rounded-xl
                                p-2
                                text-left
                                transition
                                hover:bg-gray-50
                              "
                            >

                              <img
                                src={
                                  product.image
                                }
                                alt=""
                                className="
                                  h-12
                                  w-12
                                  shrink-0
                                  rounded-lg
                                  object-cover
                                "
                              />

                              <div className="min-w-0">

                                <p
                                  className="
                                    truncate
                                    text-sm
                                    font-semibold
                                    text-gray-900
                                  "
                                >
                                  {
                                    product.name
                                  }
                                </p>

                                <p
                                  className="
                                    mt-0.5
                                    text-xs
                                    text-gray-500
                                  "
                                >
                                  {product.brand
                                    ? `${product.brand} • `
                                    : ""}
                                  {
                                    product.category
                                  }
                                </p>

                              </div>

                            </button>
                          )
                        )}

                      </div>
                    </div>
                  </div>
                )}

            </div>

            {/* MOBILE FILTER */}

            <button
              type="button"
              onClick={() =>
                setIsFilterOpen(
                  true
                )
              }
              className="
                flex
                w-full
                items-center
                justify-between
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3.5
                text-sm
                font-semibold
                sm:hidden
              "
            >

              <span className="flex items-center gap-2">
                ⚙️
                <span>Filters</span>
              </span>

              {activeFilterCount >
                0 && (
                <span
                  className="
                    flex
                    h-6
                    min-w-6
                    items-center
                    justify-center
                    rounded-full
                    bg-orange-600
                    px-1.5
                    text-xs
                    font-bold
                    text-white
                  "
                >
                  {
                    activeFilterCount
                  }
                </span>
              )}

            </button>

          </div>
        </div>

        {/* RECENT SEARCHES */}

        {search === "" &&
          recentSearches.length >
            0 && (
            <div
              className="
                mb-5
                flex
                items-center
                gap-2
                overflow-x-auto
                pb-1
              "
            >

              <span
                className="
                  shrink-0
                  text-xs
                  font-semibold
                  text-gray-500
                "
              >
                Recent:
              </span>

              {recentSearches.map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      handleRecentSearch(
                        item
                      )
                    }
                    className="
                      shrink-0
                      rounded-full
                      bg-white
                      px-3
                      py-1.5
                      text-xs
                      text-gray-600
                      shadow-sm
                      hover:bg-gray-100
                    "
                  >
                    🕘 {item}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={
                  clearRecentSearches
                }
                className="
                  shrink-0
                  text-xs
                  font-semibold
                  text-orange-600
                "
              >
                Clear
              </button>

            </div>
          )}

        {/* ACTIVE FILTER CHIPS */}

        {hasActiveFilters && (
          <div
            className="
              mb-5
              flex
              max-w-full
              items-center
              gap-2
              overflow-x-auto
              pb-1
            "
          >

            <span
              className="
                shrink-0
                text-xs
                font-semibold
                text-gray-500
              "
            >
              Active:
            </span>

            {selectedCategory && (
              <button
                type="button"
                onClick={
                  clearCategory
                }
                className="
                  shrink-0
                  rounded-full
                  bg-orange-50
                  px-3
                  py-1.5
                  text-xs
                  font-medium
                  text-orange-700
                "
              >
                {selectedCategory} ✕
              </button>
            )}

            {selectedSubcategory && (
              <button
                type="button"
                onClick={
                  clearSubcategory
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                {selectedSubcategory} ✕
              </button>
            )}

            {hasSearch && (
              <button
                type="button"
                onClick={
                  clearSearch
                }
                className="
                  max-w-[220px]
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                <span className="truncate">
                  Search: "{search}"
                </span>{" "}
                ✕
              </button>
            )}

            {selectedBrands.length >
              0 && (
              <button
                type="button"
                onClick={() =>
                  clearArrayFilter(
                    "brand"
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                Brand:{" "}
                {selectedBrands.length} ✕
              </button>
            )}

            {selectedSizes.length >
              0 && (
              <button
                type="button"
                onClick={() =>
                  clearArrayFilter(
                    "size"
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                Size:{" "}
                {selectedSizes.length} ✕
              </button>
            )}

            {selectedColors.length >
              0 && (
              <button
                type="button"
                onClick={() =>
                  clearArrayFilter(
                    "color"
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                Color:{" "}
                {selectedColors.length} ✕
              </button>
            )}

            {availability && (
              <button
                type="button"
                onClick={() =>
                  updateParam(
                    "availability",
                    ""
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                {availability ===
                "in-stock"
                  ? "In Stock"
                  : "Out of Stock"}{" "}
                ✕
              </button>
            )}

            {minPrice !== "" && (
              <button
                type="button"
                onClick={() =>
                  handleMinPriceChange(
                    ""
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                Min ₹{minPrice} ✕
              </button>
            )}

            {maxPrice !== "" && (
              <button
                type="button"
                onClick={() =>
                  handleMaxPriceChange(
                    ""
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                Max ₹{maxPrice} ✕
              </button>
            )}

            {minRating !== "" && (
              <button
                type="button"
                onClick={() =>
                  handleRatingChange(
                    ""
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                ⭐ {minRating}+ ✕
              </button>
            )}

            {minDiscount !== "" && (
              <button
                type="button"
                onClick={() =>
                  handleDiscountChange(
                    ""
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                {minDiscount}%+ off ✕
              </button>
            )}

            {sort !== "default" && (
              <button
                type="button"
                onClick={() =>
                  handleSortChange(
                    "default"
                  )
                }
                className="
                  shrink-0
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                {getSortLabel()} ✕
              </button>
            )}

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="
                shrink-0
                text-xs
                font-semibold
                text-orange-600
              "
            >
              Clear all
            </button>

          </div>
        )}

        {/* =================================================
            DESKTOP FILTER PANEL
        ================================================= */}

        <div
          className="
            mb-8
            hidden
            rounded-2xl
            border
            border-gray-200
            bg-white
            p-5
            shadow-sm
            sm:block
          "
        >

          {/* ROW 1 */}

          <div
            className="
              grid
              grid-cols-2
              gap-3
              lg:grid-cols-4
            "
          >

            {/* SORT */}

            <select
              value={sort}
              onChange={(e) =>
                handleSortChange(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-orange-500
              "
            >
              <option value="default">
                Recommended
              </option>

              <option value="newest">
                Newest
              </option>

              <option value="best-selling">
                Best Selling
              </option>

              <option value="price-low">
                Price: Low to High
              </option>

              <option value="price-high">
                Price: High to Low
              </option>

              <option value="rating">
                Highest Rated
              </option>

              <option value="discount">
                Biggest Discount
              </option>
            </select>

            {/* CATEGORY */}

            <select
              value={
                selectedCategory
              }
              onChange={(e) =>
                handleCategoryChange(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-orange-500
              "
            >
              <option value="">
                All Categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>

            {/* SUBCATEGORY */}

            <select
              value={
                selectedSubcategory
              }
              onChange={(e) =>
                updateParam(
                  "subcategory",
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-orange-500
              "
            >
              <option value="">
                All Subcategories
              </option>

              {subcategories.map(
                (subcategory) => (
                  <option
                    key={subcategory}
                    value={
                      subcategory
                    }
                  >
                    {subcategory}
                  </option>
                )
              )}
            </select>

            {/* BRAND */}

            <select
              value={
                selectedBrands[0] ||
                ""
              }
              onChange={(e) =>
                updateParam(
                  "brand",
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-orange-500
              "
            >
              <option value="">
                All Brands
              </option>

              {brands.map(
                (brand) => (
                  <option
                    key={brand}
                    value={brand}
                  >
                    {brand}
                  </option>
                )
              )}
            </select>

          </div>

          {/* ROW 2 */}

          <div
            className="
              mt-3
              grid
              grid-cols-2
              gap-3
              lg:grid-cols-4
            "
          >

            {/* MIN PRICE */}

            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) =>
                handleMinPriceChange(
                  e.target.value
                )
              }
              placeholder="Min price"
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                px-4
                py-3
                text-sm
                outline-none
                focus:border-orange-500
              "
            />

            {/* MAX PRICE */}

            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) =>
                handleMaxPriceChange(
                  e.target.value
                )
              }
              placeholder="Max price"
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                px-4
                py-3
                text-sm
                outline-none
                focus:border-orange-500
              "
            />

            {/* RATING */}

            <select
              value={minRating}
              onChange={(e) =>
                handleRatingChange(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
              "
            >
              <option value="">
                Minimum Rating
              </option>

              <option value="4">
                ⭐ 4+
              </option>

              <option value="4.5">
                ⭐ 4.5+
              </option>

              <option value="4.8">
                ⭐ 4.8+
              </option>
            </select>

            {/* DISCOUNT */}

            <select
              value={minDiscount}
              onChange={(e) =>
                handleDiscountChange(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
              "
            >
              <option value="">
                Minimum Discount
              </option>

              <option value="10">
                10%+ Off
              </option>

              <option value="20">
                20%+ Off
              </option>

              <option value="30">
                30%+ Off
              </option>

              <option value="50">
                50%+ Off
              </option>
            </select>

          </div>

          {/* ROW 3 */}

          <div
            className="
              mt-3
              flex
              flex-wrap
              items-center
              gap-3
            "
          >

            {/* AVAILABILITY */}

            <label
              className="
                flex
                cursor-pointer
                items-center
                gap-2
                rounded-xl
                border
                border-gray-200
                px-4
                py-3
                text-sm
              "
            >
              <input
                type="checkbox"
                checked={
                  availability ===
                  "in-stock"
                }
                onChange={(e) =>
                  updateParam(
                    "availability",
                    e.target.checked
                      ? "in-stock"
                      : ""
                  )
                }
                className="h-4 w-4 accent-orange-600"
              />

              <span>
                In Stock Only
              </span>
            </label>

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="
                rounded-xl
                border
                border-gray-200
                bg-white
                px-5
                py-3
                text-sm
                font-medium
                hover:border-orange-600
                hover:text-orange-600
              "
            >
              Clear Filters
            </button>

          </div>

          {invalidPriceRange && (
            <p
              className="
                mt-3
                text-xs
                font-medium
                text-red-500
              "
            >
              Minimum price cannot
              be greater than maximum
              price.
            </p>
          )}

        </div>

        {/* =================================================
            MOBILE FILTER DRAWER
        ================================================= */}

        {isFilterOpen && (
          <div
            className="
              fixed
              inset-0
              z-[100]
              sm:hidden
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
                h-full
                w-full
                bg-black/40
              "
            />

            {/* DRAWER */}

            <div
              className="
                absolute
                bottom-0
                left-0
                right-0
                max-h-[90vh]
                overflow-y-auto
                rounded-t-3xl
                bg-white
                p-5
                pb-7
                shadow-2xl
              "
            >

              <div
                className="
                  mb-6
                  flex
                  items-center
                  justify-between
                "
              >

                <div>
                  <p
                    className="
                      text-xs
                      font-bold
                      tracking-wider
                      text-orange-600
                    "
                  >
                    GYMDROBE
                  </p>

                  <h3
                    className="
                      mt-1
                      text-xl
                      font-bold
                    "
                  >
                    Filters & Sort
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsFilterOpen(
                      false
                    )
                  }
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-full
                    bg-gray-100
                  "
                >
                  ✕
                </button>

              </div>

              <div className="space-y-5">

                {/* SORT */}

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                    "
                  >
                    Sort by
                  </label>

                  <select
                    value={sort}
                    onChange={(e) =>
                      handleSortChange(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      px-4
                      py-3.5
                      text-sm
                    "
                  >
                    <option value="default">
                      Recommended
                    </option>

                    <option value="newest">
                      Newest
                    </option>

                    <option value="best-selling">
                      Best Selling
                    </option>

                    <option value="price-low">
                      Price: Low to High
                    </option>

                    <option value="price-high">
                      Price: High to Low
                    </option>

                    <option value="rating">
                      Highest Rated
                    </option>

                    <option value="discount">
                      Biggest Discount
                    </option>
                  </select>
                </div>

                {/* CATEGORY */}

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                    "
                  >
                    Category
                  </label>

                  <select
                    value={
                      selectedCategory
                    }
                    onChange={(e) =>
                      handleCategoryChange(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      px-4
                      py-3.5
                      text-sm
                    "
                  >
                    <option value="">
                      All Categories
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={category}
                          value={
                            category
                          }
                        >
                          {category}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* SUBCATEGORY */}

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                    "
                  >
                    Subcategory
                  </label>

                  <select
                    value={
                      selectedSubcategory
                    }
                    onChange={(e) =>
                      updateParam(
                        "subcategory",
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      px-4
                      py-3.5
                      text-sm
                    "
                  >
                    <option value="">
                      All Subcategories
                    </option>

                    {subcategories.map(
                      (subcategory) => (
                        <option
                          key={
                            subcategory
                          }
                          value={
                            subcategory
                          }
                        >
                          {
                            subcategory
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* BRAND */}

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                    "
                  >
                    Brand
                  </label>

                  <select
                    value={
                      selectedBrands[0] ||
                      ""
                    }
                    onChange={(e) =>
                      updateParam(
                        "brand",
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      px-4
                      py-3.5
                      text-sm
                    "
                  >
                    <option value="">
                      All Brands
                    </option>

                    {brands.map(
                      (brand) => (
                        <option
                          key={brand}
                          value={brand}
                        >
                          {brand}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* SIZE */}

                <div>
                  <p
                    className="
                      mb-2
                      text-sm
                      font-semibold
                    "
                  >
                    Size
                  </p>

                  <div className="flex flex-wrap gap-2">

                    {sizes.map(
                      (size) => {
                        const active =
                          selectedSizes.includes(
                            size
                          );

                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() =>
                              toggleArrayFilter(
                                "size",
                                selectedSizes,
                                size
                              )
                            }
                            className={`
                              rounded-lg
                              border
                              px-4
                              py-2
                              text-sm
                              ${
                                active
                                  ? "border-black bg-black text-white"
                                  : "border-gray-200 bg-white text-gray-700"
                              }
                            `}
                          >
                            {size}
                          </button>
                        );
                      }
                    )}

                  </div>
                </div>

                {/* COLOR */}

                <div>
                  <p
                    className="
                      mb-2
                      text-sm
                      font-semibold
                    "
                  >
                    Color
                  </p>

                  <div className="flex flex-wrap gap-2">

                    {colors.map(
                      (color) => {
                        const active =
                          selectedColors.includes(
                            color
                          );

                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() =>
                              toggleArrayFilter(
                                "color",
                                selectedColors,
                                color
                              )
                            }
                            className={`
                              rounded-lg
                              border
                              px-3
                              py-2
                              text-xs
                              ${
                                active
                                  ? "border-black bg-black text-white"
                                  : "border-gray-200 bg-white text-gray-700"
                              }
                            `}
                          >
                            {color}
                          </button>
                        );
                      }
                    )}

                  </div>
                </div>

                {/* PRICE */}

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                    "
                  >
                    Price Range
                  </label>

                  <div className="grid grid-cols-2 gap-3">

                    <input
                      type="number"
                      min="0"
                      value={minPrice}
                      onChange={(e) =>
                        handleMinPriceChange(
                          e.target.value
                        )
                      }
                      placeholder="Min ₹"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-gray-200
                        px-4
                        py-3.5
                        text-sm
                      "
                    />

                    <input
                      type="number"
                      min="0"
                      value={maxPrice}
                      onChange={(e) =>
                        handleMaxPriceChange(
                          e.target.value
                        )
                      }
                      placeholder="Max ₹"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-gray-200
                        px-4
                        py-3.5
                        text-sm
                      "
                    />

                  </div>

                  {invalidPriceRange && (
                    <p className="mt-2 text-xs font-medium text-red-500">
                      Minimum price cannot
                      be greater than maximum
                      price.
                    </p>
                  )}

                </div>

                {/* RATING */}

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                    "
                  >
                    Minimum Rating
                  </label>

                  <select
                    value={minRating}
                    onChange={(e) =>
                      handleRatingChange(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      px-4
                      py-3.5
                      text-sm
                    "
                  >
                    <option value="">
                      Any Rating
                    </option>

                    <option value="4">
                      ⭐ 4+
                    </option>

                    <option value="4.5">
                      ⭐ 4.5+
                    </option>

                    <option value="4.8">
                      ⭐ 4.8+
                    </option>
                  </select>
                </div>

                {/* DISCOUNT */}

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                    "
                  >
                    Minimum Discount
                  </label>

                  <select
                    value={minDiscount}
                    onChange={(e) =>
                      handleDiscountChange(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      px-4
                      py-3.5
                      text-sm
                    "
                  >
                    <option value="">
                      Any Discount
                    </option>

                    <option value="10">
                      10%+ Off
                    </option>

                    <option value="20">
                      20%+ Off
                    </option>

                    <option value="30">
                      30%+ Off
                    </option>

                    <option value="50">
                      50%+ Off
                    </option>
                  </select>
                </div>

                {/* AVAILABILITY */}

                <label
                  className="
                    flex
                    cursor-pointer
                    items-center
                    gap-3
                    rounded-xl
                    border
                    border-gray-200
                    p-4
                  "
                >
                  <input
                    type="checkbox"
                    checked={
                      availability ===
                      "in-stock"
                    }
                    onChange={(e) =>
                      updateParam(
                        "availability",
                        e.target.checked
                          ? "in-stock"
                          : ""
                      )
                    }
                    className="h-5 w-5 accent-orange-600"
                  />

                  <span className="text-sm font-semibold">
                    Show In-Stock Products Only
                  </span>
                </label>

              </div>

              {/* BUTTONS */}

              <div
                className="
                  mt-7
                  grid
                  grid-cols-2
                  gap-3
                "
              >

                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="
                    rounded-xl
                    border
                    border-gray-200
                    py-3.5
                    text-sm
                    font-semibold
                  "
                >
                  Reset
                </button>

                <button
                  type="button"
                  disabled={
                    invalidPriceRange
                  }
                  onClick={() =>
                    setIsFilterOpen(
                      false
                    )
                  }
                  className="
                    rounded-xl
                    bg-orange-600
                    py-3.5
                    text-sm
                    font-semibold
                    text-white
                    hover:bg-orange-700
                    disabled:cursor-not-allowed
                    disabled:bg-gray-300
                  "
                >
                  Show{" "}
                  {
                    filteredProducts.length
                  }{" "}
                  Products
                </button>

              </div>

            </div>
          </div>
        )}

        {/* =================================================
            PRODUCTS
        ================================================= */}

        {visibleProducts.length >
        0 ? (
          <>

            <div
              className="
                grid
                grid-cols-1
                gap-3
                min-[380px]:grid-cols-2
                sm:grid-cols-2
                sm:gap-5
                lg:grid-cols-3
                lg:gap-6
                xl:grid-cols-4
              "
            >

              {visibleProducts.map(
                (product) => {
                  const isWishlisted =
                    wishlist.some(
                      (item) =>
                        item.id ===
                        product.id
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
                      price={
                        product.price
                      }
                      rating={
                        product.rating
                      }
                      discount={
                        product.discount
                      }
                      image={
                        product.image
                      }
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
                  mt-10
                  flex
                  flex-col
                  items-center
                "
              >

                <p
                  className="
                    mb-3
                    text-xs
                    text-gray-500
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
                  onClick={
                    handleLoadMore
                  }
                  className="
                    rounded-xl
                    border
                    border-gray-900
                    bg-black
                    px-7
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    hover:bg-gray-800
                  "
                >
                  Load More
                </button>

              </div>
            )}

            {!hasMoreProducts &&
              filteredProducts.length >
                12 && (
                <p
                  className="
                    mt-10
                    text-center
                    text-xs
                    text-gray-400
                  "
                >
                  You've reached the
                  end of the collection.
                </p>
              )}

          </>
        ) : (

          /* NO PRODUCTS */

          <div
            className="
              rounded-2xl
              border
              border-dashed
              border-gray-200
              bg-white
              px-4
              py-14
              text-center
              sm:py-16
            "
          >

            <div className="mb-4 text-4xl">
              🔍
            </div>

            <h3
              className="
                mb-2
                text-lg
                font-bold
                sm:text-xl
              "
            >
              No products found
            </h3>

            <p
              className="
                mx-auto
                mb-5
                max-w-md
                text-sm
                leading-6
                text-gray-500
              "
            >
              We couldn't find products
              matching your current search
              or filters.
            </p>

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="
                rounded-xl
                bg-orange-600
                px-5
                py-3
                text-sm
                font-semibold
                text-white
                hover:bg-orange-700
              "
            >
              Reset Filters
            </button>

          </div>
        )}

      </div>
    </section>
  );
}

export default ProductSection;
  