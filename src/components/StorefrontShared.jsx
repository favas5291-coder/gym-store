import { useState } from "react";

import ProductArtwork from "./ProductArtwork.jsx";

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

// ======================================================
// PRODUCT AND CATEGORY LINKS
// ======================================================

export const productPath = (id) =>
  `/product/${encodeURIComponent(id)}`;

export const categoryPath = (name) =>
  `/shop?${new URLSearchParams({
    category: name,
  })}`;

// ======================================================
// PRODUCT PRICING
// ======================================================

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

// ======================================================
// PRODUCT AVAILABILITY
// ======================================================

export const inStock = (product) =>
  getTotalStock(product) > 0;

export const validProducts = (list) =>
  (Array.isArray(list) ? list : []).filter(
    (product) =>
      product &&
      product.id != null &&
      product.name
  );

// ======================================================
// PRODUCT IMAGE
//
// Images load lazily by default.
// Main product images can use eager loading and
// fetchPriority="high".
// ======================================================

export function ProductImage({
  product,
  className = "",
  eager = false,
  decorative = false,
  fetchPriority = "auto",
}) {
  const source =
    typeof product?.image === "string"
      ? product.image
      : "";

  const [failed, setFailed] = useState(null);

  if (source && failed !== source) {
    return (
      <img
        src={source}
        className={className}
        alt={
          decorative
            ? ""
            : product?.name || "Product"
        }
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={fetchPriority}
        onError={() => setFailed(source)}
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

      <small>
        Illustration · photo unavailable
      </small>
    </span>
  );
}

// ======================================================
// ARROW ICON
// ======================================================

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

// ======================================================
// WISHLIST ICON
// ======================================================

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