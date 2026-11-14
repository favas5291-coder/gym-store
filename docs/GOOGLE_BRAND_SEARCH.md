# GymDrobe branded search

The canonical origin is `https://www.gymdrobe.com`. The homepage declares GymDrobe as its preferred site name through WebSite structured data. The linked OnlineStore entity uses the square green and cream logo. The web app's install page is at `/install` and gives browser-based installation instructions for iPhone, iPad and Android.

## Keyword and page map

| Search intent | Canonical page |
| --- | --- |
| GymDrobe, GymDrobe website, GymDrobe official | `/` |
| Gym wear India, workout clothing, fitness essentials | `/shop` |
| Gym T-shirts, men's and women's compression tops | `/collections/compression-t-shirts` |
| Gym joggers, training track pants | `/collections/gym-joggers` |
| Gym bags, training duffels | `/collections/gym-bags` |
| GymDrobe app, install GymDrobe | `/install` |
| Product model, brand and size queries | The corresponding canonical `/product/<id>` |

The current apparel selection supports a combined compression T-shirt or jogger collection. Keep separate men's and women's landing pages on hold until each has enough products and distinct shopping information.

## Production and Search Console

1. Verify the homepage, `/install`, `/shop`, the collection pages and a product from the sitemap. Check HTTP status, canonical, initial HTML and JSON-LD. Confirm an invented URL returns 404, checkout returns `X-Robots-Tag: noindex, follow`, and the favicon and logo return image bytes.
2. Open [Search Console](https://search.google.com/search-console) and select the verified GymDrobe domain property. In **Sitemaps**, submit `https://www.gymdrobe.com/sitemap.xml` if it has not already been submitted. If the existing entry is successful, keep it and check its last read date.
3. Inspect `https://www.gymdrobe.com/` and `https://www.gymdrobe.com/install`. Run **Test live URL** and **Request indexing** for each if the live test succeeds. Record Google-selected canonical and the last crawl date when available. Use **Page indexing** for exclusions and **Performance** for clicks, impressions and position on branded queries filtered to India.
4. Use the [Schema Markup Validator](https://validator.schema.org/) for the homepage and [Rich Results Test](https://search.google.com/test/rich-results) for product eligibility. The site's product offers are updated from live catalogue data in the browser. Size does not have a preselected URL, so the site does not publish ProductGroup markup for all size and colour combinations.
5. Submit the same sitemap through [Bing Webmaster Tools](https://www.bing.com/webmasters/) if the property is available and check URL Inspection there.

## Public profiles and app listing copy

Use **GymDrobe** as the profile name on official Instagram, Facebook, YouTube and LinkedIn profiles where applicable. Use the green and cream square wordmark and link to `https://www.gymdrobe.com/`. Suggested bio: “Gym clothing, workout gear and fitness essentials. Shop GymDrobe online in India.” Add each URL to OnlineStore `sameAs` once control and the official link are verified.

Native listing title: **GymDrobe**. Short description: “Shop gym wear, training bags and fitness essentials in India.” Full description: “Find gym clothing, workout accessories and training essentials from multiple brands. Browse products by category, compare colours and sizes, save favourites and check your orders.” Use the official homepage and `/help` as website and support URLs. Publish store links when the public listings resolve. Verify Apple associated domains with the distribution Team ID and Android App Links with the release signing fingerprint before advertising those links.

## 30, 60 and 90 days

- **30 days:** Track branded queries and homepage canonical selection weekly. Update profiles you control and publish the first gym-owner interview with a link to the relevant collection.
- **60 days:** Compare clicks and impressions for the T-shirt, jogger and gym-bag pages. Add real sizing, fabric and capacity details where shoppers need them. Link trainer demonstrations to the products used.
- **90 days:** Compare branded traffic and indexed product pages with the baseline. Expand collection coverage where assortment and customer demand support a distinct page. Link native listings only after public launch.
