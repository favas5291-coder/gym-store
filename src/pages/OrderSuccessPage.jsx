import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getOrder, orderTotal } from "../utils/customerData.js";
import { money } from "../utils/productPricing.js";
import EmptyState from "../components/EmptyState.jsx";
export default function OrderSuccessPage() {
  const [params] = useSearchParams(),
    { user } = useAuth();
  const order = getOrder(params.get("orderId"), user);
  if (!order)
    return (
      <EmptyState title="Order not found" to="/orders" label="View my orders">
        Open your order history to see orders saved for this account or guest
        session.
      </EmptyState>
    );
  return (
    <div className="success-page">
      <span className="success-check" aria-hidden="true">
        ✓
      </span>
      <p className="eyebrow">THANK YOU FOR CHOOSING GYMDROBE</p>
      <h1>Your preview order is saved.</h1>
      <p>No payment has been taken. This order is stored on this device.</p>
      <div className="success-order">
        <strong>{order.id}</strong>
        <span>
          {order.items.reduce((n, i) => n + i.quantity, 0)} items ·{" "}
          {money(orderTotal(order))}
        </span>
        <p>
          {order.customer?.name}
          <br />
          {order.shippingAddress?.city}, {order.shippingAddress?.pincode}
        </p>
      </div>
      <div className="purchase-actions">
        <Link className="button" to={`/orders/${encodeURIComponent(order.id)}`}>
          View order
        </Link>
        <Link className="button secondary" to="/shop">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}