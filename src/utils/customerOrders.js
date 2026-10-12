import {
  recordedAmount,
} from "./customerOrderDetails.js";

import {
  orderOwnedBy,
} from "./customerReturns.js";

export function orderIdentifier(order) {
  const value =
    order?.id ??
    order?.orderNumber ??
    order?._id;

  if (
    !["string", "number"].includes(typeof value)
  ) {
    return "";
  }

  const id = String(value).trim();

  return (
    id &&
    id.length <= 150 &&
    !/[\u0000-\u001f\u007f]/.test(id)
  )
    ? id
    : "";
}

export function orderTimestamp(
  order,
  now = Date.now(),
) {
  const value = order?.createdAt;

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const time = Date.parse(value);

  return Number.isFinite(time) && time <= now
    ? time
    : null;
}

export function fulfilmentStatus(order) {
  return order?.status === "packed"
    ? "processing"
    : order?.status || "";
}

export function prepareOrderList(
  value,
  userId = "",
) {
  if (!Array.isArray(value)) {
    throw new Error(
      "GymDrobe returned an unreadable order list.",
    );
  }

  const seen = new Set();

  for (const order of value) {
    const id = orderIdentifier(order);

    if (
      !order ||
      typeof order !== "object" ||
      Array.isArray(order) ||
      !id ||
      typeof order.status !== "string" ||
      !Array.isArray(order.items) ||
      seen.has(id)
    ) {
      throw new Error(
        "Some order records could not be verified. Retry or contact support.",
      );
    }

    if (
      userId &&
      !orderOwnedBy(order, userId)
    ) {
      throw Object.assign(
        new Error(
          "The returned order list could not be verified for your account. Please sign in again.",
        ),
        { status: 403 },
      );
    }

    seen.add(id);
  }

  return [...value];
}

export function orderPaymentSummary(order) {
  const payment = order?.payment || {};
  const refund = order?.refund || {};

  const method =
    payment.method || order?.paymentMethod;

  const methodLabel =
    ({
      razorpay: "Full online payment",
      "cod-partial": "COD with 10% advance",
      cod: "Cash on delivery",
    })[method] ||
    "Payment method not recorded";

  const paid = recordedAmount(
    payment.amountPaid,
  );

  const due = recordedAmount(
    payment.amountDue,
  );

  const total = recordedAmount(
    order?.pricing?.finalTotal,
  );

  const paymentTotal = recordedAmount(
    payment.totalAmount,
  );

  const advance = recordedAmount(
    payment.advanceAmount,
  );

  const refundAmount = recordedAmount(
    refund.amount,
  );

  const refundCompleted = [
    "refunded",
    "processed",
    "completed",
  ].includes(refund.status);

  const hasRefund = Boolean(
    refund.status &&
    ![
      "none",
      "not-requested",
      "not-applicable",
    ].includes(refund.status),
  );

  const cod = [
    "cod",
    "cod-partial",
  ].includes(method);

  const cancelled =
    order?.status === "cancelled";

  const verified =
    method === "cod" ||
    (
      ["razorpay", "cod-partial"].includes(method) &&
      Boolean(
        payment.verifiedAt &&
        (
          payment.razorpayPaymentId ||
          payment.transactionId
        ),
      )
    );

  const totalsMatch =
    total != null &&
    total > 0 &&
    paymentTotal === total;

  let needsReview =
    (
      total != null &&
      paymentTotal != null &&
      total !== paymentTotal
    ) ||
    (
      total != null &&
      paid != null &&
      paid > total
    );

  let label =
    ({
      paid: "Payment completed",

      "partially-paid":
        method === "cod-partial"
          ? "Advance paid"
          : "Partial payment recorded",

      pending: "Payment pending",
      failed: "Payment failed",
      refunded: "Refunded",
      "partially-refunded": "Partially refunded",
    })[payment.status] ||
    "Payment not recorded";

  if (
    payment.status === "paid" &&
    (
      !totalsMatch ||
      paid !== total ||
      due !== 0 ||
      !verified
    )
  ) {
    needsReview = true;
  }

  if (
    payment.status === "partially-paid" &&
    method !== "cod-partial"
  ) {
    needsReview = true;
  }

  if (
    payment.status === "partially-paid" &&
    method === "cod-partial" &&
    (
      !totalsMatch ||
      paid == null ||
      paid <= 0 ||
      paid >= total ||
      advance !== paid ||
      !verified ||
      due !== (
        cancelled
          ? 0
          : Math.round((total - paid) * 100) / 100
      )
    )
  ) {
    needsReview = true;
  }

  if (
    payment.status === "refunded" &&
    (
      paid !== 0 ||
      !refundCompleted
    )
  ) {
    needsReview = true;
  }

  if (
    payment.status === "partially-refunded" &&
    (
      paid == null ||
      paid <= 0 ||
      !refundCompleted
    )
  ) {
    needsReview = true;
  }

  if (
    payment.status === "failed" &&
    (
      paid > 0 ||
      payment.verifiedAt
    )
  ) {
    needsReview = true;
  }

  if (
    cancelled &&
    due != null &&
    due !== 0
  ) {
    needsReview = true;
  }

  if (needsReview) {
    label = "Payment record needs review";
  }

  const received =
    ["paid", "partially-paid"].includes(
      payment.status,
    ) ||
    paid > 0 ||
    Boolean(payment.verifiedAt);

  return {
    method,
    methodLabel,
    label,
    paid,
    due,
    total,
    refundAmount,
    cod,
    cancelled,
    refundCompleted,
    hasRefund,
    refundStatus: refund.status,
    needsReview,

    retained:
      refundCompleted ||
      ["refunded", "partially-refunded"].includes(
        payment.status,
      ),

    success:
      !needsReview &&
      ["paid", "partially-paid"].includes(
        payment.status,
      ),

    awaitingConfirmation:
      order?.status === "payment-pending" &&
      received,
  };
}

export function filterCustomerOrders(
  orders,
  {
    query = "",
    status = "",
    payment = "",
    days = "",
    sort = "newest",
  } = {},
  now = Date.now(),
) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const range = [
    "30",
    "90",
    "365",
  ].includes(String(days))
    ? Number(days)
    : null;

  return (
    Array.isArray(orders) ? orders : []
  )
    .filter((order) => {
      if (!order) {
        return false;
      }

      const summary = orderPaymentSummary(
        order,
      );

      if (
        status &&
        fulfilmentStatus(order) !== status
      ) {
        return false;
      }

      if (
        payment === "review"
          ? !summary.needsReview
          : payment &&
            (
              order.payment?.status !== payment ||
              summary.needsReview
            )
      ) {
        return false;
      }

      const timestamp = orderTimestamp(
        order,
        now,
      );

      if (
        range &&
        (
          timestamp == null ||
          now - timestamp > range * 86400000
        )
      ) {
        return false;
      }

      const items = Array.isArray(order.items)
        ? order.items
        : [];

      const searchable = [
        orderIdentifier(order),
        order.orderNumber,
        fulfilmentStatus(order),
        summary.methodLabel,
        summary.label,
        order.payment?.status,
        order.refund?.status,
        order.returnRequest?.status,

        ...items.flatMap((item) => [
          item?.name,
          item?.brand,
          item?.sku,
          item?.selectedSize,
          item?.selectedColor,
        ]),
      ]
        .filter((value) =>
          ["string", "number"].includes(
            typeof value,
          ),
        )
        .join(" ")
        .toLowerCase();

      return terms.every((term) =>
        searchable.includes(term),
      );
    })
    .sort((a, b) => {
      const left = orderTimestamp(a, now);
      const right = orderTimestamp(b, now);

      if (left == null || right == null) {
        return left == null
          ? right == null
            ? 0
            : 1
          : -1;
      }

      return sort === "oldest"
        ? left - right
        : right - left;
    });
}