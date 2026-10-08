import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useCatalog } from "../context/CatalogContext.jsx";

import CollectionBrowser from "./CollectionBrowser.jsx";
import RecentlyViewed from "./RecentlyViewed.jsx";
import ProductRow from "./ProductRow.jsx";

import {
  inStock,
  ProductImage,
  productPath,
  priceDetails,
  Arrow,
} from "./StorefrontShared.jsx";

function productId(product) {
  return String(product?.id ?? product?._id ?? "");
}

export default function HomeProductSections() {
  const { products } = useCatalog();

  const {
    bestSellers,
    trending,
    offers,
    newProducts,
    recommended,
  } = useMemo(() => {
    const available = [];
    const bestSellers = [];
    const trending = [];
    const newProducts = [];
    const discounted = [];
    const seen = new Set();

    for (const product of Array.isArray(products) ? products : []) {
      const id = productId(product);

      if (
        !product ||
        !id ||
        !product.name ||
        seen.has(id) ||
        !inStock(product)
      ) {
        continue;
      }

      seen.add(id);
      available.push(product);

      if (product.isBestSeller) bestSellers.push(product);
      if (product.isFeatured) trending.push(product);
      if (product.isNew) newProducts.push(product);

      const pricing = priceDetails(product);

      if (pricing.valid && pricing.discount > 0) {
        discounted.push({ product, pricing });
      }
    }

    discounted.sort(
      (a, b) => b.pricing.discount - a.pricing.discount,
    );

    // Preserve the existing recommendation priority.
    // Stop once ten unique products have been selected.
    const recommended = [];
    const recommendedIds = new Set();

    for (const group of [
      bestSellers,
      trending,
      newProducts,
      available,
    ]) {
      for (const product of group) {
        const id = productId(product);

        if (recommendedIds.has(id)) continue;

        recommendedIds.add(id);
        recommended.push(product);

        if (recommended.length === 10) break;
      }

      if (recommended.length === 10) break;
    }

    return {
      bestSellers,
      trending,
      offers: discounted.slice(0, 6),
      newProducts,
      recommended,
    };
  }, [products]);

  return (
    <>
      {bestSellers.length > 0 && (
        <ProductRow
          title="BEST SELLERS"
          products={bestSellers}
          to="/shop?collection=bestsellers"
        />
      )}

      {trending.length > 0 && (
        <ProductRow
          title="TRENDING NOW"
          id="featured"
          products={trending}
          to="/shop?collection=featured"
        />
      )}

      {offers.length > 0 && (
        <section className="gm-section">
          <div className="gm-section-head">
            <div>
              <p className="eyebrow">REAL CURRENT OFFERS</p>
              <h2>DEALS WORTH ADDING TO YOUR BAG</h2>
            </div>

            <Link to="/shop?discount=1">
              EXPLORE ALL <Arrow />
            </Link>
          </div>

          <div
            className="gm-deal-grid"
            style={{ "--gm-deal-count": offers.length }}
          >
            {offers.map(({ product, pricing }) => (
              <Link
                key={productId(product)}
                className="gm-deal-card"
                to={productPath(productId(product))}
              >
                <ProductImage product={product} decorative />

                <div>
                  <small>{product.brand || "GymDrobe"}</small>
                  <h3>{product.name}</h3>
                  <strong>{pricing.discount}% OFF</strong>
                  <span>
                    SHOP NOW <Arrow />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <CollectionBrowser />

      <section
        className="gm-section gm-why-gymdrobe"
        aria-labelledby="why-gymdrobe-title"
      >
        <div className="gm-section-head">
          <div>
            <p className="eyebrow">SHOP WITH CLARITY</p>
            <h2 id="why-gymdrobe-title">WHY GYMDROBE</h2>
          </div>
        </div>

        <div className="gm-why-grid">
          <article className="gm-why-card">
            <strong>Fitness-focused shopping</strong>
            <p>
              Discover workout clothing, footwear and gym essentials
              in one focused store.
            </p>
          </article>

          <article className="gm-why-card">
            <strong>Real product information</strong>
            <p>
              See available variants, stock, pricing, discounts and
              product details before you buy.
            </p>
          </article>

          <article className="gm-why-card">
            <strong>Secure payment</strong>
            <p>
              Choose full online payment or COD with a 10% online
              advance through Razorpay.
            </p>
          </article>

          <article className="gm-why-card">
            <strong>Clear order journey</strong>
            <p>
              Review your delivery address, payment choice and final
              order total before payment.
            </p>
          </article>
        </div>
      </section>

      <div className="gm-edit-banner">
        <div>
          <p>THE GYMDROBE ESSENTIALS EDIT</p>
          <h2>GOOD GEAR. GREAT SESSIONS.</h2>
          <span>
            Build your workout wardrobe with gear that fits your routine.
          </span>
        </div>

        <Link to="/shop">
          EXPLORE THE COLLECTION <Arrow />
        </Link>
      </div>

      {newProducts.length > 0 && (
        <ProductRow
          title="NEW ARRIVALS"
          products={newProducts}
          to="/shop?collection=new"
        />
      )}

      {recommended.length > 0 && (
        <ProductRow
          title="WORKOUT PICKS TO EXPLORE"
          products={recommended}
          to="/shop"
        />
      )}

      <RecentlyViewed />
    </>
  );
}