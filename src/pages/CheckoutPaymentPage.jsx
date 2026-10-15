import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";

import { selectedBag } from "../utils/commerce.js";
import { getCartItemKey } from "../utils/cartUtils.js";
import { reviewCart } from "../utils/cartReview.js";
import { buyingInformation } from "../utils/productInformation.js";

import {
  calculateOrderPricing,
  resolveCoupon,
  FREE_SHIPPING_LIMIT,
} from "../utils/orderCalculations.js";

import { money } from "../utils/productPricing.js";

import {
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
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";

import {
  checkoutAddress,
  checkoutAddressErrors,
  checkoutFingerprint,
  paymentAmounts,
  validateGateway,
  validateConfirmedOrder,
  orderIsComplete,
  subtractPurchasedItems,
} from "../utils/checkoutPayment.js";

import {
  analyticsVisitKey,
  commercePayload,
  trackOnce,
  trackEvent,
  trackPurchase,
} from "../utils/analytics.js";

import {
  getAddresses,
  createAddress,
} from "../services/addressApi.js";

import {
  createRazorpayPaymentOrder,
  verifyRazorpayPayment,
} from "../services/paymentApi.js";

import {
  getOrderById,
} from "../services/orderApi.js";

import {
  loadRazorpay,
  openRazorpayCheckout,
} from "../utils/razorpay.js";

import {
  getCheckoutQuote,
} from "../services/checkoutQuoteApi.js";

import {
  containsKit,
  checkoutSelectionRows,
  kitSelectionIssue,
  kitQuoteSignature,
  kitQuotePayable,
} from "../utils/kitPaymentReview.js";

import CheckoutKitReview from "../components/CheckoutKitReview.jsx";

import {
  ProductImage,
} from "../components/StorefrontShared.jsx";

import AddressForm from "../components/AddressForm.jsx";
import CouponBox from "../components/CouponBox.jsx";
import EmptyState from "../components/EmptyState.jsx";

import "../utils/CheckoutPage.css";

const text = (value) =>
  typeof value === "string"
    ? value
    : "";

export default function CheckoutPage() {
  const auth = useAuth();
  const [params] = useSearchParams();

  const mode = [
    "buy-now",
    "selection",
  ].includes(params.get("mode"))
    ? params.get("mode")
    : "cart";

  if (auth.loading) {
    return (
      <div
        className="page narrow"
        role="status"
      >
        Checking your account…
      </div>
    );
  }

  const identity = String(
    auth.user?.id ||
    auth.user?._id ||
    "guest",
  );

  return (
    <Checkout
      key={`${identity}:${mode}:${auth.token || ""}`}
      auth={auth}
      mode={mode}
    />
  );
}

function Checkout({ auth, mode }) {
  const { user, token } = auth;

  const store = useStore();
  const catalog = useCatalog();
  const tools = useShoppingTools();
  const navigate = useNavigate();

  const optionsKey = userKey(
    "gymdrobe-checkout-options",
    user,
  );

  const addressKey = userKey(
    "gymdrobe-checkout-address",
    user,
  );

  const pendingKey = store.shoppingKey(
    `gymdrobe-payment-confirmation-${mode}`,
  );

  const activeKey = store.shoppingKey(
    "gymdrobe-active-checkout-v2",
  );

  const attemptKey = store.shoppingKey(
    `gymdrobe-checkout-attempt-${mode}`,
  );

  const [savedAttempt] = useState(
    () =>
      readSession(activeKey, null) ||
      readSession(pendingKey, null),
  );

  const [draft] = useState(
    () =>
      readStorage(optionsKey, {}) || {},
  );

  const [address, setAddress] = useState(() =>
    checkoutAddress({
      ...EMPTY_ADDRESS,

      ...normalizeAddress(
        readStorage(addressKey, {}) || {},
      ),

      email:
        user?.email ||
        readStorage(addressKey, {})?.email ||
        "",

      fullName:
        readStorage(addressKey, {})?.fullName ||
        user?.name ||
        "",

      phone:
        readStorage(addressKey, {})?.phone ||
        user?.phone ||
        "",

      pincode:
        readStorage(addressKey, {})?.pincode ||
        readStorage(
          store.shoppingKey(
            "gymdrobe-delivery-pincode",
          ),
          "",
        ),

      ...(
        savedAttempt?.payload?.shippingAddress ||
        {}
      ),
    }),
  );

  const [method, setMethod] = useState(
    (
      savedAttempt?.payload?.deliveryMethod ||
      draft.deliveryMethod
    ) === "express"
      ? "express"
      : "standard",
  );

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState(
    savedAttempt?.payload?.paymentMethod ===
      "cod-partial"
      ? "cod-partial"
      : "razorpay",
  );

  const [
    giftMessage,
    setGiftMessage,
  ] = useState(
    text(
      savedAttempt?.payload?.giftMessage ??
      draft.giftMessage,
    ).slice(0, 250),
  );

  const [
    orderNote,
    setOrderNote,
  ] = useState(
    text(
      savedAttempt?.payload?.orderNote ??
      draft.orderNote,
    ).slice(0, 300),
  );

  const [
    saveAddress,
    setSaveAddress,
  ] = useState(Boolean(user));

  const [
    addresses,
    setAddresses,
  ] = useState([]);

  const [
    addressesLoading,
    setAddressesLoading,
  ] = useState(Boolean(user && token));

  const [
    addressesError,
    setAddressesError,
  ] = useState("");

  const [
    kitResult,
    setKitResult,
  ] = useState(null);

  const [
    quoteError,
    setQuoteError,
  ] = useState("");

  const [
    quoteLoading,
    setQuoteLoading,
  ] = useState(false);

  const [
    quoteRevision,
    setQuoteRevision,
  ] = useState(0);

  const quoteSubmit = useRef(null);

  const [step, setStep] =
    useState("address");

  const [errors, setErrors] =
    useState({});

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [pending, setPending] =
    useState(savedAttempt);

  const pendingRef = useRef(pending);
  const current = useRef(null);

  current.current = {
    store,
    tools,
    addresses,
    address,
    saveAddress,
  };

  const mounted = useRef(false);
  const locked = useRef(false);
  const refreshLock = useRef(false);
  const finished = useRef(false);
  const addressTouched = useRef(false);
  const reviewed = useRef("");
  const formRef = useRef(null);

  const items =
    mode === "buy-now"
      ? store.buyNowItem
        ? [store.buyNowItem]
        : []
      : mode === "selection"
        ? selectedBag(
            store.cart,
            tools.checkoutKeys,
          )
        : store.cart;

  const ready =
    store.catalogReady &&
    !catalog.loading &&
    !catalog.error;

  const review = reviewCart(
    items,
    catalog.products,
    ready,
    {
      allowKitReview: true,
    },
  );

  const hasKits = containsKit(items);

  const kitIssue = kitSelectionIssue(
    items,
    store.cart,
    mode,
  );

  let quoteSignature = "";

  try {
    if (
      hasKits &&
      !kitIssue &&
      review.canCheckout
    ) {
      quoteSignature = kitQuoteSignature(
        review.pricingRows,
        store.coupon,
        method,
        paymentMethod,
        address.pincode,
      );
    }
  } catch {
    // Invalid grouping is reported by cart review.
  }

  const kitQuote =
    kitResult?.signature === quoteSignature
      ? kitResult.quote
      : null;

  const pricing = hasKits
    ? (
        kitQuote?.shippingIsEstimate === false
          ? kitQuote.pricing
          : null
      )
    : review.totalsKnown && items.length
      ? calculateOrderPricing({
          cart: review.pricingRows,
          coupon: store.coupon,
          deliveryMethod: method,
        })
      : null;

  const amounts = pricing
    ? paymentAmounts(
        pricing,
        paymentMethod,
      )
    : null;

  const loginPath =
    `/login?next=${encodeURIComponent(
      `/checkout?mode=${mode}`,
    )}`;

  const frozen =
    busy || Boolean(pending);

  const canPay =
    !kitIssue &&
    (
      !hasKits ||
      kitQuotePayable(kitQuote)
    ) &&
    review.canCheckout &&
    review.rows.length <= 50 &&
    Number.isSafeInteger(amounts?.paise) &&
    amounts.paise >= 100 &&
    Number.isSafeInteger(
      Math.round(
        pricing?.finalTotal * 100,
      ),
    );

  const displayedPricing =
    pending?.pricing || pricing;

  const displayedAmounts = displayedPricing
    ? paymentAmounts(
        displayedPricing,
        pending?.payload?.paymentMethod ||
          paymentMethod,
      )
    : null;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      quoteSubmit.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (
      !hasKits ||
      !quoteSignature ||
      !token ||
      pending ||
      !/^[1-9]\d{5}$/.test(
        String(address.pincode).trim(),
      )
    ) {
      setQuoteLoading(false);
      return;
    }

    const controller =
      new AbortController();

    let cancelled = false;

    setQuoteLoading(true);
    setQuoteError("");
    setKitResult(null);

    const timer = setTimeout(() => {
      getCheckoutQuote(
        token,
        {
          items: review.pricingRows,

          coupon:
            resolveCoupon(store.coupon)?.code ||
            "",

          deliveryMethod: method,
          paymentMethod,

          pincode: String(
            address.pincode,
          ).trim(),
        },
        {
          signal: controller.signal,
        },
      )
        .then((quote) => {
          if (!cancelled) {
            setKitResult({
              signature: quoteSignature,
              quote,
            });
          }
        })
        .catch((failure) => {
          if (!cancelled) {
            setQuoteError(
              failure.message ||
              "Kit prices could not be checked.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setQuoteLoading(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    hasKits,
    quoteSignature,
    token,
    Boolean(pending),
    quoteRevision,
  ]);

  useEffect(() => {
    if (!kitQuote || pending) {
      return;
    }

    const remaining =
      Date.parse(
        kitQuote.shippingReview?.validUntil,
      ) - Date.now();

    if (!Number.isFinite(remaining)) {
      return;
    }

    const timer = setTimeout(
      () => {
        setKitResult(null);

        setQuoteError(
          "The kit review expired. Refresh prices and delivery before paying.",
        );
      },
      Math.max(
        0,
        Math.min(
          remaining,
          2147483647,
        ),
      ),
    );

    return () => clearTimeout(timer);
  }, [
    kitQuote,
    Boolean(pending),
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        !mounted.current ||
        pendingRef.current
      ) {
        return;
      }

      writeStorage(
        addressKey,
        checkoutAddress(address),
      );

      writeStorage(
        optionsKey,
        {
          deliveryMethod: method,
          giftMessage,
          orderNote,
        },
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [
    address,
    method,
    giftMessage,
    orderNote,
    addressKey,
    optionsKey,
  ]);

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    let cancelled = false;

    getAddresses(token)
      .then((rows) => {
        if (cancelled) {
          return;
        }

        const valid = Array.isArray(rows)
          ? rows
          : [];

        setAddresses(valid);

        const preferred =
          valid.find(
            (row) => row.isDefault,
          ) || valid[0];

        if (
          preferred &&
          !addressTouched.current &&
          !pendingRef.current &&
          !current.current.address.addressLine
        ) {
          setAddress(
            checkoutAddress(
              normalizeAddress(preferred),
            ),
          );
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setAddressesError(
            failure.message ||
            "Saved addresses could not be loaded. Enter an address below.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, token]);

  useEffect(() => {
    function track() {
      if (
        !review.canCheckout ||
        !pricing
      ) {
        return;
      }

      trackOnce(
        `checkout:${analyticsVisitKey()}:${mode}`,
        "begin_checkout",

        commercePayload(
          review.pricingRows,
          pricing.totalAfterCoupon,
        ),
      );
    }

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
    mode,
    review.canCheckout,
    pricing?.totalAfterCoupon,
  ]);

  function remember(
    record,
    required = false,
  ) {
    const source =
      record?.payload?.source ||
      record?.mode ||
      pendingRef.current?.payload?.source ||
      pendingRef.current?.mode ||
      mode;

    const value = record
      ? {
          ...record,
          mode: source,
        }
      : null;

    const savedActive = writeSession(
      activeKey,
      value,
    );

    const savedMode = writeSession(
      store.shoppingKey(
        `gymdrobe-payment-confirmation-${source}`,
      ),
      value,
    );

    const saved =
      savedActive && savedMode;

    if (required && !saved) {
      throw new Error(
        "Enable browser session storage before starting payment. No payment was started.",
      );
    }

    pendingRef.current = value;

    if (mounted.current) {
      setPending(value);
    }

    return saved;
  }

  function finishOrder(order, record) {
    if (
      !mounted.current ||
      finished.current
    ) {
      return;
    }

    const savedOrder =
      validateConfirmedOrder(
        order,
        record,
        user?.id || user?._id,
      );

    finished.current = true;

    trackPurchase(savedOrder);

    persistOrder({
      ...savedOrder,
      ownerKey: ownerKey(user),
    });

    writeStorage(
      userKey(
        "gymdrobe-last-order",
        user,
      ),
      savedOrder,
    );

    // Save completion before cleaning the cart.
    const completionSaved = remember({
      ...record,
      phase: "complete",
      orderId: savedOrder.id,
    });

    const latest = current.current;

    if (
      completionSaved &&
      record.snapshot?.length &&
      record.phase !== "complete"
    ) {
      const purchaseMode =
        record.payload?.source ||
        record.mode ||
        mode;

      if (purchaseMode === "buy-now") {
        const bought = record.snapshot[0];
        const now = latest.store.buyNowItem;

        if (
          now &&
          getCartItemKey(now) ===
            getCartItemKey(bought) &&
          Number(now.quantity) ===
            Number(bought.quantity) &&
          Number(now.price) ===
            Number(bought.price)
        ) {
          latest.store.clearBuyNow();
        }
      } else if (
        latest.store.catalogReady
      ) {
        const quantities = (rows) =>
          JSON.stringify(
            rows
              .map((row) => [
                getCartItemKey(row),
                Number(row?.quantity),
              ])
              .sort(),
          );

        if (
          quantities(latest.store.cart) ===
          quantities(
            latest.store.latestCart(),
          )
        ) {
          const cleaned =
            subtractPurchasedItems(
              latest.store.cart,
              record.snapshot,
            );

          latest.store.setCart(cleaned);

          const purchasedKitIds = new Set(
            record.snapshot
              .map(
                (row) =>
                  row.kitGroup?.id,
              )
              .filter(Boolean),
          );

          if (
            cleaned.some(
              (row) =>
                purchasedKitIds.has(
                  row.kitGroup?.id,
                ),
            )
          ) {
            latest.store.notify(
              "Order confirmed. Your kit changed during payment, so its updated selections remain in your bag. Review them before ordering again.",
              "warning",
            );
          }
        } else {
          latest.store.notify(
            "Order confirmed. Your bag changed during payment; review it before ordering again.",
            "warning",
          );
        }
      } else {
        latest.store.notify(
          "Order confirmed. Review your bag when products are available again.",
          "info",
        );
      }
    } else if (
      !record.snapshot?.length &&
      record.phase !== "complete"
    ) {
      latest.store.notify(
        "Order confirmed. Review your bag; this older checkout has no saved item snapshot.",
        "info",
      );
    }

    if (completionSaved) {
      writeSession(attemptKey, null);
      remember(null);
    } else {
      latest.store.notify(
        "Order confirmed. Browser storage could not be updated; review your bag before ordering again.",
        "warning",
      );
    }

    if (
      record.saveAddress &&
      record.payload?.shippingAddress
    ) {
      const candidate =
        record.payload.shippingAddress;

      const same = (value) =>
        JSON.stringify(
          checkoutAddress(value),
        ) ===
        JSON.stringify(
          checkoutAddress(candidate),
        );

      if (!latest.addresses.some(same)) {
        // Optional saving must not delay confirmation.
        createAddress(
          token,
          candidate,
        ).catch(() => {
          latest.store.notify(
            "Order confirmed, but the address could not be saved.",
            "warning",
          );
        });
      }
    }

    latest.store.notify(
      savedOrder.payment.method ===
        "cod-partial" &&
      savedOrder.payment.status ===
        "partially-paid"
        ? "Advance received. Your order is confirmed."
        : "Payment completed. Your order is confirmed.",
      "success",
    );

    navigate("/orders", {
      replace: true,
    });
  }

  function acceptOrder(order, record) {
    if (orderIsComplete(order)) {
      finishOrder(order, record);
      return true;
    }

    if (
      order?.status === "cancelled" ||
      [
        "refunded",
        "partially-refunded",
      ].includes(order?.payment?.status)
    ) {
      const owner = String(
        order.user?.id ||
        order.user?._id ||
        "",
      );

      const id = String(
        order.orderNumber || order.id,
      );

      if (
        owner !==
          String(user?.id || user?._id) ||
        (
          record.orderId &&
          record.orderId !== id
        )
      ) {
        throw new Error(
          "The order reference could not be verified for this account.",
        );
      }

      remember({
        ...record,
        phase: "closed",
      });

      setError(
        "This order is cancelled or has a refund recorded. Check My orders before starting another checkout.",
      );

      return true;
    }

    return false;
  }

  useEffect(() => {
    if (
      !pending?.orderId ||
      !token ||
      finished.current ||
      pending.phase === "closed"
    ) {
      return;
    }

    let cancelled = false;
    let timer;

    async function poll() {
      try {
        if (!locked.current) {
          const record =
            pendingRef.current;

          const order = await getOrderById(
            token,
            record.orderId,
          );

          if (
            !cancelled &&
            mounted.current &&
            !locked.current &&
            pendingRef.current === record
          ) {
            acceptOrder(order, record);
          }
        }
      } catch {
        // Retain the reference and recovery controls.
      }

      if (
        !cancelled &&
        !finished.current
      ) {
        timer = setTimeout(
          poll,
          15000,
        );
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    pending?.orderId,
    pending?.phase,
    token,
  ]);

  async function refresh() {
    if (
      refreshLock.current ||
      frozen
    ) {
      return;
    }

    refreshLock.current = true;

    setRefreshing(true);

    try {
      await catalog.refreshProducts();
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure.message ||
          "Products could not be refreshed.",
        );
      }
    } finally {
      refreshLock.current = false;

      if (mounted.current) {
        setRefreshing(false);
      }
    }
  }

  function payloadFor(
    rows,
    latestPricing,
    quote = kitQuote,
  ) {
    const coupon =
      resolveCoupon(store.coupon);

    return {
      source: mode,
      paymentMethod,
      deliveryMethod: method,

      shippingAddress:
        checkoutAddress(address),

      giftMessage: giftMessage.trim(),
      orderNote: orderNote.trim(),

      items: checkoutSelectionRows(rows),

      ...(
        containsKit(rows)
          ? {
              expectedReviewKey:
                quote?.reviewKey,
            }
          : {}
      ),

      coupon:
        coupon &&
        latestPricing.subtotal >=
          coupon.minimum
          ? coupon.code
          : null,

      expectedTotal:
        latestPricing.finalTotal,
    };
  }

  async function pay(
    record,
    checkOnly = false,
    firstRequest = false,
  ) {
    if (
      locked.current ||
      !mounted.current ||
      !user ||
      !token ||
      !record?.payload ||
      record.phase === "closed"
    ) {
      return;
    }

    locked.current = true;

    setBusy(true);
    setError("");

    let active = record;

    try {
      if (!checkOnly) {
        await loadRazorpay();
      }

      if (!mounted.current) {
        return;
      }

      if (firstRequest) {
        remember(record, true);
      }

      const data =
        await createRazorpayPaymentOrder(
          token,
          record.payload,
        );

      if (!mounted.current) {
        return;
      }

      if (
        data.order &&
        acceptOrder(data.order, record)
      ) {
        return;
      }

      validateGateway(data, record);

      active = {
        ...record,
        phase: "ready",
        orderId: data.orderNumber,
        gatewayId: data.razorpayOrderId,

        testMode:
          data.keyId.startsWith(
            "rzp_test_",
          ),
      };

      remember(active);

      if (checkOnly) {
        setError(
          "The server has not recorded a completed payment. Resume payment to continue this same order. If money was deducted, check My orders or contact support first.",
        );

        return;
      }

      remember({
        ...active,
        phase: "check",
      });

      const response =
        await openRazorpayCheckout({
          key: data.keyId,
          order_id: data.razorpayOrderId,
          amount: data.amount,
          currency: data.currency,
          name: "GymDrobe",

          description:
            record.payload.paymentMethod ===
              "cod-partial"
              ? "10% COD advance"
              : "Order payment",

          prefill: {
            name:
              record.payload
                .shippingAddress.fullName,

            email:
              record.payload
                .shippingAddress.email,

            contact:
              record.payload
                .shippingAddress.phone,
          },

          notes: {
            gymdrobeOrderNumber:
              data.orderNumber,
          },

          retry: {
            enabled: true,
          },

          modal: {
            confirm_close: true,
          },
        });

      if (!mounted.current) {
        return;
      }

      if (
        response?.razorpay_order_id !==
          data.razorpayOrderId ||
        !/^pay_[A-Za-z0-9]+$/.test(
          response?.razorpay_payment_id ||
          "",
        ) ||
        !/^[a-f0-9]{64}$/i.test(
          response?.razorpay_signature ||
          "",
        )
      ) {
        throw new Error(
          "Payment confirmation was incomplete. Do not pay again; check this order.",
        );
      }

      active = {
        ...active,
        phase: "confirming",
      };

      remember(active);

      const verification = {
        checkoutToken:
          record.payload.checkoutToken,

        ...response,
      };

      let verified;

      try {
        verified =
          await verifyRazorpayPayment(
            token,
            verification,
          );
      } catch (failure) {
        if (!mounted.current) {
          return;
        }

        if (
          !failure.data?.retryVerification
        ) {
          throw failure;
        }

        verified =
          await verifyRazorpayPayment(
            token,
            verification,
          );
      }

      if (!mounted.current) {
        return;
      }

      if (
        !acceptOrder(
          verified.order,
          active,
        )
      ) {
        throw new Error(
          "Payment confirmation is still pending. Do not pay again; check this order.",
        );
      }
    } catch (failure) {
      if (!mounted.current) {
        return;
      }

      const safeRejection =
        firstRequest &&
        !active.orderId &&
        !failure.data?.verificationUncertain &&
        !failure.data?.paymentReceived &&
        (
          failure.status === 400 ||
          failure.status === 401 ||
          failure.status === 403 ||
          [
            "PAYMENT_NOT_CONFIGURED",
            "PRODUCT_UNAVAILABLE",
            "STOCK_UNAVAILABLE",
            "PRODUCT_PRICE_INVALID",
            "CHECKOUT_TOTAL_CHANGED",
            "CHECKOUT_REVIEW_CHANGED",
            "SHIPPING_SNAPSHOT_INVALID",
            "KIT_UNAVAILABLE",
            "KIT_VERSION_CHANGED",
          ].includes(failure.code)
        );

      if (safeRejection) {
        remember(null);
      } else if (pendingRef.current) {
        remember({
          ...pendingRef.current,
          phase: "check",
        });
      }

      if (
        failure.data?.order &&
        acceptOrder(
          failure.data.order,
          pendingRef.current || active,
        )
      ) {
        return;
      }

      const reference =
        failure.data?.errorReference;

      setError(
        `${
          failure.message ||
          "Payment could not be completed."
        }${
          reference
            ? ` Support reference: ${reference}.`
            : ""
        }`,
      );

      trackEvent(
        "checkout_payment_error",
        {
          payment_type:
            record.payload.paymentMethod,

          failure_stage:
            pendingRef.current
              ? "confirmation"
              : "checkout",
        },
      );
    } finally {
      locked.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (
      locked.current ||
      pendingRef.current ||
      !mounted.current
    ) {
      return;
    }

    const clean =
      checkoutAddress(address);

    const validation =
      checkoutAddressErrors(clean);

    setErrors(validation);
    setError("");

    if (
      Object.keys(validation).length
    ) {
      setStep("address");

      setError(
        "Correct the highlighted delivery details.",
      );

      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector(
            '[aria-invalid="true"]',
          )
          ?.focus();
      });

      return;
    }

    if (
      !(
        step === "address" && hasKits
          ? review.canCheckout &&
            !kitIssue
          : canPay
      )
    ) {
      setError(
        kitIssue ||
        "Check the highlighted products, quantities, prices and delivery review before continuing.",
      );

      return;
    }

    const latestCatalog =
      catalog.getLatestProducts();

    const latestStore =
      current.current.store;

    const latestItems =
      mode === "buy-now"
        ? latestStore.buyNowItem
          ? [latestStore.buyNowItem]
          : []
        : mode === "selection"
          ? selectedBag(
              latestStore.latestCart(),
              current.current.tools
                .checkoutKeys,
            )
          : latestStore.latestCart();

    const fresh = reviewCart(
      latestItems,
      latestCatalog,

      latestStore.catalogReady &&
        Array.isArray(latestCatalog),

      {
        allowKitReview: true,
      },
    );

    if (
      hasKits &&
      step === "address"
    ) {
      if (
        !fresh.canCheckout ||
        kitSelectionIssue(
          latestItems,
          latestStore.latestCart(),
          mode,
        )
      ) {
        setError(
          "Your kit selection or availability changed. Review your bag before continuing.",
        );

        return;
      }

      writeStorage(
        addressKey,
        clean,
      );

      reviewed.current = "";

      setStep("review");

      window.scrollTo({
        top: 0,
        behavior: "instant",
      });

      return;
    }

    let latestQuote = null;

    if (hasKits) {
      if (
        !fresh.canCheckout ||
        kitSelectionIssue(
          latestItems,
          latestStore.latestCart(),
          mode,
        )
      ) {
        setError(
          "Your kit selection or availability changed. Review your bag before paying.",
        );

        return;
      }

      const signature =
        kitQuoteSignature(
          fresh.pricingRows,
          latestStore.coupon,
          method,
          paymentMethod,
          clean.pincode,
        );

      if (
        signature !== quoteSignature
      ) {
        setError(
          "Your bag changed. Refresh prices and delivery before paying.",
        );

        return;
      }

      locked.current = true;
      setBusy(true);

      const controller =
        new AbortController();

      quoteSubmit.current = controller;

      try {
        latestQuote =
          await getCheckoutQuote(
            token,
            {
              items: fresh.pricingRows,

              coupon:
                resolveCoupon(
                  latestStore.coupon,
                )?.code || "",

              deliveryMethod: method,
              paymentMethod,
              pincode: clean.pincode,
            },
            {
              signal: controller.signal,
            },
          );

        if (!mounted.current) {
          return;
        }

        const currentStore =
          current.current.store;

        const currentCart =
          currentStore.latestCart();

        const currentItems =
          mode === "selection"
            ? selectedBag(
                currentCart,
                current.current.tools
                  .checkoutKeys,
              )
            : currentCart;

        const currentReview = reviewCart(
          currentItems,
          catalog.getLatestProducts(),
          currentStore.catalogReady,

          {
            allowKitReview: true,
          },
        );

        if (
          !currentReview.canCheckout ||
          kitSelectionIssue(
            currentItems,
            currentCart,
            mode,
          ) ||
          kitQuoteSignature(
            currentReview.pricingRows,
            currentStore.coupon,
            method,
            paymentMethod,
            clean.pincode,
          ) !== signature
        ) {
          setError(
            "Your bag changed during the pricing check. Review the current bag before paying.",
          );

          return;
        }

        if (
          !kitQuotePayable(latestQuote) ||
          !kitQuotePayable(kitQuote) ||
          latestQuote.reviewKey !==
            kitQuote.reviewKey
        ) {
          setKitResult({
            signature,
            quote: latestQuote,
          });

          reviewed.current = "";

          setError(
            "Kit prices, packages or delivery terms changed. Review the updated details, then press Pay again.",
          );

          return;
        }
      } catch (failure) {
        if (mounted.current) {
          setError(
            failure.message ||
            "Kit checkout could not be checked. No payment was started.",
          );
        }

        return;
      } finally {
        locked.current = false;
        quoteSubmit.current = null;

        if (mounted.current) {
          setBusy(false);
        }
      }
    }

    const latestPricing = hasKits
      ? latestQuote.pricing
      : calculateOrderPricing({
          cart: fresh.pricingRows,
          coupon: latestStore.coupon,
          deliveryMethod: method,
        });

    const latestPayload = payloadFor(
      fresh.pricingRows,
      latestPricing,
      latestQuote || kitQuote,
    );

    if (
      !fresh.canCheckout ||
      checkoutFingerprint(
        latestPayload,
        fresh.pricingRows,
      ) !==
        checkoutFingerprint(
          payloadFor(
            review.pricingRows,
            pricing,
          ),
          review.pricingRows,
        )
    ) {
      reviewed.current = "";

      setError(
        "Your bag, prices or availability changed. Review the bag and refresh products before paying.",
      );

      return;
    }

    const signature =
      checkoutFingerprint(
        latestPayload,
        fresh.pricingRows,
      );

    if (step === "address") {
      writeStorage(
        addressKey,
        clean,
      );

      reviewed.current = signature;

      setStep("review");

      window.scrollTo({
        top: 0,
        behavior: "instant",
      });

      return;
    }

    if (!user || !token) {
      setError(
        "Sign in with Google before payment.",
      );

      return;
    }

    if (
      !hasKits &&
      reviewed.current !== signature
    ) {
      reviewed.current = signature;

      setError(
        "Your checkout details changed. Review the updated total, then press Pay again.",
      );

      return;
    }

    const checkoutToken =
      makeId("checkout");

    const record = {
      version: 2,
      phase: "starting",

      payload: {
        ...latestPayload,
        checkoutToken,
      },

      pricing: latestPricing,

      snapshot: fresh.pricingRows.map(
        (row) => ({
          id: row.id,
          quantity: row.quantity,
          price: row.price,
          selectedSize:
            row.selectedSize ?? null,
          selectedColor:
            row.selectedColor ?? null,

          ...(
            row.kitGroup
              ? {
                  kitGroup:
                    checkoutSelectionRows([
                      row,
                    ])[0].kitGroup,
                }
              : {}
          ),
        }),
      ),

      saveAddress,
    };

    const eventKey =
      `${analyticsVisitKey()}:${signature}`;

    trackOnce(
      `shipping:${eventKey}`,
      "add_shipping_info",
      {
        ...commercePayload(
          fresh.pricingRows,
          latestPricing.totalAfterCoupon,
        ),

        shipping_tier: method,
      },
    );

    trackOnce(
      `payment:${eventKey}`,
      "add_payment_info",
      {
        ...commercePayload(
          fresh.pricingRows,
          latestPricing.totalAfterCoupon,
        ),

        payment_type: paymentMethod,
      },
    );

    await pay(
      record,
      false,
      true,
    );
  }

  function changeAddress(value) {
    if (frozen) {
      return;
    }

    addressTouched.current = true;

    // Preserve spaces while typing.
    // Normalize when submitting.
    setAddress(
      Object.fromEntries(
        Object.keys(
          EMPTY_ADDRESS,
        ).map((key) => [
          key,

          String(
            value?.[key] ??
            EMPTY_ADDRESS[key],
          ),
        ]),
      ),
    );

    setErrors({});
    setError("");
  }

  if (
    !items.length &&
    !pending
  ) {
    return (
      <EmptyState
        title="Your checkout is empty"
        to="/shop"
        label="Continue shopping"
      >
        Add products to your bag to continue.
      </EmptyState>
    );
  }

  return (
    <div className="page narrow checkout-page gd-checkout">
      <nav
        className="checkout-steps"
        aria-label="Checkout progress"
      >
        <Link to="/cart">
          1. BAG
        </Link>

        <strong
          aria-current={
            step === "address"
              ? "step"
              : undefined
          }
        >
          2. ADDRESS
        </strong>

        <strong
          aria-current={
            step === "review"
              ? "step"
              : undefined
          }
        >
          3. REVIEW & PAY
        </strong>
      </nav>

      <div className="page-heading">
        <div>
          <h1>
            {pending
              ? "Check your payment"
              : step === "address"
                ? "Delivery details"
                : "Review & payment"}
          </h1>

          <p className="muted">
            {review.itemCount} items ·{" "}

            {mode === "buy-now"
              ? "Buy now"
              : mode === "selection"
                ? "Selected items"
                : "Bag checkout"}
          </p>
        </div>
      </div>

      {!user && (
        <p className="notice">
          Enter delivery details, then{" "}

          <Link to={loginPath}>
            continue with Google
          </Link>

          {" "}before payment.
        </p>
      )}

      {(error || pending) && (
        <section
          className="error-box"
          role="alert"
        >
          <p>
            {error ||
              "A checkout attempt is saved. Check its status before paying again."}
          </p>

          {pending && (
            <>
              <p>
                Order:{" "}

                {pending.orderId ||
                  "Waiting for the server reference"}

                . Keep this page open while
                payment is checked.
              </p>

              <p>
                <Link to="/orders">
                  My orders
                </Link>

                {" · "}

                <Link to="/help">
                  Contact support
                </Link>
              </p>

              <div className="purchase-actions">
                {pending.payload &&
                  pending.phase !== "closed" && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        pay(
                          pendingRef.current,
                          true,
                        )
                      }
                    >
                      {busy
                        ? "Checking…"
                        : "Check payment status"}
                    </button>
                  )}

                {pending.payload &&
                  pending.phase === "ready" && (
                    <button
                      className="button"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        pay(pendingRef.current)
                      }
                    >
                      Resume payment
                    </button>
                  )}

                {pending.phase === "closed" && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      remember(null);
                      reviewed.current = "";
                      setStep("address");
                      setError("");
                    }}
                  >
                    Review a new checkout
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {pending?.testMode && (
        <p className="notice">
          Test payment mode: this checkout
          does not collect live payments.
        </p>
      )}

      {kitIssue && (
        <p
          role="alert"
          className="field-error"
        >
          {kitIssue}
        </p>
      )}

      {!pending &&
        !review.canCheckout && (
          <section
            className="notice"
            role="status"
          >
            <p>
              Checkout needs a current product
              and stock check. Review highlighted
              items below.
            </p>

            <button
              className="button secondary"
              type="button"
              disabled={refreshing || busy}
              onClick={refresh}
            >
              {refreshing
                ? "Checking products…"
                : "Refresh products"}
            </button>

            {" "}

            <Link to="/cart">
              Review bag
            </Link>
          </section>
        )}

      <div className="checkout-layout">
        <form
          id="checkout-form"
          className="checkout-form"
          ref={formRef}
          onSubmit={submit}
          noValidate
        >
          {step === "address" ? (
            <>
              <fieldset
                className="panel gd-checkout-fields"
                disabled={frozen}
              >
                <legend>
                  CONTACT & DELIVERY ADDRESS
                </legend>

                {addressesLoading && (
                  <p role="status">
                    Loading saved addresses…
                  </p>
                )}

                {addressesError && (
                  <p
                    className="field-error"
                    role="alert"
                  >
                    {addressesError}
                  </p>
                )}

                {addresses.length > 0 && (
                  <div className="saved-address-choices">
                    <h3>
                      Use a saved address
                    </h3>

                    {addresses.map(
                      (value, index) => (
                        <button
                          key={
                            value.id ||
                            value._id ||
                            index
                          }
                          type="button"
                          className="saved-address-choice"
                          onClick={() =>
                            changeAddress(
                              normalizeAddress(
                                value,
                              ),
                            )
                          }
                        >
                          <strong>
                            {value.fullName ||
                              value.name}
                          </strong>

                          <span>
                            {value.addressLine}

                            {" · "}

                            {value.city}{" "}
                            {value.pincode}
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                )}

                <AddressForm
                  value={address}
                  errors={errors}
                  onChange={changeAddress}
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
              </fieldset>

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
                    maxLength={250}
                    rows={3}
                    value={giftMessage}
                    disabled={frozen}
                    onChange={(event) =>
                      setGiftMessage(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="order-note">
                    Delivery instructions
                  </label>

                  <textarea
                    id="order-note"
                    maxLength={300}
                    rows={2}
                    value={orderNote}
                    disabled={frozen}
                    onChange={(event) =>
                      setOrderNote(
                        event.target.value,
                      )
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
                    className="text-link"
                    type="button"
                    disabled={frozen}
                    onClick={() =>
                      setStep("address")
                    }
                  >
                    Edit details
                  </button>
                </div>

                <strong>
                  {address.fullName}
                </strong>

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

                <p>
                  {address.phone} · {address.email}
                </p>
              </section>

              <fieldset
                className="panel gd-checkout-fields"
                disabled={frozen}
              >
                <legend>
                  DELIVERY METHOD
                </legend>

                {[
                  "standard",
                  "express",
                ].map((value) => (
                  <label
                    className="check"
                    key={value}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={method === value}
                      onChange={() =>
                        setMethod(value)
                      }
                    />

                    <span>
                      <strong>
                        {value === "standard"
                          ? "Standard delivery"
                          : "Express delivery"}
                      </strong>

                      {" · "}

                      {hasKits
                        ? (
                            method === value &&
                            pricing
                              ? money(
                                  pricing.shipping,
                                )
                              : "Checked for your pincode"
                          )
                        : pricing
                          ? money(
                              calculateOrderPricing({
                                cart:
                                  review.pricingRows,

                                coupon:
                                  store.coupon,

                                deliveryMethod:
                                  value,
                              }).shipping,
                            )
                          : "Charge unavailable"}
                    </span>
                  </label>
                ))}

                <p className="muted">
                  {hasKits
                    ? "Kit charges depend on the measured packages, your pincode and payment method. Review the confirmed package breakdown below."
                    : `Standard delivery is free from ${money(FREE_SHIPPING_LIMIT)} after coupons. Supplier preparation and courier transit are separate.`}
                </p>
              </fieldset>

              <fieldset
                className="panel gd-checkout-fields"
                disabled={frozen || !token}
              >
                <legend>
                  PAYMENT METHOD
                </legend>

                <label className="check">
                  <input
                    type="radio"
                    name="payment"
                    checked={
                      paymentMethod === "razorpay"
                    }
                    onChange={() =>
                      setPaymentMethod("razorpay")
                    }
                  />

                  <span>
                    <strong>
                      Online payment
                    </strong>

                    <br />

                    Pay the complete order amount
                    through Razorpay. Nothing remains
                    due on delivery.
                  </span>
                </label>

                <label className="check">
                  <input
                    type="radio"
                    name="payment"
                    checked={
                      paymentMethod ===
                      "cod-partial"
                    }
                    onChange={() =>
                      setPaymentMethod(
                        "cod-partial",
                      )
                    }
                  />

                  <span>
                    <strong>
                      COD with 10% advance
                    </strong>

                    <br />

                    The advance is 10% of products
                    after coupons. Delivery charges
                    stay in the remaining balance.
                  </span>
                </label>

                <p className="muted">
                  Review{" "}

                  <Link to="/help">
                    cancellation, return and refund
                    information
                  </Link>

                  {" "}before paying. Contact support
                  if eligibility or terms are unconfirmed.
                </p>
              </fieldset>

              {(
                giftMessage.trim() ||
                orderNote.trim()
              ) && (
                <section className="panel">
                  <h2>ORDER NOTES</h2>

                  <p>{giftMessage}</p>
                  <p>{orderNote}</p>
                </section>
              )}
            </>
          )}

          {hasKits && !pending && (
            <CheckoutKitReview
              quote={kitQuote}
              loading={quoteLoading}
              error={quoteError}
              disabled={
                frozen ||
                !token ||
                Boolean(kitIssue)
              }
              onRefresh={() =>
                setQuoteRevision(
                  (value) => value + 1,
                )
              }
            />
          )}

          <section className="panel">
            <h2>YOUR PRODUCTS</h2>

            {review.rows.map((row) => {
              const information =
                buyingInformation(
                  row.product || row,
                );

              const variants = [
                [
                  row.labels.color,
                  row.selectedColor,
                ],
                [
                  row.labels.size,
                  row.selectedSize,
                ],
              ]
                .filter(
                  ([, value]) =>
                    value != null &&
                    value !== "",
                )
                .map(
                  ([label, value]) =>
                    `${label}: ${value}`,
                )
                .join(" · ");

              return (
                <article
                  className="gd-checkout-item"
                  key={`${row.key}:${row.index}`}
                >
                  <ProductImage
                    product={{
                      ...(row.product || row),

                      selectedColor:
                        row.selectedColor,
                    }}
                    className="gd-checkout-photo"
                  />

                  <div>
                    <h3>
                      {row.name ||
                        "Unavailable product"}
                    </h3>

                    <p className="muted">
                      {row.product?.brand ||
                        row.brand ||
                        "Brand not recorded"}
                    </p>

                    <p>{variants}</p>

                    <p>
                      Quantity:{" "}

                      {row.quantityValid
                        ? row.quantity
                        : "Needs correction"}

                      {" · "}

                      {row.lineSafe
                        ? money(row.lineTotal)
                        : "Price unavailable"}

                      {hasKits
                        ? " before kit and coupon savings"
                        : ""}
                    </p>

                    {row.message && (
                      <p
                        className="field-error"
                        role="alert"
                      >
                        {row.message}
                      </p>
                    )}

                    <p className="muted">
                      {information.transit ||
                        information.estimate ||
                        "Delivery estimate: confirm with support."}
                    </p>

                    <p className="muted">
                      {information.returns}
                    </p>

                    {information.returnDetails.map(
                      (detail) => (
                        <p
                          className="muted"
                          key={detail}
                        >
                          {detail}
                        </p>
                      ),
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        </form>

        <aside className="checkout-summary">
          {step === "address" &&
            !frozen &&
            pricing && (
              <CouponBox
                subtotal={pricing.subtotal}
              />
            )}

          <section className="price-summary">
            <h2>ORDER SUMMARY</h2>

            {displayedPricing ? (
              <dl>
                <div>
                  <dt>
                    Products after product discounts
                  </dt>

                  <dd>
                    {money(
                      displayedPricing.subtotal,
                    )}
                  </dd>
                </div>

                {displayedPricing.kitDiscount > 0 && (
                  <div>
                    <dt>Kit savings</dt>

                    <dd>
                      −{money(
                        displayedPricing.kitDiscount,
                      )}
                    </dd>
                  </div>
                )}

                <div>
                  <dt>Coupon savings</dt>

                  <dd>
                    −{money(
                      displayedPricing.couponDiscount,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    {method === "express"
                      ? "Express"
                      : "Standard"}

                    {" "}delivery
                  </dt>

                  <dd>
                    {money(
                      displayedPricing.shipping,
                    )}
                  </dd>
                </div>

                <div className="total">
                  <dt>Total amount</dt>

                  <dd>
                    {money(
                      displayedPricing.finalTotal,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Pay now</dt>

                  <dd>
                    {money(displayedAmounts.now)}
                  </dd>
                </div>

                <div>
                  <dt>Pay on delivery</dt>

                  <dd>
                    {money(displayedAmounts.due)}
                  </dd>
                </div>

                {review.productSavings > 0 &&
                  !pending && (
                    <div>
                      <dt>
                        Product savings included above
                      </dt>

                      <dd>
                        {money(
                          review.productSavings,
                        )}
                      </dd>
                    </div>
                  )}
              </dl>
            ) : (
              <p role="status">
                {hasKits
                  ? "Confirm your delivery pincode, kit prices and package arrangements to see the payable total."
                  : "The total cannot be calculated until product prices and quantities are valid."}
              </p>
            )}

            {!pending &&
              (
                !user &&
                step === "review"
                  ? (
                      <Link
                        className="button full"
                        to={loginPath}
                      >
                        Continue with Google
                      </Link>
                    )
                  : (
                      <button
                        className="button full"
                        type="submit"
                        form="checkout-form"
                        disabled={
                          busy ||
                          refreshing ||
                          (
                            step === "address" &&
                            hasKits
                              ? !review.canCheckout ||
                                Boolean(kitIssue)
                              : !canPay
                          ) ||
                          (
                            step === "review" &&
                            !token
                          )
                        }
                      >
                        {busy
                          ? "Processing payment…"
                          : step === "address"
                            ? "Continue to delivery & payment"
                            : `Pay ${money(
                                amounts?.now,
                              )} & place order`}
                      </button>
                    )
              )}

            <p className="muted">
              Prices and stock are checked again
              on the server. After verified payment
              and order confirmation, you will go
              to My orders.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}