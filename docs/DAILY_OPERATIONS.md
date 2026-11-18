# Daily operations report

An active administrator can open **Admin → Daily operations**, choose the Indian calendar date on which orders were created and select **Load daily report**. The dashboard's real/test order filter applies to the report. Changing either filter clears the previous result. Each request reads current order and supplier fulfilment status, so a later refund changes that order date's figures.

Amounts use INR. When some orders lack recorded values, the figure includes only known amounts and displays the number missing. When every relevant order lacks the amount, the report shows “Unavailable”. A zero with full coverage means the recorded amount is zero or the cohort has no eligible orders. Customer COD collections may include advances. The API has no courier remittance statement or complete cost basis for net profit.

The panel is off by default. For an approved staging rollout, use the daily operations API from backend PR #22, provision its documented supporting index, and verify the authenticated endpoint. Build the storefront with `VITE_DAILY_OPERATIONS_ENABLED=true`. To hide the panel again, rebuild with the flag unset. The general accounts dashboard loads independently.

Run `node tests/daily-operations-browser.mjs` with the repository's Playwright test tooling installed. The browser check uses isolated fixtures.
