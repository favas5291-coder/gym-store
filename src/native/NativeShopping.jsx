import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { House, Grid2X2, Search, Heart, UserRound, ShoppingBag, ArrowUpRight } from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { SHOP_DEPARTMENTS, catalogOptions, productDepartment } from "../utils/catalog.js";
import { isNativeApp } from "./platform.js";

export function NativeShoppingNavigation() {
  const { cart, wishlist } = useStore();
  const { pathname } = useLocation();
  const [offline, setOffline] = useState(() => navigator.onLine === false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!isNativeApp() || /^\/(admin|supplier|dev)(\/|$)/.test(pathname)) return null;
  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const checkout = pathname === "/checkout";
  const tabs = [["/", "Home", House], ["/categories", "Categories", Grid2X2], ["/search", "Search", Search], ["/wishlist", "Wishlist", Heart], ["/account", "Account", UserRound]];
  return <>
    {offline && <div className="native-offline" role="status">You’re offline. Your saved bag is kept on this device. Reconnect to check stock or pay.</div>}
    {!checkout && <>
      <Link className="native-cart" to="/cart" aria-label={`Bag, ${count} items`}><ShoppingBag size={22}/>{count > 0 && <span>{count > 99 ? "99+" : count}</span>}</Link>
      <nav className="native-tabs" aria-label="App navigation">
        {tabs.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"}><Icon size={21} strokeWidth={1.65}/><span>{label}{label === "Wishlist" && wishlist.length > 0 ? ` (${wishlist.length})` : ""}</span></NavLink>)}
      </nav>
    </>}
  </>;
}

export function NativeCategoriesPage() {
  const { products, loading, error } = useCatalog();
  return <div className="page native-discover">
    <p className="eyebrow">FIND YOUR NEXT ESSENTIAL</p><h1>Shop by category</h1>
    {loading && <p role="status">Loading collections…</p>}
    {error && <p role="alert">Collections could not load. Check your connection and try again.</p>}
    {SHOP_DEPARTMENTS.map((department) => {
      const scoped = products.filter((product) => productDepartment(product) === department.id);
      if (!scoped.length) return null;
      return <section className="native-collection" key={department.id}>
        <Link to={`/shop?department=${department.id}`}><h2>{department.title}</h2><ArrowUpRight aria-hidden="true" size={24}/></Link>
        <div>{catalogOptions(scoped, "category").map((category) => <Link key={category} to={`/shop?${new URLSearchParams({ department: department.id, category })}`}>{category}</Link>)}</div>
      </section>;
    })}
    <Link className="button secondary" to="/shop">Explore all products</Link>
  </div>;
}

export function NativeSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return <div className="page native-discover"><p className="eyebrow">MADE FOR YOUR WORKOUT</p><h1>What’s in your next session?</h1>
    <form className="native-search-form" role="search" onSubmit={(event) => { event.preventDefault(); const term = query.trim(); if (term) navigate(`/shop?${new URLSearchParams({ search: term })}`); }}>
      <label className="sr-only" htmlFor="app-search">Search GymDrobe</label><input id="app-search" type="search" enterKeyHint="search" placeholder="Shoes, tees, shakers…" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200}/>
      <button type="submit" aria-label="Search products" disabled={!query.trim()}><Search size={24}/></button>
    </form>
    <Link className="text-link" to="/categories">Browse categories</Link>
  </div>;
}
