import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { getDiscountedPrice } from "../utils/productPricing.js";
import { getTotalStock } from "../utils/cartUtils.js";

const description =
  "Discover training clothing, gym shoes and workout essentials at GymDrobe. Everything you need for every workout.";
const pages = {
  "/": ["GymDrobe | Everything for Every Workout", description],
  "/shop": ["Shop Gym Clothing & Workout Essentials | GymDrobe", description],
  "/offers": [
    "Offers & Coupons | GymDrobe",
    "Explore current GymDrobe offers on gym clothing and workout essentials.",
  ],
  "/help": [
    "Shopping Help | GymDrobe",
    "Find help with shopping, delivery, payments and orders at GymDrobe.",
  ],
};

function text(value) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function meta(name, content, property = false) {
  const attribute = property ? "property" : "name";
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function SEOController() {
  const { pathname } = useLocation();
  const { products, loading, loaded, error } = useCatalog();

  useEffect(() => {
    let origin = window.location.origin;
    try {
      const configured = new URL(import.meta.env.VITE_SITE_URL || origin);
      if (["https:", "http:"].includes(configured.protocol))
        origin = configured.origin;
    } catch {
      /* Use the current site when configuration is invalid. */
    }

    const path = pathname.replace(/\/+$/, "") || "/";
    const match = path.match(/^\/product\/([^/]+)$/);
    let identifier = "";
    try {
      identifier = match ? decodeURIComponent(match[1]) : "";
    } catch {
      /* Invalid product URL. */
    }
    const product =
      match &&
      products.find((item) =>
        [item.id, item._id, item.legacyId, item.slug].some(
          (value) => value != null && String(value) === identifier,
        ),
      );
    const publicPage = Boolean(pages[path] || match);
    const missingProduct = Boolean(
      match && loaded === true && !loading && !error && !product,
    );
    const title = product
      ? `${text(product.name)} | GymDrobe`
      : pages[path]?.[0] ||
        (match ? "Product | GymDrobe" : "Your Account & Shopping | GymDrobe");
    const summary = product
      ? (
          text(product.description) ||
          `Explore ${text(product.name)} at GymDrobe. View available options, pricing and stock.`
        ).slice(0, 160)
      : pages[path]?.[1] || description;
    const canonicalPath = product
      ? `/product/${encodeURIComponent(product.id ?? product._id ?? identifier)}`
      : path;
    const canonical = new URL(canonicalPath, origin).href;

    document.title = missingProduct ? "Product Not Found | GymDrobe" : title;
    meta("description", summary);
    meta(
      "robots",
      publicPage && !missingProduct ? "index, follow" : "noindex, follow",
    );
    meta("og:type", product ? "product" : "website", true);
    meta("og:site_name", "GymDrobe", true);
    meta("og:title", document.title, true);
    meta("og:description", summary, true);
    meta("og:url", canonical, true);
    meta("twitter:card", "summary");
    meta("twitter:title", document.title);
    meta("twitter:description", summary);

    let link = document.head.querySelector('link[rel="canonical"]');
    if (publicPage && !missingProduct) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    } else link?.remove();

    document.getElementById("gymdrobe-product-schema")?.remove();
    document.head.querySelector('meta[property="og:image"]')?.remove();
    document.head.querySelector('meta[name="twitter:image"]')?.remove();
    document.head.querySelector('meta[property="og:image:alt"]')?.remove();
    document.head.querySelector('meta[name="twitter:image:alt"]')?.remove();
    if (!product) return;

    const images = [
      ...new Set([
        product.image,
        ...(Array.isArray(product.images) ? product.images : []),
      ]),
    ]
      .filter((value) => typeof value === "string" && value.trim())
      .flatMap((value) => {
        try {
          const url = new URL(value, origin);
          return ["https:", "http:"].includes(url.protocol) ? [url.href] : [];
        } catch {
          return [];
        }
      });
    if (images.length) {
      meta("og:image", images[0], true);
      meta("twitter:image", images[0]);
      meta("twitter:card", "summary_large_image");
      meta("og:image:alt", text(product.name), true);
      meta("twitter:image:alt", text(product.name));
    }
    const price = getDiscountedPrice(product);
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: text(product.name),
      ...(text(product.sku) ? { sku: text(product.sku) } : {}),
      description: summary,
      url: canonical,
      ...(images.length ? { image: images } : {}),
      ...(text(product.brand)
        ? { brand: { "@type": "Brand", name: text(product.brand) } }
        : {}),
      ...(Number.isFinite(price) && price > 0
        ? {
            offers: {
              "@type": "Offer",
              url: canonical,
              priceCurrency: "INR",
              price,
              availability:
                getTotalStock(product) > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
            },
          }
        : {}),
    };
    const script = document.createElement("script");
    script.id = "gymdrobe-product-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }, [pathname, products, loading, loaded, error]);

  return null;
}
