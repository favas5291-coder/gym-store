> Historical first redesign. See [the current flagship implementation and verification](FLAGSHIP_REDESIGN.md) for the latest design, screenshots and test results.

# GymDrobe cinematic storefront

## Implementation plan and scope

1. Inspect existing React/Vite routes, catalog providers, checkout, SEO and supplied assets.
2. Add a customer-only visual system: obsidian campaign sections, warm neutral shopping surfaces, platinum typography and one restrained copper interaction accent.
3. Replace the opening with responsive Higgsfield footage and matching posters, then connect category discovery, featured products, editorial content, available kits and verified reviews to existing data.
4. Carry the system through browsing, product details, wishlist, cart, checkout, authentication, account, addresses, orders, tracking, returns, help and static policy pages.
5. Exercise responsive layouts, commerce interactions and media failures; compile and run existing tests; document any production-only blockers.

## Behavior preserved

Routes and SEO modules, catalog APIs, variant and colour-image logic, prices and stock verification, review APIs, local cart/wishlist persistence, Google authentication, guest checkout, address persistence, shipping quotes, coupons, Razorpay, COD advance, order recovery, cancellation, returns and refunds retain their existing integrations. Admin and supplier workspaces are excluded from the new CSS scope. The source branch's existing gated supplier workspace commit is carried forward; this redesign does not enable it or replace its backend.

Only real catalog categories/products populate browsing. No generated merchandise is inserted into catalog data. Homepage kits disappear when the kit API has no supported offerings; verified review content is supplied by the existing review component. Empty and error states remain honest. Local preview fixtures are isolated under tests and are never production fallback data.

Product detail purchase buttons share equal width and height. Supporting product, delivery and return text is expandable. Checkout retains address, delivery choices, payment method, review and totals; payment logic is unchanged. There is no entry gate, scroll lock or animation dependency.

## Media

See [CINEMATIC_MEDIA.md](CINEMATIC_MEDIA.md) for the source masters, individual shot prompts, references, export settings and file placement. The exact merchandise insert remains outstanding. Sources remain separate from the compressed files shipped in `public/media/campaign`.

## Verification

The [final review workflow](https://github.com/favas5291-coder/gym-store/actions/runs/40448993240) passed on 27 October 2026 against source commit `acb5591392228e83eab3c00f89b7dcd4161374f8`. It installs the repository lockfile from scratch on Node 24. All **164 existing regression tests** and **68 storefront browser checks** pass, with no browser runtime exceptions. Production compilation with the pinned Vite 8.2.2 also passes (`npx --no-install vite build`, 589 ms). This is an application compilation, not a successful run of the full sitemap-gated `npm run build`. The earlier local cache used Vite 8.3.5; the clean CI result supersedes that toolchain check. No merge or deployment was performed.

The browser runner uses Chromium at 320, 390, 768 and 1440 px, a local Vite server, test-only catalog/order/address/quote fixtures and blocked third-party services. Screenshots therefore demonstrate the interface, not real orders, live inventory or successful payment. It checks discovery, colour imagery, balanced purchase controls, wishlist/cart persistence, guest address validation, saved address edits, COD totals, mobile menu/filter controls, order states, responsive overflow, keyboard focus and media preferences/fallbacks. The original obsolete `test:browser` runner is retained; use the new `test:storefront` command for this redesign. Artifacts and its detailed report are produced under `test-results/storefront` and attached to the GitHub workflow.

The browser pass caught and corrected a quick-add issue: a colour chosen on a product card now carries into the variant dialog. It also verifies autoplay rejection/manual recovery, media network failure, reduced motion, data saver, correct desktop/portrait selection, offscreen pause and persistent user pause. No Razorpay order creation or payment verification call is made by these tests.

### Measured lab performance

| Viewport | Median LCP | LCP range, three runs | Observed CLS |
| --- | --- | --- | --- |
| Mobile, 390 × 960 | 1.552 s | 1.524–1.552 s | 0.000149 |
| Desktop, 1440 × 960 | 0.156 s | 0.120–0.172 s | 0.001171 |

Conditions: headless Chromium 151.0.7922.34 on GitHub `ubuntu-latest`; Vite production preview on localhost without a CDN or configured compression; instant test API responses with external services blocked; three fresh browser contexts per viewport. Mobile used 4× CPU slowdown, 150 ms latency and 1.6 Mbps down / 0.75 Mbps up. Desktop was unthrottled. Default motion was enabled, with the film deferred by 1.4 seconds. The homepage conditionally preloads its responsive poster before React starts. CLS here is the sum of observed shifts during the measurement window. These are controlled lab samples, not deployed-site or field percentiles. INP was **not measured**.

Targets remain LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1. The measured LCP/CLS samples meet their respective targets under the stated conditions; real API latency, real customer devices and production delivery must still be measured. Raw evidence: [browser checks](verification/storefront-report.json), [performance samples](verification/performance.json), [build and CI summary](verification/build-results.json).

### Rendered screenshots

All screenshots use **test catalog and order data**. Homepage captures show the poster state with reduced motion enabled; normal playback and pause behavior were checked separately. Customer and order details are fixtures. The production site does not receive fixture fallback data.

| Experience | Desktop | Mobile |
| --- | --- | --- |
| Opening frame | [1440 px](screenshots/home-1440-viewport.png) | [390 px](screenshots/home-390-viewport.png) |
| Full homepage | [Desktop](screenshots/home-1440.png) | [Mobile](screenshots/home-390.png) |
| Shop and filters | [Desktop](screenshots/shop-1440.png) | [Mobile](screenshots/shop-390.png) |
| Product details | [Desktop](screenshots/product-1440.png) | [Mobile](screenshots/product-390.png) |
| Checkout | [Desktop](screenshots/checkout-desktop.png) | [Mobile](screenshots/checkout-mobile.png) |
| Cart / account | [Cart](screenshots/cart-desktop.png) | [Account](screenshots/account-390.png) |
| Orders / tracking | [Orders](screenshots/orders-1440.png) | [Tracking](screenshots/tracking-390.png) |

The full workflow artifact also contains address, confirmation, help, returns, login, empty, error and out-of-stock captures. Automated layout checks include 320 px phones and 768 px tablets in addition to the screenshots above.

Run:

```sh
npm ci
npm test
# Browser tooling is isolated from the application dependencies:
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run test:storefront
# Compile only; this does not run the full sitemap-gated build:
npx --no-install vite build
node tests/storefront-performance.mjs
# Requires the real public storefront origin and complete product API:
VITE_SITE_URL=https://www.gymdrobe.com VITE_API_URL=https://YOUR_API_HOST/api npm run build
```

`GYMDROBE_PLAYWRIGHT_MODULE` and `GYMDROBE_CHROMIUM_PATH` can point to existing local browser tooling. The dedicated review workflow compiles with Vite and does not deploy. The normal build still requires the existing sitemap preflight to succeed against a complete real catalog.

## Production verification blockers

- No production frontend environment or reachable catalog API was supplied in this checkout. Full `npm run build` is blocked by its sitemap step until `VITE_SITE_URL` and `VITE_API_URL` identify the real environment. Do not ship a fixture sitemap or silently skip this production gate.
- No Razorpay test-mode credentials/backend, Google OAuth environment, authenticated live customer account or shipping-provider test environment is available. No live payment, refund, cancellation, address write or supplier action has been submitted.
- Approved in-stock product references are needed for the final 6–9 second campaign insert. The currently integrated insert is gym atmosphere.
- Core Web Vitals targets are LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. These are targets, not measured production results. Field INP and real-device/cellular measurements require the deployed site. Local/CI measurements, if recorded, must be labelled separately.
