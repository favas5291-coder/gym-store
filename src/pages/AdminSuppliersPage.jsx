import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  NavLink,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import PageLoading from "../components/PageLoading.jsx";

import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  setSupplierStatus,
  setSupplierVerification,
} from "../services/supplierApi.js";

import "./AdminSuppliersPage.css";

const STATUSES = ["draft", "active", "blocked", "archived"];

const LABELS = {
  draft: "Draft",
  active: "Active",
  blocked: "Blocked",
  archived: "Archived",
};

const EMPTY = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  whatsapp: "",
  notes: "",
  dispatchToCustomer: false,
  sendToPackingLocation: false,
  preparationDaysMin: "",
  preparationDaysMax: "",
};

function draftFor(supplier) {
  return {
    ...EMPTY,
    name: supplier?.name || "",
    contactName: supplier?.contact?.name || "",
    email: supplier?.contact?.email || "",
    phone: supplier?.contact?.phone || "",
    whatsapp: supplier?.contact?.whatsapp || "",
    notes: supplier?.notes || "",
    dispatchToCustomer:
      supplier?.fulfillment?.dispatchToCustomer === true,
    sendToPackingLocation:
      supplier?.fulfillment?.sendToPackingLocation === true,
    preparationDaysMin: String(
      supplier?.fulfillment?.preparationDaysMin ?? "",
    ),
    preparationDaysMax: String(
      supplier?.fulfillment?.preparationDaysMax ?? "",
    ),
  };
}

function prepare(draft) {
  const errors = {};

  const contact = {
    name: draft.contactName.trim(),
    email: draft.email.trim().toLowerCase(),
  };

  if (draft.name.trim().length < 2) {
    errors.name =
      "Enter a supplier business name with at least 2 characters.";
  }

  if (
    contact.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)
  ) {
    errors.email = "Enter a valid supplier email address.";
  }

  for (const key of ["phone", "whatsapp"]) {
    contact[key] = draft[key].trim().replace(/[\s()+-]/g, "");

    if (contact[key] && !/^\d{7,15}$/.test(contact[key])) {
      errors[key] =
        "Enter 7–15 digits, including the country code.";
    }
  }

  const fulfillment = {
    dispatchToCustomer: draft.dispatchToCustomer,
    sendToPackingLocation: draft.sendToPackingLocation,
  };

  for (const key of [
    "preparationDaysMin",
    "preparationDaysMax",
  ]) {
    const raw = draft[key].trim();
    const value = raw === "" ? null : Number(raw);

    if (
      value != null &&
      (!Number.isSafeInteger(value) || value < 0 || value > 365)
    ) {
      errors[key] = "Enter whole days from 0 to 365.";
    }

    fulfillment[key] = value;
  }

  const low = fulfillment.preparationDaysMin;
  const high = fulfillment.preparationDaysMax;

  if ((low == null) !== (high == null)) {
    errors.preparationDaysMax =
      "Enter both preparation limits, or leave both blank for a draft.";
  } else if (low != null && high < low) {
    errors.preparationDaysMax =
      "Maximum preparation days cannot be below the minimum.";
  }

  return {
    errors,
    value: {
      name: draft.name.trim(),
      contact,
      fulfillment,
      notes: draft.notes.trim(),
    },
  };
}

function timestamp(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function preparation(supplier) {
  const low = supplier.fulfillment?.preparationDaysMin;
  const high = supplier.fulfillment?.preparationDaysMax;

  if (
    !Number.isSafeInteger(low) ||
    !Number.isSafeInteger(high)
  ) {
    return "Not recorded";
  }

  return low === high
    ? `${low} ${low === 1 ? "day" : "days"}`
    : `${low}–${high} days`;
}

function useRemote(loader, token, options) {
  const query = JSON.stringify(options);
  const [attempt, setAttempt] = useState(0);
  const key = `${token}:${query}:${attempt}`;

  const [state, setState] = useState({
    key: "",
    data: null,
    loading: true,
    error: null,
  });

  const reload = useCallback(
    () => setAttempt((value) => value + 1),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setState({
      key,
      data: null,
      loading: true,
      error: null,
    });

    Promise.resolve()
      .then(() =>
        loader(token, {
          ...JSON.parse(query),
          signal: controller.signal,
        }),
      )
      .then((data) => {
        if (!cancelled) {
          setState({
            key,
            data,
            loading: false,
            error: null,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            key,
            data: null,
            loading: false,
            error,
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loader, token, query, key]);

  return state.key === key
    ? { ...state, reload }
    : {
        data: null,
        loading: true,
        error: null,
        reload,
      };
}

function loadEditor(token, { id, signal }) {
  return id === "new"
    ? Promise.resolve({
        supplier: null,
        productCount: 0,
        activeProductCount: 0,
      })
    : getSupplierById(token, id, { signal });
}

function ErrorNotice({ error, retry }) {
  const { retrySession, logout } = useAuth();

  if (!error) return null;

  const sessionError =
    error.status === 401 || error.status === 403;

  return (
    <div className="gd-supplier-error" role="alert">
      <p>
        {error.message ||
          "Supplier information could not be loaded."}
      </p>

      <div className="gd-supplier-actions">
        {sessionError ? (
          <>
            <Link
              className="button secondary"
              to="/login?next=%2Fadmin%2Fsuppliers"
              onClick={() => logout?.()}
            >
              Sign in again
            </Link>

            <button
              type="button"
              className="button secondary"
              onClick={retrySession}
            >
              Check my session
            </button>
          </>
        ) : (
          retry && (
            <button
              type="button"
              className="button secondary"
              onClick={retry}
            >
              Retry loading
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Badge({ status }) {
  return (
    <span className={`gd-supplier-badge ${status}`}>
      {LABELS[status] || "Not recorded"}
    </span>
  );
}

function SupplierEditor({
  id,
  token,
  onClose,
  onCreated,
  onChanged,
  onDirty,
  onBusy,
}) {
  const remote = useRemote(loadEditor, token, { id });

  const [supplier, setSupplier] = useState(null);

  const [counts, setCounts] = useState({
    productCount: null,
    activeProductCount: null,
  });

  const [draft, setDraft] = useState({ ...EMPTY });

  const [verification, setVerification] = useState({
    status: "pending",
    notes: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const alive = useRef(false);
  const writing = useRef(false);
  const operation = useRef(null);

  const newSupplier = id === "new";

  const detailsDirty =
    JSON.stringify(draft) !== JSON.stringify(draftFor(supplier));

  const verificationDirty =
    verification.status !==
      (supplier?.verification?.status || "pending") ||
    verification.notes !==
      (supplier?.verification?.notes || "");

  const dirty = detailsDirty || verificationDirty;

  const locked =
    needsReload || remote.loading || Boolean(remote.error);

  const adopt = useCallback(
    (record, nextCounts) => {
      setSupplier(record);
      setDraft(draftFor(record));

      setVerification({
        status: record?.verification?.status || "pending",
        notes: record?.verification?.notes || "",
      });

      setFieldErrors({});
      setError(null);
      setNeedsReload(false);

      if (nextCounts) setCounts(nextCounts);

      onDirty(false);
    },
    [onDirty],
  );

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
      operation.current?.abort();
      onDirty(false);
      onBusy(false);
    };
  }, [onDirty, onBusy]);

  useEffect(() => {
    if (remote.data) {
      adopt(remote.data.supplier, {
        productCount: remote.data.productCount,
        activeProductCount: remote.data.activeProductCount,
      });
    }
  }, [remote.data, adopt]);

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  useEffect(() => {
    if (!dirty) return;

    const protect = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", protect);

    return () => {
      window.removeEventListener("beforeunload", protect);
    };
  }, [dirty]);

  async function run(action, creating = false) {
    if (writing.current || locked) return;

    writing.current = true;
    setBusy(true);
    onBusy(true);
    setError(null);
    setNotice("");

    operation.current = new AbortController();

    try {
      const result = await action(operation.current.signal);

      if (!alive.current) return;

      const withdrawn = Number.isSafeInteger(
        result.withdrawnProducts,
      )
        ? result.withdrawnProducts
        : 0;

      adopt(result.supplier, {
        productCount: counts.productCount,
        activeProductCount: Number.isSafeInteger(
          counts.activeProductCount,
        )
          ? Math.max(0, counts.activeProductCount - withdrawn)
          : null,
      });

      setConfirm(null);

      setNotice(
        `${result.message || "Supplier saved."}${
          withdrawn
            ? ` ${withdrawn} published ${
                withdrawn === 1 ? "product was" : "products were"
              } withdrawn.`
            : ""
        }`,
      );

      onChanged();

      if (creating) onCreated(result.supplier.id);
    } catch (failure) {
      if (!alive.current) return;

      setConfirm(null);
      setError(failure);

      if (
        failure.outcomeUnknown ||
        failure.status === 409 ||
        failure.status === 401 ||
        failure.status === 403
      ) {
        setNeedsReload(true);

        if (failure.outcomeUnknown) onChanged();
      }
    } finally {
      writing.current = false;

      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }

  function change(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [key]: "",
    }));

    setError(null);
  }

  function save(event) {
    event.preventDefault();

    if (busy || locked || verificationDirty) return;

    const prepared = prepare(draft);

    setFieldErrors(prepared.errors);

    const first = Object.keys(prepared.errors)[0];

    if (first) {
      document.getElementById(`supplier-${first}`)?.focus();
      return;
    }

    run(
      (signal) =>
        newSupplier
          ? createSupplier(token, prepared.value, { signal })
          : updateSupplier(token, supplier, prepared.value, {
              signal,
            }),
      newSupplier,
    );
  }

  function askVerification(event) {
    event.preventDefault();

    if (busy || locked || detailsDirty || !supplier) return;

    if (
      verification.status !== "pending" &&
      !verification.notes.trim()
    ) {
      setError(
        new Error(
          "Record what you checked, or why verification was rejected.",
        ),
      );

      document.getElementById(
        "supplier-verification-notes",
      )?.focus();

      return;
    }

    setConfirm({
      kind: "verification",
      title: "Record supplier verification",
      value: {
        ...verification,
        notes: verification.notes.trim(),
      },
    });
  }

  function reload() {
    if (busy) return;

    if (dirty) {
      setConfirm({
        kind: "reload",
        title: "Reload latest supplier record",
      });

      return;
    }

    setNotice("");
    remote.reload();
  }

  function confirmAction() {
    if (!confirm || busy) return;

    if (confirm.kind === "reload") {
      setConfirm(null);
      setNotice("");
      remote.reload();
      return;
    }

    if (confirm.kind === "discard") {
      setConfirm(null);
      adopt(supplier);
      return;
    }

    if (confirm.kind === "status") {
      run((signal) =>
        setSupplierStatus(token, supplier, confirm.value, {
          signal,
        }),
      );
    }

    if (confirm.kind === "verification") {
      run((signal) =>
        setSupplierVerification(
          token,
          supplier,
          confirm.value,
          { signal },
        ),
      );
    }
  }

  const field = (
    key,
    label,
    {
      type = "text",
      maximum = 100,
      help,
      ...attributes
    } = {},
  ) => (
    <label
      className="gd-supplier-field"
      htmlFor={`supplier-${key}`}
    >
      <span>{label}</span>

      <input
        id={`supplier-${key}`}
        name={key}
        type={type}
        value={draft[key]}
        maxLength={maximum}
        onChange={(event) => change(key, event.target.value)}
        aria-invalid={Boolean(fieldErrors[key])}
        aria-describedby={
          fieldErrors[key] || help
            ? `supplier-${key}-help`
            : undefined
        }
        {...attributes}
      />

      {(fieldErrors[key] || help) && (
        <small
          id={`supplier-${key}-help`}
          className={
            fieldErrors[key] ? "gd-supplier-field-error" : ""
          }
        >
          {fieldErrors[key] || help}
        </small>
      )}
    </label>
  );

  if (remote.loading && !supplier) {
    return (
      <section className="gd-supplier-panel" role="status">
        Loading supplier details…
      </section>
    );
  }

  if (remote.error && !supplier) {
    return (
      <section className="gd-supplier-panel">
        <h2>Supplier could not be loaded</h2>

        <ErrorNotice
          error={remote.error}
          retry={remote.reload}
        />

        <button
          type="button"
          className="button secondary"
          onClick={onClose}
        >
          Back to suppliers
        </button>
      </section>
    );
  }

  return (
    <section
      className="gd-supplier-panel gd-supplier-editor"
      aria-labelledby="supplier-editor-title"
      aria-busy={busy}
    >
      <div className="gd-supplier-heading">
        <div>
          <p className="eyebrow">
            {supplier?.supplierCode || "NEW SUPPLIER"}
          </p>

          <h2 id="supplier-editor-title">
            {newSupplier
              ? "Add a supplier"
              : `Manage ${supplier?.name || "supplier"}`}
          </h2>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          Close editor
        </button>
      </div>

      {supplier && (
        <div className="gd-supplier-record">
          <Badge status={supplier.status} />

          <span>
            Verification:{" "}
            {supplier.verification?.status || "pending"}
          </span>

          <span>
            Linked products:{" "}
            {counts.productCount ?? "Not recorded"}
          </span>

          <span>
            Published products:{" "}
            {counts.activeProductCount ?? "Not recorded"}
          </span>

          <button
            type="button"
            className="gd-supplier-text-button"
            disabled={busy || remote.loading}
            onClick={reload}
          >
            Reload latest record
          </button>
        </div>
      )}

      {remote.loading && (
        <p role="status">
          Reloading the latest supplier record…
        </p>
      )}

      <ErrorNotice error={remote.error || error} />

      {needsReload && (
        <div className="gd-supplier-warning" role="status">
          <p>
            {newSupplier
              ? "The supplier may have been saved. Refresh the supplier list and check for it before creating another."
              : "The saved result needs checking. Reload the latest record before making another change."}
          </p>

          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={newSupplier ? onClose : reload}
          >
            {newSupplier
              ? "Check supplier list"
              : "Reload latest record"}
          </button>
        </div>
      )}

      {notice && (
        <p className="gd-supplier-success" role="status">
          {notice}
        </p>
      )}

      {busy && (
        <p role="status">
          Saving supplier information. Keep this page open…
        </p>
      )}

      <form onSubmit={save} noValidate>
        <fieldset
          className="gd-supplier-fields"
          disabled={busy || locked || verificationDirty}
        >
          <legend>1. Supplier details</legend>

          {field("name", "Supplier business name", {
            maximum: 200,
            required: true,
            help: "Record the seller or supplier business. Product brands are recorded separately.",
          })}

          <h3>Contact details</h3>

          <div className="gd-supplier-field-grid">
            {field("contactName", "Contact person", {
              autoComplete: "name",
            })}

            {field("email", "Supplier email", {
              type: "email",
              maximum: 150,
              autoComplete: "email",
            })}

            {field("phone", "Supplier phone", {
              type: "tel",
              maximum: 40,
              autoComplete: "tel",
              help: "Include the country code, for example +91 for India.",
            })}

            {field("whatsapp", "Supplier WhatsApp", {
              type: "tel",
              maximum: 40,
              help: "Include the country code. Leave blank if unavailable.",
            })}
          </div>

          <h3>Fulfillment arrangement</h3>

          <p className="gd-supplier-muted">
            Select only arrangements you have agreed with
            this supplier.
          </p>

          <label className="gd-supplier-check">
            <input
              type="checkbox"
              checked={draft.dispatchToCustomer}
              onChange={(event) =>
                change(
                  "dispatchToCustomer",
                  event.target.checked,
                )
              }
            />
            Supplier can dispatch directly to customers
          </label>

          <label className="gd-supplier-check">
            <input
              type="checkbox"
              checked={draft.sendToPackingLocation}
              onChange={(event) =>
                change(
                  "sendToPackingLocation",
                  event.target.checked,
                )
              }
            />
            Supplier can send products to a packing location
          </label>

          <p className="gd-supplier-muted">
            A packing location and kit shipping arrangement
            must also be configured before promising one
            package.
          </p>

          <div className="gd-supplier-field-grid">
            {field(
              "preparationDaysMin",
              "Minimum preparation days",
              {
                type: "number",
                min: 0,
                max: 365,
                step: 1,
              },
            )}

            {field(
              "preparationDaysMax",
              "Maximum preparation days",
              {
                type: "number",
                min: 0,
                max: 365,
                step: 1,
              },
            )}
          </div>

          <p className="gd-supplier-muted">
            Preparation means time before dispatch. Delivery
            transit time is recorded separately on products.
          </p>

          <label
            className="gd-supplier-field"
            htmlFor="supplier-notes"
          >
            <span>Internal supplier notes</span>

            <textarea
              id="supplier-notes"
              name="notes"
              rows={3}
              maxLength={2000}
              value={draft.notes}
              onChange={(event) =>
                change("notes", event.target.value)
              }
            />
          </label>
        </fieldset>

        <div className="gd-supplier-actions">
          <button
            type="submit"
            className="button"
            disabled={
              busy ||
              locked ||
              verificationDirty ||
              (!newSupplier && !detailsDirty)
            }
          >
            {busy
              ? "Saving…"
              : newSupplier
                ? "Save draft supplier"
                : "Save supplier details"}
          </button>

          {dirty && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || locked}
              onClick={() =>
                setConfirm({
                  kind: "discard",
                  title: "Discard unsaved edits",
                })
              }
            >
              Discard unsaved edits
            </button>
          )}
        </div>
      </form>

      {supplier && (
        <>
          {detailsDirty && (
            <p className="gd-supplier-warning">
              Save or discard supplier details before
              recording verification or changing status.
            </p>
          )}

          <form
            className="gd-supplier-section"
            onSubmit={askVerification}
          >
            <fieldset
              className="gd-supplier-fields"
              disabled={busy || locked || detailsDirty}
            >
              <legend>2. Record supplier verification</legend>

              <p className="gd-supplier-muted">
                Record the checks you performed. This does
                not verify the authenticity of every product.
              </p>

              {supplier.verification?.verifiedAt && (
                <p>
                  Last verified:{" "}
                  {timestamp(supplier.verification.verifiedAt)}
                </p>
              )}

              <label
                className="gd-supplier-field"
                htmlFor="supplier-verification-status"
              >
                <span>Verification result</span>

                <select
                  id="supplier-verification-status"
                  value={verification.status}
                  onChange={(event) => {
                    setVerification((current) => ({
                      ...current,
                      status: event.target.value,
                    }));

                    setError(null);
                  }}
                >
                  <option value="pending">Pending checks</option>
                  <option value="verified">
                    Verified by admin
                  </option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <label
                className="gd-supplier-field"
                htmlFor="supplier-verification-notes"
              >
                <span>Verification notes</span>

                <textarea
                  id="supplier-verification-notes"
                  rows={3}
                  maxLength={2000}
                  value={verification.notes}
                  onChange={(event) => {
                    setVerification((current) => ({
                      ...current,
                      notes: event.target.value,
                    }));

                    setError(null);
                  }}
                />
              </label>
            </fieldset>

            <button
              type="submit"
              className="button secondary"
              disabled={
                busy ||
                locked ||
                detailsDirty ||
                !verificationDirty
              }
            >
              Record verification
            </button>
          </form>

          <section
            className="gd-supplier-section"
            aria-labelledby="supplier-status-title"
          >
            <h3 id="supplier-status-title">
              3. Supplier status
            </h3>

            {supplier.setupIssues?.length > 0 && (
              <div className="gd-supplier-warning">
                <strong>Complete before activation</strong>

                <ul>
                  {supplier.setupIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="gd-supplier-muted">
              Blocking, archiving or moving to draft withdraws
              linked published products. Existing order records
              remain available. Activating a supplier does not
              restore products automatically.
            </p>

            {verificationDirty && (
              <p className="gd-supplier-warning">
                Record or discard your verification edits
                before changing status.
              </p>
            )}

            <div className="gd-supplier-actions">
              {STATUSES.filter(
                (status) => status !== supplier.status,
              ).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`button ${
                    status === "active" ? "" : "secondary"
                  } ${
                    status === "blocked"
                      ? "gd-supplier-danger"
                      : ""
                  }`}
                  disabled={
                    busy ||
                    locked ||
                    dirty ||
                    (status === "active" &&
                      supplier.setupIssues?.length > 0)
                  }
                  onClick={() =>
                    setConfirm({
                      kind: "status",
                      value: status,
                      title:
                        status === "active"
                          ? "Activate supplier"
                          : status === "blocked"
                            ? "Block supplier"
                            : status === "archived"
                              ? "Archive supplier"
                              : "Move supplier to draft",
                    })
                  }
                >
                  {status === "active"
                    ? "Activate supplier"
                    : status === "blocked"
                      ? "Block supplier"
                      : status === "archived"
                        ? "Archive supplier"
                        : "Move to draft"}
                </button>
              ))}
            </div>

            <div className="gd-supplier-actions gd-supplier-related">
              <Link
                className="gd-supplier-text-button"
                to="/admin/products"
              >
                Review products →
              </Link>

              <Link
                className="gd-supplier-text-button"
                to="/admin/orders"
              >
                Review unfulfilled orders →
              </Link>
            </div>
          </section>
        </>
      )}

      {confirm && (
        <Modal
          title={confirm.title}
          className="gd-supplier-dialog"
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          {confirm.kind === "status" && (
            <>
              <p>
                {confirm.value === "active"
                  ? "Activate this supplier for product publication? Review and restore its archived products separately."
                  : `Mark ${supplier.name} as ${
                      LABELS[confirm.value].toLowerCase()
                    }? Its currently published products will be withdrawn.`}
              </p>

              {confirm.value !== "active" && (
                <p>
                  Check any unfulfilled orders and arrange
                  support where needed. This action does not
                  cancel or refund existing orders.
                </p>
              )}
            </>
          )}

          {confirm.kind === "verification" && (
            <>
              <p>
                Record verification as{" "}
                <strong>{confirm.value.status}</strong> for{" "}
                {supplier.name}?
              </p>

              <p className="gd-supplier-verification-note">
                {confirm.value.notes ||
                  "No verification notes recorded."}
              </p>

              {confirm.value.status !== "verified" &&
                supplier.status === "active" && (
                  <p>
                    This moves the supplier to draft and
                    withdraws its published products.
                  </p>
                )}
            </>
          )}

          {confirm.kind === "reload" && (
            <p>
              Load the saved supplier record? Your unsaved
              edits will be replaced. Copy any details you
              want to keep before continuing.
            </p>
          )}

          {confirm.kind === "discard" && (
            <p>
              Discard these unsaved edits and return to the
              last loaded supplier details?
            </p>
          )}

          {busy && (
            <p role="status">
              Saving… Keep this dialog open.
            </p>
          )}

          <div className="gd-supplier-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={confirmAction}
            >
              {busy ? "Saving…" : "Confirm"}
            </button>

            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Suppliers({ token }) {
  const [params, setParams] = useSearchParams();

  const status = STATUSES.includes(params.get("status"))
    ? params.get("status")
    : "";

  const search = (params.get("search") || "").slice(0, 150);
  const rawPage = Number(params.get("page") || 1);

  const page =
    Number.isSafeInteger(rawPage) &&
    rawPage >= 1 &&
    rawPage <= 1000000
      ? rawPage
      : 1;

  const selected = params.get("supplier") || "";

  const [searchText, setSearchText] = useState(search);
  const [busy, setBusy] = useState(false);
  const [discardTarget, setDiscardTarget] = useState(null);

  const dirty = useRef(false);

  const setDirty = useCallback((value) => {
    dirty.current = value;
  }, []);

  const setOperationBusy = useCallback(
    (value) => setBusy(value),
    [],
  );

  const list = useRemote(getSuppliers, token, {
    search,
    status,
    page,
    limit: 12,
  });

  useEffect(() => {
    setSearchText(search);
  }, [search]);

  function query(patch) {
    setParams((current) => {
      const next = new URLSearchParams(current);

      for (const [key, value] of Object.entries(patch)) {
        if (
          value == null ||
          value === "" ||
          (key === "page" && value === 1)
        ) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      return next;
    });
  }

  function select(id, force = false) {
    if (busy && !force) return;

    if (dirty.current && !force) {
      setDiscardTarget({ id });
      return;
    }

    dirty.current = false;
    setDiscardTarget(null);
    query({ supplier: id });

    if (!id) list.reload();
  }

  function resetFilters() {
    setSearchText("");

    query({
      search: "",
      status: "",
      page: 1,
    });
  }

  return (
    <div className="page gd-suppliers-page">
      <div className="gd-supplier-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Suppliers</h1>

          <p className="gd-supplier-muted">
            Manage who supplies your products, their contact
            details and agreed fulfillment arrangements.
          </p>
        </div>

        <button
          type="button"
          className="button"
          disabled={busy || selected === "new"}
          onClick={() => select("new")}
        >
          Add supplier
        </button>
      </div>

      <nav
        className="gd-supplier-menu"
        aria-label="Admin sections"
      >
        {[
          ["/admin", "Overview"],
          ["/admin/orders", "Orders"],
          ["/admin/products", "Products"],
          ["/admin/suppliers", "Suppliers"],
          ["/admin/customers", "Customers"],
          ["/admin/returns", "Returns"],
          ["/admin/support", "Support"],
        ].map(([to, label]) => (
          <NavLink key={to} to={to} end>
            {label}
          </NavLink>
        ))}
      </nav>

      <ol
        className="gd-supplier-steps"
        aria-label="Supplier setup steps"
      >
        <li>Save a draft</li>
        <li>Record your checks</li>
        <li>Activate supplier</li>
        <li>Link and publish products</li>
      </ol>

      {selected && (
        <SupplierEditor
          key={selected}
          id={selected}
          token={token}
          onClose={() => select("")}
          onCreated={(id) => select(id, true)}
          onChanged={list.reload}
          onDirty={setDirty}
          onBusy={setOperationBusy}
        />
      )}

      <section aria-labelledby="supplier-list-title">
        <div className="gd-supplier-heading">
          <h2 id="supplier-list-title">Supplier directory</h2>

          <button
            type="button"
            className="button secondary"
            disabled={list.loading || busy}
            onClick={list.reload}
          >
            Refresh list
          </button>
        </div>

        <form
          className="gd-supplier-filters"
          onSubmit={(event) => {
            event.preventDefault();

            query({
              search: searchText.trim(),
              page: 1,
            });
          }}
        >
          <label htmlFor="supplier-search">
            <span>Search suppliers</span>

            <input
              id="supplier-search"
              type="search"
              maxLength={150}
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="Business name, code or contact"
            />
          </label>

          <label htmlFor="supplier-filter-status">
            <span>Status</span>

            <select
              id="supplier-filter-status"
              value={status}
              onChange={(event) =>
                query({
                  status: event.target.value,
                  page: 1,
                })
              }
            >
              <option value="">All suppliers</option>

              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="button secondary"
          >
            Search
          </button>

          {(search || status) && (
            <button
              type="button"
              className="gd-supplier-text-button"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          )}
        </form>

        <ErrorNotice
          error={list.error}
          retry={list.reload}
        />

        {list.error?.status === 404 && (
          <p className="gd-supplier-warning">
            Start the updated backend with the supplier routes
            from the previous step, then retry.
          </p>
        )}

        {list.loading ? (
          <div className="gd-supplier-empty" role="status">
            Loading suppliers…
          </div>
        ) : (
          list.data && (
            <>
              <p className="gd-supplier-muted" role="status">
                {list.data.total}{" "}
                {list.data.total === 1
                  ? "supplier"
                  : "suppliers"}{" "}
                found
              </p>

              {list.data.suppliers.length ? (
                <div className="gd-supplier-grid">
                  {list.data.suppliers.map((supplier) => (
                    <article
                      className="gd-supplier-card"
                      key={supplier.id}
                    >
                      <div className="gd-supplier-heading">
                        <h3>{supplier.name}</h3>
                        <Badge status={supplier.status} />
                      </div>

                      <p className="gd-supplier-code">
                        {supplier.supplierCode ||
                          "Code not recorded"}
                      </p>

                      <p className="gd-supplier-muted">
                        {supplier.available === true
                          ? "Ready for product publication"
                          : supplier.unavailableReason ||
                            "Supplier setup needs review."}
                      </p>

                      <dl>
                        <div>
                          <dt>Contact</dt>
                          <dd>
                            {supplier.contact?.name ||
                              "Not recorded"}
                          </dd>
                        </div>

                        <div>
                          <dt>Preparation</dt>
                          <dd>{preparation(supplier)}</dd>
                        </div>

                        <div>
                          <dt>Verification</dt>
                          <dd>
                            {supplier.verification?.status ||
                              "pending"}
                          </dd>
                        </div>
                      </dl>

                      <div className="gd-supplier-contact">
                        {supplier.contact?.email && (
                          <a
                            href={`mailto:${supplier.contact.email}`}
                          >
                            {supplier.contact.email}
                          </a>
                        )}

                        {supplier.contact?.phone && (
                          <a
                            href={`tel:+${supplier.contact.phone}`}
                          >
                            +{supplier.contact.phone}
                          </a>
                        )}

                        {supplier.contact?.whatsapp && (
                          <a
                            href={`https://wa.me/${supplier.contact.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Supplier WhatsApp ↗
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        className="button secondary"
                        disabled={
                          busy || selected === supplier.id
                        }
                        onClick={() => select(supplier.id)}
                      >
                        {selected === supplier.id
                          ? "Editor open"
                          : "Manage supplier"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="gd-supplier-empty">
                  <h3>
                    {list.data.total
                      ? "No suppliers on this page"
                      : search || status
                        ? "No matching suppliers"
                        : "Add your first supplier"}
                  </h3>

                  <p>
                    {search || status
                      ? "Try another search or reset the filters."
                      : "New suppliers stay in draft until their details and verification are ready."}
                  </p>

                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={
                      search || status
                        ? resetFilters
                        : list.data.total
                          ? () => query({ page: 1 })
                          : () => select("new")
                    }
                  >
                    {search || status
                      ? "Reset filters"
                      : list.data.total
                        ? "Go to first page"
                        : "Add supplier"}
                  </button>
                </div>
              )}

              {list.data.pages > 1 && (
                <nav
                  className="gd-supplier-pagination"
                  aria-label="Supplier pages"
                >
                  <button
                    type="button"
                    className="button secondary"
                    disabled={page <= 1}
                    onClick={() => query({ page: page - 1 })}
                  >
                    Previous
                  </button>

                  <span>
                    Page {list.data.page} of {list.data.pages}
                  </span>

                  <button
                    type="button"
                    className="button secondary"
                    disabled={page >= list.data.pages}
                    onClick={() => query({ page: page + 1 })}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )
        )}
      </section>

      {discardTarget && (
        <Modal
          title="Discard unsaved supplier edits?"
          className="gd-supplier-dialog"
          onClose={() => setDiscardTarget(null)}
        >
          <p>
            Your unsaved edits will be discarded when you
            leave this supplier editor.
          </p>

          <div className="gd-supplier-actions">
            <button
              type="button"
              className="button"
              onClick={() => select(discardTarget.id, true)}
            >
              Discard and continue
            </button>

            <button
              type="button"
              className="button secondary"
              onClick={() => setDiscardTarget(null)}
            >
              Keep editing
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AdminSuppliersPage() {
  const {
    user,
    token,
    loading,
    authError,
  } = useAuth();

  if (loading) return <PageLoading />;

  if (authError) {
    return (
      <div className="page">
        <h1>Unable to check admin access</h1>
        <ErrorNotice error={new Error(authError)} />
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="page">
        <h1>Sign in to manage suppliers</h1>

        <Link
          className="button"
          to="/login?next=%2Fadmin%2Fsuppliers"
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

        <Link className="button secondary" to="/account">
          My account
        </Link>
      </div>
    );
  }

  return (
    <Suppliers
      key={`${user.id || user._id}:${token}`}
      token={token}
    />
  );
}