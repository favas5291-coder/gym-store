import { useEffect, useRef, useState } from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  analyticsVisitKey,
  commercePayload,
  trackEvent,
  trackOnce,
  trackPurchase,
} from "../utils/analytics.js";

import { checkoutSignature } from "../utils/checkout.js";

import {
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";

import { selectedBag } from "../utils/commerce.js";

import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getCartItemKey,
  revalidateCart,
} from "../utils/cartUtils.js";

import {
  calculateOrderPricing,
  resolveCoupon,
} from "../utils/orderCalculations.js";

import {
  money,
  roundMoney,
} from "../utils/productPricing.js";

import {
  addressErrors,
  EMPTY_ADDRESS,
  normalizeAddress,
  ownerKey,
  persistOrder,
} from "../utils/customerData.js";

import {
  makeId,
  readStorage,
  userKey,
  writeStorage,
} from "../utils/storage.js";

import {
  createAddress as createSavedAddress,
  getAddresses as getSavedAddresses,
} from "../services/addressApi.js";

import {
  createRazorpayPaymentOrder,
  verifyRazorpayPayment,
} from "../services/paymentApi.js";

import { getOrderById } from "../services/orderApi.js";
import { openRazorpayCheckout } from "../utils/razorpay.js";

import AddressForm from "../components/AddressForm.jsx";
import CouponBox from "../components/CouponBox.jsx";
import PriceSummary from "../components/PriceSummary.jsx";
import EmptyState from "../components/EmptyState.jsx";

const COD_ADVANCE_PERCENTAGE = 10;

function getAddressId(address) {
  return address?.id || address?._id || "";
}

function addressPayload(address) {
  return {
    fullName: String(address?.fullName || "").trim(),

    email: String(address?.email || "")
      .trim()
      .toLowerCase(),

    phone: String(address?.phone || "").replace(/\D/g, ""),

    addressLine: String(address?.addressLine || "").trim(),
    landmark: String(address?.landmark || "").trim(),
    city: String(address?.city || "").trim(),
    state: String(address?.state || "").trim(),

    pincode: String(address?.pincode || "").replace(/\D/g, ""),

    label: String(address?.label || "Home").trim() || "Home",
    isDefault: Boolean(address?.isDefault),
  };
}

function sameAddress(a, b) {
  return (
    String(a?.addressLine || "").trim().toLowerCase() ===
      String(b?.addressLine || "").trim().toLowerCase() &&
    String(a?.pincode || "").trim() ===
      String(b?.pincode || "").trim() &&
    String(a?.phone || "").replace(/\D/g, "") ===
      String(b?.phone || "").replace(/\D/g, "")
  );
}

export default function CheckoutPage() {
  const { getLatestProducts, refreshProducts } = useCatalog();
  const tools = useShoppingTools();
  const { user, token } = useAuth();
  const store = useStore();

  const navigate = useNavigate();
  const [params] = useSearchParams();

  const isBuyNow = params.get("mode") === "buy-now";
  const isSelection = params.get("mode") === "selection";

  const checkoutMode = isBuyNow
    ? "buy-now"
    : isSelection
      ? "selection"
      : "cart";

  const items = isBuyNow
    ? store.buyNowItem
      ? [store.buyNowItem]
      : []
    : isSelection
      ? selectedBag(store.cart, tools.checkoutKeys)
      : store.cart;

  const [draftOptions] = useState(() =>
    readStorage(userKey("gymdrobe-checkout-options", user), {}),
  );

  const [giftMessage, setGiftMessage] = useState(
    draftOptions?.giftMessage || "",
  );

  const [orderNote, setOrderNote] = useState(
    draftOptions?.orderNote || "",
  );

  const [method, setMethod] = useState(
    draftOptions?.method === "express"
      ? "express"
      : "standard",
  );

  // Restored default: COD with a 10% online advance.
  const [paymentMethod, setPaymentMethod] =
    useState("cod-partial");

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] =
    useState(Boolean(user));
  const [addressesError, setAddressesError] = useState("");

  const [address, setAddress] = useState(() => {
    const draft = readStorage(
      userKey("gymdrobe-checkout-details", user),
      {},
    );

    return normalizeAddress({
      ...EMPTY_ADDRESS,
      ...(draft && typeof draft === "object" ? draft : {}),

      fullName:
        draft?.fullName ||
        draft?.name ||
        user?.name ||
        "",

      email: user?.email || draft?.email || "",
      phone: draft?.phone || user?.phone || "",

      pincode:
        draft?.pincode ||
        readStorage(
          store.shoppingKey("gymdrobe-delivery-pincode"),
          "",
        ),
    });
  });

  const [saveAddress, setSaveAddress] = useState(Boolean(user));
  const [step, setStep] = useState("address");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submitting = useRef(false);
  const reviewed = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const confirmationKey = store.shoppingKey(
    `gymdrobe-payment-confirmation-${checkoutMode}`,
  );

  const [confirmationPending, setConfirmationPending] =
    useState(() =>
      Boolean(readSession(confirmationKey, null)),
    );

  useEffect(() => {
    if (!confirmationPending || !token) return;

    let cancelled = false;
    let timer;

    async function checkConfirmation() {
      if (submitting.current) {
        timer = setTimeout(checkConfirmation, 15000);
        return;
      }

      const pending = readSession(confirmationKey, null);

      if (!pending?.orderId) return;

      try {
        const order = await getOrderById(
          token,
          pending.orderId,
        );

        if (cancelled) return;

        const confirmed = [
          "confirmed",
          "processing",
          "packed",
          "shipped",
          "out-for-delivery",
          "delivered",
        ].includes(order?.status);

        const paymentRecorded = [
          "paid",
          "partially-paid",
        ].includes(order?.payment?.status);

        if (
          (confirmed && paymentRecorded) ||
          order?.status === "cancelled" ||
          order?.payment?.status === "refunded"
        ) {
          writeSession(confirmationKey, null);

          if (confirmed) {
            trackPurchase(order);
          }

          setConfirmationPending(false);
          navigate("/orders", { replace: true });
          return;
        }
      } catch {
        // Keep the warning while confirmation cannot be checked.
      }

      if (!cancelled) {
        timer = setTimeout(checkConfirmation, 15000);
      }
    }

    checkConfirmation();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    confirmationPending,
    confirmationKey,
    token,
    navigate,
  ]);

  const attemptKey = store.shoppingKey(
    `gymdrobe-checkout-attempt-${checkoutMode}`,
  );

  const [attempt, setAttempt] = useState(
    () =>
      readSession(attemptKey, null) ||
      makeId("checkout"),
  );

  const checkoutToken = `${attempt}-${paymentMethod}`;

  useEffect(() => {
    writeSession(attemptKey, attempt);
  }, [attemptKey, attempt]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedAddresses() {
      if (!user || !token) {
        setAddresses([]);
        setAddressesLoading(false);
        setAddressesError("");
        return;
      }

      setAddressesLoading(true);
      setAddressesError("");

      try {
        const result = await getSavedAddresses(token);

        if (cancelled) return;

        const saved = Array.isArray(result) ? result : [];
        setAddresses(saved);

        const preferred =
          saved.find((item) => item.isDefault) ||
          saved[0];

        if (
          preferred &&
          !String(address?.addressLine || "").trim()
        ) {
          setAddress(
            normalizeAddress({
              ...preferred,
              id: getAddressId(preferred),
              email: preferred.email || user.email || "",
            }),
          );
        }
      } catch (loadError) {
        if (cancelled) return;

        setAddresses([]);

        setAddressesError(
          loadError.message ||
            "Saved addresses could not be loaded. You can still enter an address manually.",
        );
      } finally {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      }
    }

    loadSavedAddresses();

    return () => {
      cancelled = true;
    };
  }, [user?.id, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      writeStorage(
        userKey("gymdrobe-checkout-details", user),
        address,
      );

      writeStorage(
        userKey("gymdrobe-checkout-options", user),
        {
          method,
          paymentMethod,
          giftMessage,
          orderNote,
        },
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [
    address,
    method,
    paymentMethod,
    giftMessage,
    orderNote,
    user?.id,
  ]);

  const pricing = calculateOrderPricing({
    cart: items,
    coupon: store.coupon,
    deliveryMethod: method,
  });

  const codAdvanceAmount = roundMoney(
    (Number(pricing.totalAfterCoupon || 0) *
      COD_ADVANCE_PERCENTAGE) /
      100,
  );

  const codBalanceAmount = roundMoney(
    Math.max(
      0,
      Number(pricing.finalTotal || 0) - codAdvanceAmount,
    ),
  );

  const analyticsItemsKey = JSON.stringify(
    items.map((item) => [
      item.id,
      item.quantity,
      item.selectedSize,
      item.selectedColor,
      item.price,
    ]),
  );

  useEffect(() => {
    if (!items.length) return;

    const track = () =>
      trackOnce(
        `checkout:${analyticsVisitKey()}:${checkoutMode}`,
        "begin_checkout",
        {
          ...commercePayload(
            items,
            pricing.totalAfterCoupon,
          ),
          checkout_mode: checkoutMode,
        },
      );

    track();

    window.addEventListener(
      "gymdrobe-analytics-ready",
      track,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-analytics-ready",
        track,
      );
    };
  }, [
    analyticsItemsKey,
    checkoutMode,
    pricing.totalAfterCoupon,
  ]);

  function reviewSignature(
    deliveryMethod = method,
    payment = paymentMethod,
  ) {
    return JSON.stringify({
      checkout: checkoutSignature(
        items,
        store.coupon,
        deliveryMethod,
      ),
      paymentMethod: payment,
    });
  }

  function createNewAttempt() {
    const next = makeId("checkout");
    setAttempt(next);
    writeSession(attemptKey, next);
    return next;
  }

  function validate() {
    const invalid = addressErrors(address);
    setErrors(invalid);

    if (Object.keys(invalid).length) {
      setStep("address");

      requestAnimationFrame(() =>
        document
          .querySelector('[aria-invalid="true"]')
          ?.focus(),
      );

      return false;
    }

    return true;
  }

  function selectSavedAddress(item) {
    setAddress(
      normalizeAddress({
        ...item,
        id: getAddressId(item),
        email: item.email || user?.email || "",
      }),
    );

    setErrors({});
    setError("");
  }

  async function saveCheckoutAddressIfNeeded() {
    if (!user || !token || !saveAddress) return;

    const duplicate = addresses.some((item) =>
      sameAddress(item, address),
    );

    if (duplicate) return;

    try {
      const created = await createSavedAddress(token, {
        ...addressPayload(address),
        isDefault: addresses.length === 0,
      });

      if (created) {
        setAddresses((current) => [
          ...current.map((item) =>
            created.isDefault
              ? { ...item, isDefault: false }
              : item,
          ),
          created,
        ]);
      }
    } catch {
      store.notify(
        "Your order was placed, but this address could not be added to your saved addresses.",
        "warning",
      );
    }
  }

  function applyRevalidatedCart(checked) {
    if (isBuyNow) {
      store.refreshBuyNow(checked.cart?.[0]);
      return;
    }

    const selectedKeys = items.map(getCartItemKey);

    store.setCart([
      ...store.cart.filter(
        (item) =>
          !selectedKeys.includes(getCartItemKey(item)),
      ),
      ...(checked.cart || []),
    ]);
  }

  function clearPurchasedItems() {
    if (isBuyNow) {
      store.clearBuyNow();
      return;
    }

    const orderedKeys = items.map(getCartItemKey);

    store.setCart((current) =>
      current.filter(
        (item) =>
          !orderedKeys.includes(getCartItemKey(item)),
      ),
    );

    tools.startSelection([]);
    store.setCoupon(null);
  }

  async function finishSuccessfulOrder(
    savedOrder,
    { existing = false } = {},
  ) {
    if (!mounted.current) return;

    const confirmed = [
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "out-for-delivery",
      "delivered",
    ].includes(savedOrder?.status);

    const paymentRecorded = [
      "paid",
      "partially-paid",
    ].includes(savedOrder?.payment?.status);

    if (
      !confirmed ||
      !paymentRecorded ||
      !savedOrder?.id
    ) {
      const failure = new Error(
        "Payment confirmation is still pending. Do not pay again. Check My orders or contact support.",
      );

      failure.data = {
        paymentReceived: true,
      };

      throw failure;
    }

    trackPurchase(savedOrder);

    if (!existing) {
      await saveCheckoutAddressIfNeeded();
    }

    if (!mounted.current) return;

    let orderForLocalPages = savedOrder;

    if (user && token) {
      orderForLocalPages = {
        ...savedOrder,
        ownerKey: ownerKey(user),

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },

        metadata: {
          ...savedOrder.metadata,
          checkoutToken:
            savedOrder?.metadata?.checkoutToken ||
            checkoutToken,
        },
      };

      persistOrder(orderForLocalPages);

      try {
        if (typeof refreshProducts === "function") {
          await refreshProducts();
        }
      } catch {
        store.notify(
          "Your order was placed, but the latest stock could not be refreshed yet.",
          "warning",
        );
      }
    }

    if (!mounted.current) return;

    writeStorage(
      userKey("gymdrobe-last-order", user),
      orderForLocalPages,
    );

    clearPurchasedItems();

    writeSession(attemptKey, null);
    writeSession(confirmationKey, null);

    writeStorage(
      userKey("gymdrobe-checkout-options", user),
      {
        method: "standard",
        paymentMethod: "cod-partial",
        giftMessage: "",
        orderNote: "",
      },
    );

    navigate("/orders", { replace: true });
  }

  function changePaymentMethod(next) {
    if (!["razorpay", "cod-partial"].includes(next)) {
      return;
    }

    setPaymentMethod(next);
    setError("");
    createNewAttempt();

    if (step === "review") {
      reviewed.current = reviewSignature(method, next);
    }
  }

  function changeDeliveryMethod(next) {
    setMethod(next);
    setError("");
    createNewAttempt();

    if (step === "review") {
      reviewed.current = reviewSignature(
        next,
        paymentMethod,
      );
    }
  }

  async function placeRazorpayOrder({
    checked,
    coupon,
    cleanShippingAddress,
    latestPricing,
  }) {
    if (!user || !token) {
      throw new Error(
        "Sign in to continue with payment.",
      );
    }

    const detailsKey = JSON.stringify({
      mode: checkoutMode,

      items: checked.cart.map((item) => [
        item.id,
        item.quantity,
        item.selectedSize,
        item.selectedColor,
        item.price,
      ]),

      merchandiseValue: latestPricing.totalAfterCoupon,
      deliveryMethod: method,
    });

    const visit = analyticsVisitKey();

    trackOnce(
      `shipping:${visit}:${detailsKey}`,
      "add_shipping_info",
      {
        ...commercePayload(
          checked.cart,
          latestPricing.totalAfterCoupon,
        ),
        shipping_tier: method,
      },
    );

    trackOnce(
      `payment:${visit}:${detailsKey}:${paymentMethod}`,
      "add_payment_info",
      {
        ...commercePayload(
          checked.cart,
          latestPricing.totalAfterCoupon,
        ),
        payment_type: paymentMethod,
      },
    );

    trackEvent("payment_attempt", {
      ...commercePayload(
        checked.cart,
        latestPricing.totalAfterCoupon,
      ),
      payment_type: paymentMethod,
    });

    const gatewayOrder =
      await createRazorpayPaymentOrder(token, {
        checkoutToken,
        paymentMethod,
        source: checkoutMode,
        giftMessage: giftMessage.trim(),
        orderNote: orderNote.trim(),
        shippingAddress: cleanShippingAddress,

        items: checked.cart.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          selectedSize: item.selectedSize ?? null,
          selectedColor: item.selectedColor ?? null,
        })),

        coupon: coupon?.code || null,
        deliveryMethod: method,
        expectedTotal: latestPricing.finalTotal,
      });

    if (!mounted.current) return null;

    if (
      gatewayOrder?.alreadyPaid &&
      gatewayOrder?.order
    ) {
      return {
        order: gatewayOrder.order,
        existing: true,
      };
    }

    if (
      !gatewayOrder?.keyId ||
      !gatewayOrder?.razorpayOrderId ||
      !gatewayOrder?.amount
    ) {
      throw new Error(
        "Razorpay payment could not be started.",
      );
    }

    const description =
      paymentMethod === "cod-partial"
        ? `10% advance for ${
            gatewayOrder.orderNumber ||
            "GymDrobe order"
          }`
        : gatewayOrder.orderNumber
          ? `Full payment for ${gatewayOrder.orderNumber}`
          : "GymDrobe order payment";

    const paymentResponse =
      await openRazorpayCheckout({
        key: gatewayOrder.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency || "INR",
        name: "GymDrobe",
        description,
        order_id: gatewayOrder.razorpayOrderId,

        prefill: {
          name: cleanShippingAddress.fullName,
          email: cleanShippingAddress.email,
          contact: cleanShippingAddress.phone,
        },

        notes: {
          gymdrobe_order:
            gatewayOrder.orderNumber || "",
          payment_method: paymentMethod,
        },

        retry: {
          enabled: true,
        },

        modal: {
          confirm_close: true,
        },
      });

    writeSession(confirmationKey, {
      checkoutToken,
      orderId: gatewayOrder.orderNumber || "",
    });

    if (!mounted.current) return null;

    setConfirmationPending(true);

    if (
      !paymentResponse?.razorpay_order_id ||
      !paymentResponse?.razorpay_payment_id ||
      !paymentResponse?.razorpay_signature
    ) {
      throw new Error(
        "Razorpay did not return complete payment verification details.",
      );
    }

    const verifyPayload = {
      checkoutToken,

      razorpay_order_id:
        paymentResponse.razorpay_order_id,

      razorpay_payment_id:
        paymentResponse.razorpay_payment_id,

      razorpay_signature:
        paymentResponse.razorpay_signature,
    };

    try {
      const verified = await verifyRazorpayPayment(
        token,
        verifyPayload,
      );

      return {
        order: verified.order,
        existing: Boolean(verified.existing),
      };
    } catch (verificationError) {
      if (
        verificationError?.data?.retryVerification
      ) {
        const retried = await verifyRazorpayPayment(
          token,
          verifyPayload,
        );

        return {
          order: retried.order,
          existing: Boolean(retried.existing),
        };
      }

      throw verificationError;
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (submitting.current) return;

    if (confirmationPending) {
      setError(
        "Check My orders before paying again. Your previous payment needs confirmation.",
      );
      return;
    }

    setError("");

    if (!validate()) return;

    if (step === "address") {
      writeStorage(
        userKey("gymdrobe-checkout-details", user),
        address,
      );

      reviewed.current = reviewSignature();
      setStep("review");

      window.scrollTo({
        top: 0,
        behavior: "instant",
      });

      return;
    }

    if (!user || !token) {
      setError(
        "Please sign in before placing your GymDrobe order.",
      );
      return;
    }

    const signature = reviewSignature();

    if (reviewed.current !== signature) {
      reviewed.current = signature;
      createNewAttempt();

      setError(
        "Your products, coupon, delivery option or payment method changed. Review the latest total and place the order again.",
      );

      return;
    }

    const catalog = getLatestProducts();

    if (
      !store.catalogReady ||
      !Array.isArray(catalog)
    ) {
      setError(
        "Products are still loading. Please wait and try again.",
      );
      return;
    }

    const checked = revalidateCart(items, catalog);

    if (
      !checked.cart.length ||
      checked.changes.length
    ) {
      applyRevalidatedCart(checked);
      createNewAttempt();

      setError(
        "Product availability or prices changed. Please review your updated selection before placing the order.",
      );

      return;
    }

    submitting.current = true;
    setBusy(true);

    const selectedCoupon = resolveCoupon(store.coupon);

    const coupon =
      selectedCoupon &&
      pricing.subtotal >= selectedCoupon.minimum
        ? selectedCoupon
        : null;

    const cleanShippingAddress = addressPayload(address);

    const latestPricing = calculateOrderPricing({
      cart: checked.cart,
      coupon,
      deliveryMethod: method,
    });

    try {
      const result = await placeRazorpayOrder({
        checked,
        coupon,
        cleanShippingAddress,
        latestPricing,
      });

      if (!mounted.current || !result) return;

      await finishSuccessfulOrder(result.order, {
        existing: result.existing,
      });
    } catch (paymentError) {
      if (!mounted.current) return;

      const paymentReceived = Boolean(
        paymentError?.data?.paymentReceived,
      );

      const needsConfirmation =
        paymentReceived ||
        Boolean(readSession(confirmationKey, null));

      trackEvent(
        paymentReceived
          ? "payment_confirmation_pending"
          : paymentError.code === "RAZORPAY_CANCELLED"
            ? "payment_cancelled"
            : "checkout_payment_error",
        {
          payment_type: paymentMethod,
          failure_stage: paymentReceived
            ? "confirmation"
            : "checkout",
        },
      );

      if (needsConfirmation) {
        setConfirmationPending(true);

        if (!readSession(confirmationKey, null)) {
          writeSession(confirmationKey, {
            checkoutToken,
          });
        }

        setError(
          `${
            paymentError.message ||
            "Payment confirmation is pending."
          } Do not pay again. Check My orders or contact support.`,
        );
      } else {
        setError(
          paymentError.message ||
            "Payment could not be completed.",
        );
      }

      submitting.current = false;
      setBusy(false);
    }
  }

  const itemCount = items.reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0,
  );

  const standardPricing = calculateOrderPricing({
    cart: items,
    coupon: store.coupon,
    deliveryMethod: "standard",
  });

  const expressPricing = calculateOrderPricing({
    cart: items,
    coupon: store.coupon,
    deliveryMethod: "express",
  });

  const standardDeliveryText =
    Number(standardPricing.shipping || 0) > 0
      ? money(standardPricing.shipping)
      : "FREE";

  const expressDeliveryText =
    Number(expressPricing.shipping || 0) > 0
      ? money(expressPricing.shipping)
      : "FREE";

  const loginPath = `/login?next=${encodeURIComponent(
    `/checkout?mode=${checkoutMode}`,
  )}`;

  if (!items.length) {
    return (
      <EmptyState
        title={
          isBuyNow
            ? "Choose your Buy now selection again"
            : "Your checkout is empty"
        }
      >
        <p>
          Return to a product or add something to your bag
          to continue.
        </p>

        <Link className="button" to="/shop">
          Continue shopping
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="page narrow checkout-page">
      <nav
        className="checkout-steps"
        aria-label="Checkout progress"
      >
        <Link to="/cart">1. BAG</Link>

        <strong
          className={
            step === "address" ? "active" : undefined
          }
        >
          2. ADDRESS
        </strong>

        <strong
          className={
            step === "review" ? "active" : "muted"
          }
        >
          3. REVIEW & PAY
        </strong>
      </nav>

      <div className="page-heading">
        <div>
          <h1>
            {step === "address"
              ? "Delivery details"
              : "Review & payment"}
          </h1>

          <p className="muted">
            {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"}
            {" · "}
            {isBuyNow
              ? "Buy now"
              : isSelection
                ? "Selected items"
                : "Bag checkout"}
          </p>
        </div>

        {step === "review" && (
          <button
            type="button"
            className="text-link"
            disabled={busy || confirmationPending}
            onClick={() => {
              setStep("address");
              setError("");
            }}
          >
            Edit details
          </button>
        )}
      </div>

      <p className="notice">
        <strong>Secure GymDrobe checkout</strong>
        <br />

        {user
          ? "Choose COD with a 10% online advance or pay the complete amount online. Payments are verified through Razorpay."
          : "Enter your delivery details first. Sign in before payment to save your order to your GymDrobe account."}
      </p>

      {!user && (
        <p className="checkout-signin">
          <Link to={loginPath}>
            Continue with Google
          </Link>{" "}
          to place your order.
        </p>
      )}

      <div className="checkout-layout">
        <form
          id="checkout-form"
          className="checkout-form"
          onSubmit={submit}
          noValidate
        >
          {(error || confirmationPending) && (
            <div className="error-box" role="alert">
              <p>
                {error ||
                  "Your previous payment is awaiting confirmation. Do not pay again."}
              </p>

              {confirmationPending && (
                <p>
                  <Link to="/orders">
                    Check My orders
                  </Link>
                  {" · "}
                  <Link to="/help">
                    Contact support
                  </Link>
                </p>
              )}
            </div>
          )}

          {step === "address" ? (
            <>
              <section className="panel">
                <h2>CONTACT & DELIVERY ADDRESS</h2>

                {user && addressesLoading && (
                  <p className="muted" role="status">
                    Loading your saved addresses…
                  </p>
                )}

                {user && addressesError && (
                  <p
                    className="field-error"
                    role="alert"
                  >
                    {addressesError}
                  </p>
                )}

                {user &&
                  !addressesLoading &&
                  addresses.length > 0 && (
                    <div className="saved-address-choices">
                      <h3>Use a saved address</h3>

                      {addresses.map((item) => (
                        <button
                          type="button"
                          key={getAddressId(item)}
                          className="saved-address-choice"
                          disabled={
                            busy || confirmationPending
                          }
                          aria-pressed={
                            String(getAddressId(address)) ===
                            String(getAddressId(item))
                          }
                          onClick={() =>
                            selectSavedAddress(item)
                          }
                        >
                          <strong>
                            {item.fullName}
                            {" · "}
                            {item.label || "Home"}
                            {item.isDefault
                              ? " · Default"
                              : ""}
                          </strong>

                          <span>
                            {item.addressLine}
                            {item.landmark
                              ? `, ${item.landmark}`
                              : ""}
                            {", "}
                            {item.city} {item.pincode}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                <AddressForm
                  value={address}
                  errors={errors}
                  onChange={(value) => {
                    setAddress(value);
                    setErrors({});
                    setError("");
                  }}
                />

                {user && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(event) =>
                        setSaveAddress(
                          event.target.checked,
                        )
                      }
                    />
                    Save this address for next time
                  </label>
                )}
              </section>

              <details className="panel">
                <summary>
                  Gift message & delivery instructions
                  (optional)
                </summary>

                <div className="field">
                  <label htmlFor="gift-message">
                    Gift message
                  </label>

                  <textarea
                    id="gift-message"
                    rows="3"
                    maxLength="250"
                    value={giftMessage}
                    disabled={busy || confirmationPending}
                    onChange={(event) =>
                      setGiftMessage(event.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="order-note">
                    Delivery instructions
                  </label>

                  <textarea
                    id="order-note"
                    rows="2"
                    maxLength="300"
                    value={orderNote}
                    disabled={busy || confirmationPending}
                    onChange={(event) =>
                      setOrderNote(event.target.value)
                    }
                  />
                </div>
              </details>
            </>
          ) : (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <h2>DELIVER TO</h2>

                  <button
                    type="button"
                    className="text-link"
                    disabled={busy || confirmationPending}
                    onClick={() => {
                      setStep("address");
                      setError("");
                    }}
                  >
                    Edit
                  </button>
                </div>

                <strong>{address.fullName}</strong>

                <p>
                  {address.addressLine}
                  {address.landmark
                    ? `, ${address.landmark}`
                    : ""}
                  <br />
                  {address.city}, {address.state}
                  {" – "}
                  {address.pincode}
                </p>

                <p className="muted">
                  {address.phone} · {address.email}
                </p>
              </section>

              <fieldset
                className="delivery-methods"
                disabled={busy || confirmationPending}
              >
                <legend>DELIVERY METHOD</legend>

                <label className="check">
                  <input
                    type="radio"
                    name="delivery"
                    value="standard"
                    checked={method === "standard"}
                    onChange={() =>
                      changeDeliveryMethod("standard")
                    }
                  />

                  <span>
                    <strong>Standard delivery</strong>
                    <br />
                    <small className="muted">
                      {standardDeliveryText}
                    </small>
                  </span>
                </label>

                <label className="check">
                  <input
                    type="radio"
                    name="delivery"
                    value="express"
                    checked={method === "express"}
                    onChange={() =>
                      changeDeliveryMethod("express")
                    }
                  />

                  <span>
                    <strong>Express delivery</strong>
                    <br />
                    <small className="muted">
                      {expressDeliveryText}
                    </small>
                  </span>
                </label>
              </fieldset>

              <section className="panel">
                <h2>PAYMENT METHOD</h2>

                <fieldset
                  disabled={
                    busy ||
                    confirmationPending ||
                    !user ||
                    !token
                  }
                >
                  <legend className="sr-only">
                    Choose how to pay
                  </legend>

                  <label className="check">
                    <input
                      type="radio"
                      name="payment"
                      value="cod-partial"
                      checked={
                        paymentMethod === "cod-partial"
                      }
                      onChange={() =>
                        changePaymentMethod("cod-partial")
                      }
                    />

                    <span>
                      <strong>COD with 10% advance</strong>
                      <br />

                      <small>
                        Pay {money(codAdvanceAmount)} online
                        now.
                      </small>
                      <br />

                      <small className="muted">
                        Pay {money(codBalanceAmount)} on
                        delivery.
                      </small>
                    </span>
                  </label>

                  <label className="check">
                    <input
                      type="radio"
                      name="payment"
                      value="razorpay"
                      checked={
                        paymentMethod === "razorpay"
                      }
                      onChange={() =>
                        changePaymentMethod("razorpay")
                      }
                    />

                    <span>
                      <strong>Online payment</strong>
                      <br />

                      <small>
                        Pay {money(pricing.finalTotal)}
                        {" "}
                        securely through Razorpay.
                      </small>
                      <br />

                      <small className="muted">
                        Nothing remains payable on
                        delivery.
                      </small>
                    </span>
                  </label>
                </fieldset>

                {!user && (
                  <p>
                    <Link to={loginPath}>Sign in</Link>
                    {" "}
                    to continue with payment.
                  </p>
                )}

                <p className="notice">
                  {paymentMethod === "cod-partial"
                    ? `Pay ${money(
                        codAdvanceAmount,
                      )} now and ${money(
                        codBalanceAmount,
                      )} on delivery. The advance is 10% of merchandise after coupons; delivery charges remain in the balance.`
                    : `Pay the complete order amount of ${money(
                        pricing.finalTotal,
                      )} online. GymDrobe confirms your order after backend payment verification.`}
                </p>
              </section>

              <section className="panel">
                <h2>ORDER ITEMS</h2>

                {items.map((item, index) => (
                  <p
                    key={getCartItemKey(item) || index}
                  >
                    <strong>{item.name}</strong>

                    {[
                      item.selectedColor,
                      item.selectedSize,
                    ].filter(Boolean).length > 0 &&
                      ` · ${[
                        item.selectedColor,
                        item.selectedSize,
                      ]
                        .filter(Boolean)
                        .join(" / ")}`}

                    {` × ${item.quantity} · `}

                    <strong>
                      {money(
                        Number(item.price || 0) *
                          Number(item.quantity || 0),
                      )}
                    </strong>
                  </p>
                ))}
              </section>

              {(giftMessage.trim() ||
                orderNote.trim()) && (
                <section className="panel">
                  <h2>ORDER NOTES</h2>

                  {giftMessage.trim() && (
                    <p>
                      <strong>Gift message:</strong>
                      {" "}
                      {giftMessage.trim()}
                    </p>
                  )}

                  {orderNote.trim() && (
                    <p>
                      <strong>
                        Delivery instructions:
                      </strong>
                      {" "}
                      {orderNote.trim()}
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </form>

        <aside className="checkout-summary">
          {step === "address" && (
            <CouponBox subtotal={pricing.subtotal} />
          )}

          <PriceSummary
            cart={items}
            coupon={store.coupon}
            deliveryMethod={method}
          >
            {step === "review" && (
              <div className="panel">
                <h3>PAYMENT SUMMARY</h3>

                <p>
                  Pay now{" "}
                  <strong>
                    {money(
                      paymentMethod === "cod-partial"
                        ? codAdvanceAmount
                        : pricing.finalTotal,
                    )}
                  </strong>
                </p>

                <p>
                  Pay on delivery{" "}
                  <strong>
                    {money(
                      paymentMethod === "cod-partial"
                        ? codBalanceAmount
                        : 0,
                    )}
                  </strong>
                </p>
              </div>
            )}

            {!user && step === "review" && (
              <Link
                className="button full"
                to={loginPath}
              >
                Continue with Google
              </Link>
            )}

            {(user || step === "address") && (
              <button
                type="submit"
                form="checkout-form"
                className="button full"
                disabled={
                  busy ||
                  confirmationPending ||
                  (step === "review" &&
                    (!user ||
                      !token ||
                      !store.catalogReady))
                }
              >
                {confirmationPending
                  ? "Check My orders for payment confirmation"
                  : busy
                    ? "Processing secure payment…"
                    : step === "address"
                      ? "Continue to delivery & payment"
                      : `Pay ${money(
                          paymentMethod === "cod-partial"
                            ? codAdvanceAmount
                            : pricing.finalTotal,
                        )} & place order`}
              </button>
            )}

            <p className="muted">
              {step === "address"
                ? "Review delivery, payment and the final total before paying."
                : "After payment is verified and the order is confirmed, you will go to My orders."}
            </p>
          </PriceSummary>
        </aside>
      </div>
    </div>
  );
}