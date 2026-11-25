// Store only navigation choices. Payment, login, invitations, and order-access
// URLs are never replayed. Protected pages still run their normal guards.
export function resumableRoute(path, role) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /[\\#]/.test(path)) return null;
  const url = new URL(path, "https://www.gymdrobe.com");
  let params = [];
  if (url.pathname === "/shop") {
    params = ["search","category","subcategory","gender","brand","size","color","colour","sort","page","minPrice","maxPrice","inStock"];
  } else if (/^\/product\/[a-z\d_-]+$/i.test(url.pathname)) {
    params = ["colour","size"];
  } else if (url.pathname === "/admin/products" && role === "admin") {
    const id = url.searchParams.get("editor");
    if (id === "new" || /^[a-f\d]{24}$/i.test(id || "")) params = ["editor"];
  } else if (role === "admin" && /^\/admin(?:\/(?:dashboard|orders|returns|customers|support|marketplace|suppliers|kits|packing-locations|shipping-profiles|shipping-settings|cart-addons|package-plans))?$/.test(url.pathname)) {
    params = [];
  } else if (role === "supplier" && /^\/supplier(?:\/(?:new|products|profile|orders|earnings|payouts|settings|products\/[a-f\d]{24}))?$/.test(url.pathname)) {
    params = [];
  } else if (!/^\/(?:categories|cart|wishlist|offers|collections\/[a-z\d-]+)$/.test(url.pathname)) return null;

  const query = new URLSearchParams();
  for (const key of params) {
    for (const value of url.searchParams.getAll(key).slice(0,8)) query.append(key,value.slice(0,200));
  }
  return url.pathname + (query.size ? "?" + query : "");
}

export function nativeResumeKey(user) {
  return "gymdrobe-native-resume:" + JSON.stringify([user?.id || user?._id || "guest",user?.role || "guest"]);
}
