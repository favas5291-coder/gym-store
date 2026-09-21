import { useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  calculateOrderPricing,
  FREE_SHIPPING_LIMIT,
} from "../utils/orderCalculations";

function InputField({
  label,
  name,
  type = "text",
  value,
  error,
  onChange,
  placeholder,
  inputMode,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="
          block
          text-sm
          sm:text-base
          font-semibold
          mb-2
        "
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={
          name === "name"
            ? "name"
            : name === "email"
            ? "email"
            : name === "phone"
            ? "tel"
            : name === "address"
            ? "street-address"
            : name === "city"
            ? "address-level2"
            : name === "state"
            ? "address-level1"
            : name === "pincode"
            ? "postal-code"
            : "off"
        }
        className={`
          w-full
          border
          rounded-xl
          px-3
          sm:px-4
          py-3
          text-sm
          sm:text-base
          outline-none
          transition
          ${
            error
              ? "border-red-500 focus:ring-2 focus:ring-red-200"
              : "border-gray-300 focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
          }
        `}
      />

      {error && (
        <p
          className="
            text-red-500
            text-xs
            sm:text-sm
            mt-1.5
          "
        >
          {error}
        </p>
      )}
    </div>
  );
}

function CheckoutPage({ cart, setCart }) {
  const navigate = useNavigate();

  // ==========================================
  // CUSTOMER FORM
  // ==========================================

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  // ==========================================
  // DELIVERY
  // ==========================================

  const [deliveryMethod, setDeliveryMethod] =
    useState("standard");

  // ==========================================
  // PAYMENT
  // ==========================================

  const [paymentMethod, setPaymentMethod] =
    useState("cod");

  // ==========================================
  // FORM ERRORS
  // ==========================================

  const [errors, setErrors] = useState({});

  // ==========================================
  // SUBMITTING
  // ==========================================

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // ==========================================
  // COUPON
  // ==========================================

  const [coupon, setCoupon] = useState(null);

  // ==========================================
  // LOAD COUPON
  // ==========================================

  useEffect(() => {
    const savedCoupon =
      localStorage.getItem("gymdrobe-coupon");

    if (savedCoupon) {
      try {
        setCoupon(JSON.parse(savedCoupon));
      } catch {
        localStorage.removeItem(
          "gymdrobe-coupon"
        );
      }
    }
  }, []);

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
            max-w-2xl
            mx-auto
            bg-white
            rounded-2xl
            sm:rounded-3xl
            shadow-sm
            p-6
            sm:p-10
            text-center
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
            Add some products before
            proceeding to checkout.
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
            GO TO SHOP
          </Link>
        </div>
      </section>
    );
  }

  // ==========================================
  // FORM CHANGE
  // ==========================================

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
  }

  // ==========================================
  // ORDER PRICING
  // ==========================================

  const {
    subtotal,
    couponDiscount,
    totalAfterCoupon,
    shipping,
    finalTotal,
  } = calculateOrderPricing({
    cart,
    coupon,
    deliveryMethod,
  });

  // ==========================================
  // VALIDATION
  // ==========================================

  function validateForm() {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name =
        "Please enter your full name.";
    }

    if (!formData.email.trim()) {
      newErrors.email =
        "Please enter your email.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formData.email
      )
    ) {
      newErrors.email =
        "Please enter a valid email.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone =
        "Please enter your phone number.";
    } else if (
      !/^[6-9]\d{9}$/.test(
        formData.phone
      )
    ) {
      newErrors.phone =
        "Enter a valid 10-digit Indian phone number.";
    }

    if (!formData.address.trim()) {
      newErrors.address =
        "Please enter your address.";
    }

    if (!formData.city.trim()) {
      newErrors.city =
        "Please enter your city.";
    }

    if (!formData.state.trim()) {
      newErrors.state =
        "Please enter your state.";
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode =
        "Please enter your pincode.";
    } else if (
      !/^\d{6}$/.test(
        formData.pincode
      )
    ) {
      newErrors.pincode =
        "Enter a valid 6-digit pincode.";
    }

    setErrors(newErrors);

    return (
      Object.keys(newErrors).length === 0
    );
  }

  // ==========================================
  // PLACE ORDER
  // ==========================================

  function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    setIsSubmitting(true);

    // ========================================
    // CREATE ORDER
    // ========================================

    const order = {
      id: `GD-${Date.now()}`,

      createdAt:
        new Date().toISOString(),

      customer: {
        ...formData,
      },

      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        selectedSize:
          item.selectedSize || null,
        selectedColor:
          item.selectedColor || null,
      })),

      pricing: {
        subtotal,
        couponDiscount,
        shipping,
        total: finalTotal,
      },

      coupon: coupon
        ? {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
          }
        : null,

      deliveryMethod,
      paymentMethod,
    };

    // ========================================
// SAVE ORDER
// ========================================

// Save latest order
localStorage.setItem(
  "gymdrobe-last-order",
  JSON.stringify(order)
);

// Save order history
const existingOrders =
  JSON.parse(
    localStorage.getItem(
      "gymdrobe-orders"
    )
  ) || [];

existingOrders.unshift(order);

localStorage.setItem(
  "gymdrobe-orders",
  JSON.stringify(existingOrders)
);

    // ========================================
    // CLEAR CART
    // ========================================

    setCart([]);

    // ========================================
    // CLEAR COUPON
    // ========================================

    localStorage.removeItem(
      "gymdrobe-coupon"
    );

    // ========================================
    // GO TO SUCCESS PAGE
    // ========================================

    setTimeout(() => {
      navigate("/order-success");
    }, 500);
  }

  // ==========================================
  // UI
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

        {/* HEADER */}

        <div className="mb-7 sm:mb-10">
          <Link
            to="/cart"
            className="
              inline-flex
              items-center
              text-sm
              sm:text-base
              text-gray-500
              hover:text-orange-600
              transition
            "
          >
            ← Back to Cart
          </Link>

          <h1
            className="
              text-3xl
              sm:text-4xl
              font-bold
              mt-3
              sm:mt-4
            "
          >
            Checkout
          </h1>

          <p
            className="
              text-sm
              sm:text-base
              text-gray-500
              mt-2
            "
          >
            Complete your details to place
            your order.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className="
              grid
              lg:grid-cols-3
              gap-5
              sm:gap-6
              lg:gap-8
            "
          >

            {/* ==================================
                LEFT SIDE
            ================================== */}

            <div
              className="
                lg:col-span-2
                space-y-4
                sm:space-y-6
              "
            >

              {/* CUSTOMER DETAILS */}

              <div
                className="
                  bg-white
                  rounded-xl
                  sm:rounded-2xl
                  p-4
                  sm:p-6
                  shadow-sm
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
                  1. Customer Details
                </h2>

                <div
                  className="
                    grid
                    sm:grid-cols-2
                    gap-4
                    sm:gap-5
                  "
                >
                  <InputField
                    label="Full Name"
                    name="name"
                    value={formData.name}
                    error={errors.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                  />

                  <InputField
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    error={errors.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                  />

                  <div className="sm:col-span-2">
                    <InputField
                      label="Phone Number"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      error={errors.phone}
                      onChange={handleChange}
                      placeholder="10-digit phone number"
                    />
                  </div>
                </div>
              </div>

              {/* ADDRESS */}

              <div
                className="
                  bg-white
                  rounded-xl
                  sm:rounded-2xl
                  p-4
                  sm:p-6
                  shadow-sm
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
                  2. Delivery Address
                </h2>

                <div className="space-y-4 sm:space-y-5">

                  <InputField
                    label="Address"
                    name="address"
                    value={formData.address}
                    error={errors.address}
                    onChange={handleChange}
                    placeholder="House number, street, area"
                  />

                  <div
                    className="
                      grid
                      sm:grid-cols-3
                      gap-4
                      sm:gap-5
                    "
                  >
                    <InputField
                      label="City"
                      name="city"
                      value={formData.city}
                      error={errors.city}
                      onChange={handleChange}
                      placeholder="City"
                    />

                    <InputField
                      label="State"
                      name="state"
                      value={formData.state}
                      error={errors.state}
                      onChange={handleChange}
                      placeholder="State"
                    />

                    <InputField
                      label="Pincode"
                      name="pincode"
                      type="text"
                      value={formData.pincode}
                      error={errors.pincode}
                      onChange={handleChange}
                      placeholder="6-digit pincode"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>

              {/* DELIVERY */}

              <div
                className="
                  bg-white
                  rounded-xl
                  sm:rounded-2xl
                  p-4
                  sm:p-6
                  shadow-sm
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
                  3. Delivery Method
                </h2>

                <div className="space-y-3 sm:space-y-4">

                  {/* STANDARD */}

                  <label
                    className={`
                      flex
                      items-center
                      justify-between
                      gap-3
                      sm:gap-4
                      border
                      rounded-xl
                      p-3.5
                      sm:p-4
                      cursor-pointer
                      transition
                      ${
                        deliveryMethod ===
                        "standard"
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-400"
                      }
                    `}
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-3
                        min-w-0
                      "
                    >
                      <input
                        type="radio"
                        name="delivery"
                        value="standard"
                        checked={
                          deliveryMethod ===
                          "standard"
                        }
                        onChange={(e) =>
                          setDeliveryMethod(
                            e.target.value
                          )
                        }
                        className="shrink-0"
                      />

                      <div className="min-w-0">
                        <p
                          className="
                            font-semibold
                            text-sm
                            sm:text-base
                          "
                        >
                          Standard Delivery
                        </p>

                        <p
                          className="
                            text-xs
                            sm:text-sm
                            text-gray-500
                            mt-0.5
                          "
                        >
                          3–7 business days
                        </p>
                      </div>
                    </div>

                    <span
                      className="
                        font-bold
                        text-sm
                        sm:text-base
                        shrink-0
                      "
                    >
                      {totalAfterCoupon >=
                      FREE_SHIPPING_LIMIT
                        ? "FREE"
                        : "₹99"}
                    </span>
                  </label>

                  {/* EXPRESS */}

                  <label
                    className={`
                      flex
                      items-center
                      justify-between
                      gap-3
                      sm:gap-4
                      border
                      rounded-xl
                      p-3.5
                      sm:p-4
                      cursor-pointer
                      transition
                      ${
                        deliveryMethod ===
                        "express"
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-400"
                      }
                    `}
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-3
                        min-w-0
                      "
                    >
                      <input
                        type="radio"
                        name="delivery"
                        value="express"
                        checked={
                          deliveryMethod ===
                          "express"
                        }
                        onChange={(e) =>
                          setDeliveryMethod(
                            e.target.value
                          )
                        }
                        className="shrink-0"
                      />

                      <div className="min-w-0">
                        <p
                          className="
                            font-semibold
                            text-sm
                            sm:text-base
                          "
                        >
                          Express Delivery
                        </p>

                        <p
                          className="
                            text-xs
                            sm:text-sm
                            text-gray-500
                            mt-0.5
                          "
                        >
                          1–3 business days
                        </p>
                      </div>
                    </div>

                    <span
                      className="
                        font-bold
                        text-sm
                        sm:text-base
                        shrink-0
                      "
                    >
                      ₹199
                    </span>
                  </label>
                </div>
              </div>

              {/* PAYMENT */}

              <div
                className="
                  bg-white
                  rounded-xl
                  sm:rounded-2xl
                  p-4
                  sm:p-6
                  shadow-sm
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
                  4. Payment Method
                </h2>

                <div className="space-y-3 sm:space-y-4">

                  {/* COD */}

                  <label
                    className={`
                      flex
                      items-start
                      gap-3
                      border
                      rounded-xl
                      p-3.5
                      sm:p-4
                      cursor-pointer
                      transition
                      ${
                        paymentMethod ===
                        "cod"
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-400"
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={
                        paymentMethod ===
                        "cod"
                      }
                      onChange={(e) =>
                        setPaymentMethod(
                          e.target.value
                        )
                      }
                      className="mt-1 shrink-0"
                    />

                    <div className="min-w-0">
                      <p
                        className="
                          font-semibold
                          text-sm
                          sm:text-base
                        "
                      >
                        Cash on Delivery
                      </p>

                      <p
                        className="
                          text-xs
                          sm:text-sm
                          text-gray-500
                          mt-0.5
                        "
                      >
                        Pay when your order
                        arrives.
                      </p>
                    </div>
                  </label>

                  {/* ONLINE */}

                  <label
                    className={`
                      flex
                      items-start
                      gap-3
                      border
                      rounded-xl
                      p-3.5
                      sm:p-4
                      cursor-pointer
                      transition
                      ${
                        paymentMethod ===
                        "online"
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-400"
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="online"
                      checked={
                        paymentMethod ===
                        "online"
                      }
                      onChange={(e) =>
                        setPaymentMethod(
                          e.target.value
                        )
                      }
                      className="mt-1 shrink-0"
                    />

                    <div className="min-w-0">
                      <p
                        className="
                          font-semibold
                          text-sm
                          sm:text-base
                        "
                      >
                        Online Payment
                      </p>

                      <p
                        className="
                          text-xs
                          sm:text-sm
                          text-gray-500
                          mt-0.5
                        "
                      >
                        Payment gateway will be
                        connected later.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* ==================================
                ORDER SUMMARY
            ================================== */}

            <div>
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

                {/* ITEMS */}

                <div
                  className="
                    space-y-3
                    sm:space-y-4
                    mb-5
                    sm:mb-6
                    max-h-[420px]
                    overflow-y-auto
                    pr-1
                  "
                >
                  {cart.map((item) => (
                    <div
                      key={`${item.id}-${item.selectedSize}-${item.selectedColor}`}
                      className="
                        flex
                        gap-3
                      "
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="
                          w-14
                          h-14
                          sm:w-16
                          sm:h-16
                          rounded-lg
                          object-cover
                          bg-gray-100
                          shrink-0
                        "
                      />

                      <div
                        className="
                          flex-1
                          min-w-0
                        "
                      >
                        <p
                          className="
                            font-semibold
                            text-xs
                            sm:text-sm
                            line-clamp-2
                          "
                        >
                          {item.name}
                        </p>

                        <p
                          className="
                            text-[11px]
                            sm:text-xs
                            text-gray-500
                            mt-1
                          "
                        >
                          Qty: {item.quantity}
                        </p>

                        {item.selectedSize && (
                          <p
                            className="
                              text-[11px]
                              sm:text-xs
                              text-gray-500
                            "
                          >
                            Size:{" "}
                            {item.selectedSize}
                          </p>
                        )}

                        {item.selectedColor && (
                          <p
                            className="
                              text-[11px]
                              sm:text-xs
                              text-gray-500
                            "
                          >
                            Color:{" "}
                            {item.selectedColor}
                          </p>
                        )}
                      </div>

                      <p
                        className="
                          font-semibold
                          text-xs
                          sm:text-sm
                          shrink-0
                        "
                      >
                        ₹
                        {(
                          item.price *
                          item.quantity
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {/* PRICES */}

                <div
                  className="
                    border-t
                    border-gray-200
                    pt-4
                    sm:pt-5
                    space-y-3
                    sm:space-y-4
                    text-sm
                    sm:text-base
                  "
                >
                  <div className="flex justify-between gap-4">
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

                  {couponDiscount > 0 && (
                    <div
                      className="
                        flex
                        justify-between
                        gap-4
                        text-green-600
                      "
                    >
                      <span>
                        Coupon{" "}
                        {coupon?.code}
                      </span>

                      <span className="font-semibold">
                        -₹
                        {couponDiscount.toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">
                      Delivery
                    </span>

                    <span className="font-semibold">
                      {shipping === 0
                        ? "FREE"
                        : `₹${shipping}`}
                    </span>
                  </div>
                </div>

                {/* TOTAL */}

                <div
                  className="
                    border-t
                    border-gray-200
                    mt-5
                    pt-5
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

                {/* PLACE ORDER */}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="
                    w-full
                    bg-orange-600
                    hover:bg-orange-700
                    disabled:bg-gray-400
                    disabled:cursor-not-allowed
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
                  {isSubmitting
                    ? "PLACING ORDER..."
                    : "PLACE ORDER"}
                </button>

                <p
                  className="
                    text-[10px]
                    sm:text-xs
                    text-gray-500
                    text-center
                    mt-3
                    sm:mt-4
                    leading-5
                  "
                >
                  By placing this order,
                  you agree to our terms and
                  conditions.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

export default CheckoutPage;