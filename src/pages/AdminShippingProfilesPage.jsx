import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getAdminProducts } from "../services/productApi.js";
import { getSuppliers } from "../services/supplierApi.js";
import { getPackingLocations } from "../services/packingLocationApi.js";

import {
  getShippingProfiles,
  getShippingProfile,
  saveShippingProfile,
  confirmShippingProfile,
  rupeesToPaise,
  paiseToRupeesInput,
} from "../services/shippingProfileApi.js";

import { money } from "../utils/productPricing.js";

const STATES = ["draft", "active", "paused", "archived"];

const LIMITS = [
  ["maximumWeightGrams", "Maximum packed weight (grams)", 500000],
  ["maximumLengthMm", "Maximum parcel length (mm)", 10000],
  ["maximumWidthMm", "Maximum parcel width (mm)", 10000],
  ["maximumHeightMm", "Maximum parcel height (mm)", 10000],
  ["maximumUnits", "Maximum product units per parcel", 999],
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const blank = () => ({
  name: "",
  status: "draft",

  origin: {
    kind: "unconfigured",
    name: "",
    pickupPincode: "",
    packingLocation: null,
    supplier: null,
  },

  productIds: [],
  destinationPincodes: [],

  service: {
    carrier: "",
    name: "",
    deliveryMethod: "standard",
    supportsOnline: true,
    supportsCodAdvance: false,
    maximumCodBalancePaise: null,
    transitDaysMin: null,
    transitDaysMax: null,
  },

  parcelLimits: Object.fromEntries(
    LIMITS.map(([key]) => [key, null]),
  ),

  charges: {
    shippingPaise: null,
    codFeePaise: 0,
    courierCostPaise: null,
  },

  notes: "",
});

const amountsFor = (value) => ({
  shippingPaise: paiseToRupeesInput(value.charges.shippingPaise),
  codFeePaise: paiseToRupeesInput(value.charges.codFeePaise),
  courierCostPaise: paiseToRupeesInput(value.charges.courierCostPaise),
  maximumCodBalancePaise: paiseToRupeesInput(
    value.service.maximumCodBalancePaise,
  ),
});

const numberInput = (value) =>
  value === "" ? null : Number(value);

const identifier = (value) =>
  String(value?.id || value?._id || "");

const validDays = (low, high) =>
  Number.isSafeInteger(low) &&
  Number.isSafeInteger(high) &&
  low >= 0 &&
  high >= low &&
  high <= 365;

function formatDate(value) {
  const date = value ? new Date(value) : null;

  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString("en-IN")
    : "Not recorded";
}

function displayMoney(value) {
  return value == null ? "Not recorded" : money(value / 100);
}

function parsePincodes(value) {
  const rows = value.trim()
    ? value.trim().split(/[\s,;]+/)
    : [];

  if (rows.length > 10000) {
    throw new Error(
      "Destination pincodes: use at most 10,000 entries.",
    );
  }

  const invalid = rows.find(
    (pin) => !/^[1-9]\d{5}$/.test(pin),
  );

  if (invalid) {
    throw new Error(
      `Destination pincode ${invalid} is invalid. Use six digits, without a leading zero.`,
    );
  }

  if (new Set(rows).size !== rows.length) {
    throw new Error(
      "Destination pincodes: remove duplicate entries before saving.",
    );
  }

  return rows;
}

function amount(value, label) {
  try {
    return rupeesToPaise(value);
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

function saveBody(draft, saved, pinText, amounts) {
  return {
    name: draft.name,

    status: saved?.status === "active"
      ? "paused"
      : draft.status,

    origin: {
      kind: draft.origin.kind,
      name: draft.origin.name,
      pickupPincode: draft.origin.pickupPincode,
      packingLocation: draft.origin.packingLocation || null,
      supplier: draft.origin.supplier || null,
    },

    productIds: draft.productIds,
    destinationPincodes: parsePincodes(pinText),

    service: {
      carrier: draft.service.carrier,
      name: draft.service.name,
      deliveryMethod: draft.service.deliveryMethod,
      supportsOnline: draft.service.supportsOnline,
      supportsCodAdvance: draft.service.supportsCodAdvance,

      maximumCodBalancePaise: draft.service.supportsCodAdvance
        ? amount(
            amounts.maximumCodBalancePaise,
            "Maximum COD balance",
          )
        : null,

      transitDaysMin: draft.service.transitDaysMin,
      transitDaysMax: draft.service.transitDaysMax,
    },

    parcelLimits: Object.fromEntries(
      LIMITS.map(([key]) => [key, draft.parcelLimits[key]]),
    ),

    charges: {
      shippingPaise: amount(
        amounts.shippingPaise,
        "Customer shipping charge",
      ),

      codFeePaise: draft.service.supportsCodAdvance
        ? amount(amounts.codFeePaise, "COD fee") ?? 0
        : 0,

      courierCostPaise: amount(
        amounts.courierCostPaise,
        "Courier cost",
      ),
    },

    notes: draft.notes,
  };
}

function productIssue(product, origin) {
  if (!/^[a-f0-9]{24}$/i.test(identifier(product))) {
    return "Product ID is unavailable.";
  }

  if (
    product.isActive !== true ||
    product.delivery?.available !== true
  ) {
    return "Product is unavailable for delivery.";
  }

  const setup = product.fulfillment || {};

  if (
    !validDays(
      setup.preparationDaysMin,
      setup.preparationDaysMax,
    )
  ) {
    return "Record product preparation times first.";
  }

  if (origin.kind === "unconfigured") {
    return "Choose the dispatch origin first.";
  }

  if (origin.kind === "packing-location") {
    if (!origin.packingLocation) {
      return "Select a packing location first.";
    }

    if (
      setup.canSendToPackingLocation !== true ||
      !["gymdrobe", "supplier"].includes(setup.stockSource)
    ) {
      return "Configure the stock owner and packing-location transfers first.";
    }
  } else if (origin.kind === "supplier") {
    if (!origin.supplier) {
      return "Select a supplier first.";
    }

    if (
      String(product.supplier || "") !== String(origin.supplier) ||
      setup.stockSource !== "supplier" ||
      setup.dispatchBy !== "supplier" ||
      !setup.supplierStockConfirmedAt ||
      !Number.isFinite(Date.parse(setup.supplierStockConfirmedAt))
    ) {
      return "This product is not configured for this supplier's stock and direct dispatch.";
    }
  } else if (
    origin.kind === "gymdrobe" &&
    (
      setup.stockSource !== "gymdrobe" ||
      setup.dispatchBy !== "gymdrobe"
    )
  ) {
    return "Configure GymDrobe-held stock and direct dispatch first.";
  }

  return "";
}

function Field({ label, children }) {
  return (
    <label className="shipping-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AmountField({ label, value, onChange }) {
  return (
    <Field label={`${label} (INR)`}>
      <input
        type="text"
        inputMode="decimal"
        maxLength={10}
        pattern="[0-9]+([.][0-9]{1,2})?"
        value={value}
        placeholder="Unknown"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export default function AdminShippingProfilesPage() {
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
        <p role="alert">An active admin session is required.</p>
      </div>
    );
  }

  return (
    <Profiles
      key={`${user.id || user._id}:${token}`}
      token={token}
    />
  );
}

function Profiles({ token }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    const abort = new AbortController();

    setLoading(true);
    setData(null);
    setError("");

    getShippingProfiles(token, {
      page,
      search: query,
      status,
      signal: abort.signal,
    })
      .then((result) => {
        if (!abort.signal.aborted) setData(result);
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });

    return () => abort.abort();
  }, [token, page, query, status, revision]);

  return (
    <div className="page gd-admin-page shipping-admin">
      <div className="page-heading">
        <h1>Shipping profiles</h1>
        {!editor && <Link to="/admin">Admin dashboard</Link>}
      </div>

      {!editor && (
        <nav
          className="purchase-actions"
          aria-label="Related admin pages"
        >
          <Link to="/admin/packing-locations">Packing locations</Link>
          <Link to="/admin/suppliers">Suppliers</Link>
          <Link to="/admin/products">Products</Link>
        </nav>
      )}

      <p>
        Record real courier coverage and rates for a specific
        dispatch origin and product list. An active profile still
        requires matching parcel contents and measurements before
        it can price an order.
      </p>

      {editor ? (
        <ProfileEditor
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
            Add shipping profile
          </button>

          <form
            className="shipping-controls"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQuery(search.trim());
              setRevision((value) => value + 1);
            }}
          >
            <Field label="Search profiles">
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
                {STATES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </Field>

            <button type="submit" className="button secondary">
              Search / reload
            </button>
          </form>

          {loading && <p role="status">Loading shipping profiles…</p>}
          {error && <p role="alert" className="error-box">{error}</p>}

          {data && (
            <>
              <p>{data.total} shipping profiles</p>

              <div className="shipping-grid">
                {data.profiles.map((profile) => (
                  <article className="panel" key={profile.id}>
                    <h2>{profile.name}</h2>
                    <p>{profile.profileCode} · {profile.status}</p>
                    <p>{profile.origin.name || "Origin not configured"}</p>
                    <p>
                      {profile.service.carrier || "Courier not recorded"}
                      {" · "}{profile.service.deliveryMethod}
                    </p>
                    <p>
                      Shipping:{" "}
                      <strong>
                        {displayMoney(profile.charges.shippingPaise)}
                      </strong>
                      {profile.service.supportsCodAdvance && (
                        <>
                          {" · "}COD fee:{" "}
                          {displayMoney(profile.charges.codFeePaise)}
                        </>
                      )}
                    </p>
                    <p>
                      {profile.productIds.length} products ·{" "}
                      {profile.destinationPincodes.length} destination pincodes
                    </p>
                    <p>
                      Agreement expiry:{" "}
                      {formatDate(profile.verification.validUntil)}
                    </p>
                    <p>
                      {profile.ready
                        ? "Active with complete recorded terms"
                        : "Setup, confirmation or activation needed"}
                    </p>

                    {profile.readinessIssues.length > 0 && (
                      <ul>
                        {profile.readinessIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    )}

                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setEditor(profile)}
                    >
                      Manage profile
                    </button>
                  </article>
                ))}
              </div>

              {!data.profiles.length && (
                <p>
                  No shipping profiles found. Add a draft or change
                  your filters.
                </p>
              )}

              <nav
                className="shipping-controls"
                aria-label="Shipping profile pages"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>{data.page} / {data.pages}</span>
                <button
                  type="button"
                  disabled={page >= data.pages}
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
        .shipping-controls {
          display:flex;
          flex-wrap:wrap;
          align-items:end;
          gap:12px;
          margin:20px 0;
        }
        .shipping-field {
          display:grid;
          gap:6px;
          margin:12px 0;
          min-width:0;
        }
        .shipping-field :is(input:not([type=checkbox]),select,textarea) {
          width:100%;
          min-height:44px;
          padding:10px;
          border:1px solid #cbd5e1;
          border-radius:6px;
          font:inherit;
          box-sizing:border-box;
        }
        .shipping-field textarea { min-height:130px; }
        .shipping-field input[type=checkbox] { width:22px;height:22px; }
        .shipping-grid {
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(min(100%,280px),1fr));
          gap:16px;
        }
        .shipping-admin .panel {
          margin:20px 0;
          padding:20px;
          overflow-wrap:anywhere;
        }
        .shipping-admin fieldset {
          min-width:0;
          border:0;
          padding:0;
        }
        .shipping-admin button { min-height:44px; }
        .shipping-admin ul { padding-left:22px; }
        .shipping-admin .purchase-actions {
          display:flex;
          flex-wrap:wrap;
          gap:12px;
        }
        .shipping-admin :is(button,input,textarea,select,a):focus-visible {
          outline:3px solid #c2410c;
          outline-offset:3px;
        }
        .shipping-selection {
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:12px 0;
          border-bottom:1px solid #e2e8f0;
          overflow-wrap:anywhere;
        }
        .shipping-selection span { min-width:0;flex:1; }
        .shipping-option {
          border:1px solid #e2e8f0;
          border-radius:8px;
          padding:14px;
          overflow-wrap:anywhere;
        }
        @media(max-width:540px) {
          .shipping-admin .panel { padding:14px; }
          .shipping-controls > .shipping-field { flex:1 1 100%; }
          .shipping-field :is(input,select,textarea) { font-size:16px; }
        }
      `}</style>
    </div>
  );
}

function OriginPicker({ token, origin, onSelect, onDenied }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const packing = origin.kind === "packing-location";

  useEffect(() => {
    const abort = new AbortController();

    setLoading(true);
    setData(null);
    setError("");

    const pending = packing
      ? getPackingLocations(token, {
          page,
          search: query,
          status: "active",
          signal: abort.signal,
        })
      : getSuppliers(token, {
          page,
          limit: 12,
          search: query,
          status: "active",
          signal: abort.signal,
        });

    pending
      .then((result) => {
        if (!abort.signal.aborted) setData(result);
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setError(failure.message);
          if ([401, 403].includes(failure.status)) onDenied();
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });

    return () => abort.abort();
  }, [token, packing, page, query, revision, onDenied]);

  const rows = data
    ? packing ? data.locations : data.suppliers
    : [];

  const selected = packing
    ? origin.packingLocation
    : origin.supplier;

  return (
    <section aria-label="Choose dispatch origin">
      {selected && (
        <p>Selected origin: {origin.name} · ID {selected}</p>
      )}

      <div className="shipping-controls">
        <Field
          label={
            packing
              ? "Find an active packing location"
              : "Find an active supplier"
          }
        >
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
          Search / reload origins
        </button>
      </div>

      {loading && <p role="status">Loading dispatch origins…</p>}
      {error && <p role="alert">{error}</p>}

      {data && (
        <>
          <div className="shipping-grid">
            {rows.map((row) => (
              <article className="shipping-option" key={row.id}>
                <h4>{row.name}</h4>
                <p>
                  {packing
                    ? row.address?.city || "City not recorded"
                    : "Supplier dispatch must be verified before confirmation."}
                </p>
                <button
                  type="button"
                  className="button secondary"
                  disabled={selected === row.id}
                  onClick={() =>
                    onSelect({
                      kind: origin.kind,
                      name: row.name,
                      pickupPincode: packing
                        ? row.address?.pincode || ""
                        : selected === row.id
                          ? origin.pickupPincode
                          : "",
                      packingLocation: packing ? row.id : null,
                      supplier: packing ? null : row.id,
                    })
                  }
                >
                  {selected === row.id ? "Selected" : "Use this origin"}
                </button>
              </article>
            ))}
          </div>

          {!rows.length && (
            <p>
              No active origins match. Configure a supplier or
              packing location first.
            </p>
          )}

          <nav
            className="shipping-controls"
            aria-label="Dispatch origin pages"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous origins
            </button>
            <span>{data.page} / {data.pages}</span>
            <button
              type="button"
              disabled={page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next origins
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

function ProductPicker({ token, origin, ids, onChange, onDenied }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState({});

  useEffect(() => {
    const abort = new AbortController();

    setLoading(true);
    setData(null);
    setError("");

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
                identifier(product),
                product.name,
              ]),
            ),
          }));
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setError(failure.message);
          if ([401, 403].includes(failure.status)) onDenied();
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });

    return () => abort.abort();
  }, [token, page, query, revision, onDenied]);

  return (
    <section aria-label="Products covered by the shipping profile">
      <h3>Covered products ({ids.length} / 500)</h3>
      <p>
        Select actual products dispatched from this origin.
        Changing the origin may make previously selected products
        ineligible; review the list before confirming.
      </p>

      {ids.map((id) => (
        <div className="shipping-selection" key={id}>
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

      {!ids.length && <p>No products selected.</p>}

      <div className="shipping-controls">
        <Field label="Find a product by name, brand or SKU">
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
      </div>

      {loading && <p role="status">Loading products…</p>}
      {error && <p role="alert">{error}</p>}

      {data && (
        <>
          <p>
            {data.total} active products match. Products needing
            setup show a reason.
          </p>

          <div className="shipping-grid">
            {data.products.map((product) => {
              const id = identifier(product);
              const issue = productIssue(product, origin);
              const selected = ids.includes(id);

              return (
                <article
                  className="shipping-option"
                  key={id || product.name}
                >
                  <h4>{product.name}</h4>
                  <p>
                    {product.brand || "Brand not recorded"}
                    {" · "}
                    {product.category || "Category not recorded"}
                  </p>
                  <small>ID: {id}</small>
                  <p>
                    {issue ||
                      "Configured for this origin type. Verify the physical dispatch location before selecting."}
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
                    {selected ? "Selected" : "Add product"}
                  </button>
                </article>
              );
            })}
          </div>

          {!data.products.length && <p>No products match. Change your search.</p>}

          <nav
            className="shipping-controls"
            aria-label="Covered product pages"
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

function ProfileEditor({ token, initial, onClose }) {
  const [saved, setSaved] = useState(
    initial.id ? clone(initial) : null,
  );
  const [draft, setDraft] = useState(clone(initial));
  const [pinText, setPinText] = useState(
    initial.destinationPincodes.join("\n"),
  );
  const [amounts, setAmounts] = useState(() => amountsFor(initial));

  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [agreement, setAgreement] = useState("");
  const [expiry, setExpiry] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const mounted = useRef(false);
  const lock = useRef(false);
  const controller = useRef(null);
  const form = useRef(null);
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

  function markDirty() {
    setDirty(true);
    setAcknowledged(false);
    setNotice("");
  }

  function edit(change) {
    if (lock.current || blocked) return;

    setDraft((previous) => ({
      ...previous,
      ...(typeof change === "function"
        ? change(previous)
        : change),
    }));

    markDirty();
  }

  function editAmount(key, value) {
    if (lock.current || blocked) return;

    setAmounts((previous) => ({
      ...previous,
      [key]: value,
    }));

    markDirty();
  }

  async function run(action) {
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
            "Discard unsaved changes and reload this shipping profile?",
          )
        )
      )
    ) {
      return;
    }

    if (action === "save" && !form.current?.reportValidity()) {
      return;
    }

    if (
      action === "confirm" &&
      (!acknowledged || !agreement.trim() || !expiry)
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
        result = await saveShippingProfile(
          token,
          saved,
          saveBody(draft, saved, pinText, amounts),
          options,
        );
      } else if (action === "reload") {
        result = await getShippingProfile(
          token,
          saved.id,
          options,
        );
      } else if (action === "confirm") {
        const date = new Date(expiry);

        if (
          !Number.isFinite(date.getTime()) ||
          date.getTime() <= Date.now()
        ) {
          throw new Error(
            "Choose a valid future courier agreement expiry.",
          );
        }

        result = await confirmShippingProfile(
          token,
          saved,
          {
            arrangementReference: agreement.trim(),
            validUntil: date.toISOString(),
          },
          options,
        );
      } else {
        result = await saveShippingProfile(
          token,
          saved,
          { status: action },
          options,
        );
      }

      if (!mounted.current) return;

      setSaved(clone(result));
      setDraft(clone(result));
      setPinText(result.destinationPincodes.join("\n"));
      setAmounts(amountsFor(result));
      setDirty(false);
      setBlocked(false);
      setAcknowledged(false);
      setAgreement("");
      setExpiry("");

      setNotice(
        action === "save"
          ? "Profile saved. Review its setup issues before confirming courier terms."
          : action === "reload"
            ? "Latest shipping profile loaded."
            : action === "confirm"
              ? "Courier terms confirmed. Activate the profile separately."
              : `Profile status: ${result.status}.`,
      );
    } catch (failure) {
      if (!mounted.current) return;

      setError(failure.message);

      if ([401, 403].includes(failure.status)) setDenied(true);

      if (
        failure.resultUnknown ||
        failure.status === 409 ||
        [401, 403].includes(failure.status)
      ) {
        setBlocked(true);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (denied) {
    return (
      <section>
        <p role="alert">
          Your admin session is no longer authorized.
          Sign in again to continue.
        </p>
        <Link to="/login?next=%2Fadmin%2Fshipping-profiles">
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

  const confirmable =
    operational &&
    ["draft", "paused"].includes(saved.status);

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
        Back to shipping profiles
      </button>

      <h2>{saved ? saved.name : "New shipping profile"}</h2>

      {saved && (
        <p>
          {saved.profileCode} · {saved.status}
          {" · "}version {saved.version}
        </p>
      )}

      {error && <p role="alert" className="error-box">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {blocked && (
        <p className="notice">
          Reload before another write.{" "}
          {saved
            ? "The last request may already have completed."
            : "Return to the list and check whether the profile was created before adding it again."}
        </p>
      )}

      {saved && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => run("reload")}
        >
          Reload saved profile
        </button>
      )}

      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          run("save");
        }}
      >
        <fieldset disabled={disabled}>
          <Field label="Profile name">
            <input
              required
              minLength={2}
              maxLength={200}
              value={draft.name}
              onChange={(event) => edit({ name: event.target.value })}
            />
          </Field>

          <section className="panel">
            <h3>1. Dispatch origin</h3>

            <Field label="Origin type">
              <select
                value={draft.origin.kind}
                onChange={(event) =>
                  edit({
                    origin: {
                      kind: event.target.value,
                      name: "",
                      pickupPincode: "",
                      packingLocation: null,
                      supplier: null,
                    },
                  })
                }
              >
                <option value="unconfigured">Choose an origin</option>
                <option value="packing-location">
                  Confirmed packing location
                </option>
                <option value="supplier">Supplier direct dispatch</option>
                <option value="gymdrobe">GymDrobe direct dispatch</option>
              </select>
            </Field>

            {["packing-location", "supplier"].includes(
              draft.origin.kind,
            ) && (
              <OriginPicker
                key={draft.origin.kind}
                token={token}
                origin={draft.origin}
                onSelect={(origin) => edit({ origin })}
                onDenied={denyRef.current}
              />
            )}

            <div className="shipping-grid">
              <Field label="Actual dispatch origin name">
                <input
                  maxLength={200}
                  value={draft.origin.name}
                  onChange={(event) =>
                    edit((previous) => ({
                      origin: {
                        ...previous.origin,
                        name: event.target.value,
                      },
                    }))
                  }
                />
              </Field>

              <Field label="Actual pickup pincode">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[1-9][0-9]{5}"
                  value={draft.origin.pickupPincode}
                  onChange={(event) =>
                    edit((previous) => ({
                      origin: {
                        ...previous.origin,
                        pickupPincode: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </div>

            <p>
              For a packing location, the pickup pincode must match
              its saved address. For supplier or GymDrobe dispatch,
              verify the actual pickup location with the courier.
            </p>

            <div className="purchase-actions">
              <Link
                target="_blank"
                rel="noreferrer"
                to="/admin/packing-locations"
              >
                Manage packing locations in a new tab
              </Link>
              <Link
                target="_blank"
                rel="noreferrer"
                to="/admin/suppliers"
              >
                Manage suppliers in a new tab
              </Link>
            </div>
          </section>

          <section className="panel">
            <ProductPicker
              token={token}
              origin={draft.origin}
              ids={draft.productIds}
              onChange={(productIds) => edit({ productIds })}
              onDenied={denyRef.current}
            />
            <Link
              target="_blank"
              rel="noreferrer"
              to="/admin/products"
            >
              Manage products in a new tab
            </Link>
          </section>

          <section className="panel">
            <h3>2. Destination coverage</h3>
            <Field label="Exact destination pincodes">
              <textarea
                maxLength={90000}
                rows={7}
                value={pinText}
                placeholder="Enter courier-confirmed pincodes, one per line"
                onChange={(event) => {
                  if (lock.current || blocked) return;
                  setPinText(event.target.value);
                  markDirty();
                }}
              />
            </Field>
            <p>
              Separate pincodes with new lines, spaces or commas.
              Up to 10,000 distinct pincodes. List only locations
              confirmed for this origin and service; a valid-looking
              pincode does not prove courier coverage.
            </p>
          </section>

          <section className="panel">
            <h3>3. Courier service</h3>

            <div className="shipping-grid">
              <Field label="Courier name">
                <input
                  maxLength={100}
                  value={draft.service.carrier}
                  onChange={(event) =>
                    edit((previous) => ({
                      service: {
                        ...previous.service,
                        carrier: event.target.value,
                      },
                    }))
                  }
                />
              </Field>

              <Field label="Courier service name">
                <input
                  maxLength={150}
                  value={draft.service.name}
                  onChange={(event) =>
                    edit((previous) => ({
                      service: {
                        ...previous.service,
                        name: event.target.value,
                      },
                    }))
                  }
                />
              </Field>

              <Field label="Delivery method">
                <select
                  value={draft.service.deliveryMethod}
                  onChange={(event) =>
                    edit((previous) => ({
                      service: {
                        ...previous.service,
                        deliveryMethod: event.target.value,
                      },
                    }))
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                </select>
              </Field>

              {[
                ["transitDaysMin", "Minimum courier transit days"],
                ["transitDaysMax", "Maximum courier transit days"],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    step={1}
                    value={draft.service[key] ?? ""}
                    onChange={(event) =>
                      edit((previous) => ({
                        service: {
                          ...previous.service,
                          [key]: numberInput(event.target.value),
                        },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>

            <Field label="Supports full online payment">
              <input
                type="checkbox"
                checked={draft.service.supportsOnline}
                onChange={(event) =>
                  edit((previous) => ({
                    service: {
                      ...previous.service,
                      supportsOnline: event.target.checked,
                    },
                  }))
                }
              />
            </Field>

            <Field label="Supports collecting the remaining COD balance after an online advance">
              <input
                type="checkbox"
                checked={draft.service.supportsCodAdvance}
                onChange={(event) => {
                  const enabled = event.target.checked;

                  edit((previous) => ({
                    service: {
                      ...previous.service,
                      supportsCodAdvance: enabled,
                    },
                  }));

                  if (!enabled) {
                    setAmounts((previous) => ({
                      ...previous,
                      codFeePaise: "0.00",
                      maximumCodBalancePaise: "",
                    }));
                  }
                }}
              />
            </Field>

            {draft.service.supportsCodAdvance && (
              <AmountField
                label="Maximum balance the courier can collect on delivery"
                value={amounts.maximumCodBalancePaise}
                onChange={(value) =>
                  editAmount("maximumCodBalancePaise", value)
                }
              />
            )}
          </section>

          <section className="panel">
            <h3>4. Parcel limits for this rate</h3>
            <p>
              Enter limits from the real courier agreement.
              These limits do not prove that a customized kit fits
              in one parcel; packed weight and dimensions must
              be checked separately.
            </p>

            <div className="shipping-grid">
              {LIMITS.map(([key, label, maximum]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    min={1}
                    max={maximum}
                    step={1}
                    value={draft.parcelLimits[key] ?? ""}
                    onChange={(event) =>
                      edit((previous) => ({
                        parcelLimits: {
                          ...previous.parcelLimits,
                          [key]: numberInput(event.target.value),
                        },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>5. Charges per qualifying parcel</h3>
            <p>
              Enter rupee amounts without commas or currency symbols.
              Customer charges must include all applicable fees and
              taxes. Leave unknown amounts blank; enter 0 only for an
              agreed zero charge.
            </p>

            <div className="shipping-grid">
              <AmountField
                label="Complete customer shipping charge"
                value={amounts.shippingPaise}
                onChange={(value) => editAmount("shippingPaise", value)}
              />

              {draft.service.supportsCodAdvance && (
                <AmountField
                  label="Additional COD collection fee"
                  value={amounts.codFeePaise}
                  onChange={(value) => editAmount("codFeePaise", value)}
                />
              )}

              <AmountField
                label="Actual courier cost, optional"
                value={amounts.courierCostPaise}
                onChange={(value) =>
                  editAmount("courierCostPaise", value)
                }
              />
            </div>

            <p>
              Unknown courier cost stays unknown when reporting
              margins. Payment collection must later be allocated
              across shipments without charging the balance twice.
            </p>
          </section>

          <Field label="Internal notes">
            <textarea
              maxLength={2000}
              value={draft.notes}
              onChange={(event) => edit({ notes: event.target.value })}
            />
          </Field>

          {saved?.status === "active" && dirty && (
            <p className="notice">
              Saving this form pauses the active profile.
              Changed courier terms require confirmation again
              before activation.
            </p>
          )}

          <button
            type="submit"
            className="button"
            disabled={Boolean(saved) && !dirty}
          >
            Save {saved ? "changes" : "draft profile"}
          </button>
        </fieldset>
      </form>

      {saved && (
        <section className="panel">
          <h3>6. Confirm and activate</h3>
          <p>Confirmed: {formatDate(saved.verification.confirmedAt)}</p>
          <p>Agreement expiry: {formatDate(saved.verification.validUntil)}</p>

          {saved.verification.arrangementReference && (
            <p>Reference: {saved.verification.arrangementReference}</p>
          )}

          {saved.readinessIssues.length > 0 && (
            <ul>
              {saved.readinessIssues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          )}

          {dirty && (
            <p>Save your edits before confirmation or status changes.</p>
          )}

          <Field label="Actual courier coverage and rate agreement reference">
            <input
              disabled={!confirmable}
              maxLength={200}
              value={agreement}
              onChange={(event) => {
                setAgreement(event.target.value);
                setAcknowledged(false);
              }}
            />
          </Field>

          <Field label="Agreement expiry date and time">
            <input
              disabled={!confirmable}
              type="datetime-local"
              value={expiry}
              onChange={(event) => {
                setExpiry(event.target.value);
                setAcknowledged(false);
              }}
            />
          </Field>

          <p>The expiry uses your device's local time.</p>

          <Field label="I have verified this courier's actual origin, covered products, pincodes, payment support, parcel limits and complete charges">
            <input
              disabled={!confirmable}
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
          </Field>

          <div className="purchase-actions">
            <button
              type="button"
              className="button secondary"
              disabled={
                !confirmable ||
                !acknowledged ||
                !agreement.trim() ||
                !expiry
              }
              onClick={() => run("confirm")}
            >
              Confirm actual courier terms
            </button>

            <button
              type="button"
              className="button"
              disabled={
                !operational ||
                saved.status === "active" ||
                saved.readinessIssues.length > 0
              }
              onClick={() => run("active")}
            >
              Activate profile
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
              Pause profile
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
                    "Archive this profile? Future shipping quotes must use another valid arrangement.",
                  )
                ) {
                  run("archived");
                }
              }}
            >
              Archive profile
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

          <p>
            Activation records usable courier terms. Kit checkout
            still needs confirmed package details and a matching
            shipping quote before payment.
          </p>
        </section>
      )}
    </section>
  );
}