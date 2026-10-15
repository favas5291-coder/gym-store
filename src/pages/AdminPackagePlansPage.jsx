import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getAdminProducts, getAdminProductById } from "../services/productApi.js";
import { getSuppliers } from "../services/supplierApi.js";
import { getPackingLocations } from "../services/packingLocationApi.js";
import { getVariantStock } from "../utils/cartUtils.js";
import {
  MEASUREMENTS, packagePlanBody, packageAllocationIssues,
  getPackagePlans, getPackagePlan, savePackagePlan, confirmPackagePlan,
} from "../services/packagePlanApi.js";
import "./AdminDashboardPage.css";
import "./AdminPackagePlansPage.css";

const idOf = row => String(row?.id || row?._id || "");
const clone = value => structuredClone(value);
const numberInput = value => value === "" ? null : Number(value);
const newKey = prefix => `${prefix}-${crypto.randomUUID()}`;
const blank = () => ({name: "", status: "draft", origin: {kind: "unconfigured", name: "", pickupPincode: "", supplier: null, packingLocation: null}, components: [], parcels: [], notes: ""});
const dateLabel = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-IN") : "Not recorded";

function Pagination({data, page, setPage}) {
  return data?.pages > 1 && <nav className="gd-admin-pagination" aria-label="Result pages">
    <button type="button" className="gd-admin-action" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
    <span>{data.page} / {data.pages}</span>
    <button type="button" className="gd-admin-action" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
  </nav>;
}

export default function AdminPackagePlansPage() {
  const {user, token, loading, authError} = useAuth();
  if (loading) return <div className="page" role="status">Checking admin access…</div>;
  if (authError || !token || user?.role !== "admin" || user.isActive === false) return <div className="page"><p role="alert">{authError || "An active admin session is required."}</p><Link to="/login?next=%2Fadmin%2Fpackage-plans">Sign in again</Link></div>;
  return <Plans key={`${idOf(user)}:${token}`} token={token} />;
}

function Plans({token}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setData(null); setError("");
    if (denied) {setLoading(false); return;}
    getPackagePlans(token, {page, search: query, status, signal: abort.signal})
      .then(result => {if (!abort.signal.aborted) setData(result);})
      .catch(failure => {if (!abort.signal.aborted) {setError(failure.message); if ([401, 403].includes(failure.status)) onDenied();}})
      .finally(() => {if (!abort.signal.aborted) setLoading(false);});
    return () => abort.abort();
  }, [token, page, query, status, revision, denied, onDenied]);

  if (denied) return <div className="page"><p role="alert">Your admin session could not be verified. Sign in again before managing package plans.</p><Link to="/login?next=%2Fadmin%2Fpackage-plans">Sign in</Link></div>;
  return <div className="page gd-admin-page gd-package-page">
    <div className="gd-admin-heading"><div><p className="eyebrow">GYMDROBE ADMIN</p><h1>Package plans</h1><p className="gd-admin-muted">Record what goes into each measured parcel before confirming checkout delivery charges.</p></div><button type="button" className="button" disabled={Boolean(editor)} onClick={() => setEditor({record: null, key: newKey("new")})}>New package plan</button></div>
    <nav className="gd-admin-menu" aria-label="Related admin pages"><Link to="/admin">Dashboard</Link><Link to="/admin/kits">Fitness Kits</Link><Link to="/admin/products">Products</Link><Link to="/admin/packing-locations">Packing locations</Link><Link to="/admin/shipping-profiles">Shipping profiles</Link></nav>
    <p className="gd-admin-test">Use real sealed parcel measurements, including packaging. A single-package kit needs one parcel containing all selected units. Customizations need a matching plan. These plans support delivery review; kit payment integration is still pending.</p>
    {editor && <Editor key={editor.key} token={token} initial={editor.record} onDenied={onDenied} onSaved={() => setRevision(value => value + 1)} onClose={() => setEditor(null)} />}
    <section className="gd-admin-panel">
      <h2>Saved plans</h2>
      <form className="gd-admin-filters" onSubmit={event => {event.preventDefault(); setQuery(search.trim()); setPage(1); setRevision(value => value + 1);}}>
        <label>Search<input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Plan name or code" /></label>
        <label>Status<select value={status} onChange={event => {setStatus(event.target.value); setPage(1);}}><option value="">All statuses</option>{["draft", "active", "paused", "archived"].map(value => <option key={value}>{value}</option>)}</select></label>
        <button type="submit" className="button secondary">Search / reload</button>
      </form>
      {loading && <p role="status">Loading package plans…</p>}
      {error && <p className="gd-admin-alert" role="alert">{error}</p>}
      {data && !data.plans.length && <p>No plans found. Create a draft or reset your search.</p>}
      {data?.plans.map(plan => <article className="gd-package-card" key={plan.id}>
        <div className="gd-admin-heading"><div><h3>{plan.name}</h3><p>{plan.planCode} · {plan.status} · {plan.packageCount} parcel(s)</p><p className="gd-admin-muted">{plan.origin.name || "Origin not configured"} · Review expires: {dateLabel(plan.verification.validUntil)}</p></div><button type="button" className="gd-admin-action" disabled={Boolean(editor)} onClick={() => setEditor({record: plan, key: plan.id})}>Edit plan</button></div>
        <p className={plan.ready ? "gd-admin-success" : "gd-admin-test"}>{plan.ready ? "Ready for matching shipping reviews" : "Requires setup or confirmation"}</p>
        {!!plan.readinessIssues.length && <details><summary>Why this plan is not ready ({plan.readinessIssues.length})</summary><ul>{plan.readinessIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
      </article>)}
      <Pagination data={data} page={page} setPage={setPage} />
    </section>
  </div>;
}

// Search and paginate rather than assuming the first page is the whole catalog.
function Picker({token, kind, onPick, onDenied}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setData(null); setError("");
    const options = {page, limit: 12, search: query, signal: abort.signal};
    const pending = kind === "products" ? getAdminProducts(token, {...options, active: true}) : kind === "supplier" ? getSuppliers(token, {...options, status: "active"}) : getPackingLocations(token, {...options, status: "active"});
    pending.then(result => {if (!abort.signal.aborted) setData({...result, rows: result.products || result.suppliers || result.locations});})
      .catch(failure => {if (!abort.signal.aborted) {setError(failure.message); if ([401, 403].includes(failure.status)) onDenied();}})
      .finally(() => {if (!abort.signal.aborted) setLoading(false);});
    return () => abort.abort();
  }, [token, kind, page, query, revision, onDenied]);
  return <div className="gd-package-picker">
    <div className="gd-admin-filters"><label>Find {kind === "products" ? "products" : kind === "supplier" ? "active suppliers" : "active packing locations"}<input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /></label><button type="button" className="gd-admin-action" onClick={() => {setQuery(search.trim()); setPage(1); setRevision(value => value + 1);}}>Search / reload</button></div>
    {loading && <p role="status">Loading choices…</p>}
    {error && <p role="alert">{error}</p>}
    {data && !data.rows.length && <p>No matching choices. Check the search and configure active records first.</p>}
    <div className="gd-package-choices">{data?.rows.map(row => <div key={idOf(row)}><span><strong>{row.name}</strong><small>{kind === "products" ? [row.brand, row.category].filter(Boolean).join(" · ") : row.locationCode || row.supplierCode}<br />ID: {idOf(row)}</small></span><button type="button" className="gd-admin-action" onClick={() => onPick(row)}>{kind === "products" ? "Add component" : "Choose"}</button></div>)}</div>
    <Pagination data={data} page={page} setPage={setPage} />
  </div>;
}

function Field({label, children}) {return <label className="gd-package-field"><span>{label}</span>{children}</label>;}

function Editor({token, initial, onDenied, onSaved, onClose}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => initial ? packagePlanBody(initial) : blank());
  const [products, setProducts] = useState({});
  const [productError, setProductError] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [productRevision, setProductRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [measurementReference, setMeasurementReference] = useState("");
  const [expiry, setExpiry] = useState("");
  const [measured, setMeasured] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const requestRef = useRef(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ? packagePlanBody(saved) : blank());
  const componentIds = JSON.stringify([...new Set(draft.components.map(row => row.product))].sort());
  const allocationIssues = packageAllocationIssues(draft);
  const confirmed = Boolean(saved?.verification.confirmedAt && saved?.verification.confirmedBy && Date.parse(saved.verification.validUntil) > clock);

  useEffect(() => {mounted.current = true; return () => {mounted.current = false; requestRef.current?.abort();};}, []);
  useEffect(() => {const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer);}, []);
  useEffect(() => {
    const warn = event => {if (dirty || busyRef.current) {event.preventDefault(); event.returnValue = "";}};
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const abort = new AbortController();
    setProductLoading(true); setProductError("");
    Promise.all(JSON.parse(componentIds).map(id => getAdminProductById(token, id, {signal: abort.signal})))
      .then(rows => {if (!abort.signal.aborted) setProducts(Object.fromEntries(rows.map(row => [idOf(row), row])));})
      .catch(failure => {if (!abort.signal.aborted) {setProductError(failure.message); if ([401, 403].includes(failure.status)) onDenied();}})
      .finally(() => {if (!abort.signal.aborted) setProductLoading(false);});
    return () => abort.abort();
  }, [token, componentIds, productRevision, onDenied]);

  function update(change) {setDraft(previous => ({...previous, ...change})); setError(""); setNotice(""); setMeasured(false);}
  function component(key, change) {update({components: draft.components.map(row => row.key === key ? {...row, ...change} : row)});}
  function parcel(key, change) {update({parcels: draft.parcels.map(row => row.key === key ? {...row, ...change} : row)});}
  function close() {if (!busyRef.current && (!dirty || window.confirm("Discard the unsaved package plan changes?"))) onClose();}

  async function run(action) {
    if (busyRef.current || (blocked && action !== "reload")) return;
    if (action === "reload" && dirty && !window.confirm("Discard unsaved changes and reload the saved plan?")) return;
    if (action !== "save" && action !== "reload" && dirty) {setError("Save your edits before confirming or changing status."); return;}
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    const abort = new AbortController(); requestRef.current = abort;
    try {
      let result;
      if (action === "reload") {
        if (!saved?.id) {setError("The new plan's save result is unknown. Close this editor, reload the list and find the saved plan before creating another."); return;}
        result = await getPackagePlan(token, saved.id, {signal: abort.signal});
      } else if (action === "save") {
        if (productLoading || productError) throw new Error("Reload component products before saving.");
        for (const row of draft.components) {
          const product = products[row.product];
          if (!product) throw new Error("A component product could not be loaded.");
          if (product.sizes?.length && !product.sizes.map(String).includes(row.selectedSize)) throw new Error(`${product.name}: choose a valid size.`);
          if (product.colors?.length && !product.colors.map(String).includes(row.selectedColor)) throw new Error(`${product.name}: choose a valid colour.`);
        }
        const body = {...draft, status: saved?.status === "active" && dirty ? "paused" : draft.status};
        result = await savePackagePlan(token, saved, body, {signal: abort.signal});
      } else if (action === "confirm") {
        if (!measured) throw new Error("Confirm that the sealed parcels were physically measured.");
        if (allocationIssues.length) throw new Error(allocationIssues.join(" "));
        const date = new Date(expiry);
        if (!expiry || !Number.isFinite(date.getTime())) throw new Error("Choose a valid future review expiry.");
        result = await confirmPackagePlan(token, saved, {measurementReference, validUntil: date.toISOString()}, {signal: abort.signal});
      } else {
        result = await savePackagePlan(token, saved, {...packagePlanBody(saved), status: action}, {signal: abort.signal});
      }
      if (!mounted.current) return;
      setSaved(result); setDraft(packagePlanBody(result)); setBlocked(false); setMeasured(false);
      setNotice(action === "confirm" ? "Measurements confirmed. Activate the saved plan separately." : action === "reload" ? "Latest saved plan loaded." : `Plan saved as ${result.status}.`);
      onSaved();
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure.message);
      if (failure.resultUnknown || failure.status === 409) setBlocked(true);
      if ([401, 403].includes(failure.status)) onDenied();
    } finally {busyRef.current = false; if (mounted.current) setBusy(false);}
  }

  return <section className="gd-admin-panel" aria-labelledby="package-editor-title">
    <div className="gd-admin-heading"><div><h2 id="package-editor-title">{saved ? `Edit ${saved.name}` : "New package plan"}</h2><p>{saved ? `${saved.planCode} · ${saved.status} · version ${saved.version}` : "Start with an unpublished draft."}</p></div><button type="button" className="gd-admin-action" disabled={busy} onClick={close}>Close editor</button></div>
    {error && <p className="gd-admin-alert" role="alert">{error}</p>}
    {notice && <p className="gd-admin-success" role="status">{notice}</p>}
    {blocked && <p className="gd-admin-test">Saving is locked until you reload. {saved ? "Reload the saved plan below." : "Close this editor and reload the plan list to check whether it was created."}</p>}
    {saved && <button type="button" className="gd-admin-action" disabled={busy} onClick={() => run("reload")}>Reload saved plan</button>}
    <form onSubmit={event => {event.preventDefault(); run("save");}}>
      <fieldset disabled={busy || blocked} className="gd-package-fields">
        <legend>1. Plan and dispatch origin</legend>
        <Field label="Plan name"><input required minLength={2} maxLength={200} value={draft.name} onChange={event => update({name: event.target.value})} /></Field>
        <div className="gd-package-grid">
          <Field label="Dispatch origin"><select value={draft.origin.kind} onChange={event => update({origin: {kind: event.target.value, name: "", pickupPincode: "", supplier: null, packingLocation: null}})}><option value="unconfigured">Configure later</option><option value="packing-location">Packing location</option><option value="supplier">Supplier</option><option value="gymdrobe">GymDrobe stock location</option></select></Field>
          <Field label="Origin name"><input maxLength={200} value={draft.origin.name} onChange={event => update({origin: {...draft.origin, name: event.target.value}})} /></Field>
          <Field label="Actual pickup pincode"><input inputMode="numeric" maxLength={6} value={draft.origin.pickupPincode} onChange={event => update({origin: {...draft.origin, pickupPincode: event.target.value.replace(/\D/g, "")}})} /></Field>
        </div>
        {["supplier", "packing-location"].includes(draft.origin.kind) && <>
          <p>Selected origin: {draft.origin.name || "None"} · ID: {draft.origin.supplier || draft.origin.packingLocation || "Not selected"}</p>
          <Picker key={draft.origin.kind} token={token} kind={draft.origin.kind} onDenied={onDenied} onPick={row => update({origin: {...draft.origin, name: row.name, pickupPincode: "", supplier: draft.origin.kind === "supplier" ? idOf(row) : null, packingLocation: draft.origin.kind === "packing-location" ? idOf(row) : null}})} />
        </>}
        <p className="gd-admin-muted">Choose an actual packing arrangement or supplier. Confirm the pickup pincode with the dispatch team; the courier profile must match it.</p>
      </fieldset>
      <fieldset disabled={busy || blocked} className="gd-package-fields">
        <legend>2. Products and selected variants</legend>
        <p>Choose the exact selections this plan covers. Each different size or colour needs its own component.</p>
        {productLoading && <p role="status">Loading selected products…</p>}
        {productError && <p role="alert">{productError} <button type="button" className="gd-admin-action" onClick={() => setProductRevision(value => value + 1)}>Retry products</button></p>}
        {draft.components.map((row, index) => {
          const product = products[row.product];
          const sizes = (product?.sizes || []).map(String), colors = (product?.colors || []).map(String);
          const allocated = draft.parcels.reduce((sum, box) => sum + box.contents.filter(item => item.componentKey === row.key).reduce((total, item) => total + (item.quantity || 0), 0), 0);
          return <article className="gd-package-card" key={row.key}>
            <div className="gd-admin-heading"><div><h3>{index + 1}. {product?.name || "Product details unavailable"}</h3><small>ID: {row.product} · {row.key}</small></div><button type="button" className="gd-admin-action danger" onClick={() => update({components: draft.components.filter(item => item.key !== row.key), parcels: draft.parcels.map(box => ({...box, contents: box.contents.filter(item => item.componentKey !== row.key)}))})}>Remove component</button></div>
            <div className="gd-package-grid">
              {!!sizes.length && <Field label={product.optionLabels?.size || "Size"}><select value={row.selectedSize || ""} onChange={event => component(row.key, {selectedSize: event.target.value || null})}><option value="">Choose {product.optionLabels?.size?.toLowerCase() || "size"}</option>{row.selectedSize && !sizes.includes(row.selectedSize) && <option value={row.selectedSize}>{row.selectedSize} — no longer listed</option>}{sizes.map(value => <option key={value}>{value}</option>)}</select></Field>}
              {!!colors.length && <Field label={product.optionLabels?.color || "Colour"}><select value={row.selectedColor || ""} onChange={event => component(row.key, {selectedColor: event.target.value || null})}><option value="">Choose {product.optionLabels?.color?.toLowerCase() || "colour"}</option>{row.selectedColor && !colors.includes(row.selectedColor) && <option value={row.selectedColor}>{row.selectedColor} — no longer listed</option>}{colors.map(value => <option key={value}>{value}</option>)}</select></Field>}
              <Field label="Component quantity"><input type="number" required min={1} max={999} step={1} value={row.quantity ?? ""} onChange={event => component(row.key, {quantity: numberInput(event.target.value)})} /></Field>
            </div>
            {product && !sizes.length && row.selectedSize && <button type="button" className="gd-admin-action" onClick={() => component(row.key, {selectedSize: null})}>Clear obsolete size / pack selection</button>}
            {product && !colors.length && row.selectedColor && <button type="button" className="gd-admin-action" onClick={() => component(row.key, {selectedColor: null})}>Clear obsolete colour / flavour selection</button>}
            <p className="gd-admin-muted">Saved selection: {row.selectedSize || "No size"} / {row.selectedColor || "No colour"}. {product ? `Available for selection: ${getVariantStock(product, row.selectedSize, row.selectedColor)}.` : "Stock not loaded."} Allocated: {allocated} / {row.quantity ?? "?"} units.</p>
          </article>;
        })}
        {draft.components.length < 50 && <Picker token={token} kind="products" onDenied={onDenied} onPick={product => {
          setProducts(previous => ({...previous, [idOf(product)]: product}));
          update({components: [...draft.components, {key: newKey("item"), product: idOf(product), quantity: 1, selectedSize: null, selectedColor: null}]});
        }} />}
      </fieldset>
      <fieldset disabled={busy || blocked} className="gd-package-fields">
        <legend>3. Parcel contents and physical measurements</legend>
        <p>Measure the sealed parcel with its packaging. Leave measurements blank in a draft if they are not known.</p>
        {draft.parcels.map(box => <article className="gd-package-card" key={box.key}>
          <div className="gd-admin-heading"><h3>{box.label || "Unnamed parcel"}</h3><button type="button" className="gd-admin-action danger" onClick={() => update({parcels: draft.parcels.filter(row => row.key !== box.key)})}>Remove parcel</button></div>
          <Field label="Customer parcel label"><input maxLength={150} value={box.label} onChange={event => parcel(box.key, {label: event.target.value})} /></Field>
          <div className="gd-package-grid">{MEASUREMENTS.map(([key, label, max]) => <Field key={key} label={label}><input type="number" min={1} max={max} step={1} value={box[key] ?? ""} onChange={event => parcel(box.key, {[key]: numberInput(event.target.value)})} /></Field>)}</div>
          <h4>Units in this parcel</h4>
          {!draft.components.length && <p>Add component products first.</p>}
          {draft.components.map(row => {
            const count = box.contents.find(item => item.componentKey === row.key)?.quantity || 0;
            return <Field key={row.key} label={`${products[row.product]?.name || row.product} · ${row.selectedSize || "No size"} / ${row.selectedColor || "No colour"} · ${row.quantity ?? "?"} total units`}><input type="number" min={0} max={999} step={1} value={count} onChange={event => {
              const quantity = numberInput(event.target.value) || 0;
              parcel(box.key, {contents: [...box.contents.filter(item => item.componentKey !== row.key), ...(quantity ? [{componentKey: row.key, quantity}] : [])]});
            }} /></Field>;
          })}
        </article>)}
        <button type="button" className="gd-admin-action" disabled={draft.parcels.length >= 50} onClick={() => update({parcels: [...draft.parcels, {key: newKey("parcel"), label: `Package ${draft.parcels.length + 1}`, weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, contents: []}]})}>Add parcel</button>
        {!!allocationIssues.length && <div className="gd-admin-test"><strong>Complete before confirmation:</strong><ul>{allocationIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
      </fieldset>
      <fieldset disabled={busy || blocked} className="gd-package-fields"><legend>4. Save details</legend><Field label="Internal packing notes"><textarea maxLength={2000} rows={3} value={draft.notes} onChange={event => update({notes: event.target.value})} /></Field><p>Changed packing details need measurement confirmation again. Editing an active plan saves it as paused.</p><button type="submit" className="button" disabled={!dirty || productLoading || Boolean(productError)}>{busy ? "Working…" : saved ? "Save changes" : "Save draft"}</button></fieldset>
    </form>
    {saved && <fieldset className="gd-package-fields" disabled={busy || blocked || dirty}>
      <legend>5. Confirm and activate</legend>
      <p>Confirmed: {dateLabel(saved.verification.confirmedAt)} · Review expires: {dateLabel(saved.verification.validUntil)}</p>
      {!!saved.readinessIssues.length && <details><summary>Backend setup issues ({saved.readinessIssues.length})</summary><ul>{saved.readinessIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
      {dirty && <p>Save edits before confirming or changing status.</p>}
      {["draft", "paused"].includes(saved.status) && <>
        <Field label="Actual measurement record reference"><input maxLength={200} value={measurementReference} onChange={event => setMeasurementReference(event.target.value)} placeholder="Your packing measurement record" /></Field>
        <Field label="Measurement review expiry (your local time)"><input type="datetime-local" value={expiry} onChange={event => setExpiry(event.target.value)} /></Field>
        <label className="gd-package-check"><input type="checkbox" checked={measured} onChange={event => setMeasured(event.target.checked)} />The sealed parcels were physically measured and their contents checked.</label>
        <button type="button" className="gd-admin-action" disabled={!measured || !!allocationIssues.length || !measurementReference.trim() || !expiry} onClick={() => run("confirm")}>Confirm actual measurements</button>
      </>}
      <div className="purchase-actions">
        <button type="button" className="button" disabled={!confirmed || saved.status === "active" || saved.status === "archived"} onClick={() => run("active")}>Activate plan</button>
        <button type="button" className="gd-admin-action" disabled={saved.status !== "active"} onClick={() => run("paused")}>Pause plan</button>
        <button type="button" className="gd-admin-action" disabled={saved.status === "draft"} onClick={() => run("draft")}>Move to draft</button>
        <button type="button" className="gd-admin-action danger" disabled={saved.status === "archived"} onClick={() => run("archived")}>Archive plan</button>
      </div>
      <p className="gd-admin-muted">The server checks products, variants, supplier arrangements, measurements and confirmation before activation. A matching active courier profile is also needed for a confirmed shipping review.</p>
    </fieldset>}
  </section>;
}
