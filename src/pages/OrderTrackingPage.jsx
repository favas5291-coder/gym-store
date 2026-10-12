import {
  Link,
  useParams,
} from "react-router-dom";

import useCustomerOrder from "../hooks/useCustomerOrder.js";

import EmptyState from "../components/EmptyState.jsx";

import OrderPaymentDetails, {
  formatOrderDate,
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import {
  TRACKING_STAGES,
  TRACKING_MESSAGES,
  trackingSummary,
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

  const {
    status,
    events,
    deliveredAt,
    currentIndex,
    cancelled,
    pending,
    estimate,
  } = trackingSummary(order);

  const paymentReceived =
    ["paid", "partially-paid"].includes(
      order.payment?.status,
    ) ||
    Number(order.payment?.amountPaid) > 0 ||
    Boolean(order.payment?.verifiedAt);

  const address = order.shippingAddress;

  const carrier = trackingText(
    order.tracking?.carrier,
  );

  const trackingNumber = trackingText(
    order.tracking?.trackingNumber,
  );

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

      <p className="notice">
        {isAccountOrder
          ? "These details come from your GymDrobe account order."
          : "Local preview only. These details are stored on this device and are not live tracking or proof of a real order."}

        {lastUpdated && (
          <>
            {" "}
            Last checked:{" "}
            {formatOrderDate(lastUpdated)}.
          </>
        )}
      </p>

      {order.metadata?.demo === true && (
        <p className="notice">
          Test order. The recorded payment used
          Razorpay test mode.
        </p>
      )}

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

      {cancelled ? (
        <section className="panel">
          <h2>ORDER CANCELLED</h2>

          <p>
            This order is recorded as cancelled.
            Check payment details below for its
            refund status.
          </p>

          {trackingText(
            order.cancellation?.reason,
          ) && (
            <p>{order.cancellation.reason}</p>
          )}

          <p>
            Any previous shipment information below
            is historical. Contact support if a
            parcel still arrives.
          </p>
        </section>
      ) : pending ? (
        <section className="panel">
          <h2>ORDER CONFIRMATION PENDING</h2>

          <p>
            {paymentReceived
              ? "Payment has been recorded, but order confirmation is pending. Do not pay again."
              : "Payment confirmation has not been recorded. If money was deducted, do not pay again; contact support with your order number."}
          </p>

          <Link
            className="text-link"
            to={detailsPath}
          >
            Check payment and available actions →
          </Link>
        </section>
      ) : currentIndex >= 0 ? (
        <>
          <ol
            className="tracking-steps"
            aria-label="Delivery progress"
          >
            {TRACKING_STAGES.map(
              (stage, index) => (
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
              ),
            )}
          </ol>

          <section className="panel">
            <h2>ORDER STATUS</h2>

            <p>{TRACKING_MESSAGES[status]}</p>

            {status === "delivered" && (
              <p className="muted">
                {deliveredAt
                  ? `Recorded delivery: ${formatOrderDate(
                      deliveredAt,
                    )}.`
                  : "The delivery date has not been recorded. Contact support to confirm it."}
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="notice">
          Delivery progress is not available for
          this order status. Contact support for
          an update.
        </p>
      )}

      <OrderPaymentDetails order={order} />

      <section className="panel">
        <h2>
          {cancelled
            ? "PREVIOUS SHIPMENT INFORMATION"
            : "SHIPMENT INFORMATION"}
        </h2>

        {pending ? (
          <p>
            Shipment information will appear after
            order confirmation.
          </p>
        ) : (
          <>
            <p>
              {carrier ? (
                <>
                  <strong>Carrier:</strong>{" "}
                  {carrier}
                </>
              ) : cancelled ? (
                "No carrier was recorded."
              ) : (
                "A carrier has not been recorded yet."
              )}
            </p>

            {trackingNumber && (
              <p
                style={{
                  overflowWrap: "anywhere",
                }}
              >
                <strong>Tracking number:</strong>{" "}
                {trackingNumber}
              </p>
            )}
          </>
        )}

        {estimate && (
          <>
            <p>
              <strong>Estimated delivery:</strong>{" "}
              {estimate.label}
            </p>

            <p
              className={
                estimate.overdue
                  ? "notice"
                  : "muted"
              }
            >
              {estimate.overdue
                ? "The recorded estimated date has passed. Delivery is not yet recorded as completed. Contact support for an updated estimate."
                : "This is an estimate, not a guaranteed delivery date."}
            </p>
          </>
        )}

        {!cancelled &&
          !pending &&
          status !== "delivered" &&
          !estimate && (
            <p className="muted">
              A valid delivery estimate has not
              been recorded yet.
            </p>
          )}

        {trackingText(order.delivery?.label) && (
          <p>
            <strong>Delivery method:</strong>{" "}
            {order.delivery.label}
          </p>
        )}

        <p className="muted">
          Updates reflect information recorded for
          your order. Refreshing this page does not
          contact the courier directly.
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