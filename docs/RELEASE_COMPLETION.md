# GymDrobe task tracker — 5 November 2026

₹0 additional services. Tested frontend source29e668e, production mergef00f4560. Production backendda509135. The table separates implementation evidence from real provider and physical-device acceptance.

| Priority | Task | Status | Evidence | Dependency | Next action |
|---|---|---|---|---|---|
| P0 | CI, Android shell and public PWA cache | Merged/deployed PR35; current candidate also passes | Current web41975539273; Android41975539267; exact cache allowlist/private API tests | None for released fix | Preserve historical comparison limitations and earlier failed attempt |
| P0 | API cache and dependency security | Merged/deployed PR9/PR10 | 112/113 tests; Render deploydep-dblr7ghsrm7s7386v1mg; read-only health/private401 no-store | None for released fix | Monitor through existing resources |
| P0 | Login/session recovery | Implemented; browser/emulator pass; merged/deployed PR26 (f00f4560) | TOKEN_KEY/native storage/stale-read/reconnect fixes; current full web run | Real Google authorization and physical phones | Owner verifies sign-in/cancel/reopen/switch/logout with isolated accounts |
| P0 | Account/nav/cart/checkout UI | Preserved; fixture matrix passes; merged/deployed PR26 (f00f4560) | Eight required widths in Chromium/WebKit; 98 storefront and22 Account checks | Physical keyboard/safe-area acceptance | Install supplied development APK and test mobile website |
| P0 | Google branding and product metadata | Approved branding PR34/PR36 deployed; crawler metadata merged/deployed PR26 (f00f4560) | HTTP image/type/dimension/redirect checks;50 product/alias documents | Authorized Search Console property | Owner tests live homepage and requests indexing; Google controls appearance |
| P0 | Payment/order correctness | Prepared backend tests pass; provider acceptance blocked; PR6 draft | 167 tests plus disposable transaction/index/identity integrations | Isolated staging replica set/user/JWT/origin and Razorpay Test Mode pair/webhook | Configure privately, run staging preflight then success/failure/cancel/duplicate/retry/refund cases |
| P1 | Shared cart/wishlist | Implemented and isolated tests pass; disabled pending backend release | React plus actual paired JWT/API contract, guest journal/concurrent/offline/account tests | Staging/index/provider compatibility acceptance | Keep VITE_SHOPPING_SYNC_ENABLED off until paired release verified |
| P1 | Transactional push | UI/native bridge/backend tests prepared; delivery disabled | Actual paired API ownership tests and adapter cleanup/retries; optional native bridge compilation | APNs/FCM setup and physical receipt tests | Owner configures privately; verify opt-in/rotation/logout/deletion before sending |
| P1 | Apple secure login/deletion | Implemented and fixtures pass; provider/signing not accepted | Keychain/nonce/deletion/logout isolated checks; PR6 draft | Apple Team, OAuth, production-data/index compatibility, retention facts | Follow iOS setup; validate signed build/provider/device before enabling |
| P1 | Android test build | Current emulator acceptance passed | Source29e668e/run41975539267; supplied APK hash | Physical Android | Install/update compatible development signature; website does not replace bundled code |
| P1 | iPhone build | Current simulator and optional push compilation passed; unsigned artifact available | Run41975539376; app/UI runner compiled before simulator boot | Physical iPhone/Mac/signing/provider access and vendor privacy declaration | Owner validates supported SDK privacy declaration, signed archive and real device/provider flows before distribution |
| P0 | Five launch products and suppliers | Business facts missing; drafts prepared | Operations-Acceptance.md | Owner/suppliers: IDs, variant stock, identity/rights, costs, accepted terms | Complete evidence register; do not invent acceptance or margins |
| P0 | Dispatch/returns/refunds/policies | Draft inputs prepared, not published | Operations worksheet and unsigned terms outline | Owner/supplier decisions and professional review where needed | Approve operator/support/retention/dispatch/courier/cost payer/return responsibilities |
| P1 | Inventory/courier/routing/settlement | Software contracts prepared; live automation incomplete | Feed/routing/reporting requirements; collections separated from profit | Actual supplier/courier API/channel, commercial model, commissions and costs | Supply verified contracts before implementation/activation of outbound integrations |
| Deferred | Photo Search | Disabled | Local CLIP pipeline tested in isolation;345MB model plus runtime exceeds safe512MB host capacity | Existing-budget capacity, relevance, privacy and indexing acceptance | Leave unavailable; no paid upgrade or fabricated/random matches |
| Deferred | Virtual Try-On | Disabled/unconfigured | No production acceptance | Approved assets/provider/capacity/privacy/budget | Keep disabled |
| Deferred | Rewards/referrals/ads/stores | Deferred | No activation/spend/submission | Approved rules/economics, accounts and specific publication/spending instruction | No action in this release |

No real customer order, charge, refund, shipment or provider/customer/supplier message was used for testing. Staging tests and simulator/device tests are separate gates.

## Current release evidence

- Frontend PR26: https://github.com/favas5291-coder/gym-store/pull/26
- Production application merge: f00f4560e2898ca0bc44c07cca416f98c77aba6f; tested source29e668e7671bc57ae88cbd92ddf2a85d53ad2fc6.
- Successful production Vercel deployment: https://vercel.com/favaasz/gym-store/6CnL31Kkxj36bQ8LM7ePw7iFqu6e
- Current full web/PWA/Account/session/contract checks: https://github.com/favas5291-coder/gym-store/actions/runs/41975539273
- Current Android APK/emulator: https://github.com/favas5291-coder/gym-store/actions/runs/41975539267
- Current iPhone simulator/UI/push-bridge compile: https://github.com/favas5291-coder/gym-store/actions/runs/41975539376
- Current controlled performance comparison: https://github.com/favas5291-coder/gym-store/actions/runs/41975539278
- All262 frontend unit tests pass. Backend production dependency/API releases passed112/113 tests; prepared backend aggregate passed167 tests and disposable database/model checks but remains draft.
- Read-only live homepage/shop/Account/product-ID/product-slug HTTP checks passed; private pages have noindex headers and actual product photographs remain in sharing previews. Live public Chromium loaded25 catalogue records and an empty guest cart. No real authorization or transaction was performed.

Older PROJECT_STATUS reports and intermediate run IDs are historical. The final downloadable handover supplies screenshots, exact changed paths, configuration templates, test reports, development APK checksum and remaining external dependencies.

Operational worksheet: [OPERATIONS_ACCEPTANCE.md](OPERATIONS_ACCEPTANCE.md). iPhone setup: [IOS_APP.md](IOS_APP.md). Backend staging instructions remain in backend PR6; do not activate its unfinished features on production.
