import { useState } from "react";
import { Link } from "react-router-dom";

import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
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


// ======================================================
// PRODUCT CARD
// ======================================================

export default function ProductCard({
  product,
  ...legacy
}) {
  const item =
    product ||
    legacy;


  const {
    compared,
    toggleCompare,
  } =
    useShoppingTools();


  const {
    wishlist,
    toggleWishlist,
  } =
    useStore();


  const [
    quick,
    setQuick,
  ] =
    useState(
      false
    );


  // ====================================================
  // PRODUCT STATE
  // ====================================================

  const saved =
    wishlist.some(
      (
        entry
      ) =>
        String(
          entry.id
        ) ===
        String(
          item.id
        )
    );


  const isCompared =
    compared.some(
      (
        entry
      ) =>
        String(
          entry.id
        ) ===
        String(
          item.id
        )
    );


  const available =
    inStock(
      item
    );


  // ====================================================
  // PRICE
  // ====================================================

  const price =
    priceDetails(
      item
    );


  // ====================================================
  // REVIEWS
  // ====================================================

  const {
    rating,
    count,
  } =
    useProductReviews(
      item
    );


  // ====================================================
  // SECOND IMAGE
  // ====================================================

  const alternateImage =
    Array.isArray(
      item.images
    )
      ? item.images.find(
          (
            src
          ) =>
            src &&
            src !==
              item.image
        )
      : null;


  // ====================================================
  // PRODUCT LINK
  // ====================================================

  const path =
    productPath(
      item.id
    );


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <article className="gm-product-card">
      {/* =================================================
          PRODUCT VISUAL
      ================================================= */}

      <div className="gm-product-visual">
        <Link
          className="gm-product-image"
          to={
            path
          }
          aria-label={`View ${item.name}`}
        >
          <ProductImage
            product={
              item
            }
          />


          {alternateImage && (
            <ProductImage
              className="alternate-photo"
              product={{
                ...item,

                image:
                  alternateImage,
              }}
              decorative
            />
          )}
        </Link>


        {/* ===============================================
            BADGE
        =============================================== */}

        {item.badge && (
          <span className="gm-product-badge">
            {item.badge}
          </span>
        )}


        {/* ===============================================
            WISHLIST
        =============================================== */}

        <button
          type="button"
          className={`card-heart ${
            saved
              ? "saved"
              : ""
          }`}
          aria-label={`${
            saved
              ? "Remove"
              : "Save"
          } ${item.name} ${
            saved
              ? "from"
              : "to"
          } wishlist`}
          aria-pressed={
            saved
          }
          onClick={() =>
            toggleWishlist(
              item
            )
          }
        >
          <Heart
            filled={
              saved
            }
          />
        </button>


        {/* ===============================================
            REAL REVIEW SCORE
        =============================================== */}

        {count >
          0 && (
          <span
            className="gm-rating"
            aria-label={`${rating} out of 5 from ${count} reviews`}
          >
            {rating}

            <span aria-hidden="true">
              ★
            </span>

            <i />

            {count}
          </span>
        )}


        {/* ===============================================
            STOCK
        =============================================== */}

        {!available && (
          <span className="gm-stock-label">
            OUT OF STOCK
          </span>
        )}


        {/* ===============================================
            PRIMARY CARD ACTION
        =============================================== */}

        <div className="gm-card-action">
          {available ? (
            <button
              type="button"
              aria-label={`Quick add ${item.name}`}
              onClick={() =>
                setQuick(
                  true
                )
              }
            >
              QUICK ADD
            </button>
          ) : (
            <Link
              to={
                path
              }
            >
              VIEW PRODUCT
            </Link>
          )}
        </div>
      </div>


      {/* =================================================
          PRODUCT INFORMATION
      ================================================= */}

      <div className="gm-product-copy">
        <Link
          to={
            path
          }
          className="gm-product-info-link"
        >
          <p className="gm-product-brand">
            {item.brand ||
              "GymDrobe"}
          </p>


          <h3>
            {item.name}
          </h3>
        </Link>


        {/* ===============================================
            PRICE
        =============================================== */}

        <p className="gm-product-price">
          <strong>
            {money(
              price.selling
            )}
          </strong>


          {price.discount >
            0 && (
            <>
              <del>
                {money(
                  price.price
                )}
              </del>


              <span>
                {price.discount}% OFF
              </span>
            </>
          )}
        </p>


        {/* ===============================================
            SOCIAL PROOF
        =============================================== */}

        {count >
          0 && (
          <p className="gm-product-proof">
            <span aria-hidden="true">
              ★
            </span>{" "}

            <strong>
              {rating}
            </strong>

            {" "}

            <span>
              ({count}{" "}
              {count ===
              1
                ? "review"
                : "reviews"})
            </span>
          </p>
        )}


        {/* ===============================================
            STOCK MESSAGE
        =============================================== */}

        <p
          className={`gm-product-availability ${
            available
              ? "available"
              : "unavailable"
          }`}
        >
          {available
            ? "In stock"
            : "Currently unavailable"}
        </p>


        {/* ===============================================
            STRONG PRODUCT CTA
        =============================================== */}

        <div className="gm-product-card-cta">
          {available ? (
            <button
              type="button"
              className="button full"
              onClick={() =>
                setQuick(
                  true
                )
              }
            >
              Quick add
            </button>
          ) : (
            <Link
              className="button full"
              to={
                path
              }
            >
              View product
            </Link>
          )}


          <Link
            className="text-link"
            to={
              path
            }
          >
            View details →
          </Link>
        </div>


        {/* ===============================================
            COMPARE — TERTIARY ACTION
        =============================================== */}

        <button
          className="compare-toggle"
          type="button"
          aria-pressed={
            isCompared
          }
          onClick={() =>
            toggleCompare(
              item
            )
          }
        >
          {isCompared
            ? "✓ Added to comparison"
            : "+ Compare"}
        </button>
      </div>


      {/* =================================================
          QUICK ADD MODAL
      ================================================= */}

      {quick && (
        <Modal
          title={
            item.name
          }
          onClose={() =>
            setQuick(
              false
            )
          }
          className="quick-modal"
        >
          <div className="quick-layout">
            <ProductImage
              product={
                item
              }
              eager
            />


            <div>
              <p className="eyebrow">
                {item.brand ||
                  "GymDrobe"}
              </p>


              {count >
                0 && (
                <p className="gm-product-proof">
                  <strong>
                    {rating} ★
                  </strong>

                  {" "}

                  <span>
                    {count}{" "}
                    {count ===
                    1
                      ? "review"
                      : "reviews"}
                  </span>
                </p>
              )}


              <ProductOptions
                key={
                  item.id
                }
                product={
                  item
                }
                onAdded={() =>
                  setQuick(
                    false
                  )
                }
              />


              <Link
                className="text-link"
                to={
                  path
                }
                onClick={() =>
                  setQuick(
                    false
                  )
                }
              >
                View full product details →
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}