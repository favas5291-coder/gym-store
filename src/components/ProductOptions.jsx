import VirtualTryOnButton from "./virtual-try-on/VirtualTryOnButton.jsx";

import {
  useShoppingTools,
} from "../context/ShoppingToolsContext.jsx";

import FitGuide from "./FitGuide.jsx";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

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


// ======================================================
// PRODUCT OPTIONS
// ======================================================

export default function ProductOptions({
  product,
  onAdded,
}) {
  const {
    watches,
    watchProduct,
  } =
    useShoppingTools();


  const {
    addToCart,
    buyNow,
    wishlist,
    toggleWishlist,
  } =
    useStore();


  const navigate =
    useNavigate();


  const [
    guide,
    setGuide,
  ] =
    useState(
      false
    );


  const [
    added,
    setAdded,
  ] =
    useState(
      false
    );


  // ====================================================
  // PRODUCT OPTION LISTS
  // ====================================================

  const sizes =
    useMemo(
      () =>
        Array.isArray(
          product?.sizes
        )
          ? product.sizes
              .map(
                String
              )
              .filter(
                Boolean
              )
          : [],

      [
        product?.sizes,
      ]
    );


  const colors =
    useMemo(
      () =>
        Array.isArray(
          product?.colors
        )
          ? product.colors
              .map(
                String
              )
              .filter(
                Boolean
              )
          : [],

      [
        product?.colors,
      ]
    );


  const hasSizes =
    sizes.length >
    0;


  const hasColors =
    colors.length >
    0;


  // ====================================================
  // INITIAL SELECTION
  // ====================================================

  const initial =
    useMemo(
      () =>
        firstOptions(
          product
        ),

      [
        product,
      ]
    );


  const [
    size,
    setSize,
  ] =
    useState(
      initial.selectedSize
    );


  const [
    color,
    setColor,
  ] =
    useState(
      initial.selectedColor
    );


  const [
    quantity,
    setQuantity,
  ] =
    useState(
      1
    );


  // ====================================================
  // RESET SELECTION WHEN PRODUCT CHANGES
  // ====================================================

  useEffect(
    () => {
      const next =
        firstOptions(
          product
        );


      setSize(
        next.selectedSize
      );


      setColor(
        next.selectedColor
      );


      setQuantity(
        1
      );


      setAdded(
        false
      );
    },

    [
      product?.id,
      product?._id,
      product?.stock,
      product?.stockStatus,
      product?.variants,
    ]
  );


  // ====================================================
  // TOTAL PRODUCT STOCK
  // ====================================================

  const totalStock =
    getTotalStock(
      product
    );


  const available =
    totalStock >
    0;


  // ====================================================
  // SELECTED VARIANT STOCK
  //
  // Colour + Size:
  // variants[colour][size]
  //
  // Colour only:
  // variants[colour].default
  //
  // Size only:
  // variants[size]
  //
  // No options:
  // product.stock
  // ====================================================

  const stock =
    getVariantStock(
      product,
      size,
      color
    );


  // ====================================================
  // WISHLIST
  // ====================================================

  const saved =
    wishlist.some(
      (
        item
      ) =>
        String(
          item.id
        ) ===
        String(
          product.id
        )
    );


  // ====================================================
  // WATCH STATUS
  // ====================================================

  const watching =
    watches.some(
      (
        item
      ) =>
        String(
          item.id
        ) ===
        String(
          product.id
        )
    );


  // ====================================================
  // STOCK FOR ONE COLOUR
  // ====================================================

  function getColorStock(
    nextColor
  ) {
    if (
      !hasColors
    ) {
      return 0;
    }


    // --------------------------------------------
    // COLOUR + SIZE PRODUCT
    // --------------------------------------------

    if (
      hasSizes
    ) {
      return sizes.reduce(
        (
          total,
          nextSize
        ) =>
          total +
          getVariantStock(
            product,
            nextSize,
            nextColor
          ),

        0
      );
    }


    // --------------------------------------------
    // COLOUR ONLY PRODUCT
    // --------------------------------------------

    return getVariantStock(
      product,
      null,
      nextColor
    );
  }


  // ====================================================
  // CHOOSE COLOUR
  // ====================================================

  function chooseColor(
    nextColor
  ) {
    if (
      !colors.includes(
        String(
          nextColor
        )
      )
    ) {
      return;
    }


    const colorStock =
      getColorStock(
        nextColor
      );


    if (
      colorStock <=
      0
    ) {
      return;
    }


    setAdded(
      false
    );


    setColor(
      nextColor
    );


    setQuantity(
      1
    );


    // --------------------------------------------
    // COLOUR + SIZE PRODUCT
    //
    // If the currently selected size does not
    // exist for the new colour, automatically
    // select the first available size.
    // --------------------------------------------

    if (
      hasSizes &&
      getVariantStock(
        product,
        size,
        nextColor
      ) <= 0
    ) {
      const firstAvailableSize =
        sizes.find(
          (
            option
          ) =>
            getVariantStock(
              product,
              option,
              nextColor
            ) >
            0
        );


      setSize(
        firstAvailableSize ||
          sizes[0] ||
          null
      );
    }
  }


  // ====================================================
  // CHOOSE SIZE
  // ====================================================

  function chooseSize(
    nextSize
  ) {
    if (
      !sizes.includes(
        String(
          nextSize
        )
      )
    ) {
      return;
    }


    const optionStock =
      getVariantStock(
        product,
        nextSize,
        color
      );


    if (
      optionStock <=
      0
    ) {
      return;
    }


    setAdded(
      false
    );


    setSize(
      nextSize
    );


    setQuantity(
      1
    );
  }


  // ====================================================
  // QUANTITY
  // ====================================================

  function changeQuantity(
    value
  ) {
    if (
      value ===
      ""
    ) {
      setQuantity(
        ""
      );

      return;
    }


    const next =
      Number(
        value
      );


    if (
      !Number.isFinite(
        next
      )
    ) {
      return;
    }


    const whole =
      Math.floor(
        next
      );


    setQuantity(
      Math.min(
        Math.max(
          1,
          whole
        ),

        Math.max(
          1,
          stock
        )
      )
    );
  }


  function normalizedQuantity() {
    const next =
      Number(
        quantity
      );


    if (
      !Number.isSafeInteger(
        next
      ) ||
      next <
        1
    ) {
      return 1;
    }


    return Math.min(
      next,
      Math.max(
        1,
        stock
      )
    );
  }


  // ====================================================
  // VIRTUAL TRY-ON SELECTION
  // ====================================================

  function handleTryOnSelection({
    color:
      nextColor,
    size:
      nextSize,
  }) {
    let finalColor =
      nextColor ??
      color;


    let finalSize =
      nextSize ??
      size;


    // --------------------------------------------
    // VALIDATE COLOUR
    // --------------------------------------------

    if (
      hasColors
    ) {
      if (
        !colors.includes(
          String(
            finalColor
          )
        ) ||
        getColorStock(
          finalColor
        ) <= 0
      ) {
        finalColor =
          colors.find(
            (
              option
            ) =>
              getColorStock(
                option
              ) >
              0
          ) ||
          colors[0] ||
          null;
      }
    } else {
      finalColor =
        null;
    }


    // --------------------------------------------
    // VALIDATE SIZE
    // --------------------------------------------

    if (
      hasSizes
    ) {
      if (
        !sizes.includes(
          String(
            finalSize
          )
        ) ||
        getVariantStock(
          product,
          finalSize,
          finalColor
        ) <= 0
      ) {
        finalSize =
          sizes.find(
            (
              option
            ) =>
              getVariantStock(
                product,
                option,
                finalColor
              ) >
              0
          ) ||
          sizes[0] ||
          null;
      }
    } else {
      finalSize =
        null;
    }


    setColor(
      finalColor
    );


    setSize(
      finalSize
    );


    setQuantity(
      1
    );


    setAdded(
      false
    );
  }


  // ====================================================
  // ADD TO BAG
  // ====================================================

  function handleAddToCart() {
    if (
      stock <=
      0
    ) {
      return;
    }


    const qty =
      normalizedQuantity();


    const success =
      addToCart(
        product,
        qty,
        size,
        color
      );


    if (
      success
    ) {
      setQuantity(
        qty
      );


      setAdded(
        true
      );


      onAdded?.();
    }
  }


  // ====================================================
  // BUY NOW
  // ====================================================

  function handleBuyNow() {
    if (
      stock <=
      0
    ) {
      return;
    }


    const qty =
      normalizedQuantity();


    const success =
      buyNow(
        product,
        qty,
        size,
        color
      );


    if (
      success
    ) {
      navigate(
        "/checkout?mode=buy-now"
      );
    }
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div
      className="product-options"
    >
      {/* ===============================================
          PRICE
      =============================================== */}

      <div
        className="detail-price"
      >
        <strong>
          {money(
            getDiscountedPrice(
              product
            )
          )}
        </strong>


        {getDiscountPercentage(
          product
        ) >
          0 && (
          <>
            <del>
              MRP{" "}
              {money(
                getOriginalPrice(
                  product
                )
              )}
            </del>

            <span>
              (
              {getDiscountPercentage(
                product
              )}
              % OFF)
            </span>
          </>
        )}
      </div>


      <p
        className="tax-note"
      >
        Price includes applicable taxes
      </p>


      {/* ===============================================
          COLOUR OPTIONS
      =============================================== */}

      {hasColors && (
        <fieldset>
          <legend>
            SELECT COLOUR

            {color && (
              <span>
                {" "}
                {
                  color
                }
              </span>
            )}
          </legend>


          <div
            className="option-list"
          >
            {colors.map(
              (
                option
              ) => {
                const optionStock =
                  getColorStock(
                    option
                  );


                const disabled =
                  optionStock <=
                  0;


                return (
                  <button
                    key={
                      option
                    }
                    type="button"
                    disabled={
                      disabled
                    }
                    aria-disabled={
                      disabled
                    }
                    aria-pressed={
                      String(
                        color
                      ) ===
                      String(
                        option
                      )
                    }
                    title={
                      disabled
                        ? `${option} is out of stock`
                        : `${option} — ${optionStock} available`
                    }
                    onClick={() =>
                      chooseColor(
                        option
                      )
                    }
                  >
                    {
                      option
                    }
                  </button>
                );
              }
            )}
          </div>
        </fieldset>
      )}


      {/* ===============================================
          SIZE OPTIONS
      =============================================== */}

      {hasSizes && (
        <fieldset>
          <legend>
            SELECT SIZE

            {size && (
              <span>
                {" "}
                {
                  size
                }
              </span>
            )}
          </legend>


          <button
            className="text-link fit-guide-link"
            type="button"
            onClick={() =>
              setGuide(
                true
              )
            }
          >
            Size & fit guide
          </button>


          <div
            className="option-list sizes"
          >
            {sizes.map(
              (
                option
              ) => {
                const optionStock =
                  getVariantStock(
                    product,
                    option,
                    color
                  );


                const disabled =
                  optionStock <=
                  0;


                return (
                  <button
                    key={
                      option
                    }
                    type="button"
                    disabled={
                      disabled
                    }
                    aria-disabled={
                      disabled
                    }
                    aria-pressed={
                      String(
                        size
                      ) ===
                      String(
                        option
                      )
                    }
                    title={
                      disabled
                        ? `Size ${option} is out of stock`
                        : `Size ${option} — ${optionStock} available`
                    }
                    onClick={() =>
                      chooseSize(
                        option
                      )
                    }
                  >
                    {
                      option
                    }
                  </button>
                );
              }
            )}
          </div>
        </fieldset>
      )}


      {/* ===============================================
          VIRTUAL TRY ON
      =============================================== */}

      <VirtualTryOnButton
        product={
          product
        }
        color={
          color
        }
        size={
          size
        }
        onSelectionChange={
          handleTryOnSelection
        }
      />


      {/* ===============================================
          QUANTITY + STOCK
      =============================================== */}

      <div
        className="quantity-line"
      >
        <label
          htmlFor={`quantity-${product.id}`}
        >
          Quantity
        </label>


        <input
          id={`quantity-${product.id}`}
          type="number"
          min="1"
          max={
            Math.max(
              1,
              stock
            )
          }
          step="1"
          disabled={
            stock <=
            0
          }
          value={
            quantity
          }
          onChange={
            (
              event
            ) =>
              changeQuantity(
                event.target
                  .value
              )
          }
          onBlur={() => {
            if (
              quantity ===
                "" ||
              Number(
                quantity
              ) <
                1
            ) {
              setQuantity(
                1
              );
            }
          }}
        />


        <span>
          {!available
            ? "Out of stock"
            : stock >
                0
              ? `${stock} available`
              : "This selection is unavailable"}
        </span>
      </div>


      {/* ===============================================
          PURCHASE ACTIONS
      =============================================== */}

      <div
        className="purchase-actions"
      >
        <button
          type="button"
          className="button"
          disabled={
            stock <=
            0
          }
          onClick={
            handleAddToCart
          }
        >
          {!available
            ? "Out of stock"
            : stock >
                0
              ? "Add to bag"
              : "Unavailable"}
        </button>


        <button
          type="button"
          className={`button secondary ${
            saved
              ? "saved"
              : ""
          }`}
          aria-pressed={
            saved
          }
          onClick={() =>
            toggleWishlist(
              product
            )
          }
        >
          <Heart
            filled={
              saved
            }
          />

          {saved
            ? "Wishlisted"
            : "Wishlist"}
        </button>
      </div>


      {/* ===============================================
          ADDED FEEDBACK
      =============================================== */}

      {added && (
        <div
          className="purchase-feedback"
          role="status"
        >
          <span>
            ✓ Added to your bag
          </span>

          <Link
            to="/cart"
          >
            View bag & checkout →
          </Link>
        </div>
      )}


      {/* ===============================================
          BUY NOW
      =============================================== */}

      {stock >
        0 && (
        <button
          type="button"
          className="button secondary full buy-now"
          onClick={
            handleBuyNow
          }
        >
          Buy now
        </button>
      )}


      {/* ===============================================
          PRICE / STOCK WATCH
      =============================================== */}

      <button
        className="text-link watch-button"
        type="button"
        aria-pressed={
          watching
        }
        onClick={() =>
          watchProduct(
            product
          )
        }
      >
        {watching
          ? "Watching this product ✓"
          : "Watch price & availability"}
      </button>


      {/* ===============================================
          FIT GUIDE
      =============================================== */}

      {guide && (
        <FitGuide
          product={
            product
          }
          color={
            color
          }
          onSelectSize={
            (
              next
            ) => {
              const optionStock =
                getVariantStock(
                  product,
                  next,
                  color
                );


              if (
                optionStock >
                0
              ) {
                setSize(
                  next
                );

                setQuantity(
                  1
                );

                setAdded(
                  false
                );
              }


              setGuide(
                false
              );
            }
          }
          onClose={() =>
            setGuide(
              false
            )
          }
        />
      )}
    </div>
  );
}