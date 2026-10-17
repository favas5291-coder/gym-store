import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

import useCustomerOrders from "../hooks/useCustomerOrders.js";
import useOrderUpdates from "../hooks/useOrderUpdates.js";

import GuestOrderAccess from "../components/GuestOrderAccess.jsx";
import AccountLayout from "../components/AccountLayout.jsx";

import {
  ProductImage,
} from "../components/StorefrontShared.jsx";

import {
  formatOrderDate,
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import {
  orderIdentifier,
  orderTimestamp,
  fulfilmentStatus,
  orderPaymentSummary,
  filterCustomerOrders,
} from "../utils/customerOrders.js";

import { guestAccess } from "../utils/guestCheckout.js";
import { money } from "../utils/productPricing.js";

import "../utils/CheckoutPage.css";

const PAGE_SIZE = 8;

function showMoney(value) {
  return value == null
    ? "Not recorded"
    : money(value);
}

function PaymentSummary({ order }) {
  const info = orderPaymentSummary(order);

  return (
    <div className="order-payment-info">
      <p>
        <strong>{info.methodLabel}</strong>
      </p>

      <p
        className={
          info.success
            ? "order-payment-success"
            : undefined
        }
      >
        <strong>{info.label}</strong>
      </p>

      <p>
        {info.retained
          ? "Recorded amount retained after refund"
          : "Recorded amount paid"}
        {": "}

        <strong>
          {showMoney(info.paid)}
        </strong>
      </p>

      {!info.cancelled && (
        <p>
          {info.cod
            ? "Balance due on delivery"
            : "Amount remaining"}
          {": "}

          <strong>
            {showMoney(info.due)}
          </strong>
        </p>
      )}

      {info.cancelled && info.cod && (
        <p className="muted">
          No remaining COD balance will be collected
          for this cancelled order.
        </p>
      )}

      {info.hasRefund && (
        <p>
          {info.refundCompleted
            ? "Recorded refund"
            : "Requested refund"}
          {": "}

          {formatOrderStatus(info.refundStatus)}
          {" · "}
          {showMoney(info.refundAmount)}
        </p>
      )}

      {info.needsReview && (
        <p className="notice">
          The recorded payment needs checking. Open
          order details or contact support before
          paying again.
        </p>
      )}

      {order.status === "payment-pending" && (
        <p className="notice">
          {info.awaitingConfirmation
            ? "Payment is recorded. Order confirmation is pending. Do not pay again."
            : "Payment confirmation is pending. If money was deducted, do not pay again; contact support with your order number."}
        </p>
      )}
    </div>
  );
}

function OrderList({ userId, token }) {
  const data = useCustomerOrders(userId, token);

  const [filters, setFilters] = useState({
    query: "",
    status: "",
    payment: "",
    days: "",
    sort: "newest",
  });

  const [page, setPage] = useState(1);

  const guest = guestAccess();
  const remote = Boolean(userId || guest);
  const orders = data.orders;

  const matches = filterCustomerOrders(
    orders,
    {
      ...filters,
      status: "",
    },
  ).filter(
    (order) =>
      !filters.status ||
      order.status === filters.status,
  );

  const pages = Math.max(
    1,
    Math.ceil(matches.length / PAGE_SIZE),
  );

  const current = Math.min(page, pages);

  const visible = matches.slice(
    (current - 1) * PAGE_SIZE,
    current * PAGE_SIZE,
  );

  const filtering = Boolean(
    filters.query.trim() ||
      filters.status ||
      filters.payment ||
      filters.days ||
      filters.sort !== "newest",
  );

  function change(name, value) {
    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));

    setPage(1);
  }

  function reset() {
    setFilters({
      query: "",
      status: "",
      payment: "",
      days: "",
      sort: "newest",
    });

    setPage(1);
  }

  return (
    <AccountLayout
      title={
        remote
          ? "My orders"
          : "Orders & guest access"
      }
    >
      {userId ? (
        <details className="gd-guest-access">
          <summary>Guest order access</summary>
          <GuestOrderAccess />
        </details>
      ) : (
        <GuestOrderAccess />
      )}

      <div className="page-heading">
        <p className="muted">
          {remote
            ? userId
              ? "View your account orders and any guest orders available through your private access code. Payment, delivery, return and refund updates come from GymDrobe."
              : "View your guest orders using the private access saved in this browser. Payment, delivery, return and refund updates come from GymDrobe."
            : orders.length
              ? "These previews are stored on this device. They are not proof of a real order, payment or request submitted to GymDrobe."
              : "Restore your private guest access code to view guest purchases. Signing in is optional for orders placed without an account."}
        </p>

        <button
          type="button"
          className="button secondary compact"
          disabled={
            data.loading || data.refreshing
          }
          onClick={data.refresh}
        >
          {data.refreshing
            ? "Refreshing…"
            : "Refresh orders"}
        </button>
      </div>

      {!userId && (
        <p>
          <Link
            className="button secondary"
            to="/login?next=%2Forders"
          >
            Sign in to view account orders (optional)
          </Link>
        </p>
      )}

      {data.lastUpdated && (
        <p className="muted">
          Last checked:{" "}
          {formatOrderDate(data.lastUpdated)}.
        </p>
      )}

      {data.error && (
        <section className="panel">
          <p
            className="error-box"
            role="alert"
          >
            {data.error}
          </p>

          <div className="purchase-actions">
            <button
              type="button"
              className="button"
              disabled={
                data.loading || data.refreshing
              }
              onClick={data.refresh}
            >
              Try again
            </button>

            {userId && (
              <Link
                className="button secondary"
                to="/login?next=%2Forders"
              >
                Check sign-in
              </Link>
            )}

            <Link
              className="text-link"
              to="/help"
            >
              Contact support
            </Link>
          </div>
        </section>
      )}

      {data.refreshError && (
        <p
          className="error-box"
          role="alert"
        >
          {data.refreshError} Showing the last
          successfully loaded list. Open an order
          or refresh successfully to confirm its
          latest status.
        </p>
      )}

      {data.loading && (
        <p role="status">
          Loading your orders…
        </p>
      )}

      {data.loaded && !data.error && (
        <>
          <div className="field order-search">
            <label htmlFor="order-search">
              Search your orders
            </label>

            <input
              id="order-search"
              type="search"
              maxLength={200}
              placeholder="Order number, product, brand or SKU"
              value={filters.query}
              onChange={(event) =>
                change(
                  "query",
                  event.target.value,
                )
              }
            />
          </div>

          <div className="browse-controls">
            <label>
              Status{" "}

              <select
                value={filters.status}
                onChange={(event) =>
                  change(
                    "status",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All order statuses
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
                    {value === "packed"
                      ? "Packed"
                      : formatOrderStatus(value)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Payment{" "}

              <select
                value={filters.payment}
                onChange={(event) =>
                  change(
                    "payment",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All payment statuses
                </option>

                {[
                  ["paid", "Payment completed"],
                  [
                    "partially-paid",
                    "Partial / advance payment",
                  ],
                  ["pending", "Payment pending"],
                  ["failed", "Payment failed"],
                  ["refunded", "Refunded"],
                  [
                    "partially-refunded",
                    "Partially refunded",
                  ],
                  [
                    "review",
                    "Payment needs review",
                  ],
                ].map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Placed in{" "}

              <select
                value={filters.days}
                onChange={(event) =>
                  change(
                    "days",
                    event.target.value,
                  )
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
                  Last 365 days
                </option>
              </select>
            </label>

            <label>
              Sort{" "}

              <select
                value={filters.sort}
                onChange={(event) =>
                  change(
                    "sort",
                    event.target.value,
                  )
                }
              >
                <option value="newest">
                  Newest first
                </option>

                <option value="oldest">
                  Oldest first
                </option>
              </select>
            </label>

            {filtering && (
              <button
                type="button"
                className="button secondary compact"
                onClick={reset}
              >
                Reset filters
              </button>
            )}
          </div>

          <p
            className="muted"
            aria-live="polite"
          >
            {matches.length} of {orders.length}{" "}

            {remote
              ? "orders"
              : "local previews"}

            {data.refreshError
              ? " in the previously loaded list"
              : ""}
            .
          </p>

          {visible.map((order) => {
            const id = orderIdentifier(order);

            const displayId =
              order.orderNumber || id;

            const items = order.items.filter(
              (item) =>
                item &&
                typeof item === "object" &&
                !Array.isArray(item),
            );

            const previewItems = items.slice(0, 3);

            const summary =
              orderPaymentSummary(order);

            const request =
              order.returnRequest || {};

            const hasRequest = [
              "requested",
              "approved",
              "rejected",
              "completed",
            ].includes(request.status);

            return (
              <article
                className="order-card"
                key={id}
              >
                <div className="order-card-head">
                  <div>
                    <strong>
                      {orderTimestamp(order) == null
                        ? "Date not recorded or needs confirmation"
                        : formatOrderDate(
                            order.createdAt,
                          )}
                    </strong>

                    <small>{displayId}</small>

                    {remote &&
                      order.isGuestOrder === true && (
                        <small>Guest order</small>
                      )}
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
                    {summary.awaitingConfirmation
                      ? "Awaiting order confirmation"
                      : order.status === "packed"
                        ? "Packed"
                        : formatOrderStatus(
                            fulfilmentStatus(order),
                          )}
                  </span>
                </div>

                {order.metadata?.demo === true && (
                  <p className="notice">
                    Test order · Razorpay test mode.
                  </p>
                )}

                <div className="order-preview">
                  {previewItems.map(
                    (item, index) => (
                      <ProductImage
                        key={`${id}-${index}`}
                        product={item}
                      />
                    ),
                  )}
                </div>

                <p>
                  {previewItems
                    .map((item) =>
                      typeof item.name === "string"
                        ? item.name
                        : "Purchased item",
                    )
                    .join(", ") ||
                    "Item details are not recorded."}

                  {items.length > 3 &&
                    ` · ${items.length - 3} more selections`}
                </p>

                <PaymentSummary order={order} />

                {hasRequest && (
                  <p className="muted">
                    {request.type === "exchange"
                      ? "Exchange"
                      : "Return"}{" "}

                    request:{" "}

                    {formatOrderStatus(
                      request.status,
                    )}
                    . View details for instructions
                    and progress.
                  </p>
                )}

                <div className="order-card-bottom">
                  <div>
                    <small className="muted">
                      Order total
                    </small>

                    <strong>
                      {showMoney(summary.total)}
                    </strong>
                  </div>

                  <Link
                    className="text-link"
                    to={`/orders/${encodeURIComponent(id)}`}
                  >
                    View details →
                  </Link>
                </div>
              </article>
            );
          })}

          {pages > 1 && (
            <nav
              className="pagination"
              aria-label="Order list pages"
            >
              <button
                type="button"
                disabled={current === 1}
                onClick={() =>
                  setPage(current - 1)
                }
              >
                Previous
              </button>

              <span aria-live="polite">
                Page {current} of {pages}
              </span>

              <button
                type="button"
                disabled={current === pages}
                onClick={() =>
                  setPage(current + 1)
                }
              >
                Next
              </button>
            </nav>
          )}

          {!matches.length &&
            !data.refreshError && (
              <div className="empty-state">
                <h3>
                  {orders.length
                    ? "No matching orders"
                    : remote
                      ? userId
                        ? "No orders found"
                        : "No guest orders yet"
                      : "No orders to display yet"}
                </h3>

                <p>
                  {orders.length
                    ? "Try another search, status, payment filter or date range."
                    : remote
                      ? "No orders are currently available through this account or private guest access. Restore another saved guest code if needed."
                      : "Restore your private guest access code above, or optionally sign in to view account orders."}
                </p>

                <div className="purchase-actions">
                  {filtering && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={reset}
                    >
                      Reset filters
                    </button>
                  )}

                  <Link
                    className="button"
                    to="/shop"
                  >
                    Explore the collection
                  </Link>
                </div>
              </div>
            )}
        </>
      )}
    </AccountLayout>
  );
}

export default function OrdersPage() {
  useOrderUpdates();

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
        className="page narrow"
        role="status"
      >
        Checking your account…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page narrow panel">
        <h1>Unable to check your account</h1>

        <p
          className="error-box"
          role="alert"
        >
          {authError}
        </p>

        <button
          type="button"
          className="button"
          onClick={retrySession}
        >
          Try again
        </button>
      </div>
    );
  }

  const userId = String(
    user?.id || user?._id || "",
  );

  const guest = guestAccess();

  if (
    user?.isActive === false ||
    (user && (!userId || !token)) ||
    (token && !userId)
  ) {
    return (
      <div className="page narrow panel">
        <h1>Account unavailable</h1>

        <p>
          Sign in again to view your account
          orders, or contact support.
        </p>

        <div className="purchase-actions">
          <Link
            className="button"
            to="/login?next=%2Forders"
          >
            Sign in
          </Link>

          <Link
            className="button secondary"
            to="/help"
          >
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  return (
    <OrderList
      key={`${userId || "guest"}:${token || ""}:${guest?.token || ""}`}
      userId={userId}
      token={token || ""}
    />
  );
}