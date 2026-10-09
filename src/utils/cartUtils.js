import {
  getDiscountedPrice,
  getOriginalPrice,
} from "./productPricing.js";

export {
  getDiscountedPrice,
} from "./productPricing.js";

// ======================================================
// HELPERS
// ======================================================

function isObject(value) {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object || {},
    key,
  );
}

function numeric(value) {
  if (
    !["number", "string"].includes(typeof value)
  ) {
    return null;
  }

  if (
    typeof value === "string" &&
    !value.trim()
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function count(value) {
  const parsed = numeric(value);

  if (parsed == null || parsed < 0) {
    return 0;
  }

  const result = Math.floor(parsed);

  return Number.isSafeInteger(result)
    ? result
    : 0;
}

function productId(product) {
  return (
    [
      product?.id,
      product?._id,
      product?.legacyId,
    ].find(
      (value) =>
        ["string", "number"].includes(
          typeof value,
        ) &&
        String(value).trim(),
    ) ?? ""
  );
}

function options(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) =>
          ["string", "number"].includes(
            typeof value,
          ),
        )
        .map(String)
        .filter((value) => value.trim()),
    ),
  ];
}

function option(value) {
  return value == null || value === ""
    ? null
    : String(value);
}

function hasVariants(product) {
  return (
    isObject(product?.variants) &&
    Object.keys(product.variants).length > 0
  );
}

function unavailable(product) {
  return (
    !isObject(product) ||
    product.isActive === false ||
    product.stockStatus === "out-of-stock"
  );
}

function validSelection(product, size, color) {
  const sizes = options(product?.sizes);
  const colors = options(product?.colors);

  const validSize = sizes.length
    ? sizes.includes(option(size))
    : option(size) === null;

  const validColor = colors.length
    ? colors.includes(option(color))
    : option(color) === null;

  return validSize && validColor;
}

// ======================================================
// TOTAL AVAILABLE STOCK
// ======================================================

export function getTotalStock(product) {
  if (unavailable(product)) {
    return 0;
  }

  // Empty variant objects use the product's shared stock.
  if (!hasVariants(product)) {
    return count(product.stock);
  }

  const sizes = options(product.sizes);
  const colors = options(product.colors);

  const sizeOptions = sizes.length
    ? sizes
    : [null];

  const colorOptions = colors.length
    ? colors
    : [null];

  let total = 0;

  // Count only inventory belonging to declared options.
  for (const color of colorOptions) {
    for (const size of sizeOptions) {
      total = Math.min(
        Number.MAX_SAFE_INTEGER,
        total +
          getVariantStock(product, size, color),
      );
    }
  }

  return total;
}

// ======================================================
// SELECTED VARIANT STOCK
//
// Supported inventory:
//
// Colour + size: variants[colour][size]
// Colour only:  variants[colour].default
//               or variants[colour]
// Size only:    variants[size]
// No options:   variants.default
// Shared stock: product.stock when variants is empty
// ======================================================

export function getVariantStock(
  product,
  selectedSize = null,
  selectedColor = null,
) {
  if (
    unavailable(product) ||
    !validSelection(
      product,
      selectedSize,
      selectedColor,
    )
  ) {
    return 0;
  }

  if (!hasVariants(product)) {
    return count(product.stock);
  }

  const sizes = options(product.sizes);
  const colors = options(product.colors);

  let group = product.variants;

  if (colors.length) {
    const colorKey = option(selectedColor);

    if (!own(group, colorKey)) {
      return 0;
    }

    group = group[colorKey];
  }

  if (sizes.length) {
    const sizeKey = option(selectedSize);

    if (
      !isObject(group) ||
      !own(group, sizeKey)
    ) {
      return 0;
    }

    return count(group[sizeKey]);
  }

  if (colors.length) {
    if (isObject(group)) {
      return own(group, "default")
        ? count(group.default)
        : 0;
    }

    return count(group);
  }

  return own(group, "default")
    ? count(group.default)
    : 0;
}

// ======================================================
// FIRST AVAILABLE OPTIONS
// ======================================================

export function firstOptions(product) {
  const colors = options(product?.colors);
  const sizes = options(product?.sizes);

  const colorOptions = colors.length
    ? colors
    : [null];

  const sizeOptions = sizes.length
    ? sizes
    : [null];

  for (const color of colorOptions) {
    for (const size of sizeOptions) {
      if (
        getVariantStock(product, size, color) > 0
      ) {
        return {
          selectedColor: color,
          selectedSize: size,
        };
      }
    }
  }

  // Returning an option does not mean it is in stock.
  // validateCartItem still checks availability.
  return {
    selectedColor: colors[0] ?? null,
    selectedSize: sizes[0] ?? null,
  };
}

// ======================================================
// CART ITEM KEY
// ======================================================

export function getCartItemKey(item) {
  return JSON.stringify([
    String(productId(item)),
    option(item?.selectedSize),
    option(item?.selectedColor),
  ]);
}

export function isSameCartItem(a, b) {
  return (
    getCartItemKey(a) === getCartItemKey(b)
  );
}

// ======================================================
// NORMALIZE CART ITEM
//
// Call validateCartItem before accepting a new item.
// Invalid quantities remain invalid instead of
// silently becoming a quantity of one.
// ======================================================

export function normalizeCartItem(
  product,
  quantity = 1,
  selectedSize = null,
  selectedColor = null,
) {
  const parsed = numeric(quantity);

  const size = options(product?.sizes).length
    ? option(selectedSize)
    : null;

  const color = options(product?.colors).length
    ? option(selectedColor)
    : null;

  const variantRows = Array.isArray(
    product?.variantSkus,
  )
    ? product.variantSkus
    : [];

  const variant = variantRows.find(
    (row) =>
      row &&
      option(row.size) === size &&
      option(row.color) === color,
  );

  const variantSku =
    typeof variant?.sku === "string"
      ? variant.sku.trim()
      : "";

  return {
    ...product,

    id: String(productId(product)),

    originalPrice: getOriginalPrice(product),

    price: getDiscountedPrice(product),

    quantity:
      Number.isSafeInteger(parsed) && parsed > 0
        ? parsed
        : 0,

    selectedSize: size,

    selectedColor: color,

    ...(variantSku
      ? { sku: variantSku }
      : {}),
  };
}

// ======================================================
// CART VALIDATION
// ======================================================

export function validateCartItem(
  product,
  quantity,
  size = null,
  color = null,
) {
  const stock = getVariantStock(
    product,
    size,
    color,
  );

  function fail(message) {
    return {
      valid: false,
      stock,
      message,
    };
  }

  if (
    !isObject(product) ||
    productId(product) === ""
  ) {
    return fail(
      "This product is no longer available.",
    );
  }

  if (product.isActive === false) {
    return fail(
      "This product is no longer available.",
    );
  }

  const qty = numeric(quantity);

  if (
    !Number.isSafeInteger(qty) ||
    qty < 1
  ) {
    return fail(
      "Choose a whole-number quantity of at least 1.",
    );
  }

  const sizes = options(product.sizes);
  const colors = options(product.colors);

  if (
    sizes.length &&
    !sizes.includes(option(size))
  ) {
    return fail(
      "Choose an available size.",
    );
  }

  if (
    colors.length &&
    !colors.includes(option(color))
  ) {
    return fail(
      "Choose an available colour.",
    );
  }

  if (
    !sizes.length &&
    option(size) !== null
  ) {
    return fail(
      "This size is no longer available. Remove the item and add it again.",
    );
  }

  if (
    !colors.length &&
    option(color) !== null
  ) {
    return fail(
      "This colour is no longer available. Remove the item and add it again.",
    );
  }

  const rawPrice = numeric(product.price);
  const sellingPrice = getDiscountedPrice(
    product,
  );

  if (
    rawPrice == null ||
    rawPrice < 0 ||
    !Number.isFinite(sellingPrice) ||
    sellingPrice < 0
  ) {
    return fail(
      "The price for this product is unavailable. Please contact support.",
    );
  }

  if (stock <= 0) {
    const subject =
      sizes.length && colors.length
        ? "size and colour combination"
        : sizes.length
          ? "size"
          : colors.length
            ? "colour"
            : "product";

    return fail(
      `This ${subject} is currently out of stock.`,
    );
  }

  if (qty > stock) {
    return fail(
      `Only ${stock} available for this selection.`,
    );
  }

  return {
    valid: true,
    stock,
    message: "",
  };
}

// ======================================================
// INVENTORY POOL
//
// Products without variant inventory share one stock
// quantity across every size and colour.
// ======================================================

function inventoryKey(product, size, color) {
  return JSON.stringify([
    String(productId(product)),

    hasVariants(product)
      ? [option(size), option(color)]
      : "shared-stock",
  ]);
}

// ======================================================
// REVALIDATE CART
// ======================================================

export function revalidateCart(cart, products) {
  const input = Array.isArray(cart)
    ? cart
    : [];

  // Missing catalogue data is not proof that products
  // have been removed. Call this after catalogue loading.
  if (!Array.isArray(products)) {
    return {
      cart: [...input],
      changes: [],
    };
  }

  const catalogue = new Map();

  for (const product of products) {
    if (!isObject(product)) {
      continue;
    }

    const ids = [
      product.id,
      product._id,
      product.legacyId,
    ];

    for (const id of ids) {
      if (
        ["string", "number"].includes(
          typeof id,
        ) &&
        String(id).trim()
      ) {
        catalogue.set(String(id), product);
      }
    }
  }

  const rows = new Map();
  const usedStock = new Map();
  const changes = [];

  function removed(item, reason) {
    changes.push({
      type: "removed",
      item,
      reason,
    });
  }

  for (const item of input) {
    if (!isObject(item)) {
      removed(item, "Invalid bag item.");
      continue;
    }

    const product = catalogue.get(
      String(productId(item)),
    );

    if (
      !product ||
      product.isActive === false
    ) {
      removed(
        item,
        "This product is no longer available.",
      );

      continue;
    }

    const qty = numeric(item.quantity);

    if (
      !Number.isSafeInteger(qty) ||
      qty < 1
    ) {
      removed(item, "Invalid quantity.");
      continue;
    }

    // Validate one unit first. A larger valid quantity
    // can then be reduced to current available stock.
    const check = validateCartItem(
      product,
      1,
      item.selectedSize,
      item.selectedColor,
    );

    if (!check.valid) {
      removed(item, check.message);
      continue;
    }

    const normalized = normalizeCartItem(
      product,
      qty,
      item.selectedSize,
      item.selectedColor,
    );

    // Use the current canonical product ID so legacy
    // and database references merge into the same row.
    const key = getCartItemKey(normalized);
    const previous = rows.get(key);

    const poolKey = inventoryKey(
      product,
      normalized.selectedSize,
      normalized.selectedColor,
    );

    const alreadyUsed =
      usedStock.get(poolKey) || 0;

    const remainingStock = Math.max(
      0,
      check.stock - alreadyUsed,
    );

    const accepted = Math.min(
      qty,
      remainingStock,
    );

    if (accepted <= 0) {
      removed(
        item,
        "The available stock is already included in another bag item.",
      );

      continue;
    }

    const combinedQuantity =
      (previous?.quantity || 0) + accepted;

    rows.set(key, {
      ...normalized,
      quantity: combinedQuantity,
    });

    usedStock.set(
      poolKey,
      alreadyUsed + accepted,
    );

    const reasons = [];

    if (previous) {
      reasons.push(
        "Matching bag items were combined.",
      );
    }

    if (accepted < qty) {
      reasons.push(
        "Quantity was reduced to available stock.",
      );
    }

    if (
      numeric(item.price) !== normalized.price
    ) {
      reasons.push(
        "The product price was updated.",
      );
    }

    if (
      String(productId(item)) !== normalized.id
    ) {
      reasons.push(
        "The product reference was updated.",
      );
    }

    if (reasons.length) {
      changes.push({
        type: "updated",
        item,
        reason: reasons.join(" "),
      });
    }
  }

  return {
    cart: [...rows.values()],
    changes,
  };
}