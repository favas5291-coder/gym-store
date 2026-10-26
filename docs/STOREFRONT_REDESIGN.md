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

Results are updated after the review-branch checks finish. The earlier implementation run passed all 164 existing Node tests and compiled with Vite 8.3.5. That initial toolchain cache was reset between sessions; the final review workflow installs the repository lockfile from scratch.

The browser runner uses Chromium at 320, 390, 768 and 1440 px, a local Vite server, test-only catalog/order/address/quote fixtures and blocked third-party services. Screenshots therefore demonstrate the interface, not real orders, live inventory or successful payment. It checks discovery, colour imagery, balanced purchase controls, wishlist/cart persistence, guest address validation, COD totals, mobile menu/filter controls, order states, responsive overflow, keyboard focus and media preferences/fallbacks. Artifacts and its detailed report are produced under `test-results/storefront` and attached to the GitHub workflow.

Run:

```sh
npm ci
npm test
# Browser tooling is isolated from the application dependencies:
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run test:storefront
# Requires the real public storefront origin and complete product API:
VITE_SITE_URL=https://www.gymdrobe.com VITE_API_URL=https://YOUR_API_HOST/api npm run build
```

`GYMDROBE_PLAYWRIGHT_MODULE` and `GYMDROBE_CHROMIUM_PATH` can point to existing local browser tooling. The dedicated review workflow compiles with Vite and does not deploy. The normal build still requires the existing sitemap preflight to succeed against a complete real catalog.

## Production verification blockers

- No production frontend environment or reachable catalog API was supplied in this checkout. Full `npm run build` is blocked by its sitemap step until `VITE_SITE_URL` and `VITE_API_URL` identify the real environment. Do not ship a fixture sitemap or silently skip this production gate.
- No Razorpay test-mode credentials/backend, Google OAuth environment, authenticated live customer account or shipping-provider test environment is available. No live payment, refund, cancellation, address write or supplier action has been submitted.
- Approved in-stock product references are needed for the final 6–9 second campaign insert. The currently integrated insert is gym atmosphere.
- Core Web Vitals targets are LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. These are targets, not measured production results. Field INP and real-device/cellular measurements require the deployed site. Local/CI measurements, if recorded, must be labelled separately.
