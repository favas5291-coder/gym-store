import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("approved external GymDrobe brand vectors remain available", () => {
  const icon = read("public/brand/gymdrobe-app-icon.svg");
  const lockup = read("public/brand/gymdrobe-lockup.svg");
  for (const svg of [icon, lockup]) {
    assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /id="swoosh"/);
    assert.match(svg, /fill="#fff"/);
  }
});

test("previous internal wordmarks are restored; external icon is separate", () => {
  const navbar = read("src/components/Navbar.jsx");
  const footer = read("src/components/Footer.jsx");
  const style = read("src/components/GymDrobeStorefront.css");
  const offline = read("public/offline.html");
  const install = read("src/pages/InstallAppPage.jsx");
  const html = read("index.html");
  assert.match(navbar, /className="gn-wordmark">GYMDROBE/);
  assert.match(footer, /aria-label="GymDrobe home">GYMDROBE<\/Link>/);
  assert.doesNotMatch(navbar + footer, /gymdrobe-lockup\.svg|gn-branded-lockup|footer-branded-lockup/);
  assert.doesNotMatch(style, /\.gn-branded-lockup|\.footer-branded-lockup/);
  assert.doesNotMatch(offline, /gymdrobe-app-icon\.svg/);
  assert.match(install, /gymdrobe-app-icon\.svg/);
  assert.ok(html.includes('href="/android-chrome-192x192.png?v=3"'));
  assert.ok(html.includes('https://www.gymdrobe.com/brand/external/gymdrobe-app-icon-1024.png'));
  assert.ok(!html.includes('type="image/svg+xml"'), "Search favicon must use supported PNG/ICO formats");
});

test("external share/PWA images and Android launcher assets have expected pixel dimensions", () => {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const expectPng = (path, width, height) => {
    const bytes = readFileSync(new URL("../" + path, import.meta.url));
    assert.ok(bytes.subarray(0, 8).equals(pngSignature), path + " must be a real PNG");
    assert.ok(bytes.length > 32, path + " must not be empty");
    assert.equal(bytes.readUInt32BE(16), width, path + " width");
    assert.equal(bytes.readUInt32BE(20), height, path + " height");
  };
  expectPng("public/brand/external/gymdrobe-app-icon-1024.png", 1024, 1024);
  expectPng("public/brand/external/gymdrobe-profile-1024.png", 1024, 1024);
  expectPng("public/brand/external/gymdrobe-maskable-512.png", 512, 512);
  expectPng("public/gymdrobe-share-v2.png", 1200, 630);
  for (const [density, ratio] of [["mdpi", 1], ["hdpi", 1.5], ["xhdpi", 2], ["xxhdpi", 3], ["xxxhdpi", 4]]) {
    const prefix = "android/app/src/main/res/mipmap-" + density + "/";
    for (const icon of ["ic_launcher.png", "ic_launcher_round.png"]) {
      const dimension = Math.round(48 * ratio);
      expectPng(prefix + icon, dimension, dimension);
    }
    const foregroundSize = Math.round(108 * ratio);
    expectPng(prefix + "ic_launcher_foreground.png", foregroundSize, foregroundSize);
  }
});
