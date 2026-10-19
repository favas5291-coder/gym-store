import {
  getCartItemKey,
  getKitGroup,
} from "./cartUtils.js";

import {
  getDiscountedPrice,
  getOriginalPrice,
} from "./productPricing.js";

import {
  optionLabels,
} from "./productInformation.js";

import {
  MAX_PURCHASE_QUANTITY,
  latestPurchaseProduct,
  productPriceAvailable,
  productReference,
  purchaseOptions,
  purchaseState,
} from "./productPurchase.js";

function amount(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

export function reviewCart(
  cart,
  products,
  ready,
  { allowKitReview = false } = {},
) {
  const input = Array.isArray(cart) ? cart : [];

  const rows = input.map((item, index) => {
    const product = latestPurchaseProduct(
      products,
      item,
    );

    const key = getCartItemKey(item);
    const quantity = amount(item?.quantity);

    const quantityValid =
      Number.isSafeInteger(quantity) &&
      quantity >= 1;

    const currentPriceKnown =
      productPriceAvailable(product);

    const cachedPrice = amount(item?.price);

    const unitPrice =
      ready && product
        ? currentPriceKnown
          ? getDiscountedPrice(product)
          : null
        : cachedPrice;

    const originalUnit =
      ready && product && currentPriceKnown
        ? Math.max(
            unitPrice,
            getOriginalPrice(product),
          )
        : unitPrice;

    const lineTotal =
      quantityValid && unitPrice != null
        ? quantity * unitPrice
        : null;

    const lineOriginal =
      quantityValid && originalUnit != null
        ? quantity * originalUnit
        : null;

    const priceSafe =
      unitPrice != null &&
      Number.isSafeInteger(
        Math.round(unitPrice * 100),
      ) &&
      Number.isSafeInteger(
        Math.round(originalUnit * 100),
      );

    const lineSafe =
      quantityValid &&
      priceSafe &&
      Number.isSafeInteger(
        Math.round(lineTotal * 100),
      ) &&
      Number.isSafeInteger(
        Math.round(lineOriginal * 100),
      );

    const state = purchaseState(
      product,
      item?.selectedSize,
      item?.selectedColor,
      quantity,
      ready,
    );

    const base = purchaseState(
      product,
      item?.selectedSize,
      item?.selectedColor,
      1,
      ready,
    );

    const variantInventory =
      product?.variants &&
      typeof product.variants === "object" &&
      !Array.isArray(product.variants) &&
      Object.keys(product.variants).length > 0;

    const pool = JSON.stringify([
      String(
        productReference(product) ||
          productReference(item),
      ),

      variantInventory
        ? [
            item?.selectedSize ?? null,
            item?.selectedColor ?? null,
          ]
        : "shared",
    ]);

    return {
      ...item,
      key,
      index,
      product,
      quantity,
      quantityValid,
      unitPrice,
      lineTotal,
      lineOriginal,
      priceSafe,
      lineSafe,
      pool,
      state,
      base,

      labels: optionLabels(product || item),

      priceCurrent:
        ready &&
        currentPriceKnown &&
        cachedPrice === unitPrice,

      hasOptions:
        purchaseOptions(product?.sizes).length > 0 ||
        purchaseOptions(product?.colors).length > 0,
    };
  });

  const pools = new Map();
  const keys = new Map();

  for (const row of rows) {
    pools.set(
      row.pool,
      (pools.get(row.pool) || 0) +
        (row.quantityValid ? row.quantity : 0),
    );

    keys.set(
      row.key,
      (keys.get(row.key) || 0) + 1,
    );
  }

  for (const row of rows) {
    const total = pools.get(row.pool);

    const otherQuantity =
      total - (row.quantityValid ? row.quantity : 0);

    row.stock = row.state.stock;

    row.stockRemaining = Math.max(
      0,
      row.stock - otherQuantity,
    );

    row.maxQuantity = Math.max(
      0,
      Math.min(
        MAX_PURCHASE_QUANTITY,
        row.stock - otherQuantity,
      ),
    );

    row.message = row.state.message;

    if (
      !row.message &&
      (!row.priceSafe || !row.lineSafe)
    ) {
      row.message =
        "This item has an unsupported price or total. Review its quantity or contact support before checkout.";
    }

    if (
      !row.message &&
      keys.get(row.key) > 1
    ) {
      row.message =
        "Matching bag rows need to be combined. Refresh products and review your bag.";
    }

    if (
      !row.message &&
      !row.priceCurrent
    ) {
      row.message =
        "The price changed. Refresh products and review the updated bag before checkout.";
    }

    if (
      !row.message &&
      (
        !Number.isSafeInteger(total) ||
        total > row.stock
      )
    ) {
      row.message =
        "These options share stock with other items in your bag. Reduce quantities before checkout.";
    }

    const kitComponent =
      Object.prototype.hasOwnProperty.call(
        row,
        "kitGroup",
      );

    if (
      kitComponent &&
      !getKitGroup(row)
    ) {
      row.message =
        "This kit grouping is invalid. Reopen the kit builder before checkout.";
    } else if (
      kitComponent &&
      !allowKitReview
    ) {
      row.message =
        "Continue to checkout to review the complete kit's current prices and delivery.";
    }

    row.available =
      ready && !row.message;

    row.canAdjust =
      !kitComponent &&
      ready &&
      row.base.canBuy &&
      row.priceSafe &&
      row.priceCurrent &&
      keys.get(row.key) === 1 &&
      row.maxQuantity > 0;

    row.lineSavings = row.lineSafe
      ? Math.max(
          0,
          row.lineOriginal - row.lineTotal,
        )
      : 0;
  }

  const itemCount = rows.reduce(
    (sum, row) =>
      sum + (
        row.quantityValid
          ? row.quantity
          : 0
      ),
    0,
  );

  const subtotal = rows.reduce(
    (sum, row) =>
      sum + (row.lineTotal ?? 0),
    0,
  );

  const originalTotal = rows.reduce(
    (sum, row) =>
      sum + (row.lineOriginal ?? 0),
    0,
  );

  const totalsKnown =
    rows.every((row) => row.lineSafe) &&
    Number.isSafeInteger(itemCount) &&
    Number.isSafeInteger(
      Math.round(subtotal * 100),
    ) &&
    Number.isSafeInteger(
      Math.round(originalTotal * 100),
    );

  return {
    rows,
    itemCount,
    totalsKnown,

    productSavings: totalsKnown
      ? Math.max(
          0,
          originalTotal - subtotal,
        )
      : 0,

    originalTotal: totalsKnown
      ? originalTotal
      : null,

    pricingRows: totalsKnown
      ? rows.map((row) => ({
          ...row,

          price: row.unitPrice,

          originalPrice:
            row.unitPrice +
            row.lineSavings / row.quantity,
        }))
      : [],

    canCheckout:
      ready &&
      rows.length > 0 &&
      totalsKnown &&
      rows.every((row) => row.available),
  };
}