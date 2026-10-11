import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} from "../services/adminOrderApi.js";

import "./AdminOrdersPage.css";

const FLOW = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];

const FILTERS = [
  "all",
  "payment-pending",
  ...FLOW,
  "cancelled",
];

const PAGE_SIZE = 25;

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function label(value) {
  const names = {
    all: "All orders",
    "payment-pending": "Payment pending",
    confirmed: "Confirmed",
    processing: "Processing",
    packed: "Packed",
    shipped: "Shipped",
    "out-for-delivery": "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    paid: "Payment completed",
    "partially-paid": "Advance paid",
    pending: "Pending",
    failed: "Failed",
    refunded: "Refunded",
    "partially-refunded": "Partially refunded",
    collected: "Collected",
    "manual-required": "Requires review",
  };

  if (
    !value ||
    ["none", "not-requested", "unconfirmed"].includes(value)
  ) {
    return "Not recorded";
  }

  return names[value] || String(value).replaceAll("-", " ");
}

function amount(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

function money(value) {
  const parsed = amount(value);

  return parsed === null
    ? "Not recorded"
    : currency.format(parsed);
}

function date(value) {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function formatDate(value) {
  return (
    date(value)?.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }) || "Not recorded"
  );
}

function dateInput(value) {
  const parsed = date(value);

  if (!parsed) return "";

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
}

function validDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = date(`${value}T00:00:00Z`);

  return Boolean(
    parsed &&
      parsed.toISOString().slice(0, 10) === value,
  );
}

function idOf(order) {
  return String(
    order?.orderNumber ||
      order?.id ||
      order?._id ||
      "",
  );
}

function nameOf(order) {
  return (
    order?.shippingAddress?.fullName ||
    order?.shippingAddress?.name ||
    order?.customer?.name ||
    order?.user?.name ||
    "Customer"
  );
}

function emailOf(order) {
  return (
    order?.shippingAddress?.email ||
    order?.customer?.email ||
    order?.user?.email ||
    ""
  );
}

function phoneOf(order) {
  return String(
    order?.shippingAddress?.phone ||
      order?.customer?.phone ||
      order?.user?.phone ||
      "",
  );
}

function phoneLink(value) {
  const digits = String(value).replace(/\D/g, "");

  return digits.length >= 7 && digits.length <= 15
    ? `tel:${digits}`
    : null;
}

function methodOf(order) {
  return (
    order?.payment?.method ||
    order?.paymentMethod ||
    ""
  );
}

function methodLabel(order) {
  const names = {
    razorpay: "Online payment",
    "cod-partial": "COD with online advance",
    cod: "Cash on delivery",
  };

  return names[methodOf(order)] || "Not recorded";
}

function totalOf(order) {
  return (
    amount(order?.pricing?.finalTotal) ??
    amount(order?.payment?.totalAmount)
  );
}

function dispatchInfo(order, now = Date.now()) {
  const due = date(order?.fulfilment?.dispatchDueAt);

  const waiting = [
    "confirmed",
    "processing",
    "packed",
  ].includes(order?.status);

  return {
    due,
    overdue: Boolean(
      due &&
        waiting &&
        due.getTime() < now,
    ),
  };
}

function demoOrder(order) {
  return (
    order?.metadata?.demo === true ||
    order?.payment?.mode === "test" ||
    order?.payment?.razorpayMode === "test"
  );
}

function activeRecord(record) {
  return Boolean(
    record?.status &&
      !["none", "not-requested"].includes(record.status),
  );
}

function draftOf(order) {
  return {
    status: order?.status || "",
    carrier: order?.tracking?.carrier || "",
    trackingNumber: order?.tracking?.trackingNumber || "",
    estimatedDelivery: dateInput(
      order?.tracking?.estimatedDelivery,
    ),
    codBalanceCollected: false,
  };
}

function snapshot(order) {
  return JSON.stringify({
    id: idOf(order),
    status: order?.status,
    updatedAt: order?.updatedAt,
    payment: order?.payment || {},
    tracking: order?.tracking || {},
    refund: order?.refund || {},
    returnRequest: order?.returnRequest || {},
  });
}

function paymentIssue(order) {
  const method = methodOf(order);
  const payment = order?.payment || {};

  const paid = amount(payment.amountPaid);
  const due = amount(payment.amountDue);
  const total = totalOf(order);

  if (
    !["razorpay", "cod-partial", "cod"].includes(method)
  ) {
    return "The payment method is not recorded. Review the order before advancing fulfilment.";
  }

  if (
    paid === null ||
    due === null ||
    total === null
  ) {
    return "Payment amounts are incomplete. Reconcile the payment record before advancing fulfilment.";
  }

  if (Math.abs(paid + due - total) > 0.02) {
    return "Recorded paid and due amounts do not match the order total. Review the payment record.";
  }

  if (
    method === "razorpay" &&
    (payment.status !== "paid" || due !== 0)
  ) {
    return "Online payment must be verified as paid before advancing fulfilment.";
  }

  if (method === "cod-partial") {
    const advance = amount(payment.advanceAmount);

    if (
      !["paid", "partially-paid"].includes(payment.status) ||
      advance === null ||
      paid + 0.01 < advance
    ) {
      return "The required online advance is not verified. Review payment before advancing fulfilment.";
    }

    if (
      due > 0 &&
      payment.balanceStatus !== "pending"
    ) {
      return "The remaining COD amount and balance status need reconciliation.";
    }

    if (
      due > 0 &&
      payment.status === "paid"
    ) {
      return "This COD order is marked paid but still has an outstanding balance. Review payment first.";
    }
  }

  return "";
}

function validateDraft(order, draft) {
  const index = FLOW.indexOf(order?.status);
  const next = FLOW.indexOf(draft.status);

  if (
    index < 0 ||
    next < index ||
    next > index + 1
  ) {
    return "Choose the current status or the next fulfilment step.";
  }

  if (draft.carrier.trim().length > 100) {
    return "Courier name cannot exceed 100 characters.";
  }

  if (draft.trackingNumber.trim().length > 150) {
    return "Tracking number cannot exceed 150 characters.";
  }

  if (
    draft.estimatedDelivery &&
    !validDateInput(draft.estimatedDelivery)
  ) {
    return "Enter a valid estimated delivery date.";
  }

  if (draft.status !== order.status) {
    const issue = paymentIssue(order);

    if (issue) return issue;
  }

  if (
    ["shipped", "out-for-delivery", "delivered"].includes(
      draft.status,
    ) &&
    (
      !draft.carrier.trim() ||
      !draft.trackingNumber.trim()
    )
  ) {
    return "Enter both the courier and tracking number before dispatching or completing delivery.";
  }

  const deliveryNeedsPaymentCheck =
    draft.status === "delivered" &&
    (
      order.status !== "delivered" ||
      (
        methodOf(order) === "cod-partial" &&
        amount(order?.payment?.amountDue) > 0
      )
    );

  if (deliveryNeedsPaymentCheck) {
    const issue = paymentIssue(order);

    if (issue) return issue;

    const due = amount(order?.payment?.amountDue);

    if (
      methodOf(order) === "cod" &&
      due > 0
    ) {
      return "This legacy COD balance must be reconciled through the backend before marking delivery complete.";
    }

    if (
      methodOf(order) === "cod-partial" &&
      due > 0 &&
      !draft.codBalanceCollected
    ) {
      return `Confirm receipt of ${money(due)} before marking delivery complete.`;
    }
  }

  return "";
}

function updatePayload(order, draft) {
  const original = draftOf(order);

  const body = {
    status: draft.status,
  };

  for (const field of [
    "carrier",
    "trackingNumber",
    "estimatedDelivery",
  ]) {
    if (draft[field] !== original[field]) {
      body[field] = draft[field].trim();
    }
  }

  if (
    draft.status === "delivered" &&
    methodOf(order) === "cod-partial" &&
    amount(order?.payment?.amountDue) > 0
  ) {
    body.codBalanceCollected =
      draft.codBalanceCollected === true;
  }

  return body;
}

function readList(result) {
  if (
    !result ||
    !Array.isArray(result.orders) ||
    result.orders.some((order) => !idOf(order))
  ) {
    throw new Error(
      "The order list could not be read. Check the backend response.",
    );
  }

  const total = amount(result.total);
  const pages = amount(result.pages);
  const page = amount(result.page);

  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(pages) ||
    pages < 1 ||
    !Number.isSafeInteger(page) ||
    page < 1
  ) {
    throw new Error(
      "The server returned invalid order pagination.",
    );
  }

  return {
    orders: result.orders,
    total,
    pages,
    page,
  };
}

function Badge({ status }) {
  return (
    <span className={`ao-badge ao-${status || "unknown"}`}>
      {label(status)}
    </span>
  );
}

function Row({ title, children }) {
  return (
    <div className="ao-money-row">
      <dt>{title}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Phone({ value }) {
  const href = phoneLink(value);

  return href ? (
    <a href={href}>{value}</a>
  ) : (
    <span>{value || "Phone not recorded"}</span>
  );
}

function AdminOrderCard({
  order,
  token,
  notify,
  onUpdated,
  onActivity,
}) {
  const id = idOf(order);

  const [current, setCurrent] = useState(order);
  const [draft, setDraft] = useState(() => draftOf(order));

  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const mounted = useRef(false);
  const generation = useRef(0);
  const lock = useRef(false);

  const dirty =
    expanded &&
    JSON.stringify(draft) !==
      JSON.stringify(draftOf(current));

  const busy = loading || saving;
  const due = amount(current?.payment?.amountDue);

  const needsCollection =
    methodOf(current) === "cod-partial" &&
    draft.status === "delivered" &&
    due > 0;

  const index = FLOW.indexOf(current.status);
  const dispatch = dispatchInfo(current);
  const issue = paymentIssue(current);

  const detailsId =
    `order-details-${encodeURIComponent(id)}`;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      generation.current++;
      onActivity(id, null);
    };
  }, [id, onActivity]);

  useEffect(() => {
    onActivity(id, {
      dirty,
      busy,
    });
  }, [id, dirty, busy, onActivity]);

  useEffect(() => {
    if (!expanded && !lock.current) {
      setCurrent(order);
      setDraft(draftOf(order));
      setReady(false);
    }
  }, [order, expanded]);

  async function loadDetails() {
    if (lock.current) return;

    if (
      dirty &&
      !window.confirm(
        "Discard the unsaved changes and load the latest order?",
      )
    ) {
      return;
    }

    lock.current = true;

    onActivity(id, {
      dirty,
      busy: true,
    });

    const version = ++generation.current;

    setExpanded(true);
    setLoading(true);
    setReady(false);
    setError("");
    setSuccess("");

    let loaded = false;

    try {
      const fresh = await getAdminOrderById(token, id);

      if (
        !mounted.current ||
        version !== generation.current
      ) {
        return;
      }

      if (!fresh || idOf(fresh) !== id) {
        throw new Error(
          "The correct order details were not returned. Please reload.",
        );
      }

      setCurrent(fresh);
      setDraft(draftOf(fresh));
      setReady(true);

      loaded = true;
    } catch (failure) {
      if (
        mounted.current &&
        version === generation.current
      ) {
        setError(
          failure.message ||
            "Order details could not be loaded.",
        );
      }
    } finally {
      lock.current = false;

      if (
        mounted.current &&
        version === generation.current
      ) {
        setLoading(false);

        onActivity(id, {
          dirty: loaded ? false : dirty,
          busy: false,
        });
      }
    }
  }

  function closeDetails() {
    if (lock.current) return;

    if (
      dirty &&
      !window.confirm(
        "Discard the unsaved order changes?",
      )
    ) {
      return;
    }

    setDraft(draftOf(current));
    setExpanded(false);
    setError("");
    setSuccess("");

    onActivity(id, {
      dirty: false,
      busy: false,
    });
  }

  function change(field, value) {
    setSuccess("");

    setDraft((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "status"
        ? { codBalanceCollected: false }
        : {}),
    }));

    onActivity(id, {
      dirty: true,
      busy: false,
    });
  }

  async function save(event) {
    event.preventDefault();

    if (!ready || lock.current) return;

    const invalid = validateDraft(current, draft);

    if (invalid) {
      setError(invalid);
      return;
    }

    if (!dirty) {
      setError("There are no changes to save.");
      return;
    }

    if (
      draft.status === "delivered" &&
      draft.status !== current.status &&
      !window.confirm(
        needsCollection
          ? `Confirm delivery and record ${money(due)} actually collected?`
          : "Confirm that the customer received this order?",
      )
    ) {
      return;
    }

    lock.current = true;

    onActivity(id, {
      dirty,
      busy: true,
    });

    setSaving(true);
    setError("");
    setSuccess("");

    let saveStarted = false;
    let saved = false;

    try {
      const fresh = await getAdminOrderById(token, id);

      if (!mounted.current) return;

      if (!fresh || idOf(fresh) !== id) {
        throw new Error(
          "Current order details could not be verified.",
        );
      }

      if (snapshot(fresh) !== snapshot(current)) {
        setReady(false);

        throw new Error(
          "This order changed since you opened it. Reload its details and review the latest payment and status before saving.",
        );
      }

      saveStarted = true;

      const updated = await updateAdminOrderStatus(
        token,
        id,
        updatePayload(fresh, draft),
      );

      if (!mounted.current) return;

      if (
        !updated ||
        idOf(updated) !== id ||
        updated.status !== draft.status
      ) {
        throw new Error(
          "The saved order status could not be confirmed.",
        );
      }

      setCurrent(updated);
      setDraft(draftOf(updated));
      setReady(true);

      saved = true;

      setSuccess(
        "Order update confirmed by the backend.",
      );

      onActivity(id, {
        dirty: false,
        busy: false,
      });

      onUpdated(updated);

      try {
        notify?.(`Order ${id} updated.`);
      } catch {
        // The order is already saved.
      }
    } catch (failure) {
      if (!mounted.current) return;

      if (saveStarted) {
        setReady(false);
      }

      setError(
        saveStarted
          ? `${failure.message || "The update could not be confirmed."} Reload order details before retrying.`
          : failure.message ||
              "Unable to verify the latest order. Please retry loading its details.",
      );
    } finally {
      lock.current = false;

      if (mounted.current) {
        setSaving(false);

        onActivity(id, {
          dirty: saved ? false : dirty,
          busy: false,
        });
      }
    }
  }

  return (
    <article
      className="ao-card"
      aria-busy={busy}
    >
      <header className="ao-card-header">
        <div>
          <h2>{id}</h2>
          <p className="ao-muted">
            Placed {formatDate(current.createdAt)}
          </p>
        </div>

        <div className="ao-badges">
          <Badge status={current.status} />

          {demoOrder(current) && (
            <span className="ao-badge ao-test">
              Test / demo order
            </span>
          )}
        </div>
      </header>

      <div className="ao-summary">
        <div>
          <span className="ao-muted">
            Customer / recipient
          </span>

          <strong>{nameOf(current)}</strong>

          <Phone value={phoneOf(current)} />

          {emailOf(current) && (
            <span className="ao-muted ao-wrap">
              {emailOf(current)}
            </span>
          )}
        </div>

        <div>
          <span className="ao-muted">
            Order value
          </span>

          <strong className="ao-total">
            {money(totalOf(current))}
          </strong>

          <span className="ao-muted">
            {Array.isArray(current.items)
              ? current.items.length
              : 0}{" "}
            product lines
          </span>
        </div>

        <div>
          <span className="ao-muted">
            {methodLabel(current)}
          </span>

          <strong>
            {label(current.payment?.status)}
          </strong>

          <span>
            Recorded paid:{" "}
            <b>{money(current.payment?.amountPaid)}</b>
          </span>

          <span>
            {current.status === "cancelled"
              ? "Recorded balance (not collectable)"
              : "Remaining balance"}
            :{" "}
            <b>{money(current.payment?.amountDue)}</b>
          </span>
        </div>

        <div>
          <span className="ao-muted">
            Dispatch deadline
          </span>

          <strong
            className={
              dispatch.overdue ? "ao-danger-text" : ""
            }
          >
            {formatDate(dispatch.due)}
          </strong>

          {dispatch.overdue && (
            <span className="ao-danger-text">
              Overdue — follow up on dispatch
            </span>
          )}

          <span className="ao-muted">
            {[
              current.shippingAddress?.city,
              current.shippingAddress?.pincode,
            ]
              .filter(Boolean)
              .join(" · ") ||
              "Delivery location not recorded"}
          </span>
        </div>
      </div>

      <div className="ao-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={
            expanded ? closeDetails : loadDetails
          }
        >
          {expanded ? "Close details" : "Manage order"}
        </button>

        {expanded && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={loadDetails}
          >
            Reload details
          </button>
        )}
      </div>

      {error && (
        <p className="ao-alert" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="ao-success" role="status">
          {success}
        </p>
      )}

      {expanded && (
        <div
          className="ao-details"
          id={detailsId}
        >
          {loading ? (
            <p role="status">
              Loading latest order details…
            </p>
          ) : (
            <>
              {!ready && (
                <p className="ao-notice">
                  Editing is locked until you reload
                  and review the latest order details.
                </p>
              )}

              <section>
                <h3>Ordered products</h3>

                <div className="ao-table-scroll">
                  <table className="ao-table">
                    <caption className="sr-only">
                      Order products, variants and
                      prices in INR
                    </caption>

                    <thead>
                      <tr>
                        <th scope="col">
                          Product / variant
                        </th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Unit price</th>
                        <th scope="col">Line total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(Array.isArray(current.items)
                        ? current.items
                        : []
                      ).map((item, position) => (
                        <tr
                          key={`${
                            item.productId ||
                            item.id ||
                            "item"
                          }-${position}`}
                        >
                          <td>
                            <strong>
                              {item.name || "Unnamed product"}
                            </strong>

                            <small>
                              {[
                                item.selectedColor,
                                item.selectedSize &&
                                  `Size ${item.selectedSize}`,
                              ]
                                .filter(Boolean)
                                .join(" / ") ||
                                "No variant recorded"}
                            </small>

                            {item.sku && (
                              <small>SKU: {item.sku}</small>
                            )}

                            {item.supplier?.name && (
                              <small>
                                Supplier: {item.supplier.name}
                              </small>
                            )}
                          </td>

                          <td>
                            {item.quantity ?? "Not recorded"}
                          </td>

                          <td>{money(item.price)}</td>

                          <td>
                            {money(
                              amount(item.price) !== null &&
                                Number.isSafeInteger(
                                  item.quantity,
                                ) &&
                                item.quantity > 0
                                ? amount(item.price) *
                                    item.quantity
                                : null,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!current.items?.length && (
                  <p className="ao-muted">
                    No order items were returned.
                  </p>
                )}
              </section>

              <div className="ao-detail-grid">
                <section>
                  <h3>Payment and complete costs</h3>

                  <dl className="ao-money-list">
                    <Row title="Items subtotal">
                      {money(current.pricing?.subtotal)}
                    </Row>

                    <Row title="Coupon savings">
                      {money(
                        current.pricing?.couponDiscount,
                      )}
                    </Row>

                    <Row title="Delivery charges">
                      {money(current.pricing?.shipping)}
                    </Row>

                    <Row title="Order total">
                      <strong>
                        {money(totalOf(current))}
                      </strong>
                    </Row>

                    <Row title="Method">
                      {methodLabel(current)}
                    </Row>

                    <Row title="Payment status">
                      {label(current.payment?.status)}
                    </Row>

                    <Row
                      title={
                        current.payment?.status === "refunded"
                          ? "Recorded amount retained"
                          : "Recorded amount paid"
                      }
                    >
                      {money(current.payment?.amountPaid)}
                    </Row>

                    <Row
                      title={
                        current.status === "cancelled"
                          ? "Recorded balance (not collectable)"
                          : "Remaining balance"
                      }
                    >
                      {money(current.payment?.amountDue)}
                    </Row>

                    {methodOf(current) === "cod-partial" && (
                      <>
                        <Row
                          title={`Required online advance${
                            amount(
                              current.payment?.advancePercentage,
                            ) > 0
                              ? ` (${current.payment.advancePercentage}%)`
                              : ""
                          }`}
                        >
                          {money(
                            current.payment?.advanceAmount,
                          )}
                        </Row>

                        <Row title="COD balance status">
                          {label(
                            current.payment?.balanceStatus,
                          )}
                        </Row>
                      </>
                    )}
                  </dl>

                  {current.payment?.razorpayPaymentId && (
                    <p className="ao-muted ao-wrap">
                      Payment reference:{" "}
                      {current.payment.razorpayPaymentId}
                    </p>
                  )}

                  {current.payment?.advancePaidAt && (
                    <p className="ao-muted">
                      Advance received:{" "}
                      {formatDate(
                        current.payment.advancePaidAt,
                      )}
                    </p>
                  )}

                  {current.payment?.balanceCollectedAt && (
                    <p className="ao-muted">
                      COD collected:{" "}
                      {formatDate(
                        current.payment.balanceCollectedAt,
                      )}
                    </p>
                  )}

                  {issue &&
                    current.status !== "cancelled" && (
                      <p className="ao-notice">{issue}</p>
                    )}
                </section>

                <section>
                  <h3>Shipping and contact</h3>

                  <address className="ao-address">
                    <strong>{nameOf(current)}</strong>

                    <span>
                      {current.shippingAddress?.addressLine ||
                        current.shippingAddress?.addressLine1 ||
                        current.shippingAddress?.address ||
                        "Address not recorded"}
                    </span>

                    {current.shippingAddress?.addressLine2 && (
                      <span>
                        {current.shippingAddress.addressLine2}
                      </span>
                    )}

                    {current.shippingAddress?.landmark && (
                      <span>
                        {current.shippingAddress.landmark}
                      </span>
                    )}

                    <span>
                      {[
                        current.shippingAddress?.city,
                        current.shippingAddress?.state,
                        current.shippingAddress?.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>

                    <Phone value={phoneOf(current)} />

                    {emailOf(current) && (
                      <span className="ao-wrap">
                        {emailOf(current)}
                      </span>
                    )}
                  </address>

                  <p>
                    Delivery option:{" "}
                    {current.delivery?.label ||
                      {
                        standard: "Standard delivery",
                        express: "Express delivery",
                      }[current.deliveryMethod] ||
                      "Not recorded"}
                  </p>

                  <p>
                    Estimated delivery:{" "}
                    {formatDate(
                      current.tracking?.estimatedDelivery,
                    )}
                  </p>

                  <p>
                    Fulfilment responsibility:{" "}
                    {label(
                      current.fulfilment?.responsibility,
                    )}
                  </p>

                  {current.fulfilment?.notes && (
                    <p className="ao-wrap">
                      {current.fulfilment.notes}
                    </p>
                  )}

                  {current.orderNote && (
                    <p className="ao-wrap">
                      <b>Delivery instructions:</b>{" "}
                      {current.orderNote}
                    </p>
                  )}

                  {current.giftMessage && (
                    <p className="ao-wrap">
                      <b>Gift message:</b>{" "}
                      {current.giftMessage}
                    </p>
                  )}
                </section>
              </div>

              <section>
                <h3>Update fulfilment and tracking</h3>

                {current.status === "cancelled" ? (
                  <p className="ao-notice">
                    This order is cancelled. Do not
                    dispatch it or collect a remaining
                    COD balance.
                  </p>
                ) : current.status === "payment-pending" ? (
                  <p className="ao-notice">
                    Payment verification is pending.
                    The payment backend must confirm
                    it before fulfilment can start.
                    Check the gateway transaction
                    before asking the customer to
                    pay again.
                  </p>
                ) : index < 0 ? (
                  <p className="ao-notice">
                    This status has no supported
                    fulfilment transition. Review it
                    before editing.
                  </p>
                ) : (
                  <form onSubmit={save}>
                    <fieldset
                      className="ao-form"
                      disabled={!ready || busy}
                    >
                      <label>
                        Order status

                        <select
                          value={draft.status}
                          disabled={
                            current.status === "delivered"
                          }
                          onChange={(event) =>
                            change(
                              "status",
                              event.target.value,
                            )
                          }
                        >
                          {FLOW.map((status, position) => (
                            <option
                              key={status}
                              value={status}
                              disabled={
                                position < index ||
                                position > index + 1 ||
                                (
                                  position !== index &&
                                  Boolean(issue)
                                )
                              }
                            >
                              {label(status)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Courier / carrier

                        <input
                          type="text"
                          maxLength={100}
                          value={draft.carrier}
                          placeholder="Courier name"
                          onChange={(event) =>
                            change(
                              "carrier",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        Tracking number

                        <input
                          type="text"
                          maxLength={150}
                          value={draft.trackingNumber}
                          placeholder="Courier tracking number"
                          onChange={(event) =>
                            change(
                              "trackingNumber",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        Estimated delivery

                        <input
                          type="date"
                          value={draft.estimatedDelivery}
                          onChange={(event) =>
                            change(
                              "estimatedDelivery",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <p className="ao-muted ao-full">
                        {current.status === "delivered"
                          ? `Delivered: ${formatDate(
                              current.delivery?.deliveredAt,
                            )}. You can correct recorded tracking details.`
                          : `Current: ${label(
                              current.status,
                            )}. Next step: ${label(
                              FLOW[index + 1],
                            )}.`}
                      </p>

                      {needsCollection && (
                        <label className="ao-collection ao-full">
                          <input
                            type="checkbox"
                            checked={
                              draft.codBalanceCollected
                            }
                            onChange={(event) =>
                              change(
                                "codBalanceCollected",
                                event.target.checked,
                              )
                            }
                          />

                          <span>
                            I confirm the remaining{" "}
                            <strong>{money(due)}</strong>{" "}
                            was actually received from
                            the customer. Confirm only
                            after checking the courier's
                            collection record.
                          </span>
                        </label>
                      )}

                      <div className="ao-actions ao-full">
                        <button
                          type="submit"
                          className="button"
                          disabled={
                            !dirty ||
                            (
                              needsCollection &&
                              !draft.codBalanceCollected
                            )
                          }
                        >
                          {saving
                            ? "Verifying and saving…"
                            : needsCollection
                              ? `Record ${money(due)} collected & complete delivery`
                              : "Save order update"}
                        </button>

                        {dirty && (
                          <span className="ao-muted">
                            Unsaved changes
                          </span>
                        )}
                      </div>
                    </fieldset>
                  </form>
                )}
              </section>

              <div className="ao-detail-grid">
                <section>
                  <h3>Tracking history</h3>

                  {Array.isArray(
                    current.tracking?.events,
                  ) &&
                  current.tracking.events.length ? (
                    <ol className="ao-history">
                      {[...current.tracking.events]
                        .reverse()
                        .map((event, position) => (
                          <li
                            key={`${event.timestamp}-${position}`}
                          >
                            <strong>
                              {label(event.status)}
                            </strong>

                            <p>
                              {event.description ||
                                "Order update"}
                            </p>

                            <small>
                              {formatDate(event.timestamp)}
                            </small>
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p className="ao-muted">
                      No tracking events recorded.
                    </p>
                  )}
                </section>

                <section>
                  <h3>
                    Cancellations, returns and refunds
                  </h3>

                  {current.status === "cancelled" && (
                    <p className="ao-notice">
                      Order cancelled. Any refund
                      progress is shown below.
                    </p>
                  )}

                  {activeRecord(current.returnRequest) ? (
                    <p>
                      Request:{" "}
                      {label(current.returnRequest.type)}
                      {" · "}
                      <strong>
                        {label(
                          current.returnRequest.status,
                        )}
                      </strong>
                    </p>
                  ) : (
                    <p className="ao-muted">
                      No return or exchange request
                      recorded.
                    </p>
                  )}

                  {activeRecord(current.refund) ? (
                    <>
                      <p>
                        Refund:{" "}
                        <strong>
                          {label(current.refund.status)}
                        </strong>
                      </p>

                      <p>
                        Recorded refund amount:{" "}
                        {money(current.refund.amount)}
                      </p>

                      {current.refund.reference && (
                        <p className="ao-wrap">
                          Reference:{" "}
                          {current.refund.reference}
                        </p>
                      )}

                      {current.refund.refundedAt && (
                        <p>
                          Recorded completed:{" "}
                          {formatDate(
                            current.refund.refundedAt,
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="ao-muted">
                      No refund request recorded.
                    </p>
                  )}

                  <div className="ao-actions">
                    <Link
                      className="button secondary"
                      to="/admin/returns"
                    >
                      Manage returns / refunds
                    </Link>

                    <Link
                      className="button secondary"
                      to="/admin/support"
                    >
                      Customer support
                    </Link>
                  </div>

                  <p className="ao-muted">
                    Recording a manual refund does
                    not transfer money. Cancellation
                    actions need the backend's
                    eligibility checks.
                  </p>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function AdminOrdersWorkspace({ token }) {
  const { notify } = useStore();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);

  const activities = useRef(new Map());

  const onActivity = useCallback((id, value) => {
    if (value) {
      activities.current.set(id, value);
    } else {
      activities.current.delete(id);
    }
  }, []);

  function mayNavigate() {
    const states = [
      ...activities.current.values(),
    ];

    if (states.some((state) => state.busy)) {
      setError(
        "Wait for the current order request to finish before changing the list.",
      );

      return false;
    }

    if (
      states.some((state) => state.dirty) &&
      !window.confirm(
        "Discard unsaved order edits and change or reload the list?",
      )
    ) {
      return false;
    }

    return true;
  }

  function navigate(action) {
    if (!mayNavigate()) return;

    activities.current.clear();
    action();

    setRevision((value) => value + 1);
  }

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    async function load() {
      try {
        const result = readList(
          await getAdminOrders(token, {
            status,
            search,
            page,
            limit: PAGE_SIZE,
          }),
        );

        if (cancelled) return;

        const last = Math.max(1, result.pages);

        if (page > last) {
          setPage(last);
          return;
        }

        setOrders(result.orders);
        setTotal(result.total);
        setPages(last);
      } catch (failure) {
        if (!cancelled) {
          setOrders([]);
          setTotal(0);
          setPages(1);

          setError(
            failure.message ||
              "Unable to load orders.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, status, search, page, revision]);

  useEffect(() => {
    function warn(event) {
      if (
        [...activities.current.values()].some(
          (state) => state.dirty || state.busy,
        )
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener(
        "beforeunload",
        warn,
      );
    };
  }, []);

  const stats = useMemo(
    () => ({
      preparing: orders.filter((order) =>
        ["confirmed", "processing", "packed"].includes(
          order.status,
        ),
      ).length,

      travelling: orders.filter((order) =>
        ["shipped", "out-for-delivery"].includes(
          order.status,
        ),
      ).length,

      overdue: orders.filter(
        (order) => dispatchInfo(order).overdue,
      ).length,

      pending: orders.filter(
        (order) => order.status === "payment-pending",
      ).length,
    }),
    [orders],
  );

  function updated(order) {
    setOrders((current) =>
      current.map((item) =>
        idOf(item) === idOf(order)
          ? order
          : item,
      ),
    );
  }

  function adminLinkClick(event) {
    if (!mayNavigate()) {
      event.preventDefault();
    }
  }

  return (
    <div className="page ao-page">
      <header className="ao-heading">
        <div>
          <p className="ao-muted">
            GYMDROBE ADMIN
          </p>

          <h1>Manage orders</h1>

          <p className="ao-muted">
            Check payment, prepare products, record
            courier tracking and confirm delivery.
          </p>
        </div>
      </header>

      <nav
        className="ao-nav"
        aria-label="Admin sections"
      >
        <Link
          to="/admin"
          onClick={adminLinkClick}
        >
          Overview
        </Link>

        <Link
          to="/admin/products"
          onClick={adminLinkClick}
        >
          Products & stock
        </Link>

        <Link
          to="/admin/returns"
          onClick={adminLinkClick}
        >
          Returns & refunds
        </Link>

        <Link
          to="/admin/support"
          onClick={adminLinkClick}
        >
          Support
        </Link>
      </nav>

      <section
        className="ao-stats"
        aria-label="Current page order counts"
      >
        {[
          [
            "Matching orders",
            total,
            "Results at the last list refresh",
          ],
          [
            "To prepare",
            stats.preparing,
            "On this page",
          ],
          [
            "On the way",
            stats.travelling,
            "On this page",
          ],
          [
            "Dispatch overdue",
            stats.overdue,
            "Recorded deadlines on this page",
          ],
        ].map(([title, value, note]) => (
          <div key={title}>
            <span>{title}</span>
            <strong>{loading ? "—" : value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </section>

      <section className="ao-card">
        <form
          className="ao-search"
          onSubmit={(event) => {
            event.preventDefault();

            navigate(() => {
              setSearch(searchInput.trim());
              setPage(1);
            });
          }}
        >
          <label>
            Find an order

            <input
              type="search"
              maxLength={150}
              placeholder="Order number, customer, email or phone"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />
          </label>

          <button
            type="submit"
            className="button"
            disabled={loading}
          >
            Search
          </button>

          <button
            type="button"
            className="button secondary"
            disabled={loading}
            onClick={() =>
              navigate(() => {
                setSearchInput("");
                setSearch("");
                setStatus("all");
                setPage(1);
              })
            }
          >
            Reset filters
          </button>

          <button
            type="button"
            className="button secondary"
            disabled={loading}
            onClick={() => navigate(() => {})}
          >
            Refresh
          </button>
        </form>

        <div
          className="ao-filter-row"
          role="group"
          aria-label="Filter by order status"
        >
          {FILTERS.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={status === value}
              disabled={loading}
              onClick={() =>
                navigate(() => {
                  setStatus(value);
                  setPage(1);
                })
              }
            >
              {label(value)}
            </button>
          ))}
        </div>

        <p className="ao-muted">
          {search ? `Search: ${search}. ` : ""}
          Status: {label(status)}.{" "}
          {stats.pending} payment-pending orders on
          this page. Counts include any displayed
          test orders. Updated orders stay visible
          until you refresh to reapply the filters.
        </p>
      </section>

      {error && (
        <div className="ao-alert" role="alert">
          <p>{error}</p>

          <button
            type="button"
            className="button secondary"
            disabled={loading}
            onClick={() => navigate(() => {})}
          >
            Retry loading
          </button>
        </div>
      )}

      {loading ? (
        <p className="ao-card" role="status">
          Loading orders…
        </p>
      ) : !orders.length ? (
        !error && (
          <section className="ao-card">
            <h2>No matching orders</h2>
            <p>
              Try a different search or reset
              your filters.
            </p>
          </section>
        )
      ) : (
        <section
          className="ao-order-list"
          aria-label="Orders"
        >
          {orders.map((order) => (
            <AdminOrderCard
              key={idOf(order)}
              order={order}
              token={token}
              notify={notify}
              onUpdated={updated}
              onActivity={onActivity}
            />
          ))}
        </section>
      )}

      {!loading && !error && pages > 1 && (
        <nav
          className="ao-pagination"
          aria-label="Order pages"
        >
          <button
            type="button"
            className="button secondary"
            disabled={page <= 1}
            onClick={() =>
              navigate(() =>
                setPage((value) =>
                  Math.max(1, value - 1),
                ),
              )
            }
          >
            Previous
          </button>

          <span>
            Page {page} of {pages}
          </span>

          <button
            type="button"
            className="button secondary"
            disabled={page >= pages}
            onClick={() =>
              navigate(() =>
                setPage((value) =>
                  Math.min(pages, value + 1),
                ),
              )
            }
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  const auth = useAuth();

  if (auth.loading || auth.authLoading) {
    return (
      <div
        className="page ao-page"
        role="status"
      >
        Checking admin session…
      </div>
    );
  }

  if (auth.authError) {
    return (
      <div className="page ao-page">
        <h1>Unable to verify your account</h1>

        <p className="ao-alert" role="alert">
          {auth.authError}
        </p>

        <button
          type="button"
          className="button"
          onClick={auth.retrySession}
        >
          Retry session
        </button>
      </div>
    );
  }

  if (!auth.user || !auth.token) {
    return (
      <div className="page ao-page">
        <h1>Admin orders</h1>

        <p>
          Sign in with an administrator account.
        </p>

        <Link
          className="button"
          to="/login?next=%2Fadmin%2Forders"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (auth.user.role !== "admin") {
    return (
      <div className="page ao-page">
        <h1>Admin access required</h1>

        <p>
          Your account does not have permission
          to manage orders.
        </p>

        <Link className="button" to="/">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <AdminOrdersWorkspace
      key={`${
        auth.user.id ||
        auth.user._id ||
        "admin"
      }:${auth.token}`}
      token={auth.token}
    />
  );
}