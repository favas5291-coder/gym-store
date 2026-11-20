import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { crc32, inflateSync } from "node:zlib";
import { verifyIconHead, verifyLauncherManifest } from "../scripts/verify-favicon-build.mjs";

const read = file => readFileSync(new URL("../" + file, import.meta.url));
const signature = Buffer.from("89504e470d0a1a0a", "hex");
const forest = [15, 61, 58, 255];

function paeth(left, up, upperLeft) {
  const p = left + up - upperLeft;
  const a = Math.abs(p - left);
  const b = Math.abs(p - up);
  const c = Math.abs(p - upperLeft);
  return a <= b && a <= c ? left : b <= c ? up : upperLeft;
}

// The generator produces 8-bit, non-interlaced RGBA tiles.
function decodePng(file, size) {
  assert.ok(file.subarray(0, 8).equals(signature), "PNG signature");
  const chunks = [];
  let offset = 8;
  let end = false;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    assert.equal(file.readUInt32BE(offset + 8 + length),
      crc32(file.subarray(offset + 4, offset + 8 + length)), `${type} CRC`);
    if (offset === 8) {
      assert.equal(type, "IHDR");
      assert.equal(data.readUInt32BE(0), size, "PNG width");
      assert.equal(data.readUInt32BE(4), size, "PNG height");
      assert.deepEqual([...data.subarray(8)], [8, 6, 0, 0, 0]);
    }
    offset += length + 12;
    if (type === "IDAT") chunks.push(data);
    if (type === "IEND") {
      assert.equal(length, 0);
      end = true;
      break;
    }
  }
  assert.ok(end && offset === file.length, "Complete PNG");
  const bytes = inflateSync(Buffer.concat(chunks));
  const stride = size * 4;
  assert.equal(bytes.length, (stride + 1) * size);
  const pixels = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const start = y * (stride + 1);
    const filter = bytes[start];
    assert.ok(filter <= 4, "PNG row filter");
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const left = x >= 4 ? pixels[i - 4] : 0;
      const up = y ? pixels[i - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[i - stride - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = up;
      if (filter === 3) predictor = Math.floor((left + up) / 2);
      if (filter === 4) predictor = paeth(left, up, upperLeft);
      pixels[i] = (bytes[start + 1 + x] + predictor) & 255;
    }
  }
  return pixels;
}

for (const size of [16, 32, 48, 64, 96]) {
  const file = size === 64 ? "favicon-64-v1.png" : `favicon-${size}x${size}.png`;
  test(`${file} is a padded cream monogram on a solid forest square`, () => {
    const pixels = decodePng(read("public/" + file), size);
    let minX = size, minY = size, maxX = -1, maxY = -1, creamPixels = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        assert.equal(pixels[i + 3], 255, "Opaque tile");
        if ((x === 0 || x === size - 1) && (y === 0 || y === size - 1)) {
          assert.deepEqual([...pixels.subarray(i, i + 4)], forest);
        }
        if (pixels[i] === 245 && pixels[i + 1] === 218 && pixels[i + 2] === 191) {
          creamPixels++;
        }
        if (pixels[i] >= 225 && pixels[i + 1] >= 200 && pixels[i + 2] >= 165) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    assert.ok(creamPixels > size * size * 0.05, "Visible #F5DABF cream artwork");
    for (const [low, high] of [[minX, maxX], [minY, maxY]]) {
      assert.ok(high - low + 1 >= size / 2, "Initial fills the tiny icon in both directions");
      assert.ok(low >= 1 && high < size - 1, "Initial has padding");
      assert.ok(Math.abs(low - (size - 1 - high)) <= Math.max(2, size * 0.08), "Centered initial");
    }
  });
}

test("the ICO contains the same 16, 32 and 48 pixel artwork as the standalone files", () => {
  const ico = read("public/favicon.ico");
  const sizes = [16, 32, 48];
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), sizes.length);
  const frames = new Map();
  for (let i = 0; i < sizes.length; i++) {
    const entry = 6 + i * 16;
    const size = ico[entry];
    assert.equal(ico[entry + 1], size, "Square ICO frame");
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset >= 6 + sizes.length * 16 && offset + length <= ico.length, "Frame lies inside ICO");
    frames.set(size, ico.subarray(offset, offset + length));
  }
  assert.deepEqual([...frames.keys()].sort((a, b) => a - b), sizes);
  for (const size of sizes) {
    const standalone = decodePng(read(`public/favicon-${size}x${size}.png`), size);
    assert.ok(decodePng(frames.get(size), size).equals(standalone), `ICO artwork at ${size}px`);
  }
});

// Fingerprint decoded pixels so recompressing the approved full-name icons remains safe.
for (const [name, size, digest] of [
  ["apple-touch-icon.png", 180, "57c7a5bf48f267a17f7a5d6b70b2541daaedf39d47340d30589f54d4bf33b49b"],
  ["android-chrome-192x192.png", 192, "32d4778a3cc51d5d363c7ab1f69ae3ad5a4c9a3260e2feaaa720416cd64bf64c"],
  ["android-chrome-512x512.png", 512, "b59c64e2ffd56e8fc290c34d59cf42e568dcdfeef5ae11bb8b11113f70e1f6e9"],
  ["brand/external/gymdrobe-maskable-512.png", 512, "cbf585098ec18666f44126cc30ebc811805911a9de26587cbefe5d710c807346"],
]) {
  test(`${name} retains the approved full-name artwork`, () => {
    const pixels = decodePng(read("public/" + name), size);
    assert.equal(createHash("sha256").update(pixels).digest("hex"), digest);
  });
}

test("storefront and policy pages declare the icon set and the offline page uses its cached monogram", () => {
  for (const file of ["index.html", "public/offline.html", "public/shipping-and-returns.html",
    "public/virtual-try-on-privacy.html"]) {
    verifyIconHead(read(file).toString("utf8"), file);
  }
});
test("the web app manifest selects approved launcher artwork at stable URLs", () => {
  verifyLauncherManifest(JSON.parse(read("public/site.webmanifest")));
});
