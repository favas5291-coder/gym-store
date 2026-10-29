# Native order update controls

Review implementation only. `VITE_PUSH_ENABLED=false` for both mobile builds;
the backend's registration, delivery and database controls also default off.
No notification has been sent and no provider key is included in this repository.

Customers choose **Order updates** from the notification screen. Permission is
requested only after their tap and a backend availability check. Existing consent
can be refreshed on foreground/restart without another permission prompt. The
setting is scoped to this account and this device; marketing and price watches
are separate. Raw APNs/FCM tokens stay in memory. Random binding metadata is saved
locally. Sign-out clears consent immediately, disables only that binding and
unregisters the native token. If offline server cleanup fails, the same account
retries it after reconnecting; the screen reports incomplete cleanup. A later
account cannot inherit consent, and an old callback cannot reclaim a newer binding.

The lock screen receives only “Your GymDrobe order has an update.” An exact HTTPS
order URL opens the existing authenticated order page; no payment state, credential
or external destination is accepted from a notification. The app never navigates
away from an active payment to open a push route.

## Build configuration

- New exact dependency: `@capacitor/push-notifications@8.1.3`, compatible with the
  current Capacitor 8 core. The default plugin allowlist excludes it, preserving
  unconfigured builds and preventing Firebase startup failures.
- iOS: explicitly set `VITE_PUSH_ENABLED=true` and `VITE_APNS_ENVIRONMENT=sandbox`
  for development or `production` for distribution, then `npm run ios:sync`.
  Sync adds the matching APNs entitlement. AppDelegate forwards native registration
  events. Provisioning must actually include the capability before signed testing.
- Android: provide the owner's matching `android/app/google-services.json`
  (git-ignored) before enabling the flag and running `npm run android:sync`.
  Sync refuses a missing/wrong package configuration. Firebase auto-init and
  analytics are disabled; permission/registration follows explicit opt-in. A
  separate monochrome notification icon/channel is included.
- Android test version is 1.1.2 / code 3, preserving the existing development
  signing certificate and Google OAuth package identity. It is not a Play release.
- Website/PWA push is not added; existing on-device price/stock watches stay intact.

## Evidence and rollout

Lifecycle/permission/storage/API unit tests pass locally. The feature-enabled Vite
build passes. Browser CI exercises actual React → paired backend JWT/router/domain
with an isolated repository and a fake native bridge. Native CI compiles normal
default-off iOS/Android builds; an additional unsigned iOS compile includes the
push bridge. Simulator/adapter checks are distinct from actual APNs/FCM delivery.

The backend companion provides the encrypted registry, bounded outbox, admin stop
control, failure review, stale-claim recovery and provider adapters. Its
`docs/ORDER_NOTIFICATIONS.md` records protocol/retention/retry limits. Database CI
uses disposable loopback MongoDB only. Provider credentials, staging verification,
approved retention/disclosures/log-alert ownership and controlled physical-phone
delivery are still required. No default flag should be enabled as part of a
routine merge. Sending a real test message requires founder authorization.

Rollback: turn the backend database control off, then server flags off; create
new native bundles with the UI flag off. Existing installed apps still depend on
the shared API, so retain compatible disable endpoints. Do not drop customer data
or reset outbox receipts. Provider-accepted alerts cannot be recalled.

Primary integration reference: https://capacitorjs.com/docs/apis/push-notifications
