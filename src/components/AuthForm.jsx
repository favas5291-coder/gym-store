import {
  useState,
} from "react";

import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  safeNext,
} from "../utils/storage.js";


export default function AuthForm({
  signupMode = false,
}) {
  const {
    user,
    loading: authLoading,
    login,
    register,
  } = useAuth();

  const navigate =
    useNavigate();

  const [params] =
    useSearchParams();

  const next =
    safeNext(
      params.get("next")
    );

  const [
    data,
    setData,
  ] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [
    visible,
    setVisible,
  ] = useState(false);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  // ======================================================
  // INPUT CHANGE
  // ======================================================

  function updateField(
    field,
    value
  ) {
    setData(
      (current) => ({
        ...current,
        [field]: value,
      })
    );

    if (error) {
      setError("");
    }
  }


  // ======================================================
  // SUBMIT LOGIN / REGISTER
  // ======================================================

  async function submit(
    event
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError("");
    setBusy(true);

    try {
      const email =
        data.email
          .trim()
          .toLowerCase();

      const password =
        data.password;

      if (!email) {
        throw new Error(
          "Enter your email address."
        );
      }

      if (!password) {
        throw new Error(
          "Enter your password."
        );
      }


      // ==================================================
      // REGISTER
      // ==================================================

      if (signupMode) {
        const name =
          data.name.trim();

        if (
          name.length < 2
        ) {
          throw new Error(
            "Enter your full name."
          );
        }

        if (
          password.length < 8
        ) {
          throw new Error(
            "Password must contain at least 8 characters."
          );
        }

        await register({
          name,
          email,
          password,
        });
      }


      // ==================================================
      // LOGIN
      // ==================================================

      else {
        await login({
          email,
          password,
        });
      }


      // Authentication succeeded.
      // Go back to the page the
      // customer originally wanted.

      navigate(
        next,
        {
          replace: true,
        }
      );

    } catch (error) {
      console.error(
        signupMode
          ? "Registration error:"
          : "Login error:",
        error
      );

      setError(
        error.message ||
          (
            signupMode
              ? "Unable to create your account."
              : "Unable to login."
          )
      );

    } finally {
      setBusy(false);
    }
  }


  // ======================================================
  // RESTORING EXISTING JWT SESSION
  // ======================================================

  if (authLoading) {
    return (
      <div className="auth-page">
        <section className="auth-card">
          <div className="auth-form">
            <h2>
              Checking your
              account...
            </h2>

            <p className="muted">
              Please wait a moment.
            </p>
          </div>
        </section>
      </div>
    );
  }


  // ======================================================
  // ALREADY LOGGED IN
  // ======================================================

  if (user) {
    return (
      <Navigate
        to={next}
        replace
      />
    );
  }


  // ======================================================
  // FORM
  // ======================================================

  return (
    <div className="auth-page">

      <section className="auth-card">

        {/* LEFT / BANNER */}

        <div className="auth-banner">

          <span>
            THE GYMDROBE CLUB
          </span>

          <h1>
            {
              signupMode
                ? "Your next chapter starts here."
                : "Your favourites. All together."
            }
          </h1>

          <p>
            Good gear. Great sessions.
          </p>

        </div>


        {/* FORM */}

        <form
          className="auth-form"
          onSubmit={submit}
        >

          <h2>
            {
              signupMode
                ? "Create an account"
                : "Login"
            }{" "}

            <span>
              to GymDrobe
            </span>
          </h2>


          <p className="muted">
            {
              signupMode
                ? "Create your GymDrobe account to manage orders, addresses and favourites."
                : "Login to access your GymDrobe account, orders and saved details."
            }
          </p>


          {/* NAME */}

          {signupMode && (

            <div className="field">

              <label
                htmlFor="auth-name"
              >
                Full name
              </label>

              <input
                id="auth-name"

                type="text"

                required

                minLength="2"

                maxLength="60"

                autoComplete="name"

                value={
                  data.name
                }

                disabled={
                  busy
                }

                onChange={(
                  event
                ) =>
                  updateField(
                    "name",
                    event.target.value
                  )
                }
              />

            </div>
          )}


          {/* EMAIL */}

          <div className="field">

            <label
              htmlFor="auth-email"
            >
              Email address
            </label>

            <input
              id="auth-email"

              type="email"

              required

              autoComplete="email"

              value={
                data.email
              }

              disabled={
                busy
              }

              onChange={(
                event
              ) =>
                updateField(
                  "email",
                  event.target.value
                )
              }
            />

          </div>


          {/* PASSWORD */}

          <div className="field">

            <label
              htmlFor="auth-password"
            >
              Password
            </label>

            <div className="password-field">

              <input
                id="auth-password"

                type={
                  visible
                    ? "text"
                    : "password"
                }

                required

                minLength={
                  signupMode
                    ? 8
                    : 1
                }

                autoComplete={
                  signupMode
                    ? "new-password"
                    : "current-password"
                }

                value={
                  data.password
                }

                disabled={
                  busy
                }

                onChange={(
                  event
                ) =>
                  updateField(
                    "password",
                    event.target.value
                  )
                }
              />


              <button
                type="button"

                disabled={
                  busy
                }

                aria-label={
                  visible
                    ? "Hide password"
                    : "Show password"
                }

                onClick={() =>
                  setVisible(
                    (current) =>
                      !current
                  )
                }
              >
                {
                  visible
                    ? "Hide"
                    : "Show"
                }
              </button>

            </div>


            {signupMode && (

              <small>
                Use at least 8
                characters.
              </small>

            )}

          </div>


          {/* ERROR */}

          {error && (

            <p
              className="error-box"
              role="alert"
            >
              {error}
            </p>

          )}


          {/* SUBMIT */}

          <button
            type="submit"

            className="button full"

            disabled={
              busy
            }
          >
            {
              busy
                ? (
                    signupMode
                      ? "Creating account…"
                      : "Logging in…"
                  )

                : (
                    signupMode
                      ? "Create account"
                      : "Login"
                  )
            }
          </button>


          {/* SWITCH LOGIN / SIGNUP */}

          <p>

            {
              signupMode
                ? "Already registered?"
                : "New to GymDrobe?"
            }{" "}


            <Link
              className="text-link"

              to={
                `${
                  signupMode
                    ? "/login"
                    : "/signup"
                }?next=${encodeURIComponent(
                  next
                )}`
              }
            >
              {
                signupMode
                  ? "Login"
                  : "Create an account"
              }
            </Link>

          </p>


          {!signupMode && (

            <p className="muted">
              Use the email and
              password you registered
              with GymDrobe.
            </p>

          )}

        </form>

      </section>

    </div>
  );
}