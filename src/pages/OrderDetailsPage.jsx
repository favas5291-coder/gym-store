import useOrderUpdates from "../hooks/useOrderUpdates.js";
import { useCatalog } from "../context/CatalogContext.jsx";
import { returnEligibility } from "../utils/commerce.js";
import {
  getCartItemKey,
  normalizeCartItem,
  validateCartItem,
} from "../utils/cartUtils.js";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import {
  getOrder,
  orderStatus,
  orderTotal,
  updateOrder,
} from "../utils/customerData.js";
import { money } from "../utils/productPricing.js";
import { ProductImage, productPath } from "../components/StorefrontShared.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";
function OrderDetail({ id }) {
  const revision = useOrderUpdates();
  const { products } = useCatalog();
  const store = useStore();
  const { user } = useAuth(),
    { notify } = useStore();
  const [order, setOrder] = useState(() => getOrder(id, user)),
    [action, setAction] = useState(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  useEffect(() => { setOrder(getOrder(id, user)); }, [id, user?.id, revision]);
  if (!order)
    return (
      <EmptyState title="Order not found" to="/orders" label="View my orders">
        This order is not available for the current account or guest session.
      </EmptyState>
    );
  const address = order.shippingAddress || {},
    canCancel = ["confirmed", "pending", "processing"].includes(order.status),
    canReturn = returnEligibility(order).eligible;
  function reorder() {
    let next = [...store.cart],
      added = 0;
    const skipped = [];
    for (const item of order.items) {
      const product = products.find((p) => String(p.id) === String(item.id));
      const key = getCartItemKey(item),
        existing = next.find((row) => getCartItemKey(row) === key);
      const quantity = item.quantity + (existing?.quantity || 0);
      const check = validateCartItem(
        product,
        quantity,
        item.selectedSize,
        item.selectedColor,
      );
      if (!check.valid) {
        skipped.push(item.name);
        continue;
      }
      next = [
        ...next.filter((row) => getCartItemKey(row) !== key),
        normalizeCartItem(
          product,
          quantity,
          item.selectedSize,
          item.selectedColor,
        ),
      ];
      added++;
    }
    store.setCart(next);
    notify(
      `${added} selections added at current prices.${skipped.length ? ` Unavailable: ${skipped.join(", ")}.` : ""}`,
      skipped.length ? "info" : "success",
    );
  }
  function confirm(event) {
    event.preventDefault();
    if (reason.trim().length < 5) {
      setError("Please tell us the reason in at least 5 characters.");
      return;
    }
    const current = getOrder(id, user);
    if (
      !current ||
      (action === "cancel" &&
        !["confirmed", "pending", "processing"].includes(current.status)) ||
      (action === "return" &&
        (current.status !== "delivered" ||
          (current.returnRequest?.status &&
            current.returnRequest.status !== "not-requested")))
    ) {
      setError("The order status changed. Please reload the order.");
      return;
    }
    const now = new Date().toISOString();
    const next = updateOrder(id, user, (old) =>
      action === "cancel"
        ? {
            ...old,
            status: "cancelled",
            cancellation: {
              status: "cancelled",
              reason: reason.trim(),
              cancelledAt: now,
            },
            tracking: {
              ...old.tracking,
              events: [
                ...(old.tracking?.events || []),
                {
                  status: "cancelled",
                  description: "Preview cancellation saved",
                  timestamp: now,
                },
              ],
            },
          }
        : {
            ...old,
            returnRequest: {
              status: "requested",
              reason: reason.trim(),
              requestedAt: now,
            },
          },
    );
    if (!next) {
      setError("Unable to save this change. Please try again.");
      return;
    }
    setOrder(next);
    setAction(null);
    notify(
      action === "cancel"
        ? "Preview order cancelled."
        : "Preview return request saved.",
    );
  }
  return (
    <div className="page narrow">
      <Link className="text-link" to="/orders">
        ← All orders
      </Link>
      <div className="page-heading">
        <div>
          <h1>Order details</h1>
          <p className="order-id">{order.id}</p>
        </div>
        <span className="status-pill">{orderStatus(order)}</span>
      </div>
      <div className="notice">
        Preview order history. Changes are saved on this device; no carrier or
        payment provider is connected.
      </div>
      <div className="checkout-layout">
        <div>
          {order.items.map((item, index) => (
            <article className="bag-item" key={index}>
              <Link className="bag-photo" to={productPath(item.id)}>
                <ProductImage product={item} />
              </Link>
              <div className="bag-copy">
                <h2>{item.name}</h2>
                <p>
                  {[
                    item.selectedColor,
                    item.selectedSize && `Size ${item.selectedSize}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p>Quantity: {item.quantity}</p>
                <strong>{money(item.price * item.quantity)}</strong>
                <p>
                  <Link className="text-link" to={productPath(item.id)}>
                    View product
                  </Link>
                </p>
              </div>
            </article>
          ))}
          <div className="panel">
            <h2>DELIVERY ADDRESS</h2>
            <strong>{address.fullName || address.name}</strong>
            <p>
              {address.addressLine || address.address}
              <br />
              {address.city}, {address.state} – {address.pincode}
            </p>
            <p>{address.phone}</p>
          </div>
          {order.giftMessage && (
            <p className="panel">
              <strong>Gift message:</strong> {order.giftMessage}
            </p>
          )}
          {order.orderNote && (
            <p className="panel">
              <strong>Delivery instructions:</strong> {order.orderNote}
            </p>
          )}
          <div className="purchase-actions">
            <Link
              className="button secondary"
              to={`/orders/${encodeURIComponent(order.id)}/receipt`}
            >
              View receipt
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={reorder}
            >
              Buy again
            </button>
            <Link
              className="button secondary"
              to={`/help?order=${encodeURIComponent(order.id)}`}
            >
              Get order help
            </Link>
            <Link
              className="button secondary"
              to={`/orders/${encodeURIComponent(order.id)}/track`}
            >
              Track order
            </Link>
            {canCancel && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setAction("cancel");
                  setReason("");
                  setError("");
                }}
              >
                Cancel order
              </button>
            )}
            {canReturn && (
              <Link
                className="button secondary"
                to={`/orders/${encodeURIComponent(order.id)}/return`}
              >
                Return / exchange items
              </Link>
            )}
          </div>
          {order.cancellation?.reason && (
            <p className="muted">
              Cancellation reason: {order.cancellation.reason}
            </p>
          )}
          {order.returnRequest?.status &&
            order.returnRequest.status !== "not-requested" && (
              <section className="panel">
                <h3>
                  {order.returnRequest.type === "exchange"
                    ? "Exchange"
                    : "Return"}{" "}
                  request · {order.returnRequest.status}
                </h3>
                <p>{order.returnRequest.reason}</p>
                {order.returnRequest.items?.map((row) => (
                  <p key={row.index}>
                    {order.items[row.index]?.name} × {row.quantity}
                    {order.returnRequest.type === "exchange"
                      ? ` → ${[row.color, row.size].filter(Boolean).join(" / ")}`
                      : ""}
                  </p>
                ))}
                {order.returnRequest.response && (
                  <p>Store preview response: {order.returnRequest.response}</p>
                )}
                <p className="muted">
                  No refund or replacement shipment has been issued by this
                  preview.
                </p>
              </section>
            )}
        </div>
        <aside className="panel order-totals">
          <h2>PAYMENT DETAILS</h2>
          <dl>
            <div>
              <dt>Items subtotal</dt>
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
            <div className="total">
              <dt>Total</dt>
              <dd>{money(orderTotal(order))}</dd>
            </div>
          </dl>
          <p>
            Method:{" "}
            {order.payment?.method === "cod" || order.paymentMethod === "cod"
              ? "Cash on delivery"
              : order.payment?.method || "Not recorded"}
          </p>
          <p>Status: {order.payment?.status || "pending"}</p>
        </aside>
      </div>
      {action && (
        <Modal
          title={
            action === "cancel" ? "Cancel this order?" : "Request a return"
          }
          onClose={() => setAction(null)}
        >
          <form onSubmit={confirm}>
            <p>This action updates your preview order on this device.</p>
            <div className="field">
              <label htmlFor="order-action-reason">Reason</label>
              <textarea
                id="order-action-reason"
                rows="4"
                required
                minLength="5"
                maxLength="500"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="button full">
              {action === "cancel"
                ? "Confirm cancellation"
                : "Submit return request"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { user } = useAuth();
  return <OrderDetail key={`${orderId}-${user?.id || "guest"}`} id={orderId} />;
}