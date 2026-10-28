import { useState } from "react";


import {
  responsiveProductImage,
} from "../utils/responsiveProductImage.js";

import {
  productImageSources,
} from "../utils/productImages.js";

import {
  isPublicImageUrl,
} from "../utils/imageUrl.js";

import {
  getDiscountPercentage,
  getDiscountedPrice,
  getOriginalPrice,
  money,
} from "../utils/productPricing.js";

import {
  getTotalStock,
} from "../utils/cartUtils.js";

export { money };

// Include local image URLs in production.
// Images download only when the browser requests them.
const bundledImages = import.meta.glob(
  "/src/assets/**/*.{jpg,jpeg,png,webp,avif,gif,svg,JPG,JPEG,PNG,WEBP,AVIF,GIF,SVG}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

export const productPath = (id) =>
  `/product/${encodeURIComponent(id)}`;

export const categoryPath = (name) =>
  `/shop?${new URLSearchParams({
    category: name,
  })}`;

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
      product.name,
  );

// Resolve local assets, public paths and hosted images.
export function resolveProductImage(value) {
  if (typeof value !== "string") {
    return "";
  }

  const source = value.trim();

  if (!source) {
    return "";
  }

  if (/^https?:\/\//i.test(source)) {
    return isPublicImageUrl(source)
      ? source
      : "";
  }

  // Preserve image data and browser-generated previews.
  if (
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

  pathname = pathname.replace(/^\.\//, "");

  if (pathname.startsWith("src/assets/")) {
    pathname = `/${pathname}`;
  } else if (
    pathname.startsWith("../assets/")
  ) {
    pathname =
      "/src/assets/" +
      pathname.slice("../assets/".length);
  }

  if (pathname.startsWith("/src/assets/")) {
    return bundledImages[pathname] || "";
  }

  // Public files are served without the public prefix.
  if (pathname.startsWith("/public/")) {
    return pathname.slice("/public".length);
  }

  if (pathname.startsWith("public/")) {
    return (
      "/" +
      pathname.slice("public/".length)
    );
  }

  // Preserve query strings on public and built image URLs.
  return source.startsWith("/")
    ? source
    : `/${source.replace(/^\.\/+/, "")}`;
}

function imageCandidates(product) {
  const sources = productImageSources(product);

  return [
    ...new Set(
      sources
        .map(resolveProductImage)
        .filter(Boolean),
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
  sizes,
}) {
  const [index, setIndex] = useState(0);

  const [
    failedResponsive,
    setFailedResponsive,
  ] = useState("");

  const source = sources[index];

  const srcSet =
    failedResponsive === source
      ? null
      : responsiveProductImage(source);

  if (source) {
    return (
      <img
        key={source}
        src={source}
        srcSet={srcSet || undefined}
        sizes={sizes}
        className={className}
        alt={
          decorative
            ? ""
            : product?.name || "Product"
        }
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={fetchPriority}
        onError={() => {
          if (srcSet) {
            // Retry the original photo if a resized
            // version is unavailable.
            setFailedResponsive(source);
          } else {
            setIndex(
              (current) => current + 1,
            );
          }
        }}
      />
    );
  }

  return (
    <span
      className={`gm-image-fallback ${className}`}
      aria-hidden={decorative || undefined}
    >
      <span className="image-placeholder-mark" aria-hidden="true">GD</span>

      <span className="sr-only">
        {product?.name || "GymDrobe"}
      </span>

      <small>
        Photo unavailable
      </small>
    </span>
  );
}

export function ProductImage({
  product,
  className = "",
  eager = false,
  decorative = false,
  fetchPriority = "auto",

  sizes = eager
    ? "(max-width: 900px) 100vw, 60vw"
    : "(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 300px",
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
      sizes={sizes}
    />
  );
}

export function Arrow({
  direction = "right",
}) {
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
          ? {
              transform: "rotate(180deg)",
            }
          : undefined
      }
    >
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );
}

export function Heart({
  filled = false,
}) {
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