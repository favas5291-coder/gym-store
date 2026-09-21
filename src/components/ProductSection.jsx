import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import ProductCard from "./ProductCard";
import products from "../data/products";

function ProductSection({
  wishlist = [],
  toggleWishlist,
}) {
  const [searchParams, setSearchParams] =
    useSearchParams();

  // ==============================
  // STATE
  // ==============================

  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] =
    useState(false);

  const [sort, setSort] =
    useState("default");

  const [minPrice, setMinPrice] =
    useState("");

  const [maxPrice, setMaxPrice] =
    useState("");

  const [minRating, setMinRating] =
    useState("");

  const [minDiscount, setMinDiscount] =
    useState("");

  const [isFilterOpen, setIsFilterOpen] =
    useState(false);

  // ==============================
  // CATEGORY FROM URL
  // ==============================

  const selectedCategory =
    searchParams.get("category") || "";

  // ==============================
  // SEARCH SUGGESTIONS
  // ==============================

  const searchSuggestions = useMemo(() => {
    const searchText =
      search.trim().toLowerCase();

    if (!searchText) {
      return [];
    }

    return products
      .filter((product) => {
        const searchableText = [
          product.name,
          product.category,
          product.brand,
          product.description,
          ...(product.colors || []),
          ...(product.sizes || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          searchText
        );
      })
      .slice(0, 5);
  }, [search]);

  // ==============================
  // FILTER + SORT PRODUCTS
  // ==============================

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // ------------------------------
    // CATEGORY
    // ------------------------------

    if (selectedCategory) {
      result = result.filter(
        (product) =>
          product.category ===
          selectedCategory
      );
    }

    // ------------------------------
    // SEARCH
    // ------------------------------

    const searchText =
      search.trim().toLowerCase();

    if (searchText) {
      result = result.filter((product) => {
        const searchableText = [
          product.name,
          product.category,
          product.brand,
          product.description,
          ...(product.colors || []),
          ...(product.sizes || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          searchText
        );
      });
    }

    // ------------------------------
    // MINIMUM PRICE
    // ------------------------------

    if (minPrice !== "") {
      const minimum = Number(minPrice);

      if (!Number.isNaN(minimum)) {
        result = result.filter(
          (product) =>
            product.price >= minimum
        );
      }
    }

    // ------------------------------
    // MAXIMUM PRICE
    // ------------------------------

    if (maxPrice !== "") {
      const maximum = Number(maxPrice);

      if (!Number.isNaN(maximum)) {
        result = result.filter(
          (product) =>
            product.price <= maximum
        );
      }
    }

    // ------------------------------
    // MINIMUM RATING
    // ------------------------------

    if (minRating !== "") {
      const rating = Number(minRating);

      if (!Number.isNaN(rating)) {
        result = result.filter(
          (product) =>
            product.rating >= rating
        );
      }
    }

    // ------------------------------
    // MINIMUM DISCOUNT
    // ------------------------------

    if (minDiscount !== "") {
      const discount =
        Number(minDiscount);

      if (!Number.isNaN(discount)) {
        result = result.filter(
          (product) =>
            product.discount >= discount
        );
      }
    }

    // ------------------------------
    // SORTING
    // ------------------------------

    if (sort === "price-low") {
      result.sort(
        (a, b) => a.price - b.price
      );
    }

    if (sort === "price-high") {
      result.sort(
        (a, b) => b.price - a.price
      );
    }

    if (sort === "rating") {
      result.sort(
        (a, b) => b.rating - a.rating
      );
    }

    if (sort === "discount") {
      result.sort(
        (a, b) =>
          b.discount - a.discount
      );
    }

    return result;
  }, [
    search,
    sort,
    minPrice,
    maxPrice,
    minRating,
    minDiscount,
    selectedCategory,
  ]);

  // ==============================
  // CLEAR ALL FILTERS
  // ==============================

  function clearFilters() {
    setSearch("");
    setSort("default");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
    setMinDiscount("");

    const newParams =
      new URLSearchParams(
        searchParams
      );

    newParams.delete("category");

    setSearchParams(newParams);

    setIsFilterOpen(false);
  }

  // ==============================
  // CLEAR CATEGORY
  // ==============================

  function clearCategory() {
    const newParams =
      new URLSearchParams(
        searchParams
      );

    newParams.delete("category");

    setSearchParams(newParams);
  }

  // ==============================
  // ACTIVE FILTERS
  // ==============================

  const hasSearch =
    search.trim() !== "";

  const hasActiveFilters =
    hasSearch ||
    sort !== "default" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    minRating !== "" ||
    minDiscount !== "" ||
    selectedCategory !== "";

  const activeFilterCount =
    (hasSearch ? 1 : 0) +
    (minPrice !== "" ? 1 : 0) +
    (maxPrice !== "" ? 1 : 0) +
    (minRating !== "" ? 1 : 0) +
    (minDiscount !== "" ? 1 : 0) +
    (sort !== "default" ? 1 : 0) +
    (selectedCategory ? 1 : 0);

  // ==============================
  // SORT LABEL
  // ==============================

  function getSortLabel() {
    if (sort === "price-low") {
      return "Price: Low → High";
    }

    if (sort === "price-high") {
      return "Price: High → Low";
    }

    if (sort === "rating") {
      return "Highest Rated";
    }

    if (sort === "discount") {
      return "Biggest Discount";
    }

    return "";
  }

  // ==============================
  // PRICE VALIDATION
  // ==============================

  function handleMinPriceChange(value) {
    if (value === "") {
      setMinPrice("");
      return;
    }

    const number = Number(value);

    if (number >= 0) {
      setMinPrice(value);
    }
  }

  function handleMaxPriceChange(value) {
    if (value === "") {
      setMaxPrice("");
      return;
    }

    const number = Number(value);

    if (number >= 0) {
      setMaxPrice(value);
    }
  }

  const invalidPriceRange =
    minPrice !== "" &&
    maxPrice !== "" &&
    Number(minPrice) >
      Number(maxPrice);

  // ==============================
  // SELECT SEARCH SUGGESTION
  // ==============================

  function handleSearchSuggestion(
    product
  ) {
    setSearch(product.name);
    setIsSearchFocused(false);
  }

  // ==============================
  // RENDER
  // ==============================

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

        {/* =================================
            HEADING
        ================================= */}

        <div className="mb-6 sm:mb-8">

          <p
            className="
              mb-2
              text-[11px]
              font-bold
              tracking-[0.18em]
              text-orange-600
              uppercase
              sm:text-xs
            "
          >
            GYMDROBE COLLECTION
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
                {selectedCategory
                  ? selectedCategory
                  : "Featured Products"}
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
                Discover performance essentials built for every workout.
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

        {/* =================================
            SEARCH
        ================================= */}

        <div className="mb-4">

          <div
            className="
              flex
              w-full
              flex-col
              gap-2
              sm:flex-row
              sm:gap-3
            "
          >

            {/* SEARCH CONTAINER */}

            <div
              className="
                relative
                min-w-0
                flex-1
              "
            >

              {/* Search Icon */}

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

              {/* Search Input */}

              <input
                type="search"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                onFocus={() =>
                  setIsSearchFocused(true)
                }
                onBlur={() =>
                  setTimeout(() => {
                    setIsSearchFocused(
                      false
                    );
                  }, 150)
                }
                placeholder="Search products, categories..."
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

              {/* Clear Search */}

              {hasSearch && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
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
                    transition
                    hover:bg-gray-200
                  "
                >
                  ✕
                </button>
              )}

              {/* =================================
                  SEARCH SUGGESTIONS
              ================================= */}

              {isSearchFocused &&
                search.trim() !== "" &&
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
                      shadow-xl
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
                              key={product.id}
                              type="button"
                              onMouseDown={() =>
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

            {/* =================================
                MOBILE FILTER BUTTON
            ================================= */}

            <button
              type="button"
              onClick={() =>
                setIsFilterOpen(true)
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
                transition
                active:scale-[0.98]
                sm:hidden
              "
              aria-label="Open filters"
            >

              <span
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                ⚙️
                <span>Filters</span>
              </span>

              {activeFilterCount > 0 && (
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
                  {activeFilterCount}
                </span>
              )}

            </button>

          </div>
        </div>

        {/* =================================
            ACTIVE FILTER CHIPS
        ================================= */}

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

            {/* CATEGORY */}

            {selectedCategory && (
              <button
                type="button"
                onClick={clearCategory}
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  border-orange-100
                  bg-orange-50
                  px-3
                  py-1.5
                  text-xs
                  font-medium
                  text-orange-700
                  transition
                  hover:bg-orange-100
                "
              >
                {selectedCategory}
                <span>✕</span>
              </button>
            )}

            {/* SEARCH */}

            {hasSearch && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="
                  flex
                  max-w-[220px]
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                  transition
                  hover:bg-gray-200
                "
              >
                <span className="truncate">
                  Search: "{search}"
                </span>

                <span className="shrink-0">
                  ✕
                </span>
              </button>
            )}

            {/* MIN PRICE */}

            {minPrice !== "" && (
              <button
                type="button"
                onClick={() =>
                  setMinPrice("")
                }
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                Min ₹{minPrice}
                <span>✕</span>
              </button>
            )}

            {/* MAX PRICE */}

            {maxPrice !== "" && (
              <button
                type="button"
                onClick={() =>
                  setMaxPrice("")
                }
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                Max ₹{maxPrice}
                <span>✕</span>
              </button>
            )}

            {/* RATING */}

            {minRating !== "" && (
              <button
                type="button"
                onClick={() =>
                  setMinRating("")
                }
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                ⭐ {minRating}+
                <span>✕</span>
              </button>
            )}

            {/* DISCOUNT */}

            {minDiscount !== "" && (
              <button
                type="button"
                onClick={() =>
                  setMinDiscount("")
                }
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                {minDiscount}%+ off
                <span>✕</span>
              </button>
            )}

            {/* SORT */}

            {sort !== "default" && (
              <button
                type="button"
                onClick={() =>
                  setSort("default")
                }
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                "
              >
                {getSortLabel()}
                <span>✕</span>
              </button>
            )}

            {/* CLEAR ALL */}

            <button
              type="button"
              onClick={clearFilters}
              className="
                shrink-0
                text-xs
                font-semibold
                text-orange-600
                hover:text-orange-700
              "
            >
              Clear all
            </button>

          </div>
        )}

        {/* =================================
            DESKTOP FILTERS
        ================================= */}

        <div
          className="
            mb-8
            hidden
            rounded-2xl
            border
            border-gray-200
            bg-white
            p-4
            shadow-sm
            sm:block
            sm:p-5
          "
        >

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
                setSort(e.target.value)
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
                transition
                focus:border-orange-500
                focus:ring-2
                focus:ring-orange-100
              "
            >
              <option value="default">
                Sort Products
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
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:border-orange-500
                focus:ring-2
                focus:ring-orange-100
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
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:border-orange-500
                focus:ring-2
                focus:ring-orange-100
              "
            />

            {/* RATING */}

            <select
              value={minRating}
              onChange={(e) =>
                setMinRating(e.target.value)
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
                transition
                focus:border-orange-500
                focus:ring-2
                focus:ring-orange-100
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

          </div>

          <div
            className="
              mt-3
              flex
              flex-col
              gap-3
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            {/* DISCOUNT */}

            <select
              value={minDiscount}
              onChange={(e) =>
                setMinDiscount(
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
                transition
                focus:border-orange-500
                focus:ring-2
                focus:ring-orange-100
                lg:w-auto
                lg:min-w-[220px]
              "
            >
              <option value="">
                Minimum Discount
              </option>

              <option value="10">
                10%+
              </option>

              <option value="15">
                15%+
              </option>

              <option value="20">
                20%+
              </option>
            </select>

            {/* CLEAR */}

            <button
              type="button"
              onClick={clearFilters}
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-5
                py-3
                text-sm
                font-medium
                transition
                hover:border-orange-600
                hover:text-orange-600
                lg:w-auto
              "
            >
              Clear Filters
            </button>

          </div>

        </div>

        {/* =================================
            MOBILE FILTER DRAWER
        ================================= */}

        {isFilterOpen && (
          <div
            className="
              fixed
              inset-0
              z-[100]
              sm:hidden
            "
            role="dialog"
            aria-modal="true"
            aria-label="Product filters"
          >

            {/* OVERLAY */}

            <button
              type="button"
              aria-label="Close filter drawer"
              onClick={() =>
                setIsFilterOpen(false)
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
                max-h-[88vh]
                overflow-y-auto
                rounded-t-3xl
                bg-white
                p-5
                pb-7
                shadow-2xl
              "
            >

              {/* HEADER */}

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
                    setIsFilterOpen(false)
                  }
                  aria-label="Close filters"
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-full
                    bg-gray-100
                    text-lg
                  "
                >
                  ✕
                </button>

              </div>

              <div className="space-y-5">

                {/* SORT */}

                <div>

                  <label
                    htmlFor="mobile-sort"
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
                    id="mobile-sort"
                    value={sort}
                    onChange={(e) =>
                      setSort(e.target.value)
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      bg-white
                      px-4
                      py-3.5
                      text-sm
                      outline-none
                      focus:border-orange-500
                    "
                  >
                    <option value="default">
                      Recommended
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

                  <div
                    className="
                      grid
                      grid-cols-2
                      gap-3
                    "
                  >

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
                        min-w-0
                        rounded-xl
                        border
                        border-gray-200
                        px-4
                        py-3.5
                        text-sm
                        outline-none
                        focus:border-orange-500
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
                        min-w-0
                        rounded-xl
                        border
                        border-gray-200
                        px-4
                        py-3.5
                        text-sm
                        outline-none
                        focus:border-orange-500
                      "
                    />

                  </div>

                  {invalidPriceRange && (
                    <p
                      className="
                        mt-2
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

                {/* RATING */}

                <div>

                  <label
                    htmlFor="mobile-rating"
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
                    id="mobile-rating"
                    value={minRating}
                    onChange={(e) =>
                      setMinRating(
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
                      py-3.5
                      text-sm
                      outline-none
                      focus:border-orange-500
                    "
                  >
                    <option value="">
                      Any rating
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
                    htmlFor="mobile-discount"
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
                    id="mobile-discount"
                    value={minDiscount}
                    onChange={(e) =>
                      setMinDiscount(
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
                      py-3.5
                      text-sm
                      outline-none
                      focus:border-orange-500
                    "
                  >
                    <option value="">
                      Any discount
                    </option>

                    <option value="10">
                      10%+
                    </option>

                    <option value="15">
                      15%+
                    </option>

                    <option value="20">
                      20%+
                    </option>
                  </select>

                </div>

              </div>

              {/* DRAWER BUTTONS */}

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
                  onClick={clearFilters}
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
                  onClick={() =>
                    setIsFilterOpen(false)
                  }
                  disabled={invalidPriceRange}
                  className="
                    rounded-xl
                    bg-orange-600
                    py-3.5
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-orange-700
                    disabled:cursor-not-allowed
                    disabled:bg-gray-300
                  "
                >
                  Show{" "}
                  {filteredProducts.length}{" "}
                  Products
                </button>

              </div>

            </div>
          </div>
        )}

        {/* =================================
            PRODUCTS
        ================================= */}

        {filteredProducts.length > 0 ? (

          <div
            className="
              grid
              grid-cols-2
              gap-3
              sm:grid-cols-2
              sm:gap-5
              lg:grid-cols-3
              lg:gap-6
              xl:grid-cols-4
            "
          >

            {filteredProducts.map(
              (product) => {
                const isWishlisted =
                  wishlist.some(
                    (item) =>
                      item.id ===
                      product.id
                  );

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    category={
                      product.category
                    }
                    price={product.price}
                    rating={product.rating}
                    discount={
                      product.discount
                    }
                    image={product.image}
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

        ) : (

          /* =================================
              NO PRODUCTS
          ================================= */

          <div
            className="
              rounded-2xl
              border
              border-dashed
              border-gray-200
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
              onClick={clearFilters}
              className="
                rounded-xl
                bg-orange-600
                px-5
                py-3
                text-sm
                font-semibold
                text-white
                transition
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