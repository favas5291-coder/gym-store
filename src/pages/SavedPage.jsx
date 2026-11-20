import { Link } from "react-router-dom";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { getCartItemKey } from "../utils/cartUtils.js";
import { latestPurchaseProduct, purchaseState } from "../utils/productPurchase.js";
import { getDiscountedPrice, money } from "../utils/productPricing.js";
import { ProductImage, productPath } from "../components/StorefrontShared.jsx";
import EmptyState from "../components/EmptyState.jsx";
export default function SavedPage() {
  const { savedItems, removeSaved, moveSavedToBag } = useShoppingTools(),
    { products, loaded, loading, error, refreshProducts } = useCatalog();
  const ready = loaded && !loading && !error;
  if (!savedItems.length)
    return (
      <EmptyState
        title="Save it for another session"
        to="/cart"
        label="Open your bag"
      >
        Move items from your bag to Saved for later. Your size, colour and
        quantity stay with each item.
      </EmptyState>
    );
  return (
    <div className="page narrow">
      <div className="page-heading">
        <h1>
          Saved for later <span>{savedItems.length} items</span>
        </h1>
        <Link className="text-link" to="/cart">
          Back to bag →
        </Link>
      </div>
      {error && <p role="alert">Saved items are available on this device. <button className="text-link" onClick={() => refreshProducts().catch(() => {})}>Retry product information</button></p>}
      {savedItems.map((item) => {
        const product = latestPurchaseProduct(products, item);
        const state = purchaseState(product, item.selectedSize, item.selectedColor, item.quantity, ready);
        const selectedProduct = product ? { ...product, selectedColor: item.selectedColor } : item;
        return (
          <article className="bag-item" key={getCartItemKey(item)}>
            <Link className="bag-photo" to={productPath(item.id)}>
              <ProductImage product={selectedProduct} />
            </Link>
            <div className="bag-copy">
              <h2>{item.name}</h2>
              <p>
                {[item.selectedSize, item.selectedColor]
                  .filter(Boolean)
                  .join(" / ")}{" "}
                · Qty {item.quantity}
              </p>
              <strong>
                {ready && state.priceAvailable ? money(getDiscountedPrice(product, item.selectedSize, item.selectedColor)) : !ready && Number.isFinite(item.price) ? `Saved estimate ${money(item.price)}` : "Price unavailable"}
              </strong>
              <p>
                {state.canBuy
                  ? "Your selection is available"
                  : state.message}
              </p>
              <div className="bag-links">
                <button
                  className="button compact"
                  type="button"
                  disabled={!state.canBuy}
                  onClick={() => moveSavedToBag(item)}
                >
                  Move to bag
                </button>
                <Link className="text-link" to={productPath(item.id)}>
                  Choose options
                </Link>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => removeSaved(getCartItemKey(item))}
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}