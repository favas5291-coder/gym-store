import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
} from "react-router-dom";

import {
  analyticsConfigured,
  getAnalyticsConsent,
  initAnalytics,
  setAnalyticsConsent,
  trackPageView,
} from "../utils/analytics.js";

export default function AnalyticsController() {
  const { pathname } = useLocation();

  const [preference, setPreference] =
    useState(getAnalyticsConsent);

  const [editing, setEditing] =
    useState(false);

  useEffect(() => {
    function update() {
      initAnalytics();
      trackPageView(pathname);

      setPreference(
        getAnalyticsConsent(),
      );
    }

    update();

    window.addEventListener(
      "gymdrobe-analytics-ready",
      update,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-analytics-ready",
        update,
      );
    };
  }, [pathname]);

  if (!analyticsConfigured) {
    return null;
  }

  function choose(value) {
    setAnalyticsConsent(value);
    setPreference(value);
    setEditing(false);
  }

  if (preference && !editing) {
    return (
      <div
        style={{
          padding: "12px 20px",
          textAlign: "center",
        }}
      >
        <button
          type="button"
          className="text-link"
          onClick={() => setEditing(true)}
        >
          Analytics preferences
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Analytics preferences"
      style={{
        padding: "20px",
        borderTop: "1px solid #ddd",
        background: "#fff",
        color: "#171717",
      }}
    >
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
        }}
      >
        <strong>
          Help improve GymDrobe
        </strong>

       <p>
  Allow optional Google Analytics to measure page visits
  and shopping activity. Google Analytics processes
  browser, device and network information. Our shopping
  events do not include your name, email, delivery
  address or payment credentials. You can change your
  choice through Analytics preferences.
</p>

        <div className="purchase-actions">
          <button
            className="button"
            type="button"
            onClick={() => choose("granted")}
          >
            Allow analytics
          </button>

          <button
            className="button secondary"
            type="button"
            onClick={() => choose("denied")}
          >
            No thanks
          </button>
        </div>
      </div>
    </section>
  );
}