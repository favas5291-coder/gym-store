import {
  getCartItemKey,
  getKitGroup,
} from "./cartUtils.js";

export function containsKit(rows = []) {
  return rows.some(
    (row) =>
      row &&
      Object.hasOwn(row, "kitGroup"),
  );
}

// Preserve kit grouping during payment recovery and cart cleanup.
// Client prices and purchased snapshots are never sent as selections.
export function checkoutSelectionRows(rows) {
  return rows.map((row) => {
    const result = {
      id: String(row.id),
      quantity: Number(row.quantity),
      selectedSize: row.selectedSize ?? null,
      selectedColor: row.selectedColor ?? null,
    };

    if (Object.hasOwn(row, "kitGroup")) {
      const group = getKitGroup(row);

      if (!group) {
        throw new Error(
          "Reopen the kit builder to correct this kit grouping.",
        );
      }

      const {
        id,
        kitId,
        version,
        name,
        level,
        slotKey,
      } = group;

      result.kitGroup = {
        id,
        kitId,
        version,
        name,
        level,
        slotKey,
      };
    }

    return result;
  });
}

export function kitSelectionIssue(
  selected,
  cart,
  mode,
) {
  if (!containsKit(selected)) {
    return "";
  }

  if (mode === "buy-now") {
    return "Buy complete kits from your bag.";
  }

  const keys = new Set(
    selected.map(getCartItemKey),
  );

  const groups = new Set();

  for (const row of selected) {
    if (!Object.hasOwn(row, "kitGroup")) {
      continue;
    }

    const group = getKitGroup(row);

    if (!group) {
      return "Reopen the kit builder to correct this kit grouping.";
    }

    groups.add(group.id);
  }

  const incomplete = cart.some(
    (row) =>
      groups.has(getKitGroup(row)?.id) &&
      !keys.has(getCartItemKey(row)),
  );

  if (incomplete) {
    return (
      "Select the complete kit. " +
      "Use Edit kit in your bag to remove or replace components."
    );
  }

  return "";
}

export function kitQuoteSignature(
  rows,
  coupon,
  method,
  paymentMethod,
  pincode,
) {
  return JSON.stringify({
    items: checkoutSelectionRows(rows),
    prices: rows.map((row) => row.price),
    coupon:
      typeof coupon === "string"
        ? coupon
        : coupon?.code || "",
    method,
    paymentMethod,
    pincode: String(pincode).trim(),
  });
}

export function kitQuotePayable(
  quote,
  now = Date.now(),
) {
  return Boolean(
    quote?.purchaseEnabled === true &&
      quote.shippingIsEstimate === false &&
      quote.shippingReview?.ready === true &&
      /^[a-f0-9]{64}$/.test(
        quote.reviewKey || "",
      ) &&
      Date.parse(
        quote.shippingReview.validUntil,
      ) > now,
  );
}