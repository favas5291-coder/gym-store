import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

import {
  getAdminDashboard,
  getAdminCustomers,
} from "../services/adminApi.js";

import {
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import "./AdminDashboardPage.css";

function date(value) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : parsed.toLocaleDateString("en-IN");
}

function paymentLabel(status) {
  if (status === "paid") {
    return "Payment completed";
  }

  if (status === "partially-paid") {
    return "Advance paid";
  }

  return formatOrderStatus(status);
}

function AdminMenu() {
  return (
    <nav
      className="gd-admin-menu"
      aria-label="Admin sections"
    >
      <Link to="/admin">Dashboard</Link>
      <Link to="/admin/customers">Customers</Link>
      <Link to="/admin/products">Products</Link>
      <Link to="/admin/orders">Orders</Link>
      <Link to="/admin/returns">
        Returns & exchanges
      </Link>
      <Link to="/admin/support">
        Support inbox
      </Link>
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

  if (
    !user ||
    !token ||
    user.role !== "admin"
  ) {
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
    key: `${user.id || user._id}:${token}`,
  });
}

function ErrorNotice({ error }) {
  return error ? (
    <p className="error-box" role="alert">
      {error}
    </p>
  ) : null;
}

function Dashboard({ user, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError("");

    getAdminDashboard(token, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled) setData(result);
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
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, attempt]);

  const cards = [
    [
      "Customers",
      "customers",
      "/admin/customers",
    ],
    [
      "Active products",
      "activeProducts",
      "/admin/products",
    ],
    [
      "Orders awaiting fulfilment",
      "openOrders",
      "/admin/orders",
    ],
    [
      "Payments awaiting confirmation",
      "pendingPayments",
      "/admin/orders",
    ],
    [
      "Low-stock products",
      "lowStockProducts",
      "/admin/products",
    ],
    [
      "Out-of-stock products",
      "outOfStockProducts",
      "/admin/products",
    ],
    [
      "Returns awaiting action",
      "pendingReturns",
      "/admin/returns",
    ],
    [
      "Open support conversations",
      "openSupport",
      "/admin/support",
    ],
  ];

  return (
    <div className="page gd-admin-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            GYMDROBE ADMIN
          </p>

          <h1>Store dashboard</h1>

          <p className="muted">
            Welcome, {user.name}. Here is your
            store overview.
          </p>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={() =>
            setAttempt((value) => value + 1)
          }
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <AdminMenu />
      <ErrorNotice error={error} />

      {loading && (
        <p role="status">
          Loading your store information…
        </p>
      )}

      {data && (
        <>
          <div
            className="gd-admin-stats"
            aria-busy={loading}
          >
            {cards.map(([label, field, to]) => (
              <Link
                className="gd-admin-stat"
                to={to}
                key={field}
              >
                <span>{label}</span>

                <strong>
                  {Number(
                    data.stats[field] || 0,
                  ).toLocaleString("en-IN")}
                </strong>

                <small>View details →</small>
              </Link>
            ))}
          </div>

          <p className="muted">
            Low stock means 1–10 units. Counts
            include stored test orders.
            {" "}
            {Number(data.stats.testOrders || 0)}
            {" "}test orders are recorded.
            {" "}Last updated:{" "}
            {new Date(
              data.generatedAt,
            ).toLocaleString("en-IN")}.
            {error &&
              " These are the last successfully loaded figures."}
          </p>

          <section className="panel">
            <div className="page-heading">
              <h2>Recent orders</h2>

              <Link
                className="text-link"
                to="/admin/orders"
              >
                Manage orders →
              </Link>
            </div>

            {data.recentOrders.length ? (
              <div className="comparison-scroll">
                <table className="data-table">
                  <caption className="sr-only">
                    Five most recent store orders
                  </caption>

                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Date</th>
                      <th scope="col">
                        Order status
                      </th>
                      <th scope="col">Payment</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.recentOrders.map(
                      (order) => (
                        <tr key={order.orderNumber}>
                          <td>
                            {order.orderNumber}
                          </td>
                          <td>
                            {order.customerName}
                          </td>
                          <td>
                            {date(order.createdAt)}
                          </td>
                          <td>
                            {formatOrderStatus(
                              order.status,
                            )}
                          </td>
                          <td>
                            {paymentLabel(
                              order.paymentStatus,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                No orders have been recorded yet.
              </p>
            )}
          </section>
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

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError("");
    setData(null);

    getAdminCustomers(token, {
      ...filters,
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled) setData(result);
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
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, filters, attempt]);

  function apply(event) {
    event.preventDefault();

    setFilters({
      search: search.trim(),
      status,
      page: 1,
    });
  }

  return (
    <div className="page gd-admin-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            GYMDROBE ADMIN
          </p>
          <h1>Customers</h1>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={() =>
            setAttempt((value) => value + 1)
          }
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <AdminMenu />

      <p className="muted">
        Registered customer accounts. Phone numbers
        appear after customers add them to their
        profile.
      </p>

      <form
        className="gd-admin-filters"
        onSubmit={apply}
      >
        <div className="field">
          <label htmlFor="admin-customer-search">
            Search customers
          </label>

          <input
            id="admin-customer-search"
            type="search"
            maxLength={80}
            placeholder="Name, email or phone"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="field">
          <label htmlFor="admin-customer-status">
            Account status
          </label>

          <select
            id="admin-customer-status"
            value={status}
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
              Disabled
            </option>
          </select>
        </div>

        <button
          type="submit"
          className="button"
        >
          Search
        </button>

        <button
          type="button"
          className="button secondary"
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

      <ErrorNotice error={error} />

      {error && (
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setAttempt((value) => value + 1)
          }
        >
          Retry
        </button>
      )}

      {loading && (
        <p role="status">Loading customers…</p>
      )}

      {data && (
        <>
          <p className="muted" role="status">
            {data.total} customers found
          </p>

          {data.customers.length ? (
            <div className="panel comparison-scroll">
              <table className="data-table">
                <caption className="sr-only">
                  Registered customer accounts
                </caption>

                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Orders</th>
                    <th scope="col">Account</th>
                  </tr>
                </thead>

                <tbody>
                  {data.customers.map(
                    (customer) => (
                      <tr key={customer.id}>
                        <td>{customer.name}</td>

                        <td className="gd-admin-email">
                          {customer.email}
                        </td>

                        <td>
                          {customer.phone ||
                            "Not added"}
                        </td>

                        <td>
                          {date(customer.createdAt)}
                        </td>

                        <td>
                          {customer.orderCount}
                        </td>

                        <td>
                          {customer.isActive
                            ? "Active"
                            : "Disabled"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <h2>No customers found</h2>
              <p>
                Try another search or clear the
                filters.
              </p>
            </div>
          )}

          <p className="muted">
            Order counts include pending,
            cancelled and test orders.
          </p>

          {(data.pages > 1 || data.page > 1) && (
            <nav
              className="pagination"
              aria-label="Customer pages"
            >
              <button
                type="button"
                disabled={
                  loading || data.page <= 1
                }
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: value.page - 1,
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
                disabled={
                  loading ||
                  data.page >= data.pages
                }
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: value.page + 1,
                  }))
                }
              >
                Next
              </button>
            </nav>
          )}
        </>
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
        <Customers key={key} token={token} />
      )}
    </Access>
  );
}