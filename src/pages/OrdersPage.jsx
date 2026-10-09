import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import useOrderUpdates from "../hooks/useOrderUpdates.js";

import { useAuth } from "../context/AuthContext.jsx";

import {
  getOrders as getLocalOrders,
  orderTotal,
} from "../utils/customerData.js";

import {
  getOrders as getRemoteOrders,
} from "../services/orderApi.js";

import { money } from "../utils/productPricing.js";

import {
  ProductImage,
} from "../components/StorefrontShared.jsx";

import AccountLayout from "../components/AccountLayout.jsx";

import {
  formatOrderDate,
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

function amount(value) {
  if (
    value == null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

function paymentLabel(order) {
  const labels = {
    paid: "Payment completed",
    "partially-paid": "Advance paid",
    pending: "Payment pending",
    failed: "Payment failed",
    refunded: "Refunded",
    "partially-refunded": "Partially refunded",
  };

  return (
    labels[order.payment?.status] ||
    "Payment not recorded"
  );
}

function methodLabel(order) {
  const labels = {
    razorpay: "Full online payment",
    "cod-partial": "COD with 10% advance",
    cod: "Cash on delivery",
  };

  return (
    labels[
      order.payment?.method ||
        order.paymentMethod
    ] || "Payment method not recorded"
  );
}

function fulfilmentLabel(order) {
  if (
    order.status === "payment-pending" &&
    ["paid", "partially-paid"].includes(
      order.payment?.status,
    )
  ) {
    return "Awaiting order confirmation";
  }

  return formatOrderStatus(order.status);
}

function PaymentSummary({ order }) {
  const payment = order.payment || {};
  const refund = order.refund || {};

  const paid = amount(payment.amountPaid);
  const due = amount(payment.amountDue);
  const refundAmount = amount(refund.amount);

  const cod = ["cod", "cod-partial"].includes(
    payment.method || order.paymentMethod,
  );

  const refunded = [
    "refunded",
    "processed",
    "completed",
  ].includes(refund.status);

  return (
    <div className="order-payment-info">
      <p>
        <strong>{methodLabel(order)}</strong>
      </p>

      <p
        className={
          payment.status === "paid" ||
          payment.status === "partially-paid"
            ? "order-payment-success"
            : undefined
        }
      >
        <strong>{paymentLabel(order)}</strong>
      </p>

      {paid != null && (
        <p>
          {refunded
            ? "Amount retained after refund"
            : "Recorded amount paid"}
          {": "}
          <strong>{money(paid)}</strong>
        </p>
      )}

      {order.status !== "cancelled" &&
        due != null && (
          <p>
            {cod
              ? "Balance due on delivery"
              : "Amount remaining"}
            {": "}
            <strong>{money(due)}</strong>
          </p>
        )}

      {order.status === "cancelled" && cod && (
        <p className="muted">
          No remaining COD balance will be
          collected.
        </p>
      )}

      {refund.status &&
        ![
          "none",
          "not-requested",
          "not-applicable",
        ].includes(refund.status) && (
          <p>
            Refund:{" "}
            {formatOrderStatus(refund.status)}
            {refundAmount != null
              ? ` · ${money(refundAmount)}`
              : ""}
          </p>
        )}

      {order.status === "payment-pending" && (
        <p className="notice">
          {["paid", "partially-paid"].includes(
            payment.status,
          )
            ? "Payment is recorded. Order confirmation is pending. Do not pay again."
            : "Payment confirmation is pending. If money was deducted, do not pay again; contact support with your order number."}
        </p>
      )}
    </div>
  );
}

export default function OrdersPage() {
  useOrderUpdates();

  const {
    user,
    token,
    loading: authLoading,
    authError,
  } = useAuth();

  const scope = JSON.stringify([
    user?.id || null,
    token || null,
  ]);

  const [snapshot, setSnapshot] = useState({
    scope: "",
    orders: [],
    loading: false,
    error: "",
  });

  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [days, setDays] = useState("");

  useEffect(() => {
    if (
      authLoading ||
      authError ||
      !user ||
      !token
    ) {
      return;
    }

    let cancelled = false;
    let timer;
    let running = false;

    async function loadOrders() {
      if (cancelled || running) return;

      running = true;
      clearTimeout(timer);

      setSnapshot((current) => ({
        scope,

        orders:
          current.scope === scope
            ? current.orders
            : [],

        loading: true,
        error: "",
      }));

      try {
        const result =
          await getRemoteOrders(token);

        if (cancelled) return;

        if (!Array.isArray(result)) {
          throw new Error(
            "GymDrobe returned an unreadable order list.",
          );
        }

        const orders = result.filter(
          (order) =>
            order &&
            typeof order === "object",
        );

        setSnapshot({
          scope,
          orders,
          loading: false,
          error: "",
        });

        if (
          orders.some(
            (order) =>
              order.status ===
              "payment-pending",
          )
        ) {
          timer = setTimeout(() => {
            if (
              document.visibilityState ===
              "visible"
            ) {
              loadOrders();
            }
          }, 15000);
        }
      } catch (error) {
        if (!cancelled) {
          setSnapshot((current) => ({
            scope,

            orders:
              current.scope === scope
                ? current.orders
                : [],

            loading: false,

            error:
              error.message ||
              "Your orders could not be loaded. Please retry.",
          }));
        }
      } finally {
        running = false;
      }
    }

    function onVisible() {
      if (
        document.visibilityState === "visible"
      ) {
        loadOrders();
      }
    }

    loadOrders();

    document.addEventListener(
      "visibilitychange",
      onVisible,
    );

    window.addEventListener(
      "online",
      loadOrders,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);

      document.removeEventListener(
        "visibilitychange",
        onVisible,
      );

      window.removeEventListener(
        "online",
        loadOrders,
      );
    };
  }, [
    scope,
    authLoading,
    authError,
    refresh,
  ]);

  const current =
    snapshot.scope === scope
      ? snapshot
      : null;

  const orders = user
    ? current?.orders || []
    : getLocalOrders(null);

  const loading = Boolean(
    authLoading ||
      (user &&
        token &&
        !authError &&
        (!current || current.loading)),
  );

  const loadError =
    authError ||
    (user && !token
      ? "Your session has expired. Please sign in again."
      : current?.error || "");

  const search = query.trim().toLowerCase();

  const matches = (
    Array.isArray(orders) ? orders : []
  ).filter((order) => {
    if (!order) return false;

    if (
      status &&
      order.status !== status
    ) {
      return false;
    }

    const created = Date.parse(
      order.createdAt,
    );

    if (
      days &&
      (!Number.isFinite(created) ||
        Date.now() - created >
          Number(days) * 86400000)
    ) {
      return false;
    }

    const items = Array.isArray(order.items)
      ? order.items
      : [];

    const searchable = [
      order.id,
      order.orderNumber,
      methodLabel(order),
      paymentLabel(order),
      ...items.map((item) => item.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      !search ||
      searchable.includes(search)
    );
  });

  return (
    <AccountLayout title="My orders">
      <div className="page-heading">
        <p className="muted">
          {user
            ? "Your orders and payment status are loaded from your GymDrobe account."
            : "Guest order summaries are stored on this device. Sign in before checkout to save future orders to your account."}
        </p>

        {user && token && (
          <button
            type="button"
            className="button secondary compact"
            disabled={loading}
            onClick={() =>
              setRefresh(
                (value) => value + 1,
              )
            }
          >
            {loading
              ? "Refreshing…"
              : "Refresh orders"}
          </button>
        )}
      </div>

      {loadError && (
        <p
          className="error-box"
          role="alert"
        >
          {loadError}
        </p>
      )}

      <div className="field order-search">
        <label htmlFor="order-search">
          Search your orders
        </label>

        <input
          id="order-search"
          type="search"
          placeholder="Product name or order number"
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
        />
      </div>

      <div className="browse-controls">
        <label>
          Status{" "}
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="">
              All orders
            </option>

            {[
              "payment-pending",
              "confirmed",
              "processing",
              "packed",
              "shipped",
              "out-for-delivery",
              "delivered",
              "cancelled",
            ].map((value) => (
              <option
                key={value}
                value={value}
              >
                {formatOrderStatus(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Placed in{" "}
          <select
            value={days}
            onChange={(event) =>
              setDays(event.target.value)
            }
          >
            <option value="">
              Any time
            </option>

            <option value="30">
              Last 30 days
            </option>

            <option value="90">
              Last 90 days
            </option>

            <option value="365">
              Last year
            </option>
          </select>
        </label>
      </div>

      {loading && (
        <p role="status">
          Loading your latest orders…
        </p>
      )}

      {!authLoading &&
        !authError &&
        matches.map((order, index) => {
          const id =
            order.orderNumber || order.id;

          const items = Array.isArray(
            order.items,
          )
            ? order.items
            : [];

          const total =
            amount(
              order.payment?.totalAmount,
            ) ??
            amount(
              order.pricing?.finalTotal,
            ) ??
            amount(orderTotal(order));

          return (
            <article
              className="order-card"
              key={id || index}
            >
              <div className="order-card-head">
                <div>
                  <strong>
                    {formatOrderDate(
                      order.createdAt,
                    )}
                  </strong>

                  <small>
                    {id ||
                      "Order number not recorded"}
                  </small>
                </div>

                <span
                  className={`status-pill ${
                    order.status === "cancelled"
                      ? "cancelled"
                      : order.status ===
                          "payment-pending"
                        ? "pending"
                        : ""
                  }`}
                >
                  {fulfilmentLabel(order)}
                </span>
              </div>

              <div className="order-preview">
                {items
                  .slice(0, 3)
                  .map((item, itemIndex) => (
                    <ProductImage
                      key={`${id}-${itemIndex}`}
                      product={item}
                    />
                  ))}
              </div>

              <p>
                {items
                  .map((item) => item.name)
                  .filter(Boolean)
                  .join(", ")}
              </p>

              <PaymentSummary order={order} />

              <div className="order-card-bottom">
                <div>
                  <small className="muted">
                    Order total
                  </small>

                  <strong>
                    {total == null
                      ? "Not recorded"
                      : money(total)}
                  </strong>
                </div>

                {id && (
                  <Link
                    className="text-link"
                    to={`/orders/${encodeURIComponent(
                      id,
                    )}`}
                  >
                    View details →
                  </Link>
                )}
              </div>
            </article>
          );
        })}

      {!loading &&
        !loadError &&
        !matches.length && (
          <div className="empty-state">
            <h3>
              {orders.length
                ? "No matching orders"
                : "Your first order is waiting"}
            </h3>

            <p>
              {orders.length
                ? "Try another product, order number, status or date range."
                : "Explore the collection and find your next training favourite."}
            </p>

            <Link
              className="button"
              to="/shop"
            >
              Explore the collection
            </Link>
          </div>
        )}
    </AccountLayout>
  );
}