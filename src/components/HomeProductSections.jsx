import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { homeCollections } from "../utils/homeCollections.js";
import { productDepartment } from "../utils/catalog.js";
import { ProductImage } from "./StorefrontShared.jsx";
import ProductRow from "./ProductRow.jsx";

function CategorySection({ title, products, gender, departments, id }) {
  const tiles = useMemo(() => {
    const groups = new Map();
    for (const product of products) {
      if (gender && String(product.gender).toLowerCase() !== gender.toLowerCase()) continue;
      if (departments && !departments.includes(productDepartment(product))) continue;
      const category = product.category;
      if (!category || groups.has(category)) continue;
      const params = new URLSearchParams({ category });
      if (gender) params.set("gender", gender);
      groups.set(category, { product, to: `/shop?${params}` });
    }
    return [...groups.entries()].slice(0, 4);
  }, [products, gender, departments]);
  if (!tiles.length) return null;
  return <section className="gm-section athletic-categories" id={id} aria-label={title}>
    <h2>{title}</h2>
    <div className="athletic-category-grid">
      {tiles.map(([category, { product, to }]) => <Link key={category} to={to}>
        <div className="athletic-category-image"><ProductImage product={product} decorative sizes="(max-width: 700px) 50vw, 25vw" /></div>
        <span>{category}</span>
      </Link>)}
    </div>
  </section>;
}

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const { lead, available } = useMemo(() => homeCollections(products), [products]);
  if (!lead.length) return <section className="gm-section catalog-status" aria-live="polite">
    <h2>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "More gear is on the way."}</h2>
    {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
  </section>;
  return <>
    <ProductRow title="Featured gear" id="featured" products={lead} to="/shop" />
    <CategorySection title="Women’s workout gear" products={available} gender="Women" id="categories" />
    <CategorySection title="Men’s workout gear" products={available} gender="Men" />
    <CategorySection title="Accessories & essentials" products={available} departments={["accessories", "hydration"]} />
    <section className="gm-section athletic-support" aria-label="Shopping support">
      <Link to="/orders">Track your order</Link><Link to="/help">Contact GymDrobe</Link><a href="/shipping-and-returns.html">Delivery & exchanges</a>
    </section>
  </>;
}
