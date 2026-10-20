import { useState } from "react";

// Build messages from saved customer-facing order information.
// Never include sourcing links, private access codes or unsaved edits.
export default function CustomerUpdateShare({
  order,
}) {
  const [notice, setNotice] = useState("");

  if (
    !order ||
    order.status === "payment-pending"
  ) {
    return null;
  }

  const labels = {
    confirmed:
      "Your GymDrobe order is confirmed.",

    processing: order.tracking?.packedAt
      ? "Your GymDrobe order is packed and ready for pickup."
      : "We are preparing your GymDrobe order.",

    shipped:
      "Your GymDrobe order has been shipped.",

    "out-for-delivery":
      "Your GymDrobe order is out for delivery.",

    delivered:
      "Your GymDrobe order is recorded as delivered.",

    cancelled:
      "Your GymDrobe order is cancelled. Check order details for payment and refund updates.",
  };

  const number = String(
    order.orderNumber || order.id || "",
  );

  const link =
    `${window.location.origin}/orders/` +
    `${encodeURIComponent(number)}/track`;

  const message = [
    "Hi!",

    labels[order.status] ||
      "There is an update to your GymDrobe order.",

    `Order: ${number}`,

    order.tracking?.carrier
      ? `Courier: ${order.tracking.carrier}`
      : "",

    order.tracking?.trackingNumber
      ? `Tracking number: ${order.tracking.trackingNumber}`
      : "",

    `View your saved updates: ${link}`,

    "Use your account or your private guest access code to view the order. Contact GymDrobe if you need help.",
  ]
    .filter(Boolean)
    .join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        message,
      );

      setNotice(
        "Update copied. Paste it into WhatsApp or email to notify the customer.",
      );
    } catch {
      setNotice(
        "Select and copy the message below, then paste it into WhatsApp or email.",
      );
    }
  }

  return (
    <details
      className="notice"
      style={{
        marginBlock: 16,
        overflowWrap: "anywhere",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          minHeight: 44,
        }}
      >
        Notify the customer
      </summary>

      <p>
        Copy an update from the saved order.
        Send it to the customer yourself.
      </p>

      <label>
        Customer update

        <textarea
          readOnly
          rows={7}
          value={message}
          style={{
            width: "100%",
            maxWidth: "100%",
            font: "inherit",
          }}
        />
      </label>

      <button
        type="button"
        className="button secondary"
        onClick={copy}
        style={{
          minHeight: 44,
        }}
      >
        Copy customer update
      </button>

      {notice && (
        <p role="status">
          {notice}
        </p>
      )}
    </details>
  );
}