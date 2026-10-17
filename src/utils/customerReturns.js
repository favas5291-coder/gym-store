import { guestAccess } from "./guestCheckout.js";
import { getVariantStock } from "./cartUtils.js";
import { purchaseOptions } from "./productPurchase.js";

function moneyValue(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return null;
  }

  const number = Number(value);
  const cents = Math.round(number * 100);

  return (
    Number.isFinite(number) &&
    number >= 0 &&
    Number.isSafeInteger(cents) &&
    Math.abs(number * 100 - cents) < 0.000001
  )
    ? cents
    : null;
}

export function orderOwnedBy(order, userId) {
  // UI check for orders returned by the order API.
  // The backend enforces ownership on every read and action.
  if (
    order?.isGuestOrder === true &&
    guestAccess()
  ) {
    return true;
  }

  const user = order?.user;

  const id =
    typeof user === "object" && user
      ? user.id || user._id
      : user;

  return Boolean(
    userId &&
    id &&
    String(id) === String(userId),
  );
}

export function returnAvailability(
  order,
  now = Date.now(),
) {
  let message = "";

  if (
    !order ||
    order.status !== "delivered" ||
    order.cancellation?.status === "cancelled"
  ) {
    message =
      "Returns and exchanges open after delivery.";
  } else if (
    !["not-requested", "rejected"].includes(
      order.returnRequest?.status || "not-requested",
    )
  ) {
    message =
      "A request is already recorded. Open order details to see its progress.";
  } else if (
    !["not-requested", "not-applicable"].includes(
      order.refund?.status || "not-requested",
    )
  ) {
    message =
      "This order has a refund under management. Contact support for help.";
  }

  const total = moneyValue(
    order?.pricing?.finalTotal,
  );

  const paid = moneyValue(
    order?.payment?.amountPaid,
  );

  if (
    !message &&
    (
      order.payment?.status !== "paid" ||
      total === null ||
      total <= 0 ||
      paid !== total ||
      moneyValue(order.payment.amountDue) !== 0 ||
      moneyValue(order.payment.totalAmount) !== total
    )
  ) {
    message =
      "The recorded payment needs confirmation before a return or exchange. Contact support.";
  }

  const method =
    order?.payment?.method ||
    order?.paymentMethod;

  if (
    !message &&
    (
      !["razorpay", "cod-partial", "cod"].includes(method) ||
      (
        method !== "cod" &&
        (
          !order.payment.verifiedAt ||
          !(
            order.payment.razorpayPaymentId ||
            order.payment.transactionId
          )
        )
      )
    )
  ) {
    message =
      "The recorded payment needs verification. Contact support before submitting a request.";
  }

  const events = Array.isArray(
    order?.tracking?.events,
  )
    ? order.tracking.events
    : [];

  const deliveredAt =
    order?.delivery?.deliveredAt ||
    [...events]
      .reverse()
      .find(
        (row) => row?.status === "delivered",
      )?.timestamp;

  const delivered = new Date(
    deliveredAt || "invalid",
  ).getTime();

  if (
    !message &&
    (
      !Number.isFinite(delivered) ||
      !Number.isFinite(now) ||
      delivered > now
    )
  ) {
    message =
      "Contact support to confirm the delivery date and request deadlines.";
  }

  return {
    eligible: !message,
    message,
    delivered,
  };
}

export function itemReturnAvailability(
  order,
  item,
  now = Date.now(),
) {
  const overall = returnAvailability(
    order,
    now,
  );

  if (!overall.eligible) {
    return overall;
  }

  const days = item?.returnWindowDays ?? 7;

  let message = "";

  if (
    !item ||
    !Number.isSafeInteger(item.quantity) ||
    item.quantity < 1
  ) {
    message =
      "This item's purchased quantity needs support review.";
  } else if (item.returnsEligible === "no") {
    message =
      "Routine returns are unavailable for this item. Contact support about damaged, incorrect or faulty items.";
  } else if (
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > 7
  ) {
    message =
      "This item's request window needs support review.";
  }

  const deadline =
    overall.delivered + days * 86400000;

  if (!message && now > deadline) {
    message =
      `This item's ${days}-day request window has ended. Contact support for help.`;
  }

  return {
    eligible: !message,
    message,
    deadline,
    policyConfirmed:
      item?.returnsEligible === "yes",
  };
}

export function findReturnProduct(
  products,
  item,
) {
  const list = Array.isArray(products)
    ? products
    : [];

  const ids = [
    item?.productId,
    item?.product,
    item?.id,
  ]
    .filter((value) => value != null)
    .map(String);

  const exact = list.find((product) =>
    [product?.id, product?._id].some(
      (value) =>
        value != null &&
        ids.includes(String(value)),
    ),
  );

  if (exact) {
    return exact;
  }

  // A reused slug must not substitute another product
  // for a missing original MongoDB product.
  if (
    ids.some(
      (id) => /^[a-f0-9]{24}$/i.test(id),
    )
  ) {
    return null;
  }

  return (
    list.find((product) =>
      product &&
      (
        (
          item?.legacyId != null &&
          product.legacyId != null &&
          String(item.legacyId) ===
            String(product.legacyId)
        ) ||
        (
          Boolean(item?.slug) &&
          String(item.slug) ===
            String(product.slug)
        ) ||
        (
          product.legacyId != null &&
          ids.includes(
            String(product.legacyId),
          )
        )
      ),
    ) || null
  );
}

export function replacementOptions(product) {
  return {
    sizes: purchaseOptions(product?.sizes),
    colors: purchaseOptions(product?.colors),
  };
}

export function replacementStock(
  product,
  size,
  color,
) {
  if (
    !product ||
    product.isActive === false ||
    product.delivery?.available === false
  ) {
    return 0;
  }

  const { sizes, colors } =
    replacementOptions(product);

  if (
    (sizes.length || colors.length) &&
    (
      !product.variants ||
      typeof product.variants !== "object" ||
      !Object.keys(product.variants).length
    )
  ) {
    return 0;
  }

  return getVariantStock(
    product,
    size,
    color,
  );
}

export function returnPayload(
  order,
  chosen,
  type,
  reason,
  products,
  ready = true,
  now = Date.now(),
) {
  if (
    !["return", "exchange"].includes(type)
  ) {
    throw new Error(
      "Choose return or exchange.",
    );
  }

  const overall = returnAvailability(
    order,
    now,
  );

  if (!overall.eligible) {
    throw new Error(overall.message);
  }

  const cleanReason =
    typeof reason === "string"
      ? reason.trim()
      : "";

  if (
    cleanReason.length < 5 ||
    cleanReason.length > 1000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(
      cleanReason,
    )
  ) {
    throw new Error(
      "Enter a reason of 5–1,000 characters without unsupported control characters.",
    );
  }

  const selected = Object.entries(
    chosen || {},
  ).filter(
    ([, row]) => row?.selected === true,
  );

  if (
    !selected.length ||
    selected.length > 50
  ) {
    throw new Error(
      "Select between 1 and 50 items.",
    );
  }

  if (type === "exchange" && !ready) {
    throw new Error(
      "Load current replacement options before submitting an exchange.",
    );
  }

  const pools = new Map();

  const items = selected.map(([key, row]) => {
    const index = Number(key);

    const quantity =
      row.quantity === ""
        ? NaN
        : Number(row.quantity);

    const item = order.items?.[index];

    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      String(index) !== key ||
      !item ||
      !["string", "number"].includes(
        typeof row.quantity,
      ) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > item.quantity
    ) {
      throw new Error(
        "Choose valid whole-number item quantities.",
      );
    }

    const allowed = itemReturnAvailability(
      order,
      item,
      now,
    );

    if (!allowed.eligible) {
      throw new Error(
        `${item.name}: ${allowed.message}`,
      );
    }

    if (type === "return") {
      return {
        index,
        quantity,
        size: null,
        color: null,
      };
    }

    const product = findReturnProduct(
      products,
      item,
    );

    if (
      !product ||
      product.isActive === false ||
      product.delivery?.available === false
    ) {
      throw new Error(
        `${item.name}: this product is unavailable for exchange.`,
      );
    }

    const { sizes, colors } =
      replacementOptions(product);

    const size = sizes.length
      ? String(row.size ?? "") || null
      : null;

    const color = colors.length
      ? String(row.color ?? "") || null
      : null;

    if (
      (
        sizes.length &&
        !sizes.includes(size)
      ) ||
      (
        colors.length &&
        !colors.includes(color)
      )
    ) {
      throw new Error(
        `${item.name}: choose available replacement options. A previous option may have changed.`,
      );
    }

    if (
      size === (item.selectedSize ?? null) &&
      color === (item.selectedColor ?? null)
    ) {
      throw new Error(
        `${item.name}: choose a different replacement option.`,
      );
    }

    const available = replacementStock(
      product,
      size,
      color,
    );

    const separate =
      product.variants &&
      typeof product.variants === "object" &&
      Object.keys(product.variants).length > 0;

    const pool = JSON.stringify([
      String(
        product._id ??
        product.id ??
        product.legacyId,
      ),
      separate ? size : null,
      separate ? color : null,
    ]);

    const total =
      (pools.get(pool) || 0) + quantity;

    if (total > available) {
      throw new Error(
        `${item.name}: only ${available} available across the selected items for this replacement.`,
      );
    }

    pools.set(pool, total);

    return {
      index,
      quantity,
      size,
      color,
    };
  });

  return {
    type,
    reason: cleanReason,
    items,
  };
}

export function returnReviewKey(order) {
  return JSON.stringify([
    order?.orderNumber || order?.id,
    order?.user,
    order?.status,
    order?.cancellation?.status,
    order?.items,
    order?.pricing,
    order?.payment,
    order?.refund,
    order?.returnRequest?.id,
    order?.returnRequest?.status,
    order?.delivery?.deliveredAt,

    (
      Array.isArray(order?.tracking?.events)
        ? order.tracking.events
        : []
    ).filter(
      (row) => row?.status === "delivered",
    ),
  ]);
}

export function matchingReturn(
  order,
  payload,
  previousId = "",
) {
  const request = order?.returnRequest;

  const rows = (value) =>
    JSON.stringify(
      (Array.isArray(value) ? value : [])
        .map((row) => [
          row?.index,
          row?.quantity,
          row?.size ?? null,
          row?.color ?? null,
        ])
        .sort(
          (a, b) => a[0] - b[0],
        ),
    );

  return Boolean(
    request?.id &&
    request.id !== previousId &&
    [
      "requested",
      "approved",
      "rejected",
      "completed",
    ].includes(request.status) &&
    request.type === payload?.type &&
    request.reason === payload?.reason &&
    rows(request.items) ===
      rows(payload?.items),
  );
}

export function returnAttemptKey(
  userId,
  orderId,
) {
  return (
    "gymdrobe-return-attempt-v1:" +
    `${encodeURIComponent(userId)}:` +
    encodeURIComponent(orderId)
  );
}

export function readReturnAttempt(key) {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key),
    );

    return (
      value &&
      typeof value === "object" &&
      typeof value.previousId === "string" &&
      ["return", "exchange"].includes(
        value.payload?.type,
      ) &&
      typeof value.payload.reason === "string" &&
      Array.isArray(value.payload.items) &&
      value.payload.items.length > 0 &&
      value.payload.items.length <= 50 &&
      value.payload.reason.trim().length >= 5 &&
      value.payload.reason.length <= 1000 &&
      value.payload.items.every(
        (row) =>
          row &&
          Number.isSafeInteger(row.index) &&
          row.index >= 0 &&
          Number.isSafeInteger(row.quantity) &&
          row.quantity > 0,
      )
    )
      ? value
      : null;
  } catch {
    return null;
  }
}

export function saveReturnAttempt(key, value) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify(value),
    );

    return true;
  } catch {
    return false;
  }
}

export function clearReturnAttempt(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Backend request-state checks remain in place.
  }
}