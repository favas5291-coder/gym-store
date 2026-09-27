import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import {
  calculateOrderPricing,
  FREE_SHIPPING_LIMIT,
} from "../utils/orderCalculations.js";
import { getCartItemKey, getVariantStock } from "../utils/cartUtils.js";
import { money } from "../utils/productPricing.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { ProductImage, productPath } from "./StorefrontShared.jsx";
import EmptyState from "./EmptyState.jsx";
import CouponBox from "./CouponBox.jsx";
import PriceSummary from "./PriceSummary.jsx";
import Modal from "./Modal.jsx";
import BagVariantEditor from "./BagVariantEditor.jsx";
export default function Cart() {
  const { products } = useCatalog(),
    store = useStore(),
    tools = useShoppingTools(),
    navigate = useNavigate();
  const {
    cart,
    coupon,
    updateQuantity,
    removeFromCart,
    toggleWishlist,
    wishlist,
  } = store;
  const [excluded, setExcluded] = useState([]),
    [editing, setEditing] = useState(null),
    [confirmRemove, setConfirmRemove] = useState(false);
  const [pincode, setPincode] = useState(() =>
      readStorage("gymdrobe-delivery-pincode", ""),
    ),
    [pinMessage, setPinMessage] = useState("");
  const selected = cart.filter(
      (item) => !excluded.includes(getCartItemKey(item)),
    ),
    keys = selected.map(getCartItemKey);
  const pricing = calculateOrderPricing({ cart: selected, coupon });
  function toggle(key) {
    setExcluded((old) =>
      old.includes(key) ? old.filter((k) => k !== key) : [...old, key],
    );
  }
  function move(item) {
    const product = products.find((p) => String(p.id) === String(item.id));
    if (!wishlist.some((p) => p.id === product.id)) toggleWishlist(product);
    removeFromCart(getCartItemKey(item));
  }
  if (!cart.length)
    return (
      <>
        <EmptyState title="Your bag is empty">
          There’s room for your next training favourite.
        </EmptyState>
        {tools.savedItems.length > 0 && (
          <div className="saved-callout">
            <Link className="button secondary" to="/saved">
              View {tools.savedItems.length} saved-for-later items
            </Link>
          </div>
        )}
      </>
    );
  return (
    <div className="page narrow">
      <nav className="checkout-steps" aria-label="Checkout progress">
        <strong>1. BAG</strong>
        <span>2. ADDRESS</span>
        <span>3. REVIEW</span>
      </nav>
      <div className="page-heading">
        <h1>
          My shopping bag{" "}
          <span>{cart.reduce((n, item) => n + item.quantity, 0)} items</span>
        </h1>
        <Link className="text-link" to="/wishlist">
          Add from wishlist →
        </Link>
      </div>
      <div className="checkout-layout">
        <div>
          <form
            className="bag-delivery panel"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^[1-9]\d{5}$/.test(pincode)) {
                setPinMessage("Enter a valid 6-digit pincode.");
                return;
              }
              writeStorage("gymdrobe-delivery-pincode", pincode);
              setPinMessage(
                "Pincode saved for checkout. Courier serviceability is not yet connected.",
              );
            }}
          >
            <label htmlFor="bag-pincode">Delivery pincode</label>
            <div className="inline-form">
              <input
                id="bag-pincode"
                inputMode="numeric"
                maxLength="6"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              />
              <button className="button secondary compact" type="submit">
                Save
              </button>
            </div>
            {pinMessage && <p role="status">{pinMessage}</p>}
          </form>
          <div className="shipping-progress">
            <strong>
              {selected.length
                ? pricing.totalAfterCoupon >= FREE_SHIPPING_LIMIT
                  ? "Your selection qualifies for free standard delivery"
                  : `You’re ${money(FREE_SHIPPING_LIMIT - pricing.totalAfterCoupon)} away from free standard delivery`
                : "Select items to see your delivery total"}
            </strong>
            <progress
              aria-label="Free delivery progress"
              max={FREE_SHIPPING_LIMIT}
              value={Math.min(FREE_SHIPPING_LIMIT, pricing.totalAfterCoupon)}
            />
            <small>Eligibility is calculated after coupon discounts.</small>
          </div>
          <div className="bag-bulk">
            <label className="check">
              <input
                type="checkbox"
                aria-label="Select all bag items"
                checked={selected.length === cart.length}
                onChange={() =>
                  setExcluded(
                    selected.length === cart.length
                      ? cart.map(getCartItemKey)
                      : [],
                  )
                }
              />
              {selected.length} / {cart.length} selected
            </label>
            <button
              className="text-link"
              type="button"
              disabled={!selected.length}
              onClick={() => setConfirmRemove(true)}
            >
              Remove selected
            </button>
            <button
              className="text-link"
              type="button"
              disabled={!selected.length}
              onClick={() => tools.saveForLater(keys)}
            >
              Save selected for later
            </button>
          </div>
          {cart.map((item) => {
            const key = getCartItemKey(item),
              canonical = products.find(
                (p) => String(p.id) === String(item.id),
              ),
              stock = getVariantStock(
                canonical,
                item.selectedSize,
                item.selectedColor,
              );
            return (
              <article className="bag-item selectable-bag-item" key={key}>
                <input
                  className="bag-select"
                  type="checkbox"
                  aria-label={`Select ${item.name} ${item.selectedColor || ""} ${item.selectedSize || ""}`}
                  checked={!excluded.includes(key)}
                  onChange={() => toggle(key)}
                />
                <Link className="bag-photo" to={productPath(item.id)}>
                  <ProductImage product={item} />
                </Link>
                <div className="bag-copy">
                  <Link to={productPath(item.id)}>
                    <strong>{item.brand || "GymDrobe"}</strong>
                    <h2>{item.name}</h2>
                  </Link>
                  <p>
                    {[
                      item.selectedColor,
                      item.selectedSize && `Size: ${item.selectedSize}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {(canonical?.sizes?.length > 0 ||
                    canonical?.colors?.length > 0) && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setEditing(item)}
                    >
                      Edit size / colour
                    </button>
                  )}
                  <div className="bag-quantity">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.name}`}
                      disabled={item.quantity <= 1}
                      onClick={() => updateQuantity(key, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span aria-label={`Quantity ${item.quantity}`}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.name}`}
                      disabled={item.quantity >= stock}
                      onClick={() => updateQuantity(key, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong>{money(item.price * item.quantity)}</strong>
                  {item.originalPrice > item.price && (
                    <del className="bag-mrp">
                      {money(item.originalPrice * item.quantity)}
                    </del>
                  )}
                  <span className="muted">
                    {" "}
                    {item.quantity > 1 ? `(${money(item.price)} each)` : ""}
                  </span>
                  <p className="bag-return">{canonical?.returnPolicy}</p>
                  <div className="bag-links">
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => removeFromCart(key)}
                    >
                      Remove
                    </button>
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => move(item)}
                    >
                      Move to wishlist
                    </button>
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => tools.saveForLater([key])}
                    >
                      Save for later
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <Link className="text-link" to="/saved">
            Saved for later ({tools.savedItems.length}) →
          </Link>
        </div>
        <aside className="checkout-summary">
          <CouponBox subtotal={pricing.subtotal} />
          <PriceSummary cart={selected} coupon={coupon}>
            <button
              type="button"
              className="button full"
              disabled={!selected.length}
              onClick={() => {
                tools.startSelection(keys);
                navigate(
                  selected.length === cart.length
                    ? "/checkout?mode=cart"
                    : "/checkout?mode=selection",
                );
              }}
            >
              Continue to address
            </button>
            <p className="muted">
              {selected.length === cart.length
                ? "All bag items will be checked out."
                : "Only selected items will be checked out. Other items stay in your bag."}
            </p>
          </PriceSummary>
        </aside>
      </div>
      {editing && (
        <BagVariantEditor item={editing} onClose={() => setEditing(null)} />
      )}
      {confirmRemove && (
        <Modal
          title="Remove selected items?"
          onClose={() => setConfirmRemove(false)}
        >
          <p>Remove {selected.length} items from your bag?</p>
          <div className="purchase-actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                store.setCart(
                  cart.filter((item) => !keys.includes(getCartItemKey(item))),
                );
                setConfirmRemove(false);
                store.notify("Selected items removed.");
              }}
            >
              Remove items
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => setConfirmRemove(false)}
            >
              Keep items
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}