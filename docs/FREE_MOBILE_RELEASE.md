# Free mobile navigation release

Based directly on production main 935e09a. Adds the five shared shopping tabs, categories/text-search routes, cart quantities, active states, bottom safe-area and fixed-control spacing. Desktop navigation and existing backend/account/payment behaviour are preserved.

Photo search is deferred: no camera button, upload flow, new native plugin or model service is added by this release. The complete implementation remains saved in the launch and backend staging branches. No new hosting resource, recurring charge, database change or paid plan is required.

Rebuild installed Android apps to receive bundled UI changes. iPhone release/signing and physical-device testing remain separate; production main does not yet contain the iPhone launch stack.
