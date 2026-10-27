import { useState } from "react";
import "../pages/AdminSuppliersPage.css";
import "../pages/SupplierPortalPage.css";

export const SUPPLIER_STATUS = {
  "pending-verification": "Pending verification", approved: "Approved",
  rejected: "Rejected", suspended: "Suspended", inactive: "Inactive",
};

export function supplierDate(value) {
  return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
}

export function SupplierBusinessForm({ initial, busy, onSubmit, label = "Submit application" }) {
  const [profile, setProfile] = useState(() => ({ legalName: "", contactName: "", phone: "", gstin: "", ...initial,
    dispatchAddress: { addressLine: "", city: "", state: "", pincode: "", country: "IN", ...initial?.dispatchAddress } }));
  const update = (key, value) => setProfile((old) => ({ ...old, [key]: value }));
  const address = (key, value) => setProfile((old) => ({ ...old, dispatchAddress: { ...old.dispatchAddress, [key]: value } }));
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(profile); }}>
    <fieldset className="gd-supplier-fields" disabled={busy}>
      <legend>Business & dispatch details</legend>
      <div className="gd-supplier-field-grid">
        <label className="gd-supplier-field">Legal business name<input required minLength={2} maxLength={200} value={profile.legalName} onChange={(e) => update("legalName", e.target.value)} autoComplete="organization" /></label>
        <label className="gd-supplier-field">Contact name<input required minLength={2} maxLength={100} value={profile.contactName} onChange={(e) => update("contactName", e.target.value)} autoComplete="name" /></label>
        <label className="gd-supplier-field">Phone, including country code<input required type="tel" maxLength={30} value={profile.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" /></label>
        <label className="gd-supplier-field">GSTIN, if applicable<input maxLength={15} value={profile.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} /><small>This records the number for review; it does not verify registration.</small></label>
      </div>
      <label className="gd-supplier-field">Dispatch address<input required minLength={5} maxLength={300} value={profile.dispatchAddress.addressLine} onChange={(e) => address("addressLine", e.target.value)} autoComplete="street-address" /></label>
      <div className="gd-supplier-field-grid">
        <label className="gd-supplier-field">City<input required minLength={2} maxLength={100} value={profile.dispatchAddress.city} onChange={(e) => address("city", e.target.value)} autoComplete="address-level2" /></label>
        <label className="gd-supplier-field">State<input required minLength={2} maxLength={100} value={profile.dispatchAddress.state} onChange={(e) => address("state", e.target.value)} autoComplete="address-level1" /></label>
        <label className="gd-supplier-field">Pincode<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={profile.dispatchAddress.pincode} onChange={(e) => address("pincode", e.target.value)} autoComplete="postal-code" /></label>
      </div>
      <button className="button" type="submit">{busy ? "Saving…" : label}</button>
    </fieldset>
  </form>;
}

export function SupplierTerms({ agreement }) {
  if (!agreement) return null;
  const terms = agreement.terms;
  return <section className="gd-supplier-section" aria-label="Commercial terms">
    <h3>{terms.title}</h3>
    <p className="gd-supplier-muted">Version {agreement.version} · {terms.supplierLegalName}</p>
    <dl className="gd-portal-facts">
      <div><dt>Trial commission</dt><dd>{(terms.commissionBps / 100).toFixed(2)}% of net product sales, excluding taxes and shipping</dd></div>
      <div><dt>Trial duration</dt><dd>{terms.trialDays} days from approval or the agreed effective date, whichever is later</dd></div>
      <div><dt>Joining / monthly fees</dt><dd>₹0 during the trial</dd></div>
      <div><dt>Shipping paid by</dt><dd>{terms.shippingResponsibility === "supplier" ? "Supplier" : "GymDrobe"}</dd></div>
      <div><dt>Gateway fees paid by</dt><dd>{terms.gatewayFeeResponsibility === "supplier" ? "Supplier" : "GymDrobe"}</dd></div>
      <div><dt>Effective from</dt><dd>{supplierDate(terms.effectiveFrom)}</dd></div>
      {agreement.status === "offered" && <div><dt>Accept before</dt><dd>{supplierDate(terms.offerExpiresAt)}</dd></div>}
    </dl>
    <p><strong>Return responsibilities</strong><br />{terms.returnResponsibility}</p>
    <div className="gd-portal-terms">{terms.text}</div>
    <p className="gd-supplier-muted">There is no automatic increase in commission or paid subscription after the trial. New commercial terms need separate acceptance.</p>
    {agreement.acceptance && <p className="gd-supplier-success">Accepted by {agreement.acceptance.signerName} on {supplierDate(agreement.acceptance.acceptedAt)}.</p>}
  </section>;
}

export function SupplierAcceptance({ workspace, busy, onAccept }) {
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const agreement = workspace.offeredAgreement;
  return <form onSubmit={(event) => {
    event.preventDefault();
    onAccept({ revision: workspace.revision, agreementId: agreement.id, digest: agreement.digest, signerName: name, accepted, authorized });
  }}>
    <fieldset disabled={busy} className="gd-supplier-fields">
      <legend>Accept this offer</legend>
      <label className="gd-supplier-field">Authorized signer's full name<input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="gd-supplier-check"><input required type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />I am authorized to accept these terms for this business.</label>
      <label className="gd-supplier-check"><input required type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I have read and accept version {agreement.version}, including its commission, fees and responsibilities.</label>
      <button className="button" type="submit" disabled={!accepted || !authorized || name.trim().length < 2}>{busy ? "Recording acceptance…" : "Accept these commercial terms"}</button>
    </fieldset>
  </form>;
}

export function SupplierWorkspaceSummary({ workspace }) {
  const trial = workspace.readiness.trial;
  return <>
    <div className="gd-supplier-heading"><h2>{workspace.supplier.name}</h2><span className="gd-supplier-badge">{SUPPLIER_STATUS[workspace.status]}</span></div>
    <p className="gd-supplier-code">{workspace.supplier.code}</p>
    <div className="gd-supplier-record">
      <span>Account: {workspace.hasOwner ? "Connected" : "Invitation pending"}</span>
      <span>Terms: {workspace.acceptedAgreement ? "Accepted" : workspace.offeredAgreement ? "Awaiting acceptance" : "No offer yet"}</span>
      <span>Trial: {trial.state === "active" ? `${trial.remainingDays} days remaining` : trial.state.replaceAll("-", " ")}</span>
    </div>
    {trial.endAt && <p className="gd-supplier-muted">Trial: {supplierDate(trial.startAt)} – {supplierDate(trial.endAt)}</p>}
    {workspace.statusReason && <p><strong>Review note:</strong> {workspace.statusReason}</p>}
    {trial.state === "review-required" && <p className="gd-supplier-warning">Your trial has ended. New terms require review and acceptance. Your commission has not been increased.</p>}
    <p className="gd-supplier-warning">Onboarding records are being prepared. Products in this supplier workspace are not accepting customer orders yet.</p>
  </>;
}

export function SupplierHistory({ events }) {
  return <details className="gd-supplier-section"><summary>Recent activity</summary>
    {!events.length ? <p>No activity loaded.</p> : <ol className="gd-portal-history">{events.map((event) => <li key={event.revision}><strong>{event.action.replaceAll("-", " ")}</strong><span>{supplierDate(event.createdAt)}</span><p>{event.detail}</p></li>)}</ol>}
  </details>;
}
