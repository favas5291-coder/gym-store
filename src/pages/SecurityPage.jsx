import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import { getOrders } from "../services/orderApi.js";
import { getAddresses } from "../services/addressApi.js";
import { ticketsFor } from "../utils/support.js";
import { downloadText } from "../utils/commerce.js";

import AccountLayout from "../components/AccountLayout.jsx";

// Remove authentication information if an API response
// accidentally includes it in a nested record.
const privateFields = new Set([
  "password",
  "passwordHash",
  "passwordResetToken",
  "passwordResetExpires",
  "passwordResetRequestedAt",
  "authVersion",
  "googleId",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "credential",
  "authorization",
]);

function removePrivateData(value) {
  if (Array.isArray(value)) {
    return value.map(removePrivateData);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !privateFields.has(key))
        .map(([key, item]) => [key, removePrivateData(item)])
    );
  }

  return value;
}

export default function SecurityPage() {
  const { user, token } = useAuth();
  const { notify } = useStore();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");

  const mounted = useRef(false);
  const exportBusy = useRef(false);
  const currentSession = useRef({ token, userId: user?.id });

  currentSession.current = {
    token,
    userId: user?.id,
  };

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  async function downloadAccountData() {
    if (exportBusy.current) return;

    if (!token || !user?.id) {
      setExportError(
        "Your sign-in session has expired. Please sign in again."
      );
      return;
    }

    const exportToken = token;
    const exportUser = user;

    function sessionIsCurrent() {
      return (
        mounted.current &&
        currentSession.current.token === exportToken &&
        currentSession.current.userId === exportUser.id
      );
    }

    exportBusy.current = true;
    setExporting(true);
    setExportError("");
    setExportSuccess("");

    try {
      const [orderResult, addressResult] =
        await Promise.allSettled([
          getOrders(exportToken),
          getAddresses(exportToken),
        ]);

      if (!sessionIsCurrent()) return;

      if (orderResult.status !== "fulfilled") {
        throw new Error(
          orderResult.reason?.message ||
            "Orders could not be loaded."
        );
      }

      if (addressResult.status !== "fulfilled") {
        throw new Error(
          addressResult.reason?.message ||
            "Addresses could not be loaded."
        );
      }

      // These services are expected to return arrays.
      // Do not silently export empty data for an invalid response.
      if (!Array.isArray(orderResult.value)) {
        throw new Error(
          "The order response could not be read. Please try again."
        );
      }

      if (!Array.isArray(addressResult.value)) {
        throw new Error(
          "The address response could not be read. Please try again."
        );
      }

      const supportRecords = ticketsFor(exportUser);

      if (!Array.isArray(supportRecords)) {
        throw new Error(
          "Support records could not be read. Please try again."
        );
      }

      const profile = {
        id: exportUser.id,
        name: exportUser.name || "",
        email: exportUser.email || "",
        phone: exportUser.phone || "",
        role: exportUser.role || "customer",
        createdAt: exportUser.createdAt || null,
        updatedAt: exportUser.updatedAt || null,
      };

      const exportData = removePrivateData({
        exportedAt: new Date().toISOString(),
        profile,
        addresses: addressResult.value,
        orders: orderResult.value,
        support: supportRecords,
        exportNotes: {
          support:
            "Support records available through this browser's support helper.",
        },
      });

      if (!sessionIsCurrent()) return;

      downloadText(
        "GymDrobe-my-account.json",
        JSON.stringify(exportData, null, 2),
        "application/json"
      );

      setExportSuccess(
        "Your account-data download has been prepared."
      );

      notify("Your account-data download has been prepared.");
    } catch (error) {
      if (!sessionIsCurrent()) return;

      setExportError(
        error.message || "Unable to download your account data."
      );
    } finally {
      exportBusy.current = false;

      if (mounted.current) {
        setExporting(false);
      }
    }
  }

  const accountFields = [
    ["Name", user?.name || "—"],
    ["Email", user?.email || "—"],
    ["Mobile", user?.phone || "Not added"],
    [
      "Account type",
      user?.role === "admin" ? "Administrator" : "Customer",
    ],
  ];

  return (
    <AccountLayout title="Account security & data">
      <div className="notice">
        <strong>Sign in to GymDrobe with Google.</strong>

        <p className="muted" style={{ marginBottom: 0 }}>
          Use your Google account to access your GymDrobe profile,
          saved addresses and account orders.
        </p>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <p className="eyebrow">SIGN-IN & SECURITY</p>

        <h3>Manage your Google account</h3>

        <p className="muted">
          Manage your Google password, recovery options and
          two-step verification in your Google Account settings.
          GymDrobe does not receive your Google password.
        </p>

        <a
          href="https://myaccount.google.com/security"
          target="_blank"
          rel="noopener noreferrer"
          className="button secondary"
        >
          Open Google security settings
          <span className="sr-only"> (opens in a new tab)</span>
        </a>

        <p className="muted" style={{ marginTop: 16 }}>
          Make sure you select the Google account you use to
          sign in to GymDrobe.
        </p>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <p className="eyebrow">ACCOUNT</p>

        <h3>Account information</h3>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            gap: 16,
            marginTop: 18,
          }}
        >
          {accountFields.map(([label, value]) => (
            <div key={label} style={{ minWidth: 0 }}>
              <dt className="muted">{label}</dt>

              <dd
                style={{
                  margin: "8px 0 0",
                  fontWeight: 700,
                  overflowWrap: "anywhere",
                }}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <Link to="/account" className="button secondary">
          Edit profile
        </Link>
      </section>

      <section
        className="panel account-export"
        style={{ marginTop: 20 }}
        aria-busy={exporting}
      >
        <p className="eyebrow">YOUR DATA</p>

        <h3>Download account data</h3>

        <p className="muted">
          Download a JSON copy of your GymDrobe profile,
          saved addresses and orders, along with support records
          available in this browser.
        </p>

        <p className="muted">
          Passwords and sign-in tokens are excluded. This file
          contains personal information, so keep it private.
        </p>

        {exportError && (
          <p className="field-error" role="alert">
            {exportError}
          </p>
        )}

        {exportSuccess && (
          <p className="notice" role="status">
            {exportSuccess}
          </p>
        )}

        {exporting && (
          <p className="muted" role="status">
            Preparing your account data…
          </p>
        )}

        <button
          className="button secondary"
          type="button"
          disabled={exporting}
          onClick={downloadAccountData}
        >
          {exporting
            ? "Preparing download…"
            : "Download my account data"}
        </button>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <p className="eyebrow">ACCOUNT HELP</p>

        <h3>Need help accessing your account?</h3>

        <p className="muted">
          For Google sign-in or password recovery, use Google's
          account recovery page. For GymDrobe orders or profile
          questions, contact our support team.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <a
            href="https://accounts.google.com/signin/recovery"
            target="_blank"
            rel="noopener noreferrer"
            className="button secondary"
          >
            Google account recovery
            <span className="sr-only"> (opens in a new tab)</span>
          </a>

          <Link to="/help" className="button secondary">
            GymDrobe support
          </Link>
        </div>
      </section>
    </AccountLayout>
  );
}