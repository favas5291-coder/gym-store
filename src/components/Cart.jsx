import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import BagVariantEditor from "./BagVariantEditor.jsx";
import CouponBox from "./CouponBox.jsx";

import {
  ProductImage,
  productPath,
} from "./StorefrontShared.jsx";

import { getCartItemKey } from "../utils/cartUtils.js";
import { reviewCart } from "../utils/cartReview.js";
import { bagEditSignature } from "../utils/bagVariantEditing.js";

import {
  buyingInformation,
  productText,
} from "../utils/productInformation.js";

import {
  productReference,
  latestPurchaseProduct,
  purchaseOptions,
} from "../utils/productPurchase.js";

import {
  calculateOrderPricing,
  FREE_SHIPPING_LIMIT,
} from "../utils/orderCalculations.js";

import { money } from "../utils/productPricing.js";

import {
  analyticsVisitKey,
  commercePayload,
  trackOnce,
} from "../utils/analytics.js";

import "./Cart.css";

export default function Cart() {
  const { loading: authLoading } = useAuth();

  const {
    products,
    loading,
    error: catalogError,
    refreshProducts,
    getLatestProducts,
  } = useCatalog();

  const {
    cart,
    latestCart,
    updateQuantity,
    removeFromCart,
    wishlist,
    toggleWishlist,
    coupon,
    catalogReady,
    notify,
    shoppingKey,
  } = useStore();

  const navigate = useNavigate();

  const [editingKey, setEditingKey] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");

  const retryLock = useRef(false);
  const actionLock = useRef(false);
  const mounted = useRef(false);

  const shopper = shoppingKey("gymdrobe-cart");
  const shopperRef = useRef(shopper);
  shopperRef.current = shopper;

  const ready =
    catalogReady &&
    !loading &&
    !catalogError;

  const review = useMemo(
    () => reviewCart(cart, products, ready),
    [cart, products, ready],
  );

  const { rows, itemCount, totalsKnown } = review;

  const pricing = calculateOrderPricing({
    cart: review.pricingRows,
    coupon,
    deliveryMethod: "standard",
  });

  const editingItem = rows.find(
    (item) => item.key === editingKey,
  );

  const canCheckout =
    review.canCheckout && !authLoading;

  const savings =
    review.productSavings + pricing.couponDiscount;

  const analyticsKey = bagEditSignature(
    review.pricingRows,
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setEditingKey(null);
    setActionError(null);
    setCheckoutError("");
    setRetrying(false);
  }, [shopper]);

  useEffect(() => {
    if (!ready || !totalsKnown || !rows.length) {
      return;
    }

    function track() {
      trackOnce(
        `bag:${analyticsVisitKey()}`,
        "view_cart",
        commercePayload(
          review.pricingRows,
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
    ready,
    totalsKnown,
    analyticsKey,
    pricing.totalAfterCoupon,
    shopper,
  ]);

  async function retryCatalog() {
    if (
      retryLock.current ||
      typeof refreshProducts !== "function"
    ) {
      return;
    }

    retryLock.current = true;
    const startedFor = shopper;

    setRetrying(true);
    setCheckoutError("");
    setActionError(null);

    try {
      await refreshProducts();
    } catch {
      if (
        mounted.current &&
        shopperRef.current === startedFor
      ) {
        notify(
          "Products could not be refreshed. Please try again.",
          "error",
        );
      }
    } finally {
      retryLock.current = false;

      if (
        mounted.current &&
        shopperRef.current === startedFor
      ) {
        setRetrying(false);
      }
    }
  }

  function freshBag() {
    if (authLoading) {
      throw new Error(
        "Checking your account. Please wait a moment.",
      );
    }

    if (!ready) {
      throw new Error(
        "Refresh products before changing options or checking out.",
      );
    }

    const catalogue = getLatestProducts();

    if (!Array.isArray(catalogue)) {
      throw new Error(
        "Product information is unavailable. Retry product loading.",
      );
    }

    const latest = latestCart();

    if (
      bagEditSignature(cart) !==
      bagEditSignature(latest)
    ) {
      throw new Error(
        "Your bag changed. Review the updated quantities and prices before continuing.",
      );
    }

    return { catalogue, latest };
  }

  function changeQuantity(item, quantity) {
    if (actionLock.current) return;

    actionLock.current = true;
    setActionError(null);
    setCheckoutError("");

    try {
      const { catalogue, latest } = freshBag();

      const changed = latest.map((row) =>
        getCartItemKey(row) === item.key
          ? { ...row, quantity }
          : row,
      );

      const checked = reviewCart(
        changed,
        catalogue,
        true,
      );

      const target = checked.rows.find(
        (row) => row.key === item.key,
      );

      if (!target?.available) {
        throw new Error(
          target?.message ||
            "This item is no longer in your bag.",
        );
      }

      const updated = updateQuantity(
        item.key,
        quantity,
      );

      const accepted = latestCart().some(
        (row) =>
          getCartItemKey(row) === item.key &&
          Number(row.quantity) === quantity,
      );

      if (updated !== true || !accepted) {
        throw new Error(
          "The quantity could not be updated. Review your bag and retry.",
        );
      }
    } catch (error) {
      setActionError({
        key: item.key,
        message:
          error.message ||
          "Quantity could not be updated.",
      });
    } finally {
      actionLock.current = false;
    }
  }

  function isSaved(product) {
    const references = [
      product?.id,
      product?._id,
      product?.legacyId,
    ]
      .filter((value) => value != null)
      .map(String);

    return (
      Array.isArray(wishlist) ? wishlist : []
    ).some((entry) =>
      references.includes(
        String(
          typeof entry === "object"
            ? productReference(entry)
            : entry,
        ),
      ),
    );
  }

  function moveToWishlist(item) {
    if (actionLock.current) return;

    actionLock.current = true;
    setActionError(null);

    try {
      const { catalogue, latest } = freshBag();

      if (
        !latest.some(
          (row) => getCartItemKey(row) === item.key,
        )
      ) {
        throw new Error(
          "This item is no longer in your bag.",
        );
      }

      const product = latestPurchaseProduct(
        catalogue,
        item,
      );

      if (!product || product.isActive === false) {
        throw new Error(
          "This product is no longer available to save.",
        );
      }

      if (
        !isSaved(product) &&
        toggleWishlist(product) !== true
      ) {
        throw new Error(
          "Wishlist saving could not be confirmed. This item stays in your bag.",
        );
      }

      if (removeFromCart(item.key) !== true) {
        throw new Error(
          "The item is saved to your wishlist, but could not be removed from your bag. Please retry removal.",
        );
      }
    } catch (error) {
      setActionError({
        key: item.key,
        message:
          error.message ||
          "This item could not be moved.",
      });
    } finally {
      actionLock.current = false;
    }
  }

  function removeItem(item) {
    setActionError(null);
    setCheckoutError("");

    try {
      if (
        authLoading ||
        removeFromCart(item.key) !== true
      ) {
        throw new Error(
          "The item could not be removed. Check your account and retry.",
        );
      }

      if (editingKey === item.key) {
        setEditingKey(null);
      }
    } catch (error) {
      setActionError({
        key: item.key,
        message:
          error.message ||
          "Removal could not be completed.",
      });
    }
  }

  function checkout() {
    setCheckoutError("");

    try {
      const { catalogue, latest } = freshBag();

      const checked = reviewCart(
        latest,
        catalogue,
        true,
      );

      if (!checked.canCheckout) {
        throw new Error(
          checked.rows.find(
            (row) => !row.available,
          )?.message ||
            "Refresh products and check your bag quantities and prices before checkout.",
        );
      }

      if (
        !review.canCheckout ||
        bagEditSignature(review.pricingRows) !==
          bagEditSignature(checked.pricingRows)
      ) {
        throw new Error(
          "Product prices or availability changed. Refresh products and review your bag before checkout.",
        );
      }

      navigate("/checkout");
    } catch (error) {
      setCheckoutError(
        error.message ||
          "Checkout could not be opened. Please retry.",
      );
    }
  }

  if (!rows.length) {
    return (
      <div className="page narrow cart-page">
        <div className="empty-state">
          <h1>
            {authLoading
              ? "Checking your bag…"
              : "Your bag is empty"}
          </h1>

          <p>
            {authLoading
              ? "Please wait while your account is checked."
              : "Find clothing, accessories and workout essentials for your next session."}
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

          <p
            className="muted"
            aria-live="polite"
          >
            {rows.every(
              (item) => item.quantityValid,
            ) && Number.isSafeInteger(itemCount)
              ? `${itemCount} ${
                  itemCount === 1 ? "item" : "items"
                } in your bag`
              : "Check the quantities of items in your bag"}
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
        <p className="field-error" role="alert">
          Products could not be loaded. Your saved bag
          is shown below. Retry product loading before
          checkout.
        </p>
      )}

      <button
        type="button"
        className="text-link cart-refresh"
        disabled={loading || retrying}
        onClick={retryCatalog}
      >
        {loading || retrying
          ? "Checking products…"
          : "Refresh prices & stock"}
      </button>

      <div className="cart-layout">
        <div className="cart-items">
          {rows.map((item) => {
            const product = item.product || item;

            const information = buyingInformation(
              product,
            );

            const unavailable =
              ready &&
              (
                !item.product ||
                item.product.isActive === false
              );

            const variants = [
              item.selectedColor &&
                `${item.labels.color}: ${item.selectedColor}`,
              item.selectedSize &&
                `${item.labels.size}: ${item.selectedSize}`,
            ]
              .filter(Boolean)
              .join(" / ");

            const quantityOptions = Array.from(
              { length: item.maxQuantity },
              (_, index) => index + 1,
            );

            if (
              item.quantityValid &&
              !quantityOptions.includes(item.quantity)
            ) {
              quantityOptions.push(item.quantity);
            }

            const optionNames = [
              purchaseOptions(
                item.product?.sizes,
              ).length > 0 &&
                item.labels.size.toLowerCase(),

              purchaseOptions(
                item.product?.colors,
              ).length > 0 &&
                item.labels.color.toLowerCase(),
            ]
              .filter(Boolean)
              .join(" / ");

            const productId =
              productReference(item.product) ||
              productReference(item);

            const availabilityMessage =
              item.message ||
              (
                item.stockRemaining < item.stock
                  ? `Up to ${item.maxQuantity} for this option after other bag items sharing its stock.`
                  : item.maxQuantity < item.stock
                    ? `Up to ${item.maxQuantity} units of this selection per order.`
                    : `${item.stock} available for this selection.`
              );

            return (
              <article
                key={`${item.key}:${item.index}`}
                className="cart-row"
              >
                {productId && !unavailable && (
                  <Link
                    to={productPath(productId)}
                    className="cart-thumb"
                    aria-label={`View ${
                      product.name || "product"
                    }`}
                  >
                    <ProductImage product={product} />
                  </Link>
                )}

                <div className="cart-copy">
                  <div className="cart-head">
                    <div>
                      <p className="eyebrow">
                        {productText(product.brand) ||
                          "Brand not recorded"}
                      </p>

                      {productId && !unavailable ? (
                        <Link
                          to={productPath(productId)}
                        >
                          <h2>
                            {product.name || "Product"}
                          </h2>
                        </Link>
                      ) : (
                        <h2>
                          {product.name ||
                            "Product unavailable"}
                        </h2>
                      )}
                    </div>

                    <div className="cart-price">
                      <strong>
                        {item.lineSafe
                          ? money(item.lineTotal)
                          : "Check price / quantity"}
                      </strong>

                      {item.lineSavings > 0 && (
                        <del className="muted">
                          {money(item.lineOriginal)}
                        </del>
                      )}
                    </div>
                  </div>

                  <p className="muted">
                    {variants || "Standard option"}
                  </p>

                  <p className="muted">
                    {item.priceSafe
                      ? `${money(item.unitPrice)} each`
                      : "Price unavailable"}

                    {!ready ? " · Saved estimate" : ""}
                  </p>

                  {item.lineSavings > 0 && (
                    <p className="positive">
                      Product savings:{" "}
                      {money(item.lineSavings)}
                    </p>
                  )}

                  {ready &&
                    item.available &&
                    information.estimate && (
                      <p className="muted">
                        Recorded delivery estimate:{" "}
                        {information.estimate}
                      </p>
                    )}

                  {ready &&
                    item.available &&
                    information.transit && (
                      <p className="muted">
                        Courier transit:{" "}
                        {information.transit}
                      </p>
                    )}

                  {ready && item.product && (
                    <details className="cart-returns">
                      <summary>
                        Return conditions
                      </summary>

                      <p>{information.returns}</p>

                      {information.returnDetails.map(
                        (detail) => (
                          <p key={detail}>{detail}</p>
                        ),
                      )}
                    </details>
                  )}

                  <div className="cart-controls">
                    <label>
                      Qty{" "}
                      <select
                        aria-label={`Quantity for ${
                          product.name || "product"
                        }`}
                        aria-describedby={`bag-row-${item.index}`}
                        value={item.quantity ?? ""}
                        disabled={
                          !item.canAdjust ||
                          authLoading
                        }
                        onChange={(event) =>
                          changeQuantity(
                            item,
                            Number(event.target.value),
                          )
                        }
                      >
                        {!item.quantityValid && (
                          <option
                            value={item.quantity ?? ""}
                            disabled
                          >
                            Check quantity
                          </option>
                        )}

                        {quantityOptions.map(
                          (quantity) => (
                            <option
                              key={quantity}
                              value={quantity}
                              disabled={
                                quantity >
                                item.maxQuantity
                              }
                            >
                              {quantity}

                              {quantity >
                              item.maxQuantity
                                ? " — unavailable"
                                : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    {item.hasOptions && (
                      <button
                        type="button"
                        className="text-link"
                        disabled={
                          !ready ||
                          authLoading ||
                          unavailable
                        }
                        onClick={() => {
                          setActionError(null);
                          setEditingKey(item.key);
                        }}
                      >
                        Edit {optionNames}
                      </button>
                    )}

                    <button
                      type="button"
                      className="text-link"
                      disabled={
                        !ready ||
                        authLoading ||
                        unavailable
                      }
                      onClick={() =>
                        moveToWishlist(item)
                      }
                    >
                      {isSaved(product)
                        ? "Move to wishlist"
                        : "Save & move to wishlist"}
                    </button>

                    <button
                      type="button"
                      className="text-link danger"
                      disabled={authLoading}
                      onClick={() => removeItem(item)}
                    >
                      Remove
                    </button>
                  </div>

                  <p
                    id={`bag-row-${item.index}`}
                    className={
                      item.message
                        ? "field-error"
                        : "muted"
                    }
                    aria-live="polite"
                  >
                    {availabilityMessage}
                  </p>

                  {actionError?.key === item.key && (
                    <p
                      className="field-error"
                      role="alert"
                    >
                      {actionError.message}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <aside
          className="cart-summary"
          aria-label="Bag summary"
        >
          {totalsKnown ? (
            <>
              <fieldset
                aria-label="Order coupons"
                disabled={!ready || authLoading}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                }}
              >
                <CouponBox subtotal={pricing.subtotal} />
              </fieldset>

              <section className="price-summary">
                <h2>Estimated order total</h2>

                <dl>
                  <div>
                    <dt>
                      Items before product discounts
                    </dt>
                    <dd>{money(review.originalTotal)}</dd>
                  </div>

                  {review.productSavings > 0 && (
                    <div>
                      <dt>Product savings</dt>
                      <dd className="positive">
                        −{money(review.productSavings)}
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt>Items subtotal</dt>
                    <dd>{money(pricing.subtotal)}</dd>
                  </div>

                  {pricing.couponDiscount > 0 && (
                    <div>
                      <dt>Coupon savings</dt>
                      <dd className="positive">
                        −{money(pricing.couponDiscount)}
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt>
                      Estimated standard delivery
                    </dt>
                    <dd>
                      {pricing.shipping > 0
                        ? money(pricing.shipping)
                        : "Free"}
                    </dd>
                  </div>

                  <div className="total">
                    <dt>Estimated total</dt>
                    <dd>{money(pricing.finalTotal)}</dd>
                  </div>
                </dl>

                {savings > 0 && (
                  <p className="positive">
                    Your savings: {money(savings)}
                  </p>
                )}

                <p className="muted">
                  Standard delivery is free from{" "}
                  {money(FREE_SHIPPING_LIMIT)} after
                  coupons. Your selected delivery method
                  and final charges are shown at checkout.
                </p>

                {!review.canCheckout && (
                  <p className="muted">
                    Review the highlighted items before
                    using this estimate to check out.
                  </p>
                )}
              </section>
            </>
          ) : (
            <p className="notice" role="status">
              The total cannot be calculated until every
              item has a valid price and quantity. Correct
              the highlighted items or remove them.
            </p>
          )}

          <div className="panel cart-trust">
            <p>
              <strong>Review before payment</strong>
            </p>

            <p className="muted">
              Product prices, variants and stock are
              checked again before placing your order.
            </p>

            <p className="muted">
              If you choose COD with a 10% advance, the
              advance is calculated on products after
              coupons. The remaining balance includes
              delivery charges. Review cancellation and
              refund terms at checkout.
            </p>
          </div>

          <button
            type="button"
            className="button full"
            disabled={!canCheckout}
            onClick={checkout}
          >
            {authLoading
              ? "Checking your account…"
              : !ready
                ? "Waiting for product check"
                : !review.canCheckout
                  ? "Check highlighted items"
                  : "Proceed to checkout"}
          </button>

          {checkoutError && (
            <p className="field-error" role="alert">
              {checkoutError}
            </p>
          )}

          <Link
            className="text-link cart-continue"
            to="/shop"
          >
            Continue shopping
          </Link>
        </aside>
      </div>

      {editingItem && ready && !authLoading && (
        <BagVariantEditor
          key={editingKey}
          item={editingItem}
          onClose={() => setEditingKey(null)}
        />
      )}
    </div>
  );
}