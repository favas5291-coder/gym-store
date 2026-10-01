import useOrderUpdates from "../hooks/useOrderUpdates.js";

import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  getOrder as getLocalOrder,
  orderStatus,
} from "../utils/customerData.js";

import {
  getOrderById,
} from "../services/orderApi.js";

import EmptyState from "../components/EmptyState.jsx";


// ======================================================
// TRACKING STAGES
// ======================================================

const stages = [
  "confirmed",
  "processing",
  "shipped",
  "out-for-delivery",
  "delivered",
];


// ======================================================
// ORDER TRACKING PAGE
// ======================================================

export default function OrderTrackingPage() {
  const revision =
    useOrderUpdates();


  const {
    orderId,
  } = useParams();


  const {
    user,
    token,
  } = useAuth();


  const [
    order,
    setOrder,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(user)
  );


  const [
    error,
    setError,
  ] = useState("");


  // ====================================================
  // LOAD ORDER
  //
  // Signed in:
  // MongoDB
  //
  // Guest:
  // localStorage
  // ====================================================

  useEffect(() => {
    let cancelled =
      false;


    async function loadOrder() {
      setError("");


      // -----------------------------------------------
      // GUEST
      // -----------------------------------------------

      if (!user) {
        const local =
          getLocalOrder(
            orderId,
            null
          );


        if (!cancelled) {
          setOrder(
            local
          );

          setLoading(
            false
          );
        }


        return;
      }


      // -----------------------------------------------
      // LOGGED-IN USER WITHOUT TOKEN
      // -----------------------------------------------

      if (!token) {
        if (!cancelled) {
          setOrder(
            null
          );

          setLoading(
            false
          );

          setError(
            "Your sign-in session has expired. Please sign in again."
          );
        }


        return;
      }


      // -----------------------------------------------
      // MONGODB ORDER
      // -----------------------------------------------

      setLoading(
        true
      );


      try {
        const remoteOrder =
          await getOrderById(
            token,
            orderId
          );


        if (cancelled) {
          return;
        }


        setOrder(
          remoteOrder ||
            null
        );

      } catch (
        loadError
      ) {
        if (cancelled) {
          return;
        }


        console.error(
          "Order tracking load error:",
          loadError
        );


        setOrder(
          null
        );


        setError(
          loadError.message ||
            "Tracking information could not be loaded."
        );

      } finally {
        if (!cancelled) {
          setLoading(
            false
          );
        }
      }
    }


    loadOrder();


    return () => {
      cancelled =
        true;
    };

  }, [
    orderId,
    user?.id,
    token,
    revision,
  ]);


  // ====================================================
  // LOADING
  // ====================================================

  if (
    loading &&
    user
  ) {
    return (
      <div className="page narrow tracking-page">

        <div className="empty-state">

          <h3>
            Loading tracking…
          </h3>

          <p>
            Getting the latest information for your GymDrobe order.
          </p>

        </div>

      </div>
    );
  }


  // ====================================================
  // ERROR
  // ====================================================

  if (error) {
    return (
      <EmptyState
        title="Tracking could not be loaded"
        to="/orders"
        label="My orders"
      >
        {error}
      </EmptyState>
    );
  }


  // ====================================================
  // ORDER NOT FOUND
  // ====================================================

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        to="/orders"
        label="My orders"
      >
        Check your order history for available orders.
      </EmptyState>
    );
  }


  // ====================================================
  // STATUS
  // ====================================================

  const progressStatus =
    order.status ===
    "packed"
      ? "processing"
      : order.status;


  const currentIndex =
    stages.indexOf(
      progressStatus
    );


  // ====================================================
  // TRACKING EVENTS
  // ====================================================

  const events =
    Array.isArray(
      order.tracking
        ?.events
    )
      ? order.tracking
          .events
      : [];


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="page narrow tracking-page">

      <Link
        className="text-link"
        to={`/orders/${encodeURIComponent(
          order.id
        )}`}
      >
        ← Order details
      </Link>


      <h1>
        Track your order
      </h1>


      <p className="order-id">
        {order.id}
      </p>


      <span
        className={`status-pill ${
          order.status ===
          "cancelled"
            ? "cancelled"
            : ""
        }`}
      >
        {orderStatus(
          order
        )}
      </span>


      {/* =================================================
          DATA SOURCE NOTICE
      ================================================= */}

      <div className="notice">
        {user
          ? "Tracking information is loaded from your GymDrobe account."
          : "Guest tracking information is stored on this device."}
      </div>


      {/* =================================================
          CANCELLED ORDER
      ================================================= */}

      {order.status ===
      "cancelled" ? (
        <div className="notice">
          This order has been cancelled.
        </div>
      ) : (

        // ===============================================
        // TRACKING PROGRESS
        // ===============================================

        <ol className="tracking-steps">

          {stages.map(
            (
              stage,
              index
            ) => {
              const completed =
                currentIndex >=
                  0 &&
                index <=
                  currentIndex;


              const isCurrent =
                stage ===
                progressStatus;


              return (
                <li
                  key={
                    stage
                  }
                  className={
                    completed
                      ? "done"
                      : ""
                  }
                  aria-current={
                    isCurrent
                      ? "step"
                      : undefined
                  }
                >

                  <span aria-hidden="true">
                    {currentIndex >
                    index
                      ? "✓"
                      : index +
                        1}
                  </span>


                  <strong>
                    {stage.replaceAll(
                      "-",
                      " "
                    )}
                  </strong>

                </li>
              );
            }
          )}

        </ol>
      )}


      {/* =================================================
          SHIPMENT INFORMATION
      ================================================= */}

      <section className="panel">

        <h2>
          SHIPMENT INFORMATION
        </h2>


        {order.tracking
          ?.carrier ? (
          <p>
            Carrier:{" "}
            {
              order.tracking
                .carrier
            }
          </p>
        ) : (
          <p>
            A carrier has not been assigned yet.
          </p>
        )}


        {order.tracking
          ?.trackingNumber && (
          <p>
            Tracking number:{" "}
            {
              order.tracking
                .trackingNumber
            }
          </p>
        )}


        {order.tracking
          ?.estimatedDelivery && (
          <p>
            Estimated delivery:{" "}

            {new Date(
              order.tracking
                .estimatedDelivery
            ).toLocaleDateString(
              "en-IN",
              {
                day:
                  "numeric",

                month:
                  "short",

                year:
                  "numeric",
              }
            )}
          </p>
        )}


        {order.delivery
          ?.label && (
          <p>
            Delivery method:{" "}
            {
              order.delivery
                .label
            }
          </p>
        )}


        <p className="muted">
          Tracking displays events currently recorded for this order. Live courier tracking will be added when shipping integration is connected.
        </p>

      </section>


      {/* =================================================
          ORDER ACTIVITY
      ================================================= */}

      <section className="panel">

        <h2>
          ORDER ACTIVITY
        </h2>


        {events.length ? (

          [...events]
            .sort(
              (
                a,
                b
              ) =>
                Date.parse(
                  b.timestamp ||
                    0
                ) -
                Date.parse(
                  a.timestamp ||
                    0
                )
            )
            .map(
              (
                event,
                index
              ) => (
                <div
                  className="tracking-event"
                  key={`${event.status || "event"}-${event.timestamp || index}`}
                >

                  <strong>
                    {event.description ||
                      event.status ||
                      "Order update"}
                  </strong>


                  {event.status && (
                    <p className="muted">
                      {String(
                        event.status
                      ).replaceAll(
                        "-",
                        " "
                      )}
                    </p>
                  )}


                  {event.timestamp && (
                    <p>
                      {new Date(
                        event.timestamp
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  )}

                </div>
              )
            )

        ) : (
          <p>
            No tracking events have been recorded yet.
          </p>
        )}

      </section>

    </div>
  );
}