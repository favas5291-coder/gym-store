# GymDrobe mobile app: PWA foundation

The first mobile release reuses the current React storefront and the existing
backend. Customers can install GymDrobe from a supported browser and launch it
in a standalone window. The installation page is `/install`, linked from the
footer. This phase does not produce an Android APK/AAB or an iOS application.

## Included

- Stable manifest identity, standalone display and the existing transparent icons.
- A separate opaque, padded maskable icon for launchers that crop app icons.
- A user-initiated install button when the browser supplies an install prompt.
- Android, iPhone/iPad and desktop browser-menu instructions as a fallback.
- An accessible offline screen with a retry action that preserves the requested URL.
- Production-only service worker registration after the window load event.
- Update activation only after tabs close or the customer chooses Update GymDrobe
  on `/install`. No automatic reload during shopping or payment.

## Data and connectivity

The service worker caches only `offline.html`, `offline.js` and the offline
screen's icon. It does not cache the storefront application, product catalog,
prices, stock, customer information, orders, login responses or payments.
Shopping and checkout require an internet connection. Requests under `/api`
and requests to other origins bypass the worker entirely. There is no background
order or payment replay.

The offline screen does not automatically retry a payment. It tells customers
to check their order status after reconnecting before attempting payment again.

## Build and verify

Use Node 24 and the existing deployment environment variables:

```bash
npm ci
VITE_SITE_URL=https://www.gymdrobe.com \
VITE_API_URL=https://gym-drobe-backend.onrender.com/api npm run check
```

The build retains the existing catalog/sitemap preflight. `scripts/build-pwa.mjs`
then fingerprints the worker and offline assets so a changed release receives a
new cache revision. The Vercel configuration makes the worker, offline document,
offline script and manifest revalidate instead of remaining stale in HTTP caches.

After building, run the dedicated production-browser checks:

```bash
node tests/pwa-browser.mjs
```

Playwright and Chromium must be available, as in the existing storefront CI.
An isolated installation can be supplied with `GYMDROBE_PLAYWRIGHT_MODULE` and
`GYMDROBE_CHROMIUM_PATH`. Tests use mocked APIs and never contact live payment,
authentication or analytics services. Reports and screenshots are written to
`test-results/pwa/`. The test temporarily changes `dist/sw.js` to check updates
and restores it afterward. Do not run it against a deployed server.

For a local smoke test, run `npm run preview -- --host 127.0.0.1` and open
`http://127.0.0.1:4173/install`. Localhost is treated as a secure context; real
devices require HTTPS. The service worker intentionally does not register in
`npm run dev`.

## Release checks

Verify on physical Android Chrome and iPhone Safari over HTTPS: installation,
launch icon, safe areas, Google login, saved sessions, shopping bag, Razorpay/UPI
return flow, interrupted payment recovery, order tracking and offline retry.
Browser automation checks the web behaviour and installability criteria; it
does not confirm an operating-system installation or a successful live payment.

The Android development project is documented in [ANDROID_APP.md](ANDROID_APP.md).
It adds native Google login, Razorpay checkout, app links and device navigation.
Physical-device verification, release signing, push notifications and store
publication remain separate release work.
