import { useState } from "react";

import ProductArtwork from "./ProductArtwork.jsx";

import {
  getDiscountPercentage,
  getDiscountedPrice,
  getOriginalPrice,
  money,
} from "../utils/productPricing.js";

import { getTotalStock } from "../utils/cartUtils.js";

export { money };

// Import local images so Vite includes them in production.
// This imports image URLs; the browser still loads images lazily.
const bundledImages = import.meta.glob(
  "/src/assets/**/*.{jpg,jpeg,png,webp,avif,gif,svg,JPG,JPEG,PNG,WEBP,AVIF,GIF,SVG}",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

export const productPath = (id) =>
  `/product/${encodeURIComponent(id)}`;

export const categoryPath = (name) =>
  `/shop?${new URLSearchParams({ category: name })}`;

export function priceDetails(product) {
  return {
    valid:
      product?.price != null &&
      Number.isFinite(Number(product.price)) &&
      Number(product.price) >= 0,
    price: getOriginalPrice(product),
    discount: getDiscountPercentage(product),
    selling: getDiscountedPrice(product),
  };
}

export const inStock = (product) =>
  getTotalStock(product) > 0;

export const validProducts = (list) =>
  (Array.isArray(list) ? list : []).filter(
    (product) =>
      product &&
      product.id != null &&
      product.name
  );

// Resolve existing source assets, public paths and hosted URLs.
export function resolveProductImage(value) {
  if (typeof value !== "string") return "";

  const source = value.trim();

  if (!source) return "";

  // Preserve hosted image URLs and image data.
  if (
    /^https?:\/\//i.test(source) ||
    /^\/\//.test(source) ||
    /^data:image\//i.test(source) ||
    /^blob:/i.test(source)
  ) {
    return source;
  }

  // Reject other URL schemes and Windows file paths.
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
    return "";
  }

  let pathname = source
    .split(/[?#]/)[0]
    .replace(/\\/g, "/");

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the original path if decoding is invalid.
  }

  pathname = pathname.replace(/^\.\/+/, "");

  if (pathname.startsWith("src/assets/")) {
    pathname = `/${pathname}`;
  } else if (pathname.startsWith("../assets/")) {
    pathname = `/src/assets/${pathname.slice("../assets/".length)}`;
  }

  if (pathname.startsWith("/src/assets/")) {
    // An absent source file cannot be restored by changing its URL.
    return bundledImages[pathname] || "";
  }

  // Files in public are served without the "public" prefix.
  if (pathname.startsWith("/public/")) {
    return pathname.slice("/public".length);
  }

  if (pathname.startsWith("public/")) {
    return `/${pathname.slice("public/".length)}`;
  }

  // Keep public and already-built URLs, including query strings.
  return source.startsWith("/")
    ? source
    : `/${source.replace(/^\.\/+/, "")}`;
}

function imageCandidates(product) {
  const sources = [
    product?.image,
    ...(Array.isArray(product?.images)
      ? product.images
      : []),
  ];

  return [
    ...new Set(
      sources.map(resolveProductImage).filter(Boolean)
    ),
  ];
}

function ProductImageContent({
  product,
  sources,
  className,
  eager,
  decorative,
  fetchPriority,
}) {
  const [index, setIndex] = useState(0);
  const source = sources[index];

  if (source) {
    return (
      <img
        key={source}
        src={source}
        className={className}
        alt={decorative ? "" : product?.name || "Product"}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={fetchPriority}
        onError={() => setIndex((current) => current + 1)}
      />
    );
  }

  return (
    <span
      className={`gm-image-fallback ${className}`}
      aria-hidden={decorative || undefined}
    >
      <ProductArtwork
        category={product?.category}
        name={product?.name}
      />

      <span className="sr-only">
        {product?.name || "GymDrobe"}
      </span>

      <small>Illustration · photo unavailable</small>
    </span>
  );
}

export function ProductImage({
  product,
  className = "",
  eager = false,
  decorative = false,
  fetchPriority = "auto",
}) {
  const sources = imageCandidates(product);

  return (
    <ProductImageContent
      key={JSON.stringify(sources)}
      product={product}
      sources={sources}
      className={className}
      eager={eager}
      decorative={decorative}
      fetchPriority={fetchPriority}
    />
  );
}

export function Arrow({ direction = "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      style={
        direction === "left"
          ? { transform: "rotate(180deg)" }
          : undefined
      }
    >
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );
}

export function Heart({ filled = false }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}