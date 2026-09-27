import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getOrder, orderTotal } from "../utils/customerData.js";
import { money } from "../utils/productPricing.js";
import { csvCell, downloadText } from "../utils/commerce.js";
import EmptyState from "../components/EmptyState.jsx";
export default function ReceiptPage() {
  const { user } = useAuth(),
    { orderId } = useParams(),
    order = getOrder(orderId, user);
  if (!order)
    return (
      <EmptyState title="Receipt not found" to="/orders" label="View orders">
        This order is not available for your current session.
      </EmptyState>
    );
  const address = order.shippingAddress || {};
  function csv() {
    const rows = [
      ["Order", order.id],
      ["Date", order.createdAt],
      ["Status", order.status],
      [],
      ["Product", "Size", "Colour", "Quantity", "Unit INR", "Line INR"],
      ...order.items.map((i) => [
        i.name,
        i.selectedSize,
        i.selectedColor,
        i.quantity,
        i.price,
        i.quantity * i.price,
      ]),
      [],
      ["Items subtotal INR", order.pricing?.subtotal],
      ["Coupon savings INR", order.pricing?.couponDiscount],
      ["Delivery INR", order.pricing?.shipping],
      ["Order total INR", orderTotal(order)],
      [
        "Payment",
        `${order.payment?.method || "cod"} / ${order.payment?.status || "pending"}`,
      ],
    ];
    downloadText(
      `${order.id}-receipt.csv`,
      rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <div className="page narrow receipt-page">
      <div className="receipt-actions">
        <Link
          className="text-link"
          to={`/orders/${encodeURIComponent(order.id)}`}
        >
          ← Order details
        </Link>
        <div className="purchase-actions">
          <button className="button secondary" type="button" onClick={csv}>
            Download CSV
          </button>
          <button
            className="button"
            type="button"
            onClick={() => window.print()}
          >
            Print / save PDF
          </button>
        </div>
      </div>
      <article className="receipt-sheet">
        <div className="page-heading">
          <div>
            <p className="eyebrow">GYMDROBE</p>
            <h1>Order receipt</h1>
          </div>
          <span className="status-pill">Preview</span>
        </div>
        <p className="order-id">{order.id}</p>
        <p>{new Date(order.createdAt).toLocaleString("en-IN")}</p>
        <p className="notice">
          This is a preview order summary, not a tax invoice or proof of
          payment.
        </p>
        <h2>DELIVER TO</h2>
        <p>
          {address.fullName || address.name}
          <br />
          {address.addressLine || address.address}
          <br />
          {address.city}, {address.state} {address.pincode}
          <br />
          {address.phone}
        </p>
        <div className="comparison-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Qty</th>
                <th scope="col">Unit price</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td>
                    {item.name}
                    <small>
                      {[item.selectedColor, item.selectedSize]
                        .filter(Boolean)
                        .join(" / ")}
                    </small>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price)}</td>
                  <td>{money(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="receipt-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(order.pricing?.subtotal)}</dd>
          </div>
          <div>
            <dt>Coupon savings</dt>
            <dd>−{money(order.pricing?.couponDiscount)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>{money(order.pricing?.shipping)}</dd>
          </div>
          <div>
            <dt>
              <strong>Total</strong>
            </dt>
            <dd>
              <strong>{money(orderTotal(order))}</strong>
            </dd>
          </div>
        </dl>
        <p>
          Payment: {order.payment?.method || "cod"} ·{" "}
          {order.payment?.status || "pending"}
        </p>
        {order.giftMessage && (
          <p>
            <strong>Gift message:</strong> {order.giftMessage}
          </p>
        )}
        {order.orderNote && (
          <p>
            <strong>Delivery instructions:</strong> {order.orderNote}
          </p>
        )}
      </article>
    </div>
  );
}