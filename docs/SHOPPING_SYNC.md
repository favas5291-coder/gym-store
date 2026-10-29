# Shared account shopping lists

The paired implementation is a development feature and defaults off. Enable
`VITE_SHOPPING_SYNC_ENABLED=true` only for a client built against a reviewed
backend with `SHOPPING_SYNC_ENABLED=true`. Existing website/Android/iPhone
behavior is preserved when disabled. Product data, prices and payment verification
continue to use the shared backend and its checkout rules.

Signed-in bag and wishlist changes are written to immutable, account-scoped
device journal entries before local copies change. The same operation identifier
survives retries and app restarts. Account refreshes do not overwrite pending
edits, and ending a session prevents stale responses from publishing into another
account. Guest transfers journal their stable transfer receipt, including retries
after the account copy was saved but the guest copy could not yet be removed.

Legacy account lists merge by the maximum quantity for each variant, avoiding
duplicate copies of the same old bag. Later quantity changes combine as deltas;
removals/wishlist changes follow committed order. Kit choice metadata is retained
without granting checkout permission. Incoming product rows are rebuilt from the
current catalogue, and stock/selection corrections are journaled; no server list
payload supplies prices. Checkout still performs its own authoritative review.

The client refreshes on online/foreground/focus and every 30 seconds while
visible. Interrupted saves remain on the device. Older/invalid changes require
customer review. Choosing account lists or this device's lists requires explicit
confirmation, preserves edits created during the review, and uses a transactional
revision barrier so discarded edits are not silently replayed. Only acknowledged
operations and explicitly superseded entries are removed. Account deletion stops
in-flight publishing and clears only the deleted account's journal.

Validation so far: 12 client synchronization regressions pass, the existing
frontend suite passes (230 total), 133 backend tests/health checks pass, and a
Vite production compilation with the feature enabled succeeds. The new browser
contract uses the actual backend router, JWT middleware and service with an
isolated in-memory repository. It is prepared for CI; no browser pass is assumed.
Real MongoDB transactions, concurrent deletion/TTL behavior, signed native
devices, offline restart and staging rollout remain separate acceptance checks.

The browser workflow pins the tested backend source to
`53b4c483ab43ed667af768c4d65ef8252112a17a`. Its fixture binds only to loopback,
uses generated test JWTs and never contacts a database, provider or real customer.
It must not be deployed. No continuous production sync is claimed from tests.

Roll out the compatible backend first in staging, then web preview and rebuilt
test apps. Review privacy/retention wording before enabling production. Rollback
disables both flags and rebuilds bundled clients while retaining owned lists and
receipts for reconciliation. Website deployment alone does not update installed
app bundles. See backend `docs/SHOPPING_SYNC.md` for request limits, receipt
retention and database deployment gates.
