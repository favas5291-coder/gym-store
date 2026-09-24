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
import { useAuth } from "../context/AuthContext";

const RECENT_SEARCH_KEY =
  "gymdrobe-recent-searches";

const MAX_RECENT_SEARCHES = 6;

/* =========================================================
   NAVIGATION CONFIG
========================================================= */

const navigationGroups = [
  {
    id: "workout",
    label: "WORKOUT",
    accent: "#f97316",

    columns: [
      {
        title: "Workout Clothing",
        links: [
          {
            label: "All Workout Clothes",
            category: "Workout Clothes",
          },
          {
            label: "T-Shirts",
            category: "Workout Clothes",
            subcategory: "T-Shirts",
          },
        ],
      },

      {
        title: "Workout Essentials",
        links: [
          {
            label: "Training Socks",
            category: "Socks",
          },
          {
            label: "Gym Towels",
            category: "Gym Towels",
          },
        ],
      },

      {
        title: "Shop By",
        links: [
          {
            label: "Bestsellers",
            query: "bestseller",
          },
          {
            label: "New Arrivals",
            query: "new",
          },
          {
            label: "Top Rated",
            query: "top rated",
          },
        ],
      },
    ],
  },

  {
    id: "shoes",
    label: "SHOES",
    accent: "#2563eb",

    columns: [
      {
        title: "Gym Shoes",
        links: [
          {
            label: "All Gym Shoes",
            category: "Gym Shoes",
          },
          {
            label: "Training Shoes",
            category: "Gym Shoes",
            subcategory: "Training Shoes",
          },
        ],
      },

      {
        title: "Shop By Activity",
        links: [
          {
            label: "Training",
            query: "training shoes",
          },
          {
            label: "Running",
            query: "running shoes",
          },
          {
            label: "Sports",
            query: "sports shoes",
          },
        ],
      },

      {
        title: "Popular",
        links: [
          {
            label: "Top Rated Shoes",
            query: "top rated shoes",
          },
          {
            label: "GymDrobe Shoes",
            query: "gymdrobe shoes",
          },
        ],
      },
    ],
  },

  {
    id: "accessories",
    label: "ACCESSORIES",
    accent: "#9333ea",

    columns: [
      {
        title: "Gym Accessories",
        links: [
          {
            label: "Gym Towels",
            category: "Gym Towels",
          },
          {
            label: "Training Socks",
            category: "Socks",
          },
          {
            label: "Headphones",
            category: "Headphones",
          },
        ],
      },

      {
        title: "Workout Gear",
        links: [
          {
            label: "Workout Towels",
            category: "Gym Towels",
            subcategory: "Workout Towels",
          },
          {
            label: "Sports Socks",
            category: "Socks",
            subcategory: "Sports Socks",
          },
        ],
      },

      {
        title: "Discover",
        links: [
          {
            label: "Trending Gear",
            query: "trending",
          },
          {
            label: "Popular Accessories",
            query: "popular",
          },
        ],
      },
    ],
  },

  {
    id: "hydration",
    label: "HYDRATION",
    accent: "#0891b2",

    columns: [
      {
        title: "Water Bottles",
        links: [
          {
            label: "All Water Bottles",
            category: "Water Bottles",
          },
          {
            label: "Sports Bottles",
            category: "Water Bottles",
            subcategory: "Sports Bottles",
          },
        ],
      },

      {
        title: "Shaker Bottles",
        links: [
          {
            label: "All Shakers",
            category: "Shaker Bottles",
          },
          {
            label: "Protein Shakers",
            category: "Shaker Bottles",
            subcategory: "Protein Shakers",
          },
        ],
      },

      {
        title: "Popular Searches",
        links: [
          {
            label: "Gym Bottles",
            query: "gym bottle",
          },
          {
            label: "Protein Shakers",
            query: "protein shaker",
          },
        ],
      },
    ],
  },

  {
    id: "supplements",
    label: "SUPPLEMENTS",
    accent: "#16a34a",

    columns: [
      {
        title: "Protein",
        links: [
          {
            label: "Shop Protein",
            category: "Protein",
          },
        ],
      },

      {
        title: "Fitness Nutrition",
        links: [
          {
            label: "Protein Products",
            query: "protein",
          },
          {
            label: "Workout Nutrition",
            query: "workout nutrition",
          },
        ],
      },
    ],
  },
];

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

  const desktopSearchRef =
    useRef(null);

  const mobileSearchRef =
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
    activeMegaMenu,
    setActiveMegaMenu,
  ] = useState(null);

  const [
    mobileCategoryOpen,
    setMobileCategoryOpen,
  ] = useState(null);

  const [
    recentSearches,
    setRecentSearches,
  ] = useState(
    getRecentSearches
  );

  /* =======================================================
     SEARCH SUGGESTIONS
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

  /* =======================================================
     SEARCH PARAM SYNC
  ======================================================= */

  useEffect(() => {
    setSearch(
      searchParams.get(
        "search"
      ) || ""
    );
  }, [searchParams]);

  /* =======================================================
     OUTSIDE SEARCH CLICK
  ======================================================= */

  useEffect(() => {
    function handleClickOutside(
      event
    ) {
      const clickedDesktop =
        desktopSearchRef.current?.contains(
          event.target
        );

      const clickedMobile =
        mobileSearchRef.current?.contains(
          event.target
        );

      if (
        !clickedDesktop &&
        !clickedMobile
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
     ROUTE CHANGE
  ======================================================= */

  useEffect(() => {
    setIsMenuOpen(false);
    setActiveMegaMenu(null);
    setMobileCategoryOpen(
      null
    );
    setIsSearchFocused(false);
  }, [location.pathname]);

  /* =======================================================
     MOBILE BODY LOCK
  ======================================================= */

  useEffect(() => {
    if (!isMenuOpen) {
      document.body.style.overflow =
        "";

      return;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [isMenuOpen]);

  /* =======================================================
     SEARCH
  ======================================================= */

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

  /* =======================================================
     SHOP NAVIGATION
  ======================================================= */

  function openShopLink(link) {
    if (link.category) {
      const params =
        new URLSearchParams();

      params.set(
        "category",
        link.category
      );

      if (link.subcategory) {
        params.set(
          "subcategory",
          link.subcategory
        );
      }

      navigate(
        `/shop?${params.toString()}`
      );

      return;
    }

    if (link.query) {
      navigate(
        `/shop?search=${encodeURIComponent(
          link.query
        )}`
      );

      return;
    }

    navigate("/shop");
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  function handleLogout() {
    logout();

    setIsMenuOpen(false);

    navigate("/");
  }

  /* =======================================================
     SEARCH BOX
  ======================================================= */

  function SearchBox({
    wrapperRef,
  }) {
    return (
      <div
        ref={wrapperRef}
        className="relative w-full"
      >
        <div
          className={`
            flex
            h-[44px]
            w-full
            items-center
            rounded-[4px]
            border
            transition
            ${
              isSearchFocused
                ? "border-gray-300 bg-white"
                : "border-transparent bg-[#f5f5f6]"
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
              w-12
              shrink-0
              items-center
              justify-center
              text-[#696b79]
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
              text-[13px]
              text-[#282c3f]
              outline-none
              placeholder:text-[#696b79]
            "
          />

          {search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="
                mr-3
                text-xl
                text-gray-400
                hover:text-gray-700
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
              top-[50px]
              z-[120]
              max-h-[430px]
              overflow-y-auto
              border
              border-[#eaeaec]
              bg-white
              shadow-[0_8px_25px_rgba(40,44,63,0.12)]
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
                        text-[11px]
                        font-bold
                        uppercase
                        tracking-[0.08em]
                        text-[#696b79]
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
                        text-[11px]
                        font-bold
                        uppercase
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
                          border-b
                          border-gray-50
                          px-1
                          py-3
                          text-left
                          text-sm
                          text-[#282c3f]
                          last:border-b-0
                          hover:bg-[#f5f5f6]
                        "
                      >
                        <span
                          className="
                            text-gray-400
                          "
                        >
                          ↻
                        </span>

                        {item}
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
                    {searchSuggestions.map(
                      (product) => (
                        <button
                          key={
                            product.id
                          }
                          type="button"
                          onClick={() =>
                            navigate(
                              `/product/${product.id}`
                            )
                          }
                          className="
                            flex
                            w-full
                            items-center
                            gap-3
                            p-2
                            text-left
                            hover:bg-[#f5f5f6]
                          "
                        >
                          <img
                            src={
                              product.image
                            }
                            alt={
                              product.name
                            }
                            className="
                              h-14
                              w-11
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
                                text-[#282c3f]
                              "
                            >
                              {
                                product.name
                              }
                            </p>

                            <p
                              className="
                                mt-0.5
                                truncate
                                text-xs
                                text-[#696b79]
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
                        border-[#eaeaec]
                        px-3
                        py-3
                        text-left
                        text-xs
                        font-bold
                        uppercase
                        tracking-wide
                        text-orange-600
                      "
                    >
                      View all results
                      for "{search}" →
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p
                      className="
                        text-sm
                        font-semibold
                        text-[#282c3f]
                      "
                    >
                      No products found
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-[#696b79]
                      "
                    >
                      Try another product,
                      brand or category.
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
          text-[#282c3f]
          shadow-[0_2px_12px_rgba(40,44,63,0.08)]
        "
      >
        {/* =================================================
            DESKTOP
        ================================================= */}

        <div
          className="
            hidden
            lg:block
          "
          onMouseLeave={() =>
            setActiveMegaMenu(
              null
            )
          }
        >
          <div
            className="
              mx-auto
              flex
              h-[80px]
              w-full
              max-w-[1600px]
              items-center
              px-8
            "
          >
            {/* LOGO */}

            <Link
              to="/"
              className="
                mr-8
                flex
                shrink-0
                items-center
              "
            >
              <img
                src={logoImage}
                alt="GymDrobe"
                className="
                  h-[52px]
                  w-[112px]
                  object-contain
                  object-left
                  invert
                "
              />
            </Link>

            {/* NAVIGATION */}

            <nav
              className="
                flex
                h-full
                shrink-0
                items-center
              "
            >
              {navigationGroups.map(
                (group) => (
                  <button
                    key={group.id}
                    type="button"
                    onMouseEnter={() =>
                      setActiveMegaMenu(
                        group.id
                      )
                    }
                    className={`
                      relative
                      flex
                      h-full
                      items-center
                      px-[13px]
                      text-[12px]
                      font-bold
                      tracking-[0.03em]
                      transition
                      after:absolute
                      after:bottom-0
                      after:left-0
                      after:right-0
                      after:h-[4px]
                      after:origin-center
                      after:scale-x-0
                      after:transition-transform
                      hover:after:scale-x-100
                      ${
                        activeMegaMenu ===
                        group.id
                          ? "after:scale-x-100"
                          : ""
                      }
                    `}
                    style={{
                      "--nav-accent":
                        group.accent,
                    }}
                  >
                    <span>
                      {group.label}
                    </span>

                    <span
                      className="
                        absolute
                        bottom-0
                        left-0
                        right-0
                        h-[4px]
                      "
                      style={{
                        background:
                          activeMegaMenu ===
                          group.id
                            ? group.accent
                            : "transparent",
                      }}
                    />
                  </button>
                )
              )}

              <Link
                to="/shop?discount=10"
                onMouseEnter={() =>
                  setActiveMegaMenu(
                    null
                  )
                }
                className="
                  relative
                  flex
                  h-full
                  items-center
                  px-[13px]
                  text-[12px]
                  font-bold
                  tracking-[0.03em]
                  text-orange-600
                "
              >
                OFFERS

                <span
                  className="
                    absolute
                    right-0
                    top-[20px]
                    text-[8px]
                    font-bold
                    text-red-500
                  "
                >
                  NEW
                </span>
              </Link>
            </nav>

            {/* SEARCH */}

            <div
              className="
                ml-auto
                w-full
                max-w-[420px]
                px-5
              "
              onMouseEnter={() =>
                setActiveMegaMenu(
                  null
                )
              }
            >
              <SearchBox
                wrapperRef={
                  desktopSearchRef
                }
              />
            </div>

            {/* ACTIONS */}

            <div
              className="
                flex
                shrink-0
                items-center
                gap-6
              "
              onMouseEnter={() =>
                setActiveMegaMenu(
                  null
                )
              }
            >
              <Link
                to={
                  isAuthenticated
                    ? "/account"
                    : "/login"
                }
                className="
                  flex
                  min-w-[48px]
                  flex-col
                  items-center
                  justify-center
                  gap-1
                  text-[11px]
                  font-semibold
                  hover:text-orange-600
                "
              >
                <UserIcon />

                <span>
                  {isAuthenticated
                    ? user?.name
                        ?.split(" ")[0] ||
                      "Profile"
                    : "Profile"}
                </span>
              </Link>

              <Link
                to="/wishlist"
                className="
                  relative
                  flex
                  min-w-[48px]
                  flex-col
                  items-center
                  justify-center
                  gap-1
                  text-[11px]
                  font-semibold
                  hover:text-orange-600
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
                      h-[17px]
                      min-w-[17px]
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
                  min-w-[48px]
                  flex-col
                  items-center
                  justify-center
                  gap-1
                  text-[11px]
                  font-semibold
                  hover:text-orange-600
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
                      h-[17px]
                      min-w-[17px]
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

          {/* ===============================================
              DESKTOP MEGA MENU
          =============================================== */}

          {activeMegaMenu && (
            <div
              className="
                absolute
                left-0
                right-0
                top-[80px]
                z-[80]
                border-t
                border-[#eaeaec]
                bg-white
                shadow-[0_10px_30px_rgba(40,44,63,0.12)]
              "
            >
              <div
                className="
                  mx-auto
                  grid
                  min-h-[330px]
                  max-w-[1120px]
                  grid-cols-4
                  bg-white
                "
              >
                {navigationGroups
                  .find(
                    (group) =>
                      group.id ===
                      activeMegaMenu
                  )
                  ?.columns.map(
                    (
                      column,
                      index
                    ) => {
                      const activeGroup =
                        navigationGroups.find(
                          (
                            group
                          ) =>
                            group.id ===
                            activeMegaMenu
                        );

                      return (
                        <div
                          key={
                            column.title
                          }
                          className={`
                            px-7
                            py-7
                            ${
                              index % 2 ===
                              1
                                ? "bg-[#fafafa]"
                                : "bg-white"
                            }
                          `}
                        >
                          <h3
                            className="
                              mb-4
                              text-[13px]
                              font-bold
                            "
                            style={{
                              color:
                                activeGroup?.accent,
                            }}
                          >
                            {
                              column.title
                            }
                          </h3>

                          <div
                            className="
                              space-y-2.5
                            "
                          >
                            {column.links.map(
                              (
                                link
                              ) => (
                                <button
                                  key={
                                    link.label
                                  }
                                  type="button"
                                  onClick={() => {
                                    openShopLink(
                                      link
                                    );

                                    setActiveMegaMenu(
                                      null
                                    );
                                  }}
                                  className="
                                    block
                                    w-full
                                    text-left
                                    text-[13px]
                                    font-normal
                                    text-[#282c3f]
                                    transition
                                    hover:font-semibold
                                  "
                                >
                                  {
                                    link.label
                                  }
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}

                {/* PROMO COLUMN */}

                <div
                  className="
                    flex
                    flex-col
                    justify-between
                    bg-[#fff7ed]
                    px-7
                    py-7
                  "
                >
                  <div>
                    <p
                      className="
                        text-[11px]
                        font-bold
                        uppercase
                        tracking-[0.1em]
                        text-orange-600
                      "
                    >
                      GymDrobe
                    </p>

                    <h3
                      className="
                        mt-3
                        text-[22px]
                        font-bold
                        leading-tight
                        text-[#282c3f]
                      "
                    >
                      Built for
                      <br />
                      Every Workout
                    </h3>

                    <p
                      className="
                        mt-3
                        text-[13px]
                        leading-5
                        text-[#696b79]
                      "
                    >
                      Discover gym wear,
                      footwear and workout
                      essentials.
                    </p>
                  </div>

                  <Link
                    to="/shop"
                    onClick={() =>
                      setActiveMegaMenu(
                        null
                      )
                    }
                    className="
                      mt-8
                      inline-flex
                      w-fit
                      items-center
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-orange-600
                    "
                  >
                    Shop All →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            MOBILE
        ================================================= */}

        <div className="lg:hidden">
          {/* TOP BAR */}

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
                setIsMenuOpen(true)
              }
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
              "
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>

            <Link
              to="/"
              className="
                ml-1
                flex
                flex-1
                items-center
              "
            >
              <img
                src={logoImage}
                alt="GymDrobe"
                className="
                  h-10
                  w-[92px]
                  object-contain
                  object-left
                  invert
                "
              />
            </Link>

            <Link
              to="/wishlist"
              className="
                relative
                flex
                h-10
                w-10
                items-center
                justify-center
              "
              aria-label="Wishlist"
            >
              <HeartIcon />

              {wishlistCount > 0 && (
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
                    text-[8px]
                    font-bold
                    text-white
                  "
                >
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link
              to="/cart"
              className="
                relative
                flex
                h-10
                w-10
                items-center
                justify-center
              "
              aria-label="Bag"
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
                    text-[8px]
                    font-bold
                    text-white
                  "
                >
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          {/* MOBILE SEARCH */}

          <div
            className="
              px-3
              pb-3
            "
          >
            <SearchBox
              wrapperRef={
                mobileSearchRef
              }
            />
          </div>

          {/* MOBILE QUICK NAV */}

          <div
            className="
              hide-scrollbar
              flex
              items-center
              gap-6
              overflow-x-auto
              border-t
              border-[#eaeaec]
              px-4
              py-3
            "
          >
            <Link
              to="/shop"
              className="
                shrink-0
                text-[11px]
                font-bold
                uppercase
                text-orange-600
              "
            >
              All
            </Link>

            {navigationGroups.map(
              (group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() =>
                    setIsMenuOpen(
                      true
                    )
                  }
                  className="
                    shrink-0
                    whitespace-nowrap
                    text-[11px]
                    font-bold
                    uppercase
                    text-[#282c3f]
                  "
                >
                  {group.label}
                </button>
              )
            )}

            <Link
              to="/shop?discount=10"
              className="
                shrink-0
                text-[11px]
                font-bold
                uppercase
                text-orange-600
              "
            >
              Offers
            </Link>
          </div>
        </div>
      </header>

      {/* ===================================================
          MOBILE DRAWER
      =================================================== */}

      {isMenuOpen && (
        <div
          className="
            fixed
            inset-0
            z-[200]
            lg:hidden
          "
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() =>
              setIsMenuOpen(false)
            }
            className="
              absolute
              inset-0
              bg-black/50
            "
          />

          <aside
            className="
              relative
              z-10
              h-full
              w-[88%]
              max-w-[360px]
              overflow-y-auto
              bg-white
            "
          >
            {/* DRAWER HEADER */}

            <div
              className="
                flex
                h-[64px]
                items-center
                justify-between
                border-b
                border-[#eaeaec]
                px-4
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
                    w-[100px]
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

            {/* ACCOUNT AREA */}

            <div
              className="
                border-b
                border-[#eaeaec]
                bg-[#fafafa]
                p-5
              "
            >
              {isAuthenticated ? (
                <>
                  <p
                    className="
                      text-xs
                      text-[#696b79]
                    "
                  >
                    Welcome back
                  </p>

                  <p
                    className="
                      mt-1
                      font-bold
                      text-[#282c3f]
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
                  <p
                    className="
                      font-bold
                      text-[#282c3f]
                    "
                  >
                    Welcome to
                    GymDrobe
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-[#696b79]
                    "
                  >
                    Login to view
                    orders, addresses and
                    wishlist.
                  </p>

                  <div
                    className="
                      mt-4
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
                        border-orange-600
                        px-4
                        py-2
                        text-xs
                        font-bold
                        uppercase
                        text-orange-600
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
                        bg-orange-600
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

            {/* NAVIGATION GROUPS */}

            <div>
              {navigationGroups.map(
                (group) => (
                  <div
                    key={group.id}
                    className="
                      border-b
                      border-[#eaeaec]
                    "
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setMobileCategoryOpen(
                          (
                            current
                          ) =>
                            current ===
                            group.id
                              ? null
                              : group.id
                        )
                      }
                      className="
                        flex
                        w-full
                        items-center
                        justify-between
                        px-5
                        py-4
                        text-left
                        text-sm
                        font-bold
                        text-[#282c3f]
                      "
                    >
                      {group.label}

                      <span
                        className="
                          text-xl
                          font-light
                        "
                      >
                        {mobileCategoryOpen ===
                        group.id
                          ? "−"
                          : "+"}
                      </span>
                    </button>

                    {mobileCategoryOpen ===
                      group.id && (
                      <div
                        className="
                          bg-[#fafafa]
                          px-5
                          pb-5
                        "
                      >
                        {group.columns.map(
                          (
                            column
                          ) => (
                            <div
                              key={
                                column.title
                              }
                              className="
                                border-b
                                border-gray-200
                                py-4
                                last:border-b-0
                              "
                            >
                              <p
                                className="
                                  mb-3
                                  text-xs
                                  font-bold
                                "
                                style={{
                                  color:
                                    group.accent,
                                }}
                              >
                                {
                                  column.title
                                }
                              </p>

                              <div
                                className="
                                  space-y-3
                                "
                              >
                                {column.links.map(
                                  (
                                    link
                                  ) => (
                                    <button
                                      key={
                                        link.label
                                      }
                                      type="button"
                                      onClick={() => {
                                        openShopLink(
                                          link
                                        );

                                        setIsMenuOpen(
                                          false
                                        );
                                      }}
                                      className="
                                        block
                                        w-full
                                        text-left
                                        text-[13px]
                                        text-[#282c3f]
                                      "
                                    >
                                      {
                                        link.label
                                      }
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* BASIC LINKS */}

            <div
              className="
                border-b
                border-[#eaeaec]
                p-5
              "
            >
              <Link
                to="/shop?discount=10"
                onClick={() =>
                  setIsMenuOpen(
                    false
                  )
                }
                className="
                  block
                  py-2
                  text-sm
                  font-bold
                  text-orange-600
                "
              >
                Offers
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
                  py-2
                  text-sm
                  text-[#282c3f]
                "
              >
                Wishlist

                <span>
                  {wishlistCount}
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
                  py-2
                  text-sm
                  text-[#282c3f]
                "
              >
                Shopping Bag

                <span>
                  {cartCount}
                </span>
              </Link>
            </div>

            {/* ACCOUNT LINKS */}

            {isAuthenticated && (
              <div className="p-5">
                <Link
                  to="/account"
                  onClick={() =>
                    setIsMenuOpen(
                      false
                    )
                  }
                  className="
                    block
                    py-2
                    text-sm
                    text-[#282c3f]
                  "
                >
                  My Account
                </Link>

                <Link
                  to="/orders"
                  onClick={() =>
                    setIsMenuOpen(
                      false
                    )
                  }
                  className="
                    block
                    py-2
                    text-sm
                    text-[#282c3f]
                  "
                >
                  My Orders
                </Link>

                <Link
                  to="/addresses"
                  onClick={() =>
                    setIsMenuOpen(
                      false
                    )
                  }
                  className="
                    block
                    py-2
                    text-sm
                    text-[#282c3f]
                  "
                >
                  My Addresses
                </Link>

                <button
                  type="button"
                  onClick={
                    handleLogout
                  }
                  className="
                    mt-3
                    block
                    text-sm
                    font-bold
                    text-red-600
                  "
                >
                  Logout
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

export default Navbar;