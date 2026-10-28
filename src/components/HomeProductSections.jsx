import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { homeCollections } from "../utils/homeCollections.js";
import { productDepartment } from "../utils/catalog.js";
import { ProductImage, categoryPath } from "./StorefrontShared.jsx";
import ProductRow from "./ProductRow.jsx";
import RecentlyViewed from "./RecentlyViewed.jsx";
import HomeKits from "./HomeKits.jsx";

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const {available, lead, leadTitle, fresh, more, moreTitle} = useMemo(() => homeCollections(products), [products]);
  const apparel = available.find(p => productDepartment(p) === 'workout');
  const equipment = available.find(p => productDepartment(p) === 'accessories') || available.find(p => productDepartment(p) === 'hydration');
  return <>
    {lead.length ? <ProductRow title={leadTitle} id="featured" products={lead} grid to={leadTitle === 'Best sellers' ? '/shop?collection=bestsellers' : '/shop'} /> :
      <section className="gm-section catalog-status" aria-live="polite">
        <h2>{loading ? "Loading the collection…" : error ? "The collection couldn’t load." : "New essentials are on their way."}</h2>
        <p>{loading ? "Your next workout starts here." : error ? "Please try again in a moment." : "Explore again soon."}</p>
        {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
      </section>}
    {apparel && <section className="editorial-collection" aria-labelledby="editorial-title">
      <Link to={categoryPath(apparel.category)} className="editorial-photo" aria-label={`Shop ${apparel.category}`}><ProductImage product={apparel} decorative /></Link>
      <div className="editorial-copy"><p className="eyebrow">THE TRAINING WARDROBE</p><h2 id="editorial-title">Good gear.<br />Better routine.</h2><p>Find your fit for the warm-up, the last set, and everything in between.</p><Link to="/shop?department=workout" className="button">Explore workout clothing <span aria-hidden="true">↗</span></Link></div>
    </section>}
    {more.length > 0 && <ProductRow title={moreTitle} products={more} grid to={moreTitle === 'Trending now' ? '/shop?collection=trending' : '/shop?collection=featured'} />}
    {equipment && <section className="gymdrobe-edit gm-section" aria-labelledby="edit-title">
      <div className="edit-intro"><p className="eyebrow">THE GYMDROBE EDIT</p><h2 id="edit-title">The details<br />make the difference.</h2><p>Round out your routine with the essentials you reach for every day.</p><Link to={`/shop?department=${productDepartment(equipment)}`} className="text-link">Explore {productDepartment(equipment)} <span aria-hidden="true">→</span></Link></div>
      <Link className="edit-product" to={categoryPath(equipment.category)}><ProductImage product={equipment} decorative /><span>{equipment.category.toLowerCase() === 'bag' ? 'Pack for your next session' : `Explore ${equipment.category.toLowerCase()}`} <span aria-hidden="true">↗</span></span></Link>
    </section>}
    {fresh.length > 0 && <ProductRow title="New arrivals" products={fresh} grid to="/shop?collection=new" />}
    <HomeKits />
    <RecentlyViewed />
  </>;
}
