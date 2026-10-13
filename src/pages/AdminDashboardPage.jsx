import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

import {
  getAdminCustomers,
  setAdminCustomerStatus,
} from "../services/adminApi.js";

import Modal from "../components/Modal.jsx";
import "./AdminDashboardPage.css";

function numeric(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function count(value) {
  const parsed = numeric(value);

  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed.toLocaleString("en-IN")
    : "Not recorded";
}

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

async function loadCustomers(token, options) {
  const data = await getAdminCustomers(token, options);

  if (
    !Array.isArray(data?.customers) ||
    !data.customers.every(
      (person) =>
        person &&
        /^[a-f0-9]{24}$/i.test(person.id || "") &&
        typeof person.isActive === "boolean",
    ) ||
    !Number.isSafeInteger(data.page) ||
    data.page < 1 ||
    !Number.isSafeInteger(data.pages) ||
    data.pages < data.page ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0
  ) {
    throw new Error(
      "The customer response is incomplete. Check that the backend admin API is up to date.",
    );
  }

  return data;
}

function Phone({ value, source }) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length < 7 || digits.length > 15) {
    return <span className="gd-admin-muted">Not added</span>;
  }

  return (
    <div className="gd-admin-phone">
      <a href={`tel:${digits.length === 10 ? "+91" : ""}${digits}`}>
        {digits.length === 10 ? `+91 ${digits}` : String(value)}
      </a>

      {source === "order" && <small>Latest order contact</small>}
    </div>
  );
}

function AdminMenu() {
  return (
    <nav className="gd-admin-menu" aria-label="Admin sections">
      {[
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
      ].map(([to, label]) => (
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

        <Link
          className="button"
          to="/login?next=%2Fadmin%2Fcustomers"
        >
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

  const refresh = useCallback(
    () => setAttempt((value) => value + 1),
    [],
  );

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

function Customers({ user, token }) {
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
  } = useAdminData(loadCustomers, token, filters);

  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const action = useRef(null);
  const mounted = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      clearTimeout(timerRef.current);
      action.current?.abort();
    };
  }, []);

  async function changeStatus() {
    if (
      !selected ||
      typeof selected.isActive !== "boolean" ||
      action.current
    ) {
      return;
    }

    const controller = new AbortController();
    action.current = controller;

    timerRef.current = setTimeout(
      () => controller.abort(),
      45000,
    );

    setBusy(true);
    setNotice("");
    setActionError("");

    try {
      const result = await setAdminCustomerStatus(
        token,
        selected,
        !selected.isActive,
        { signal: controller.signal },
      );

      if (controller.signal.aborted) {
        throw new DOMException(
          "The request timed out.",
          "AbortError",
        );
      }

      if (
        String(result?.customer?.id) !==
          String(selected.id) ||
        result.customer.isActive !== !selected.isActive
      ) {
        throw new Error(
          "The saved customer status could not be confirmed.",
        );
      }

      if (mounted.current) {
        setNotice(
          result.message || "Customer access updated.",
        );
      }
    } catch (failure) {
      if (mounted.current) {
        setActionError(
          failure?.name === "AbortError"
            ? "The request took too long. Check the refreshed account status before trying again."
            : `${
                failure?.message ||
                "The change could not be confirmed."
              } Check the refreshed list before trying again.`,
        );
      }
    } finally {
      clearTimeout(timerRef.current);
      action.current = null;

      if (mounted.current) {
        setBusy(false);
        setSelected(null);
        refresh();
      }
    }
  }

  function clearFilters() {
    setSearch("");
    setStatus("");

    setFilters({
      search: "",
      status: "",
      page: 1,
    });
  }

  const people = Array.isArray(data?.customers)
    ? data.customers.filter(
        (person) => person && typeof person === "object",
      )
    : [];

  const page = numeric(data?.page) || filters.page;
  const pages = numeric(data?.pages) || 1;

  return (
    <div className="page gd-admin-page">
      <div className="gd-admin-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Your customers</h1>

          <p className="gd-admin-muted">
            Find contact details and manage customer account access.
          </p>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={loading || busy}
          onClick={refresh}
        >
          Refresh customers
        </button>
      </div>

      <AdminMenu />

      <form
        className="gd-admin-filters"
        onSubmit={(event) => {
          event.preventDefault();

          if (!busy) {
            setFilters({
              search: search.trim(),
              status,
              page: 1,
            });
          }
        }}
      >
        <label htmlFor="admin-customer-search">
          Search customers

          <input
            id="admin-customer-search"
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

        <label htmlFor="admin-customer-status">
          Account status

          <select
            id="admin-customer-status"
            value={status}
            disabled={busy}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="">All customers</option>
            <option value="active">Active</option>
            <option value="disabled">Blocked</option>
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
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </form>

      {notice && (
        <p className="gd-admin-success" role="status">
          {notice}
        </p>
      )}

      {actionError && (
        <p className="gd-admin-alert" role="alert">
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
          <p className="gd-admin-muted" role="status">
            Total customers matching these filters:{" "}
            {count(data.total)}
          </p>

          {people.length ? (
            <div className="gd-admin-panel gd-admin-table-scroll">
              <table className="gd-admin-table">
                <caption className="sr-only">
                  Customer contacts and account access controls
                </caption>

                <thead>
                  <tr>
                    {[
                      "Customer",
                      "Contact number",
                      "Joined",
                      "Orders",
                      "Status",
                      "Action",
                    ].map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {people.map((person, index) => {
                    const active =
                      person.isActive === true;

                    const knownStatus =
                      typeof person.isActive === "boolean";

                    const protectedAccount =
                      person.role === "admin" ||
                      String(person.id || person._id)
                        .toLowerCase() ===
                        String(user.id || user._id)
                          .toLowerCase();

                    return (
                      <tr key={person.id || person._id || index}>
                        <td>
                          <strong>
                            {person.name || "Not recorded"}
                          </strong>

                          <small className="gd-admin-email">
                            {person.email || "Email not recorded"}
                          </small>
                        </td>

                        <td>
                          <Phone
                            value={person.phone}
                            source={person.phoneSource}
                          />
                        </td>

                        <td>{date(person.createdAt)}</td>
                        <td>{count(person.orderCount)}</td>

                        <td>
                          <span
                            className={`gd-admin-badge ${
                              knownStatus
                                ? active
                                  ? "active"
                                  : "blocked"
                                : ""
                            }`}
                          >
                            {knownStatus
                              ? active
                                ? "Active"
                                : "Blocked"
                              : "Not recorded"}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className={`gd-admin-action ${
                              active ? "danger" : ""
                            }`}
                            disabled={
                              busy ||
                              loading ||
                              !knownStatus ||
                              !person.id ||
                              protectedAccount
                            }
                            aria-label={`${
                              active ? "Block" : "Unblock"
                            } ${person.name || "customer"}`}
                            onClick={() => {
                              setNotice("");
                              setActionError("");
                              setSelected(person);
                            }}
                          >
                            {protectedAccount
                              ? "Protected account"
                              : active
                                ? "Block user"
                                : "Unblock user"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="gd-admin-panel">
              <h2>No customers found</h2>
              <p>Try another search or clear the filters.</p>

              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          )}

          <p className="gd-admin-muted">
            If the profile has no number, the latest order
            contact is shown and labelled. Search uses profile
            numbers. Order counts include test and cancelled orders.
          </p>

          {pages > 1 && (
            <nav
              className="gd-admin-pagination"
              aria-label="Customer pages"
            >
              <button
                type="button"
                className="button secondary"
                disabled={busy || loading || page <= 1}
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: page - 1,
                  }))
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
                disabled={busy || loading || page >= pages}
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: page + 1,
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
            if (!busy) setSelected(null);
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
                ? "This customer will lose access to sign-in and authenticated account actions. Their existing orders remain available to administrators."
                : "Restore this customer's account access. They can sign in again with Google."}
            </p>

            {busy && (
              <p role="status">
                Saving the account change…
              </p>
            )}

            <div className="purchase-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`button ${
                  selected.isActive ? "gd-admin-danger" : ""
                }`}
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

export default function AdminCustomersPage() {
  return (
    <Access>
      {({ user, token, key }) => (
        <Customers key={key} user={user} token={token} />
      )}
    </Access>
  );
}