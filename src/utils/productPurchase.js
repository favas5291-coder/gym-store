import {
  getVariantStock,
  getDiscountedPrice,
} from "./cartUtils.js";

import { optionLabels } from "./productInformation.js";

// Matches the current checkout backend.
export const MAX_PURCHASE_QUANTITY = 99;

export function purchaseOptions(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) =>
          ["string", "number"].includes(typeof value),
        )
        .filter(
          (value) =>
            typeof value !== "number" ||
            Number.isFinite(value),
        )
        .map(String)
        .filter((value) => value.trim()),
    ),
  ];
}

function numeric(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function productPriceAvailable(product) {
  const price = numeric(product?.price);

  const discount =
    product?.discount == null
      ? 0
      : numeric(product.discount);

  return (
    price != null &&
    price >= 0 &&
    discount != null &&
    discount >= 0 &&
    discount <= 100
  );
}

export function productReference(product) {
  return (
    [
      product?.id,
      product?._id,
      product?.legacyId,
    ].find(
      (value) =>
        ["string", "number"].includes(typeof value) &&
        String(value).trim(),
    ) ?? ""
  );
}

export function purchaseState(
  product,
  size,
  color,
  quantity,
  ready = true,
) {
  const labels = optionLabels(product);
  const sizes = purchaseOptions(product?.sizes);
  const colors = purchaseOptions(product?.colors);

  const stock = getVariantStock(
    product,
    size,
    color,
  );

  const qty = numeric(quantity);

  const quantityValid =
    Number.isSafeInteger(qty) && qty >= 1;

  const priceAvailable =
    productPriceAvailable(product);

  let message = "";

  if (!ready) {
    message =
      "Wait for the latest product information before buying. If loading fails, retry the catalogue.";
  } else if (
    !product ||
    !String(productReference(product)) ||
    product.isActive === false
  ) {
    message = "This product is no longer available.";
  } else if (product.delivery?.available === false) {
    message =
      "This product is currently unavailable for delivery. Contact support for help.";
  } else if (!priceAvailable) {
    message =
      "The price is unavailable. Contact support before buying.";
  } else if (
    sizes.length &&
    !sizes.includes(size == null ? "" : String(size))
  ) {
    message =
      `Choose an available ${labels.size.toLowerCase()}. ` +
      "Your previous selection may have changed.";
  } else if (
    colors.length &&
    !colors.includes(color == null ? "" : String(color))
  ) {
    message =
      `Choose an available ${labels.color.toLowerCase()}. ` +
      "Your previous selection may have changed.";
  } else if (
    (!sizes.length && size != null && size !== "") ||
    (!colors.length && color != null && color !== "")
  ) {
    message =
      "These options are no longer listed. Reopen the product to choose its current options.";
  } else if (stock <= 0) {
    message =
      "This product selection is out of stock. Choose another available option or watch availability.";
  } else if (!quantityValid) {
    message =
      "Enter a whole-number quantity of at least 1.";
  } else if (qty > stock) {
    message =
      `Only ${stock} available for this selection. ` +
      "Reduce your quantity.";
  } else if (qty > MAX_PURCHASE_QUANTITY) {
    message =
      `Choose no more than ${MAX_PURCHASE_QUANTITY} ` +
      "units of this selection per order.";
  }

  return {
    canBuy: !message,
    message,
    stock,
    quantity: qty,
    quantityValid,
    priceAvailable,
  };
}

export function purchaseKey(
  product,
  size,
  color,
  quantity,
  shopper = "",
) {
  return JSON.stringify([
    shopper,
    String(productReference(product)),
    size ?? null,
    color ?? null,
    quantity,
    productPriceAvailable(product)
      ? getDiscountedPrice(product)
      : null,
  ]);
}

export function latestPurchaseProduct(products, product) {
  const reference = String(productReference(product));

  return (
    Array.isArray(products) ? products : []
  ).find((candidate) =>
    [
      candidate?.id,
      candidate?._id,
      candidate?.legacyId,
    ].some(
      (value) =>
        value != null &&
        String(value) === reference,
    ),
  );
}

export function bagQuantityMessage(
  cart,
  product,
  size,
  color,
  quantity,
) {
  const reference = String(productReference(product));

  const existing = (
    Array.isArray(cart) ? cart : []
  ).reduce((sum, row) => {
    if (
      !row ||
      String(productReference(row)) !== reference ||
      String(row.selectedSize ?? "") !== String(size ?? "") ||
      String(row.selectedColor ?? "") !== String(color ?? "")
    ) {
      return sum;
    }

    const qty = numeric(row.quantity);

    return Number.isSafeInteger(qty) && qty > 0
      ? sum + qty
      : sum;
  }, 0);

  return existing + quantity > MAX_PURCHASE_QUANTITY
    ? `Your bag would exceed ${MAX_PURCHASE_QUANTITY} units of this selection. Review its quantity in your bag.`
    : "";
}