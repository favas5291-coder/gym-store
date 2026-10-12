import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import {
  getAdminReturnRequests,
  getAdminOrderById,
  reviewReturnRequest,
  recordReturnRefund,
} from "../services/adminOrderApi.js";

import {
  inspectionPayload,
  completeInspectedReturn,
} from "../services/returnInspectionApi.js";

import { money } from "../utils/productPricing.js";

import "./AdminReturnsPage.css";

const FILTERS = [
  "requested",
  "approved",
  "completed",
  "rejected",
  "all",
];

function label(value) {
  return String(value || "Not recorded")
    .replaceAll("-", " ")
    .replace(
      /^./,
      character => character.toUpperCase(),
    );
}

function date(value) {
  const parsed = new Date(value || "invalid");

  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : parsed.toLocaleString("en-IN");
}

function amount(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    !String(value).trim()
  ) {
    return null;
  }

  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0 &&
    Number.isSafeInteger(
      Math.round(number * 100),
    )
  )
    ? number
    : null;
}

function showMoney(value) {
  const parsed = amount(value);

  return parsed === null
    ? "Not recorded"
    : money(parsed);
}

function orderId(order) {
  return String(
    order?.orderNumber || order?.id || "",
  );
}

function requestKey(order) {
  return `${orderId(order)}:${
    order.returnRequest?.id || "missing"
  }`;
}

function variant(size, color) {
  return [
    color && `Colour / flavour: ${color}`,
    size && `Size / pack: ${size}`,
  ]
    .filter(Boolean)
    .join(" · ") || "Default variant";
}

function validRows(order) {
  const rows = order.returnRequest?.items;

  return (
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.length <= 50 &&
    new Set(
      rows.map(row => row?.index),
    ).size === rows.length &&
    rows.every(row => {
      if (!row || typeof row !== "object") {
        return false;
      }

      const item = order.items?.[row.index];

      return (
        Number.isSafeInteger(row.index) &&
        row.index >= 0 &&
        item &&
        Number.isSafeInteger(row.quantity) &&
        row.quantity > 0 &&
        row.quantity <= item.quantity
      );
    })
  );
}

function refundAllowed(order) {
  const refund = order.refund || {};
  const paid = amount(order.payment?.amountPaid);
  const value = amount(refund.amount);

  return (
    order.returnRequest?.type === "return" &&
    order.returnRequest.status === "completed" &&
    ["pending", "manual-required"].includes(
      refund.status,
    ) &&
    value !== null &&
    value > 0 &&
    paid !== null &&
    value <= paid &&
    !refund.reference &&
    !["submitting", "submitted", "uncertain"].includes(
      refund.submissionState,
    )
  );
}

function freshness(order) {
  return JSON.stringify([
    order.updatedAt,
    order.status,
    order.returnRequest,
    order.refund,
    order.payment,
    order.metadata,
    order.pricing,
    order.items,
  ]);
}

function nextStep(order) {
  const request = order.returnRequest || {};

  if (request.status === "requested") {
    return "Check purchased return conditions and the customer's reason before reviewing.";
  }

  if (request.status === "approved") {
    return "Receive every requested original item. Record how many units are saleable before completing.";
  }

  if (request.status === "rejected") {
    return "The request was rejected. The customer can read your message.";
  }

  if (
    request.type === "exchange" &&
    request.status === "completed"
  ) {
    return "Original-item inspection is complete. Confirm replacement dispatch separately.";
  }

  if (order.refund?.status === "refunded") {
    return "The refund is recorded as completed.";
  }

  if (
    ["pending", "manual-required"].includes(
      order.refund?.status,
    )
  ) {
    return "Reconcile payment-provider records. Process any due refund separately, then record the completed transfer.";
  }

  return "Check the recorded inspection and refund details.";
}

function RequestCard({
  order,
  busy,
  working,
  onAction,
}) {
  const request = order.returnRequest || {};
  const refund = order.refund || {};
  const id = orderId(order);

  const exchange = request.type === "exchange";
  const rowsValid = validRows(order);

  const rows = Array.isArray(request.items)
    ? request.items
    : [];

  const [response, setResponse] = useState(
    request.response || "",
  );

  const [reference, setReference] = useState("");
  const [refundSent, setRefundSent] = useState(false);

  const [draft, setDraft] = useState({
    received: false,
    items: {},
  });

  let inspectionError = "";

  try {
    inspectionPayload(order, draft, response);
  } catch (error) {
    inspectionError = error.message;
  }

  const policiesConfirmed =
    rowsValid &&
    rows.every(
      row =>
        order.items[row.index].returnsEligible ===
        "yes",
    );

  const inspection = Array.isArray(
    request.inspectionItems,
  )
    ? request.inspectionItems
    : [];

  const action = kind =>
    onAction(order, kind, {
      response,
      reference,
      refundSent,
      draft,
    });

  function updateRow(index, changes) {
    setDraft(current => ({
      ...current,
      items: {
        ...current.items,
        [index]: {
          ...current.items[index],
          ...changes,
        },
      },
    }));
  }

  return (
    <article
      className="panel ar-card"
      aria-busy={working}
    >
      <header className="ar-heading">
        <div>
          <h2>
            {exchange ? "Exchange" : "Return"} · {id}
          </h2>

          <p className="muted">
            Request {request.id || "Not recorded"} ·{" "}
            {date(request.requestedAt)}
          </p>
        </div>

        <span className="status-pill">
          {label(request.status)}
        </span>
      </header>

      <p className="notice">
        <strong>Next step:</strong>{" "}
        {nextStep(order)}
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

          <p>
            {order.customer?.phone ||
              order.shippingAddress?.phone}
          </p>

          <p>
            <strong>Reason:</strong>{" "}
            {request.reason || "Not recorded"}
          </p>

          <Link
            className="text-link"
            to="/admin/orders"
          >
            Open admin orders
          </Link>

          <p className="muted">
            Find order {id} in admin orders.
          </p>
        </section>

        <section>
          <h3>Recorded payment</h3>

          <dl className="ar-facts">
            {[
              [
                "Method",
                label(
                  order.payment?.method ||
                    order.paymentMethod,
                ),
              ],
              [
                "Payment status",
                label(order.payment?.status),
              ],
              [
                "Money retained",
                showMoney(order.payment?.amountPaid),
              ],
              [
                "Gross collected",
                showMoney(
                  order.payment?.grossCollected,
                ),
              ],
              [
                "Refunds completed",
                showMoney(
                  order.payment?.refundedAmount,
                ),
              ],
              [
                "Balance due",
                showMoney(order.payment?.amountDue),
              ],
              [
                "COD collection",
                label(order.payment?.balanceStatus),
              ],
            ].map(([title, value]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <p className="muted">
            Refund amounts use purchased prices and
            allocated coupon savings. Shipping is
            excluded from item returns.
          </p>
        </section>
      </div>

      <section className="ar-section">
        <h3>Requested items</h3>

        {!rowsValid && (
          <p className="field-error">
            Recorded items are invalid. Reconcile the
            order before approval or completion.
          </p>
        )}

        {rows.map((row, index) => {
          const item = order.items?.[row?.index];

          if (!item) {
            return (
              <p
                className="field-error"
                key={index}
              >
                Original item could not be found.
              </p>
            );
          }

          const saved = inspection.find(
            entry => entry?.index === row.index,
          );

          return (
            <div
              className="ar-item"
              key={`${row.index}-${index}`}
            >
              <strong>{item.name}</strong>

              <p>
                Requested: {row.quantity} · Purchased:{" "}
                {item.quantity}
              </p>

              {item.sku && (
                <p className="muted">
                  Original SKU: {item.sku}
                </p>
              )}

              <p className="muted">
                Original:{" "}
                {variant(
                  item.selectedSize,
                  item.selectedColor,
                )}
              </p>

              {exchange && (
                <p>
                  <strong>Replacement:</strong>{" "}
                  {variant(row.size, row.color)}
                </p>
              )}

              <p>
                Purchased unit price:{" "}
                {showMoney(item.price)}
              </p>

              <p className="muted">
                Return eligibility:{" "}
                {label(item.returnsEligible)} · Recorded
                window:{" "}
                {item.returnWindowDays ??
                  "Not recorded"}{" "}
                days
              </p>

              {(item.returnPolicy ||
                item.returnConditions) && (
                <p className="muted">
                  {[
                    item.returnPolicy,
                    item.returnConditions,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {request.status === "completed" &&
                saved && (
                  <p className="notice">
                    Received: {saved.returnedQuantity} ·
                    Restocked: {saved.restockQuantity} ·
                    Kept out of stock:{" "}
                    {saved.returnedQuantity -
                      saved.restockQuantity}

                    {saved.note && (
                      <>
                        {" "}· Inspection note:{" "}
                        {saved.note}
                      </>
                    )}
                  </p>
                )}
            </div>
          );
        })}
      </section>

      <section className="ar-section">
        <h3>Inventory and history</h3>

        {exchange && (
          <p>
            Replacement stock reserved:{" "}
            {date(request.exchangeInventoryReservedAt)}
          </p>
        )}

        <p>
          Inspection completed:{" "}
          {date(request.inspectionCompletedAt)}
        </p>

        <p>
          Saleable stock restored:{" "}
          {request.inspectionCompletedAt &&
          !request.originalInventoryRestoredAt
            ? "No units restocked"
            : date(
                request.originalInventoryRestoredAt,
              )}
        </p>

        {request.status === "completed" &&
          !request.inspectionCompletedAt && (
            <p className="notice">
              This older completion has no item
              inspection breakdown. Review inventory
              manually; do not complete it again.
            </p>
          )}

        {[
          ["Approved", request.approvedAt],
          ["Rejected", request.rejectedAt],
          ["Completed", request.completedAt],
        ]
          .filter(([, value]) => value)
          .map(([title, value]) => (
            <p className="muted" key={title}>
              {title}: {date(value)}
            </p>
          ))}

        {request.response && (
          <p className="notice">
            <strong>Recorded customer message:</strong>{" "}
            {request.response}
          </p>
        )}
      </section>

      {!exchange && (
        <section className="ar-section">
          <h3>Refund</h3>

          <dl className="ar-facts">
            <div>
              <dt>Status</dt>
              <dd>{label(refund.status)}</dd>
            </div>

            <div>
              <dt>Recorded amount</dt>
              <dd>{showMoney(refund.amount)}</dd>
            </div>
          </dl>

          {request.status !== "completed" && (
            <p className="muted">
              The approved amount needs inspection and
              completion before refund processing.
            </p>
          )}

          {refund.requestedAt && (
            <p className="muted">
              Requested: {date(refund.requestedAt)}
            </p>
          )}

          {refund.reference && (
            <p>Reference: {refund.reference}</p>
          )}

          {refund.refundedAt && (
            <p className="muted">
              Refund recorded:{" "}
              {date(refund.refundedAt)}
            </p>
          )}

          {[
            "submitting",
            "submitted",
            "uncertain",
          ].includes(refund.submissionState) && (
            <p className="notice">
              A provider submission is recorded or
              uncertain. Check the provider and webhook
              results before sending any further refund.
            </p>
          )}

          {refundAllowed(order) && (
            <form
              onSubmit={event => {
                event.preventDefault();
                action("refund");
              }}
            >
              <p className="notice">
                This records a refund already
                transferred. It does not send money.
              </p>

              <label className="ar-field">
                Refund transaction reference

                <input
                  value={reference}
                  minLength={3}
                  maxLength={200}
                  required
                  autoComplete="off"
                  disabled={busy}
                  onChange={event =>
                    setReference(event.target.value)
                  }
                />
              </label>

              <label className="ar-actions">
                <input
                  type="checkbox"
                  checked={refundSent}
                  disabled={busy}
                  onChange={event =>
                    setRefundSent(
                      event.target.checked,
                    )
                  }
                />

                I checked that this refund was already
                transferred.
              </label>

              <button
                type="submit"
                className="button"
                disabled={busy || !refundSent}
              >
                {working
                  ? "Processing…"
                  : "Record refund already sent"}
              </button>
            </form>
          )}
        </section>
      )}

      {["requested", "approved"].includes(
        request.status,
      ) && (
        <section className="ar-section">
          <h3>
            {request.status === "requested"
              ? "Review request"
              : "Receive and inspect"}
          </h3>

          <label className="ar-field">
            Message visible to the customer

            <textarea
              rows={3}
              maxLength={1000}
              value={response}
              disabled={busy}
              onChange={event =>
                setResponse(event.target.value)
              }
            />
          </label>

          {request.status === "requested" ? (
            <>
              {!policiesConfirmed && (
                <p className="notice">
                  A purchased item has an unconfirmed
                  or ineligible policy. Resolve it with
                  support before approval.
                </p>
              )}

              <div className="ar-actions">
                <button
                  type="button"
                  className="button"
                  disabled={
                    busy || !policiesConfirmed
                  }
                  onClick={() => action("approve")}
                >
                  Approve request
                </button>

                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => action("reject")}
                >
                  Reject request
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="notice">
                Record only units inspected and
                accepted as saleable. Enter zero for
                damaged or used items. Refund
                eligibility is separate from whether an
                item can be restocked.

                {exchange &&
                  " Reserved replacements still need separate dispatch."}
              </p>

              <label className="ar-actions">
                <input
                  type="checkbox"
                  checked={draft.received}
                  disabled={busy}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      received:
                        event.target.checked,
                    }))
                  }
                />

                All requested original items have been
                received and inspected.
              </label>

              {rowsValid &&
                rows.map(row => (
                  <fieldset
                    className="ar-item"
                    key={row.index}
                    disabled={busy}
                  >
                    <legend>
                      {order.items[row.index].name} ·
                      Received: {row.quantity}
                    </legend>

                    <label className="ar-field">
                      Saleable quantity to return to stock

                      <input
                        type="number"
                        min="0"
                        max={row.quantity}
                        step="1"
                        inputMode="numeric"
                        required
                        value={
                          draft.items[row.index]
                            ?.quantity ?? ""
                        }
                        placeholder={`0–${row.quantity}`}
                        onChange={event =>
                          updateRow(row.index, {
                            quantity:
                              event.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="ar-field">
                      Inspection note — required when
                      any units stay out of stock

                      <textarea
                        rows={2}
                        maxLength={500}
                        value={
                          draft.items[row.index]
                            ?.note ?? ""
                        }
                        placeholder="Example: one unit damaged; kept out of saleable stock"
                        onChange={event =>
                          updateRow(row.index, {
                            note: event.target.value,
                          })
                        }
                      />
                    </label>
                  </fieldset>
                ))}

              {inspectionError && (
                <p className="muted">
                  {inspectionError}
                </p>
              )}

              <button
                type="button"
                className="button"
                disabled={
                  busy ||
                  !rowsValid ||
                  Boolean(inspectionError)
                }
                onClick={() => action("complete")}
              >
                {working
                  ? "Processing…"
                  : "Complete inspection"}
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
  const [workingId, setWorkingId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [mustReload, setMustReload] = useState(false);
  const [accessDenied, setAccessDenied] =
    useState(false);

  const mounted = useRef(false);
  const generation = useRef(0);
  const lock = useRef(false);

  const loadController = useRef(null);
  const actionController = useRef(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      generation.current++;

      loadController.current?.abort();
      actionController.current?.abort();
    };
  }, []);

  const loadRequests = useCallback(async () => {
    loadController.current?.abort();

    const controller = new AbortController();
    loadController.current = controller;

    const version = ++generation.current;

    setLoading(true);
    setError("");

    try {
      const rows = await getAdminReturnRequests(
        token,
        filter === "all" ? "" : filter,
        { signal: controller.signal },
      );

      if (
        mounted.current &&
        version === generation.current
      ) {
        setOrders(rows);
        setMustReload(false);
        setAccessDenied(false);
      }
    } catch (failure) {
      if (
        mounted.current &&
        version === generation.current &&
        failure.name !== "AbortError"
      ) {
        setError(
          failure.message ||
            "Unable to load requests.",
        );

        setMustReload(true);

        if ([401, 403].includes(failure.status)) {
          setAccessDenied(true);
          setOrders([]);
        }
      }
    } finally {
      if (
        mounted.current &&
        version === generation.current
      ) {
        setLoading(false);
      }
    }
  }, [token, filter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function act(order, action, details) {
    if (
      lock.current ||
      loading ||
      mustReload ||
      accessDenied ||
      !token
    ) {
      return;
    }

    lock.current = true;

    loadController.current?.abort();
    generation.current++;

    setLoading(false);

    const id = orderId(order);
    const controller = new AbortController();

    actionController.current = controller;

    setWorkingId(id);
    setError("");
    setSuccess("");

    let needsServerReload = false;

    try {
      if (
        !id ||
        !["approve", "reject", "complete", "refund"].includes(
          action,
        )
      ) {
        throw new Error(
          "This action is unavailable.",
        );
      }

      const response = String(
        details.response || "",
      ).trim();

      const reference = String(
        details.reference || "",
      ).trim();

      if (response.length > 1000) {
        throw new Error(
          "Keep the customer message within 1,000 characters.",
        );
      }

      if (
        action === "reject" &&
        response.length < 5
      ) {
        throw new Error(
          "Enter a clear rejection reason of at least five characters.",
        );
      }

      const payload =
        action === "complete"
          ? inspectionPayload(
              order,
              details.draft,
              response,
            )
          : null;

      if (
        action === "refund" &&
        (
          !refundAllowed(order) ||
          !details.refundSent ||
          reference.length < 3 ||
          reference.length > 200
        )
      ) {
        throw new Error(
          "Check the completed transfer and refund reference before recording it.",
        );
      }

      needsServerReload = true;

      const fresh = await getAdminOrderById(
        token,
        id,
        { signal: controller.signal },
      );

      if (!mounted.current) return;

      if (
        freshness(fresh) !== freshness(order)
      ) {
        setOrders(current =>
          current.map(row =>
            orderId(row) === id ? fresh : row,
          ),
        );

        setError(
          "The order changed. Review its refreshed details before taking an action.",
        );

        return;
      }

      const restocked =
        payload?.inspectionItems.reduce(
          (sum, row) =>
            sum + row.restockQuantity,
          0,
        );

      const confirmations = {
        approve:
          `Approve request ${order.returnRequest.id}? Exchange approval reserves replacement stock.`,

        reject:
          `Reject request ${order.returnRequest.id}? Your message will be visible to the customer.`,

        complete:
          `Complete inspection for ${id}? Only ${restocked} saleable units will return to stock. Other received units stay out of stock. This does not send a refund or dispatch replacements.`,

        refund:
          `Confirm ${showMoney(order.refund?.amount)} was already refunded for ${id}. Record reference ${reference}?`,
      };

      if (
        !window.confirm(confirmations[action])
      ) {
        return;
      }

      let updated;

      if (action === "complete") {
        updated = await completeInspectedReturn(
          token,
          id,
          payload,
          { signal: controller.signal },
        );
      } else if (action === "refund") {
        updated = await recordReturnRefund(
          token,
          id,
          { reference },
          { signal: controller.signal },
        );
      } else {
        updated = await reviewReturnRequest(
          token,
          id,
          {
            decision: action,
            response,
          },
          { signal: controller.signal },
        );
      }

      if (!mounted.current) return;

      const message =
        action === "complete"
          ? "Inspection completed. Accepted saleable quantities were restored; refund and replacement dispatch remain separate."
          : action === "refund"
            ? "Refund already transferred and recorded. This action did not send money."
            : `Request ${
                action === "approve"
                  ? "approved"
                  : "rejected"
              }.`;

      setOrders(current =>
        current.map(row =>
          orderId(row) === id ? updated : row,
        ),
      );

      setSuccess(message);
      notify(message, "success");

      await loadRequests();
    } catch (failure) {
      if (mounted.current) {
        setError(
          needsServerReload
            ? `${failure.message || "This action could not be confirmed."} Reload requests before retrying. Do not send another refund without checking its provider record.`
            : failure.message ||
              "Check the entered information.",
        );

        setMustReload(needsServerReload);

        if ([401, 403].includes(failure.status)) {
          setAccessDenied(true);
          setOrders([]);
        }
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setWorkingId("");
      }
    }
  }

  const busy =
    loading ||
    Boolean(workingId) ||
    mustReload ||
    accessDenied;

  const query = search.trim().toLowerCase();

  const visible = orders.filter(order =>
    (
      filter === "all" ||
      order.returnRequest?.status === filter
    ) &&
    [
      orderId(order),
      order.returnRequest?.id,
      order.customer?.name,
      order.customer?.email,
      order.customer?.phone,
      order.shippingAddress?.phone,
      order.user?.name,
      order.user?.email,
    ].some(value =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    ),
  );

  return (
    <div className="page ar-admin">
      <header className="ar-heading">
        <div>
          <p className="eyebrow">
            GYMDROBE ADMIN
          </p>

          <h1>Returns and exchanges</h1>

          <p>
            Review requests, inspect received items,
            then manage stock and refunds.
          </p>
        </div>

        <div className="ar-actions">
          <Link
            className="button secondary"
            to="/admin/products"
          >
            Products
          </Link>

          <Link
            className="button secondary"
            to="/admin/orders"
          >
            Orders
          </Link>
        </div>
      </header>

      <section className="panel">
        <div
          className="ar-actions"
          aria-label="Request status filters"
        >
          {FILTERS.map(value => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? "button"
                  : "button secondary"
              }
              aria-pressed={filter === value}
              disabled={
                loading || Boolean(workingId)
              }
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
              placeholder="Order, request, customer, email or phone"
              onChange={event =>
                setSearch(event.target.value)
              }
            />
          </label>

          <button
            type="button"
            className="button secondary"
            disabled={
              loading || Boolean(workingId)
            }
            onClick={loadRequests}
          >
            Refresh
          </button>
        </div>

        {!loading && (
          <p className="muted">
            Showing {visible.length} of{" "}
            {orders.length} loaded requests.
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
          <p
            className="field-error"
            role="alert"
          >
            {error}
          </p>

          {accessDenied && (
            <Link
              className="button secondary"
              to="/login"
            >
              Check admin sign-in
            </Link>
          )}

          <button
            type="button"
            className="button secondary"
            disabled={
              loading || Boolean(workingId)
            }
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
      ) : !visible.length && !error ? (
        <div className="panel">
          <h2>No matching requests</h2>

          <p>
            Choose another status or clear your search.
          </p>
        </div>
      ) : (
        <div className="ar-list">
          {visible.map(order => (
            <RequestCard
              key={requestKey(order)}
              order={order}
              busy={busy}
              working={
                workingId === orderId(order)
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
  const {
    user,
    token,
    loading,
    authError,
    retrySession,
  } = useAuth();

  if (loading) {
    return (
      <div
        className="page panel"
        role="status"
      >
        Checking admin session…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page narrow panel">
        <h1>Unable to check admin session</h1>

        <p
          className="field-error"
          role="alert"
        >
          {authError}
        </p>

        <button
          type="button"
          className="button"
          onClick={retrySession}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="page narrow panel">
        <h1>Admin returns</h1>

        <p>
          Sign in with an admin account to continue.
        </p>

        <Link
          className="button"
          to="/login"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (
    user.role !== "admin" ||
    user.isActive === false
  ) {
    return (
      <div className="page narrow panel">
        <h1>Admin access required</h1>

        <p>
          This page requires an active GymDrobe
          administrator account.
        </p>

        <Link className="button" to="/">
          Go home
        </Link>
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