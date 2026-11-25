import test from "node:test";
import assert from "node:assert/strict";
import { indexForCatalogue, searchCatalogue } from "../src/utils/smartSearch.js";
import { responsiveProductImage } from "../src/utils/responsiveProductImage.js";

test("reopening search reuses the index and a new catalogue replaces the old index", () => {
  const products = [{id:"one",name:"Gym bag",price:800,stock:1,category:"Bags"}];
  const first = indexForCatalogue(products);
  assert.equal(indexForCatalogue(products), first);
  const changed = indexForCatalogue([{...products[0],price:1200}]);
  assert.notEqual(changed, first);
  assert.equal(searchCatalogue(first, "gym bag under 999").products.length, 1);
  assert.equal(searchCatalogue(changed, "gym bag under 999").products.length, 0);
});

test("square catalogue packshots retain proportions and signed or unfamiliar transforms stay intact", () => {
  const source = "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/093633/01/fnd/IND/image.jpg";
  const result = responsiveProductImage(source);
  assert.match(result, /w_480,h_480\/global\/093633\/01\/fnd\/IND\/image.jpg 480w/);
  assert.doesNotMatch(responsiveProductImage(source.replaceAll("2000","750")), /900w/);
  for (const excluded of [source+"?signature=x",source.replace("h_2000","h_1200"),source.replace("images.puma.com","example.test")]) {
    assert.equal(responsiveProductImage(excluded),null);
  }
});
