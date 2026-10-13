import { getDiscountedPrice } from "./productPricing.js";
import { getVariantStock } from "./cartUtils.js";

export const productId = (value) =>
  String(value?.id || value?._id || "");

export function defaultKitSelections(kit) {
  return kit.slots.map((slot) => ({
    slotKey: slot.key,
    included: slot.defaultIncluded === true,
    productId: slot.defaultProduct || "",
    selectedSize: slot.defaultSize ?? null,
    selectedColor: slot.defaultColor ?? null,
    quantity: slot.defaultQuantity,
  }));
}

export function restoreKitSelections(kit, saved) {
  const valid =
    saved &&
    Array.isArray(saved.selections) &&
    saved.selections.length <= 20 &&
    saved.selections.every(
      (row) =>
        row &&
        typeof row.slotKey === "string" &&
        typeof row.included === "boolean" &&
        typeof row.productId === "string" &&
        Number.isSafeInteger(row.quantity) &&
        row.quantity > 0 &&
        [row.selectedSize, row.selectedColor].every(
          (value) =>
            value == null ||
            typeof value === "string",
        ),
    ) &&
    new Set(
      saved.selections.map((row) => row.slotKey),
    ).size === saved.selections.length;

  if (!valid) {
    return {
      selections: defaultKitSelections(kit),
      restored: false,
      changed: false,
    };
  }

  const restored = saved.selections.map((row) => ({
    slotKey: row.slotKey,
    included: row.included,
    productId: row.productId,
    selectedSize: row.selectedSize ?? null,
    selectedColor: row.selectedColor ?? null,
    quantity: row.quantity,
  }));

  const keys = new Set(
    restored.map((row) => row.slotKey),
  );

  return {
    selections: [
      ...restored,
      ...defaultKitSelections(kit).filter(
        (row) => !keys.has(row.slotKey),
      ),
    ],
    restored: true,
    changed: saved.version !== kit.version,
  };
}

export function inspectKitSelections(
  kit,
  products,
  selections,
) {
  const catalog = new Map(
    products.map((product) => [
      productId(product),
      product,
    ]),
  );

  const slots = new Map(
    kit.slots.map((slot) => [slot.key, slot]),
  );

  const stockUsed = new Map();
  const errors = [];
  const rows = [];
  const payload = [];

  let subtotal = 0;

  for (const row of selections) {
    if (!row.included) continue;

    const slot = slots.get(row.slotKey);
    const product = catalog.get(row.productId);

    if (!slot) {
      errors.push(
        "A saved section no longer belongs to this kit. Reset to the suggested kit to review the updated template.",
      );
      continue;
    }

    const label = slot.label || slot.key;

    if (
      !product ||
      !slot.allowedProducts.includes(row.productId)
    ) {
      errors.push(
        `${label}: choose an available product.`,
      );
      continue;
    }

    const unitPrice = getDiscountedPrice(product);

    if (
      typeof product.price !== "number" ||
      !Number.isFinite(product.price) ||
      product.price < 0 ||
      typeof product.discount !== "number" ||
      !Number.isFinite(product.discount) ||
      product.discount < 0 ||
      product.discount > 100
    ) {
      errors.push(
        `${label}: pricing is unavailable.`,
      );
      continue;
    }

    rows.push({
      ...row,
      label,
      name: product.name,
      unitPrice,
      linePrice: unitPrice * row.quantity,
    });

    subtotal += unitPrice * row.quantity;

    if (
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > slot.maximumQuantity
    ) {
      errors.push(
        `${label}: quantity must be between 1 and ${slot.maximumQuantity}.`,
      );
    }

    if (product.deliveryAvailable !== true) {
      errors.push(
        `${label}: delivery is currently unavailable.`,
      );
    }

    for (const [axis, key] of [
      ["sizes", "selectedSize"],
      ["colors", "selectedColor"],
    ]) {
      const options = product[axis] || [];

      const invalid = options.length
        ? !options.includes(row[key])
        : row[key] != null;

      if (invalid) {
        const optionLabel = axis === "sizes"
          ? product.optionLabels?.size || "size"
          : product.optionLabels?.color || "colour";

        errors.push(
          `${label}: choose a valid ${optionLabel}.`,
        );
      }
    }

    const key = JSON.stringify([
      row.productId,
      row.selectedSize,
      row.selectedColor,
    ]);

    const used =
      (stockUsed.get(key) || 0) +
      row.quantity;

    stockUsed.set(key, used);

    const available = getVariantStock(
      product,
      row.selectedSize,
      row.selectedColor,
    );

    if (used > available) {
      errors.push(
        `${label}: only ${available} available for this selection across the kit.`,
      );
    }

    payload.push({
      slotKey: row.slotKey,
      productId: row.productId,
      selectedSize: row.selectedSize,
      selectedColor: row.selectedColor,
      quantity: row.quantity,
    });
  }

  if (!payload.length) {
    errors.push(
      "Choose at least one complete kit item.",
    );
  }

  return {
    errors: [...new Set(errors)],
    rows,
    selections: payload,
    subtotal,
  };
}