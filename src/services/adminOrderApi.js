import { normalizeCourierUrl } from "../utils/courierTracking.js";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

const REQUEST_TIMEOUT = 60000;

const ORDER_STATUSES = [
  "payment-pending",
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
  "cancelled",
];

const FULFILMENT_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];

const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "completed",
];

function apiError(
  message,
  {
    status,
    code,
    data,
    saveResultUnknown = false,
  } = {},
) {
  const error = new Error(message);

  error.isAdminOrderApiError = true;

  if (status !== undefined) {
    error.status = status;
  }

  error.code =
    code || "ADMIN_ORDER_REQUEST_FAILED";

  error.data = data ?? null;

  error.saveResultUnknown =
    saveResultUnknown;

  return error;
}

function invalid(message) {
  return apiError(message, {
    code: "INVALID_ADMIN_ORDER_DATA",
  });
}

function object(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function text(
  value,
  name,
  maximum,
  minimum = 0,
) {
  if (typeof value !== "string") {
    throw invalid(
      `${name} must be text.`,
    );
  }

  const clean = value.trim();

  if (
    clean.length < minimum ||
    clean.length > maximum
  ) {
    throw invalid(
      `${name} must contain ${minimum}–${maximum} characters.`,
    );
  }

  return clean;
}

function identifier(value) {
  if (
    !["string", "number"].includes(
      typeof value,
    ) ||
    (
      typeof value === "number" &&
      !Number.isFinite(value)
    )
  ) {
    throw invalid(
      "A valid order ID is required.",
    );
  }

  const clean = String(value).trim();

  if (
    !clean ||
    clean.length > 150
  ) {
    throw invalid(
      "A valid order ID is required.",
    );
  }

  return encodeURIComponent(clean);
}

function requireToken(token) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw apiError(
      "Please sign in with an administrator account.",
      {
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
      },
    );
  }
}

function fallbackMessage(status) {
  const messages = {
    400:
      "Check the order information and try again.",

    401:
      "Your login session expired. Please sign in again.",

    403:
      "Your account does not have permission to manage orders.",

    404:
      "This order or admin service could not be found.",

    409:
      "The order changed or this action is no longer allowed. Reload its details before retrying.",

    413:
      "The request is too large. Shorten the information and try again.",

    429:
      "Too many requests. Please wait before trying again.",

    503:
      "The order service is temporarily unavailable.",
  };

  return (
    messages[status] ||
    "The server could not complete the admin order request."
  );
}

function cancelledError(
  saveResultUnknown = false,
) {
  const error = new Error(
    saveResultUnknown
      ? "The request was cancelled. Reload the order to check whether the update was saved."
      : "The order request was cancelled.",
  );

  error.name = "AbortError";

  error.code =
    "ADMIN_ORDER_REQUEST_CANCELLED";

  error.saveResultUnknown =
    saveResultUnknown;

  return error;
}

// Requests are never automatically retried.
// An interrupted update may already have
// reached the backend.
async function request(
  path,
  {
    token,
    method = "GET",
    body,
    signal,
    timeoutMs = REQUEST_TIMEOUT,
  } = {},
) {
  requireToken(token);

  const saving =
    method !== "GET";

  const headers = {
    Accept: "application/json",

    Authorization:
      `Bearer ${token.trim()}`,
  };

  let serializedBody;

  if (body !== undefined) {
    headers["Content-Type"] =
      "application/json";

    try {
      serializedBody =
        JSON.stringify(body);
    } catch {
      throw invalid(
        "The order information could not be prepared.",
      );
    }
  }

  if (signal?.aborted) {
    throw cancelledError();
  }

  const controller =
    new AbortController();

  let timedOut = false;
  let started = false;

  const cancel = () =>
    controller.abort();

  signal?.addEventListener(
    "abort",
    cancel,
    {
      once: true,
    },
  );

  const duration =
    Number.isFinite(timeoutMs) &&
    timeoutMs > 0 &&
    timeoutMs <= 120000
      ? timeoutMs
      : REQUEST_TIMEOUT;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, duration);

  try {
    started = true;

    const response = await fetch(
      `${API_URL}${path}`,
      {
        method,
        headers,
        body: serializedBody,
        cache: "no-store",
        signal: controller.signal,
      },
    );

    let data = null;

    try {
      data = await response.json();
    } catch (failure) {
      if (
        controller.signal.aborted
      ) {
        throw failure;
      }
    }

    if (
      controller.signal.aborted
    ) {
      throw cancelledError(
        saving,
      );
    }

    if (!response.ok) {
      const unknown =
        saving &&
        response.status >= 500;

      const message =
        typeof data?.message ===
          "string" &&
        data.message.trim()
          ? data.message
          : fallbackMessage(
              response.status,
            );

      throw apiError(
        unknown
          ? `${message} Reload the order and check its saved state before retrying.`
          : message,

        {
          status: response.status,

          code:
            typeof data?.code ===
              "string" &&
            data.code
              ? data.code
              : "ADMIN_ORDER_HTTP_ERROR",

          data,

          saveResultUnknown:
            unknown,
        },
      );
    }

    if (
      !object(data) ||
      data.success !== true
    ) {
      const declaredFailure =
        object(data) &&
        data.success === false;

      const message =
        typeof data?.message ===
          "string" &&
        data.message.trim()
          ? data.message
          : "The server returned an unreadable order response.";

      throw apiError(
        saving &&
        !declaredFailure
          ? `${message} Reload the order before retrying the update.`
          : message,

        {
          status: response.status,

          code:
            typeof data?.code ===
              "string" &&
            data.code
              ? data.code
              : "INVALID_ADMIN_ORDER_RESPONSE",

          data,

          saveResultUnknown:
            saving &&
            !declaredFailure,
        },
      );
    }

    return data;
  } catch (failure) {
    if (
      failure?.isAdminOrderApiError
    ) {
      throw failure;
    }

    if (signal?.aborted) {
      throw cancelledError(
        saving && started,
      );
    }

    if (timedOut) {
      throw apiError(
        saving
          ? "The update timed out. Its save result is unknown. Reload the order before retrying."
          : "The order server took too long to respond. Please try again.",

        {
          code:
            "ADMIN_ORDER_REQUEST_TIMEOUT",

          saveResultUnknown:
            saving && started,
        },
      );
    }

    throw apiError(
      saving
        ? "Connection lost. The update could not be confirmed. Reload the order before retrying."
        : "Unable to connect to GymDrobe. Check your connection and try again.",

      {
        code:
          "ADMIN_ORDER_NETWORK_ERROR",

        saveResultUnknown:
          saving && started,
      },
    );
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      cancel,
    );
  }
}

function validOrder(order) {
  if (
    !object(order) ||
    typeof order.status !==
      "string" ||
    !order.status.trim()
  ) {
    return false;
  }

  const id =
    order.orderNumber ||
    order.id ||
    order._id;

  return (
    ["string", "number"].includes(
      typeof id,
    ) &&
    String(id).trim() !== "" &&
    (
      typeof id !== "number" ||
      Number.isFinite(id)
    )
  );
}

function orderFrom(
  data,
  saving = false,
) {
  if (
    !validOrder(data.order)
  ) {
    throw apiError(
      saving
        ? "The saved order details were not returned. Reload the order before retrying."
        : "Order details could not be read. Please reload.",

      {
        code:
          "INVALID_ADMIN_ORDER_RESPONSE",

        data,

        saveResultUnknown:
          saving,
      },
    );
  }

  return data.order;
}

export async function updateAdminKitFulfillment(
  token,
  orderId,
  changes,
  options = {},
) {
  requireToken(token);

  if (
    !object(changes) ||
    !Number.isSafeInteger(
      changes.revision,
    ) ||
    changes.revision < 0 ||
    ![
      "initialize",
      "component",
      "parcel",
      "cod",
    ].includes(changes.action)
  ) {
    throw invalid(
      "Include the current kit revision and a valid fulfillment action.",
    );
  }

  const data = await request(
    `/orders/admin/orders/${
      identifier(orderId)
    }/kit-fulfillment`,

    {
      ...options,
      token,
      method: "PUT",
      body: changes,
    },
  );

  const order =
    orderFrom(data, true);

  const progress =
    order.kitFulfillmentAdmin;

  if (
    !progress ||
    !Number.isSafeInteger(
      progress.revision,
    ) ||
    progress.revision <=
      changes.revision ||
    !Array.isArray(
      progress.components,
    ) ||
    !Array.isArray(
      progress.parcels,
    )
  ) {
    throw apiError(
      "Saved kit progress could not be verified. Reload the order before another update.",

      {
        code:
          "INVALID_KIT_FULFILLMENT_RESPONSE",

        saveResultUnknown: true,
      },
    );
  }

  return order;
}

function ordersFrom(data) {
  if (
    !Array.isArray(data.orders) ||
    data.orders.some(
      (order) =>
        !validOrder(order),
    )
  ) {
    throw apiError(
      "The order list could not be read. Please retry.",

      {
        code:
          "INVALID_ADMIN_ORDER_RESPONSE",

        data,
      },
    );
  }

  return data.orders;
}

function positiveInteger(
  value,
  fallback,
  maximum,
) {
  if (
    !["string", "number"].includes(
      typeof value,
    ) ||
    !String(value).trim()
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? Math.min(
        maximum,
        Math.max(
          1,
          Math.floor(parsed),
        ),
      )
    : fallback;
}

function responseInteger(
  value,
  fallback,
  minimum = 0,
) {
  if (value == null) {
    return fallback;
  }

  const parsed =
    Number(value);

  if (
    !["string", "number"].includes(
      typeof value,
    ) ||
    !String(value).trim() ||
    !Number.isSafeInteger(parsed) ||
    parsed < minimum
  ) {
    throw apiError(
      "The server returned invalid order pagination. Please retry.",

      {
        code:
          "INVALID_ADMIN_ORDER_RESPONSE",
      },
    );
  }

  return parsed;
}

function validDate(value) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const parsed = new Date(
    `${value}T00:00:00Z`,
  );

  return (
    !Number.isNaN(
      parsed.getTime(),
    ) &&
    parsed
      .toISOString()
      .slice(0, 10) === value
  );
}

export async function getAdminOrders(
  token,
  {
    status = "",
    search = "",
    page = 1,
    limit = 25,
    signal,
    timeoutMs,
  } = {},
) {
  requireToken(token);

  const filter = text(
    status,
    "Order status",
    40,
  ).toLowerCase();

  if (
    filter &&
    filter !== "all" &&
    !ORDER_STATUSES.includes(
      filter,
    )
  ) {
    throw invalid(
      "Choose a valid order status filter.",
    );
  }

  const query =
    new URLSearchParams();

  if (
    filter &&
    filter !== "all"
  ) {
    query.set(
      "status",
      filter,
    );
  }

  const term = text(
    search,
    "Search",
    150,
  );

  if (term) {
    query.set(
      "search",
      term,
    );
  }

  const safePage =
    positiveInteger(
      page,
      1,
      1000000,
    );

  const safeLimit =
    positiveInteger(
      limit,
      25,
      100,
    );

  query.set(
    "page",
    String(safePage),
  );

  query.set(
    "limit",
    String(safeLimit),
  );

  const data = await request(
    `/orders/admin/orders?${query}`,

    {
      token,
      signal,
      timeoutMs,
    },
  );

  const orders =
    ordersFrom(data);

  if (
    data.total == null ||
    data.pages == null
  ) {
    throw apiError(
      "Order totals were not returned. Check the backend response.",

      {
        code:
          "INVALID_ADMIN_ORDER_RESPONSE",

        data,
      },
    );
  }

  return {
    orders,

    count: responseInteger(
      data.count,
      orders.length,
    ),

    total: responseInteger(
      data.total,
      0,
    ),

    page: responseInteger(
      data.page,
      safePage,
      1,
    ),

    pages: responseInteger(
      data.pages,
      1,
      1,
    ),

    limit: responseInteger(
      data.limit,
      safeLimit,
      1,
    ),
  };
}

export async function getAdminOrderById(
  token,
  orderId,
  options = {},
) {
  const data = await request(
    `/orders/admin/orders/${
      identifier(orderId)
    }`,

    {
      ...options,
      token,
      method: "GET",
    },
  );

  return orderFrom(data);
}

export async function updateAdminOrderStatus(
  token,
  orderId,
  changes = {},
  options = {},
) {
  if (!object(changes)) {
    throw invalid(
      "Order changes are required.",
    );
  }

  const status = text(
    changes.status,
    "Order status",
    40,
    1,
  ).toLowerCase();

  if (
    !FULFILMENT_STATUSES.includes(
      status,
    )
  ) {
    throw invalid(
      "Choose a valid fulfilment status.",
    );
  }

  const body = {
    status,
  };

  if (
    changes.packingConfirmed !==
    undefined
  ) {
    if (
      typeof changes.packingConfirmed !==
      "boolean"
    ) {
      throw invalid(
        "Confirm packing using the checkbox.",
      );
    }

    body.packingConfirmed =
      changes.packingConfirmed;
  }

  if (
    changes.courierUrl !==
    undefined
  ) {
    body.courierUrl =
      normalizeCourierUrl(
        changes.courierUrl,
      );
  }

  if (
    changes.trackingNotice !==
    undefined
  ) {
    if (
      ![
        "none",
        "delayed",
        "delivery-attempt-failed",
      ].includes(
        changes.trackingNotice,
      )
    ) {
      throw invalid(
        "Choose a supported delivery notice.",
      );
    }

    body.trackingNotice =
      changes.trackingNotice;

    body.trackingMessage = text(
      changes.trackingMessage ||
        "",
      "Customer delivery update",
      500,
      changes.trackingNotice ===
        "none"
        ? 0
        : 1,
    );
  }

  if (
    changes.carrier !==
    undefined
  ) {
    body.carrier = text(
      changes.carrier ?? "",
      "Courier name",
      100,
    );
  }

  if (
    changes.trackingNumber !==
    undefined
  ) {
    body.trackingNumber = text(
      changes.trackingNumber ??
        "",
      "Tracking number",
      150,
    );
  }

  if (
    changes.estimatedDelivery !==
    undefined
  ) {
    const value = text(
      changes.estimatedDelivery ??
        "",
      "Estimated delivery",
      10,
    );

    if (
      value &&
      !validDate(value)
    ) {
      throw invalid(
        "Enter a valid estimated delivery date in YYYY-MM-DD format.",
      );
    }

    body.estimatedDelivery =
      value;
  }

  if (
    changes.codBalanceCollected !==
    undefined
  ) {
    if (
      typeof changes.codBalanceCollected !==
      "boolean"
    ) {
      throw invalid(
        "COD collection confirmation must be true or false.",
      );
    }

    if (
      changes.codBalanceCollected &&
      status !== "delivered"
    ) {
      throw invalid(
        "Record COD collection only when confirming delivery.",
      );
    }

    body.codBalanceCollected =
      changes.codBalanceCollected;
  }

  const data = await request(
    `/orders/admin/orders/${
      identifier(orderId)
    }/status`,

    {
      ...options,
      token,
      method: "PUT",
      body,
    },
  );

  return orderFrom(data, true);
}

export async function getAdminReturnRequests(
  token,
  status = "",
  options = {},
) {
  const filter = text(
    status,
    "Return status",
    30,
  ).toLowerCase();

  if (
    filter &&
    filter !== "all" &&
    !RETURN_STATUSES.includes(
      filter,
    )
  ) {
    throw invalid(
      "Choose a valid return status filter.",
    );
  }

  const query =
    filter &&
    filter !== "all"
      ? `?status=${
          encodeURIComponent(
            filter,
          )
        }`
      : "";

  const data = await request(
    `/orders/admin/returns${query}`,

    {
      ...options,
      token,
      method: "GET",
    },
  );

  return ordersFrom(data);
}

export async function reviewReturnRequest(
  token,
  orderId,
  changes = {},
  options = {},
) {
  if (!object(changes)) {
    throw invalid(
      "A return decision is required.",
    );
  }

  const decision = text(
    changes.decision,
    "Return decision",
    20,
    1,
  ).toLowerCase();

  if (
    ![
      "approve",
      "reject",
    ].includes(decision)
  ) {
    throw invalid(
      "Choose approve or reject.",
    );
  }

  const response = text(
    changes.response ?? "",
    "Customer response",
    1000,
  );

  const data = await request(
    `/orders/admin/returns/${
      identifier(orderId)
    }/review`,

    {
      ...options,
      token,
      method: "PUT",

      body: {
        decision,
        response,
      },
    },
  );

  return orderFrom(data, true);
}

export async function completeReturnRequest(
  token,
  orderId,
  changes = {},
  options = {},
) {
  if (!object(changes)) {
    throw invalid(
      "Return completion information is required.",
    );
  }

  const response = text(
    changes.response ?? "",
    "Customer response",
    1000,
  );

  const data = await request(
    `/orders/admin/returns/${
      identifier(orderId)
    }/complete`,

    {
      ...options,
      token,
      method: "PUT",

      body: {
        response,
      },
    },
  );

  return orderFrom(data, true);
}

// Records a refund already sent through an
// approved payment process.
//
// This function does not transfer money.
export async function recordReturnRefund(
  token,
  orderId,
  changes = {},
  options = {},
) {
  if (!object(changes)) {
    throw invalid(
      "Refund information is required.",
    );
  }

  const reference = text(
    changes.reference,
    "Refund reference",
    200,
    3,
  );

  const data = await request(
    `/orders/admin/returns/${
      identifier(orderId)
    }/refund`,

    {
      ...options,
      token,
      method: "PUT",

      body: {
        reference,
      },
    },
  );

  return orderFrom(data, true);
}