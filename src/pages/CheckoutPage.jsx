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
  getDiscountedPrice,
  getVariantStock,
  revalidateCart,
  validateCartItem,
} from "../utils/cartUtils";

import products from "../data/products";

import { useAuth } from "../context/AuthContext";

/* =========================================================
   STORAGE KEYS
========================================================= */

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

/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

/* =========================================================
   STORAGE HELPERS
========================================================= */

function getUserStorageKey(
  baseKey,
  user
) {
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

function readStorage(
  key,
  fallback = null
) {
  try {
    const saved =
      localStorage.getItem(
        key
      );

    if (!saved) {
      return fallback;
    }

    return JSON.parse(
      saved
    );
  } catch {
    return fallback;
  }
}

/* =========================================================
   SAVED ADDRESSES

   Supports the new user-scoped storage and also falls
   back to your older gymdrobe-addresses data.
========================================================= */

function getSavedAddresses(
  user
) {
  if (!user) {
    return [];
  }

  const scopedKey =
    getUserStorageKey(
      ADDRESS_STORAGE_KEY,
      user
    );

  const scopedAddresses =
    readStorage(
      scopedKey,
      []
    );

  if (
    Array.isArray(
      scopedAddresses
    ) &&
    scopedAddresses.length >
      0
  ) {
    return scopedAddresses;
  }

  const legacyAddresses =
    readStorage(
      ADDRESS_STORAGE_KEY,
      []
    );

  if (
    !Array.isArray(
      legacyAddresses
    )
  ) {
    return [];
  }

  return legacyAddresses;
}

/* =========================================================
   SAVED CHECKOUT DETAILS
========================================================= */

function getSavedCheckoutDetails(
  user
) {
  const storageKey =
    getUserStorageKey(
      CHECKOUT_STORAGE_KEY,
      user
    );

  const saved =
    readStorage(
      storageKey,
      null
    );

  if (
    !saved ||
    typeof saved !==
      "object"
  ) {
    return {
      ...EMPTY_FORM,
    };
  }

  return {
    ...EMPTY_FORM,
    ...saved,
  };
}

/* =========================================================
   SAVED COUPON

   Cart currently stores the coupon under gymdrobe-coupon.
   Checkout also supports the user-scoped version.
========================================================= */

function getSavedCoupon(
  user
) {
  const scopedKey =
    getUserStorageKey(
      COUPON_STORAGE_KEY,
      user
    );

  const scopedCoupon =
    readStorage(
      scopedKey,
      null
    );

  const legacyCoupon =
    readStorage(
      COUPON_STORAGE_KEY,
      null
    );

  const couponData =
    scopedCoupon ||
    legacyCoupon;

  if (
    !couponData?.code
  ) {
    return null;
  }

  const code =
    String(
      couponData.code
    )
      .trim()
      .toUpperCase();

  return (
    COUPONS[code] ||
    null
  );
}

/* =========================================================
   INPUT FIELD
========================================================= */

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
  disabled = false,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="
          mb-2
          block
          text-[11px]
          font-bold
          uppercase
          tracking-[0.04em]
          text-[#282c3f]
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
        placeholder={
          placeholder
        }
        inputMode={
          inputMode
        }
        maxLength={
          maxLength
        }
        disabled={
          disabled
        }
        autoComplete={
          name === "name"
            ? "name"
            : name ===
              "email"
            ? "email"
            : name ===
              "phone"
            ? "tel"
            : name ===
              "address"
            ? "street-address"
            : name ===
              "landmark"
            ? "address-line2"
            : name ===
              "city"
            ? "address-level2"
            : name ===
              "state"
            ? "address-level1"
            : name ===
              "pincode"
            ? "postal-code"
            : "off"
        }
        className={`
          w-full
          border
          px-4
          py-3
          text-sm
          outline-none
          transition

          ${
            disabled
              ? "cursor-not-allowed bg-[#f5f5f6] text-[#94969f]"
              : "bg-white text-[#282c3f]"
          }

          ${
            error
              ? "border-red-500"
              : "border-[#d4d5d9] focus:border-orange-500"
          }
        `}
      />

      {error && (
        <p
          className="
            mt-1.5
            text-[11px]
            text-red-600
          "
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   ICONS
========================================================= */

function ShieldIcon() {
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

function CheckIcon() {
  return (
    <span
      className="
        flex
        h-5
        w-5
        items-center
        justify-center
        rounded-full
        bg-green-600
        text-[10px]
        text-white
      "
    >
      ✓
    </span>
  );
}

/* =========================================================
   CHECKOUT PAGE
========================================================= */

function CheckoutPage({
  cart,
  setCart,
  buyNowItem,
  clearBuyNow,
}) {
  const navigate =
    useNavigate();

  const {
    user,
    isAuthenticated,
  } = useAuth();

  /* =======================================================
     CURRENT STEP
  ======================================================= */

  const [
    checkoutStep,
    setCheckoutStep,
  ] = useState(
    "address"
  );

  /* =======================================================
     CUSTOMER
  ======================================================= */

  const [
    formData,
    setFormData,
  ] = useState(() =>
    getSavedCheckoutDetails(
      user
    )
  );

  /* =======================================================
     SAVED ADDRESSES
  ======================================================= */

  const [
    savedAddresses,
    setSavedAddresses,
  ] = useState(() =>
    getSavedAddresses(
      user
    )
  );

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] = useState(null);

  /* =======================================================
     DELIVERY
  ======================================================= */

  const [
    deliveryMethod,
    setDeliveryMethod,
  ] = useState(
    "standard"
  );

  /* =======================================================
     PAYMENT

     Real online payment is intentionally not completed
     until the backend/payment gateway is connected.
  ======================================================= */

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState(
    "cod"
  );

  /* =======================================================
     ERRORS
  ======================================================= */

  const [
    errors,
    setErrors,
  ] = useState({});

  const [
    checkoutError,
    setCheckoutError,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  /* =======================================================
     COUPON
  ======================================================= */

  const [
    coupon,
    setCoupon,
  ] = useState(() =>
    getSavedCoupon(
      user
    )
  );

  /* =======================================================
     BUY NOW MODE
  ======================================================= */

  const isBuyNowCheckout =
    Boolean(
      buyNowItem
    );

  /* =======================================================
     VALIDATE BUY NOW ITEM
  ======================================================= */

  const validatedBuyNowItem =
    useMemo(() => {
      if (!buyNowItem) {
        return null;
      }

      const product =
        products.find(
          (
            productItem
          ) =>
            String(
              productItem.id
            ) ===
            String(
              buyNowItem.id
            )
        );

      if (!product) {
        return null;
      }

      const selectedSize =
        buyNowItem.selectedSize ??
        null;

      const selectedColor =
        buyNowItem.selectedColor ??
        null;

      const quantity =
        Number(
          buyNowItem.quantity ||
            1
        );

      const validation =
        validateCartItem(
          product,
          quantity,
          selectedSize,
          selectedColor
        );

      if (
        !validation.valid
      ) {
        return null;
      }

      return {
        ...product,

        price:
          getDiscountedPrice(
            product
          ),

        quantity,

        selectedSize,

        selectedColor,
      };
    }, [
      buyNowItem,
    ]);

  /* =======================================================
     CHECKOUT ITEMS
  ======================================================= */

  const checkoutItems =
    useMemo(() => {
      if (
        isBuyNowCheckout
      ) {
        return validatedBuyNowItem
          ? [
              validatedBuyNowItem,
            ]
          : [];
      }

      return Array.isArray(
        cart
      )
        ? cart
        : [];
    }, [
      isBuyNowCheckout,
      validatedBuyNowItem,
      cart,
    ]);

  /* =======================================================
     LOAD USER DATA
  ======================================================= */

  useEffect(() => {
    setSavedAddresses(
      getSavedAddresses(
        user
      )
    );

    setFormData(
      getSavedCheckoutDetails(
        user
      )
    );

    setCoupon(
      getSavedCoupon(
        user
      )
    );

    setSelectedAddressId(
      null
    );

    setCheckoutStep(
      "address"
    );

    setErrors({});

    setCheckoutError("");
  }, [
    user,
  ]);

  /* =======================================================
     AUTOFILL USER
  ======================================================= */

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData(
      (current) => ({
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
      })
    );
  }, [
    user,
  ]);

  /* =======================================================
     SAVE CHECKOUT DETAILS
  ======================================================= */

  useEffect(() => {
    try {
      const storageKey =
        getUserStorageKey(
          CHECKOUT_STORAGE_KEY,
          user
        );

      localStorage.setItem(
        storageKey,
        JSON.stringify(
          formData
        )
      );
    } catch {
      // Ignore storage errors.
    }
  }, [
    formData,
    user,
  ]);

  /* =======================================================
     SAVE ADDRESSES
  ======================================================= */

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
        JSON.stringify(
          savedAddresses
        )
      );
    } catch {
      // Ignore.
    }
  }, [
    savedAddresses,
    user,
  ]);

  /* =======================================================
     SAVE COUPON
  ======================================================= */

  useEffect(() => {
    const storageKey =
      getUserStorageKey(
        COUPON_STORAGE_KEY,
        user
      );

    try {
      if (coupon) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            code:
              coupon.code,
          })
        );
      } else {
        localStorage.removeItem(
          storageKey
        );
      }
    } catch {
      // Ignore.
    }
  }, [
    coupon,
    user,
  ]);

  /* =======================================================
     DEFAULT SAVED ADDRESS
  ======================================================= */

  useEffect(() => {
    if (
      !isAuthenticated ||
      savedAddresses.length ===
        0
    ) {
      return;
    }

    const selectedExists =
      selectedAddressId &&
      savedAddresses.some(
        (address) =>
          String(
            address.id
          ) ===
          String(
            selectedAddressId
          )
      );

    if (
      selectedExists
    ) {
      return;
    }

    const defaultAddress =
      savedAddresses.find(
        (address) =>
          address.isDefault ===
          true
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

  /* =======================================================
     APPLY SELECTED ADDRESS
  ======================================================= */

  useEffect(() => {
    if (
      !selectedAddressId ||
      !savedAddresses.length
    ) {
      return;
    }

    const address =
      savedAddresses.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            selectedAddressId
          )
      );

    if (!address) {
      return;
    }

    setFormData(
      (current) => ({
        ...current,

        name:
          address.fullName ||
          user?.name ||
          current.name ||
          "",

        email:
          user?.email ||
          current.email ||
          "",

        phone:
          address.phone ||
          user?.phone ||
          current.phone ||
          "",

        address:
          address.addressLine ||
          address.address ||
          "",

        landmark:
          address.landmark ||
          "",

        city:
          address.city ||
          "",

        state:
          address.state ||
          "",

        pincode:
          address.pincode ||
          "",
      })
    );

    setErrors({});

    setCheckoutError("");
  }, [
    selectedAddressId,
    savedAddresses,
    user,
  ]);

  /* =======================================================
     CART REVALIDATION
  ======================================================= */

  useEffect(() => {
    if (
      isBuyNowCheckout ||
      !Array.isArray(
        cart
      ) ||
      cart.length === 0
    ) {
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
    }
  }, [
    cart,
    setCart,
    isBuyNowCheckout,
  ]);

  /* =======================================================
     VALIDATE CHECKOUT ITEMS
  ======================================================= */

  const checkoutValidation =
    useMemo(() => {
      if (
        !checkoutItems.length
      ) {
        return {
          valid: false,

          message:
            isBuyNowCheckout &&
            buyNowItem
              ? "The selected product variant or quantity is no longer available."
              : "Your checkout is empty.",
        };
      }

      for (
        const item of
        checkoutItems
      ) {
        const product =
          products.find(
            (
              productItem
            ) =>
              String(
                productItem.id
              ) ===
              String(
                item.id
              )
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
            item.selectedSize ??
              null,
            item.selectedColor ??
              null
          );

        const quantity =
          Number(
            item.quantity ||
              0
          );

        if (stock <= 0) {
          return {
            valid: false,

            message:
              `${item.name} is out of stock.`,
          };
        }

        if (
          quantity <= 0
        ) {
          return {
            valid: false,

            message:
              `Invalid quantity for ${item.name}.`,
          };
        }

        if (
          quantity >
          stock
        ) {
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
    }, [
      checkoutItems,
      isBuyNowCheckout,
      buyNowItem,
    ]);

  /* =======================================================
     PRICING
  ======================================================= */

  const {
    subtotal,
    couponDiscount,
    totalAfterCoupon,
    shipping,
    finalTotal,
  } = useMemo(() => {
    return calculateOrderPricing({
      cart:
        checkoutItems,

      coupon,

      deliveryMethod,
    });
  }, [
    checkoutItems,
    coupon,
    deliveryMethod,
  ]);

  const totalItems =
    checkoutItems.reduce(
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

  const totalMrp =
    checkoutItems.reduce(
      (
        total,
        item
      ) => {
        const product =
          products.find(
            (
              productItem
            ) =>
              String(
                productItem.id
              ) ===
              String(
                item.id
              )
          );

        const mrp =
          Number(
            product?.price ??
              item.price ??
              0
          );

        return (
          total +
          mrp *
            Number(
              item.quantity ||
                1
            )
        );
      },
      0
    );

  const productDiscount =
    Math.max(
      totalMrp -
        subtotal,
      0
    );

  /* =======================================================
     INPUT CHANGE
  ======================================================= */

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    let nextValue =
      value;

    if (
      name === "phone"
    ) {
      nextValue =
        value
          .replace(
            /\D/g,
            ""
          )
          .slice(
            0,
            10
          );
    }

    if (
      name ===
      "pincode"
    ) {
      nextValue =
        value
          .replace(
            /\D/g,
            ""
          )
          .slice(
            0,
            6
          );
    }

    if (
      name === "name"
    ) {
      nextValue =
        value.slice(
          0,
          80
        );
    }

    if (
      name === "city" ||
      name === "state"
    ) {
      nextValue =
        value.slice(
          0,
          80
        );
    }

    if (
      name ===
      "landmark"
    ) {
      nextValue =
        value.slice(
          0,
          120
        );
    }

    setFormData(
      (current) => ({
        ...current,

        [name]:
          nextValue,
      })
    );

    setErrors(
      (current) => ({
        ...current,

        [name]: "",
      })
    );

    setCheckoutError(
      ""
    );

    if (
      [
        "name",
        "phone",
        "address",
        "landmark",
        "city",
        "state",
        "pincode",
      ].includes(name)
    ) {
      setSelectedAddressId(
        null
      );
    }
  }

  /* =======================================================
     ADDRESS SELECT
  ======================================================= */

  function handleSelectAddress(
    address
  ) {
    if (!address) {
      return;
    }

    setSelectedAddressId(
      address.id
    );

    setErrors({});

    setCheckoutError("");
  }

  function handleUseManualAddress() {
    setSelectedAddressId(
      null
    );

    setErrors({});

    setCheckoutError("");
  }

  /* =======================================================
     FORM VALIDATION
  ======================================================= */

  function validateForm() {
    const newErrors =
      {};

    if (
      !formData.name.trim()
    ) {
      newErrors.name =
        "Please enter your full name.";
    } else if (
      formData.name
        .trim().length < 3
    ) {
      newErrors.name =
        "Name must contain at least 3 characters.";
    }

    if (
      !formData.email.trim()
    ) {
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

    if (
      !formData.phone.trim()
    ) {
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

    if (
      !formData.address.trim()
    ) {
      newErrors.address =
        "Please enter your address.";
    } else if (
      formData.address
        .trim().length < 5
    ) {
      newErrors.address =
        "Please enter a more complete address.";
    }

    if (
      !formData.city.trim()
    ) {
      newErrors.city =
        "Please enter your city.";
    }

    if (
      !formData.state.trim()
    ) {
      newErrors.state =
        "Please enter your state.";
    }

    if (
      !formData.pincode.trim()
    ) {
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

    setErrors(
      newErrors
    );

    return (
      Object.keys(
        newErrors
      ).length === 0
    );
  }

  /* =======================================================
     CONTINUE TO PAYMENT
  ======================================================= */

  function handleContinueToPayment() {
    setCheckoutError("");

    if (
      !checkoutValidation.valid
    ) {
      setCheckoutError(
        checkoutValidation.message
      );

      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });

      return;
    }

    if (
      !validateForm()
    ) {
      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });

      return;
    }

    setCheckoutStep(
      "payment"
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  /* =======================================================
     SAVE CURRENT ADDRESS
  ======================================================= */

  function saveCurrentAddress() {
    if (
      !isAuthenticated ||
      !user
    ) {
      return null;
    }

    const addressData = {
      fullName:
        formData.name.trim(),

      phone:
        formData.phone.trim(),

      addressLine:
        formData.address.trim(),

      landmark:
        formData.landmark.trim(),

      city:
        formData.city.trim(),

      state:
        formData.state.trim(),

      pincode:
        formData.pincode.trim(),
    };

    const existing =
      savedAddresses.find(
        (address) =>
          address.fullName ===
            addressData.fullName &&
          address.phone ===
            addressData.phone &&
          (
            address.addressLine ||
            address.address
          ) ===
            addressData.addressLine &&
          (
            address.landmark ||
            ""
          ) ===
            addressData.landmark &&
          address.city ===
            addressData.city &&
          address.state ===
            addressData.state &&
          address.pincode ===
            addressData.pincode
      );

    if (existing) {
      return existing;
    }

    const newAddress = {
      id:
        Date.now(),

      ...addressData,

      userId:
        user.id ||
        null,

      userEmail:
        user.email ||
        "",

      isDefault:
        savedAddresses.length ===
        0,

      createdAt:
        new Date().toISOString(),
    };

    setSavedAddresses(
      (current) => [
        ...current,
        newAddress,
      ]
    );

    return newAddress;
  }

  /* =======================================================
     EXISTING ORDERS
  ======================================================= */

  function getExistingOrders() {
    const orders =
      readStorage(
        ORDERS_STORAGE_KEY,
        []
      );

    return Array.isArray(
      orders
    )
      ? orders
      : [];
  }

  /* =======================================================
     PLACE ORDER
  ======================================================= */

  function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      checkoutStep !==
      "payment"
    ) {
      handleContinueToPayment();

      return;
    }

    if (
      isSubmitting
    ) {
      return;
    }

    setCheckoutError("");

    if (
      !checkoutValidation.valid
    ) {
      setCheckoutError(
        checkoutValidation.message
      );

      return;
    }

    if (
      !validateForm()
    ) {
      setCheckoutStep(
        "address"
      );

      return;
    }

    /*
      Online payments are displayed in the UI,
      but a real gateway is not connected yet.
    */

    if (
      paymentMethod ===
      "online"
    ) {
      setCheckoutError(
        "Online payment will be connected during the backend/payment integration phase. Please use Cash on Delivery for now."
      );

      return;
    }

    /* =============================================
       FINAL NORMAL CART VALIDATION
    ============================================= */

    if (
      !isBuyNowCheckout
    ) {
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

        setCheckoutError(
          "Some cart items changed because stock or product information was updated. Please review your bag before placing the order."
        );

        return;
      }
    }

    /* =============================================
       FINAL BUY NOW VALIDATION
    ============================================= */

    if (
      isBuyNowCheckout
    ) {
      const latestProduct =
        products.find(
          (product) =>
            String(
              product.id
            ) ===
            String(
              buyNowItem?.id
            )
        );

      if (
        !latestProduct
      ) {
        setCheckoutError(
          "This product is no longer available."
        );

        return;
      }

      const validation =
        validateCartItem(
          latestProduct,

          Number(
            buyNowItem?.quantity ||
              1
          ),

          buyNowItem?.selectedSize ??
            null,

          buyNowItem?.selectedColor ??
            null
        );

      if (
        !validation.valid
      ) {
        setCheckoutError(
          validation.message
        );

        return;
      }
    }

    /* =============================================
       COUPON VALIDATION
    ============================================= */

    let validCoupon =
      null;

    if (coupon) {
      const code =
        coupon.code
          ?.trim()
          .toUpperCase();

      validCoupon =
        code
          ? COUPONS[
              code
            ]
          : null;

      if (
        !validCoupon
      ) {
        setCoupon(
          null
        );

        setCheckoutError(
          "The applied coupon is no longer valid."
        );

        return;
      }

      if (
        subtotal <
        validCoupon.minimum
      ) {
        setCoupon(
          null
        );

        setCheckoutError(
          `Coupon ${validCoupon.code} requires a minimum order value of ₹${validCoupon.minimum.toLocaleString(
            "en-IN"
          )}.`
        );

        return;
      }
    }

    setIsSubmitting(
      true
    );

    /* =============================================
       ORDER ITEMS
    ============================================= */

    const orderItems =
      checkoutItems.map(
        (item) => {
          const product =
            products.find(
              (
                productItem
              ) =>
                String(
                  productItem.id
                ) ===
                String(
                  item.id
                )
            );

          return {
            id:
              product?.id ??
              item.id,

            name:
              product?.name ??
              item.name,

            image:
              product?.image ||
              product
                ?.images?.[0] ||
              item.image ||
              item
                .images?.[0] ||
              "",

            category:
              product?.category ||
              item.category ||
              "",

            price:
              getDiscountedPrice(
                product ||
                  item
              ),

            originalPrice:
              Number(
                product?.price ??
                  item.price ??
                  0
              ),

            discount:
              Number(
                product?.discount ??
                  item.discount ??
                  0
              ),

            quantity:
              Number(
                item.quantity ||
                  1
              ),

            selectedSize:
              item.selectedSize ??
              null,

            selectedColor:
              item.selectedColor ??
              null,

            itemKey:
              getCartItemKey(
                item
              ),
          };
        }
      );

    /* =============================================
       DELIVERY
    ============================================= */

    const deliveryInfo = {
      method:
        deliveryMethod,

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

      charge:
        shipping,

      status:
        "pending",
    };

    /* =============================================
       PAYMENT
    ============================================= */

    const paymentInfo = {
      method:
        paymentMethod,

      status:
        paymentMethod ===
        "cod"
          ? "pending"
          : "payment-pending",

      transactionId:
        null,

      gateway:
        paymentMethod ===
        "cod"
          ? "cod"
          : null,

      paidAt:
        null,
    };

    /* =============================================
       ADDRESS
    ============================================= */

    const savedAddress =
      saveCurrentAddress();

    const shippingAddress = {
      id:
        savedAddress?.id ||
        selectedAddressId ||
        null,

      fullName:
        formData.name.trim(),

      name:
        formData.name.trim(),

      email:
        formData.email
          .trim()
          .toLowerCase(),

      phone:
        formData.phone.trim(),

      addressLine:
        formData.address.trim(),

      address:
        formData.address.trim(),

      landmark:
        formData.landmark.trim(),

      city:
        formData.city.trim(),

      state:
        formData.state.trim(),

      pincode:
        formData.pincode.trim(),
    };

    /* =============================================
       CREATE ORDER
    ============================================= */

    const now =
      new Date().toISOString();

    const order = {
      id:
        `GD-${Date.now()}`,

      createdAt:
        now,

      updatedAt:
        now,

      status:
        "confirmed",

      source:
        isBuyNowCheckout
          ? "buy-now"
          : "cart",

      user:
        isAuthenticated
          ? {
              id:
                user?.id ||
                null,

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

      shippingAddress,

      items:
        orderItems,

      pricing: {
        subtotal,

        couponDiscount,

        shipping,

        totalAfterCoupon,

        finalTotal,

        total:
          finalTotal,

        currency:
          "INR",
      },

      coupon:
        validCoupon
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

      delivery:
        deliveryInfo,

      deliveryMethod,

      payment:
        paymentInfo,

      paymentMethod,

      refund: {
        status:
          "not-requested",

        amount:
          0,

        requestedAt:
          null,

        processedAt:
          null,

        transactionId:
          null,
      },

      cancellation: {
        status:
          "not-cancelled",

        reason:
          "",

        cancelledAt:
          null,
      },

      returnRequest: {
        status:
          "not-requested",

        reason:
          "",

        requestedAt:
          null,

        approvedAt:
          null,

        completedAt:
          null,
      },

      tracking: {
        carrier:
          null,

        trackingNumber:
          null,

        currentLocation:
          null,

        estimatedDelivery:
          null,

        events: [],
      },

      metadata: {
        version:
          "1.0",

        platform:
          "web",

        createdFrom:
          isBuyNowCheckout
            ? "buy-now"
            : "cart",
      },
    };

    /* =============================================
       SAVE LAST ORDER
    ============================================= */

    try {
      const lastOrderKey =
        getUserStorageKey(
          LAST_ORDER_STORAGE_KEY,
          user
        );

      localStorage.setItem(
        lastOrderKey,
        JSON.stringify(
          order
        )
      );
    } catch {
      // Ignore.
    }

    /* =============================================
       SAVE ORDER HISTORY
    ============================================= */

    let existingOrders =
      getExistingOrders();

    existingOrders =
      existingOrders.filter(
        (existingOrder) =>
          existingOrder?.id !==
          order.id
      );

    existingOrders.unshift(
      order
    );

    try {
      localStorage.setItem(
        ORDERS_STORAGE_KEY,
        JSON.stringify(
          existingOrders
        )
      );
    } catch {
      setIsSubmitting(
        false
      );

      setCheckoutError(
        "Unable to save your order. Please try again."
      );

      return;
    }

    /* =============================================
       LAST ADDRESS
    ============================================= */

    try {
      const lastAddressKey =
        getUserStorageKey(
          LAST_ADDRESS_STORAGE_KEY,
          user
        );

      localStorage.setItem(
        lastAddressKey,
        JSON.stringify(
          shippingAddress
        )
      );
    } catch {
      // Ignore.
    }

    /* =============================================
       CLEAR SOURCE
    ============================================= */

    if (
      isBuyNowCheckout
    ) {
      clearBuyNow?.();
    } else {
      setCart([]);
    }

    /* =============================================
       CLEAR COUPON
    ============================================= */

    setCoupon(
      null
    );

    try {
      localStorage.removeItem(
        COUPON_STORAGE_KEY
      );

      localStorage.removeItem(
        getUserStorageKey(
          COUPON_STORAGE_KEY,
          user
        )
      );
    } catch {
      // Ignore.
    }

    /* =============================================
       SUCCESS PAGE
    ============================================= */

    setTimeout(() => {
      navigate(
        `/order-success?orderId=${encodeURIComponent(
          order.id
        )}`
      );
    }, 400);
  }

  /* =======================================================
     EMPTY CHECKOUT
  ======================================================= */

  if (
    checkoutItems.length ===
    0
  ) {
    return (
      <main
        className="
          min-h-[75vh]
          bg-white
          text-[#282c3f]
        "
      >
        <div
          className="
            flex
            min-h-[600px]
            items-center
            justify-center
            px-5
          "
        >
          <div
            className="
              max-w-md
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
                bg-orange-50
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
              {isBuyNowCheckout
                ? "Product Unavailable"
                : "Checkout Is Empty"}
            </h1>

            <p
              className="
                mt-3
                text-sm
                leading-6
                text-[#696b79]
              "
            >
              {isBuyNowCheckout
                ? "The selected product variant or quantity is no longer available."
                : "Add products to your bag before proceeding to checkout."}
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
                text-white
              "
            >
              Go To Shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     RENDER
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
            min-h-[78px]
            max-w-[1100px]
            items-center
            justify-between
            gap-4
            px-4
            sm:px-6
          "
        >
          {/* BACK */}

          <Link
            to={
              isBuyNowCheckout
                ? `/product/${buyNowItem?.id}`
                : "/cart"
            }
            className="
              hidden
              w-[150px]
              text-[10px]
              font-bold
              uppercase
              text-[#696b79]
              hover:text-orange-600
              sm:block
            "
          >
            ← Back
          </Link>

          {/* STEPS */}

          <div
            className="
              flex
              flex-1
              items-center
              justify-center
              gap-2
              text-[10px]
              font-bold
              uppercase
              tracking-[0.15em]
              sm:text-[11px]
            "
          >
            <span
              className="
                flex
                items-center
                gap-1.5
                text-green-600
              "
            >
              <CheckIcon />
              Bag
            </span>

            <span
              className="
                text-[#c7c8cc]
              "
            >
              ─────
            </span>

            <button
              type="button"
              onClick={() =>
                setCheckoutStep(
                  "address"
                )
              }
              className={`
                pb-2
                ${
                  checkoutStep ===
                  "address"
                    ? "border-b-2 border-orange-600 text-orange-600"
                    : "text-green-600"
                }
              `}
            >
              Address
            </button>

            <span
              className="
                text-[#c7c8cc]
              "
            >
              ─────
            </span>

            <span
              className={
                checkoutStep ===
                "payment"
                  ? "border-b-2 border-orange-600 pb-2 text-orange-600"
                  : "pb-2 text-[#696b79]"
              }
            >
              Payment
            </span>
          </div>

          {/* SECURE */}

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
              tracking-[0.1em]
              text-[#696b79]
              sm:flex
            "
          >
            <span
              className="
                text-green-600
              "
            >
              <ShieldIcon />
            </span>

            100% Secure
          </div>
        </div>
      </div>

      {/* =================================================
          CONTENT
      ================================================= */}

      <form
        onSubmit={
          handleSubmit
        }
        noValidate
      >
        <div
          className="
            mx-auto
            max-w-[1100px]
            px-4
            py-7
            sm:px-6
            lg:py-9
          "
        >
          {/* ERROR */}

          {checkoutError && (
            <div
              className="
                mb-6
                border
                border-red-200
                bg-red-50
                px-4
                py-3
                text-sm
                text-red-700
              "
            >
              {checkoutError}
            </div>
          )}

          <div
            className="
              grid
              gap-8
              lg:grid-cols-[minmax(0,1fr)_360px]
            "
          >
            {/* =================================================
                LEFT COLUMN
            ================================================= */}

            <section
              className="
                min-w-0
                lg:border-r
                lg:border-[#eaeaec]
                lg:pr-8
              "
            >
              {/* =================================================
                  ADDRESS STEP
              ================================================= */}

              {checkoutStep ===
                "address" && (
                <>
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                      border-b
                      border-[#eaeaec]
                      pb-4
                    "
                  >
                    <div>
                      <h1
                        className="
                          text-lg
                          font-bold
                        "
                      >
                        Select Delivery Address
                      </h1>

                      <p
                        className="
                          mt-1
                          text-xs
                          text-[#696b79]
                        "
                      >
                        Choose a saved address or enter a new one.
                      </p>
                    </div>

                    {isAuthenticated && (
                      <Link
                        to="/addresses"
                        className="
                          shrink-0
                          border
                          border-orange-500
                          px-3
                          py-2
                          text-[10px]
                          font-bold
                          uppercase
                          text-orange-600
                        "
                      >
                        Manage
                      </Link>
                    )}
                  </div>

                  {/* SAVED ADDRESSES */}

                  {isAuthenticated &&
                    savedAddresses.length >
                      0 && (
                      <div
                        className="
                          mt-5
                          space-y-3
                        "
                      >
                        {savedAddresses.map(
                          (
                            address
                          ) => {
                            const selected =
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
                                  w-full
                                  border
                                  p-4
                                  text-left
                                  transition

                                  ${
                                    selected
                                      ? "border-orange-500 bg-orange-50"
                                      : "border-[#eaeaec] bg-white hover:border-[#94969f]"
                                  }
                                `}
                              >
                                <div
                                  className="
                                    flex
                                    items-start
                                    gap-3
                                  "
                                >
                                  <span
                                    className={`
                                      mt-1
                                      flex
                                      h-4
                                      w-4
                                      shrink-0
                                      items-center
                                      justify-center
                                      rounded-full
                                      border

                                      ${
                                        selected
                                          ? "border-orange-600"
                                          : "border-[#94969f]"
                                      }
                                    `}
                                  >
                                    {selected && (
                                      <span
                                        className="
                                          h-2
                                          w-2
                                          rounded-full
                                          bg-orange-600
                                        "
                                      />
                                    )}
                                  </span>

                                  <div
                                    className="
                                      min-w-0
                                      flex-1
                                    "
                                  >
                                    <div
                                      className="
                                        flex
                                        flex-wrap
                                        items-center
                                        gap-2
                                      "
                                    >
                                      <p
                                        className="
                                          text-sm
                                          font-bold
                                        "
                                      >
                                        {
                                          address.fullName
                                        }
                                      </p>

                                      {address.isDefault && (
                                        <span
                                          className="
                                            bg-[#f5f5f6]
                                            px-2
                                            py-1
                                            text-[9px]
                                            font-bold
                                            uppercase
                                          "
                                        >
                                          Default
                                        </span>
                                      )}
                                    </div>

                                    <p
                                      className="
                                        mt-2
                                        text-[12px]
                                        leading-5
                                        text-[#696b79]
                                      "
                                    >
                                      {address.addressLine ||
                                        address.address}

                                      {address.landmark
                                        ? `, ${address.landmark}`
                                        : ""}

                                      <br />

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

                                    <p
                                      className="
                                        mt-2
                                        text-[12px]
                                        font-semibold
                                      "
                                    >
                                      Mobile:{" "}
                                      {
                                        address.phone
                                      }
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          }
                        )}

                        {selectedAddressId && (
                          <button
                            type="button"
                            onClick={
                              handleUseManualAddress
                            }
                            className="
                              text-[11px]
                              font-bold
                              uppercase
                              text-orange-600
                            "
                          >
                            + Use A Different Address
                          </button>
                        )}
                      </div>
                    )}

                  {/* CONTACT DETAILS */}

                  <div
                    className="
                      mt-7
                      border-t
                      border-[#eaeaec]
                      pt-6
                    "
                  >
                    <h2
                      className="
                        text-[13px]
                        font-bold
                        uppercase
                      "
                    >
                      Contact Details
                    </h2>

                    <div
                      className="
                        mt-5
                        grid
                        gap-4
                        sm:grid-cols-2
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

                      <div
                        className="
                          sm:col-span-2
                        "
                      >
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
                          placeholder="10-digit mobile number"
                          inputMode="numeric"
                          maxLength={
                            10
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* DELIVERY ADDRESS */}

                  <div
                    className="
                      mt-7
                      border-t
                      border-[#eaeaec]
                      pt-6
                    "
                  >
                    <h2
                      className="
                        text-[13px]
                        font-bold
                        uppercase
                      "
                    >
                      Delivery Address
                    </h2>

                    <div
                      className="
                        mt-5
                        space-y-4
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
                        placeholder="House number, building, street, area"
                      />

                      <InputField
                        label="Landmark"
                        name="landmark"
                        value={
                          formData.landmark
                        }
                        error={
                          errors.landmark
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="Nearby landmark (optional)"
                      />

                      <div
                        className="
                          grid
                          gap-4
                          sm:grid-cols-3
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
                          placeholder="6 digits"
                          inputMode="numeric"
                          maxLength={
                            6
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* DELIVERY METHOD */}

                  <div
                    className="
                      mt-7
                      border-t
                      border-[#eaeaec]
                      pt-6
                    "
                  >
                    <h2
                      className="
                        text-[13px]
                        font-bold
                        uppercase
                      "
                    >
                      Delivery Method
                    </h2>

                    <div
                      className="
                        mt-4
                        space-y-3
                      "
                    >
                      <label
                        className={`
                          flex
                          cursor-pointer
                          items-center
                          justify-between
                          gap-4
                          border
                          p-4

                          ${
                            deliveryMethod ===
                            "standard"
                              ? "border-orange-500 bg-orange-50"
                              : "border-[#eaeaec]"
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-3
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
                            onChange={(
                              event
                            ) =>
                              setDeliveryMethod(
                                event.target
                                  .value
                              )
                            }
                            className="
                              accent-orange-600
                            "
                          />

                          <div>
                            <p
                              className="
                                text-sm
                                font-bold
                              "
                            >
                              Standard Delivery
                            </p>

                            <p
                              className="
                                mt-1
                                text-[11px]
                                text-[#696b79]
                              "
                            >
                              3–7 business days
                            </p>
                          </div>
                        </div>

                        <span
                          className="
                            text-sm
                            font-bold
                          "
                        >
                          {totalAfterCoupon >=
                          FREE_SHIPPING_LIMIT
                            ? "FREE"
                            : "₹99"}
                        </span>
                      </label>

                      <label
                        className={`
                          flex
                          cursor-pointer
                          items-center
                          justify-between
                          gap-4
                          border
                          p-4

                          ${
                            deliveryMethod ===
                            "express"
                              ? "border-orange-500 bg-orange-50"
                              : "border-[#eaeaec]"
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-3
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
                            onChange={(
                              event
                            ) =>
                              setDeliveryMethod(
                                event.target
                                  .value
                              )
                            }
                            className="
                              accent-orange-600
                            "
                          />

                          <div>
                            <p
                              className="
                                text-sm
                                font-bold
                              "
                            >
                              Express Delivery
                            </p>

                            <p
                              className="
                                mt-1
                                text-[11px]
                                text-[#696b79]
                              "
                            >
                              1–3 business days
                            </p>
                          </div>
                        </div>

                        <span
                          className="
                            text-sm
                            font-bold
                          "
                        >
                          ₹199
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* =================================================
                  PAYMENT STEP
              ================================================= */}

              {checkoutStep ===
                "payment" && (
                <>
                  {/* ADDRESS SUMMARY */}

                  <div
                    className="
                      border
                      border-[#eaeaec]
                      bg-white
                      p-5
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-4
                      "
                    >
                      <div>
                        <p
                          className="
                            text-[11px]
                            font-bold
                            uppercase
                            text-[#696b79]
                          "
                        >
                          Deliver To
                        </p>

                        <h2
                          className="
                            mt-2
                            text-sm
                            font-bold
                          "
                        >
                          {
                            formData.name
                          }
                        </h2>

                        <p
                          className="
                            mt-2
                            text-[12px]
                            leading-5
                            text-[#696b79]
                          "
                        >
                          {
                            formData.address
                          }

                          {formData.landmark
                            ? `, ${formData.landmark}`
                            : ""}

                          <br />

                          {
                            formData.city
                          }
                          ,{" "}
                          {
                            formData.state
                          }{" "}
                          -{" "}
                          {
                            formData.pincode
                          }

                          <br />

                          Mobile:{" "}
                          {
                            formData.phone
                          }
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setCheckoutStep(
                            "address"
                          )
                        }
                        className="
                          border
                          border-orange-500
                          px-3
                          py-2
                          text-[10px]
                          font-bold
                          uppercase
                          text-orange-600
                        "
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {/* DELIVERY SUMMARY */}

                  <div
                    className="
                      mt-4
                      flex
                      items-center
                      justify-between
                      border
                      border-[#eaeaec]
                      p-5
                    "
                  >
                    <div>
                      <p
                        className="
                          text-[11px]
                          font-bold
                          uppercase
                          text-[#696b79]
                        "
                      >
                        Delivery
                      </p>

                      <p
                        className="
                          mt-2
                          text-sm
                          font-bold
                        "
                      >
                        {deliveryMethod ===
                        "express"
                          ? "Express Delivery"
                          : "Standard Delivery"}
                      </p>

                      <p
                        className="
                          mt-1
                          text-[11px]
                          text-[#696b79]
                        "
                      >
                        {deliveryMethod ===
                        "express"
                          ? "1–3 business days"
                          : "3–7 business days"}
                      </p>
                    </div>

                    <span
                      className="
                        text-sm
                        font-bold
                      "
                    >
                      {shipping ===
                      0
                        ? "FREE"
                        : `₹${shipping}`}
                    </span>
                  </div>

                  {/* PAYMENT OPTIONS */}

                  <div
                    className="
                      mt-6
                    "
                  >
                    <h1
                      className="
                        text-lg
                        font-bold
                      "
                    >
                      Choose Payment Method
                    </h1>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-[#696b79]
                      "
                    >
                      Select how you want to pay for your order.
                    </p>

                    <div
                      className="
                        mt-5
                        space-y-3
                      "
                    >
                      {/* COD */}

                      <label
                        className={`
                          flex
                          cursor-pointer
                          items-start
                          gap-3
                          border
                          p-4

                          ${
                            paymentMethod ===
                            "cod"
                              ? "border-orange-500 bg-orange-50"
                              : "border-[#eaeaec]"
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
                          onChange={(
                            event
                          ) =>
                            setPaymentMethod(
                              event.target
                                .value
                            )
                          }
                          className="
                            mt-1
                            accent-orange-600
                          "
                        />

                        <div>
                          <p
                            className="
                              text-sm
                              font-bold
                            "
                          >
                            Cash On Delivery
                          </p>

                          <p
                            className="
                              mt-1
                              text-[11px]
                              text-[#696b79]
                            "
                          >
                            Pay when your order reaches you.
                          </p>
                        </div>
                      </label>

                      {/* UPI */}

                      <div
                        className="
                          flex
                          items-start
                          gap-3
                          border
                          border-[#eaeaec]
                          bg-[#fafafa]
                          p-4
                          opacity-60
                        "
                      >
                        <input
                          type="radio"
                          disabled
                          className="
                            mt-1
                          "
                        />

                        <div
                          className="
                            flex-1
                          "
                        >
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <p
                              className="
                                text-sm
                                font-bold
                              "
                            >
                              UPI
                            </p>

                            <span
                              className="
                                bg-[#282c3f]
                                px-2
                                py-1
                                text-[8px]
                                font-bold
                                uppercase
                                text-white
                              "
                            >
                              Coming Soon
                            </span>
                          </div>

                          <p
                            className="
                              mt-1
                              text-[11px]
                              text-[#696b79]
                            "
                          >
                            Google Pay, PhonePe, BHIM and other UPI apps.
                          </p>
                        </div>
                      </div>

                      {/* CARD */}

                      <div
                        className="
                          flex
                          items-start
                          gap-3
                          border
                          border-[#eaeaec]
                          bg-[#fafafa]
                          p-4
                          opacity-60
                        "
                      >
                        <input
                          type="radio"
                          disabled
                          className="
                            mt-1
                          "
                        />

                        <div
                          className="
                            flex-1
                          "
                        >
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <p
                              className="
                                text-sm
                                font-bold
                              "
                            >
                              Credit / Debit Card
                            </p>

                            <span
                              className="
                                bg-[#282c3f]
                                px-2
                                py-1
                                text-[8px]
                                font-bold
                                uppercase
                                text-white
                              "
                            >
                              Coming Soon
                            </span>
                          </div>

                          <p
                            className="
                              mt-1
                              text-[11px]
                              text-[#696b79]
                            "
                          >
                            Secure card payments will be connected with the backend.
                          </p>
                        </div>
                      </div>

                      {/* NETBANKING */}

                      <div
                        className="
                          flex
                          items-start
                          gap-3
                          border
                          border-[#eaeaec]
                          bg-[#fafafa]
                          p-4
                          opacity-60
                        "
                      >
                        <input
                          type="radio"
                          disabled
                          className="
                            mt-1
                          "
                        />

                        <div>
                          <p
                            className="
                              text-sm
                              font-bold
                            "
                          >
                            Net Banking
                          </p>

                          <p
                            className="
                              mt-1
                              text-[11px]
                              text-[#696b79]
                            "
                          >
                            Available after payment gateway integration.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* =================================================
                RIGHT — ORDER SUMMARY
            ================================================= */}

            <aside
              className="
                min-w-0
                lg:sticky
                lg:top-[100px]
                lg:self-start
              "
            >
              {/* ITEMS */}

              <div
                className="
                  border-b
                  border-[#eaeaec]
                  pb-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <h2
                    className="
                      text-[12px]
                      font-bold
                      uppercase
                    "
                  >
                    Order Summary
                  </h2>

                  <span
                    className="
                      text-[11px]
                      text-[#696b79]
                    "
                  >
                    {totalItems}{" "}
                    {totalItems ===
                    1
                      ? "item"
                      : "items"}
                  </span>
                </div>

                <div
                  className="
                    mt-4
                    max-h-[260px]
                    space-y-4
                    overflow-y-auto
                  "
                >
                  {checkoutItems.map(
                    (
                      item
                    ) => (
                      <div
                        key={getCartItemKey(
                          item
                        )}
                        className="
                          flex
                          gap-3
                        "
                      >
                        <Link
                          to={`/product/${item.id}`}
                          className="
                            h-[86px]
                            w-[66px]
                            shrink-0
                            overflow-hidden
                            bg-[#f5f5f6]
                          "
                        >
                          <img
                            src={
                              item.image ||
                              item
                                .images?.[0]
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

                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >
                          <p
                            className="
                              truncate
                              text-xs
                              font-bold
                            "
                          >
                            {item.brand ||
                              "GymDrobe"}
                          </p>

                          <p
                            className="
                              mt-1
                              truncate
                              text-[11px]
                              text-[#696b79]
                            "
                          >
                            {
                              item.name
                            }
                          </p>

                          <div
                            className="
                              mt-2
                              flex
                              flex-wrap
                              gap-x-3
                              gap-y-1
                              text-[10px]
                              text-[#696b79]
                            "
                          >
                            {item.selectedSize && (
                              <span>
                                Size:{" "}
                                {
                                  item.selectedSize
                                }
                              </span>
                            )}

                            {item.selectedColor && (
                              <span>
                                Color:{" "}
                                {
                                  item.selectedColor
                                }
                              </span>
                            )}

                            <span>
                              Qty:{" "}
                              {
                                item.quantity
                              }
                            </span>
                          </div>

                          <p
                            className="
                              mt-2
                              text-xs
                              font-bold
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
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* COUPON */}

              <div
                className="
                  border-b
                  border-[#eaeaec]
                  py-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-[11px]
                        font-bold
                        uppercase
                      "
                    >
                      Coupon
                    </p>

                    {coupon ? (
                      <p
                        className="
                          mt-1
                          text-[11px]
                          font-semibold
                          text-green-600
                        "
                      >
                        {coupon.code} applied
                      </p>
                    ) : (
                      <p
                        className="
                          mt-1
                          text-[10px]
                          text-[#696b79]
                        "
                      >
                        No coupon applied
                      </p>
                    )}
                  </div>

                  {!isBuyNowCheckout && (
                    <Link
                      to="/cart"
                      className="
                        text-[10px]
                        font-bold
                        uppercase
                        text-orange-600
                      "
                    >
                      Change
                    </Link>
                  )}
                </div>
              </div>

              {/* PRICE DETAILS */}

              <div
                className="
                  py-5
                "
              >
                <h2
                  className="
                    text-[12px]
                    font-bold
                    uppercase
                  "
                >
                  Price Details
                </h2>

                <div
                  className="
                    mt-5
                    space-y-4
                    text-[13px]
                  "
                >
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

                  <div
                    className="
                      flex
                      justify-between
                      gap-4
                    "
                  >
                    <span>
                      Discount on MRP
                    </span>

                    <span
                      className="
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

                  <div
                    className="
                      flex
                      justify-between
                      gap-4
                    "
                  >
                    <span>
                      Coupon Discount
                    </span>

                    <span
                      className={
                        couponDiscount >
                        0
                          ? "text-green-600"
                          : "text-[#696b79]"
                      }
                    >
                      {couponDiscount >
                      0
                        ? `- ₹${couponDiscount.toLocaleString(
                            "en-IN"
                          )}`
                        : "₹0"}
                    </span>
                  </div>

                  <div
                    className="
                      flex
                      justify-between
                      gap-4
                    "
                  >
                    <span>
                      Delivery Charges
                    </span>

                    <span
                      className={
                        shipping ===
                        0
                          ? "text-green-600"
                          : ""
                      }
                    >
                      {shipping ===
                      0
                        ? "FREE"
                        : `₹${shipping.toLocaleString(
                            "en-IN"
                          )}`}
                    </span>
                  </div>

                  {deliveryMethod ===
                    "standard" &&
                    totalAfterCoupon <
                      FREE_SHIPPING_LIMIT && (
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
                        more for free delivery.
                      </p>
                    )}
                </div>

                {/* TOTAL */}

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
                </div>

                {/* ACTION */}

                {checkoutStep ===
                "address" ? (
                  <button
                    type="button"
                    onClick={
                      handleContinueToPayment
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
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !checkoutValidation.valid
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
                      disabled:cursor-not-allowed
                      disabled:bg-gray-300
                    "
                  >
                    {isSubmitting
                      ? "Placing Order..."
                      : "Place Order"}
                  </button>
                )}

                {/* SECURITY */}

                <div
                  className="
                    mt-5
                    flex
                    items-center
                    justify-center
                    gap-2
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
                    <ShieldIcon />
                  </span>

                  Secure Checkout
                </div>
              </div>
            </aside>
          </div>
        </div>
      </form>
    </main>
  );
}

export default CheckoutPage;