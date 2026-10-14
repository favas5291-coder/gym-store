import test from "node:test";
import assert from "node:assert/strict";

import { normalizeMeeshoLink } from "../src/utils/meeshoUrl.js";

test("Meesho links accept canonical HTTPS URLs and normalize the default port", () => {
  assert.equal(
    normalizeMeeshoLink("https://www.meesho.com/product/p/123"),
    "https://www.meesho.com/product/p/123",
  );

  assert.equal(
    normalizeMeeshoLink("https://MEESHO.com:0443/product/p/123"),
    "https://meesho.com/product/p/123",
  );
});

test("Meesho links reject other hosts, credentials, and custom ports", () => {
  for (const value of [
    "https://meesho.com.example.test/product/p/123",
    "https://user@meesho.com/product/p/123",
    "https://meesho.com:444/product/p/123",
  ]) {
    assert.throws(() => normalizeMeeshoLink(value));
  }
});
