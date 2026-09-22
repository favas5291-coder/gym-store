

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

import {
  getCartItemKey,
  getVariantStock,
  revalidateCart,
} from "../utils/cartUtils";

import products from "../data/products";

import { useAuth } from "../context/AuthContext";

// ==========================================
// CONSTANTS
// ==========================================

const ADDRESS_STORAGE_KEY =
  "gymdrobe-addresses";

const CHECKOUT_STORAGE_KEY =
  "gymdrobe-checkout-details";

const COUPON_STORAGE_KEY =
  "gymdrobe-coupon";

const ORDERS_STORAGE_KEY =
  "gymdrobe-orders";

const LAST_ORDER_STORAGE_KEY =
  "gymdrobe-last-order";

const LAST_ADDRESS_STORAGE_KEY =
  "gymdrobe-last-address";

// ==========================================
// USER STORAGE KEY
// ==========================================

function getUserStorageKey(baseKey, user) {
  const userId = String(
    user?.id ||
      user?.email ||
      ""
  )
    .trim()
    .toLowerCase();

  if (!userId) {
    return `${baseKey}:guest`;
  }

  return `${baseKey}:${userId}`;
}

// ==========================================
// EMPTY FORM
// ==========================================

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

// ==========================================
// GET SAVED ADDRESSES
// ==========================================

function getSavedAddresses(user) {
  if (!user) {
    return [];
  }

  try {
    const storageKey =
      getUserStorageKey(
        ADDRESS_STORAGE_KEY,
        user
      );

    const saved =
      localStorage.getItem(
        storageKey
      );

    const parsed = saved
      ? JSON.parse(saved)
      : [];

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

// ==========================================
// GET SAVED CHECKOUT DETAILS
// ==========================================

function getSavedCheckoutDetails(user) {
  try {
    const storageKey =
      getUserStorageKey(
        CHECKOUT_STORAGE_KEY,
        user
      );

    const saved =
      localStorage.getItem(
        storageKey
      );

    if (!saved) {
      return {
        ...EMPTY_FORM,
      };
    }

    const parsed =
      JSON.parse(saved);

    return {
      ...EMPTY_FORM,
      ...(parsed || {}),
    };
  } catch {
    return {
      ...EMPTY_FORM,
    };
  }
}

// ==========================================
// INPUT FIELD
// ==========================================

function InputField({
  label,
  name,
  type = "text",
  value,
  error,
  onChange,
  placeholder,
  inputMode,
  maxLength,
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
        maxLength={maxLength}
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

// ==========================================
// CHECKOUT PAGE
// ==========================================

function CheckoutPage({
  cart,
  setCart,
  buyNowItem,
  clearBuyNow,
}) {
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
  } = useAuth();

  // ==========================================
  // CUSTOMER FORM
  // ==========================================

  const [formData, setFormData] =
    useState(() =>
      getSavedCheckoutDetails(user)
    );

  // ==========================================
  // SAVED ADDRESSES
  // ==========================================

  const [savedAddresses, setSavedAddresses] =
    useState(() =>
      getSavedAddresses(user)
    );

  // ==========================================
  // SELECTED ADDRESS
  // ==========================================

  const [selectedAddressId, setSelectedAddressId] =
    useState(null);

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

  const [errors, setErrors] =
    useState({});

  // ==========================================
  // CHECKOUT ERROR
  // ==========================================

  const [checkoutError, setCheckoutError] =
    useState("");

  // ==========================================
  // SUBMITTING
  // ==========================================

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // ==========================================
  // COUPON
  // ==========================================

  const [coupon, setCoupon] =
    useState(null);

  // ==========================================
  // CHECKOUT ITEMS
  // ==========================================

  const checkoutItems = useMemo(() => {
    if (buyNowItem) {
      return [buyNowItem];
    }

    return cart;
  }, [buyNowItem, cart]);

  // ==========================================
  // BUY NOW MODE
  // ==========================================

  const isBuyNowCheckout =
    Boolean(buyNowItem);

  // ==========================================
  // LOAD USER DATA WHEN USER CHANGES
  // ==========================================

  useEffect(() => {
    if (!user) {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      setFormData({
        ...EMPTY_FORM,
      });
      return;
    }

    const addresses =
      getSavedAddresses(user);

    setSavedAddresses(addresses);

    setFormData(
      getSavedCheckoutDetails(user)
    );

    setSelectedAddressId(null);
    setErrors({});
    setCheckoutError("");
  }, [user]);

  // ==========================================
  // LOAD COUPON
  // ==========================================

  useEffect(() => {
    const savedCoupon =
      localStorage.getItem(
        COUPON_STORAGE_KEY
      );

    if (!savedCoupon) {
      return;
    }

    try {
      const parsedCoupon =
        JSON.parse(savedCoupon);

      const code =
        parsedCoupon?.code?.toUpperCase();

      const validCoupon =
        code
          ? COUPONS[code]
          : null;

      if (validCoupon) {
        setCoupon(validCoupon);
      } else {
        localStorage.removeItem(
          COUPON_STORAGE_KEY
        );
      }
    } catch {
      localStorage.removeItem(
        COUPON_STORAGE_KEY
      );
    }
  }, []);

  // ==========================================
  // AUTO SELECT DEFAULT ADDRESS
  // ==========================================

  useEffect(() => {
    if (
      !isAuthenticated ||
      savedAddresses.length === 0
    ) {
      return;
    }

    if (
      selectedAddressId &&
      savedAddresses.some(
        (address) =>
          String(address.id) ===
          String(selectedAddressId)
      )
    ) {
      return;
    }

    const defaultAddress =
      savedAddresses.find(
        (address) =>
          address.isDefault === true
      );

    const addressToUse =
      defaultAddress ||
      savedAddresses[0];

    if (addressToUse) {
      setSelectedAddressId(
        addressToUse.id
      );
    }
  }, [
    isAuthenticated,
    savedAddresses,
    selectedAddressId,
  ]);

  // ==========================================
  // AUTO FILL LOGGED-IN USER
  // ==========================================

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData((current) => ({
      ...current,

      name:
        current.name ||
        user.name ||
        "",

      email:
        current.email ||
        user.email ||
        "",

      phone:
        current.phone ||
        user.phone ||
        "",
    }));
  }, [user]);

  // ==========================================
  // APPLY SELECTED ADDRESS
  // ==========================================

  useEffect(() => {
    if (
      !selectedAddressId ||
      !savedAddresses.length
    ) {
      return;
    }

    const selectedAddress =
      savedAddresses.find(
        (address) =>
          String(address.id) ===
          String(selectedAddressId)
      );

    if (!selectedAddress) {
      return;
    }

    setFormData((current) => ({
      ...current,

      name:
        selectedAddress.fullName ||
        current.name ||
        user?.name ||
        "",

      phone:
        selectedAddress.phone ||
        current.phone ||
        user?.phone ||
        "",

      email:
        current.email ||
        user?.email ||
        "",

      address:
        selectedAddress.addressLine ||
        "",

      city:
        selectedAddress.city ||
        "",

      state:
        selectedAddress.state ||
        "",

      pincode:
        selectedAddress.pincode ||
        "",
    }));

    setErrors({});
    setCheckoutError("");
  }, [
    selectedAddressId,
    savedAddresses,
    user,
  ]);

  // ==========================================
  // SAVE CHECKOUT DETAILS
  // ==========================================

  useEffect(() => {
    if (!user) {
      return;
    }

    try {
      const storageKey =
        getUserStorageKey(
          CHECKOUT_STORAGE_KEY,
          user
        );

      localStorage.setItem(
        storageKey,
        JSON.stringify(formData)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [formData, user]);

  // ==========================================
  // SAVE ADDRESS STORAGE
  // ==========================================

  useEffect(() => {
    if (!user) {
      return;
    }

    try {
      const storageKey =
        getUserStorageKey(
          ADDRESS_STORAGE_KEY,
          user
        );

      localStorage.setItem(
        storageKey,
        JSON.stringify(savedAddresses)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [
    savedAddresses,
    user,
  ]);

  // ==========================================
  // REVALIDATE NORMAL CART
  // ==========================================

  useEffect(() => {
    if (isBuyNowCheckout) {
      return;
    }

    const result =
      revalidateCart(
        cart,
        products
      );

    if (
      JSON.stringify(result.cart) !==
      JSON.stringify(cart)
    ) {
      setCart(result.cart);
    }
  }, [
    cart,
    setCart,
    isBuyNowCheckout,
  ]);

  // ==========================================
  // CHECKOUT ITEMS VALIDATION
  // ==========================================

  const checkoutValidation =
    useMemo(() => {
      if (!checkoutItems.length) {
        return {
          valid: false,
          message:
            "Your checkout is empty.",
        };
      }

      for (const item of checkoutItems) {
        const product =
          products.find(
            (productItem) =>
              String(productItem.id) ===
              String(item.id)
          );

        if (!product) {
          return {
            valid: false,
            message:
              `${item.name} is no longer available.`,
          };
        }

        const stock =
          getVariantStock(
            product,
            item.selectedSize ?? null,
            item.selectedColor ?? null
          );

        const quantity =
          Number(
            item.quantity || 0
          );

        if (stock <= 0) {
          return {
            valid: false,
            message:
              `${item.name} is out of stock.`,
          };
        }

        if (quantity <= 0) {
          return {
            valid: false,
            message:
              `Invalid quantity for ${item.name}.`,
          };
        }

        if (quantity > stock) {
          return {
            valid: false,
            message:
              `Only ${stock} unit${
                stock === 1
                  ? ""
                  : "s"
              } of ${item.name} available.`,
          };
        }
      }

      return {
        valid: true,
        message: "",
      };
    }, [checkoutItems]);

  // ==========================================
  // ORDER PRICING
  // ==========================================

  const {
    subtotal,
    couponDiscount,
    totalAfterCoupon,
    shipping,
    finalTotal,
  } = useMemo(() => {
    return calculateOrderPricing({
      cart: checkoutItems,
      coupon,
      deliveryMethod,
    });
  }, [
    checkoutItems,
    coupon,
    deliveryMethod,
  ]);

  // ==========================================
  // HANDLE FORM CHANGE
  // ==========================================

  function handleChange(e) {
    const {
      name,
      value,
    } = e.target;

    let nextValue = value;

    // PHONE
    if (name === "phone") {
      nextValue = value
        .replace(/\D/g, "")
        .slice(0, 10);
    }

    // PINCODE
    if (name === "pincode") {
      nextValue = value
        .replace(/\D/g, "")
        .slice(0, 6);
    }

    // NAME
    if (name === "name") {
      nextValue =
        value.slice(0, 80);
    }

    setFormData((current) => ({
      ...current,
      [name]: nextValue,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));

    setCheckoutError("");

    // Manual editing means
    // no saved address is selected.
    if (
      [
        "name",
        "phone",
        "address",
        "city",
        "state",
        "pincode",
      ].includes(name)
    ) {
      setSelectedAddressId(null);
    }
  }

  // ==========================================
  // SELECT SAVED ADDRESS
  // ==========================================

  function handleSelectAddress(address) {
    if (!address) {
      return;
    }

    setSelectedAddressId(
      address.id
    );

    setCheckoutError("");
    setErrors({});
  }

  // ==========================================
  // USE MANUAL ADDRESS
  // ==========================================

  function handleUseManualAddress() {
    setSelectedAddressId(null);

    setErrors({});
    setCheckoutError("");
  }

  // ==========================================
  // VALIDATE FORM
  // ==========================================

  function validateForm() {
    const newErrors = {};

    // NAME
    if (!formData.name.trim()) {
      newErrors.name =
        "Please enter your full name.";
    } else if (
      formData.name.trim().length < 3
    ) {
      newErrors.name =
        "Name must contain at least 3 characters.";
    }

    // EMAIL
    if (!formData.email.trim()) {
      newErrors.email =
        "Please enter your email.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formData.email.trim()
      )
    ) {
      newErrors.email =
        "Please enter a valid email.";
    }

    // PHONE
    if (!formData.phone.trim()) {
      newErrors.phone =
        "Please enter your phone number.";
    } else if (
      !/^[6-9]\d{9}$/.test(
        formData.phone.trim()
      )
    ) {
      newErrors.phone =
        "Enter a valid 10-digit Indian phone number.";
    }

    // ADDRESS
    if (!formData.address.trim()) {
      newErrors.address =
        "Please enter your address.";
    } else if (
      formData.address.trim().length < 5
    ) {
      newErrors.address =
        "Please enter a more complete address.";
    }

    // CITY
    if (!formData.city.trim()) {
      newErrors.city =
        "Please enter your city.";
    }

    // STATE
    if (!formData.state.trim()) {
      newErrors.state =
        "Please enter your state.";
    }

    // PINCODE
    if (!formData.pincode.trim()) {
      newErrors.pincode =
        "Please enter your pincode.";
    } else if (
      !/^\d{6}$/.test(
        formData.pincode.trim()
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
  // SAVE CURRENT ADDRESS
  // ==========================================

  function saveCurrentAddress() {
    if (!isAuthenticated || !user) {
      return null;
    }

    const addressData = {
      fullName:
        formData.name.trim(),

      phone:
        formData.phone.trim(),

      addressLine:
        formData.address.trim(),

      city:
        formData.city.trim(),

      state:
        formData.state.trim(),

      pincode:
        formData.pincode.trim(),

      landmark: "",
    };

    const matchingAddress =
      savedAddresses.find(
        (address) =>
          address.fullName ===
            addressData.fullName &&
          address.phone ===
            addressData.phone &&
          address.addressLine ===
            addressData.addressLine &&
          address.city ===
            addressData.city &&
          address.state ===
            addressData.state &&
          address.pincode ===
            addressData.pincode
      );

    if (matchingAddress) {
      return matchingAddress;
    }

    const newAddress = {
      id: Date.now(),

      ...addressData,

      userId:
        user?.id || null,

      userEmail:
        user?.email || "",

      isDefault:
        savedAddresses.length === 0,
    };

    setSavedAddresses((current) => [
      ...current,
      newAddress,
    ]);

    return newAddress;
  }

  // ==========================================
  // PLACE ORDER
  // ==========================================

  function handleSubmit(e) {
    e.preventDefault();

    // PREVENT DOUBLE SUBMISSION
    if (isSubmitting) {
      return;
    }

    setCheckoutError("");

    // CHECK ITEMS
    if (!checkoutValidation.valid) {
      setCheckoutError(
        checkoutValidation.message
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    // FORM VALIDATION
    if (!validateForm()) {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    // FINAL CART REVALIDATION
    if (!isBuyNowCheckout) {
      const result =
        revalidateCart(
          cart,
          products
        );

      if (
        JSON.stringify(result.cart) !==
        JSON.stringify(cart)
      ) {
        setCart(result.cart);

        setCheckoutError(
          "Some cart items changed because stock was updated. Please review your cart before placing the order."
        );

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });

        return;
      }
    }

    // FINAL COUPON VALIDATION
    let validCoupon = null;

    if (coupon) {
      const couponCode =
        coupon.code?.toUpperCase();

      validCoupon =
        couponCode
          ? COUPONS[couponCode]
          : null;

      if (!validCoupon) {
        setCoupon(null);

        localStorage.removeItem(
          COUPON_STORAGE_KEY
        );

        setCheckoutError(
          "The applied coupon is no longer valid. Please review your order."
        );

        return;
      }

      if (
        subtotal <
        validCoupon.minimum
      ) {
        setCoupon(null);

        localStorage.removeItem(
          COUPON_STORAGE_KEY
        );

        setCheckoutError(
          `Coupon ${validCoupon.code} requires a minimum order value of ₹${validCoupon.minimum.toLocaleString(
            "en-IN"
          )}.`
        );

        return;
      }
    }

    // START SUBMISSION
    setIsSubmitting(true);

    // CREATE ORDER ITEMS
    const orderItems =
      checkoutItems.map((item) => ({
        id: item.id,

        name: item.name,

        image:
          item.image ||
          item.images?.[0] ||
          "",

        category:
          item.category || "",

        price:
          Number(item.price || 0),

        quantity:
          Number(
            item.quantity || 1
          ),

        selectedSize:
          item.selectedSize ?? null,

        selectedColor:
          item.selectedColor ?? null,

        itemKey:
          getCartItemKey(item),
      }));

    // DELIVERY INFORMATION
    const deliveryInfo = {
      method: deliveryMethod,

      label:
        deliveryMethod ===
        "express"
          ? "Express Delivery"
          : "Standard Delivery",

      estimatedTime:
        deliveryMethod ===
        "express"
          ? "1–3 business days"
          : "3–7 business days",

      charge: shipping,
    };

    // PAYMENT INFORMATION
    const paymentInfo = {
      method: paymentMethod,

      status: "pending",

      transactionId: null,
    };

    // ORDER STATUS
    const orderStatus =
      paymentMethod === "online"
        ? "payment-pending"
        : "confirmed";

    // SAVE ADDRESS
    const savedAddress =
      saveCurrentAddress();

    // CREATE ORDER
    const order = {
      id: `GD-${Date.now()}`,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),

      status: orderStatus,

      source:
        isBuyNowCheckout
          ? "buy-now"
          : "cart",

      // USER
      user: isAuthenticated
        ? {
            id:
              user?.id || null,

            name:
              user?.name ||
              formData.name.trim(),

            email:
              user?.email ||
              formData.email
                .trim()
                .toLowerCase(),
          }
        : null,

      // CUSTOMER
      customer: {
        name:
          formData.name.trim(),

        email:
          formData.email
            .trim()
            .toLowerCase(),

        phone:
          formData.phone.trim(),
      },

      // SHIPPING ADDRESS
      shippingAddress: {
        id:
          savedAddress?.id ||
          selectedAddressId ||
          null,

        name:
          formData.name.trim(),

        phone:
          formData.phone.trim(),

        address:
          formData.address.trim(),

        city:
          formData.city.trim(),

        state:
          formData.state.trim(),

        pincode:
          formData.pincode.trim(),

        landmark:
          savedAddress?.landmark ||
          "",
      },

      // ITEMS
      items: orderItems,

      // PRICING
      pricing: {
        subtotal,

        couponDiscount,

        shipping,

        totalAfterCoupon,

        finalTotal,

        total: finalTotal,
      },

      // COUPON
      coupon: validCoupon
        ? {
            code:
              validCoupon.code,

            type:
              validCoupon.type,

            value:
              validCoupon.value,

            minimum:
              validCoupon.minimum,

            discount:
              couponDiscount,
          }
        : null,

      // DELIVERY
      delivery:
        deliveryInfo,

      deliveryMethod,

      // PAYMENT
      payment:
        paymentInfo,

      paymentMethod,

      // REFUND
      refund: {
        status: "not-requested",

        amount: 0,

        requestedAt: null,

        processedAt: null,
      },

      // CANCELLATION
      cancellation: {
        status: "not-cancelled",

        reason: "",

        cancelledAt: null,
      },

      // RETURN
      returnRequest: {
        status: "not-requested",

        reason: "",

        requestedAt: null,

        approvedAt: null,

        completedAt: null,
      },
    };

    // SAVE LAST ORDER
    try {
      const lastOrderKey =
        getUserStorageKey(
          LAST_ORDER_STORAGE_KEY,
          user
        );

      localStorage.setItem(
        lastOrderKey,
        JSON.stringify(order)
      );
    } catch {
      // Ignore storage errors.
    }

    // LOAD EXISTING ORDERS
    let existingOrders = [];

    try {
      const savedOrders =
        localStorage.getItem(
          ORDERS_STORAGE_KEY
        );

      existingOrders =
        savedOrders
          ? JSON.parse(savedOrders)
          : [];

      if (
        !Array.isArray(
          existingOrders
        )
      ) {
        existingOrders = [];
      }
    } catch {
      existingOrders = [];
    }

    // SAVE ORDER HISTORY
    existingOrders.unshift(order);

    try {
      localStorage.setItem(
        ORDERS_STORAGE_KEY,
        JSON.stringify(
          existingOrders
        )
      );
    } catch {
      // Ignore storage errors.
    }

    // SAVE LAST ADDRESS
    try {
      const lastAddressKey =
        getUserStorageKey(
          LAST_ADDRESS_STORAGE_KEY,
          user
        );

      localStorage.setItem(
        lastAddressKey,
        JSON.stringify({
          name:
            formData.name.trim(),

          email:
            formData.email
              .trim()
              .toLowerCase(),

          phone:
            formData.phone.trim(),

          address:
            formData.address.trim(),

          city:
            formData.city.trim(),

          state:
            formData.state.trim(),

          pincode:
            formData.pincode.trim(),
        })
      );
    } catch {
      // Ignore storage errors.
    }

    // CLEAR CHECKOUT SOURCE
    if (isBuyNowCheckout) {
      clearBuyNow?.();
    } else {
      setCart([]);
    }

    // CLEAR COUPON
    localStorage.removeItem(
      COUPON_STORAGE_KEY
    );

    // GO TO SUCCESS PAGE
    setTimeout(() => {
      navigate(
        "/order-success"
      );
    }, 500);
  }

  // ==========================================
  // EMPTY CHECKOUT
  // ==========================================

  if (checkoutItems.length === 0) {
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
            Your checkout is empty
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
  // MAIN UI
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
            to={
              isBuyNowCheckout
                ? `/product/${buyNowItem.id}`
                : "/cart"
            }
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
            ←{" "}
            {isBuyNowCheckout
              ? "Back to Product"
              : "Back to Cart"}
          </Link>

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
              mt-3
              sm:mt-4
            "
          >
            <h1
              className="
                text-3xl
                sm:text-4xl
                font-bold
              "
            >
              Checkout
            </h1>

            {isBuyNowCheckout && (
              <span
                className="
                  bg-gray-900
                  text-white
                  text-xs
                  font-bold
                  px-3
                  py-1.5
                  rounded-full
                "
              >
                BUY NOW
              </span>
            )}
          </div>

          <p
            className="
              text-sm
              sm:text-base
              text-gray-500
              mt-2
            "
          >
            Complete your details
            to place your order.
          </p>
        </div>

        {/* CHECKOUT ERROR */}

        {checkoutError && (
          <div
            className="
              mb-5
              sm:mb-6
              bg-red-50
              border
              border-red-200
              text-red-700
              rounded-xl
              p-4
              text-sm
            "
          >
            {checkoutError}
          </div>
        )}

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          noValidate
        >
          <div
            className="
              grid
              lg:grid-cols-3
              gap-5
              sm:gap-6
              lg:gap-8
            "
          >

            {/* LEFT SIDE */}

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
                    value={
                      formData.name
                    }
                    error={
                      errors.name
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Your full name"
                  />

                  <InputField
                    label="Email"
                    name="email"
                    type="email"
                    value={
                      formData.email
                    }
                    error={
                      errors.email
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="you@example.com"
                  />

                  <div className="sm:col-span-2">
                    <InputField
                      label="Phone Number"
                      name="phone"
                      type="tel"
                      value={
                        formData.phone
                      }
                      error={
                        errors.phone
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="10-digit phone number"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* SAVED ADDRESSES */}

              {isAuthenticated &&
                savedAddresses.length > 0 && (
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
                    <div
                      className="
                        flex
                        flex-wrap
                        items-center
                        justify-between
                        gap-3
                        mb-5
                      "
                    >
                      <div>
                        <h2
                          className="
                            text-lg
                            sm:text-xl
                            font-bold
                          "
                        >
                          Saved Addresses
                        </h2>

                        <p
                          className="
                            text-xs
                            sm:text-sm
                            text-gray-500
                            mt-1
                          "
                        >
                          Choose where you
                          want your order
                          delivered.
                        </p>
                      </div>

                      <Link
                        to="/addresses"
                        className="
                          text-sm
                          font-semibold
                          text-orange-600
                          hover:text-orange-700
                        "
                      >
                        Manage
                      </Link>
                    </div>

                    <div
                      className="
                        grid
                        md:grid-cols-2
                        gap-3
                      "
                    >
                      {savedAddresses.map(
                        (address) => {
                          const isSelected =
                            String(
                              selectedAddressId
                            ) ===
                            String(
                              address.id
                            );

                          return (
                            <button
                              key={
                                address.id
                              }
                              type="button"
                              onClick={() =>
                                handleSelectAddress(
                                  address
                                )
                              }
                              className={`
                                text-left
                                border
                                rounded-xl
                                p-4
                                transition
                                ${
                                  isSelected
                                    ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
                                    : "border-gray-200 hover:border-gray-400"
                                }
                              `}
                            >
                              <div
                                className="
                                  flex
                                  items-start
                                  justify-between
                                  gap-3
                                "
                              >
                                <div>
                                  <p
                                    className="
                                      font-bold
                                      text-sm
                                    "
                                  >
                                    {
                                      address.fullName
                                    }
                                  </p>

                                  <p
                                    className="
                                      text-xs
                                      text-gray-500
                                      mt-1
                                    "
                                  >
                                    {
                                      address.phone
                                    }
                                  </p>
                                </div>

                                {address.isDefault && (
                                  <span
                                    className="
                                      text-[10px]
                                      font-bold
                                      bg-green-100
                                      text-green-700
                                      px-2
                                      py-1
                                      rounded-full
                                      shrink-0
                                    "
                                  >
                                    DEFAULT
                                  </span>
                                )}
                              </div>

                              <p
                                className="
                                  text-sm
                                  text-gray-600
                                  mt-3
                                  leading-5
                                "
                              >
                                {
                                  address.addressLine
                                }
                              </p>

                              <p
                                className="
                                  text-sm
                                  text-gray-600
                                  mt-1
                                "
                              >
                                {
                                  address.city
                                }
                                ,{" "}
                                {
                                  address.state
                                }{" "}
                                -{" "}
                                {
                                  address.pincode
                                }
                              </p>

                              {isSelected && (
                                <p
                                  className="
                                    text-xs
                                    font-bold
                                    text-orange-600
                                    mt-3
                                  "
                                >
                                  ✓ Selected
                                </p>
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>

                    {selectedAddressId && (
                      <button
                        type="button"
                        onClick={
                          handleUseManualAddress
                        }
                        className="
                          mt-4
                          text-sm
                          font-semibold
                          text-gray-600
                          hover:text-black
                        "
                      >
                        Use a different /
                        manual address
                      </button>
                    )}
                  </div>
                )}

              {/* DELIVERY ADDRESS */}

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
                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    justify-between
                    gap-3
                    mb-5
                    sm:mb-6
                  "
                >
                  <div>
                    <h2
                      className="
                        text-lg
                        sm:text-xl
                        font-bold
                      "
                    >
                      2. Delivery Address
                    </h2>

                    <p
                      className="
                        text-xs
                        sm:text-sm
                        text-gray-500
                        mt-1
                      "
                    >
                      {selectedAddressId
                        ? "Using your selected saved address."
                        : "Enter your delivery address."}
                    </p>
                  </div>

                  <Link
                    to="/addresses"
                    className="
                      text-sm
                      font-semibold
                      text-orange-600
                      hover:text-orange-700
                    "
                  >
                    + Add Address
                  </Link>
                </div>

                <div
                  className="
                    space-y-4
                    sm:space-y-5
                  "
                >
                  <InputField
                    label="Address"
                    name="address"
                    value={
                      formData.address
                    }
                    error={
                      errors.address
                    }
                    onChange={
                      handleChange
                    }
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
                      value={
                        formData.city
                      }
                      error={
                        errors.city
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="City"
                    />

                    <InputField
                      label="State"
                      name="state"
                      value={
                        formData.state
                      }
                      error={
                        errors.state
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="State"
                    />

                    <InputField
                      label="Pincode"
                      name="pincode"
                      value={
                        formData.pincode
                      }
                      error={
                        errors.pincode
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="6-digit pincode"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </div>
                </div>
              </div>

              {/* DELIVERY METHOD */}

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

                <div
                  className="
                    space-y-3
                    sm:space-y-4
                  "
                >

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

              {/* PAYMENT METHOD */}

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

                <div
                  className="
                    space-y-3
                    sm:space-y-4
                  "
                >

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
                      className="
                        mt-1
                        shrink-0
                      "
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
                        Pay when your
                        order arrives.
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
                      className="
                        mt-1
                        shrink-0
                      "
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
                        Secure payment
                        gateway integration
                        will be connected
                        later.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE */}

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

                {/* SUMMARY HEADER */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    mb-5
                    sm:mb-6
                  "
                >
                  <h2
                    className="
                      text-lg
                      sm:text-xl
                      font-bold
                    "
                  >
                    Order Summary
                  </h2>

                  <span
                    className="
                      text-[10px]
                      sm:text-xs
                      font-bold
                      bg-gray-900
                      text-white
                      px-2.5
                      py-1
                      rounded-full
                    "
                  >
                    {checkoutItems.length}{" "}
                    {checkoutItems.length ===
                    1
                      ? "ITEM"
                      : "ITEMS"}
                  </span>
                </div>

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
                  {checkoutItems.map(
                    (item) => (
                      <div
                        key={getCartItemKey(
                          item
                        )}
                        className="
                          flex
                          gap-3
                        "
                      >
                        <img
                          src={
                            item.image ||
                            item.images?.[0]
                          }
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
                            Qty:{" "}
                            {item.quantity}
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
                              {
                                item.selectedSize
                              }
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
                              {
                                item.selectedColor
                              }
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
                            Number(
                              item.price ||
                                0
                            ) *
                            Number(
                              item.quantity ||
                                1
                            )
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>

                {/* FREE SHIPPING */}

                {deliveryMethod ===
                  "standard" &&
                  totalAfterCoupon <
                    FREE_SHIPPING_LIMIT && (
                    <div
                      className="
                        bg-gray-50
                        rounded-xl
                        p-3
                        mb-5
                        text-xs
                        sm:text-sm
                        text-gray-600
                      "
                    >
                      Add ₹
                      {(
                        FREE_SHIPPING_LIMIT -
                        totalAfterCoupon
                      ).toLocaleString(
                        "en-IN"
                      )}{" "}
                      more to unlock
                      free standard
                      delivery.
                    </div>
                  )}

                {deliveryMethod ===
                  "standard" &&
                  totalAfterCoupon >=
                    FREE_SHIPPING_LIMIT && (
                    <div
                      className="
                        bg-green-50
                        border
                        border-green-100
                        rounded-xl
                        p-3
                        mb-5
                        text-xs
                        sm:text-sm
                        text-green-700
                      "
                    >
                      🎉 Free standard
                      delivery unlocked!
                    </div>
                  )}

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

                  {/* SUBTOTAL */}

                  <div
                    className="
                      flex
                      justify-between
                      gap-4
                    "
                  >
                    <span
                      className="
                        text-gray-500
                      "
                    >
                      Subtotal
                    </span>

                    <span
                      className="
                        font-semibold
                      "
                    >
                      ₹
                      {subtotal.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  </div>

                  {/* COUPON */}

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

                      <span
                        className="
                          font-semibold
                        "
                      >
                        -₹
                        {couponDiscount.toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    </div>
                  )}

                  {/* DELIVERY */}

                  <div
                    className="
                      flex
                      justify-between
                      gap-4
                    "
                  >
                    <span
                      className="
                        text-gray-500
                      "
                    >
                      Delivery
                    </span>

                    <span
                      className="
                        font-semibold
                      "
                    >
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

                {/* PAYMENT NOTE */}

                {paymentMethod ===
                  "cod" && (
                  <div
                    className="
                      mt-4
                      bg-gray-50
                      rounded-xl
                      p-3
                      text-xs
                      sm:text-sm
                      text-gray-600
                    "
                  >
                    💵 You will pay when
                    the order is delivered.
                  </div>
                )}

                {paymentMethod ===
                  "online" && (
                  <div
                    className="
                      mt-4
                      bg-gray-50
                      rounded-xl
                      p-3
                      text-xs
                      sm:text-sm
                      text-gray-600
                    "
                  >
                    🔒 Online payment will
                    be securely processed
                    after the payment gateway
                    is connected.
                  </div>
                )}

                {/* PLACE ORDER */}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !checkoutValidation.valid
                  }
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
                    : paymentMethod ===
                      "online"
                    ? "CONTINUE TO PAYMENT"
                    : "PLACE ORDER"}
                </button>

                {/* TERMS */}

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
                  you agree to our terms
                  and conditions.
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
