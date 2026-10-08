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
