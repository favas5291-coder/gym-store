import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import CollectionBrowser from "./CollectionBrowser.jsx";
import RecentlyViewed from "./RecentlyViewed.jsx";
import ProductRow from "./ProductRow.jsx";
import {
  inStock,
  ProductImage,
  productPath,
  priceDetails,
  Arrow,
} from "./StorefrontShared.jsx";
export default function HomeProductSections() {
  const { products } = useCatalog();
  const available = products.filter(inStock),
    offers = available.filter((p) => priceDetails(p).discount > 0);
  return (
    <>
      {offers.length > 0 && (
        <section className="gm-section">
          <div className="gm-section-head">
            <h2>DEALS TO ADD TO YOUR BAG</h2>
            <Link to="/shop?discount=1">
              EXPLORE ALL <Arrow />
            </Link>
          </div>
          <div
            className="gm-deal-grid"
            style={{ "--gm-deal-count": Math.min(offers.length, 6) }}
          >
            {offers.slice(0, 6).map((p) => (
              <Link key={p.id} className="gm-deal-card" to={productPath(p.id)}>
                <ProductImage product={p} decorative />
                <div>
                  <small>{p.brand}</small>
                  <h3>{p.name}</h3>
                  <strong>{priceDetails(p).discount}% OFF</strong>
                  <span>
                    SHOP NOW <Arrow />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <CollectionBrowser />
      <ProductRow
        title="TRENDING NOW"
        id="featured"
        products={available.filter((p) => p.isFeatured)}
        to="/shop?collection=featured"
      />
      <ProductRow
        title="BESTSELLERS TO KNOW"
        products={available.filter((p) => p.isBestSeller)}
        to="/shop?collection=bestsellers"
      />
      <div className="gm-edit-banner">
        <div>
          <p>THE GYMDROBE ESSENTIALS EDIT</p>
          <h2>GOOD GEAR. GREAT SESSIONS.</h2>
          <span>Build your workout wardrobe, one favourite at a time.</span>
        </div>
        <Link to="/shop">
          EXPLORE THE COLLECTION <Arrow />
        </Link>
      </div>
      <ProductRow
        title="FRESH FINDS FOR YOUR ROUTINE"
        products={products.filter((p) => p.isNew)}
        to="/shop?collection=new"
      />
      <RecentlyViewed />
    </>
  );
}