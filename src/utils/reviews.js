import { readStorage } from "./storage.js";
export function reviewStats(product) {
  const saved = readStorage("gymdrobe-reviews", {});
  const local =
    saved && typeof saved === "object" && Array.isArray(saved[product?.id])
      ? saved[product.id]
      : [];
  const reviews = [
    ...local,
    ...(Array.isArray(product?.reviews) ? product.reviews : []),
  ].filter(
    (item) =>
      item &&
      typeof item.name === "string" &&
      typeof item.comment === "string" &&
      Number.isInteger(Number(item.rating)) &&
      Number(item.rating) >= 1 &&
      Number(item.rating) <= 5,
  );
  const rating = reviews.length
    ? Math.round(
        (reviews.reduce((n, item) => n + Number(item.rating), 0) /
          reviews.length) *
          10,
      ) / 10
    : 0;
  return { reviews, rating, count: reviews.length };
}