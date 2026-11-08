# GymDrobe — final website speed review (8 November 2026)

**Readiness: CONDITIONAL. No approval to declare the live site performance-ready.**

## Scope and source versions

- Frontend `main`: `51148f4d813291b52cd9c7dc083d086fdb445557` (merged speed PR #53, 7 Nov).
- Backend `main`: `e07fb781cfa4686e8945f3c52fcd9227df3c0e11` (deployed to Render 7 Nov).
- The candidate changes in [PR #55](https://github.com/favas5291-coder/gym-store/pull/55) are **draft only**. They are not proof of speed improvement or a production deployment.
- Live site `https://www.gymdrobe.com/` and production API could not be reached through the available external testing tools. **No real Indian mobile-network or live physical-device measurements were obtained.**
- Vercel reports a successful commit status for frontend `main`, but current production page bytes/commit SHA were not independently verified.

## Existing comparable lab evidence (7 Nov CI, PR #53)

Source: [Before and after performance audit, run 42383466862](https://github.com/favas5291-coder/gym-store/actions/runs/42383466862).

Lab setup: Chromium, identical local assets and mocked instantaneous APIs, three fresh-context samples per viewport/page; mobile 390×960 with 4× CPU slowdown, 150 ms round-trip time and 1.6 Mbps download. Results below are **median synthetic LCP**.

| Route / viewport | Previous code | Merged PR #53 code | Interpretation |
| --- | ---: | ---: | --- |
| Homepage / mobile 390px | 1820 ms | 1744 ms | 4.2% lower lab LCP |
| Shop / mobile 390px | 2516 ms | 2500 ms | 0.6% lower lab LCP; effectively at the 2.5s target |
| Homepage / desktop 1440px | 168 ms | 200 ms | 19% higher LCP in this lab run |
| Shop / desktop 1440px | 468 ms | 496 ms | 6% higher LCP in this lab run |

Earlier independent PR #53 run 42381729936 showed somewhat better desktop candidate samples, so the desktop effect is not reliably established. Mobile bytes moved only ~0.1–0.4%; the homepage's video response accounted for ~704 KB on mobile and ~1328 KB on desktop in the local lab. This is a byte-transfer target to investigate, **not** evidence the live hero must be removed.

## Hosting and backend

- Render service `gym-drobe-backend` is attached to `main` in **Oregon, USA** and last successfully deployed backend SHA `e07fb781` on 7 Nov 2026 at 12:03 UTC.
- Render's read-only metric query for 7–8 Nov returned **no HTTP request-count or latency samples**, and the request log query returned an empty set. CPU and memory samples were sparse. Do not infer a P95 response time or server incident from these gaps.
- Backend `/api/products` already uses `Product.find({isActive: true}).lean()`, a `Server-Timing` header for the product DB/review/serialization stages, and `Cache-Control: no-store`. It also loads all active products plus their reviews. Future catalogue growth may increase payload and query work; measure response bytes, collection size, timings and Atlas `explain` before changing response shape or caching.
- India-to-Oregon network latency is a plausible additional cost, not a measured number. No hosting migration should occur automatically.

## Candidate code and new tests (PR #55)

1. `src/components/ProductSection.jsx`: avoid eager `createSearchIndex(products)` during ordinary browsing and special collection searches; keep explicit normal-query search behavior.
2. `tests/performance-audit.mjs`: add matched-fixture lab samples for `/shop?search=training`, `/product/<fixture-id>`, `/cart` (empty), and `/login` (guest) in addition to home/shop.
3. New scenario timings are deliberately **not** measurements of signed-in account, customer payment, checkout, real API latency, live CDN delivery or physical devices.
4. Full CI comparison and browser acceptance must be checked before the PR may be merged. Revert or adjust if candidate timings regress or search behavior fails.

## Acceptance / remaining evidence

| Requested area | Evidence available | Status |
| --- | --- | --- |
| Homepage and shop lab LCP/CLS | Earlier successful comparable PR audit | Tested in lab, live not verified |
| Product/search/cart/login lab LCP | Expanded audit in PR #55 | Candidate CI pending |
| Real 4G/Indian geography | No authenticated public field/India measurements | Unverified |
| Browser cold/warm cache | Lab cold context only | Warm cache and real CDN unverified |
| LCP, INP and CLS p75 real users | No access to CrUX/Search Console real user dashboard | Unverified |
| Checkout payments and inventory | Out of scope for synthetic audit, safe flows only | Unverified |
| Render P95 API and Atlas query plans | No suitable telemetry returned | Unverified |
| Physical Android and iPhone | No physical device executed in this review | Unverified |
| Frontend current production SHA | GitHub Vercel commit status success only | Live SHA unverified |
| Admin/supplier authenticated pages | No safe test credentials in this audit | Unverified |

## Next safe steps

1. Review PR #55 after tests: lab comparison and storefront/search acceptance, especially mobile shop and search results. Keep the changes unmerged until approved.
2. Obtain current real production Lighthouse/PageSpeed Insights Mobile results for Home, Shop and one product page. Record URL, date, test location, network/cache and LCP breakdown. Do not treat Lighthouse as field INP.
3. Use a real India-region browser or consenting field RUM/CrUX to verify network effects. Collect Render `Server-Timing` from public catalogue (safe read-only), and cross-check Atlas `explain` before refactoring.
4. Audit hero asset network priority/compression/codec under a real throttled Indian connection; preserve the premium brand experience.
5. Execute test-account checkout and authorized sandbox payments separately before a commercial launch, not as a speed test.

**Budget:** ₹0 added spending. No customer data, payment, supplier transaction, production deployment, or region migration was changed by this audit.
