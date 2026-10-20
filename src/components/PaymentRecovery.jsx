import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  checkRazorpayPayment,
} from "../services/paymentApi.js";

export default function PaymentRecovery({
  order,
  token,
  admin = false,
  disabled = false,
  onUpdated,
  onBusyChange,
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const lock = useRef(false);
  const mounted = useRef(false);
  const controller = useRef(null);

  const id = String(
    order?.orderNumber || order?.id || "",
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  if (
    order?.status !== "payment-pending" ||
    !["razorpay", "cod-partial"].includes(
      order?.payment?.method ||
        order?.paymentMethod,
    )
  ) {
    return null;
  }

  async function check() {
    if (lock.current || disabled || !id) {
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");
    setMessage("");

    onBusyChange?.(true);

    controller.current = new AbortController();

    let verified = false;

    try {
      const result = await checkRazorpayPayment(
        token,
        id,
        {
          admin,
          signal: controller.current.signal,
        },
      );

      if (!mounted.current) {
        return;
      }

      verified = result.state === "verified";

      setMessage(result.message);

      if (
        verified ||
        result.state === "review"
      ) {
        await onUpdated?.(result);
      }
    } catch (failure) {
      if (!mounted.current) {
        return;
      }

      setError(
        verified
          ? "Payment was verified, but this page could not refresh. Reload the order. Do not pay again."
          : failure.message ||
              "Payment could not be checked. Do not pay again; contact support.",
      );
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }

  return (
    <div
      className="notice gd-payment-recovery"
      style={{
        overflowWrap: "anywhere",
      }}
    >
      <p>
        <strong>
          {admin
            ? "Verify this existing payment"
            : "Already paid?"}
        </strong>
      </p>

      <p>
        Check the existing order directly with Razorpay.
        If money was deducted, do not pay again while
        confirmation is pending.
      </p>

      <button
        type="button"
        className="button secondary"
        style={{
          minHeight: 44,
          whiteSpace: "normal",
          maxWidth: "100%",
        }}
        disabled={busy || disabled || !id}
        onClick={check}
        aria-busy={busy}
      >
        {busy
          ? "Checking payment…"
          : "Check payment with Razorpay"}
      </button>

      {message && (
        <p role="status">
          {message}
        </p>
      )}

      {error && (
        <p
          className="field-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}