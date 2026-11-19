import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { TextLink, IconButton } from "./PremiumControls.jsx";

import ProductCard from "./ProductCard.jsx";
import "./HomeFeaturedGear.css";


export default function ProductRow({
  title,
  products,
  id,
  grid = false,
  opening = false,
  featured = false,
  to = "/shop",
}) {
  const trackRef = useRef(null);
  const generatedId = useId();
  const [visibleExtras, setVisibleExtras] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });

  const headingId = `${generatedId}-heading`;
  const trackId = `${generatedId}-track`;

  const rows = Array.isArray(products)
    ? products.filter(
        (product) => product && product.id != null,
      )
    : [];

  useEffect(() => {
    const node = trackRef.current;
    if (!featured || !node) return;
    const sync = () => {
      const start = node.scrollLeft <= 1;
      const end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
      setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    // Browsers may fetch lazy images several screens ahead on a horizontal
    // rail. Delay the extra desktop photos until those cards approach view.
    const extras = Array.from(node.children).slice(4);
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const count = extras.indexOf(entry.target) + 1;
        setVisibleExtras(previous => Math.max(previous, count));
        visibility.unobserve(entry.target);
      }
    }, { rootMargin: "160px 0px" });
    extras.forEach(card => visibility.observe(card));
    node.addEventListener("scroll", sync, { passive: true });
    return () => {
      observer.disconnect();
      visibility.disconnect();
      node.removeEventListener("scroll", sync);
    };
  }, [featured, rows.length]);

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
      left: direction * node.clientWidth * (featured ? 1 : 0.8),
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
      className={`gm-section${grid ? " product-grid-section" : ""}${featured ? " home-featured-gear" : ""}`}
      id={id}
      aria-labelledby={headingId}
    >
      <div className="gm-section-head">
        <h2 id={headingId}>{label}</h2>

        {featured && <TextLink to={to} aria-label={`View all ${label.toLowerCase()}`}>View all</TextLink>}
        <div className="gm-row-controls">
          {(featured || !grid) && <>
            <IconButton icon={featured ? ChevronLeft : ArrowLeft} label={`Previous ${label.toLowerCase()}`}
              aria-controls={trackId} disabled={featured && edges.start} onClick={() => scroll(-1)} />
            <IconButton icon={featured ? ChevronRight : ArrowRight} label={`Next ${label.toLowerCase()}`}
              aria-controls={trackId} disabled={featured && edges.end} onClick={() => scroll(1)} />
          </>}

          {!featured && <TextLink to={to} aria-label={`View all ${label.toLowerCase()}`}>View all</TextLink>}
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
        {rows.map((product, index) => (
          <ProductCard
            key={product.id}
            loadPhoto={!featured || index < 4 + visibleExtras}
            featured={featured}
            priority={opening && index < 2}
            product={product}
          />
        ))}
      </div>
    </section>
  );
}