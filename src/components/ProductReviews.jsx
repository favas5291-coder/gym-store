import { useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import { ownerKey } from "../utils/customerData.js";
import {
  readStorage,
  writeStorage,
} from "../utils/storage.js";

import {
  updateProductReviews,
} from "../utils/reviews.js";

import useProductReviews from "../hooks/useProductReviews.js";

import {
  getReviews,
  saveReview,
  deleteReview,
} from "../services/reviewApi.js";

export default function ProductReviews({ product }) {
  const productId = product?.id || product?._id;

  if (!productId) {
    return null;
  }

  return (
    <ReviewPanel
      key={String(productId)}
      product={product}
      productId={productId}
    />
  );
}

function ReviewPanel({ product, productId }) {
  const { user, token } = useAuth();
  const { notify } = useStore();

  const {
    reviews,
    rating,
    count,
  } = useProductReviews(product);

  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    rating: "5",
    comment: "",
  });

  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const userId = String(
    user?._id || user?.id || "",
  );

  const owns = (review) =>
    Boolean(
      userId &&
        String(review.userId) === userId,
    );

  const ownReview = reviews.find(owns);

  const voteKey =
    `gymdrobe-helpful:${ownerKey(user)}:${productId}`;

  const [votes, setVotes] = useState(() => {
    const saved = readStorage(voteKey, []);
    return Array.isArray(saved) ? saved : [];
  });

  const disabled =
    loading || busy || Boolean(loadError);

  const shown = reviews
    .filter(
      (review) =>
        !filter ||
        Number(review.rating) === Number(filter),
    )
    .sort((a, b) => {
      if (sort === "highest") {
        return Number(b.rating) - Number(a.rating);
      }

      if (sort === "lowest") {
        return Number(a.rating) - Number(b.rating);
      }

      return String(
        b.createdAt || "",
      ).localeCompare(
        String(a.createdAt || ""),
      );
    });

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setLoadError("");

    getReviews(productId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          updateProductReviews(
            productId,
            data.reviews,
          );
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setLoadError(
            err.message || "Unable to load reviews.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [productId, attempt]);

  useEffect(() => {
    setEditing(false);
    setForm({
      rating: "5",
      comment: "",
    });
    setError("");

    const saved = readStorage(voteKey, []);
    setVotes(
      Array.isArray(saved) ? saved : [],
    );
  }, [voteKey]);

  function startEditing(review) {
    setEditing(true);
    setError("");

    setForm({
      rating: String(review.rating),
      comment: review.comment,
    });

    document
      .getElementById("review-comment")
      ?.focus();
  }

  function cancelEditing() {
    setEditing(false);
    setError("");
    setForm({
      rating: "5",
      comment: "",
    });
  }

  async function submit(event) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    if (!user || !token) {
      setError(
        "Please sign in to write a review.",
      );
      return;
    }

    const score = Number(form.rating);
    const comment = form.comment.trim();

    if (
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5 ||
      comment.length < 5 ||
      comment.length > 1500
    ) {
      setError(
        "Choose a rating and write a review of 5–1500 characters.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const data = await saveReview(
        productId,
        token,
        {
          rating: score,
          comment,
        },
      );

      if (!data.review) {
        throw new Error(
          "The server did not return your saved review. Please reload the reviews.",
        );
      }

      updateProductReviews(productId, [
        data.review,
        ...reviews.filter(
          (review) =>
            String(review.userId) !==
            String(data.review.userId),
        ),
      ]);

      setForm({
        rating: "5",
        comment: "",
      });
      setEditing(false);

      notify("Your review was saved.");
    } catch (err) {
      setError(
        err.message || "Unable to save your review.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeReview(review) {
    if (!owns(review) || disabled || !token) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await deleteReview(productId, token);

      updateProductReviews(
        productId,
        reviews.filter(
          (item) => item.id !== review.id,
        ),
      );

      setEditing(false);
      setForm({
        rating: "5",
        comment: "",
      });

      notify("Your review was removed.");
    } catch (err) {
      setError(
        err.message || "Unable to remove your review.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleHelpful(reviewId) {
    const id = String(reviewId);

    const next = votes.includes(id)
      ? votes.filter((vote) => vote !== id)
      : [...votes, id];

    if (writeStorage(voteKey, next)) {
      setVotes(next);
    } else {
      notify(
        "Unable to save your helpful mark on this device.",
        "warning",
      );
    }
  }

  return (
    <section
      id="product-reviews"
      className="reviews-section"
      aria-labelledby="product-reviews-title"
    >
      <h2 id="product-reviews-title">
        RATINGS & REVIEWS
      </h2>

      <div className="review-layout">
        <div>
          <div className="review-score">
            <strong>
              {count ? rating : "—"}
              <span aria-hidden="true"> ★</span>
            </strong>

            <p>
              {count}{" "}
              {count === 1 ? "review" : "reviews"}
            </p>
          </div>

          {[5, 4, 3, 2, 1].map((stars) => {
            const total = reviews.filter(
              (review) =>
                Number(review.rating) === stars,
            ).length;

            return (
              <div
                className="rating-bar"
                key={stars}
              >
                <span>{stars} ★</span>

                <progress
                  aria-label={`${stars}-star reviews`}
                  max={Math.max(1, count)}
                  value={total}
                />

                <small>{total}</small>
              </div>
            );
          })}

          <form
            className="review-form"
            onSubmit={submit}
          >
            <h3>
              {editing
                ? "Edit your review"
                : "Share your experience"}
            </h3>

            <p className="muted">
              {user
                ? `Reviewing as ${user.name || "Customer"}. One review per account and product.`
                : "Sign in to share your experience."}
            </p>

            <p className="muted">
              Verified Buyer means a delivered
              order includes this product.
            </p>

            {ownReview && !editing ? (
              <>
                <p className="muted">
                  You have already reviewed this
                  product.
                </p>

                <button
                  type="button"
                  className="button"
                  disabled={disabled}
                  onClick={() =>
                    startEditing(ownReview)
                  }
                >
                  Edit your review
                </button>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="review-rating">
                    Your rating
                  </label>

                  <select
                    id="review-rating"
                    value={form.rating}
                    disabled={busy || !token}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        rating: event.target.value,
                      })
                    }
                  >
                    {[5, 4, 3, 2, 1].map(
                      (stars) => (
                        <option
                          key={stars}
                          value={stars}
                        >
                          {stars}{" "}
                          {stars === 1
                            ? "star"
                            : "stars"}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="review-comment">
                    Your review
                  </label>

                  <textarea
                    id="review-comment"
                    required
                    minLength={5}
                    maxLength={1500}
                    rows={4}
                    value={form.comment}
                    disabled={busy || !token}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        comment: event.target.value,
                      })
                    }
                  />
                </div>

                <button
                  type="submit"
                  className="button"
                  disabled={disabled || !token}
                >
                  {busy
                    ? "Saving…"
                    : editing
                      ? "Save review changes"
                      : "Submit review"}
                </button>

                {editing && (
                  <button
                    type="button"
                    className="text-link"
                    disabled={busy}
                    onClick={cancelEditing}
                  >
                    Cancel editing
                  </button>
                )}
              </>
            )}

            {error && (
              <p
                role="alert"
                className="field-error"
              >
                {error}
              </p>
            )}
          </form>
        </div>

        <div>
          <div className="browse-controls">
            <label>
              Sort reviews{" "}
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value)
                }
              >
                <option value="newest">
                  Newest first
                </option>

                <option value="highest">
                  Highest rating
                </option>

                <option value="lowest">
                  Lowest rating
                </option>
              </select>
            </label>

            <label>
              Filter rating{" "}
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value)
                }
              >
                <option value="">
                  All ratings
                </option>

                {[5, 4, 3, 2, 1].map((stars) => (
                  <option
                    key={stars}
                    value={stars}
                  >
                    {stars}{" "}
                    {stars === 1
                      ? "star"
                      : "stars"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading && (
            <p role="status">
              Loading reviews…
            </p>
          )}

          {loadError && (
            <div
              role="alert"
              className="field-error"
            >
              <p>{loadError}</p>

              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setAttempt(
                    (value) => value + 1,
                  )
                }
              >
                Retry loading reviews
              </button>
            </div>
          )}

          {shown.map((review, index) => {
            const id = String(
              review.id || index,
            );

            const helpful = votes.includes(id);

            const hasDate =
              review.createdAt &&
              !Number.isNaN(
                Date.parse(review.createdAt),
              );

            return (
              <article
                className="review"
                key={id}
              >
                <strong className="rating-pill">
                  {review.rating} ★
                </strong>

                <p>{review.comment}</p>

                <small>
                  {review.name}

                  {review.verified === true &&
                    " · Verified Buyer"}

                  {hasDate &&
                    ` · ${new Date(
                      review.createdAt,
                    ).toLocaleDateString("en-IN")}`}
                </small>

                <div className="bag-links">
                  <button
                    type="button"
                    className="text-link"
                    aria-pressed={helpful}
                    onClick={() =>
                      toggleHelpful(id)
                    }
                  >
                    {helpful
                      ? "Marked helpful ✓"
                      : "Helpful?"}
                  </button>

                  {owns(review) && (
                    <>
                      <button
                        type="button"
                        className="text-link"
                        disabled={disabled}
                        onClick={() =>
                          startEditing(review)
                        }
                      >
                        Edit your review
                      </button>

                      <button
                        type="button"
                        className="text-link"
                        disabled={disabled}
                        onClick={() =>
                          removeReview(review)
                        }
                      >
                        Delete your review
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}

          {!shown.length &&
            !loading &&
            !loadError && (
              <p className="muted">
                {filter
                  ? "No reviews with this rating."
                  : "Be the first to review this product."}
              </p>
            )}
        </div>
      </div>
    </section>
  );
}