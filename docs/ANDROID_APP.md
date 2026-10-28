# GymDrobe Android test app

This phase bundles the existing React storefront in Capacitor 8. The app ID is
`com.gymdrobe.app`; Android 7.0/API 24 or newer is required. The app uses the same
products, accounts, shopping bag, saved checkout recovery and backend verification
as the website. It is a development build for device testing.

## What is included

- Android project, GD launcher/adaptive icons, branded splash and system-bar insets.
- Bundled local web assets, HTTPS API access and no remote `server.url` WebView.
- Native Google sign-in through Credential Manager, using the backend's fresh
  challenge nonce and existing ID-token verification endpoint.
- Native Razorpay Android checkout through `GymDrobeCheckoutPlugin`. Responses
  still pass through the existing signature-verification endpoint. A callback
  does not mark an order as paid.
- Back-button handling, keyboard dismissal and external links in a browser tab.
- Allowlisted custom links such as `gymdrobe://app/product/PRODUCT_ID` and
  `gymdrobe://app/orders/ORDER_ID/track`. Links cannot supply login credentials,
  checkout success, staff routes or foreign destinations.
- Interrupted checkout recovery opens the existing saved checkout. It does not
  replay a payment or trust a restored callback as proof of payment.

PWA service workers are disabled inside the native app. The storefront is bundled,
but catalog, login, checkout and order data require a connection.

## Build

Install Node 24, JDK 21 and an Android SDK with platform 36 and its build tools.
Android Studio 2025.2.1 or later includes the appropriate JDK. Public Android
configuration is in `.env.android`. No server/payment secret belongs in this file.

```bash
npm ci
npm run android:apk
```

The output is `android/app/build/outputs/apk/debug/app-debug.apk`. Install with
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk` or open it on a
test phone. `npm run android:open` opens Android Studio after syncing.

The Android GitHub workflow compiles the APK, runs Android lint,
installs it on an API 35 emulator and checks that a native login page launches. It
uploads `GymDrobe-Android-debug` with the APK, SHA-256 checksum and certificate
details. A new PR build uses the same public development certificate so test app
updates and Google OAuth registration stay consistent.

## Google configuration needed for device sign-in

In the Google Cloud project that owns the website's existing Web OAuth client,
create an **Android OAuth client** with these exact values:

| Field | Development value |
| --- | --- |
| Package name | `com.gymdrobe.app` |
| SHA-1 | `37:69:38:B9:08:D0:EE:C4:40:64:67:4B:23:85:8B:64:63:EF:3D:B0` |
| Web client ID used by the app | `1098658899656-34u0lfqcfucgf8dgq0c9oag6q673mtnu.apps.googleusercontent.com` |

The Android OAuth client ID stays in Google Cloud; the JavaScript configuration
uses the Web client ID so the backend can verify the ID-token audience. If the
OAuth consent screen is in testing, add the Google accounts used for device tests
as test users. No `google-services.json` or Firebase project is required for this
Google-only setup.

The checked-in `android/debug.keystore` is a public development certificate with
the standard `android` password. Never use it for a public release. Release and
Play App Signing certificates need separate Android OAuth client registrations.

## Validation and release boundary

`npm test` covers app-link validation and native payment response boundaries as
well as the existing checkout suite. `node tests/native-browser.mjs` checks the
native UI/adapter contracts with a fake bridge and mocked APIs. This is not a
Google authentication or Razorpay transaction on a real device.

Before release, configure the Android OAuth client and verify on a physical phone:
Google login/logout, restored sessions, bag and wishlist, Android back/keyboard,
UPI app switching, cancelled/interrupted payments, confirmed order recovery,
tracking, slow/offline conditions and signed app updates. Use Razorpay test-mode
keys on a staging backend for transaction tests. The default public config points
at the existing production backend; this build script never makes a payment.

Public distribution still needs an owned private release signing key, a signed
release bundle, account-deletion support, privacy/Data safety declarations, store
assets and required Play testing/review. Push notifications are a later phase.
HTTPS App Links also require the release certificate's assetlinks.json on the
website; this phase registers only the custom scheme.
