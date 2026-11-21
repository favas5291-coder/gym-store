# Combined storefront review

The nine source drafts were integrated on main `fa8a928a40ac2766e5c4b48a73ef21bcb6e7d38a`. The tested application tree is `d7341717db0de4fdd3d17413b220fb7f85f85c58` at `6e03b2270c55b0d65bc446074ee5d88380393382`. The snapshot retains each source head as a Git parent. It preserves both supplier dispatch timing and admin settlement review in the shared shipment component.

## Mobile lab measurements

| Mobile route | LCP main → draft (ms) | Content ready main → draft (ms) | Draft JS + CSS gzip (bytes) | Gzip delta (bytes) | Median CLS main → draft |
|---|---:|---:|---:|---:|---:|
| Home | 2,008 → 2,068 | 1,487 → 1,501 | 199,480 | +250 | 0.000 → 0.000 |
| Shop | 2,844 → 2,780 | 2,240 → 2,140 | 201,827 | +251 | 0.000 → 0.000 |
| Cart with one item | 1,996 → 2,604 | 1,982 → 2,300 | 191,539 | +363 | 0.000 → 0.000 |

The startup scripts and styles referenced by HTML totaled 171,277 gzip bytes on main and 171,527 on the draft (+250). Route bytes include each unique local JavaScript and CSS file loaded on that page, gzipped individually. Content readiness is the first animation frame after the hero, first product card or first cart row appears.

Each median uses three cold visits in Chromium 153.0.8010.0 at 390 × 844 with 4× CPU slowdown, 150 ms latency and 1.6 Mbps download. The test uses local production-build assets, one synthetic cart item and instant mock APIs. Production CDN, backend response time, real-device INP and field percentiles need separate measurement.

The candidate missed a 2500 ms LCP goal on Shop and Cart. The first baseline test attempt timed out on a navigation and was discarded. The table uses the full repeat of all nine baseline samples. On Cart, the main LCP element was recommendation text. On the draft it was the first product image. With catalog delivery deliberately held, main moved the coupon from y=722 to 2083 px. After #80 the coupon moved from y=710 to 692 px. Sub-second timing differences across this sample remain sensitive to host load.

[Raw samples and source SHAs](results.json) · [Mobile cart screenshot](cart-mobile.png)

## Functional verification

The production build generated 58 route metadata pages and the PWA. The combined Node suite passed 289 of 289 tests. Chromium fixtures cover the owner queue, standard COD, overdue support, the daily report, the mobile cart, analytics consent across tabs, supplier dispatch timing, supplier settlement and courier remittance. The two finance fixtures use authenticated local Express routes and a disposable Mongo replica set. The other browser fixtures use synthetic API responses. A naming error between the owner queue and daily report was found in integration and corrected in #74.

## Reproduce the mobile comparison

Use Node 24 and install the Playwright version from the review workflow. Run on a machine with Chromium and free loopback ports 4384–4385. The same build settings and runner apply to both commits. On the main baseline, copy the runner into its tests directory from the integration branch.

```sh
npm ci --ignore-scripts
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
export VITE_SITE_URL=https://www.gymdrobe.com
export VITE_API_URL=https://gym-drobe-backend.onrender.com/api
export VITE_STANDARD_COD_ENABLED=true
export VITE_AUTOMATION_ENGINE_ENABLED=true
export VITE_DAILY_OPERATIONS_ENABLED=true
export VITE_MARKETPLACE_ENABLED=true
export VITE_SUPPLIER_DISPATCH_REVIEW_ENABLED=true
npm test
npm run build
node tests/automation-mobile-benchmark.mjs
```

Set `PERFORMANCE_OUTPUT` to a separate folder for each revision. Results include each cold sample, browser conditions, compressed entry files and the first screenshot for each route. A locally installed Chromium can be selected with `GYMDROBE_CHROMIUM_PATH`.
