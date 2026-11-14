import assert from "node:assert/strict";
import test from "node:test";
import { brandFilterPath, catalogueBrands } from "../src/utils/brandIdentity.js";
import { filterProducts } from "../src/utils/catalog.js";

test("brand tiles collapse casing and whitespace and omit inactive brands", () => {
  assert.deepEqual(catalogueBrands([
    { brand: "  Adidas " }, { brand: "ADIDAS" },
    { brand: "Optimum   Nutrition" }, { brand: "optimum nutrition" },
    { brand: "Hidden", isActive: false },
  ]), [{ key: "adidas", name: "Adidas" }, { key: "optimum nutrition", name: "Optimum Nutrition" }]);
});

test("brand links preserve identity, including catalogue names with commas", () => {
  const products = [
    { brand: "A-B Co", price: 100 }, { brand: "  a-b  CO", price: 100 },
    { brand: "A B Co", price: 100 }, { brand: "A, B", price: 100 },
  ];
  function matching(name) {
    return filterProducts(products, new URL(brandFilterPath(name), "https://gymdrobe.com").searchParams)
      .map(product => product.brand);
  }
  assert.deepEqual(matching("A-B Co"), ["A-B Co", "  a-b  CO"]);
  assert.deepEqual(matching("A, B"), ["A, B"]);
});
