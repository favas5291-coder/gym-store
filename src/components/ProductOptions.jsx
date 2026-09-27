import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import FitGuide from "./FitGuide.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../context/StoreContext.jsx";
import {
  firstOptions,
  getTotalStock,
  getVariantStock,
} from "../utils/cartUtils.js";
import {
  getDiscountedPrice,
  getOriginalPrice,
  getDiscountPercentage,
  money,
} from "../utils/productPricing.js";
import { Heart } from "./StorefrontShared.jsx";
export default function ProductOptions({ product, onAdded }) {
  const { watches, watchProduct } = useShoppingTools();
  const [guide, setGuide] = useState(false);
  const [added, setAdded] = useState(false);
  const initial = firstOptions(product),
    navigate = useNavigate();
  const [size, setSize] = useState(initial.selectedSize),
    [color, setColor] = useState(initial.selectedColor),
    [quantity, setQuantity] = useState(1);
  const { addToCart, buyNow, wishlist, toggleWishlist } = useStore();
  const stock = getVariantStock(product, size, color),
    available = getTotalStock(product) > 0;
  const saved = wishlist.some((p) => String(p.id) === String(product.id));
  function chooseColor(next) {
    setAdded(false);
    setColor(next);
    setQuantity(1);
    if (product.sizes?.length && !getVariantStock(product, size, next))
      setSize(
        product.sizes.find(
          (option) => getVariantStock(product, option, next) > 0,
        ) || product.sizes[0],
      );
  }
  return (
    <div className="product-options">
      <div className="detail-price">
        <strong>{money(getDiscountedPrice(product))}</strong>
        {getDiscountPercentage(product) > 0 && (
          <>
            <del>MRP {money(getOriginalPrice(product))}</del>
            <span>({getDiscountPercentage(product)}% OFF)</span>
          </>
        )}
      </div>
      <p className="tax-note">Price includes applicable taxes</p>
      {Boolean(product.colors?.length) && (
        <fieldset>
          <legend>
            SELECT COLOUR <span>{color}</span>
          </legend>
          <div className="option-list">
            {product.colors.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={color === option}
                onClick={() => chooseColor(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {Boolean(product.sizes?.length) && (
        <fieldset>
          <legend>SELECT SIZE</legend>
          <button
            className="text-link fit-guide-link"
            type="button"
            onClick={() => setGuide(true)}
          >
            Size & fit guide
          </button>
          <div className="option-list sizes">
            {product.sizes.map((option) => (
              <button
                key={option}
                type="button"
                disabled={!getVariantStock(product, option, color)}
                aria-pressed={String(size) === String(option)}
                onClick={() => {
                  setAdded(false);
                  setSize(option);
                  setQuantity(1);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="quantity-line">
        <label htmlFor={`quantity-${product.id}`}>Quantity</label>
        <input
          id={`quantity-${product.id}`}
          type="number"
          min="1"
          max={Math.max(1, stock)}
          step="1"
          disabled={!stock}
          value={quantity}
          onChange={(event) =>
            setQuantity(
              event.target.value === "" ? "" : Number(event.target.value),
            )
          }
        />
        <span>
          {!available
            ? "Out of stock"
            : stock
              ? "In stock"
              : "This selection is unavailable"}
        </span>
      </div>
      <div className="purchase-actions">
        <button
          type="button"
          className="button"
          disabled={!stock}
          onClick={() => {
            if (addToCart(product, quantity, size, color)) {
              setAdded(true);
              onAdded?.();
            }
          }}
        >
          {available ? "Add to bag" : "Out of stock"}
        </button>
        <button
          type="button"
          className={`button secondary ${saved ? "saved" : ""}`}
          aria-pressed={saved}
          onClick={() => toggleWishlist(product)}
        >
          <Heart filled={saved} />
          {saved ? "Wishlisted" : "Wishlist"}
        </button>
      </div>
      {added && <div className="purchase-feedback" role="status">
        <span>✓ Added to your bag</span>
        <Link to="/cart">View bag & checkout →</Link>
      </div>}
      {stock > 0 && (
        <button
          type="button"
          className="button secondary full buy-now"
          onClick={() => {
            if (buyNow(product, quantity, size, color))
              navigate("/checkout?mode=buy-now");
          }}
        >
          Buy now
        </button>
      )}
      <button
        className="text-link watch-button"
        type="button"
        aria-pressed={watches.some((w) => String(w.id) === String(product.id))}
        onClick={() => watchProduct(product)}
      >
        {watches.some((w) => String(w.id) === String(product.id))
          ? "Watching this product ✓"
          : "Watch price & availability"}
      </button>
      {guide && <FitGuide product={product} onClose={() => setGuide(false)} />}
    </div>
  );
}