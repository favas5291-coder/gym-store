# GymDrobe 1.2 — fitting room

Added a product-page fitting room with a real FASHN server adapter, consented photo uploads, before/after comparison, downloadable output and photo removal. Added a supplier-range size finder with cm/inches, explicit no-match/missing-data states, stock checks and size selection.

Photos and credentials were not supplied. The customer interface does not fake generation; configuration instructions are in `TRY-ON-SETUP.md`. The new tests use a mock provider and synthetic fixtures. Real image quality and garment fit still need live validation.

# GymDrobe 1.1 changes

This package addresses functional failures in the previous storefront while retaining its customer pages and original catalogue.

| Problem | Replacement behaviour |
|---|---|
| An open tab kept an old bag after another tab changed it | Storage updates synchronize bag and wishlist; cart edits read the latest stored state |
| Different preview accounts shared shopping lists | Bags, saved items, wishlist, comparison and watches use account keys; guest lists import once |
| Buy now could keep rejecting an old price | The item refreshes from the current catalogue and the customer reviews the changed total |
| Checkout could repeat the same saved attempt | An attempt token identifies an already-created order; supported browsers serialize commits with Web Locks |
| Order creation could lose items on a save failure | Saving is checked before the selected bag rows are removed |
| Selecting another category replaced the first | Multiple categories work together, with separate removable filter chips |
| “tee” search and suggestions differed | Catalogue search and navigation suggestions share normalization and aliases |
| Adding an item gave no direct route to checkout | Success feedback includes View bag & checkout |
| Wishlist controls overflowed on narrow screens | Search and sort wrap within the available width |
| Missing assets looked broken | Labelled product illustrations and a campaign fallback display until original photos are restored |
| Windows install/import errors were hard to diagnose | A start script and project doctor check the setup and missing local files |

## Evidence

`npm run check` runs the import doctor, 28 logic tests and production build. `tests/browser.mjs` exercises 12 customer-flow scenario groups; its successful report and screenshots are included in `test-results`.

The tests verify the browser-local preview. Live commerce still requires backend accounts, shared inventory, payment and courier services.