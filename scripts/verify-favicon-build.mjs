import assert from "node:assert/strict";
import { glob, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STOREFRONT_DOCUMENT_ROUTES } from "../src/utils/seoMetadata.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const browserSizes = [16, 32, 48, 96];
const favicon = size => `/favicon-${size}x${size}.png`;
const appleIcon = "/apple-touch-icon.png";
const manifestPath = "/site.webmanifest";
const launcherIcons = [
  { src: "/android-chrome-192x192.png", sizes: "192x192", purpose: "any" },
  { src: "/android-chrome-512x512.png", sizes: "512x512", purpose: "any" },
  { src: "/brand/external/gymdrobe-maskable-512.png", sizes: "512x512", purpose: "maskable" },
];

function headTags(html, tag) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  return [...head.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map(([element]) =>
    Object.fromEntries([...element.matchAll(/\s([\w:-]+)\s*=\s*(["'])(.*?)\2/g)]
      .map(([, name, , value]) => [name.toLowerCase(), value])),
  );
}

export function verifyIconHead(html, documentName) {
  const links = headTags(html, "link");
  const withRelation = name => links.filter(link => link.rel?.toLowerCase().split(/\s+/).includes(name));
  const icons = withRelation("icon");
  const themes = headTags(html, "meta").filter(meta => meta.name === "theme-color");
  assert.deepEqual(themes.map(meta => meta.content.toLowerCase()), ["#0f3d3a"], documentName);

  if (path.basename(documentName) === "offline.html") {
    assert.deepEqual(icons.map(link => [link.href, link.sizes, link.type]),
      [[favicon(96), "96x96", "image/png"]], "The offline page uses its precached monogram");
    return;
  }

  const expected = ["/favicon.ico", ...browserSizes.map(favicon)];
  assert.deepEqual(icons.map(link => link.href).sort(), expected.sort(), `${documentName}: browser icon URLs`);
  assert.equal(icons.find(link => link.href === "/favicon.ico").sizes, "any", documentName);
  for (const size of browserSizes) {
    const link = icons.find(link => link.href === favicon(size));
    assert.equal(link.sizes, `${size}x${size}`, documentName);
    assert.equal(link.type, "image/png", documentName);
  }
  assert.deepEqual(withRelation("apple-touch-icon").map(link => [link.href, link.sizes]),
    [[appleIcon, "180x180"]], `${documentName}: Apple touch icon`);
  assert.deepEqual(withRelation("manifest").map(link => link.href), [manifestPath], documentName);
}

export function verifyLauncherManifest(manifest) {
  assert.equal(manifest.name, "GymDrobe");
  assert.equal(manifest.short_name, "GymDrobe");
  assert.equal(manifest.theme_color.toLowerCase(), "#0f3d3a");
  assert.equal(manifest.icons.length, launcherIcons.length);
  for (const { src, sizes, purpose } of launcherIcons) {
    const icon = manifest.icons.find(entry => entry.src === src);
    assert.ok(icon, src);
    assert.equal(icon.sizes, sizes, src);
    assert.equal(icon.purpose, purpose, src);
    assert.equal(icon.type, "image/png", src);
  }
}

async function verifyBuild() {
  const dist = path.join(root, "dist");
  const assets = [
    "/favicon.ico", ...browserSizes.map(favicon), "/favicon-64-v1.png", appleIcon,
    manifestPath, ...launcherIcons.map(icon => icon.src), "/gymdrobe-share-v2.png",
  ];
  for (const file of assets) {
    const [source, build] = await Promise.all([
      readFile(path.join(root, "public", file)), readFile(path.join(dist, file)),
    ]);
    assert.ok(source.equals(build), `Production copy differs from source: ${file}`);
  }
  verifyLauncherManifest(JSON.parse(await readFile(path.join(dist, manifestPath), "utf8")));

  const documents = new Set(["index.html", "404.html", "storefront-shell.html", "offline.html",
    "shipping-and-returns.html", "virtual-try-on-privacy.html"]);
  for (const route of STOREFRONT_DOCUMENT_ROUTES) {
    if (route !== "/") documents.add(route.slice(1));
  }
  for await (const file of glob(["product/*", "collections/*"], { cwd: dist })) {
    documents.add(file);
  }
  for (const file of documents) {
    verifyIconHead(await readFile(path.join(dist, file), "utf8"), file);
  }
  console.log(`Verified ${assets.length} production assets and favicon metadata in ${documents.size} HTML documents.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyBuild();
}
