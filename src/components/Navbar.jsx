import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  SHOP_DEPARTMENTS,
  catalogOptions,
  catalogProducts,
  matchesSearch,
  productDepartment,
} from "../utils/catalog.js";

import { asset } from "../data/assets.js";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

import "./GymDrobeStorefront.css";

const logoImage = asset("new logo.png");

const RECENT_SEARCH_KEY =
  "gymdrobe-recent-searches";

const MAX_RECENT_SEARCHES = 6;

function buildNavigationGroups(products) {
  const catalogue = catalogProducts(products);

  return SHOP_DEPARTMENTS.filter(department => catalogue.some(product => productDepartment(product) === department.id)).map((department) => {
    const scoped = catalogue.filter(
      (product) =>
        productDepartment(product) === department.id,
    );

    const scope = {
      department: department.id,
    };

    return {
      ...department,

      columns: [
        {
          title: "Explore the collection",

          links: [
            {
              label: `All ${department.title.toLowerCase()}`,
              ...scope,
            },

            ...catalogOptions(scoped, "category")
              .slice(0, 12)
              .map((category) => ({
                label: category,
                category,
                ...scope,
              })),
          ],
        },

        {
          title: "Shop by",

          links: [
            {
              label: "Trending",
              collection: "featured",
              ...scope,
            },
            {
              label: "Bestsellers",
              collection: "bestsellers",
              ...scope,
            },
            {
              label: "New arrivals",
              collection: "new",
              ...scope,
            },
            {
              label: "Top rated",
              rating: "4",
              sort: "rating",
              ...scope,
            },
          ],
        },

        {
          title: "Shop by brand",

          links: [
            {
              label: "All brands",
              ...scope,
            },

            ...catalogOptions(scoped, "brand")
              .slice(0, 8)
              .map((brand) => ({
                label: brand,
                brand,
                ...scope,
              })),
          ],
        },
      ],
    };
  });
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

function safeCount(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(0, Math.floor(parsed))
    : 0;
}

function getRecentSearches() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(RECENT_SEARCH_KEY) || "[]",
    );

    if (!Array.isArray(saved)) return [];

    const seen = new Set();

    return saved
      .filter((value) => {
        if (
          typeof value !== "string" ||
          !value.trim()
        ) {
          return false;
        }

        const key = normalizeText(value);

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .map((value) => value.trim().slice(0, 120))
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function shopPath(link) {
  const params = new URLSearchParams();

  for (const key of [
    "department",
    "category",
    "subcategory",
    "brand",
    "collection",
    "sort",
    "rating",
    "search",
  ]) {
    if (
      typeof link[key] === "string" &&
      link[key].trim()
    ) {
      params.set(key, link[key].trim());
    }
  }

  return params.size
    ? `/shop?${params}`
    : "/shop";
}

function Icon({ name, size = 22 }) {
  const paths = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),

    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),

    bag: (
      <>
        <path d="M6 8h12l1 13H5L6 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),

    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.8-4.2 3.4-6 8-6s7.2 1.8 8 6" />
      </>
    ),

    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,

    history: (
      <>
        <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Brand() {
  const [failed, setFailed] = useState(false);

  if (failed || !logoImage) {
    return (
      <span className="gn-wordmark">
        GYMDROBE.
      </span>
    );
  }

  return (
    <img
      src={logoImage}
      alt="GymDrobe"
      onError={() => setFailed(true)}
    />
  );
}

function Thumbnail({ src }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={35}
        height={44}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return <Icon name="bag" />;
}

function SearchBox({
  value,
  onChange,
  onSubmit,
  onPick,
  recent,
  onClearHistory,
  onClear,
  onOpen,
  routeKey,
  onRemember,
}) {
  const { products } = useCatalog();

  const container = useRef(null);
  const input = useRef(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const listId = useId();
  const clean = value.trim();

  const matches = useMemo(() => {
    if (!clean) return [];

    const found = [];

    for (const product of Array.isArray(products)
      ? products
      : []) {
      if (
        product &&
        product.id != null &&
        product.isActive !== false &&
        matchesSearch(product, clean)
      ) {
        found.push(product);

        if (found.length === 6) break;
      }
    }

    return found;
  }, [clean, products]);

  const options = clean
    ? [
        ...matches.map((product) => ({
          type: "product",
          product,
          label: product.name,

          href: `/product/${encodeURIComponent(
            String(product.id),
          )}`,
        })),

        {
          type: "query",
          label: `Search all results for “${clean}”`,
          query: clean,

          href: `/shop?${new URLSearchParams({
            search: clean,
          })}`,
        },
      ]
    : recent.map((query) => ({
        type: "query",
        label: query,
        query,

        href: `/shop?${new URLSearchParams({
          search: query,
        })}`,
      }));

  function close() {
    setOpen(false);
    setActive(-1);
  }

  useEffect(() => {
    setOpen(false);
    setActive(-1);
  }, [routeKey]);

  useEffect(() => {
    function outside(event) {
      if (
        !container.current?.contains(event.target)
      ) {
        setOpen(false);
        setActive(-1);
      }
    }

    document.addEventListener(
      "pointerdown",
      outside,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        outside,
      );
    };
  }, []);

  function choose(option) {
    if (!option) return;

    if (option.type === "product") {
      onPick(option.product);
    } else {
      onSubmit(option.query);
    }

    close();
  }

  function handleKey(event) {
    if (event.nativeEvent.isComposing) return;

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp"
    ) {
      event.preventDefault();
      onOpen();
      setOpen(true);

      if (!options.length) return;

      const direction =
        event.key === "ArrowDown" ? 1 : -1;

      const next =
        !open || active < 0
          ? direction === 1
            ? 0
            : options.length - 1
          : (
              active +
              direction +
              options.length
            ) % options.length;

      setActive(next);

      requestAnimationFrame(() => {
        document
          .getElementById(`${listId}-${next}`)
          ?.scrollIntoView({
            block: "nearest",
          });
      });

      return;
    }

    if (
      event.key === "Enter" &&
      open &&
      active >= 0
    ) {
      event.preventDefault();
      choose(options[active]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div
      className="gn-search"
      ref={container}
    >
      <form
        className="gn-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
          close();
          input.current?.blur();
        }}
      >
        <button
          className="gn-icon-button"
          type="submit"
          aria-label="Submit search"
        >
          <Icon name="search" size={20} />
        </button>

        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Search products"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={120}
          value={value}
          placeholder="Search for products, brands and more"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={
            open ? listId : undefined
          }
          aria-activedescendant={
            open &&
            active >= 0 &&
            active < options.length
              ? `${listId}-${active}`
              : undefined
          }
          onChange={(event) => {
            onChange(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => {
            onOpen();
            setOpen(true);
          }}
          onKeyDown={handleKey}
        />

        {value && (
          <button
            className="gn-icon-button"
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onClear();
              setActive(-1);
              input.current?.focus();
              setOpen(true);
            }}
          >
            <Icon name="close" size={17} />
          </button>
        )}
      </form>

      {open && (
        <div className="gn-results">
          <div className="gn-result-title">
            <span>
              {clean
                ? "Product suggestions"
                : "Recent searches"}
            </span>

            {!clean && recent.length > 0 && (
              <button
                className="gn-clear-history"
                type="button"
                onClick={onClearHistory}
              >
                Clear history
              </button>
            )}
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={
              clean
                ? "Search suggestions"
                : "Recent searches"
            }
          >
            {options.map((option, index) => (
              <li
                key={
                  option.type === "product"
                    ? `product-${option.product.id}`
                    : `query-${option.query}`
                }
                role="presentation"
              >
                <Link
                  to={option.href}
                  id={`${listId}-${index}`}
                  className="gn-option"
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === active}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    font: "inherit",
                    color: "inherit",

                    background:
                      index === active
                        ? "#f5f5f6"
                        : "#fff",

                    touchAction: "manipulation",
                  }}
                  onPointerMove={(event) => {
                    if (
                      event.pointerType === "mouse"
                    ) {
                      setActive(index);
                    }
                  }}
                  onClick={() => {
                    // Keep the link mounted so the tap can navigate.
                    if (option.type === "query") {
                      onRemember?.(option.query);
                    }
                  }}
                >
                  {option.type === "product" ? (
                    <Thumbnail
                      key={option.product.image}
                      src={option.product.image}
                    />
                  ) : (
                    <Icon
                      name={
                        clean
                          ? "search"
                          : "history"
                      }
                      size={18}
                    />
                  )}

                  <span className="gn-option-copy">
                    <strong>{option.label}</strong>

                    {option.type === "product" && (
                      <small>
                        {option.product.category}

                        {option.product.brand
                          ? ` · ${option.product.brand}`
                          : ""}
                      </small>
                    )}
                  </span>

                  <Icon name="arrow" size={15} />
                </Link>
              </li>
            ))}
          </ul>

          {!options.length && (
            <p className="gn-search-hint">
              Try a product, brand or category,
              such as shoes, bottle or training.
            </p>
          )}

          {clean && !matches.length && (
            <p className="gn-search-hint">
              No matching suggestions. Try another
              word or search the full shop.
            </p>
          )}
        </div>
      )}

      <span
        className="gn-sr"
        role="status"
      >
        {open && clean
          ? `${matches.length} product suggestions`
          : ""}
      </span>
    </div>
  );
}

export default function Navbar({
  cartCount = 0,
  wishlistCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const { products } = useCatalog();

  const navigationGroups = useMemo(
    () => buildNavigationGroups(products),
    [products],
  );

  const {
    user,
    logout,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const header = useRef(null);
  const dialog = useRef(null);
  const triggers = useRef({});
  const menuId = useId();

  const [search, setSearch] = useState(
    () =>
      new URLSearchParams(location.search).get(
        "search",
      ) || "",
  );

  const [recent, setRecent] = useState(
    getRecentSearches,
  );

  const [activeMenu, setActiveMenu] =
    useState(null);

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [mobileGroup, setMobileGroup] =
    useState(null);

  const [raised, setRaised] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [authError, setAuthError] =
    useState("");

  const bagCount = safeCount(cartCount);
  const savedCount = safeCount(wishlistCount);

  const firstName =
    typeof user?.name === "string"
      ? user.name.trim().split(/\s+/)[0]
      : "";

  const signedIn =
    Boolean(user) && isAuthenticated;

  const currentPath =
    `${location.pathname}${location.search}`;

  const loginHref =
    `/login?next=${encodeURIComponent(
      currentPath || "/",
    )}`;

  const signupHref =
    `/signup?next=${encodeURIComponent(
      currentPath || "/",
    )}`;

  const activeGroup = navigationGroups.find(
    (group) => group.id === activeMenu,
  );

  useEffect(() => {
    setSearch(
      new URLSearchParams(location.search).get(
        "search",
      ) || "",
    );

    setActiveMenu(null);
    setDrawerOpen(false);
    setMobileGroup(null);
  }, [
    location.key,
    location.pathname,
    location.search,
  ]);

  useEffect(() => {
    function update() {
      setRaised(window.scrollY > 12);
    }

    update();

    window.addEventListener("scroll", update, {
      passive: true,
    });

    return () => {
      window.removeEventListener(
        "scroll",
        update,
      );
    };
  }, []);

  useEffect(() => {
    function outside(event) {
      if (
        !header.current?.contains(event.target)
      ) {
        setActiveMenu(null);
      }
    }

    document.addEventListener(
      "pointerdown",
      outside,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        outside,
      );
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;

    const element = dialog.current;

    const previousFocus =
      document.activeElement;

    const previousOverflow =
      document.body.style.overflow;

    const desktop = window.matchMedia(
      "(min-width: 1280px)",
    );

    if (!element || desktop.matches) {
      setDrawerOpen(false);
      return undefined;
    }

    if (!element.open) {
      element.showModal();
    }

    document.body.style.overflow = "hidden";

    function resize() {
      if (desktop.matches) {
        setDrawerOpen(false);
      }
    }

    desktop.addEventListener(
      "change",
      resize,
    );

    return () => {
      desktop.removeEventListener(
        "change",
        resize,
      );

      if (element.open) {
        element.close();
      }

      document.body.style.overflow =
        previousOverflow;

      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus();
      }
    };
  }, [drawerOpen]);

  function closeMenus() {
    setActiveMenu(null);
    setDrawerOpen(false);
  }

  function remember(value) {
    const updated = [
      value,

      ...getRecentSearches().filter(
        (item) =>
          normalizeText(item) !==
          normalizeText(value),
      ),
    ].slice(0, MAX_RECENT_SEARCHES);

    setRecent(updated);

    try {
      localStorage.setItem(
        RECENT_SEARCH_KEY,
        JSON.stringify(updated),
      );
    } catch {
      // Search remains available without storage.
    }
  }

  function performSearch(value) {
    const clean = String(value ?? "")
      .trim()
      .slice(0, 120);

    setSearch(clean);
    closeMenus();

    if (clean) {
      remember(clean);
    }

    navigate(
      clean
        ? `/shop?${new URLSearchParams({
            search: clean,
          }).toString()}`
        : "/shop",
    );
  }

  function clearSearch() {
    setSearch("");

    if (location.pathname === "/shop") {
      const params = new URLSearchParams(
        location.search,
      );

      params.delete("search");

      navigate(
        {
          pathname: "/shop",

          search: params.size
            ? `?${params}`
            : "",
        },
        {
          replace: true,
        },
      );
    }
  }

  function clearHistory() {
    setRecent([]);

    try {
      localStorage.removeItem(
        RECENT_SEARCH_KEY,
      );
    } catch {
      // Ignore unavailable storage.
    }
  }

  function openDrawer(groupId = null) {
    setActiveMenu(null);
    setMobileGroup(groupId);
    setDrawerOpen(true);
    setAuthError("");
  }

  async function handleLogout() {
    setLoggingOut(true);
    setAuthError("");

    try {
      await logout();

      closeMenus();
      navigate("/");
    } catch {
      setAuthError(
        "Could not sign out. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header
      ref={header}
      className={`gd-nav${
        raised ? " gn-raised" : ""
      }`}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          setActiveMenu(null);
        }
      }}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget,
          )
        ) {
          setActiveMenu(null);
        }
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          activeMenu
        ) {
          const target =
            triggers.current[activeMenu];

          setActiveMenu(null);
          target?.focus();
        }
      }}
    >
      <div className="gn-bar">
        <button
          type="button"
          className="gn-menu-toggle gn-icon-button"
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls={`${menuId}-drawer`}
          onClick={() => openDrawer()}
        >
          <Icon name="menu" />
        </button>

        <Link
          to="/"
          className="gn-brand"
          aria-label="GymDrobe home"
          onClick={closeMenus}
        >
          <Brand />
        </Link>

        <nav
          className="gn-desktop"
          aria-label="Main categories"
        >
          <Link to="/shop" className="gn-trigger" onClick={closeMenus}>SHOP ALL</Link>
          {navigationGroups.map((group) => (
            <Link
              to={shopPath({
                department: group.id,
              })}
              key={group.id}
              ref={(node) => {
                triggers.current[group.id] =
                  node;
              }}
              id={`${menuId}-trigger-${group.id}`}
              className="gn-trigger"
              aria-expanded={
                activeMenu === group.id
              }
              aria-controls={
                activeMenu === group.id
                  ? `${menuId}-mega`
                  : undefined
              }
              onPointerEnter={(event) => {
                if (
                  event.pointerType === "mouse"
                ) {
                  setActiveMenu(group.id);
                }
              }}
              onClick={closeMenus}
              onKeyDown={(event) => {
                if (
                  event.key === "ArrowDown"
                ) {
                  event.preventDefault();
                  setActiveMenu(group.id);

                  requestAnimationFrame(() => {
                    document
                      .getElementById(
                        `${menuId}-mega`,
                      )
                      ?.querySelector("a")
                      ?.focus();
                  });
                }
              }}
            >
              {group.label}
            </Link>
          ))}

          <Link
            className="gn-offers"
            to="/offers"
            onPointerEnter={() =>
              setActiveMenu(null)
            }
            onClick={closeMenus}
          >
            OFFERS

          </Link>
        </nav>

        <SearchBox
          value={search}
          onChange={setSearch}
          onSubmit={performSearch}
          onRemember={remember}
          recent={recent}
          onClearHistory={clearHistory}
          onClear={clearSearch}
          routeKey={location.key}
          onOpen={() =>
            setActiveMenu(null)
          }
          onPick={(product) => {
            closeMenus();

            navigate(
              `/product/${encodeURIComponent(
                product.id,
              )}`,
            );
          }}
        />

        <div className="gn-actions">
          <div
            className="gn-profile-wrap"
            onPointerEnter={(event) => {
              if (
                event.pointerType === "mouse" &&
                window.matchMedia(
                  "(min-width: 1280px)",
                ).matches
              ) {
                setActiveMenu("profile");
              }
            }}
          >
            <Link
              className="gn-action"
              ref={(node) => {
                triggers.current.profile =
                  node;
              }}
              to={
                signedIn
                  ? "/account"
                  : loginHref
              }
              aria-label={
                authLoading
                  ? "Account"
                  : signedIn
                    ? "My account"
                    : "Sign in"
              }
              aria-expanded={
                activeMenu === "profile"
              }
              aria-controls={
                activeMenu === "profile"
                  ? `${menuId}-profile`
                  : undefined
              }
              onClick={closeMenus}
              onKeyDown={(event) => {
                if (
                  event.key === "ArrowDown" &&
                  window.matchMedia(
                    "(min-width: 1280px)",
                  ).matches
                ) {
                  event.preventDefault();
                  setActiveMenu("profile");

                  requestAnimationFrame(() => {
                    document
                      .getElementById(
                        `${menuId}-profile`,
                      )
                      ?.querySelector("a")
                      ?.focus();
                  });
                }
              }}
            >
              <Icon name="user" />

              <span className="gn-action-label">
                Profile
              </span>
            </Link>

            {activeMenu === "profile" && (
              <div
                className="gn-profile-menu"
                id={`${menuId}-profile`}
              >
                <strong>
                  {authLoading
                    ? "Checking account…"
                    : signedIn
                      ? `Hello, ${
                          firstName || "there"
                        }`
                      : "Welcome"}
                </strong>

                <p>
                  {authLoading
                    ? "Restoring your GymDrobe session."
                    : signedIn
                      ? "Access your account and manage orders"
                      : "Sign in to manage your account and orders"}
                </p>

                {authLoading ? (
                  <span
                    className="gn-login-link"
                    aria-live="polite"
                  >
                    CHECKING ACCOUNT…
                  </span>
                ) : (
                  <Link
                    className="gn-login-link"
                    to={
                      signedIn
                        ? "/account"
                        : loginHref
                    }
                    onClick={closeMenus}
                  >
                    {signedIn
                      ? "MY ACCOUNT"
                      : "LOGIN / SIGNUP"}
                  </Link>
                )}

                <nav aria-label="Profile links">
                  {signedIn && (
                    <Link
                      to="/orders"
                      onClick={closeMenus}
                    >
                      Orders
                    </Link>
                  )}

                  <Link
                    to="/wishlist"
                    onClick={closeMenus}
                  >
                    Wishlist
                  </Link>

                  {signedIn && (
                    <Link
                      to="/addresses"
                      onClick={closeMenus}
                    >
                      Saved addresses
                    </Link>
                  )}

                  {signedIn &&
                    user?.role === "admin" && (
                      <>
                        <Link
                          to="/admin/orders"
                          onClick={closeMenus}
                        >
                          Admin orders
                        </Link>

                        <Link
                          to="/admin/products"
                          onClick={closeMenus}
                        >
                          Admin products
                        </Link>

                        <Link
                          to="/admin/returns"
                          onClick={closeMenus}
                        >
                          Admin returns
                        </Link>
                      </>
                    )}
                </nav>

                {signedIn && (
                  <>
                    <button
                      type="button"
                      className="gn-logout"
                      disabled={loggingOut}
                      onClick={handleLogout}
                    >
                      {loggingOut
                        ? "Signing out…"
                        : "Logout"}
                    </button>

                    {authError && (
                      <p
                        className="gn-auth-error"
                        role="alert"
                      >
                        {authError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <Link
            className="gn-action"
            to="/wishlist"
            aria-label={`Wishlist, ${savedCount} saved items`}
            onPointerEnter={() =>
              setActiveMenu(null)
            }
            onClick={closeMenus}
          >
            <Icon name="heart" />

            <span className="gn-action-label">
              Wishlist
            </span>

            {savedCount > 0 && (
              <span
                key={savedCount}
                className="gn-badge"
                aria-hidden="true"
              >
                {savedCount > 99
                  ? "99+"
                  : savedCount}
              </span>
            )}
          </Link>

          <Link
            className="gn-action"
            to="/cart"
            aria-label={`Shopping bag, ${bagCount} items`}
            onPointerEnter={() =>
              setActiveMenu(null)
            }
            onClick={closeMenus}
          >
            <Icon name="bag" />

            <span className="gn-action-label">
              Bag
            </span>

            {bagCount > 0 && (
              <span
                key={bagCount}
                className="gn-badge"
                aria-hidden="true"
              >
                {bagCount > 99
                  ? "99+"
                  : bagCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {activeGroup && (
        <div
          className="gn-mega"
          id={`${menuId}-mega`}
          aria-labelledby={`${menuId}-trigger-${activeGroup.id}`}
          style={{
            "--gn-category-color":
              activeGroup.accent,
          }}
        >
          <div className="gn-mega-inner">
            {activeGroup.columns.map(
              (column) => (
                <div
                  className="gn-menu-column"
                  key={column.title}
                >
                  <h3>{column.title}</h3>

                  <ul>
                    {column.links.map(
                      (link) => (
                        <li key={link.label}>
                          <Link
                            to={shopPath(link)}
                            onClick={closeMenus}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ),
            )}

            <div className="gn-promo">
              <span>
                THE GYMDROBE EDIT
              </span>

              <strong>
                Everything for
                <br />
                every workout.
              </strong>

              <Link
                to="/shop"
                onClick={closeMenus}
              >
                SHOP ALL{" "}
                <Icon
                  name="arrow"
                  size={18}
                />
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav
        className="gn-quick-nav"
        aria-label="Quick categories"
      >
        <Link
          to="/shop"
          onClick={closeMenus}
        >
          ALL GEAR
        </Link>

        {navigationGroups.map((group) => (
          <Link
            key={group.id}
            to={shopPath({
              department: group.id,
            })}
            onClick={closeMenus}
          >
            {group.label}
          </Link>
        ))}

        <Link
          to="/offers"
          onClick={closeMenus}
        >
          OFFERS
        </Link>
      </nav>

      <dialog
        className="gn-drawer"
        ref={dialog}
        id={`${menuId}-drawer`}
        aria-labelledby={`${menuId}-drawer-title`}
        onCancel={(event) => {
          event.preventDefault();
          setDrawerOpen(false);
        }}
        onClick={(event) => {
          if (
            event.target !==
            event.currentTarget
          ) {
            return;
          }

          const rect =
            event.currentTarget
              .getBoundingClientRect();

          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          ) {
            setDrawerOpen(false);
          }
        }}
      >
        <div className="gn-drawer-top">
          <h2
            id={`${menuId}-drawer-title`}
            className="gn-drawer-title"
          >
            Explore GymDrobe
          </h2>

          <button
            type="button"
            className="gn-icon-button"
            aria-label="Close menu"
            onClick={() =>
              setDrawerOpen(false)
            }
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="gn-welcome">
          <strong>
            {authLoading
              ? "Checking your account…"
              : signedIn
                ? `Hi, ${
                    firstName || "there"
                  }.`
                : "Your next workout starts here."}
          </strong>

          <p>
            {authLoading
              ? "Restoring your GymDrobe session."
              : signedIn
                ? "Your account, saved gear and order details."
                : "Explore the collection and find your next training favourite."}
          </p>

          <div className="gn-welcome-links">
            {authLoading ? (
              <span aria-live="polite">
                Checking account…
              </span>
            ) : signedIn ? (
              <Link
                to="/account"
                onClick={closeMenus}
              >
                My account
              </Link>
            ) : (
              <>
                <Link
                  to={loginHref}
                  onClick={closeMenus}
                >
                  Sign in
                </Link>

                <Link
                  to={signupHref}
                  onClick={closeMenus}
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>

        <nav aria-label="Mobile categories">
          {navigationGroups.map((group) => (
            <div
              className="gn-mobile-group"
              key={group.id}
            >
              <button
                type="button"
                className="gn-mobile-trigger"
                aria-expanded={
                  mobileGroup === group.id
                }
                aria-controls={`${menuId}-mobile-${group.id}`}
                onClick={() =>
                  setMobileGroup((value) =>
                    value === group.id
                      ? null
                      : group.id,
                  )
                }
              >
                {group.label}

                <span aria-hidden="true">
                  {mobileGroup === group.id
                    ? "−"
                    : "+"}
                </span>
              </button>

              <div
                id={`${menuId}-mobile-${group.id}`}
                className="gn-mobile-panel"
                hidden={
                  mobileGroup !== group.id
                }
              >
                {group.columns.map(
                  (column) => (
                    <div key={column.title}>
                      <h3>{column.title}</h3>

                      {column.links.map(
                        (link) => (
                          <Link
                            key={link.label}
                            to={shopPath(link)}
                            onClick={closeMenus}
                          >
                            {link.label}
                          </Link>
                        ),
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>

        <nav
          className="gn-drawer-links"
          aria-label="Mobile shopping links"
        >
          <Link
            to="/shop"
            onClick={closeMenus}
          >
            All products{" "}
            <Icon
              name="arrow"
              size={17}
            />
          </Link>

          <Link
            to="/offers"
            onClick={closeMenus}
          >
            Offers
          </Link>

          <Link
            to="/wishlist"
            onClick={closeMenus}
          >
            Wishlist{" "}
            <span>{savedCount}</span>
          </Link>

          <Link
            to="/cart"
            onClick={closeMenus}
          >
            Shopping bag{" "}
            <span>{bagCount}</span>
          </Link>
        </nav>

        {signedIn && (
          <nav
            className="gn-drawer-links"
            aria-label="Mobile account links"
          >
            <Link
              to="/orders"
              onClick={closeMenus}
            >
              My orders
            </Link>

            <Link
              to="/addresses"
              onClick={closeMenus}
            >
              Saved addresses
            </Link>

            {user?.role === "admin" && (
              <>
                <Link
                  to="/admin/orders"
                  onClick={closeMenus}
                >
                  Admin orders
                </Link>

                <Link
                  to="/admin/products"
                  onClick={closeMenus}
                >
                  Admin products
                </Link>

                <Link
                  to="/admin/returns"
                  onClick={closeMenus}
                >
                  Admin returns
                </Link>
              </>
            )}

            <button
              type="button"
              className="gn-logout"
              disabled={loggingOut}
              onClick={handleLogout}
            >
              {loggingOut
                ? "Signing out…"
                : "Sign out"}
            </button>

            {authError && (
              <p
                className="gn-auth-error"
                role="alert"
              >
                {authError}
              </p>
            )}
          </nav>
        )}
      </dialog>
    </header>
  );
}