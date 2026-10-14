import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

import {
  getCustomerList,
  getCustomerDetail,
  changeCustomerStatus,
} from "../services/customerAdminApi.js";

import "./AdminCustomersPage.css";

const defaults = {
  search: "",
  status: "all",
  activity: "all",
  sort: "newest",
  from: "",
  to: "",
  page: 1,
  limit: 25,
};

const loadList = (token, id, options) =>
  getCustomerList(token, options);

const loadDetail = (token, id, options) =>
  getCustomerDetail(token, id, options);

const money = (value) =>
  Number.isSafeInteger(value) && value >= 0
    ? (value / 100).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      })
    : "Needs review";

function date(value) {
  const parsed = value ? new Date(value) : null;

  return parsed && Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "Not recorded";
}

function label(value) {
  const names = {
    paid: "Payment completed",
    "partially-paid": "Advance paid",
    "payment-pending": "Payment pending",
    razorpay: "Online payment",
    "cod-partial": "COD with online advance",
    cod: "Cash on delivery",
    "not-requested": "No request",
    none: "Not recorded",
  };

  return (
    names[value] ||
    String(value || "Not recorded").replaceAll("-", " ")
  );
}

function contactLinks(person) {
  const digits = String(person.phone || "")
    .replace(/\D/g, "");

  const international =
    digits.length === 10 ? `91${digits}` : digits;

  return {
    call:
      digits.length >= 7 && digits.length <= 15
        ? `tel:${digits.length === 10 ? "+91" : ""}${digits}`
        : "",

    whatsapp:
      international.length >= 11 &&
      international.length <= 15
        ? `https://wa.me/${international}`
        : "",

    email:
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        person.email || "",
      )
        ? `mailto:${person.email}`
        : "",
  };
}

function csvCell(value) {
  let text = String(value ?? "");

  if (/^\s*[=+\-@]|^[\t\r\n]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function exportPage(people) {
  const rows = [
    [
      "Customer ID",
      "Name",
      "Email",
      "Phone",
      "Phone source",
      "Account status",
      "Joined",
      "All orders",
      "Real confirmed orders",
      "Last order",
    ],

    ...people.map((person) => [
      person.id,
      person.name,
      person.email,
      person.phone,
      person.phoneSource,
      person.isActive ? "Active" : "Blocked",
      date(person.createdAt),
      person.orderCount,
      person.purchaseCount,
      date(person.lastOrderAt),
    ]),
  ];

  const blob = new Blob(
    [
      "\uFEFF",
      rows
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    anchor.href = url;
    anchor.download =
      "gymdrobe-customers-current-page.csv";

    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000,
    );
  }
}

function useRemote(
  loader,
  token,
  id,
  options,
  externalRevision = 0,
) {
  const [revision, setRevision] = useState(0);

  const query = JSON.stringify(options);

  const key =
    `${id}:${query}:${revision}:${externalRevision}`;

  const [state, setState] = useState({
    key: "",
    data: null,
    error: "",
    loading: true,
  });

  const refresh = useCallback(
    () => setRevision((value) => value + 1),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    setState({
      key,
      data: null,
      error: "",
      loading: true,
    });

    Promise.resolve()
      .then(() =>
        loader(token, id, {
          ...JSON.parse(query),
          signal: controller.signal,
        }),
      )
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            data,
            error: "",
            loading: false,
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            data: null,
            error:
              error.message ||
              "Customer information could not be loaded.",
            loading: false,
          });
        }
      });

    return () => controller.abort();
  }, [loader, token, id, query, key]);

  return {
    ...(state.key === key
      ? state
      : {
          data: null,
          error: "",
          loading: true,
        }),
    refresh,
  };
}

function Notice({ remote }) {
  return (
    <>
      {remote.loading && (
        <p className="gc-panel" role="status">
          Loading customer information…
        </p>
      )}

      {remote.error && (
        <div className="gc-alert" role="alert">
          <p>{remote.error}</p>

          <button
            type="button"
            className="button secondary"
            onClick={remote.refresh}
          >
            Retry loading
          </button>
        </div>
      )}
    </>
  );
}

function Contact({ person }) {
  const links = contactLinks(person);

  return (
    <div className="gc-contact">
      <span>
        {person.email || "Email not recorded"}
      </span>

      {links.call ? (
        <a href={links.call}>{person.phone}</a>
      ) : (
        <span>{person.phone || "Phone not added"}</span>
      )}

      {person.phoneSource === "order" && (
        <small>Latest order contact</small>
      )}
    </div>
  );
}

function ContactActions({ person }) {
  const links = contactLinks(person);

  return (
    <div className="gc-actions">
      {links.call && (
        <a
          className="button secondary compact"
          href={links.call}
        >
          Call
        </a>
      )}

      {links.email && (
        <a
          className="button secondary compact"
          href={links.email}
        >
          Email
        </a>
      )}

      {links.whatsapp && (
        <a
          className="button secondary compact"
          href={links.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
      )}
    </div>
  );
}

function AddressCard({ address, title }) {
  return (
    <section className="gc-panel">
      <h3>{title}</h3>

      <p>
        {address.fullName || "Name not recorded"}
        <br />

        {address.addressLine}
        {address.landmark
          ? `, ${address.landmark}`
          : ""}

        <br />

        {[
          address.city,
          address.state,
          address.pincode,
        ]
          .filter(Boolean)
          .join(", ")}

        <br />

        {address.phone || "Phone not recorded"}
      </p>
    </section>
  );
}

function OrderSnapshot({ order, onClose }) {
  return (
    <Modal
      title={`Order ${order.orderNumber}`}
      onClose={onClose}
      className="gc-dialog"
    >
      <p>
        <strong>{label(order.status)}</strong>
        {" · "}
        {date(order.createdAt)}
        {order.test ? " · Test / demo order" : ""}
      </p>

      <p>
        Payment: {label(order.paymentStatus)}
        {" · "}
        {label(order.paymentMethod)}
      </p>

      <div className="gc-table-scroll">
        <table className="gc-table">
          <caption>
            Purchased items. Unit prices are before
            order-level discounts.
          </caption>

          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Options</th>
              <th scope="col">Quantity</th>
              <th scope="col">Unit price</th>
            </tr>
          </thead>

          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td>
                  <strong>{item.name}</strong>
                  <small>
                    {item.brand} {item.sku}
                  </small>
                </td>

                <td>
                  {[
                    item.selectedColor,
                    item.selectedSize,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "Standard"}
                </td>

                <td>{item.quantity}</td>
                <td>{money(item.unitPricePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="gc-totals">
        {[
          ["Items subtotal", order.pricingPaise.subtotal],
          ["Kit savings", order.pricingPaise.kitDiscount],
          ["Coupon savings", order.pricingPaise.couponDiscount],
          ["Shipping", order.pricingPaise.shipping],
          ["Order total", order.totalPaise],
          ["Money collected", order.collectedPaise],
          ["Refunded", order.refundedPaise],
          ["Net retained", order.retainedPaise],
          [
            order.status === "cancelled"
              ? "Collectable balance"
              : "Balance due",
            order.duePaise,
          ],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{money(value)}</dd>
          </div>
        ))}
      </dl>

      <p>
        Return status: {label(order.returnStatus)}.
        {" "}
        Refund status: {label(order.refundStatus)}.
      </p>

      <p>
        Courier: {order.tracking?.carrier || "Not recorded"}.
        {" "}
        Tracking:{" "}
        {order.tracking?.trackingNumber || "Not recorded"}.
      </p>

      {order.shippingAddress && (
        <AddressCard
          address={order.shippingAddress}
          title="Delivery address recorded on this order"
        />
      )}

      <div className="gc-actions">
        <Link
          className="button secondary"
          to="/admin/orders"
        >
          Manage orders
        </Link>

        <Link
          className="button secondary"
          to="/admin/returns"
        >
          Returns and refunds
        </Link>
      </div>

      <p className="gc-muted">
        Search the order number in Manage orders to change
        fulfilment. This view does not change orders or
        transfer money.
      </p>
    </Modal>
  );
}

function CustomerDetail({
  id,
  token,
  revision,
  onClose,
  onStatus,
}) {
  const [source, setSource] = useState("real");
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState(null);

  const remote = useRemote(
    loadDetail,
    token,
    id,
    {
      source,
      page,
      limit: 10,
    },
    revision,
  );

  const data = remote.data;

  useEffect(() => {
    if (data && page > data.pages) {
      setPage(data.pages);
    }
  }, [data, page]);

  useEffect(() => {
    setOrder(null);
  }, [source, revision]);

  return (
    <Modal
      title="Customer details"
      onClose={onClose}
      className="gc-dialog"
    >
      <Notice remote={remote} />

      {data && (
        <>
          <div className="gc-heading">
            <div>
              <h2>{data.customer.name || "Customer"}</h2>

              <p className="gc-muted">
                Customer ID: {data.customer.id}
                <br />
                Joined {date(data.customer.createdAt)}
              </p>

              <Contact person={data.customer} />
            </div>

            <span
              className={`gc-badge ${
                data.customer.isActive
                  ? "active"
                  : "blocked"
              }`}
            >
              {data.customer.isActive
                ? "Active"
                : "Blocked"}
            </span>
          </div>

          <ContactActions person={data.customer} />

          <div className="gc-actions">
            <button
              type="button"
              className="button secondary"
              onClick={remote.refresh}
            >
              Refresh details
            </button>

            <button
              type="button"
              className={`button ${
                data.customer.isActive
                  ? "gc-danger"
                  : "secondary"
              }`}
              onClick={() => onStatus(data.customer)}
            >
              {data.customer.isActive
                ? "Block customer"
                : "Unblock customer"}
            </button>
          </div>

          <label className="gc-field">
            Order type

            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setPage(1);
              }}
            >
              <option value="real">Real orders</option>
              <option value="test">Test / demo orders</option>
              <option value="all">All orders</option>
            </select>
          </label>

          <p className="gc-muted">
            The following totals use{" "}
            {source === "all"
              ? "all"
              : source === "test"
                ? "test / demo"
                : "real"}{" "}
            orders across all dates. Order value excludes
            cancelled and payment-pending orders.
          </p>

          <div className="gc-stats">
            {[
              ["Orders", data.summary.orders],
              ["Delivered", data.summary.delivered],
              ["Cancelled", data.summary.cancelled],
              [
                "Return / exchange requests",
                data.summary.returns,
              ],
            ].map(([name, value]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <dl className="gc-totals">
            {[
              [
                "Confirmed order value",
                data.summary.orderValuePaise,
              ],
              [
                "Recorded money collected",
                data.summary.collectedPaise,
              ],
              [
                "Recorded refunds",
                data.summary.refundedPaise,
              ],
              [
                "Net money retained",
                data.summary.retainedPaise,
              ],
              [
                "Confirmed orders: balance due",
                data.summary.duePaise,
              ],
            ].map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{money(value)}</dd>
              </div>
            ))}
          </dl>

          {(
            data.summary.financialReviewOrders > 0 ||
            data.summary.valueReviewOrders > 0 ||
            data.summary.dueReviewOrders > 0
          ) && (
            <p className="gc-alert" role="status">
              Totals are incomplete:{" "}
              {data.summary.financialReviewOrders} orders
              need payment reconciliation,{" "}
              {data.summary.valueReviewOrders} need price
              review, and{" "}
              {data.summary.dueReviewOrders} need balance
              review. Unknown amounts are excluded.
            </p>
          )}

          <h3>Order history</h3>

          {data.orders.length ? (
            <div className="gc-table-scroll">
              <table className="gc-table">
                <caption>
                  Orders linked to this account ID
                </caption>

                <thead>
                  <tr>
                    {[
                      "Order",
                      "Status",
                      "Order value",
                      "Net retained",
                      "Action",
                    ].map((name) => (
                      <th scope="col" key={name}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.orders.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.orderNumber}</strong>
                        <small>
                          {date(row.createdAt)}
                          {row.test ? " · Test / demo" : ""}
                        </small>
                      </td>

                      <td>
                        {label(row.status)}
                        <small>{label(row.paymentStatus)}</small>
                      </td>

                      <td>{money(row.totalPaise)}</td>
                      <td>{money(row.retainedPaise)}</td>

                      <td>
                        <button
                          type="button"
                          className="button secondary compact"
                          onClick={() => setOrder(row)}
                        >
                          View order
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="gc-panel">
              No {source === "all" ? "" : source} orders
              found for this customer.
            </p>
          )}

          {data.pages > 1 && (
            <nav
              className="gc-pagination"
              aria-label="Customer order pages"
            >
              <button
                type="button"
                className="button secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>

              <span>
                Page {page} of {data.pages}
              </span>

              <button
                type="button"
                className="button secondary"
                disabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}

          <h3>Saved addresses</h3>

          <p className="gc-muted">
            Up to 10 saved addresses. Recorded addresses
            can belong to recipients other than the
            account owner.
          </p>

          {data.addresses.length ? (
            <div className="gc-address-grid">
              {data.addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  title={`${
                    address.label || "Address"
                  }${
                    address.isDefault
                      ? " · Default"
                      : ""
                  }`}
                />
              ))}
            </div>
          ) : (
            <p>No saved addresses.</p>
          )}

          {data.latestShippingAddress && (
            <AddressCard
              address={data.latestShippingAddress}
              title="Latest order delivery address (all order types)"
            />
          )}

          <p className="gc-muted">
            Contact links open your phone, email app or
            WhatsApp. Nothing is sent automatically.
          </p>
        </>
      )}

      {order && (
        <OrderSnapshot
          order={order}
          onClose={() => setOrder(null)}
        />
      )}
    </Modal>
  );
}

function CustomersWorkspace({ token, user }) {
  const [query, setQuery] = useState(defaults);
  const [draft, setDraft] = useState(defaults);
  const [detailId, setDetailId] = useState("");
  const [target, setTarget] = useState(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const mounted = useRef(false);
  const write = useRef(null);

  const remote = useRemote(
    loadList,
    token,
    "list",
    query,
  );

  const data = remote.data;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      write.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (data && query.page > data.pages) {
      setQuery((value) => ({
        ...value,
        page: data.pages,
      }));
    }
  }, [data, query.page]);

  function reset() {
    setDraft(defaults);
    setQuery(defaults);
    setActionError("");
  }

  function selectStatus(person) {
    if (
      busy ||
      person.role === "admin" ||
      person.id.toLowerCase() ===
        String(user.id || user._id).toLowerCase()
    ) {
      return;
    }

    setNotice("");
    setActionError("");
    setTarget(person);
  }

  async function saveStatus() {
    if (!target || write.current) return;

    const controller = new AbortController();
    write.current = controller;

    setBusy(true);
    setNotice("");
    setActionError("");

    try {
      const result = await changeCustomerStatus(
        token,
        target,
        !target.isActive,
        { signal: controller.signal },
      );

      if (mounted.current) {
        setNotice(
          result.message || "Account access updated.",
        );
      }
    } catch (error) {
      if (mounted.current) {
        setActionError(
          `${
            error.message ||
            "Account change could not be confirmed."
          } Check the refreshed status before retrying.`,
        );
      }
    } finally {
      write.current = null;

      if (mounted.current) {
        setBusy(false);
        setTarget(null);
        remote.refresh();

        setDetailRevision(
          (value) => value + 1,
        );
      }
    }
  }

  const people = data?.customers || [];

  return (
    <div className="page gc-page">
      <header className="gc-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Customers</h1>

          <p className="gc-muted">
            Customer accounts, contacts, order history
            and account access.
          </p>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={busy || remote.loading}
          onClick={remote.refresh}
        >
          Refresh customers
        </button>
      </header>

      <nav
        className="gc-menu"
        aria-label="Admin sections"
      >
        {[
          ["/admin", "Overview"],
          ["/admin/orders", "Orders"],
          ["/admin/products", "Products"],
          ["/admin/customers", "Customers"],
          ["/admin/returns", "Returns"],
          ["/admin/support", "Support"],
        ].map(([to, name]) => (
          <NavLink key={to} to={to} end>
            {name}
          </NavLink>
        ))}
      </nav>

      <p className="gc-muted">
        All customer accounts, regardless of the filters
        below. Guest shoppers are not included.
      </p>

      <div className="gc-stats">
        {[
          ["Customer accounts", "total"],
          ["Active accounts", "active"],
          ["Blocked accounts", "blocked"],
          ["Joined in last 30 days", "new30Days"],
        ].map(([name, field]) => (
          <div key={field}>
            <span>{name}</span>
            <strong>
              {data ? data.stats[field] : "—"}
            </strong>
          </div>
        ))}
      </div>

      <form
        className="gc-panel gc-filters"
        onSubmit={(event) => {
          event.preventDefault();

          if (!busy) {
            setQuery({
              ...draft,
              page: 1,
            });

            setActionError("");
          }
        }}
      >
        <label className="gc-field gc-search">
          Search

          <input
            type="search"
            maxLength={80}
            placeholder="Name, email, phone or customer ID"
            value={draft.search}
            onChange={(event) =>
              setDraft({
                ...draft,
                search: event.target.value,
              })
            }
          />
        </label>

        <label className="gc-field">
          Account status

          <select
            value={draft.status}
            onChange={(event) =>
              setDraft({
                ...draft,
                status: event.target.value,
              })
            }
          >
            <option value="all">All accounts</option>
            <option value="active">Active</option>
            <option value="disabled">Blocked</option>
          </select>
        </label>

        <label className="gc-field">
          Shopping activity

          <select
            value={draft.activity}
            onChange={(event) =>
              setDraft({
                ...draft,
                activity: event.target.value,
              })
            }
          >
            <option value="all">All customers</option>
            <option value="with-orders">Has orders</option>
            <option value="no-orders">No orders</option>
            <option value="repeat">
              2+ real confirmed orders
            </option>
          </select>
        </label>

        <label className="gc-field">
          Sort by

          <select
            value={draft.sort}
            onChange={(event) =>
              setDraft({
                ...draft,
                sort: event.target.value,
              })
            }
          >
            <option value="newest">Newest accounts</option>
            <option value="oldest">Oldest accounts</option>
            <option value="name">Name A–Z</option>
            <option value="orders">Most orders</option>
            <option value="last-order">
              Most recent order
            </option>
          </select>
        </label>

        <label className="gc-field">
          Joined from

          <input
            type="date"
            value={draft.from}
            onChange={(event) =>
              setDraft({
                ...draft,
                from: event.target.value,
              })
            }
          />
        </label>

        <label className="gc-field">
          Joined through

          <input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(event) =>
              setDraft({
                ...draft,
                to: event.target.value,
              })
            }
          />
        </label>

        <label className="gc-field">
          Per page

          <select
            value={draft.limit}
            onChange={(event) =>
              setDraft({
                ...draft,
                limit: Number(event.target.value),
              })
            }
          >
            {[25, 50, 100].map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </label>

        <div className="gc-actions">
          <button
            type="submit"
            className="button"
            disabled={busy}
          >
            Apply filters
          </button>

          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </form>

      {notice && (
        <p className="gc-success" role="status">
          {notice}
        </p>
      )}

      {actionError && (
        <p className="gc-alert" role="alert">
          {actionError}
        </p>
      )}

      <Notice remote={remote} />

      {data && (
        <>
          <div className="gc-heading">
            <p role="status">
              <strong>{data.total}</strong> matching
              customers · {people.length} on this page
            </p>

            <button
              type="button"
              className="button secondary"
              disabled={!people.length || busy}
              onClick={() => {
                try {
                  exportPage(people);
                  setNotice(
                    "Exported the current page only.",
                  );
                } catch {
                  setActionError(
                    "The export could not be created. Please retry.",
                  );
                }
              }}
            >
              Export this page
            </button>
          </div>

          {people.length ? (
            <div className="gc-panel gc-table-scroll">
              <table className="gc-table">
                <caption>
                  Customer accounts. Order counts include
                  test and cancelled orders.
                </caption>

                <thead>
                  <tr>
                    {[
                      "Customer",
                      "Contact",
                      "Joined",
                      "Orders",
                      "Last order",
                      "Status",
                      "Actions",
                    ].map((name) => (
                      <th scope="col" key={name}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {people.map((person) => (
                    <tr key={person.id}>
                      <td>
                        <strong>
                          {person.name || "Customer"}
                        </strong>
                        <small className="gc-id">
                          {person.id}
                        </small>
                      </td>

                      <td>
                        <Contact person={person} />
                      </td>

                      <td>{date(person.createdAt)}</td>

                      <td>
                        {person.orderCount}
                        <small>
                          {person.purchaseCount} real confirmed
                        </small>
                      </td>

                      <td>{date(person.lastOrderAt)}</td>

                      <td>
                        <span
                          className={`gc-badge ${
                            person.isActive
                              ? "active"
                              : "blocked"
                          }`}
                        >
                          {person.isActive
                            ? "Active"
                            : "Blocked"}
                        </span>
                      </td>

                      <td>
                        <div className="gc-actions">
                          <button
                            type="button"
                            className="button secondary compact"
                            disabled={busy}
                            onClick={() =>
                              setDetailId(person.id)
                            }
                          >
                            View details
                          </button>

                          <button
                            type="button"
                            className={`button compact ${
                              person.isActive
                                ? "gc-danger"
                                : "secondary"
                            }`}
                            disabled={
                              busy ||
                              person.role === "admin" ||
                              person.id.toLowerCase() ===
                                String(
                                  user.id || user._id,
                                ).toLowerCase()
                            }
                            onClick={() =>
                              selectStatus(person)
                            }
                          >
                            {person.isActive
                              ? "Block"
                              : "Unblock"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="gc-panel">
              <h2>No matching customers</h2>
              <p>
                Try another search or reset the filters.
              </p>

              <button
                type="button"
                className="button secondary"
                onClick={reset}
              >
                Reset filters
              </button>
            </section>
          )}

          {data.pages > 1 && (
            <nav
              className="gc-pagination"
              aria-label="Customer pages"
            >
              <button
                type="button"
                className="button secondary"
                disabled={busy || query.page <= 1}
                onClick={() =>
                  setQuery({
                    ...query,
                    page: query.page - 1,
                  })
                }
              >
                Previous
              </button>

              <span>
                Page {query.page} of {data.pages}
              </span>

              <button
                type="button"
                className="button secondary"
                disabled={
                  busy || query.page >= data.pages
                }
                onClick={() =>
                  setQuery({
                    ...query,
                    page: query.page + 1,
                  })
                }
              >
                Next
              </button>
            </nav>
          )}

          <p className="gc-muted">
            Last refreshed {date(data.generatedAt)}.
            Phone numbers are recorded contacts, not proof
            of phone verification. Exports contain customer
            information; share only with authorized staff.
          </p>
        </>
      )}

      {detailId && (
        <CustomerDetail
          key={detailId}
          id={detailId}
          token={token}
          revision={detailRevision}
          onClose={() => {
            if (!busy) setDetailId("");
          }}
          onStatus={selectStatus}
        />
      )}

      {target && (
        <Modal
          title={
            target.isActive
              ? "Block customer?"
              : "Unblock customer?"
          }
          onClose={() => {
            if (!busy) setTarget(null);
          }}
        >
          <p>
            <strong>{target.name || "Customer"}</strong>
            <br />
            {target.email}
          </p>

          <p>
            {target.isActive
              ? "Block sign-in and authenticated account actions. Existing orders stay available to administrators; blocking does not cancel orders or issue refunds."
              : "Restore sign-in and authenticated account access."}
          </p>

          <div className="gc-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Cancel
            </button>

            <button
              type="button"
              className={`button ${
                target.isActive ? "gc-danger" : ""
              }`}
              disabled={busy}
              onClick={saveStatus}
            >
              {busy
                ? "Saving…"
                : target.isActive
                  ? "Confirm block"
                  : "Confirm unblock"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AdminCustomersPage() {
  const auth = useAuth();

  if (auth.loading || auth.authLoading) {
    return (
      <div className="page" role="status">
        Checking admin access…
      </div>
    );
  }

  if (auth.authError) {
    return (
      <div className="page">
        <h1>Unable to verify your account</h1>
        <p role="alert">{auth.authError}</p>

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
      <div className="page">
        <h1>Admin sign-in required</h1>

        <Link
          className="button"
          to="/login?next=%2Fadmin%2Fcustomers"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (
    auth.user.role !== "admin" ||
    auth.user.isActive === false
  ) {
    return (
      <div className="page">
        <h1>Admin access required</h1>
        <Link className="button" to="/">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <CustomersWorkspace
      key={`${auth.user.id || auth.user._id}:${auth.token}`}
      token={auth.token}
      user={auth.user}
    />
  );
}