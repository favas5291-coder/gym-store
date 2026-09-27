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
export const productPath = (id) => `/product/${encodeURIComponent(id)}`;
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
export const inStock = (product) => getTotalStock(product) > 0;
export const validProducts = (list) =>
  (Array.isArray(list) ? list : []).filter((p) => p && p.id != null && p.name);
export function ProductImage({
  product,
  className = "",
  eager = false,
  decorative = false,
}) {
  const source = typeof product?.image === "string" ? product.image : "";
  const [failed, setFailed] = useState(null);
  return source && failed !== source ? (
    <img
      src={source}
      className={className}
      alt={decorative ? "" : product?.name || "Product"}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(source)}
    />
  ) : (
    <span
      className={`gm-image-fallback ${className}`}
      aria-hidden={decorative || undefined}
    >
      <ProductArtwork category={product?.category} name={product?.name} />
      <span className="sr-only">{product?.name || "GymDrobe"}</span>
      <small>Illustration · photo unavailable</small>
    </span>
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
      style={direction === "left" ? { transform: "rotate(180deg)" } : undefined}
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