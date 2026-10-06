import {
  analyticsVisitKey,
  commercePayload,
  trackEvent,
  trackOnce,
  trackPurchase,
} from "../utils/analytics.js";
import { checkoutSignature } from "../utils/checkout.js";
import { readSession, writeSession } from "../utils/shopperStorage.js";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { selectedBag } from "../utils/commerce.js";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { getCartItemKey, revalidateCart } from "../utils/cartUtils.js";
import {
  calculateOrderPricing,
  resolveCoupon,
} from "../utils/orderCalculations.js";
import { money, roundMoney } from "../utils/productPricing.js";
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
import { openRazorpayCheckout } from "../utils/razorpay.js";
import AddressForm from "../components/AddressForm.jsx";
import CouponBox from "../components/CouponBox.jsx";
import PriceSummary from "../components/PriceSummary.jsx";
import EmptyState from "../components/EmptyState.jsx";
// ======================================================
// PAYMENT
// ======================================================
const COD_ADVANCE_PERCENTAGE = 10;
// ======================================================
// HELPERS
// ======================================================
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
    String(a?.addressLine || "")
      .trim()
      .toLowerCase() ===
      String(b?.addressLine || "")
        .trim()
        .toLowerCase() &&
    String(a?.pincode || "").trim() === String(b?.pincode || "").trim() &&
    String(a?.phone || "").replace(/\D/g, "") ===
      String(b?.phone || "").replace(/\D/g, "")
  );
}
// ======================================================
// CHECKOUT PAGE
// ======================================================
export default function CheckoutPage() {
  const { getLatestProducts, refreshProducts } = useCatalog();
  const tools = useShoppingTools();
  const { user, token } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ====================================================
  // CHECKOUT MODE
  // ====================================================
  const isBuyNow = params.get("mode") === "buy-now";
  const isSelection = params.get("mode") === "selection";
  const checkoutMode = isBuyNow
    ? "buy-now"
    : isSelection
      ? "selection"
      : "cart";
  // ====================================================
  // ITEMS
  // ====================================================
  const items = isBuyNow
    ? store.buyNowItem
      ? [store.buyNowItem]
      : []
    : isSelection
      ? selectedBag(store.cart, tools.checkoutKeys)
      : store.cart;
  // ====================================================
  // SAVED OPTIONS
  // ====================================================
  const [draftOptions] = useState(() =>
    readStorage(userKey("gymdrobe-checkout-options", user), {}),
  );
  const [giftMessage, setGiftMessage] = useState(
    draftOptions?.giftMessage || "",
  );
  const [orderNote, setOrderNote] = useState(draftOptions?.orderNote || "");
  const [method, setMethod] = useState(
    draftOptions?.method === "express" ? "express" : "standard",
  );
  // ====================================================
  // PAYMENT METHOD
  // ====================================================
  const [paymentMethod, setPaymentMethod] = useState(
    ["razorpay", "cod-partial"].includes(draftOptions?.paymentMethod)
      ? draftOptions.paymentMethod
      : "cod-partial",
  );
  // ====================================================
  // ADDRESSES
  // ====================================================
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(Boolean(user));
  const [addressesError, setAddressesError] = useState("");
  const [address, setAddress] = useState(() => {
    const draft = readStorage(userKey("gymdrobe-checkout-details", user), {});
    return normalizeAddress({
      ...EMPTY_ADDRESS,
      ...(draft && typeof draft === "object" ? draft : {}),
      fullName: draft?.fullName || draft?.name || user?.name || "",
      email: user?.email || draft?.email || "",
      phone: draft?.phone || user?.phone || "",
      pincode:
        draft?.pincode ||
        readStorage(store.shoppingKey("gymdrobe-delivery-pincode"), ""),
    });
  });
  const [saveAddress, setSaveAddress] = useState(Boolean(user));
  // ====================================================
  // UI STATE
  // ====================================================
  const [step, setStep] = useState("address");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const reviewed = useRef(null);
  // ====================================================
  // CHECKOUT ATTEMPT
  // ====================================================
  const attemptKey = store.shoppingKey(
    `gymdrobe-checkout-attempt-${checkoutMode}`,
  );
  const [attempt, setAttempt] = useState(
    () => readSession(attemptKey, null) || makeId("checkout"),
  );
  const checkoutToken = `${attempt}-${paymentMethod}`;
  useEffect(() => {
    writeSession(attemptKey, attempt);
  }, [attemptKey, attempt]);
  // ====================================================
  // LOAD SAVED ADDRESSES
  // ====================================================
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
        if (cancelled) {
          return;
        }
        const saved = Array.isArray(result) ? result : [];
        setAddresses(saved);
        const preferred = saved.find((item) => item.isDefault) || saved[0];
        if (preferred && !String(address?.addressLine || "").trim()) {
          setAddress(
            normalizeAddress({
              ...preferred,
              id: getAddressId(preferred),
              email: preferred.email || user.email || "",
            }),
          );
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.error("Checkout address load error:", loadError);
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
  // ====================================================
  // SAVE DRAFT
  // ====================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      writeStorage(userKey("gymdrobe-checkout-details", user), address);
      writeStorage(userKey("gymdrobe-checkout-options", user), {
        method,
        paymentMethod,
        giftMessage,
        orderNote,
      });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [address, method, paymentMethod, giftMessage, orderNote, user?.id]);
  // ====================================================
  // PRICING
  // ====================================================
  const pricing = calculateOrderPricing({
    cart: items,
    coupon: store.coupon,
    deliveryMethod: method,
  });
  const codAdvanceAmount = roundMoney(
    (Number(pricing.totalAfterCoupon || 0) * COD_ADVANCE_PERCENTAGE) / 100,
  );
  const codBalanceAmount = roundMoney(
    Math.max(0, Number(pricing.finalTotal || 0) - codAdvanceAmount),
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
          ...commercePayload(items, pricing.totalAfterCoupon),
          checkout_mode: checkoutMode,
        },
      );
    track();
    window.addEventListener("gymdrobe-analytics-ready", track);
    return () => window.removeEventListener("gymdrobe-analytics-ready", track);
  }, [analyticsItemsKey, checkoutMode, pricing.totalAfterCoupon]);
  // ====================================================
  // REVIEW SIGNATURE
  // ====================================================
  function reviewSignature(deliveryMethod = method, payment = paymentMethod) {
    return JSON.stringify({
      checkout: checkoutSignature(items, store.coupon, deliveryMethod),
      paymentMethod: payment,
    });
  }
  // ====================================================
  // NEW ATTEMPT
  // ====================================================
  function createNewAttempt() {
    const next = makeId("checkout");
    setAttempt(next);
    writeSession(attemptKey, next);
    return next;
  }
  // ====================================================
  // VALIDATE ADDRESS
  // ====================================================
  function validate() {
    const invalid = addressErrors(address);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      setStep("address");
      requestAnimationFrame(() =>
        document.querySelector('[aria-invalid="true"]')?.focus(),
      );
      return false;
    }
    return true;
  }
  // ====================================================
  // SELECT ADDRESS
  // ====================================================
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
  // ====================================================
  // SAVE ADDRESS
  // ====================================================
  async function saveCheckoutAddressIfNeeded() {
    if (!user || !token || !saveAddress) {
      return;
    }
    const duplicate = addresses.some((item) => sameAddress(item, address));
    if (duplicate) {
      return;
    }
    try {
      const created = await createSavedAddress(token, {
        ...addressPayload(address),
        isDefault: addresses.length === 0,
      });
      if (created) {
        setAddresses((current) => [
          ...current.map((item) =>
            created.isDefault
              ? {
                  ...item,
                  isDefault: false,
                }
              : item,
          ),
          created,
        ]);
      }
    } catch (saveError) {
      console.error("Checkout saved-address error:", saveError);
      store.notify(
        "Your order was placed, but this address could not be added to your saved addresses.",
        "warning",
      );
    }
  }
  // ====================================================
  // REVALIDATED CART
  // ====================================================
  function applyRevalidatedCart(checked) {
    if (isBuyNow) {
      store.refreshBuyNow(checked.cart?.[0]);
      return;
    }
    const selectedKeys = items.map(getCartItemKey);
    store.setCart([
      ...store.cart.filter(
        (item) => !selectedKeys.includes(getCartItemKey(item)),
      ),
      ...(checked.cart || []),
    ]);
  }
  // ====================================================
  // CLEAR PURCHASED ITEMS
  // ====================================================
  function clearPurchasedItems() {
    if (isBuyNow) {
      store.clearBuyNow();
      return;
    }
    const orderedKeys = items.map(getCartItemKey);
    store.setCart((current) =>
      current.filter((item) => !orderedKeys.includes(getCartItemKey(item))),
    );
    tools.startSelection([]);
    store.setCoupon(null);
  }
  // ====================================================
  // SUCCESS
  // ====================================================
  async function finishSuccessfulOrder(savedOrder, { existing = false } = {}) {
    if (!savedOrder) {
      throw new Error("Your order could not be loaded after checkout.");
    }
    trackPurchase(savedOrder);
    if (!existing) {
      await saveCheckoutAddressIfNeeded();
    }
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
          checkoutToken: savedOrder?.metadata?.checkoutToken || checkoutToken,
        },
      };
      const cached = persistOrder(orderForLocalPages);
      if (!cached) {
        console.warn(
          "MongoDB order was created, but its temporary local cache could not be saved.",
        );
      }
      try {
        if (typeof refreshProducts === "function") {
          await refreshProducts();
        }
      } catch (refreshError) {
        console.error("Product refresh after checkout failed:", refreshError);
        store.notify(
          "Your order was placed, but the latest stock could not be refreshed yet.",
          "warning",
        );
      }
    }
    writeStorage(userKey("gymdrobe-last-order", user), orderForLocalPages);
    clearPurchasedItems();
    writeSession(attemptKey, null);
    writeStorage(userKey("gymdrobe-checkout-options", user), {
      method: "standard",
      paymentMethod: "cod-partial",
      giftMessage: "",
      orderNote: "",
    });
    navigate(`/order-success?orderId=${encodeURIComponent(savedOrder.id)}`, {
      replace: true,
    });
  }
  // ====================================================
  // PAYMENT METHOD
  // ====================================================
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
  // ====================================================
  // DELIVERY METHOD
  // ====================================================
  function changeDeliveryMethod(next) {
    setMethod(next);
    setError("");
    createNewAttempt();
    if (step === "review") {
      reviewed.current = reviewSignature(next, paymentMethod);
    }
  }
  // ====================================================
  // RAZORPAY
  // ====================================================
  async function placeRazorpayOrder({
    checked,
    coupon,
    cleanShippingAddress,
    latestPricing,
  }) {
    if (!user || !token) {
      throw new Error("Sign in to continue with payment.");
    }
    trackEvent("add_shipping_info", {
      ...commercePayload(checked.cart, latestPricing.totalAfterCoupon),
      shipping_tier: method,
    });
    trackEvent("add_payment_info", {
      ...commercePayload(checked.cart, latestPricing.totalAfterCoupon),
      payment_type: paymentMethod,
    });
    trackEvent("payment_attempt", {
      ...commercePayload(checked.cart, latestPricing.totalAfterCoupon),
      payment_type: paymentMethod,
    });
    const gatewayOrder = await createRazorpayPaymentOrder(token, {
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
    if (gatewayOrder?.alreadyPaid && gatewayOrder?.order) {
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
      throw new Error("Razorpay payment could not be started.");
    }
    const description =
      paymentMethod === "cod-partial"
        ? `10% advance for ${gatewayOrder.orderNumber || "GymDrobe order"}`
        : gatewayOrder.orderNumber
          ? `Full payment for ${gatewayOrder.orderNumber}`
          : "GymDrobe order payment";
    const paymentResponse = await openRazorpayCheckout({
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
        gymdrobe_order: gatewayOrder.orderNumber || "",
        payment_method: paymentMethod,
      },
      retry: {
        enabled: true,
      },
      modal: {
        confirm_close: true,
      },
    });
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
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_signature: paymentResponse.razorpay_signature,
    };
    try {
      const verified = await verifyRazorpayPayment(token, verifyPayload);
      return {
        order: verified.order,
        existing: Boolean(verified.existing),
      };
    } catch (verificationError) {
      if (verificationError?.data?.retryVerification) {
        const retried = await verifyRazorpayPayment(token, verifyPayload);
        return {
          order: retried.order,
          existing: Boolean(retried.existing),
        };
      }
      throw verificationError;
    }
  }
  // ====================================================
  // SUBMIT
  // ====================================================
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) {
      return;
    }
    setError("");
    if (!validate()) {
      return;
    }
    // ADDRESS → REVIEW
    if (step === "address") {
      writeStorage(userKey("gymdrobe-checkout-details", user), address);
      reviewed.current = reviewSignature();
      setStep("review");
      window.scrollTo({
        top: 0,
        behavior: "instant",
      });
      return;
    }
    if (!user || !token) {
      setError("Please sign in before placing your GymDrobe order.");
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
    const checked = revalidateCart(items, getLatestProducts());
    if (!checked.cart.length || checked.changes.length) {
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
      selectedCoupon && pricing.subtotal >= selectedCoupon.minimum
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
      await finishSuccessfulOrder(result.order, {
        existing: result.existing,
      });
      return;
    } catch (paymentError) {
      console.error("GymDrobe payment error:", paymentError);
      const paymentReceived = Boolean(paymentError?.data?.paymentReceived);
      trackEvent(
        paymentReceived
          ? "payment_confirmation_pending"
          : paymentError.code === "RAZORPAY_CANCELLED"
            ? "payment_cancelled"
            : "checkout_payment_error",
        {
          payment_type: paymentMethod,
          failure_stage: paymentReceived ? "confirmation" : "checkout",
        },
      );
      if (paymentReceived) {
        setError(
          paymentError.message ||
            "Your payment was received, but the order still requires confirmation. Do not make another payment.",
        );
      } else {
        setError(paymentError.message || "Payment could not be completed.");
      }
      submitting.current = false;
      setBusy(false);
    }
  }
  // ====================================================
  // CRO DISPLAY VALUES
  // ====================================================
  const itemCount = items.reduce(
    (total, item) => total + Number(item.quantity || 0),
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
  // ====================================================
  // EMPTY
  // ====================================================
  if (!items.length) {
    return (
      <EmptyState
        title={
          isBuyNow
            ? "Choose your Buy now selection again"
            : "Your checkout is empty"
        }
      >
        <p>Return to a product or add something to your bag to continue.</p>
        <Link className="button" to="/shop">
          Continue shopping
        </Link>
      </EmptyState>
    );
  }
  // ====================================================
  // PAGE
  // ====================================================
  return (
    <div className="page narrow checkout-page">
      {/* CHECKOUT PROGRESS */}
      <nav className="checkout-steps" aria-label="Checkout progress">
        <Link to="/cart">1. BAG</Link>
        <strong className={step === "address" ? "active" : undefined}>
          2. ADDRESS
        </strong>
        <strong className={step === "review" ? "active" : "muted"}>
          3. REVIEW & PAY
        </strong>
      </nav>
      {/* HEADING */}
      <div className="page-heading">
        <div>
          <h1>
            {step === "address" ? "Delivery details" : "Review & payment"}
          </h1>
          <p className="muted">
            {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
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
            disabled={busy}
            onClick={() => {
              setStep("address");
              setError("");
            }}
          >
            Edit details
          </button>
        )}
      </div>
      {/* TRUST */}
      <div className="notice" role="status">
        <strong>Secure GymDrobe checkout</strong>
        <br />
        {user
          ? "Choose full online payment or COD with a 10% online advance. Both payment flows are verified securely through Razorpay."
          : "You can enter your delivery details first. Sign in before payment so GymDrobe can securely create and verify your order."}
      </div>
      {!user && (
        <p className="checkout-signin">
          Already have an account? <Link to={loginPath}>Sign in</Link>
        </p>
      )}
      {/* MAIN */}
      <div className="checkout-layout">
        <form
          id="checkout-form"
          className="checkout-form"
          onSubmit={submit}
          noValidate
        >
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          {/* ===========================================
              ADDRESS STEP
          ============================================ */}
          {step === "address" ? (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">STEP 1</p>
                    <h2>CONTACT & DELIVERY ADDRESS</h2>
                  </div>
                </div>
                {user && addressesLoading && (
                  <p className="muted">Loading your saved addresses…</p>
                )}
                {user && addressesError && (
                  <p className="field-error" role="alert">
                    {addressesError}
                  </p>
                )}
                {user && !addressesLoading && addresses.length > 0 && (
                  <div className="saved-address-choices">
                    <h3>Use a saved address</h3>
                    {addresses.map((item) => {
                      const id = getAddressId(item);
                      return (
                        <button
                          type="button"
                          key={id}
                          className="saved-address-choice"
                          aria-pressed={
                            String(getAddressId(address)) === String(id)
                          }
                          onClick={() => selectSavedAddress(item)}
                        >
                          <strong>
                            {item.fullName}
                            {" · "}
                            {item.label || "Home"}
                            {item.isDefault ? " · Default" : ""}
                          </strong>
                          <span>
                            {item.addressLine}
                            {item.landmark ? `, ${item.landmark}` : ""}
                            {", "}
                            {item.city} {item.pincode}
                          </span>
                        </button>
                      );
                    })}
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
                      onChange={(event) => setSaveAddress(event.target.checked)}
                    />
                    Save this address for next time
                  </label>
                )}
              </section>
              {/* OPTIONAL DETAILS */}
              <details className="panel">
                <summary>
                  Gift message & delivery instructions (optional)
                </summary>
                <div className="field">
                  <label htmlFor="gift-message">Gift message</label>
                  <textarea
                    id="gift-message"
                    rows="3"
                    maxLength="250"
                    disabled={busy}
                    value={giftMessage}
                    onChange={(event) => setGiftMessage(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="order-note">Delivery instructions</label>
                  <textarea
                    id="order-note"
                    rows="2"
                    maxLength="300"
                    disabled={busy}
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                  />
                </div>
              </details>
            </>
          ) : (
            <>
              {/* DELIVERY ADDRESS */}
              <section className="panel">
                <div className="panel-heading">
                  <h2>DELIVER TO</h2>
                  <button
                    type="button"
                    className="text-link"
                    disabled={busy}
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
                  {address.landmark ? `, ${address.landmark}` : ""}
                  <br />
                  {address.city}
                  {", "}
                  {address.state}
                  {" – "}
                  {address.pincode}
                </p>
                <p className="muted">
                  {address.phone}
                  {" · "}
                  {address.email}
                </p>
              </section>
              {/* DELIVERY METHOD */}
              <fieldset className="delivery-methods" disabled={busy}>
                <legend>DELIVERY METHOD</legend>
                <label className="check">
                  <input
                    type="radio"
                    name="delivery"
                    value="standard"
                    checked={method === "standard"}
                    onChange={() => changeDeliveryMethod("standard")}
                  />
                  <span>
                    <strong>Standard delivery</strong>
                    <br />
                    <small className="muted">{standardDeliveryText}</small>
                  </span>
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="delivery"
                    value="express"
                    checked={method === "express"}
                    onChange={() => changeDeliveryMethod("express")}
                  />
                  <span>
                    <strong>Express delivery</strong>
                    <br />
                    <small className="muted">{expressDeliveryText}</small>
                  </span>
                </label>
                <p className="muted">
                  Shipping is not included when calculating the 10% COD advance.
                </p>
              </fieldset>
              {/* PAYMENT */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">SECURE PAYMENT</p>
                    <h2>PAYMENT METHOD</h2>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  <label
                    className="check"
                    style={
                      !user
                        ? {
                            opacity: 0.55,
                          }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cod-partial"
                      disabled={busy || !user || !token}
                      checked={paymentMethod === "cod-partial"}
                      onChange={() => changePaymentMethod("cod-partial")}
                    />
                    <span>
                      <strong>COD with 10% advance</strong>
                      <br />
                      <small>
                        Pay {money(codAdvanceAmount)} securely online now
                      </small>
                      <br />
                      <small className="muted">
                        {money(codBalanceAmount)} remains payable on delivery
                      </small>
                    </span>
                  </label>
                  <label
                    className="check"
                    style={
                      !user
                        ? {
                            opacity: 0.55,
                          }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="razorpay"
                      disabled={busy || !user || !token}
                      checked={paymentMethod === "razorpay"}
                      onChange={() => changePaymentMethod("razorpay")}
                    />
                    <span>
                      <strong>Full Online Payment</strong>
                      <br />
                      <small>
                        Pay {money(pricing.finalTotal)} securely through
                        Razorpay
                      </small>
                      <br />
                      <small className="muted">
                        Nothing remains payable on delivery
                      </small>
                    </span>
                  </label>
                </div>
                {!user && (
                  <p className="muted">
                    <Link to={loginPath}>Sign in</Link> to choose a payment
                    method and place your order.
                  </p>
                )}
                {paymentMethod === "cod-partial" ? (
                  <div className="notice">
                    <strong>Pay {money(codAdvanceAmount)} now</strong>
                    <br />
                    The remaining <strong>
                      {money(codBalanceAmount)}
                    </strong>{" "}
                    will be collected on delivery.
                    <br />
                    <small>
                      The 10% advance is calculated only from merchandise after
                      coupon discount. Shipping is excluded from the advance.
                    </small>
                  </div>
                ) : (
                  <div className="notice">
                    <strong>Pay in full: {money(pricing.finalTotal)}</strong>
                    <br />
                    The complete order amount will be verified through Razorpay
                    before confirmation.
                  </div>
                )}
              </section>
              {/* ORDER ITEMS */}
              <section className="panel">
                <div className="panel-heading">
                  <h2>ORDER ITEMS</h2>
                  <span className="muted">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                {items.map((item, index) => {
                  const options = [item.selectedColor, item.selectedSize]
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <p key={getCartItemKey(item) || index}>
                      <strong>{item.name}</strong>
                      {options ? ` · ${options}` : ""}
                      {" × "}
                      {item.quantity}
                      {" · "}
                      <strong>
                        {money(
                          Number(item.price || 0) * Number(item.quantity || 0),
                        )}
                      </strong>
                    </p>
                  );
                })}
              </section>
              {/* NOTES SUMMARY */}
              {(giftMessage.trim() || orderNote.trim()) && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>ORDER NOTES</h2>
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy}
                      onClick={() => setStep("address")}
                    >
                      Edit
                    </button>
                  </div>
                  {giftMessage.trim() && (
                    <p>
                      <strong>Gift message:</strong> {giftMessage.trim()}
                    </p>
                  )}
                  {orderNote.trim() && (
                    <p>
                      <strong>Delivery instructions:</strong> {orderNote.trim()}
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </form>
        {/* SUMMARY */}
        <aside className="checkout-summary">
          {step === "address" && <CouponBox subtotal={pricing.subtotal} />}
          <PriceSummary
            cart={items}
            coupon={store.coupon}
            deliveryMethod={method}
          >
            {step === "review" && (
              <div
                className="panel"
                style={{
                  marginBottom: "16px",
                }}
              >
                <div className="panel-heading">
                  <h3>PAYMENT SUMMARY</h3>
                </div>
                {paymentMethod === "cod-partial" ? (
                  <>
                    <p>
                      Pay now <strong>{money(codAdvanceAmount)}</strong>
                    </p>
                    <p>
                      Pay on delivery <strong>{money(codBalanceAmount)}</strong>
                    </p>
                    <p className="muted">
                      Shipping stays in the delivery balance and is not part of
                      the 10% advance.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Pay now <strong>{money(pricing.finalTotal)}</strong>
                    </p>
                    <p>
                      Pay on delivery <strong>{money(0)}</strong>
                    </p>
                  </>
                )}
              </div>
            )}
            {!user && step === "review" && (
              <Link className="button full" to={loginPath}>
                Sign in to continue
              </Link>
            )}
            {(user || step === "address") && (
              <button
                type="submit"
                form="checkout-form"
                className="button full"
                disabled={busy || (step === "review" && (!user || !token))}
              >
                {busy
                  ? "Opening secure payment…"
                  : step === "address"
                    ? "Continue to delivery & payment"
                    : paymentMethod === "cod-partial"
                      ? `Pay ${money(codAdvanceAmount)} & place order`
                      : `Pay ${money(pricing.finalTotal)} & place order`}
              </button>
            )}
            <p
              className="muted"
              style={{
                marginTop: "10px",
              }}
            >
              {step === "address"
                ? "You can review delivery, payment and the final total before paying."
                : paymentMethod === "cod-partial"
                  ? `GymDrobe confirms the order only after the ${COD_ADVANCE_PERCENTAGE}% Razorpay advance is verified.`
                  : "GymDrobe confirms the order only after the full Razorpay payment is verified."}
            </p>
            {step === "review" && (
              <p className="muted">
                Secure payment verification · Final stock and price rechecked
                before order confirmation
              </p>
            )}
          </PriceSummary>
        </aside>
      </div>
    </div>
  );
}
