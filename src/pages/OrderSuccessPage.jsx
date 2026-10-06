import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import useOrderUpdates from "../hooks/useOrderUpdates.js";
import { useAuth } from "../context/AuthContext.jsx";

import {
  getOrder as getLocalOrder,
  orderTotal,
} from "../utils/customerData.js";

import { getOrderById } from "../services/orderApi.js";
import { money } from "../utils/productPricing.js";

import EmptyState from "../components/EmptyState.jsx";

function recordedAmount(value) {
  if (value == null || value === "") {
    return null;
  }

  const amount = Number(value);

  return Number.isFinite(amount) && amount >= 0
    ? amount
    : null;
}

function paymentLabel(method) {
  switch (method) {
    case "cod-partial":
      return "Cash on delivery with 10% advance";
    case "cod":
      return "Cash on delivery";
    case "razorpay":
      return "Online payment through Razorpay";
    default:
      return "Payment method not recorded";
  }
}

function statusLabel(value) {
  const labels = {
    pending: "Pending",
    "payment-pending": "Payment pending",
    confirmed: "Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    "out-for-delivery": "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    paid: "Paid",
    "partially-paid": "Advance paid",
    failed: "Failed",
    refunded: "Refunded",
    "partially-refunded": "Partially refunded",
    "manual-required": "Requires review",
  };

  return labels[value] || "Awaiting update";
}

export default function OrderSuccessPage() {
  const revision = useOrderUpdates();
  const [params] = useSearchParams();

  const {
    user,
    token,
    loading: authLoading,
  } = useAuth();

  const orderId = params.get("orderId");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const userId = user?._id || user?.id || "";

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      setOrder(null);
      setError("");
      setLoading(true);

      if (authLoading) {
        return;
      }

      if (!orderId) {
        setLoading(false);
        return;
      }

      // A stored token requires an authenticated session.
      // Do not fall back to a guest order while it is unresolved.
      if (token && !userId) {
        setError(
          "Your account session could not be verified. Please sign in again to view this order.",
        );
        setLoading(false);
        return;
      }

      if (userId && !token) {
        setError(
          "Your sign-in session has expired. Please sign in again.",
        );
        setLoading(false);
        return;
      }

      try {
        const result = userId
          ? await getOrderById(token, orderId)
          : getLocalOrder(orderId, null);

        if (!cancelled) {
          setOrder(result || null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.message ||
              "Your order could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [
    orderId,
    userId,
    token,
    authLoading,
    revision,
    attempt,
  ]);

  if (authLoading || loading) {
    return (
      <div className="success-page">
        <div className="empty-state" role="status">
          <h3>Loading your order…</h3>
          <p>Checking your latest order details.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="success-page">
        <EmptyState
          title="Order could not be loaded"
          to="/orders"
          label="View my orders"
        >
          {error}
        </EmptyState>

        <div className="purchase-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setAttempt((current) => current + 1)
            }
          >
            Retry
          </button>

          {!userId && (
            <Link
              className="button secondary"
              to="/login"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        to="/orders"
        label="View my orders"
      >
        Open your order history to see orders
        available for this account or guest session.
      </EmptyState>
    );
  }

  const payment = order.payment || {};
  const refund = order.refund || {};

  const method =
    payment.method || order.paymentMethod;

  const isCodAdvance = method === "cod-partial";
  const isCancelled = order.status === "cancelled";

  const isConfirmed = [
    "confirmed",
    "processing",
    "shipped",
    "out-for-delivery",
    "delivered",
  ].includes(order.status);

  const amountPaid = recordedAmount(
    payment.amountPaid,
  );

  const amountDue = recordedAmount(
    payment.amountDue,
  );

  const advanceAmount = recordedAmount(
    payment.advanceAmount,
  );

  const refundAmount = recordedAmount(
    refund.amount,
  );

  const refundComplete =
    refund.status === "refunded" ||
    refund.status === "processed";

  const refundPending =
    refund.status === "pending" ||
    refund.status === "requested";

  const refundManual =
    refund.status === "manual-required";

  const displayId =
    order.orderNumber || order.id || orderId;

  const totalItems = (order.items || []).reduce(
    (total, item) =>
      total + (Number(item.quantity) || 0),
    0,
  );

  const customerName =
    order.customer?.name ||
    order.shippingAddress?.fullName ||
    order.shippingAddress?.name ||
    user?.name ||
    "Customer";

  let heading = "Your order is awaiting confirmation.";
  let message =
    "Check your order details for the latest payment and confirmation status.";

  if (isCancelled) {
    heading = "Your order was cancelled.";
    message =
      "This order will not be fulfilled. Any recorded refund details are shown below.";
  } else if (isConfirmed) {
    heading =
      order.status === "delivered"
        ? "Your order has been delivered."
        : "Your order is confirmed.";

    if (isCodAdvance && payment.status === "partially-paid") {
      message =
        "Your COD advance has been received. The remaining balance is payable on delivery.";
    } else if (payment.status === "paid") {
      message =
        "Your payment has been received. You can view the latest delivery updates in your order details.";
    } else if (method === "cod") {
      message =
        "Your order has been accepted. Payment is due on delivery.";
    } else {
      message =
        "View your order details for the latest payment and delivery updates.";
    }
  } else if (
    payment.status === "paid" ||
    payment.status === "partially-paid"
  ) {
    heading = "Payment received. Confirmation pending.";
    message =
      "Do not pay again. Check your order details or contact support if confirmation remains pending.";
  } else if (payment.status === "failed") {
    heading = "Your payment was not completed.";
    message =
      "Open your order details to check the payment status and available retry options.";
  } else if (order.status === "payment-pending") {
    heading = "Your order is awaiting payment.";
    message =
      "Your order is not confirmed yet. Open your order details to check the next step.";
  }

  return (
    <div className="success-page">
      {isConfirmed && (
        <span
          className="success-check"
          aria-hidden="true"
        >
          ✓
        </span>
      )}

      <p className="eyebrow">
        {isConfirmed
          ? "THANK YOU FOR CHOOSING GYMDROBE"
          : "GYMDROBE ORDER UPDATE"}
      </p>

      <h1>{heading}</h1>
      <p>{message}</p>

      <div className="success-order">
        <strong>{displayId}</strong>

        <span>
          {totalItems}{" "}
          {totalItems === 1 ? "item" : "items"}
          {" · "}
          {money(orderTotal(order))}
        </span>

        <p>
          {customerName}

          <br />

          {[
            order.shippingAddress?.city,
            order.shippingAddress?.pincode,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>

      <div className="success-order">
        <strong>Payment details</strong>

        <p>{paymentLabel(method)}</p>

        <p>
          Order status: {statusLabel(order.status)}
        </p>

        <p>
          Payment status: {statusLabel(payment.status)}
        </p>

        {isCodAdvance && advanceAmount !== null && (
          <p>
            COD advance: {money(advanceAmount)}
          </p>
        )}

        {amountPaid !== null && (
          <p>
            {payment.status === "refunded"
              ? "Amount retained after refund"
              : "Amount paid"}
            : {money(amountPaid)}
          </p>
        )}

        {!isCancelled && amountDue !== null && (
          <p>
            {isCodAdvance || method === "cod"
              ? "Balance due on delivery"
              : "Amount remaining"}
            : {money(amountDue)}
          </p>
        )}

        {isCancelled && (
          <p className="muted">
            No COD balance will be collected for
            this cancelled order.
          </p>
        )}
      </div>

      {(refundComplete || refundPending || refundManual) && (
        <div className="success-order">
          <strong>
            {refundComplete
              ? "Refund completed"
              : refundManual
                ? "Refund requires review"
                : "Refund in progress"}
          </strong>

          {refundAmount !== null && (
            <p>
              Refund amount: {money(refundAmount)}
            </p>
          )}

          <p className="muted">
            {refundComplete
              ? "The refund is recorded as completed. Bank processing may affect when it appears in your account."
              : refundManual
                ? "Contact GymDrobe support with your order number. Do not make another payment for this order."
                : "Your refund request is being processed. Check your order details for updates."}
          </p>

          {refund.reference && (
            <p>
              Refund reference: {refund.reference}
            </p>
          )}
        </div>
      )}

      <p className="muted">
        {userId
          ? "This order is linked to your GymDrobe account."
          : "These guest order details are stored on this device."}
      </p>

      <div className="purchase-actions">
        <Link
          className="button"
          to={`/orders/${encodeURIComponent(displayId)}`}
        >
          View order
        </Link>

        <Link
          className="button secondary"
          to="/orders"
        >
          My orders
        </Link>

        <Link
          className="button secondary"
          to="/shop"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}