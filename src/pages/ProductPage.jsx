import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import RecentlyViewed from "../components/RecentlyViewed.jsx";
import ProductOptions from "../components/ProductOptions.jsx";
import ProductReviews from "../components/ProductReviews.jsx";
import ProductRow from "../components/ProductRow.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";

import {
  ProductImage,
  categoryPath,
  resolveProductImage,
} from "../components/StorefrontShared.jsx";

import {
  productSpecs,
  rankRelated,
} from "../utils/commerce.js";

import {
  readStorage,
  writeStorage,
} from "../utils/storage.js";

import { trackProductView } from "../utils/analytics.js";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { money } from "../utils/productPricing.js";
import useProductReviews from "../hooks/useProductReviews.js";

function ProductDetail({ product, products }) {
  const { compared, toggleCompare } = useShoppingTools();
  const { notify, shoppingKey } = useStore();
  const { rating, count } = useProductReviews(product);

  const productId = product.id ?? product._id;

  const deliveryKey = shoppingKey(
    "gymdrobe-delivery-pincode",
  );

  const recentlyViewedKey = shoppingKey(
    "gymdrobe-recently-viewed",
  );

  useEffect(() => {
    const track = () => trackProductView(product);

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
  }, [product.id, product._id]);

  const images = [
    ...new Set(
      [
        product.image,
        ...(Array.isArray(product.images)
          ? product.images
          : []),
      ]
        .map(resolveProductImage)
        .filter(Boolean),
    ),
  ];

  const [photo, setPhoto] = useState(images[0] || "");
  const [zoom, setZoom] = useState(false);

  const activePhoto = images.includes(photo)
    ? photo
    : images[0] || "";

  const photoIndex = Math.max(
    0,
    images.indexOf(activePhoto),
  );

  function galleryProduct(source) {
    return {
      ...product,
      image: source,
      images: [],
    };
  }

  function movePhoto(direction) {
    if (!images.length) {
      return;
    }

    const nextIndex =
      (photoIndex + direction + images.length) %
      images.length;

    setPhoto(images[nextIndex]);
  }

  const [pincode, setPincode] = useState(() => {
    const saved = readStorage(deliveryKey, "");
    return typeof saved === "string" ? saved : "";
  });

  const [delivery, setDelivery] = useState("");

  const isCompared = (
    Array.isArray(compared) ? compared : []
  ).some(
    (item) =>
      item &&
      String(item.id ?? item._id) === String(productId),
  );

  const highlights = Array.isArray(product.highlights)
    ? product.highlights
    : Array.isArray(product.features)
      ? product.features
      : [];

  const careInstructions = Array.isArray(
    product.careInstructions,
  )
    ? product.careInstructions
    : typeof product.careInstructions === "string" &&
        product.careInstructions.trim()
      ? [product.careInstructions]
      : [];

  const freeDeliveryAbove = Number(
    product.delivery?.freeDeliveryAbove,
  );

  const hasFreeDeliveryThreshold =
    Number.isFinite(freeDeliveryAbove) &&
    freeDeliveryAbove > 0;

  const productBadge =
    typeof product.badge === "string"
      ? product.badge.trim()
      : "";

  useEffect(() => {
    const saved = readStorage(recentlyViewedKey, []);

    const recentIds = Array.isArray(saved)
      ? saved
          .filter(
            (value) =>
              typeof value === "string" ||
              typeof value === "number",
          )
          .map((value) => String(value).trim())
          .filter(Boolean)
      : [];

    writeStorage(
      recentlyViewedKey,
      [
        ...new Set([
          String(productId),
          ...recentIds.filter(
            (value) => value !== String(productId),
          ),
        ]),
      ].slice(0, 8),
    );
  }, [productId, recentlyViewedKey]);

  const related = rankRelated(product, products).slice(0, 5);

  function checkDelivery(event) {
    event.preventDefault();

    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setDelivery("Enter a valid 6-digit pincode.");
      return;
    }

    const saved = writeStorage(deliveryKey, pincode);

    if (!saved) {
      setDelivery(
        "Your pincode could not be saved because browser storage is unavailable. Delivery availability and dates still need confirmation.",
      );
      return;
    }

    setDelivery(
      product.delivery?.available === false
        ? "This product is currently unavailable for delivery."
        : "Pincode saved. Delivery availability and dates still need confirmation.",
    );
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(
          window.location.href,
        );

        notify("Product link copied.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        notify(
          "Copy this page's address to share the product.",
          "info",
        );
      }
    }
  }

  return (
    <div className="product-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>

        <Link
          to={
            product.category
              ? categoryPath(product.category)
              : "/shop"
          }
        >
          {product.category || "Shop"}
        </Link>

        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail-layout">
        <div className="gallery">
          <button
            className="main-photo"
            type="button"
            disabled={!activePhoto}
            onClick={() => setZoom(true)}
            aria-label={`Enlarge ${product.name} image`}
            aria-haspopup="dialog"
          >
            <ProductImage
              product={galleryProduct(activePhoto)}
              eager
              fetchPriority="high"
            />
          </button>

          {images.length > 1 && (
            <div
              className="thumbnails"
              role="group"
              aria-label="Product photos"
            >
              {images.map((source, index) => (
                <button
                  key={source}
                  type="button"
                  aria-label={`View product photo ${index + 1}`}
                  aria-pressed={activePhoto === source}
                  onClick={() => setPhoto(source)}
                >
                  <ProductImage
                    product={galleryProduct(source)}
                    decorative
                  />
                </button>
              ))}
            </div>
          )}

          <p className="muted">
            {activePhoto
              ? "Select an image to view it larger."
              : "Product photography is currently unavailable."}
          </p>
        </div>

        <div className="product-info">
          <div className="product-title-meta">
            <p className="product-brand">
              {product.brand || "GymDrobe"}
            </p>

            {productBadge && (
              <span className="gm-product-badge">
                {productBadge}
              </span>
            )}
          </div>

          <h1>{product.name}</h1>

          {product.description && (
            <p className="product-summary">
              {product.description}
            </p>
          )}

          {count > 0 ? (
            <a
              className="detail-rating"
              href="#product-reviews"
              aria-label={`${rating} out of 5 from ${count} reviews. Jump to reviews.`}
            >
              <strong>{rating}</strong>{" "}
              <span aria-hidden="true">★</span>
              {" · "}
              {count} {count === 1 ? "review" : "reviews"}
            </a>
          ) : (
            <p className="muted">No customer reviews yet</p>
          )}

          <ProductOptions product={product} />

          <div className="delivery-box">
            <h2>CHECK DELIVERY</h2>

            <p className="muted">
              Enter your pincode to save it for checkout.
            </p>

            <form onSubmit={checkDelivery}>
              <label
                className="sr-only"
                htmlFor="delivery-pincode"
              >
                Delivery pincode
              </label>

              <input
                id="delivery-pincode"
                placeholder="Enter 6-digit pincode"
                value={pincode}
                maxLength={6}
                inputMode="numeric"
                autoComplete="postal-code"
                onChange={(event) => {
                  setPincode(
                    event.target.value.replace(/\D/g, ""),
                  );
                  setDelivery("");
                }}
              />

              <button className="text-link" type="submit">
                Check
              </button>
            </form>

            {delivery && <p role="status">{delivery}</p>}

            {hasFreeDeliveryThreshold && (
              <p>
                Standard delivery is free on qualifying orders
                of <strong>{money(freeDeliveryAbove)}</strong>{" "}
                or more after coupons.
              </p>
            )}

            {product.delivery?.estimatedDays && (
              <p>
                <strong>Estimated delivery:</strong>{" "}
                {product.delivery.estimatedDays}
              </p>
            )}

            {product.returnPolicy && (
              <p>
                <strong>Returns:</strong>{" "}
                {product.returnPolicy}
              </p>
            )}
          </div>

          <details open className="product-description">
            <summary>PRODUCT DETAILS</summary>

            {product.description && (
              <p>{product.description}</p>
            )}

            {highlights.length > 0 && (
              <>
                <h3>Product benefits</h3>

                <ul>
                  {highlights.map((feature, index) => (
                    <li key={`${index}-${feature}`}>
                      {feature}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {product.whatsIncluded && (
              <p>
                <strong>What's included:</strong>{" "}
                {product.whatsIncluded}
              </p>
            )}

            <dl className="spec-grid">
              {productSpecs(product).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </details>

          <details className="product-description">
            <summary>CARE INSTRUCTIONS</summary>

            {careInstructions.length ? (
              <ul>
                {careInstructions.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>
                Follow the care label supplied with the product.
              </p>
            )}
          </details>

          <div className="bag-links">
            <button
              className="text-link"
              type="button"
              aria-pressed={isCompared}
              onClick={() => toggleCompare(product)}
            >
              {isCompared
                ? "✓ Added to comparison"
                : "+ Compare product"}
            </button>

            <Link
              className="text-link"
              to={`/help?product=${encodeURIComponent(productId)}`}
            >
              Need help choosing?
            </Link>

            <button
              type="button"
              className="text-link"
              onClick={share}
            >
              Share product ↗
            </button>
          </div>
        </div>
      </div>

      <ProductReviews product={product} />

      {related.length > 0 && (
        <ProductRow
          title="COMPLETE YOUR WORKOUT"
          products={related}
        />
      )}

      <RecentlyViewed exclude={productId} />

      {zoom && (
        <Modal
          title={product.name}
          onClose={() => setZoom(false)}
          className="image-modal"
        >
          <ProductImage
            product={galleryProduct(activePhoto)}
            eager
          />

          {images.length > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => movePhoto(-1)}
              >
                Previous photo
              </button>

              <span role="status">
                {photoIndex + 1} / {images.length}
              </span>

              <button
                type="button"
                onClick={() => movePhoto(1)}
              >
                Next photo
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const { shoppingKey } = useStore();

  const {
    products,
    loading,
    loaded,
    error,
    refreshProducts,
  } = useCatalog();

  const catalog = Array.isArray(products) ? products : [];

  const product = catalog.find(
    (item) =>
      item &&
      [item.id, item._id, item.legacyId, item.slug].some(
        (value) =>
          value != null && String(value) === String(id),
      ),
  );

  if (loading || (loaded === false && !error)) {
    return (
      <div role="status">
        <EmptyState title="Loading product…">
          Getting the latest product information from GymDrobe.
        </EmptyState>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState title="Unable to load product">
        <p role="alert">{String(error)}</p>

        <button
          type="button"
          className="button"
          onClick={refreshProducts}
        >
          Try again
        </button>

        <p>
          <Link className="text-link" to="/shop">
            Back to shop
          </Link>
        </p>
      </EmptyState>
    );
  }

  if (!product) {
    return (
      <EmptyState title="Product not found">
        This product may no longer be available.{" "}
        <Link className="text-link" to="/shop">
          Explore our current collection.
        </Link>
      </EmptyState>
    );
  }

  return (
    <ProductDetail
      key={`${shoppingKey("gymdrobe-recently-viewed")}:${product.id ?? product._id}`}
      product={product}
      products={catalog}
    />
  );
}