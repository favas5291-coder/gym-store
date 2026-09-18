import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Cart({ cart, setCart }) {
  const navigate = useNavigate();

  // =====================================================
  // COUPON STATE
  // =====================================================

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");

  // =====================================================
  // AVAILABLE COUPONS
  // =====================================================

  const coupons = {
    GYM10: {
      type: "percentage",
      value: 10,
      minAmount: 1000,
    },

    GYM20: {
      type: "percentage",
      value: 20,
      minAmount: 2000,
    },

    FIT100: {
      type: "fixed",
      value: 100,
      minAmount: 1000,
    },
  };

  // =====================================================
  // SUBTOTAL
  // =====================================================

  const totalPrice = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // =====================================================
  // COUPON DISCOUNT
  // =====================================================

  const couponDiscount =
    appliedCoupon?.type === "percentage"
      ? (totalPrice * appliedCoupon.value) / 100
      : appliedCoupon?.type === "fixed"
      ? appliedCoupon.value
      : 0;

  const finalCouponDiscount = Math.min(
    couponDiscount,
    totalPrice
  );

  // =====================================================
  // PRICE AFTER COUPON
  // =====================================================

  const amountAfterDiscount =
    totalPrice - finalCouponDiscount;

  // =====================================================
  // FREE SHIPPING
  // =====================================================

  const FREE_SHIPPING_LIMIT = 2000;

  const deliveryCharge =
    amountAfterDiscount === 0
      ? 0
      : amountAfterDiscount >= FREE_SHIPPING_LIMIT
      ? 0
      : 99;

  // =====================================================
  // FINAL TOTAL
  // =====================================================

  const finalTotal =
    amountAfterDiscount + deliveryCharge;

  // =====================================================
  // APPLY COUPON
  // =====================================================

  function applyCoupon() {
    const code = couponCode.trim().toUpperCase();

    if (!code) {
      setCouponMessage(
        "Please enter a coupon code."
      );
      return;
    }

    const coupon = coupons[code];

    if (!coupon) {
      setAppliedCoupon(null);

      setCouponMessage(
        "Invalid coupon code."
      );

      return;
    }

    if (totalPrice < coupon.minAmount) {
      setAppliedCoupon(null);

      setCouponMessage(
        `Minimum order value is ₹${coupon.minAmount.toLocaleString(
          "en-IN"
        )}.`
      );

      return;
    }

    setAppliedCoupon({
      code,
      ...coupon,
    });

    setCouponMessage(
      `Coupon ${code} applied successfully!`
    );
  }

  // =====================================================
  // REMOVE COUPON
  // =====================================================

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponMessage("");
  }

  // =====================================================
  // GET VARIANT STOCK
  // =====================================================

  function getVariantStock(item) {
    // Product has color + size
    if (
      item.selectedColor &&
      item.selectedSize &&
      item.variants?.[item.selectedColor]?.[
        item.selectedSize
      ] !== undefined
    ) {
      return item.variants[item.selectedColor][
        item.selectedSize
      ];
    }

    // Product has color but no size
    if (
      item.selectedColor &&
      item.variants?.[item.selectedColor]?.default !==
        undefined
    ) {
      return item.variants[item.selectedColor].default;
    }

    // Fallback stock
    return item.stock ?? 0;
  }

  // =====================================================
  // REMOVE ITEM
  // =====================================================

  function removeItem(
    id,
    selectedSize,
    selectedColor
  ) {
    const newCart = cart.filter(
      (item) =>
        !(
          item.id === id &&
          item.selectedSize === selectedSize &&
          item.selectedColor === selectedColor
        )
    );

    setCart(newCart);
  }

  // =====================================================
  // DECREASE QUANTITY
  // =====================================================

  function decreaseQuantity(
    id,
    selectedSize,
    selectedColor
  ) {
    const product = cart.find(
      (item) =>
        item.id === id &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor
    );

    if (!product) return;

    // Remove product when quantity reaches 0
    if (product.quantity === 1) {
      removeItem(
        id,
        selectedSize,
        selectedColor
      );

      return;
    }

    const newCart = cart.map((item) => {
      if (
        item.id === id &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor
      ) {
        return {
          ...item,
          quantity: item.quantity - 1,
        };
      }

      return item;
    });

    setCart(newCart);
  }

  // =====================================================
  // INCREASE QUANTITY
  // =====================================================

  function increaseQuantity(
    id,
    selectedSize,
    selectedColor
  ) {
    const newCart = cart.map((item) => {
      if (
        item.id === id &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor
      ) {
        const variantStock =
          getVariantStock(item);

        return {
          ...item,

          // Never allow quantity above stock
          quantity: Math.min(
            variantStock,
            item.quantity + 1
          ),
        };
      }

      return item;
    });

    setCart(newCart);
  }

  // =====================================================
  // TOTAL ITEM COUNT
  // =====================================================

  const totalItems = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  // =====================================================
  // UI
  // =====================================================

  return (
    <section className="bg-white py-20 px-6 min-h-screen">
      <div className="max-w-5xl mx-auto">

        {/* =================================================
            TITLE
        ================================================= */}

        <h2 className="text-4xl font-bold mb-3">
          MY CART
        </h2>

        <p className="mb-8 text-gray-500">
          Total Items: {totalItems}
        </p>

        {/* =================================================
            EMPTY CART
        ================================================= */}

        {cart.length === 0 ? (
          <div className="text-center py-20">

            <div className="text-6xl mb-6">
              🛒
            </div>

            <h3 className="text-2xl font-bold mb-3">
              Your cart is empty
            </h3>

            <p className="text-gray-500">
              Add some products to your cart.
            </p>

          </div>
        ) : (
          <>
            {/* =============================================
                CART ITEMS
            ============================================= */}

            <div className="space-y-4">

              {cart.map((item) => {
                const variantStock =
                  getVariantStock(item);

                return (
                  <div
                    key={`${item.id}-${item.selectedSize || "default"}-${item.selectedColor || "default"}`}
                    className="
                      bg-gray-100
                      p-4
                      rounded-xl
                      flex
                      flex-col
                      md:flex-row
                      md:justify-between
                      md:items-center
                      gap-5
                    "
                  >

                    {/* PRODUCT INFO */}

                    <div className="flex gap-4">

                      {/* IMAGE */}

                      <img
                        src={item.image}
                        alt={item.name}
                        className="
                          w-24
                          h-24
                          object-cover
                          rounded-lg
                        "
                      />

                      <div>

                        {/* NAME */}

                        <h3 className="font-semibold text-lg">
                          {item.name}
                        </h3>

                        {/* SIZE */}

                        {item.selectedSize && (
                          <p className="text-gray-500 text-sm mt-1">
                            Size:{" "}
                            {item.selectedSize}
                          </p>
                        )}

                        {/* COLOR */}

                        {item.selectedColor && (
                          <p className="text-gray-500 text-sm mt-1">
                            Color:{" "}
                            {item.selectedColor}
                          </p>
                        )}

                        {/* STOCK */}

                        <p
                          className={`
                            text-sm
                            mt-1
                            font-medium
                            ${
                              variantStock > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          `}
                        >
                          {variantStock > 0
                            ? `${variantStock} available`
                            : "Out of stock"}
                        </p>

                        {/* QUANTITY */}

                        <div className="flex items-center gap-3 mt-3">

                          {/* DECREASE */}

                          <button
                            type="button"
                            onClick={() =>
                              decreaseQuantity(
                                item.id,
                                item.selectedSize,
                                item.selectedColor
                              )
                            }
                            className="
                              w-8
                              h-8
                              bg-white
                              border
                              rounded
                              font-bold
                              hover:bg-gray-200
                            "
                          >
                            −
                          </button>

                          {/* QUANTITY */}

                          <span
                            className="
                              font-semibold
                              min-w-[20px]
                              text-center
                            "
                          >
                            {item.quantity}
                          </span>

                          {/* INCREASE */}

                          <button
                            type="button"
                            onClick={() =>
                              increaseQuantity(
                                item.id,
                                item.selectedSize,
                                item.selectedColor
                              )
                            }
                            disabled={
                              variantStock === 0 ||
                              item.quantity >=
                                variantStock
                            }
                            className="
                              w-8
                              h-8
                              bg-white
                              border
                              rounded
                              font-bold
                              hover:bg-gray-200
                              disabled:opacity-40
                              disabled:cursor-not-allowed
                            "
                          >
                            +
                          </button>

                        </div>
                      </div>
                    </div>

                    {/* PRICE + REMOVE */}

                    <div className="flex items-center gap-6">

                      {/* PRICE */}

                      <span className="font-bold whitespace-nowrap">
                        ₹
                        {(
                          item.price *
                          item.quantity
                        ).toLocaleString("en-IN")}
                      </span>

                      {/* REMOVE */}

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(
                            item.id,
                            item.selectedSize,
                            item.selectedColor
                          )
                        }
                        className="
                          text-red-600
                          font-semibold
                          hover:text-red-800
                        "
                      >
                        REMOVE
                      </button>

                    </div>

                  </div>
                );
              })}

            </div>

            {/* =================================================
                ORDER SUMMARY
            ================================================= */}

            <div
              className="
                mt-10
                bg-gray-100
                p-6
                rounded-xl
                max-w-md
                ml-auto
              "
            >

              <h3 className="text-2xl font-bold mb-6">
                Order Summary
              </h3>

              {/* =============================================
                  COUPON
              ============================================= */}

              <div className="mb-6">

                <h4 className="font-bold text-lg mb-3">
                  HAVE A COUPON?
                </h4>

                <div className="flex gap-2">

                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) =>
                      setCouponCode(
                        e.target.value.toUpperCase()
                      )
                    }
                    disabled={!!appliedCoupon}
                    className="
                      flex-1
                      p-3
                      border
                      rounded-lg
                      bg-white
                      disabled:bg-gray-200
                    "
                  />

                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="
                        px-4
                        py-3
                        bg-gray-200
                        hover:bg-gray-300
                        rounded-lg
                        font-semibold
                      "
                    >
                      REMOVE
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyCoupon}
                      className="
                        px-5
                        py-3
                        bg-black
                        text-white
                        hover:bg-gray-800
                        rounded-lg
                        font-semibold
                      "
                    >
                      APPLY
                    </button>
                  )}

                </div>

                {/* COUPON MESSAGE */}

                {couponMessage && (
                  <p className="text-sm mt-2 text-gray-600">
                    {couponMessage}
                  </p>
                )}

                {/* AVAILABLE COUPONS */}

                <p className="text-xs text-gray-500 mt-2">
                  Try: GYM10, GYM20 or FIT100
                </p>

              </div>

              {/* =============================================
                  FREE SHIPPING MESSAGE
              ============================================= */}

              {amountAfterDiscount <
                FREE_SHIPPING_LIMIT &&
                amountAfterDiscount > 0 && (
                  <p className="text-sm text-orange-600 mb-4">
                    Add ₹
                    {(
                      FREE_SHIPPING_LIMIT -
                      amountAfterDiscount
                    ).toLocaleString("en-IN")}{" "}
                    more to get FREE SHIPPING 🚚
                  </p>
                )}

              {amountAfterDiscount >=
                FREE_SHIPPING_LIMIT && (
                <p className="text-sm text-green-600 mb-4">
                  🎉 You unlocked FREE SHIPPING!
                </p>
              )}

              {/* SUBTOTAL */}

              <div className="flex justify-between mb-3">
                <span>
                  Subtotal
                </span>

                <span>
                  ₹
                  {totalPrice.toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>

              {/* COUPON DISCOUNT */}

              {finalCouponDiscount > 0 && (
                <div className="flex justify-between mb-3 text-green-600">
                  <span>
                    Coupon Discount
                  </span>

                  <span>
                    -₹
                    {finalCouponDiscount.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>
              )}

              {/* DELIVERY */}

              <div className="flex justify-between mb-3">
                <span>
                  Delivery
                </span>

                <span>
                  {deliveryCharge === 0
                    ? "FREE"
                    : `₹${deliveryCharge}`}
                </span>
              </div>

              <hr className="my-4" />

              {/* FINAL TOTAL */}

              <div className="flex justify-between text-xl font-bold mb-5">
                <span>
                  Total
                </span>

                <span>
                  ₹
                  {finalTotal.toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>

              {/* =============================================
                  CHECKOUT
              ============================================= */}

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => navigate("/checkout")}
                className="
                  w-full
                  bg-orange-600
                  hover:bg-orange-700
                  disabled:bg-gray-400
                  disabled:cursor-not-allowed
                  text-white
                  py-3
                  rounded-lg
                  font-semibold
                  transition
                "
              >
                PROCEED TO CHECKOUT
              </button>

            </div>
          </>
        )}

      </div>
    </section>
  );
}

export default Cart;