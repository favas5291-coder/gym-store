import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { productDepartment } from "../utils/catalog.js";
import { homeCollections } from "../utils/homeCollections.js";
import { productVideo } from "../utils/productVideo.js";
import { ProductImage } from "./StorefrontShared.jsx";
import ProductRow from "./ProductRow.jsx";
import ProductVideo from "./ProductVideo.jsx";

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const { lead, available, fresh } = homeCollections(products);

  if (!lead.length) {
    return (
      <section className="gm-section catalog-status" aria-live="polite">
        <h2>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "More gear is on the way."}</h2>
        {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
      </section>
    );
  }

  const demonstration = available.find(product => productVideo(product.videoUrl));
  const featured = demonstration || fresh[0] || lead[0];
  const brands = [...new Set(available.map(product => product.brand?.trim()).filter(Boolean))];
  const collectionPhoto = available.find(product => productDepartment(product) === "accessories") || featured;
  const productPath = product => `/product/${encodeURIComponent(product.id || product._id)}`;
  const related = (fresh.length ? fresh : lead).filter(product => product !== featured).slice(0, 4);

  return <>
    <section className="gm-section home-new" aria-labelledby="home-new-title">
      <h2 id="home-new-title">New at GymDrobe</h2>
      <div className="home-product-feature">
        {demonstration ? <ProductVideo product={featured} /> :
          <Link className="home-feature-photo" to={productPath(featured)}><ProductImage product={featured} /></Link>}
        <div className="home-feature-copy">
          <h3>{featured.name}</h3>
          <Link to={productPath(featured)} className="button">Shop this product</Link>
        </div>
      </div>
      {related.length > 0 && <div className="home-spotlight-grid">
        {related.map(product => <Link key={product.id || product._id} to={productPath(product)}>
          <ProductImage product={product} decorative />
          <strong>{product.name}</strong>
        </Link>)}
      </div>}
    </section>
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
      <Link className="home-collection-banner" to="/shop?department=accessories">
        <span><strong>Pack Your Gym Bag</strong><small>Shop accessories →</small></span>
        <ProductImage product={collectionPhoto} decorative />
      </Link>
      <div>
        <Link to="/kits">Your First Gym Kit →</Link>
        <Link to="/shop?department=workout">Training-Day Essentials →</Link>
      </div>
      {brands.length > 0 && <>
        <h3 id="home-brands">Shop by brand</h3>
        <div>{brands.map(brand => <Link key={brand} to={`/shop?brand=${encodeURIComponent(brand)}`}>{brand}</Link>)}</div>
      </>}
    </section>
    <ProductRow title="Featured gear" id="featured" products={lead} grid to="/shop" />
  </>;
}
