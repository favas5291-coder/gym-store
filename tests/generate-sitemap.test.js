import assert from "node:assert/strict";
import test from "node:test";
import { buildSitemap } from "../scripts/generate-sitemap.mjs";

test("buildSitemap includes fixed routes and active product routes", () => {
  const sitemap = buildSitemap("https://gymdrobe.com", [
    { id: "shirt-1" },
    { _id: 42 },
    { id: "inactive", isActive: false },
  ]);

  assert.match(sitemap, /<loc>https:\/\/gymdrobe\.com\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/gymdrobe\.com\/shop<\/loc>/);
  assert.match(
    sitemap,
    /<loc>https:\/\/gymdrobe\.com\/product\/shirt-1<\/loc>/,
  );
  assert.match(
    sitemap,
    /<loc>https:\/\/gymdrobe\.com\/product\/42<\/loc>/,
  );
  assert.doesNotMatch(sitemap, /product\/inactive/);
});

test("buildSitemap URL-encodes product IDs", () => {
  const sitemap = buildSitemap("https://gymdrobe.com", [
    { id: "item&one" },
  ]);

  assert.match(
    sitemap,
    /<loc>https:\/\/gymdrobe\.com\/product\/item%26one<\/loc>/,
  );
});

test("buildSitemap rejects invalid origins and product catalogs", () => {
  assert.throws(
    () => buildSitemap("http://gymdrobe.com", []),
    /public HTTPS origin/,
  );
  assert.throws(
    () => buildSitemap("https://gymdrobe.com", {}),
    /catalog must be an array/,
  );
  assert.throws(
    () => buildSitemap("https://gymdrobe.com", [{ name: "Shirt" }]),
    /missing its canonical ID/,
  );
});

test("sitemap lists only canonical collection URLs with an active product", () => {
  const xml = buildSitemap("https://www.gymdrobe.com", [
    { id: "tee", category: "Compression T-shirt" },
    { id: "hidden-bag", category: "BAG", isActive: false },
  ]);
  assert.match(xml, /<loc>https:\/\/www\.gymdrobe\.com\/collections\/compression-t-shirts<\/loc>/);
  assert.doesNotMatch(xml, /gym-bags|hidden-bag|\?category/);
});

test("sitemap includes the web app and policy with verified product modification dates only", () => {
  const xml = buildSitemap("https://www.gymdrobe.com", [
    { id: "recent", updatedAt: "2026-11-13T09:30:00.000Z" },
    { id: "bad-date", updatedAt: "2026-02-31T00:00:00.000Z" },
    { id: "future", updatedAt: "2026-11-16T09:30:00.000Z" },
  ], Date.parse("2026-11-14T00:00:00.000Z"));
  assert.match(xml, /<loc>https:\/\/www\.gymdrobe\.com\/install<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.gymdrobe\.com\/shipping-and-returns\.html<\/loc>/);
  assert.equal([...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(match => match[1]).join(), "2026-11-13T09:30:00.000Z");
});
