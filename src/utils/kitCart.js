import {
  getCartItemKey,
  getKitGroup,
  getVariantStock,
  normalizeCartItem,
} from "./cartUtils.js";

import {
  inspectKitSelections,
  productId,
} from "./kitBuilder.js";

export function kitGroupSignature(rows, groupId) {
  return JSON.stringify(
    rows
      .filter((row) => getKitGroup(row)?.id === groupId)
      .map((row) => [
        getCartItemKey(row),
        row.quantity,
        row.price,
        getKitGroup(row)?.version,
      ])
      .sort((a, b) =>
        String(a[0]).localeCompare(String(b[0])),
      ),
  );
}

export function prepareKitCart({
  cart,
  kit,
  products,
  selections,
  quote,
  groupId,
  replacing = false,
}) {
  if (!Array.isArray(cart) || !Array.isArray(products)) {
    throw new Error(
      "Your bag or kit products could not be read.",
    );
  }

  const checked = inspectKitSelections(
    kit,
    products,
    selections,
  );

  if (checked.errors.length) {
    throw new Error(checked.errors.join(" "));
  }

  if (
    quote?.kitId !== kit.id ||
    quote.templateVersion !== kit.version ||
    quote.purchaseEnabled !== false ||
    quote.inventoryReserved !== false ||
    !Array.isArray(quote.items) ||
    quote.items.length !== checked.selections.length
  ) {
    throw new Error(
      "A fresh kit estimate is required before saving.",
    );
  }

  const existing = cart.filter(
    (row) => getKitGroup(row)?.id === groupId,
  );

  const invalidGroup = replacing
    ? !existing.length ||
      existing.some(
        (row) => getKitGroup(row)?.kitId !== kit.id,
      )
    : existing.length > 0;

  if (invalidGroup) {
    throw new Error(
      "The kit in your bag changed. Return to your bag and reopen it.",
    );
  }

  const remaining = replacing
    ? cart.filter(
        (row) => getKitGroup(row)?.id !== groupId,
      )
    : [...cart];

  const newRows = checked.selections.map((selection) => {
    const product = products.find(
      (value) => productId(value) === selection.productId,
    );

    const quoted = quote.items.find(
      (item) => item.slotKey === selection.slotKey,
    );

    const inspected = checked.rows.find(
      (row) => row.slotKey === selection.slotKey,
    );

    if (
      !quoted ||
      quoted.productId !== selection.productId ||
      quoted.quantity !== selection.quantity ||
      (quoted.selectedSize ?? null) !==
        selection.selectedSize ||
      (quoted.selectedColor ?? null) !==
        selection.selectedColor ||
      quoted.unitPrice !== inspected?.unitPrice
    ) {
      throw new Error(
        "Kit products or prices changed. Refresh the estimate before saving.",
      );
    }

    const metadata = {
      id: groupId,
      kitId: kit.id,
      version: kit.version,
      name: kit.name,
      level: kit.level,
      slotKey: selection.slotKey,
      checkoutReady: false,
      reviewReasons: [],
    };

    if (!getKitGroup({ kitGroup: metadata })) {
      throw new Error(
        "This kit's grouping information is incomplete.",
      );
    }

    return normalizeCartItem(
      product,
      selection.quantity,
      selection.selectedSize,
      selection.selectedColor,
      metadata,
    );
  });

  // Kits and individual products share underlying stock.
  const selectedProducts = new Map(
    newRows.map((row) => [
      productId(row),
      products.find(
        (product) =>
          productId(product) === productId(row),
      ),
    ]),
  );

  const totals = new Map();

  for (const row of [...remaining, ...newRows]) {
    const product = [...selectedProducts.values()].find(
      (value) =>
        [value.id, value._id, value.legacyId]
          .filter((id) => id != null)
          .map(String)
          .some((id) =>
            [row.id, row._id, row.legacyId]
              .filter((reference) => reference != null)
              .map(String)
              .includes(id),
          ),
    );

    if (!product) continue;

    const quantity = Number(row.quantity);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      throw new Error(
        "Correct the quantities of matching products already in your bag.",
      );
    }

    const stock = getVariantStock(
      product,
      row.selectedSize,
      row.selectedColor,
    );

    const variantInventory =
      product.variants &&
      typeof product.variants === "object" &&
      !Array.isArray(product.variants) &&
      Object.keys(product.variants).length > 0;

    const key = JSON.stringify([
      productId(product),
      variantInventory
        ? [
            row.selectedSize ?? null,
            row.selectedColor ?? null,
          ]
        : "shared",
    ]);

    const total =
      (totals.get(key) || 0) + quantity;

    if (
      !Number.isSafeInteger(total) ||
      total > stock
    ) {
      throw new Error(
        `${product.name}: only ${stock} available for this stock selection across your bag and kits.`,
      );
    }

    totals.set(key, total);
  }

  if (!replacing) {
    return {
      cart: [...remaining, ...newRows],
      rows: newRows,
    };
  }

  // Replace the complete kit while preserving its position.
  const next = [];
  let inserted = false;

  for (const row of cart) {
    if (getKitGroup(row)?.id === groupId) {
      if (!inserted) {
        next.push(...newRows);
        inserted = true;
      }
    } else {
      next.push(row);
    }
  }

  return {
    cart: next,
    rows: newRows,
  };
}