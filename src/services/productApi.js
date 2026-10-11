const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

const REQUEST_TIMEOUT = 60000;

function apiError(message, { status, code, data } = {}) {
  const error = new Error(message);

  error.isProductApiError = true;

  if (status !== undefined) {
    error.status = status;
  }

  error.code = code || "PRODUCT_REQUEST_FAILED";
  error.data = data ?? null;

  return error;
}

function abortError() {
  const error = new Error("The product request was cancelled.");
  error.name = "AbortError";

  return error;
}

function isObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function fallbackMessage(status) {
  const messages = {
    400: "Check the product information and try again.",
    401: "Your session expired. Please sign in again.",
    403: "Your account does not have permission for this action.",
    404: "This product or product service could not be found.",
    409: "This product changed or a code is already used. Refresh and check before retrying.",
    413: "The product information is too large. Reduce it and try again.",
    429: "Too many requests. Please wait before trying again.",
    503: "The product service is temporarily unavailable. Please try again later.",
  };

  return (
    messages[status] ||
    "The server could not complete the product request."
  );
}

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
  const headers = {
    Accept: "application/json",
  };

  let serializedBody;

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";

    try {
      serializedBody = JSON.stringify(body);
    } catch {
      throw apiError(
        "The product information could not be prepared. Check it and try again.",
        {
          code: "INVALID_PRODUCT_DATA",
        },
      );
    }
  }

  if (token) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  if (signal?.aborted) {
    throw abortError();
  }

  const controller = new AbortController();
  let timedOut = false;

  function cancel() {
    controller.abort();
  }

  signal?.addEventListener("abort", cancel, {
    once: true,
  });

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
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      cache: "no-store",
      signal: controller.signal,
      body: serializedBody,
    });

    let data = null;

    try {
      data = await response.json();
    } catch (failure) {
      if (controller.signal.aborted) {
        throw failure;
      }
    }

    if (controller.signal.aborted) {
      throw abortError();
    }

    if (!response.ok) {
      const message =
        typeof data?.message === "string" &&
        data.message.trim()
          ? data.message
          : fallbackMessage(response.status);

      throw apiError(message, {
        status: response.status,
        code:
          typeof data?.code === "string"
            ? data.code
            : "PRODUCT_HTTP_ERROR",
        data,
      });
    }

    if (!isObject(data) || data.success !== true) {
      const message =
        typeof data?.message === "string" &&
        data.message.trim()
          ? data.message
          : "The server returned an unreadable product response. Refresh and check before retrying.";

      throw apiError(message, {
        code:
          typeof data?.code === "string"
            ? data.code
            : "INVALID_PRODUCT_RESPONSE",
        data,
      });
    }

    return data;
  } catch (failure) {
    if (failure.isProductApiError) {
      throw failure;
    }

    if (signal?.aborted) {
      throw abortError();
    }

    const saving = method !== "GET";

    if (timedOut) {
      throw apiError(
        saving
          ? "The request timed out. The save result is unknown. Refresh the product list before trying again."
          : "The product server took too long to respond. Please try again.",
        {
          code: "PRODUCT_REQUEST_TIMEOUT",
        },
      );
    }

    throw apiError(
      saving
        ? "Connection lost. The save result could not be confirmed. Refresh the product list before trying again."
        : "Unable to connect to GymDrobe. Check your connection and try again.",
      {
        code: "PRODUCT_NETWORK_ERROR",
      },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

function requireToken(token) {
  if (typeof token !== "string" || !token.trim()) {
    throw apiError("Please sign in with an admin account.", {
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    });
  }
}

function productId(id) {
  if (
    !["string", "number"].includes(typeof id) ||
    (typeof id === "number" && !Number.isFinite(id)) ||
    !String(id).trim() ||
    String(id).trim().length > 200
  ) {
    throw apiError("A valid product ID is required.", {
      code: "INVALID_PRODUCT_ID",
    });
  }

  return encodeURIComponent(String(id).trim());
}

function requireData(data, message) {
  if (!isObject(data)) {
    throw apiError(message, {
      code: "INVALID_PRODUCT_DATA",
    });
  }
}

function productFrom(data) {
  const product = data.product;

  if (
    !isObject(product) ||
    !(product._id || product.id || product.slug)
  ) {
    throw apiError(
      "Product details were not returned. Refresh the product list before retrying.",
      {
        code: "INVALID_PRODUCT_RESPONSE",
        data,
      },
    );
  }

  return product;
}

function mutationResult(data, message) {
  return {
    success: true,
    message: data.message || message,
    product: productFrom(data),
  };
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    String(value ?? "").trim()
    ? Math.min(
        maximum,
        Math.max(1, Math.floor(parsed)),
      )
    : fallback;
}

function responseInteger(value, fallback, minimum = 0) {
  if (value == null) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    typeof value === "boolean" ||
    !String(value).trim() ||
    !Number.isSafeInteger(parsed) ||
    parsed < minimum
  ) {
    throw apiError(
      "The server returned invalid product pagination. Please retry.",
      {
        code: "INVALID_PRODUCT_RESPONSE",
      },
    );
  }

  return parsed;
}

// ======================================================
// PUBLIC CATALOGUE
// ======================================================

export async function getProducts(options = {}) {
  const data = await request("/products", options);

  if (!Array.isArray(data.products)) {
    throw apiError(
      "The product catalogue could not be read. Please retry.",
      {
        code: "INVALID_PRODUCT_RESPONSE",
        data,
      },
    );
  }

  return data.products;
}

export async function getProductById(id, options = {}) {
  const data = await request(
    `/products/${productId(id)}`,
    options,
  );

  return productFrom(data);
}

// ======================================================
// ADMIN PRODUCT LIST
// ======================================================

export async function getAdminProducts(
  token,
  {
    search = "",
    category = "",
    stockStatus = "",
    active = "",
    page = 1,
    limit = 25,
    signal,
    timeoutMs,
  } = {},
) {
  requireToken(token);

  const params = new URLSearchParams();

  for (const [key, value, maximum] of [
    ["search", search, 150],
    ["category", category, 100],
  ]) {
    const clean = String(value ?? "").trim();

    if (clean.length > maximum) {
      throw apiError(
        `${key === "search" ? "Search" : "Category"} cannot exceed ${maximum} characters.`,
        {
          code: "INVALID_PRODUCT_FILTER",
        },
      );
    }

    if (clean) {
      params.set(key, clean);
    }
  }

  if (
    ["in-stock", "low-stock", "out-of-stock"].includes(
      stockStatus,
    )
  ) {
    params.set("stockStatus", stockStatus);
  }

  if (
    [true, false, "true", "false"].includes(active)
  ) {
    params.set("active", String(active));
  }

  const safePage = positiveInteger(page, 1, 1000000);
  const safeLimit = positiveInteger(limit, 25, 100);

  params.set("page", String(safePage));
  params.set("limit", String(safeLimit));

  const data = await request(
    `/products/admin?${params}`,
    {
      token,
      signal,
      timeoutMs,
    },
  );

  if (!Array.isArray(data.products)) {
    throw apiError(
      "The admin product list could not be read. Please retry.",
      {
        code: "INVALID_PRODUCT_RESPONSE",
        data,
      },
    );
  }

  if (data.total == null || data.pages == null) {
    throw apiError(
      "Product totals were not returned. Please check the backend response.",
      {
        code: "INVALID_PRODUCT_RESPONSE",
        data,
      },
    );
  }

  return {
    products: data.products,
    count: responseInteger(
      data.count,
      data.products.length,
    ),
    total: responseInteger(data.total, 0),
    page: responseInteger(data.page, safePage, 1),
    pages: responseInteger(data.pages, 1, 1),
    limit: responseInteger(data.limit, safeLimit, 1),
  };
}

// ======================================================
// CATEGORY, SUBCATEGORY AND BRAND OPTIONS
// ======================================================

export async function getAdminProductOptions(
  token,
  options = {},
) {
  requireToken(token);

  const data = await request(
    "/products/admin/options",
    {
      ...options,
      token,
    },
  );

  if (
    !Array.isArray(data.categories) ||
    !Array.isArray(data.brands) ||
    !isObject(data.subcategories)
  ) {
    throw apiError(
      "Category and brand options could not be read. Please reload them.",
      {
        code: "INVALID_PRODUCT_RESPONSE",
        data,
      },
    );
  }

  return data;
}

// ======================================================
// ADMIN PRODUCT DETAILS
// ======================================================

export async function getAdminProductById(
  token,
  id,
  options = {},
) {
  requireToken(token);

  const data = await request(
    `/products/admin/${productId(id)}`,
    {
      ...options,
      token,
    },
  );

  return productFrom(data);
}

// ======================================================
// CREATE PRODUCT
// ======================================================

export async function createProduct(
  token,
  productData,
  options = {},
) {
  requireToken(token);
  requireData(productData, "Product data is required.");

  const data = await request("/products", {
    ...options,
    token,
    method: "POST",
    body: productData,
  });

  return mutationResult(
    data,
    "Product created successfully.",
  );
}

// ======================================================
// UPDATE PRODUCT
// ======================================================

export async function updateProduct(
  token,
  id,
  productData,
  options = {},
) {
  requireToken(token);
  requireData(
    productData,
    "Product changes are required.",
  );

  const data = await request(
    `/products/${productId(id)}`,
    {
      ...options,
      token,
      method: "PUT",
      body: productData,
    },
  );

  return mutationResult(
    data,
    "Product updated successfully.",
  );
}

// ======================================================
// UPDATE INVENTORY
// ======================================================

export async function updateProductInventory(
  token,
  id,
  inventoryData,
  options = {},
) {
  requireToken(token);
  requireData(
    inventoryData,
    "Inventory data is required.",
  );

  if (
    !Object.prototype.hasOwnProperty.call(
      inventoryData,
      "stock",
    ) &&
    !Object.prototype.hasOwnProperty.call(
      inventoryData,
      "variants",
    )
  ) {
    throw apiError(
      "Provide stock or variant quantities.",
      {
        code: "INVALID_PRODUCT_DATA",
      },
    );
  }

  const data = await request(
    `/products/${productId(id)}/inventory`,
    {
      ...options,
      token,
      method: "PUT",
      body: inventoryData,
    },
  );

  return mutationResult(
    data,
    "Inventory updated successfully.",
  );
}

// ======================================================
// ARCHIVE PRODUCT
// ======================================================

export async function archiveProduct(
  token,
  id,
  options = {},
) {
  requireToken(token);

  const data = await request(
    `/products/${productId(id)}`,
    {
      ...options,
      token,
      method: "DELETE",
    },
  );

  return mutationResult(
    data,
    "Product archived successfully.",
  );
}

// ======================================================
// RESTORE PRODUCT
// ======================================================

export async function restoreProduct(
  token,
  id,
  options = {},
) {
  requireToken(token);

  const data = await request(
    `/products/${productId(id)}/restore`,
    {
      ...options,
      token,
      method: "PUT",
    },
  );

  return mutationResult(
    data,
    "Product restored successfully.",
  );
}

// Keep the existing function name compatible.
// Deleting a product archives it.
export async function deleteProduct(
  token,
  id,
  options = {},
) {
  return archiveProduct(token, id, options);
}