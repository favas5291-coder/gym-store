import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import {
  getOrder,
  updateOrder,
} from "../utils/customerData.js";
import {
  returnEligibility,
  validateReturnItems,
} from "../utils/commerce.js";
import EmptyState from "../components/EmptyState.jsx";

export default function ReturnPage() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const { products } = useCatalog();
  const { notify } = useStore();
  const navigate = useNavigate();
  const order = getOrder(orderId, user);
  const [type, setType] = useState("return");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() =>
    order?.items.map((item, index) => ({
      index,
      quantity: item.quantity,
      size: item.selectedSize ?? null,
      color: item.selectedColor ?? null,
      checked: false,
    })) || [],
  );
  if (!order)
    return (
      <EmptyState title="Order not found" to="/orders" label="View my orders">
        This order is not available for the current account or guest session.
      </EmptyState>
    );
  const eligibility = returnEligibility(order);
  function submit(event) {
    event.preventDefault();
    const requested = selected
      .filter((item) => item.checked)
      .map(({ checked, ...item }) => item);
    const validation = eligibility.eligible
      ? validateReturnItems(order, requested, products, type)
      : eligibility.message;
    if (validation || reason.trim().length < 5) {
      setError(validation || "Tell us the reason in at least 5 characters.");
      return;
    }
    const next = updateOrder(order.id, user, (current) => ({
      ...current,
      returnRequest: {
        status: "requested",
        type,
        reason: reason.trim(),
        items: requested,
        requestedAt: new Date().toISOString(),
      },
    }));
    if (!next) {
      setError("Unable to save this request. Please try again.");
      return;
    }
    notify(`${type === "exchange" ? "Exchange" : "Return"} request saved.`);
    navigate(`/orders/${encodeURIComponent(order.id)}`);
  }
  return (
    <div className="page narrow">
      <Link className="text-link" to={`/orders/${encodeURIComponent(order.id)}`}>
        ← Order details
      </Link>
      <div className="page-heading">
        <h1>Return or exchange items</h1>
        <span className="order-id">{order.id}</span>
      </div>
      <p className="notice">
        This preview records a request on this device. It does not book a collection,
        issue a refund, or create a replacement shipment.
      </p>
      {!eligibility.eligible ? (
        <div className="empty-state">
          <h2>Return window unavailable</h2>
          <p>{eligibility.message}</p>
        </div>
      ) : (
        <form className="panel" onSubmit={submit}>
          <div className="field">
            <label htmlFor="return-type">Request type</label>
            <select id="return-type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="return">Return for refund review</option>
              <option value="exchange">Exchange for another size or colour</option>
            </select>
          </div>
          <fieldset>
            <legend>Select items</legend>
            {order.items.map((item, index) => {
              const row = selected[index];
              const product = products.find((entry) => String(entry.id) === String(item.id));
              return (
                <div className="field" key={`${item.id}-${index}`}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={() => setSelected((old) => old.map((entry, i) => i === index ? { ...entry, checked: !entry.checked } : entry))}
                    />
                    {item.name} ({item.quantity})
                  </label>
                  {row.checked && (
                    <div className="inline-form">
                      <label>Quantity <input type="number" min="1" max={item.quantity} value={row.quantity} onChange={(event) => setSelected((old) => old.map((entry, i) => i === index ? { ...entry, quantity: Number(event.target.value) } : entry))} /></label>
                      {type === "exchange" && product?.sizes?.length > 0 && (
                        <label>Size <select value={row.size || ""} onChange={(event) => setSelected((old) => old.map((entry, i) => i === index ? { ...entry, size: event.target.value || null } : entry))}>{product.sizes.map((size) => <option key={size}>{size}</option>)}</select></label>
                      )}
                      {type === "exchange" && product?.colors?.length > 0 && (
                        <label>Colour <select value={row.color || ""} onChange={(event) => setSelected((old) => old.map((entry, i) => i === index ? { ...entry, color: event.target.value || null } : entry))}>{product.colors.map((color) => <option key={color}>{color}</option>)}</select></label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>
          <div className="field">
            <label htmlFor="return-reason">Reason</label>
            <textarea id="return-reason" rows="5" minLength="5" maxLength="500" required value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button" type="submit">Submit request</button>
        </form>
      )}
    </div>
  );
}
