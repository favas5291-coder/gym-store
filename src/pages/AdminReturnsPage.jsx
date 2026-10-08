import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import {
  getAdminReturnRequests,
  reviewReturnRequest,
  completeReturnRequest,
  recordReturnRefund,
} from "../services/adminOrderApi.js";

import { money } from "../utils/productPricing.js";
import "./AdminReturnsPage.css";

const FILTERS = ["requested", "approved", "completed", "rejected", "all"];

function label(value) {
  return String(value || "Not recorded")
    .replaceAll("-", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function date(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : parsed.toLocaleString("en-IN");
}

function amount(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function showMoney(value) {
  const parsed = amount(value);
  return parsed === null ? "Not recorded" : money(parsed);
}

function orderId(order) {
  return order.orderNumber || order.id;
}

function variant(size, color) {
  return [
    color,
    size != null && size !== "" ? `Size ${size}` : "",
  ].filter(Boolean).join(" · ") || "Default variant";
}

function nextStep(order) {
  const request = order.returnRequest || {};

  if (request.status === "requested") {
    return "Check the selected items and reason, then approve or reject.";
  }

  if (request.status === "approved") {
    return "Receive and inspect the original items before completing.";
  }

  if (request.status === "rejected") {
    return "The request was rejected. The customer can read your response.";
  }

  if (request.type === "exchange" && request.status === "completed") {
    return "The exchange is completed. Check replacement dispatch separately.";
  }

  if (
    request.status === "completed" &&
    ["pending", "manual-required"].includes(order.refund?.status)
  ) {
    return "Reconcile the collected payment before sending and recording a refund.";
  }

  if (order.refund?.status === "refunded") {
    return "The refund is recorded as completed.";
  }

  return "Check the recorded request and refund details.";
}

function RequestCard({
  order,
  busy,
  working,
  response,
  reference,
  onResponse,
  onReference,
  onAction,
}) {
  const id = orderId(order);
  const request = order.returnRequest || {};
  const refund = order.refund || {};
  const exchange = request.type === "exchange";
  const paid = amount(order.payment?.amountPaid);
  const refundAmount = amount(refund.amount);

  const needsRefund =
    !exchange &&
    request.status === "completed" &&
    ["pending", "manual-required"].includes(refund.status) &&
    refundAmount !== null &&
    refundAmount > 0;

  const refundAllowed =
    paid !== null &&
    refundAmount !== null &&
    refundAmount <= paid;

  const rows = Array.isArray(request.items) ? request.items : [];

  const validItems =
    rows.length > 0 &&
    rows.every((row) => {
      const item = order.items?.[row.index];
      return (
        Number.isSafeInteger(row.index) &&
        row.index >= 0 &&
        item &&
        Number.isSafeInteger(row.quantity) &&
        row.quantity > 0 &&
        row.quantity <= Number(item.quantity)
      );
    }) &&
    new Set(rows.map((row) => row.index)).size === rows.length;

  return (
    <article className="panel ar-card" aria-busy={working}>
      <header className="ar-heading">
        <div>
          <h2>{exchange ? "Exchange" : "Return"} · {id}</h2>
          <p className="muted">
            Request {request.id || "Not recorded"} · {date(request.requestedAt)}
          </p>
        </div>
        <span className="status-pill">{label(request.status)}</span>
      </header>

      <p className="notice">
        <strong>Next step:</strong> {nextStep(order)}
      </p>

      <div className="ar-columns">
        <section>
          <h3>Customer and request</h3>
          <strong>
            {order.customer?.name ||
              order.user?.name ||
              order.shippingAddress?.fullName ||
              "Customer"}
          </strong>
          <p>
            {order.customer?.email ||
              order.user?.email ||
              order.shippingAddress?.email}
          </p>
          <p>{order.customer?.phone || order.shippingAddress?.phone}</p>
          <p><strong>Reason:</strong> {request.reason || "Not recorded"}</p>
          <Link className="text-link" to="/admin/orders">
            Open admin orders
          </Link>
          <p className="muted">Find order {id} in admin orders.</p>
        </section>

        <section>
          <h3>Recorded payment</h3>
          <dl className="ar-facts">
            {[
              ["Method", label(order.payment?.method || order.paymentMethod)],
              ["Payment status", label(order.payment?.status)],
              ["Amount paid", showMoney(paid)],
              ["Balance due", showMoney(order.payment?.amountDue)],
              ["COD collection status", label(order.payment?.balanceStatus)],
            ].map(([title, value]) => (
              <div key={title}><dt>{title}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <p className="muted">
            Check collected payment and previous refunds before sending money.
            The current item calculation applies coupon savings and excludes shipping.
          </p>
        </section>
      </div>

      <section className="ar-section">
        <h3>Requested items</h3>
        {!validItems && (
          <p className="field-error">
            Requested items are missing or invalid. Reconcile this order before approval or completion.
          </p>
        )}

        {rows.map((row, index) => {
          const item = order.items?.[row.index];
          if (!item) {
            return <p className="field-error" key={index}>Original item could not be found.</p>;
          }

          const price = amount(item.price);
          const quantity = Number(row.quantity);
          const value = price !== null &&
            Number.isSafeInteger(quantity) && quantity > 0
              ? price * quantity
              : null;

          return (
            <div className="ar-item" key={`${row.index}-${index}`}>
              <strong>{item.name}</strong>
              <p>Requested quantity: {row.quantity} · Ordered: {item.quantity}</p>
              {item.sku && <p className="muted">Original SKU: {item.sku}</p>}
              <p className="muted">
                Original: {variant(item.selectedSize, item.selectedColor)}
              </p>
              {exchange ? (
                <p><strong>Replacement:</strong> {variant(row.size, row.color)}</p>
              ) : (
                <p>Item value before coupon allocation: {showMoney(value)}</p>
              )}
            </div>
          );
        })}
      </section>

      <section className="ar-section">
        <h3>Inventory and request history</h3>
        {exchange && (
          <p>
            Replacement stock reserved:{" "}
            {request.exchangeInventoryReservedAt
              ? date(request.exchangeInventoryReservedAt)
              : "Not recorded"}
          </p>
        )}
        <p>
          Original stock restored:{" "}
          {request.originalInventoryRestoredAt
            ? date(request.originalInventoryRestoredAt)
            : "Not recorded"}
        </p>
        {[
          ["Approved", request.approvedAt],
          ["Rejected", request.rejectedAt],
          ["Completed", request.completedAt],
        ].filter(([, value]) => value).map(([title, value]) => (
          <p className="muted" key={title}>{title}: {date(value)}</p>
        ))}
        {request.response && (
          <p className="notice">
            <strong>Recorded customer message:</strong> {request.response}
          </p>
        )}
      </section>

      {!exchange && (
        <section className="ar-section">
          <h3>Refund</h3>
          <dl className="ar-facts">
            <div><dt>Status</dt><dd>{label(refund.status)}</dd></div>
            <div><dt>Recorded amount</dt><dd>{showMoney(refundAmount)}</dd></div>
          </dl>

          {request.status !== "completed" && (
            <p className="muted">
              Any calculated amount is provisional until the return is completed.
            </p>
          )}

          {refund.requestedAt && (
            <p className="muted">Requested: {date(refund.requestedAt)}</p>
          )}

          {refund.reference && (
            <p style={{ overflowWrap: "anywhere" }}>
              Reference: {refund.reference}
            </p>
          )}

          {refund.refundedAt && (
            <p className="muted">Refund recorded: {date(refund.refundedAt)}</p>
          )}

          {needsRefund && (
            <form onSubmit={(event) => {
              event.preventDefault();
              onAction(order, "refund");
            }}>
              <p className="notice">
                This action only records a refund already sent.
                It does not transfer money.
              </p>

              {!refundAllowed && (
                <p className="field-error">
                  The recorded payment is missing or lower than the refund.
                  Reconcile the payment before sending or recording money.
                </p>
              )}

              <label className="ar-field">
                Refund transaction reference
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  autoComplete="off"
                  value={reference}
                  disabled={busy || !refundAllowed}
                  onChange={(event) => onReference(event.target.value)}
                />
              </label>

              <button
                type="submit"
                className="button"
                disabled={busy || !refundAllowed}
              >
                {working ? "Processing…" : "Record refund already sent"}
              </button>
            </form>
          )}
        </section>
      )}

      {["requested", "approved"].includes(request.status) && (
        <section className="ar-section">
          <h3>{request.status === "requested" ? "Review request" : "Complete request"}</h3>

          <label className="ar-field">
            Message visible to the customer
            <textarea
              rows={3}
              maxLength={1000}
              value={response}
              disabled={busy}
              onChange={(event) => onResponse(event.target.value)}
            />
          </label>

          {request.status === "requested" ? (
            <div className="ar-actions">
              <button
                type="button"
                className="button"
                disabled={busy || !validItems}
                onClick={() => onAction(order, "approve")}
              >
                {working ? "Processing…" : "Approve request"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => onAction(order, "reject")}
              >
                Reject request
              </button>
            </div>
          ) : (
            <>
              <p className="notice">
                Complete only after receiving and inspecting the original items.
                This restores them to saleable inventory.
                {exchange
                  ? " Replacement dispatch must be handled separately."
                  : " Refund processing remains a separate action."}
              </p>
              <button
                type="button"
                className="button"
                disabled={busy || !validItems}
                onClick={() => onAction(order, "complete")}
              >
                {working ? "Processing…" : `Complete ${exchange ? "exchange" : "return"}`}
              </button>
            </>
          )}
        </section>
      )}
    </article>
  );
}

function ReturnsWorkspace({ token }) {
  const { notify } = useStore();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("requested");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [responses, setResponses] = useState({});
  const [references, setReferences] = useState({});

  const mounted = useRef(false);
  const generation = useRef(0);
  const lock = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);

  const loadRequests = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");

    try {
      const rows = await getAdminReturnRequests(
        token,
        filter === "all" ? "" : filter,
      );
      if (mounted.current && version === generation.current) {
        setOrders(Array.isArray(rows) ? rows : []);
      }
    } catch (failure) {
      if (mounted.current && version === generation.current) {
        setOrders([]);
        setError(failure.message || "Unable to load requests.");
      }
    } finally {
      if (mounted.current && version === generation.current) {
        setLoading(false);
      }
    }
  }, [token, filter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function act(order, action) {
    if (lock.current || !token) return;

    const id = orderId(order);
    const response = String(
      responses[id] ?? order.returnRequest?.response ?? "",
    ).trim();
    const reference = String(references[id] ?? "").trim();

    if (!id || !["approve", "reject", "complete", "refund"].includes(action)) {
      setError("This action is unavailable.");
      return;
    }

    if (action === "reject" && response.length < 5) {
      setError("Enter a clear rejection reason of at least 5 characters.");
      return;
    }

    if (action === "refund") {
      const paid = amount(order.payment?.amountPaid);
      const refund = amount(order.refund?.amount);

      if (
        order.returnRequest?.type !== "return" ||
        order.returnRequest?.status !== "completed" ||
        !["pending", "manual-required"].includes(order.refund?.status) ||
        refund === null || refund <= 0 ||
        paid === null || refund > paid
      ) {
        setError("Reconcile the return and payment records before recording this refund.");
        return;
      }

      if (reference.length < 3 || reference.length > 200) {
        setError("Enter a refund reference of 3–200 characters.");
        return;
      }
    }

    const confirmations = {
      approve: `Approve the request for ${id}? Exchange approval reserves replacement stock.`,
      reject: `Reject the request for ${id}? Your message will be visible to the customer.`,
      complete: `Complete the request for ${id}? Confirm the original items were received, inspected and accepted for saleable stock.`,
      refund: `Confirm ${showMoney(order.refund?.amount)} was already refunded for ${id}. Record reference ${reference}?`,
    };

    if (!window.confirm(confirmations[action])) return;

    lock.current = true;
    generation.current += 1;
    setWorkingId(id);
    setError("");
    setSuccess("");

    try {
      let updated;

      if (action === "complete") {
        updated = await completeReturnRequest(token, id, { response });
      } else if (action === "refund") {
        updated = await recordReturnRefund(token, id, { reference });
      } else {
        updated = await reviewReturnRequest(token, id, {
          decision: action,
          response,
        });
      }

      if (!updated) {
        throw new Error("The updated order was not returned.");
      }

      if (!mounted.current) return;

      const message = action === "refund"
        ? "Refund recorded. This action did not transfer money."
        : action === "complete"
          ? "Request completed. Check inventory and refund details."
          : `Request ${action === "approve" ? "approved" : "rejected"}.`;

      setSuccess(message);
      notify(message, "success");

      setResponses((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      setReferences((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      await loadRequests();
    } catch (failure) {
      if (mounted.current) {
        setError(
          `${failure.message || "Unable to process this request."} Reload requests to check the current status before retrying. Do not resend a refund without checking the payment provider.`,
        );
      }
    } finally {
      lock.current = false;
      if (mounted.current) setWorkingId("");
    }
  }

  const busy = Boolean(workingId);
  const query = search.trim().toLowerCase();

  const visible = orders.filter((order) =>
    [
      orderId(order),
      order.returnRequest?.id,
      order.customer?.name,
      order.customer?.email,
      order.user?.name,
      order.user?.email,
    ].some((value) => String(value || "").toLowerCase().includes(query)),
  );

  return (
    <div className="page ar-admin">
      <header className="ar-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Returns and exchanges</h1>
          <p>Review requests, inspect returned items, then complete and reconcile refunds.</p>
        </div>
        <div className="ar-actions">
          <Link className="button secondary" to="/admin/products">Products</Link>
          <Link className="button secondary" to="/admin/orders">Orders</Link>
        </div>
      </header>

      <section className="panel">
        <div className="ar-actions" aria-label="Request status filters">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "button" : "button secondary"}
              aria-pressed={filter === value}
              disabled={loading || busy}
              onClick={() => {
                setFilter(value);
                setSuccess("");
              }}
            >
              {label(value)}
            </button>
          ))}
        </div>

        <div className="ar-search">
          <label className="ar-field">
            Search within this status
            <input
              type="search"
              value={search}
              placeholder="Order ID, request ID, customer name or email"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={loading || busy}
            onClick={loadRequests}
          >
            Refresh
          </button>
        </div>

        {!loading && !error && (
          <p className="muted">
            Showing {visible.length} of {orders.length} loaded requests.
          </p>
        )}
      </section>

      {success && <p className="notice" role="status">{success}</p>}

      {error && (
        <div className="panel">
          <p className="field-error" role="alert">{error}</p>
          <button
            type="button"
            className="button secondary"
            disabled={loading || busy}
            onClick={loadRequests}
          >
            Reload requests
          </button>
        </div>
      )}

      {loading ? (
        <p className="panel" role="status">Loading requests…</p>
      ) : !error && !visible.length ? (
        <div className="panel">
          <h2>No matching requests</h2>
          <p>Choose another status or clear your search.</p>
        </div>
      ) : !error && (
        <div className="ar-list">
          {visible.map((order) => {
            const id = orderId(order);
            return (
              <RequestCard
                key={id}
                order={order}
                busy={busy}
                working={workingId === id}
                response={responses[id] ?? order.returnRequest?.response ?? ""}
                reference={references[id] ?? ""}
                onResponse={(value) =>
                  setResponses((current) => ({ ...current, [id]: value }))
                }
                onReference={(value) =>
                  setReferences((current) => ({ ...current, [id]: value }))
                }
                onAction={act}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminReturnsPage() {
  const {
    user,
    token,
    loading,
    authError,
    retrySession,
  } = useAuth();

  if (loading) {
    return (
      <div className="page panel" role="status">
        Checking admin session…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page narrow panel">
        <h1>Unable to check admin session</h1>
        <p className="field-error" role="alert">{authError}</p>
        <button type="button" className="button" onClick={retrySession}>
          Retry
        </button>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="page narrow panel">
        <h1>Admin returns</h1>
        <p>Sign in with an admin account to continue.</p>
        <Link className="button" to="/login">Sign in</Link>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="page narrow panel">
        <h1>Admin access required</h1>
        <p>This page is available to GymDrobe administrators.</p>
        <Link className="button" to="/">Go home</Link>
      </div>
    );
  }

  return (
    <ReturnsWorkspace
      key={`${user.id || user._id}:${token}`}
      token={token}
    />
  );
}