import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url));
const html = read("index.html").toString("utf8");

function pngDimensions(path) {
  const bytes = read(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", path);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test("Google Search favicon declarations use crawlable PNG/ICO candidates, not SVG", () => {
  const icons = [...html.matchAll(/<link\s+[^>]*rel="(?:icon|shortcut icon)"[^>]*>/g)]
    .map((match) => match[0]);
  assert.ok(icons.length > 0, "Homepage needs a favicon declaration");
  assert.ok(icons.every((tag) => !tag.includes('type="image/svg+xml"')),
    "Google Search favicon does not list SVG as a supported format");
  assert.ok(icons.some((tag) =>
    tag.includes('sizes="192x192"') && tag.includes('href="/android-chrome-192x192.png?v=3"')),
    "Keep one high-resolution square PNG candidate");
  assert.ok(icons.some((tag) => tag.includes('href="/favicon.ico?v=3"')));
  assert.deepEqual(pngDimensions("public/android-chrome-192x192.png"), [192, 192]);
  assert.deepEqual(pngDimensions("public/favicon-48x48.png"), [48, 48]);
  assert.ok(html.includes('href="/site.webmanifest?v=3"'));
});

test("homepage exposes the actual high-resolution external logo in OnlineStore JSON-LD", () => {
  const block = html.match(/<script\s+id="gymdrobe-site-schema"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(block, "Expected server-visible JSON-LD in the HTML template");
  const structuredData = JSON.parse(block[1]);
  const entities = structuredData["@graph"];
  assert.ok(Array.isArray(entities));
  const org = entities.find((entry) => entry["@id"] === "https://www.gymdrobe.com/#organization");
  assert.ok(org);
  assert.equal(org["@type"], "OnlineStore");
  assert.equal(org.name, "GymDrobe");
  assert.equal(org.logo["@type"], "ImageObject");
  assert.equal(org.logo.contentUrl,
    "https://www.gymdrobe.com/brand/external/gymdrobe-app-icon-1024.png");
  assert.equal(org.logo.width, 1024);
  assert.equal(org.logo.height, 1024);
  assert.deepEqual(pngDimensions("public/brand/external/gymdrobe-app-icon-1024.png"), [1024, 1024]);
});

test("homepage is not blocked by the repository robots policy", () => {
  const robots = read("public/robots.txt").toString("utf8");
  assert.match(robots, /^User-agent:\s*\*/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.doesNotMatch(robots, /^Disallow:\s*\/$/m);
});

test("brand image applies to homepage while product social shares retain product photos", () => {
  assert.match(html, /https:\/\/www\.gymdrobe\.com\/gymdrobe-share-v2\.png/);
  assert.deepEqual(pngDimensions("public/gymdrobe-share-v2.png"), [1200, 630]);
  const seo = read("src/components/SEOController.jsx").toString("utf8");
  const metadata = read("src/utils/seoMetadata.js").toString("utf8");
  assert.match(metadata, /export const DEFAULT_SHARE_IMAGE = "\/gymdrobe-share-v2\.png"/);
  assert.match(seo, /const shareImage\s*=\s*images\[0\]\s*\|\|\s*new URL\(DEFAULT_SHARE_IMAGE, origin\)\.href/);
});

test("fix does not change established internal UI branding", () => {
  const navbar = read("src/components/Navbar.jsx").toString("utf8");
  const footer = read("src/components/Footer.jsx").toString("utf8");
  assert.match(navbar, /className="gn-wordmark">GYMDROBE<\/span>/);
  assert.match(footer, /aria-label="GymDrobe home">GYMDROBE<\/Link>/);
  assert.doesNotMatch(navbar + footer, /\/brand\/gymdrobe-lockup\.svg/);
});

test("homepage primary image and Organization logo are the same approved square artwork", () => {
  const block = html.match(/<script[^>]*id="gymdrobe-site-schema"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(block, "Homepage JSON-LD should be present in source HTML");
  const graph = JSON.parse(block[1])["@graph"];
  const website = graph.find(entry => entry["@id"] === "https://www.gymdrobe.com/#website");
  const webpage = graph.find(entry => entry["@id"] === "https://www.gymdrobe.com/#webpage");
  const shop = graph.find(entry => entry["@id"] === "https://www.gymdrobe.com/#organization");
  assert.ok(website && webpage && shop, "Expected WebSite, WebPage and OnlineStore");
  assert.equal(webpage["@type"], "WebPage");
  assert.equal(webpage.isPartOf["@id"], website["@id"]);
  assert.equal(webpage.about["@id"], shop["@id"]);
  assert.equal(webpage.primaryImageOfPage.contentUrl, shop.logo.contentUrl);
  assert.deepEqual(pngDimensions("public/brand/external/gymdrobe-app-icon-1024.png"), [1024, 1024]);
});

test("retired Google-visible logo URLs redirect before serving static legacy assets", () => {
  const config = JSON.parse(read("vercel.json").toString("utf8"));
  const redirects = [
    ["^/gymdrobe-share-v1\\.png$", "/gymdrobe-share-v2.png"],
    ["^/favicon\\.jpeg$", "/favicon.ico?v=3"],
    ["^/favicon-64-v1\\.png$", "/favicon-48x48.png?v=3"],
  ];
  const filesystem = config.routes.findIndex(route => route.handle === "filesystem");
  assert.ok(filesystem >= 0, "Existing SPA filesystem routing must be retained");
  for (const [source, target] of redirects) {
    const index = config.routes.findIndex(route => route.src === source);
    assert.ok(index >= 0 && index < filesystem, "Redirect must precede filesystem for " + source);
    assert.equal(config.routes[index].status, 308);
    assert.equal(config.routes[index].headers.Location, target);
  }
});
