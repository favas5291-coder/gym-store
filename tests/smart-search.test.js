import test from "node:test";
import assert from "node:assert/strict";
import { createSearchIndex, normalizeSearchText, searchCatalogue } from "../src/utils/smartSearch.js";
import { filterProducts } from "../src/utils/catalog.js";

const catalog = [
  { id: "whey", name: "Whey Protein Powder", category: "Supplements", brand: "Fit Fuel", tags: ["nutrition"], stock: 3, price: 1400 },
  { id: "shoe", name: "Gym Running Shoes", category: "Footwear", brand: "Sprint", stock: 6, price: 1800 },
  { id: "dumbbell", name: "Rubber Dumbbell", category: "Equipment", brand: "Liftpro", stock: 5, price: 900 },
  { id: "tshirt", name: "Compression T-shirt", category: "Training Clothing", brand: "Flex", stock: 0, price: 799, searchAliases: ["Workout tee", "Gym shirt"] },
  { id: "joggers", name: "Training Joggers", category: "Activewear", stock: 2, price: 1099 },
  { id: "gloves", name: "Lifting Gloves", category: "Gym Accessories", stock: 4, price: 399 },
  { id: "bands", name: "Resistance Bands", category: "Home Gym", stock: 3, price: 499 },
  { id: "shaker", name: "Steel Shaker Bottle", category: "Hydration", stock: 1, price: 249 },
  { id: "hidden", name: "Secret Protein Powder", category: "Supplements", isActive: false, stock: 5 },
];

const ids = (q, options) => searchCatalogue(catalog, q, options).products.map((p) => p.id);

test("normalizes spelling safely and preserves multiword terms", () => {
  assert.equal(normalizeSearchText("  T-shirts! "), "tshirt");
  assert.equal(normalizeSearchText("Crème  PROTÉIN"), "creme protein");
  assert.equal(normalizeSearchText("  "), "");
});

test("corrects typical gym shopping mistakes from visible catalogue vocabulary", () => {
  for (const [query, expected] of [
    ["protien", "whey"],
    ["protine powder", "whey"],
    ["whey protien", "whey"],
    ["gym shooes", "shoe"],
    ["dumbel", "dumbbell"],
    ["compresion tshirt", "tshirt"],
    ["joger", "joggers"],
    ["glovs", "gloves"],
    ["resitance band", "bands"],
  ]) {
    assert.ok(ids(query).includes(expected), "Expected " + expected + " for " + query);
  }
  assert.equal(searchCatalogue(catalog, "whey protien").correctedQuery, "whey protein");
});

test("supports aliases, phrases, prefixes and deliberate alternate names", () => {
  assert.ok(ids("shirt for gym").includes("tshirt"));
  assert.ok(ids("workout tee").includes("tshirt"));
  assert.ok(ids("sho").includes("shoe"));
  assert.ok(ids("Fit Fuel").includes("whey"));
  assert.ok(ids("Hydration").includes("shaker"));
});

test("understands bounded intent phrases without inventing catalogue stock", () => {
  assert.ok(ids("protein for muscle").includes("whey"));
  assert.ok(ids("shirt for gym").includes("tshirt"));
  assert.ok(ids("hand protection gym").includes("gloves"));
  assert.ok(ids("workout pant").includes("joggers"));
  assert.ok(ids("gym bottle").includes("shaker"));
  assert.ok(ids("running footwear").includes("shoe"));
  assert.ok(ids("workout equipment for home").includes("dumbbell"));
});

test("only uses real active catalogue data for results and suggestions", () => {
  const result = searchCatalogue(catalog, "protein");
  assert.deepEqual(result.products.map((p) => p.id), ["whey"]);
  assert.deepEqual(result.brands, ["Fit Fuel"]);
  assert.deepEqual(result.categories, ["Supplements"]);
  assert.equal(searchCatalogue(catalog, "nonexistentcategory").products.length, 0);
  assert.deepEqual(searchCatalogue([], "protien").products, []);
});

test("exact product relevance outranks stock when a near-match is in stock", () => {
  const products = [
    { id: "exact", name: "Gym Gloves", category: "Accessories", stock: 0 },
    { id: "other", name: "Gym Gloves Replacement Pack", category: "Accessories", stock: 10 },
  ];
  assert.equal(searchCatalogue(products, "gym gloves").products[0].id, "exact");
});

test("avoids overcorrecting unrecognized or strict literal searches", () => {
  assert.equal(searchCatalogue(catalog, "protien", { strict: true }).products.length, 0);
  assert.equal(searchCatalogue(catalog, "x!@#$").products.length, 0);
  assert.equal(searchCatalogue(catalog, "").products.length, 0);
  assert.equal(searchCatalogue(catalog, "unknownbrand").correctedQuery, "");
});

test("preserves existing catalogue filters with fuzzy search and sort override", () => {
  const params = new URLSearchParams({ search: "protien", category: "Supplements" });
  assert.deepEqual(filterProducts(catalog, params).map((p) => p.id), ["whey"]);
  params.set("category", "Hydration");
  assert.deepEqual(filterProducts(catalog, params), []);
  params.set("category", "Supplements");
  params.set("literal", "1");
  assert.deepEqual(filterProducts(catalog, params), []);
});

test("index can be reused across autocomplete requests without new server calls", () => {
  const index = createSearchIndex(catalog);
  assert.equal(searchCatalogue(index, "protein").products[0].id, "whey");
  assert.ok(searchCatalogue(index, "protien", { limit: 1 }).products.length <= 1);
  assert.deepEqual(searchCatalogue(index, "shooes").categories, ["Footwear"]);
});
