import {
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import VirtualTryOnButton from "./virtual-try-on/VirtualTryOnButton.jsx";
import FitGuide from "./FitGuide.jsx";

import {
  useShoppingTools,
} from "../context/ShoppingToolsContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

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
  Heart,
} from "./StorefrontShared.jsx";

export default function ProductOptions({
  product,
  onAdded,
}) {
  const {
    watches,
    watchProduct,
  } = useShoppingTools();

  const {
    addToCart,
    buyNow,
    wishlist,
    toggleWishlist,
  } = useStore();

  const navigate = useNavigate();

  const instanceId = useId();

  const quantityId =
    `quantity-${instanceId}`;

  const stockId =
    `stock-${instanceId}`;

  const touchTarget = {
    minHeight: "44px",
    minWidth: "44px",
  };

  const [guide, setGuide] = useState(false);
  const [added, setAdded] = useState(false);

  // ====================================================
  // AVAILABLE OPTIONS
  // ====================================================

  const sizes = useMemo(
    () =>
      Array.isArray(product?.sizes)
        ? product.sizes.map(String).filter(Boolean)
        : [],
    [product?.sizes]
  );

  const colors = useMemo(
    () =>
      Array.isArray(product?.colors)
        ? product.colors.map(String).filter(Boolean)
        : [],
    [product?.colors]
  );

  const hasSizes = sizes.length > 0;
  const hasColors = colors.length > 0;

  const benefits = useMemo(
    () =>
      Array.isArray(product?.highlights)
        ? product.highlights
            .filter(Boolean)
            .slice(0, 4)
        : [],
    [product?.highlights]
  );

  // ====================================================
  // INITIAL SELECTION
  // ====================================================

  const initial = useMemo(
    () => firstOptions(product),
    [product]
  );

  const [size, setSize] = useState(
    initial.selectedSize
  );

  const [color, setColor] = useState(
    initial.selectedColor
  );

  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const next = firstOptions(product);

    setSize(next.selectedSize);
    setColor(next.selectedColor);
    setQuantity(1);
    setAdded(false);
  }, [
    product?.id,
    product?._id,
    product?.stock,
    product?.stockStatus,
    product?.variants,
    product?.sizes,
    product?.colors,
  ]);

  // ====================================================
  // STOCK AND PRICING
  // ====================================================

  const totalStock = getTotalStock(product);
  const available = totalStock > 0;

  const stock = getVariantStock(
    product,
    size,
    color
  );

  const lowStock =
    stock > 0 && stock <= 5;

  const sellingPrice =
    getDiscountedPrice(product);

  const originalPrice =
    getOriginalPrice(product);

  const discount =
    getDiscountPercentage(product);

  // ====================================================
  // DELIVERY AND RETURNS
  // ====================================================

  const deliveryEstimate = String(
    product?.delivery?.estimatedDays || ""
  ).trim();

  const deliveryAvailable =
    product?.delivery?.available !== false;

  const returnPolicy = String(
    product?.returnPolicy || ""
  ).trim();

  // ====================================================
  // WISHLIST AND WATCH STATUS
  // ====================================================

  const saved = wishlist.some(
    (item) =>
      String(item.id) === String(product.id)
  );

  const watching = watches.some(
    (item) =>
      String(item.id) === String(product.id)
  );

  // ====================================================
  // COLOUR STOCK
  // ====================================================

  function getColorStock(nextColor) {
    if (!hasColors) {
      return 0;
    }

    if (hasSizes) {
      return sizes.reduce(
        (total, nextSize) =>
          total +
          getVariantStock(
            product,
            nextSize,
            nextColor
          ),
        0
      );
    }

    return getVariantStock(
      product,
      null,
      nextColor
    );
  }

  // ====================================================
  // CHANGE COLOUR
  // ====================================================

  function chooseColor(nextColor) {
    if (
      !colors.includes(String(nextColor)) ||
      getColorStock(nextColor) <= 0
    ) {
      return;
    }

    setAdded(false);
    setColor(nextColor);
    setQuantity(1);

    if (
      hasSizes &&
      getVariantStock(
        product,
        size,
        nextColor
      ) <= 0
    ) {
      const firstAvailableSize = sizes.find(
        (option) =>
          getVariantStock(
            product,
            option,
            nextColor
          ) > 0
      );

      setSize(
        firstAvailableSize ||
        sizes[0] ||
        null
      );
    }
  }

  // ====================================================
  // CHANGE SIZE
  // ====================================================

  function chooseSize(nextSize) {
    if (
      !sizes.includes(String(nextSize)) ||
      getVariantStock(
        product,
        nextSize,
        color
      ) <= 0
    ) {
      return;
    }

    setAdded(false);
    setSize(nextSize);
    setQuantity(1);
  }

  // ====================================================
  // QUANTITY
  // ====================================================

  function changeQuantity(value) {
    if (value === "") {
      setAdded(false);
      setQuantity("");
      return;
    }

    const next = Number(value);

    if (!Number.isFinite(next)) {
      return;
    }

    setAdded(false);

    const whole = Math.floor(next);

    setQuantity(
      Math.min(
        Math.max(1, whole),
        Math.max(1, stock)
      )
    );
  }

  function normalizedQuantity() {
    const next = Number(quantity);

    if (
      !Number.isSafeInteger(next) ||
      next < 1
    ) {
      return 1;
    }

    return Math.min(
      next,
      Math.max(1, stock)
    );
  }

  // ====================================================
  // VIRTUAL TRY-ON SELECTION
  // ====================================================

  function handleTryOnSelection({
    color: nextColor,
    size: nextSize,
  }) {
    let finalColor = nextColor ?? color;
    let finalSize = nextSize ?? size;

    if (hasColors) {
      if (
        !colors.includes(String(finalColor)) ||
        getColorStock(finalColor) <= 0
      ) {
        finalColor =
          colors.find(
            (option) =>
              getColorStock(option) > 0
          ) ||
          colors[0] ||
          null;
      }
    } else {
      finalColor = null;
    }

    if (hasSizes) {
      if (
        !sizes.includes(String(finalSize)) ||
        getVariantStock(
          product,
          finalSize,
          finalColor
        ) <= 0
      ) {
        finalSize =
          sizes.find(
            (option) =>
              getVariantStock(
                product,
                option,
                finalColor
              ) > 0
          ) ||
          sizes[0] ||
          null;
      }
    } else {
      finalSize = null;
    }

    setColor(finalColor);
    setSize(finalSize);
    setQuantity(1);
    setAdded(false);
  }

  // ====================================================
  // ADD TO BAG
  // ====================================================

  function handleAddToCart() {
    if (stock <= 0) {
      return;
    }

    const qty = normalizedQuantity();

    const success = addToCart(
      product,
      qty,
      size,
      color
    );

    if (success) {
      setQuantity(qty);
      setAdded(true);
      onAdded?.();
    }
  }

  // ====================================================
  // BUY NOW
  // ====================================================

  function handleBuyNow() {
    if (stock <= 0) {
      return;
    }

    const qty = normalizedQuantity();

    const success = buyNow(
      product,
      qty,
      size,
      color
    );

    if (success) {
      navigate("/checkout?mode=buy-now");
    }
  }

  // ====================================================
  // DISPLAY
  // ====================================================

  return (
    <div className="product-options">
      {/* Pricing */}

      <div className="detail-price">
        <strong>
          {money(sellingPrice)}
        </strong>

        {discount > 0 && (
          <>
            <del>
              MRP {money(originalPrice)}
            </del>

            <span>
              {discount}% OFF
            </span>
          </>
        )}
      </div>

      <p className="tax-note">
        Price includes applicable taxes
      </p>

      {/* Product benefits */}

      {benefits.length > 0 && (
        <div className="panel product-buying-benefits">
          <p className="eyebrow">
            WHY YOU'LL LIKE IT
          </p>

          <ul>
            {benefits.map((benefit) => (
              <li key={benefit}>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Colour selection */}

      {hasColors && (
        <fieldset>
          <legend>
            SELECT COLOUR

            {color && (
              <span> {color}</span>
            )}
          </legend>

          <div className="option-list">
            {colors.map((option) => {
              const optionStock =
                getColorStock(option);

              const disabled =
                optionStock <= 0;

              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  aria-disabled={disabled}
                  aria-pressed={
                    String(color) ===
                    String(option)
                  }
                  aria-label={`Colour ${option}${
                    disabled
                      ? ", out of stock"
                      : ""
                  }`}
                  style={touchTarget}
                  title={
                    disabled
                      ? `${option} is out of stock`
                      : `${option} — ${optionStock} available`
                  }
                  onClick={() =>
                    chooseColor(option)
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Size selection */}

      {hasSizes && (
        <fieldset>
          <legend>
            SELECT SIZE

            {size && (
              <span> {size}</span>
            )}
          </legend>

          <button
            className="text-link fit-guide-link"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={guide}
            style={touchTarget}
            onClick={() => setGuide(true)}
          >
            Size & fit guide
          </button>

          <div className="option-list sizes">
            {sizes.map((option) => {
              const optionStock =
                getVariantStock(
                  product,
                  option,
                  color
                );

              const disabled =
                optionStock <= 0;

              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  aria-disabled={disabled}
                  aria-pressed={
                    String(size) ===
                    String(option)
                  }
                  aria-label={`Size ${option}${
                    disabled
                      ? ", out of stock"
                      : ""
                  }`}
                  style={touchTarget}
                  title={
                    disabled
                      ? `Size ${option} is out of stock`
                      : `Size ${option} — ${optionStock} available`
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

      {/* Quantity and stock */}

      <div className="quantity-line">
        <label htmlFor={quantityId}>
          Quantity
        </label>

        <input
          id={quantityId}
          type="number"
          min="1"
          max={Math.max(1, stock)}
          step="1"
          inputMode="numeric"
          aria-describedby={stockId}
          style={touchTarget}
          disabled={stock <= 0}
          value={quantity}
          onChange={(event) =>
            changeQuantity(
              event.target.value
            )
          }
          onBlur={() =>
            setQuantity(
              normalizedQuantity()
            )
          }
        />

        <span
          id={stockId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {!available
            ? "Out of stock"
            : stock <= 0
              ? "This selection is unavailable"
              : lowStock
                ? `Only ${stock} left for this selection`
                : `${stock} available`}
        </span>
      </div>

      {/* Delivery and returns */}

      <div className="panel product-purchase-trust">
        {deliveryAvailable &&
          deliveryEstimate && (
            <p>
              <strong>Delivery:</strong>{" "}
              {deliveryEstimate}
            </p>
          )}

        {returnPolicy && (
          <p>
            <strong>Returns:</strong>{" "}
            {returnPolicy}
          </p>
        )}

        {stock > 0 && (
          <p className="muted">
            Availability is based on your
            selected size and colour.
          </p>
        )}
      </div>

      {/* Purchase buttons */}

      <div className="purchase-actions product-primary-actions">
        <button
          type="button"
          className="button"
          disabled={stock <= 0}
          aria-describedby={stockId}
          style={touchTarget}
          onClick={handleAddToCart}
        >
          {!available
            ? "Out of stock"
            : stock > 0
              ? "Add to bag"
              : "Unavailable"}
        </button>

        <button
          type="button"
          className="button secondary buy-now"
          disabled={stock <= 0}
          aria-describedby={stockId}
          style={touchTarget}
          onClick={handleBuyNow}
        >
          Buy now
        </button>
      </div>

      {/* Added confirmation */}

      {added && (
        <div
          className="purchase-feedback"
          role="status"
        >
          <span>
            ✓ Added to your bag
          </span>

          <Link to="/cart">
            View bag & checkout →
          </Link>
        </div>
      )}

      {/* Wishlist */}

      <button
        type="button"
        className={`button secondary full ${
          saved ? "saved" : ""
        }`}
        aria-pressed={saved}
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

      {/* Virtual Try-On */}

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

      {/* Price and availability watch */}

      <button
        className="text-link watch-button"
        type="button"
        aria-pressed={watching}
        style={touchTarget}
        onClick={() =>
          watchProduct(product)
        }
      >
        {watching
          ? "Watching this product ✓"
          : "Watch price & availability"}
      </button>

      {/* Fit guide */}

      {guide && (
        <FitGuide
          product={product}
          color={color}
          onSelectSize={(next) => {
            const optionStock =
              getVariantStock(
                product,
                next,
                color
              );

            if (optionStock > 0) {
              setSize(next);
              setQuantity(1);
              setAdded(false);
            }

            setGuide(false);
          }}
          onClose={() =>
            setGuide(false)
          }
        />
      )}
    </div>
  );
}