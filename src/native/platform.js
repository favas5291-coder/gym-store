import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

// App links select a page, never a credential, payment result or arbitrary URL.
export function nativeRouteFromUrl(value) {
  try {
    const url = new URL(value);
    const website = url.protocol === "https:" && ["gymdrobe.com", "www.gymdrobe.com"].includes(url.hostname) && !url.port;
    const app = url.protocol === "gymdrobe:" && url.hostname === "app" && !url.port;
    if ((!website && !app) || url.username || url.password || /%2f|%5c|\\/i.test(url.pathname)) return null;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!/^\/(?:shop|product\/[^/]+|kits(?:\/[^/]+)?|cart|wishlist|orders(?:\/[^/]+(?:\/track)?)?|account(?:\/security)?|addresses|login|offers|help|install)?$/.test(path)) return null;
    const query = new URLSearchParams();
    if (path === "/shop") {
      for (const key of ["search", "category", "sort", "page"]) {
        if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key).slice(0, 200));
      }
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
