import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { safeNext } from "../utils/storage.js";
export default function AuthForm({ signupMode = false }) {
  const { user, login, signup } = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const next = safeNext(params.get("next")),
    [data, setData] = useState({ name: "", email: "", password: "" }),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = signupMode
      ? await signup(data)
      : await login(data.email, data.password);
    if (result.success) navigate(next, { replace: true });
    else setError(result.message);
    setBusy(false);
  }
  if (user) return <Navigate to={next} replace />;
  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-banner">
          <span>THE GYMDROBE CLUB</span>
          <h1>
            {signupMode
              ? "Your next chapter starts here."
              : "Your favourites. All together."}
          </h1>
          <p>Good gear. Great sessions.</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <h2>
            {signupMode ? "Create an account" : "Login"}{" "}
            <span>to GymDrobe</span>
          </h2>
          <p className="muted">Preview account: saved only in this browser.</p>
          {signupMode && (
            <div className="field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                required
                minLength="2"
                maxLength="80"
                autoComplete="name"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <div className="password-field">
              <input
                id="auth-password"
                type={visible ? "text" : "password"}
                required
                minLength={signupMode ? 8 : 1}
                autoComplete={signupMode ? "new-password" : "current-password"}
                value={data.password}
                onChange={(e) => setData({ ...data, password: e.target.value })}
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? "Hide" : "Show"}
              </button>
            </div>
            {signupMode && (
              <small>Use at least 8 characters for this preview account.</small>
            )}
          </div>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button full" disabled={busy}>
            {busy ? "Please wait…" : signupMode ? "Create account" : "Login"}
          </button>
          <p>
            {signupMode ? "Already registered?" : "New to GymDrobe?"}{" "}
            <Link
              className="text-link"
              to={`${signupMode ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}
            >
              {signupMode ? "Login" : "Create an account"}
            </Link>
          </p>
          {!signupMode && (
            <p className="muted">
              Accounts from the old email-only preview need to be registered
              once with a password.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}