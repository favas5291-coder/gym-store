import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, DEFAULT_SHARE_IMAGE, cleanText, productMetadata } from "../src/utils/seoMetadata.js";
import { STOREFRONT_COLLECTIONS, collectionBreadcrumbs, collectionMatchesProduct } from "../src/utils/storefrontCollections.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const snapshotFile = path.join(root, "node_modules/.cache/gymdrobe-public-catalogue.json");
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export function metadataHtml(template, metadata) {
  const end = template.toLowerCase().indexOf("</head>");
  if (end < 0) throw new Error("Built storefront head is missing");
  const body = template.slice(end), head = template.slice(0, end)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<script\b[^>]*\bid=["']gymdrobe-product-schema["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, tag => /\b(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["']/i.test(tag) ? "" : tag);
  const meta = (name, value, property = false) => `<meta ${property ? "property" : "name"}="${name}" content="${escape(value)}" />`;
  const tags = [`<title>${escape(metadata.title)}</title>`, meta("description", metadata.description), meta("robots", "index, follow"),
    `<link rel="canonical" href="${escape(metadata.canonical)}" />`,
    ...Object.entries({ "og:site_name": "GymDrobe", "og:type": metadata.type, "og:title": metadata.title, "og:description": metadata.description,
      "og:url": metadata.canonical, "og:image": metadata.image, "og:image:alt": metadata.imageAlt }).map(([name, value]) => meta(name, value, true)),
    ...Object.entries({ "twitter:card": "summary_large_image", "twitter:title": metadata.title, "twitter:description": metadata.description,
      "twitter:image": metadata.image, "twitter:image:alt": metadata.imageAlt }).map(([name,value]) => meta(name,value)),
    ...(metadata.schema ? [`<script id="${metadata.schema["@type"] === "BreadcrumbList" ? "gymdrobe-collection-schema" : "gymdrobe-product-schema"}" type="application/ld+json">${JSON.stringify(metadata.schema).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}</script>`] : []),
  ];
  const fallback = metadata.fallback ? `<noscript>${metadata.fallback}</noscript>` : "";
  return head + tags.join("\n") + "\n" + body.replace('<div id="app"></div>', () => `<div id="app"></div>${fallback}`);
}

function collectionLinks(collections) {
  return `<ul>${collections.map(({ route, heading }) =>
    `<li><a href="${escape(route)}">${escape(heading)}</a></li>`,
  ).join("")}</ul>`;
}
export function publicCatalogueSnapshot(origin, products) {
  const site = new URL(origin);
  if (site.protocol !== "https:" || site.origin !== origin || site.username || site.password) throw new Error("Use a public canonical HTTPS origin");
  if (!Array.isArray(products)) throw new Error("The public catalogue is incomplete");
  const entries = [], aliases = new Map(), identifiers = new Set();
  for (const product of products) {
    if (product.isActive === false) continue;
    const metadata = productMetadata(product, origin), id = String(product.id ?? product._id);
    if (identifiers.has(id)) throw new Error("The public catalogue repeats a product identifier");
    identifiers.add(id);
    const routes = new Set([id]);
    if (typeof product.slug === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(product.slug)) routes.add(product.slug);
    for (const route of routes) {
      if (aliases.has(route) && aliases.get(route) !== id) throw new Error("Two products share a public route");
      if (aliases.has(route)) continue;
      aliases.set(route, id); entries.push({ route: `/product/${route}`, metadata });
    }
  }
  const collections = Object.entries(STOREFRONT_COLLECTIONS).flatMap(([route, collection]) => {
    const links = products.filter(product => collectionMatchesProduct(collection, product)).map(product => ({
      route: `/product/${encodeURIComponent(String(product.id ?? product._id))}`,
      heading: cleanText(product.name) || "Product",
    }));
    return links.length ? [{ route, ...collection, links }] : [];
  });
  return { version: 1, origin, observedAt: new Date().toISOString(), entries, collections };
}
export async function writeStorefrontDocuments({ directory = path.join(root, "dist"), snapshot, template } = {}) {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.entries)) throw new Error("Regenerate the public catalogue before the website build");
  template ??= await fs.readFile(path.join(directory, "index.html"), "utf8");
  const documents = new Map();
  const collectionDocs = snapshot.collections || [];
  const defaultPreview = {
    type: "website", image: new URL(DEFAULT_SHARE_IMAGE, snapshot.origin).href, imageAlt: "GymDrobe wordmark",
  };
  for (const route of ["/", "/shop", "/offers", "/help"]) {
    const fallback = collectionDocs.length && ["/", "/shop"].includes(route)
      ? `<main><h1>${escape(PAGES[route].title)}</h1><h2>Shop by category</h2>${collectionLinks(collectionDocs)}</main>`
      : "";
    documents.set(route, { ...PAGES[route], ...defaultPreview, canonical: snapshot.origin + route, fallback });
  }
  for (const collection of collectionDocs) {
    const { route, heading, description, title, links } = collection;
    if (!Object.hasOwn(STOREFRONT_COLLECTIONS, route)) throw new Error("Invalid collection document path");
    documents.set(route, {
      ...defaultPreview, title, description, canonical: snapshot.origin + route,
      schema: collectionBreadcrumbs(snapshot.origin, route, collection),
      fallback: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a></nav><h1>${escape(heading)}</h1><p>${escape(description)}</p>${collectionLinks(links)}</main>`,
    });
  }
  for (const entry of snapshot.entries) {
    if (!/^\/product\/[A-Za-z0-9_-]{1,200}$/.test(entry.route) || entry.metadata?.canonical?.startsWith(snapshot.origin + "/product/") !== true) throw new Error("Invalid catalogue document path");
    const { canonical, schema } = entry.metadata;
    documents.set(entry.route, {
      ...entry.metadata,
      fallback: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a></nav><h1>${escape(schema.name)}</h1><p>${escape(schema.description)}</p><p>Enable JavaScript to see current prices, stock and purchase options.</p><a href="${escape(canonical)}">Product page</a></main>`,
    });
  }
  for (const [route, metadata] of documents) {
    // Extensionless HTML files are served by the existing Vercel filesystem
    // handler, with an explicit HTML response type for these document routes.
    const filename = route === "/" ? path.join(directory, "index.html") : path.join(directory, route.slice(1));
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, metadataHtml(template, metadata), "utf8");
  }
  return documents.size;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = JSON.parse(await fs.readFile(snapshotFile, "utf8"));
  const count = await writeStorefrontDocuments({ snapshot });
  console.log(`Built ${count} public HTML metadata documents. Mutable offers remain API-derived.`);
}
