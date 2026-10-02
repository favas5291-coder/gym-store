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
// HELPERS
// ======================================================

function statusLabel(
  status
) {
  const labels = {
    confirmed:
      "Confirmed",

    processing:
      "Processing",

    shipped:
      "Shipped",

    "out-for-delivery":
      "Out for delivery",

    delivered:
      "Delivered",

    cancelled:
      "Cancelled",

    packed:
      "Processing",
  };


  return (
    labels[
      status
    ] ||
    String(
      status ||
        "Order update"
    )
      .replaceAll(
        "-",
        " "
      )
  );
}


function formatDate(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  );
}


function formatDateTime(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date.toLocaleString(
    "en-IN",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}


// ======================================================
// ORDER TRACKING PAGE
// ======================================================

export default function OrderTrackingPage() {
  const revision =
    useOrderUpdates();


  const {
    orderId,
  } =
    useParams();


  const {
    user,
    token,
  } =
    useAuth();


  const [
    order,
    setOrder,
  ] =
    useState(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      Boolean(
        user
      )
    );


  const [
    refreshing,
    setRefreshing,
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
    refreshError,
    setRefreshError,
  ] =
    useState("");


  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState(
      null
    );


  // ====================================================
  // LOAD ORDER
  //
  // SIGNED IN:
  // MongoDB
  //
  // GUEST:
  // localStorage
  // ====================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadOrder() {
        setError(
          ""
        );


        // ----------------------------------------------
        // GUEST ORDER
        // ----------------------------------------------

        if (
          !user
        ) {
          const local =
            getLocalOrder(
              orderId,
              null
            );


          if (
            !cancelled
          ) {
            setOrder(
              local
            );

            setLoading(
              false
            );

            setLastUpdated(
              new Date()
            );
          }


          return;
        }


        // ----------------------------------------------
        // LOGGED-IN USER WITHOUT TOKEN
        // ----------------------------------------------

        if (
          !token
        ) {
          if (
            !cancelled
          ) {
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


        // ----------------------------------------------
        // MONGODB ORDER
        // ----------------------------------------------

        setLoading(
          true
        );


        try {
          const remoteOrder =
            await getOrderById(
              token,
              orderId
            );


          if (
            cancelled
          ) {
            return;
          }


          setOrder(
            remoteOrder ||
              null
          );


          setLastUpdated(
            new Date()
          );

        } catch (
          loadError
        ) {
          if (
            cancelled
          ) {
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
          if (
            !cancelled
          ) {
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
    },

    [
      orderId,
      user?.id,
      token,
      revision,
    ]
  );


  // ====================================================
  // SILENT REMOTE REFRESH
  // ====================================================

  async function refreshRemoteOrder({
    showLoading = false,
  } = {}) {
    if (
      !user ||
      !token ||
      !orderId
    ) {
      return;
    }


    if (
      showLoading
    ) {
      setRefreshing(
        true
      );
    }


    setRefreshError(
      ""
    );


    try {
      const remoteOrder =
        await getOrderById(
          token,
          orderId
        );


      setOrder(
        remoteOrder ||
          null
      );


      setLastUpdated(
        new Date()
      );

    } catch (
      refreshLoadError
    ) {
      console.error(
        "Tracking refresh error:",
        refreshLoadError
      );


      setRefreshError(
        refreshLoadError.message ||
          "Could not refresh tracking right now."
      );

    } finally {
      if (
        showLoading
      ) {
        setRefreshing(
          false
        );
      }
    }
  }


  // ====================================================
  // AUTO REFRESH
  //
  // Checks MongoDB while this tracking page is open.
  // ====================================================

  useEffect(
    () => {
      if (
        !user ||
        !token ||
        !orderId
      ) {
        return undefined;
      }


      const interval =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
              "visible"
            ) {
              refreshRemoteOrder();
            }
          },

          30000
        );


      return () => {
        window.clearInterval(
          interval
        );
      };
    },

    [
      user?.id,
      token,
      orderId,
    ]
  );


  // ====================================================
  // REFRESH WHEN CUSTOMER RETURNS TO TAB
  // ====================================================

  useEffect(
    () => {
      if (
        !user ||
        !token
      ) {
        return undefined;
      }


      function refreshOnFocus() {
        refreshRemoteOrder();
      }


      function refreshOnVisibility() {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refreshRemoteOrder();
        }
      }


      window.addEventListener(
        "focus",
        refreshOnFocus
      );


      document.addEventListener(
        "visibilitychange",
        refreshOnVisibility
      );


      return () => {
        window.removeEventListener(
          "focus",
          refreshOnFocus
        );


        document.removeEventListener(
          "visibilitychange",
          refreshOnVisibility
        );
      };
    },

    [
      user?.id,
      token,
      orderId,
    ]
  );


  // ====================================================
  // LOADING
  // ====================================================

  if (
    loading &&
    user
  ) {
    return (
      <div
        className="page narrow tracking-page"
      >
        <div
          className="empty-state"
        >
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

  if (
    error
  ) {
    return (
      <EmptyState
        title="Tracking could not be loaded"
        to="/orders"
        label="My orders"
      >
        {
          error
        }
      </EmptyState>
    );
  }


  // ====================================================
  // ORDER NOT FOUND
  // ====================================================

  if (
    !order
  ) {
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


  const sortedEvents = [
    ...events,
  ].sort(
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
  );


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div
      className="page narrow tracking-page"
    >
      <Link
        className="text-link"
        to={`/orders/${encodeURIComponent(
          order.id
        )}`}
      >
        ← Order details
      </Link>


      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "16px",

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <h1>
            Track your order
          </h1>

          <p
            className="order-id"
          >
            {
              order.id
            }
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
        </div>


        {user && (
          <button
            type="button"
            className="button secondary"
            disabled={
              refreshing
            }
            onClick={
              () =>
                refreshRemoteOrder({
                  showLoading:
                    true,
                })
            }
          >
            {refreshing
              ? "Refreshing…"
              : "Refresh tracking"}
          </button>
        )}
      </div>


      {/* =================================================
          DATA SOURCE
      ================================================= */}

      <div
        className="notice"
      >
        {user
          ? "Tracking information is synced with your GymDrobe account."
          : "Guest tracking information is stored on this device."}

        {lastUpdated && (
          <>
            {" "}
            Last updated{" "}
            {formatDateTime(
              lastUpdated
            )}
            .
          </>
        )}
      </div>


      {refreshError && (
        <p
          className="field-error"
          role="alert"
        >
          {
            refreshError
          }
        </p>
      )}


      {/* =================================================
          CANCELLED
      ================================================= */}

      {order.status ===
      "cancelled" ? (
        <div
          className="notice"
        >
          This order has been cancelled.
        </div>

      ) : (
        <>
          {/* =============================================
              PROGRESS
          ============================================= */}

          <ol
            className="tracking-steps"
          >
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
                    <span
                      aria-hidden="true"
                    >
                      {currentIndex >
                      index
                        ? "✓"
                        : index +
                          1}
                    </span>

                    <strong>
                      {statusLabel(
                        stage
                      )}
                    </strong>
                  </li>
                );
              }
            )}
          </ol>


          {/* =============================================
              CURRENT DELIVERY MESSAGE
          ============================================= */}

          <section
            className="panel"
          >
            <h2>
              ORDER STATUS
            </h2>


            {progressStatus ===
              "confirmed" && (
              <p>
                Your order has been confirmed. GymDrobe will begin preparing it for dispatch.
              </p>
            )}


            {progressStatus ===
              "processing" && (
              <p>
                Your order is being prepared and packed for dispatch.
              </p>
            )}


            {progressStatus ===
              "shipped" && (
              <p>
                Your order has left GymDrobe and is on its way to you.
              </p>
            )}


            {progressStatus ===
              "out-for-delivery" && (
              <p>
                Your order is out for delivery. Please keep your phone available for the delivery partner.
              </p>
            )}


            {progressStatus ===
              "delivered" && (
              <p>
                Your order has been delivered successfully.
              </p>
            )}


            {order.delivery
              ?.deliveredAt && (
              <p
                className="muted"
              >
                Delivered:{" "}
                {formatDateTime(
                  order.delivery
                    .deliveredAt
                )}
              </p>
            )}
          </section>
        </>
      )}


      {/* =================================================
          SHIPMENT INFORMATION
      ================================================= */}

      <section
        className="panel"
      >
        <h2>
          SHIPMENT INFORMATION
        </h2>


        {order.tracking
          ?.carrier ? (
          <p>
            <strong>
              Carrier:
            </strong>{" "}
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
            <strong>
              Tracking number:
            </strong>{" "}
            {
              order.tracking
                .trackingNumber
            }
          </p>
        )}


        {order.tracking
          ?.estimatedDelivery && (
          <p>
            <strong>
              Estimated delivery:
            </strong>{" "}
            {formatDate(
              order.tracking
                .estimatedDelivery
            )}
          </p>
        )}


        {order.delivery
          ?.label && (
          <p>
            <strong>
              Delivery method:
            </strong>{" "}
            {
              order.delivery
                .label
            }
          </p>
        )}


        {order.delivery
          ?.status && (
          <p>
            <strong>
              Delivery status:
            </strong>{" "}
            {statusLabel(
              order.delivery
                .status
            )}
          </p>
        )}


        {!order.tracking
          ?.carrier &&
          !order.tracking
            ?.trackingNumber &&
          progressStatus ===
            "confirmed" && (
            <p
              className="muted"
            >
              Courier information will appear here after your order is prepared for shipment.
            </p>
          )}


        <p
          className="muted"
        >
          This page shows fulfilment and tracking information recorded by GymDrobe. Courier-level live location tracking can be connected later through a shipping provider.
        </p>
      </section>


      {/* =================================================
          ORDER ACTIVITY
      ================================================= */}

      <section
        className="panel"
      >
        <h2>
          ORDER ACTIVITY
        </h2>


        {sortedEvents.length ? (
          <div>
            {sortedEvents.map(
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
                      statusLabel(
                        event.status
                      ) ||
                      "Order update"}
                  </strong>


                  {event.status && (
                    <p
                      className="muted"
                    >
                      {statusLabel(
                        event.status
                      )}
                    </p>
                  )}


                  {event.timestamp && (
                    <p>
                      {formatDateTime(
                        event.timestamp
                      )}
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          <p>
            No tracking events have been recorded yet.
          </p>
        )}
      </section>


      {/* =================================================
          DELIVERY ADDRESS
      ================================================= */}

      {order.shippingAddress && (
        <section
          className="panel"
        >
          <h2>
            DELIVERY ADDRESS
          </h2>


          <p>
            <strong>
              {order.shippingAddress
                .fullName ||
                order.customer
                  ?.name ||
                "Customer"}
            </strong>

            <br />

            {order.shippingAddress
              .addressLine ||
              ""}

            {order.shippingAddress
              .landmark && (
              <>
                <br />
                {
                  order.shippingAddress
                    .landmark
                }
              </>
            )}

            <br />

            {order.shippingAddress
              .city ||
              ""}

            {order.shippingAddress
              .state
              ? `, ${order.shippingAddress.state}`
              : ""}

            {order.shippingAddress
              .pincode
              ? ` - ${order.shippingAddress.pincode}`
              : ""}
          </p>


          {order.shippingAddress
            .phone && (
            <p>
              <strong>
                Phone:
              </strong>{" "}
              {
                order.shippingAddress
                  .phone
              }
            </p>
          )}
        </section>
      )}


      {/* =================================================
          CUSTOMER ACTIONS
      ================================================= */}

      <div
        style={{
          display:
            "flex",

          gap:
            "12px",

          flexWrap:
            "wrap",
        }}
      >
        <Link
          className="button secondary"
          to={`/orders/${encodeURIComponent(
            order.id
          )}`}
        >
          View order details
        </Link>


        <Link
          className="button secondary"
          to="/orders"
        >
          All orders
        </Link>


        <Link
          className="button"
          to="/shop"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}