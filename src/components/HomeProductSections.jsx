import { useMemo } from "react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { homeCollections } from "../utils/homeCollections.js";
import ProductRow from "./ProductRow.jsx";

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const { lead } = useMemo(() => homeCollections(products), [products]);

  if (lead.length) {
    return <ProductRow title="Featured gear" id="featured" products={lead} grid to="/shop" />;
  }

  return (
    <section className="gm-section catalog-status" aria-live="polite">
      <h2>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "More gear is on the way."}</h2>
      {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
    </section>
  );
}
