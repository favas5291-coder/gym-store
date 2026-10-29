import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { productMetadata, getImages } from "../src/utils/seoMetadata.js";
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
  assert.equal(productMetadata({ ...value, images: [] }, origin).image, origin + "/gymdrobe-share-v1.png");
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
    assert.equal(count, 6);
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
  assert.ok(routes.findIndex(route => route.handle === "filesystem") < routes.findIndex(route => route.dest === "/index.html"));
  const document = routes.find(route => route.headers?.["Content-Type"]);
  assert.ok(new RegExp(document.src).test(`/product/${id}`)); assert.ok(!new RegExp(document.src).test("/shop.js"));
  const privateRoute = routes.find(route => route.headers?.["X-Robots-Tag"]);
  for (const route of ["/account", "/orders/private-order", "/admin/orders", "/checkout"]) assert.ok(new RegExp(privateRoute.src).test(route));
  assert.ok(!new RegExp(privateRoute.src).test(`/product/${id}`));
  assert.ok(routes.some(route => route.status === 308 && new RegExp(route.src).test(`/product/${id}/`)));
});
