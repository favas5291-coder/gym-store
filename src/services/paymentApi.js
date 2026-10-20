import {
  customerHeaders,
  guestAccess,
} from "../utils/guestCheckout.js";

const API_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const PAYMENT_METHODS = [
  "razorpay",
  "cod-partial",
];

function paymentError(
  message,
  {
    status,
    code,
    data,
  } = {},
) {
  const error = new Error(message);

  error.status = status;
  error.code = code;
  error.data = data;

  return error;
}

async function request(
  path,
  {
    token,
    method = "GET",
    body,
    verification = false,
    signal,
  } = {},
) {
  if (!token && !guestAccess()) {
    throw paymentError(
      "Your checkout access is missing. Return to checkout to prepare guest access, restore your private guest access code, or sign in.",
      {
        code: "AUTH_REQUIRED",
      },
    );
  }

  const headers = {
    Accept: "application/json",
    ...customerHeaders(token),
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(
      `${API_URL}${path}`,
      {
        method,
        headers,
        cache: "no-store",
        signal,

        body:
          body !== undefined
            ? JSON.stringify(body)
            : undefined,
      },
    );
  } catch {
    throw paymentError(
      verification
        ? "We could not confirm your payment because the connection was interrupted. Your payment may have succeeded. Do not pay again; check My orders or contact support."
        : "Unable to connect to GymDrobe to start payment. Check your connection and try again.",
      {
        code: "PAYMENT_CONNECTION_FAILED",

        data: {
          verificationUncertain: verification,
        },
      },
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw paymentError(
      verification
        ? "The payment server returned an unreadable response. Your payment may have succeeded. Do not pay again; check My orders or contact support."
        : "The payment server returned an unreadable response. Please try again later.",
      {
        status: response.status,
        code: "INVALID_PAYMENT_RESPONSE",

        data: {
          verificationUncertain: verification,
        },
      },
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.success !== "boolean"
  ) {
    throw paymentError(
      verification
        ? "Your payment confirmation could not be read. Do not pay again; check My orders or contact support."
        : "Payment could not be started. Please try again later.",
      {
        status: response.status,
        code: "INVALID_PAYMENT_RESPONSE",

        data: {
          verificationUncertain: verification,
        },
      },
    );
  }

  if (!response.ok || data.success === false) {
    throw paymentError(
      typeof data.message === "string" &&
      data.message.trim()
        ? data.message
        : verification
          ? "Payment confirmation failed. Check My orders before attempting another payment."
          : "Payment could not be started. Please try again.",
      {
        status: response.status,

        code:
          data.code ||
          "PAYMENT_REQUEST_FAILED",

        data,
      },
    );
  }

  return data;
}

function validateCheckoutData(checkoutData) {
  if (
    !checkoutData ||
    typeof checkoutData !== "object" ||
    Array.isArray(checkoutData)
  ) {
    throw new Error(
      "Checkout information is missing.",
    );
  }

  if (
    typeof checkoutData.checkoutToken !== "string" ||
    !checkoutData.checkoutToken.trim()
  ) {
    throw new Error(
      "Checkout token is missing. Refresh checkout and try again.",
    );
  }

  if (
    !PAYMENT_METHODS.includes(
      checkoutData.paymentMethod,
    )
  ) {
    throw new Error(
      "Choose a valid GymDrobe payment method.",
    );
  }

  if (
    !Array.isArray(checkoutData.items) ||
    !checkoutData.items.length
  ) {
    throw new Error(
      "Your checkout has no products.",
    );
  }

  if (
    !checkoutData.shippingAddress ||
    typeof checkoutData.shippingAddress !== "object" ||
    Array.isArray(checkoutData.shippingAddress)
  ) {
    throw new Error(
      "Shipping address is missing.",
    );
  }
}

export async function createRazorpayPaymentOrder(
  token,
  checkoutData,
) {
  validateCheckoutData(checkoutData);

  return request(
    "/payments/razorpay/order",
    {
      token,
      method: "POST",

      body: {
        ...checkoutData,
      },
    },
  );
}

export async function verifyRazorpayPayment(
  token,
  {
    checkoutToken,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = {},
) {
  const details = {
    checkoutToken,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  };

  const labels = {
    checkoutToken: "Checkout token",
    razorpay_order_id: "Razorpay order ID",
    razorpay_payment_id: "Razorpay payment ID",
    razorpay_signature: "Razorpay payment signature",
  };

  for (const [key, value] of Object.entries(details)) {
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      throw new Error(
        `${labels[key]} is missing.`,
      );
    }
  }

  return request(
    "/payments/razorpay/verify",
    {
      token,
      method: "POST",
      body: details,
      verification: true,
    },
  );
}

export async function checkRazorpayPayment(
  token,
  orderId,
  {
    admin = false,
    signal,
  } = {},
) {
  if (
    typeof orderId !== "string" ||
    !orderId.trim() ||
    orderId.length > 150 ||
    /[\u0000-\u0020\u007f]/.test(orderId)
  ) {
    throw new Error(
      "A valid order number is required.",
    );
  }

  if (admin && !token) {
    throw new Error(
      "Please sign in as an admin.",
    );
  }

  const controller = new AbortController();

  const abort = () => controller.abort();

  if (signal?.aborted) {
    abort();
  }

  signal?.addEventListener(
    "abort",
    abort,
    { once: true },
  );

  const timer = setTimeout(abort, 55000);

  try {
    const path = admin
      ? `/payments/admin/orders/${encodeURIComponent(
          orderId,
        )}/check`
      : "/payments/razorpay/check";

    const data = await request(path, {
      token,
      method: "POST",

      body: admin
        ? {}
        : { orderId },

      verification: true,
      signal: controller.signal,
    });

    const result = data.result;

    if (
      !result ||
      ![
        "verified",
        "pending",
        "authorized",
        "review",
      ].includes(result.state) ||
      typeof result.message !== "string" ||
      typeof result.orderNumber !== "string" ||
      (
        orderId.startsWith("GD-") &&
        result.orderNumber !== orderId
      ) ||
      (
        result.state === "verified" &&
        result.paymentVerified !== true
      )
    ) {
      throw paymentError(
        "Payment check could not be read. Do not pay again; reload your order or contact support.",
        {
          code: "INVALID_PAYMENT_RESPONSE",

          data: {
            verificationUncertain: true,
          },
        },
      );
    }

    return result;
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      abort,
    );
  }
}