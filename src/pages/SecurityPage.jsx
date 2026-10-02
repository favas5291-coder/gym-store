import {
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  getOrders,
} from "../services/orderApi.js";

import {
  getAddresses,
} from "../services/addressApi.js";

import {
  ticketsFor,
} from "../utils/support.js";

import {
  downloadText,
} from "../utils/commerce.js";

import AccountLayout from "../components/AccountLayout.jsx";


// ======================================================
// SECURITY PAGE
// ======================================================

export default function SecurityPage() {
  const {
    user,
    token,
    changePassword,
  } =
    useAuth();


  const {
    notify,
  } =
    useStore();


  // ====================================================
  // PASSWORD FORM
  // ====================================================

  const [
    current,
    setCurrent,
  ] =
    useState("");


  const [
    next,
    setNext,
  ] =
    useState("");


  const [
    confirmation,
    setConfirmation,
  ] =
    useState("");


  const [
    busy,
    setBusy,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    success,
    setSuccess,
  ] =
    useState("");


  // ====================================================
  // EXPORT
  // ====================================================

  const [
    exporting,
    setExporting,
  ] =
    useState(
      false
    );


  const [
    exportError,
    setExportError,
  ] =
    useState("");


  // ====================================================
  // CHANGE PASSWORD
  // ====================================================

  async function submit(
    event
  ) {
    event.preventDefault();


    if (
      busy
    ) {
      return;
    }


    setError(
      ""
    );

    setSuccess(
      ""
    );


    if (
      !current
    ) {
      setError(
        "Enter your current password."
      );

      return;
    }


    if (
      next.length <
      8
    ) {
      setError(
        "New password must contain at least 8 characters."
      );

      return;
    }


    if (
      next.length >
      128
    ) {
      setError(
        "New password cannot exceed 128 characters."
      );

      return;
    }


    if (
      current ===
      next
    ) {
      setError(
        "Choose a new password that is different from your current password."
      );

      return;
    }


    if (
      next !==
      confirmation
    ) {
      setError(
        "The new passwords do not match."
      );

      return;
    }


    setBusy(
      true
    );


    try {
      const result =
        await changePassword(
          current,
          next
        );


      if (
        !result?.success
      ) {
        setError(
          result?.message ||
            "Unable to change password."
        );

        return;
      }


      setCurrent(
        ""
      );

      setNext(
        ""
      );

      setConfirmation(
        ""
      );


      setError(
        ""
      );


      setSuccess(
        result.message ||
          "Password changed successfully."
      );


      notify(
        "Password changed successfully."
      );

    } catch (
      changeError
    ) {
      console.error(
        "Password change error:",
        changeError
      );


      setError(
        changeError.message ||
          "Unable to change password."
      );

    } finally {
      setBusy(
        false
      );
    }
  }


  // ====================================================
  // DOWNLOAD ACCOUNT DATA
  // ====================================================

  async function downloadAccountData() {
    if (
      exporting
    ) {
      return;
    }


    if (
      !token
    ) {
      setExportError(
        "Your sign-in session has expired. Please sign in again."
      );

      return;
    }


    setExporting(
      true
    );

    setExportError(
      ""
    );


    try {
      const [
        orderResult,
        addressResult,
      ] =
        await Promise.allSettled([
          getOrders(
            token
          ),

          getAddresses(
            token
          ),
        ]);


      if (
        orderResult.status !==
        "fulfilled"
      ) {
        throw new Error(
          orderResult.reason
            ?.message ||
            "Orders could not be loaded."
        );
      }


      if (
        addressResult.status !==
        "fulfilled"
      ) {
        throw new Error(
          addressResult.reason
            ?.message ||
            "Addresses could not be loaded."
        );
      }


      /*
        Build the profile manually.

        Do NOT export:
        - JWT token
        - password
        - password hash
      */

      const profile = {
        id:
          user?.id ||
          null,

        name:
          user?.name ||
          "",

        email:
          user?.email ||
          "",

        phone:
          user?.phone ||
          "",

        role:
          user?.role ||
          "customer",

        createdAt:
          user?.createdAt ||
          null,

        updatedAt:
          user?.updatedAt ||
          null,
      };


      const exportData = {
        exportedAt:
          new Date().toISOString(),

        profile,

        addresses:
          Array.isArray(
            addressResult.value
          )
            ? addressResult.value
            : [],

        orders:
          Array.isArray(
            orderResult.value
          )
            ? orderResult.value
            : [],

        /*
          Support tickets still use the existing
          GymDrobe support helper.

          We can move support tickets to MongoDB
          in the support/admin phase later.
        */

        support:
          ticketsFor(
            user
          ),
      };


      downloadText(
        "GymDrobe-my-account.json",

        JSON.stringify(
          exportData,
          null,
          2
        ),

        "application/json"
      );


      notify(
        "Account data downloaded."
      );

    } catch (
      downloadError
    ) {
      console.error(
        "Account export error:",
        downloadError
      );


      setExportError(
        downloadError.message ||
          "Unable to download your account data."
      );

    } finally {
      setExporting(
        false
      );
    }
  }


  return (
    <AccountLayout
      title="Password & account data"
    >
      {/* ===============================================
          SECURITY STATUS
      =============================================== */}

      <div
        className="notice"
      >
        <strong>
          Your GymDrobe account is protected by server authentication.
        </strong>

        <p
          className="muted"
          style={{
            marginBottom:
              0,
          }}
        >
          Password changes are verified against your current password before the new password is saved.
        </p>
      </div>


      {/* ===============================================
          CHANGE PASSWORD
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "20px",
        }}
      >
        <div>
          <p
            className="eyebrow"
          >
            SECURITY
          </p>

          <h3>
            Change password
          </h3>

          <p
            className="muted"
          >
            Enter your current password before choosing a new one.
          </p>
        </div>


        <form
          className="profile-form"
          onSubmit={
            submit
          }
          style={{
            marginTop:
              "20px",
          }}
        >
          <div
            className="field"
          >
            <label
              htmlFor="current-password"
            >
              Current password
            </label>

            <input
              id="current-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength="128"
              value={
                current
              }
              onChange={
                (
                  event
                ) => {
                  setCurrent(
                    event.target
                      .value
                  );

                  setError(
                    ""
                  );

                  setSuccess(
                    ""
                  );
                }
              }
            />
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="new-password"
            >
              New password
            </label>

            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength="8"
              maxLength="128"
              value={
                next
              }
              onChange={
                (
                  event
                ) => {
                  setNext(
                    event.target
                      .value
                  );

                  setError(
                    ""
                  );

                  setSuccess(
                    ""
                  );
                }
              }
            />

            <small
              className="muted"
            >
              Use at least 8 characters.
            </small>
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="confirm-password"
            >
              Confirm new password
            </label>

            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength="8"
              maxLength="128"
              value={
                confirmation
              }
              onChange={
                (
                  event
                ) => {
                  setConfirmation(
                    event.target
                      .value
                  );

                  setError(
                    ""
                  );

                  setSuccess(
                    ""
                  );
                }
              }
            />
          </div>


          {error && (
            <p
              className="field-error"
              role="alert"
            >
              {
                error
              }
            </p>
          )}


          {success && (
            <p
              className="notice"
              role="status"
            >
              {
                success
              }
            </p>
          )}


          <button
            className="button"
            type="submit"
            disabled={
              busy
            }
          >
            {busy
              ? "Updating password…"
              : "Change password"}
          </button>
        </form>
      </section>


      {/* ===============================================
          ACCOUNT INFORMATION
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "20px",
        }}
      >
        <p
          className="eyebrow"
        >
          ACCOUNT
        </p>

        <h3>
          Account information
        </h3>


        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",

            gap:
              "16px",

            marginTop:
              "18px",
          }}
        >
          <div>
            <small
              className="muted"
            >
              Name
            </small>

            <p>
              <strong>
                {user?.name ||
                  "—"}
              </strong>
            </p>
          </div>


          <div>
            <small
              className="muted"
            >
              Email
            </small>

            <p>
              <strong>
                {user?.email ||
                  "—"}
              </strong>
            </p>
          </div>


          <div>
            <small
              className="muted"
            >
              Mobile
            </small>

            <p>
              <strong>
                {user?.phone ||
                  "Not added"}
              </strong>
            </p>
          </div>


          <div>
            <small
              className="muted"
            >
              Account type
            </small>

            <p>
              <strong>
                {user?.role ===
                "admin"
                  ? "Administrator"
                  : "Customer"}
              </strong>
            </p>
          </div>
        </div>


        <Link
          to="/account"
          className="button secondary"
        >
          Edit profile
        </Link>
      </section>


      {/* ===============================================
          ACCOUNT DATA EXPORT
      =============================================== */}

      <section
        className="panel account-export"
        style={{
          marginTop:
            "20px",
        }}
      >
        <p
          className="eyebrow"
        >
          YOUR DATA
        </p>

        <h3>
          Download account data
        </h3>


        <p
          className="muted"
        >
          Download a JSON copy of your GymDrobe profile, saved addresses, orders and current support records.
        </p>


        <p
          className="muted"
        >
          Your password, password hash and authentication token are not included.
        </p>


        {exportError && (
          <p
            className="field-error"
            role="alert"
          >
            {
              exportError
            }
          </p>
        )}


        <button
          className="button secondary"
          type="button"
          disabled={
            exporting
          }
          onClick={
            downloadAccountData
          }
        >
          {exporting
            ? "Preparing download…"
            : "Download my account data"}
        </button>
      </section>


      {/* ===============================================
          ACCOUNT SECURITY STATUS
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "20px",
        }}
      >
        <p
          className="eyebrow"
        >
          SECURITY STATUS
        </p>

        <h3>
          Current protection
        </h3>


        <div
          style={{
            display:
              "grid",

            gap:
              "10px",

            marginTop:
              "16px",
          }}
        >
          <p>
            ✓ Passwords are hashed before being stored.
          </p>

          <p>
            ✓ Current password is required before changing your password.
          </p>

          <p>
            ✓ Profile and order APIs require authentication.
          </p>

          <p>
            ✓ Password information is excluded from account-data downloads.
          </p>
        </div>
      </section>


      {/* ===============================================
          FUTURE SECURITY FEATURES
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "20px",
        }}
      >
        <p
          className="eyebrow"
        >
          COMING LATER
        </p>

        <h3>
          Additional account security
        </h3>


        <p
          className="muted"
        >
          Before the production launch, we will also add password recovery, email verification and stronger production session security.
        </p>
      </section>
    </AccountLayout>
  );
}