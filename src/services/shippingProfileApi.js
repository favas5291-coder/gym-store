const API_URL = String(
  import.meta.env.VITE_API_URL || "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const ID = /^[a-f0-9]{24}$/i;
const PIN = /^[1-9]\d{5}$/;

const STATES = [
  "draft",
  "active",
  "paused",
  "archived",
];

const PARCEL_LIMITS = {
  maximumWeightGrams: 500000,
  maximumLengthMm: 10000,
  maximumWidthMm: 10000,
  maximumHeightMm: 10000,
  maximumUnits: 999,
};

function object(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value),
  );
}

function integer(
  value,
  maximum,
  nullable = true,
  minimum = 0,
) {
  return (
    (nullable && value == null) ||
    (
      Number.isSafeInteger(value) &&
      value >= minimum &&
      value <= maximum
    )
  );
}

function date(value) {
  return (
    value == null ||
    (
      typeof value === "string" &&
      Number.isFinite(Date.parse(value))
    )
  );
}

function optionalId(value) {
  return (
    value == null ||
    (typeof value === "string" && ID.test(value))
  );
}

function validProfile(value) {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !ID.test(value.id) ||
    !integer(value.version, Number.MAX_SAFE_INTEGER, false) ||
    typeof value.name !== "string" ||
    !STATES.includes(value.status) ||
    typeof value.ready !== "boolean" ||
    value.purchaseEnabled !== false ||
    !Array.isArray(value.readinessIssues) ||
    !value.readinessIssues.every(
      (issue) => typeof issue === "string",
    )
  ) {
    return false;
  }

  const origin = value.origin;
  const service = value.service;
  const charges = value.charges;
  const verification = value.verification;

  if (
    !object(origin) ||
    ![
      "unconfigured",
      "packing-location",
      "supplier",
      "gymdrobe",
    ].includes(origin.kind) ||
    typeof origin.name !== "string" ||
    typeof origin.pickupPincode !== "string" ||
    (
      origin.pickupPincode !== "" &&
      !PIN.test(origin.pickupPincode)
    ) ||
    !optionalId(origin.packingLocation) ||
    !optionalId(origin.supplier)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.productIds) ||
    value.productIds.length > 500 ||
    !value.productIds.every(
      (id) => typeof id === "string" && ID.test(id),
    ) ||
    new Set(
      value.productIds.map((id) => id.toLowerCase()),
    ).size !== value.productIds.length
  ) {
    return false;
  }

  if (
    !Array.isArray(value.destinationPincodes) ||
    value.destinationPincodes.length > 10000 ||
    !value.destinationPincodes.every(
      (pin) => typeof pin === "string" && PIN.test(pin),
    ) ||
    new Set(value.destinationPincodes).size !==
      value.destinationPincodes.length
  ) {
    return false;
  }

  if (
    !object(service) ||
    typeof service.carrier !== "string" ||
    typeof service.name !== "string" ||
    !["standard", "express"].includes(service.deliveryMethod) ||
    typeof service.supportsOnline !== "boolean" ||
    typeof service.supportsCodAdvance !== "boolean" ||
    !integer(service.maximumCodBalancePaise, 100000000) ||
    !integer(service.transitDaysMin, 365) ||
    !integer(service.transitDaysMax, 365)
  ) {
    return false;
  }

  if (
    (
      service.transitDaysMin != null ||
      service.transitDaysMax != null
    ) &&
    (
      service.transitDaysMin == null ||
      service.transitDaysMax == null ||
      service.transitDaysMax < service.transitDaysMin
    )
  ) {
    return false;
  }

  if (
    !object(value.parcelLimits) ||
    Object.entries(PARCEL_LIMITS).some(
      ([key, maximum]) =>
        !integer(value.parcelLimits[key], maximum, true, 1),
    )
  ) {
    return false;
  }

  if (
    !object(charges) ||
    !integer(charges.shippingPaise, 100000000) ||
    !integer(charges.codFeePaise, 100000000, false) ||
    !integer(charges.courierCostPaise, 100000000)
  ) {
    return false;
  }

  if (
    !object(verification) ||
    !date(verification.confirmedAt) ||
    !date(verification.validUntil) ||
    !optionalId(verification.confirmedBy) ||
    typeof verification.arrangementReference !== "string" ||
    typeof value.notes !== "string"
  ) {
    return false;
  }

  return true;
}

// A blank amount means unknown, not free.
export function rupeesToPaise(value) {
  if (
    value == null ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  if (!["string", "number"].includes(typeof value)) {
    throw new Error(
      "Enter an INR amount with at most two decimal places.",
    );
  }

  const input = String(value).trim();

  if (!/^\d{1,7}(\.\d{1,2})?$/.test(input)) {
    throw new Error(
      "Enter an INR amount with at most two decimal places, without commas or currency symbols.",
    );
  }

  const [whole, fraction = ""] = input.split(".");

  const paise =
    Number(whole) * 100 +
    Number(fraction.padEnd(2, "0"));

  if (
    !Number.isSafeInteger(paise) ||
    paise > 100000000
  ) {
    throw new Error(
      "The amount cannot exceed INR 10,00,000.",
    );
  }

  return paise;
}

export function paiseToRupeesInput(value) {
  if (value == null) {
    return "";
  }

  if (!integer(value, 100000000, false)) {
    throw new Error("The recorded amount is invalid.");
  }

  return (
    `${Math.floor(value / 100)}.` +
    String(value % 100).padStart(2, "0")
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

  if (signal?.aborted) {
    throw new DOMException("Request cancelled.", "AbortError");
  }

  let serialized;

  if (body !== undefined) {
    try {
      serialized = JSON.stringify(body);
    } catch {
      throw new Error(
        "The shipping information could not be prepared. Check it before saving.",
      );
    }
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
      `${API_URL}/shipping-profiles${path}`,
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

        body: serialized,
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.success !== true) {
      const error = new Error(
        typeof data?.message === "string" && data.message.trim()
          ? data.message
          : "The shipping service returned an unreadable response.",
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
      method !== "GET"
        ? "The save result is unknown. Reload the profile before trying again."
        : timedOut
          ? "The shipping service timed out. Check your connection and retry."
          : "Cannot load shipping profiles. Check your connection and retry.",
    );

    // An interrupted write may already have reached the server.
    error.resultUnknown = method !== "GET";

    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function profileId(value) {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new Error("Shipping profile ID is invalid.");
  }

  return encodeURIComponent(value.toLowerCase());
}

function checkRecord(record) {
  profileId(record?.id);

  if (
    !integer(record.version, Number.MAX_SAFE_INTEGER, false)
  ) {
    throw new Error(
      "Reload the shipping profile to get its current version before saving.",
    );
  }
}

function readProfile(
  data,
  writing = false,
  expectedId = "",
) {
  if (
    !validProfile(data.profile) ||
    (
      expectedId &&
      data.profile.id.toLowerCase() !==
        expectedId.toLowerCase()
    )
  ) {
    const error = new Error(
      writing
        ? "The saved shipping profile could not be read. Reload before another save."
        : "The shipping profile could not be read. Reload and try again.",
    );

    error.resultUnknown = writing;

    throw error;
  }

  return data.profile;
}

export async function getShippingProfiles(
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
    throw new Error("Choose a valid shipping-profile page.");
  }

  if (
    typeof search !== "string" ||
    search.trim().length > 100
  ) {
    throw new Error(
      "Search must contain at most 100 characters.",
    );
  }

  if (status && !STATES.includes(status)) {
    throw new Error("Choose a valid shipping-profile status.");
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
    !Array.isArray(data.profiles) ||
    !data.profiles.every(validProfile) ||
    !integer(data.page, 100000, false, 1) ||
    !integer(data.pages, Number.MAX_SAFE_INTEGER, false, 1) ||
    !integer(data.total, Number.MAX_SAFE_INTEGER, false)
  ) {
    throw new Error(
      "The shipping-profile list could not be read.",
    );
  }

  return data;
}

export async function getShippingProfile(
  token,
  id,
  options = {},
) {
  return readProfile(
    await request(token, `/${profileId(id)}`, {
      ...options,
      method: "GET",
    }),
    false,
    id,
  );
}

export async function saveShippingProfile(
  token,
  record,
  body,
  options = {},
) {
  if (!object(body)) {
    throw new Error("Shipping profile information is required.");
  }

  if (record?.id) {
    checkRecord(record);
  }

  return readProfile(
    await request(
      token,
      record?.id ? `/${profileId(record.id)}` : "",
      {
        ...options,
        method: record?.id ? "PUT" : "POST",

        body: record?.id
          ? { ...body, version: record.version }
          : body,
      },
    ),
    true,
    record?.id || "",
  );
}

export async function confirmShippingProfile(
  token,
  record,
  { arrangementReference, validUntil } = {},
  options = {},
) {
  checkRecord(record);

  if (!["draft", "paused"].includes(record.status)) {
    throw new Error(
      "Save the shipping profile as draft or paused before confirming its terms.",
    );
  }

  if (
    typeof arrangementReference !== "string" ||
    !arrangementReference.trim() ||
    arrangementReference.trim().length > 200
  ) {
    throw new Error(
      "Enter the actual courier agreement reference, up to 200 characters.",
    );
  }

  if (
    typeof validUntil !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(validUntil) ||
    !Number.isFinite(Date.parse(validUntil)) ||
    Date.parse(validUntil) <= Date.now()
  ) {
    throw new Error(
      "Choose a valid future agreement expiry with a timezone.",
    );
  }

  const profile = readProfile(
    await request(
      token,
      `/${profileId(record.id)}/confirm`,
      {
        ...options,
        method: "POST",
        body: {
          version: record.version,
          arrangementReference: arrangementReference.trim(),
          validUntil,
        },
      },
    ),
    true,
    record.id,
  );

  if (
    !profile.verification.confirmedAt ||
    !profile.verification.confirmedBy ||
    profile.verification.arrangementReference !==
      arrangementReference.trim() ||
    Date.parse(profile.verification.validUntil) !==
      Date.parse(validUntil)
  ) {
    const error = new Error(
      "Shipping confirmation could not be verified. Reload before trying again.",
    );

    error.resultUnknown = true;

    throw error;
  }

  return profile;
}