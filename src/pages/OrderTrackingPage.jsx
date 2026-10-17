import {
  Link,
  useParams,
} from "react-router-dom";

import useCustomerOrder from "../hooks/useCustomerOrder.js";

import EmptyState from "../components/EmptyState.jsx";

import KitFulfillmentTracking from "../components/KitFulfillmentTracking.jsx";

import OrderPaymentDetails, {
  formatOrderDate,
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import {
  trackingEvents,
  trackingText,
} from "../utils/orderTracking.js";

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
        <div
          className="empty-state"
          role="status"
        >
          <h1>Loading tracking…</h1>
          <p>Getting your order information.</p>
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

        <div className="purchase-actions">
          <button
            className="button secondary"
            type="button"
            disabled={refreshing}
            onClick={refresh}
          >
            {refreshing ? "Retrying…" : "Retry"}
          </button>

          <Link
            className="button secondary"
            to="/login"
          >
            Sign in
          </Link>

          <Link
            className="text-link"
            to="/help"
          >
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page narrow tracking-page">
        <EmptyState
          title="Order not found"
          to="/orders"
          label="My orders"
        >
          Check your order history for available orders.
        </EmptyState>
      </div>
    );
  }

  const displayId =
    order.orderNumber || order.id || orderId;

  const detailsPath =
    `/orders/${encodeURIComponent(
      order.id || order._id || orderId,
    )}`;

  const events = trackingEvents(order);

  const cancelled =
    order.status === "cancelled" ||
    order.cancellation?.status === "cancelled";

  const address = order.shippingAddress;

  const request = order.returnRequest || {};

  const hasRequest = [
    "requested",
    "approved",
    "rejected",
    "completed",
  ].includes(request.status);

  return (
    <div className="page narrow tracking-page">
      <Link
        className="text-link"
        to={detailsPath}
      >
        ← Order details
      </Link>

      <div className="page-heading">
        <div>
          <h1>Track your order</h1>
          <p className="order-id">{displayId}</p>
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

      <p className="notice">
        {isAccountOrder
          ? "These details come from your GymDrobe account order. Tracking refreshes while this page is open."
          : "Local preview only. These details are stored on this device and are not live tracking or proof of a real order."}

        {lastUpdated && (
          <>
            {" "}
            Last checked:{" "}
            {formatOrderDate(lastUpdated)}.
          </>
        )}
      </p>

      {refreshError && (
        <p
          className="field-error"
          role="alert"
        >
          {refreshError} Showing the last successfully
          loaded details. Refresh or contact support
          for an update.
        </p>
      )}

      <KitFulfillmentTracking order={order} />

      {order.status === "payment-pending" && (
        <p>
          <Link
            className="text-link"
            to={detailsPath}
          >
            Check payment and available actions →
          </Link>
        </p>
      )}

      {cancelled &&
        trackingText(order.cancellation?.reason) && (
          <section className="panel">
            <h2>CANCELLATION DETAILS</h2>

            <p>{order.cancellation.reason}</p>

            <p>
              Previous shipment information is historical.
              Contact support if a parcel still arrives.
              Check payment details for refund progress.
            </p>
          </section>
        )}

      <OrderPaymentDetails order={order} />

      <section className="panel">
        <h2>DELIVERY INFORMATION</h2>

        {trackingText(order.delivery?.label) && (
          <p>
            <strong>Delivery method:</strong>{" "}
            {order.delivery.label}
          </p>
        )}

        <p className="muted">
          Updates reflect information recorded for your
          order. Refreshing this page checks GymDrobe’s
          saved updates. For the courier’s latest
          information, use Track with Courier when
          available above.
        </p>
      </section>

      {hasRequest && (
        <section className="panel">
          <h2>RETURN / EXCHANGE PROGRESS</h2>

          <p>
            {request.type === "exchange"
              ? "Exchange"
              : "Return"}{" "}
            request:{" "}
            {formatOrderStatus(request.status)}.
          </p>

          <p>
            This request is separate from the
            original order&apos;s delivery progress.
            View order details for the store
            response, inspection and refund
            information.
          </p>

          <Link
            className="text-link"
            to={detailsPath}
          >
            View request details →
          </Link>
        </section>
      )}

      <section className="panel">
        <h2>ORDER ACTIVITY</h2>

        {events.length ? (
          events.map((event) => (
            <div
              className="tracking-event"
              key={event.key}
            >
              <strong>
                {event.description ||
                  formatOrderStatus(event.status)}
              </strong>

              {event.status &&
                event.description && (
                  <p className="muted">
                    {formatOrderStatus(
                      event.status,
                    )}
                  </p>
                )}

              <p>
                {event.timestamp
                  ? formatOrderDate(
                      event.timestamp,
                    )
                  : "Event time not recorded or needs confirmation."}
              </p>
            </div>
          ))
        ) : (
          <p>
            No tracking events have been recorded yet.
          </p>
        )}
      </section>

      {address &&
        typeof address === "object" && (
          <section className="panel">
            <h2>DELIVERY ADDRESS</h2>

            <p>
              <strong>
                {trackingText(
                  address.fullName,
                ) ||
                  trackingText(address.name) ||
                  "Customer"}
              </strong>

              <br />

              {trackingText(
                address.addressLine,
              ) ||
                trackingText(address.address)}

              <br />

              {trackingText(
                address.landmark,
              ) && (
                <>
                  {address.landmark}
                  <br />
                </>
              )}

              {[
                address.city,
                address.state,
                address.pincode,
              ]
                .map(trackingText)
                .filter(Boolean)
                .join(", ")}
            </p>

            {trackingText(address.phone) && (
              <p>
                <strong>Phone:</strong>{" "}
                {address.phone}
              </p>
            )}
          </section>
        )}

      <section className="panel">
        <h2>NEED HELP WITH THIS ORDER?</h2>

        <p>
          Contact GymDrobe with order number{" "}
          <strong>{displayId}</strong> for
          delivery issues, incorrect items or
          payment questions.
        </p>

        <Link
          className="button secondary"
          to="/help"
        >
          Contact support
        </Link>
      </section>

      <div className="purchase-actions">
        <Link
          className="button secondary"
          to={detailsPath}
        >
          View order details
        </Link>

        <Link
          className="button secondary"
          to="/orders"
        >
          All orders
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