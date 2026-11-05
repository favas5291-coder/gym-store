# GymDrobe release completion — 5 November 2026

Additional service budget: ₹0. Existing approved UI, customer data and authentication remain in place. No real charge, refund, shipment, message, store submission or paid resource is authorized by this work.

| Priority | Work | Status | Evidence / dependency | Next action |
|---|---|---|---|---|
| P0 | CI/PWA/Android orchestration | Merged and deployed in PR35 | Full current web/PWA suite passed run41921256162. External Bash entry point and bounded probes preserve candidate failures. Legacy APK failed startup and invalidated the emulator in run41921256178; default current acceptance is isolated from that comparison. Shell contract covers history, cleanup, install, startup and smoke failures. | PR35 main59420fe is deployed. Current web41925099674 and Android41925099536 attempt2 passed; retain attempt1 WebView timeout as a reliability limitation. |
| P0 | Google Search identity | Merged and deployed in PR34 | Main f1d61a7 deployed successfully. Live PNG/ICO/logo/share URLs return 200 and correct dimensions/content types. Homepage metadata, robots, manifest and apex canonical checked. | Owner: Search Console live inspection and indexing request; Google controls recrawl/appearance. |
| P0 | Login and shopping | Prior release delivered; re-verification running | Account/nav/session work preserved. Real Google and physical-device acceptance are separate from fixtures. | Run current suites and retain screenshots. |
| P0 | Payment/order acceptance | 167 tests and disposable database integrations passed; provider acceptance blocked | Backend review8e61075: local167 passed; commerce41927217939, identity41927217998 and catalogue41927218091 passed. Isolated payment staging/provider configuration is missing. Prepared startup indexes also need production-data compatibility review. Do not test against production customer data. | Audit backend/test coverage and staging validation; document missing private configuration. |
| P1 | Shared shopping, push and iPhone stack | Reconciled in existing PR26; release verification running | Latest account/brand/CI merged into candidate; duplicate navigation and session merge defects corrected. 260 unit tests pass. Shared shopping/push/photo browser fixtures passed. Flags remain off. Backend aggregate is existing PR6, not deployed. | Complete current web/native CI; release only compatible frontend code with unfinished provider features off. |
| P1 | Mobile builds | Android b94ae25 passed; iPhone runner reliability under verification | iPhone1b2353f run41925113122 passed UI and push-bridge compilation. Later b94ae25 run41927206217 had a runner bootstrap kill before assertions. Compile tests before simulator boot and retain launch/resource diagnostics; no missing assertions are waived. Physical Android/iPhone, Apple signing/OAuth, provider acceptance and Razorpay privacy declaration remain external dependencies. | Produce current artifacts and separate simulator, emulator and physical evidence. |
| P0 | Supplier and policies | Business inputs required | Supplier identity/rights, accepted costs, stock, dispatch/returns, operator/tax/retention facts cannot be fabricated. | Use docs/OPERATIONS_ACCEPTANCE.md in PR26 for the five-variant evidence register, unsigned supplier terms outline, policy inputs and routing/settlement contracts. |
| P1 | Operational automation | Incomplete; depends on actual contracts | Supplier feeds, courier API, routing rules, commission and settlement costs need approved inputs. | Prepare validated contracts, configuration gates and reviewable operator drafts; do not activate unverified outbound actions. |
| Deferred | Photo search / virtual try-on | Disabled | Existing visual search is not suitable for the current free backend memory limit; try-on requires approved provider/assets/budget. | Keep unavailable honestly; no random search results or paid activation. |
| Deferred | Rewards / advertising / store publication | Not enabled | Rules/economics, release accounts and specific publication/spending authorization remain separate. | No paid or public activation in this release. |

## External owner actions

- Test the provided current APK and the mobile website on physical phones, including Google sign-in, reopen, account switching, keyboard/safe areas and interrupted checkout with staging credentials.
- Configure isolated staging database/JWT/Razorpay test secrets/webhooks privately; never paste secrets in chat or source control.
- Supply Apple Team/signing and iOS OAuth configuration, approved retention/privacy facts and device access before signed iPhone acceptance.
- Confirm actual supplier terms, five launch products/variant stock, costs and fulfilment/return responsibilities.
- Use an authorized Search Console property to inspect the deployed homepage and request indexing after publication; Google controls recrawl and displayed appearance.

A check passing in a fixture is not a real provider transaction, a simulator is not a signed iPhone build, and prepared code is not a deployed feature. This source checkpoint records the audit while release checks run. The final verification handover and PR descriptions record the resulting run/deployment IDs; older PROJECT_STATUS.md evidence remains historical.

## Build-tool maintenance

The audit also found development-tool advisories. Vite is patched within the existing 8.2 line to 8.2.4; allowed transitive updates use rimraf6.1.4, glob14.0.3, minimatch11.0.4 and source-map-js1.2.2. The candidate audit reports zero known vulnerabilities and its 216-file source check, 260 tests and production build pass. No force update or major framework/native upgrade was used. The full web workflow gets 30 minutes because observed package installation consumed most of the previous 15-minute limit; all assertions remain mandatory and FFmpeg installation omits optional recommended packages.

## Production backend follow-up

Separate production PR9 (dependency patches,112 tests) and PR10 (API no-store policy,113 tests) passed their CI and deployed to the existing free Render service. Main is da509135; the staged Apple/shopping/push/index/visual-search aggregate remains a draft. The aggregate incorporates both production fixes and passes167 tests with zero known dependency advisories.
