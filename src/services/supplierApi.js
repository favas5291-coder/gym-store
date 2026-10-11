const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).trim().replace(/\/+$/, "");

class SupplierApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "SupplierApiError";
    Object.assign(this, details);
  }
}

function apiError(message, details = {}) {
  return new SupplierApiError(message, details);
}

function supplierId(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) {
    throw apiError("Choose a valid supplier.", {
      code: "SUPPLIER_ID_INVALID",
    });
  }

  return encodeURIComponent(value);
}

function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw apiError("Reload the supplier before saving.", {
      code: "SUPPLIER_REVISION_REQUIRED",
    });
  }

  return value;
}

function record(value, outcomeUnknown = false) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.id !== "string" ||
    !/^[a-f0-9]{24}$/i.test(value.id) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.name !== "string" ||
    !["draft", "active", "blocked", "archived"].includes(value.status)
  ) {
    throw apiError(
      "The supplier response is incomplete. Reload the latest record.",
      {
        code: "SUPPLIER_RESPONSE_INVALID",
        outcomeUnknown,
      },
    );
  }

  return value;
}

async function request(
  path,
  token,
  {
    method = "GET",
    body,
    signal,
    timeoutMs = 45000,
  } = {},
) {
  if (typeof token !== "string" || !token.trim()) {
    throw apiError("Please sign in to your admin account.", {
      status: 401,
    });
  }

  if (signal?.aborted) {
    throw new DOMException("Request cancelled.", "AbortError");
  }

  const writing = method !== "GET";

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token.trim()}`,
  };

  let serialized;

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    serialized = JSON.stringify(body);
  }

  const controller = new AbortController();

  let timedOut = false;
  let started = false;

  const cancel = () => controller.abort();

  signal?.addEventListener("abort", cancel, { once: true });

  const duration =
    Number.isFinite(timeoutMs) &&
    timeoutMs > 0 &&
    timeoutMs <= 120000
      ? timeoutMs
      : 45000;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, duration);

  try {
    started = true;

    const response = await fetch(API_URL + path, {
      method,
      headers,
      body: serialized,
      signal: controller.signal,
      cache: "no-store",
    });

    let data;

    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
    }

    if (controller.signal.aborted) {
      throw new DOMException("Request cancelled.", "AbortError");
    }

    if (!response.ok || data?.success !== true) {
      const fallback =
        response.status === 401
          ? "Your session expired. Please sign in again."
          : response.status === 403
            ? "An active admin account is required."
            : response.status === 409
              ? "This supplier changed. Reload it before saving again."
              : "The supplier request could not be completed.";

      throw apiError(
        typeof data?.message === "string" && data.message.trim()
          ? data.message
          : fallback,
        {
          status: response.status,
          code: data?.code,
          data,
          outcomeUnknown:
            writing && (response.status >= 500 || response.ok),
        },
      );
    }

    return data;
  } catch (error) {
    if (error instanceof SupplierApiError) throw error;

    if (controller.signal.aborted && !timedOut && !writing) {
      throw error;
    }

    throw apiError(
      timedOut
        ? "The supplier server took too long to respond."
        : "Unable to confirm the supplier request. Check your connection.",
      {
        code: timedOut
          ? "SUPPLIER_TIMEOUT"
          : "SUPPLIER_CONNECTION_FAILED",
        outcomeUnknown: writing && started,
      },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

async function write(path, token, options) {
  const data = await request(path, token, options);

  record(data.supplier, true);

  return data;
}

export async function getSuppliers(
  token,
  {
    search = "",
    status = "",
    page = 1,
    limit = 12,
    signal,
    timeoutMs,
  } = {},
) {
  const query = new URLSearchParams({
    search,
    status,
    page: String(page),
    limit: String(limit),
  });

  const data = await request(
    `/suppliers?${query}`,
    token,
    { signal, timeoutMs },
  );

  if (
    !Array.isArray(data.suppliers) ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0 ||
    !Number.isSafeInteger(data.page) ||
    data.page < 1 ||
    !Number.isSafeInteger(data.pages) ||
    data.pages < 1
  ) {
    throw apiError(
      "The supplier list could not be read. Please reload.",
      { code: "SUPPLIER_RESPONSE_INVALID" },
    );
  }

  data.suppliers.forEach((value) => record(value));

  return data;
}

export async function getSupplierById(
  token,
  id,
  { signal, timeoutMs } = {},
) {
  const data = await request(
    `/suppliers/${supplierId(id)}`,
    token,
    { signal, timeoutMs },
  );

  record(data.supplier);

  return data;
}

export function createSupplier(token, body, options = {}) {
  return write("/suppliers", token, {
    ...options,
    method: "POST",
    body,
  });
}

export function updateSupplier(
  token,
  supplier,
  body,
  options = {},
) {
  return write(`/suppliers/${supplierId(supplier.id)}`, token, {
    ...options,
    method: "PUT",
    body: {
      ...body,
      revision: revision(supplier.revision),
    },
  });
}

export function setSupplierStatus(
  token,
  supplier,
  status,
  options = {},
) {
  return write(
    `/suppliers/${supplierId(supplier.id)}/status`,
    token,
    {
      ...options,
      method: "PATCH",
      body: {
        status,
        revision: revision(supplier.revision),
      },
    },
  );
}

export function setSupplierVerification(
  token,
  supplier,
  { status, notes },
  options = {},
) {
  return write(
    `/suppliers/${supplierId(supplier.id)}/verification`,
    token,
    {
      ...options,
      method: "PATCH",
      body: {
        status,
        notes,
        revision: revision(supplier.revision),
      },
    },
  );
}