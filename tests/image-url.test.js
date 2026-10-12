import test from "node:test";
import assert from "node:assert/strict";

import { isPublicImageUrl } from "../src/utils/imageUrl.js";

test("accepts public HTTP and HTTPS image URLs", () => {
  assert.equal(
    isPublicImageUrl("https://images.example.com/product.png"),
    true,
  );
  assert.equal(
    isPublicImageUrl("http://images.example.com/product.png"),
    true,
  );
});

test("rejects loopback image URLs", () => {
  for (const url of [
    "http://localhost:37857/8750596.png",
    "http://shop.localhost/image.png",
    "http://127.0.0.1:7070/image.png",
    "http://127.4.5.6:7071/image.png",
    "http://[::1]:7070/image.png",
  ]) {
    assert.equal(isPublicImageUrl(url), false, url);
  }
});

test("rejects unsupported schemes and credential-bearing URLs", () => {
  assert.equal(isPublicImageUrl("ftp://images.example.com/image.png"), false);
  assert.equal(
    isPublicImageUrl("https://user:password@images.example.com/image.png"),
    false,
  );
});
