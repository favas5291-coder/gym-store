import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getSuppliers } from "../services/supplierApi.js";
import { getAdminProducts } from "../services/productApi.js";

import {
  getPackingLocations,
  getPackingLocation,
  savePackingLocation,
  confirmPackingLocation,
  confirmSupplierArrangement,
  confirmGymDrobeStockTransfer,
} from "../services/packingLocationApi.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

const address = () => ({
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
});

const contact = () => ({
  name: "",
  phone: "",
  email: "",
});

const blankTransfer = () => ({
  status: "pending",
  originName: "",
  originAddress: address(),
  originContact: contact(),
  productIds: [],
  transferDaysMin: null,
  transferDaysMax: null,
  arrangementReference: "",
});

const blank = () => ({
  name: "",
  operator: "gymdrobe",
  status: "draft",
  address: address(),
  contact: contact(),
  packing: {
    packingDaysMin: null,
    packingDaysMax: null,
  },
  delivery: {
    transitDaysMin: null,
    transitDaysMax: null,
  },
  acceptsGymDrobeStock: false,
  gymdrobeStockTransfer: null,
  supplierArrangements: [],
  notes: "",
});

const days = (value) => value === "" ? null : Number(value);

const validDays = (low, high) =>
  Number.isSafeInteger(low) &&
  Number.isSafeInteger(high) &&
  low >= 0 &&
  high >= low &&
  high <= 365;

const productId = (product) =>
  String(product?.id || product?._id || "");

function productIssue(product) {
  if (!/^[a-f0-9]{24}$/i.test(productId(product))) {
    return "Product ID is unavailable.";
  }

  if (product.isActive === false) {
    return "Product is archived.";
  }

  if (product.fulfillment?.stockSource !== "gymdrobe") {
    return "Stock is not configured as held by GymDrobe.";
  }

  if (product.fulfillment?.canSendToPackingLocation !== true) {
    return "Packing transfers are not enabled for this product.";
  }

  if (
    !validDays(
      product.fulfillment?.preparationDaysMin,
      product.fulfillment?.preparationDaysMax,
    )
  ) {
    return "Product preparation times are missing.";
  }

  return "";
}

function fields(value, keys) {
  return Object.fromEntries(
    keys.map((key) => [key, value?.[key] ?? ""]),
  );
}

function saveBody(draft, saved) {
  const transfer = draft.gymdrobeStockTransfer;

  return {
    name: draft.name,
    operator: draft.operator,

    // Edited active locations are saved while paused.
    status: saved?.status === "active"
      ? "paused"
      : draft.status,

    address: fields(
      draft.address,
      ["addressLine", "city", "state", "pincode"],
    ),

    contact: fields(
      draft.contact,
      ["name", "phone", "email"],
    ),

    packing: draft.packing,
    delivery: draft.delivery,
    acceptsGymDrobeStock: draft.acceptsGymDrobeStock,
    notes: draft.notes,

    supplierArrangements: draft.supplierArrangements.map(
      (row) => ({
        supplier: String(row.supplier),
        status: row.status,
        arrangementReference: row.arrangementReference,
        transferDaysMin: row.transferDaysMin,
        transferDaysMax: row.transferDaysMax,
      }),
    ),

    // Confirmation dates and admin IDs are server-controlled.
    gymdrobeStockTransfer: transfer
      ? {
          status: transfer.status,
          originName: transfer.originName,
          originAddress: fields(
            transfer.originAddress,
            ["addressLine", "city", "state", "pincode"],
          ),
          originContact: fields(
            transfer.originContact,
            ["name", "phone", "email"],
          ),
          productIds: transfer.productIds.map(String),
          transferDaysMin: transfer.transferDaysMin,
          transferDaysMax: transfer.transferDaysMax,
          arrangementReference: transfer.arrangementReference,
        }
      : null,
  };
}

function Field({ label, children }) {
  return (
    <label className="packing-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function date(value) {
  const parsed = value ? new Date(value) : null;

  return parsed && Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString("en-IN")
    : "Not confirmed";
}

function AddressFields({ value, onChange, prefix = "" }) {
  return (
    <div className="packing-grid">
      {[
        ["addressLine", "Address", 500],
        ["city", "City", 100],
        ["state", "State", 100],
        ["pincode", "Pincode", 6],
      ].map(([key, label, maximum]) => (
        <Field key={key} label={`${prefix}${label}`}>
          <input
            maxLength={maximum}
            value={value?.[key] || ""}
            inputMode={key === "pincode" ? "numeric" : undefined}
            pattern={
              key === "pincode"
                ? "[1-9][0-9]{5}"
                : undefined
            }
            onChange={(event) =>
              onChange({
                ...value,
                [key]: event.target.value,
              })
            }
          />
        </Field>
      ))}
    </div>
  );
}

function ContactFields({ value, onChange, prefix = "" }) {
  return (
    <div className="packing-grid">
      {[
        ["name", "Contact name", 100],
        ["phone", "Phone with country code", 40],
        ["email", "Contact email", 150],
      ].map(([key, label, maximum]) => (
        <Field key={key} label={`${prefix}${label}`}>
          <input
            maxLength={maximum}
            type={
              key === "email"
                ? "email"
                : key === "phone"
                  ? "tel"
                  : "text"
            }
            value={value?.[key] || ""}
            onChange={(event) =>
              onChange({
                ...value,
                [key]: event.target.value,
              })
            }
          />
        </Field>
      ))}
    </div>
  );
}

function DayFields({
  value,
  low,
  high,
  label,
  onChange,
}) {
  return (
    <div className="packing-grid">
      {[
        [low, "Minimum"],
        [high, "Maximum"],
      ].map(([key, word]) => (
        <Field key={key} label={`${word} ${label} days`}>
          <input
            type="number"
            min={0}
            max={365}
            step={1}
            value={value?.[key] ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                [key]: days(event.target.value),
              })
            }
          />
        </Field>
      ))}
    </div>
  );
}

export default function AdminPackingLocationsPage() {
  const { user, token, authError } = useAuth();

  if (
    !user ||
    user.role !== "admin" ||
    user.isActive === false ||
    authError ||
    !token
  ) {
    return (
      <div className="page">
        <p role="alert">
          An active admin session is required.
        </p>
      </div>
    );
  }

  return (
    <Locations
      key={`${user.id || user._id}:${token}`}
      token={token}
    />
  );
}

function Locations({ token }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");
    setList(null);

    getPackingLocations(token, {
      page,
      search: query,
      status,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setList(data);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, page, query, status, revision]);

  return (
    <div className="page gd-admin-page packing-admin">
      <div className="page-heading">
        <h1>Packing locations</h1>
        <Link to="/admin">Admin dashboard</Link>
      </div>

      <nav
        className="purchase-actions"
        aria-label="Related admin pages"
      >
        <Link to="/admin/kits">Fitness Kits</Link>
        <Link to="/admin/suppliers">Suppliers</Link>
        <Link to="/admin/products">Products</Link>
      </nav>

      <p>
        Configure a real packing location or fulfillment partner
        and the arrangements for bringing products there.
        Software does not combine parcels automatically.
      </p>

      {editor ? (
        <LocationEditor
          key={editor.id || "new"}
          token={token}
          initial={editor}
          onClose={() => {
            setEditor(null);
            setRevision((value) => value + 1);
          }}
        />
      ) : (
        <>
          <button
            type="button"
            className="button"
            onClick={() => setEditor(blank())}
          >
            Add packing location
          </button>

          <form
            className="packing-controls"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQuery(search.trim());
              setRevision((value) => value + 1);
            }}
          >
            <Field label="Search locations">
              <input
                type="search"
                maxLength={100}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>

            <Field label="Status">
              <select
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value);
                }}
              >
                <option value="">All statuses</option>
                {["draft", "active", "paused", "archived"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <button className="button secondary" type="submit">
              Search / reload
            </button>
          </form>

          {loading && (
            <p role="status">Loading packing locations…</p>
          )}

          {error && (
            <p role="alert" className="error-box">{error}</p>
          )}

          {list && (
            <>
              <p>{list.total} locations</p>

              <div className="packing-grid">
                {list.locations.map((location) => (
                  <article className="panel" key={location.id}>
                    <h2>{location.name}</h2>
                    <p>
                      {location.locationCode} · {location.status}
                    </p>
                    <p>
                      {location.address?.city || "Address incomplete"}
                    </p>
                    <p>
                      {location.ready
                        ? "Packing configuration complete"
                        : "Setup or reconfirmation needed"}
                    </p>

                    {location.readinessIssues.length > 0 && (
                      <ul>
                        {location.readinessIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    )}

                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setEditor(location)}
                    >
                      Manage location
                    </button>
                  </article>
                ))}
              </div>

              {!list.locations.length && (
                <p>
                  No locations found. Add a real location or
                  change the filters.
                </p>
              )}

              <nav
                className="packing-controls"
                aria-label="Packing-location pages"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>{list.page} / {list.pages}</span>
                <button
                  type="button"
                  disabled={page >= list.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </>
      )}

      <style>{`
        .packing-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: end;
          gap: 12px;
          margin: 20px 0;
        }

        .packing-field {
          display: grid;
          gap: 6px;
          margin: 12px 0;
          min-width: 0;
        }

        .packing-field input:not([type=checkbox]),
        .packing-field select,
        .packing-field textarea {
          width: 100%;
          min-height: 44px;
          padding: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
          box-sizing: border-box;
        }

        .packing-field textarea {
          min-height: 90px;
        }

        .packing-field input[type=checkbox] {
          width: 22px;
          height: 22px;
        }

        .packing-grid {
          display: grid;
          grid-template-columns:
            repeat(auto-fit, minmax(min(100%, 290px), 1fr));
          gap: 16px;
        }

        .packing-admin .panel {
          margin: 20px 0;
          padding: 20px;
        }

        .packing-admin button {
          min-height: 44px;
        }

        .packing-admin ul {
          padding-left: 22px;
        }

        .packing-admin .purchase-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .packing-admin :is(button,input,select,textarea,a):focus-visible {
          outline: 3px solid #c2410c;
          outline-offset: 3px;
        }

        .packing-product {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
          overflow-wrap: anywhere;
        }

        .packing-product p {
          margin: 8px 0;
        }

        .packing-selected {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
          overflow-wrap: anywhere;
        }

        .packing-selected span {
          min-width: 0;
          flex: 1;
        }

        .packing-admin fieldset {
          min-width: 0;
        }

        @media (max-width: 540px) {
          .packing-admin .panel {
            padding: 14px;
          }

          .packing-controls > .packing-field {
            flex: 1 1 100%;
          }

          .packing-product input {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}

function TransferProducts({ token, ids, onChange, onDenied }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState({});

  useEffect(() => {
    const abort = new AbortController();

    setLoading(true);
    setError("");
    setData(null);

    getAdminProducts(token, {
      page,
      limit: 12,
      search: query,
      active: true,
      signal: abort.signal,
    })
      .then((result) => {
        if (!abort.signal.aborted) {
          setData(result);
          setNames((previous) => ({
            ...previous,
            ...Object.fromEntries(
              result.products.map((product) => [
                productId(product),
                product.name,
              ]),
            ),
          }));
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setError(failure.message);

          if ([401, 403].includes(failure.status)) {
            onDenied();
          }
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) {
          setLoading(false);
        }
      });

    return () => abort.abort();
  }, [token, page, query, revision, onDenied]);

  return (
    <section aria-label="Products covered by the stock transfer">
      <h4>Products at this stock origin ({ids.length} / 500)</h4>

      <p>
        Select only products physically held at this pickup
        location. This route covers these products only.
        Selecting a product does not reserve or increase its stock.
      </p>

      {ids.map((id) => (
        <div className="packing-selected" key={id}>
          <span>
            <strong>{names[id] || "Selected product"}</strong>
            <br />
            <small>Product ID: {id}</small>
          </span>
          <button
            type="button"
            onClick={() =>
              onChange(ids.filter((value) => value !== id))
            }
          >
            Remove product
          </button>
        </div>
      ))}

      {!ids.length && <p>No products selected for this route.</p>}

      <div className="packing-controls">
        <Field label="Find an existing product">
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>

        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setPage(1);
            setQuery(search.trim());
            setRevision((value) => value + 1);
          }}
        >
          Search / reload products
        </button>

        <Link to="/admin/products">
          Manage product fulfillment settings
        </Link>
      </div>

      {loading && <p role="status">Loading products…</p>}
      {error && <p role="alert">{error}</p>}

      {data && (
        <>
          <p>
            {data.total} active products match this search.
            Products needing setup are shown with a reason.
          </p>

          <div className="packing-grid">
            {data.products.map((product) => {
              const id = productId(product);
              const issue = productIssue(product);
              const selected = ids.includes(id);

              return (
                <article
                  className="packing-product"
                  key={id || product.name}
                >
                  <h4>{product.name}</h4>
                  <p>
                    {product.brand || "Brand not recorded"}
                    {" · "}
                    {product.category || "Category not recorded"}
                  </p>
                  <small>Product ID: {id}</small>

                  <p>
                    {issue ||
                      "Configured for GymDrobe stock transfers. Confirm its physical stock origin before selecting."}
                  </p>

                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      selected ||
                      Boolean(issue) ||
                      ids.length >= 500
                    }
                    onClick={() =>
                      onChange([...new Set([...ids, id])])
                    }
                  >
                    {selected ? "Selected" : "Add to transfer route"}
                  </button>
                </article>
              );
            })}
          </div>

          {!data.products.length && (
            <p>
              No products match. Change the search or add
              products in admin.
            </p>
          )}

          <nav
            className="packing-controls"
            aria-label="Transfer product pages"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous products
            </button>

            <span>{data.page} / {data.pages}</span>

            <button
              type="button"
              disabled={page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next products
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

function LocationEditor({ token, initial, onClose }) {
  const [saved, setSaved] = useState(
    initial.id ? clone(initial) : null,
  );
  const [draft, setDraft] = useState(
    clone({ ...blank(), ...initial }),
  );

  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [agreement, setAgreement] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [transferAcknowledged, setTransferAcknowledged] =
    useState(false);

  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierRevision, setSupplierRevision] = useState(0);
  const [supplierData, setSupplierData] = useState(null);
  const [supplierError, setSupplierError] = useState("");

  const mounted = useRef(false);
  const lock = useRef(false);
  const controller = useRef(null);
  const form = useRef(null);

  // Stable callback avoids reloading products during form edits.
  const denyRef = useRef(() => setDenied(true));

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!dirty && !blocked) return;

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, blocked]);

  useEffect(() => {
    const abort = new AbortController();

    setSupplierData(null);
    setSupplierError("");

    getSuppliers(token, {
      page: supplierPage,
      limit: 12,
      search: supplierQuery,
      signal: abort.signal,
    })
      .then((data) => {
        if (!abort.signal.aborted) {
          setSupplierData(data);
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setSupplierError(failure.message);

          if ([401, 403].includes(failure.status)) {
            setDenied(true);
          }
        }
      });

    return () => abort.abort();
  }, [token, supplierPage, supplierQuery, supplierRevision]);

  function edit(change) {
    if (lock.current || blocked) return;

    setDraft((previous) => ({
      ...previous,
      ...(typeof change === "function"
        ? change(previous)
        : change),
    }));

    setDirty(true);
    setAcknowledged(false);
    setTransferAcknowledged(false);
    setNotice("");
  }

  function editTransfer(change) {
    edit((previous) => ({
      gymdrobeStockTransfer: {
        ...(previous.gymdrobeStockTransfer || blankTransfer()),
        ...change,
        status: change.status ?? "pending",
        confirmedAt: null,
        confirmedBy: null,
      },
    }));
  }

  function row(index, change) {
    edit((previous) => ({
      supplierArrangements: previous.supplierArrangements.map(
        (value, position) =>
          position === index
            ? {
                ...value,
                ...change,
                status: change.status ?? "pending",
              }
            : value,
      ),
    }));
  }

  async function run(action, item) {
    if (
      lock.current ||
      denied ||
      (blocked && action !== "reload")
    ) {
      return;
    }

    if (
      action !== "save" &&
      action !== "reload" &&
      (!saved || dirty)
    ) {
      return;
    }

    if (
      action === "reload" &&
      (
        !saved ||
        (
          dirty &&
          !window.confirm(
            "Discard unsaved changes and reload this location?",
          )
        )
      )
    ) {
      return;
    }

    if (
      action === "save" &&
      !form.current?.reportValidity()
    ) {
      return;
    }

    if (action === "stock" && !transferAcknowledged) return;

    if (
      action === "confirm" &&
      (!acknowledged || !agreement.trim())
    ) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    const abort = new AbortController();
    controller.current = abort;

    try {
      const options = { signal: abort.signal };
      let result;

      if (action === "save") {
        result = await savePackingLocation(
          token,
          saved,
          saveBody(draft, saved),
          options,
        );
      } else if (action === "reload") {
        result = await getPackingLocation(
          token,
          saved.id,
          options,
        );
      } else if (action === "confirm") {
        result = await confirmPackingLocation(
          token,
          saved,
          agreement.trim(),
          options,
        );
      } else if (action === "supplier") {
        result = await confirmSupplierArrangement(
          token,
          saved,
          item,
          options,
        );
      } else if (action === "stock") {
        result = await confirmGymDrobeStockTransfer(
          token,
          saved,
          options,
        );
      } else {
        result = await savePackingLocation(
          token,
          saved,
          { status: action },
          options,
        );
      }

      if (!mounted.current) return;

      setSaved(clone(result));
      setDraft(clone({ ...blank(), ...result }));
      setDirty(false);
      setBlocked(false);
      setAcknowledged(false);
      setTransferAcknowledged(false);
      setAgreement("");

      setNotice(
        action === "save"
          ? "Location saved. Check the saved setup issues before confirmation or activation."
          : action === "reload"
            ? "Latest location loaded."
            : action === "confirm"
              ? "Packing agreement recorded. Activation is a separate action."
              : action === "supplier"
                ? "Supplier agreement recorded."
                : action === "stock"
                  ? "GymDrobe stock transfer recorded for the selected products."
                  : `Location status: ${result.status}.`,
      );
    } catch (failure) {
      if (!mounted.current) return;

      setError(failure.message);

      if ([401, 403].includes(failure.status)) {
        setDenied(true);
      }

      if (
        failure.resultUnknown ||
        failure.status === 409 ||
        [401, 403].includes(failure.status)
      ) {
        setBlocked(true);
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  if (denied) {
    return (
      <section>
        <p role="alert">
          Your admin session is no longer authorized.
          Sign in again to continue.
        </p>
        <Link to="/login?next=%2Fadmin%2Fpacking-locations">
          Sign in
        </Link>
      </section>
    );
  }

  const disabled = busy || blocked;

  const operational =
    saved &&
    !dirty &&
    !disabled &&
    saved.status !== "archived";

  const transfer = draft.gymdrobeStockTransfer;

  const canConfirmTransfer =
    operational &&
    saved.acceptsGymDrobeStock &&
    saved.gymdrobeStockTransfer?.status === "pending" &&
    Boolean(saved.verification?.confirmedAt);

  return (
    <section>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => {
          if (
            (!dirty && !blocked) ||
            window.confirm(
              "Leave this editor? Unsaved changes will be discarded. Check the list for any uncertain save.",
            )
          ) {
            onClose();
          }
        }}
      >
        Back to locations
      </button>

      <h2>{saved ? saved.name : "New packing location"}</h2>

      {saved && (
        <p>
          {saved.locationCode} · {saved.status}
          {" · "}version {saved.version}
        </p>
      )}

      {error && (
        <p className="error-box" role="alert">{error}</p>
      )}
      {notice && <p role="status">{notice}</p>}

      {blocked && (
        <p className="notice">
          Reload before another write.{" "}
          {saved
            ? "Your previous request may have completed."
            : "Return to the list and check whether the location was created before adding it again."}
        </p>
      )}

      {saved && (
        <button
          type="button"
          disabled={busy}
          className="button secondary"
          onClick={() => run("reload")}
        >
          Reload saved location
        </button>
      )}

      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          run("save");
        }}
      >
        <fieldset
          disabled={disabled}
          style={{ border: 0, padding: 0 }}
        >
          <h3>Packing destination</h3>

          <Field label="Location name">
            <input
              required
              minLength={2}
              maxLength={200}
              value={draft.name}
              onChange={(event) =>
                edit({ name: event.target.value })
              }
            />
          </Field>

          <Field label="Operated by">
            <select
              value={draft.operator}
              onChange={(event) =>
                edit({ operator: event.target.value })
              }
            >
              <option value="gymdrobe">GymDrobe</option>
              <option value="fulfillment-partner">
                Fulfillment partner
              </option>
            </select>
          </Field>

          <AddressFields
            value={draft.address}
            onChange={(value) => edit({ address: value })}
          />

          <ContactFields
            value={draft.contact}
            onChange={(value) => edit({ contact: value })}
          />

          <DayFields
            value={draft.packing}
            low="packingDaysMin"
            high="packingDaysMax"
            label="packing"
            onChange={(value) => edit({ packing: value })}
          />

          <DayFields
            value={draft.delivery}
            low="transitDaysMin"
            high="transitDaysMax"
            label="courier transit"
            onChange={(value) => edit({ delivery: value })}
          />

          <p>
            Courier transit estimates do not confirm delivery
            coverage for a customer's pincode.
          </p>

          <Field label="This packing location can receive GymDrobe-held stock">
            <input
              type="checkbox"
              checked={draft.acceptsGymDrobeStock}
              onChange={(event) =>
                edit({
                  acceptsGymDrobeStock: event.target.checked,
                })
              }
            />
          </Field>

          <section
            className="panel"
            aria-label="GymDrobe stock transfer settings"
          >
            <h3>GymDrobe stock origin and transfer</h3>

            <p>
              Record where the selected products are physically
              held and how they will reach this packing destination.
              Leave the route unconfigured if the arrangement
              does not exist yet.
            </p>

            {!draft.acceptsGymDrobeStock && (
              <p>
                Enable receipt of GymDrobe stock above before
                confirming a transfer route.
              </p>
            )}

            {!transfer ? (
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  edit({
                    gymdrobeStockTransfer: blankTransfer(),
                  })
                }
              >
                Configure stock transfer
              </button>
            ) : (
              <>
                <p>
                  Transfer status: {transfer.status}
                  {" · "}{date(transfer.confirmedAt)}
                </p>

                <Field label="Stock origin name">
                  <input
                    maxLength={200}
                    value={transfer.originName || ""}
                    onChange={(event) =>
                      editTransfer({
                        originName: event.target.value,
                      })
                    }
                  />
                </Field>

                <AddressFields
                  prefix="Pickup "
                  value={transfer.originAddress}
                  onChange={(value) =>
                    editTransfer({ originAddress: value })
                  }
                />

                <ContactFields
                  prefix="Pickup "
                  value={transfer.originContact}
                  onChange={(value) =>
                    editTransfer({ originContact: value })
                  }
                />

                <DayFields
                  value={transfer}
                  low="transferDaysMin"
                  high="transferDaysMax"
                  label="stock transfer"
                  onChange={(value) =>
                    editTransfer({
                      transferDaysMin: value.transferDaysMin,
                      transferDaysMax: value.transferDaysMax,
                    })
                  }
                />

                <p>
                  Use zero days only when the recorded arrangement
                  actually supports same-day transfer, including
                  stock already at the packing location.
                </p>

                <Field label="Real stock-transfer arrangement reference">
                  <input
                    maxLength={200}
                    value={transfer.arrangementReference || ""}
                    onChange={(event) =>
                      editTransfer({
                        arrangementReference: event.target.value,
                      })
                    }
                  />
                </Field>

                <TransferProducts
                  token={token}
                  ids={transfer.productIds || []}
                  onChange={(productIds) =>
                    editTransfer({ productIds })
                  }
                  onDenied={denyRef.current}
                />

                <div className="purchase-actions">
                  <button
                    type="button"
                    disabled={transfer.status === "paused"}
                    onClick={() =>
                      editTransfer({ status: "paused" })
                    }
                  >
                    Pause transfer route
                  </button>

                  <button
                    type="button"
                    disabled={transfer.status === "pending"}
                    onClick={() =>
                      editTransfer({ status: "pending" })
                    }
                  >
                    Save route as pending
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remove this transfer route? Kits depending on it will need a replacement arrangement.",
                        )
                      ) {
                        edit({ gymdrobeStockTransfer: null });
                      }
                    }}
                  >
                    Remove transfer route
                  </button>
                </div>

                <p>
                  Save the form, confirm the packing agreement
                  below, then confirm this stock transfer.
                  Editing transfer details requires confirmation again.
                </p>
              </>
            )}
          </section>

          <Field label="Internal notes">
            <textarea
              maxLength={2000}
              value={draft.notes || ""}
              onChange={(event) =>
                edit({ notes: event.target.value })
              }
            />
          </Field>

          <h3>Suppliers sending products here</h3>

          <div className="packing-controls">
            <Field label="Find supplier">
              <input
                maxLength={100}
                value={supplierSearch}
                onChange={(event) =>
                  setSupplierSearch(event.target.value)
                }
              />
            </Field>

            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setSupplierPage(1);
                setSupplierQuery(supplierSearch.trim());
                setSupplierRevision((value) => value + 1);
              }}
            >
              Search / reload suppliers
            </button>

            <Link to="/admin/suppliers">Manage suppliers</Link>
          </div>

          {supplierError && (
            <p role="alert">{supplierError}</p>
          )}

          {!supplierData && !supplierError && (
            <p role="status">Loading suppliers…</p>
          )}

          {supplierData && (
            <>
              <div className="purchase-actions">
                {supplierData.suppliers.map((supplier) => (
                  <button
                    type="button"
                    className="button secondary"
                    key={supplier.id}
                    disabled={
                      draft.supplierArrangements.length >= 500 ||
                      draft.supplierArrangements.some(
                        (value) =>
                          String(value.supplier) === supplier.id,
                      )
                    }
                    onClick={() =>
                      edit((previous) => ({
                        supplierArrangements: [
                          ...previous.supplierArrangements,
                          {
                            supplier: supplier.id,
                            status: "pending",
                            arrangementReference: "",
                            transferDaysMin: null,
                            transferDaysMax: null,
                          },
                        ],
                      }))
                    }
                  >
                    Add {supplier.name} · {supplier.status}
                  </button>
                ))}
              </div>

              {!supplierData.suppliers.length && (
                <p>No suppliers match this search.</p>
              )}

              <nav
                className="packing-controls"
                aria-label="Supplier pages"
              >
                <button
                  type="button"
                  disabled={supplierPage <= 1}
                  onClick={() =>
                    setSupplierPage((value) => value - 1)
                  }
                >
                  Previous suppliers
                </button>
                <span>
                  {supplierData.page} / {supplierData.pages}
                </span>
                <button
                  type="button"
                  disabled={supplierPage >= supplierData.pages}
                  onClick={() =>
                    setSupplierPage((value) => value + 1)
                  }
                >
                  Next suppliers
                </button>
              </nav>
            </>
          )}

          {draft.supplierArrangements.map((value, index) => (
            <article className="panel" key={String(value.supplier)}>
              <h4>
                {supplierData?.suppliers.find(
                  (supplier) =>
                    supplier.id === String(value.supplier),
                )?.name || `Supplier ${value.supplier}`}
              </h4>

              <p>
                Agreement: {value.status}
                {" · "}{date(value.confirmedAt)}
              </p>

              <Field label="Supplier agreement reference">
                <input
                  maxLength={200}
                  value={value.arrangementReference || ""}
                  onChange={(event) =>
                    row(index, {
                      arrangementReference: event.target.value,
                    })
                  }
                />
              </Field>

              <DayFields
                value={value}
                low="transferDaysMin"
                high="transferDaysMax"
                label="supplier transfer"
                onChange={(times) =>
                  row(index, {
                    transferDaysMin: times.transferDaysMin,
                    transferDaysMax: times.transferDaysMax,
                  })
                }
              />

              <div className="purchase-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={
                    !operational ||
                    value.status !== "pending" ||
                    !value.arrangementReference?.trim() ||
                    !validDays(
                      value.transferDaysMin,
                      value.transferDaysMax,
                    )
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirm that this supplier has actually agreed to send products to this packing address within the recorded times?",
                      )
                    ) {
                      run("supplier", value);
                    }
                  }}
                >
                  Confirm actual supplier agreement
                </button>

                <button
                  type="button"
                  onClick={() =>
                    row(index, { status: "paused" })
                  }
                >
                  Pause agreement
                </button>

                <button
                  type="button"
                  onClick={() =>
                    edit((previous) => ({
                      supplierArrangements:
                        previous.supplierArrangements.filter(
                          (_, position) => position !== index,
                        ),
                    }))
                  }
                >
                  Remove agreement
                </button>
              </div>
            </article>
          ))}

          {saved?.status === "active" && dirty && (
            <p className="notice">
              Saving edited settings pauses this active location.
              Reconfirm changed operational details, then activate it.
            </p>
          )}

          <button
            type="submit"
            className="button"
            disabled={Boolean(saved) && !dirty}
          >
            Save {saved ? "changes" : "draft location"}
          </button>
        </fieldset>
      </form>

      {saved && (
        <section className="panel">
          <h3>Confirm and activate</h3>

          <p>
            Current packing confirmation:{" "}
            {date(saved.verification?.confirmedAt)}
          </p>

          {saved.verification?.arrangementReference && (
            <p>
              Reference: {saved.verification.arrangementReference}
            </p>
          )}

          {saved.readinessIssues?.length > 0 && (
            <ul>
              {saved.readinessIssues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          )}

          {dirty && (
            <p>
              Save your edits before confirming an agreement
              or changing status.
            </p>
          )}

          <Field label="Real packing agreement reference">
            <input
              disabled={!operational}
              maxLength={200}
              value={agreement}
              onChange={(event) => {
                setAgreement(event.target.value);
                setAcknowledged(false);
              }}
            />
          </Field>

          <Field label="I have checked this real location or partner and its recorded operating details">
            <input
              disabled={!operational}
              type="checkbox"
              checked={acknowledged}
              onChange={(event) =>
                setAcknowledged(event.target.checked)
              }
            />
          </Field>

          <button
            type="button"
            className="button secondary"
            disabled={
              !operational ||
              !acknowledged ||
              !agreement.trim()
            }
            onClick={() => run("confirm")}
          >
            Record packing confirmation
          </button>

          {(saved.acceptsGymDrobeStock ||
            saved.gymdrobeStockTransfer) && (
            <section aria-label="Confirm GymDrobe stock transfer">
              <h4>Saved GymDrobe stock transfer</h4>

              <p>
                {saved.gymdrobeStockTransfer?.status || "Not configured"}
                {" · "}
                {date(saved.gymdrobeStockTransfer?.confirmedAt)}
              </p>

              {saved.gymdrobeStockTransferIssues?.length > 0 && (
                <ul>
                  {saved.gymdrobeStockTransferIssues.map(
                    (issue, index) => (
                      <li key={index}>{issue}</li>
                    ),
                  )}
                </ul>
              )}

              {saved.gymdrobeStockTransferReady && (
                <p>
                  Transfer configuration is confirmed for the
                  selected products. Stock and customer delivery
                  are checked separately.
                </p>
              )}

              <Field label="I have verified the pickup location, selected products and actual transfer arrangement">
                <input
                  type="checkbox"
                  disabled={!canConfirmTransfer}
                  checked={transferAcknowledged}
                  onChange={(event) =>
                    setTransferAcknowledged(event.target.checked)
                  }
                />
              </Field>

              <button
                type="button"
                className="button secondary"
                disabled={
                  !canConfirmTransfer ||
                  !transferAcknowledged
                }
                onClick={() => run("stock")}
              >
                Confirm actual GymDrobe stock transfer
              </button>

              {!saved.verification?.confirmedAt && (
                <p>Record the packing confirmation first.</p>
              )}
            </section>
          )}

          <p>
            Activation makes the configured location available
            to kit setup. It does not enable payment or confirm
            delivery coverage and shipping charges.
          </p>

          <div className="purchase-actions">
            <button
              type="button"
              className="button"
              disabled={
                !operational ||
                saved.status === "active" ||
                saved.readinessIssues?.length > 0
              }
              onClick={() => run("active")}
            >
              Activate location
            </button>

            <button
              type="button"
              disabled={
                dirty ||
                disabled ||
                saved.status !== "active"
              }
              onClick={() => run("paused")}
            >
              Pause location
            </button>

            <button
              type="button"
              disabled={
                dirty ||
                disabled ||
                saved.status === "archived"
              }
              onClick={() => {
                if (
                  window.confirm(
                    "Archive this location? Kits using it will require a ready packing arrangement before purchase.",
                  )
                ) {
                  run("archived");
                }
              }}
            >
              Archive location
            </button>

            {saved.status === "archived" && (
              <button
                type="button"
                disabled={dirty || disabled}
                onClick={() => run("draft")}
              >
                Restore as draft
              </button>
            )}
          </div>
        </section>
      )}
    </section>
  );
}