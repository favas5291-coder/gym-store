# Supplier marketplace implementation tracker

Budget: ₹0 additional services. Extend the existing Supplier, User, Product, Order and Razorpay workflows. Do not activate production marketplace operations until isolated database/provider/configuration acceptance is complete. Never perform a real transfer or message as a test.

| Priority | Work | Current status | Evidence / dependency | Next action |
|---|---|---|---|---|
| P0 | Existing project audit | Complete | Main frontend bf53db0; backend da509135. Existing supplier onboarding is gated and has no catalogue/order/banking/settlement implementation. | Extend existing records and shared clients; preserve customer auth/navigation. |
| P0 | Monetary model | Implementing | Agreed supplier amount and admin selling amount in integer paise; ₹500/₹550 yields ₹50 markup before expenses. | Add exact allocation, price audit, discount/loss guards and immutable order snapshots. |
| P0 | Supplier identity and permissions | Implementing | Reuse existing User authentication and Supplier identity; brands remain product/profile concepts. | Invitation activation, owner-scoped APIs, suspension and reauthentication. |
| P0 | Catalogue review | Pending | Reuse actual Product catalogue, with proposed changes separate from live content. | Draft/submission/review/publish, exact variant pricing and routine stock updates. |
| P0 | Orders and settlement | Pending | Existing Razorpay/stock/returns remain authoritative. | Private item snapshots, supplier fulfilment groups, collection/return-dependent earnings and atomic manual payout recording. |
| P1 | Responsive dashboards | Pending | Existing branding and React/Capacitor shared application. | Build supplier/admin forms, data/error/empty states and route integration. |
| P0 | Verification and release | Pending | Isolated synthetic fixtures only; no production data changes. | Unit/security/database/browser checks, guides, migration audit and gated release. |
| External | Real provider/device/business acceptance | Blocked until supplied | Staging replica set, restricted credentials, private encryption key, actual supplier terms/stock/payment destination and device/provider acceptance. | Document exact setup; no invented agreements or paid services. |
