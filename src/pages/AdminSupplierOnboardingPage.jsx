import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PageLoading from "../components/PageLoading.jsx";
import { getSuppliers } from "../services/supplierApi.js";
import { supplierPortalApi as api, commissionBps } from "../services/supplierPortalApi.js";
import { SupplierTerms, SupplierWorkspaceSummary, SupplierHistory, SUPPLIER_STATUS } from "../components/SupplierPortalShared.jsx";

const dateInput = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function OfferForm({ workspace, busy, onSubmit, onError }) {
  const [draft, setDraft] = useState(() => ({ title: "90-day supplier trial", text: "", percentage: "",
    shippingResponsibility: "", gatewayFeeResponsibility: "", returnResponsibility: "",
    effectiveFrom: dateInput(new Date()), offerExpiresAt: dateInput(new Date(Date.now() + 7 * 86400000)) }));
  const update = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  return <form className="gd-supplier-section" onSubmit={(event) => {
    event.preventDefault();
    try {
      const { percentage, ...terms } = draft;
      onSubmit({ ...terms, commissionBps: commissionBps(percentage),
        effectiveFrom: new Date(terms.effectiveFrom).toISOString(), offerExpiresAt: new Date(terms.offerExpiresAt).toISOString() });
    } catch (error) { onError(error.message); }
  }}>
    <fieldset className="gd-supplier-fields" disabled={busy}>
      <legend>{workspace.offeredAgreement ? "Replace the unaccepted offer" : "Prepare a commercial offer"}</legend>
      <p>Enter the proposed agreement in full. The supplier must explicitly accept it. Joining and monthly fees stay at ₹0 for the 90-day trial.</p>
      <label className="gd-supplier-field">Agreement title<input required maxLength={150} value={draft.title} onChange={(e) => update("title", e.target.value)} /></label>
      <div className="gd-supplier-field-grid">
        <label className="gd-supplier-field">Trial commission (%)<input required type="number" min="0" max="100" step="0.01" value={draft.percentage} onChange={(e) => update("percentage", e.target.value)} /><small>Proposal only. No rate is applied without acceptance.</small></label>
        <label className="gd-supplier-field">Shipping responsibility<select required value={draft.shippingResponsibility} onChange={(e) => update("shippingResponsibility", e.target.value)}><option value="">Choose who pays</option><option value="supplier">Supplier</option><option value="gymdrobe">GymDrobe</option></select></label>
        <label className="gd-supplier-field">Payment gateway fees<select required value={draft.gatewayFeeResponsibility} onChange={(e) => update("gatewayFeeResponsibility", e.target.value)}><option value="">Choose who pays</option><option value="supplier">Supplier</option><option value="gymdrobe">GymDrobe</option></select></label>
        <label className="gd-supplier-field">Effective date<input required type="datetime-local" value={draft.effectiveFrom} onChange={(e) => update("effectiveFrom", e.target.value)} /></label>
        <label className="gd-supplier-field">Offer expires<input required type="datetime-local" value={draft.offerExpiresAt} onChange={(e) => update("offerExpiresAt", e.target.value)} /></label>
      </div>
      <label className="gd-supplier-field">Return responsibilities<textarea required minLength={10} maxLength={2000} value={draft.returnResponsibility} onChange={(e) => update("returnResponsibility", e.target.value)} /></label>
      <label className="gd-supplier-field">Complete commercial terms<textarea required minLength={20} maxLength={20000} rows={10} value={draft.text} onChange={(e) => update("text", e.target.value)} /></label>
      <button className="button" type="submit">{busy ? "Saving offer…" : "Save offer for supplier review"}</button>
    </fieldset>
  </form>;
}

function StatusForm({ workspace, busy, onSubmit }) {
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  return <form className="gd-supplier-section" onSubmit={(event) => { event.preventDefault(); onSubmit(status, reason); }}>
    <fieldset className="gd-supplier-fields" disabled={busy}>
      <legend>Admin review</legend>
      <p>Approval records your business review and starts the agreed trial. Catalogue activation and order routing remain closed for this workspace.</p>
      <label className="gd-supplier-field">Review decision<select required value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Choose a decision</option>
        <option value="approved" disabled={!workspace.acceptedAgreement || workspace.readiness.trial.state === "review-required"}>Approve</option>
        <option value="rejected">Reject</option><option value="suspended">Suspend</option><option value="inactive">Mark inactive</option>
      </select></label>
      <label className="gd-supplier-field">Review reason<textarea required minLength={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /><small>Record what you verified or why the status is changing. This note is visible to the supplier.</small></label>
      <button className="button" type="submit">Save review decision</button>
    </fieldset>
  </form>;
}

export default function AdminSupplierOnboardingPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [history, setHistory] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [email, setEmail] = useState("");
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0);
  const busyRef = useRef(false);
  const selectionRef = useRef(null);

  const load = useCallback(async () => {
    const request = ++epoch.current;
    setLoading(true); setError(""); setLocked(true); setHistory([]); setInvitation(null);
    try {
      const [result, existing, current] = await Promise.all([
        api.list(token, { page, status }), getSuppliers(token, { status: "draft", limit: 100 }),
        selectionRef.current ? api.get(token, selectionRef.current) : Promise.resolve(null),
      ]);
      if (request !== epoch.current) return;
      setRows(result.workspaces); setPages(result.pages); setDrafts(existing.suppliers);
      setSelected(current?.workspace || null); setAvailable(true); setLocked(false);
    } catch (failure) { if (request === epoch.current) { setError(failure.message); setAvailable(false); } }
    finally { if (request === epoch.current) setLoading(false); }
  }, [token, page, status, attempt]);
  useEffect(() => { load(); return () => { epoch.current += 1; }; }, [load]);

  async function mutate(action, success) {
    if (busyRef.current || locked) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage(""); setInvitation(null);
    const request = ++epoch.current;
    try {
      const data = await action();
      if (request !== epoch.current) return;
      setSelected(data.workspace); selectionRef.current = data.workspace.id;
      setRows((old) => old.some((row) => row.id === data.workspace.id)
        ? old.map((row) => row.id === data.workspace.id ? data.workspace : row)
        : [data.workspace, ...old].slice(0, 20));
      setInvitation(data.invitation || null); setHistory([]); setMessage(success);
    } catch (failure) {
      if (request !== epoch.current) return;
      setError(failure.message);
      if (failure.status === 409 || failure.outcomeUnknown) setLocked(true);
    } finally { busyRef.current = false; if (request === epoch.current) setBusy(false); }
  }

  function select(row) {
    ++epoch.current; selectionRef.current = row.id;
    setSelected(row); setHistory([]); setInvitation(null); setError(""); setMessage(""); setLocked(false);
    setTimeout(() => document.getElementById("supplier-onboarding-detail")?.scrollIntoView({ behavior: "instant", block: "start" }), 0);
  }

  async function loadHistory() {
    const request = epoch.current;
    try { const result = await api.adminHistory(token, selected.id); if (request === epoch.current) setHistory(result.events); }
    catch (failure) { if (request === epoch.current) setError(failure.message); }
  }

  if (loading) return <PageLoading />;
  return <div className="page gd-suppliers-page">
    <div className="gd-supplier-heading"><div><p className="gd-supplier-muted">PARTNER OPERATIONS</p><h1>Supplier onboarding</h1></div>
      <button className="button secondary" disabled={busy} onClick={() => setAttempt((v) => v + 1)}>Reload latest records</button></div>
    <nav className="gd-supplier-menu" aria-label="Supplier administration"><Link to="/admin">Overview</Link><Link to="/admin/suppliers">Supplier records</Link><Link to="/supplier">Supplier workspace</Link></nav>
    <p className="gd-portal-intro">Review applications, record explicit commercial offers and connect supplier accounts. Existing suppliers keep their current setup until you enroll them.</p>
    {error && <p className="gd-supplier-error" role="alert">{error}</p>}
    {message && <p className="gd-supplier-success" role="status">{message}</p>}
    {locked && available && <p className="gd-supplier-warning">Reload the latest records before making another change.</p>}
    {invitation && <section className="gd-supplier-panel"><h2>Invitation code created</h2><p>No message has been sent. Share this private code with {invitation.email}, who must use the same email to sign in at <Link to="/supplier">the supplier workspace</Link>.</p>
      <label className="gd-supplier-field">Private invitation code<textarea readOnly value={invitation.code} onFocus={(e) => e.target.select()} /></label><p className="gd-supplier-muted">Shown once. Expires {new Date(invitation.expiresAt).toLocaleString("en-IN")}.</p></section>}
    {available && <>
      <section className="gd-supplier-panel"><h2>Invite an existing draft supplier</h2><p><Link to="/admin/suppliers">Create a supplier draft</Link> first, or let the supplier submit an application in their workspace.</p>
        <form onSubmit={(event) => { event.preventDefault(); mutate(() => api.invite(token, { supplierId, email }), "Invitation prepared. The supplier must claim it and accept terms separately."); }}>
          <fieldset className="gd-supplier-fields" disabled={busy || locked}>
            <div className="gd-supplier-field-grid">
              <label className="gd-supplier-field">Draft supplier<select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Choose a supplier</option>{drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.name} · {draft.supplierCode}</option>)}</select></label>
              <label className="gd-supplier-field">Supplier sign-in email<input required type="email" maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            </div><button type="submit" className="button">Create invitation code</button>
          </fieldset>
        </form>
      </section>
      <div className="gd-supplier-filters"><label>Application status<select disabled={busy} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(SUPPLIER_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="gd-supplier-grid">{rows.map((row) => <article className="gd-supplier-card" key={row.id}><h3>{row.supplier.name}</h3><p>{SUPPLIER_STATUS[row.status]}</p><p className="gd-supplier-muted">{row.acceptedAgreement ? "Commercial terms accepted" : row.offeredAgreement ? "Awaiting acceptance" : "Terms not yet offered"}</p><button className="button secondary" disabled={busy || locked} onClick={() => select(row)}>Review {row.supplier.name}</button></article>)}</div>
      {!rows.length && <p className="gd-supplier-empty">No supplier applications match this view.</p>}
      <nav className="gd-supplier-pagination" aria-label="Application pages"><button className="button secondary" disabled={page <= 1 || busy} onClick={() => setPage((v) => v - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button secondary" disabled={page >= pages || busy} onClick={() => setPage((v) => v + 1)}>Next</button></nav>
    </>}
    {selected && available && <section id="supplier-onboarding-detail" className="gd-supplier-panel gd-portal-detail">
      <SupplierWorkspaceSummary workspace={selected} />
      {selected.profile?.legalName && <dl className="gd-portal-facts"><div><dt>Legal name</dt><dd>{selected.profile.legalName}</dd></div><div><dt>Contact</dt><dd>{selected.profile.contactName} · {selected.profile.phone}</dd></div><div><dt>Dispatch address</dt><dd>{selected.profile.dispatchAddress?.addressLine}, {selected.profile.dispatchAddress?.city}, {selected.profile.dispatchAddress?.state} {selected.profile.dispatchAddress?.pincode}</dd></div><div><dt>GSTIN</dt><dd>{selected.profile.gstin || "Not submitted"}</dd></div></dl>}
      {!selected.hasOwner && <form onSubmit={(event) => { event.preventDefault(); mutate(() => api.invite(token, { revision: selected.revision, email }, selected.id), "A new invitation code replaced the previous one."); }}><fieldset className="gd-supplier-fields" disabled={busy || locked}><legend>Replace invitation</legend><label className="gd-supplier-field">Invitation email<input type="email" required maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} /></label><button className="button secondary" type="submit">Issue a new invitation code</button></fieldset></form>}
      <SupplierTerms agreement={selected.acceptedAgreement || selected.offeredAgreement} />
      {!selected.acceptedAgreement && selected.submittedAt && selected.status === "pending-verification" && <OfferForm key={`${selected.id}:${selected.revision}`} workspace={selected} busy={busy || locked} onError={setError}
        onSubmit={(terms) => mutate(() => api.offer(token, selected.id, selected.revision, terms), "Offer saved for supplier review. Acceptance has not been assumed.")} />}
      <StatusForm key={`status:${selected.id}:${selected.revision}`} workspace={selected} busy={busy || locked} onSubmit={(status, reason) => mutate(() => api.status(token, selected.id, selected.revision, status, reason), "Review decision recorded.")} />
      <button className="button secondary" disabled={busy} onClick={loadHistory}>Load recent activity</button><SupplierHistory events={history} />
    </section>}
  </div>;
}
