# Supplier onboarding screens

Companion backend: `favas5291-coder/gym-drobe-backend`, branch `feature/marketplace-supplier-foundation`. Read its `docs/MARKETPLACE_AUDIT.md` and `docs/SUPPLIER_PORTAL.md` for the complete audit, database design, API, rollout limits and ordered checklist.

## Routes and behavior

- `/supplier`: uses existing account sign-in; supplier application, private invitation claim, business profile, exact commercial offer, explicit acceptance receipt, trial display and recent history.
- `/admin/supplier-onboarding`: uses existing admin authorization; application list, draft-supplier invitations, commercial offers, explicit review decisions and audit history.
- Navigation appears in the account footer and admin dashboard only when the frontend flag is enabled. Existing store/catalogue/payment/checkout/tracking components retain their behavior.
- Forms disable during writes. Conflicts and uncertain saves require reloading current server state. Acceptance checkboxes reset when the offered digest changes. Private invitation codes are kept only in page memory and submitted in POST bodies, never URL query strings.
- Supplier access is checked by the backend's account/workspace relationship. Browser state never grants access.

## Configuration

Use the existing frontend `.env` file; do not commit credentials.

```dotenv
VITE_SUPPLIER_PORTAL_ENABLED=false
```

Default behavior is disabled. Set it to `true` only for staging verification with the companion API and `SUPPLIER_PORTAL_ENABLED=true` on that backend. Reuse the existing `VITE_API_URL` (including `/api`) and `VITE_SITE_URL`. Vite flags are embedded at build time, so rebuilding is necessary. The backend flag does not enable live order routing or payment transfers.

New portal suppliers remain drafts and cannot accept orders in this release. Private uploads, banking, supplier inventory/order screens, notifications, trial reports and settlements remain unfinished. No production deployment has been performed.

## Checks actually run

```bash
npm ci
npm run check
```

With valid public site/API origins and the portal flag enabled:

- Source/import check: 180 files.
- **164 tests pass, 0 fail, 0 skipped.** The original published branch had 160 passing tests.
- Production sitemap generation and Vite build succeed.
- Added API tests cover authenticated/no-store requests, exact acceptance payloads, uncertain or missing write replies, no automatic retries, revision conflicts and exact basis-point parsing.
- No dependency or lockfile changed.

Visual browser verification is **not complete**. The environment could not install a local Chromium binary, and its cloud browser could not reach the local preview. No desktop/mobile visual result or connected production checkout result is claimed.

## Reproducible local UI fixture

With both companion branches checked out as sibling folders named `gym-store` and `gym-drobe-backend`:

```bash
node tests/supplier-portal-fixture.mjs
```

Alternatively set `GYMDROBE_BACKEND_DIR` to the backend checkout. The fixture binds only to `127.0.0.1:4198`, starts an isolated in-memory commerce API, and prints local supplier/admin test links. It uses fixture-only sign-in identities and no real database/provider. Never deploy this test fixture.

Manually verify application submission, admin offer creation, supplier acceptance, approval, suspension and reload/conflict recovery. Check the forms at 320px/390px mobile and desktop widths, keyboard focus, required inputs, long terms, no horizontal overflow and no browser errors. Use a staging replica set and real test sign-in for the database/auth acceptance gates documented in the backend.

## Merge and rollback

The source base is published `gym-store@3874399b99176b4b662a14fc4ff1fa0cf42eaa7d`. The newer local `feature/tracking-live-updates` and add-on work are not included in that base. Merge/review this branch into the current local branch instead of replacing whole directories. No tracking files were changed.

Turn the frontend flag off and rebuild to hide both routes/navigation. Preserve backend agreement/audit records and its enrolled-supplier activation guard. Do not delete data or assume supplier consent during rollback.
