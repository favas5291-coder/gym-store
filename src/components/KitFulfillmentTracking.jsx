import { money } from "../utils/productPricing.js";

import "./KitFulfillment.css";

const LABELS = {
  "awaiting-setup": "Preparation details pending",
  collecting: "Collecting items",
  packing: "Packing your kit",
  packed: "Packed and checked",
  shipped: "Shipped",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const date = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("en-IN")
    : "Not recorded";

export default function KitFulfillmentTracking({ order }) {
  if (!order?.kitSnapshots?.length) {
    return null;
  }

  const progress = order.fulfillmentProgress;
  const snapshot = order.shippingSnapshot;

  return (
    <section
      className="panel gd-kit-progress"
      aria-label="Fitness Kit package tracking"
    >
      <h2>Kit delivery progress</h2>

      <p>
        <strong>
          {order.status === "cancelled"
            ? "Cancelled"
            : LABELS[progress?.stage] ||
              "Preparation details pending"}
        </strong>
      </p>

      {!progress && (
        <p>
          Package progress has not been recorded yet.
          Check again or contact support with your order number.
        </p>
      )}

      {progress?.parcels.map((parcel) => {
        const original = snapshot?.shipments.find(
          (row) => row.key === parcel.key,
        );

        const balance = original
          ? original.amountDuePaise - parcel.codCollectedPaise
          : null;

        return (
          <article
            className="gd-kit-progress-card"
            key={parcel.key}
          >
            <h3>
              {original?.label || "Package"}
              {" · "}
              {LABELS[parcel.status] || parcel.status}
            </h3>

            <ul>
              {original?.contents.map((row) => (
                <li key={row.itemIndex}>
                  {row.name}
                  {" · "}
                  {[
                    row.selectedColor,
                    row.selectedSize,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "Default variant"}
                  {" · "}
                  Qty {row.quantity}
                </li>
              ))}
            </ul>

            {parcel.carrier && (
              <p>Courier: {parcel.carrier}</p>
            )}

            {parcel.trackingNumber && (
              <p>
                Tracking number:{" "}
                <strong
                  style={{ overflowWrap: "anywhere" }}
                >
                  {parcel.trackingNumber}
                </strong>
              </p>
            )}

            {parcel.estimatedDelivery &&
              parcel.status !== "delivered" && (
                <p>
                  Estimated delivery:{" "}
                  {date(parcel.estimatedDelivery)}
                </p>
              )}

            {parcel.deliveredAt && (
              <p>
                Recorded delivered:{" "}
                {date(parcel.deliveredAt)}
              </p>
            )}

            {snapshot?.paymentMethod === "cod-partial" &&
              balance != null &&
              order.status !== "cancelled" && (
                <p>
                  {balance > 0 ? (
                    <>
                      Balance due for this package:{" "}
                      <strong>
                        {money(balance / 100)}
                      </strong>
                    </>
                  ) : (
                    "This package’s recorded COD balance is collected."
                  )}
                </p>
              )}
          </article>
        );
      })}

      {progress &&
        progress.stage !== "delivered" &&
        order.status !== "cancelled" && (
          <p className="muted">
            Your complete order is delivered when every package
            is recorded as delivered.
          </p>
        )}
    </section>
  );
}