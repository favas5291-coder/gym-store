import { ownerKey } from "../utils/customerData.js";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { makeId, readStorage, writeStorage } from "../utils/storage.js";
import useProductReviews from "../hooks/useProductReviews.js";
export default function ProductReviews({ product }) {
  const { user } = useAuth(),
    { notify } = useStore();
  const { reviews, rating, count } = useProductReviews(product);
  const [sort, setSort] = useState("newest"),
    [filter, setFilter] = useState(""),
    [editing, setEditing] = useState(null);
  const voteKey = `gymdrobe-helpful:${ownerKey(user)}:${product.id}`;
  const [votes, setVotes] = useState(() => {
    const v = readStorage(voteKey, []);
    return Array.isArray(v) ? v : [];
  });
  const shown = reviews
    .filter((r) => !filter || Number(r.rating) === Number(filter))
    .sort((a, b) =>
      sort === "highest"
        ? b.rating - a.rating
        : sort === "lowest"
          ? a.rating - b.rating
          : String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
  function removeReview(review) {
    if (review.ownerKey !== ownerKey(user)) return;
    const saved = readStorage("gymdrobe-reviews", {});
    const next = {
      ...saved,
      [product.id]: (saved?.[product.id] || []).filter(
        (r) => r.id !== review.id || r.ownerKey !== ownerKey(user),
      ),
    };
    if (writeStorage("gymdrobe-reviews", next)) {
      window.dispatchEvent(new Event("gymdrobe-reviews-updated"));
      notify("Your review was removed.");
    }
  }
  const [form, setForm] = useState({
      name: user?.name || "",
      rating: "5",
      comment: "",
    }),
    [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    const name = form.name.trim(),
      comment = form.comment.trim(),
      score = Number(form.rating);
    if (
      name.length < 2 ||
      comment.length < 5 ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      setError(
        "Enter your name, a rating and a review of at least 5 characters.",
      );
      return;
    }
    const saved = readStorage("gymdrobe-reviews", {}),
      all =
        saved && typeof saved === "object" && !Array.isArray(saved)
          ? saved
          : {};
    const items = Array.isArray(all[product.id]) ? all[product.id] : [];
    if (
      editing &&
      !items.some((r) => r.id === editing && r.ownerKey === ownerKey(user))
    ) {
      setError("This review cannot be edited by the current account.");
      return;
    }
    all[product.id] = [
      {
        id: editing || makeId("review"),
        ownerKey: ownerKey(user),
        name,
        comment,
        rating: score,
        verified: false,
        createdAt: new Date().toISOString(),
      },
      ...items.filter((r) => r.id !== editing),
    ];
    if (!writeStorage("gymdrobe-reviews", all)) {
      setError(
        "Your review could not be saved. Check browser storage and try again.",
      );
      return;
    }
    window.dispatchEvent(new Event("gymdrobe-reviews-updated"));
    setForm({ ...form, comment: "" });
    setEditing(null);
    setError("");
    notify("Review saved on this device.");
  }
  return (
    <section id="product-reviews" className="reviews-section">
      <h2>RATINGS & REVIEWS</h2>
      <div className="review-layout">
        <div>
          <div className="review-score">
            <strong>
              {count ? rating : "—"}
              <span aria-hidden="true"> ★</span>
            </strong>
            <p>
              {count} {count === 1 ? "review" : "reviews"}
            </p>
          </div>
          {[5, 4, 3, 2, 1].map((stars) => (
            <div className="rating-bar" key={stars}>
              <span>{stars} ★</span>
              <progress
                aria-label={`${stars}-star reviews`}
                max={Math.max(1, count)}
                value={reviews.filter((r) => Number(r.rating) === stars).length}
              />
              <small>
                {reviews.filter((r) => Number(r.rating) === stars).length}
              </small>
            </div>
          ))}
          <form className="review-form" onSubmit={submit}>
            <h3>Share your experience</h3>
            <p className="muted">Preview reviews are saved on this device.</p>
            <div className="field">
              <label htmlFor="review-name">Name</label>
              <input
                id="review-name"
                required
                minLength="2"
                maxLength="80"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="review-rating">Your rating</label>
              <select
                id="review-rating"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="review-comment">Your review</label>
              <textarea
                id="review-comment"
                required
                minLength="5"
                maxLength="1500"
                rows="4"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <button className="button" type="submit">
              {editing ? "Save review changes" : "Submit review"}
            </button>
          </form>
        </div>
        <div>
          <div className="browse-controls">
            <label>
              Sort reviews{" "}
              <select
                aria-label="Sort reviews"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </select>
            </label>
            <label>
              Filter rating{" "}
              <select
                aria-label="Filter review rating"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All ratings</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </label>
          </div>
          {shown.length ? (
            shown.map((review, index) => (
              <article className="review" key={review.id || index}>
                <strong className="rating-pill">{review.rating} ★</strong>
                <p>{review.comment}</p>
                <small>
                  {review.name}
                  {review.createdAt &&
                  !Number.isNaN(Date.parse(review.createdAt))
                    ? ` · ${new Date(review.createdAt).toLocaleDateString("en-IN")}`
                    : ""}
                </small>
                <div className="bag-links">
                  <button
                    type="button"
                    className="text-link"
                    aria-pressed={votes.includes(String(review.id || index))}
                    onClick={() => {
                      const id = String(review.id || index),
                        next = votes.includes(id)
                          ? votes.filter((v) => v !== id)
                          : [...votes, id];
                      if (writeStorage(voteKey, next)) setVotes(next);
                    }}
                  >
                    {votes.includes(String(review.id || index))
                      ? "Marked helpful ✓"
                      : "Helpful?"}
                  </button>
                  {review.ownerKey === ownerKey(user) && (
                    <>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => {
                          setEditing(review.id);
                          setForm({
                            name: review.name,
                            rating: String(review.rating),
                            comment: review.comment,
                          });
                          document.getElementById("review-comment")?.focus();
                        }}
                      >
                        Edit your review
                      </button>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => removeReview(review)}
                      >
                        Delete your review
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          ) : (
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