const reviewCache = new Map();

export function updateProductReviews(
  productId,
  reviews,
) {
  reviewCache.set(
    String(productId),
    Array.isArray(reviews) ? reviews : [],
  );

  window.dispatchEvent(
    new Event("gymdrobe-reviews-updated"),
  );
}

export function reviewStats(product) {
  const productId = String(
    product?.id || product?._id || "",
  );

  const source =
    reviewCache.get(productId) ??
    product?.reviews ??
    [];

  const reviews = (
    Array.isArray(source) ? source : []
  ).filter(
    (review) =>
      review &&
      typeof review.name === "string" &&
      typeof review.comment === "string" &&
      Number.isInteger(Number(review.rating)) &&
      Number(review.rating) >= 1 &&
      Number(review.rating) <= 5,
  );

  const count = reviews.length;

  const rating = count
    ? Math.round(
        (reviews.reduce(
          (total, review) =>
            total + Number(review.rating),
          0,
        ) /
          count) *
          10,
      ) / 10
    : 0;

  return {
    reviews,
    rating,
    count,
  };
}