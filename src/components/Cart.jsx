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
  calculateOrderPricing,
  COUPONS,
  FREE_SHIPPING_LIMIT,
} from "../utils/orderCalculations";

import products from "../data/products";

import {
  getVariantStock,
  getCartItemKey,
  revalidateCart,
} from "../utils/cartUtils";

/* =========================================================
   ICONS
========================================================= */

function SecureIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3 4.5 6v5.2c0 4.7 3.1 8.9 7.5 9.8 4.4-.9 7.5-5.1 7.5-9.8V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M20 13 11 22l-9-9V4h9l9 9Z" />
      <circle cx="7" cy="9" r="1" />
    </svg>
  );
}

function DeliveryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 5h11v11H3z" />
      <path d="M14 9h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

/* =========================================================
   CART
========================================================= */

function Cart({
  cart,
  setCart,
}) {
  const navigate =
    useNavigate();

  /* =======================================================
     COUPON STATE
  ======================================================= */

  const [
    couponCode,
    setCouponCode,
  ] = useState("");

  const [
    appliedCoupon,
    setAppliedCoupon,
  ] = useState(null);

  const [
    couponMessage,
    setCouponMessage,
  ] = useState("");

  /* =======================================================
     DELIVERY CHECK
  ======================================================= */

  const [
    pincode,
    setPincode,
  ] = useState("");

  const [
    deliveryMessage,
    setDeliveryMessage,
  ] = useState("");

  /* =======================================================
     REVALIDATE CART
  ======================================================= */

  useEffect(() => {
    const result =
      revalidateCart(
        cart,
        products
      );

    const currentCartJSON =
      JSON.stringify(cart);

    const updatedCartJSON =
      JSON.stringify(
        result.cart
      );

    if (
      currentCartJSON !==
      updatedCartJSON
    ) {
      setCart(result.cart);
    }
  }, [
    cart,
    setCart,
  ]);

  /* =======================================================
     LOAD SAVED COUPON
  ======================================================= */

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
        JSON.parse(
          savedCoupon
        );

      const code =
        savedCouponData?.code
          ?.toUpperCase();

      const coupon =
        code
          ? COUPONS[code]
          : null;

      if (coupon) {
        setAppliedCoupon(
          coupon
        );

        setCouponCode(
          coupon.code
        );
      } else {
        localStorage.removeItem(
          "gymdrobe-coupon"
        );
      }
    } catch {
      localStorage.removeItem(
        "gymdrobe-coupon"
      );
    }
  }, []);

  /* =======================================================
     GET PRODUCT
  ======================================================= */

  function getProduct(item) {
    return products.find(
      (productItem) =>
        String(
          productItem.id
        ) ===
        String(
          item.id
        )
    );
  }

  /* =======================================================
     STOCK
  ======================================================= */

  function getItemStock(item) {
    const product =
      getProduct(item);

    if (!product) {
      return 0;
    }

    return getVariantStock(
      product,
      item.selectedSize ??
        null,
      item.selectedColor ??
        null
    );
  }

  /* =======================================================
     REMOVE ITEM
  ======================================================= */

  function removeItem(
    itemToRemove
  ) {
    const itemKey =
      getCartItemKey(
        itemToRemove
      );

    setCart(
      (currentCart) =>
        currentCart.filter(
          (item) =>
            getCartItemKey(
              item
            ) !== itemKey
        )
    );
  }

  /* =======================================================
     QUANTITY
  ======================================================= */

  function decreaseQuantity(
    itemToDecrease
  ) {
    const itemKey =
      getCartItemKey(
        itemToDecrease
      );

    setCart(
      (currentCart) =>
        currentCart
          .map(
            (item) => {
              if (
                getCartItemKey(
                  item
                ) !== itemKey
              ) {
                return item;
              }

              const newQuantity =
                Number(
                  item.quantity ||
                    1
                ) - 1;

              return {
                ...item,
                quantity:
                  newQuantity,
              };
            }
          )
          .filter(
            (item) =>
              Number(
                item.quantity
              ) > 0
          )
    );
  }

  function increaseQuantity(
    itemToIncrease
  ) {
    const itemKey =
      getCartItemKey(
        itemToIncrease
      );

    const stock =
      getItemStock(
        itemToIncrease
      );

    setCart(
      (currentCart) =>
        currentCart.map(
          (item) => {
            if (
              getCartItemKey(
                item
              ) !== itemKey
            ) {
              return item;
            }

            const currentQuantity =
              Number(
                item.quantity ||
                  0
              );

            if (
              currentQuantity >=
              stock
            ) {
              return item;
            }

            return {
              ...item,

              quantity:
                currentQuantity +
                1,
            };
          }
        )
    );
  }

  /* =======================================================
     PRICING
  ======================================================= */

  const {
    subtotal,
    couponDiscount,
    totalAfterCoupon,
    shipping:
      standardShipping,
    finalTotal,
  } = useMemo(() => {
    return calculateOrderPricing({
      cart,

      coupon:
        appliedCoupon,

      deliveryMethod:
        "standard",
    });
  }, [
    cart,
    appliedCoupon,
  ]);

  /* =======================================================
     APPLY COUPON
  ======================================================= */

  function applyCoupon(
    requestedCode = null
  ) {
    const code =
      (
        requestedCode ??
        couponCode
      )
        .trim()
        .toUpperCase();

    if (!code) {
      setCouponMessage(
        "Please enter a coupon code."
      );

      return;
    }

    const coupon =
      COUPONS[code];

    if (!coupon) {
      setCouponMessage(
        "Invalid coupon code."
      );

      setAppliedCoupon(
        null
      );

      localStorage.removeItem(
        "gymdrobe-coupon"
      );

      return;
    }

    if (
      subtotal <
      coupon.minimum
    ) {
      setCouponMessage(
        `Minimum order value is ₹${coupon.minimum.toLocaleString(
          "en-IN"
        )}.`
      );

      setAppliedCoupon(
        null
      );

      localStorage.removeItem(
        "gymdrobe-coupon"
      );

      return;
    }

    setAppliedCoupon(
      coupon
    );

    setCouponCode(
      coupon.code
    );

    localStorage.setItem(
      "gymdrobe-coupon",
      JSON.stringify({
        code:
          coupon.code,
      })
    );

    setCouponMessage(
      `Coupon ${coupon.code} applied successfully.`
    );
  }

  /* =======================================================
     REMOVE COUPON
  ======================================================= */

  function removeCoupon() {
    setAppliedCoupon(
      null
    );

    setCouponCode("");

    setCouponMessage(
      "Coupon removed."
    );

    localStorage.removeItem(
      "gymdrobe-coupon"
    );
  }

  /* =======================================================
     COUPON REVALIDATION
  ======================================================= */

  useEffect(() => {
    if (!appliedCoupon) {
      return;
    }

    if (
      subtotal <
      appliedCoupon.minimum
    ) {
      setAppliedCoupon(
        null
      );

      setCouponCode("");

      setCouponMessage(
        `Coupon removed. Minimum order value is ₹${appliedCoupon.minimum.toLocaleString(
          "en-IN"
        )}.`
      );

      localStorage.removeItem(
        "gymdrobe-coupon"
      );
    }
  }, [
    subtotal,
    appliedCoupon,
  ]);

  /* =======================================================
     TOTAL ITEMS
  ======================================================= */

  const totalItems =
    cart.reduce(
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

  /* =======================================================
     PRODUCT SAVINGS
  ======================================================= */

  const productSavings =
    cart.reduce(
      (
        total,
        item
      ) => {
        const product =
          getProduct(item);

        if (!product) {
          return total;
        }

        const originalPrice =
          Number(
            product.price ||
              0
          );

        const sellingPrice =
          Number(
            item.price ||
              0
          );

        const saving =
          Math.max(
            originalPrice -
              sellingPrice,
            0
          );

        return (
          total +
          saving *
            Number(
              item.quantity ||
                0
            )
        );
      },
      0
    );

  const totalSavings =
    productSavings +
    couponDiscount;

  /* =======================================================
     TOTAL MRP
  ======================================================= */

  const totalMrp =
    cart.reduce(
      (
        total,
        item
      ) => {
        const product =
          getProduct(item);

        const originalPrice =
          Number(
            product?.price ??
              item.price ??
              0
          );

        return (
          total +
          originalPrice *
            Number(
              item.quantity ||
                0
            )
        );
      },
      0
    );

  /* =======================================================
     PRODUCT DISCOUNT
  ======================================================= */

  const productDiscount =
    Math.max(
      totalMrp -
        subtotal,
      0
    );

  /* =======================================================
     AVAILABLE COUPONS
  ======================================================= */

  const availableCoupons =
    Object.values(
      COUPONS
    );

  /* =======================================================
     DELIVERY PINCODE
  ======================================================= */

  function checkPincode() {
    const value =
      pincode.trim();

    if (
      !/^\d{6}$/.test(
        value
      )
    ) {
      setDeliveryMessage(
        "Enter a valid 6-digit pincode."
      );

      return;
    }

    setDeliveryMessage(
      "Pincode saved. Final delivery date will be confirmed at checkout."
    );
  }

  /* =======================================================
     CHECKOUT
  ======================================================= */

  function handleCheckout() {
    if (!cart.length) {
      return;
    }

    const result =
      revalidateCart(
        cart,
        products
      );

    if (
      JSON.stringify(
        result.cart
      ) !==
      JSON.stringify(
        cart
      )
    ) {
      setCart(
        result.cart
      );

      return;
    }

    navigate(
      "/checkout"
    );
  }

  /* =======================================================
     EMPTY BAG
  ======================================================= */

  if (
    cart.length === 0
  ) {
    return (
      <main
        className="
          min-h-[75vh]
          bg-white
          text-[#282c3f]
        "
      >
        {/* CHECKOUT HEADER */}

        <div
          className="
            border-b
            border-[#eaeaec]
          "
        >
          <div
            className="
              mx-auto
              flex
              min-h-[76px]
              max-w-[1200px]
              items-center
              justify-center
              px-4
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                text-[11px]
                font-bold
                uppercase
                tracking-[0.18em]
              "
            >
              <span
                className="
                  border-b-2
                  border-orange-600
                  pb-2
                  text-orange-600
                "
              >
                Bag
              </span>

              <span
                className="
                  text-[#d4d5d9]
                "
              >
                ─────
              </span>

              <span>
                Address
              </span>

              <span
                className="
                  text-[#d4d5d9]
                "
              >
                ─────
              </span>

              <span>
                Payment
              </span>
            </div>
          </div>
        </div>

        <div
          className="
            flex
            min-h-[560px]
            items-center
            justify-center
            px-5
          "
        >
          <div
            className="
              max-w-[460px]
              text-center
            "
          >
            <div
              className="
                mx-auto
                flex
                h-20
                w-20
                items-center
                justify-center
                rounded-full
                bg-[#fff4ed]
                text-4xl
              "
            >
              🛍️
            </div>

            <h1
              className="
                mt-6
                text-2xl
                font-bold
              "
            >
              Your Bag Is Empty
            </h1>

            <p
              className="
                mt-3
                text-sm
                leading-6
                text-[#696b79]
              "
            >
              Add your favourite
              workout essentials to
              your bag and they will
              appear here.
            </p>

            <Link
              to="/shop"
              className="
                mt-7
                inline-flex
                min-h-[48px]
                items-center
                justify-center
                bg-orange-600
                px-8
                text-xs
                font-bold
                uppercase
                tracking-wide
                text-white
                transition
                hover:bg-orange-700
              "
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     CART
  ======================================================= */

  return (
    <main
      className="
        min-h-screen
        bg-white
        text-[#282c3f]
      "
    >
      {/* =================================================
          CHECKOUT PROGRESS
      ================================================= */}

      <div
        className="
          border-b
          border-[#eaeaec]
          bg-white
        "
      >
        <div
          className="
            mx-auto
            flex
            min-h-[76px]
            max-w-[1200px]
            items-center
            justify-between
            gap-4
            px-4
            sm:px-6
          "
        >
          <div
            className="
              hidden
              w-[150px]
              sm:block
            "
          />

          <div
            className="
              flex
              items-center
              gap-2
              text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              sm:text-[11px]
            "
          >
            <span
              className="
                border-b-2
                border-orange-600
                pb-2
                text-orange-600
              "
            >
              Bag
            </span>

            <span
              className="
                text-[#c7c8cc]
              "
            >
              ─────
            </span>

            <span>
              Address
            </span>

            <span
              className="
                text-[#c7c8cc]
              "
            >
              ─────
            </span>

            <span>
              Payment
            </span>
          </div>

          <div
            className="
              hidden
              w-[150px]
              items-center
              justify-end
              gap-2
              text-[10px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-[#696b79]
              sm:flex
            "
          >
            <span
              className="
                text-green-600
              "
            >
              <SecureIcon />
            </span>

            100% Secure
          </div>
        </div>
      </div>

      {/* =================================================
          MAIN CART
      ================================================= */}

      <div
        className="
          mx-auto
          max-w-[1000px]
          px-4
          py-6
          sm:px-6
          lg:py-8
        "
      >
        <div
          className="
            grid
            gap-8
            lg:grid-cols-[minmax(0,1fr)_360px]
          "
        >
          {/* =================================================
              LEFT
          ================================================= */}

          <section
            className="
              min-w-0
              lg:border-r
              lg:border-[#eaeaec]
              lg:pr-8
            "
          >
            {/* =============================================
                DELIVERY CHECK
            ============================================= */}

            <div
              className="
                border
                border-[#eaeaec]
                bg-[#fff8f5]
                px-4
                py-4
              "
            >
              <div
                className="
                  flex
                  flex-col
                  gap-4
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >
                  <DeliveryIcon />

                  <span
                    className="
                      text-sm
                      font-bold
                    "
                  >
                    Check delivery
                    time & services
                  </span>
                </div>

                <div
                  className="
                    flex
                    border
                    border-orange-500
                    bg-white
                  "
                >
                  <input
                    type="text"
                    value={
                      pincode
                    }
                    maxLength={6}
                    inputMode="numeric"
                    onChange={(
                      event
                    ) => {
                      setPincode(
                        event.target.value
                          .replace(
                            /\D/g,
                            ""
                          )
                          .slice(
                            0,
                            6
                          )
                      );

                      setDeliveryMessage(
                        ""
                      );
                    }}
                    placeholder="PIN CODE"
                    className="
                      w-[120px]
                      px-3
                      py-2
                      text-xs
                      outline-none
                    "
                  />

                  <button
                    type="button"
                    onClick={
                      checkPincode
                    }
                    className="
                      border-l
                      border-orange-500
                      px-4
                      text-[10px]
                      font-bold
                      uppercase
                      text-orange-600
                    "
                  >
                    Check
                  </button>
                </div>
              </div>

              {deliveryMessage && (
                <p
                  className="
                    mt-3
                    text-xs
                    text-[#696b79]
                  "
                >
                  {
                    deliveryMessage
                  }
                </p>
              )}
            </div>

            {/* =============================================
                AVAILABLE OFFERS
            ============================================= */}

            <div
              className="
                mt-3
                border
                border-[#eaeaec]
                bg-white
                p-4
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <TagIcon />

                <h2
                  className="
                    text-sm
                    font-bold
                  "
                >
                  Available Offers
                </h2>
              </div>

              <p
                className="
                  mt-3
                  text-xs
                  leading-5
                  text-[#696b79]
                "
              >
                Apply an eligible
                GymDrobe coupon to
                save more on your
                order.
              </p>

              <div
                className="
                  mt-3
                  flex
                  flex-wrap
                  gap-x-4
                  gap-y-2
                "
              >
                {availableCoupons.map(
                  (coupon) => (
                    <button
                      key={
                        coupon.code
                      }
                      type="button"
                      onClick={() => {
                        setCouponCode(
                          coupon.code
                        );

                        applyCoupon(
                          coupon.code
                        );
                      }}
                      className="
                        text-[11px]
                        font-bold
                        text-orange-600
                        hover:underline
                      "
                    >
                      {
                        coupon.code
                      }
                    </button>
                  )
                )}
              </div>
            </div>

            {/* =============================================
                ITEMS HEADER
            ============================================= */}

            <div
              className="
                mt-6
                flex
                items-center
                justify-between
                border-b
                border-[#eaeaec]
                pb-4
              "
            >
              <h1
                className="
                  text-sm
                  font-bold
                  uppercase
                "
              >
                {totalItems}{" "}
                {totalItems === 1
                  ? "Item"
                  : "Items"}{" "}
                In Your Bag
              </h1>

              <Link
                to="/wishlist"
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  text-[#696b79]
                  hover:text-orange-600
                "
              >
                Wishlist
              </Link>
            </div>

            {/* =============================================
                CART ITEMS
            ============================================= */}

            <div
              className="
                divide-y
                divide-[#eaeaec]
              "
            >
              {cart.map(
                (item) => {
                  const product =
                    getProduct(
                      item
                    );

                  const stock =
                    getItemStock(
                      item
                    );

                  const quantity =
                    Number(
                      item.quantity ||
                        0
                    );

                  const isAtStockLimit =
                    stock > 0 &&
                    quantity >=
                      stock;

                  const originalPrice =
                    Number(
                      product?.price ??
                        item.price ??
                        0
                    );

                  const sellingPrice =
                    Number(
                      item.price ||
                        0
                    );

                  const discount =
                    originalPrice >
                    0
                      ? Math.round(
                          ((originalPrice -
                            sellingPrice) /
                            originalPrice) *
                            100
                        )
                      : 0;

                  return (
                    <article
                      key={getCartItemKey(
                        item
                      )}
                      className="
                        py-5
                      "
                    >
                      <div
                        className="
                          flex
                          gap-4
                        "
                      >
                        {/* IMAGE */}

                        <Link
                          to={`/product/${item.id}`}
                          className="
                            h-[150px]
                            w-[112px]
                            shrink-0
                            overflow-hidden
                            bg-[#f5f5f6]
                            sm:h-[170px]
                            sm:w-[128px]
                          "
                        >
                          <img
                            src={
                              item.image ||
                              item.images?.[
                                0
                              ]
                            }
                            alt={
                              item.name
                            }
                            className="
                              h-full
                              w-full
                              object-cover
                            "
                          />
                        </Link>

                        {/* DETAILS */}

                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >
                          <div
                            className="
                              flex
                              items-start
                              justify-between
                              gap-3
                            "
                          >
                            <div
                              className="
                                min-w-0
                              "
                            >
                              <p
                                className="
                                  text-sm
                                  font-bold
                                  text-[#282c3f]
                                "
                              >
                                {product?.brand ||
                                  "GymDrobe"}
                              </p>

                              <Link
                                to={`/product/${item.id}`}
                                className="
                                  mt-1
                                  block
                                  truncate
                                  text-[13px]
                                  text-[#696b79]
                                  hover:text-orange-600
                                "
                              >
                                {
                                  item.name
                                }
                              </Link>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  item
                                )
                              }
                              aria-label={`Remove ${item.name}`}
                              className="
                                flex
                                h-8
                                w-8
                                shrink-0
                                items-center
                                justify-center
                                text-xl
                                text-[#696b79]
                                hover:text-red-600
                              "
                            >
                              ×
                            </button>
                          </div>

                          {/* VARIANTS */}

                          <div
                            className="
                              mt-3
                              flex
                              flex-wrap
                              gap-2
                            "
                          >
                            {item.selectedSize && (
                              <span
                                className="
                                  bg-[#f5f5f6]
                                  px-2.5
                                  py-1.5
                                  text-[11px]
                                  font-semibold
                                "
                              >
                                Size:{" "}
                                {
                                  item.selectedSize
                                }
                              </span>
                            )}

                            {item.selectedColor && (
                              <span
                                className="
                                  bg-[#f5f5f6]
                                  px-2.5
                                  py-1.5
                                  text-[11px]
                                  font-semibold
                                "
                              >
                                Color:{" "}
                                {
                                  item.selectedColor
                                }
                              </span>
                            )}
                          </div>

                          {/* QUANTITY */}

                          <div
                            className="
                              mt-3
                              flex
                              flex-wrap
                              items-center
                              gap-3
                            "
                          >
                            <span
                              className="
                                text-[11px]
                                font-semibold
                              "
                            >
                              Qty:
                            </span>

                            <div
                              className="
                                flex
                                h-8
                                items-center
                                border
                                border-[#d4d5d9]
                              "
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  decreaseQuantity(
                                    item
                                  )
                                }
                                disabled={
                                  quantity <=
                                  1
                                }
                                className="
                                  flex
                                  h-full
                                  w-8
                                  items-center
                                  justify-center
                                  disabled:text-gray-300
                                "
                              >
                                −
                              </button>

                              <span
                                className="
                                  flex
                                  h-full
                                  min-w-8
                                  items-center
                                  justify-center
                                  border-x
                                  border-[#eaeaec]
                                  px-2
                                  text-xs
                                  font-bold
                                "
                              >
                                {quantity}
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
                                className="
                                  flex
                                  h-full
                                  w-8
                                  items-center
                                  justify-center
                                  disabled:text-gray-300
                                "
                              >
                                +
                              </button>
                            </div>

                            <span
                              className={`
                                text-[10px]
                                ${
                                  stock <=
                                  3
                                    ? "font-semibold text-orange-600"
                                    : "text-[#696b79]"
                                }
                              `}
                            >
                              {stock <= 0
                                ? "Out of stock"
                                : stock <=
                                  3
                                ? `Only ${stock} left`
                                : `${stock} available`}
                            </span>
                          </div>

                          {/* PRICE */}

                          <div
                            className="
                              mt-4
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <span
                              className="
                                text-sm
                                font-bold
                              "
                            >
                              ₹
                              {sellingPrice.toLocaleString(
                                "en-IN"
                              )}
                            </span>

                            {discount >
                              0 && (
                              <>
                                <span
                                  className="
                                    text-[11px]
                                    text-[#94969f]
                                    line-through
                                  "
                                >
                                  ₹
                                  {originalPrice.toLocaleString(
                                    "en-IN"
                                  )}
                                </span>

                                <span
                                  className="
                                    text-[11px]
                                    text-[#ff905a]
                                  "
                                >
                                  {
                                    discount
                                  }
                                  % OFF
                                </span>
                              </>
                            )}
                          </div>

                          {/* RETURN INFO */}

                          <p
                            className="
                              mt-3
                              text-[10px]
                              text-[#696b79]
                            "
                          >
                            ✓ Easy
                            returns on
                            eligible
                            products
                          </p>

                          {quantity >
                            1 && (
                            <p
                              className="
                                mt-2
                                text-[10px]
                                text-[#94969f]
                              "
                            >
                              Item total:
                              ₹
                              {(
                                sellingPrice *
                                quantity
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </section>

          {/* =================================================
              RIGHT SIDE
          ================================================= */}

          <aside
            className="
              min-w-0
              lg:sticky
              lg:top-[100px]
              lg:self-start
            "
          >
            {/* =============================================
                OFFERS & COUPONS
            ============================================= */}

            <div
              className="
                border-b
                border-[#eaeaec]
                pb-6
              "
            >
              <h2
                className="
                  text-[12px]
                  font-bold
                  uppercase
                  tracking-[0.04em]
                "
              >
                Offers & Coupons
              </h2>

              {appliedCoupon ? (
                <div
                  className="
                    mt-4
                    flex
                    items-center
                    justify-between
                    gap-4
                    bg-green-50
                    px-4
                    py-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-xs
                        font-bold
                        text-green-700
                      "
                    >
                      {
                        appliedCoupon.code
                      }
                    </p>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        text-green-600
                      "
                    >
                      Coupon
                      applied
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      removeCoupon
                    }
                    className="
                      text-[10px]
                      font-bold
                      uppercase
                      text-red-600
                    "
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="
                      mt-4
                      flex
                      items-center
                      border
                      border-[#d4d5d9]
                    "
                  >
                    <input
                      type="text"
                      value={
                        couponCode
                      }
                      onChange={(
                        event
                      ) =>
                        setCouponCode(
                          event.target
                            .value
                            .toUpperCase()
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          applyCoupon();
                        }
                      }}
                      placeholder="Enter coupon code"
                      className="
                        min-w-0
                        flex-1
                        px-3
                        py-3
                        text-xs
                        uppercase
                        outline-none
                      "
                    />

                    <button
                      type="button"
                      onClick={() =>
                        applyCoupon()
                      }
                      className="
                        px-4
                        text-[10px]
                        font-bold
                        uppercase
                        text-orange-600
                      "
                    >
                      Apply
                    </button>
                  </div>

                  <div
                    className="
                      mt-3
                      flex
                      flex-wrap
                      gap-2
                    "
                  >
                    {availableCoupons.map(
                      (
                        coupon
                      ) => (
                        <button
                          key={
                            coupon.code
                          }
                          type="button"
                          onClick={() => {
                            setCouponCode(
                              coupon.code
                            );

                            applyCoupon(
                              coupon.code
                            );
                          }}
                          className="
                            border
                            border-dashed
                            border-orange-300
                            px-2.5
                            py-1.5
                            text-[10px]
                            font-bold
                            text-orange-600
                          "
                        >
                          {
                            coupon.code
                          }
                        </button>
                      )
                    )}
                  </div>
                </>
              )}

              {couponMessage && (
                <p
                  className="
                    mt-3
                    text-[11px]
                    leading-5
                    text-[#696b79]
                  "
                >
                  {
                    couponMessage
                  }
                </p>
              )}
            </div>

            {/* =============================================
                PRICE DETAILS
            ============================================= */}

            <div
              className="
                pt-6
              "
            >
              <h2
                className="
                  text-[12px]
                  font-bold
                  uppercase
                  tracking-[0.04em]
                "
              >
                Price Details (
                {totalItems}{" "}
                {totalItems ===
                1
                  ? "Item"
                  : "Items"}
                )
              </h2>

              <div
                className="
                  mt-5
                  space-y-4
                  text-[13px]
                "
              >
                {/* TOTAL MRP */}

                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Total MRP
                  </span>

                  <span>
                    ₹
                    {totalMrp.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                {/* PRODUCT DISCOUNT */}

                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Discount on
                    MRP
                  </span>

                  <span
                    className="
                      font-medium
                      text-green-600
                    "
                  >
                    {productDiscount >
                    0
                      ? `- ₹${productDiscount.toLocaleString(
                          "en-IN"
                        )}`
                      : "₹0"}
                  </span>
                </div>

                {/* COUPON */}

                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Coupon
                    Discount
                  </span>

                  {couponDiscount >
                  0 ? (
                    <span
                      className="
                        font-medium
                        text-green-600
                      "
                    >
                      - ₹
                      {couponDiscount.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  ) : (
                    <span
                      className="
                        text-orange-600
                      "
                    >
                      Apply Coupon
                    </span>
                  )}
                </div>

                {/* DELIVERY */}

                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Delivery
                    Charges
                  </span>

                  <span
                    className={
                      standardShipping ===
                      0
                        ? "font-medium text-green-600"
                        : ""
                    }
                  >
                    {standardShipping ===
                    0
                      ? "FREE"
                      : `₹${standardShipping.toLocaleString(
                          "en-IN"
                        )}`}
                  </span>
                </div>

                {/* SHIPPING MESSAGE */}

                {totalAfterCoupon <
                FREE_SHIPPING_LIMIT ? (
                  <p
                    className="
                      text-[10px]
                      leading-5
                      text-[#696b79]
                    "
                  >
                    Add ₹
                    {(
                      FREE_SHIPPING_LIMIT -
                      totalAfterCoupon
                    ).toLocaleString(
                      "en-IN"
                    )}{" "}
                    more for free
                    standard
                    delivery.
                  </p>
                ) : (
                  <p
                    className="
                      text-[10px]
                      font-medium
                      text-green-600
                    "
                  >
                    You unlocked
                    free standard
                    delivery.
                  </p>
                )}
              </div>

              {/* ===========================================
                  TOTAL
              =========================================== */}

              <div
                className="
                  mt-6
                  border-t
                  border-[#eaeaec]
                  pt-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-4
                  "
                >
                  <span
                    className="
                      text-sm
                      font-bold
                    "
                  >
                    Total Amount
                  </span>

                  <span
                    className="
                      text-lg
                      font-bold
                    "
                  >
                    ₹
                    {finalTotal.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                {totalSavings >
                  0 && (
                  <p
                    className="
                      mt-2
                      text-[11px]
                      font-medium
                      text-green-600
                    "
                  >
                    You save ₹
                    {totalSavings.toLocaleString(
                      "en-IN"
                    )}{" "}
                    on this order.
                  </p>
                )}
              </div>

              {/* ===========================================
                  CHECKOUT
              =========================================== */}

              <button
                type="button"
                onClick={
                  handleCheckout
                }
                className="
                  mt-6
                  min-h-[48px]
                  w-full
                  bg-orange-600
                  px-5
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.05em]
                  text-white
                  transition
                  hover:bg-orange-700
                "
              >
                Place Order
              </button>

              <Link
                to="/shop"
                className="
                  mt-4
                  block
                  text-center
                  text-[11px]
                  font-semibold
                  text-[#696b79]
                  hover:text-orange-600
                "
              >
                ← Continue Shopping
              </Link>

              {/* SECURE */}

              <div
                className="
                  mt-6
                  flex
                  items-center
                  justify-center
                  gap-2
                  border-t
                  border-[#eaeaec]
                  pt-5
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.08em]
                  text-[#696b79]
                "
              >
                <span
                  className="
                    text-green-600
                  "
                >
                  <SecureIcon />
                </span>

                Secure Checkout
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default Cart;