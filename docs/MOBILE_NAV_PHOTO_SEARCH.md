# Shared mobile navigation and photo search

The existing React/Vite/Capacitor 8.6 app is retained. One shared navigation component serves mobile web, installed PWA and native iOS/Android: Home, Categories, Wishlist, Cart, Account. The cart count comes directly from StoreContext quantities. Routes retain their existing guest/authentication rules; account links already provide orders/tracking, addresses, profile and support. Desktop navigation is unchanged.

The bar uses 55 px-tall targets, equal columns, brand-colour active indicators and a single bottom-safe-area owner. The mobile header hides duplicate account/wishlist/cart/menu controls; search stays visible. Purchase controls sit above the bar. Footer padding, guide launcher and toast offsets reserve space. Native keyboard events and the web VisualViewport hide the bar/purchase overlay while editing; physical phones must verify keyboard/toolbar/inset behaviour. Existing back/deep-link routing is preserved. Desktop photo search uses the same header button and sheet.

Photo selection, image processing and camera code are loaded only after opening the sheet. Web uses capture/gallery file inputs; native uses the official Capacitor Camera plugin only after a tap, with a gallery/file-picker fallback, data URLs and no save-to-gallery. Crop, replace, remove, preview, loading, cancel, retry, unsupported/oversized inputs, unavailable status, no-match results and text-search fallback are included. The modal uses the existing accessible dialog/focus handling. Results reuse real ProductCard components; the production app has no fake-result fallback.

## Integration

Deploy the paired backend implementation and follow its `docs/VISUAL_SEARCH.md`. The frontend uses the existing `VITE_API_URL`; no provider key belongs in the frontend. Backend `VISUAL_SEARCH_ENABLED`, `VISUAL_SEARCH_MODEL_DIR`, `VISUAL_SEARCH_CATALOGUE_ORIGIN`, `VISUAL_SEARCH_IMAGE_HOSTS` and `VISUAL_SEARCH_THRESHOLD` configure local inference and indexing. Model weights and a completed catalogue index are required. Until configured, the UI honestly disables search submission and offers text search.

Run `npm ci --ignore-scripts`, `npm test`, then a normal `npm run build` using the existing site/API environment. Regenerate native projects with `npm run android:sync` and `npm run ios:sync`; the shared default native-plugin list includes Camera even with push disabled. Updated iOS permission descriptions explain product-photo search. App binaries must be rebuilt/released to receive native plugin changes; updating the website alone will not install a plugin in an existing app.

## Required release review

- iPhone Safari and Android Chrome: 320–480 px, landscape, keyboard, browser toolbars, notch/home indicator, field scrolling, file chooser cancellation/denial and HEIC fallback.
- Signed physical apps: camera/gallery denial/retry, limited-photo access, Android activity restoration, no unexpected gallery save, and native system navigation/safe areas.
- Cart badge changes immediately on add/remove/quantity changes; active tab survives deep links, refresh and browser back.
- Product Add to Cart/Buy Now, checkout forms/actions, footer, consent and guide must remain reachable.
- Staging visual search: real model/index, stock/price changes, archived products, new/changed variant images, relevance threshold, empty/error/slow cases. Cropped catalogue tests do not establish camera-photo accuracy.

No production deployment, App Store/Play Store submission, paid provider setup or customer-photo processing is part of this review branch.

## Free release

Photo search is deferred because the existing free API cannot run the measured model memory footprint. `VITE_PHOTO_SEARCH_ENABLED` defaults off: the shared button returns no UI and registers no camera-restoration listener. Do not set it to `true` in website, Android or iPhone builds until a working backend and catalogue index are available. Text search and all five navigation tabs remain enabled. The retained opt-in browser flow is tested using explicit test-only environment configuration. No paid resources are required or provisioned for this release.
