import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import BagVariantEditor from "./BagVariantEditor.jsx";
import { ProductImage, productPath } from "./StorefrontShared.jsx";
import PriceSummary from "./PriceSummary.jsx";
import CouponBox from "./CouponBox.jsx";

import {
  getCartItemKey,
  getVariantStock,
} from "../utils/cartUtils.js";

import {
  calculateOrderPricing,
} from "../utils/orderCalculations.js";

import { money } from "../utils/productPricing.js";

import {
  analyticsVisitKey,
  commercePayload,
  trackOnce,
} from "../utils/analytics.js";

function safeAmount(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

export default function Cart() {
  const {
    products,
    loading,
    error: catalogError,
    refreshProducts,
  } = useCatalog();

  const {
    cart,
    updateQuantity,
    removeFromCart,
    wishlist,
    toggleWishlist,
    coupon,
    catalogReady,
    notify,
  } = useStore();

  const [editingKey, setEditingKey] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const rows = useMemo(() => {
    const catalog = Array.isArray(products) ? products : [];

    return cart.map((item) => {
      const product = catalog.find(
        (entry) =>
          entry && String(entry.id) === String(item.id),
      );

      const quantity = safeAmount(item.quantity);
      const sellingUnit = safeAmount(item.price);

      const originalUnit = Math.max(
        sellingUnit,
        safeAmount(
          item.originalPrice ??
            product?.originalPrice ??
            product?.price,
          sellingUnit,
        ),
      );

      const lineTotal = sellingUnit * quantity;
      const originalLineTotal = originalUnit * quantity;

      const stock =
        catalogReady && product
          ? getVariantStock(
              product,
              item.selectedSize,
              item.selectedColor,
            )
          : null;

      const validQuantity =
        Number.isSafeInteger(quantity) && quantity >= 1;

      const available =
        catalogReady &&
        Boolean(product) &&
        product.isActive !== false &&
        validQuantity &&
        stock >= quantity;

      return {
        ...item,
        product,
        quantity,
        stock,
        available,
        lineTotal,
        originalLineTotal,
        lineSavings: Math.max(
          0,
          originalLineTotal - lineTotal,
        ),
      };
    });
  }, [cart, products, catalogReady]);

  const pricing = useMemo(
    () =>
      calculateOrderPricing({
        cart,
        coupon: coupon || null,
        deliveryMethod: "standard",
      }),
    [cart, coupon],
  );

  const itemCount = rows.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const productSavings = rows.reduce(
    (total, item) => total + item.lineSavings,
    0,
  );

  const couponSavings = safeAmount(
    pricing.couponDiscount,
  );

  const totalSavings = productSavings + couponSavings;

  const hasUnavailableItems =
    catalogReady && rows.some((item) => !item.available);

  const canCheckout =
    catalogReady &&
    rows.length > 0 &&
    !hasUnavailableItems;

  const editingItem = rows.find(
    (item) => getCartItemKey(item) === editingKey,
  );

  const analyticsItemsKey = JSON.stringify(
    cart.map((item) => [
      item.id,
      item.quantity,
      item.selectedSize,
      item.selectedColor,
      item.price,
    ]),
  );

  useEffect(() => {
    if (!catalogReady || !cart.length) return;

    function track() {
      trackOnce(
        `bag:${analyticsVisitKey()}`,
        "view_cart",
        commercePayload(
          cart,
          pricing.totalAfterCoupon,
        ),
      );
    }

    track();

    window.addEventListener(
      "gymdrobe-analytics-ready",
      track,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-analytics-ready",
        track,
      );
    };
  }, [
    catalogReady,
    analyticsItemsKey,
    pricing.totalAfterCoupon,
  ]);

  async function retryCatalog() {
    if (
      retrying ||
      typeof refreshProducts !== "function"
    ) {
      return;
    }

    setRetrying(true);

    try {
      await refreshProducts();
    } catch {
      notify(
        "Products could not be refreshed. Please try again.",
        "error",
      );
    } finally {
      setRetrying(false);
    }
  }

  function moveToWishlist(item) {
    if (!catalogReady || !item.product) return;

    const alreadySaved = wishlist.some(
      (product) =>
        String(product.id) === String(item.product.id),
    );

    if (!alreadySaved) {
      const saved = toggleWishlist(item.product);

      // Keep the bag item when persistent saving fails.
      // StoreContext still retains the wishlist in memory.
      if (!saved) return;
    }

    removeFromCart(getCartItemKey(item));
  }

  if (!rows.length) {
    return (
      <div className="page narrow">
        <div className="empty-state">
          <h1>Your bag is empty</h1>

          <p>
            Pick your workout essentials and come back
            when you’re ready to check out.
          </p>

          <Link className="button" to="/shop">
            Shop GymDrobe
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div className="page-heading">
        <div>
          <h1>Shopping bag</h1>

          <p className="muted" aria-live="polite">
            {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"} in your bag
          </p>
        </div>

        <Link className="text-link" to="/shop">
          Continue shopping →
        </Link>
      </div>

      {loading && (
        <p className="notice" role="status">
          Checking current prices and available stock…
        </p>
      )}

      {catalogError && (
        <div className="notice">
          <p role="alert">
            Products could not be loaded. Your saved bag
            is still shown, but availability must be checked
            before checkout.
          </p>

          <button
            type="button"
            className="button secondary"
            disabled={retrying}
            onClick={retryCatalog}
          >
            {retrying ? "Retrying…" : "Retry product loading"}
          </button>
        </div>
      )}

      <div className="cart-layout">
        <div className="cart-items">
          {rows.map((item) => {
            const product = item.product;
            const key = getCartItemKey(item);

            if (
              catalogReady &&
              (!product || product.isActive === false)
            ) {
              return (
                <article key={key} className="cart-row">
                  <div className="cart-copy">
                    <h2>{item.name || "Product unavailable"}</h2>

                    <p className="field-error">
                      This product is no longer available in
                      the current catalogue.
                    </p>

                    <button
                      type="button"
                      className="text-link danger"
                      onClick={() => removeFromCart(key)}
                    >
                      Remove from bag
                    </button>
                  </div>
                </article>
              );
            }

            const displayProduct = product || item;

            const productSaved = wishlist.some(
              (entry) =>
                String(entry.id) ===
                String(displayProduct.id),
            );

            const deliveryEstimate = String(
              product?.delivery?.estimatedDays || "",
            ).trim();

            const maxQuantity =
              item.stock == null
                ? 1
                : Math.max(
                    1,
                    Math.min(10, Math.floor(item.stock)),
                  );

            const quantities = Array.from(
              { length: maxQuantity },
              (_, index) => index + 1,
            );

            // Keep the recorded selection visible even if
            // stock has fallen or quantity exceeds ten.
            if (
              Number.isSafeInteger(item.quantity) &&
              item.quantity >= 1 &&
              !quantities.includes(item.quantity)
            ) {
              quantities.push(item.quantity);
              quantities.sort((a, b) => a - b);
            }

            const options = [
              item.selectedColor,
              item.selectedSize,
            ]
              .filter(Boolean)
              .join(" / ");

            return (
              <article key={key} className="cart-row">
                <Link
                  to={productPath(item.id)}
                  className="cart-thumb"
                  aria-label={`View ${
                    displayProduct.name || "product"
                  }`}
                >
                  <ProductImage product={displayProduct} />
                </Link>

                <div className="cart-copy">
                  <div className="cart-head">
                    <div>
                      <p className="eyebrow">
                        {displayProduct.brand || "GymDrobe"}
                      </p>

                      <Link to={productPath(item.id)}>
                        <h2>
                          {displayProduct.name || "Product"}
                        </h2>
                      </Link>
                    </div>

                    <div className="cart-price">
                      <strong>{money(item.lineTotal)}</strong>

                      {item.lineSavings > 0 && (
                        <del className="muted">
                          {money(item.originalLineTotal)}
                        </del>
                      )}
                    </div>
                  </div>

                  <p className="muted">
                    {options || "Standard option"}
                  </p>

                  <p className="muted">
                    {money(safeAmount(item.price))} each
                  </p>

                  {item.lineSavings > 0 && (
                    <p className="positive">
                      You save {money(item.lineSavings)} on
                      this selection
                    </p>
                  )}

                  {deliveryEstimate && catalogReady && (
                    <p className="muted">
                      Estimated delivery:{" "}
                      <strong>{deliveryEstimate}</strong>
                    </p>
                  )}

                  {catalogReady &&
                    item.stock > 0 &&
                    item.stock <= 5 && (
                      <p className="muted">
                        Only {item.stock} left for this selection
                      </p>
                    )}

                  <div className="cart-controls">
                    <label>
                      Qty{" "}
                      <select
                        aria-label={`Quantity for ${
                          displayProduct.name || "product"
                        }`}
                        value={item.quantity}
                        disabled={
                          !catalogReady ||
                          !product ||
                          item.stock <= 0
                        }
                        onChange={(event) =>
                          updateQuantity(
                            key,
                            Number(event.target.value),
                          )
                        }
                      >
                        {!quantities.includes(item.quantity) && (
                          <option
                            value={item.quantity}
                            disabled
                          >
                            Check quantity
                          </option>
                        )}

                        {quantities.map((quantity) => (
                          <option
                            key={quantity}
                            value={quantity}
                            disabled={
                              catalogReady &&
                              quantity > item.stock
                            }
                          >
                            {quantity}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="text-link"
                      disabled={!catalogReady || !product}
                      onClick={() => setEditingKey(key)}
                    >
                      Edit size / colour
                    </button>

                    <button
                      type="button"
                      className="text-link"
                      disabled={!catalogReady || !product}
                      onClick={() => moveToWishlist(item)}
                    >
                      {productSaved
                        ? "Move to wishlist"
                        : "Save to wishlist"}
                    </button>

                    <button
                      type="button"
                      className="text-link danger"
                      disabled={!catalogReady}
                      onClick={() => removeFromCart(key)}
                    >
                      Remove
                    </button>
                  </div>

                  {catalogReady && !item.available && (
                    <p className="field-error" role="alert">
                      {!Number.isSafeInteger(item.quantity) ||
                      item.quantity < 1
                        ? "Choose a valid quantity before checkout."
                        : item.stock <= 0
                          ? "This variant is currently out of stock. Choose another option or remove it."
                          : `Only ${item.stock} available. Reduce the quantity before checkout.`}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="cart-summary">
          <CouponBox subtotal={pricing.subtotal} />

          <PriceSummary
            cart={cart}
            coupon={coupon}
            deliveryMethod="standard"
          />

          {totalSavings > 0 && (
            <div className="notice" role="status">
              <strong>
                Your current savings: {money(totalSavings)}
              </strong>

              {couponSavings > 0 && (
                <p className="muted">
                  Includes {money(couponSavings)} coupon
                  savings.
                </p>
              )}
            </div>
          )}

          <div className="panel cart-trust">
            <p>
              <strong>Review before payment</strong>
            </p>

            <p className="muted">
              Choose delivery and payment at checkout.
              Product availability and pricing are checked
              again before your order is placed.
            </p>

            <p className="muted">
              COD requires a 10% online advance on products
              after coupon discounts. The remaining balance,
              including delivery charges, is paid on delivery.
            </p>
          </div>

          {canCheckout ? (
            <Link
              className="button full"
              to="/checkout"
            >
              Proceed to checkout
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="button full"
                disabled
              >
                {!catalogReady
                  ? "Waiting for product check"
                  : "Check unavailable items"}
              </button>

              {hasUnavailableItems && (
                <p className="field-error" role="alert">
                  Update the unavailable products before
                  continuing to checkout.
                </p>
              )}
            </>
          )}

          <Link className="text-link" to="/shop">
            Continue shopping
          </Link>
        </aside>
      </div>

      {editingItem && catalogReady && (
        <BagVariantEditor
          key={editingKey}
          item={editingItem}
          onClose={() => setEditingKey(null)}
        />
      )}
    </div>
  );
}