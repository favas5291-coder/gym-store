import { getDiscountedPrice } from "./productPricing.js";

const ID = String(
  import.meta.env.VITE_GA_MEASUREMENT_ID || "",
).trim();

const DEBUG =
  import.meta.env.DEV &&
  import.meta.env.VITE_ANALYTICS_DEBUG === "true";

const CONSENT_KEY = "gymdrobe-analytics-consent-v1";

const sent = new Set();
const purchases = new Set();

let initialized = false;
let lastPath = "";
let visit = 0;
let consent = null;

export const analyticsConfigured = /^G-[A-Z0-9]+$/.test(ID);

function normalizeConsent(value) {
  return value === "granted" || value === "denied"
    ? value
    : null;
}

export function getAnalyticsConsent() {
  try {
    return (
      normalizeConsent(localStorage.getItem(CONSENT_KEY)) ||
      consent
    );
  } catch {
    return consent;
  }
}

consent = getAnalyticsConsent();

function amount(value) {
  if (
    value == null ||
    value === "" ||
    !["number", "string"].includes(typeof value)
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function identifier(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value && typeof value === "object") {
    return identifier(value.id ?? value._id);
  }

  return "";
}

function safePath(path = window.location.pathname) {
  const publicPath =
    /^(\/|\/shop\/?|\/cart\/?|\/wishlist\/?|\/checkout\/?|\/offers\/?|\/product\/[^/]+\/?)$/;

  return publicPath.test(path) ? path : "/";
}

function safeLocation() {
  return window.location.origin + safePath();
}

function safeReferrer() {
  try {
    const url = new URL(document.referrer);

    // Retain the referring site without external query strings or paths.
    return url.origin === window.location.origin
      ? url.origin + safePath(url.pathname)
      : url.origin + "/";
  } catch {
    return "";
  }
}

export function analyticsVisitKey() {
  const path = window.location.pathname;

  if (path !== lastPath) {
    lastPath = path;
    visit += 1;
  }

  return `${visit}:${path}`;
}

function gtag() {
  window.dataLayer.push(arguments);
}

export function initAnalytics() {
  if (
    !analyticsConfigured ||
    consent !== "granted" ||
    initialized
  ) {
    return;
  }

  window.dataLayer = window.dataLayer || [];

  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  gtag("js", new Date());

  gtag("config", ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: safeLocation(),
    page_referrer: safeReferrer(),
  });

  if (!document.getElementById("gymdrobe-google-analytics")) {
    const script = document.createElement("script");

    script.id = "gymdrobe-google-analytics";
    script.async = true;
    script.src =
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;

    document.head.appendChild(script);
  }

  initialized = true;
}

export function setAnalyticsConsent(value) {
  consent = value === "granted" ? "granted" : "denied";

  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Retain the preference in memory for this visit.
  }

  if (initialized) {
    gtag("consent", "update", {
      analytics_storage: consent,
    });
  }

  initAnalytics();

  window.dispatchEvent(
    new Event("gymdrobe-analytics-ready"),
  );
}

export function trackEvent(name, parameters = {}) {
  try {
    if (
      consent !== "granted" ||
      !analyticsConfigured ||
      typeof name !== "string" ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(name)
    ) {
      return false;
    }

    initAnalytics();

    const payload = {
      ...parameters,
      page_location: safeLocation(),
      page_referrer: safeReferrer(),
      ...(DEBUG ? { debug_mode: true } : {}),
    };

    if (DEBUG) {
      console.debug("[GymDrobe analytics]", name, payload);
    }

    gtag("event", name, payload);

    // True means queued locally, not confirmed delivered to Google.
    return true;
  } catch {
    return false;
  }
}

export function trackOnce(key, name, parameters) {
  if (sent.has(key)) {
    return false;
  }

  const tracked = trackEvent(name, parameters);

  if (tracked) {
    sent.add(key);
  }

  return tracked;
}

export function trackPageView(pathname) {
  const visitKey = analyticsVisitKey();

  if (safePath(pathname) !== pathname) {
    return false;
  }

  return trackOnce(`page:${visitKey}`, "page_view", {
    page_title: pathname.startsWith("/product/")
      ? "GymDrobe product"
      : `GymDrobe ${
          pathname === "/" ? "home" : pathname.slice(1)
        }`,
  });
}

// Cart and order rows already contain discounted unit prices.
export function commercePayload(rows, merchandiseValue) {
  const items = (Array.isArray(rows) ? rows : []).flatMap(
    (row) => {
      if (!row || typeof row !== "object") {
        return [];
      }

      const id =
        identifier(row.id) ||
        identifier(row.productId) ||
        identifier(row.product) ||
        identifier(row._id);

      const price = amount(row.price);
      const quantity =
        row.quantity == null ? 1 : Number(row.quantity);

      if (
        !id ||
        price == null ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        !Number.isFinite(price * quantity)
      ) {
        return [];
      }

      return [{
        item_id: id,
        item_name: String(row.name || "").slice(0, 200),
        item_brand: String(row.brand || "GymDrobe").slice(0, 100),
        item_category: String(row.category || "").slice(0, 100),
        item_variant: [
          row.selectedColor,
          row.selectedSize,
        ]
          .filter((value) => value != null && value !== "")
          .join(" / ")
          .slice(0, 200),
        price,
        quantity,
      }];
    },
  );

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  if (!Number.isFinite(subtotal)) {
    return { currency: "INR", value: 0, items: [] };
  }

  const override = amount(merchandiseValue);
  const value =
    override == null ? subtotal : Math.min(subtotal, override);

  const ratio = subtotal > 0 ? value / subtotal : 1;

  return {
    currency: "INR",
    value: roundMoney(value),
    items: items.map((item) => ({
      ...item,
      // Keep proportional coupon allocation without whole-rupee rounding.
      price: item.price * ratio,
    })),
  };
}

export function trackProductView(product) {
  const id = identifier(product?.id ?? product?._id);

  if (!id) {
    return false;
  }

  const payload = commercePayload([{
    ...product,
    id,
    price: getDiscountedPrice(product),
    quantity: 1,
  }]);

  if (!payload.items.length) {
    return false;
  }

  return trackOnce(
    `product:${analyticsVisitKey()}:${id}`,
    "view_item",
    payload,
  );
}

export function trackPurchase(order) {
  const id = identifier(
    order?.orderNumber ?? order?.id ?? order?._id,
  );

  const confirmedStatuses = [
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "out-for-delivery",
    "delivered",
  ];

  if (
    !id ||
    !confirmedStatuses.includes(order?.status) ||
    !["paid", "partially-paid"].includes(
      order?.payment?.status,
    )
  ) {
    return false;
  }

  const key = `gymdrobe-analytics-purchase:${id}`;

  if (purchases.has(id)) {
    return false;
  }

  try {
    if (localStorage.getItem(key) === "sent") {
      return false;
    }
  } catch {
    // Memory deduplication remains available.
  }

  const pricing = order.pricing || {};
  const payment = order.payment || {};

  const total = amount(pricing.finalTotal);
  const shipping = amount(pricing.shipping);
  const discountedSubtotal = amount(pricing.totalAfterCoupon);

  const merchandise =
    discountedSubtotal ??
    (total != null && shipping != null
      ? Math.max(0, total - shipping)
      : null);

  const commerce = commercePayload(order.items, merchandise);

  if (!commerce.items.length) {
    return false;
  }

  const paid = amount(payment.amountPaid);
  const due = amount(payment.amountDue);
  const method = payment.method || order.paymentMethod;

  const payload = {
    ...commerce,
    transaction_id: id,
    ...(method ? { payment_type: method } : {}),
    ...(shipping != null ? { shipping } : {}),
    ...(paid != null ? { amount_paid: paid } : {}),
    ...(due != null ? { amount_due: due } : {}),
  };

  if (!trackEvent("purchase", payload)) {
    return false;
  }

  purchases.add(id);

  try {
    localStorage.setItem(key, "sent");
  } catch {
    // Use memory deduplication for this visit.
  }

  return true;
}