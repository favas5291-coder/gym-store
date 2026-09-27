import RecentlyViewed from "../components/RecentlyViewed.jsx";
import { productSpecs, rankRelated } from "../utils/commerce.js";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import ProductOptions from "../components/ProductOptions.jsx";
import ProductReviews from "../components/ProductReviews.jsx";
import ProductRow from "../components/ProductRow.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";
import { ProductImage, categoryPath } from "../components/StorefrontShared.jsx";
import { readStorage, writeStorage } from "../utils/storage.js";
import { useStore } from "../context/StoreContext.jsx";
import useProductReviews from "../hooks/useProductReviews.js";
function ProductDetail({ product }) {
  const { products } = useCatalog();
  const { compared, toggleCompare } = useShoppingTools();
  const { notify } = useStore(),
    { rating, count } = useProductReviews(product);
  const images = [
    ...new Set([product.image, ...(product.images || [])].filter(Boolean)),
  ];
  const [photo, setPhoto] = useState(images[0] || ""),
    [zoom, setZoom] = useState(false),
    [pincode, setPincode] = useState(
      readStorage("gymdrobe-delivery-pincode", ""),
    ),
    [delivery, setDelivery] = useState("");
  const [recentIds] = useState(() => {
    const ids = readStorage("gymdrobe-recently-viewed", []);
    return Array.isArray(ids) ? ids.map(String) : [];
  });
  useEffect(() => {
    writeStorage(
      "gymdrobe-recently-viewed",
      [
        String(product.id),
        ...recentIds.filter((id) => id !== String(product.id)),
      ].slice(0, 8),
    );
  }, [product.id, recentIds]);
  const related = rankRelated(product, products).slice(0, 5);
  function checkDelivery(event) {
    event.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setDelivery("Enter a valid 6-digit pincode.");
      return;
    }
    writeStorage("gymdrobe-delivery-pincode", pincode);
    setDelivery(
      product.delivery?.available === false
        ? "This product is currently unavailable for delivery."
        : "Pincode format accepted. Delivery serviceability and dates will be confirmed when live shipping is connected.",
    );
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: product.name,
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        notify("Product link copied.");
      }
    } catch (error) {
      if (error.name !== "AbortError")
        notify("Copy this page’s address to share the product.", "info");
    }
  }
  return (
    <div className="product-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to={categoryPath(product.category)}>{product.category}</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail-layout">
        <div className="gallery">
          <button
            className="main-photo"
            type="button"
            onClick={() => setZoom(true)}
            aria-label={`Enlarge ${product.name} image`}
          >
            <ProductImage product={{ ...product, image: photo }} eager />
          </button>
          {images.length > 1 && (
            <div className="thumbnails">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`View product photo ${index + 1}`}
                  aria-pressed={photo === src}
                  onClick={() => setPhoto(src)}
                >
                  <ProductImage
                    product={{ ...product, image: src }}
                    decorative
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <p className="product-brand">{product.brand}</p>
          <h1>{product.name}</h1>
          {count > 0 && (
            <a className="detail-rating" href="#product-reviews">
              {rating} <span>★</span> | {count} reviews
            </a>
          )}
          <ProductOptions product={product} />
          <div className="delivery-box">
            <h2>DELIVERY OPTIONS</h2>
            <form onSubmit={checkDelivery}>
              <label className="sr-only" htmlFor="delivery-pincode">
                Delivery pincode
              </label>
              <input
                id="delivery-pincode"
                placeholder="Enter pincode"
                value={pincode}
                maxLength="6"
                inputMode="numeric"
                onChange={(e) => {
                  setPincode(e.target.value.replace(/\D/g, ""));
                  setDelivery("");
                }}
              />
              <button className="text-link" type="submit">
                Check
              </button>
            </form>
            {delivery && <p role="status">{delivery}</p>}
            <p>
              Standard delivery is free on qualifying totals of ₹500 or more
              after coupons.
            </p>
            <p>
              {product.returnPolicy ||
                "Return eligibility is shown with your order."}
            </p>
          </div>
          <details open className="product-description">
            <summary>PRODUCT DETAILS</summary>
            <p>{product.description}</p>
            {Array.isArray(product.highlights || product.features) && (
              <ul>
                {(product.highlights || product.features).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
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
            {product.careInstructions?.length ? (
              <ul>
                {product.careInstructions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>Follow the care label supplied with the product.</p>
            )}
          </details>
          <div className="bag-links">
            <button
              className="text-link"
              type="button"
              aria-pressed={compared.some((p) => p.id === product.id)}
              onClick={() => toggleCompare(product)}
            >
              {compared.some((p) => p.id === product.id)
                ? "Remove from comparison"
                : "Compare this product"}
            </button>
            <Link
              className="text-link"
              to={`/help?product=${encodeURIComponent(product.id)}`}
            >
              Ask about this product
            </Link>
          </div>
          <button type="button" className="text-link" onClick={share}>
            Share this product ↗
          </button>
        </div>
      </div>
      <ProductReviews product={product} />
      <ProductRow title="YOU MAY ALSO LIKE" products={related} />
      <RecentlyViewed exclude={product.id} />
      {zoom && (
        <Modal
          title={product.name}
          onClose={() => setZoom(false)}
          className="image-modal"
        >
          <ProductImage product={{ ...product, image: photo }} eager />
          {images.length > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() =>
                  setPhoto(
                    images[
                      (images.indexOf(photo) - 1 + images.length) %
                        images.length
                    ],
                  )
                }
              >
                Previous photo
              </button>
              <span>
                {images.indexOf(photo) + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPhoto(images[(images.indexOf(photo) + 1) % images.length])
                }
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
  const { products } = useCatalog();
  const { id } = useParams();
  const product = products.find((p) => String(p.id) === String(id));
  return product ? (
    <ProductDetail key={product.id} product={product} />
  ) : (
    <EmptyState title="Product not found">
      This product may no longer be available. Explore our current collection.
    </EmptyState>
  );
}