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
  assert.match(html, /gymdrobe-app-icon\.svg/);
});
