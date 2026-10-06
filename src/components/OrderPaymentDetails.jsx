import { money } from "../utils/productPricing.js";

function amount(value) {
  if (value == null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
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
    processed: "Processed",
    "manual-required": "Requires review",
  };

  if (!value || value === "none") {
    return "Not recorded";
  }

  return (
    labels[value] ||
    String(value).replaceAll("-", " ")
  );
}

export function formatOrderDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString("en-IN");
}

export function getPaymentRows(order) {
  const payment = order.payment || {};
  const refund = order.refund || {};

  const method =
    payment.method || order.paymentMethod;

  const methodLabels = {
    razorpay: "Online payment through Razorpay",
    "cod-partial": "COD with 10% advance",
    cod: "Cash on delivery",
  };

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

  const paid = amount(payment.amountPaid);
  const due = amount(payment.amountDue);
  const advance = amount(payment.advanceAmount);

  if (method === "cod-partial") {
    rows.push([
      "COD advance",
      advance ?? "Not recorded",
    ]);
  }

  rows.push([
    payment.status === "refunded"
      ? "Amount retained after refund"
      : "Amount paid",
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

  const transaction =
    payment.razorpayPaymentId ||
    payment.transactionId;

  if (transaction) {
    rows.push(["Payment reference", transaction]);
  }

  if (refund.status && refund.status !== "none") {
    rows.push([
      "Refund status",
      formatOrderStatus(refund.status),
    ]);

    const refundAmount = amount(refund.amount);

    rows.push([
      "Refund amount",
      refundAmount ?? "Not recorded",
    ]);

    if (refund.reference) {
      rows.push([
        "Refund reference",
        refund.reference,
      ]);
    }

    if (refund.refundedAt) {
      rows.push([
        "Refund completed",
        formatOrderDate(refund.refundedAt),
      ]);
    }
  }

  return rows;
}

export default function OrderPaymentDetails({
  order,
}) {
  const payment = order.payment || {};
  const refund = order.refund || {};

  const method =
    payment.method || order.paymentMethod;

  const isCancelled = order.status === "cancelled";
  const isAdvance = method === "cod-partial";

  return (
    <section
      className="panel"
      aria-labelledby="order-payment-title"
    >
      <h2 id="order-payment-title">
        PAYMENT DETAILS
      </h2>

      <dl className="receipt-totals">
        {getPaymentRows(order).map(
          ([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>

              <dd style={{ overflowWrap: "anywhere" }}>
                {typeof value === "number"
                  ? money(value)
                  : value}
              </dd>
            </div>
          ),
        )}
      </dl>

      {isAdvance && (
        <p className="muted">
          The 10% advance is calculated on the
          product amount after coupon discounts.
          Delivery charges are included in the
          remaining balance.
        </p>
      )}

      {isCancelled ? (
        <p className="notice">
          This order is cancelled. No remaining
          COD balance will be collected.
        </p>
      ) : (
        isAdvance &&
        payment.status === "partially-paid" && (
          <p className="notice">
            Your advance has been received.
            Pay the recorded remaining balance
            on delivery.
          </p>
        )
      )}

      {!isCancelled &&
        order.status === "payment-pending" && (
          <p className="notice">
            {payment.status === "paid" ||
            payment.status === "partially-paid"
              ? "Payment is recorded, but order confirmation is pending. Do not pay again."
              : "This order is awaiting payment confirmation. Check order details before making another payment."}
          </p>
        )}

      {refund.status === "pending" && (
        <p className="muted">
          Your refund is being processed.
          Check this order for updates.
        </p>
      )}

      {refund.status === "manual-required" && (
        <p className="notice">
          Your refund requires review. Contact
          GymDrobe support with your order number.
        </p>
      )}

      {(refund.status === "refunded" ||
        refund.status === "processed") && (
        <p className="muted">
          The refund is recorded as completed.
          Your bank may take additional time to
          display it.
        </p>
      )}
    </section>
  );
}