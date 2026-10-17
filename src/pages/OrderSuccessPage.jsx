import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import useCustomerOrder from "../hooks/useCustomerOrder.js";

import { money } from "../utils/productPricing.js";
import { recordedAmount } from "../utils/customerOrderDetails.js";
import { trackPurchase } from "../utils/analytics.js";
import { orderIsComplete } from "../utils/checkoutPayment.js";
import { deliveryEstimate } from "../utils/orderTracking.js";

import OrderPaymentDetails, {
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import GuestOrderAccess from "../components/GuestOrderAccess.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { ProductImage } from "../components/StorefrontShared.jsx";

import "../utils/CheckoutPage.css";

function hasRefundUpdate(order) {
  return (
    [
      "pending",
      "requested",
      "manual-required",
      "refunded",
      "processed",
      "completed",
    ].includes(order?.refund?.status) ||
    [
      "refunded",
      "partially-refunded",
    ].includes(order?.payment?.status)
  );
}

function confirmationText(order, remote, confirmed) {
  if (!remote) {
    return {
      heading: "Order preview",
      message:
        "These details are saved on this device. They are not proof of a real payment or a confirmed order.",
    };
  }

  if (order.status === "cancelled") {
    return {
      heading: "Your order was cancelled",
      message:
        "This order will not be fulfilled. Check the payment section for any recorded refund progress.",
    };
  }

  if (hasRefundUpdate(order)) {
    return {
      heading: "Refund update for your order",
      message:
        "Your payment and refund details are shown below. Open your order details for the latest return and delivery updates.",
    };
  }

  if (order.status === "delivered") {
    return {
      heading: "Your order has been delivered",
      message:
        "Your delivery is recorded as completed. Your recorded payment details and order history are available below.",
    };
  }

  if (confirmed) {
    return {
      heading: "Your order is confirmed!",
      message:
        order.payment?.status === "partially-paid"
          ? "Your COD advance is received. Check the recorded remaining balance below and track each package for delivery updates."
          : "Your payment is received. We’ll record delivery updates as your order moves forward.",
    };
  }

  const method =
    order.payment?.method ||
    order.paymentMethod;

  if (
    method === "cod" &&
    [
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "out-for-delivery",
    ].includes(order.status)
  ) {
    return {
      heading: "Your order is confirmed!",
      message:
        "This order uses cash on delivery. Check the recorded balance and delivery updates below.",
    };
  }

  if (
    ["paid", "partially-paid"].includes(
      order.payment?.status,
    )
  ) {
    return {
      heading: "Payment received. Confirmation pending.",
      message:
        "Do not pay again. Refresh the order status or contact support if confirmation remains pending.",
    };
  }

  if (order.payment?.status === "failed") {
    return {
      heading: "Your payment was not completed",
      message:
        "Check the latest order details before retrying payment. If money was deducted, contact support with your order number.",
    };
  }

  return {
    heading: "Payment confirmation pending",
    message:
      "Your order is not confirmed yet. If money was deducted, do not pay again. Refresh the status or contact support.",
  };
}

function packageEstimate(range) {
  if (
    !Number.isSafeInteger(range?.minimum) ||
    !Number.isSafeInteger(range?.maximum) ||
    range.minimum < 0 ||
    range.maximum < range.minimum
  ) {
    return "Estimate awaiting confirmation.";
  }

  return `${range.minimum}–${range.maximum} days from the recorded preparation and transit estimates.`;
}

function showMoney(value) {
  const amount = recordedAmount(value);

  return amount == null
    ? "Not recorded"
    : money(amount);
}

export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();

  const orderId = params.get("orderId") || "";

  const data = useCustomerOrder(orderId, {
    autoRefresh: true,
  });

  const { order } = data;

  // This also includes guest orders loaded from the backend.
  const remote = data.isAccountOrder;

  const confirmed = Boolean(
    remote &&
    !data.loading &&
    !data.error &&
    orderIsComplete(order) &&
    !hasRefundUpdate(order),
  );

  useEffect(() => {
    if (!confirmed || !order) {
      return;
    }

    const track = () => trackPurchase(order);

    track();

    window.addEventListener(
      "gymdrobe-analytics-ready",
      track,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-analytics-ready",
        track,
      );
    };
  }, [order, confirmed]);

  if (data.loading) {
    return (
      <div
        className="page narrow success-page"
        role="status"
      >
        <h1>Checking your order…</h1>
        <p>Loading the latest recorded confirmation.</p>
      </div>
    );
  }

  if (data.error || !order) {
    return (
      <div className="page narrow success-page">
        <EmptyState
          title={
            data.error
              ? "Order could not be loaded"
              : "Order not found"
          }
          to="/orders"
          label="Orders & guest access"
        >
          {data.error ||
            "Open your orders or restore your private guest access code."}
        </EmptyState>

        <button
          type="button"
          className="button secondary"
          onClick={data.refresh}
          disabled={data.refreshing}
        >
          {data.refreshing ? "Checking…" : "Retry"}
        </button>

        {!user && <GuestOrderAccess />}
      </div>
    );
  }

  const id =
    order.orderNumber ||
    order.id ||
    order._id ||
    orderId;

  const route =
    `/orders/${encodeURIComponent(id)}`;

  const address = order.shippingAddress || {};

  const status = confirmationText(
    order,
    remote,
    confirmed,
  );

  const estimate = deliveryEstimate(
    order.tracking?.estimatedDelivery,
  );

  const shipments =
    order.shippingSnapshot?.shipments || [];

  const showEstimate =
    !["cancelled", "delivered"].includes(
      order.status,
    );

  const addressLines = [
    address.addressLine || address.address,
    address.landmark,
    [
      address.city,
      address.state,
      address.pincode,
    ]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const total =
    order.pricing?.finalTotal ??
    order.pricing?.total ??
    order.total;

  return (
    <div className="page narrow gd-checkout gd-order-confirmation">
      <header className="panel">
        {confirmed && (
          <span
            className="success-check"
            aria-hidden="true"
          >
            ✓
          </span>
        )}

        <p className="eyebrow">
          {confirmed
            ? "THANK YOU FOR CHOOSING GYMDROBE"
            : "GYMDROBE ORDER UPDATE"}
        </p>

        <h1>{status.heading}</h1>
        <p>{status.message}</p>

        <p>
          Order number: <strong>{id}</strong>
        </p>

        <p>
          Order status:{" "}
          <strong>
            {order.status === "packed"
              ? "Packed"
              : formatOrderStatus(order.status)}
          </strong>
        </p>

        <div className="purchase-actions">
          <Link
            className="button"
            to={`${route}/track`}
          >
            Track Order
          </Link>

          <Link
            className="button secondary"
            to={route}
          >
            View order details
          </Link>

          {remote && (
            <button
              type="button"
              className="button secondary"
              onClick={data.refresh}
              disabled={data.refreshing}
            >
              {data.refreshing
                ? "Checking…"
                : "Refresh order status"}
            </button>
          )}
        </div>

        {!remote && (
          <p className="notice">
            Local preview only. Restore guest access
            or sign in to check the backend order.
          </p>
        )}

        {order.metadata?.demo === true && (
          <p className="notice">
            Test order · Razorpay test mode was used.
          </p>
        )}

        {data.refreshError && (
          <p
            className="field-error"
            role="alert"
          >
            {data.refreshError}
            {" "}
            Showing the last successfully loaded details.
          </p>
        )}
      </header>

      <OrderPaymentDetails order={order} />

      <section className="panel">
        <h2>DELIVER TO</h2>

        <strong>
          {address.fullName ||
            address.name ||
            order.customer?.name ||
            user?.name ||
            "Customer"}
        </strong>

        {addressLines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}

        {address.phone && (
          <p>Mobile: {address.phone}</p>
        )}

        {showEstimate && (
          <>
            {estimate ? (
              <p>
                Recorded estimated delivery:{" "}
                <strong>{estimate.label}</strong>
              </p>
            ) : order.delivery?.estimatedTime ? (
              <p>
                Recorded estimate:{" "}
                {order.delivery.estimatedTime}
              </p>
            ) : !shipments.length ? (
              <p className="muted">
                A delivery date has not been recorded
                yet. Check tracking for updates.
              </p>
            ) : null}

            {shipments.map((parcel) => (
              <p key={parcel.key}>
                <strong>
                  {parcel.label || "Package"}
                </strong>
                : {packageEstimate(parcel.estimatedDays)}
              </p>
            ))}
          </>
        )}
      </section>

      <section className="panel">
        <h2>YOUR ITEMS</h2>

        {(order.items || []).map((item, index) => (
          <article
            className="gd-checkout-item"
            key={`${
              item.id ||
              item.productId ||
              item.product
            }:${index}`}
          >
            <ProductImage
              product={item}
              className="gd-checkout-photo"
            />

            <div>
              <h3>{item.name}</h3>

              <p>
                {[
                  item.selectedColor,
                  item.selectedSize,
                ]
                  .filter(Boolean)
                  .join(" / ") || "Standard option"}

                {" · "}
                Qty {item.quantity}
              </p>

              <p>
                Recorded unit price:{" "}
                {showMoney(item.price)}
              </p>
            </div>
          </article>
        ))}

        <p>
          <strong>
            Order total: {showMoney(total)}
          </strong>
        </p>
      </section>

      {order.isGuestOrder === true && (
        <>
          <GuestOrderAccess backup />

          {!user && (
            <section className="panel">
              <h2>Make your next visit easier</h2>

              <p>
                Account creation is optional. Continue
                with Google to create or sign in to
                your GymDrobe account. Keep your guest
                access code for this purchase.
              </p>

              <Link
                className="button secondary"
                to={`/login?next=${encodeURIComponent(
                  route,
                )}`}
              >
                Continue with Google (optional)
              </Link>
            </section>
          )}
        </>
      )}

      <div className="purchase-actions">
        <Link
          className="button secondary"
          to="/orders"
        >
          All orders
        </Link>

        <Link
          className="button secondary"
          to="/help"
        >
          Get help
        </Link>

        <Link
          className="button"
          to="/shop"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}