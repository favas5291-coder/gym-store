import {
  getCartItemKey,
  normalizeCartItem,
} from "./cartUtils.js";

import { reviewCart } from "./cartReview.js";
import { purchaseState } from "./productPurchase.js";

import {
  findReturnProduct,
  orderOwnedBy,
} from "./customerReturns.js";

export function recordedAmount(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return null;
  }

  const amount = Number(value);
  const cents = Math.round(amount * 100);

  return (
    Number.isFinite(amount) &&
    amount >= 0 &&
    Number.isSafeInteger(cents) &&
    Math.abs(amount * 100 - cents) < 0.000001
  )
    ? cents / 100
    : null;
}

export function purchasedOptions(size, color) {
  return (
    [color, size]
      .filter(
        (value) =>
          ["string", "number"].includes(typeof value) &&
          String(value).trim(),
      )
      .map(String)
      .join(" / ") || "Default variant"
  );
}

export function cancellationAvailability(order) {
  if (
    !order ||
    !["confirmed", "processing"].includes(order.status) ||
    order.cancellation?.status === "cancelled"
  ) {
    return {
      eligible: false,
      message:
        "Cancellation is available only before dispatch, while an order is confirmed or processing.",
    };
  }

  if (
    !["not-requested", "not-applicable"].includes(
      order.refund?.status || "not-requested",
    )
  ) {
    return {
      eligible: false,
      message:
        "A refund is already under management. Contact support before requesting cancellation.",
    };
  }

  return {
    eligible: true,
    message:
      "GymDrobe checks the current order, inventory and payment records before confirming cancellation.",
  };
}

export function cancellationReason(value) {
  const reason =
    typeof value === "string" ? value.trim() : "";

  if (
    reason.length < 5 ||
    reason.length > 500 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(
      reason,
    )
  ) {
    throw new Error(
      "Enter a cancellation reason of 5–500 characters without unsupported control characters.",
    );
  }

  return reason;
}

export function cancellationReviewKey(order) {
  return JSON.stringify([
    order?.id,
    order?.orderNumber,
    order?.user,
    order?.status,
    order?.items,
    order?.pricing,
    order?.payment,
    order?.refund,
    order?.cancellation,
    order?.metadata?.inventoryReserved,
  ]);
}

export function sameOrder(left, right) {
  const ids = (value) =>
    [
      value?.id,
      value?._id,
      value?.orderNumber,
    ]
      .filter(
        (id) =>
          ["string", "number"].includes(typeof id) &&
          String(id).trim(),
      )
      .map(String);

  const expected = ids(right);

  return ids(left).some((id) =>
    expected.includes(id),
  );
}

export function confirmedCancellation(
  next,
  previous,
  userId,
) {
  return (
    orderOwnedBy(next, userId) &&
    sameOrder(next, previous) &&
    next.status === "cancelled" &&
    next.cancellation?.status === "cancelled"
  );
}

export function cancellationAttemptKey(
  userId,
  orderId,
) {
  return (
    "gymdrobe-cancellation-attempt-v1:" +
    `${encodeURIComponent(userId)}:` +
    encodeURIComponent(orderId)
  );
}

export function readCancellationAttempt(key) {
  try {
    const value = sessionStorage.getItem(key);

    if (value == null) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);

      return {
        reason: cancellationReason(parsed?.reason),
      };
    } catch {
      return {
        reason: "",
        invalid: true,
      };
    }
  } catch {
    return null;
  }
}

export function saveCancellationAttempt(
  key,
  reason,
) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        reason: cancellationReason(reason),
      }),
    );

    return true;
  } catch {
    return false;
  }
}

export function clearCancellationAttempt(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Verified state remains available in memory.
  }
}

export function buildReorder(
  order,
  products,
  cart,
  ready = true,
) {
  const current = Array.isArray(cart) ? cart : [];

  const result = {
    next: current,
    additions: [],
    skipped: [],
    subtotal: 0,
    message: "",
  };

  if (!ready) {
    result.message =
      "Load current products and prices before buying again.";
  } else if (
    !Array.isArray(order?.items) ||
    !order.items.length
  ) {
    result.message =
      "No purchased items are available to reorder.";
  } else if (
    !Array.isArray(cart) ||
    !reviewCart(current, products, true).totalsKnown ||
    !reviewCart(current, products, true).rows.every(
      (row) => row.available,
    )
  ) {
    result.message =
      "Review your existing bag's prices, quantities and availability before adding this order again.";
  }

  if (!result.message) {
    let next = [...current];

    for (const item of order.items) {
      const name =
        typeof item?.name === "string"
          ? item.name
          : "Unavailable item";

      const found = findReturnProduct(
        products,
        item,
      );

      if (!found) {
        result.skipped.push({
          name,
          message:
            "The original product is no longer available.",
        });

        continue;
      }

      const product = {
        ...found,
        id: found.id ?? found._id,
      };

      const quantity = item.quantity;
      const size = item.selectedSize ?? null;
      const color = item.selectedColor ?? null;

      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        result.skipped.push({
          name,
          message:
            "The purchased quantity needs review.",
        });

        continue;
      }

      const key = getCartItemKey({
        id: product.id,
        selectedSize: size,
        selectedColor: color,
      });

      const existing = next.filter(
        (row) => getCartItemKey(row) === key,
      );

      const total =
        quantity +
        existing.reduce(
          (sum, row) => sum + Number(row.quantity),
          0,
        );

      const check = purchaseState(
        product,
        size,
        color,
        total,
        true,
      );

      if (!check.canBuy) {
        result.skipped.push({
          name,
          message: check.message,
        });

        continue;
      }

      const row = normalizeCartItem(
        product,
        total,
        size,
        color,
      );

      const trial = [
        ...next.filter(
          (entry) => getCartItemKey(entry) !== key,
        ),
        row,
      ];

      const reviewed = reviewCart(
        trial,
        products,
        true,
      );

      if (
        trial.length > 50 ||
        !reviewed.totalsKnown ||
        !reviewed.rows.every(
          (entry) => entry.available,
        )
      ) {
        result.skipped.push({
          name,
          message:
            "This selection exceeds the bag limit or shares stock with another selection in your bag.",
        });

        continue;
      }

      next = trial;

      result.additions.push({
        name: product.name || name,
        product,
        quantity,
        size,
        color,
        price: row.price,
        previousPrice: recordedAmount(item.price),
      });

      result.subtotal += row.price * quantity;
    }

    result.next = next;

    if (!result.additions.length) {
      result.message =
        "No original selections can currently be added. Browse products for available options.";
    }
  }

  result.key = JSON.stringify([
    current,
    result.next,
    result.additions,
    result.skipped,
    result.message,
  ]);

  return result;
}

export function returnRequestMessage(request) {
  const exchange =
    request?.type === "exchange";

  const type = exchange ? "exchange" : "return";

  if (request?.status === "requested") {
    return `Your ${type} request is awaiting GymDrobe review.`;
  }

  if (request?.status === "approved") {
    return exchange
      ? "Your exchange is approved. Follow the store instructions. Reserved replacement stock does not confirm dispatch."
      : "Your return is approved. Follow the store instructions. Approval does not confirm receipt of items or a completed refund.";
  }

  if (request?.status === "rejected") {
    return `Your ${type} request was not approved. Read the store response or contact support.`;
  }

  if (request?.status === "completed") {
    return exchange
      ? "The exchange request is recorded as completed. Contact support for the replacement's shipment details; the original delivery timeline does not track the replacement."
      : "The return is recorded as completed. Check payment details for refund progress; completing a return does not itself transfer money.";
  }

  return "Contact support for the latest request information.";
}