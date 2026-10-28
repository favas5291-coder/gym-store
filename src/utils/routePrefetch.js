// Prefetch only on deliberate customer intent. React Router's lazy imports
// share the same module-cache entry, so navigating never loads a duplicate.
// Avoid using customer data, API calls or speculative prefetch on slow links.
const routeImports = {
  shop: () => import("../pages/Shop.jsx"),
  product: () => import("../pages/ProductPage.jsx"),
  cart: () => import("../pages/CartPage.jsx"),
  checkout: () => import("../pages/CheckoutPage.jsx"),
  wishlist: () => import("../pages/WishlistPage.jsx"),
  account: () => import("../pages/AccountPage.jsx"),
  orders: () => import("../pages/OrdersPage.jsx"),
};
const warm = new Map();

export function routeForPath(pathname) {
  if (/^\/shop\/?$/.test(pathname)) return "shop";
  if (/^\/product\/[^/]+/.test(pathname)) return "product";
  if (/^\/cart\/?$/.test(pathname)) return "cart";
  if (/^\/checkout\/?$/.test(pathname)) return "checkout";
  if (/^\/wishlist\/?$/.test(pathname)) return "wishlist";
  if (/^\/account\/?$/.test(pathname)) return "account";
  if (/^\/orders\/?$/.test(pathname)) return "orders";
  return "";
}
export function prefetchRoute(pathname) {
  const key = routeForPath(pathname);
  if (!key) return null;
  if (navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || "")) return null;
  if (!warm.has(key)) {
    const promise = routeImports[key]().catch(() => {
      warm.delete(key); // Let the next navigation retry a transient failure.
    });
    warm.set(key, promise);
  }
  return warm.get(key);
}
export function installRoutePrefetch() {
  if (typeof window === "undefined") return () => {};
  let pending = 0;
  function onIntent(event) {
    const link = event.target?.closest?.("a[href]");
    if (!link || link.origin !== window.location.origin ||
        link.hasAttribute("download") || link.getAttribute("target") === "_blank") return;
    if (event.type === "pointerover" && event.pointerType !== "mouse") return;
    window.clearTimeout(pending);
    const pathname = link.pathname;
    pending = window.setTimeout(() => prefetchRoute(pathname), event.type === "pointerdown" ? 0 : 60);
  }
  for (const type of ["pointerover", "focusin", "pointerdown"]) document.addEventListener(type, onIntent, { passive: true });
  return () => {
    window.clearTimeout(pending);
    for (const type of ["pointerover", "focusin", "pointerdown"]) document.removeEventListener(type, onIntent);
  };
}
