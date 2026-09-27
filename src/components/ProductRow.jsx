import { useRef } from "react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard.jsx";
import { Arrow } from "./StorefrontShared.jsx";
export default function ProductRow({ title, products, id, to = "/shop" }) {
  const ref = useRef(null);
  if (!products?.length) return null;
  function scroll(direction) {
    const node = ref.current;
    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <section className="gm-section" id={id}>
      <div className="gm-section-head">
        <h2>{title}</h2>
        <div className="gm-row-controls">
          <button
            type="button"
            aria-label={`Previous ${title.toLowerCase()}`}
            onClick={() => scroll(-1)}
          >
            <Arrow direction="left" />
          </button>
          <button
            type="button"
            aria-label={`Next ${title.toLowerCase()}`}
            onClick={() => scroll(1)}
          >
            <Arrow />
          </button>
          <Link to={to}>
            VIEW ALL <Arrow />
          </Link>
        </div>
      </div>
      <div ref={ref} className="gm-product-track">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}