import {
  useMemo,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

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


// ======================================================
// HELPERS
// ======================================================

function uniqueProducts(
  products
) {
  const seen =
    new Set();


  return products.filter(
    (
      product
    ) => {
      const key =
        String(
          product?.id ??
            product?._id ??
            ""
        );


      if (
        !key ||
        seen.has(
          key
        )
      ) {
        return false;
      }


      seen.add(
        key
      );


      return true;
    }
  );
}


// ======================================================
// HOME PRODUCT SECTIONS
// ======================================================

export default function HomeProductSections() {
  const {
    products,
  } =
    useCatalog();


  // ====================================================
  // REAL AVAILABLE PRODUCTS
  // ====================================================

  const available =
    useMemo(
      () =>
        Array.isArray(
          products
        )
          ? products.filter(
              inStock
            )
          : [],

      [
        products,
      ]
    );


  // ====================================================
  // BEST SELLERS
  // ====================================================

  const bestSellers =
    useMemo(
      () =>
        available.filter(
          (
            product
          ) =>
            Boolean(
              product.isBestSeller
            )
        ),

      [
        available,
      ]
    );


  // ====================================================
  // TRENDING
  // ====================================================

  const trending =
    useMemo(
      () =>
        available.filter(
          (
            product
          ) =>
            Boolean(
              product.isFeatured
            )
        ),

      [
        available,
      ]
    );


  // ====================================================
  // REAL DISCOUNTED PRODUCTS
  // ====================================================

  const offers =
    useMemo(
      () =>
        available
          .filter(
            (
              product
            ) =>
              priceDetails(
                product
              ).discount >
              0
          )
          .sort(
            (
              a,
              b
            ) =>
              priceDetails(
                b
              ).discount -
              priceDetails(
                a
              ).discount
          ),

      [
        available,
      ]
    );


  // ====================================================
  // NEW PRODUCTS
  // ====================================================

  const newProducts =
    useMemo(
      () =>
        available.filter(
          (
            product
          ) =>
            Boolean(
              product.isNew
            )
        ),

      [
        available,
      ]
    );


  // ====================================================
  // RECOMMENDED WORKOUT PICKS
  //
  // Uses real catalogue flags only.
  // No fake personalization claim.
  // ====================================================

  const recommended =
    useMemo(
      () => {
        const candidates =
          uniqueProducts([
            ...bestSellers,
            ...trending,
            ...newProducts,
            ...available,
          ]);


        return candidates.slice(
          0,
          10
        );
      },

      [
        available,
        bestSellers,
        trending,
        newProducts,
      ]
    );


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <>
      {/* ===============================================
          1. BEST SELLERS
      =============================================== */}

      {bestSellers.length >
        0 && (
        <ProductRow
          title="BEST SELLERS"
          products={
            bestSellers
          }
          to="/shop?collection=bestsellers"
        />
      )}


      {/* ===============================================
          2. TRENDING
      =============================================== */}

      {trending.length >
        0 && (
        <ProductRow
          title="TRENDING NOW"
          id="featured"
          products={
            trending
          }
          to="/shop?collection=featured"
        />
      )}


      {/* ===============================================
          3. REAL DEALS
      =============================================== */}

      {offers.length >
        0 && (
        <section className="gm-section">
          <div className="gm-section-head">
            <div>
              <p className="eyebrow">
                REAL CURRENT OFFERS
              </p>


              <h2>
                DEALS WORTH ADDING TO YOUR BAG
              </h2>
            </div>


            <Link to="/shop?discount=1">
              EXPLORE ALL{" "}

              <Arrow />
            </Link>
          </div>


          <div
            className="gm-deal-grid"
            style={{
              "--gm-deal-count":
                Math.min(
                  offers.length,
                  6
                ),
            }}
          >
            {offers
              .slice(
                0,
                6
              )
              .map(
                (
                  product
                ) => {
                  const price =
                    priceDetails(
                      product
                    );


                  return (
                    <Link
                      key={
                        product.id
                      }
                      className="gm-deal-card"
                      to={productPath(
                        product.id
                      )}
                    >
                      <ProductImage
                        product={
                          product
                        }
                        decorative
                      />


                      <div>
                        <small>
                          {product.brand ||
                            "GymDrobe"}
                        </small>


                        <h3>
                          {product.name}
                        </h3>


                        <strong>
                          {price.discount}% OFF
                        </strong>


                        <span>
                          SHOP NOW{" "}

                          <Arrow />
                        </span>
                      </div>
                    </Link>
                  );
                }
              )}
          </div>
        </section>
      )}


      {/* ===============================================
          4. COLLECTION DISCOVERY
      =============================================== */}

      <CollectionBrowser />


      {/* ===============================================
          5. WHY GYMDROBE
      =============================================== */}

      <section
        className="gm-section gm-why-gymdrobe"
        aria-labelledby="why-gymdrobe-title"
      >
        <div className="gm-section-head">
          <div>
            <p className="eyebrow">
              SHOP WITH CLARITY
            </p>


            <h2 id="why-gymdrobe-title">
              WHY GYMDROBE
            </h2>
          </div>
        </div>


        <div className="gm-why-grid">
          <article className="gm-why-card">
            <strong>
              Fitness-focused shopping
            </strong>


            <p>
              Discover workout clothing, footwear and gym essentials in one focused store.
            </p>
          </article>


          <article className="gm-why-card">
            <strong>
              Real product information
            </strong>


            <p>
              See available variants, stock, pricing, discounts and product details before you buy.
            </p>
          </article>


          <article className="gm-why-card">
            <strong>
              Secure payment
            </strong>


            <p>
              Choose full online payment or COD with a 10% online advance through Razorpay.
            </p>
          </article>


          <article className="gm-why-card">
            <strong>
              Clear order journey
            </strong>


            <p>
              Review your delivery address, payment choice and final order total before payment.
            </p>
          </article>
        </div>
      </section>


      {/* ===============================================
          6. BRAND / COLLECTION CTA
      =============================================== */}

      <div className="gm-edit-banner">
        <div>
          <p>
            THE GYMDROBE ESSENTIALS EDIT
          </p>


          <h2>
            GOOD GEAR.
            GREAT SESSIONS.
          </h2>


          <span>
            Build your workout wardrobe with gear that fits your routine.
          </span>
        </div>


        <Link to="/shop">
          EXPLORE THE COLLECTION{" "}

          <Arrow />
        </Link>
      </div>


      {/* ===============================================
          7. NEW ARRIVALS
      =============================================== */}

      {newProducts.length >
        0 && (
        <ProductRow
          title="NEW ARRIVALS"
          products={
            newProducts
          }
          to="/shop?collection=new"
        />
      )}


      {/* ===============================================
          8. RECOMMENDED PRODUCT DISCOVERY
      =============================================== */}

      {recommended.length >
        0 && (
        <ProductRow
          title="WORKOUT PICKS TO EXPLORE"
          products={
            recommended
          }
          to="/shop"
        />
      )}


      {/* ===============================================
          9. RECENTLY VIEWED
      =============================================== */}

      <RecentlyViewed />
    </>
  );
}