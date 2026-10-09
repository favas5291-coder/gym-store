import {
  getCartItemKey,
  normalizeCartItem,
  validateCartItem,
  getTotalStock,
} from "./cartUtils.js";

import { getDiscountedPrice } from "./productPricing.js";

// ======================================================
// BAG VARIANT
// ======================================================

function positiveQuantity(value) {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return null;
  }

  const quantity = Number(value);

  return Number.isSafeInteger(quantity) && quantity > 0
    ? quantity
    : null;
}

export function changeBagVariant(
  cart,
  key,
  product,
  size,
  color,
) {
  if (!Array.isArray(cart)) {
    return {
      error: "Your bag could not be read. Please refresh.",
    };
  }

  const old = cart.find(
    (row) => row && getCartItemKey(row) === key,
  );

  if (
    !old ||
    !product ||
    product.id == null ||
    product.isActive === false ||
    String(old.id) !== String(product.id)
  ) {
    return {
      error: "This bag item is no longer available.",
    };
  }

  const originalQuantity = positiveQuantity(old.quantity);

  if (originalQuantity == null) {
    return {
      error: "This bag item has an invalid quantity. Remove it and add it again.",
    };
  }

  // Check the selection before building its normalized key.
  const selectionCheck = validateCartItem(
    product,
    originalQuantity,
    size,
    color,
  );

  if (!selectionCheck.valid) {
    return {
      error:
        selectionCheck.message ||
        "Choose available product options.",
    };
  }

  const preview = normalizeCartItem(
    product,
    originalQuantity,
    size,
    color,
  );

  const nextKey = getCartItemKey(preview);

  // Include every matching row so duplicate stored rows
  // cannot cause quantities to disappear.
  let quantity = 0;

  for (const row of cart) {
    if (!row) continue;

    const rowKey = getCartItemKey(row);

    if (rowKey !== key && rowKey !== nextKey) {
      continue;
    }

    const rowQuantity = positiveQuantity(row.quantity);

    if (rowQuantity == null) {
      return {
        error:
          "A matching bag item has an invalid quantity. Remove it and add it again.",
      };
    }

    quantity += rowQuantity;

    if (!Number.isSafeInteger(quantity)) {
      return {
        error: "The combined quantity is too large.",
      };
    }
  }

  // Validate the complete destination quantity.
  // Nothing in the original cart changes on failure.
  const check = validateCartItem(
    product,
    quantity,
    size,
    color,
  );

  if (!check.valid) {
    return {
      error:
        check.message ||
        "Not enough stock to combine these bag items.",
    };
  }

  const item = normalizeCartItem(
    product,
    quantity,
    size,
    color,
  );

  const nextCart = [];
  let inserted = false;

  for (const row of cart) {
    if (!row) {
      nextCart.push(row);
      continue;
    }

    const rowKey = getCartItemKey(row);

    if (rowKey === key || rowKey === nextKey) {
      if (!inserted) {
        nextCart.push(item);
        inserted = true;
      }

      continue;
    }

    nextCart.push(row);
  }

  return {
    cart: nextCart,
  };
}

// ======================================================
// SELECTED BAG
// ======================================================

export function selectedBag(cart, keys) {
  const selected = new Set(
    Array.isArray(keys) ? keys : [],
  );

  return (Array.isArray(cart) ? cart : []).filter(
    (item) =>
      item && selected.has(getCartItemKey(item)),
  );
}

// ======================================================
// PRODUCT SPECIFICATIONS
// ======================================================

export function productSpecs(product) {
  if (!product || typeof product !== "object") {
    return [];
  }

  const specifications =
    product.specifications &&
    typeof product.specifications === "object" &&
    !Array.isArray(product.specifications)
      ? product.specifications
      : {};

  return Object.entries({
    Brand: product.brand,
    Category: product.category,
    Style: product.subcategory,
    Material: product.material,
    For: product.gender,
    ...specifications,
    SKU: product.sku,
    "In the box": product.whatsIncluded,
  }).filter(
    ([, value]) =>
      value != null && String(value).trim() !== "",
  );
}

// ======================================================
// RECOMMENDATION HELPERS
// ======================================================

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeList(value) {
  const values = Array.isArray(value)
    ? value
    : [value];

  return [
    ...new Set(
      values.map(normalizeValue).filter(Boolean),
    ),
  ];
}

function sharedValues(first, second) {
  const left = new Set(normalizeList(first));

  return normalizeList(second).filter(
    (value) => left.has(value),
  ).length;
}

// ======================================================
// COMPLEMENTARY CATEGORIES
// ======================================================

const COMPLEMENTARY_CATEGORIES = {
  "workout clothes": [
    "gym shoes",
    "socks",
    "water bottles",
    "shaker bottles",
    "gym towels",
    "headphones",
  ],

  "gym shoes": [
    "workout clothes",
    "socks",
    "water bottles",
    "gym towels",
  ],

  socks: [
    "gym shoes",
    "workout clothes",
  ],

  "gym towels": [
    "workout clothes",
    "water bottles",
    "shaker bottles",
    "gym shoes",
  ],

  "water bottles": [
    "workout clothes",
    "gym shoes",
    "gym towels",
    "protein",
    "shaker bottles",
  ],

  "shaker bottles": [
    "protein",
    "water bottles",
    "workout clothes",
    "gym towels",
  ],

  protein: [
    "shaker bottles",
    "water bottles",
  ],

  headphones: [
    "workout clothes",
    "gym shoes",
    "water bottles",
  ],

  "gym bags": [
    "workout clothes",
    "gym shoes",
    "water bottles",
    "shaker bottles",
    "gym towels",
    "socks",
  ],
};

function complementaryScore(product, candidate) {
  const sourceCategory = normalizeValue(
    product?.category,
  );

  const candidateCategory = normalizeValue(
    candidate?.category,
  );

  if (!sourceCategory || !candidateCategory) {
    return 0;
  }

  const relationships =
    Object.prototype.hasOwnProperty.call(
      COMPLEMENTARY_CATEGORIES,
      sourceCategory,
    )
      ? COMPLEMENTARY_CATEGORIES[sourceCategory]
      : [];

  const position = relationships.indexOf(
    candidateCategory,
  );

  return position < 0
    ? 0
    : Math.max(8, 20 - position * 2);
}

// ======================================================
// PRICE SIMILARITY
// ======================================================

function priceSimilarityScore(product, candidate) {
  const sourcePrice = Number(
    getDiscountedPrice(product),
  );

  const candidatePrice = Number(
    getDiscountedPrice(candidate),
  );

  if (
    !Number.isFinite(sourcePrice) ||
    !Number.isFinite(candidatePrice) ||
    sourcePrice <= 0 ||
    candidatePrice <= 0
  ) {
    return 0;
  }

  const ratio =
    Math.abs(sourcePrice - candidatePrice) /
    Math.max(sourcePrice, candidatePrice);

  if (ratio <= 0.15) return 10;
  if (ratio <= 0.3) return 7;
  if (ratio <= 0.5) return 4;
  if (ratio <= 0.75) return 2;

  return 0;
}

// ======================================================
// RELATED PRODUCT SCORE
// ======================================================

function relatedScore(product, candidate) {
  let score = complementaryScore(
    product,
    candidate,
  );

  const matchingFields = [
    ["category", 18],
    ["subcategory", 15],
    ["gender", 4],
    ["brand", 3],
    ["material", 2],
  ];

  for (const [field, points] of matchingFields) {
    const source = normalizeValue(product?.[field]);
    const destination = normalizeValue(
      candidate?.[field],
    );

    if (source && source === destination) {
      score += points;
    }
  }

  score +=
    sharedValues(product?.tags, candidate?.tags) * 7;

  score +=
    sharedValues(
      product?.activities ||
        product?.activity ||
        product?.useCases,
      candidate?.activities ||
        candidate?.activity ||
        candidate?.useCases,
    ) * 6;

  score += priceSimilarityScore(
    product,
    candidate,
  );

  if (candidate?.isBestSeller) score += 5;
  if (candidate?.isFeatured) score += 3;
  if (candidate?.isNew) score += 2;
  if (getTotalStock(candidate) > 0) score += 8;

  return score;
}

// ======================================================
// RELATED PRODUCTS
// ======================================================

export function rankRelated(product, catalogue) {
  if (!product || !Array.isArray(catalogue)) {
    return [];
  }

  return catalogue
    .filter(
      (item) =>
        item &&
        item.id != null &&
        item.isActive !== false &&
        String(item.id) !== String(product.id),
    )
    .map((item, index) => ({
      item,
      index,
      score: relatedScore(product, item),
      available: getTotalStock(item) > 0 ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.available - a.available ||
        b.score - a.score ||
        a.index - b.index,
    )
    .map((entry) => entry.item);
}

// ======================================================
// PRICE / STOCK WATCHES
// ======================================================

function recordedAmount(value) {
  if (
    value == null ||
    (typeof value === "string" && !value.trim()) ||
    !["string", "number"].includes(typeof value)
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

export function watchChanges(watches, catalogue) {
  if (
    !Array.isArray(watches) ||
    !Array.isArray(catalogue)
  ) {
    return [];
  }

  return watches.flatMap((watch) => {
    if (!watch || watch.id == null) {
      return [];
    }

    const product = catalogue.find(
      (item) =>
        item &&
        item.id != null &&
        item.isActive !== false &&
        String(item.id) === String(watch.id),
    );

    if (!product) {
      return [];
    }

    const price = getDiscountedPrice(product);
    const stock = getTotalStock(product);

    const previousPrice = recordedAmount(
      watch.price,
    );

    const previousStock = recordedAmount(
      watch.stock,
    );

    const updates = [];

    if (previousStock === 0 && stock > 0) {
      updates.push("Back in stock");
    }

    if (
      previousPrice != null &&
      Number.isFinite(price) &&
      price < previousPrice
    ) {
      updates.push("Price dropped");
    }

    return [
      {
        ...watch,
        product,
        priceNow: price,
        stockNow: stock,
        updates,
      },
    ];
  });
}

// ======================================================
// DELIVERY DATE
// ======================================================

export function deliveredAt(order) {
  if (!order) {
    return null;
  }

  const events = Array.isArray(
    order.tracking?.events,
  )
    ? order.tracking.events
    : [];

  const event = [...events]
    .reverse()
    .find(
      (entry) => entry?.status === "delivered",
    );

  return (
    order.deliveredAt ||
    order.delivery?.deliveredAt ||
    event?.timestamp ||
    null
  );
}

// ======================================================
// RETURN ELIGIBILITY
// ======================================================

// This is a frontend check.
// The backend must also verify eligibility when submitting.
export function returnEligibility(
  order,
  now = Date.now(),
) {
  if (order?.status !== "delivered") {
    return {
      eligible: false,
      message:
        "Returns and exchanges open after delivery.",
    };
  }

  const requestStatus = order.returnRequest?.status;

  if (
    requestStatus &&
    requestStatus !== "not-requested" &&
    requestStatus !== "rejected"
  ) {
    return {
      eligible: false,
      message:
        "A return or exchange request is already recorded for this order.",
    };
  }

  const start = Date.parse(deliveredAt(order));
  const currentTime = Number(now);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(currentTime) ||
    start > currentTime
  ) {
    return {
      eligible: false,
      message:
        "Contact support to confirm the delivery date and return eligibility.",
    };
  }

  const end = start + 7 * 86400000;

  if (currentTime > end) {
    return {
      eligible: false,
      message:
        "The 7-day request window has ended. Contact support for help.",
    };
  }

  return {
    eligible: true,
    deadline: new Date(end).toISOString(),
  };
}

// ======================================================
// RETURN / EXCHANGE VALIDATION
// ======================================================

export function validateReturnItems(
  order,
  requested,
  catalogue,
  type,
) {
  if (
    !Array.isArray(requested) ||
    !requested.length
  ) {
    return "Select at least one item.";
  }

  const items = Array.isArray(order?.items)
    ? order.items
    : [];

  const products = Array.isArray(catalogue)
    ? catalogue
    : [];

  const seen = new Set();
  const exchangeTotals = new Map();

  for (const row of requested) {
    if (
      !row ||
      !Number.isSafeInteger(row.index) ||
      row.index < 0 ||
      seen.has(row.index) ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1
    ) {
      return "Choose valid item quantities.";
    }

    const item = items[row.index];
    const purchasedQuantity = positiveQuantity(
      item?.quantity,
    );

    if (
      !item ||
      purchasedQuantity == null ||
      row.quantity > purchasedQuantity
    ) {
      return "Choose valid item quantities.";
    }

    seen.add(row.index);

    if (type !== "exchange") {
      continue;
    }

    const product = products.find(
      (entry) =>
        entry &&
        entry.id != null &&
        String(entry.id) === String(item.id),
    );

    if (!product || product.isActive === false) {
      return `${item.name || "This item"}: The product is unavailable for exchange.`;
    }

    const check = validateCartItem(
      product,
      row.quantity,
      row.size,
      row.color,
    );

    if (!check.valid) {
      return `${item.name || "This item"}: ${
        check.message || "Choose available options."
      }`;
    }

    const replacement = normalizeCartItem(
      product,
      row.quantity,
      row.size,
      row.color,
    );

    const sameSize =
      String(replacement.selectedSize ?? "") ===
      String(item.selectedSize ?? "");

    const sameColor =
      String(replacement.selectedColor ?? "") ===
      String(item.selectedColor ?? "");

    if (sameSize && sameColor) {
      return "Choose a different size or colour for an exchange.";
    }

    // Multiple order lines can target the same replacement.
    // Check their combined quantity against stock.
    const replacementKey = getCartItemKey(
      replacement,
    );

    const combinedQuantity =
      (exchangeTotals.get(replacementKey) || 0) +
      row.quantity;

    if (!Number.isSafeInteger(combinedQuantity)) {
      return "Choose valid item quantities.";
    }

    const combinedCheck = validateCartItem(
      product,
      combinedQuantity,
      replacement.selectedSize,
      replacement.selectedColor,
    );

    if (!combinedCheck.valid) {
      return `${item.name || "This item"}: ${
        combinedCheck.message ||
        "Not enough stock for the combined exchange quantity."
      }`;
    }

    exchangeTotals.set(
      replacementKey,
      combinedQuantity,
    );
  }

  return "";
}

// ======================================================
// CSV
// ======================================================

export function csvCell(value) {
  const text = String(value ?? "");

  // Prevent spreadsheet applications from interpreting
  // user-entered text as a formula.
  const needsPrefix =
    /^\s*[=+@-]/.test(text) ||
    /^[\t\r\n]/.test(text);

  const safeText = needsPrefix
    ? `'${text}`
    : text;

  return `"${safeText.replaceAll('"', '""')}"`;
}

// ======================================================
// DOWNLOAD TEXT
// ======================================================

export function downloadText(
  filename,
  text,
  type = "text/plain",
) {
  const url = URL.createObjectURL(
    new Blob([text], { type }),
  );

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}