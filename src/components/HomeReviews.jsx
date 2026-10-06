import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import {
  reviewStats,
} from "../utils/reviews.js";

import "./HomeReviews.css";

export default function HomeReviews() {
  const {
    products,
    loading,
    error,
  } = useCatalog();

  const [version, setVersion] = useState(0);

  useEffect(() => {
    function refresh() {
      setVersion((current) => current + 1);
    }

    window.addEventListener(
      "gymdrobe-reviews-updated",
      refresh,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-reviews-updated",
        refresh,
      );
    };
  }, []);

  const reviews = useMemo(() => {
    const rows = [];
    const seen = new Set();

    for (const product of products || []) {
      const productId =
        product?.id || product?._id;

      if (
        !productId ||
        product.isActive === false
      ) {
        continue;
      }

      for (const review of reviewStats(product).reviews) {
        const timestamp = Date.parse(
          review.createdAt || "",
        );

        if (
          review.verified !== true ||
          !review.id ||
          !review.name.trim() ||
          !review.comment.trim() ||
          !Number.isFinite(timestamp)
        ) {
          continue;
        }

        const key =
          `${productId}:${review.id}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        rows.push({
          ...review,
          key,
          timestamp,
          productId: String(productId),
          productName:
            product.name || "View product",
        });
      }
    }

    // Show recent reviews regardless of their score.
    return rows
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6);
  }, [products, version]);

  if (loading || error || !reviews.length) {
    return null;
  }

  return (
    <section
      className="gd-home-reviews"
      aria-labelledby="gd-home-reviews-title"
    >
      <div className="gd-home-reviews-heading">
        <div>
          <p className="gd-home-reviews-eyebrow">
            CUSTOMER EXPERIENCES
          </p>

          <h2 id="gd-home-reviews-title">
            From our verified buyers
          </h2>

          <p className="gd-home-reviews-description">
            Recent reviews from customers whose
            orders were delivered.
          </p>
        </div>

        <Link
          className="gd-home-reviews-shop"
          to="/shop"
        >
          Explore the collection →
        </Link>
      </div>

      <div className="gd-home-reviews-grid">
        {reviews.map((review) => (
          <article
            className="gd-home-review"
            key={review.key}
          >
            <div className="gd-home-review-top">
              <span
                className="gd-home-review-rating"
                aria-label={`${review.rating} out of 5 stars`}
              >
                {review.rating}
                <span aria-hidden="true"> ★</span>
              </span>

              <span className="gd-home-review-verified">
                Verified Buyer
              </span>
            </div>

            <blockquote className="gd-home-review-comment">
              {review.comment}
            </blockquote>

            <div className="gd-home-review-author">
              <strong>{review.name}</strong>

              <time dateTime={review.createdAt}>
                {new Date(
                  review.timestamp,
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>

            <Link
              className="gd-home-review-product"
              to={
                `/product/${encodeURIComponent(
                  review.productId,
                )}#product-reviews`
              }
            >
              {review.productName}
              <span aria-hidden="true"> →</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}