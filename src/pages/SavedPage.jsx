import { Link } from "react-router-dom";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { getCartItemKey, getVariantStock } from "../utils/cartUtils.js";
import { getDiscountedPrice, money } from "../utils/productPricing.js";
import { ProductImage, productPath } from "../components/StorefrontShared.jsx";
import EmptyState from "../components/EmptyState.jsx";
export default function SavedPage() {
  const { savedItems, removeSaved, moveSavedToBag } = useShoppingTools(),
    { products } = useCatalog();
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
      {savedItems.map((item) => {
        const p = products.find((p) => String(p.id) === String(item.id)),
          stock = getVariantStock(p, item.selectedSize, item.selectedColor);
        return (
          <article className="bag-item" key={getCartItemKey(item)}>
            <Link className="bag-photo" to={productPath(item.id)}>
              <ProductImage product={p || item} />
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
                {p ? money(getDiscountedPrice(p)) : "No longer available"}
              </strong>
              <p>
                {stock >= item.quantity
                  ? "Your selection is available"
                  : `Available quantity: ${stock}. Open the product to choose other options.`}
              </p>
              <div className="bag-links">
                <button
                  className="button compact"
                  type="button"
                  disabled={stock < item.quantity}
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