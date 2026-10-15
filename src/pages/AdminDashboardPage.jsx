import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getAdminDashboard } from "../services/adminApi.js";

import {
  formatOrderStatus,
} from "../components/OrderPaymentDetails.jsx";

import "./AdminDashboardPage.css";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

function numeric(value) {
  if (
    value == null ||
    typeof value === "boolean" ||
    !["number", "string"].includes(typeof value) ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value) {
  const parsed = numeric(value);

  return parsed == null
    ? "Not recorded"
    : currency.format(parsed);
}

function count(value) {
  const parsed = numeric(value);

  return (
    parsed != null &&
    Number.isSafeInteger(parsed) &&
    parsed >= 0
  )
    ? integer.format(parsed)
    : "Not recorded";
}

function date(value, short = false) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(short ? {} : { year: "numeric" }),
        timeZone: "Asia/Kolkata",
      });
}

function timestamp(value) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : parsed.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function paymentLabel(status) {
  if (status === "paid") return "Payment completed";

  if (status === "partially-paid") {
    return "Advance / partial payment received";
  }

  return formatOrderStatus(status);
}

function Phone({ value }) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length < 7 || digits.length > 15) {
    return <span className="gd-admin-muted">Not added</span>;
  }

  return (
    <div className="gd-admin-phone">
      <a href={`tel:${digits.length === 10 ? "+91" : "+"}${digits}`}>
        {digits.length === 10 ? `+91 ${digits}` : String(value)}
      </a>
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
    ["/admin/suppliers", "Suppliers"],
    ["/admin/kits", "Fitness Kits"],
    ["/admin/packing-locations", "Packing locations"],
    ["/admin/shipping-profiles", "Shipping profiles"],
  ];

  return (
    <nav className="gd-admin-menu" aria-label="Admin sections">
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
        <h1>Unable to check your account</h1>

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

  if (!user || !token) {
    return (
      <div className="page">
        <h1>Sign in to manage GymDrobe</h1>
        <p>An administrator account is required.</p>

        <Link className="button" to="/login?next=%2Fadmin">
          Sign in
        </Link>
      </div>
    );
  }

  if (user.role !== "admin" || user.isActive === false) {
    return (
      <div className="page">
        <h1>Admin access required</h1>

        <p>
          Your current account does not have permission
          to manage the store.
        </p>

        <Link className="button" to="/account">
          My account
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

function useAdminData(loader, token, options) {
  const query = JSON.stringify(options);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${query}:${attempt}`;

  const [state, setState] = useState({
    key: "",
    data: null,
    loading: true,
    error: "",
  });

  const refresh = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setState({
      key: requestKey,
      data: null,
      loading: true,
      error: "",
    });

    const timer = setTimeout(() => {
      if (cancelled) return;

      controller.abort();

      setState({
        key: requestKey,
        data: null,
        loading: false,
        error:
          "The admin server took too long to respond. Please try again.",
      });
    }, 45000);

    Promise.resolve()
      .then(() =>
        loader(token, {
          ...JSON.parse(query),
          signal: controller.signal,
        }),
      )
      .then((result) => {
        if (cancelled || controller.signal.aborted) return;

        if (!result || typeof result !== "object") {
          throw new Error(
            "The server returned an unreadable admin response.",
          );
        }

        setState({
          key: requestKey,
          data: result,
          loading: false,
          error: "",
        });
      })
      .catch((failure) => {
        if (cancelled || controller.signal.aborted) return;

        setState({
          key: requestKey,
          data: null,
          loading: false,
          error:
            failure?.message ||
            "Admin information could not be loaded.",
        });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [loader, token, query, requestKey]);

  const current = state.key === requestKey;

  return {
    data: current ? state.data : null,
    loading: !current || state.loading,
    error: current ? state.error : "",
    refresh,
  };
}

function LoadNotice({ loading, error, refresh }) {
  return (
    <>
      {loading && (
        <p role="status">Loading store information…</p>
      )}

      {error && (
        <div className="gd-admin-alert" role="alert">
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

const METRICS = {
  sales: ["Order value", money],
  received: ["Recorded payments", money],
  due: ["Balance due", money],
  orders: ["Confirmed orders", count],
};

function SalesChart({ points }) {
  const rows = points.filter(
    (point) => point && typeof point === "object",
  );

  const [selected, setSelected] = useState(rows.length - 1);
  const [table, setTable] = useState(false);
  const [metric, setMetric] = useState("sales");

  const [metricLabel, formatMetric] = METRICS[metric];

  const values = rows
    .map((point) => numeric(point[metric]))
    .filter((value) => value != null);

  const maximum = Math.max(0, ...values);
  const minimum = Math.min(0, ...values);
  const range = maximum - minimum || 1;
  const upper = maximum === minimum ? minimum + range : maximum;
  const zero = (-minimum / range) * 100;

  const chosenIndex =
    selected >= 0 && selected < rows.length
      ? selected
      : rows.length - 1;

  const chosen = rows[chosenIndex];

  if (!rows.length) {
    return (
      <p className="gd-admin-muted">
        Daily figures have not been recorded.
      </p>
    );
  }

  return (
    <>
      <div className="gd-admin-controls">
        <label htmlFor="admin-chart-metric">
          Show on graph

          <select
            id="admin-chart-metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
          >
            {Object.entries(METRICS).map(([key, [label]]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="button secondary"
          aria-pressed={table}
          onClick={() => setTable((value) => !value)}
        >
          {table ? "Show graph" : "Show daily table"}
        </button>
      </div>

      {table ? (
        <div
          className="gd-admin-table-scroll"
          style={{ marginTop: 16 }}
        >
          <table className="gd-admin-table">
            <caption className="sr-only">
              Daily figures supplied by the store report
            </caption>

            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Order value</th>
                <th scope="col">Recorded payments</th>
                <th scope="col">Balance due</th>
                <th scope="col">Orders</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((point, index) => (
                <tr key={`${point.date}-${index}`}>
                  <td>{date(point.date)}</td>
                  <td>{money(point.sales)}</td>
                  <td>{money(point.received)}</td>
                  <td>{money(point.due)}</td>
                  <td>{count(point.orders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="gd-sales-chart">
            <div className="gd-sales-axis" aria-hidden="true">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                <span
                  key={ratio}
                  style={{ top: `${(1 - ratio) * 100}%` }}
                >
                  {metric === "orders"
                    ? integer.format(minimum + range * ratio)
                    : compactCurrency.format(
                        minimum + range * ratio,
                      )}
                </span>
              ))}
            </div>

            <div className="gd-sales-scroll">
              <div
                className="gd-sales-bars"
                role="group"
                aria-label={`Daily ${metricLabel.toLowerCase()}`}
                style={{
                  position: "relative",
                  gridTemplateColumns:
                    `repeat(${rows.length}, minmax(28px, 1fr))`,
                  minWidth: rows.length * 32,
                }}
              >
                {minimum < 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: `${(upper / range) * 180}px`,
                      left: 0,
                      right: 0,
                      borderTop: "1px solid #64748b",
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  />
                )}

                {rows.map((point, index) => {
                  const value = numeric(point[metric]);
                  const selectedDay = chosenIndex === index;

                  return (
                    <div
                      className="gd-sales-column"
                      key={`${point.date}-${index}`}
                    >
                      <button
                        type="button"
                        className={`gd-sales-bar ${
                          selectedDay ? "selected" : ""
                        }`}
                        style={{ position: "relative" }}
                        aria-pressed={selectedDay}
                        aria-label={`${date(point.date)}: ${
                          formatMetric(point[metric])
                        } ${metricLabel.toLowerCase()}`}
                        title={`${date(point.date)}: ${
                          formatMetric(point[metric])
                        }`}
                        onFocus={() => setSelected(index)}
                        onClick={() => setSelected(index)}
                      >
                        {value != null && (
                          <span
                            style={{
                              position: "absolute",
                              left: 3,
                              width: "calc(100% - 6px)",
                              height:
                                `${(Math.abs(value) / range) * 100}%`,
                              bottom: `${
                                value >= 0
                                  ? zero
                                  : zero + (value / range) * 100
                              }%`,
                              ...(value < 0
                                ? {
                                    background: "#b91c1c",
                                    borderRadius: "0 0 5px 5px",
                                  }
                                : {}),
                            }}
                          />
                        )}
                      </button>

                      <small>
                        {rows.length <= 7 ||
                        index % 5 === 0 ||
                        index === rows.length - 1
                          ? date(point.date, true)
                          : ""}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {chosen && (
            <p className="gd-sales-selected" aria-live="polite">
              <strong>{date(chosen.date)}</strong>
              <span>Order value: {money(chosen.sales)}</span>
              <span>
                Recorded payments: {money(chosen.received)}
              </span>
              <span>Balance due: {money(chosen.due)}</span>
              <span>{count(chosen.orders)} orders</span>
            </p>
          )}
        </>
      )}

      <p className="gd-admin-muted">
        Tap a bar to inspect a day, or open the daily table.
        Dates use Indian time. Missing figures are labelled
        “Not recorded”.
      </p>
    </>
  );
}

function Dashboard({ user, token }) {
  const [days, setDays] = useState("7");
  const [source, setSource] = useState("real");

  const { data, loading, error, refresh } = useAdminData(
    getAdminDashboard,
    token,
    { days, source },
  );

  const summary = data?.sales?.summary || {};
  const stats = data?.stats || {};

  const points = Array.isArray(data?.sales?.points)
    ? data.sales.points
    : [];

  const recent = Array.isArray(data?.recentOrders)
    ? data.recentOrders.filter(
        (order) => order && typeof order === "object",
      )
    : [];

  const hasDailyValue = points.some(
    (point) =>
      numeric(point?.sales) != null &&
      numeric(point.sales) !== 0,
  );

  const cards = [
    [
      "Order value",
      money(summary.sales),
      "After recorded completed refunds",
      "/admin/orders",
    ],
    [
      "Recorded payments",
      money(summary.received),
      "Amount retained after recorded refunds",
      "/admin/orders",
    ],
    [
      "Balance due",
      money(summary.due),
      "Recorded unpaid balance, including COD",
      "/admin/orders",
    ],
    [
      "Confirmed orders",
      count(summary.orders),
      `Last ${days} days · selected order type`,
      "/admin/orders",
    ],
    [
      "Customers",
      count(stats.customers),
      `${count(stats.blockedCustomers)} blocked accounts · all dates`,
      "/admin/customers",
    ],
    [
      "Active products",
      count(stats.activeProducts),
      "Products currently active in your shop",
      "/admin/products",
    ],
  ];

  const tasks = [
    ["Orders to fulfil", stats.openOrders, "/admin/orders"],
    ["Awaiting payment", stats.pendingPayments, "/admin/orders"],
    [
      "Low stock · 1–10 units",
      stats.lowStockProducts,
      "/admin/products",
    ],
    ["Out of stock", stats.outOfStockProducts, "/admin/products"],
    ["Return requests", stats.pendingReturns, "/admin/returns"],
    ["Support conversations", stats.openSupport, "/admin/support"],
  ];

  return (
    <div className="page gd-admin-page">
      <div className="gd-admin-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Your store at a glance</h1>

          <p className="gd-admin-muted">
            Welcome, {user.name || "Admin"}. Review your orders,
            payments and tasks here.
          </p>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={refresh}
        >
          {loading ? "Loading…" : "Refresh dashboard"}
        </button>
      </div>

      <AdminMenu />

      <div className="gd-admin-controls">
        <label htmlFor="admin-report-days">
          Date range

          <select
            id="admin-report-days"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>

        <label htmlFor="admin-order-source">
          Order type

          <select
            id="admin-order-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="real">Real orders</option>
            <option value="test">Test orders</option>
          </select>
        </label>

        <Link className="button" to="/admin/products">
          Manage products
        </Link>
      </div>

      {source === "test" && (
        <p className="gd-admin-test">
          You are viewing test orders. These figures are for testing.
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
            {cards.map(([label, value, detail, to]) => (
              <Link
                className="gd-admin-stat"
                key={label}
                to={to}
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
                <h2 id="gd-sales-title">Sales and payments</h2>

                <p className="gd-admin-muted">
                  Compare order value, money retained and balances
                  due for confirmed orders created in the selected
                  period.
                </p>
              </div>

              <strong className="gd-sales-total">
                {money(summary.sales)}
              </strong>
            </div>

            {numeric(summary.orders) === 0 && !hasDailyValue ? (
              <div className="gd-admin-empty-chart">
                <h3>
                  No confirmed sales recorded for this period
                </h3>
                <p>
                  Try another date range or switch the order type.
                </p>
              </div>
            ) : (
              <SalesChart
                key={`${days}:${source}:${
                  data.generatedAt || "report"
                }`}
                points={points}
              />
            )}

            <p className="gd-admin-muted">
              {data.sales.basis ||
                "Current figures for confirmed orders created in this period; cancelled orders excluded."}
            </p>

            <p className="gd-admin-muted">
              COD advances count only toward recorded payments;
              the unpaid portion stays in balance due. Days are
              grouped by order creation date, not by payment or
              refund date.
            </p>

            <p className="gd-admin-muted">
              Profit is not calculated by this report. Product
              costs, shipping, packing, payment fees and return
              costs must be recorded before reporting a margin.
            </p>
          </section>

          <section
            className="gd-admin-panel"
            aria-labelledby="gd-tasks-title"
          >
            <h2 id="gd-tasks-title">Needs your attention</h2>

            <div className="gd-admin-tasks">
              {tasks.map(([label, value, to]) => (
                <Link key={label} to={to}>
                  <span>{label}</span>
                  <strong>{count(value)}</strong>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>

            <p className="gd-admin-muted">
              Order tasks use the selected order type across all
              dates. Product and customer counts are current store
              totals.
            </p>
          </section>

          <section
            className="gd-admin-panel"
            aria-labelledby="gd-recent-title"
          >
            <div className="gd-admin-heading">
              <h2 id="gd-recent-title">Latest orders</h2>

              <Link className="text-link" to="/admin/orders">
                View all orders →
              </Link>
            </div>

            {recent.length ? (
              <div className="gd-admin-table-scroll">
                <table className="gd-admin-table">
                  <caption className="sr-only">
                    Latest orders of the selected type, across
                    all dates
                  </caption>

                  <thead>
                    <tr>
                      {[
                        "Order",
                        "Customer",
                        "Contact number",
                        "Total",
                        "Order status",
                        "Payment",
                      ].map((label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {recent.map((order, index) => (
                      <tr
                        key={
                          order.id ||
                          order.orderNumber ||
                          index
                        }
                      >
                        <td>
                          <strong>
                            {order.orderNumber || "Not recorded"}
                          </strong>
                          <small>{date(order.createdAt)}</small>
                        </td>

                        <td>
                          {order.customerName || "Not recorded"}
                        </td>

                        <td>
                          <Phone value={order.customerPhone} />
                        </td>

                        <td>{money(order.total)}</td>
                        <td>{formatOrderStatus(order.status)}</td>
                        <td>
                          {paymentLabel(order.paymentStatus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No orders of this type are recorded yet.</p>
            )}
          </section>

          <p className="gd-admin-muted">
            Last report update: {timestamp(data.generatedAt)}
            {date(data.generatedAt) !== "Not recorded"
              ? " IST"
              : ""}
            .
          </p>
        </>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Access>
      {({ user, token, key }) => (
        <Dashboard key={key} user={user} token={token} />
      )}
    </Access>
  );
}