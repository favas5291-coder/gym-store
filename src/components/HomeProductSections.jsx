import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { homeCollections } from "../utils/homeCollections.js";
import { productDepartment } from "../utils/catalog.js";
import { ProductImage } from "./StorefrontShared.jsx";
import ProductRow from "./ProductRow.jsx";
import "../styles/home-womens-gear.css";

const categoryCaptions = new Map([
  ["CREATINE", "Creatine"],
  ["HYGIENE", "Hygiene"],
  ["BAG", "Bag"],
]);

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
  const womensGear = gender === "Women";
  return <section className={`gm-section athletic-categories${womensGear ? " womens-workout-gear" : ""}`} id={id} aria-label={title}>
    <h2>{title}</h2>
    <div className="athletic-category-grid">
      {tiles.map(([category, { product, to }]) => <Link key={category} to={to}>
        <div className="athletic-category-image"><ProductImage product={product} decorative homeGear={womensGear} sizes="(max-width: 700px) 50vw, 25vw" /></div>
        <span>{(womensGear && categoryCaptions.get(category)) || category}</span>
      </Link>)}
    </div>
  </section>;
}

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const { lead, available } = useMemo(() => homeCollections(products), [products]);
  // Keep the existing lead selection, then fill the desktop rail with distinct gear.
  const featuredProducts = useMemo(() => {
    const leadIds = new Set(lead.map(product => product.id));
    return [...lead, ...available.filter(product => !leadIds.has(product.id))].slice(0, 8);
  }, [lead, available]);
  const featured = featuredProducts.length
    ? <ProductRow title="Featured gear" id="featured" products={featuredProducts} to="/shop" grid featured />
    : <section id="featured" className="gm-section catalog-status" aria-live="polite">
        <h2>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "More gear is on the way."}</h2>
        {loading && <div className="opening-placeholders" aria-hidden="true"><i/><i/><i/><i/></div>}
        {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
      </section>;
  return <>
    {featured}
    <CategorySection title="Women’s workout gear" products={available} gender="Women" id="categories" />
    <CategorySection title="Men’s workout gear" products={available} gender="Men" />
    <CategorySection title="Accessories & essentials" products={available} departments={["accessories", "hydration"]} />
    <section className="gm-section athletic-support" aria-label="Shopping support">
      <Link to="/orders">Track your order</Link><Link to="/help">Contact GymDrobe</Link><a href="/shipping-and-returns.html">Delivery & exchanges</a>
    </section>
  </>;
}
