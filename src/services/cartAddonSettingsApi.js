const API_URL = String(
  import.meta.env?.VITE_API_URL ||
    "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const MAX_SUGGESTIONS = 3;
const MAX_CONFIGURED_PAIRS = 200;
const MAX_EXCLUDED_PRODUCTS = 500;
const MAX_SETTINGS_VERSION = Number.MAX_SAFE_INTEGER - 1;

const SETTINGS_FIELDS = Object.freeze([
  "version",
  "enabled",
  "useCategoryRules",
  "maxSuggestions",
  "excludedProductIds",
  "configuredPairs",
]);

const PAIR_FIELDS = Object.freeze([
  "sourceId",
  "productId",
  "enabled",
  "compatibilityConfirmed",
]);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "INVALID_CART_ADDON_SETTINGS";
  error.gymdrobe = true;
  return error;
}

function requireFields(value, fields, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw invalid(`${label} must be an object.`);
  }

  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) {
      throw invalid(
        `${label} contains an unsupported field.`,
      );
    }
  }

  for (const key of fields) {
    if (
      !Object.prototype.hasOwnProperty.call(
        value,
        key,
      )
    ) {
      throw invalid(
        `Send the complete ${label.toLowerCase()}.`,
      );
    }
  }
}

function productId(value, label) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{24}$/i.test(value.trim())
  ) {
    throw invalid(
      `${label} must be a valid product ID.`,
    );
  }

  return value.trim().toLowerCase();
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw invalid(
      `${label} must be true or false.`,
    );
  }

  return value;
}

function defaultCartAddonSettings() {
  return {
    version: 0,
    enabled: false,
    useCategoryRules: true,
    maxSuggestions: MAX_SUGGESTIONS,
    excludedProductIds: [],
    configuredPairs: [],
  };
}

function normalizeCartAddonSettings(input) {
  requireFields(
    input,
    SETTINGS_FIELDS,
    "Cart add-on settings",
  );

  if (
    !Number.isSafeInteger(input.version) ||
    input.version < 0 ||
    input.version > MAX_SETTINGS_VERSION
  ) {
    throw invalid(
      "Load the current settings version before saving.",
    );
  }

  const enabled = requireBoolean(
    input.enabled,
    "Enabled",
  );

  const useCategoryRules = requireBoolean(
    input.useCategoryRules,
    "Use category rules",
  );

  if (
    !Number.isSafeInteger(input.maxSuggestions) ||
    input.maxSuggestions < 1 ||
    input.maxSuggestions > MAX_SUGGESTIONS
  ) {
    throw invalid(
      `Choose between 1 and ${MAX_SUGGESTIONS} suggestions.`,
    );
  }

  if (
    !Array.isArray(input.excludedProductIds) ||
    input.excludedProductIds.length >
      MAX_EXCLUDED_PRODUCTS
  ) {
    throw invalid(
      `Choose up to ${MAX_EXCLUDED_PRODUCTS} excluded products.`,
    );
  }

  const excludedProductIds =
    input.excludedProductIds.map((value) =>
      productId(value, "Excluded product"),
    );

  if (
    new Set(excludedProductIds).size !==
    excludedProductIds.length
  ) {
    throw invalid(
      "List each excluded product only once.",
    );
  }

  if (
    !Array.isArray(input.configuredPairs) ||
    input.configuredPairs.length >
      MAX_CONFIGURED_PAIRS
  ) {
    throw invalid(
      `Configure up to ${MAX_CONFIGURED_PAIRS} product pairings.`,
    );
  }

  const seen = new Set();

  const configuredPairs = input.configuredPairs.map(
    (pair) => {
      requireFields(
        pair,
        PAIR_FIELDS,
        "Product pairing",
      );

      const sourceId = productId(
        pair.sourceId,
        "Source product",
      );

      const targetId = productId(
        pair.productId,
        "Recommended product",
      );

      const pairEnabled = requireBoolean(
        pair.enabled,
        "Pairing enabled",
      );

      const compatibilityConfirmed =
        requireBoolean(
          pair.compatibilityConfirmed,
          "Compatibility confirmed",
        );

      if (sourceId === targetId) {
        throw invalid(
          "A product cannot be its own add-on.",
        );
      }

      const key = `${sourceId}:${targetId}`;

      if (seen.has(key)) {
        throw invalid(
          "List each source and recommended product pairing only once.",
        );
      }

      seen.add(key);

      if (
        pairEnabled &&
        !compatibilityConfirmed
      ) {
        throw invalid(
          "Confirm product compatibility before enabling this pairing.",
        );
      }

      return {
        sourceId,
        productId: targetId,
        enabled: pairEnabled,
        compatibilityConfirmed,
      };
    },
  );

  // Exclusions take priority when recommendations are selected.
  // Disabled pairs suppress their source/product category relationship.
  // Pair order is retained as the admin's recommendation priority.
  return {
    version: input.version,
    enabled,
    useCategoryRules,
    maxSuggestions: input.maxSuggestions,
    excludedProductIds,
    configuredPairs,
  };
}

export {
  MAX_SUGGESTIONS,
  MAX_CONFIGURED_PAIRS,
  MAX_EXCLUDED_PRODUCTS,
  MAX_SETTINGS_VERSION,
  defaultCartAddonSettings,
  normalizeCartAddonSettings as validateCartAddonSettings,
};

function requestError(message, details = {}) {
  const error = new Error(message);

  Object.assign(error, {
    cartAddonSettings: true,
    status: 0,
    code: "CART_ADDON_REQUEST_FAILED",
    resultUnknown: false,
    reloadRequired: false,
    ...details,
  });

  return error;
}

function requireAdminToken(value) {
  const token =
    typeof value === "string"
      ? value.trim()
      : "";

  if (
    !token ||
    /\s/.test(token) ||
    token.length > 8192
  ) {
    throw requestError(
      "Sign in with an admin account.",
      {
        code: "AUTH_REQUIRED",
      },
    );
  }

  return token;
}

async function request({
  token,
  admin = false,
  writing = false,
  body,
  signal,
} = {}) {
  const credential = admin
    ? requireAdminToken(token)
    : "";

  const submitted = writing
    ? normalizeCartAddonSettings(body)
    : null;

  if (
    writing &&
    submitted.version >= MAX_SETTINGS_VERSION
  ) {
    throw invalid(
      "The settings version cannot be increased.",
    );
  }

  if (signal?.aborted) {
    throw requestError(
      "The settings request was cancelled.",
      {
        name: "AbortError",
        code: "CART_ADDON_REQUEST_ABORTED",
      },
    );
  }

  // Capture the complete draft before any asynchronous work.
  const serialized = writing
    ? JSON.stringify(submitted)
    : undefined;

  const controller = new AbortController();

  let timedOut = false;
  let dispatched = false;

  const abort = () => controller.abort();

  signal?.addEventListener(
    "abort",
    abort,
    { once: true },
  );

  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, 15000);

  try {
    const path = admin
      ? "/cart-addons/admin/settings"
      : "/cart-addons/settings";

    dispatched = true;

    const response = await fetch(
      `${API_URL}${path}`,
      {
        method: writing ? "PUT" : "GET",
        cache: "no-store",
        signal: controller.signal,

        headers: {
          Accept: "application/json",

          ...(admin
            ? {
                Authorization:
                  `Bearer ${credential}`,
              }
            : {}),

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

    if (controller.signal.aborted) {
      throw new Error("REQUEST_ABORTED");
    }

    if (
      !response.ok ||
      data?.success !== true
    ) {
      const knownRejection =
        data?.success === false &&
        (
          [
            400,
            401,
            403,
            404,
            405,
            409,
            413,
            422,
            429,
          ].includes(response.status) ||
          (
            response.status === 503 &&
            data.code ===
              "CART_ADDON_PRODUCTS_UNAVAILABLE"
          )
        );

      const resultUnknown =
        writing && !knownRejection;

      throw requestError(
        resultUnknown
          ? "The save result is unknown. Reload saved settings before trying again."
          : typeof data?.message === "string" &&
              data.message.trim()
            ? data.message
            : "Cart add-on settings could not be loaded. Please retry.",
        {
          status: response.status,

          code:
            typeof data?.code === "string"
              ? data.code
              : "CART_ADDON_REQUEST_FAILED",

          resultUnknown,

          reloadRequired:
            resultUnknown ||
            response.status === 409,
        },
      );
    }

    let result;

    try {
      result = normalizeCartAddonSettings(
        data.settings,
      );

      if (
        writing &&
        JSON.stringify(result) !==
          JSON.stringify({
            ...submitted,
            version: submitted.version + 1,
          })
      ) {
        throw new Error("SAVE_MISMATCH");
      }
    } catch {
      throw requestError(
        writing
          ? "The save result could not be verified. Reload saved settings before another save."
          : "The server returned invalid cart add-on settings. Please retry.",
        {
          status: response.status,
          code: "INVALID_CART_ADDON_RESPONSE",
          resultUnknown: writing,
          reloadRequired: writing,
        },
      );
    }

    return result;
  } catch (failure) {
    if (
      failure?.cartAddonSettings === true
    ) {
      throw failure;
    }

    const resultUnknown =
      writing && dispatched;

    throw requestError(
      resultUnknown
        ? "The save result is unknown. Reload saved settings before trying again."
        : timedOut
          ? "Loading cart add-on settings timed out. Please retry."
          : signal?.aborted
            ? "The settings request was cancelled."
            : "Cannot load cart add-on settings. Check your connection and retry.",
      {
        name: signal?.aborted
          ? "AbortError"
          : "Error",

        code: timedOut
          ? "CART_ADDON_REQUEST_TIMEOUT"
          : signal?.aborted
            ? "CART_ADDON_REQUEST_ABORTED"
            : "CART_ADDON_CONNECTION_FAILED",

        resultUnknown,
        reloadRequired: resultUnknown,
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

export const getPublicCartAddonSettings = (
  options = {},
) =>
  request({
    signal: options.signal,
  });

export const getCartAddonSettings = (
  token,
  options = {},
) =>
  request({
    token,
    admin: true,
    signal: options.signal,
  });

export const saveCartAddonSettings = (
  token,
  body,
  options = {},
) =>
  request({
    token,
    admin: true,
    writing: true,
    body,
    signal: options.signal,
  });