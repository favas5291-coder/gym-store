import { useId } from "react";
import { money } from "../utils/productPricing.js";

function amount(value) {
  if (value == null || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

export function formatOrderStatus(value) {
  const labels = {
    "payment-pending": "Payment pending",
    confirmed: "Confirmed",
    processing: "Processing",
    packed: "Processing",
    shipped: "Shipped",
    "out-for-delivery": "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    pending: "Pending",
    paid: "Paid",
    "partially-paid": "Advance paid",
    failed: "Failed",
    refunded: "Refunded",
    "partially-refunded": "Partially refunded",
    requested: "Requested",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
    processed: "Processed",
    collected: "Collected",
    waived: "Waived",
    "not-requested": "Not requested",
    "not-applicable": "Not applicable",
    "manual-required": "Requires review",
  };

  if (!value || value === "none") {
    return "Not recorded";
  }

  return labels[value] || String(value).replaceAll("-", " ");
}

export function formatOrderDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString("en-IN");
}

function hasRefund(refund) {
  return Boolean(
    refund.status &&
    !["none", "not-requested", "not-applicable"].includes(
      refund.status
    )
  );
}

function refundCompleted(refund) {
  return ["refunded", "processed", "completed"].includes(
    refund.status
  );
}

export function getPaymentRows(order = {}) {
  const payment = order.payment || {};
  const refund = order.refund || {};
  const method = payment.method || order.paymentMethod;

  const methodLabels = {
    razorpay: "Online payment through Razorpay",
    "cod-partial": "COD with 10% advance",
    cod: "Cash on delivery",
  };

  const paid = amount(payment.amountPaid);
  const due = amount(payment.amountDue);
  const advance = amount(payment.advanceAmount);
  const completed = refundCompleted(refund);

  const rows = [
    [
      "Payment method",
      methodLabels[method] || "Not recorded",
    ],
    [
      "Payment status",
      formatOrderStatus(payment.status),
    ],
  ];

  if (method === "cod-partial") {
    rows.push([
      "Required COD advance",
      advance ?? "Not recorded",
    ]);

    if (payment.advancePaidAt) {
      rows.push([
        "Advance recorded on",
        formatOrderDate(payment.advancePaidAt),
      ]);
    }
  }

  rows.push([
    completed || payment.status === "refunded"
      ? "Recorded amount retained after refund"
      : "Recorded amount paid",
    paid ?? "Not recorded",
  ]);

  if (order.status !== "cancelled") {
    rows.push([
      method === "cod" || method === "cod-partial"
        ? "Balance due on delivery"
        : "Amount remaining",
      due ?? "Not recorded",
    ]);
  }

  if (
    method === "cod-partial" &&
    payment.balanceStatus &&
    payment.balanceStatus !== "not-applicable"
  ) {
    rows.push([
      "Delivery balance status",
      formatOrderStatus(payment.balanceStatus),
    ]);
  }

  if (payment.balanceCollectedAt) {
    rows.push([
      "Balance collected on",
      formatOrderDate(payment.balanceCollectedAt),
    ]);
  }

  if (payment.paidAt) {
    rows.push([
      "Full payment recorded on",
      formatOrderDate(payment.paidAt),
    ]);
  }

  const transaction =
    payment.razorpayPaymentId || payment.transactionId;

  if (transaction) {
    rows.push(["Payment reference", transaction]);
  }

  if (hasRefund(refund)) {
    rows.push([
      "Refund status",
      formatOrderStatus(refund.status),
    ]);

    rows.push([
      completed ? "Recorded refund amount" : "Requested refund amount",
      amount(refund.amount) ?? "Not recorded",
    ]);

    if (refund.reference) {
      rows.push(["Refund reference", refund.reference]);
    }

    if (refund.requestedAt) {
      rows.push([
        "Refund requested on",
        formatOrderDate(refund.requestedAt),
      ]);
    }

    if (refund.refundedAt) {
      rows.push([
        "Refund completed on",
        formatOrderDate(refund.refundedAt),
      ]);
    }
  }

  return rows;
}

export default function OrderPaymentDetails({
  order = {},
}) {
  const titleId = useId();
  const payment = order.payment || {};
  const refund = order.refund || {};
  const method = payment.method || order.paymentMethod;

  const isCancelled = order.status === "cancelled";
  const isAdvance = method === "cod-partial";
  const paid = amount(payment.amountPaid);

  const paymentRecorded =
    ["paid", "partially-paid"].includes(payment.status) ||
    (paid != null && paid > 0) ||
    Boolean(payment.verifiedAt);

  const gatewayRefundRecorded =
    typeof refund.reference === "string" &&
    refund.reference.startsWith("rfnd_");

  return (
    <section
      className="panel"
      aria-labelledby={titleId}
    >
      <h2 id={titleId}>PAYMENT DETAILS</h2>

      <dl className="receipt-totals">
        {getPaymentRows(order).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>

            <dd style={{ overflowWrap: "anywhere" }}>
              {typeof value === "number"
                ? money(value)
                : value}
            </dd>
          </div>
        ))}
      </dl>

      {isAdvance && (
        <p className="muted">
          The 10% advance is calculated on the product
          amount after coupon discounts. Delivery
          charges are included in the remaining balance.
        </p>
      )}

      {isCancelled && (
        <p className="notice">
          This order is cancelled. No remaining COD
          balance will be collected.
        </p>
      )}

      {!isCancelled &&
        order.status !== "payment-pending" &&
        isAdvance &&
        payment.status === "partially-paid" &&
        payment.balanceStatus === "pending" && (
          <p className="notice">
            Your advance is recorded as received.
            Pay the recorded remaining balance on delivery.
          </p>
        )}

      {!isCancelled &&
        isAdvance &&
        payment.balanceStatus === "collected" && (
          <p className="notice">
            Your delivery balance is recorded as collected.
          </p>
        )}

      {!isCancelled &&
        isAdvance &&
        payment.balanceStatus === "waived" && (
          <p className="notice">
            Your delivery balance is recorded as waived.
          </p>
        )}

      {!isCancelled &&
        order.status === "payment-pending" && (
          <p className="notice">
            {paymentRecorded
              ? "Payment is recorded, but order confirmation is pending. Do not pay again."
              : "This order is awaiting payment confirmation. If money was deducted, do not pay again; contact support with your order number."}
          </p>
        )}

      {refund.status === "pending" && (
        <p className="muted">
          {gatewayRefundRecorded
            ? "A payment-provider refund reference is recorded. Refund completion is pending."
            : "A refund request is recorded. Its completion has not yet been confirmed."}
        </p>
      )}

      {refund.status === "manual-required" && (
        <p className="notice">
          Your refund requires review. Contact GymDrobe
          support with your order number.
        </p>
      )}

      {refundCompleted(refund) && (
        <p className="muted">
          The refund is recorded as completed.
          Check your payment account for the credit.
        </p>
      )}
    </section>
  );
}