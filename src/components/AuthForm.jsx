import { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getGoogleChallenge } from "../services/authApi.js";
import { safeNext } from "../utils/storage.js";

const GOOGLE_CLIENT_ID = (
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "1098658899656-34u0lfqcfucgf8dgq0c9oag6q673mtnu.apps.googleusercontent.com"
).trim();

let googleScriptPromise;

function scriptError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const id = "gymdrobe-google-identity";
    let script = document.getElementById(id);
    let settled = false;

    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
    }

    const timer = setTimeout(() => {
      finish(
        scriptError(
          "Google sign-in took too long to load.",
          "GOOGLE_SCRIPT_TIMEOUT"
        )
      );
    }, 20000);

    function finish(error) {
      if (settled) return;
      settled = true;

      clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);

      if (error) {
        script.remove();
        reject(error);
      } else {
        resolve();
      }
    }

    function onLoad() {
      if (window.google?.accounts?.id) {
        finish();
      } else {
        finish(
          scriptError(
            "Google sign-in could not load.",
            "GOOGLE_SCRIPT_FAILED"
          )
        );
      }
    }

    function onError() {
      finish(
        scriptError(
          "Your browser could not load Google sign-in.",
          "GOOGLE_SCRIPT_FAILED"
        )
      );
    }

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!script.isConnected) document.head.appendChild(script);
  }).catch((error) => {
    googleScriptPromise = undefined;
    throw error;
  });

  return googleScriptPromise;
}

function describeError(error) {
  const code =
    error.code ||
    (error.status === 429
      ? "TOO_MANY_ATTEMPTS"
      : error.status >= 500
        ? "SERVICE_UNAVAILABLE"
        : "REQUEST_FAILED");

  const descriptions = {
    OFFLINE: [
      "You appear to be offline",
      "Reconnect to Wi-Fi or mobile data, then try again.",
    ],
    CONNECTION_FAILED: [
      "Could not reach GymDrobe",
      "Check your connection and retry. If other websites work, GymDrobe may be temporarily unavailable.",
    ],
    REQUEST_TIMEOUT: [
      "Sign-in took too long",
      "The server did not respond in time. Wait a moment, then restart Google sign-in.",
    ],
    GOOGLE_SCRIPT_TIMEOUT: [
      "Google sign-in took too long to load",
      "Check your connection, then retry.",
    ],
    GOOGLE_SCRIPT_FAILED: [
      "Google sign-in could not load",
      "Retry in Chrome or Safari. If needed, check whether a browser extension is blocking Google sign-in.",
    ],
    SIGNIN_EXPIRED: [
      "Your sign-in attempt expired",
      "Restart Google sign-in and select your account again.",
    ],
    SIGNIN_RESTART_REQUIRED: [
      "Start a new sign-in attempt",
      "Restart Google sign-in to continue.",
    ],
    GOOGLE_VERIFICATION_FAILED: [
      "Google sign-in could not be verified",
      "Restart Google sign-in. If this continues, contact GymDrobe support.",
    ],
    GOOGLE_EMAIL_UNVERIFIED: [
      "Your Google email is not verified",
      "Verify your email with Google or choose a verified Google account.",
    ],
    GOOGLE_EMAIL_INVALID: [
      "A usable email address is required",
      "Choose another Google account or contact support.",
    ],
    ACCOUNT_DISABLED: [
      "Your GymDrobe account is disabled",
      "Contact GymDrobe support for help accessing this account.",
    ],
    GOOGLE_ACCOUNT_CONFLICT: [
      "Use your linked Google account",
      "This GymDrobe account is linked to another Google account. Choose that account or contact support.",
    ],
    ACCOUNT_LINK_REQUIRED: [
      "Connect your existing account",
      error.message ||
        "Enter your existing GymDrobe password once to connect Google.",
    ],
    ACCOUNT_CHANGED: [
      "Your account changed during sign-in",
      "Restart Google sign-in to continue.",
    ],
    LOGIN_UNAVAILABLE: [
      "Google sign-in is temporarily unavailable",
      "Please try again later. If this continues, contact GymDrobe support.",
    ],
    GOOGLE_UNAVAILABLE: [
      "Google verification is temporarily unavailable",
      "Please wait a moment, then try again.",
    ],
    SERVICE_UNAVAILABLE: [
      "GymDrobe is temporarily unavailable",
      "Please try again later or contact support.",
    ],
    INVALID_RESPONSE: [
      "Sign-in could not be completed",
      "GymDrobe returned an unexpected response. Retry or contact support.",
    ],
    ACCOUNT_DATA_INVALID: [
      "Your account could not be saved",
      "Contact GymDrobe support for help.",
    ],
    SESSION_EXPIRED: [
      "Please sign in again",
      "Your previous session has expired.",
    ],
    TOO_MANY_ATTEMPTS: [
      "Too many sign-in attempts",
      error.retryAfterSeconds > 0
        ? `Please wait about ${Math.ceil(
            error.retryAfterSeconds / 60
          )} minute(s) before trying again.`
        : "Please wait a few minutes before trying again.",
    ],
  };

  const [title, message] = descriptions[code] || [
    "Sign-in could not be completed",
    error.message || "Please retry or contact GymDrobe support.",
  ];

  return { code, title, message };
}

function ErrorNotice({ error }) {
  if (!error) return null;

  return (
    <div className="error-box" role="alert">
      <strong>{error.title}</strong>
      <p style={{ marginBottom: 0 }}>{error.message}</p>
    </div>
  );
}

export default function AuthForm() {
  const {
    user,
    loading: authLoading,
    authError,
    retrySession,
    googleLogin,
  } = useAuth();

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const buttonRef = useRef(null);
  const pendingCredentials = useRef(null);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const callbackRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [linkRequired, setLinkRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      pendingCredentials.current = null;
    };
  }, []);

  async function completeLogin(credentials) {
    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError(null);

    try {
      await googleLogin(credentials);

      if (mounted.current) {
        pendingCredentials.current = null;
        setPassword("");
        navigate(next, { replace: true });
      }
    } catch (loginError) {
      if (!mounted.current) return;

      setError(describeError(loginError));

      if (loginError.code === "ACCOUNT_LINK_REQUIRED") {
        pendingCredentials.current = {
          credential: credentials.credential,
          challenge: credentials.challenge,
        };

        setLinkRequired(true);
      } else {
        pendingCredentials.current = null;
        setLinkRequired(false);
      }

      setPassword("");
      setVisible(false);
    } finally {
      submitting.current = false;

      if (mounted.current) setBusy(false);
    }
  }

  callbackRef.current = completeLogin;

  useEffect(() => {
    if (authLoading || authError || user || linkRequired) return;

    let cancelled = false;
    const controller = new AbortController();
    let expiryTimer;

    setReady(false);
    buttonRef.current?.replaceChildren();

    async function prepareGoogle() {
      try {
        const [, challengeData] = await Promise.all([
          loadGoogleScript(),
          getGoogleChallenge({ signal: controller.signal }),
        ]);

        if (cancelled || !buttonRef.current) return;

        const container = buttonRef.current;
        container.replaceChildren();

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: challengeData.nonce,
          auto_select: false,
          ux_mode: "popup",

          callback(response) {
            if (cancelled) return;

            if (!response.credential) {
              setError({
                code: "GOOGLE_VERIFICATION_FAILED",
                title: "Google did not complete sign-in",
                message: "Please restart Google sign-in and select your account.",
              });
              return;
            }

            callbackRef.current({
              credential: response.credential,
              challenge: challengeData.challenge,
            });
          },
        });

        const width = Math.max(
          200,
          Math.min(
            400,
            Math.floor(container.getBoundingClientRect().width)
          )
        );

        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width,
          logo_alignment: "left",
        });

        setReady(true);

        expiryTimer = setTimeout(() => {
          if (!cancelled && !submitting.current) {
            setAttempt((value) => value + 1);
          }
        }, 8 * 60000);
      } catch (setupError) {
        if (cancelled || setupError.name === "AbortError") return;

        setReady(false);
        setError(describeError(setupError));
      }
    }

    prepareGoogle();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(expiryTimer);
    };
  }, [authLoading, authError, user, linkRequired, attempt]);

  function restartGoogle() {
    if (submitting.current) return;

    pendingCredentials.current = null;
    setLinkRequired(false);
    setPassword("");
    setVisible(false);
    setError(null);
    setReady(false);
    setAttempt((value) => value + 1);
  }

  function submitLink(event) {
    event.preventDefault();

    if (!pendingCredentials.current) {
      restartGoogle();
      return;
    }

    if (!password) {
      setError({
        code: "ACCOUNT_LINK_REQUIRED",
        title: "Your existing password is required",
        message: "Enter your old GymDrobe password to connect this account.",
      });
      return;
    }

    completeLogin({
      ...pendingCredentials.current,
      existingPassword: password,
    });
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
              Retry session check
            </button>

            <p>
              <Link className="text-link" to="/shop">
                Continue shopping
              </Link>
            </p>

            <p>
              <Link className="text-link" to="/help">
                Contact GymDrobe support
              </Link>
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (user) return <Navigate to={next} replace />;

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-banner">
          <span>THE GYMDROBE CLUB</span>
          <h1>Your favourites. All together.</h1>
          <p>Good gear. Great sessions.</p>
        </div>

        <div className="auth-form" aria-busy={busy}>
          <h2>
            Welcome <span>to GymDrobe</span>
          </h2>

          <p className="muted">
            Sign in with Google to access your orders, saved addresses
            and favourites. New here? Your account is created automatically.
          </p>

          {!linkRequired && (
            <>
              <div
                ref={buttonRef}
                style={{
                  width: "100%",
                  minHeight: 44,
                  marginTop: 24,
                  marginBottom: 16,
                  pointerEvents: busy ? "none" : "auto",
                  visibility: busy ? "hidden" : "visible",
                }}
                inert={busy ? true : undefined}
              />

              {!ready && !error && !busy && (
                <p className="muted" role="status">
                  Preparing Google sign-in…
                </p>
              )}
            </>
          )}

          {linkRequired && (
            <form onSubmit={submitLink}>
              <h3>Connect your existing account</h3>

              <p className="muted">
                Enter your old GymDrobe password once to keep your
                existing orders and account details. After connecting,
                use Google to sign in.
              </p>

              <div className="field">
                <label htmlFor="google-link-password">
                  Existing GymDrobe password
                </label>

                <div className="password-field">
                  <input
                    id="google-link-password"
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    value={password}
                    aria-invalid={
                      error?.code === "ACCOUNT_LINK_REQUIRED"
                        ? true
                        : undefined
                    }
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                  />

                  <button
                    type="button"
                    disabled={busy}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    onClick={() => setVisible((value) => !value)}
                  >
                    {visible ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="button full"
                disabled={busy}
              >
                {busy ? "Connecting…" : "Connect Google account"}
              </button>
            </form>
          )}

          {busy && (
            <p role="status" className="muted">
              Signing you in…
            </p>
          )}

          <ErrorNotice error={error} />

          {(error || linkRequired) && (
            <button
              type="button"
              className="button secondary full"
              disabled={busy}
              onClick={restartGoogle}
            >
              Restart Google sign-in
            </button>
          )}

          <p className="muted">
            Your Google password stays with Google.
          </p>

          <p>
            <Link className="text-link" to="/shop">
              Continue shopping
            </Link>
          </p>

          <p>
            <Link className="text-link" to="/help">
              Need help? Contact GymDrobe support
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}