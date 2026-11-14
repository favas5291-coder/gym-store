import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { asset } from "../data/assets.js";
import { homeCollections } from "../utils/homeCollections.js";
import { ProductImage } from "./StorefrontShared.jsx";
import ProductRow from "./ProductRow.jsx";
import HomeProductVideo from "./HomeProductVideo.jsx";

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const { lead, available, fresh } = useMemo(() => homeCollections(products), [products]);

  if (!lead.length) {
    return (
      <section className="gm-section catalog-status" aria-live="polite">
        <h2>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "More gear is on the way."}</h2>
        {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
      </section>
    );
  }

  const brands = [...new Set(available.map(product => product.brand?.trim()).filter(Boolean))];
  const gymBag = available.find(product => /\b(?:duffel|duffle|gym bag|sports bag)\b/i.test(product.name));
  const collections = [
    { title: "Your First Gym Kit", to: "/kits", image: asset("Towel.jpg") },
    { title: "Training Apparel", to: "/shop?department=workout", image: asset("tshirt.jpg") },
    { title: "Hydration", to: "/shop?department=hydration", image: asset("shaker.jpg") },
    { title: "Gym Bag Essentials", to: "/shop?department=accessories", product: gymBag, image: asset("shaker.jpg") },
  ];
  const productPath = product => `/product/${encodeURIComponent(product.id || product._id)}`;
  return <>
    <ProductRow title={lead.some(product => product.isBestSeller) ? "Bestsellers" : "Featured Gear"} id="featured" products={lead} grid to="/shop" />
    <section className="gm-section home-story" aria-labelledby="home-story-title">
      <img src="/media/campaign/editorial.webp" alt="" width="1200" height="675" loading="lazy" />
      <div>
        <h2 id="home-story-title">Why GymDrobe</h2>
        <p>We built GymDrobe to help people in India find workout clothing and gear for the way they train, from their first gym session to their everyday routine.</p>
        <Link className="text-link" to="/shop">Explore workout gear</Link>
      </div>
    </section>
    <HomeProductVideo products={available} fallback={fresh[0] || lead[0]} />
    <section className="gm-section home-spotlight" aria-labelledby="home-spotlight-title">
      <h2 id="home-spotlight-title">In the Spotlight</h2>
      <div className="home-spotlight-grid">
        {available.slice(0, 6).map(product => <Link key={product.id || product._id} to={productPath(product)}>
          <ProductImage product={product} decorative />
          <strong>{product.name}</strong>
        </Link>)}
      </div>
    </section>
    <section className="gm-section home-collections" aria-labelledby="home-collections-title">
      <h2 id="home-collections-title">Shop collections</h2>
      <div className="home-collection-grid">
        {collections.map(({ title, to, image, product }) => <Link key={to} to={to}>
          {product ? <ProductImage product={product} decorative /> : <img src={image} alt="" loading="lazy" width="480" height="360" />}
          <strong>{title}</strong>
        </Link>)}
      </div>
      {brands.length > 0 && <>
        <h3 id="home-brands">Shop by brand</h3>
        <div className="home-brand-grid">{brands.slice(0, 6).map(brand => <Link key={brand} to={`/shop?brand=${encodeURIComponent(brand)}`}>{brand}</Link>)}</div>
        {brands.length > 6 && <details className="home-brand-more"><summary>View all brands</summary>
          <div className="home-brand-grid">{brands.slice(6).map(brand => <Link key={brand} to={`/shop?brand=${encodeURIComponent(brand)}`}>{brand}</Link>)}</div>
        </details>}
      </>}
    </section>
    {fresh.length > 0 && <ProductRow title="New Arrivals" products={fresh} grid to="/shop?collection=new" />}
  </>;
}
