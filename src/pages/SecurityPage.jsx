import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { getOrders, getAddresses } from "../utils/customerData.js";
import { ticketsFor } from "../utils/support.js";
import { downloadText } from "../utils/commerce.js";
import AccountLayout from "../components/AccountLayout.jsx";
export default function SecurityPage() {
  const { user, changePassword } = useAuth(),
    { notify } = useStore();
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (next !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirmation("");
    setError("");
    notify("Preview account password updated.");
  }
  return (
    <AccountLayout title="Password & account data">
      <p className="notice">
        This account is a device-local preview. A live store needs server
        authentication, email verification, password recovery and session
        management.
      </p>
      <form className="profile-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength="8"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength="8"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Updating…" : "Change password"}
        </button>
      </form>
      <section className="panel account-export">
        <h3>Your account records</h3>
        <p>
          Export this account’s profile, saved addresses, orders and support
          requests. Password hashes and other accounts are excluded.
        </p>
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            downloadText(
              "GymDrobe-my-account.json",
              JSON.stringify(
                {
                  exportedAt: new Date().toISOString(),
                  profile: user,
                  addresses: getAddresses(user),
                  orders: getOrders(user),
                  support: ticketsFor(user),
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          Download my account data
        </button>
      </section>
    </AccountLayout>
  );
}