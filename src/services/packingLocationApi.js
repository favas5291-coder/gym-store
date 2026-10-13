const API_URL = String(
  import.meta.env.VITE_API_URL || "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const ID_PATTERN = /^[a-f0-9]{24}$/i;

const LOCATION_STATES = [
  "draft",
  "active",
  "paused",
  "archived",
];

const TRANSFER_STATES = [
  "pending",
  "confirmed",
  "paused",
];

function validTransfer(value) {
  if (value == null) {
    return true;
  }

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  if (
    !TRANSFER_STATES.includes(value.status) ||
    typeof value.originName !== "string" ||
    !Array.isArray(value.productIds) ||
    value.productIds.length > 500 ||
    !value.productIds.every(
      (id) => typeof id === "string" && ID_PATTERN.test(id),
    ) ||
    new Set(
      value.productIds.map((id) => id.toLowerCase()),
    ).size !== value.productIds.length ||
    typeof value.arrangementReference !== "string"
  ) {
    return false;
  }

  for (const [record, keys] of [
    [
      value.originAddress,
      ["addressLine", "city", "state", "pincode"],
    ],
    [
      value.originContact,
      ["name", "phone", "email"],
    ],
  ]) {
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      !keys.every((key) => typeof record[key] === "string")
    ) {
      return false;
    }
  }

  const low = value.transferDaysMin;
  const high = value.transferDaysMax;

  if (
    (low != null || high != null) &&
    (
      !Number.isSafeInteger(low) ||
      !Number.isSafeInteger(high) ||
      low < 0 ||
      high < low ||
      high > 365
    )
  ) {
    return false;
  }

  if (
    value.status === "confirmed" &&
    (
      !ID_PATTERN.test(value.confirmedBy || "") ||
      typeof value.confirmedAt !== "string" ||
      !Number.isFinite(Date.parse(value.confirmedAt)) ||
      !value.productIds.length ||
      low == null ||
      high == null ||
      !value.arrangementReference.trim()
    )
  ) {
    return false;
  }

  return true;
}

function validLocation(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.id === "string" &&
    ID_PATTERN.test(value.id) &&
    Number.isSafeInteger(value.version) &&
    value.version >= 0 &&
    LOCATION_STATES.includes(value.status) &&
    Array.isArray(value.supplierArrangements) &&
    Array.isArray(value.readinessIssues) &&
    value.readinessIssues.every(
      (issue) => typeof issue === "string",
    ) &&
    validTransfer(value.gymdrobeStockTransfer) &&
    (
      value.gymdrobeStockTransferIssues === undefined ||
      (
        Array.isArray(value.gymdrobeStockTransferIssues) &&
        value.gymdrobeStockTransferIssues.every(
          (issue) => typeof issue === "string",
        )
      )
    ) &&
    (
      value.gymdrobeStockTransferReady === undefined ||
      typeof value.gymdrobeStockTransferReady === "boolean"
    ),
  );
}

async function request(
  token,
  path,
  { method = "GET", body, signal } = {},
) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Please sign in as an admin.");
  }

  // Nothing has been sent when the signal is already cancelled.
  if (signal?.aborted) {
    throw new DOMException("Request cancelled.", "AbortError");
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  signal?.addEventListener("abort", abort, {
    once: true,
  });

  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 25000);

  try {
    const response = await fetch(
      `${API_URL}/packing-locations${path}`,
      {
        method,
        signal: controller.signal,
        cache: "no-store",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },

        body:
          body !== undefined
            ? JSON.stringify(body)
            : undefined,
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.success !== true) {
      const error = new Error(
        data?.message ||
          "The packing service returned an unreadable response.",
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
    if (failure.status) {
      throw failure;
    }

    if (
      method === "GET" &&
      signal?.aborted &&
      !timedOut
    ) {
      throw failure;
    }

    const error = new Error(
      method === "GET"
        ? "Cannot load packing locations. Check your connection and retry."
        : "The save result is unknown. Reload before trying again.",
    );

    // Cancelling a write does not prove the server cancelled it.
    error.resultUnknown = method !== "GET";

    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function locationId(value) {
  if (
    typeof value !== "string" ||
    !ID_PATTERN.test(value)
  ) {
    throw new Error("Location ID is invalid.");
  }

  return encodeURIComponent(value.toLowerCase());
}

function checkRecord(record) {
  locationId(record?.id);

  if (
    !Number.isSafeInteger(record.version) ||
    record.version < 0
  ) {
    throw new Error(
      "Reload the location to get its current version before saving.",
    );
  }
}

function readLocation(
  data,
  writing = false,
  expectedId = "",
) {
  if (
    !validLocation(data.location) ||
    (
      expectedId &&
      data.location.id.toLowerCase() !==
        expectedId.toLowerCase()
    )
  ) {
    const error = new Error(
      writing
        ? "The saved location could not be read. Reload before another save."
        : "The packing location could not be read. Reload and try again.",
    );

    error.resultUnknown = writing;

    throw error;
  }

  return data.location;
}

export async function getPackingLocations(
  token,
  {
    page = 1,
    search = "",
    status = "",
    signal,
  } = {},
) {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000
  ) {
    throw new Error("Choose a valid location page.");
  }

  if (
    typeof search !== "string" ||
    search.trim().length > 100
  ) {
    throw new Error(
      "Search must contain at most 100 characters.",
    );
  }

  if (status && !LOCATION_STATES.includes(status)) {
    throw new Error("Choose a valid location status.");
  }

  const query = new URLSearchParams({
    page: String(page),
    limit: "12",
    search: search.trim(),
    status,
  });

  const data = await request(
    token,
    `?${query}`,
    { signal },
  );

  if (
    !Array.isArray(data.locations) ||
    !data.locations.every(validLocation) ||
    !Number.isSafeInteger(data.page) ||
    data.page < 1 ||
    !Number.isSafeInteger(data.pages) ||
    data.pages < 1 ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0
  ) {
    throw new Error(
      "The packing-location list could not be read.",
    );
  }

  return data;
}

export async function getPackingLocation(
  token,
  id,
  options = {},
) {
  const path = locationId(id);

  return readLocation(
    await request(token, `/${path}`, {
      ...options,
      method: "GET",
    }),
    false,
    id,
  );
}

export async function savePackingLocation(
  token,
  record,
  body,
  options = {},
) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error("Location information is required.");
  }

  if (record?.id) {
    checkRecord(record);
  }

  const data = await request(
    token,
    record?.id ? `/${locationId(record.id)}` : "",
    {
      ...options,
      method: record?.id ? "PUT" : "POST",
      body: record?.id
        ? { ...body, version: record.version }
        : body,
    },
  );

  return readLocation(data, true, record?.id || "");
}

export async function confirmPackingLocation(
  token,
  record,
  arrangementReference,
  options = {},
) {
  checkRecord(record);

  return readLocation(
    await request(
      token,
      `/${locationId(record.id)}/confirm`,
      {
        ...options,
        method: "POST",
        body: {
          version: record.version,
          arrangementReference,
        },
      },
    ),
    true,
    record.id,
  );
}

export async function confirmSupplierArrangement(
  token,
  record,
  row,
  options = {},
) {
  checkRecord(record);

  const supplierId = locationId(row?.supplier);

  return readLocation(
    await request(
      token,
      `/${locationId(record.id)}/suppliers/${supplierId}/confirm`,
      {
        ...options,
        method: "POST",
        body: {
          version: record.version,
          arrangementReference: row.arrangementReference,
          transferDaysMin: row.transferDaysMin,
          transferDaysMax: row.transferDaysMax,
        },
      },
    ),
    true,
    record.id,
  );
}

export async function confirmGymDrobeStockTransfer(
  token,
  record,
  options = {},
) {
  checkRecord(record);

  if (
    record.acceptsGymDrobeStock !== true ||
    record.gymdrobeStockTransfer?.status !== "pending"
  ) {
    throw new Error(
      "Enable receipt of GymDrobe stock and save the transfer arrangement as pending first.",
    );
  }

  const data = await request(
    token,
    `/${locationId(record.id)}/gymdrobe-stock-transfer/confirm`,
    {
      ...options,
      method: "POST",
      body: {
        version: record.version,
      },
    },
  );

  const location = readLocation(data, true, record.id);

  if (location.gymdrobeStockTransfer?.status !== "confirmed") {
    const error = new Error(
      "Transfer confirmation could not be verified. Reload before trying again.",
    );

    error.resultUnknown = true;

    throw error;
  }

  return location;
}