import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { deleteAccount, getDeletionPolicy } from "../services/authApi.js";
import { clearDeletedAccountData } from "../native/accountData.js";

export default function AccountDeletionSection() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [deletedNotice, setDeletedNotice] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  async function prepare() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const data = await getDeletionPolicy(token);
      if (!data.enabled) throw new Error("Account deletion is awaiting the store’s data-retention configuration. Please contact GymDrobe support.");
      setPolicy(data);
    } catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  }
  async function remove(event) {
    event.preventDefault();
    if (locked.current || confirmation !== "DELETE") return;
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await deleteAccount(token, confirmation);
      if (result.deleted !== true) throw new Error("Deletion was not confirmed. Please retry.");
      setDeletedNotice(result.retentionNotice || policy.retentionNotice);
      try { clearDeletedAccountData(user); } catch { /* Server deletion already succeeded. */ }
      await logout();
      navigate("/login", { replace: true });
    } catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  }
  if (deletedNotice !== null) return <section className="panel" style={{ marginTop: 20 }}>
    <h3>Your GymDrobe account was deleted</h3><p>{deletedNotice}</p>
    {error && <p role="alert">Your account is deleted. Unlock your device and retry signing out to clear this device’s session.</p>}
    <button type="button" className="button secondary" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await logout(); navigate("/login", { replace: true }); } catch { setError("Unable to clear this device’s session."); } finally { setBusy(false); }
    }}>Clear session and continue</button>
  </section>;
  return <section className="panel" style={{ marginTop: 20 }} aria-busy={busy}>
    <p className="eyebrow">ACCOUNT DELETION</p><h3>Delete your GymDrobe account</h3>
    <p className="muted">Permanently remove your profile, saved addresses, reviews and support conversations. Your sessions will stop working. This does not cancel an order or request a refund.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    {!policy ? <button type="button" className="button secondary" disabled={busy} onClick={prepare}>{busy ? "Checking…" : "Delete my account"}</button> : <form onSubmit={remove}>
      <p className="notice">{policy.retentionNotice}</p>
      <p>Sign in again before deleting if your current session started more than 10 minutes ago.</p>
      <div className="field"><label htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy}/></div>
      <div className="purchase-actions"><button type="submit" className="button" disabled={busy || confirmation !== "DELETE"}>{busy ? "Deleting…" : "Permanently delete account"}</button><button type="button" className="button secondary" disabled={busy} onClick={() => { setPolicy(null); setConfirmation(""); }}>Cancel</button></div>
    </form>}
  </section>;
}
