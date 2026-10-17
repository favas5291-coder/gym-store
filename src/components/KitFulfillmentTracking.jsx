import { useId } from "react";
import { Link } from "react-router-dom";

import {
  customerTracking,
  shipmentTracking,
  trackingText,
} from "../utils/orderTracking.js";

import {
  safeCourierUrl,
} from "../utils/courierTracking.js";

import {
  money,
} from "../utils/productPricing.js";

import {
  formatOrderDate,
  formatOrderStatus,
} from "./OrderPaymentDetails.jsx";

import "./OrderTrackingTimeline.css";

function Illustration({ stage }) {
  const art = {
    confirmed: (
      <>
        <path
          d="M9 13h4l4 20h22l5-15H15M20 39h.01M36 39h.01"
        />
        <path
          d="M25 9v12m-5-6h10"
        />
      </>
    ),

    packed: (
      <>
        <path
          d="m10 16 14-7 14 7v20l-14 7-14-7V16Z"
        />
        <path
          d="m10 16 14 7 14-7M24 23v20m-8-30 14 7v8"
        />
      </>
    ),

    shipped: (
      <>
        <path
          d="M5 14h25v22H5zM30 22h8l6 8v6H30M10 36a4 4 0 1 0 8 0m15 0a4 4 0 1 0 8 0M8 21h11M8 27h7"
        />
      </>
    ),

    "out-for-delivery": (
      <>
        <path
          d="m6 24 18-15 18 15M11 21v20h26V21M20 41V29h9v12"
        />
        <path
          d="m31 8 3-3m4 10h5"
        />
      </>
    ),

    delivered: (
      <>
        <path
          d="m11 37 5-20 15 15-20 5ZM18 9l2 5m15 0 4-4M32 5v5m9 13h4M8 13l3 3M28 36l3 5"
        />
        <path
          d="m24 23 5-3 4 4 4-5"
        />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {art[stage]}
    </svg>
  );
}

function PaymentNote({ order }) {
  const payment =
    order.payment || {};

  const due =
    payment.amountDue;

  const validDue =
    due != null &&
    due !== "" &&
    Number.isFinite(Number(due)) &&
    Number(due) >= 0;

  return (
    <p
      className="gd-track-payment"
      data-status={
        payment.status || "unknown"
      }
    >
      <span>Payment</span>

      <strong>
        {formatOrderStatus(
          payment.status,
        )}
      </strong>

      {(
        payment.method ||
        order.paymentMethod
      ) === "cod-partial" &&
        validDue &&
        order.status !== "cancelled" && (
          <>
            <span aria-hidden="true">
              {" · "}
            </span>

            {Number(due) > 0
              ? `${money(
                  Number(due),
                )} remaining on delivery`
              : "No remaining delivery balance"}
          </>
        )}
    </p>
  );
}

function Timeline({
  order,
  parcel = null,
  title,
  snapshot = null,
}) {
  const id = useId();

  const model =
    customerTracking(order, {
      parcel,
    });

  const tracking =
    parcel ||
    order.tracking ||
    {};

  const courierUrl =
    safeCourierUrl(
      tracking.courierUrl,
    );

  const carrier =
    trackingText(
      tracking.carrier,
    );

  const trackingNumber =
    trackingText(
      tracking.trackingNumber,
    );

  return (
    <article
      className={
        "gd-track-card" +
        (
          model.cancelled
            ? " is-cancelled"
            : ""
        )
      }
      aria-labelledby={id}
    >
      <header className="gd-track-heading">
        <div>
          <p className="gd-track-eyebrow">
            {title ||
              "YOUR WORKOUT ESSENTIALS"}
          </p>

          <h3 id={id}>
            {model.label}
          </h3>
        </div>

        <span className="gd-track-status">
          {model.cancelled
            ? "Cancelled"
            : model.pending
              ? "Confirmation pending"
              : model.index === 4
                ? "Delivery confirmed"
                : "Delivery progress"}
        </span>
      </header>

      <div className="gd-track-meta">
        <div>
          <span>
            Estimated delivery
          </span>

          <strong>
            {model.estimate?.label ||
              (
                model.index === 4
                  ? "Delivery recorded"
                  : model.cancelled
                    ? "Not applicable"
                    : "We’ll share an estimate when available"
              )}
          </strong>
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
        >
          <span>
            Latest saved update
          </span>

          <strong>
            {model.latest?.description ||
              "We’ll add tracking updates as your order moves forward."}
          </strong>

          {model.latest?.timestamp ? (
            <time
              dateTime={
                model.latest.timestamp
              }
            >
              {formatOrderDate(
                model.latest.timestamp,
              )}
            </time>
          ) : (
            <small>
              Update time not recorded yet
            </small>
          )}
        </div>
      </div>

      {model.pending && (
        <p
          className="gd-track-note"
          role="status"
        >
          {model.paymentReceived
            ? "Your payment is recorded. We’re waiting for order confirmation. Please don’t pay again."
            : "Awaiting payment confirmation. If money was deducted, please don’t pay again; contact support with your order number."}
        </p>
      )}

      {model.cancelled && (
        <p className="gd-track-note">
          This order is cancelled. The last
          recorded delivery progress is kept
          below for reference. Check order
          details for refund updates.
        </p>
      )}

      {model.exception && (
        <div
          className="gd-track-note is-warning"
          role="status"
        >
          <strong>
            {model.exception.type ===
            "delayed"
              ? "Delivery update: delayed"
              : "Delivery attempt unsuccessful"}
          </strong>

          <p>
            {model.exception.message ||
              "Contact support for the next delivery update."}
          </p>

          {model.exception.updatedAt && (
            <small>
              Recorded{" "}
              {formatOrderDate(
                model.exception.updatedAt,
              )}
            </small>
          )}
        </div>
      )}

      {model.estimate?.overdue &&
        !model.exception && (
          <p className="gd-track-note is-warning">
            The estimated date has passed.
            We’re waiting for an updated
            delivery estimate; the recorded
            stage is unchanged.
          </p>
        )}

      <ol
        className="gd-track-stages"
        aria-label={
          `${title || "Order"} delivery stages`
        }
      >
        {model.steps.map(
          (step, index) => (
            <li
              key={step.key}
              className={
                `gd-track-step is-${step.state}`
              }
              aria-current={
                step.state === "current" &&
                !model.cancelled
                  ? "step"
                  : undefined
              }
            >
              <div className="gd-track-art">
                <Illustration
                  stage={step.key}
                />

                {step.state ===
                  "complete" && (
                  <span
                    className="gd-track-check"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}

                {step.state ===
                  "current" &&
                  !model.cancelled &&
                  !model.pending && (
                    <span
                      className="gd-track-spark"
                      aria-hidden="true"
                    >
                      ✧
                    </span>
                  )}
              </div>

              <div className="gd-track-step-copy">
                <span className="gd-track-step-state">
                  {step.state === "current"
                    ? model.cancelled
                      ? "Last confirmed stage"
                      : "Current stage"
                    : step.state === "complete"
                      ? "Completed"
                      : step.state ===
                          "unrecorded"
                        ? "Earlier stage · time not recorded"
                        : `Step ${
                            index + 1
                          } · upcoming`}
                </span>

                <h4>
                  {step.label}
                </h4>

                <p>
                  {step.caption}
                </p>

                {step.timestamp && (
                  <time
                    dateTime={
                      step.timestamp
                    }
                  >
                    {formatOrderDate(
                      step.timestamp,
                    )}
                  </time>
                )}
              </div>
            </li>
          ),
        )}
      </ol>

      {snapshot && (
        <div className="gd-track-contents">
          <h4>
            Inside this parcel
          </h4>

          <ul>
            {(
              Array.isArray(
                snapshot.contents,
              )
                ? snapshot.contents
                : []
            ).map((item, index) => (
              <li
                key={
                  `${item.itemIndex}-${index}`
                }
              >
                <strong>
                  {item.name ||
                    order.items?.[
                      item.itemIndex
                    ]?.name ||
                    "Ordered item"}
                </strong>

                <span>
                  {[
                    item.selectedColor,
                    item.selectedSize,
                  ]
                    .filter(Boolean)
                    .join(" / ") ||
                    "Default variant"}

                  {" · "}
                  Qty {item.quantity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {snapshot &&
        order.shippingSnapshot
          ?.paymentMethod ===
          "cod-partial" &&
        order.status !== "cancelled" &&
        Number.isSafeInteger(
          snapshot.amountDuePaise,
        ) &&
        Number.isSafeInteger(
          parcel?.codCollectedPaise,
        ) &&
        snapshot.amountDuePaise >=
          parcel.codCollectedPaise && (
          <p className="gd-track-note">
            Balance due for this package:{" "}

            <strong>
              {money(
                (
                  snapshot.amountDuePaise -
                  parcel.codCollectedPaise
                ) / 100,
              )}
            </strong>

            . This balance applies only to
            this parcel.
          </p>
        )}

      <footer className="gd-track-courier">
        <div>
          <span>
            Courier
          </span>

          <strong>
            {carrier ||
              "Assigned after dispatch"}
          </strong>
        </div>

        <div>
          <span>
            Tracking number
          </span>

          <strong>
            {trackingNumber ||
              "We’ll add your tracking details after dispatch"}
          </strong>
        </div>

        {courierUrl &&
          !model.pending && (
            <a
              className="button secondary"
              href={courierUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Track with Courier

              <span className="sr-only">
                {" "}
                (opens in a new tab)
              </span>

              <span aria-hidden="true">
                ↗
              </span>
            </a>
          )}
      </footer>
    </article>
  );
}

// Keep the existing component name so current
// customer order page imports continue working.
export default function KitFulfillmentTracking({
  order,
}) {
  const id = useId();

  if (!order) {
    return null;
  }

  const packages =
    shipmentTracking(order);

  const request =
    order.returnRequest;

  return (
    <section
      className="gd-order-tracker"
      aria-labelledby={id}
    >
      <div className="gd-track-intro">
        <div>
          <p className="gd-track-eyebrow">
            A LITTLE CLOSER TO YOUR NEXT WORKOUT
          </p>

          <h2 id={id}>
            Your order’s journey
          </h2>

          <p className="gd-track-order">
            Order{" "}

            <strong>
              {order.orderNumber ||
                order.id ||
                "Number not recorded"}
            </strong>
          </p>
        </div>
      </div>

      <PaymentNote order={order} />

      {order.metadata?.demo === true && (
        <p className="gd-track-note">
          Test order · payment used Razorpay
          test mode.
        </p>
      )}

      {packages ? (
        <>
          <p className="gd-track-parcel-summary">
            {order.status === "cancelled"
              ? "Order cancelled"
              : order.status ===
                  "payment-pending"
                ? "Awaiting order confirmation"
                : packages.allDelivered
                  ? "Every parcel is recorded as delivered"
                  : `${
                      packages.delivered
                    } of ${
                      packages.count
                    } parcels delivered`}

            . Each parcel has its own tracking
            below.
          </p>

          {!packages.count && (
            <p className="gd-track-note">
              Parcel details have not been
              recorded yet. Contact support
              with your order number.
            </p>
          )}

          {packages.rows.map(
            (
              {
                parcel,
                snapshot,
              },
              index,
            ) => (
              <Timeline
                key={snapshot.key}
                order={order}
                parcel={parcel}
                snapshot={snapshot}
                title={
                  `${
                    snapshot.label ||
                    `Parcel ${index + 1}`
                  } · ${
                    index + 1
                  } of ${
                    packages.count
                  }`
                }
              />
            ),
          )}

          {!packages.allDelivered &&
            packages.count > 1 &&
            order.status !== "cancelled" && (
              <p className="gd-track-footnote">
                Your complete order is
                delivered only after every
                parcel is recorded as delivered.
              </p>
            )}
        </>
      ) : (
        <Timeline order={order} />
      )}

      {request &&
        [
          "requested",
          "approved",
          "rejected",
          "completed",
        ].includes(request.status) && (
          <p className="gd-track-note">
            <strong>
              {request.type === "exchange"
                ? "Exchange"
                : "Return"}

              :{" "}

              {formatOrderStatus(
                request.status,
              )}

              .
            </strong>

            {" "}
            Your original delivery history
            stays visible. Open order details
            for request and refund progress.
          </p>
        )}

      <div className="gd-track-help">
        <p>
          Questions about the next step?
          We’re here to help.
        </p>

        <Link to="/help">
          Need help with this order?{" "}

          <span aria-hidden="true">
            ↗
          </span>
        </Link>
      </div>

      <p className="gd-track-footnote">
        Tracking updates are recorded by
        GymDrobe. For the courier’s latest
        information, use Track with Courier
        when available.
      </p>
    </section>
  );
}