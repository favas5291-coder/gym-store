import { ArrowRight } from "lucide-react";
import "./ProductColorImages.css";
import "./PurchaseFlow.css";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import VirtualTryOnButton from "./virtual-try-on/VirtualTryOnButton.jsx";
import FitGuide from "./FitGuide.jsx";

import {
  Heart,
} from "./StorefrontShared.jsx";

import {
  useShoppingTools,
} from "../context/ShoppingToolsContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

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

import {
  buyingInformation,
  optionLabels,
  productList,
} from "../utils/productInformation.js";

import {
  MAX_PURCHASE_QUANTITY,
  bagQuantityMessage,
  latestPurchaseProduct,
  productPriceAvailable,
  productReference,
  purchaseKey,
  purchaseOptions,
  purchaseState,
} from "../utils/productPurchase.js";

const SWATCHES = {
  black: "#171717",
  white: "#fff",
  blue: "#2563eb",
  navy: "#172554",
  "navy blue": "#172554",
  "light blue": "#7dd3fc",
  grey: "#737373",
  gray: "#737373",
  charcoal: "#374151",
  red: "#dc2626",
  green: "#15803d",
  olive: "#657241",
  pink: "#f9a8d4",
  purple: "#7e22ce",
  yellow: "#facc15",
  orange: "#f97316",
  brown: "#854d0e",
  beige: "#dfcaa7",
  cream: "#fffdd0",
  maroon: "#800000",
};

function swatchColor(value) {
  return (
    SWATCHES[
      String(value).trim().toLowerCase()
    ] || null
  );
}

const touchTarget = {
  minHeight: 44,
  minWidth: 44,
};

function ProductOptionsContent({
  product,
  onAdded,
  onColorChange,
  showSupporting = true,
}) {
  const {
    watches,
    watchProduct,
  } = useShoppingTools();

  const {
    addToCart,
    buyNow,
    cart,
    latestCart,
    wishlist,
    toggleWishlist,
    shoppingKey,
  } = useStore();

  const {
    products,
    loading,
    loaded,
    error: catalogError,
    catalogReady,
    getLatestProducts,
    refreshProducts,
  } = useCatalog();

  const navigate = useNavigate();
  const instanceId = useId();

  const stockId = `stock-${instanceId}`;
  const errorId = `purchase-error-${instanceId}`;
  const quantityId = `quantity-${instanceId}`;

  const mounted = useRef(false);
  const actionLock = useRef(false);
  const lastAdded = useRef("");
  const sizeField = useRef(null);
  const colorField = useRef(null);
  const actionSlot = useRef(null);
  const [floatingActions, setFloatingActions] = useState(false);

  useEffect(() => {
    if (showSupporting || !actionSlot.current || typeof IntersectionObserver === "undefined") return;
    const mobile = window.matchMedia("(max-width: 700px)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = actionSlot.current?.getBoundingClientRect();
      setFloatingActions(Boolean(mobile.matches && bounds && bounds.bottom <= 106));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(schedule, { rootMargin: "-106px 0px 0px 0px" });
    observer.observe(actionSlot.current);
    // A jump from below the slot to above it can skip an intersection change.
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    mobile.addEventListener("change", schedule);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mobile.removeEventListener("change", schedule);
    };
  }, [showSupporting]);

  const [selection, setSelection] = useState(() => {
    const initial = firstOptions(product);

    const initialColor =
      Array.isArray(product?.colors) &&
      product.colors.includes(
        product.selectedColor,
      )
        ? product.selectedColor
        : initial.selectedColor;

    const availableSizes = purchaseOptions(product?.sizes);

    const initialSize = availableSizes.length > 1
      ? availableSizes.includes(String(product?.selectedSize ?? ""))
        ? String(product.selectedSize)
        : null
      : initial.selectedSize;

    return {
      size:
        getVariantStock(
          product,
          initialSize,
          initialColor,
        ) > 0
          ? initialSize
          : null,

      color: initialColor,
      quantity: "1",
    };
  });

  const {
    size,
    color,
    quantity,
  } = selection;

  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addedKey, setAddedKey] = useState("");

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const sizes = purchaseOptions(product?.sizes);
  const colors = purchaseOptions(product?.colors);
  const labels = optionLabels(product);
  const information = buyingInformation(product);

  const benefits = productList(
    product?.highlights,
  ).slice(0, 4);

  const ready =
    typeof catalogReady === "boolean"
      ? catalogReady
      : loaded === true &&
        !loading &&
        !catalogError;

  const state = purchaseState(
    product,
    size,
    color,
    quantity,
    ready,
  );

  const totalStock = getTotalStock(product);
  const sellingPrice = getDiscountedPrice(product);
  const originalPrice = getOriginalPrice(product);
  const discount = getDiscountPercentage(product);

  const productId = String(
    productReference(product),
  );

  const shopper = shoppingKey("gymdrobe-cart");
  const shopperRef = useRef(shopper);

  shopperRef.current = shopper;

  const selectionKey = purchaseKey(
    product,
    size,
    color,
    state.quantity,
    shopper,
  );

  const added =
    addedKey === selectionKey &&
    addedKey !== "";

  const showFitGuide =
    sizes.length > 0 &&
    labels.size === "Size";

  const showTryOn =
    labels.size === "Size" &&
    labels.color === "Colour";

  const saved = (
    Array.isArray(wishlist) ? wishlist : []
  ).some(
    (item) =>
      productId &&
      String(productReference(item)) === productId,
  );

  const watching = (
    Array.isArray(watches) ? watches : []
  ).some(
    (item) =>
      productId &&
      String(productReference(item)) === productId,
  );

  function changeSelection(update) {
    if (actionLock.current) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        update,
        "color",
      )
    ) {
      onColorChange?.(update.color);
    }

    setSelection((current) => ({
      ...current,
      ...update,
    }));

    setError("");
    setAddedKey("");

    lastAdded.current = "";
  }

  function colorStock(nextColor) {
    if (sizes.length) {
      // Shared stock must not be multiplied
      // by the number of option labels.
      return Math.max(
        0,
        ...sizes.map((nextSize) =>
          getVariantStock(
            product,
            nextSize,
            nextColor,
          ),
        ),
      );
    }

    return getVariantStock(
      product,
      null,
      nextColor,
    );
  }

  function chooseColor(nextColor) {
    if (
      actionLock.current ||
      !colors.includes(String(nextColor))
    ) {
      return;
    }

    const keepSize =
      !sizes.length ||
      getVariantStock(
        product,
        size,
        nextColor,
      ) > 0;

    changeSelection({
      color: String(nextColor),
      size: keepSize ? size : null,
      quantity: "1",
    });

    if (!keepSize) {
      setError(
        `Choose an available ${labels.size.toLowerCase()} for ${nextColor} before adding to your bag.`,
      );
    }
  }

  function chooseSize(nextSize) {
    if (
      !sizes.includes(String(nextSize)) ||
      getVariantStock(
        product,
        nextSize,
        color,
      ) <= 0
    ) {
      return;
    }

    changeSelection({
      size: String(nextSize),
      quantity: "1",
    });
  }

  function handleTryOnSelection({
    color: nextColor,
    size: nextSize,
  } = {}) {
    const next = {
      size: sizes.length
        ? nextSize ?? size
        : null,

      color: colors.length
        ? nextColor ?? color
        : null,
    };

    const check = purchaseState(
      product,
      next.size,
      next.color,
      1,
      true,
    );

    if (!check.canBuy) {
      setError(check.message);
      return;
    }

    changeSelection({
      ...next,
      quantity: "1",
    });
  }

  async function purchase(mode) {
    if (
      actionLock.current ||
      (
        mode === "bag" &&
        lastAdded.current === selectionKey
      )
    ) {
      return;
    }

    if (!state.canBuy) {
      setError(state.message);

      const target = colors.length && !color
        ? colorField.current
        : sizes.length && !size
          ? sizeField.current
          : null;

      if (target) {
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        target.scrollIntoView({
          block: "center",
          behavior: reduceMotion ? "auto" : "smooth",
        });

        target
          .querySelector(".option-list button:not(:disabled)")
          ?.focus({ preventScroll: true });
      }

      return;
    }

    const catalogue =
      typeof getLatestProducts === "function"
        ? getLatestProducts()
        : products;

    const latest = latestPurchaseProduct(
      catalogue,
      product,
    );

    const check = purchaseState(
      latest,
      size,
      color,
      quantity,
      ready,
    );

    if (!check.canBuy) {
      setError(check.message);
      return;
    }

    if (
      !productPriceAvailable(product) ||
      getDiscountedPrice(latest) !== sellingPrice
    ) {
      setError(
        "The price changed. Check the updated product price before trying again.",
      );
      return;
    }

    if (mode === "bag") {
      const rows =
        typeof latestCart === "function"
          ? latestCart()
          : cart;

      const bagError = bagQuantityMessage(
        rows,
        latest,
        size,
        color,
        check.quantity,
      );

      if (bagError) {
        setError(bagError);
        return;
      }
    }

    actionLock.current = true;

    setBusy(true);
    setError("");

    try {
      const success = await (
        mode === "bag"
          ? addToCart(
              latest,
              check.quantity,
              size,
              color,
            )
          : buyNow(
              latest,
              check.quantity,
              size,
              color,
            )
      );

      if (
        !mounted.current ||
        shopperRef.current !== shopper
      ) {
        return;
      }

      if (success !== true) {
        setError(
          mode === "bag"
            ? "Your bag could not be updated. Check the availability message and your existing bag quantities, then try again."
            : "Checkout could not be prepared. Check availability and try again.",
        );

        return;
      }

      if (mode === "bag") {
        lastAdded.current = selectionKey;
        setAddedKey(selectionKey);
        onAdded?.();
      } else {
        navigate("/checkout?mode=buy-now");
      }
    } catch (failure) {
      if (mounted.current) {
        setError(
          typeof failure?.message === "string" &&
          failure.message
            ? failure.message
            : "The shopping action could not be completed. Please try again.",
        );
      }
    } finally {
      actionLock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  let stockMessage =
    state.stock <= 0
      ? totalStock <= 0
        ? "Out of stock"
        : "This combination is unavailable. Choose another option."
      : state.stock <= 5
        ? `Only ${state.stock} available for this selection`
        : `${state.stock} available for this selection`;

  if (!state.canBuy) {
    stockMessage = state.message;
  }

  const buttonLabel = busy
    ? "Please wait…"
    : added
      ? "Added to bag"
      : information.deliveryUnavailable
        ? "Delivery unavailable"
        : !state.priceAvailable
          ? "Price unavailable"
          : totalStock <= 0
            ? "Out of stock"
            : state.stock <= 0
              ? "Choose available options"
              : "Add to Cart";

  const optionsIncomplete = Boolean(
    (sizes.length && !size) ||
    (colors.length && !color),
  );

  const selectedColorUnavailable = Boolean(
    colors.length &&
    color &&
    colorStock(color) <= 0,
  );

  const purchaseDisabled =
    busy ||
    !ready ||
    product?.isActive === false ||
    information.deliveryUnavailable ||
    !state.priceAvailable ||
    totalStock <= 0 ||
    selectedColorUnavailable ||
    (!state.canBuy && !optionsIncomplete);

  const quantityLimit = Math.min(
    MAX_PURCHASE_QUANTITY,
    state.stock,
  );

  return (
    <div
      className="product-options"
      aria-busy={busy}
    >
      <div className="detail-price">
        <strong>
          {state.priceAvailable
            ? money(sellingPrice)
            : "Price unavailable"}
        </strong>

        {state.priceAvailable &&
          discount > 0 &&
          originalPrice > sellingPrice && (
            <>
              <del>
                Original price {money(originalPrice)}
              </del>

              <span>{discount}% OFF</span>
            </>
          )}
      </div>

      <p className="tax-note">
        Shipping and any eligible coupon savings
        are shown separately at checkout.
      </p>

      {showSupporting && benefits.length > 0 && (
        <details className="product-buying-benefits">
          <summary>Product highlights</summary>

          <ul>
            {benefits.map((benefit) => (
              <li key={benefit}>
                {benefit}
              </li>
            ))}
          </ul>
        </details>
      )}

      {colors.length > 0 && (
        <fieldset
          ref={colorField}
          disabled={busy}
          aria-describedby={!color ? `${errorId}-color` : undefined}
        >
          <legend>
            SELECT {labels.color.toUpperCase()}
            {color && <span> {color}</span>}
          </legend>

          {!color && (
            <p id={`${errorId}-color`} className="field-error">
              Choose a {labels.color.toLowerCase()} before buying.
            </p>
          )}

          <div className="option-list">
            {colors.map((option) => {
              const unavailable =
                colorStock(option) <= 0;

              const chipColor =
                labels.color === "Colour"
                  ? swatchColor(option)
                  : null;

              return (
                <button
                  key={option}
                  type="button"
                  disabled={busy}
                  className={
                    "gd-color-choice" +
                    (
                      unavailable
                        ? " gd-color-unavailable"
                        : ""
                    )
                  }
                  aria-pressed={
                    String(color) === option
                  }
                  aria-label={
                    `${labels.color} ${option}` +
                    (
                      unavailable
                        ? ", out of stock"
                        : ""
                    )
                  }
                  style={touchTarget}
                  title={
                    unavailable
                      ? `${option} is out of stock`
                      : option
                  }
                  onClick={() =>
                    chooseColor(option)
                  }
                >
                  {chipColor && (
                    <span
                      className="gd-color-chip"
                      aria-hidden="true"
                      style={{
                        backgroundColor: chipColor,
                      }}
                    />
                  )}

                  <span>
                    {option}
                    {unavailable
                      ? " · Out of stock"
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset
          ref={sizeField}
          disabled={busy}
          aria-describedby={!size ? `${errorId}-size` : undefined}
        >
          <legend>
            SELECT {labels.size.toUpperCase()}
            {size && <span> {size}</span>}
          </legend>

          {!size && (
            <p id={`${errorId}-size`} className="field-error">
              Choose your {labels.size.toLowerCase()} before buying.
            </p>
          )}

          {showFitGuide && (
            <button
              className="text-link fit-guide-link"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={guide}
              disabled={busy}
              style={touchTarget}
              onClick={() => setGuide(true)}
            >
              Size & fit guide
            </button>
          )}

          <div
            className={
              "option-list" +
              (
                labels.size === "Size"
                  ? " sizes"
                  : ""
              )
            }
          >
            {sizes.map((option) => {
              const unavailable =
                getVariantStock(
                  product,
                  option,
                  color,
                ) <= 0;

              return (
                <button
                  key={option}
                  type="button"
                  disabled={busy || unavailable}
                  aria-pressed={
                    String(size) === option
                  }
                  aria-label={
                    `${labels.size} ${option}` +
                    (
                      unavailable
                        ? ", unavailable for this selection"
                        : ""
                    )
                  }
                  style={touchTarget}
                  title={
                    unavailable
                      ? `${option} is unavailable for this selection`
                      : option
                  }
                  onClick={() =>
                    chooseSize(option)
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {(sizes.length > 0 || colors.length > 0) && (
        <p
          className="muted"
          aria-live="polite"
        >
          Your selection:{" "}
          {[
            colors.length &&
              `${labels.color}: ${
                color || "choose an option"
              }`,

            sizes.length &&
              `${labels.size}: ${
                size || "choose an option"
              }`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="quantity-line">
        <label htmlFor={quantityId}>
          Quantity
        </label>

        <input
          id={quantityId}
          type="number"
          min="1"
          max={Math.max(1, quantityLimit)}
          step="1"
          inputMode="numeric"
          style={touchTarget}
          disabled={busy || state.stock <= 0}
          aria-describedby={`${stockId} ${errorId}`}
          aria-invalid={
            !state.quantityValid ||
            state.quantity > quantityLimit
          }
          value={quantity}
          onChange={(event) =>
            changeSelection({
              quantity: event.target.value,
            })
          }
        />

        <span
          id={stockId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {stockMessage}
        </span>
      </div>

      {state.priceAvailable &&
        state.quantityValid &&
        state.quantity <= quantityLimit && (
          <p>
            <strong>
              Selected items total:
            </strong>{" "}

            {money(
              sellingPrice * state.quantity,
            )}

            <span className="muted">
              {" "}
              · Before shipping and coupon savings
            </span>
          </p>
        )}

      {showSupporting && <details className="product-purchase-trust">
        <summary>Delivery & return information</summary>
        {information.deliveryUnavailable ? (
          <p>
            Delivery is currently unavailable
            for this product.
          </p>
        ) : information.estimate ? (
          <p>
            <strong>
              Listed delivery estimate:
            </strong>{" "}

            {information.estimate}
          </p>
        ) : (
          <p>
            Confirm delivery timing for your
            location before buying.
          </p>
        )}

        <p>
          <strong>Returns:</strong>{" "}
          {information.returns}
        </p>

        <p className="muted">
          Availability applies to your exact selection.
          Checkout recalculates prices and checks stock
          before an order is confirmed.
        </p>
      </details>}

      <div ref={actionSlot} className="purchase-action-slot">
      <div className={`purchase-actions product-primary-actions${floatingActions ? " is-floating" : ""}`}>
        <button
          type="button"
          className="button"
          disabled={purchaseDisabled || added}
          aria-describedby={`${stockId} ${errorId}`}
          style={touchTarget}
          onClick={() => purchase("bag")}
        >
          {buttonLabel}
        </button>

        <button
          type="button"
          className="button secondary buy-now"
          disabled={purchaseDisabled}
          aria-describedby={`${stockId} ${errorId}`}
          style={touchTarget}
          onClick={() =>
            purchase("buy-now")
          }
        >
          {busy
            ? "Please wait…"
            : "Buy Now"}
        </button>
      </div>
      </div>

      <div id={errorId}>
        {error && (
          <p
            className="field-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      {catalogError && (
        <button
          type="button"
          className="text-link"
          disabled={busy || loading}
          onClick={refreshProducts}
        >
          Retry product availability
        </button>
      )}

      {added && (
        <div
          className="purchase-feedback"
          role="status"
        >
          <span>✓ Added to your bag</span>

          <Link to="/cart">
            View bag &amp; checkout <ArrowRight className="premium-control-arrow" size={16} strokeWidth={1.7} aria-hidden="true" />
          </Link>
        </div>
      )}

      <button
        type="button"
        className={
          "button secondary full " +
          (saved ? "saved" : "")
        }
        aria-pressed={saved}
        disabled={busy}
        style={touchTarget}
        onClick={() =>
          toggleWishlist(product)
        }
      >
        <Heart filled={saved} />

        {saved
          ? "Wishlisted"
          : "Save to wishlist"}
      </button>

      {showTryOn && !busy && (
        <div className="product-secondary-tool">
          <VirtualTryOnButton
            product={product}
            color={color}
            size={size}
            onSelectionChange={
              handleTryOnSelection
            }
          />
        </div>
      )}

      <button
        className="text-link watch-button"
        type="button"
        aria-pressed={watching}
        disabled={busy}
        style={touchTarget}
        onClick={() =>
          watchProduct(product)
        }
      >
        {watching
          ? "Watching this product ✓"
          : "Watch price & availability"}
      </button>

      {guide && showFitGuide && (
        <FitGuide
          product={product}
          color={color}
          onSelectSize={(next) => {
            chooseSize(next);
            setGuide(false);
          }}
          onClose={() => setGuide(false)}
        />
      )}
    </div>
  );
}

export default function ProductOptions({
  product,
  onAdded,
  onColorChange,
  showSupporting = true,
}) {
  return (
    <ProductOptionsContent
      key={String(
        productReference(product),
      )}
      product={product}
      onAdded={onAdded}
      onColorChange={onColorChange}
      showSupporting={showSupporting}
    />
  );
}
