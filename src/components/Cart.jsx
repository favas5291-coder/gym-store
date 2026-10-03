import {
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import BagVariantEditor from "./BagVariantEditor.jsx";

import {
  ProductImage,
} from "./StorefrontShared.jsx";

import PriceSummary from "./PriceSummary.jsx";

import {
  getCartItemKey,
  getVariantStock,
} from "../utils/cartUtils.js";

import {
  calculateOrderPricing,
} from "../utils/orderCalculations.js";

import {
  money,
} from "../utils/productPricing.js";


// ======================================================
// CART
// ======================================================

export default function Cart() {
  const {
    products,
  } =
    useCatalog();


  const {
    cart,
    updateQuantity,
    removeFromCart,
    wishlist,
    toggleWishlist,
    coupon,
  } =
    useStore();


  const [
    editing,
    setEditing,
  ] =
    useState(
      null
    );


  // ====================================================
  // CART ROWS
  // ====================================================

  const rows =
    useMemo(
      () =>
        cart.map(
          (
            item
          ) => {
            const product =
              products.find(
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


            const quantity =
              Number(
                item.quantity ||
                  0
              );


            const sellingUnit =
              Number(
                item.price ||
                  0
              );


            const originalUnit =
              Math.max(
                sellingUnit,

                Number(
                  item.originalPrice ??
                    product?.originalPrice ??
                    product?.price ??
                    sellingUnit
                )
              );


            return {
              ...item,

              product,

              lineTotal:
                sellingUnit *
                quantity,

              originalLineTotal:
                originalUnit *
                quantity,

              lineSavings:
                Math.max(
                  0,

                  originalUnit *
                    quantity -
                    sellingUnit *
                    quantity
                ),
            };
          }
        ),

      [
        cart,
        products,
      ]
    );


  // ====================================================
  // ITEM COUNT
  // ====================================================

  const itemCount =
    rows.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.quantity ||
            0
        ),

      0
    );


  // ====================================================
  // CURRENT PRICING
  // ====================================================

  const pricing =
    useMemo(
      () =>
        calculateOrderPricing({
          cart,

          coupon:
            coupon ||
            null,

          deliveryMethod:
            "standard",
        }),

      [
        cart,
        coupon,
      ]
    );


  // ====================================================
  // REAL TOTAL SAVINGS
  // ====================================================

  const productSavings =
    rows.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.lineSavings ||
            0
        ),

      0
    );


  const couponSavings =
    Math.max(
      0,

      Number(
        pricing
          ?.couponDiscount ||
          0
      )
    );


  const totalSavings =
    Math.max(
      0,

      productSavings +
        couponSavings
    );


  // ====================================================
  // INVALID / OUT-OF-STOCK ITEMS
  // ====================================================

  const hasUnavailableItems =
    rows.some(
      (
        item
      ) => {
        if (
          !item.product
        ) {
          return true;
        }


        const stock =
          getVariantStock(
            item.product,
            item.selectedSize,
            item.selectedColor
          );


        return (
          stock <
          Number(
            item.quantity ||
              0
          )
        );
      }
    );


  // ====================================================
  // MOVE TO WISHLIST
  // ====================================================

  function moveToWishlist(
    item
  ) {
    if (
      !item.product
    ) {
      return;
    }


    const saved =
      wishlist.some(
        (
          product
        ) =>
          String(
            product.id
          ) ===
          String(
            item.product.id
          )
      );


    if (
      !saved
    ) {
      toggleWishlist(
        item.product
      );
    }


    removeFromCart(
      getCartItemKey(
        item
      )
    );
  }


  // ====================================================
  // EMPTY CART
  // ====================================================

  if (
    !rows.length
  ) {
    return (
      <div className="page narrow">
        <div className="empty-state">
          <h1>
            Your bag is empty
          </h1>


          <p>
            Pick your workout essentials and come back when you're ready to check out.
          </p>


          <Link
            className="button"
            to="/shop"
          >
            Shop GymDrobe
          </Link>
        </div>
      </div>
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="page cart-page">
      {/* =================================================
          HEADING
      ================================================= */}

      <div className="page-heading">
        <div>
          <h1>
            Shopping bag
          </h1>


          <p className="muted">
            {itemCount}{" "}
            {itemCount ===
            1
              ? "item"
              : "items"}{" "}
            in your bag
          </p>
        </div>


        <Link
          className="text-link"
          to="/shop"
        >
          Continue shopping →
        </Link>
      </div>


      {/* =================================================
          CART LAYOUT
      ================================================= */}

      <div className="cart-layout">
        {/* ===============================================
            ITEMS
        =============================================== */}

        <div className="cart-items">
          {rows.map(
            (
              item
            ) => {
              const product =
                item.product;


              const key =
                getCartItemKey(
                  item
                );


              if (
                !product
              ) {
                return (
                  <article
                    key={
                      key
                    }
                    className="cart-row"
                  >
                    <div className="cart-copy">
                      <h2>
                        Product unavailable
                      </h2>


                      <p className="field-error">
                        This product is no longer available in the current catalog.
                      </p>


                      <button
                        type="button"
                        className="text-link danger"
                        onClick={() =>
                          removeFromCart(
                            key
                          )
                        }
                      >
                        Remove from bag
                      </button>
                    </div>
                  </article>
                );
              }


              const stock =
                getVariantStock(
                  product,
                  item.selectedSize,
                  item.selectedColor
                );


              const requestedQuantity =
                Number(
                  item.quantity ||
                    0
                );


              const enoughStock =
                stock >=
                requestedQuantity;


              const productSaved =
                wishlist.some(
                  (
                    entry
                  ) =>
                    String(
                      entry.id
                    ) ===
                    String(
                      product.id
                    )
                );


              const deliveryEstimate =
                String(
                  product.delivery
                    ?.estimatedDays ||
                    ""
                ).trim();


              const maxQuantity =
                Math.max(
                  1,

                  Math.min(
                    10,
                    stock
                  )
                );


              return (
                <article
                  key={
                    key
                  }
                  className="cart-row"
                >
                  {/* =====================================
                      IMAGE
                  ===================================== */}

                  <Link
                    to={`/product/${encodeURIComponent(
                      item.id
                    )}`}
                    className="cart-thumb"
                    aria-label={`View ${product.name}`}
                  >
                    <ProductImage
                      product={
                        product
                      }
                    />
                  </Link>


                  {/* =====================================
                      PRODUCT INFO
                  ===================================== */}

                  <div className="cart-copy">
                    <div className="cart-head">
                      <div>
                        <p className="eyebrow">
                          {product.brand ||
                            "GymDrobe"}
                        </p>


                        <Link
                          to={`/product/${encodeURIComponent(
                            item.id
                          )}`}
                        >
                          <h2>
                            {product.name}
                          </h2>
                        </Link>
                      </div>


                      <div className="cart-price">
                        <strong>
                          {money(
                            item.lineTotal
                          )}
                        </strong>


                        {item.lineSavings >
                          0 && (
                          <del className="muted">
                            {money(
                              item.originalLineTotal
                            )}
                          </del>
                        )}
                      </div>
                    </div>


                    {/* ===================================
                        VARIANT
                    =================================== */}

                    <p className="muted">
                      {item.selectedColor &&
                      item.selectedSize
                        ? `${item.selectedColor} / ${item.selectedSize}`

                        : item.selectedColor ||
                          item.selectedSize ||
                          "Standard option"}
                    </p>


                    {/* ===================================
                        REAL SAVINGS
                    =================================== */}

                    {item.lineSavings >
                      0 && (
                      <p className="positive">
                        You save{" "}
                        {money(
                          item.lineSavings
                        )}{" "}
                        on this item
                      </p>
                    )}


                    {/* ===================================
                        DELIVERY
                    =================================== */}

                    {deliveryEstimate && (
                      <p className="muted">
                        Estimated delivery:{" "}
                        <strong>
                          {deliveryEstimate}
                        </strong>
                      </p>
                    )}


                    {/* ===================================
                        STOCK
                    =================================== */}

                    {stock >
                      0 &&
                      stock <=
                        5 && (
                      <p className="muted">
                        Only {stock} left for this selection
                      </p>
                    )}


                    {/* ===================================
                        CONTROLS
                    =================================== */}

                    <div className="cart-controls">
                      <label>
                        Qty


                        <select
                          value={
                            item.quantity
                          }
                          disabled={
                            stock <=
                            0
                          }
                          onChange={(
                            event
                          ) =>
                            updateQuantity(
                              key,

                              Number(
                                event.target
                                  .value
                              )
                            )
                          }
                        >
                          {Array.from(
                            {
                              length:
                                maxQuantity,
                            },

                            (
                              _,
                              index
                            ) =>
                              index +
                              1
                          ).map(
                            (
                              quantity
                            ) => (
                              <option
                                key={
                                  quantity
                                }
                                value={
                                  quantity
                                }
                              >
                                {quantity}
                              </option>
                            )
                          )}
                        </select>
                      </label>


                      <button
                        type="button"
                        className="text-link"
                        onClick={() =>
                          setEditing(
                            item
                          )
                        }
                      >
                        Edit options
                      </button>


                      <button
                        type="button"
                        className="text-link"
                        onClick={() =>
                          moveToWishlist(
                            item
                          )
                        }
                      >
                        {productSaved
                          ? "Move to wishlist"
                          : "Save for later"}
                      </button>


                      <button
                        type="button"
                        className="text-link danger"
                        onClick={() =>
                          removeFromCart(
                            key
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>


                    {/* ===================================
                        INVALID STOCK
                    =================================== */}

                    {!enoughStock && (
                      <p
                        className="field-error"
                        role="alert"
                      >
                        {stock <=
                        0
                          ? "This variant is currently out of stock."
                          : `Only ${stock} available. Reduce the quantity before checkout.`}
                      </p>
                    )}
                  </div>
                </article>
              );
            }
          )}
        </div>


        {/* ===============================================
            ORDER SUMMARY
        =============================================== */}

        <aside className="cart-summary">
          <PriceSummary
            cart={
              cart
            }
            coupon={
              coupon
            }
          />


          {/* =============================================
              REAL SAVINGS MESSAGE
          ============================================= */}

          {totalSavings >
            0 && (
            <div
              className="notice"
              role="status"
            >
              <strong>
                You saved{" "}
                {money(
                  totalSavings
                )}{" "}
                on this order
              </strong>


              {couponSavings >
                0 && (
                <p className="muted">
                  Includes{" "}
                  {money(
                    couponSavings
                  )}{" "}
                  coupon savings.
                </p>
              )}
            </div>
          )}


          {/* =============================================
              TRUST
          ============================================= */}

          <div className="panel cart-trust">
            <p>
              <strong>
                Secure checkout
              </strong>
            </p>


            <p className="muted">
              Product availability and pricing are checked again before your order is placed.
            </p>
          </div>


          {/* =============================================
              CHECKOUT CTA
          ============================================= */}

          {hasUnavailableItems ? (
            <>
              <button
                type="button"
                className="button full"
                disabled
              >
                Check unavailable items
              </button>


              <p
                className="field-error"
                role="alert"
              >
                Update the unavailable products before continuing to checkout.
              </p>
            </>
          ) : (
            <Link
              className="button full"
              to="/checkout"
            >
              Proceed to checkout
            </Link>
          )}


          <Link
            className="text-link"
            to="/shop"
          >
            Continue shopping
          </Link>
        </aside>
      </div>


      {/* =================================================
          VARIANT EDITOR
      ================================================= */}

      {editing && (
        <BagVariantEditor
          item={
            editing
          }
          onClose={() =>
            setEditing(
              null
            )
          }
        />
      )}
    </div>
  );
}