# GymDrobe 1.2 feature coverage

This package is an expanded, working **frontend preview** of a single-store ecommerce site. It does not claim to include every possible marketplace feature or a production commerce backend.

## Working customer features

| Area | Included |
|---|---|
| Homepage | Campaign slider with pause/reduced-motion handling, category grid, genuine catalogue offers, restored collection tabs/sort/pagination, featured/bestseller/new rows, recently viewed and clear history |
| Navigation/search | Responsive menus, keyboard suggestions, multi-word search, recent searches, category links, profile, wishlist and bag counts |
| Catalogue | Multiple categories, subcategory, gender, brand, size, colour, stock, price, rating and discount filters; option counts; URL state; sorting; pagination; mobile filter dialog |
| Product cards | Wishlist, real review totals, alternate-photo hover, quick view, comparison, stock labels and image fallbacks |
| Product detail | Gallery, enlargement and photo navigation, stock-aware options, quantity, add to bag, Buy now, complete specifications/highlights/care/box contents, share, related products and recently viewed |
| Photo try-on | Photo/camera input, consent, FASHN API adapter, job progress, original/result comparison, download, removal and unavailable/error states; requires credentials and approved reference photos |
| Measurement-based sizing | Supplier body ranges, cm/inches, all-measurement matching, availability and apply-size action; requires verified supplier measurements |
| Fit guidance | Available size labels, supplied fit, measurement instructions, optional supplier chart rendering; no invented measurements |
| Reviews | Submission, real rating distribution, newest/highest/lowest sort, star filtering, local helpful vote, edit/delete own newly created reviews |
| Comparison | Up to four products, side-by-side price/material/fit/options/stock/ratings/returns, remove and continue shopping |
| Wishlist | Persistence, search, sorting, availability filtering and quick view |
| Product watches | Saved baseline price and stock; local price-drop/back-in-stock updates when the catalogue changes |
| Bag | Variant-safe quantities, remove, move to wishlist, saved for later, bulk select/remove/save, edit size/colour with aggregate stock validation, pincode, MRP savings, coupons and free-delivery progress |
| Saved for later | Preserved variants and quantities; move to bag after availability validation; remove or choose other options |
| Offers | Real configured coupon minimums/discounts; copy code, select coupon and qualification feedback |
| Checkout | Guest/account, saved addresses, validation, auto-saved drafts, standard/express, gift message, delivery note, review, COD preview, selected items or Buy now, changed-total review, repeat-attempt protection |
| Inventory | Device-local reservation ledger for new preview orders; exact variant deduction; cancellation releases reserved quantities |
| Account | Signup, password login, logout, per-account shopping lists, guest-list import, profile editing, address CRUD/defaults, password change and customer-scoped data export |
| Orders | Search/status/date filters, snapshots, details, recorded tracking, cancellation, Buy again with unavailable-item feedback, printable/PDF receipt and CSV download |
| Returns/exchanges | Known delivery-date window, item/quantity selection, replacement variant validation, reason, request status and store response |
| Help/support | Searchable FAQs, product/order-linked requests, customer and store-preview replies, open/answered/resolved states |
| Usability | Mobile layouts, keyboard access/focus, modal focus management, reduced motion, image/empty/error/loading states |

## Development store console

Available only under `npm run dev` at `/dev/store`. Excluded from production routes and JavaScript chunks.

| Area | Included |
|---|---|
| Overview | Catalogue/order counts, requests awaiting review, open support and low-stock products |
| Products | Add a basic product; edit price, discount, category, description, image URL and collection flags |
| Inventory | Available quantity editing for each existing variant; reservation-aware updates; mark unavailable |
| Orders | View/export records; valid status transitions; manually record carrier/tracking; no automatic paid status |
| Returns | Review and approve/decline requests with a response; no automatic refund, exchange fulfilment or stock restoration |
| Support | Reply and resolve local customer requests |
| Coupons | Display existing rules; edit rules in the shared source file |

## Requires backend or provider integration

These are **not implemented as live services** by this frontend:

| Capability | Required next work |
|---|---|
| Production accounts/admin | Server authentication and authorization, verified email/OTP, password recovery, secure sessions and admin roles |
| Shared data | Database, APIs, multi-device cart/wishlist/orders, backups, access control and migration |
| Online payments | Payment provider, server-created orders, signed webhook verification, idempotency and reconciliation; no card/CVV/UPI credential form is included |
| Stock/pricing | Authoritative server calculations and atomic reservation/commit/release across shoppers |
| Shipping | Pincode serviceability, carrier rates/ETAs, booking, labels and signed tracking updates |
| Refunds/exchanges | Provider refunds, reverse pickup, inspection, partial refund calculations, exchange dispatch and audited stock movements |
| Notifications | Transactional email/SMS, optional push permissions/provider, stock alerts, newsletter and unsubscribe handling |
| Reviews/support | Shared storage, purchase verification, review moderation, support permissions and real support delivery |
| Business policies/invoices | Your final business contact details, shipping/return terms, privacy/terms, tax configuration and legally appropriate invoices |
| Marketing | Configurable promotions, gift cards, loyalty/referrals, abandoned-checkout messaging, consent-aware analytics and SEO deployment |
| Marketplace/dropshipping | Seller onboarding, supplier inventory/order sync, commissions, payouts and seller-specific policies; separate from this single-store preview |

A pincode format check is not a delivery promise. A saved preview order is not a payment. A recorded support ticket is not an email. A printed receipt is not a tax invoice.

## Files and installation

Extract the whole ZIP into a new folder. Copy the original images into `src/assets` without changing their names. Run `npm ci` then `npm run dev`. This update includes all files together; do not mix individual new pages with the old contexts.

Your six catalogue products and three coupon codes are retained. Product photo files were not supplied, so copy them from your current project. Category tiles for empty categories remain coming soon. A supplier measurement chart can be added as `sizeChart: { unit, columns, rows, caption }` on a product.

## Verification for version 1.2

- Production build and local-import checks pass.
- 44 logic tests pass, including checkout persistence failure, duplicate attempts, last-unit competition, account shopping imports, pricing, stock, variants, coupons, return rules and filtering.
- 12 browser scenario groups pass without JavaScript page errors. The exact scenario names are recorded in `test-results/browser-report.json`.
- Eleven customer routes were checked at 320, 390, 768 and 1440 pixels for horizontal overflow. Desktop and mobile screenshots are included.
- Browser checks ran in headless Chromium on Linux. The Windows launcher was reviewed, not run on Windows. No live payments, notifications or courier calls were tested.

See `README.md` for commands to repeat the logic and browser tests.

Try-on activation and exact limits are described in `TRY-ON-SETUP.md`. Live photorealism and physical fit were not validated with this code.

The fitting room passed 9 additional browser scenarios with a mock provider, including consent, photo removal, private output, exact-colour gating, supplier matching, size application, failures, cancellation and responsive dialogs.