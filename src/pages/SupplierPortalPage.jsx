import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import PageLoading from "../components/PageLoading.jsx";
import { supplierPortalApi as api } from "../services/supplierPortalApi.js";
import { SupplierBusinessForm, SupplierTerms, SupplierAcceptance, SupplierWorkspaceSummary, SupplierHistory } from "../components/SupplierPortalShared.jsx";

export default function SupplierPortalPage() {
  const { token, user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [code, setCode] = useState("");
  const [history, setHistory] = useState([]);
  const busyRef = useRef(false);
  const epoch = useRef(0);

  const reload = useCallback(async () => {
    const request = ++epoch.current;
    setLoading(true); setError(""); setLocked(true); setHistory([]);
    try {
      const data = await api.me(token);
      if (request !== epoch.current) return;
      setWorkspace(data.workspace); setAvailable(true); setLocked(false);
    } catch (failure) {
      if (request !== epoch.current) return;
      if (failure.code === "SUPPLIER_WORKSPACE_NOT_FOUND") {
        setWorkspace(null); setAvailable(true); setLocked(false);
      } else { setError(failure.message); setAvailable(false); }
    } finally { if (request === epoch.current) setLoading(false); }
  }, [token]);

  useEffect(() => { reload(); return () => { epoch.current += 1; }; }, [reload]);

  async function mutate(action, success) {
    if (busyRef.current || locked) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    const request = ++epoch.current;
    try {
      const data = await action();
      if (request !== epoch.current) return;
      setWorkspace(data.workspace); setCode(""); setHistory([]); setMessage(success);
    } catch (failure) {
      if (request !== epoch.current) return;
      setError(failure.message);
      if (failure.outcomeUnknown || failure.status === 409) setLocked(true);
    } finally { busyRef.current = false; if (request === epoch.current) setBusy(false); }
  }

  async function loadHistory() {
    const request = epoch.current;
    try { const data = await api.history(token); if (request === epoch.current) setHistory(data.events); }
    catch (failure) { if (request === epoch.current) setError(failure.message); }
  }

  if (loading) return <PageLoading />;
  return <div className="page gd-suppliers-page">
    <div className="gd-supplier-heading"><div><p className="gd-supplier-muted">GYMDROBE PARTNERS</p><h1>Supplier workspace</h1></div><button className="button secondary" disabled={busy} onClick={reload}>Reload latest record</button></div>
    <p className="gd-portal-intro">Submit your business details, review your commercial offer and follow your onboarding. Signed in as {user.email}.</p>
    {error && <p className="gd-supplier-error" role="alert">{error}</p>}
    {message && <p className="gd-supplier-success" role="status">{message}</p>}
    {locked && available && <p className="gd-supplier-warning">Reload the latest record to confirm its status before making another change.</p>}
    {available && !workspace && <>
      <section className="gd-supplier-panel"><h2>Have an invitation?</h2><p>Sign in using the email your invitation was issued to, then paste the private code.</p>
        <form onSubmit={(event) => { event.preventDefault(); mutate(() => api.claim(token, code.trim()), "Invitation accepted. Complete your business details below."); }}>
          <fieldset className="gd-supplier-fields" disabled={busy || locked}>
            <label className="gd-supplier-field">Invitation code<input required autoComplete="off" minLength={64} maxLength={64} value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button type="submit" className="button">Connect my supplier account</button>
          </fieldset>
        </form>
      </section>
      <section className="gd-supplier-panel"><h2>Apply to become a supplier</h2><p>Submitting an application does not accept commercial terms or approve your business.</p>
        <SupplierBusinessForm busy={busy || locked} onSubmit={(profile) => mutate(() => api.apply(token, profile), "Application saved. GymDrobe will review your details.")} />
      </section>
    </>}
    {workspace && available && <section className="gd-supplier-panel">
      <SupplierWorkspaceSummary workspace={workspace} />
      {!workspace.acceptedAgreement && ["pending-verification", "rejected"].includes(workspace.status) &&
        <SupplierBusinessForm key={workspace.revision} initial={workspace.profile} busy={busy || locked} label={workspace.submittedAt ? "Save & resubmit details" : "Submit business details"}
          onSubmit={(profile) => mutate(() => api.updateProfile(token, workspace.revision, profile), "Business details submitted for review.")} />}
      <SupplierTerms agreement={workspace.acceptedAgreement || workspace.offeredAgreement} />
      {workspace.offeredAgreement && !workspace.acceptedAgreement && <SupplierAcceptance key={workspace.offeredAgreement.digest} workspace={workspace} busy={busy || locked}
        onAccept={(body) => mutate(() => api.accept(token, body), "Your acceptance is recorded. Admin approval is still required before the trial starts.")} />}
      {!workspace.offeredAgreement && !workspace.acceptedAgreement && <p className="gd-supplier-muted">No commercial offer has been issued yet.</p>}
      <div className="gd-supplier-section"><h3>Documents & settlements</h3><p>Document submission, banking setup and settlements are not available yet.</p></div>
      <button className="button secondary" disabled={busy} onClick={loadHistory}>Load recent activity</button>
      <SupplierHistory events={history} />
    </section>}
  </div>;
}
