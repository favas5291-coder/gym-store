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

const apparel = [
  { id: "black", name: "Compression Half Sleeves T-shirt", category: "Compression T-shirt", gender: "Men", colors: ["Black", "Navy"], sizes: ["S", "M"], price: 799, stock: 4 },
  { id: "white", name: "Compression Half Sleeves T-shirt", category: "Compression T-shirt", gender: "Women", colors: ["White"], sizes: ["M"], description: "Pair with black joggers.", price: 599, stock: 3 },
  { id: "wj", name: "Training Joggers", category: "Joggers", gender: "Women", colors: ["Navy"], sizes: ["M"], price: 899, stock: 3 },
  { id: "mj", name: "Training Joggers", category: "Joggers", gender: "Men", colors: ["Black"], sizes: ["L"], price: 899, stock: 2 },
];

test("search suggestions and submitted results respect colours, department, sizes and typos", () => {
  for (const [query, expected] of [
    ["black gym t shirt", ["black"]],
    ["black gym tee", ["black"]],
    ["womens jogers", ["wj"]],
    ["Women's joggers size M", ["wj"]],
    ["men’s joggers size M", []],
    ["gym tee size S", ["black"]],
  ]) {
    const data = searchCatalogue(apparel, query);
    assert.deepEqual(data.products.map(p => p.id), expected, query);
    assert.deepEqual(filterProducts(apparel, new URLSearchParams({ search: query })).map(p => p.id), expected);
  }
  assert.equal(searchCatalogue(apparel, "womens jogers").correctedQuery, "womens joggers");
  assert.ok(searchCatalogue(apparel, "comp").suggestedQueries.includes("Compression Half Sleeves T-shirt"));
});

test("under uses the strictly lower storefront selling price and offers deliberate broadening", () => {
  const bags = [
    { id: "sale", name: "Gym Duffel", category: "BAG", price: 1200, discount: 25 },
    { id: "edge", name: "Gym Bag", category: "BAG", price: 999 },
    { id: "other", name: "Sports Bottle", category: "Bottles", description: "Fits in your gym bag", price: 199 },
    { id: "joggers", name: "Pro Flex Baggy Fit Joggers", category: "Joggers", price: 899 },
    { id: "unknown", name: "Small Gym Bag", category: "BAG" },
  ];
  assert.deepEqual(searchCatalogue(bags, "gym bag under 999").products.map(p => p.id), ["sale"]);
  assert.deepEqual(filterProducts(bags, new URLSearchParams({ search: "gym bag under ₹999" })).map(p => p.id), ["sale"]);
  assert.equal(searchCatalogue(bags, "gym bag under ₹800").broaderQuery, "gym bag");
  assert.equal(searchCatalogue(bags, "shoes under ₹800").broaderQuery, "");
  assert.deepEqual(searchCatalogue(bags, "under INR 1,000").products.map(p => p.id), ["sale", "edge", "other", "joggers"]);
});

test("a cheap variant cannot qualify an expensive colour or size for a budget search", () => {
  const bag = { name: "Gym Bag", category: "BAG", colors: ["Blue", "Black"], sizes: ["S", "L"], variantPrices: [
    { color: "Blue", size: "S", customerUnitAmount: 89900 },
    { color: "Black", size: "L", customerUnitAmount: 99900 },
  ] };
  assert.deepEqual(searchCatalogue([bag], "black gym bag under ₹999").products, []);
  assert.deepEqual(searchCatalogue([bag], "gym bag size L under ₹999").products, []);
  assert.deepEqual(searchCatalogue([bag], "blue gym bag size S under ₹999").products, [bag]);
});

test("brand and product names remain searchable when they also appear in a multiword colour or flavour", () => {
  const bags = [
    { name: "Gym Duffel", brand: "PUMA", colors: ["Light Lavender"] },
    { name: "Small Sports Bag", brand: "PUMA", colors: ["PUMA Black"] },
  ];
  assert.deepEqual(new Set(searchCatalogue(bags, "PUMA").products), new Set(bags));
  const powders = [
    { name: "Whey Protein", colors: ["Vanilla"], optionLabels: { color: "Flavour" } },
    { name: "Protein Strawberry", colors: ["Performance Whey"], optionLabels: { color: "Flavour" } },
  ];
  assert.equal(searchCatalogue(powders, "whey protein").products.length, 2);
});
