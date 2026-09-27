import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getOrder, orderStatus } from "../utils/customerData.js";
import EmptyState from "../components/EmptyState.jsx";
const stages = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];
export default function OrderTrackingPage() {
  const { orderId } = useParams(),
    { user } = useAuth(),
    order = getOrder(orderId, user);
  if (!order)
    return (
      <EmptyState title="Order not found" to="/orders" label="My orders">
        Check your order history for available orders.
      </EmptyState>
    );
  const progressStatus = order.status === "packed" ? "processing" : order.status;
  const index = stages.indexOf(progressStatus),
    events = Array.isArray(order.tracking?.events) ? order.tracking.events : [];
  return (
    <div className="page narrow tracking-page">
      <Link
        className="text-link"
        to={`/orders/${encodeURIComponent(order.id)}`}
      >
        ← Order details
      </Link>
      <h1>Track your order</h1>
      <p className="order-id">{order.id}</p>
      <span className="status-pill">{orderStatus(order)}</span>
      {order.status === "cancelled" ? (
        <div className="notice">This order has been cancelled.</div>
      ) : (
        <ol className="tracking-steps">
          {stages.map((stage, i) => (
            <li
              key={stage}
              className={i <= index ? "done" : ""}
              aria-current={stage === progressStatus ? "step" : undefined}
            >
              <span aria-hidden="true">{i < index ? "✓" : i + 1}</span>
              <strong>{stage.replaceAll("-", " ")}</strong>
            </li>
          ))}
        </ol>
      )}
      <section className="panel">
        <h2>SHIPMENT INFORMATION</h2>
        {order.tracking?.carrier ? (
          <p>Carrier: {order.tracking.carrier}</p>
        ) : (
          <p>A carrier has not been assigned.</p>
        )}
        {order.tracking?.trackingNumber && (
          <p>Tracking number: {order.tracking.trackingNumber}</p>
        )}
        {order.tracking?.estimatedDelivery && (
          <p>Estimated delivery: {order.tracking.estimatedDelivery}</p>
        )}
        <p className="muted">
          Tracking shows recorded events only. This preview does not generate
          live shipping updates.
        </p>
      </section>
      <section className="panel">
        <h2>ORDER ACTIVITY</h2>
        {events.length ? (
          events.map((event, i) => (
            <div className="tracking-event" key={i}>
              <strong>{event.description || event.status}</strong>
              {event.timestamp && (
                <p>{new Date(event.timestamp).toLocaleString("en-IN")}</p>
              )}
            </div>
          ))
        ) : (
          <p>No tracking events have been recorded yet.</p>
        )}
      </section>
    </div>
  );
}