import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("approved GymDrobe brand source assets are valid SVG artwork", () => {
  const lockup = read("public/brand/gymdrobe-lockup.svg");
  const icon = read("public/brand/gymdrobe-app-icon.svg");
  for (const svg of [lockup, icon]) {
    assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /aria-label="GymDrobe(?: app icon)?"/);
    assert.match(svg, /fill="#fff"/);
    assert.match(svg, /id="swoosh"/);
    assert.doesNotMatch(svg, /<text|GYMDROBE.*<\/text>|GD monogram/);
    assert.match(svg, /<path[^>]+d="M /);
  }
  assert.match(icon, /viewBox="0 0 1024 1024"/);
  assert.match(lockup, /viewBox="0 0 500 178"/);
});

test("website and PWA help surfaces point to the approved icon", () => {
  assert.match(read("index.html"), /\/brand\/gymdrobe-app-icon\.svg\?v=3/);
  assert.match(read("src/components/Navbar.jsx"), /\/brand\/gymdrobe-lockup\.svg/);
  assert.match(read("src/components/Footer.jsx"), /\/brand\/gymdrobe-lockup\.svg/);
  assert.match(read("public/offline.html"), /\/brand\/gymdrobe-app-icon\.svg/);
  assert.match(read("src/pages/InstallAppPage.jsx"), /\/brand\/gymdrobe-app-icon\.svg/);
  assert.match(read("public/sw.js"), /\/brand\/gymdrobe-app-icon\.svg/);
  assert.match(read("scripts/build-pwa.mjs"), /brand\/gymdrobe-app-icon\.svg/);
});
