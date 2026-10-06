import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../services/authApi.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function submit(event) {
    event.preventDefault();

    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await requestPasswordReset(email);

      setMessage(
        result.message ||
          "If an active account exists for this email, a reset link will be sent."
      );
    } catch (error) {
      setError(error.message || "Please try again later.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-banner">
          <span>YOUR GYMDROBE ACCOUNT</span>
          <h1>Let’s get you back in.</h1>
          <p>Reset your password and continue shopping.</p>
        </div>

        <div className="auth-form">
          <h2>Forgot password?</h2>

          <p className="muted">
            Enter the email address you registered with GymDrobe.
            We’ll send a reset link if an active account exists.
          </p>

          {message ? (
            <>
              <p className="notice" role="status">
                {message}
              </p>

              <p className="muted">
                Check your inbox and spam folder. Reset links expire
                after 15 minutes. If needed, wait two minutes before
                requesting another link.
              </p>

              <button
                type="button"
                className="button secondary full"
                onClick={() => setMessage("")}
              >
                Request another link
              </button>
            </>
          ) : (
            <form onSubmit={submit} aria-busy={busy}>
              <div className="field">
                <label htmlFor="recovery-email">Email address</label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  maxLength={150}
                  required
                  disabled={busy}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                />
              </div>

              {error && (
                <p className="error-box" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="button full"
                disabled={busy}
              >
                {busy ? "Requesting link…" : "Send reset link"}
              </button>
            </form>
          )}

          <p>
            <Link className="text-link" to="/login">
              Back to login
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}