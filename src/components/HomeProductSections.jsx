import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { heroMedia } from "../data/campaignMedia.js";
import { inStock, validProducts, Arrow } from "./StorefrontShared.jsx";
import ProductRow from "./ProductRow.jsx";
import RecentlyViewed from "./RecentlyViewed.jsx";
import HomeKits from "./HomeKits.jsx";

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const { featured, fresh } = useMemo(() => {
    const available = validProducts(products).filter(product => product.isActive !== false && inStock(product));
    const selected = [...available.filter(product => product.isFeatured), ...available];
    const seen = new Set();
    return {
      featured: selected.filter(product => { const id = String(product.id ?? product._id); if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 8),
      fresh: available.filter(product => product.isNew).slice(0, 8),
    };
  }, [products]);
  return <>
    {featured.length ? <ProductRow title="The essentials edit" id="featured" products={featured} /> :
      <section className="gm-section catalog-status" aria-live="polite">
        <p className="eyebrow">THE ESSENTIALS EDIT</p><h2>{loading ? "Finding your next essential…" : error ? "Let’s reconnect." : "A new collection is on its way."}</h2>
        <p>{loading ? "Loading the latest products." : error ? "We couldn’t load the collection. Please try again." : "Check back soon for available products."}</p>
        {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
      </section>}
    <section className="editorial-collection" aria-labelledby="editorial-title">
      <div className="editorial-photo"><img src={heroMedia.editorial} alt="An athlete preparing for a training session" width="1200" height="1000" loading="lazy" decoding="async" /></div>
      <div className="editorial-copy"><p className="eyebrow">THE EVERYDAY ATHLETE</p><h2 id="editorial-title">Built for<br />every rep.</h2><p>The early starts. The extra set. The time you make for yourself. Find the essentials that belong in your routine.</p><Link to="/shop" className="editorial-link">Find your training essentials <Arrow /></Link><span className="editorial-index" aria-hidden="true">GYMDROBE / 02</span></div>
    </section>
    <HomeKits />
    {fresh.length >= 4 && <ProductRow title="Fresh in the rotation" products={fresh} to="/shop?collection=new" />}
    <RecentlyViewed />
  </>;
}
