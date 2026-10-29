import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { snapshotFile } from "./storefront-documents.mjs";
const snapshot = JSON.parse(await fs.readFile(snapshotFile, "utf8"));
for (const entry of snapshot.entries) {
  const html = await fs.readFile(path.join("dist", entry.route.slice(1)), "utf8");
  assert.ok(html.includes(`rel="canonical" href="${entry.metadata.canonical}"`));
  assert.ok(html.includes('property="og:type" content="product"'));
  assert.ok(html.includes('id="gymdrobe-product-schema"'));
  assert.ok(/<script[^>]+src="\/assets\//.test(html), "The compiled application entry must remain available");
  const schema = JSON.parse(html.match(/id="gymdrobe-product-schema" type="application\/ld\+json">([^]*?)<\/script>/)[1]);
  assert.equal(schema.offers, undefined, "Do not freeze prices or stock in a build snapshot");
}
console.log(`Verified ${snapshot.entries.length} built product/alias documents, canonical URLs, bundle entries and omission of mutable offers.`);
