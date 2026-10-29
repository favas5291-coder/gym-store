# GymDrobe iPhone development and release checklist

Status: development milestone, not approved or ready for App Store submission. Work stays on `codex/gymdrobe-ios` in both repositories. No production merge, TestFlight upload, paid transaction or public submission is part of this milestone.

## Audit and shared architecture

| Area | Existing behavior and iOS work |
| --- | --- |
| Frontend | React 19/Vite 8/Router 7 reused. Bundled iPhone target added using Capacitor 8.6; no remote website URL or remote code updater. |
| Backend | Existing Express/MongoDB API remains authoritative for catalogue, accounts, addresses, checkout prices, stock, shipping, coupons, orders, payment verification, tracking and administration. |
| Shopping | Existing listing/search/filter/gallery/variants/cart/guest checkout/COD/COD advance/account/order/return flows reused. Their web/Android tests do not establish real iPhone payment success. |
| App navigation | Five customer tabs, compact header with persistent bag, dedicated categories/search, offline notice, safe-area handling, keyboard-hidden tabs and native navigation gestures. |
| Login | Existing Google web audience retained. iOS now requires its own Google OAuth client and URL scheme. Apple native authorization and backend verification added behind configuration gates. Neither iPhone provider was tested with real credentials. |
| Session | iOS JWT moves to device-only Keychain, accessible when unlocked; serialized writes prevent logout/write races. Web/Android keep existing storage. Keychain may survive an iOS reinstall. |
| Payments | Official Razorpay iOS SDK 1.5.9 via SwiftPM, local bridge, duplicate-open guard, same gateway order validation, existing backend signature/status verification. No private Razorpay keys in client. The provider-documented UPI query schemes enable discovery of Google Pay, PhonePe, Paytm, CRED, BHIM and Amazon Pay; successful external-app return still needs signed-device testing. Interrupted checkout retains existing recovery path. |
| Sharing/links | Native share uses public HTTPS product URLs. Custom URL handler accepts allowlisted customer paths and drops credentials/payment results. Universal-link entitlements added; domain association still requires the owner's real Team ID and deployment. |
| Account deletion | In-app confirmation plus backend permanent profile/address/review/support deletion, recent-login check and Apple token revocation. Disabled until the business supplies an accurate retention notice and staging tests pass. Financial/order records are retained, not silently erased. |
| Device shopping data | Cart/wishlist/watch/local support data currently live on each device/browser under customer-scoped keys. Signing into two devices does **not** currently synchronize those lists. Server-backed shopping-state synchronization is outstanding. |
| Notifications | Existing watches are local comparisons. APNs opt-in, device registration, event delivery/retries/token cleanup and support/order events are still outstanding. No notification permission is requested and no push delivery is claimed. |
| Brand/assets | Existing glossy GD artwork reused for opaque 1024px iOS icon and splash. Wordmark displays GymDrobe. Genuine simulator captures are technical QA material, subject to review before use as store screenshots. |
| Performance | Previous storefront image/lazy-load fixes retained. Native analytics/tracking integration disabled. No new physical-iPhone startup/LCP/INP improvement is claimed. |

## Build on a Mac

Use Node 24 and a stable Xcode 26 or newer. Capacitor's iOS deployment minimum is 15. The GitHub iPhone workflow compiles an unsigned simulator app and captures its real launch; signing credentials are not needed for that check.

```
npm ci
npm run ios:sync
npm run ios:open
```

`.env.ios` contains only public production API/site/web-client identifiers. Create ignored `.env.ios.local` for the actual iOS OAuth client:

```
VITE_GOOGLE_IOS_CLIENT_ID=<iOS client for com.gymdrobe.app>
VITE_APPLE_SIGN_IN_ENABLED=true
```

Enable Apple only after its native capability, backend secrets and real authorization test are ready. `ios:sync` updates the iOS URL schemes/entitlements/config, regenerates SwiftPM plugin dependencies and restores the Android Capacitor config. It must not be run concurrently with Android sync. The Android target and its package/signing setup remain in place.

Create the Google **iOS** OAuth client in the existing `gymdrobe-customer-login` project for bundle ID `com.gymdrobe.app`. Do not replace the web client ID or existing Android client. Backend Apple/deletion environment and behavior are documented in `gym-drobe-backend/docs/IOS_ACCOUNTS.md`.

For universal links, supply the actual Team ID to `node scripts/ios-universal-links.mjs`. It prepares an association document under `test-results/ios/release`; it does not deploy it. Serve that file without redirects at `https://gymdrobe.com/.well-known/apple-app-site-association` and `https://www.gymdrobe.com/.well-known/apple-app-site-association`, with JSON content type. Enable Associated Domains in the Apple identifier/provisioning profile, then test installed and uninstalled behavior from other apps.

The simulator ZIP contains a `.app` for macOS Simulator. It is **not** an IPA or an installable iPhone/TestFlight build. Actual signed release archives require the owner's Developer team, registered App ID, provisioning/signing and App Store Connect access. No credentials should be pasted into source or this document.

## Updating the ecosystem

| Change | Delivery |
| --- | --- |
| Product, price, stock, coupon, shipping or tracking data | Existing backend/admin updates reach website and apps through API refreshes. |
| Server validation, payment verification or fulfillment | Deploy tested backend changes; preserve compatibility with older app versions. |
| Website layout/React feature | Deploy website; installed apps retain their bundled code. |
| App layout/React feature/native SDK/permissions/icon | Rebuild, device-test and distribute a new store app version. Website deployment alone does not update bundled apps. |
| Store description/screenshots | Update App Store Connect under the owner's release process; some metadata needs review. |

## Observed SDK privacy declarations

Inspection of the first actual simulator `.app` found privacy manifests in Capacitor/Cordova, Google sign-in and its dependencies, and RazorpayStandard. The Google manifest declares name/email/phone/user/device identifiers, coarse location and usage categories; Razorpay declares contact/address/payment/device/interaction/crash/diagnostic categories. These are SDK declarations, not a determination that every optional category is used by GymDrobe. Reconcile them against the exact enabled features and provider documentation before completing App Store privacy answers.

The bundled RazorpayStandard 1.5.9 manifest includes a collected-data entry spelled `Email address` rather than Apple's `NSPrivacyCollectedDataTypeEmailAddress` identifier. Treat this as an archive validation/vendor follow-up blocker. Do not silently edit a signed vendor framework or claim the final archive passes privacy validation. Obtain a supported corrected SDK/vendor guidance and validate a signed archive before upload.

## Release gates

- [ ] Owner's active Apple Developer membership, Team ID, App Store Connect app and matching identifier.
- [ ] iOS Google OAuth configured and tested; real Apple login/private relay/cancellation/re-login tested. Apple email collision behavior reviewed; explicit provider linking remains future work.
- [ ] Apple authorization revocation, MongoDB transactional deletion, approved financial-data retention/erasure process, re-registration and all-device stale-data cleanup tested.
- [ ] Push implemented end-to-end: contextual opt-in, APNs key/environment, authenticated token ownership, order/support event outbox, retries, unsubscribe/logout/deletion invalidation, real iPhone delivery. No unsolicited marketing.
- [ ] Universal links deployed and tested on signed devices.
- [ ] Decide and implement shared server-backed cart/wishlist synchronization; preserve guest data and handle concurrent edits/price revalidation.
- [ ] Successful/failed/cancelled/interrupted/duplicate Razorpay, external UPI/card authentication, COD, advance, webhooks/refunds/order-state checks on real iPhones using appropriate test credentials. Do not place real charges for QA without authorization.
- [ ] Native secure-storage and lifecycle tests on real iPhones; old/new iOS, notch/Dynamic Island, keyboard, VoiceOver, large text, reduced motion, touch targets, contrast and offline recovery.
- [ ] Measure physical-device cold/warm launch, product/list/cart navigation, memory and video behavior. Lab browser tests are not field data.
- [ ] Full general privacy policy for website/app (the existing virtual-try-on policy is narrower), retention disclosures, SDK data inventory/privacy manifests/signatures and App Store privacy answers verified. No unsupported “no data collected” claim.
- [ ] Audit Razorpay/Google/Capacitor SDK privacy requirements and dependency advisories against the final archive. Native analytics is disabled; reassess tracking/consent before introducing any advertising SDK.
- [ ] Signed Release archive validation, export compliance answers from actual implementation, TestFlight upload and internal/real-device tests.
- [ ] Owner reviews final metadata/screenshots/privacy/review access and explicitly authorizes App Review submission, then public release.

## App Store listing draft

Name: **GymDrobe**

Subtitle: **Essentials for every workout**

Category proposal: **Shopping**. Confirm in App Store Connect. Age rating requires completing Apple's current questionnaire; no rating is assumed.

Description draft:

> Everything You Need for Every Workout.
>
> Explore fitness clothing, footwear and workout essentials with GymDrobe. Browse collections, search and filter products, choose sizes and colours, save favourites and build your bag.
>
> Check delivery options and available payment methods at checkout. Sign in to manage your profile, saved addresses and account orders, or shop as a guest. Follow available order tracking and contact GymDrobe support from the app.
>
> Product availability, delivery options and payment eligibility are shown during shopping and checkout.

Keyword draft (under 100 characters): `fitness,gym,workout,sportswear,shoes,training,shopping,activewear`

Support URL: https://www.gymdrobe.com/help (existing). Contact in existing footer: support@gymdrobe.com. General privacy-policy URL remains to be supplied/verified; do not use a fabricated URL. No push or cross-device list-sync promises should appear in the listing until implemented and tested.

Review-note draft: “GymDrobe sells physical goods. Browse and check out as a guest; account sign-in provides saved addresses and account orders. Payments use Razorpay with backend verification. Account deletion is in Account → Security & data. Provide working review access/testing instructions here after configuration. No credentials are supplied in this draft.” Validate every sentence against the release build; never submit placeholder review credentials.

## Android after iOS launch

Keep the existing Android Capacitor project. Reuse shared React/API/validation and account endpoints; preserve working Google/Razorpay integrations. After iOS release, add equivalent native secure storage/notifications, validate Android deep links/permissions, run existing smoke/payment tests, then prepare the signed AAB/Play listing and policy checklist. The public Android release remains second; no separate rewrite.

## Primary requirements checked 29 October 2026

- Apple App Review Guidelines, particularly physical goods, login options and account deletion: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/
- Xcode/SDK upload requirements: https://developer.apple.com/news/upcoming-requirements/
- Capacitor iOS/tooling: https://capacitorjs.com/docs/ios and https://capacitorjs.com/docs/getting-started/environment-setup
- Required third-party SDK privacy information: https://developer.apple.com/support/third-party-SDK-requirements/
- Razorpay UPI integration requirements: https://tfs.np.razorpay.in/docs/payments/payment-methods/upi/upi-intent
- Official Razorpay Swift package: https://github.com/razorpay/razorpay-pod/tree/1.5.9

These are implementation/release gates, not a claim of Apple approval or complete compliance.
