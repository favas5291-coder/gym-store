# GymDrobe flagship storefront — 27 October 2026

## Implementation plan and outcome

1. Start from main `232fd9f`, retaining the latest cart add-ons and operational workflows. Completed on `feature/flagship-storefront`.
2. Replace the oversized cinematic overlay with an editorial opening: compact light navigation, a dedicated film panel, concise copy and visible shopping actions. Completed, with separate portrait framing on phones.
3. Build photographic discovery and distinct selections from the live catalog. Six primary categories plus the full directory remain accessible. Bestseller/trending/new-arrival headings follow saved flags; no popularity, reviews or inventory are invented.
4. Extend the neutral, charcoal and restrained terracotta system through shop/search/filter drawers, product galleries, wishlist, cart, checkout, login, account, addresses, order history, tracking, returns and support. Operations keep their existing routes and workflows. Admin shortcuts collapse on customer pages.
5. Replace weak campaign footage, attempt autoplay immediately and test the rendered experience. Completed with new Higgsfield landscape/portrait films, responsive posters, pause/retry/offscreen controls and reduced-motion/data-saver support.

The product page keeps colour-specific photos and stock validation, balances Add to Cart and Buy Now, and retains those same buttons in a mobile bottom bar after scrolling past them. Supporting details and review composition expand on demand. Checkout groups delivery and its quote feedback before payment; optional notes follow. Shipping copy defers to the actual checkout quote instead of displaying fixed legacy charges.

## Verification

- `npm test`: **195 passed, 0 failed**.
- `npm run test:storefront`: **69 passed, 0 failed**, Chromium 153.0.8010.0. Covered search, persistent filters/sorting, colour imagery, variant validation, quick add, wishlist, cart quantities, mobile purchase controls, guest address persistence, checkout validation, COD advance totals, saved-address editing, review-form access, account/order/tracking/return/support views, policy links and keyboard focus. No browser runtime exceptions.
- `npm run build`: **passed**, including the real catalog sitemap and Vite production build. Used `VITE_SITE_URL=https://www.gymdrobe.com` and `VITE_API_URL=https://gym-drobe-backend.onrender.com/api`; no sitemap bypass.
- Viewports checked: **320, 390, 768 and 1440 px**. No horizontal overflow in the tested routes.
- Actual H.264 playback advances without a click at phone and desktop widths; only the corresponding film is requested. Manual pause, offscreen pause, autoplay rejection/manual recovery, missing-video fallback, reduced motion and data saver passed.

Interaction tests use deterministic, test-only API fixtures and block external payments. Real catalog screenshots use the public Render API and existing product-image URLs via a local read-only relay because of workspace networking. They are not a live end-to-end payment test or production network measurement.

Machine-readable results: [build and tests](verification/flagship/build-and-tests.json), [browser checks](verification/flagship/browser.json), [performance samples](verification/flagship/performance.json).

## Performance: measurements versus targets

Three cold-context samples per viewport, local Vite production preview, headless Chromium on the Linux workspace. No CDN or HTTP compression configured; instant fixture APIs and external services blocked. Desktop: 1440 × 960, unthrottled. Mobile: 390 × 960, 4× CPU slowdown, 150 ms latency, 1.6 Mbps download / 0.75 Mbps upload. Normal motion with immediate muted autoplay.

| Metric | Target | Desktop measured | Mobile measured |
| --- | --- | --- | --- |
| LCP | ≤2.5 s | Median **0.236 s** (0.224–0.244 s) | Median **2.976 s** (2.868–3.216 s) |
| CLS | ≤0.1 | Maximum **0.0271** | Maximum **0.00017** |
| INP | ≤200 ms | Not measured | Not measured |

**The throttled mobile LCP target was not met in this lab.** CLS here is the sum of observed shifts in the measurement window, not a field percentile. Validate on the deployed CDN and physical devices, then use real-user measurements before claiming Core Web Vitals compliance. Do not substitute these numbers for production results.

## Screenshots

Homepage, shop and product screenshots use real catalog data. Checkout, account and tracking screenshots use clearly named test-only customer/order fixtures.

- [Desktop homepage](flagship-screenshots/home-1440-viewport.png) · [full page](flagship-screenshots/home-1440.png)
- [Mobile homepage](flagship-screenshots/home-390-viewport.png) · [full page](flagship-screenshots/home-390.png)
- [Tablet homepage](flagship-screenshots/home-768-viewport.png)
- [Desktop shop](flagship-screenshots/shop-1440.png) · [mobile shop](flagship-screenshots/shop-390.png)
- [Desktop product](flagship-screenshots/product-1440.png) · [mobile product](flagship-screenshots/product-390.png)
- [Desktop checkout](flagship-screenshots/checkout-desktop.png) · [mobile checkout](flagship-screenshots/checkout-mobile.png)
- [Cart](flagship-screenshots/cart-desktop.png) · [account](flagship-screenshots/account-390.png) · [tracking](flagship-screenshots/tracking-390.png)

## Media and remaining verification

See [campaign media, exact source links, four shot prompts and placement/export instructions](CINEMATIC_MEDIA.md). The current films are generated gym atmosphere, not actual merchandise demonstrations. A supplier-approved, exact-SKU product insert remains outstanding. The supplied 35.8-second presenter advertisement is retained as source material but not bundled into web delivery.

The following were not verified against real accounts/services: Google login, Razorpay test-mode authorization and payment completion, webhooks/refunds, supplier/admin mutations, Safari, and physical iOS/Android devices. No live payment or customer order was created. Existing backend API contracts and payment handlers were retained; the backend was not changed by this redesign.

## Release

Review this branch and its preview before merging into `main`. Merging and a successful production deployment are separate from implementation; this document does not claim that gymdrobe.com has changed. The frontend build requires both public Vite environment values shown above in the hosting environment. Backend secrets remain server-side.
