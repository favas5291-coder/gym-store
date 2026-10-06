import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} from "../services/adminOrderApi.js";
import "./AdminOrdersPage.css";
const STATUS_FLOW = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];
const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "payment-pending",
    label: "Payment pending",
  },
  {
    value: "confirmed",
    label: "Confirmed",
  },
  {
    value: "processing",
    label: "Processing",
  },
  {
    value: "shipped",
    label: "Shipped",
  },
  {
    value: "out-for-delivery",
    label: "Out for delivery",
  },
  {
    value: "delivered",
    label: "Delivered",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];
function statusLabel(value) {
  const match = STATUS_OPTIONS.find((item) => item.value === value);
  if (match) {
    return match.label;
  }
  return String(value || "Unknown")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function recordedAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
function money(value) {
  const amount = recordedAmount(value);
  return amount === null
    ? "Not recorded"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount);
}
function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function dateInputValue(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function orderIdOf(order) {
  return order?.orderNumber || order?.id || "";
}
function customerName(order) {
  return (
    order?.customer?.name ||
    order?.user?.name ||
    order?.shippingAddress?.fullName ||
    "Customer"
  );
}
function customerEmail(order) {
  return order?.customer?.email || order?.user?.email || "";
}
function createDraft(order) {
  return {
    status: order?.status || "confirmed",
    carrier: order?.tracking?.carrier || "",
    trackingNumber: order?.tracking?.trackingNumber || "",
    estimatedDelivery: dateInputValue(order?.tracking?.estimatedDelivery),
    codBalanceCollected: false,
  };
}
function StatusBadge({ status }) {
  const styles = {
    "payment-pending": {
      background: "#fff7ed",
      color: "#9a3412",
    },
    confirmed: {
      background: "#eef2ff",
      color: "#3730a3",
    },
    processing: {
      background: "#fff7ed",
      color: "#9a3412",
    },
    shipped: {
      background: "#eff6ff",
      color: "#1d4ed8",
    },
    "out-for-delivery": {
      background: "#fefce8",
      color: "#854d0e",
    },
    delivered: {
      background: "#ecfdf5",
      color: "#047857",
    },
    cancelled: {
      background: "#fef2f2",
      color: "#b91c1c",
    },
  };
  const selectedStyle = styles[status] || {
    background: "#f4f4f5",
    color: "#3f3f46",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 800,
        ...selectedStyle,
      }}
    >
      {statusLabel(status)}
    </span>
  );
}
function AdminOrderCard({ order, token, notify, onUpdated }) {
  const id = orderIdOf(order);
  const [expanded, setExpanded] = useState(false);
  const [detailsReady, setDetailsReady] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const saveLock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  const [detailedOrder, setDetailedOrder] = useState(order);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(() => createDraft(order));
  useEffect(() => {
    if (expanded || saveLock.current) return;
    generation.current++;
    setLoadingDetails(false);
    setDetailedOrder(order);
    setDetailsReady(false);
    setDraft(createDraft(order));
  }, [order]);
  async function toggleDetails() {
    if (saveLock.current || loadingDetails) return;
    if (expanded) {
      if (
        JSON.stringify(draft) !== JSON.stringify(createDraft(current)) &&
        !window.confirm("Discard the unsaved order changes?")
      )
        return;
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setError("");
    if (!token || !id) {
      return;
    }
    const version = ++generation.current;
    setDetailsReady(false);
    setLoadingDetails(true);
    try {
      const fresh = await getAdminOrderById(token, id);
      if (!mounted.current || version !== generation.current) return;
      if (!fresh || !orderIdOf(fresh))
        throw new Error(
          "The order details were not returned. Reload before editing.",
        );
      setDetailedOrder(fresh);
      setDraft(createDraft(fresh));
      setDetailsReady(true);
    } catch (loadError) {
      console.error("Load admin order error:", loadError);
      if (mounted.current && version === generation.current)
        setError(loadError.message || "Unable to load this order.");
    } finally {
      if (mounted.current && version === generation.current)
        setLoadingDetails(false);
    }
  }
  const current = detailedOrder || order;
  const cancelled = current?.status === "cancelled";
  const delivered = current?.status === "delivered";
  const paymentPending = current?.status === "payment-pending";
  const currentIndex = STATUS_FLOW.indexOf(current?.status);
  const isPartialCod =
    current?.payment?.method === "cod-partial" ||
    current?.paymentMethod === "cod-partial";
  const isFullOnline =
    current?.payment?.method === "razorpay" ||
    current?.paymentMethod === "razorpay";
  const advancePercentage = Number(current?.payment?.advancePercentage || 0);
  const advanceAmount = recordedAmount(current?.payment?.advanceAmount);
  const amountPaid = recordedAmount(current?.payment?.amountPaid);
  const amountDue = recordedAmount(current?.payment?.amountDue);
  const totalAmount = recordedAmount(
    current?.payment?.totalAmount ?? current?.pricing?.finalTotal,
  );
  const codBalancePending =
    isPartialCod &&
    current?.payment?.balanceStatus === "pending" &&
    amountDue > 0;
  const deliveryNeedsCodConfirmation =
    draft.status === "delivered" && codBalancePending;
  async function saveOrder(event) {
    event.preventDefault();
    if (!token || !id || saveLock.current || !detailsReady) return;
    if (
      currentIndex < 0 ||
      STATUS_FLOW.indexOf(draft.status) < currentIndex ||
      STATUS_FLOW.indexOf(draft.status) > currentIndex + 1
    ) {
      setError("Choose the current status or the next fulfilment step.");
      return;
    }
    if (
      draft.status === "shipped" &&
      (!draft.carrier.trim() || !draft.trackingNumber.trim())
    ) {
      setError(
        "Enter the courier and tracking number before marking the order shipped.",
      );
      return;
    }
    if (
      draft.status === "delivered" &&
      isPartialCod &&
      (amountDue === null ||
        amountPaid === null ||
        !["partially-paid", "paid"].includes(current?.payment?.status))
    ) {
      setError(
        "Reconcile the verified advance, amount paid and COD balance before marking this order delivered.",
      );
      return;
    }
    if (
      draft.status === "delivered" &&
      codBalancePending &&
      !draft.codBalanceCollected
    ) {
      setError(
        `Confirm that ${money(
          amountDue,
        )} was collected from the customer before marking this order delivered.`,
      );
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminOrderStatus(token, id, {
        status: draft.status,
        carrier: draft.carrier,
        trackingNumber: draft.trackingNumber,
        estimatedDelivery: draft.estimatedDelivery,
        codBalanceCollected:
          draft.status === "delivered" && codBalancePending
            ? Boolean(draft.codBalanceCollected)
            : false,
      });
      if (!mounted.current) return;
      if (!updated || !orderIdOf(updated))
        throw new Error(
          "The update response did not include the order. Reload its details to check the saved status.",
        );
      setDetailedOrder(updated);
      setDraft(createDraft(updated));
      onUpdated(updated);
      notify?.(
        isPartialCod && draft.status === "delivered" && codBalancePending
          ? `Order ${id} delivered and COD balance recorded.`
          : `Order ${id} updated.`,
      );
    } catch (saveError) {
      console.error("Update admin order error:", saveError);
      if (mounted.current)
        setError(
          saveError.message ||
            "Unable to update this order. Reload its details before retrying.",
        );
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return (
    <article
      className="panel ao-card"
      aria-busy={saving}
      style={{
        padding: "20px",
        display: "grid",
        gap: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "8px",
            }}
          >
            <strong>{id}</strong>
            <StatusBadge status={current?.status} />
          </div>
          <p
            className="muted"
            style={{
              margin: 0,
            }}
          >
            {formatDate(current?.createdAt)}
          </p>
        </div>
        <div
          style={{
            textAlign: "right",
          }}
        >
          <strong
            style={{
              fontSize: "18px",
            }}
          >
            {money(current?.pricing?.finalTotal)}
          </strong>
          <p
            className="muted"
            style={{
              margin: "4px 0 0",
            }}
          >
            {(current?.items || []).reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0,
            )}{" "}
            units · {current?.items?.length || 0} order lines
          </p>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        <div>
          <span className="muted">Customer</span>
          <div>
            <strong>{customerName(current)}</strong>
          </div>
          {customerEmail(current) && (
            <div className="muted">{customerEmail(current)}</div>
          )}
        </div>
        <div>
          <span className="muted">Payment</span>
          <div>
            <strong>
              {isPartialCod
                ? "COD WITH ONLINE ADVANCE"
                : isFullOnline
                  ? "FULL ONLINE PAYMENT"
                  : String(
                      current?.payment?.method ||
                        current?.paymentMethod ||
                        "Unknown",
                    ).toUpperCase()}
            </strong>
          </div>
          <div className="muted">
            {statusLabel(current?.payment?.status || "pending")}
          </div>
          {isPartialCod && (
            <div
              style={{
                display: "grid",
                gap: "3px",
                marginTop: "8px",
              }}
            >
              <span>
                Required advance{" "}
                {advancePercentage > 0 ? `(${advancePercentage}%)` : ""}:{" "}
                <strong>{money(advanceAmount)}</strong>
              </span>
              <span>
                Paid: <strong>{money(amountPaid)}</strong>
              </span>
              <span>
                Remaining COD: <strong>{money(amountDue)}</strong>
              </span>
              <span className="muted">
                Balance:{" "}
                {statusLabel(current?.payment?.balanceStatus || "pending")}
              </span>
            </div>
          )}
          {isFullOnline && (
            <div
              style={{
                marginTop: "8px",
              }}
            >
              <span>
                Paid: <strong>{money(amountPaid)}</strong>
              </span>
            </div>
          )}
        </div>
        {!isPartialCod && !isFullOnline && (
          <div>
            <span className="muted">Recorded amounts</span>
            <p>
              Paid: <strong>{money(amountPaid)}</strong>
            </p>
            <p>
              Due: <strong>{money(amountDue)}</strong>
            </p>
          </div>
        )}
        <div>
          <span className="muted">Delivery</span>
          <div>
            <strong>{current?.delivery?.label || "Standard delivery"}</strong>
          </div>
          <div className="muted">
            {current?.shippingAddress?.city || "—"}
            {" · "}
            {current?.shippingAddress?.pincode || "—"}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="button secondary"
          onClick={toggleDetails}
          disabled={saving || loadingDetails}
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Manage order"}
        </button>
        <Link
          className="button secondary"
          to={`/orders/${encodeURIComponent(id)}`}
        >
          Customer view
        </Link>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {expanded && (
        <div
          style={{
            display: "grid",
            gap: "22px",
            borderTop: "1px solid #e4e4e7",
            paddingTop: "20px",
          }}
        >
          {loadingDetails ? (
            <p className="muted" role="status">
              Loading order…
            </p>
          ) : !detailsReady ? (
            <div>
              <p>Current order details are required before editing.</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => setExpanded(false)}
              >
                Close and reopen to retry
              </button>
            </div>
          ) : (
            <>
              <section>
                <h3>1. Ordered items</h3>
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  {(current?.items || []).map((item, index) => (
                    <div
                      key={`${item.productId || item.id}-${index}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        padding: "12px 0",
                        borderBottom: "1px solid #f1f1f1",
                      }}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <div className="muted">
                          Qty: {item.quantity}
                          {item.selectedSize
                            ? ` · Size: ${item.selectedSize}`
                            : ""}
                          {item.selectedColor
                            ? ` · Colour: ${item.selectedColor}`
                            : ""}
                        </div>
                      </div>
                      <strong>
                        {money(
                          Number(item.price || 0) * Number(item.quantity || 0),
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3>2. Payment details</h3>
                <div
                  className="panel"
                  style={{
                    padding: "16px",
                    display: "grid",
                    gap: "10px",
                    maxWidth: "620px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                    }}
                  >
                    <span>Order total</span>
                    <strong>{money(totalAmount)}</strong>
                  </div>
                  {isPartialCod && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                        }}
                      >
                        <span>
                          Required online advance
                          {advancePercentage > 0
                            ? ` (${advancePercentage}%)`
                            : ""}
                        </span>
                        <strong>{money(advanceAmount)}</strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                        }}
                      >
                        <span>Remaining COD</span>
                        <strong>{money(amountDue)}</strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                        }}
                      >
                        <span>COD balance status</span>
                        <strong>
                          {statusLabel(
                            current?.payment?.balanceStatus || "pending",
                          )}
                        </strong>
                      </div>
                      {current?.payment?.advancePaidAt && (
                        <p
                          className="muted"
                          style={{
                            margin: 0,
                          }}
                        >
                          Advance paid:{" "}
                          {formatDate(current.payment.advancePaidAt)}
                        </p>
                      )}
                      {current?.payment?.balanceCollectedAt && (
                        <p
                          className="muted"
                          style={{
                            margin: 0,
                          }}
                        >
                          COD balance collected:{" "}
                          {formatDate(current.payment.balanceCollectedAt)}
                        </p>
                      )}
                    </>
                  )}
                  {isFullOnline && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                        }}
                      >
                        <span>Online amount paid</span>
                        <strong>{money(amountPaid)}</strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                        }}
                      >
                        <span>Amount due</span>
                        <strong>{money(amountDue)}</strong>
                      </div>
                    </>
                  )}
                  {current?.payment?.razorpayPaymentId && (
                    <p
                      className="muted"
                      style={{
                        margin: 0,
                      }}
                    >
                      Razorpay payment ID: {current.payment.razorpayPaymentId}
                    </p>
                  )}
                </div>
              </section>
              <section>
                <h3>3. Shipping address</h3>
                <p>
                  <strong>
                    {current?.shippingAddress?.fullName ||
                      current?.shippingAddress?.name ||
                      customerName(current)}
                  </strong>
                  <br />
                  {current?.shippingAddress?.addressLine ||
                    current?.shippingAddress?.addressLine1 ||
                    ""}
                  {current?.shippingAddress?.addressLine2 && (
                    <>
                      <br />
                      {current.shippingAddress.addressLine2}
                    </>
                  )}
                  <br />
                  {current?.shippingAddress?.landmark
                    ? `${current.shippingAddress.landmark}, `
                    : ""}
                  {current?.shippingAddress?.city || ""}
                  {", "}
                  {current?.shippingAddress?.state || ""}
                  {" - "}
                  {current?.shippingAddress?.pincode || ""}
                  <br />
                  {current?.shippingAddress?.phone || ""}
                </p>
              </section>
              <section>
                <h3>4. Shipping and status update</h3>
                {cancelled ? (
                  <p className="notice">
                    This order was cancelled and cannot move through fulfilment.
                  </p>
                ) : paymentPending ? (
                  <p className="notice">
                    Payment is still pending. Fulfilment will unlock only after
                    GymDrobe verifies the required Razorpay payment.
                  </p>
                ) : currentIndex < 0 ? (
                  <p className="notice">
                    This status has no supported fulfilment transition.
                    Reconcile the order before editing.
                  </p>
                ) : (
                  <form
                    onSubmit={saveOrder}
                    style={{
                      display: "grid",
                      gap: "16px",
                      maxWidth: "720px",
                    }}
                  >
                    <div className="field">
                      <label htmlFor={`status-${id}`}>Order status</label>
                      <select
                        id={`status-${id}`}
                        value={draft.status}
                        disabled={delivered || saving}
                        onChange={(event) =>
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            status: event.target.value,
                            codBalanceCollected: false,
                          }))
                        }
                      >
                        {STATUS_FLOW.map((flowStatus, index) => (
                          <option
                            key={flowStatus}
                            value={flowStatus}
                            disabled={
                              currentIndex >= 0 &&
                              (index < currentIndex || index > currentIndex + 1)
                            }
                          >
                            {statusLabel(flowStatus)}
                          </option>
                        ))}
                      </select>
                      {!delivered &&
                        currentIndex >= 0 &&
                        currentIndex < STATUS_FLOW.length - 1 && (
                          <p className="muted">
                            Next step:{" "}
                            <strong>
                              {statusLabel(STATUS_FLOW[currentIndex + 1])}
                            </strong>
                          </p>
                        )}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <div className="field">
                        <label htmlFor={`carrier-${id}`}>
                          Courier / carrier
                        </label>
                        <input
                          id={`carrier-${id}`}
                          type="text"
                          placeholder="Example: Delhivery"
                          value={draft.carrier}
                          disabled={saving}
                          onChange={(event) =>
                            setDraft((currentDraft) => ({
                              ...currentDraft,
                              carrier: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`tracking-${id}`}>
                          Tracking number
                        </label>
                        <input
                          id={`tracking-${id}`}
                          type="text"
                          placeholder="Tracking number"
                          value={draft.trackingNumber}
                          disabled={saving}
                          onChange={(event) =>
                            setDraft((currentDraft) => ({
                              ...currentDraft,
                              trackingNumber: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`delivery-${id}`}>
                          Estimated delivery
                        </label>
                        <input
                          id={`delivery-${id}`}
                          type="date"
                          value={draft.estimatedDelivery}
                          disabled={saving}
                          onChange={(event) =>
                            setDraft((currentDraft) => ({
                              ...currentDraft,
                              estimatedDelivery: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {deliveryNeedsCodConfirmation && (
                      <div
                        className="notice"
                        style={{
                          display: "grid",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <strong>
                            Remaining COD balance: {money(amountDue)}
                          </strong>
                          <p
                            style={{
                              margin: "6px 0 0",
                            }}
                          >
                            Recorded amount paid: {money(amountPaid)}.
                          </p>
                        </div>
                        <label
                          className="check"
                          style={{
                            alignItems: "flex-start",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(draft.codBalanceCollected)}
                            disabled={saving}
                            onChange={(event) =>
                              setDraft((currentDraft) => ({
                                ...currentDraft,
                                codBalanceCollected: event.target.checked,
                              }))
                            }
                          />
                          <span>
                            <strong>
                              I confirm {money(amountDue)} was collected from
                              the customer.
                            </strong>
                            <br />
                            <small className="muted">
                              Only confirm this after the delivery payment has
                              actually been received.
                            </small>
                          </span>
                        </label>
                      </div>
                    )}
                    {delivered && (
                      <div className="notice">
                        <strong>Delivered</strong>
                        <br />
                        Delivered on{" "}
                        {formatDate(current?.delivery?.deliveredAt)}
                        {isPartialCod &&
                          current?.payment?.balanceStatus === "collected" && (
                            <>
                              <br />
                              COD balance collected successfully.
                            </>
                          )}
                      </div>
                    )}
                    <div>
                      <button
                        type="submit"
                        className="button"
                        disabled={
                          saving ||
                          !detailsReady ||
                          (deliveryNeedsCodConfirmation &&
                            !draft.codBalanceCollected)
                        }
                      >
                        {saving
                          ? "Saving…"
                          : deliveryNeedsCodConfirmation
                            ? `Record ${money(amountDue)} collected & mark delivered`
                            : delivered
                              ? "Update tracking"
                              : "Update order"}
                      </button>
                    </div>
                  </form>
                )}
              </section>
              <section>
                <h3>5. Tracking history</h3>
                {(current?.tracking?.events || []).length ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                    }}
                  >
                    {[...(current?.tracking?.events || [])]
                      .reverse()
                      .map((event, index) => (
                        <div
                          key={`${event.status}-${event.timestamp}-${index}`}
                          style={{
                            borderLeft: "3px solid #18181b",
                            paddingLeft: "14px",
                          }}
                        >
                          <strong>{statusLabel(event.status)}</strong>
                          <p
                            style={{
                              margin: "4px 0",
                            }}
                          >
                            {event.description || "Order update"}
                          </p>
                          <span className="muted">
                            {formatDate(event.timestamp)}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="muted">No tracking events yet.</p>
                )}
              </section>
              {current?.refund?.status &&
                current.refund.status !== "not-requested" && (
                  <section>
                    <h3>Refund record</h3>
                    <p>
                      Status:{" "}
                      <strong>{statusLabel(current.refund.status)}</strong>
                    </p>
                    <p>
                      Amount: <strong>{money(current.refund.amount)}</strong>
                    </p>
                    {current.refund.reference && (
                      <p>Reference: {current.refund.reference}</p>
                    )}
                    {current.refund.refundedAt && (
                      <p>Recorded: {formatDate(current.refund.refundedAt)}</p>
                    )}
                    <p className="muted">
                      A return refund is managed in the returns dashboard.
                      Recording a manual refund does not send money.
                    </p>
                  </section>
                )}
              {current?.returnRequest?.status &&
                current.returnRequest.status !== "not-requested" && (
                  <section>
                    <h3>Return / exchange</h3>
                    <p>
                      <strong>
                        {String(current.returnRequest.type || "").toUpperCase()}
                      </strong>
                      {" · "}
                      {statusLabel(current.returnRequest.status)}
                    </p>
                    <Link className="text-link" to="/admin/returns">
                      Open returns dashboard →
                    </Link>
                  </section>
                )}
            </>
          )}
        </div>
      )}
    </article>
  );
}
function AdminOrdersWorkspace({ user, token }) {
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
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || user?.role !== "admin") {
        if (!cancelled) {
          setOrders([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError("");
      try {
        const result = await getAdminOrders(token, {
          status,
          search,
          page,
          limit: 25,
        });
        if (cancelled) {
          return;
        }
        setOrders(Array.isArray(result.orders) ? result.orders : []);
        setTotal(Number(result.total || 0));
        setPages(Math.max(1, Number(result.pages || 1)));
        const lastPage = Math.max(1, Number(result.pages || 1));
        const nextPage = Math.min(
          lastPage,
          Math.max(1, Number(result.page || page)),
        );
        if (nextPage !== page) setPage(nextPage);
      } catch (loadError) {
        console.error("Load admin orders error:", loadError);
        if (!cancelled) {
          setOrders([]);
          setError(loadError.message || "Unable to load orders.");
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
  }, [token, user?.role, status, search, page, revision]);
  const stats = useMemo(() => {
    const values = {
      "payment-pending": 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      "out-for-delivery": 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const order of orders) {
      if (Object.prototype.hasOwnProperty.call(values, order.status)) {
        values[order.status] += 1;
      }
    }
    return values;
  }, [orders]);
  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }
  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }
  function changeStatus(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
  }
  function replaceOrder(updated) {
    const id = orderIdOf(updated);
    if (status !== "all" && updated.status !== status) {
      setOrders((current) => current.filter((item) => orderIdOf(item) !== id));
      setTotal((current) => Math.max(0, current - 1));
      const remaining = Math.max(0, total - 1);
      const lastPage = Math.max(1, Math.ceil(remaining / 25));
      setPages(lastPage);
      if (page > lastPage) setPage(lastPage);
      else setRevision((current) => current + 1);
    } else {
      setOrders((current) =>
        current.map((item) => (orderIdOf(item) === id ? updated : item)),
      );
    }
  }
  return (
    <div
      className="page ao-admin"
      style={{
        display: "grid",
        gap: "24px",
      }}
    >
      <div
        className="page-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            className="muted"
            style={{
              marginBottom: "6px",
            }}
          >
            GymDrobe Admin
          </p>
          <h1>Order management</h1>
          <p className="muted">
            Manage payment verification, COD balances, fulfilment, courier
            tracking and delivery updates from one place.
          </p>
        </div>
        <Link className="button secondary" to="/admin/products">
          Products & stock
        </Link>
        <Link to="/admin/returns" className="button secondary">
          Returns & exchanges
        </Link>
      </div>
      <p className="muted">
        Total results match your filters. Status counts below are for the
        current page only.
      </p>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          ["Total results", total],
          ["Payment pending", stats["payment-pending"]],
          ["Confirmed", stats.confirmed],
          ["Processing", stats.processing],
          ["Shipped", stats.shipped],
          ["Out for delivery", stats["out-for-delivery"]],
          ["Delivered", stats.delivered],
          ["Cancelled", stats.cancelled],
        ].map(([label, value]) => (
          <div
            key={label}
            className="panel"
            style={{
              padding: "16px",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "22px",
              }}
            >
              {value}
            </strong>
            <span className="muted">{label}</span>
          </div>
        ))}
      </section>
      <section
        className="panel"
        style={{
          padding: "18px",
          display: "grid",
          gap: "16px",
        }}
      >
        <form
          onSubmit={submitSearch}
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Search order, customer, email, phone, city or pincode"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{
              flex: "1 1 280px",
              minHeight: "44px",
            }}
          />
          <button type="submit" className="button">
            Search
          </button>
          {(search || searchInput) && (
            <button
              type="button"
              className="button secondary"
              onClick={clearSearch}
            >
              Clear
            </button>
          )}
        </form>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="button secondary"
            disabled={loading}
            onClick={() => setRevision((current) => current + 1)}
          >
            Refresh orders
          </button>
          {STATUS_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={status === item.value ? "button" : "button secondary"}
              aria-pressed={status === item.value}
              onClick={() => changeStatus(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      {error && (
        <div className="panel">
          <p className="field-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={loading}
            onClick={() => setRevision((current) => current + 1)}
          >
            Retry loading orders
          </button>
        </div>
      )}
      {loading ? (
        <div
          className="panel"
          style={{
            padding: "24px",
          }}
        >
          <p className="muted">Loading orders…</p>
        </div>
      ) : error ? null : orders.length === 0 ? (
        <div
          className="panel"
          style={{
            padding: "28px",
          }}
        >
          <h2>No orders found</h2>
          <p className="muted">Try another status filter or search.</p>
        </div>
      ) : (
        <section
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {orders.map((order) => (
            <AdminOrderCard
              key={orderIdOf(order)}
              order={order}
              token={token}
              notify={notify}
              onUpdated={replaceOrder}
            />
          ))}
        </section>
      )}
      {pages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            className="button secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <strong>
            Page {page} of {pages}
          </strong>
          <button
            type="button"
            className="button secondary"
            disabled={page >= pages || loading}
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
export default function AdminOrdersPage() {
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
        <h1>Admin orders</h1>
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
    <AdminOrdersWorkspace
      key={`${user.id || user._id || "admin"}:${token}`}
      user={user}
      token={token}
    />
  );
}
