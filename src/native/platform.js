import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

// App links select a page, never a credential, payment result or arbitrary URL.
export function nativeRouteFromUrl(value) {
  try {
    if (typeof value !== "string" || value.length > 16000) return null;
    // Normalize app links to HTTPS before applying the shared origin/path checks.
    const custom = /^gymdrobe:\/\/app(?:[/?#]|$)/i.test(value);
    const source = custom ? value.replace(/^gymdrobe:\/\/app/i, "https://gymdrobe.com") : value;
    const url = new URL(source);
    const website = url.protocol === "https:" && ["gymdrobe.com", "www.gymdrobe.com"].includes(url.hostname) && !url.port;
    if (!website || url.username || url.password || /%2f|%5c|\\/i.test(url.pathname)) return null;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!/^\/(?:shop|product\/[^/]+|kits(?:\/[^/]+)?|cart|wishlist|orders(?:\/[^/]+(?:\/track)?)?|account(?:\/security)?|addresses|login|offers|help|install)?$/.test(path)) return null;
    if (path !== "/shop") return path;
    const query = new URLSearchParams();
    for (const key of ["search", "category", "sort", "page"]) {
      if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key).slice(0, 200));
    }
    return path + (query.size ? `?${query}` : "");
  } catch {
    return null;
  }
}

export function nativeRouteFromEvent(event) {
  try {
    const data = typeof event === "string" && event.length < 16000 ? JSON.parse(event) : event;
    return nativeRouteFromUrl(data?.url);
  } catch {
    return null;
  }
}
