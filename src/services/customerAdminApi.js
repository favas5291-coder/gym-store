const API_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const idPattern = /^[a-f0-9]{24}$/i;

const integer = (value) =>
  Number.isSafeInteger(value) && value >= 0;

function customer(value) {
  return (
    value &&
    idPattern.test(value.id || "") &&
    typeof value.isActive === "boolean" &&
    typeof value.name === "string" &&
    typeof value.email === "string"
  );
}

function pagination(data) {
  return (
    integer(data.page) &&
    data.page > 0 &&
    integer(data.pages) &&
    data.pages > 0
  );
}

async function request(
  token,
  path,
  {
    method = "GET",
    body,
    signal,
  } = {},
) {
  if (!token) {
    throw new Error(
      "Please sign in as an administrator.",
    );
  }

  const serialized =
    body === undefined
      ? undefined
      : JSON.stringify(body);

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (signal?.aborted) abort();

  signal?.addEventListener("abort", abort, {
    once: true,
  });

  const timer = setTimeout(abort, 45000);

  try {
    const response = await fetch(
      `${API_URL}/admin/customers${path}`,
      {
        method,
        signal: controller.signal,
        cache: "no-store",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,

          ...(body !== undefined
            ? {
                "Content-Type": "application/json",
              }
            : {}),
        },

        body: serialized,
      },
    );

    const data = await response
      .json()
      .catch(() => null);

    if (
      !response.ok ||
      data?.success !== true
    ) {
      const error = new Error(
        data?.message ||
          (
            response.status === 401
              ? "Your session expired. Sign in again."
              : response.status === 403
                ? "Admin access is required."
                : "The customer response could not be read."
          ),
      );

      error.status = response.status;

      error.resultUnknown =
        method !== "GET" &&
        (
          response.status >= 500 ||
          response.ok ||
          !data
        );

      throw error;
    }

    return data;
  } catch (failure) {
    if (failure.status) throw failure;

    if (
      method === "GET" &&
      signal?.aborted
    ) {
      throw failure;
    }

    const error = new Error(
      method === "GET"
        ? "Cannot load customers. Check your connection and retry."
        : "The account-change result is unknown. Reload before trying again.",
    );

    error.resultUnknown = method !== "GET";

    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function validId(value) {
  if (
    typeof value !== "string" ||
    !idPattern.test(value)
  ) {
    throw new Error("Customer ID is invalid.");
  }

  return encodeURIComponent(value);
}

export async function getCustomerList(
  token,
  { signal, ...filters } = {},
) {
  const query = new URLSearchParams(
    Object.entries(filters).map(
      ([key, value]) => [
        key,
        String(value ?? ""),
      ],
    ),
  );

  const data = await request(
    token,
    `?${query}`,
    { signal },
  );

  if (
    !Array.isArray(data.customers) ||
    !data.customers.every(customer) ||
    !pagination(data) ||
    !integer(data.total) ||
    !data.stats ||
    ![
      "total",
      "active",
      "blocked",
      "new30Days",
    ].every((key) =>
      integer(data.stats[key]),
    ) ||
    data.stats.total !==
      data.stats.active + data.stats.blocked
  ) {
    throw new Error(
      "The customer API needs updating. Its list or summary is incomplete.",
    );
  }

  return data;
}

export async function getCustomerDetail(
  token,
  id,
  { signal, ...filters } = {},
) {
  const query = new URLSearchParams(
    Object.entries(filters).map(
      ([key, value]) => [
        key,
        String(value ?? ""),
      ],
    ),
  );

  const data = await request(
    token,
    `/${validId(id)}?${query}`,
    { signal },
  );

  const keys = [
    "orders",
    "confirmed",
    "delivered",
    "cancelled",
    "returns",
    "orderValuePaise",
    "collectedPaise",
    "refundedPaise",
    "retainedPaise",
    "duePaise",
    "financialReviewOrders",
    "valueReviewOrders",
    "dueReviewOrders",
  ];

  if (
    !customer(data.customer) ||
    data.customer.id.toLowerCase() !==
      id.toLowerCase() ||
    !pagination(data) ||
    !data.summary ||
    !keys.every((key) =>
      integer(data.summary[key]),
    ) ||
    !Array.isArray(data.orders) ||
    !data.orders.every(
      (order) =>
        idPattern.test(order.id || "") &&
        typeof order.orderNumber === "string" &&
        Array.isArray(order.items) &&
        order.items.every(
          (item) =>
            item &&
            typeof item.name === "string" &&
            integer(item.quantity) &&
            item.quantity > 0 &&
            (
              item.unitPricePaise === null ||
              integer(item.unitPricePaise)
            ),
        ) &&
        order.pricingPaise &&
        [
          "totalPaise",
          "collectedPaise",
          "refundedPaise",
          "retainedPaise",
          "duePaise",
        ].every(
          (key) =>
            order[key] === null ||
            integer(order[key]),
        ),
    ) ||
    !Array.isArray(data.addresses)
  ) {
    throw new Error(
      "The customer details could not be read. Reload and check the backend update.",
    );
  }

  return data;
}

export async function changeCustomerStatus(
  token,
  record,
  isActive,
  options = {},
) {
  if (
    typeof record?.isActive !== "boolean" ||
    typeof isActive !== "boolean" ||
    record.isActive === isActive
  ) {
    throw new Error(
      "Choose a valid account status change.",
    );
  }

  const data = await request(
    token,
    `/${validId(record.id)}/status`,
    {
      ...options,
      method: "PATCH",

      body: {
        isActive,
        expectedIsActive: record.isActive,
      },
    },
  );

  if (
    !customer(data.customer) ||
    data.customer.id.toLowerCase() !==
      record.id.toLowerCase() ||
    data.customer.isActive !== isActive
  ) {
    const error = new Error(
      "The saved account status could not be confirmed. Reload before trying again.",
    );

    error.resultUnknown = true;
    throw error;
  }

  return data;
}