import { Link, useParams } from "react-router-dom";

import useCustomerOrder from "../hooks/useCustomerOrder.js";

import EmptyState from "../components/EmptyState.jsx";

import OrderPaymentDetails, {
  formatOrderDate,
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

const stages = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];

const messages = {
  confirmed:
    "Your order is confirmed and awaiting preparation.",
  processing:
    "Your order is being prepared for dispatch.",
  shipped:
    "Your order has been dispatched.",
  "out-for-delivery":
    "Your order is out for delivery. Keep your phone available for the delivery partner.",
  delivered:
    "Your order is recorded as delivered.",
};

function eventTime(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function OrderTrackingPage() {
  const { orderId } = useParams();

  const {
    order,
    loading,
    refreshing,
    error,
    refreshError,
    lastUpdated,
    isAccountOrder,
    refresh,
  } = useCustomerOrder(orderId, {
    autoRefresh: true,
  });

  if (loading) {
    return (
      <div className="page narrow tracking-page">
        <div className="empty-state" role="status">
          <h3>Loading tracking…</h3>
          <p>Getting the latest order information.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page narrow tracking-page">
        <EmptyState
          title="Tracking could not be loaded"
          to="/orders"
          label="My orders"
        >
          {error}
        </EmptyState>

        <button
          className="button secondary"
          type="button"
          disabled={refreshing}
          onClick={refresh}
        >
          {refreshing ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        to="/orders"
        label="My orders"
      >
        Check your order history for available orders.
      </EmptyState>
    );
  }

  const displayId =
    order.orderNumber || order.id || orderId;

  const status =
    order.status === "packed"
      ? "processing"
      : order.status;

  const currentIndex = stages.indexOf(status);

  const cancelled = status === "cancelled";
  const pending = status === "payment-pending";

  const paymentReceived =
    order.payment?.status === "paid" ||
    order.payment?.status === "partially-paid";

  const events = (
    Array.isArray(order.tracking?.events)
      ? [...order.tracking.events]
      : []
  ).sort(
    (a, b) =>
      eventTime(b.timestamp) -
      eventTime(a.timestamp),
  );

  const address = order.shippingAddress;

  return (
    <div className="page narrow tracking-page">
      <Link
        className="text-link"
        to={`/orders/${encodeURIComponent(displayId)}`}
      >
        ← Order details
      </Link>

      <div className="page-heading">
        <div>
          <h1>Track your order</h1>
          <p className="order-id">{displayId}</p>

          <span
            className={`status-pill ${
              cancelled ? "cancelled" : ""
            }`}
          >
            {formatOrderStatus(status)}
          </span>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={refreshing}
          onClick={refresh}
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh tracking"}
        </button>
      </div>

      <div className="notice">
        {isAccountOrder
          ? "Tracking details are synced with your GymDrobe account."
          : "Guest tracking details are stored on this device."}

        {lastUpdated && (
          <>
            {" "}
            Last checked:{" "}
            {formatOrderDate(lastUpdated)}.
          </>
        )}
      </div>

      {refreshError && (
        <p className="field-error" role="alert">
          {refreshError} Showing the last
          successfully loaded details.
        </p>
      )}

      {cancelled ? (
        <div className="notice">
          This order has been cancelled and will
          not be fulfilled.

          {order.cancellation?.reason && (
            <p>{order.cancellation.reason}</p>
          )}
        </div>
      ) : pending ? (
        <div className="notice">
          {paymentReceived
            ? "Payment has been recorded, but order confirmation is pending. Do not pay again."
            : "This order is awaiting payment confirmation. Delivery progress will appear after confirmation."}

          <p>
            Open your order details to check the
            latest payment status and available
            actions.
          </p>
        </div>
      ) : currentIndex >= 0 ? (
        <>
          <ol
            className="tracking-steps"
            aria-label="Delivery progress"
          >
            {stages.map((stage, index) => (
              <li
                key={stage}
                className={
                  index <= currentIndex
                    ? "done"
                    : ""
                }
                aria-current={
                  stage === status
                    ? "step"
                    : undefined
                }
              >
                <span aria-hidden="true">
                  {index < currentIndex
                    ? "✓"
                    : index + 1}
                </span>

                <strong>
                  {formatOrderStatus(stage)}
                </strong>
              </li>
            ))}
          </ol>

          <section className="panel">
            <h2>ORDER STATUS</h2>
            <p>{messages[status]}</p>

            {order.delivery?.deliveredAt && (
              <p className="muted">
                Delivered:{" "}
                {formatOrderDate(
                  order.delivery.deliveredAt,
                )}
              </p>
            )}
          </section>
        </>
      ) : (
        <div className="notice">
          Delivery progress is not available for
          this order status yet.
        </div>
      )}

      <OrderPaymentDetails order={order} />

      <section className="panel">
        <h2>SHIPMENT INFORMATION</h2>

        {order.tracking?.carrier ? (
          <p>
            <strong>Carrier:</strong>{" "}
            {order.tracking.carrier}
          </p>
        ) : (
          <p>
            {cancelled
              ? "This order is cancelled."
              : pending
                ? "Shipment information is awaiting order confirmation."
                : "A carrier has not been assigned yet."}
          </p>
        )}

        {order.tracking?.trackingNumber && (
          <p>
            <strong>Tracking number:</strong>{" "}
            {order.tracking.trackingNumber}
          </p>
        )}

        {!cancelled &&
          !pending &&
          order.tracking?.estimatedDelivery && (
            <p>
              <strong>Estimated delivery:</strong>{" "}
              {formatOrderDate(
                order.tracking.estimatedDelivery,
              )}
            </p>
          )}

        {order.delivery?.label && (
          <p>
            <strong>Delivery method:</strong>{" "}
            {order.delivery.label}
          </p>
        )}

        {order.delivery?.status && (
          <p>
            <strong>Recorded delivery status:</strong>{" "}
            {formatOrderStatus(
              order.delivery.status,
            )}
          </p>
        )}

        <p className="muted">
          Tracking updates reflect information
          recorded for your order.
        </p>
      </section>

      <section className="panel">
        <h2>ORDER ACTIVITY</h2>

        {events.length ? (
          events.map((event, index) => (
            <div
              className="tracking-event"
              key={`${
                event.status || "event"
              }-${event.timestamp || index}-${index}`}
            >
              <strong>
                {event.description ||
                  formatOrderStatus(event.status)}
              </strong>

              {event.status && (
                <p className="muted">
                  {formatOrderStatus(event.status)}
                </p>
              )}

              {event.timestamp && (
                <p>
                  {formatOrderDate(event.timestamp)}
                </p>
              )}
            </div>
          ))
        ) : (
          <p>
            No tracking events have been recorded yet.
          </p>
        )}
      </section>

      {address && (
        <section className="panel">
          <h2>DELIVERY ADDRESS</h2>

          <p>
            <strong>
              {address.fullName ||
                address.name ||
                order.customer?.name ||
                "Customer"}
            </strong>

            <br />

            {address.addressLine || address.address}

            {address.landmark && (
              <>
                <br />
                {address.landmark}
              </>
            )}

            <br />

            {[
              address.city,
              address.state,
              address.pincode,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>

          {address.phone && (
            <p>
              <strong>Phone:</strong>{" "}
              {address.phone}
            </p>
          )}
        </section>
      )}

      <div className="purchase-actions">
        <Link
          className="button secondary"
          to={`/orders/${encodeURIComponent(displayId)}`}
        >
          View order details
        </Link>

        <Link
          className="button secondary"
          to="/orders"
        >
          All orders
        </Link>

        <Link className="button" to="/shop">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}