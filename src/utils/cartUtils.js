import {
  productImageSources,
} from "./productImages.js";

import {
  getDiscountedPrice,
  getOriginalPrice,
} from "./productPricing.js";

export {
  getDiscountedPrice,
} from "./productPricing.js";

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
    !["number", "string"].includes(
      typeof value,
    )
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
      (
        Array.isArray(values)
          ? values
          : []
      )
        .filter((value) =>
          ["string", "number"].includes(
            typeof value,
          ),
        )
        .map(String)
        .filter(
          (value) => value.trim(),
        ),
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

function validSelection(
  product,
  size,
  color,
) {
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

export function getTotalStock(product) {
  if (unavailable(product)) {
    return 0;
  }

  if (!hasVariants(product)) {
    return count(product.stock);
  }

  const sizes = options(product.sizes);
  const colors = options(product.colors);

  let total = 0;

  for (
    const color of
    colors.length ? colors : [null]
  ) {
    for (
      const size of
      sizes.length ? sizes : [null]
    ) {
      total = Math.min(
        Number.MAX_SAFE_INTEGER,
        total +
          getVariantStock(
            product,
            size,
            color,
          ),
      );
    }
  }

  return total;
}

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

export function firstOptions(product) {
  const colors = options(product?.colors);
  const sizes = options(product?.sizes);

  for (
    const color of
    colors.length ? colors : [null]
  ) {
    for (
      const size of
      sizes.length ? sizes : [null]
    ) {
      if (
        getVariantStock(
          product,
          size,
          color,
        ) > 0
      ) {
        return {
          selectedColor: color,
          selectedSize: size,
        };
      }
    }
  }

  return {
    selectedColor: colors[0] ?? null,
    selectedSize: sizes[0] ?? null,
  };
}

export function getKitGroup(item) {
  const group = item?.kitGroup;

  if (
    !isObject(group) ||
    typeof group.id !== "string" ||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(
      group.id,
    ) ||
    typeof group.kitId !== "string" ||
    !/^[a-f0-9]{24}$/i.test(
      group.kitId,
    ) ||
    !Number.isSafeInteger(group.version) ||
    group.version < 0 ||
    typeof group.name !== "string" ||
    group.name.length < 2 ||
    group.name.length > 200 ||
    ![
      "beginner",
      "intermediate",
      "advanced",
    ].includes(group.level) ||
    typeof group.slotKey !== "string" ||
    !/^[a-z][a-z0-9-]{0,59}$/.test(
      group.slotKey,
    )
  ) {
    return null;
  }

  return {
    id: group.id,
    kitId: group.kitId.toLowerCase(),
    version: group.version,
    name: group.name,
    level: group.level,
    slotKey: group.slotKey,

    // Checkout requires a fresh server review.
    checkoutReady: false,

    reviewReasons: Array.isArray(
      group.reviewReasons,
    )
      ? group.reviewReasons
          .filter(
            (value) =>
              typeof value === "string",
          )
          .slice(0, 20)
      : [],
  };
}

export function getCartItemKey(item) {
  const key = [
    String(productId(item)),
    option(item?.selectedSize),
    option(item?.selectedColor),
  ];

  if (own(item, "kitGroup")) {
    const group = getKitGroup(item);

    key.push(
      group ? "kit" : "invalid-kit",
      group?.id || "",
      group?.slotKey || "",
    );
  }

  return JSON.stringify(key);
}

export function isSameCartItem(a, b) {
  return (
    getCartItemKey(a) ===
    getCartItemKey(b)
  );
}

export function groupCartItems(cart) {
  const result = [];
  const kits = new Map();

  for (
    const item of
    Array.isArray(cart) ? cart : []
  ) {
    const group = getKitGroup(item);

    if (!group) {
      result.push({
        type: "product",
        key: getCartItemKey(item),
        item,
      });

      continue;
    }

    if (!kits.has(group.id)) {
      const value = {
        type: "kit",
        id: group.id,
        kitId: group.kitId,
        version: group.version,
        name: group.name,
        level: group.level,
        items: [],
        checkoutReady: false,
        reviewReasons: [],
      };

      kits.set(group.id, value);
      result.push(value);
    }

    const kit = kits.get(group.id);

    kit.items.push(item);

    kit.reviewReasons = [
      ...new Set([
        ...kit.reviewReasons,
        ...group.reviewReasons,
      ]),
    ];
  }

  return result;
}

export function normalizeCartItem(
  product,
  quantity = 1,
  selectedSize = null,
  selectedColor = null,
  kitGroup = null,
) {
  const parsed = numeric(quantity);

  const size = options(
    product?.sizes,
  ).length
    ? option(selectedSize)
    : null;

  const color = options(
    product?.colors,
  ).length
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

  // Group information is passed explicitly.
  const {
    kitGroup: ignoredGroup,
    ...cleanProduct
  } = product || {};

  const group = getKitGroup({
    kitGroup,
  });

  return {
    ...cleanProduct,

    ...(group
      ? { kitGroup: group }
      : {}),

    id: String(productId(product)),

    image:
      productImageSources(
        product,
        color,
      )[0] || "",

    images: productImageSources(
      product,
      color,
    ),

    originalPrice:
      getOriginalPrice(product),

    price:
      getDiscountedPrice(product),

    quantity:
      Number.isSafeInteger(parsed) &&
      parsed > 0
        ? parsed
        : 0,

    selectedSize: size,
    selectedColor: color,

    ...(variantSku
      ? { sku: variantSku }
      : {}),
  };
}

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

  const fail = (message) => ({
    valid: false,
    stock,
    message,
  });

  if (
    !isObject(product) ||
    productId(product) === "" ||
    product.isActive === false
  ) {
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

  const rawPrice = numeric(
    product.price,
  );

  const sellingPrice =
    getDiscountedPrice(product);

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

function inventoryKey(
  product,
  size,
  color,
) {
  return JSON.stringify([
    String(productId(product)),

    hasVariants(product)
      ? [
          option(size),
          option(color),
        ]
      : "shared-stock",
  ]);
}

export function revalidateCart(
  cart,
  products,
) {
  const input = Array.isArray(cart)
    ? cart
    : [];

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

    for (const id of [
      product.id,
      product._id,
      product.legacyId,
    ]) {
      if (
        ["string", "number"].includes(
          typeof id,
        ) &&
        String(id).trim()
      ) {
        catalogue.set(
          String(id),
          product,
        );
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

  const ordinaryItems = input.filter(
    (row) =>
      !isObject(row) ||
      !own(row, "kitGroup"),
  );

  for (const item of ordinaryItems) {
    if (!isObject(item)) {
      removed(
        item,
        "Invalid bag item.",
      );

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
      removed(
        item,
        "Invalid quantity.",
      );

      continue;
    }

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

    const key = getCartItemKey(
      normalized,
    );

    const previous = rows.get(key);

    const pool = inventoryKey(
      product,
      normalized.selectedSize,
      normalized.selectedColor,
    );

    const used =
      usedStock.get(pool) || 0;

    const accepted = Math.min(
      qty,
      Math.max(
        0,
        check.stock - used,
      ),
    );

    if (accepted <= 0) {
      removed(
        item,
        "The available stock is already included in another bag item.",
      );

      continue;
    }

    rows.set(key, {
      ...normalized,

      quantity:
        (previous?.quantity || 0) +
        accepted,
    });

    usedStock.set(
      pool,
      used + accepted,
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
      numeric(item.price) !==
      normalized.price
    ) {
      reasons.push(
        "The product price was updated.",
      );
    }

    if (
      String(productId(item)) !==
      normalized.id
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

  const kitRows = new Map();

  const kitItems = input.filter(
    (row) =>
      isObject(row) &&
      own(row, "kitGroup"),
  );

  for (const item of kitItems) {
    const group = getKitGroup(item);

    if (!group) {
      removed(
        item,
        "Invalid Fitness Kit group information. Rebuild this kit.",
      );

      continue;
    }

    if (!kitRows.has(group.id)) {
      kitRows.set(group.id, []);
    }

    kitRows.get(group.id).push({
      item,
      group,
    });
  }

  for (
    const entries of kitRows.values()
  ) {
    const reasons = new Set(
      entries.flatMap(
        (entry) =>
          entry.group.reviewReasons,
      ),
    );

    const first = entries[0].group;
    const seen = new Set();

    const proposedStock = new Map(
      usedStock,
    );

    const components = [];

    for (
      const { item, group } of entries
    ) {
      if (seen.has(group.slotKey)) {
        reasons.add(
          "This kit has duplicate sections. Edit the complete kit.",
        );
      }

      seen.add(group.slotKey);

      if (
        group.kitId !== first.kitId ||
        group.version !== first.version ||
        group.name !== first.name ||
        group.level !== first.level
      ) {
        reasons.add(
          "Kit group information changed. Edit the complete kit.",
        );
      }

      const product = catalogue.get(
        String(productId(item)),
      );

      const check = validateCartItem(
        product,
        item.quantity,
        item.selectedSize,
        item.selectedColor,
      );

      if (!check.valid) {
        reasons.add(check.message);

        // Preserve the customer's selected component
        // and quantity until the complete kit is edited.
        components.push({
          ...item,
          kitGroup: group,
        });

        continue;
      }

      const normalized = normalizeCartItem(
        product,
        item.quantity,
        item.selectedSize,
        item.selectedColor,
        group,
      );

      const pool = inventoryKey(
        product,
        normalized.selectedSize,
        normalized.selectedColor,
      );

      const total =
        (proposedStock.get(pool) || 0) +
        normalized.quantity;

      proposedStock.set(
        pool,
        total,
      );

      if (total > check.stock) {
        reasons.add(
          "Kit items share stock with other bag items. Edit the complete kit quantities.",
        );
      }

      if (
        numeric(item.price) !==
        normalized.price
      ) {
        reasons.add(
          "A kit product price changed. Refresh the complete kit estimate.",
        );
      }

      components.push(normalized);
    }

    if (seen.size !== entries.length) {
      for (const { item } of entries) {
        removed(
          item,
          "This Fitness Kit has duplicate sections. Rebuild the complete kit.",
        );
      }

      continue;
    }

    if (!reasons.size) {
      for (
        const [key, value] of proposedStock
      ) {
        usedStock.set(key, value);
      }
    }

    for (const component of components) {
      const next = {
        ...component,

        kitGroup: {
          ...component.kitGroup,
          checkoutReady: false,
          reviewReasons: [...reasons],
        },
      };

      rows.set(
        getCartItemKey(next),
        next,
      );

      if (
        JSON.stringify(next.kitGroup) !==
        JSON.stringify(component.kitGroup)
      ) {
        changes.push({
          type: "updated",
          item: component,

          reason:
            "Fitness Kit needs review. Its component quantities were preserved.",
        });
      }
    }
  }

  return {
    cart: [...rows.values()],
    changes,
  };
}