import { useId, useRef } from "react";
import { Link } from "react-router-dom";

import ProductCard from "./ProductCard.jsx";
import { Arrow } from "./StorefrontShared.jsx";

export default function ProductRow({
  title,
  products,
  id,
  to = "/shop",
}) {
  const trackRef = useRef(null);
  const generatedId = useId();

  const headingId = `${generatedId}-heading`;
  const trackId = `${generatedId}-track`;

  const rows = Array.isArray(products)
    ? products.filter(
        (product) => product && product.id != null,
      )
    : [];

  if (!rows.length) {
    return null;
  }

  const label = String(title || "Products");

  function scroll(direction) {
    const node = trackRef.current;

    if (!node) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: reducedMotion ? "instant" : "smooth",
    });
  }

  function handleKeyDown(event) {
    // Keep keyboard interactions inside product cards unchanged.
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scroll(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scroll(1);
    }
  }

  return (
    <section
      className="gm-section"
      id={id}
      aria-labelledby={headingId}
    >
      <div className="gm-section-head">
        <h2 id={headingId}>{label}</h2>

        <div className="gm-row-controls">
          <button
            type="button"
            aria-label={`Previous ${label.toLowerCase()}`}
            aria-controls={trackId}
            onClick={() => scroll(-1)}
          >
            <Arrow direction="left" />
          </button>

          <button
            type="button"
            aria-label={`Next ${label.toLowerCase()}`}
            aria-controls={trackId}
            onClick={() => scroll(1)}
          >
            <Arrow />
          </button>

          <Link
            to={to}
            aria-label={`View all ${label.toLowerCase()}`}
          >
            VIEW ALL <Arrow />
          </Link>
        </div>
      </div>

      <div
        ref={trackRef}
        id={trackId}
        className="gm-product-track"
        role="region"
        aria-labelledby={headingId}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {rows.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
          />
        ))}
      </div>
    </section>
  );
}