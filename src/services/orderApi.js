import {
  customerHeaders,
  guestAccess,
} from "../utils/guestCheckout.js";

const API_URL = String(
  import.meta.env?.VITE_API_URL ||
    "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

function failure(message, details = {}) {
  return Object.assign(
    new Error(message),
    details,
  );
}

function identifier(value) {
  if (
    !["string", "number"].includes(typeof value)
  ) {
    throw failure(
      "An order number is required.",
    );
  }

  const text = String(value).trim();

  if (
    !text ||
    text.length > 150 ||
    /[\u0000-\u001f\u007f]/.test(text)
  ) {
    throw failure(
      "Enter a valid order number.",
    );
  }

  return encodeURIComponent(text);
}

function validOrder(order) {
  return Boolean(
    order &&
    typeof order === "object" &&
    !Array.isArray(order) &&
    (
      order.orderNumber ||
      order.id ||
      order._id
    ) &&
    typeof order.status === "string" &&
    Array.isArray(order.items),
  );
}

async function request(
  path,
  {
    token,
    method = "GET",
    body,
    signal,
  } = {},
) {
  const accountToken =
    typeof token === "string"
      ? token.trim()
      : "";

  const suppliedAccountToken =
    token !== undefined &&
    token !== null &&
    token !== "";

  const validAccountToken =
    Boolean(accountToken) &&
    !/\s/.test(accountToken);

  if (
    (
      suppliedAccountToken &&
      !validAccountToken
    ) ||
    (
      !validAccountToken &&
      !guestAccess()
    )
  ) {
    throw failure(
      "Sign in or restore your private guest access code to view this order.",
      {
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        saveResultUnknown: false,
      },
    );
  }

  const saving = method !== "GET";
  const controller = new AbortController();

  if (signal?.aborted) {
    throw failure(
      "Request cancelled.",
      {
        name: "AbortError",
        saveResultUnknown: false,
      },
    );
  }

  const abort = () => controller.abort();

  signal?.addEventListener(
    "abort",
    abort,
    { once: true },
  );

  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, saving ? 30000 : 20000);

  let started = false;

  try {
    const encoded =
      body === undefined
        ? undefined
        : JSON.stringify(body);

    started = true;

    const response = await fetch(
      `${API_URL}${path}`,
      {
        method,
        cache: "no-store",
        signal: controller.signal,

        headers: {
          Accept: "application/json",

          ...customerHeaders(accountToken),

          ...(body === undefined
            ? {}
            : {
                "Content-Type":
                  "application/json",
              }),
        },

        body: encoded,
      },
    );

    const data = await response
      .json()
      .catch(() => null);

    if (controller.signal.aborted) {
      throw failure(
        timedOut
          ? "The order server took too long to respond. Check order details before retrying."
          : "Request cancelled.",
        {
          name: timedOut
            ? "TimeoutError"
            : "AbortError",

          saveResultUnknown: saving,
        },
      );
    }

    if (
      !response.ok ||
      data?.success !== true
    ) {
      const fallback =
        {
          401:
            "Your access expired. Sign in or restore your private guest access code.",

          403:
            "You cannot access this order.",

          404:
            "Order not found with your current access.",

          409:
            "The order changed or this action is unavailable. Reload order details.",
        }[response.status] ||
        "The order server could not confirm this request.";

      throw failure(
        typeof data?.message === "string" &&
        data.message.trim()
          ? data.message
          : fallback,
        {
          status: response.status,

          code:
            data?.code ||
            "ORDER_REQUEST_FAILED",

          data,

          saveResultUnknown:
            saving &&
            (
              response.status >= 500 ||
              data?.saveResultUnknown === true ||
              (
                response.ok &&
                data?.success !== false
              )
            ),
        },
      );
    }

    return data;
  } catch (error) {
    if (
      error.status !== undefined ||
      error.saveResultUnknown !== undefined
    ) {
      throw error;
    }

    throw failure(
      saving && started
        ? "The request result is unknown. Check order details before trying again."
        : timedOut
          ? "The order server took too long to respond. Please retry."
          : "Unable to load your order. Check your connection and retry.",
      {
        code: "ORDER_CONNECTION_FAILED",

        saveResultUnknown:
          saving && started,

        ...(controller.signal.aborted
          ? {
              name: timedOut
                ? "TimeoutError"
                : "AbortError",
            }
          : {}),
      },
    );
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      abort,
    );
  }
}

function orderFrom(data, saving = false) {
  if (!validOrder(data.order)) {
    throw failure(
      "Order details were not returned. Reload the order before retrying.",
      {
        code: "INVALID_ORDER_RESPONSE",
        saveResultUnknown: saving,
      },
    );
  }

  return data.order;
}

export async function createOrder(
  token,
  orderData,
  options = {},
) {
  return request("/orders", {
    ...options,
    token,
    method: "POST",
    body: orderData,
  });
}

export async function getOrders(
  token,
  options = {},
) {
  const data = await request(
    "/orders",
    {
      ...options,
      token,
    },
  );

  if (
    !Array.isArray(data.orders) ||
    data.orders.some(
      (order) => !validOrder(order),
    )
  ) {
    throw failure(
      "Your order list could not be read. Please retry.",
      {
        code: "INVALID_ORDER_RESPONSE",
      },
    );
  }

  return data.orders;
}

export async function getOrderById(
  token,
  id,
  options = {},
) {
  return orderFrom(
    await request(
      `/orders/${identifier(id)}`,
      {
        ...options,
        token,
      },
    ),
  );
}

export async function cancelOrder(
  token,
  id,
  reason,
  options = {},
) {
  if (
    typeof reason !== "string" ||
    reason.trim().length < 5 ||
    reason.trim().length > 500
  ) {
    throw failure(
      "Enter a cancellation reason of 5–500 characters.",
      {
        saveResultUnknown: false,
      },
    );
  }

  return orderFrom(
    await request(
      `/orders/${identifier(id)}/cancel`,
      {
        ...options,
        token,
        method: "PUT",

        body: {
          reason: reason.trim(),
        },
      },
    ),
    true,
  );
}

export async function requestReturn(
  token,
  id,
  returnData,
  options = {},
) {
  if (
    !returnData ||
    !["return", "exchange"].includes(
      returnData.type,
    ) ||
    !Array.isArray(returnData.items) ||
    !returnData.items.length ||
    returnData.items.length > 50 ||
    typeof returnData.reason !== "string" ||
    returnData.reason.trim().length < 5 ||
    returnData.reason.trim().length > 1000
  ) {
    throw failure(
      "Check the request type, selected items and reason.",
      {
        saveResultUnknown: false,
      },
    );
  }

  const seen = new Set();

  const items = returnData.items.map(
    (row) => {
      if (
        !row ||
        !Number.isSafeInteger(row.index) ||
        row.index < 0 ||
        seen.has(row.index) ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity < 1
      ) {
        throw failure(
          "Choose valid item quantities.",
          {
            saveResultUnknown: false,
          },
        );
      }

      seen.add(row.index);

      return {
        index: row.index,
        quantity: row.quantity,
        size: row.size ?? null,
        color: row.color ?? null,
      };
    },
  );

  return orderFrom(
    await request(
      `/orders/${identifier(id)}/return`,
      {
        ...options,
        token,
        method: "POST",

        body: {
          type: returnData.type,
          items,
          reason: returnData.reason.trim(),
        },
      },
    ),
    true,
  );
}