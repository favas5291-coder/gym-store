# Product sharing metadata

Read-only production reproduction: Home and a real product URL both returned
the homepage title/Open Graph title in raw HTML, without a canonical link or
product JSON-LD. Client JavaScript later corrected the product page, which does
not help link-preview crawlers that do not run JavaScript.

The website build now exports public HTML documents for active product IDs and
their safe slug aliases, plus Home/Shop/Offers/Help. These preserve the same
compiled React app, assets, PWA behavior and canonical product-ID URLs. The
existing Vercel filesystem handler serves known files before the SPA fallback;
unknown/new routes still reach the existing app. Explicit HTML headers cover the
extensionless document files. Trailing document slashes redirect to the same
path without a slash. Customer/admin routes get an HTTP noindex header.

Only public descriptive fields are exported. Price, stock, return/shipping offers
and review aggregates are not frozen into HTML snapshots. The client retains its
existing fresh API-derived offer markup and server-authoritative checkout.
Private supplier costs, contacts and sourcing URLs are not included. Copy/URLs
and JSON-LD are escaped. Unsafe IDs/ambiguous aliases stop the build.

The complete API read already required for the sitemap supplies the metadata
snapshot; no extra product fetch is added to a customer request. A full website
build is required after product name/image/description, activation or slug edits.
Price/stock changes continue to use the existing live API. New/unbuilt products
fall back to the React app until rebuild; missing products still use the client's
not-found/noindex behavior. Raw HTTP status handling for unknown SPA product
routes and dedicated category landing pages remain separate improvements.

Tests cover the raw-HTML reproduction, escaping, canonical aliases, private-field
exclusion, safe paths and actual generated files. CI checks the built catalogue
documents. A hosting preview must still verify real extensionless Content-Type,
trailing-slash routing, fresh API markup, PWA and share previews before production.
Search Console indexing/rich-result acceptance and social debugger cache refresh
require the owner's tools/access. A build passing is not a live SEO ranking claim.

Rollback restores the prior build/configuration together. No backend/customer
data migration occurs. Native builds keep their bundled app shell and receive
this shared helper only through a new app build; website exports do not update
an already installed application.
