import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const publicDirectory = path.join(root, "public");

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validateSite(value) {
  let site;

  try {
    site = new URL(String(value || "").trim());
  } catch {
    throw new Error(
      "Set VITE_SITE_URL in your frontend .env file.",
    );
  }

  if (
    site.protocol !== "https:" ||
    site.username ||
    site.password ||
    site.pathname !== "/" ||
    site.search ||
    site.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(
      site.hostname,
    )
  ) {
    throw new Error(
      "VITE_SITE_URL must be a public HTTPS origin without a path.",
    );
  }

  return site.origin;
}

function validateApi(value) {
  let api;

  try {
    api = new URL(String(value || "").trim());
  } catch {
    throw new Error(
      "Set VITE_API_URL in your frontend .env file.",
    );
  }

  if (
    !["http:", "https:"].includes(api.protocol) ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    api.pathname.replace(/\/+$/, "") !== "/api"
  ) {
    throw new Error("VITE_API_URL must end in /api.");
  }

  return api.href.replace(/\/+$/, "");
}

export function buildSitemap(origin, products) {
  const siteOrigin = validateSite(origin);

  if (!Array.isArray(products)) {
    throw new Error("The product catalog must be an array.");
  }

  const routes = new Set([
    "/",
    "/shop",
    "/offers",
    "/help",
  ]);

  for (const product of products) {
    if (!product || typeof product !== "object") {
      throw new Error("The catalog contains an invalid product.");
    }

    if (product.isActive === false) {
      continue;
    }

    const id = product.id ?? product._id;

    if (
      !["string", "number"].includes(typeof id) ||
      !String(id).trim()
    ) {
      throw new Error(
        "A catalog product is missing its canonical ID.",
      );
    }

    routes.add(
      `/product/${encodeURIComponent(String(id))}`,
    );
  }

  if (routes.size > 50000) {
    throw new Error(
      "The catalog exceeds 50,000 URLs and needs multiple sitemaps.",
    );
  }

  const entries = [...routes].map(
    (route) =>
      `  <url><loc>${escapeXml(
        `${siteOrigin}${route}`,
      )}</loc></url>`,
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");

  if (Buffer.byteLength(xml, "utf8") > 50 * 1024 * 1024) {
    throw new Error("The sitemap exceeds the 50 MB limit.");
  }

  return xml;
}

async function loadEnvironment() {
  for (const filename of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(root, filename));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

async function writeAtomically(filename, contents) {
  const target = path.join(publicDirectory, filename);
  const temporary = `${target}.${process.pid}.tmp`;

  try {
    await fs.writeFile(temporary, contents, "utf8");
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

export async function main() {
  // Stop if the script is not inside the frontend root's scripts folder.
  try {
    await Promise.all([
      fs.access(path.join(root, "package.json")),
      fs.access(path.join(root, "index.html")),
    ]);
  } catch {
    throw new Error(
      "Place this file in the frontend scripts folder beside src and public.",
    );
  }

  await loadEnvironment();

  const origin = validateSite(process.env.VITE_SITE_URL);
  const api = validateApi(process.env.VITE_API_URL);

  const response = await fetch(`${api}/products`, {
    signal: AbortSignal.timeout(60000),
    headers: { Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(
      `Product API returned HTTP ${response.status}.`,
    );
  }

  const data = await response.json();

  if (
    !data ||
    data.success === false ||
    !Array.isArray(data.products)
  ) {
    throw new Error("Unexpected public product API response.");
  }

  if (
    Number(data.totalPages) > 1 ||
    Number(data.pagination?.totalPages) > 1 ||
    data.hasMore === true ||
    data.pagination?.hasMore === true
  ) {
    throw new Error(
      "The product API is paginated. All pages must be fetched before generating the sitemap.",
    );
  }

  const reportedTotal =
    data.totalProducts ??
    data.pagination?.totalProducts ??
    data.total ??
    data.pagination?.total;

  if (
    reportedTotal != null &&
    Number.isFinite(Number(reportedTotal)) &&
    Number(reportedTotal) > data.products.length
  ) {
    throw new Error(
      "The API returned an incomplete catalog.",
    );
  }

  const xml = buildSitemap(origin, data.products);

  const robots = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  await fs.mkdir(publicDirectory, { recursive: true });
  await writeAtomically("sitemap.xml", xml);
  await writeAtomically("robots.txt", robots);

  console.log(
    "Generated public/sitemap.xml and public/robots.txt.",
  );
  console.log(`Canonical website: ${origin}`);
  console.log(`Saved in: ${publicDirectory}`);
}

export function reportFailure(error) {
  const errorName =
    error && typeof error === "object" ? error.name : undefined;
  const errorMessage =
    error && typeof error === "object" ? error.message : undefined;
  const message =
    error instanceof SyntaxError
      ? "The product API returned invalid JSON."
      : error instanceof TypeError
        ? "Check API configuration and internet connectivity."
        : errorName === "TimeoutError"
          ? "The backend timed out. Please retry."
          : errorMessage || String(error || "An unexpected error occurred.");

  console.error(`Sitemap generation failed: ${message}`);
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === scriptPath
) {
  main().catch(reportFailure);
}