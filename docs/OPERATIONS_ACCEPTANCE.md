# Launch operations — owner completion draft

Prepared 5 November 2026. Internal review only; not a supplier agreement, published customer policy, tax opinion or evidence of supplier acceptance. Existing catalogue records and displayed availability do not establish physical stock, product rights or fulfilment commitments.

## Facts and release boundaries

- The storefront and production API exist. The supplier-onboarding UI/API foundation is gated; it does not implement live supplier inventory feeds, automated purchase orders or settlements.
- Payment/refund/order tests use fixtures and disposable databases. No controlled supplier dispatch, actual delivery, provider settlement or supplier payout was completed in this continuation.
- No supplier's identity, accepted commercial terms, licensed product artwork, actual stock, commission rate, invoice/tax treatment or delivery promise has been verified here.
- Do not publish new policy promises or activate outbound routing until the responsible owner approves the facts below. No external message, contract acceptance, shipment or payout is triggered by this document.

## Five-product launch register

The owner must select five actual catalogue products and attach current, supplier-confirmed evidence. A photo or catalogue price is insufficient. Complete a row for every sellable size/colour/SKU, rather than a single total for a product.

| Slot | Catalogue ID and variant SKU | Supplier legal identity and rights evidence | Confirmed available stock and timestamp | Accepted cost and who pays each cost | Dispatch, courier and returns owner | Approval |
|---|---|---|---|---|---|---|
| 1 | Pending owner selection | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Not ready |
| 2 | Pending owner selection | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Not ready |
| 3 | Pending owner selection | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Not ready |
| 4 | Pending owner selection | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Not ready |
| 5 | Pending owner selection | Unconfirmed | Unconfirmed | Unconfirmed | Unconfirmed | Not ready |

Record evidence location, supplier approver, offer revision and explicit acceptance date. Do not infer acceptance from an invitation, a draft offer, supplier application or earlier discussion.

## Supplier terms outline — fill and review before offering

1. **Parties and authority:** legal names, addresses, authorized representatives and product/image rights; verification method and evidence.
2. **Commercial model:** identify the seller of record, invoice issuer, supplier purchase-price model or commission basis, accepted rate, included/excluded taxes, discount funding and every cost payer. No default rate is proposed.
3. **Stock and acceptance:** exact variants, stock-reservation ownership, update frequency, stale-feed limit, order acceptance/rejection deadline and oversell resolution.
4. **Fulfilment:** dispatch location, packaging, courier booking and cost owner, serviceability, tracking source, lost/damaged parcel responsibility and escalation contact. Delivery estimates require evidence.
5. **Returns and refunds:** eligible purchased policy, request window, exclusions, inspection, return shipping, restocking, payment-provider fees, refund approval and customer contact owner. Resolve failed deliveries and COD advance treatment explicitly.
6. **Settlement and corrections:** event that earns a payable amount, hold/reserve conditions, reconciliation evidence, payout timing, cancelled/refunded orders, disputes and negative corrections. Specify approval and audit retention.
7. **Data and termination:** minimum customer data shared, permitted purpose/access, retention/deletion, breach escalation, suspension and treatment of already accepted orders.

Business owner and appropriate professional review are required before signature or publication. The outline accepts no terms on anyone's behalf.

## Safe inventory and order-routing contract

Supplier feed input should carry a stable supplier ID, variant SKU, absolute available-to-sell quantity, source timestamp and monotonic revision/event ID. Validate supplier ownership, nonnegative integer stock and recognized variants; reject stale/conflicting updates. Quarantine unknown SKUs and retain a reconciliation record. Confirm whether supplier quantities already exclude reservations before implementing arithmetic.

Order-routing input should use the backend's immutable order/parcel ID and verified payable/accepted state, never a browser price or a client-only success callback. Use a unique handoff key per eligible parcel. States should distinguish pending, accepted, rejected and uncertain. An uncertain external response requires reconciliation; a blind retry can create a second supplier order. Provide an operator stop, audit trail and manual resolution before activation.

These are implementation/acceptance contracts, **not connected feeds or a running routing service**. Required inputs: actual channel/API specification, test credentials configured privately, supplier acceptance rules and a controlled recipient. Customer/supplier messages require separate explicit authorization.

## Settlement and contribution worksheet contract

Keep separate fields for collections, refunds, merchant revenue, supplier payable, commission earned (where contractually applicable), shipping, packaging, provider fees, return/RTO costs, marketing, taxes and corrections. Preserve order, parcel, provider and settlement identifiers and reconcile settlement totals to bank/provider evidence.

- Net collections = collections minus customer refunds. Collections are not profit.
- For a resale model, contribution before overhead uses verified revenue on the approved tax basis minus supplier/product cost and attributable costs.
- For a commission model, contribution uses earned commission and other contractually earned revenue minus attributable costs. Do not also count the supplier's gross product value as GymDrobe revenue.
- Missing model, tax basis, rate or cost must produce **Unconfirmed**, not zero, positive margin or "profit". Net profit also requires complete operating costs and accounting review.

No automated payout or final accounting report is enabled. The owner/accountant supplies the commercial model, invoice/tax basis, verified costs and provider reconciliation data.

## Customer policy publication worksheet

| Draft area | Facts that must be approved before publication | Responsible input |
|---|---|---|
| Operator/contact | Legal operator, address, registration/tax facts where applicable, monitored support channels and escalation responsibility | Owner / professional reviewer |
| Shipping | Verified serviceable areas, dispatch time, carrier responsibility, charges and estimate basis | Owner + supplier/courier |
| Returns/refunds | Purchased-policy eligibility/window/exclusions, return address/cost, inspection, refund method/timing and COD advance rules | Owner + supplier + provider |
| Privacy/deletion | Actual collected data/processors/purposes, optional notifications, financial retention, deletion exceptions and request handling | Owner / privacy reviewer |
| Supplier terms | Accepted version, rights, costs, fulfilment, returns, settlement and termination | Owner + each supplier |

Use approved answers to update existing policy pages. Do not replace unknowns with generic promises. Backend policy snapshots must preserve the terms purchased with an order when policy text later changes.

## Controlled acceptance after inputs arrive

1. Configure isolated staging as described in the backend `docs/PAYMENT_STAGING.md`; validate isolation, required indexes and test-mode provider authentication.
2. Use synthetic customer/address and controlled variants. Complete payment success/failure/cancellation/interruption/duplicate/replay/stock-conflict/refund cases. Retain redacted evidence.
3. Review one supplier handoff and reconciliation in a non-sending dry run. Actual dispatch, contact or shipment remains a separately authorized operation.
4. Reconcile verified fees/costs and refund/settlement corrections without labeling collections as profit.
5. Approve accurate policies and a responsible operator before activating any routing, inventory sync, supplier access or payout feature.
