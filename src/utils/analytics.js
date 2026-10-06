import {
  getDiscountedPrice,
} from "./productPricing.js";

const ID = String(
  import.meta.env.VITE_GA_MEASUREMENT_ID || "",
).trim();

const DEBUG =
  import.meta.env.DEV &&
  import.meta.env.VITE_ANALYTICS_DEBUG === "true";

const CONSENT_KEY =
  "gymdrobe-analytics-consent-v1";

const sent = new Set();
const purchases = new Set();

let initialized = false;
let lastPath = "";
let visit = 0;

export const analyticsConfigured =
  /^G-[A-Z0-9]+$/.test(ID);

export function getAnalyticsConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

let consent = getAnalyticsConsent();

function safePath(
  path = window.location.pathname,
) {
  const publicPath =
    /^(\/|\/shop\/?|\/cart\/?|\/wishlist\/?|\/checkout\/?|\/offers\/?|\/product\/[^/]+\/?)$/;

  return publicPath.test(path) ? path : "/";
}

function safeReferrer() {
  try {
    const url = new URL(document.referrer);

    return (
      url.origin + safePath(url.pathname)
    );
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

  window.dataLayer =
    window.dataLayer || [];

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
    page_location:
      window.location.origin + safePath(),
    page_referrer: safeReferrer(),
  });

  const script =
    document.createElement("script");

  script.async = true;

  script.src =
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;

  script.id = "gymdrobe-google-analytics";

  document.head.appendChild(script);

  initialized = true;
}

export function setAnalyticsConsent(value) {
  consent =
    value === "granted"
      ? "granted"
      : "denied";

  try {
    localStorage.setItem(
      CONSENT_KEY,
      consent,
    );
  } catch {
    // Keep the preference for this visit.
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

export function trackEvent(
  name,
  parameters = {},
) {
  try {
    if (DEBUG) {
      console.debug(
        "[GymDrobe analytics]",
        name,
        parameters,
      );
    }

    if (
      consent !== "granted" ||
      !analyticsConfigured
    ) {
      return false;
    }

    initAnalytics();

    gtag("event", name, {
      ...parameters,
      page_location:
        window.location.origin + safePath(),
      page_referrer: safeReferrer(),
    });

    return true;
  } catch {
    return false;
  }
}

export function trackOnce(
  key,
  name,
  parameters,
) {
  if (sent.has(key)) {
    return false;
  }

  const tracked = trackEvent(
    name,
    parameters,
  );

  if (tracked) {
    sent.add(key);
  }

  return tracked;
}

export function trackPageView(pathname) {
  analyticsVisitKey();

  // Skip private account, admin and order pages.
  if (safePath(pathname) !== pathname) {
    return;
  }

  trackOnce(
    `page:${analyticsVisitKey()}`,
    "page_view",
    {
      page_title:
        pathname.startsWith("/product/")
          ? "GymDrobe product"
          : `GymDrobe ${
              pathname === "/"
                ? "home"
                : pathname.slice(1)
            }`,
    },
  );
}

// Cart/order rows already contain discounted prices.
export function commercePayload(
  rows,
  merchandiseValue,
) {
  const items = (
    Array.isArray(rows) ? rows : []
  )
    .map((row) => ({
      item_id: String(
        row.id ||
          row.productId ||
          row.product ||
          row._id ||
          "",
      ),

      item_name: String(
        row.name || "",
      ).slice(0, 200),

      item_brand: String(
        row.brand || "GymDrobe",
      ).slice(0, 100),

      item_category: String(
        row.category || "",
      ).slice(0, 100),

      item_variant: [
        row.selectedColor,
        row.selectedSize,
      ]
        .filter(Boolean)
        .join(" / "),

      price: Math.max(
        0,
        Number(row.price) || 0,
      ),

      quantity: Math.max(
        1,
        Math.floor(
          Number(row.quantity) || 1,
        ),
      ),
    }))
    .filter((item) => item.item_id);

  const subtotal = items.reduce(
    (sum, item) =>
      sum + item.price * item.quantity,
    0,
  );

  const value =
    merchandiseValue != null &&
    Number.isFinite(
      Number(merchandiseValue),
    )
      ? Math.max(
          0,
          Number(merchandiseValue),
        )
      : subtotal;

  const ratio =
    subtotal > 0
      ? Math.min(1, value / subtotal)
      : 1;

  return {
    currency: "INR",
    value:
      Math.round(value * 100) / 100,

    items: items.map((item) => ({
      ...item,
      price: item.price * ratio,
    })),
  };
}

export function trackProductView(product) {
  const id =
    product?.id || product?._id;

  if (!id) {
    return;
  }

  trackOnce(
    `product:${analyticsVisitKey()}:${id}`,
    "view_item",
    commercePayload([
      {
        ...product,
        price: getDiscountedPrice(product),
        quantity: 1,
      },
    ]),
  );
}

export function trackPurchase(order) {
  const id = String(
    order?.orderNumber ||
      order?.id ||
      "",
  );

  const confirmedStatuses = [
    "confirmed",
    "processing",
    "shipped",
    "out-for-delivery",
    "delivered",
  ];

  if (
    !id ||
    !confirmedStatuses.includes(
      order.status,
    )
  ) {
    return;
  }

  if (
    !["paid", "partially-paid"].includes(
      order.payment?.status,
    )
  ) {
    return;
  }

  const key =
    `gymdrobe-analytics-purchase:${id}`;

  if (purchases.has(id)) {
    return;
  }

  try {
    if (
      localStorage.getItem(key) === "sent"
    ) {
      return;
    }
  } catch {
    // Memory deduplication remains available.
  }

  const pricing = order.pricing || {};

  const total =
    Number(pricing.finalTotal);

  const shipping =
    Number(pricing.shipping);

  const merchandise =
    pricing.totalAfterCoupon != null
      ? Number(pricing.totalAfterCoupon)
      : Number.isFinite(total) &&
          Number.isFinite(shipping)
        ? total - shipping
        : null;

  const payload = {
    ...commercePayload(
      order.items,
      merchandise,
    ),

    transaction_id: id,

    payment_type:
      order.payment.method ||
      order.paymentMethod,

    ...(Number.isFinite(shipping)
      ? { shipping }
      : {}),

    ...(Number.isFinite(
      Number(order.payment.amountPaid),
    )
      ? {
          amount_paid: Number(
            order.payment.amountPaid,
          ),
        }
      : {}),

    ...(Number.isFinite(
      Number(order.payment.amountDue),
    )
      ? {
          amount_due: Number(
            order.payment.amountDue,
          ),
        }
      : {}),
  };

  if (trackEvent("purchase", payload)) {
    purchases.add(id);

    try {
      localStorage.setItem(key, "sent");
    } catch {
      // Use memory deduplication for this visit.
    }
  }
}