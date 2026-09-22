import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import logoImage from "../assets/logo.png";
import products from "../data/products";
import { useAuth } from "../context/AuthContext";

const RECENT_SEARCH_KEY = "gymdrobe-recent-searches";
const MAX_RECENT_SEARCHES = 6;

function normalizeText(value = "") {
  return String(value).toLowerCase().trim();
}

function getSearchableText(product) {
  const values = [
    product.name,
    product.category,
    product.subcategory,
    product.brand,
    product.description,
    product.material,
    product.gender,
    product.badge,
    product.tags,
    product.colors,
    product.sizes,
  ];

  return normalizeText(
    values
      .flat(Infinity)
      .filter(Boolean)
      .join(" ")
  );
}

function getRecentSearches() {
  try {
    if (typeof window === "undefined") {
      return [];
    }

    const stored = localStorage.getItem(
      RECENT_SEARCH_KEY
    );

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed.slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(value) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return getRecentSearches();
  }

  try {
    const existing = getRecentSearches();

    const updated = [
      cleanValue,
      ...existing.filter(
        (item) =>
          normalizeText(item) !==
          normalizeText(cleanValue)
      ),
    ].slice(0, MAX_RECENT_SEARCHES);

    localStorage.setItem(
      RECENT_SEARCH_KEY,
      JSON.stringify(updated)
    );

    return updated;
  } catch {
    return [cleanValue];
  }
}

function removeRecentSearch(value) {
  try {
    const updated = getRecentSearches().filter(
      (item) =>
        normalizeText(item) !==
        normalizeText(value)
    );

    localStorage.setItem(
      RECENT_SEARCH_KEY,
      JSON.stringify(updated)
    );

    return updated;
  } catch {
    return getRecentSearches();
  }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(
      RECENT_SEARCH_KEY
    );
  } catch {
    // Ignore localStorage errors.
  }

  return [];
}

function Navbar({
  cartCount = 0,
  wishlistCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [isSearchFocused, setIsSearchFocused] =
    useState(false);

  const [isCategoryOpen, setIsCategoryOpen] =
    useState(false);

  const [search, setSearch] = useState(
    () => searchParams.get("search") || ""
  );

  const [recentSearches, setRecentSearches] =
    useState(getRecentSearches);

  /*
   * ======================================================
   * AUTHENTICATION
   * ======================================================
   */

  const {
    user,
    logout,
    isAuthenticated,
  } = useAuth();

  /*
   * ======================================================
   * DYNAMIC CATEGORY DATA
   * ======================================================
   */

  const categories = useMemo(() => {
    const categoryMap = new Map();

    products.forEach((product) => {
      if (!product.category) {
        return;
      }

      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, {
          name: product.category,
          subcategories: new Set(),
          productCount: 0,
        });
      }

      const category =
        categoryMap.get(product.category);

      category.productCount += 1;

      if (product.subcategory) {
        category.subcategories.add(
          product.subcategory
        );
      }
    });

    return Array.from(
      categoryMap.values()
    ).map((category) => ({
      ...category,
      subcategories: Array.from(
        category.subcategories
      ),
    }));
  }, []);

  /*
   * ======================================================
   * URL → SEARCH STATE
   * ======================================================
   */

  useEffect(() => {
    setSearch(
      searchParams.get("search") || ""
    );
  }, [searchParams]);

  /*
   * ======================================================
   * CLOSE SEARCH DROPDOWN
   * ======================================================
   */

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(
          event.target
        )
      ) {
        setIsSearchFocused(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /*
   * ======================================================
   * CLOSE MENU
   * ======================================================
   */

  function closeMenu() {
    setIsMenuOpen(false);
    setIsCategoryOpen(false);
  }

  /*
   * ======================================================
   * LOGOUT
   * ======================================================
   */

  function handleLogout() {
    logout();
    closeMenu();
    navigate("/");
  }

  /*
   * ======================================================
   * SEARCH
   * ======================================================
   */

  function handleSearchChange(value) {
    setSearch(value);
  }

  function performSearch(value = search) {
    const cleanValue = value.trim();

    if (!cleanValue) {
      navigate("/shop");
      setIsSearchFocused(false);
      closeMenu();
      return;
    }

    const updatedRecent =
      saveRecentSearch(cleanValue);

    setRecentSearches(updatedRecent);

    navigate(
      `/shop?search=${encodeURIComponent(
        cleanValue
      )}`
    );

    setIsSearchFocused(false);
    closeMenu();
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      performSearch();
    }

    if (event.key === "Escape") {
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    }
  }

  function clearSearch() {
    setSearch("");
    navigate("/shop");
    setIsSearchFocused(false);
  }

  /*
   * ======================================================
   * RECENT SEARCHES
   * ======================================================
   */

  function handleRecentSearchClick(value) {
    setSearch(value);
    performSearch(value);
  }

  function handleRemoveRecentSearch(
    event,
    value
  ) {
    event.stopPropagation();

    const updated =
      removeRecentSearch(value);

    setRecentSearches(updated);
  }

  function handleClearRecentSearches() {
    setRecentSearches(
      clearRecentSearches()
    );
  }

  /*
   * ======================================================
   * SEARCH SUGGESTIONS
   * ======================================================
   */

  const searchSuggestions =
    search.trim().length > 0
      ? products
          .filter((product) =>
            getSearchableText(product).includes(
              normalizeText(search)
            )
          )
          .slice(0, 6)
      : [];

  const categorySuggestions =
    search.trim().length > 0
      ? categories
          .filter((category) =>
            normalizeText(
              category.name
            ).includes(
              normalizeText(search)
            )
          )
          .slice(0, 4)
      : [];

  const brandSuggestions =
    search.trim().length > 0
      ? [
          ...new Set(
            products
              .map(
                (product) => product.brand
              )
              .filter(Boolean)
          ),
        ]
          .filter((brand) =>
            normalizeText(brand).includes(
              normalizeText(search)
            )
          )
          .slice(0, 4)
      : [];

  /*
   * ======================================================
   * CATEGORY NAVIGATION
   * ======================================================
   */

  function openCategory(category) {
    navigate(
      `/shop?category=${encodeURIComponent(
        category
      )}`
    );

    closeMenu();
    setIsSearchFocused(false);
  }

  function openSubcategory(
    category,
    subcategory
  ) {
    navigate(
      `/shop?category=${encodeURIComponent(
        category
      )}&subcategory=${encodeURIComponent(
        subcategory
      )}`
    );

    closeMenu();
    setIsSearchFocused(false);
  }

  function openBrand(brand) {
    navigate(
      `/shop?brand=${encodeURIComponent(
        brand
      )}`
    );

    closeMenu();
    setIsSearchFocused(false);
  }

  /*
   * ======================================================
   * ACTIVE NAVIGATION
   * ======================================================
   */

  const activeCategory =
    searchParams.get("category");

  const isHomeActive =
    location.pathname === "/";

  const isShopActive =
    location.pathname === "/shop";

  const isWishlistActive =
    location.pathname === "/wishlist";

  const isCartActive =
    location.pathname === "/cart";

  const isAccountActive =
    location.pathname === "/account";

  /*
   * ======================================================
   * RENDER
   * ======================================================
   */

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 text-gray-900 shadow-sm backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 md:px-6">

        {/* ==================================================
            MAIN NAVBAR
        ================================================== */}

        <div className="flex min-w-0 items-center justify-between gap-2 py-3 md:py-4">

          {/* LOGO */}

          <Link
            to="/"
            onClick={closeMenu}
            className="shrink-0"
          >
            <img
              src={logoImage}
              alt="Gymdrobe"
              className="h-10 w-20 object-contain object-left invert sm:h-12 sm:w-24"
            />
          </Link>

          {/* ==================================================
              DESKTOP NAVIGATION
          ================================================== */}

          <div className="hidden items-center gap-1 lg:flex">

            <Link
              to="/"
              className={`
                rounded-full
                px-4 py-2
                text-sm font-semibold
                uppercase tracking-[0.12em]
                transition
                ${
                  isHomeActive
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-800 hover:bg-orange-50 hover:text-orange-600"
                }
              `}
            >
              Home
            </Link>

            <Link
              to="/shop"
              className={`
                rounded-full
                px-4 py-2
                text-sm font-semibold
                uppercase tracking-[0.12em]
                transition
                ${
                  isShopActive
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-800 hover:bg-orange-50 hover:text-orange-600"
                }
              `}
            >
              Shop
            </Link>

            {/* ==================================================
                CATEGORY DROPDOWN
            ================================================== */}

            <div
              className="relative"
              onMouseEnter={() =>
                setIsCategoryOpen(true)
              }
              onMouseLeave={() =>
                setIsCategoryOpen(false)
              }
            >
              <button
                type="button"
                onClick={() =>
                  setIsCategoryOpen(
                    (current) => !current
                  )
                }
                className={`
                  flex
                  items-center
                  gap-1
                  rounded-full
                  px-4 py-2
                  text-sm font-semibold
                  uppercase tracking-[0.12em]
                  transition
                  ${
                    activeCategory
                      ? "bg-orange-50 text-orange-600"
                      : "text-gray-800 hover:bg-orange-50 hover:text-orange-600"
                  }
                `}
              >
                Categories

                <span
                  className={`text-xs transition ${
                    isCategoryOpen
                      ? "rotate-180"
                      : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {isCategoryOpen && (
                <div
                  className="
                    absolute
                    left-1/2
                    top-full
                    z-50
                    mt-2
                    w-[620px]
                    -translate-x-1/2
                    rounded-2xl
                    border
                    border-gray-100
                    bg-white
                    p-5
                    shadow-2xl
                  "
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
                        Shop by category
                      </p>

                      <h3 className="mt-1 text-lg font-bold text-gray-900">
                        Find your workout essentials
                      </h3>
                    </div>

                    <Link
                      to="/shop"
                      onClick={closeMenu}
                      className="
                        rounded-lg
                        bg-slate-900
                        px-3 py-2
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-white
                        transition
                        hover:bg-orange-600
                      "
                    >
                      View All
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {categories.map(
                      (category) => (
                        <div
                          key={category.name}
                          className="
                            rounded-xl
                            border
                            border-gray-100
                            p-3
                            transition
                            hover:border-orange-200
                            hover:bg-orange-50/50
                          "
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openCategory(
                                category.name
                              )
                            }
                            className="
                              mb-2
                              flex
                              w-full
                              items-center
                              justify-between
                              text-left
                            "
                          >
                            <span
                              className={`
                                text-sm
                                font-bold
                                ${
                                  activeCategory ===
                                  category.name
                                    ? "text-orange-600"
                                    : "text-gray-900"
                                }
                              `}
                            >
                              {category.name}
                            </span>

                            <span className="text-xs text-gray-400">
                              {category.productCount}
                            </span>
                          </button>

                          <div className="space-y-1">
                            {category.subcategories.map(
                              (
                                subcategory
                              ) => (
                                <button
                                  key={
                                    subcategory
                                  }
                                  type="button"
                                  onClick={() =>
                                    openSubcategory(
                                      category.name,
                                      subcategory
                                    )
                                  }
                                  className="
                                    block
                                    w-full
                                    rounded-md
                                    px-2
                                    py-1.5
                                    text-left
                                    text-xs
                                    text-gray-500
                                    transition
                                    hover:bg-white
                                    hover:text-orange-600
                                  "
                                >
                                  {
                                    subcategory
                                  }
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* OFFERS */}

            <Link
              to="/shop?discount=10"
              className="
                rounded-full
                px-4 py-2
                text-sm font-semibold
                uppercase tracking-[0.12em]
                text-gray-800
                transition
                hover:bg-orange-50
                hover:text-orange-600
              "
            >
              Offers
            </Link>

            {/* ==================================================
                AUTHENTICATION
            ================================================== */}

            {isAuthenticated ? (
              <Link
                to="/account"
                className={`
                  rounded-full
                  px-4 py-2
                  text-sm font-semibold
                  uppercase tracking-[0.12em]
                  transition
                  ${
                    isAccountActive
                      ? "bg-orange-50 text-orange-600"
                      : "text-gray-800 hover:bg-orange-50 hover:text-orange-600"
                  }
                `}
              >
                Hi,{" "}
                {user?.name?.split(" ")[0] ||
                  "Account"}
              </Link>
            ) : (
              <Link
                to="/login"
                className="
                  rounded-full
                  px-4 py-2
                  text-sm font-semibold
                  uppercase tracking-[0.12em]
                  text-gray-800
                  transition
                  hover:bg-orange-50
                  hover:text-orange-600
                "
              >
                Login
              </Link>
            )}
          </div>

          {/* ==================================================
              DESKTOP SEARCH
          ================================================== */}

          <div
            ref={searchContainerRef}
            className="
              relative
              hidden
              min-w-0
              flex-1
              md:flex
              md:max-w-md
              lg:max-w-lg
              xl:max-w-xl
            "
          >
            <div
              className={`
                flex
                h-11
                w-full
                items-center
                rounded-xl
                border
                bg-gray-50
                transition
                ${
                  isSearchFocused
                    ? "border-orange-400 bg-white shadow-md ring-2 ring-orange-100"
                    : "border-gray-200"
                }
              `}
            >
              <button
                type="button"
                onClick={() =>
                  performSearch()
                }
                aria-label="Search"
                className="
                  flex
                  h-full
                  w-11
                  items-center
                  justify-center
                  text-gray-500
                  hover:text-orange-600
                "
              >
                🔎
              </button>

              <input
                ref={searchInputRef}
                type="search"
                value={search}
                placeholder="Search products, brands & categories"
                onChange={(event) =>
                  handleSearchChange(
                    event.target.value
                  )
                }
                onFocus={() =>
                  setIsSearchFocused(true)
                }
                onKeyDown={
                  handleSearchKeyDown
                }
                className="
                  min-w-0
                  flex-1
                  bg-transparent
                  px-1
                  text-sm
                  text-gray-900
                  outline-none
                  placeholder:text-gray-400
                "
              />

              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="
                    mr-2
                    flex
                    h-7
                    w-7
                    items-center
                    justify-center
                    rounded-full
                    text-gray-400
                    hover:bg-gray-200
                  "
                >
                  ×
                </button>
              )}
            </div>

            {/* SEARCH DROPDOWN */}

            {isSearchFocused && (
              <div
                className="
                  absolute
                  left-0
                  right-0
                  top-[calc(100%+10px)]
                  overflow-hidden
                  rounded-2xl
                  border
                  border-gray-100
                  bg-white
                  shadow-2xl
                "
              >
                {/* RECENT SEARCHES */}

                {!search.trim() &&
                  recentSearches.length >
                    0 && (
                    <div className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Recent Searches
                        </p>

                        <button
                          type="button"
                          onClick={
                            handleClearRecentSearches
                          }
                          className="text-xs font-semibold text-orange-600"
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="space-y-1">
                        {recentSearches.map(
                          (item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() =>
                                handleRecentSearchClick(
                                  item
                                )
                              }
                              className="
                                group
                                flex
                                w-full
                                items-center
                                justify-between
                                rounded-xl
                                px-3 py-2.5
                                text-left
                                text-sm
                                hover:bg-orange-50
                              "
                            >
                              <span>
                                ↻ {item}
                              </span>

                              <span
                                onClick={(
                                  event
                                ) =>
                                  handleRemoveRecentSearch(
                                    event,
                                    item
                                  )
                                }
                                className="
                                  hidden
                                  px-2
                                  text-gray-400
                                  group-hover:block
                                "
                              >
                                ×
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* SEARCH RESULTS */}

                {search.trim() && (
                  <>
                    {searchSuggestions.length >
                      0 && (
                      <div className="p-3">
                        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Products
                        </p>

                        <div className="space-y-1">
                          {searchSuggestions.map(
                            (product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() =>
                                  performSearch(
                                    product.name
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
                                  hover:bg-orange-50
                                "
                              >
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                  <img
                                    src={
                                      product.image ||
                                      product
                                        .images?.[0]
                                    }
                                    alt={
                                      product.name
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-gray-800">
                                    {product.name}
                                  </p>

                                  <p className="truncate text-xs text-gray-500">
                                    {
                                      product.category
                                    }

                                    {product.brand &&
                                      ` • ${product.brand}`}
                                  </p>
                                </div>

                                <span className="text-gray-400">
                                  →
                                </span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* CATEGORY SUGGESTIONS */}

                    {categorySuggestions.length >
                      0 && (
                      <div className="border-t border-gray-100 p-3">
                        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Categories
                        </p>

                        <div className="flex flex-wrap gap-2 px-2">
                          {categorySuggestions.map(
                            (category) => (
                              <button
                                key={
                                  category.name
                                }
                                type="button"
                                onClick={() =>
                                  openCategory(
                                    category.name
                                  )
                                }
                                className="
                                  rounded-full
                                  border
                                  border-gray-200
                                  bg-gray-50
                                  px-3 py-1.5
                                  text-xs
                                  font-medium
                                  hover:border-orange-300
                                  hover:bg-orange-50
                                  hover:text-orange-600
                                "
                              >
                                {
                                  category.name
                                }
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* BRAND SUGGESTIONS */}

                    {brandSuggestions.length >
                      0 && (
                      <div className="border-t border-gray-100 p-3">
                        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Brands
                        </p>

                        <div className="flex flex-wrap gap-2 px-2">
                          {brandSuggestions.map(
                            (brand) => (
                              <button
                                key={brand}
                                type="button"
                                onClick={() =>
                                  openBrand(
                                    brand
                                  )
                                }
                                className="
                                  rounded-full
                                  border
                                  border-gray-200
                                  bg-gray-50
                                  px-3 py-1.5
                                  text-xs
                                  font-medium
                                  hover:border-orange-300
                                  hover:bg-orange-50
                                  hover:text-orange-600
                                "
                              >
                                {brand}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* VIEW ALL */}

                    <div className="border-t border-gray-100 p-3">
                      <button
                        type="button"
                        onClick={() =>
                          performSearch()
                        }
                        className="
                          flex
                          w-full
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          bg-slate-900
                          px-4 py-3
                          text-xs
                          font-bold
                          uppercase
                          tracking-wider
                          text-white
                          hover:bg-orange-600
                        "
                      >
                        View all results
                        <span>→</span>
                      </button>
                    </div>
                  </>
                )}

                {/* POPULAR SEARCHES */}

                {!search.trim() &&
                  recentSearches.length ===
                    0 && (
                    <div className="p-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                        Popular Searches
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {[
                          "Gym Shoes",
                          "Workout Clothes",
                          "Shaker Bottle",
                          "Gym Towel",
                        ].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() =>
                              handleRecentSearchClick(
                                item
                              )
                            }
                            className="
                              rounded-full
                              border
                              border-gray-200
                              bg-gray-50
                              px-3 py-2
                              text-xs
                              hover:border-orange-300
                              hover:bg-orange-50
                            "
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* NO RESULT */}

                {search.trim() &&
                  searchSuggestions.length ===
                    0 &&
                  categorySuggestions.length ===
                    0 &&
                  brandSuggestions.length ===
                    0 && (
                    <div className="p-6 text-center">
                      <p className="text-sm font-semibold text-gray-800">
                        No results found
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Try another product,
                        brand or category.
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* ==================================================
              RIGHT SIDE
          ================================================== */}

          <div className="flex shrink-0 items-center gap-2 md:gap-3">

            {/* WISHLIST */}

            <Link
              to="/wishlist"
              aria-label={`${wishlistCount} items in wishlist`}
              className={`
                relative
                flex h-9 w-9
                items-center justify-center
                rounded-full
                border
                bg-slate-900
                text-white
                transition
                ${
                  isWishlistActive
                    ? "border-orange-400 text-orange-300"
                    : "border-slate-700 hover:border-orange-400 hover:text-orange-300"
                }
              `}
            >
              <span
                aria-hidden="true"
                className="text-lg"
              >
                ♡
              </span>

              {wishlistCount > 0 && (
                <span
                  className="
                    absolute
                    -right-1.5
                    -top-1.5
                    flex
                    h-[18px]
                    min-w-[18px]
                    items-center
                    justify-center
                    rounded-full
                    bg-orange-500
                    px-1
                    text-[9px]
                    font-bold
                    text-slate-950
                  "
                >
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* CART */}

            <Link
              to="/cart"
              aria-label={`${cartCount} items in cart`}
              className={`
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                bg-slate-900
                px-3 py-2
                text-sm
                font-semibold
                uppercase
                tracking-wider
                text-white
                transition
                ${
                  isCartActive
                    ? "border-orange-400 text-orange-300"
                    : "border-slate-700 hover:border-orange-400 hover:text-orange-300"
                }
                md:px-4
              `}
            >
              <span>👜</span>

              <span className="hidden sm:inline">
                Bag
              </span>

              {cartCount > 0 && (
                <span
                  className="
                    flex
                    h-[18px]
                    min-w-[18px]
                    items-center
                    justify-center
                    rounded-full
                    bg-orange-500
                    px-1
                    text-[9px]
                    font-bold
                    text-slate-950
                  "
                >
                  {cartCount}
                </span>
              )}
            </Link>

            {/* MOBILE MENU */}

            <button
              type="button"
              onClick={() =>
                setIsMenuOpen(
                  (current) => !current
                )
              }
              aria-label={
                isMenuOpen
                  ? "Close menu"
                  : "Open menu"
              }
              aria-expanded={isMenuOpen}
              className="
                flex
                h-10 w-10
                items-center
                justify-center
                rounded-lg
                text-2xl
                hover:bg-gray-100
                md:hidden
              "
            >
              {isMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* ==================================================
            MOBILE SEARCH
        ================================================== */}

        <div className="relative pb-3 md:hidden">
          <div
            className="
              flex
              h-11
              w-full
              items-center
              rounded-xl
              border
              border-gray-200
              bg-gray-50
            "
          >
            <button
              type="button"
              onClick={() =>
                performSearch()
              }
              className="flex h-full w-11 items-center justify-center text-gray-500"
            >
              🔎
            </button>

            <input
              type="search"
              value={search}
              placeholder="Search GymDrobe..."
              onChange={(event) =>
                handleSearchChange(
                  event.target.value
                )
              }
              onFocus={() =>
                setIsSearchFocused(true)
              }
              onKeyDown={handleSearchKeyDown}
              className="
                min-w-0
                flex-1
                bg-transparent
                text-sm
                outline-none
                placeholder:text-gray-400
              "
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="mr-2 text-xl text-gray-400"
              >
                ×
              </button>
            )}
          </div>

          {isSearchFocused && (
            <div
              className="
                absolute
                left-0
                right-0
                top-[calc(100%-2px)]
                z-50
                overflow-hidden
                rounded-2xl
                border
                border-gray-100
                bg-white
                shadow-2xl
              "
            >
              {search.trim() &&
                searchSuggestions.length >
                  0 && (
                  <div className="max-h-80 overflow-y-auto p-3">
                    {searchSuggestions.map(
                      (product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() =>
                            performSearch(
                              product.name
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
                            hover:bg-orange-50
                          "
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                            <img
                              src={
                                product.image ||
                                product
                                  .images?.[0]
                              }
                              alt={
                                product.name
                              }
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {product.name}
                            </p>

                            <p className="truncate text-xs text-gray-500">
                              {
                                product.category
                              }
                            </p>
                          </div>

                          <span>
                            →
                          </span>
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        performSearch()
                      }
                      className="
                        mt-2
                        w-full
                        rounded-xl
                        bg-slate-900
                        px-4 py-3
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-white
                      "
                    >
                      View all results
                    </button>
                  </div>
                )}

              {!search.trim() &&
                recentSearches.length > 0 && (
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Recent Searches
                      </p>

                      <button
                        type="button"
                        onClick={
                          handleClearRecentSearches
                        }
                        className="text-xs font-semibold text-orange-600"
                      >
                        Clear
                      </button>
                    </div>

                    {recentSearches.map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            handleRecentSearchClick(
                              item
                            )
                          }
                          className="
                            flex
                            w-full
                            items-center
                            rounded-lg
                            px-3 py-2.5
                            text-left
                            text-sm
                            hover:bg-orange-50
                          "
                        >
                          ↻ {item}
                        </button>
                      )
                    )}
                  </div>
                )}

              {!search.trim() &&
                recentSearches.length ===
                  0 && (
                  <div className="p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                      Popular Searches
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {[
                        "Gym Shoes",
                        "Workout Clothes",
                        "Shaker Bottle",
                        "Gym Towel",
                      ].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            handleRecentSearchClick(
                              item
                            )
                          }
                          className="
                            rounded-full
                            border
                            border-gray-200
                            bg-gray-50
                            px-3 py-2
                            text-xs
                            hover:border-orange-300
                            hover:bg-orange-50
                          "
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {search.trim() &&
                searchSuggestions.length ===
                  0 && (
                  <div className="p-5 text-center">
                    <p className="text-sm font-semibold">
                      No products found
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        performSearch()
                      }
                      className="
                        mt-3
                        rounded-lg
                        bg-slate-900
                        px-4 py-2
                        text-xs
                        font-semibold
                        text-white
                      "
                    >
                      Search
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* ==================================================
            MOBILE MENU
        ================================================== */}

        {isMenuOpen && (
          <div className="border-t border-gray-100 pb-4 pt-4 md:hidden">

            <div className="flex flex-col gap-1">

              {/* HOME */}

              <Link
                to="/"
                onClick={closeMenu}
                className={`
                  rounded-xl
                  px-4 py-3
                  font-semibold
                  uppercase
                  tracking-wider
                  ${
                    isHomeActive
                      ? "bg-orange-50 text-orange-600"
                      : "hover:bg-orange-50 hover:text-orange-600"
                  }
                `}
              >
                Home
              </Link>

              {/* SHOP */}

              <Link
                to="/shop"
                onClick={closeMenu}
                className={`
                  rounded-xl
                  px-4 py-3
                  font-semibold
                  uppercase
                  tracking-wider
                  ${
                    isShopActive
                      ? "bg-orange-50 text-orange-600"
                      : "hover:bg-orange-50 hover:text-orange-600"
                  }
                `}
              >
                Shop
              </Link>

              {/* MOBILE CATEGORIES */}

              <div>
                <button
                  type="button"
                  onClick={() =>
                    setIsCategoryOpen(
                      (current) => !current
                    )
                  }
                  className="
                    flex
                    w-full
                    items-center
                    justify-between
                    rounded-xl
                    px-4 py-3
                    font-semibold
                    uppercase
                    tracking-wider
                    hover:bg-orange-50
                    hover:text-orange-600
                  "
                >
                  <span>
                    Categories
                  </span>

                  <span
                    className={`transition ${
                      isCategoryOpen
                        ? "rotate-180"
                        : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {isCategoryOpen && (
                  <div className="ml-3 mt-1 rounded-xl bg-gray-50 p-2">

                    {categories.map(
                      (category) => (
                        <div
                          key={
                            category.name
                          }
                          className="mb-2 last:mb-0"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openCategory(
                                category.name
                              )
                            }
                            className="
                              flex
                              w-full
                              items-center
                              justify-between
                              rounded-lg
                              px-3 py-2
                              text-left
                              text-sm
                              font-semibold
                              hover:bg-white
                              hover:text-orange-600
                            "
                          >
                            <span>
                              {
                                category.name
                              }
                            </span>

                            <span className="text-xs text-gray-400">
                              {
                                category.productCount
                              }
                            </span>
                          </button>

                          {category.subcategories.map(
                            (
                              subcategory
                            ) => (
                              <button
                                key={
                                  subcategory
                                }
                                type="button"
                                onClick={() =>
                                  openSubcategory(
                                    category.name,
                                    subcategory
                                  )
                                }
                                className="
                                  block
                                  w-full
                                  rounded-lg
                                  px-6 py-2
                                  text-left
                                  text-xs
                                  text-gray-500
                                  hover:bg-white
                                  hover:text-orange-600
                                "
                              >
                                {
                                  subcategory
                                }
                              </button>
                            )
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* OFFERS */}

              <Link
                to="/shop?discount=10"
                onClick={closeMenu}
                className="
                  rounded-xl
                  px-4 py-3
                  font-semibold
                  uppercase
                  tracking-wider
                  hover:bg-orange-50
                  hover:text-orange-600
                "
              >
                Offers
              </Link>

              <div className="my-2 border-t border-gray-100" />

              {/* WISHLIST */}

              <Link
                to="/wishlist"
                onClick={closeMenu}
                className="
                  flex
                  items-center
                  justify-between
                  rounded-xl
                  border
                  border-slate-700
                  bg-slate-900
                  px-4 py-3
                  font-semibold
                  text-white
                "
              >
                <span>Wishlist</span>

                {wishlistCount > 0 && (
                  <span className="rounded-full bg-orange-500 px-2 py-1 text-xs font-bold text-slate-950">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* CART */}

              <Link
                to="/cart"
                onClick={closeMenu}
                className="
                  flex
                  items-center
                  justify-between
                  rounded-xl
                  px-4 py-3
                  font-semibold
                  hover:bg-orange-50
                  hover:text-orange-600
                "
              >
                <span>Cart</span>

                {cartCount > 0 && (
                  <span className="rounded-full bg-orange-600 px-2 py-1 text-xs font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* ==================================================
                  MOBILE AUTHENTICATION
              ================================================== */}

              {isAuthenticated ? (
                <>
                  <Link
                    to="/account"
                    onClick={closeMenu}
                    className={`
                      rounded-xl
                      px-4 py-3
                      font-semibold
                      ${
                        isAccountActive
                          ? "bg-orange-50 text-orange-600"
                          : "hover:bg-orange-50 hover:text-orange-600"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        My Account
                      </span>

                      <span className="text-xs font-normal text-gray-400">
                        {user?.name}
                      </span>
                    </div>
                  </Link>

                  <Link
                    to="/orders"
                    onClick={closeMenu}
                    className="
                      rounded-xl
                      px-4 py-3
                      font-semibold
                      hover:bg-orange-50
                      hover:text-orange-600
                    "
                  >
                    My Orders
                  </Link>

                  <Link
                    to="/addresses"
                    onClick={closeMenu}
                    className="
                      rounded-xl
                      px-4 py-3
                      font-semibold
                      hover:bg-orange-50
                      hover:text-orange-600
                    "
                  >
                    My Addresses
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="
                      rounded-xl
                      px-4 py-3
                      text-left
                      font-semibold
                      text-red-600
                      hover:bg-red-50
                    "
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={closeMenu}
                    className="
                      rounded-xl
                      px-4 py-3
                      font-semibold
                      hover:bg-orange-50
                      hover:text-orange-600
                    "
                  >
                    Login
                  </Link>

                  <Link
                    to="/signup"
                    onClick={closeMenu}
                    className="
                      rounded-xl
                      bg-slate-900
                      px-4 py-3
                      font-semibold
                      text-white
                      transition
                      hover:bg-orange-600
                    "
                  >
                    Create Account
                  </Link>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;

