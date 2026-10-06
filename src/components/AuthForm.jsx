import { useRef, useState } from "react";

import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { safeNext } from "../utils/storage.js";

export default function AuthForm({ signupMode = false }) {
  const {
    user,
    loading: authLoading,
    authError,
    retrySession,
    login,
    register,
  } = useAuth();

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [data, setData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  function updateField(field, value) {
    setData((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();

    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError("");

    try {
      const email = data.email.trim().toLowerCase();
      const password = data.password;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }

      if (!password) {
        throw new Error("Enter your password.");
      }

      if (signupMode) {
        const name = data.name.trim();
        const phone = data.phone.replace(/\D/g, "");

        if (name.length < 2 || name.length > 60) {
          throw new Error("Your name must contain 2–60 characters.");
        }

        if (phone && !/^[6-9]\d{9}$/.test(phone)) {
          throw new Error("Enter a valid 10-digit Indian mobile number.");
        }

        if (password.length < 8) {
          throw new Error("Password must contain at least 8 characters.");
        }

        if (new TextEncoder().encode(password).length > 72) {
          throw new Error("Password cannot exceed 72 UTF-8 bytes.");
        }

        if (password !== data.confirmPassword) {
          throw new Error("Your passwords do not match.");
        }

        await register({ name, email, phone, password });
      } else {
        await login({ email, password });
      }

      navigate(next, { replace: true });
    } catch (error) {
      setError(
        error.message ||
          (signupMode
            ? "Unable to create your account."
            : "Unable to sign in.")
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="auth-page">
        <section className="auth-card">
          <div className="auth-form" role="status">
            <h2>Checking your account…</h2>
            <p className="muted">Please wait a moment.</p>
          </div>
        </section>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="auth-page">
        <section className="auth-card">
          <div className="auth-form">
            <h2>Unable to check your session</h2>
            <p className="error-box" role="alert">
              {authError}
            </p>
            <button
              type="button"
              className="button full"
              onClick={retrySession}
            >
              Try again
            </button>
            <p>
              <Link className="text-link" to="/shop">
                Continue shopping
              </Link>
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (user) {
    return <Navigate to={next} replace />;
  }

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

        <form
          className="auth-form"
          onSubmit={submit}
          aria-busy={busy}
        >
          <h2>
            {signupMode ? "Create an account" : "Login"}{" "}
            <span>to GymDrobe</span>
          </h2>

          <p className="muted">
            {signupMode
              ? "Manage your orders, addresses and favourites in one place."
              : "Access your orders, saved addresses and favourites."}
          </p>

          {signupMode && (
            <div className="field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                name="name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={60}
                required
                disabled={busy}
                value={data.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              maxLength={150}
              required
              disabled={busy}
              value={data.email}
              onChange={(event) =>
                updateField("email", event.target.value)
              }
            />
          </div>

          {signupMode && (
            <div className="field">
              <label htmlFor="auth-phone">
                Mobile number (optional)
              </label>
              <input
                id="auth-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="10-digit Indian mobile number"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                disabled={busy}
                value={data.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-password">Password</label>

            <div className="password-field">
              <input
                id="auth-password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete={
                  signupMode ? "new-password" : "current-password"
                }
                minLength={signupMode ? 8 : 1}
                maxLength={signupMode ? 72 : undefined}
                required
                disabled={busy}
                value={data.password}
                aria-describedby={
                  signupMode ? "auth-password-hint" : undefined
                }
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
              />

              <button
                type="button"
                disabled={busy}
                aria-label={
                  visible ? "Hide passwords" : "Show passwords"
                }
                aria-pressed={visible}
                onClick={() => setVisible((current) => !current)}
              >
                {visible ? "Hide" : "Show"}
              </button>
            </div>

            {signupMode && (
              <small id="auth-password-hint">
                Use at least 8 characters and a password you haven’t
                used elsewhere.
              </small>
            )}
          </div>

          {signupMode && (
            <div className="field">
              <label htmlFor="auth-confirm-password">
                Confirm password
              </label>
              <input
                id="auth-confirm-password"
                name="confirmPassword"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                disabled={busy}
                value={data.confirmPassword}
                onChange={(event) =>
                  updateField("confirmPassword", event.target.value)
                }
              />
            </div>
          )}

          {!signupMode && (
            <p>
              <Link className="text-link" to="/forgot-password">
                Forgot password?
              </Link>
            </p>
          )}

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
            {busy
              ? signupMode
                ? "Creating account…"
                : "Logging in…"
              : signupMode
                ? "Create account"
                : "Login"}
          </button>

          <p>
            {signupMode ? "Already registered?" : "New to GymDrobe?"}{" "}
            <Link
              className="text-link"
              to={`${
                signupMode ? "/login" : "/signup"
              }?next=${encodeURIComponent(next)}`}
            >
              {signupMode ? "Login" : "Create an account"}
            </Link>
          </p>

          {!signupMode && (
            <p className="muted">
              Sign in using your registered email address and password.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}