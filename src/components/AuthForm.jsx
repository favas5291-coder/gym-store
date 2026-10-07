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

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "1098658899656-34u0lfqcfucgf8dgq0c9oag6q673mtnu.apps.googleusercontent.com";

let googleScriptPromise;

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const id = "gymdrobe-google-identity";
    let script = document.getElementById(id);

    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
    }

    const timer = setTimeout(() => {
      finish(new Error("Google sign-in took too long to load. Please retry."));
    }, 20000);

    function finish(error) {
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
        finish(new Error("Google sign-in could not load. Please retry."));
      }
    }

    function onError() {
      finish(
        new Error(
          "Unable to load Google sign-in. Check your connection and retry."
        )
      );
    }

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!script.isConnected) {
      document.head.appendChild(script);
    }
  }).catch((error) => {
    googleScriptPromise = undefined;
    throw error;
  });

  return googleScriptPromise;
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
  const [error, setError] = useState("");
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
    setError("");

    try {
      await googleLogin(credentials);

      if (mounted.current) {
        pendingCredentials.current = null;
        setPassword("");
        navigate(next, { replace: true });
      }
    } catch (loginError) {
      if (!mounted.current) return;

      if (loginError.code === "ACCOUNT_LINK_REQUIRED") {
        pendingCredentials.current = {
          credential: credentials.credential,
          challenge: credentials.challenge,
        };

        setLinkRequired(true);
        setPassword("");
        setError(loginError.message);
      } else {
        setError(loginError.message || "Unable to sign in.");

        // Verification failures require a fresh Google attempt.
        if (
          loginError.status === 401 ||
          loginError.status === 400
        ) {
          pendingCredentials.current = null;
          setLinkRequired(false);
          setPassword("");
          setAttempt((value) => value + 1);
        }
      }
    } finally {
      submitting.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  callbackRef.current = completeLogin;

  useEffect(() => {
    if (authLoading || authError || user || linkRequired) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    let expiryTimer;

    setReady(false);

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
            if (cancelled || !response.credential) return;

            callbackRef.current({
              credential: response.credential,
              challenge: challengeData.challenge,
            });
          },
        });

        const width = Math.max(
          200,
          Math.min(400, Math.floor(container.getBoundingClientRect().width))
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

        // Refresh before the backend challenge expires.
        expiryTimer = setTimeout(() => {
          if (!cancelled && !submitting.current) {
            setAttempt((value) => value + 1);
          }
        }, 8 * 60000);
      } catch (setupError) {
        if (cancelled || setupError.name === "AbortError") return;

        setReady(false);
        setError(
          setupError.message || "Google sign-in is temporarily unavailable."
        );
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
    setError("");
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
      setError("Enter your existing GymDrobe password.");
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

              {!ready && !error && (
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
                Enter your old GymDrobe password once to keep your existing
                orders and account details. After linking, use Google to sign in.
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
                    onChange={(event) => setPassword(event.target.value)}
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

          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}

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
        </div>
      </section>
    </div>
  );
}