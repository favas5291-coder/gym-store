import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { House, Grid2X2, Search, Heart, UserRound, ShoppingBag, ArrowUpRight } from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { SHOP_DEPARTMENTS, catalogOptions, catalogProducts, productDepartment } from "../utils/catalog.js";
import { collectionPathForCategory } from "../utils/storefrontCollections.js";
import { isNativeApp } from "./platform.js";
import PhotoSearchButton from "../components/PhotoSearchButton.jsx";
import { createSearchIndex, searchCatalogue } from "../utils/smartSearch.js";

export function NativeShoppingNavigation() {
  const { cart } = useStore();
  const { pathname } = useLocation();
  const [offline, setOffline] = useState(() => navigator.onLine === false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const focused = document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
      const keyboard = Boolean(focused && viewport && window.innerHeight - viewport.height > 150);
      document.documentElement.classList.toggle('shopping-keyboard-open', keyboard);
      if (keyboard) requestAnimationFrame(() => document.activeElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    };
    viewport?.addEventListener('resize', update); document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    return () => { viewport?.removeEventListener('resize', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); document.documentElement.classList.remove('shopping-keyboard-open'); };
  }, []);
  if (/^\/(admin|supplier|dev)(\/|$)/.test(pathname)) return null;
  const count = cart.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
  const account = /^\/(account|orders|addresses|saved|notifications|help|support|track|login|register)(\/|$)/.test(pathname);
  const tabs = [["/", "Home", House], ["/categories", "Categories", Grid2X2], ["/wishlist", "Wishlist", Heart], ["/cart", "Cart", ShoppingBag], ["/account", "Account", UserRound]];
  return <>
    {isNativeApp() && offline && <div className="native-offline" role="status">You’re offline. Your saved bag is kept on this device. Reconnect to check stock or pay.</div>}
    <nav className="shopping-bottom-nav" aria-label="Shopping navigation">
      {tabs.map(([to, label, Icon]) => {
        const active = to === '/account' ? account : to === '/' ? pathname === '/' : pathname === to || (to === '/categories' && (pathname === '/shop' || pathname.startsWith('/collections/'))) || (to === '/cart' && pathname === '/checkout');
        return <Link key={to} to={to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} aria-label={label === 'Cart' ? `Cart, ${count} items` : label}><span className="shopping-tab-icon"><Icon size={22} strokeWidth={active ? 2 : 1.65} aria-hidden="true"/>{label === 'Cart' && count > 0 && <span className="shopping-cart-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}</span><span>{label}</span></Link>;
      })}
    </nav>
  </>;
}

export function NativeCategoriesPage() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const published = catalogProducts(products);
  const heading = useRef(null);
  return <div className="page native-discover">
    <h1 ref={heading} tabIndex={-1}>Shop by category</h1>
    {loading && <p role="status">Loading collections…</p>}
    {error && <div role="alert">
      <p>Couldn’t load the latest collections.</p>
      <button className="button secondary" type="button" onClick={() => {
        heading.current?.focus({ preventScroll: true });
        refreshProducts();
      }}>Retry loading collections</button>
    </div>}
    {!loading && !error && !published.length && <p role="status">No collections are available yet.</p>}
    {SHOP_DEPARTMENTS.map((department) => {
      const scoped = published.filter((product) => productDepartment(product) === department.id);
      if (!scoped.length) return null;
      return <section className="native-collection" key={department.id}>
        <Link to={`/shop?department=${department.id}`}><h2>{department.title}</h2><ArrowUpRight aria-hidden="true" size={24}/></Link>
        <div>{catalogOptions(scoped, "category").map((category) => <Link key={category} to={collectionPathForCategory(category) || `/shop?${new URLSearchParams({ department: department.id, category })}`}>{{ BAG: "Gym bags", SNEAKERS: "Sneakers", "Compression T-shirt": "Compression T-shirts" }[category] || category}</Link>)}</div>
      </section>;
    })}
    <Link className="button secondary" to="/shop">Explore all products</Link>
  </div>;
}

export function NativeSearchPage() {
  const navigate = useNavigate();
  const { products, loading, error, refreshProducts } = useCatalog();
  const [query, setQuery] = useState(() => {
    const draft = window.history.state?.gymdrobeDiscoveryQuery;
    return typeof draft === "string" ? draft.slice(0, 120) : "";
  });
  const [settled, setSettled] = useState(query.trim());
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [active, setActive] = useState(-1);
  const panel = useRef(null);
  const input = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 240);
    return () => clearTimeout(timer);
  }, [query]);
  const current = settled && settled === query.trim();
  const hasSettledQuery = Boolean(settled);
  const index = useMemo(() => hasSettledQuery ? createSearchIndex(products) : null, [products, hasSettledQuery]);
  const search = useMemo(
    () => current && index ? searchCatalogue(index, settled, { limit: 5 }) : null,
    [index, settled, current],
  );
  const options = [
    ...(search?.products || []).map((product) => ({
      label: product.name,
      detail: product.category,
      href: "/product/" + encodeURIComponent(String(product.id || product._id)),
    })),
    ...(search?.categories || []).slice(0, 3).map((category) => ({
      label: "Category: " + category,
      href: "/shop?" + new URLSearchParams({ category }),
    })),
  ];
  const expanded = Boolean(current && showSuggestions && options.length);
  const activeId = expanded && options[active] ? "native-smart-option-" + active : undefined;
  useEffect(() => {
    if (!activeId || !panel.current) return;
    const row = document.getElementById(activeId)?.getBoundingClientRect();
    const bounds = panel.current.getBoundingClientRect();
    if (!row) return;
    if (row.top < bounds.top) panel.current.scrollTop += row.top - bounds.top;
    else if (row.bottom > bounds.bottom) panel.current.scrollTop += row.bottom - bounds.bottom;
  }, [activeId]);

  function editQuery(next) {
    setQuery(next);
    setActive(-1);
    setShowSuggestions(true);
    try {
      // Keep the draft with this history entry across Back and refresh.
      window.history.replaceState({ ...window.history.state, gymdrobeDiscoveryQuery: next }, "");
    } catch {
      // Search still works in browsers that restrict history writes.
    }
  }

  function submit(term = query) {
    const clean = term.trim();
    if (clean) navigate("/shop?" + new URLSearchParams({ search: clean }));
  }
  return <div className="page native-discover">
    <h1>Search products</h1>
    <div onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
        setActive(-1);
        setShowSuggestions(false);
      }
    }}>
      <form className="native-search-form" role="search" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="sr-only" htmlFor="app-search">Search GymDrobe</label>
        <input ref={input} id="app-search" type="search" role="combobox" aria-expanded={expanded}
          aria-controls={expanded ? "native-smart-suggestions" : undefined} aria-autocomplete="list"
          aria-activedescendant={activeId} autoComplete="off"
          enterKeyHint="search" placeholder="Shoes, tees, shakers…" value={query}
          onChange={(event) => editQuery(event.target.value)} maxLength={120}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (["ArrowDown", "ArrowUp"].includes(event.key) && options.length) {
              event.preventDefault();
              setShowSuggestions(true);
              if (event.key === "ArrowDown") setActive((active + 1) % options.length);
              else setActive(active <= 0 ? options.length - 1 : active - 1);
            } else if (event.key === "Enter" && activeId) {
              event.preventDefault();
              navigate(options[active].href);
            } else if (event.key === "Escape" && query && showSuggestions) {
              event.preventDefault();
              setShowSuggestions(false);
              setActive(-1);
            }
          }}
        />
        <PhotoSearchButton />
        <button type="submit" aria-label="Search products" disabled={!query.trim()}><Search size={24}/></button>
      </form>
      {current && showSuggestions && <div ref={panel} className="native-smart-panel">
        {search?.correctedQuery && <button type="button" onClick={() => submit(search.correctedQuery)}>
          Did you mean “{search.correctedQuery}”?
        </button>}
        {options.length > 0 && <ul id="native-smart-suggestions" role="listbox" aria-label="Matching products and categories">
          {options.map((option, index) => <li role="presentation" key={option.href}>
            <Link role="option" id={"native-smart-option-" + index} aria-selected={index === active} tabIndex={-1}
              to={option.href}>{option.label}{option.detail && <small>{option.detail}</small>}</Link>
          </li>)}
        </ul>}
        {options.length === 0 && (loading ? <p role="status">Loading products…</p> : error ?
          <div role="alert">
            <p>Couldn’t load the latest products.</p>
            <button type="button" onClick={() => {
              input.current?.focus({ preventScroll: true });
              refreshProducts();
            }}>Retry loading products</button>
          </div> : <p role="status">No product suggestions. You can still search the full shop.</p>)}
      </div>}
    </div>
    <Link className="text-link" to="/categories">Browse categories</Link>
  </div>;
}
