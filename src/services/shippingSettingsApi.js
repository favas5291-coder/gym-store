const API_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const LIMITS = {
  eligibleProductIds: 500,
  eligibleCategories: 100,
  eligiblePincodes: 10000,
  excludedProductIds: 500,
  excludedCategories: 100,
  excludedPincodes: 10000,
};

export function rupeesToShippingPaise(value) {
  const input = String(value ?? "").trim();

  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(input)) {
    throw new Error(
      "Enter a purchase amount with at most two decimal places.",
    );
  }

  const [whole, decimal = ""] = input.split(".");

  const result =
    Number(whole) * 100 +
    Number(decimal.padEnd(2, "0"));

  if (
    !Number.isSafeInteger(result) ||
    result > 100000000
  ) {
    throw new Error(
      "The minimum purchase must be between ₹0 and ₹10,00,000.",
    );
  }

  return result;
}

export function validateShippingSettings(value) {
  const offer = value?.freeShipping;

  if (
    !Number.isSafeInteger(value?.version) ||
    value.version < 0 ||
    value.version >= Number.MAX_SAFE_INTEGER ||
    !offer ||
    typeof offer !== "object" ||
    Array.isArray(offer) ||
    typeof offer.enabled !== "boolean" ||
    !Number.isSafeInteger(
      offer.minimumSubtotalPaise,
    ) ||
    offer.minimumSubtotalPaise < 0 ||
    offer.minimumSubtotalPaise > 100000000 ||
    typeof offer.additionalChargesNotice !==
      "string" ||
    offer.additionalChargesNotice.trim().length >
      500 ||
    /[\u0000-\u001f\u007f]/.test(
      offer.additionalChargesNotice,
    )
  ) {
    throw new Error(
      "Shipping settings could not be verified. Reload the saved settings.",
    );
  }

  const clean = {
    enabled: offer.enabled,
    minimumSubtotalPaise:
      offer.minimumSubtotalPaise,
  };

  for (const [key, limit] of Object.entries(LIMITS)) {
    if (
      !Array.isArray(offer[key]) ||
      offer[key].length > limit
    ) {
      throw new Error(
        `${key}: use at most ${limit} entries.`,
      );
    }

    clean[key] = offer[key].map((entry) => {
      if (
        typeof entry !== "string" ||
        !entry.trim() ||
        entry.trim().length > 100 ||
        /[\u0000-\u001f\u007f]/.test(entry)
      ) {
        throw new Error(
          `${key} contains invalid text.`,
        );
      }

      const item = entry.trim();

      if (
        key.endsWith("ProductIds") &&
        !/^[a-f0-9]{24}$/i.test(item)
      ) {
        throw new Error(
          `${key} contains an invalid product selection.`,
        );
      }

      if (
        key.endsWith("Pincodes") &&
        !/^[1-9]\d{5}$/.test(item)
      ) {
        throw new Error(
          `${key} contains an invalid six-digit pincode.`,
        );
      }

      return key.endsWith("ProductIds")
        ? item.toLowerCase()
        : item;
    });

    if (
      new Set(
        clean[key].map((item) =>
          item.toLowerCase(),
        ),
      ).size !== clean[key].length
    ) {
      throw new Error(
        `${key} contains duplicate entries.`,
      );
    }
  }

  for (const suffix of [
    "ProductIds",
    "Categories",
    "Pincodes",
  ]) {
    const excluded = new Set(
      clean[`excluded${suffix}`].map((item) =>
        item.toLowerCase(),
      ),
    );

    if (
      clean[`eligible${suffix}`].some((item) =>
        excluded.has(item.toLowerCase()),
      )
    ) {
      throw new Error(
        `Remove the overlap between eligible and excluded ${suffix.toLowerCase()}.`,
      );
    }
  }

  clean.additionalChargesNotice =
    offer.additionalChargesNotice.trim();

  return {
    version: value.version,
    freeShipping: clean,
  };
}

async function request(
  token,
  { body, signal } = {},
) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "Sign in with an admin account.",
    );
  }

  const writing = body !== undefined;

  const serialized = writing
    ? JSON.stringify(
        validateShippingSettings(body),
      )
    : undefined;

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

  const timer = setTimeout(
    abort,
    15000,
  );

  try {
    const response = await fetch(
      `${API_URL}/shipping-settings`,
      {
        method: writing ? "PUT" : "GET",
        cache: "no-store",
        signal: controller.signal,

        headers: {
          Accept: "application/json",
          Authorization:
            `Bearer ${token.trim()}`,

          ...(writing
            ? {
                "Content-Type":
                  "application/json",
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
        typeof data?.message === "string"
          ? data.message
          : "Shipping settings could not be loaded. Please retry.",
      );

      error.status = response.status;

      error.reloadRequired =
        response.status === 409;

      error.resultUnknown =
        writing &&
        (
          response.status >= 500 ||
          response.ok ||
          !data
        );

      throw error;
    }

    let result;

    try {
      result = validateShippingSettings(
        data.settings,
      );

      if (
        writing &&
        (
          result.version !== body.version + 1 ||
          JSON.stringify(result.freeShipping) !==
            JSON.stringify(
              validateShippingSettings(body)
                .freeShipping,
            )
        )
      ) {
        throw new Error(
          "Saved settings do not match the submitted offer.",
        );
      }
    } catch {
      const error = new Error(
        writing
          ? "The save result could not be verified. Reload saved settings before another save."
          : "The server returned invalid shipping settings. Please retry.",
      );

      error.resultUnknown = writing;

      throw error;
    }

    return result;
  } catch (failure) {
    if (
      failure.status ||
      failure.resultUnknown
    ) {
      throw failure;
    }

    if (
      !writing &&
      signal?.aborted
    ) {
      throw failure;
    }

    const error = new Error(
      writing
        ? "The save result is unknown. Reload saved settings before trying again."
        : "Cannot load shipping settings. Check your connection and retry.",
    );

    error.resultUnknown = writing;

    throw error;
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      abort,
    );
  }
}

export const getShippingSettings = (
  token,
  options = {},
) => request(token, options);

export const saveShippingSettings = (
  token,
  body,
  options = {},
) =>
  request(token, {
    ...options,
    body,
  });