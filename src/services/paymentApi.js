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

const PAYMENT_REQUEST_TIMEOUT = 45000;
const PAYMENT_CHECK_TIMEOUT = 55000;

const creatingOrders = new Map();
const verifyingPayments = new Map();

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

function accessIdentity(token) {
  return token
    ? `account:${token}`
    : `guest:${guestAccess()?.token || ""}`;
}

function snapshot(value) {
  try {
    return JSON.parse(
      JSON.stringify(value),
    );
  } catch {
    throw paymentError(
      "Payment information could not be prepared. Review checkout and try again.",
      {
        code: "INVALID_CHECKOUT_DATA",
      },
    );
  }
}

function shareRequest(
  pending,
  key,
  body,
  run,
) {
  const signature = JSON.stringify(body);
  const existing = pending.get(key);

  if (existing) {
    if (existing.signature !== signature) {
      throw paymentError(
        "This checkout is already being processed with different details. Check the existing attempt before starting another payment.",
        {
          code: "PAYMENT_ATTEMPT_IN_PROGRESS",

          data: {
            verificationUncertain: true,
          },
        },
      );
    }

    return existing.promise;
  }

  const entry = {
    signature,
    promise: null,
  };

  let resolveRequest;
  let rejectRequest;

  const result = new Promise(
    (resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    },
  );

  entry.promise = result.finally(() => {
    if (pending.get(key) === entry) {
      pending.delete(key);
    }
  });

  pending.set(key, entry);

  try {
    // Capture current access headers before another action
    // can restore a different guest code or change accounts.
    Promise.resolve(run()).then(
      resolveRequest,
      rejectRequest,
    );
  } catch (error) {
    rejectRequest(error);
  }

  return entry.promise;
}

async function request(
  path,
  {
    token,
    method = "GET",
    body,
    verification = false,
    signal,
    timeoutMs = PAYMENT_REQUEST_TIMEOUT,
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

  const serializedBody =
    body === undefined
      ? undefined
      : JSON.stringify(body);

  const creatingOrder =
    method === "POST" &&
    path === "/payments/razorpay/order";

  const uncertain =
    verification || creatingOrder;

  const uncertainty = {
    verificationUncertain: uncertain,
    orderCreationUncertain: creatingOrder,
  };

  const controller = new AbortController();

  let timedOut = false;

  const abort = () => {
    controller.abort();
  };

  function interrupted() {
    return paymentError(
      verification
        ? timedOut
          ? "Payment confirmation timed out. Your payment may have succeeded. Do not pay again; check My orders or contact support."
          : "The payment check was interrupted. Your payment may have succeeded. Do not pay again; check My orders or contact support."
        : "Payment preparation timed out or was interrupted. The server may have created your order. Check this same checkout attempt before trying again.",
      {
        code: timedOut
          ? "PAYMENT_REQUEST_TIMEOUT"
          : "PAYMENT_REQUEST_CANCELLED",

        data: uncertainty,
      },
    );
  }

  if (signal?.aborted) {
    throw interrupted();
  }

  signal?.addEventListener(
    "abort",
    abort,
    {
      once: true,
    },
  );

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response;

    try {
      response = await fetch(
        `${API_URL}${path}`,
        {
          method,
          headers,
          cache: "no-store",
          signal: controller.signal,
          body: serializedBody,
        },
      );
    } catch {
      if (controller.signal.aborted) {
        throw interrupted();
      }

      throw paymentError(
        verification
          ? "We could not confirm your payment because the connection was interrupted. Your payment may have succeeded. Do not pay again; check My orders or contact support."
          : "Connection lost while preparing payment. The server may have created your order. Check this same checkout attempt before trying again.",
        {
          code: "PAYMENT_CONNECTION_FAILED",
          data: uncertainty,
        },
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted) {
        throw interrupted();
      }

      throw paymentError(
        verification
          ? "The payment server returned an unreadable response. Your payment may have succeeded. Do not pay again; check My orders or contact support."
          : "The payment server returned an unreadable response. Your order may have been created. Check this same checkout attempt before trying again.",
        {
          status: response.status,
          code: "INVALID_PAYMENT_RESPONSE",
          data: uncertainty,
        },
      );
    }

    if (controller.signal.aborted) {
      throw interrupted();
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
          : "Payment preparation could not be confirmed. Check this same checkout attempt before trying again.",
        {
          status: response.status,
          code: "INVALID_PAYMENT_RESPONSE",
          data: uncertainty,
        },
      );
    }

    if (
      !response.ok ||
      data.success === false
    ) {
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
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      abort,
    );
  }
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

  const body = snapshot(checkoutData);

  const key = JSON.stringify([
    accessIdentity(token),
    body.checkoutToken,
  ]);

  return shareRequest(
    creatingOrders,
    key,
    body,
    () =>
      request(
        "/payments/razorpay/order",
        {
          token,
          method: "POST",
          body,
        },
      ),
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

  const key = JSON.stringify([
    accessIdentity(token),
    checkoutToken,
    razorpay_order_id,
    razorpay_payment_id,
  ]);

  return shareRequest(
    verifyingPayments,
    key,
    details,
    () =>
      request(
        "/payments/razorpay/verify",
        {
          token,
          method: "POST",
          body: details,
          verification: true,
        },
      ),
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
    signal,
    timeoutMs: PAYMENT_CHECK_TIMEOUT,
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
}