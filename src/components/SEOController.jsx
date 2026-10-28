import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useCatalog } from "../context/CatalogContext.jsx";
import { getDiscountedPrice } from "../utils/productPricing.js";
import { getTotalStock } from "../utils/cartUtils.js";
import { returnPolicyMarkup } from "../utils/returnPolicy.js";

const DEFAULT_DESCRIPTION =
  "Discover training clothing, gym shoes and workout essentials at GymDrobe. Everything you need for every workout.";

const DEFAULT_SHARE_IMAGE = "/gymdrobe-share-v1.png";

const PAGES = {
  "/install": {
    title: "Install GymDrobe | Your Fitness Store",
    description: "Add GymDrobe to your home screen for quick access to fitness essentials, your shopping bag and orders.",
  },
  "/": {
    title: "GymDrobe | Everything for Every Workout",
    description: DEFAULT_DESCRIPTION,
  },

  "/shop": {
    title: "Shop Gym Clothing & Workout Essentials | GymDrobe",

    description:
      "Explore gym clothing, shoes, bags and workout essentials at GymDrobe. Browse products, compare options and find gear for your next workout.",
  },

  "/offers": {
    title: "Offers & Coupons | GymDrobe",

    description:
      "Explore current GymDrobe offers on gym clothing and workout essentials.",
  },

  "/help": {
    title: "Shopping Help | GymDrobe",

    description:
      "Find help with shopping, delivery, payments and orders at GymDrobe.",
  },
};

function cleanText(value) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function setMeta(name, content, property = false) {
  const attribute = property ? "property" : "name";

  const selector = `meta[${attribute}="${name}"]`;

  const existing = [
    ...document.head.querySelectorAll(selector),
  ];

  let element = existing.shift();

  existing.forEach((duplicate) => duplicate.remove());

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }

  element.content = content;
}

function removeMeta(name, property = false) {
  const attribute = property ? "property" : "name";

  document.head
    .querySelectorAll(`meta[${attribute}="${name}"]`)
    .forEach((element) => element.remove());
}

function getSiteOrigin() {
  const fallback = window.location.origin;

  try {
    const configured = new URL(
      String(
        import.meta.env.VITE_SITE_URL || fallback,
      ).trim(),
    );

    if (
      ["https:", "http:"].includes(configured.protocol)
    ) {
      return configured.origin;
    }
  } catch {
    // Use the current website if configuration is invalid.
  }

  return fallback;
}

function getImages(product, origin) {
  const sources = [
    product.image,

    ...(Array.isArray(product.images)
      ? product.images
      : []),
  ];

  const images = sources.flatMap((source) => {
    if (
      typeof source !== "string" ||
      !source.trim()
    ) {
      return [];
    }

    try {
      const url = new URL(source.trim(), origin);

      return ["https:", "http:"].includes(url.protocol)
        ? [url.href]
        : [];
    } catch {
      return [];
    }
  });

  return [...new Set(images)];
}

function updateCanonical(url) {
  const links = [
    ...document.head.querySelectorAll(
      'link[rel="canonical"]',
    ),
  ];

  if (!url) {
    links.forEach((link) => link.remove());
    return;
  }

  let link = links.shift();

  links.forEach((duplicate) => duplicate.remove());

  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }

  link.href = url;
}

export default function SEOController() {
  const { pathname } = useLocation();

  const {
    products,
    loading,
    loaded,
    error,
  } = useCatalog();

  useEffect(() => {
    const origin = getSiteOrigin();

    const path =
      pathname.replace(/\/+$/, "") || "/";

    const match = path.match(
      /^\/product\/([^/]+)$/,
    );

    let identifier = "";

    try {
      identifier = match
        ? decodeURIComponent(match[1])
        : "";
    } catch {
      // Malformed identifiers cannot match a product.
    }

    const catalog = Array.isArray(products)
      ? products
      : [];

    const product = match
      ? catalog.find(
          (item) =>
            item &&
            identifier &&
            [
              item.id,
              item._id,
              item.legacyId,
              item.slug,
            ].some(
              (value) =>
                value != null &&
                String(value) === identifier,
            ),
        )
      : null;

    const page = PAGES[path];

    const isPublicPage = Boolean(page || match);

    const missingProduct = Boolean(
      match &&
        loaded === true &&
        !loading &&
        !error &&
        !product,
    );

    const name =
      cleanText(product?.name) || "Product";

    const title = missingProduct
      ? "Product Not Found | GymDrobe"
      : product
        ? `${name} | GymDrobe`
        : page?.title ||
          (match
            ? "Product | GymDrobe"
            : "Your Account & Shopping | GymDrobe");

    const fullDescription = product
      ? cleanText(product.description) ||
        `Explore ${name} at GymDrobe. View available options, pricing and stock.`
      : page?.description || DEFAULT_DESCRIPTION;

    const summary = fullDescription.slice(0, 160);

    const canonicalPath = product
      ? `/product/${encodeURIComponent(
          product.id ?? product._id ?? identifier,
        )}`
      : path;

    // Keep canonical URLs on the configured website origin.
    const canonicalUrl = new URL(
      `${origin}${canonicalPath}`,
    ).href;

    document.title = title;

    setMeta("description", summary);

    setMeta(
      "robots",
      isPublicPage && !missingProduct
        ? "index, follow"
        : "noindex, follow",
    );

    setMeta(
      "og:type",
      product ? "product" : "website",
      true,
    );

    setMeta("og:site_name", "GymDrobe", true);
    setMeta("og:title", title, true);
    setMeta("og:description", summary, true);
    setMeta("og:url", canonicalUrl, true);

    setMeta("twitter:card", "summary");
    setMeta("twitter:title", title);
    setMeta("twitter:description", summary);

    updateCanonical(
      isPublicPage && !missingProduct
        ? canonicalUrl
        : null,
    );

    document
      .getElementById("gymdrobe-product-schema")
      ?.remove();

    // Clear previous image metadata before applying this page's image.
    removeMeta("og:image", true);
    removeMeta("og:image:secure_url", true);
    removeMeta("og:image:type", true);
    removeMeta("og:image:width", true);
    removeMeta("og:image:height", true);
    removeMeta("og:image:alt", true);
    removeMeta("twitter:image");
    removeMeta("twitter:image:alt");

    const images = product
      ? getImages(product, origin)
      : [];

    const shareImage =
      images[0] ||
      new URL(DEFAULT_SHARE_IMAGE, origin).href;

    const imageAlt = images.length
      ? name
      : "GymDrobe wordmark";

    setMeta("og:image", shareImage, true);
    setMeta("og:image:alt", imageAlt, true);

    setMeta("twitter:image", shareImage);
    setMeta("twitter:image:alt", imageAlt);

    setMeta(
      "twitter:card",
      "summary_large_image",
    );

    // These dimensions describe the existing GymDrobe wordmark.
    // Product photos can have different dimensions.
    if (!images.length) {
      setMeta(
        "og:image:secure_url",
        shareImage,
        true,
      );

      setMeta(
        "og:image:type",
        "image/png",
        true,
      );

      setMeta(
        "og:image:width",
        "1942",
        true,
      );

      setMeta(
        "og:image:height",
        "809",
        true,
      );
    }

    if (!product) {
      return;
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description: fullDescription,
      url: canonicalUrl,
    };

    if (images.length) {
      schema.image = images;
    }

    const sku = cleanText(product.sku);
    const brand = cleanText(product.brand);

    if (sku) {
      schema.sku = sku;
    }

    if (brand) {
      schema.brand = {
        "@type": "Brand",
        name: brand,
      };
    }

    const rawPrice = Number(product.price);

    const price = getDiscountedPrice(product);

    if (
      product.price != null &&
      product.price !== "" &&
      Number.isFinite(rawPrice) &&
      rawPrice >= 0 &&
      Number.isFinite(price) &&
      price > 0
    ) {
      schema.offers = {
        "@type": "Offer",
        url: canonicalUrl,
        priceCurrency: "INR",
        price,

        availability:
          getTotalStock(product) > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      };
    }

    const policy = returnPolicyMarkup(
      product,
      canonicalUrl,
    );

    if (schema.offers && policy) {
      schema.offers.hasMerchantReturnPolicy =
        policy;
    }

    const script = document.createElement("script");

    script.id = "gymdrobe-product-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);

    document.head.appendChild(script);
  }, [
    pathname,
    products,
    loading,
    loaded,
    error,
  ]);

  return null;
}
