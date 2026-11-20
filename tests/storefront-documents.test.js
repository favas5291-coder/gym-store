import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { productMetadata, getImages, listingFilters, LISTING_FILTER_KEYS } from "../src/utils/seoMetadata.js";
import { metadataHtml, publicCatalogueSnapshot, writeStorefrontDocuments } from "../scripts/storefront-documents.mjs";
const origin = "https://www.gymdrobe.com", id = "6ad2351ed8f991271e3d1a8b";
const product = { id, slug: "compression-tee-" + id, name: 'Training tee "A"', description: "<p>A real product description.</p>", brand: "Fixture Brand", image: "https://images.example.test/tee.jpg", price: 1000, discount: 30.1, stock: 5, supplierCost: 200, supplierLink: "private-source-marker" };
const template = '<!doctype html><html><head><title>GymDrobe homepage</title><meta name="description" content="home"><meta property="og:title" content="home"><meta property="og:image:width" content="1942"><meta name="twitter:image" content="home.png"><link rel="canonical" href="https://old.example.test"><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';
test("product document contains specific canonical sharing data without mutable offers or private fields", () => {
  const meta = productMetadata(product, origin), output = metadataHtml(template, meta);
  assert.ok(output.includes('Training tee &quot;A&quot; | GymDrobe'));
  assert.ok(output.includes(`rel="canonical" href="${origin}/product/${id}"`));
  assert.ok(output.includes('property="og:image" content="https://images.example.test/tee.jpg"'));
  assert.equal((output.match(/property="og:title"/g) || []).length, 1);
  assert.ok(!output.includes("og:image:width"), "Do not apply the wordmark's dimensions to a product photo");
  assert.ok(!JSON.stringify(meta).includes("supplierCost")); assert.ok(!JSON.stringify(meta).includes("private-source-marker"));
  assert.equal(meta.schema.offers, undefined); assert.equal(meta.schema.aggregateRating, undefined);
  assert.ok(output.includes('src="/assets/app.js"')); assert.ok(output.includes('<div id="root"></div>'));
});
test("untrusted product copy and JSON-LD cannot close the head or execute markup", () => {
  const meta = productMetadata({ ...product, name: 'A </script><script>alert("x")</script> & tee', description: '"><img src=x onerror=alert(1)>' }, origin);
  const html = metadataHtml(template, meta);
  assert.ok(!html.includes('<script>alert("x")'));
  assert.ok(!html.includes('<img src=x'));
  const match = html.match(/id="gymdrobe-product-schema" type="application\/ld\+json">([^]*?)<\/script>/);
  assert.ok(match); assert.equal(JSON.parse(match[1]).name, meta.schema.name);
});
test("unsafe image URLs are excluded and a missing image uses the approved wordmark", () => {
  const value = { ...product, image: "javascript:alert(1)", images: ["https://user:password@images.example.test/secret", "data:image/png;base64,abc", "https://images.example.test/tee.jpg", "https://images.example.test/tee.jpg"] };
  assert.deepEqual(getImages(value, origin), ["https://images.example.test/tee.jpg"]);
  assert.equal(productMetadata({ ...value, images: [] }, origin).image, origin + "/gymdrobe-share-v2.png");
});
test("catalogue export requires safe unique IDs and unambiguous product aliases", () => {
  const snapshot = publicCatalogueSnapshot(origin, [product, { ...product, id: "inactive", slug: "inactive", isActive: false }]);
  assert.equal(snapshot.entries.length, 2); assert.equal(snapshot.entries[1].metadata.canonical, `${origin}/product/${id}`);
  for (const bad of ["../outside", "../index.html", "a/b", "", "<script>"]) assert.throws(() => publicCatalogueSnapshot(origin, [{ ...product, id: bad }]));
  assert.throws(() => publicCatalogueSnapshot(origin, [product, { ...product, id: "other-id" }]));
  assert.throws(() => publicCatalogueSnapshot(origin, [product, product]));
});
test("actual file generator preserves the app bundle and writes only known public documents", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gymdrobe-seo-"));
  try {
    await fs.writeFile(path.join(directory, "index.html"), template);
    const count = await writeStorefrontDocuments({ directory, snapshot: publicCatalogueSnapshot(origin, [product]) });
    assert.equal(count, 7);
    for (const route of [id, product.slug]) {
      const html = await fs.readFile(path.join(directory, "product", route), "utf8");
      assert.ok(html.includes('content="product"')); assert.ok(html.includes('src="/assets/app.js"'));
      assert.ok(html.includes(`href="${origin}/product/${id}"`));
    }
    assert.ok((await fs.readFile(path.join(directory, "index.html"), "utf8")).includes(`href="${origin}/"`));
    await assert.rejects(fs.access(path.join(directory, "orders")));
    await assert.rejects(fs.access(path.join(directory, "product", "unknown")));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test("missing catalogue snapshot fails the metadata build rather than silently reusing stale content", async () => {
  await assert.rejects(writeStorefrontDocuments({ snapshot: {} }), /Regenerate/);
  assert.throws(() => metadataHtml("<html>missing head</html>", {}), /head/);
});
test("Vercel keeps the filesystem before SPA fallback and identifies public HTML and private noindex routes", async () => {
  const { routes } = JSON.parse(await fs.readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(routes.findIndex(route => route.handle === "filesystem") < routes.findIndex(route => route.dest === "/storefront-shell.html"));
  const document = routes.find(route => route.headers?.["Content-Type"]);
  assert.ok(new RegExp(document.src).test(`/product/${id}`)); assert.ok(!new RegExp(document.src).test("/shop.js"));
  const privateRoute = routes.find(route => route.headers?.["X-Robots-Tag"] && !route.has);
  for (const route of ["/account", "/orders/private-order", "/admin/orders", "/checkout"]) assert.ok(new RegExp(privateRoute.src).test(route));
  assert.ok(!new RegExp(privateRoute.src).test(`/product/${id}`));
  assert.ok(routes.some(route => route.status === 308 && new RegExp(route.src).test(`/product/${id}/`)));
});

test("stocked collection documents publish scoped product links and breadcrumbs", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gymdrobe-collections-"));
  const route = "/collections/compression-t-shirts";
  const snapshot = publicCatalogueSnapshot(origin, [
    { ...product, category: "Compression T-shirt" },
    { ...product, id: "hidden", slug: "hidden", category: "BAG", isActive: false },
    { ...product, id: "other", slug: "other", category: "Protein" },
  ]);
  try {
    const appTemplate = template.replace('id="root"', 'id="app"');
    await writeStorefrontDocuments({ directory, snapshot, template: appTemplate });
    const collection = await fs.readFile(path.join(directory, route.slice(1)), "utf8");
    assert.ok(collection.includes(`rel="canonical" href="${origin}${route}"`));
    assert.match(collection, /<noscript>.*<h1>Compression T-shirts<\/h1>/);
    assert.ok(collection.includes(`href="/product/${id}"`));
    assert.doesNotMatch(collection, /\/product\/(other|hidden)/);
    const jsonLd = JSON.parse(collection.match(/id="gymdrobe-breadcrumb-schema" type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(jsonLd["@type"], "BreadcrumbList");
    assert.equal(jsonLd.itemListElement.at(-1).item, origin + route);
    const home = await fs.readFile(path.join(directory, "index.html"), "utf8");
    assert.ok(home.includes(`href="${route}"`));
    await assert.rejects(fs.access(path.join(directory, "collections/gym-bags")));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});


test("Shop preview contains only public product links and images from the build snapshot", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gymdrobe-shop-preview-"));
  try {
    const snapshot = publicCatalogueSnapshot(origin, [
      product,
      { ...product, id: "hidden", slug: "hidden", name: "Hidden product", isActive: false },
    ]);
    await writeStorefrontDocuments({ directory, snapshot, template });
    const shop = await fs.readFile(path.join(directory, "shop"), "utf8");
    const payload = shop.match(/<script id="gymdrobe-shop-preview" type="application\/json">(.*?)<\/script>/);
    assert.ok(payload);
    assert.deepEqual(JSON.parse(payload[1]), { observedAt: snapshot.observedAt, items: [
      { name: product.name, path: `/product/${id}`, image: product.image },
    ] });
    const home = await fs.readFile(path.join(directory, "index.html"), "utf8");
    const detail = await fs.readFile(path.join(directory, "product", id), "utf8");
    assert.doesNotMatch(home + detail, /gymdrobe-shop-preview/);
    assert.doesNotMatch(payload[1], /supplierCost|supplierLink|price|stock|Hidden product/);
    const hostile = metadataHtml(template, { ...productMetadata(product, origin), shopPreview: {
      observedAt: snapshot.observedAt, items: [{ name: "</script><img src=x>" }],
    } });
    assert.doesNotMatch(hostile, /<img src=x>/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("initial HTML scopes homepage identity, serves app instructions, and separates dynamic routes from 404s", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gymdrobe-brand-search-"));
  try {
    const template = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
    const snapshot = publicCatalogueSnapshot(origin, [{ ...product, legacyId: 123, category: "Compression T-shirt" }]);
    await writeStorefrontDocuments({ directory, snapshot, template });
    const read = file => fs.readFile(path.join(directory, file), "utf8");
    const [home, install, legacy, shell, missing] = await Promise.all(
      ["index.html", "install", "product/123", "storefront-shell.html", "404.html"].map(read),
    );
    assert.match(home, /<title>GymDrobe \| Gym Wear, Workout Clothing &amp; Fitness Gear<\/title>/);
    for (const marker of ["gymdrobe-opening", "home-boot-template", "gymdrobe-logo-visible"]) {
      assert.ok(home.includes(marker));
      for (const page of [install, legacy, shell, missing]) assert.ok(!page.includes(marker));
    }
    for (const page of [home, install, legacy, shell, missing]) {
      assert.ok(page.includes('<div id="app"></div>'));
      assert.ok(!page.includes("<!-- home-entry -->"));
    }
    assert.equal([...home.matchAll(/id="gymdrobe-site-schema"/g)].length, 1);
    const graph = JSON.parse(home.match(/id="gymdrobe-site-schema"\s+type="application\/ld\+json"\s*>(.*?)<\/script>/s)[1])["@graph"];
    const website = graph.find(node => node["@type"] === "WebSite");
    const store = graph.find(node => node["@type"] === "OnlineStore");
    assert.equal(website.url, origin + "/");
    assert.deepEqual(website.alternateName, ["GymDrobe Store", "gymdrobe.com"]);
    assert.deepEqual(website.publisher, { "@id": store["@id"] });
    assert.equal(store.logo.contentUrl, origin + "/brand/external/gymdrobe-app-icon-1024.png");
    assert.match(home, /href="\/install">Install the GymDrobe web app/);
    assert.match(install, /<link rel="canonical" href="https:\/\/www\.gymdrobe\.com\/install"/);
    assert.match(install, /<noscript>.*Add to Home Screen/);
    assert.match(legacy, /gymdrobe-breadcrumb-schema/);
    assert.ok(legacy.includes(`href="${origin}/product/${id}"`));
    assert.match(legacy, /<img src="https:\/\/images\.example\.test\/tee\.jpg"/);
    assert.doesNotMatch(install + legacy + shell + missing, /id="gymdrobe-site-schema"/);
    assert.doesNotMatch(shell, /rel="canonical"|name="robots"|<noscript>/);
    assert.match(missing, /name="robots" content="noindex, follow"/);
    assert.doesNotMatch(missing, /rel="canonical"/);

    const { routes } = JSON.parse(await fs.readFile(new URL("../vercel.json", import.meta.url), "utf8"));
    const rewrites = routes.slice(routes.findIndex(route => route.handle === "filesystem") + 1);
    const resolve = url => rewrites.find(route => new RegExp(route.src, "i").test(url));
    for (const url of ["/product/new-id", "/order-success", "/reset-password", "/orders/123/return", "/kits/123", "/search", "/categories", "/checkout", "/admin/marketplace/listings"]) {
      assert.equal(resolve(url).dest, "/storefront-shell.html", url);
    }
    assert.equal(resolve("/no-such-page").status, 404);
    assert.equal(resolve("/collections/no-such-category").status, 404);
    assert.equal(resolve("/api/products"), undefined);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("filter noindex rules match storefront controls and leave campaign URLs indexable", async () => {
  const { routes } = JSON.parse(await fs.readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const filesystem = routes.findIndex(route => route.handle === "filesystem");
  const filters = routes.slice(0, filesystem).filter(route => route.has && route.headers?.["X-Robots-Tag"]);
  assert.deepEqual(filters.map(route => route.has[0].key), LISTING_FILTER_KEYS);
  const getHeader = url => {
    const { pathname, searchParams } = new URL(url, origin);
    return filters.find(rule => new RegExp(rule.src).test(pathname) &&
      rule.has.every(({ key }) => searchParams.has(key)))?.headers["X-Robots-Tag"];
  };
  for (const url of ["/shop?search=shirt", "/shop?brandKey=lift%2C+inc", "/shop?category=Joggers", "/collections/gym-bags?sort=price", "/shop?utm_source=profile&size=M"]) {
    assert.equal(getHeader(url), "noindex, follow", url);
    assert.ok(listingFilters(new URL(url, origin).searchParams).length);
  }
  for (const url of ["/shop", "/shop?utm_source=profile&fbclid=test", "/collections/gym-bags?gclid=test", "/product/123?size=M"]) {
    assert.equal(getHeader(url), undefined, url);
  }
  assert.deepEqual(listingFilters(new URLSearchParams("utm_source=profile&unknown=1")), []);
  const index = routes.find(rule => new RegExp(rule.src).test("/index.html"));
  assert.equal(index.status, 308);
  assert.equal(index.headers.Location, "/");
});

test("no-script Shop includes canonical links for products outside curated collections", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gymdrobe-shop-crawl-"));
  try {
    const appTemplate = template.replace('id="root"', 'id="app"');
    const snapshot = publicCatalogueSnapshot(origin, [
      { ...product, category: "Gym Gloves" },
      { ...product, id: "hidden", slug: "hidden-slug", isActive: false },
    ]);
    await writeStorefrontDocuments({ directory, snapshot, template: appTemplate });
    const html = await fs.readFile(path.join(directory, "shop"), "utf8");
    const fallback = html.match(/<noscript>(.*?)<\/noscript>/s)[1];
    assert.ok(fallback.includes(`href="/product/${id}"`));
    assert.ok(!fallback.includes(product.slug));
    assert.doesNotMatch(fallback, /hidden-slug|private-source-marker/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
