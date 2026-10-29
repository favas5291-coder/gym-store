import {
  useCallback,
  useState,
} from "react";

import { Link } from "react-router-dom";
import { Heart as HeartIcon } from "lucide-react";
import { PremiumButton, TextLink, IconButton } from "./PremiumControls.jsx";

import {
  productImageSources,
} from "../utils/productImages.js";

import {
  firstOptions,
} from "../utils/cartUtils.js";

import {
  useShoppingTools,
} from "../context/ShoppingToolsContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  ProductImage,
  productPath,
  priceDetails,
  inStock,
  money,
} from "./StorefrontShared.jsx";

import Modal from "./Modal.jsx";
import ProductOptions from "./ProductOptions.jsx";

import useProductReviews from "../hooks/useProductReviews.js";

export default function ProductCard({
  product,
  priority = false,
  ...legacy
}) {
  const item = product || legacy;
  const [cardColor, setCardColor] = useState(null);
  const [previewAlternate, setPreviewAlternate] = useState(false);

  function warmAlternate() {
    // Touch layouts never display the hover photo. Keep its URL out of the
    // DOM until a mouse or keyboard user actually approaches this card.
    if (window.matchMedia("(hover: hover)").matches) {
      setPreviewAlternate(true);
    }
  }

  const [quickColor, setQuickColor] =
    useState(null);

  const [quick, setQuick] =
    useState(false);

  const initialQuickColor =
    cardColor || (Array.isArray(item.colors) &&
    item.colors.includes(item.selectedColor)
      ? item.selectedColor
      : firstOptions(item).selectedColor);

  const changeQuickColor = useCallback(
    (color) => {
      setQuickColor((current) =>
        current?.id === item.id &&
        current.color === color
          ? current
          : {
              id: item.id,
              color,
            },
      );
    },
    [item.id],
  );

  const {
    compared,
    toggleCompare,
  } = useShoppingTools();

  const {
    wishlist,
    toggleWishlist,
  } = useStore();

  function openQuick() {
    setQuickColor({
      id: item.id,
      color: initialQuickColor,
    });

    setQuick(true);
  }

  const saved = wishlist.some(
    (entry) =>
      String(entry.id) === String(item.id),
  );

  const isCompared = compared.some(
    (entry) =>
      String(entry.id) === String(item.id),
  );

  const available = inStock(item);
  const price = priceDetails(item);

  const {
    rating,
    count,
  } = useProductReviews(item);

  const alternateImage =
    productImageSources({ ...item, selectedColor: cardColor || item.selectedColor })[1] || null;

  const path = productPath(item.id);

  const quickSelectedColor =
    quickColor?.id === item.id
      ? quickColor.color
      : initialQuickColor;

  return (
    <article className="gm-product-card" onMouseEnter={warmAlternate} onFocus={warmAlternate}>
      <div className="gm-product-visual">
        <Link
          className="gm-product-image"
          to={path}
          aria-label={`View ${item.name}`}
        >
          <ProductImage product={{ ...item, selectedColor: cardColor || item.selectedColor }}
            eager={priority} fetchPriority={priority ? "high" : "auto"}
            sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 300px" />

          {alternateImage && previewAlternate && (
            <ProductImage
              className="alternate-photo"
              product={{
                ...item,
                colorImages: [],
                images: [],
                selectedColor: null,
                image: alternateImage,
              }}
              decorative
            />
          )}
        </Link>

        {item.badge && (
          <span className="gm-product-badge">
            {item.badge}
          </span>
        )}

        <IconButton
          className={`card-heart ${saved ? "saved" : ""}`}
          label={`${saved ? "Remove" : "Save"} ${item.name} ${saved ? "from" : "to"} wishlist`}
          aria-pressed={saved}
          onClick={() => toggleWishlist(item)}
        >
          <HeartIcon size={19} strokeWidth={1.7} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
        </IconButton>

        {count > 0 && (
          <span
            className="gm-rating"
            aria-label={
              `${rating} out of 5 ` +
              `from ${count} reviews`
            }
          >
            {rating}

            <span aria-hidden="true">
              ★
            </span>

            <i />

            {count}
          </span>
        )}

        {!available && (
          <span className="gm-stock-label">
            OUT OF STOCK
          </span>
        )}
      </div>

      <div className="gm-product-copy">
        <Link
          to={path}
          className="gm-product-info-link"
        >
          <p className="gm-product-brand">
            {item.brand || "GymDrobe"}
          </p>

          <h3>{item.name}</h3>
        </Link>

        <p className="gm-product-price">
          <strong>
            {money(price.selling)}
          </strong>

          {price.discount > 0 && (
            <>
              <del>
                {money(price.price)}
              </del>

              <span>
                {price.discount}% OFF
              </span>
            </>
          )}
        </p>

        {count > 0 && (
          <p className="gm-product-proof">
            <span aria-hidden="true">
              ★
            </span>{" "}

            <strong>{rating}</strong>{" "}

            <span>
              ({count}{" "}
              {count === 1
                ? "review"
                : "reviews"})
            </span>
          </p>
        )}

        <p
          className={
            "gm-product-availability " +
            (
              available
                ? "available"
                : "unavailable"
            )
          }
        >
          {available
            ? "In stock"
            : "Currently unavailable"}
        </p>

        {Array.isArray(item.colors) && item.colors.length > 0 && <div className="card-colors" role="group" aria-label={`${item.name} colours`}>
          {item.colors.slice(0, 4).map(color => <button type="button" key={color} aria-label={`Preview ${color} ${item.name}`} aria-pressed={(cardColor || item.selectedColor || firstOptions(item).selectedColor) === color} title={color} onClick={() => setCardColor(color)}>
            <span aria-hidden="true" style={{ backgroundColor: typeof CSS !== "undefined" && CSS.supports("color", color) ? color : "#b2b2a5" }} />
          </button>)}
          {item.colors.length > 4 && <Link to={path} aria-label={`View all ${item.colors.length} colours`}>+{item.colors.length - 4}</Link>}
        </div>}

        <div className="gm-product-card-cta">
          {available ? (
            <PremiumButton
              className="button full"
              aria-label={`Quick add ${item.name}`}
              onClick={openQuick}
            >Quick add</PremiumButton>
          ) : (
            <PremiumButton variant="outline" className="button full" to={path}>View product</PremiumButton>
          )}


        </div>

        <TextLink
          className="compare-toggle"
          aria-pressed={isCompared}
          onClick={() => toggleCompare(item)}
        >{isCompared ? "Added to comparison" : "Compare"}</TextLink>
      </div>

      {quick && (
        <Modal
          title={item.name}
          onClose={() => setQuick(false)}
          className="quick-modal"
        >
          <div className="quick-layout">
            <ProductImage
              product={{
                ...item,
                selectedColor: quickSelectedColor,
              }}
              eager
            />

            <div>
              <p className="eyebrow">
                {item.brand || "GymDrobe"}
              </p>

              {count > 0 && (
                <p className="gm-product-proof">
                  <strong>
                    {rating} ★
                  </strong>{" "}

                  <span>
                    {count}{" "}
                    {count === 1
                      ? "review"
                      : "reviews"}
                  </span>
                </p>
              )}

              <ProductOptions
                key={item.id}
                product={{ ...item, selectedColor: quickSelectedColor }}
                onColorChange={changeQuickColor}
                onAdded={() => setQuick(false)}
              />

              <TextLink className="text-link" to={path} onClick={() => setQuick(false)}>View full product details</TextLink>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}
