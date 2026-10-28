import { useId, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TextLink, IconButton } from "./PremiumControls.jsx";

import ProductCard from "./ProductCard.jsx";


export default function ProductRow({
  title,
  products,
  id,
  grid = false,
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
      className={`gm-section${grid ? " product-grid-section" : ""}`}
      id={id}
      aria-labelledby={headingId}
    >
      <div className="gm-section-head">
        <h2 id={headingId}>{label}</h2>

        <div className="gm-row-controls">
          {!grid && <IconButton icon={ArrowLeft} label={`Previous ${label.toLowerCase()}`} aria-controls={trackId} onClick={() => scroll(-1)} />}

          {!grid && <IconButton icon={ArrowRight} label={`Next ${label.toLowerCase()}`} aria-controls={trackId} onClick={() => scroll(1)} />}

          <TextLink to={to} aria-label={`View all ${label.toLowerCase()}`}>View all</TextLink>
        </div>
      </div>

      <div
        ref={trackRef}
        id={trackId}
        className={grid ? "gm-home-product-grid" : "gm-product-track"}
        role="region"
        aria-labelledby={headingId}
        tabIndex={grid ? undefined : 0}
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