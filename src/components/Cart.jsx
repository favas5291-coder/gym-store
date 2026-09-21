import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  calculateOrderPricing,
  COUPONS,
  FREE_SHIPPING_LIMIT,
} from "../utils/orderCalculations";

function Cart({ cart, setCart }) {
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");

  // ==========================================
  // GET STOCK FOR A CART ITEM
  // ==========================================

  function getItemStock(item) {
    // Product with size + color
    if (
      item.variants &&
      item.selectedColor &&
      item.selectedSize
    ) {
      return (
        item.variants?.[
          item.selectedColor
        ]?.[item.selectedSize] ?? 0
      );
    }

    // Product with color only
    if (
      item.variants &&
      item.selectedColor
    ) {
      return (
        item.variants?.[
          item.selectedColor
        ]?.default ?? 0
      );
    }

    // Normal product without variants
    return item.stock ?? 0;
  }

  // ==========================================
  // CHECK WHETHER TWO CART ITEMS ARE SAME
  // ==========================================

  function isSameVariant(
    item,
    id,
    size,
    color
  ) {
    return (
      item.id === id &&
      item.selectedSize === size &&
      item.selectedColor === color
    );
  }

  // ==========================================
  // REMOVE ITEM
  // ==========================================

  function removeItem(itemToRemove) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          !isSameVariant(
            item,
            itemToRemove.id,
            itemToRemove.selectedSize,
            itemToRemove.selectedColor
          )
      )
    );
  }

  // ==========================================
  // DECREASE QUANTITY
  // ==========================================

  function decreaseQuantity(itemToDecrease) {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (
            isSameVariant(
              item,
              itemToDecrease.id,
              itemToDecrease.selectedSize,
              itemToDecrease.selectedColor
            )
          ) {
            return {
              ...item,
              quantity: item.quantity - 1,
            };
          }

          return item;
        })
        .filter(
          (item) => item.quantity > 0
        )
    );
  }

  // ==========================================
  // INCREASE QUANTITY
  // ==========================================

  function increaseQuantity(itemToIncrease) {
    const stock =
      getItemStock(itemToIncrease);

    setCart((currentCart) =>
      currentCart.map((item) => {
        if (
          isSameVariant(
            item,
            itemToIncrease.id,
            itemToIncrease.selectedSize,
            itemToIncrease.selectedColor
          )
        ) {
          if (item.quantity >= stock) {
            return item;
          }

          return {
            ...item,
            quantity: item.quantity + 1,
          };
        }

        return item;
      })
    );
  }

  // ==========================================
  // LOAD SAVED COUPON
  // ==========================================

  useEffect(() => {
    const savedCoupon =
      localStorage.getItem(
        "gymdrobe-coupon"
      );

    if (!savedCoupon) {
      return;
    }

    try {
      const savedCouponData =
        JSON.parse(savedCoupon);

      const coupon =
        savedCouponData?.code
          ? COUPONS[
              savedCouponData.code
            ]
          : null;

      if (coupon) {
        setAppliedCoupon(coupon);
        setCouponCode(coupon.code);
      } else {
        localStorage.removeItem(
          "gymdrobe-coupon"
        );
      }
    } catch (error) {
      localStorage.removeItem(
        "gymdrobe-coupon"
      );
    }
  }, []);

  // ==========================================
  // ORDER PRICING
  // ==========================================

  const {
    subtotal,
    couponDiscount,
    totalAfterCoupon,
    shipping: standardShipping,
    finalTotal,
  } = calculateOrderPricing({
    cart,
    coupon: appliedCoupon,
    deliveryMethod: "standard",
  });

  // ==========================================
  // APPLY COUPON
  // ==========================================

  function applyCoupon() {
    const code =
      couponCode.trim().toUpperCase();

    const coupon = COUPONS[code];

    // Invalid coupon
    if (!coupon) {
      setCouponMessage(
        "❌ Invalid coupon code."
      );

      setAppliedCoupon(null);

      localStorage.removeItem(
        "gymdrobe-coupon"
      );

      return;
    }

    // Minimum order check
    if (subtotal < coupon.minimum) {
      setCouponMessage(
        `❌ Minimum order value is ₹${coupon.minimum.toLocaleString(
          "en-IN"
        )}.`
      );

      setAppliedCoupon(null);

      localStorage.removeItem(
        "gymdrobe-coupon"
      );

      return;
    }

    // Apply coupon
    setAppliedCoupon(coupon);

    localStorage.setItem(
      "gymdrobe-coupon",
      JSON.stringify(coupon)
    );

    setCouponMessage(
      `✅ Coupon ${coupon.code} applied!`
    );
  }

  // ==========================================
  // REMOVE COUPON
  // ==========================================

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");

    setCouponMessage(
      "Coupon removed."
    );

    localStorage.removeItem(
      "gymdrobe-coupon"
    );
  }

  // ==========================================
  // REVALIDATE COUPON WHEN CART CHANGES
  // ==========================================

  useEffect(() => {
    if (!appliedCoupon) {
      return;
    }

    if (subtotal < appliedCoupon.minimum) {
      setAppliedCoupon(null);
      setCouponCode("");

      setCouponMessage(
        `❌ Coupon removed. Minimum order value is ₹${appliedCoupon.minimum.toLocaleString(
          "en-IN"
        )}.`
      );

      localStorage.removeItem(
        "gymdrobe-coupon"
      );
    }
  }, [subtotal, appliedCoupon]);

  // ==========================================
  // TOTAL ITEMS
  // ==========================================

  const totalItems = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  // ==========================================
  // EMPTY CART
  // ==========================================

  if (cart.length === 0) {
    return (
      <section
        className="
          min-h-screen
          bg-gray-100
          text-black
          px-3
          sm:px-6
          py-10
          sm:py-20
        "
      >
        <div
          className="
            max-w-4xl
            mx-auto
            text-center
            bg-white
            rounded-2xl
            sm:rounded-3xl
            p-6
            sm:p-12
            shadow-sm
          "
        >
          <div
            className="
              text-5xl
              sm:text-6xl
              mb-5
              sm:mb-6
            "
          >
            🛒
          </div>

          <h1
            className="
              text-2xl
              sm:text-3xl
              font-bold
              mb-4
            "
          >
            Your cart is empty
          </h1>

          <p
            className="
              text-sm
              sm:text-base
              text-gray-500
              mb-7
              sm:mb-8
              max-w-md
              mx-auto
            "
          >
            Looks like you haven't added
            anything to your cart yet.
          </p>

          <Link
            to="/shop"
            className="
              inline-flex
              items-center
              justify-center
              w-full
              sm:w-auto
              bg-orange-600
              hover:bg-orange-700
              text-white
              px-7
              sm:px-8
              py-3.5
              sm:py-4
              rounded-xl
              font-semibold
              transition
              active:scale-[0.98]
            "
          >
            CONTINUE SHOPPING
          </Link>
        </div>
      </section>
    );
  }

  // ==========================================
  // CART UI
  // ==========================================

  return (
    <section
      className="
        min-h-screen
        bg-gray-100
        text-black
        px-3
        sm:px-6
        py-7
        sm:py-10
        md:py-16
      "
    >
      <div className="max-w-7xl mx-auto">

        {/* PAGE TITLE */}

        <div className="mb-7 sm:mb-10">
          <h1
            className="
              text-3xl
              sm:text-4xl
              font-bold
            "
          >
            Shopping Cart
          </h1>

          <p
            className="
              text-sm
              sm:text-base
              text-gray-500
              mt-2
            "
          >
            {totalItems}{" "}
            item
            {totalItems !== 1
              ? "s"
              : ""}{" "}
            in your cart
          </p>
        </div>

        <div
          className="
            grid
            lg:grid-cols-3
            gap-6
            lg:gap-8
          "
        >

          {/* ======================================
              CART ITEMS
          ====================================== */}

          <div
            className="
              lg:col-span-2
              space-y-4
              sm:space-y-5
            "
          >
            {cart.map((item) => {
              const stock =
                getItemStock(item);

              const isAtStockLimit =
                stock > 0 &&
                item.quantity >= stock;

              return (
                <div
                  key={`${item.id}-${item.selectedSize}-${item.selectedColor}`}
                  className="
                    bg-white
                    rounded-xl
                    sm:rounded-2xl
                    p-3
                    sm:p-5
                    md:p-6
                    shadow-sm
                  "
                >
                  <div
                    className="
                      flex
                      gap-3
                      sm:gap-5
                    "
                  >

                    {/* IMAGE */}

                    <Link
                      to={`/product/${item.id}`}
                      className="
                        w-24
                        h-24
                        sm:w-32
                        sm:h-32
                        shrink-0
                        bg-gray-100
                        rounded-lg
                        sm:rounded-xl
                        overflow-hidden
                      "
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="
                          w-full
                          h-full
                          object-cover
                        "
                      />
                    </Link>

                    {/* DETAILS */}

                    <div className="flex-1 min-w-0">

                      <div
                        className="
                          flex
                          justify-between
                          gap-2
                        "
                      >

                        <div className="min-w-0">

                          <Link
                            to={`/product/${item.id}`}
                            className="
                              block
                              text-sm
                              sm:text-lg
                              md:text-xl
                              font-bold
                              leading-tight
                              hover:text-orange-600
                              transition
                              line-clamp-2
                            "
                          >
                            {item.name}
                          </Link>

                          <p
                            className="
                              text-gray-500
                              text-xs
                              sm:text-sm
                              mt-1
                              truncate
                            "
                          >
                            {item.category}
                          </p>

                        </div>

                        {/* REMOVE */}

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(item)
                          }
                          aria-label={`Remove ${item.name}`}
                          className="
                            shrink-0
                            w-8
                            h-8
                            sm:w-9
                            sm:h-9
                            flex
                            items-center
                            justify-center
                            rounded-full
                            text-gray-400
                            hover:text-red-500
                            hover:bg-red-50
                            transition
                            text-base
                            sm:text-lg
                          "
                        >
                          🗑️
                        </button>

                      </div>

                      {/* VARIANTS */}

                      {(item.selectedSize ||
                        item.selectedColor) && (
                        <div
                          className="
                            flex
                            flex-wrap
                            gap-1.5
                            sm:gap-2
                            mt-2
                            sm:mt-3
                          "
                        >

                          {item.selectedSize && (
                            <span
                              className="
                                bg-gray-100
                                px-2
                                sm:px-3
                                py-1
                                rounded-full
                                text-[10px]
                                sm:text-sm
                              "
                            >
                              Size:{" "}
                              <strong>
                                {item.selectedSize}
                              </strong>
                            </span>
                          )}

                          {item.selectedColor && (
                            <span
                              className="
                                bg-gray-100
                                px-2
                                sm:px-3
                                py-1
                                rounded-full
                                text-[10px]
                                sm:text-sm
                              "
                            >
                              Color:{" "}
                              <strong>
                                {item.selectedColor}
                              </strong>
                            </span>
                          )}

                        </div>
                      )}

                      {/* PRICE */}

                      <div className="mt-2 sm:mt-4">

                        <span
                          className="
                            text-base
                            sm:text-xl
                            font-bold
                          "
                        >
                          ₹
                          {item.price.toLocaleString(
                            "en-IN"
                          )}
                        </span>

                        {item.quantity > 1 && (
                          <span
                            className="
                              text-xs
                              sm:text-sm
                              text-gray-500
                              ml-2
                            "
                          >
                            × {item.quantity}
                          </span>
                        )}

                      </div>

                      {/* QUANTITY + STOCK */}

                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          justify-between
                          gap-3
                          mt-3
                          sm:mt-4
                        "
                      >

                        {/* QUANTITY */}

                        <div
                          className="
                            flex
                            items-center
                            border
                            border-gray-200
                            rounded-lg
                            overflow-hidden
                          "
                        >

                          <button
                            type="button"
                            onClick={() =>
                              decreaseQuantity(
                                item
                              )
                            }
                            aria-label="Decrease quantity"
                            className="
                              w-9
                              h-9
                              sm:w-10
                              sm:h-10
                              hover:bg-gray-100
                              transition
                              font-bold
                              text-lg
                              active:bg-gray-200
                            "
                          >
                            −
                          </button>

                          <span
                            className="
                              w-10
                              sm:w-12
                              text-center
                              text-sm
                              sm:text-base
                              font-semibold
                            "
                          >
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              increaseQuantity(
                                item
                              )
                            }
                            disabled={
                              isAtStockLimit
                            }
                            aria-label="Increase quantity"
                            className={`
                              w-9
                              h-9
                              sm:w-10
                              sm:h-10
                              font-bold
                              text-lg
                              transition
                              ${
                                isAtStockLimit
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "hover:bg-gray-100 active:bg-gray-200"
                              }
                            `}
                          >
                            +
                          </button>

                        </div>

                        {/* STOCK */}

                        <p
                          className={`
                            text-[10px]
                            sm:text-xs
                            md:text-sm
                            ${
                              stock <= 3
                                ? "text-red-500"
                                : "text-gray-500"
                            }
                          `}
                        >
                          {stock <= 3
                            ? `Only ${stock} left`
                            : `${stock} available`}
                        </p>

                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ======================================
              ORDER SUMMARY
          ====================================== */}

          <div className="lg:col-span-1">

            <div
              className="
                bg-white
                rounded-xl
                sm:rounded-2xl
                p-4
                sm:p-6
                shadow-sm
                lg:sticky
                lg:top-24
              "
            >

              <h2
                className="
                  text-lg
                  sm:text-xl
                  font-bold
                  mb-5
                  sm:mb-6
                "
              >
                Order Summary
              </h2>

              {/* SUBTOTAL */}

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  mb-4
                  text-sm
                  sm:text-base
                "
              >
                <span className="text-gray-500">
                  Subtotal
                </span>

                <span className="font-semibold">
                  ₹
                  {subtotal.toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>

              {/* COUPON */}

              <div
                className="
                  border-t
                  border-gray-100
                  pt-5
                  mt-5
                "
              >

                <p
                  className="
                    font-semibold
                    text-sm
                    sm:text-base
                    mb-3
                  "
                >
                  Have a coupon?
                </p>

                {appliedCoupon ? (
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                      bg-green-50
                      border
                      border-green-200
                      rounded-lg
                      px-3
                      py-2.5
                    "
                  >
                    <div>
                      <p
                        className="
                          text-sm
                          font-bold
                          text-green-700
                        "
                      >
                        {appliedCoupon.code}
                      </p>

                      <p
                        className="
                          text-xs
                          text-green-600
                        "
                      >
                        Coupon applied
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="
                        text-xs
                        font-semibold
                        text-red-500
                        hover:text-red-700
                      "
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className="
                      flex
                      gap-2
                    "
                  >

                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter"
                        ) {
                          applyCoupon();
                        }
                      }}
                      placeholder="Enter coupon"
                      className="
                        flex-1
                        min-w-0
                        border
                        border-gray-300
                        rounded-lg
                        px-3
                        py-2.5
                        text-sm
                        outline-none
                        focus:ring-2
                        focus:ring-orange-500
                      "
                    />

                    <button
                      type="button"
                      onClick={applyCoupon}
                      className="
                        shrink-0
                        bg-gray-900
                        hover:bg-black
                        text-white
                        px-3
                        sm:px-4
                        rounded-lg
                        font-semibold
                        text-sm
                        transition
                      "
                    >
                      Apply
                    </button>

                  </div>
                )}

                {couponMessage && (
                  <p className="text-xs sm:text-sm mt-2">
                    {couponMessage}
                  </p>
                )}

              </div>

              {/* COUPON DISCOUNT */}

              {couponDiscount > 0 && (
                <div
                  className="
                    flex
                    justify-between
                    gap-4
                    mt-5
                    text-green-600
                    text-sm
                  "
                >

                  <span>
                    Coupon Discount
                  </span>

                  <span className="font-semibold">
                    -₹
                    {couponDiscount.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                </div>
              )}

              {/* SHIPPING */}

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  mt-5
                  text-sm
                  sm:text-base
                "
              >

                <span className="text-gray-500">
                  Standard Delivery
                </span>

                <span className="font-semibold">
                  {standardShipping === 0
                    ? "FREE"
                    : `₹${standardShipping}`}
                </span>

              </div>

              {/* FREE SHIPPING MESSAGE */}

              {totalAfterCoupon <
                FREE_SHIPPING_LIMIT && (
                <p
                  className="
                    text-xs
                    sm:text-sm
                    text-gray-500
                    mt-3
                    leading-5
                  "
                >
                  Add ₹
                  {(
                    FREE_SHIPPING_LIMIT -
                    totalAfterCoupon
                  ).toLocaleString(
                    "en-IN"
                  )}{" "}
                  more for free shipping.
                </p>
              )}

              {/* FREE SHIPPING SUCCESS */}

              {totalAfterCoupon >=
                FREE_SHIPPING_LIMIT && (
                <p
                  className="
                    text-xs
                    sm:text-sm
                    text-green-600
                    mt-3
                  "
                >
                  🎉 You unlocked free
                  standard delivery!
                </p>
              )}

              {/* TOTAL */}

              <div
                className="
                  border-t
                  border-gray-200
                  mt-6
                  pt-5
                  sm:pt-6
                "
              >

                <div
                  className="
                    flex
                    justify-between
                    items-center
                    gap-4
                  "
                >

                  <span
                    className="
                      text-base
                      sm:text-lg
                      font-bold
                    "
                  >
                    Total
                  </span>

                  <span
                    className="
                      text-xl
                      sm:text-2xl
                      font-bold
                    "
                  >
                    ₹
                    {finalTotal.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                </div>

              </div>

              {/* CHECKOUT */}

              <button
                type="button"
                onClick={() =>
                  navigate("/checkout")
                }
                className="
                  w-full
                  bg-orange-600
                  hover:bg-orange-700
                  text-white
                  py-3.5
                  sm:py-4
                  rounded-xl
                  font-bold
                  text-sm
                  sm:text-base
                  mt-5
                  sm:mt-6
                  transition
                  active:scale-[0.98]
                "
              >
                PROCEED TO CHECKOUT
              </button>

              {/* CONTINUE SHOPPING */}

              <Link
                to="/shop"
                className="
                  block
                  text-center
                  mt-4
                  text-sm
                  sm:text-base
                  text-gray-600
                  hover:text-orange-600
                  transition
                "
              >
                ← Continue Shopping
              </Link>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Cart;