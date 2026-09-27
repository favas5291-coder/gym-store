# GymDrobe 1.2 — complete storefront source

A React storefront using GymDrobe branding and the white navigation, campaign banners, framed category cards and shopping layout in your Myntra reference screenshots. It includes the supplied six-product catalogue, three coupon codes, all route components, shared contexts, utilities and setup files.

**Start with `START-HERE.md`.** Extract the entire ZIP into a new folder, copy your original photos into `src/assets`, then double-click `Start-GymDrobe.cmd` on Windows. Or run the following in the folder containing `package.json`:

```sh
npm ci
npm run dev
```

Use Node.js 22.12 or newer. The entry is `src/main.js`; `index.html` provides the `app` root. Keep the included lockfile. The Windows launcher was reviewed but could not be executed on Windows in the Linux verification environment.

## New fitting room

Open a T-shirt or shoes product and choose **Try it on. Find your fit.** The complete photo-preview interface, FASHN server adapter and measurement-based size finder are included. Start both services with `npm run dev:tryon` or the Windows launcher.

**Read `TRY-ON-SETUP.md` to activate generation.** You must provide your own FASHN key/credits, approved reference photos per colour, and verified supplier body-size ranges. None were supplied, so the defaults show clear unavailable states. No fake generated image or invented fit recommendation is shown. This is an appearance preview plus separate measurement guidance, not a guarantee of physical fit.

The new tests use synthetic fixtures and a mock provider; no paid live generation or real fit validation was performed.

## Shopping fixes retained

- Bag, wishlist and related shopping lists are scoped to each preview account. Guest items transfer on sign-in once. Signing out no longer exposes the previous account's bag.
- Bag and wishlist updates synchronize between open tabs. Cart edits use current stored items and current catalogue stock.
- Checkout asks the customer to review a changed total. Buy now recovers from price or stock changes instead of repeatedly rejecting an outdated item.
- Checkout attempts have idempotency tokens. When supported, browser Web Locks serialize local order commits; the latest price and stock are checked before saving. Failed order persistence keeps the bag available.
- Individual category filters support multiple selections, removable chips and consistent search aliases such as “tee”.
- Add-to-bag feedback provides a direct link to the bag and checkout.
- Order, review and address views respond to updates from another tab.
- Narrow-screen wishlist controls wrap correctly. Quick-view buttons remain accessible on touch layouts and keyboard focus.
- Included illustrations keep missing-photo layouts usable, with visible labels. Actual product photos take precedence.
- The doctor catches missing imports and incomplete Vite installation before starting the site.

## Included customer flows

Home campaigns and categories; search and suggestions; filters, sorting and pagination; product gallery and quick view; size/colour selection and stock checks; wishlist; comparison; saved-for-later; product watches; bag variants and quantities; selected-item checkout; coupons; saved addresses; delivery selection; gift messages; local accounts; preview order history, cancellation, tracking, receipts and return/exchange requests; reviews and support conversations.

`FEATURES.md` gives a detailed feature map and service boundaries. All required local imports are supplied, including `ShoppingToolsContext.jsx`, `CatalogContext.jsx` and `StoreUtilityBar.jsx`. Use the whole replacement rather than mixing pages with older contexts.

## Preview boundary

This is a **browser-local frontend preview**, not a deployed commerce backend. Accounts, addresses, shopping lists, orders, reviews and support tickets use browser storage. Passwords are salted and hashed for the preview, but browser storage is not production authentication or an access-control boundary. Data and inventory are not shared between customers on different devices.

Checkout records a clearly labelled COD preview order. No payment is collected, courier booked or refund issued. Pincode input validates format only. Tracking shows recorded events, not invented courier updates. A local support ticket does not send an email to staff. Printed order receipts are not tax invoices.

For launch, connect server authentication, a database, authoritative pricing and transactional inventory, verified payment webhooks, courier serviceability/tracking and notification services. Browser checks cannot replace server enforcement of prices, ownership and stock.

## Development store console

During `npm run dev`, open `/dev/store` or follow the footer link. This local testing console can edit catalogue prices/stock, add basic products, progress preview orders, respond to support tickets and review return/exchange requests. It is excluded from production routes and builds, and is not a secure live admin portal.

New preview orders reserve their exact variants locally. Cancellation releases the reservation. Approval of a return does not issue a refund or restore stock automatically. Older orders without reservation metadata are not retroactively deducted.

## Products, prices and assets

The catalogue retains your supplied descriptions, options and coupon codes. Stock totals derive from variant stock. Ratings derive from supplied and locally recorded reviews.

- `MIDLAJ`: 10% off a product subtotal of at least ₹1,000.
- `NISHAD`: ₹200 off a product subtotal of at least ₹1,500.
- `FAVAS`: 15% off a product subtotal of at least ₹2,500.
- Standard shipping: ₹99, free at ₹500 after coupons. Express shipping: ₹199.

Coupon minimums use the subtotal after product discounts. Catalogue selling prices use whole-rupee rounding; order calculations retain paisa precision.

Your actual product photos were not supplied as files. Copy these from the original project into `src/assets`:

```text
tshirt.jpg, tshirt2.jpg, tshirt3.jpg
shoes.jpg, shoes2.jpg, shoes3.jpg
shaker.jpg
Towel.jpg, towel2.jpg, towel3.jpg
Socks .jpg, socks2.jpg, socks3.jpg
bottle.jpg, bottle2.jpg, bottle3.jpg
new logo.png (optional)
```

The resolver tolerates filename case and whitespace differences, but retaining original names is simplest. Missing images display labelled illustrations, never an import error. Protein and Headphones remain coming-soon categories because the supplied catalogue has no products for them.

For campaign photography, copy a suitable wide image into `src/assets` and set `bannerImage: asset("your-banner.jpg")` in the relevant category entry. Original photos are required for a photographic result like the reference screenshots. Opening.mp4 and the former 3D packages are not used by this design. Compatibility component files remain included.

## Verification and scripts

```sh
npm run doctor
npm test
npm run build
```

Or run all three with `npm run check`. `npm run preview` serves the production build.

**Verified for this package:** 44 logic tests and 12 shopping browser scenario groups pass. Browser checks cover search, category filtering, quick view, two-tab synchronization, account separation, coupons, selected checkout, invalid addresses, exact totals, order ownership, cancellation, receipts, save-for-later, comparison, address editing, price-change recovery, passwords, reviews, mobile controls and missing routes. The new fitting room also passed 9 browser scenarios using a mock provider and synthetic fixtures. Eleven customer routes were checked for horizontal overflow at 320, 390, 768 and 1440 pixels. No JavaScript page errors were recorded. Screenshots and results are in `test-results`.

These checks ran in headless Chromium on Linux. They do not prove identical behaviour in every browser or real device, and no live payment/courier integration was tested. Screenshot data includes temporary test accounts and catalogue edits from the isolated browser run; those changes are not written into the supplied catalogue.

Optional browser-test tools (not required to run the shop):

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

The browser suite starts its own local server on port 4196 and uses an isolated browser session. It does not change your normal browser's account or cart. On some Linux systems, Playwright also needs its documented system dependencies.

## Hosting

Run `npm run build` and deploy `dist` with an SPA fallback to `index.html`, so direct product and order links work. This does not add a backend or make preview accounts production-ready.

Documentation: [Vite](https://vite.dev/guide/), [React Router](https://reactrouter.com/api/declarative-routers/BrowserRouter), [Playwright library](https://playwright.dev/docs/library).