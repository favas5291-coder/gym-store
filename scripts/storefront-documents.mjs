import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, STOREFRONT_DOCUMENT_ROUTES, DEFAULT_SHARE_IMAGE, cleanText, getImages, productBreadcrumbs, productMetadata } from "../src/utils/seoMetadata.js";
import { filterProducts } from "../src/utils/catalog.js";
import { STOREFRONT_COLLECTIONS, collectionBreadcrumbs, collectionMatchesProduct } from "../src/utils/storefrontCollections.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const snapshotFile = path.join(root, "node_modules/.cache/gymdrobe-public-catalogue.json");
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export function metadataHtml(template, metadata) {
  const end = template.toLowerCase().indexOf("</head>");
  if (end < 0) throw new Error("Built storefront head is missing");
  const body = template.slice(end);
  let head = template.slice(0, end)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<script\b[^>]*\bid=["']gymdrobe-product-schema["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, tag => /\b(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["']/i.test(tag) ? "" : tag);
  if (!metadata.homepage) {
    head = head.replace(/<script\b[^>]*\bid=["']gymdrobe-site-schema["'][^>]*>[\s\S]*?<\/script>/gi, "");
  }
  const meta = (name, value, property = false) => `<meta ${property ? "property" : "name"}="${name}" content="${escape(value)}" />`;
  const tags = [`<title>${escape(metadata.title)}</title>`, meta("description", metadata.description),
    ...(metadata.robots ? [meta("robots", metadata.robots)] : []),
    ...(metadata.canonical ? [`<link rel="canonical" href="${escape(metadata.canonical)}" />`] : []),
    ...Object.entries({ "og:site_name": "GymDrobe", "og:type": metadata.type, "og:title": metadata.title, "og:description": metadata.description,
      ...(metadata.canonical && { "og:url": metadata.canonical }), "og:image": metadata.image, "og:image:alt": metadata.imageAlt,
      ...(metadata.image.endsWith(DEFAULT_SHARE_IMAGE) && { "og:image:secure_url": metadata.image,
        "og:image:type": "image/png", "og:image:width": "1200", "og:image:height": "630" }) }).map(([name, value]) => meta(name, value, true)),
    ...Object.entries({ "twitter:card": "summary_large_image", "twitter:title": metadata.title, "twitter:description": metadata.description,
      "twitter:image": metadata.image, "twitter:image:alt": metadata.imageAlt }).map(([name,value]) => meta(name,value)),
  ];
  const schemas = [
    ["gymdrobe-product-schema", metadata.schema],
    ["gymdrobe-breadcrumb-schema", metadata.breadcrumbs],
  ];
  for (const [id, schema] of schemas) {
    if (!schema) continue;
    const json = JSON.stringify(schema).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    tags.push(`<script id="${id}" type="application/ld+json">${json}</script>`);
  }
  if (metadata.shopPreview?.items?.length) {
    const json = JSON.stringify(metadata.shopPreview).replace(/</g, "\\u003c");
    tags.push(`<script id="gymdrobe-shop-preview" type="application/json">${json}</script>`);
  }
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
    for (const alias of [product.slug, product.legacyId]) {
      if (alias != null && /^[A-Za-z0-9_-]{1,200}$/.test(String(alias))) routes.add(String(alias));
    }
    const breadcrumbs = productBreadcrumbs(origin, metadata.canonical, product);
    for (const route of routes) {
      if (aliases.has(route) && aliases.get(route) !== id) throw new Error("Two products share a public route");
      if (aliases.has(route)) continue;
      aliases.set(route, id); entries.push({ route: `/product/${route}`, metadata: { ...metadata, breadcrumbs } });
    }
  }
  const collections = Object.entries(STOREFRONT_COLLECTIONS).flatMap(([route, collection]) => {
    const links = products.filter(product => collectionMatchesProduct(collection, product)).map(product => ({
      route: `/product/${encodeURIComponent(String(product.id ?? product._id))}`,
      heading: cleanText(product.name) || "Product",
    }));
    return links.length ? [{ route, ...collection, links }] : [];
  });
  const shopPreview = filterProducts(products).slice(0, 4).map(product => ({
    name: cleanText(product.name) || "Product",
    path: `/product/${encodeURIComponent(String(product.id ?? product._id))}`,
    image: getImages(product, origin).find(url => url.startsWith("https://")) || "",
  }));
  // Keep the no-script shop document bounded as the catalogue grows. The
  // sitemap and scoped collection documents retain their complete link lists.
  const shopLinks = entries
    .filter(({ route, metadata }) => origin + route === metadata.canonical)
    .slice(0, 48)
    .map(({ route, metadata }) => ({ route, heading: metadata.schema.name }));
  return { version: 1, origin, observedAt: new Date().toISOString(), entries, collections, shopPreview, shopLinks };
}
export async function writeStorefrontDocuments({ directory = path.join(root, "dist"), snapshot, template } = {}) {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.entries)) throw new Error("Regenerate the public catalogue before the website build");
  template ??= await fs.readFile(path.join(directory, "index.html"), "utf8");
  const documents = new Map();
  const collectionDocs = snapshot.collections || [];
  const defaultPreview = {
    type: "website", image: new URL(DEFAULT_SHARE_IMAGE, snapshot.origin).href, imageAlt: "GymDrobe wordmark",
  };
  const categoryLinks = collectionDocs.length
    ? `<h2>Shop by category</h2>${collectionLinks(collectionDocs)}`
    : "";
  const products = snapshot.shopLinks?.length
    ? `<h2>Shop products</h2>${collectionLinks(snapshot.shopLinks)}`
    : "";
  const app = '<a href="/install">Install the GymDrobe web app</a>';
  const shop = '<a href="/shop">Shop GymDrobe</a>';
  const fallbacks = {
    "/": `<h1>GymDrobe</h1><p>${escape(PAGES["/"].description)}</p><p>${shop} · ${app}</p>${categoryLinks}`,
    "/shop": `<h1>Shop GymDrobe</h1><p>${escape(PAGES["/shop"].description)}</p>${categoryLinks}${products}`,
    "/install": `<h1>Install the GymDrobe web app</h1><p>${escape(PAGES["/install"].description)}</p><ul><li>On iPhone or iPad, open GymDrobe in Safari and choose Add to Home Screen in the Share menu.</li><li>On Android, open GymDrobe in Chrome and choose Install app or Add to Home screen in the browser menu.</li></ul><p>${shop}</p>`,
    "/offers": `<h1>GymDrobe Offers</h1><p>${escape(PAGES["/offers"].description)}</p><p>${shop}</p>`,
    "/help": `<h1>GymDrobe Shopping Help</h1><p>${escape(PAGES["/help"].description)}</p><p><a href="/shipping-and-returns.html">Shipping and returns</a></p>`,
  };
  for (const route of STOREFRONT_DOCUMENT_ROUTES) {
    documents.set(route, {
      ...PAGES[route], ...defaultPreview, canonical: snapshot.origin + route,
      robots: "index, follow", homepage: route === "/", fallback: `<main>${fallbacks[route]}</main>`,
      ...(route === "/shop" && { shopPreview: { observedAt: snapshot.observedAt, items: snapshot.shopPreview } }),
    });
  }
  for (const collection of collectionDocs) {
    const { route, heading, description, title, links } = collection;
    if (!Object.hasOwn(STOREFRONT_COLLECTIONS, route)) throw new Error("Invalid collection document path");
    documents.set(route, {
      ...defaultPreview, title, description, canonical: snapshot.origin + route,
      robots: "index, follow", breadcrumbs: collectionBreadcrumbs(snapshot.origin, route, collection),
      fallback: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a></nav><h1>${escape(heading)}</h1><p>${escape(description)}</p>${collectionLinks(links)}</main>`,
    });
  }
  for (const entry of snapshot.entries) {
    if (!/^\/product\/[A-Za-z0-9_-]{1,200}$/.test(entry.route) || entry.metadata?.canonical?.startsWith(snapshot.origin + "/product/") !== true) throw new Error("Invalid catalogue document path");
    const { schema } = entry.metadata;
    const image = schema.image?.[0];
    documents.set(entry.route, {
      ...entry.metadata, robots: "index, follow",
      fallback: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a></nav><h1>${escape(schema.name)}</h1>${image ? `<img src="${escape(image)}" alt="${escape(schema.name)}">` : ""}<p>${escape(schema.description)}</p><p>Enable JavaScript to see current prices, stock and purchase options.</p><a href="/shop">Shop GymDrobe</a></main>`,
    });
  }
  const shell = { ...defaultPreview, title: "GymDrobe", description: "GymDrobe fitness shopping." };
  await fs.writeFile(path.join(directory, "storefront-shell.html"), metadataHtml(template, shell), "utf8");
  const missing = {
    ...shell, title: "Page Not Found | GymDrobe", description: "This GymDrobe page could not be found.",
    robots: "noindex, follow", fallback: '<main><h1>Page not found</h1><a href="/">Visit GymDrobe</a></main>',
  };
  await fs.writeFile(path.join(directory, "404.html"), metadataHtml(template, missing), "utf8");

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
