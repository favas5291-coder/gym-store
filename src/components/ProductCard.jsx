import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext.jsx";
import {
  Heart,
  ProductImage,
  productPath,
  priceDetails,
  inStock,
  money,
} from "./StorefrontShared.jsx";
import Modal from "./Modal.jsx";
import ProductOptions from "./ProductOptions.jsx";
import useProductReviews from "../hooks/useProductReviews.js";
export default function ProductCard({ product, ...legacy }) {
  const { compared, toggleCompare } = useShoppingTools();
  const item = product || legacy,
    { wishlist, toggleWishlist } = useStore();
  const [quick, setQuick] = useState(false),
    saved = wishlist.some((p) => String(p.id) === String(item.id));
  const price = priceDetails(item),
    { rating, count } = useProductReviews(item);
  return (
    <article className="gm-product-card">
      <div className="gm-product-visual">
        <Link className="gm-product-image" to={productPath(item.id)}>
          <ProductImage product={item} />
          {item.images?.find((src) => src && src !== item.image) && (
            <ProductImage
              className="alternate-photo"
              product={{
                ...item,
                image: item.images.find((src) => src && src !== item.image),
              }}
              decorative
            />
          )}
        </Link>
        {item.badge && <span className="gm-product-badge">{item.badge}</span>}
        <button
          type="button"
          className={`card-heart ${saved ? "saved" : ""}`}
          aria-label={`${saved ? "Remove" : "Save"} ${item.name} ${saved ? "from" : "to"} wishlist`}
          aria-pressed={saved}
          onClick={() => toggleWishlist(item)}
        >
          <Heart filled={saved} />
        </button>
        {count > 0 && (
          <span
            className="gm-rating"
            aria-label={`${rating} out of 5 from ${count} reviews`}
          >
            {rating} <span aria-hidden="true">★</span>
            <i />
            {count}
          </span>
        )}
        {!inStock(item) && <span className="gm-stock-label">OUT OF STOCK</span>}
        <div className="gm-card-action">
          <button type="button" onClick={() => setQuick(true)}>
            QUICK VIEW
          </button>
        </div>
      </div>
      <div className="gm-product-copy">
        <Link to={productPath(item.id)}>
          <p className="gm-product-brand">{item.brand || "GymDrobe"}</p>
          <h3>{item.name}</h3>
        </Link>
        <p className="gm-product-price">
          <strong>{money(price.selling)}</strong>
          {price.discount > 0 && (
            <>
              <del>{money(price.price)}</del>
              <span>({price.discount}% OFF)</span>
            </>
          )}
        </p>
      </div>
      <button
        className="compare-toggle"
        type="button"
        aria-pressed={compared.some((p) => String(p.id) === String(item.id))}
        onClick={() => toggleCompare(item)}
      >
        {compared.some((p) => String(p.id) === String(item.id))
          ? "✓ In comparison"
          : "+ Compare"}
      </button>
      {quick && (
        <Modal
          title={item.name}
          onClose={() => setQuick(false)}
          className="quick-modal"
        >
          <div className="quick-layout">
            <ProductImage product={item} eager />
            <div>
              <p className="eyebrow">{item.brand}</p>
              <ProductOptions key={item.id} product={item} />
              <Link className="text-link" to={productPath(item.id)}>
                View full product details →
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}