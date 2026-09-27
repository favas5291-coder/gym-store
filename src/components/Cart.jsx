import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import BagVariantEditor from "./BagVariantEditor.jsx";
import { ProductImage } from "./StorefrontShared.jsx";
import PriceSummary from "./PriceSummary.jsx";
import { getCartItemKey, getVariantStock } from "../utils/cartUtils.js";
import { money } from "../utils/productPricing.js";

export default function Cart() {
  const { products } = useCatalog();
  const { cart, updateQuantity, removeFromCart } = useStore();
  const [editing, setEditing] = useState(null);

  const rows = useMemo(
    () =>
      cart.map((item) => {
        const product = products.find((entry) => String(entry.id) === String(item.id));
        return {
          ...item,
          product,
          lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
        };
      }),
    [cart, products],
  );

  if (!rows.length) {
    return (
      <div className="page narrow">
        <div className="empty-state">
          <h1>Your bag is empty</h1>
          <p>Pick a few essentials and come back when you’re ready to check out.</p>
          <Link className="button" to="/shop">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div className="page-heading">
        <h1>
          Shopping bag <span>{rows.length} items</span>
        </h1>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {rows.map((item) => {
            const product = item.product;
            if (!product) return null;

            const stock = getVariantStock(
              product,
              item.selectedSize,
              item.selectedColor,
            );

            return (
              <article key={getCartItemKey(item)} className="cart-row">
                <Link to={`/product/${encodeURIComponent(item.id)}`} className="cart-thumb">
                  <ProductImage product={product} />
                </Link>
                <div className="cart-copy">
                  <div className="cart-head">
                    <div>
                      <p className="eyebrow">{product.brand || "GymDrobe"}</p>
                      <Link to={`/product/${encodeURIComponent(item.id)}`}>
                        <h2>{product.name}</h2>
                      </Link>
                    </div>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>

                  <p className="muted">
                    {item.selectedColor && item.selectedSize
                      ? `${item.selectedColor} / ${item.selectedSize}`
                      : item.selectedColor || item.selectedSize || "Standard option"}
                  </p>

                  <div className="cart-controls">
                    <label>
                      Qty
                      <select
                        value={item.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            getCartItemKey(item),
                            Number(event.target.value),
                          )
                        }
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setEditing(item)}
                    >
                      Edit options
                    </button>

                    <button
                      type="button"
                      className="text-link danger"
                      onClick={() => removeFromCart(getCartItemKey(item))}
                    >
                      Remove
                    </button>
                  </div>

                  {stock === 0 && (
                    <p className="field-error">
                      This variant is currently out of stock.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="cart-summary">
          <PriceSummary cart={cart} />
          <Link className="button full" to="/checkout">
            Proceed to checkout
          </Link>
        </div>
      </div>

      {editing && <BagVariantEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
