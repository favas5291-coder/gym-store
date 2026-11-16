# GymDrobe — iPhone App Store release readiness (7 November 2026)

**Status: PREPARATION ONLY — not authorized or verified for public release.**

This checklist separates verified repository/CI facts from account-, supplier-, provider- and real-device-dependent work. It does **not** claim an Apple Developer membership, App Store Connect app record, signed IPA, TestFlight build, payment success, or Apple review approval. No credentials, purchase, real payments, notifications, customer changes or submissions are authorized by this document.

## 1. Owner: check Apple Developer Program membership

1. Sign in at https://developer.apple.com/account/ with the Apple Account intended to own GymDrobe.
2. Look for **Membership details**: active Apple Developer Program, renewal/expiration date, legal entity/account type, role and Team ID. Keep Team ID and email private; only report whether membership is active.
3. Alternatively, Apple Developer app on iPhone → Account. If it offers **Enroll Now**, paid membership is not confirmed; do not buy again until you have checked.
4. If enrollment is needed **in India**, Apple says to use the Apple Developer app, which provides an annually renewing membership. Apple's standard fee is US$99/year, or the local price at checkout; the payment is not authorized by this checklist.
5. Decide *individual vs organization* before enrollment. As an individual, the seller name is the personal legal name; to display the registered organization's legal entity name, Apple requires an organization membership, its legal status and generally a D-U-N-S number. A brand name alone is not an eligible legal entity.
6. After confirming membership, sign in at https://appstoreconnect.apple.com/ to check whether an **Apps** area is available and whether an existing GymDrobe record is present. Do **not** create a duplicate record without checking.

Source: https://developer.apple.com/help/account/basics/account-landing-page/ ; https://developer.apple.com/help/account/membership/enrolling-in-the-app ; https://developer.apple.com/help/account/membership/program-enrollment/

## 2. Verified source and CI evidence

- Frontend repository: https://github.com/favas5291-coder/gym-store
- Backend repository: https://github.com/favas5291-coder/gym-drobe-backend
- Bundle identifier in `capacitor.config.json` and Xcode: **`com.gymdrobe.app`**. Current iOS target has display name **GymDrobe**, version **1.0.0**, build **1**, and deployment target **iOS 15.0**.
- Latest reviewed PR #53 was merged on 7 November 2026. Its iPhone simulator workflow `42383466859` **passed** native navigation and compiled the optional push bridge.
- **Important scope:** `.github/workflows/ios-app.yml` builds a **Debug, unsigned simulator .app** with `CODE_SIGNING_ALLOWED=NO`. It is **not** a distributable iPhone build or App Store archive.
- iPhone account/session issue remains represented by open PRs [#46](https://github.com/favas5291-coder/gym-store/pull/46) and [#51](https://github.com/favas5291-coder/gym-store/pull/51). A passing mainline navigation simulator is not proof that signed-device login/account recovery is safe.
- `.env.ios` contains `VITE_API_URL` and website origin, but **not** a configured `VITE_GOOGLE_IOS_CLIENT_ID`; the code requires a valid iOS OAuth client for `com.gymdrobe.app`. `VITE_APPLE_SIGN_IN_ENABLED` is not enabled by the reviewed configuration. Source: `src/native/google.js`, `src/native/apple.js`, `docs/IOS_APP.md`.
- `docs/IOS_APP.md` identifies an observed issue in RazorpayStandard SDK 1.5.9's privacy manifest: an `Email address` enum spelling rather than the expected Apple identifier. **Vendor-supported resolution and release archive validation are pending**; do not hand-edit a third-party signed SDK.
- Latest reviewed Android emulator run failed; it does not block a properly independently verified iOS-only launch, but it does not prove all shared mobile functionality either.

## 3. Release gates — owner and engineering

| Gate | Status on 2026-11-07 | Required proof before public submission |
| --- | --- | --- |
| Apple Developer membership | **Unknown: owner must verify** | Active program, correct legal publisher, Team ID available privately |
| App Store Connect app record | **Unknown** | One GymDrobe iOS app record; correct team/bundle ID `com.gymdrobe.app`; current agreements accepted |
| Distribution signing | **Not evidenced** | Release configuration, iOS Distribution signing, provisioning, archive and upload validation on compatible Xcode |
| Xcode/SDK requirement | **Simulator toolchain passed** | Archive compiled using Xcode 26+ with iOS 26+ SDK (current Apple upload minimum); correct deployment target |
| Apple/Google login | **Blocked/unverified** | Configure iOS Google client and Apple equivalent login option; test private relay, cancel/retry and existing-account flows on signed iPhone |
| Keychain/auth restoration | **Unverified on signed physical iPhone** | Persistent/restarted login, sign-out, switch accounts, reinstall/migration error recovery; resolve relevant PR issues |
| Checkout/Razorpay | **Unverified on signed physical iPhone** | Sandbox payment success/failure/cancel/interruption, duplicate-tap, 3DS/UPI return, backend verification and order reconciliation |
| COD/stock/shipping/refunds | **Provider/operational proof pending** | Safe staging journey from displayed inventory and charges through order management; controlled refund/cancellation/stock race |
| Account deletion | **Code implemented; live flow unverified** | Confirm in-app deletion, session revocation, Apple token revocation, financial-record retention disclosure and staging results |
| Privacy and SDK manifests | **Blocked pending validation** | General app privacy policy URL verified live; accurate App Privacy answers including third parties; Razorpay vendor resolution and archive validation |
| App icon, copy and screenshots | **Review pending** | Approved current GymDrobe identity, real final app screenshots, description, support URL, age rating, review notes and contact |
| Universal links | **Not production-verified** | Correct Team ID/AASA deployment and signed-device link test if this feature is included in initial release |
| Push notifications | **Opt-in bridge compile only** | If not production-ready, keep disabled and make no push promise; if enabled, verify APNs/device token, consent, sign-out cleanup and delivery |
| Shared cart/wishlist | **May remain disabled** | Do not promise cross-device sync unless feature is enabled and tested |
| TestFlight | **Not evidenced** | Processed signed build, internal device tests, documented findings addressed |
| App Review submission | **Not authorized** | Owner sign-off after all required gates pass |

No genuine live-site privacy policy is confirmed by this audit. Never invent a privacy URL or answer "no data collected" without tracing app and SDK behavior.

## 4. Free preparation steps before Apple membership is confirmed

Engineering can do these without paying for a new service:
- Resolve PR #46/#51 account-session failure on their branches; rerun signed-device tests when signing becomes available.
- Confirm correct iOS Google OAuth client configuration using ignored `.env.ios.local` and verify Apple Sign In configuration on device. Never commit Team keys, signing secrets, OAuth credentials or tokens.
- Obtain Razorpay's corrected/supported SDK or guidance and validate the final archive/privacy manifests.
- Review app-wide privacy policy and retention/erasure language with the owner; do not claim legal approval.
- Prepare approved App Store text and **real** device screenshots. Draft title: **GymDrobe**; subtitle: **Essentials for every workout**; category proposal: **Shopping**. Confirm copy and features are actually present in the release build.
- Use the existing Mac/Xcode workflow in `docs/IOS_APP.md` to build locally. Example: `npm ci`, `npm run ios:sync`, `npm run ios:open`. These do not create a signed submission automatically.

## 5. Once Apple membership is verified

1. Sign in to App Store Connect under the correct owner/team. Accept pending agreements. Register/confirm the unique Bundle ID **`com.gymdrobe.app`** in Apple Certificates, Identifiers & Profiles; enable the capabilities actually used.
2. Create **one** iOS app record (GymDrobe, English, matching Bundle ID, internal SKU). App Store Connect record creation requires the proper owner/App Manager/Admin role. Avoid duplicate records.
3. On a Mac, use the owner's authorized signing to build a **Release archive** (not Debug simulator). Validate the archive and Apple third-party SDK privacy requirements. The current GitHub simulator ZIP is not an IPA.
4. Upload using Xcode/Transporter/App Store Connect as authorized; wait for Apple's build processing.
5. Invite internal TestFlight testers and test sign-in, account deletion, checkout and payment recovery on compatible iPhones. Log failures; do not use real customer payments or messages for QA.
6. Finalize App Privacy, privacy policy URL, age rating, screenshots, support/contact, pricing (free app), Review Notes and release controls.
7. Submit to App Review **only with explicit owner approval**. Do not auto-publish. Apple approval is not guaranteed.

App Store Connect guide: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app ; build upload: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds ; TestFlight: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers

## 6. Apple policy constraints

- Apple App Review guideline **3.1.3(e)** permits and requires non-IAP payment methods for physical goods shipped/used outside the app. Using Razorpay does not remove the requirement for secure and reliable checkout.
- Guideline **4.8** requires an equivalent privacy-preserving login alternative when Google is used to establish the primary account; Apple's Sign in with Apple is the practical route for GymDrobe, but must be configured and tested.
- Guideline **5.1.1** requires usable in-app account deletion for apps offering account creation and clear privacy disclosures.
- Apple requires an app privacy policy URL and accurate declarations including third-party SDK data handling.
- As of 7 November 2026, uploads must use **Xcode 26+ and the iOS 26+ SDK**; the project's iOS 15 deployment target is not itself below Apple's current iOS 13 target minimum.

Sources: https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy ; https://developer.apple.com/news/upcoming-requirements/

## Release decision

**Do not label GymDrobe App Store-ready yet.** Passing a simulator smoke test confirms a development milestone, not production sign-in, payment, privacy/signing or App Store acceptance. First owner dependency: **confirm membership and whether publishing under an individual or legal entity**. Then complete the verifiable engineering gates before TestFlight and public submission.
