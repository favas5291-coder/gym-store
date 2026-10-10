import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  NavLink,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

import {
  getAdminDashboard,
  getAdminCustomers,
  setAdminCustomerStatus,
} from "../services/adminApi.js";

import {
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import Modal from "../components/Modal.jsx";

import "./AdminDashboardPage.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

function date(value, short = false) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not recorded";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "Asia/Kolkata",
  });
}

function Phone({ value, source }) {
  if (!value) {
    return (
      <span className="gd-admin-muted">
        Not added
      </span>
    );
  }

  const digits = String(value).replace(/\D/g, "");

  return (
    <div className="gd-admin-phone">
      <a
        href={
          "tel:" +
          (digits.length === 10
            ? "+91" + digits
            : digits)
        }
      >
        {digits.length === 10
          ? "+91 " + digits
          : value}
      </a>

      {source === "order" && (
        <small>Latest order contact</small>
      )}
    </div>
  );
}

function AdminMenu() {
  const links = [
    ["/admin", "Overview"],
    ["/admin/orders", "Orders"],
    ["/admin/products", "Products"],
    ["/admin/customers", "Customers"],
    ["/admin/returns", "Returns"],
    ["/admin/support", "Support"],
  ];

  return (
    <nav
      className="gd-admin-menu"
      aria-label="Admin sections"
    >
      {links.map(([to, label]) => (
        <NavLink key={to} to={to} end>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Access({ children }) {
  const {
    user,
    token,
    loading,
    authError,
    retrySession,
  } = useAuth();

  if (loading) {
    return (
      <div className="page" role="status">
        Checking admin access…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page">
        <p className="error-box" role="alert">
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

  if (!user || !token || user.role !== "admin") {
    return (
      <div className="page">
        <h1>Admin access required</h1>

        <Link
          className="button"
          to="/login?next=%2Fadmin"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return children({
    user,
    token,
    key: (user.id || user._id) + ":" + token,
  });
}

function useAdminData(loader, token, options) {
  const query = JSON.stringify(options);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setData(null);
    setLoading(true);
    setError("");

    loader(token, {
      ...JSON.parse(query),
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((failure) => {
        if (
          !cancelled &&
          failure.name !== "AbortError"
        ) {
          setError(failure.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loader, token, query, attempt]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}

function LoadNotice({
  loading,
  error,
  refresh,
}) {
  return (
    <>
      {loading && (
        <p role="status">
          Loading store information…
        </p>
      )}

      {error && (
        <div
          className="gd-admin-alert"
          role="alert"
        >
          <p>{error}</p>

          <button
            type="button"
            className="button secondary"
            onClick={refresh}
          >
            Try again
          </button>
        </div>
      )}
    </>
  );
}

function SalesChart({ points }) {
  const [selected, setSelected] = useState(
    points.at(-1)?.date,
  );

  const maximum = Math.max(
    1,
    ...points.map((point) => point.sales),
  );

  const chosen =
    points.find((point) => point.date === selected) ||
    points.at(-1);

  const compact = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  return (
    <>
      <div className="gd-sales-chart">
        <div
          className="gd-sales-axis"
          aria-hidden="true"
        >
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <span
              key={ratio}
              style={{
                top: (1 - ratio) * 100 + "%",
              }}
            >
              {compact(maximum * ratio)}
            </span>
          ))}
        </div>

        <div className="gd-sales-scroll">
          <div
            className="gd-sales-bars"
            role="group"
            aria-label="Daily sales chart"
            style={{
              gridTemplateColumns:
                "repeat(" +
                points.length +
                ", minmax(28px, 1fr))",

              minWidth: points.length * 32,
            }}
          >
            {points.map((point, index) => (
              <div
                className="gd-sales-column"
                key={point.date}
              >
                <button
                  type="button"
                  className={
                    "gd-sales-bar " +
                    (chosen?.date === point.date
                      ? "selected"
                      : "")
                  }
                  aria-label={
                    date(point.date) +
                    ": " +
                    money(point.sales) +
                    ", " +
                    point.orders +
                    " orders"
                  }
                  aria-pressed={
                    chosen?.date === point.date
                  }
                  title={
                    date(point.date) +
                    ": " +
                    money(point.sales)
                  }
                  onFocus={() =>
                    setSelected(point.date)
                  }
                  onClick={() =>
                    setSelected(point.date)
                  }
                >
                  <span
                    style={{
                      height:
                        (point.sales / maximum) *
                          100 +
                        "%",
                    }}
                  />
                </button>

                <small>
                  {points.length <= 7 ||
                  index % 5 === 0 ||
                  index === points.length - 1
                    ? date(point.date, true)
                    : ""}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>

      {chosen && (
        <p
          className="gd-sales-selected"
          aria-live="polite"
        >
          <strong>{date(chosen.date)}</strong>
          <span>{money(chosen.sales)} sales</span>
          <span>{chosen.orders} orders</span>
        </p>
      )}

      <p className="gd-admin-muted">
        Tap a bar to see that day's sales.
        Dates use Indian time.
      </p>
    </>
  );
}

function Dashboard({ user, token }) {
  const [days, setDays] = useState("7");
  const [source, setSource] = useState("real");

  const {
    data,
    loading,
    error,
    refresh,
  } = useAdminData(
    getAdminDashboard,
    token,
    { days, source },
  );

  return (
    <div className="page gd-admin-page">
      <div className="gd-admin-heading">
        <div>
          <p className="eyebrow">
            GYMDROBE ADMIN
          </p>

          <h1>Your store at a glance</h1>

          <p className="gd-admin-muted">
            Welcome, {user.name}. See sales and
            manage your store here.
          </p>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={refresh}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <AdminMenu />

      <div className="gd-admin-controls">
        <label>
          Date range

          <select
            value={days}
            onChange={(event) =>
              setDays(event.target.value)
            }
          >
            <option value="7">
              Last 7 days
            </option>

            <option value="30">
              Last 30 days
            </option>
          </select>
        </label>

        <label>
          Order type

          <select
            value={source}
            onChange={(event) =>
              setSource(event.target.value)
            }
          >
            <option value="real">
              Real orders
            </option>

            <option value="test">
              Test orders
            </option>
          </select>
        </label>

        <Link
          className="button"
          to="/admin/products"
        >
          Manage products
        </Link>
      </div>

      {source === "test" && (
        <p className="gd-admin-test">
          Test orders shown. These amounts are
          for testing.
        </p>
      )}

      <LoadNotice
        loading={loading}
        error={error}
        refresh={refresh}
      />

      {data && (
        <>
          <div className="gd-admin-stats">
            {[
              [
                "Sales",
                money(data.sales.summary.sales),
                "After recorded refunds · last " +
                  days +
                  " days",
                "/admin/orders",
              ],
              [
                "Orders",
                data.sales.summary.orders,
                "Confirmed orders · last " +
                  days +
                  " days",
                "/admin/orders",
              ],
              [
                "Customers",
                data.stats.customers,
                data.stats.blockedCustomers +
                  " blocked accounts",
                "/admin/customers",
              ],
              [
                "Products",
                data.stats.activeProducts,
                "Active products in your shop",
                "/admin/products",
              ],
            ].map(([label, value, detail, to]) => (
              <Link
                className="gd-admin-stat"
                to={to}
                key={label}
              >
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </Link>
            ))}
          </div>

          <section
            className="gd-admin-panel"
            aria-labelledby="gd-sales-title"
          >
            <div className="gd-admin-heading">
              <div>
                <h2 id="gd-sales-title">
                  Daily sales
                </h2>

                <p className="gd-admin-muted">
                  Confirmed order value, including
                  delivery, after recorded refunds.
                </p>
              </div>

              <strong className="gd-sales-total">
                {money(data.sales.summary.sales)}
              </strong>
            </div>

            <div className="gd-admin-payment-summary">
              <span>
                Received for these orders
                <strong>
                  {money(data.sales.summary.received)}
                </strong>
              </span>

              <span>
                Balance still due
                <strong>
                  {money(data.sales.summary.due)}
                </strong>
              </span>
            </div>

            {data.sales.summary.orders === 0 ? (
              <div className="gd-admin-empty-chart">
                <h3>
                  No confirmed sales in this period yet
                </h3>

                <p>
                  Change the date range or order type
                  to view other orders.
                </p>
              </div>
            ) : (
              <SalesChart
                key={data.generatedAt}
                points={data.sales.points}
              />
            )}

            <p className="gd-admin-muted">
              Pending and cancelled orders are
              excluded. A COD advance is only part
              of the money received. Today is still
              in progress.
            </p>
          </section>

          <section
            className="gd-admin-panel"
            aria-labelledby="gd-tasks-title"
          >
            <h2 id="gd-tasks-title">
              Needs your attention
            </h2>

            <div className="gd-admin-tasks">
              {[
                [
                  "Orders to fulfil",
                  data.stats.openOrders,
                  "/admin/orders",
                ],
                [
                  "Awaiting payment",
                  data.stats.pendingPayments,
                  "/admin/orders",
                ],
                [
                  "Low stock · 1–10 units",
                  data.stats.lowStockProducts,
                  "/admin/products",
                ],
                [
                  "Out of stock",
                  data.stats.outOfStockProducts,
                  "/admin/products",
                ],
                [
                  "Return requests",
                  data.stats.pendingReturns,
                  "/admin/returns",
                ],
                [
                  "Support conversations",
                  data.stats.openSupport,
                  "/admin/support",
                ],
              ].map(([label, value, to]) => (
                <Link to={to} key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>

            <p className="gd-admin-muted">
              Order tasks use the selected order
              type across all dates.
            </p>
          </section>

          <section
            className="gd-admin-panel"
            aria-labelledby="gd-recent-title"
          >
            <div className="gd-admin-heading">
              <h2 id="gd-recent-title">
                Latest orders
              </h2>

              <Link
                className="text-link"
                to="/admin/orders"
              >
                View all orders →
              </Link>
            </div>

            {data.recentOrders.length ? (
              <div className="gd-admin-table-scroll">
                <table className="gd-admin-table">
                  <caption className="sr-only">
                    Latest five orders of the
                    selected type
                  </caption>

                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Contact number</th>
                      <th>Total</th>
                      <th>Order status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr key={order.orderNumber}>
                        <td>
                          <strong>
                            {order.orderNumber}
                          </strong>

                          <small>
                            {date(order.createdAt)}
                          </small>
                        </td>

                        <td>
                          {order.customerName}
                        </td>

                        <td>
                          <Phone
                            value={order.customerPhone}
                          />
                        </td>

                        <td>
                          {order.total == null
                            ? "Not recorded"
                            : money(order.total)}
                        </td>

                        <td>
                          {formatOrderStatus(
                            order.status,
                          )}
                        </td>

                        <td>
                          {order.paymentStatus === "paid"
                            ? "Payment completed"
                            : order.paymentStatus ===
                                "partially-paid"
                              ? "Advance paid"
                              : formatOrderStatus(
                                  order.paymentStatus,
                                )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No orders of this type yet.</p>
            )}
          </section>

          <p className="gd-admin-muted">
            Updated{" "}
            {new Date(
              data.generatedAt,
            ).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST.
          </p>
        </>
      )}
    </div>
  );
}

function Customers({ token }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    page: 1,
  });

  const {
    data,
    loading,
    error,
    refresh,
  } = useAdminData(
    getAdminCustomers,
    token,
    filters,
  );

  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const action = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      action.current?.abort();
    };
  }, []);

  async function changeStatus() {
    if (!selected || action.current) return;

    const controller = new AbortController();

    action.current = controller;
    setBusy(true);
    setActionError("");
    setNotice("");

    try {
      const result = await setAdminCustomerStatus(
        token,
        selected,
        !selected.isActive,
        { signal: controller.signal },
      );

      if (mounted.current) {
        setNotice(result.message);
      }
    } catch (failure) {
      if (
        mounted.current &&
        failure.name !== "AbortError"
      ) {
        setActionError(
          failure.message +
            " Refresh the list to check the current status.",
        );
      }
    } finally {
      action.current = null;

      if (mounted.current) {
        setBusy(false);
        setSelected(null);
        refresh();
      }
    }
  }

  return (
    <div className="page gd-admin-page">
      <div className="gd-admin-heading">
        <div>
          <p className="eyebrow">
            GYMDROBE ADMIN
          </p>

          <h1>Your customers</h1>

          <p className="gd-admin-muted">
            Find customer details and manage
            account access.
          </p>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={loading || busy}
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      <AdminMenu />

      <form
        className="gd-admin-filters"
        onSubmit={(event) => {
          event.preventDefault();

          setFilters({
            search: search.trim(),
            status,
            page: 1,
          });
        }}
      >
        <label>
          Search customers

          <input
            type="search"
            maxLength={80}
            placeholder="Name, email or profile number"
            value={search}
            disabled={busy}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </label>

        <label>
          Account status

          <select
            value={status}
            disabled={busy}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="">
              All customers
            </option>

            <option value="active">
              Active
            </option>

            <option value="disabled">
              Blocked
            </option>
          </select>
        </label>

        <button
          type="submit"
          className="button"
          disabled={busy}
        >
          Search
        </button>

        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setSearch("");
            setStatus("");

            setFilters({
              search: "",
              status: "",
              page: 1,
            });
          }}
        >
          Clear
        </button>
      </form>

      {notice && (
        <p
          className="gd-admin-success"
          role="status"
        >
          {notice}
        </p>
      )}

      {actionError && (
        <p
          className="gd-admin-alert"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <LoadNotice
        loading={loading}
        error={error}
        refresh={refresh}
      />

      {data && (
        <>
          <p
            className="gd-admin-muted"
            role="status"
          >
            {data.total} customers found
          </p>

          {data.customers.length ? (
            <div className="gd-admin-panel gd-admin-table-scroll">
              <table className="gd-admin-table">
                <caption className="sr-only">
                  Customer contacts and account controls
                </caption>

                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact number</th>
                    <th>Joined</th>
                    <th>Orders</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {data.customers.map((person) => (
                    <tr key={person.id}>
                      <td>
                        <strong>
                          {person.name}
                        </strong>

                        <small className="gd-admin-email">
                          {person.email}
                        </small>
                      </td>

                      <td>
                        <Phone
                          value={person.phone}
                          source={person.phoneSource}
                        />
                      </td>

                      <td>
                        {date(person.createdAt)}
                      </td>

                      <td>
                        {person.orderCount}
                      </td>

                      <td>
                        <span
                          className={
                            "gd-admin-badge " +
                            (person.isActive
                              ? "active"
                              : "blocked")
                          }
                        >
                          {person.isActive
                            ? "Active"
                            : "Blocked"}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={
                            "gd-admin-action " +
                            (person.isActive
                              ? "danger"
                              : "")
                          }
                          disabled={busy || loading}
                          aria-label={
                            (person.isActive
                              ? "Block "
                              : "Unblock ") +
                            person.name
                          }
                          onClick={() =>
                            setSelected(person)
                          }
                        >
                          {person.isActive
                            ? "Block user"
                            : "Unblock user"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="gd-admin-panel">
              <h2>No customers found</h2>

              <p>
                Try another search or clear the filters.
              </p>
            </div>
          )}

          <p className="gd-admin-muted">
            When a profile number is missing, the
            latest order contact is shown and
            labelled. Search uses profile numbers.
            Order counts include test and cancelled
            orders.
          </p>

          {data.pages > 1 && (
            <nav
              className="gd-admin-pagination"
              aria-label="Customer pages"
            >
              <button
                type="button"
                className="button secondary"
                disabled={
                  busy ||
                  loading ||
                  data.page <= 1
                }
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: data.page - 1,
                  }))
                }
              >
                Previous
              </button>

              <span>
                Page {data.page} of {data.pages}
              </span>

              <button
                type="button"
                className="button secondary"
                disabled={
                  busy ||
                  loading ||
                  data.page >= data.pages
                }
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: data.page + 1,
                  }))
                }
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {selected && (
        <Modal
          title={
            selected.isActive
              ? "Block customer?"
              : "Unblock customer?"
          }
          onClose={() => {
            if (!busy) {
              setSelected(null);
            }
          }}
        >
          <div className="gd-admin-confirm">
            <p>
              <strong>{selected.name}</strong>
              <br />
              {selected.email}
            </p>

            <p>
              {selected.isActive
                ? "This customer will be unable to sign in or use account actions. Their existing orders remain available to admins."
                : "This customer can sign in again with Google. Previously saved login sessions will stay invalid."}
            </p>

            <div className="purchase-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  setSelected(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  "button " +
                  (selected.isActive
                    ? "gd-admin-danger"
                    : "")
                }
                disabled={busy}
                onClick={changeStatus}
              >
                {busy
                  ? "Saving…"
                  : selected.isActive
                    ? "Block customer"
                    : "Unblock customer"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Access>
      {({ user, token, key }) => (
        <Dashboard
          key={key}
          user={user}
          token={token}
        />
      )}
    </Access>
  );
}

export function AdminCustomersPage() {
  return (
    <Access>
      {({ token, key }) => (
        <Customers
          key={key}
          token={token}
        />
      )}
    </Access>
  );
}