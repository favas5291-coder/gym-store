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
  return String(value || "Unknown")
    .replaceAll("-", " ")
    .replace(/^./, (character) => character.toUpperCase());
}
function date(value) {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("en-IN")
    : "—";
}
function recordedAmount(value) {
  return value != null &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
    ? Number(value)
    : null;
}
function paymentMethod(order) {
  const method = order.payment?.method || order.paymentMethod;
  if (method === "cod-partial") return "COD with online advance";
  if (method === "cod") return "Cash on delivery";
  if (["razorpay", "online"].includes(method)) return "Online payment";
  return label(method);
}
function variant(color, size) {
  return (
    [color, size && `Size ${size}`].filter(Boolean).join(" · ") ||
    "Default variant"
  );
}
function nextStep(order) {
  const request = order.returnRequest || {};
  if (request.status === "requested")
    return "Review the reason and items, then approve or reject.";
  if (request.status === "approved")
    return "Receive and inspect the original items before completing this request.";
  if (request.status === "rejected")
    return "Request rejected. No further action on this request.";
  if (request.status === "completed" && request.type === "exchange")
    return "Exchange completed. Check replacement dispatch in your fulfillment workflow.";
  if (
    request.status === "completed" &&
    ["pending", "manual-required"].includes(order.refund?.status) &&
    Number(order.refund?.amount) > 0
  )
    return "Send the refund outside GymDrobe, then record the transaction reference.";
  if (order.refund?.status === "refunded") return "Refund has been recorded.";
  if (order.refund?.status === "not-applicable")
    return "Return completed. No refund amount is due.";
  return "Check the recorded request and payment status.";
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
  const request = order.returnRequest || {};
  const refund = order.refund || {};
  const exchange = request.type === "exchange";
  const paid = recordedAmount(order.payment?.amountPaid);
  const due = recordedAmount(order.payment?.amountDue);
  const refundAmount = recordedAmount(refund.amount);
  const needsRefund =
    !exchange &&
    request.status === "completed" &&
    ["manual-required", "pending"].includes(refund.status) &&
    refundAmount > 0;
  const refundAllowed =
    paid !== null && refundAmount !== null && refundAmount <= paid;
  const customer = order.customer || {};
  return (
    <article className="panel ar-card" aria-busy={working}>
      <header className="ar-heading">
        <div>
          <h2>
            {exchange ? "Exchange" : "Return"} · {order.id}
          </h2>
          <p className="muted">
            Request {request.id || "—"} · {date(request.requestedAt)}
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
          <p>
            <strong>
              {customer.name ||
                order.user?.name ||
                order.shippingAddress?.fullName ||
                "Customer"}
            </strong>
          </p>
          {(customer.email || order.user?.email) && (
            <p>{customer.email || order.user?.email}</p>
          )}
          {(customer.phone || order.shippingAddress?.phone) && (
            <p>{customer.phone || order.shippingAddress?.phone}</p>
          )}
          <p>
            <strong>Reason:</strong> {request.reason || "No reason provided."}
          </p>
          <Link
            className="text-link"
            to={`/orders/${encodeURIComponent(order.id)}`}
          >
            View order details
          </Link>
        </section>
        <section>
          <h3>Recorded payment</h3>
          <dl className="ar-facts">
            <div>
              <dt>Method</dt>
              <dd>{paymentMethod(order)}</dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd>{label(order.payment?.status)}</dd>
            </div>
            <div>
              <dt>Amount paid</dt>
              <dd>{paid === null ? "Not recorded" : money(paid)}</dd>
            </div>
            <div>
              <dt>Balance due</dt>
              <dd>{due === null ? "Not recorded" : money(due)}</dd>
            </div>
          </dl>
          <p className="muted">
            Refunds are limited to the eligible returned-item value and recorded
            amount paid. The server applies coupon adjustments; shipping is
            excluded.
          </p>
        </section>
      </div>
      <section className="ar-section">
        <h3>Requested items</h3>
        {!request.items?.length && (
          <p className="field-error">No requested items are recorded.</p>
        )}
        {(request.items || []).map((row, index) => {
          const item = order.items?.[row.index];
          if (!item)
            return (
              <p className="field-error" key={index}>
                Original item {row.index} could not be found. Reconcile the
                order before processing.
              </p>
            );
          return (
            <div className="ar-item" key={`${row.index}-${index}`}>
              <strong>{item.name}</strong>
              <p>
                Requested quantity: {row.quantity} · Ordered: {item.quantity}
              </p>
              <p className="muted">
                Original: {variant(item.selectedColor, item.selectedSize)}
              </p>
              {exchange ? (
                <p>
                  <strong>Replacement:</strong> {variant(row.color, row.size)}
                </p>
              ) : (
                <p>
                  Item value before coupon allocation:{" "}
                  {money(Number(item.price || 0) * Number(row.quantity || 0))}
                </p>
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
            <strong>
              {request.exchangeInventoryReservedAt ? "Yes" : "Not recorded"}
            </strong>{" "}
            {request.exchangeInventoryReservedAt &&
              `· ${date(request.exchangeInventoryReservedAt)}`}
          </p>
        )}
        <p>
          Original stock restored:{" "}
          <strong>
            {request.originalInventoryRestoredAt ? "Yes" : "Not recorded"}
          </strong>{" "}
          {request.originalInventoryRestoredAt &&
            `· ${date(request.originalInventoryRestoredAt)}`}
        </p>
        {[
          ["approvedAt", "Approved"],
          ["rejectedAt", "Rejected"],
          ["completedAt", "Completed"],
        ].map(
          ([key, title]) =>
            request[key] && (
              <p className="muted" key={key}>
                {title}: {date(request[key])}
              </p>
            ),
        )}
      </section>
      {!exchange && (
        <section className="ar-section">
          <h3>Refund</h3>
          <dl className="ar-facts">
            <div>
              <dt>Status</dt>
              <dd>{label(refund.status || "not-requested")}</dd>
            </div>
            <div>
              <dt>Server-recorded amount</dt>
              <dd>
                {refundAmount === null ? "Not recorded" : money(refundAmount)}
              </dd>
            </div>
          </dl>
          {request.status !== "completed" && (
            <p className="muted">
              Any amount shown before completion is provisional. Check the final
              amount after completing the return.
            </p>
          )}
          {refund.requestedAt && (
            <p className="muted">Refund created: {date(refund.requestedAt)}</p>
          )}
          {needsRefund && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onAction(order, "refund");
              }}
            >
              <p className="notice">
                Send {money(refundAmount)} through your payment provider or
                agreed refund method first. This button records the refund; it
                does not transfer money.
              </p>
              {!refundAllowed && (
                <p className="field-error">
                  The amount paid is missing or this refund exceeds it.
                  Reconcile the payment record before recording a refund.
                </p>
              )}
              <label className="ar-field">
                Refund transaction reference
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  autoComplete="off"
                  placeholder="Example: UTR123456789"
                  value={reference}
                  disabled={busy || !refundAllowed}
                  onChange={(event) => onReference(event.target.value)}
                />
              </label>
              <button className="button" disabled={busy || !refundAllowed}>
                {working ? "Processing…" : "Record refund already sent"}
              </button>
            </form>
          )}
          {refund.status === "refunded" && (
            <div className="notice">
              <strong>Refund recorded</strong>
              <p>Reference: {refund.reference || "Not recorded"}</p>
              <p>Recorded: {date(refund.refundedAt)}</p>
            </div>
          )}
        </section>
      )}
      {["requested", "approved"].includes(request.status) && (
        <section className="ar-section">
          <h3>
            {request.status === "requested"
              ? "Review request"
              : "Complete request"}
          </h3>
          <label className="ar-field">
            Message to customer (optional)
            <textarea
              rows={3}
              maxLength={1000}
              value={response}
              disabled={busy}
              placeholder="This message is visible to the customer."
              onChange={(event) => onResponse(event.target.value)}
            />
          </label>
          {request.status === "requested" ? (
            <div className="ar-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
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
                Complete only after the returned items have been received and
                accepted for restocking. Completion restores original stock
                {exchange
                  ? " and finalizes the exchange."
                  : "; the refund must be processed separately."}
              </p>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => onAction(order, "complete")}
              >
                {working
                  ? "Processing…"
                  : `Complete ${exchange ? "exchange" : "return"}`}
              </button>
            </>
          )}
        </section>
      )}
      {["completed", "rejected"].includes(request.status) &&
        request.response && (
          <p className="notice">
            <strong>Customer message:</strong> {request.response}
          </p>
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
      generation.current++;
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
      if (mounted.current && version === generation.current) setOrders(rows);
    } catch (failure) {
      if (mounted.current && version === generation.current) {
        setOrders([]);
        setError(failure.message || "Unable to load requests.");
      }
    } finally {
      if (mounted.current && version === generation.current) setLoading(false);
    }
  }, [token, filter]);
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);
  async function act(order, action) {
    if (lock.current || !token) return;
    const response = (
      responses[order.id] ??
      order.returnRequest?.response ??
      ""
    ).trim();
    const reference = (references[order.id] ?? "").trim();
    if (action === "refund" && reference.length < 3) {
      setError("Enter the transaction reference for the refund already sent.");
      return;
    }
    const confirmations = {
      reject: `Reject the request for ${order.id}?`,
      complete: `Complete the request for ${order.id}? Confirm the original items were received and accepted for restocking.`,
      refund: `Confirm you already sent ${money(order.refund?.amount)} for ${order.id}. Record reference ${reference}?`,
    };
    if (confirmations[action] && !window.confirm(confirmations[action])) return;
    lock.current = true;
    setWorkingId(order.id);
    setError("");
    setSuccess("");
    try {
      if (action === "complete")
        await completeReturnRequest(token, order.id, { response });
      else if (action === "refund")
        await recordReturnRefund(token, order.id, { reference });
      else
        await reviewReturnRequest(token, order.id, {
          decision: action,
          response,
        });
      if (!mounted.current) return;
      const message =
        action === "refund"
          ? "Refund recorded. No money was transferred by this action."
          : action === "complete"
            ? "Request completed. Check the recorded inventory and refund details."
            : `Request ${action === "approve" ? "approved" : "rejected"}.`;
      setSuccess(message);
      notify(message, "success");
      setReferences((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      setResponses((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      await loadRequests();
    } catch (failure) {
      if (mounted.current)
        setError(
          failure.message ||
            "Unable to process this request. Refresh to check its current status before retrying.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setWorkingId("");
    }
  }
  const query = search.trim().toLowerCase();
  const visible = orders.filter((order) =>
    [
      order.id,
      order.returnRequest?.id,
      order.customer?.name,
      order.customer?.email,
      order.user?.name,
      order.user?.email,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    ),
  );
  const busy = Boolean(workingId);
  return (
    <div className="page ar-admin">
      <header className="ar-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Returns and exchanges</h1>
          <p>
            Review requests, receive the original items, then complete the
            return or exchange.
          </p>
        </div>
        <div className="ar-actions">
          <Link className="button secondary" to="/admin/products">
            Products
          </Link>
          <Link className="button secondary" to="/admin/orders">
            Orders
          </Link>
        </div>
      </header>
      <section className="panel">
        <div className="ar-actions" aria-label="Request status filters">
          {FILTERS.map((value) => (
            <button
              type="button"
              key={value}
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order ID, request ID, customer name or email"
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
      {success && (
        <p className="notice" role="status">
          {success}
        </p>
      )}
      {error && (
        <div className="panel">
          <p className="field-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={busy || loading}
            onClick={loadRequests}
          >
            Reload requests
          </button>
        </div>
      )}
      {loading ? (
        <p className="panel" role="status">
          Loading requests…
        </p>
      ) : !error && !visible.length ? (
        <div className="panel">
          <h2>No matching requests</h2>
          <p>Choose another status or clear your search.</p>
        </div>
      ) : (
        <div className="ar-list">
          {visible.map((order) => (
            <RequestCard
              key={order.id}
              order={order}
              busy={busy}
              working={workingId === order.id}
              response={
                responses[order.id] ?? order.returnRequest?.response ?? ""
              }
              reference={references[order.id] ?? ""}
              onResponse={(value) =>
                setResponses((current) => ({ ...current, [order.id]: value }))
              }
              onReference={(value) =>
                setReferences((current) => ({ ...current, [order.id]: value }))
              }
              onAction={act}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminReturnsPage() {
  const { user, token, authLoading = false } = useAuth();
  if (authLoading)
    return (
      <div className="page panel" role="status">
        Checking admin session…
      </div>
    );
  if (!user || !token)
    return (
      <div className="page narrow panel">
        <h1>Admin returns</h1>
        <p>Sign in with an admin account to continue.</p>
        <Link className="button" to="/login">
          Sign in
        </Link>
      </div>
    );
  if (user.role !== "admin")
    return (
      <div className="page narrow panel">
        <h1>Admin access required</h1>
        <p>This page is available to GymDrobe administrators.</p>
        <Link className="button" to="/">
          Go home
        </Link>
      </div>
    );
  return (
    <ReturnsWorkspace
      key={`${user.id || user._id || "admin"}:${token}`}
      token={token}
    />
  );
}
