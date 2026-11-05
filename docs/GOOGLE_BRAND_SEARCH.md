# GymDrobe external logo in Google Search

**Branding boundary:** The approved black, white, and orange square icon is used for search/browser/app identity. The existing in-store `GYMDROBE` header, footer, colors, checkout, and app interface are intentionally unchanged.

## What the source provides

- One 192×192 PNG favicon declaration (plus 16/32/48 PNG and ICO fallbacks) in `index.html`. No SVG is declared as a `rel="icon"` because Google Search's documented accepted formats do not include SVG.
- Square PNG logo source: `/brand/external/gymdrobe-app-icon-1024.png` (1024×1024). Referenced by the server-visible `OnlineStore` JSON-LD `logo.contentUrl` property as an `ImageObject`.
- The homepage `WebPage` JSON-LD declares `primaryImageOfPage` using the same approved square logo. This is an **additional preferred-image signal**, not a guarantee that Google's preview card will use it.
- Existing legacy image URLs `/gymdrobe-share-v1.png`, `/favicon.jpeg`, and `/favicon-64-v1.png` now have 308 redirects to the approved versions. Redirects are placed before `filesystem` routing to avoid exposing outdated artwork to future crawls.
- Homepage brand social preview: `/gymdrobe-share-v2.png` (1200×630); individual product pages continue prioritizing product images.
- `robots.txt` permits crawling of the homepage and static images. Vercel's route order serves files before the SPA fallback.

The logo is a **reconstruction of the approved mockup**, not an original master vector. Avoid using the complete mockup with phone and pedestal as the production logo. The long wordmark is difficult to read at tiny sizes.

## Verify after deploying the approved change

These checks require access to the actual public deployment; source checks alone cannot establish HTTP 200 or indexing.

1. Inspect the final deployed **view-source** of `https://www.gymdrobe.com/`. Confirm the favicon links and JSON-LD reflect this version. Confirm the internal site still uses the original wordmark.
2. Inspect these exact URLs in a browser or with `curl -I -L`:
   - `https://www.gymdrobe.com/favicon.ico?v=3`
   - `https://www.gymdrobe.com/favicon-48x48.png?v=3`
   - `https://www.gymdrobe.com/android-chrome-192x192.png?v=3`
   - `https://www.gymdrobe.com/brand/external/gymdrobe-app-icon-1024.png`
   - `https://www.gymdrobe.com/gymdrobe-share-v2.png`
   - `https://www.gymdrobe.com/robots.txt`
   - `https://www.gymdrobe.com/site.webmanifest?v=3`
   Each should be publicly accessible without sign-in, not a 200-status HTML fallback. PNG URLs should return an image media type; `.ico` should contain genuine ICO bytes.
   Also request `https://www.gymdrobe.com/gymdrobe-share-v1.png`, `https://www.gymdrobe.com/favicon.jpeg`, and `https://www.gymdrobe.com/favicon-64-v1.png` **without following redirects**. Confirm each returns 308 with the intended `Location`; following the redirect should return a real current image.
3. Verify the public homepage resolves consistently from `gymdrobe.com` and `www.gymdrobe.com`. Google Search uses a favicon per hostname, so retain the intended canonical `www` hostname and confirm redirect behavior externally.
4. Run `npm test`, `npm run build`, and `node scripts/verify-favicon-build.mjs` after the build. Test app icon cropping at physical favicon sizes. Inspect actual desktop and mobile UI.
5. Run [Google Rich Results Test](https://search.google.com/test/rich-results) or [Schema Markup Validator](https://validator.schema.org/) on the deployed homepage. Confirm `OnlineStore` and its image URL are parsed, without invented merchant or business information.
6. Open the verified `www.gymdrobe.com` property in [Google Search Console](https://search.google.com/search-console), use **URL Inspection** for `https://www.gymdrobe.com/`, run **Test live URL**, and request indexing if available. This must be done through an authorized account; no request is submitted by committing repository changes.
7. Check Search appearance after Google recrawls. Google may take **days to weeks** and makes the final decision whether to display a favicon or organization logo.

## What code does not control

- The generic globe icon seen on Google may reflect a previous crawl, an inaccessible favicon at the time of Google's fetch, or Google's choice to show a fallback. The screenshot **does not prove** a single root cause.
- The cropped image in the right-hand Google surface may be chosen from cached site thumbnails, brand profiles, Google Merchant Center or another source. Favicon markup alone does not change that image.
- External Google Merchant Center, Google Business Profile, Search Console, Instagram, WhatsApp Business and app-store listings each require their own account access and approval. No change to those systems is made from this repository.
- The favicon, Organization logo, and `WebPage.primaryImageOfPage` metadata **suggest** preferred visuals; they cannot guarantee Google uses them in its result card or instantly updates a thumbnail.
- Legacy images were still present in the repository, but we **cannot confirm** that one of those exact files supplied the previously cropped Google result. Redirects make future requests for those URLs resolve to new artwork.

Official guidance:
- [Google Search favicon guidelines](https://developers.google.com/search/docs/appearance/favicon-in-search)
- [Organization / OnlineStore structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Google image SEO: preferred preview image metadata](https://developers.google.com/search/docs/appearance/google-images)
