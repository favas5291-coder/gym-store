# Standard cash on delivery

The storefront previously routed COD through Razorpay for a 10% advance. A build with `VITE_STANDARD_COD_ENABLED=true` offers cash on delivery for ordinary products with ₹0 due online. The order value and delivery charge are payable together at delivery. Fitness kits remain prepaid in this build.

## Staging check

1. Deploy the matching backend to staging. Set `STANDARD_COD_ENABLED=true` and list the courier-confirmed destinations in `STANDARD_COD_PINCODES`.
2. Build the staging storefront with `VITE_STANDARD_COD_ENABLED=true` and its staging API URL.
3. Try a covered pincode, an uncovered pincode and a kit. Verify covered guest and account orders show the full recorded order total due, an order confirmation and no Razorpay requests. Uncovered customers can choose prepaid.
4. Retry a submitted order after losing the first response. Check the token, order number, stock movement and supplier allocation for duplicates.
5. For a staged delivery, verify the collectable balance and confirm the collection only after receiving it. Review the resulting receipt and staff or supplier balances. Historical advance-paid orders should retain their original amounts.

## Rollback

Build the storefront without the feature flag to return new checkouts to the existing advance flow. Keep order history, unpaid balances and historical checkout credentials accessible. Reconcile submitted attempts against the backend before recreating an order. Production activation requires verified courier coverage and staging sign-off.
