import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import logoImage from "../assets/logo.png";
import products from "../data/products";
import categoriesData from "../data/categories";
import { useAuth } from "../context/AuthContext";

const RECENT_SEARCH_KEY =
  "gymdrobe-recent-searches";

const MAX_RECENT_SEARCHES = 6;

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .trim();
}

function getSearchableText(product) {
  return normalizeText(
    [
      product.name,
      product.category,
      product.subcategory,
      product.brand,
      product.description,
      product.material,
      product.gender,
      product.badge,
      ...(product.tags || []),
      ...(product.colors || []),
      ...(product.sizes || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getRecentSearches() {
  try {
    const stored =
      localStorage.getItem(
        RECENT_SEARCH_KEY
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed.slice(
          0,
          MAX_RECENT_SEARCHES
        )
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(value) {
  const cleanValue =
    value.trim();

  if (!cleanValue) {
    return getRecentSearches();
  }

  const existing =
    getRecentSearches();

  const updated = [
    cleanValue,

    ...existing.filter(
      (item) =>
        normalizeText(item) !==
        normalizeText(cleanValue)
    ),
  ].slice(
    0,
    MAX_RECENT_SEARCHES
  );

  try {
    localStorage.setItem(
      RECENT_SEARCH_KEY,
      JSON.stringify(updated)
    );
  } catch {
    // Ignore localStorage errors.
  }

  return updated;
}

/* =========================================================
   ICONS
========================================================= */

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />

      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M6 8h12l1 13H5L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
      />

      <path d="M4 21c.8-4.2 3.4-6 8-6s7.2 1.8 8 6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

/* =========================================================
   NAVBAR
========================================================= */

function Navbar({
  cartCount = 0,
  wishlistCount = 0,
}) {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [searchParams] =
    useSearchParams();

  const searchRef =
    useRef(null);

  const {
    user,
    logout,
    isAuthenticated,
  } = useAuth();

  const [search, setSearch] =
    useState(
      () =>
        searchParams.get(
          "search"
        ) || ""
    );

  const [
    isSearchFocused,
    setIsSearchFocused,
  ] = useState(false);

  const [
    isMenuOpen,
    setIsMenuOpen,
  ] = useState(false);

  const [
    isCategoryMenuOpen,
    setIsCategoryMenuOpen,
  ] = useState(false);

  const [
    recentSearches,
    setRecentSearches,
  ] = useState(
    getRecentSearches
  );

  /* =======================================================
     CATEGORY DATA
  ======================================================= */

  const categoryDetails =
    useMemo(() => {
      return categoriesData.map(
        (category) => {
          const categoryProducts =
            products.filter(
              (product) =>
                product.category ===
                category.name
            );

          const subcategories = [
            ...new Set(
              categoryProducts
                .map(
                  (product) =>
                    product.subcategory
                )
                .filter(Boolean)
            ),
          ];

          return {
            ...category,
            count:
              categoryProducts.length,
            subcategories,
          };
        }
      );
    }, []);

  /* =======================================================
     SEARCH SYNC
  ======================================================= */

  useEffect(() => {
    setSearch(
      searchParams.get(
        "search"
      ) || ""
    );
  }, [searchParams]);

  /* =======================================================
     OUTSIDE CLICK
  ======================================================= */

  useEffect(() => {
    function handleClickOutside(
      event
    ) {
      if (
        searchRef.current &&
        !searchRef.current.contains(
          event.target
        )
      ) {
        setIsSearchFocused(
          false
        );
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* =======================================================
     CLOSE MENUS ON ROUTE CHANGE
  ======================================================= */

  useEffect(() => {
    setIsMenuOpen(false);
    setIsCategoryMenuOpen(
      false
    );
    setIsSearchFocused(
      false
    );
  }, [location.pathname]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const searchSuggestions =
    useMemo(() => {
      const value =
        normalizeText(search);

      if (!value) {
        return [];
      }

      return products
        .filter((product) =>
          getSearchableText(
            product
          ).includes(value)
        )
        .slice(0, 6);
    }, [search]);

  function performSearch(
    value = search
  ) {
    const cleanValue =
      value.trim();

    if (!cleanValue) {
      navigate("/shop");

      setIsSearchFocused(
        false
      );

      return;
    }

    const updated =
      saveRecentSearch(
        cleanValue
      );

    setRecentSearches(
      updated
    );

    navigate(
      `/shop?search=${encodeURIComponent(
        cleanValue
      )}`
    );

    setIsSearchFocused(
      false
    );
  }

  function handleSearchKeyDown(
    event
  ) {
    if (
      event.key === "Enter"
    ) {
      event.preventDefault();

      performSearch();
    }

    if (
      event.key === "Escape"
    ) {
      setIsSearchFocused(
        false
      );
    }
  }

  function clearSearch() {
    setSearch("");

    if (
      location.pathname ===
      "/shop"
    ) {
      navigate("/shop");
    }
  }

  function openCategory(
    category
  ) {
    navigate(
      `/shop?category=${encodeURIComponent(
        category
      )}`
    );
  }

  function handleLogout() {
    logout();

    setIsMenuOpen(false);

    navigate("/");
  }

  /* =======================================================
     ACTIVE ROUTES
  ======================================================= */

  const isHome =
    location.pathname === "/";

  const isShop =
    location.pathname ===
    "/shop";

  const isWishlist =
    location.pathname ===
    "/wishlist";

  const isCart =
    location.pathname ===
    "/cart";

  /* =======================================================
     SEARCH BOX
  ======================================================= */

  function SearchBox({
    mobile = false,
  }) {
    return (
      <div
        ref={
          mobile
            ? undefined
            : searchRef
        }
        className="relative w-full"
      >
        <div
          className={`
            flex
            w-full
            items-center
            border
            bg-[#f5f5f6]
            transition
            ${
              mobile
                ? "h-11 rounded-lg"
                : "h-11 rounded-md"
            }
            ${
              isSearchFocused
                ? "border-gray-400 bg-white"
                : "border-transparent"
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
              shrink-0
              items-center
              justify-center
              text-gray-500
            "
          >
            <SearchIcon />
          </button>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            onFocus={() =>
              setIsSearchFocused(
                true
              )
            }
            onKeyDown={
              handleSearchKeyDown
            }
            placeholder="Search for products, brands and more"
            className="
              min-w-0
              flex-1
              bg-transparent
              pr-3
              text-sm
              text-gray-800
              outline-none
              placeholder:text-gray-500
            "
          />

          {search && (
            <button
              type="button"
              onClick={
                clearSearch
              }
              aria-label="Clear search"
              className="
                mr-2
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                text-lg
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
              top-[calc(100%+6px)]
              z-[100]
              max-h-[420px]
              overflow-y-auto
              border
              border-gray-100
              bg-white
              shadow-xl
            "
          >
            {!search.trim() &&
              recentSearches.length >
                0 && (
                <div className="p-4">
                  <div
                    className="
                      mb-3
                      flex
                      items-center
                      justify-between
                    "
                  >
                    <p
                      className="
                        text-xs
                        font-bold
                        uppercase
                        tracking-wide
                        text-gray-500
                      "
                    >
                      Recent Searches
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem(
                          RECENT_SEARCH_KEY
                        );

                        setRecentSearches(
                          []
                        );
                      }}
                      className="
                        text-xs
                        font-semibold
                        text-orange-600
                      "
                    >
                      Clear
                    </button>
                  </div>

                  {recentSearches.map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setSearch(
                            item
                          );

                          performSearch(
                            item
                          );
                        }}
                        className="
                          flex
                          w-full
                          items-center
                          gap-3
                          px-2
                          py-2.5
                          text-left
                          text-sm
                          hover:bg-gray-50
                        "
                      >
                        <span>
                          ↻
                        </span>

                        <span>
                          {item}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}

            {search.trim() && (
              <>
                {searchSuggestions.length >
                0 ? (
                  <div className="p-2">
                    <p
                      className="
                        px-2
                        pb-2
                        pt-1
                        text-[10px]
                        font-bold
                        uppercase
                        tracking-wider
                        text-gray-400
                      "
                    >
                      Products
                    </p>

                    {searchSuggestions.map(
                      (product) => (
                        <button
                          key={
                            product.id
                          }
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
                            p-2
                            text-left
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
                              w-10
                              shrink-0
                              object-cover
                            "
                          />

                          <div className="min-w-0">
                            <p
                              className="
                                truncate
                                text-sm
                                font-semibold
                              "
                            >
                              {
                                product.name
                              }
                            </p>

                            <p
                              className="
                                truncate
                                text-xs
                                text-gray-500
                              "
                            >
                              {
                                product.category
                              }

                              {product.brand
                                ? ` • ${product.brand}`
                                : ""}
                            </p>
                          </div>
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
                        border-t
                        border-gray-100
                        px-3
                        py-3
                        text-left
                        text-sm
                        font-bold
                        text-orange-600
                      "
                    >
                      View all results
                      for "{search}" →
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm font-semibold">
                      No products found
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Try another
                      product or
                      category.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <header
        className="
          sticky
          top-0
          z-50
          w-full
          bg-white
          text-gray-900
          shadow-[0_1px_8px_rgba(0,0,0,0.08)]
        "
      >
        {/* =================================================
            DESKTOP NAVBAR
        ================================================= */}

        <div
          className="
            hidden
            h-[72px]
            items-center
            lg:flex
          "
        >
          <div
            className="
              mx-auto
              flex
              w-full
              max-w-[1440px]
              items-center
              gap-7
              px-8
            "
          >
            {/* LOGO */}

            <Link
              to="/"
              className="
                flex
                shrink-0
                items-center
              "
            >
              <img
                src={logoImage}
                alt="GymDrobe"
                className="
                  h-12
                  w-24
                  object-contain
                  object-left
                  invert
                "
              />
            </Link>

            {/* DESKTOP LINKS */}

            <nav
              className="
                flex
                shrink-0
                items-center
                gap-1
              "
            >
              <Link
                to="/"
                className={`
                  border-b-4
                  px-3
                  py-6
                  text-xs
                  font-bold
                  uppercase
                  tracking-wide
                  transition
                  ${
                    isHome
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent hover:border-orange-500"
                  }
                `}
              >
                Home
              </Link>

              <Link
                to="/shop"
                className={`
                  border-b-4
                  px-3
                  py-6
                  text-xs
                  font-bold
                  uppercase
                  tracking-wide
                  transition
                  ${
                    isShop
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent hover:border-orange-500"
                  }
                `}
              >
                Shop
              </Link>

              {/* CATEGORY MENU */}

              <div
                className="
                  relative
                  h-[72px]
                  flex
                  items-center
                "
                onMouseEnter={() =>
                  setIsCategoryMenuOpen(
                    true
                  )
                }
                onMouseLeave={() =>
                  setIsCategoryMenuOpen(
                    false
                  )
                }
              >
                <button
                  type="button"
                  className="
                    h-full
                    border-b-4
                    border-transparent
                    px-3
                    text-xs
                    font-bold
                    uppercase
                    tracking-wide
                    hover:border-orange-500
                  "
                >
                  Categories
                </button>

                {isCategoryMenuOpen && (
                  <div
                    className="
                      absolute
                      left-0
                      top-full
                      w-[720px]
                      border-t
                      border-gray-100
                      bg-white
                      p-6
                      shadow-2xl
                    "
                  >
                    <div
                      className="
                        grid
                        grid-cols-4
                        gap-5
                      "
                    >
                      {categoryDetails.map(
                        (
                          category
                        ) => (
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
                              group
                              text-left
                            "
                          >
                            <div
                              className="
                                aspect-square
                                overflow-hidden
                                rounded-full
                                bg-gray-100
                              "
                            >
                              <img
                                src={
                                  category.icon
                                }
                                alt={
                                  category.name
                                }
                                className="
                                  h-full
                                  w-full
                                  object-cover
                                  transition
                                  duration-300
                                  group-hover:scale-105
                                "
                              />
                            </div>

                            <p
                              className="
                                mt-2
                                text-center
                                text-xs
                                font-semibold
                                group-hover:text-orange-600
                              "
                            >
                              {
                                category.name
                              }
                            </p>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Link
                to="/shop?discount=10"
                className="
                  border-b-4
                  border-transparent
                  px-3
                  py-6
                  text-xs
                  font-bold
                  uppercase
                  tracking-wide
                  hover:border-orange-500
                "
              >
                Offers
              </Link>
            </nav>

            {/* SEARCH */}

            <div
              className="
                ml-auto
                w-full
                max-w-[420px]
              "
            >
              <SearchBox />
            </div>

            {/* DESKTOP ACTIONS */}

            <div
              className="
                flex
                shrink-0
                items-center
                gap-5
              "
            >
              <Link
                to={
                  isAuthenticated
                    ? "/account"
                    : "/login"
                }
                className="
                  flex
                  flex-col
                  items-center
                  gap-0.5
                  text-[11px]
                  font-semibold
                "
              >
                <UserIcon />

                <span>
                  {isAuthenticated
                    ? user?.name
                        ?.split(
                          " "
                        )[0] ||
                      "Profile"
                    : "Profile"}
                </span>
              </Link>

              <Link
                to="/wishlist"
                className="
                  relative
                  flex
                  flex-col
                  items-center
                  gap-0.5
                  text-[11px]
                  font-semibold
                "
              >
                <HeartIcon />

                <span>
                  Wishlist
                </span>

                {wishlistCount >
                  0 && (
                  <span
                    className="
                      absolute
                      -right-1
                      -top-2
                      flex
                      h-4
                      min-w-4
                      items-center
                      justify-center
                      rounded-full
                      bg-orange-600
                      px-1
                      text-[9px]
                      font-bold
                      text-white
                    "
                  >
                    {
                      wishlistCount
                    }
                  </span>
                )}
              </Link>

              <Link
                to="/cart"
                className="
                  relative
                  flex
                  flex-col
                  items-center
                  gap-0.5
                  text-[11px]
                  font-semibold
                "
              >
                <BagIcon />

                <span>Bag</span>

                {cartCount > 0 && (
                  <span
                    className="
                      absolute
                      -right-1
                      -top-2
                      flex
                      h-4
                      min-w-4
                      items-center
                      justify-center
                      rounded-full
                      bg-orange-600
                      px-1
                      text-[9px]
                      font-bold
                      text-white
                    "
                  >
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* =================================================
            MOBILE HEADER
        ================================================= */}

        <div className="lg:hidden">
          {/* TOP ROW */}

          <div
            className="
              flex
              h-[58px]
              items-center
              px-3
            "
          >
            <button
              type="button"
              onClick={() =>
                setIsMenuOpen(
                  true
                )
              }
              aria-label="Open menu"
              className="
                mr-2
                flex
                h-10
                w-10
                items-center
                justify-center
              "
            >
              <MenuIcon />
            </button>

            <Link
              to="/"
              className="
                flex
                min-w-0
                flex-1
                items-center
              "
            >
              <img
                src={logoImage}
                alt="GymDrobe"
                className="
                  h-10
                  w-[88px]
                  object-contain
                  object-left
                  invert
                "
              />
            </Link>

            <div
              className="
                flex
                items-center
                gap-1
              "
            >
              <Link
                to="/wishlist"
                aria-label="Wishlist"
                className="
                  relative
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                "
              >
                <HeartIcon />

                {wishlistCount >
                  0 && (
                  <span
                    className="
                      absolute
                      right-0
                      top-0
                      flex
                      h-4
                      min-w-4
                      items-center
                      justify-center
                      rounded-full
                      bg-orange-600
                      px-1
                      text-[9px]
                      font-bold
                      text-white
                    "
                  >
                    {
                      wishlistCount
                    }
                  </span>
                )}
              </Link>

              <Link
                to="/cart"
                aria-label="Shopping bag"
                className="
                  relative
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                "
              >
                <BagIcon />

                {cartCount > 0 && (
                  <span
                    className="
                      absolute
                      right-0
                      top-0
                      flex
                      h-4
                      min-w-4
                      items-center
                      justify-center
                      rounded-full
                      bg-orange-600
                      px-1
                      text-[9px]
                      font-bold
                      text-white
                    "
                  >
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* MOBILE SEARCH */}

          <div
            ref={searchRef}
            className="
              px-3
              pb-3
            "
          >
            <SearchBox mobile />
          </div>

          {/* MOBILE QUICK CATEGORY BAR */}

          <div
            className="
              border-t
              border-gray-100
              bg-white
            "
          >
            <div
              className="
                flex
                items-center
                gap-6
                overflow-x-auto
                px-4
                py-3
                [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
              "
            >
              <Link
                to="/shop"
                className="
                  shrink-0
                  text-xs
                  font-bold
                  uppercase
                  text-orange-600
                "
              >
                All
              </Link>

              {categoryDetails.map(
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
                      shrink-0
                      whitespace-nowrap
                      text-xs
                      font-semibold
                      uppercase
                      text-gray-700
                    "
                  >
                    {category.name}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===================================================
          MOBILE SIDE MENU
      =================================================== */}

      {isMenuOpen && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            lg:hidden
          "
        >
          {/* OVERLAY */}

          <button
            type="button"
            aria-label="Close menu"
            onClick={() =>
              setIsMenuOpen(false)
            }
            className="
              absolute
              inset-0
              h-full
              w-full
              bg-black/50
            "
          />

          {/* DRAWER */}

          <aside
            className="
              relative
              z-10
              h-full
              w-[85%]
              max-w-[340px]
              overflow-y-auto
              bg-white
              shadow-2xl
            "
          >
            {/* DRAWER HEADER */}

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-gray-100
                p-4
              "
            >
              <Link
                to="/"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
              >
                <img
                  src={logoImage}
                  alt="GymDrobe"
                  className="
                    h-10
                    w-24
                    object-contain
                    object-left
                    invert
                  "
                />
              </Link>

              <button
                type="button"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
                aria-label="Close menu"
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                "
              >
                <CloseIcon />
              </button>
            </div>

            {/* ACCOUNT */}

            <div
              className="
                bg-gray-50
                p-4
              "
            >
              {isAuthenticated ? (
                <>
                  <p
                    className="
                      text-xs
                      text-gray-500
                    "
                  >
                    Welcome back
                  </p>

                  <p
                    className="
                      mt-1
                      font-bold
                    "
                  >
                    {user?.name ||
                      "GymDrobe Customer"}
                  </p>

                  <Link
                    to="/account"
                    onClick={() =>
                      setIsMenuOpen(
                        false
                      )
                    }
                    className="
                      mt-3
                      inline-block
                      text-xs
                      font-bold
                      uppercase
                      text-orange-600
                    "
                  >
                    View Account →
                  </Link>
                </>
              ) : (
                <>
                  <p className="font-bold">
                    Welcome to
                    GymDrobe
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-gray-500
                    "
                  >
                    Login to manage
                    your orders and
                    wishlist.
                  </p>

                  <div
                    className="
                      mt-3
                      flex
                      gap-2
                    "
                  >
                    <Link
                      to="/login"
                      onClick={() =>
                        setIsMenuOpen(
                          false
                        )
                      }
                      className="
                        border
                        border-gray-900
                        px-4
                        py-2
                        text-xs
                        font-bold
                        uppercase
                      "
                    >
                      Login
                    </Link>

                    <Link
                      to="/signup"
                      onClick={() =>
                        setIsMenuOpen(
                          false
                        )
                      }
                      className="
                        bg-gray-900
                        px-4
                        py-2
                        text-xs
                        font-bold
                        uppercase
                        text-white
                      "
                    >
                      Sign Up
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* MAIN LINKS */}

            <div className="p-3">
              <Link
                to="/"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-gray-100
                  px-2
                  py-4
                  text-sm
                  font-bold
                "
              >
                Home
                <span>›</span>
              </Link>

              <Link
                to="/shop"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-gray-100
                  px-2
                  py-4
                  text-sm
                  font-bold
                "
              >
                Shop All
                <span>›</span>
              </Link>

              {/* CATEGORIES */}

              <div
                className="
                  border-b
                  border-gray-100
                "
              >
                <button
                  type="button"
                  onClick={() =>
                    setIsCategoryMenuOpen(
                      (
                        current
                      ) =>
                        !current
                    )
                  }
                  className="
                    flex
                    w-full
                    items-center
                    justify-between
                    px-2
                    py-4
                    text-left
                    text-sm
                    font-bold
                  "
                >
                  Categories

                  <span>
                    {isCategoryMenuOpen
                      ? "−"
                      : "+"}
                  </span>
                </button>

                {isCategoryMenuOpen && (
                  <div
                    className="
                      grid
                      grid-cols-2
                      gap-3
                      pb-4
                    "
                  >
                    {categoryDetails.map(
                      (
                        category
                      ) => (
                        <button
                          key={
                            category.name
                          }
                          type="button"
                          onClick={() => {
                            openCategory(
                              category.name
                            );

                            setIsMenuOpen(
                              false
                            );
                          }}
                          className="
                            text-left
                          "
                        >
                          <div
                            className="
                              aspect-square
                              overflow-hidden
                              rounded-lg
                              bg-gray-100
                            "
                          >
                            <img
                              src={
                                category.icon
                              }
                              alt={
                                category.name
                              }
                              className="
                                h-full
                                w-full
                                object-cover
                              "
                            />
                          </div>

                          <p
                            className="
                              mt-1.5
                              text-xs
                              font-semibold
                            "
                          >
                            {
                              category.name
                            }
                          </p>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              <Link
                to="/shop?discount=10"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-gray-100
                  px-2
                  py-4
                  text-sm
                  font-bold
                  text-orange-600
                "
              >
                Offers
                <span>›</span>
              </Link>

              <Link
                to="/wishlist"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-gray-100
                  px-2
                  py-4
                  text-sm
                  font-semibold
                "
              >
                Wishlist

                <span>
                  {
                    wishlistCount
                  }
                </span>
              </Link>

              <Link
                to="/cart"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-gray-100
                  px-2
                  py-4
                  text-sm
                  font-semibold
                "
              >
                Shopping Bag

                <span>
                  {cartCount}
                </span>
              </Link>

              {isAuthenticated && (
                <>
                  <Link
                    to="/orders"
                    onClick={() =>
                      setIsMenuOpen(
                        false
                      )
                    }
                    className="
                      flex
                      items-center
                      justify-between
                      border-b
                      border-gray-100
                      px-2
                      py-4
                      text-sm
                      font-semibold
                    "
                  >
                    My Orders
                    <span>›</span>
                  </Link>

                  <Link
                    to="/addresses"
                    onClick={() =>
                      setIsMenuOpen(
                        false
                      )
                    }
                    className="
                      flex
                      items-center
                      justify-between
                      border-b
                      border-gray-100
                      px-2
                      py-4
                      text-sm
                      font-semibold
                    "
                  >
                    My Addresses
                    <span>›</span>
                  </Link>

                  <button
                    type="button"
                    onClick={
                      handleLogout
                    }
                    className="
                      w-full
                      px-2
                      py-4
                      text-left
                      text-sm
                      font-bold
                      text-red-600
                    "
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default Navbar;