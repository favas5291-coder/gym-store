import useOrderUpdates from "../hooks/useOrderUpdates.js";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { getOrder, updateOrder } from "../utils/customerData.js";
import { returnEligibility, validateReturnItems } from "../utils/commerce.js";
import { makeId } from "../utils/storage.js";
import EmptyState from "../components/EmptyState.jsx";
export default function ReturnPage() {
  useOrderUpdates();
  const { user } = useAuth(),
    { orderId } = useParams(),
    { products } = useCatalog(),
    { notify } = useStore(),
    navigate = useNavigate();
  const order = getOrder(orderId, user);
  const [type, setType] = useState("return"),
    [chosen, setChosen] = useState({}),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  if (!order)
    return (
      <EmptyState title="Order not found" to="/orders" label="View orders" />
    );
  const eligibility = returnEligibility(order);
  function submit(e) {
    e.preventDefault();
    const current = getOrder(orderId, user);
    if (!current || !returnEligibility(current).eligible) {
      setError(
        "This order is no longer eligible. Reopen the order or contact support.",
      );
      return;
    }
    const items = Object.entries(chosen)
      .filter(([, row]) => row.selected)
      .map(([index, row]) => ({
        index: Number(index),
        quantity: Number(row.quantity),
        size: row.size || null,
        color: row.color || null,
      }));
    const invalid = validateReturnItems(current, items, products, type);
    if (invalid || reason.trim().length < 5) {
      setError(
        invalid || "Please describe the reason in at least 5 characters.",
      );
      return;
    }
    const next = updateOrder(orderId, user, (old) => ({
      ...old,
      returnRequest: {
        id: makeId("RET"),
        type,
        status: "requested",
        items,
        reason: reason.trim(),
        requestedAt: new Date().toISOString(),
      },
    }));
    if (!next) {
      setError("Unable to save your request. Please try again.");
      return;
    }
    notify("Your preview request was saved for review.");
    navigate(`/orders/${encodeURIComponent(orderId)}`);
  }
  return (
    <div className="page narrow">
      <Link className="text-link" to={`/orders/${encodeURIComponent(orderId)}`}>
        ← Order details
      </Link>
      <div className="page-heading">
        <h1>Return or exchange</h1>
      </div>
      {!eligibility.eligible ? (
        <div className="panel">
          <p>{eligibility.message}</p>
          <Link
            className="button"
            to={`/help?order=${encodeURIComponent(orderId)}`}
          >
            Contact support
          </Link>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="notice">
            Submit by {new Date(eligibility.deadline).toLocaleString("en-IN")}.
            Requests are recorded for review in this preview. Collection,
            exchange dispatch and refunds are not automatic.
          </p>
          <fieldset className="option-field">
            <legend>WHAT WOULD YOU LIKE TO DO?</legend>
            <label className="check">
              <input
                type="radio"
                name="request-type"
                checked={type === "return"}
                onChange={() => setType("return")}
              />
              Return selected items
            </label>
            <label className="check">
              <input
                type="radio"
                name="request-type"
                checked={type === "exchange"}
                onChange={() => setType("exchange")}
              />
              Exchange size or colour
            </label>
          </fieldset>
          {order.items.map((item, index) => {
            const product = products.find(
              (p) => String(p.id) === String(item.id),
            );
            const row = chosen[index] || {
              selected: false,
              quantity: 1,
              size: item.selectedSize || "",
              color: item.selectedColor || "",
            };
            const change = (update) =>
              setChosen((old) => ({ ...old, [index]: { ...row, ...update } }));
            return (
              <section className="panel" key={index}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => change({ selected: e.target.checked })}
                  />
                  <strong>{item.name}</strong>
                </label>
                <p>
                  {[item.selectedColor, item.selectedSize]
                    .filter(Boolean)
                    .join(" / ")}{" "}
                  · Ordered quantity {item.quantity}
                </p>
                {row.selected && (
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`return-qty-${index}`}>Quantity</label>
                      <input
                        id={`return-qty-${index}`}
                        type="number"
                        min="1"
                        max={item.quantity}
                        required
                        value={row.quantity}
                        onChange={(e) => change({ quantity: e.target.value })}
                      />
                    </div>
                    {type === "exchange" && (
                      <>
                        {product?.sizes?.length > 0 && (
                          <div className="field">
                            <label htmlFor={`return-size-${index}`}>
                              Replacement size
                            </label>
                            <select
                              id={`return-size-${index}`}
                              value={row.size}
                              onChange={(e) => change({ size: e.target.value })}
                            >
                              {product.sizes.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {product?.colors?.length > 0 && (
                          <div className="field">
                            <label htmlFor={`return-color-${index}`}>
                              Replacement colour
                            </label>
                            <select
                              id={`return-color-${index}`}
                              value={row.color}
                              onChange={(e) =>
                                change({ color: e.target.value })
                              }
                            >
                              {product.colors.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <p className="muted">
                          Availability is checked when you submit. A request
                          does not reserve replacement stock.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}
          <div className="field">
            <label htmlFor="return-reason">Reason</label>
            <textarea
              id="return-reason"
              required
              minLength="5"
              maxLength="1000"
              rows="4"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="button" type="submit">
            Submit request for review
          </button>
        </form>
      )}
    </div>
  );
}