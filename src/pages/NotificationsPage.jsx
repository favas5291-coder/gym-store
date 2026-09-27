import { Link } from "react-router-dom";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { watchChanges } from "../utils/commerce.js";
import { money } from "../utils/productPricing.js";
import { ProductImage, productPath } from "../components/StorefrontShared.jsx";
export default function NotificationsPage() {
  const { watches, watchProduct } = useShoppingTools(),
    { products } = useCatalog();
  const items = watchChanges(watches, products);
  return (
    <div className="page narrow">
      <div className="page-heading">
        <h1>Price & stock watches</h1>
      </div>
      <p className="notice">
        Watches compare the current catalogue with the price and stock when you
        saved a product. Updates appear here on this device; email and push
        notifications are not connected.
      </p>
      {!items.length && (
        <div className="empty-state">
          <h2>Keep an eye on your favourites</h2>
          <p>Use “Watch price & availability” on a product page.</p>
          <Link className="button" to="/shop">
            Explore products
          </Link>
        </div>
      )}
      {items.map((w) => (
        <article className="bag-item" key={w.id}>
          <Link className="bag-photo" to={productPath(w.id)}>
            <ProductImage product={w.product} />
          </Link>
          <div className="bag-copy">
            <h2>{w.product.name}</h2>
            <p>
              {w.updates.length
                ? w.updates.join(" · ")
                : "No changes since you started watching"}
            </p>
            <strong>{money(w.priceNow)}</strong>
            {w.priceNow !== w.price && (
              <span className="muted"> · Watched at {money(w.price)}</span>
            )}
            <p>{w.stockNow ? "In stock" : "Out of stock"}</p>
            <div className="bag-links">
              <Link className="text-link" to={productPath(w.id)}>
                View product
              </Link>
              <button
                className="text-link"
                type="button"
                onClick={() => watchProduct(w.product)}
              >
                Stop watching
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}