import useOrderUpdates from "../hooks/useOrderUpdates.js";

import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  getOrders as getLocalOrders,
  orderStatus,
  orderTotal,
} from "../utils/customerData.js";

import {
  getOrders as getRemoteOrders,
} from "../services/orderApi.js";

import {
  money,
} from "../utils/productPricing.js";

import {
  ProductImage,
} from "../components/StorefrontShared.jsx";

import AccountLayout from "../components/AccountLayout.jsx";


// ======================================================
// NUMBER
// ======================================================

function number(
  value
) {
  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


// ======================================================
// PAYMENT METHOD
// ======================================================

function paymentMethodLabel(
  order
) {
  const method =
    order?.payment
      ?.method ||
    order?.paymentMethod ||
    "";


  if (
    method ===
    "cod-partial"
  ) {
    return "COD with 10% advance";
  }


  if (
    method ===
    "razorpay"
  ) {
    return "Full online payment";
  }


  if (
    method ===
    "cod"
  ) {
    return "Cash on delivery";
  }


  return "Payment not recorded";
}


// ======================================================
// PAYMENT STATUS
// ======================================================

function paymentStatusLabel(
  order
) {
  const status =
    order?.payment
      ?.status ||
    "pending";


  if (
    status ===
    "partially-paid"
  ) {
    return "Advance paid";
  }


  if (
    status ===
    "paid"
  ) {
    return "Paid";
  }


  if (
    status ===
    "failed"
  ) {
    return "Payment failed";
  }


  if (
    status ===
    "refunded"
  ) {
    return "Refunded";
  }


  return "Payment pending";
}


// ======================================================
// PAYMENT STATUS CLASS
// ======================================================

function paymentStatusClass(
  order
) {
  const status =
    order?.payment
      ?.status ||
    "pending";


  if (
    status ===
    "paid"
  ) {
    return "success";
  }


  if (
    status ===
    "partially-paid"
  ) {
    return "partial";
  }


  if (
    status ===
      "failed" ||
    status ===
      "refunded"
  ) {
    return "cancelled";
  }


  return "pending";
}


// ======================================================
// TOTAL
// ======================================================

function getOrderTotal(
  order
) {
  const paymentTotal =
    number(
      order?.payment
        ?.totalAmount
    );


  if (
    paymentTotal >
    0
  ) {
    return paymentTotal;
  }


  const pricingTotal =
    number(
      order?.pricing
        ?.finalTotal
    );


  if (
    pricingTotal >
    0
  ) {
    return pricingTotal;
  }


  return number(
    orderTotal(
      order
    )
  );
}


// ======================================================
// AMOUNT PAID
// ======================================================

function getAmountPaid(
  order
) {
  return Math.max(
    0,

    number(
      order?.payment
        ?.amountPaid
    )
  );
}


// ======================================================
// AMOUNT DUE
// ======================================================

function getAmountDue(
  order
) {
  return Math.max(
    0,

    number(
      order?.payment
        ?.amountDue
    )
  );
}


// ======================================================
// PAYMENT SUMMARY
// ======================================================

function PaymentSummary({
  order,
}) {
  const method =
    order?.payment
      ?.method ||
    order?.paymentMethod ||
    "";


  const paymentStatus =
    order?.payment
      ?.status ||
    "pending";


  const amountPaid =
    getAmountPaid(
      order
    );


  const amountDue =
    getAmountDue(
      order
    );


  const advanceAmount =
    Math.max(
      0,

      number(
        order?.payment
          ?.advanceAmount
      )
    );


  const balanceStatus =
    order?.payment
      ?.balanceStatus ||
    "";


  const refundStatus =
    order?.refund
      ?.status ||
    "not-requested";


  const refundAmount =
    Math.max(
      0,

      number(
        order?.refund
          ?.amount
      )
    );


  // ====================================================
  // CANCELLED / REFUND
  // ====================================================

  if (
    order?.status ===
    "cancelled"
  ) {
    if (
      refundStatus ===
        "refunded" &&
      refundAmount >
        0
    ) {
      return (
        <div className="order-payment-info">
          <p>
            <strong>
              {paymentMethodLabel(
                order
              )}
            </strong>
          </p>

          <p className="order-payment-refund">
            Refunded:{" "}
            <strong>
              {money(
                refundAmount
              )}
            </strong>
          </p>
        </div>
      );
    }


    if (
      refundStatus ===
        "pending" &&
      refundAmount >
        0
    ) {
      return (
        <div className="order-payment-info">
          <p>
            <strong>
              {paymentMethodLabel(
                order
              )}
            </strong>
          </p>

          <p>
            Refund processing:{" "}
            <strong>
              {money(
                refundAmount
              )}
            </strong>
          </p>
        </div>
      );
    }


    if (
      refundStatus ===
        "manual-required" &&
      refundAmount >
        0
    ) {
      return (
        <div className="order-payment-info">
          <p>
            <strong>
              {paymentMethodLabel(
                order
              )}
            </strong>
          </p>

          <p>
            Refund under review:{" "}
            <strong>
              {money(
                refundAmount
              )}
            </strong>
          </p>
        </div>
      );
    }


    return (
      <div className="order-payment-info">
        <p>
          <strong>
            {paymentMethodLabel(
              order
            )}
          </strong>
        </p>
      </div>
    );
  }


  // ====================================================
  // PARTIAL COD
  // ====================================================

  if (
    method ===
    "cod-partial"
  ) {
    const paidAdvance =
      amountPaid >
      0
        ? amountPaid
        : advanceAmount;


    if (
      paymentStatus ===
        "paid" ||
      balanceStatus ===
        "collected"
    ) {
      return (
        <div className="order-payment-info">
          <p>
            <strong>
              COD with 10% advance
            </strong>
          </p>

          <p className="order-payment-success">
            Payment completed
          </p>

          <small>
            Total paid:{" "}
            {money(
              getOrderTotal(
                order
              )
            )}
          </small>
        </div>
      );
    }


    if (
      paymentStatus ===
      "partially-paid"
    ) {
      return (
        <div className="order-payment-info">
          <p>
            <strong>
              COD with 10% advance
            </strong>
          </p>

          <p className="order-payment-success">
            Advance paid:{" "}
            <strong>
              {money(
                paidAdvance
              )}
            </strong>
          </p>

          {amountDue >
            0 && (
            <small>
              Pay on delivery:{" "}
              <strong>
                {money(
                  amountDue
                )}
              </strong>
            </small>
          )}
        </div>
      );
    }


    return (
      <div className="order-payment-info">
        <p>
          <strong>
            COD with 10% advance
          </strong>
        </p>

        <small>
          {paymentStatusLabel(
            order
          )}
        </small>
      </div>
    );
  }


  // ====================================================
  // FULL ONLINE
  // ====================================================

  if (
    method ===
    "razorpay"
  ) {
    return (
      <div className="order-payment-info">
        <p>
          <strong>
            Full online payment
          </strong>
        </p>

        {paymentStatus ===
        "paid" ? (
          <p className="order-payment-success">
            Paid:{" "}
            <strong>
              {money(
                amountPaid ||
                  getOrderTotal(
                    order
                  )
              )}
            </strong>
          </p>
        ) : (
          <small>
            {paymentStatusLabel(
              order
            )}
          </small>
        )}
      </div>
    );
  }


  // ====================================================
  // LEGACY COD
  // ====================================================

  return (
    <div className="order-payment-info">
      <p>
        <strong>
          {paymentMethodLabel(
            order
          )}
        </strong>
      </p>

      <small>
        {paymentStatusLabel(
          order
        )}
      </small>
    </div>
  );
}


// ======================================================
// ORDERS PAGE
// ======================================================

export default function OrdersPage() {
  // Keeps guest/local orders reactive.
  useOrderUpdates();


  const {
    user,
    token,
  } =
    useAuth();


  // ====================================================
  // MONGODB ORDERS
  // ====================================================

  const [
    remoteOrders,
    setRemoteOrders,
  ] =
    useState([]);


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
    loadError,
    setLoadError,
  ] =
    useState("");


  // ====================================================
  // FILTERS
  // ====================================================

  const [
    query,
    setQuery,
  ] =
    useState("");


  const [
    status,
    setStatus,
  ] =
    useState("");


  const [
    days,
    setDays,
  ] =
    useState("");


  // ====================================================
  // LOAD SIGNED-IN USER ORDERS FROM MONGODB
  // ====================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadOrders() {
        // Guest:
        // localStorage orders are used instead.

        if (
          !user
        ) {
          setRemoteOrders(
            []
          );


          setLoadError(
            ""
          );


          setLoading(
            false
          );


          return;
        }


        // Logged-in user should have JWT.

        if (
          !token
        ) {
          setRemoteOrders(
            []
          );


          setLoading(
            false
          );


          setLoadError(
            "Your sign-in session has expired. Please sign in again."
          );


          return;
        }


        setLoading(
          true
        );


        setLoadError(
          ""
        );


        try {
          const orders =
            await getRemoteOrders(
              token
            );


          if (
            cancelled
          ) {
            return;
          }


          setRemoteOrders(
            Array.isArray(
              orders
            )
              ? orders
              : []
          );

        } catch (
          error
        ) {
          if (
            cancelled
          ) {
            return;
          }


          console.error(
            "Load orders error:",
            error
          );


          setRemoteOrders(
            []
          );


          setLoadError(
            error.message ||
              "Your orders could not be loaded."
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


      loadOrders();


      return () => {
        cancelled =
          true;
      };
    },
    [
      user?.id,
      token,
    ]
  );


  // ====================================================
  // CHOOSE ORDER SOURCE
  // ====================================================

  /*
    Signed-in customer:
      MongoDB / Express API

    Guest:
      Existing localStorage preview orders
  */

  const orders =
    user
      ? remoteOrders
      : getLocalOrders(
          null
        );


  // ====================================================
  // FILTER ORDERS
  // ====================================================

  const normalizedQuery =
    query
      .trim()
      .toLowerCase();


  const matches =
    orders.filter(
      (
        order
      ) => {
        const matchesStatus =
          !status ||
          order.status ===
            status;


        const createdTime =
          Date.parse(
            order.createdAt
          );


        const matchesDate =
          !days ||
          (
            Number.isFinite(
              createdTime
            ) &&
            Date.now() -
              createdTime <=
              Number(
                days
              ) *
                86400000
          );


        const searchableText =
          [
            order.id,

            order.orderNumber,

            paymentMethodLabel(
              order
            ),

            paymentStatusLabel(
              order
            ),

            ...(
              order.items ||
              []
            ).map(
              (
                item
              ) =>
                item.name
            ),
          ]
            .filter(
              Boolean
            )
            .join(
              " "
            )
            .toLowerCase();


        const matchesSearch =
          !normalizedQuery ||
          searchableText.includes(
            normalizedQuery
          );


        return (
          matchesStatus &&
          matchesDate &&
          matchesSearch
        );
      }
    );


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <AccountLayout title="Orders & returns">
      <p className="muted">
        {user
          ? "Your signed-in orders are loaded from your GymDrobe account."
          : "Guest orders are saved on this device. Sign in before checkout to save future orders to your account."}
      </p>


      {/* =================================================
          LOAD ERROR
      ================================================= */}

      {loadError && (
        <p
          className="error-box"
          role="alert"
        >
          {loadError}
        </p>
      )}


      {/* =================================================
          SEARCH
      ================================================= */}

      <div className="field order-search">
        <label htmlFor="order-search">
          Search your orders
        </label>


        <input
          id="order-search"
          type="search"
          placeholder="Product name or order ID"
          value={query}
          onChange={(
            event
          ) =>
            setQuery(
              event.target
                .value
            )
          }
        />
      </div>


      {/* =================================================
          FILTERS
      ================================================= */}

      <div className="browse-controls">
        <label>
          Status{" "}

          <select
            aria-label="Filter orders by status"
            value={status}
            onChange={(
              event
            ) =>
              setStatus(
                event.target
                  .value
              )
            }
          >
            <option value="">
              All orders
            </option>


            {[
              "payment-pending",
              "confirmed",
              "processing",
              "shipped",
              "out-for-delivery",
              "delivered",
              "cancelled",
            ].map(
              (
                itemStatus
              ) => (
                <option
                  key={
                    itemStatus
                  }
                  value={
                    itemStatus
                  }
                >
                  {itemStatus.replaceAll(
                    "-",
                    " "
                  )}
                </option>
              )
            )}
          </select>
        </label>


        <label>
          Placed in{" "}

          <select
            aria-label="Filter orders by date"
            value={days}
            onChange={(
              event
            ) =>
              setDays(
                event.target
                  .value
              )
            }
          >
            <option value="">
              Any time
            </option>

            <option value="30">
              Last 30 days
            </option>

            <option value="90">
              Last 90 days
            </option>

            <option value="365">
              Last year
            </option>
          </select>
        </label>
      </div>


      {/* =================================================
          LOADING
      ================================================= */}

      {loading &&
        user && (
          <div className="empty-state">
            <h3>
              Loading your orders…
            </h3>

            <p>
              Getting your latest GymDrobe orders.
            </p>
          </div>
        )}


      {/* =================================================
          ORDER CARDS
      ================================================= */}

      {!loading &&
        matches.map(
          (
            order
          ) => (
            <article
              className="order-card"
              key={
                order.id ||
                order.orderNumber
              }
            >
              {/* =========================================
                  HEADER
              ========================================= */}

              <div className="order-card-head">
                <div>
                  <strong>
                    {new Date(
                      order.createdAt
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
                  </strong>


                  <small>
                    {order.id ||
                      order.orderNumber}
                  </small>
                </div>


                <span
                  className={`status-pill ${
                    order.status ===
                    "cancelled"
                      ? "cancelled"
                      : order.status ===
                        "payment-pending"
                        ? "pending"
                        : ""
                  }`}
                >
                  {order.status ===
                  "payment-pending"
                    ? "Payment pending"
                    : orderStatus(
                        order
                      )}
                </span>
              </div>


              {/* =========================================
                  PRODUCT IMAGES
              ========================================= */}

              <div className="order-preview">
                {(order.items || [])
                  .slice(
                    0,
                    3
                  )
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <ProductImage
                        key={`${order.id || order.orderNumber}-${item.id || item.productId || index}`}
                        product={
                          item
                        }
                      />
                    )
                  )}
              </div>


              {/* =========================================
                  PRODUCT NAMES
              ========================================= */}

              <p>
                {(order.items || [])
                  .map(
                    (
                      item
                    ) =>
                      item.name
                  )
                  .join(
                    ", "
                  )}
              </p>


              {/* =========================================
                  PAYMENT
              ========================================= */}

              <PaymentSummary
                order={
                  order
                }
              />


              {/* =========================================
                  PAYMENT STATUS BADGE
              ========================================= */}

              {user && (
                <div className="order-payment-status-row">
                  <span
                    className={`status-pill ${paymentStatusClass(
                      order
                    )}`}
                  >
                    {paymentStatusLabel(
                      order
                    )}
                  </span>
                </div>
              )}


              {/* =========================================
                  TOTAL + DETAILS
              ========================================= */}

              <div className="order-card-bottom">
                <div>
                  <small className="muted">
                    Order total
                  </small>

                  <strong>
                    {money(
                      getOrderTotal(
                        order
                      )
                    )}
                  </strong>
                </div>


                <Link
                  className="text-link"
                  to={`/orders/${encodeURIComponent(
                    order.id ||
                      order.orderNumber
                  )}`}
                >
                  View details →
                </Link>
              </div>
            </article>
          )
        )}


      {/* =================================================
          EMPTY STATE
      ================================================= */}

      {!loading &&
        !matches.length && (
          <div className="empty-state">
            <h3>
              {orders.length
                ? "No matching orders"
                : "Your first order is waiting"}
            </h3>


            <p>
              {orders.length
                ? "Try another order ID, product name, status, or date range."
                : user
                  ? "You haven't placed an order with this account yet."
                  : "Explore the collection and find your next training favourite."}
            </p>


            <Link
              className="button"
              to="/shop"
            >
              Explore the collection
            </Link>
          </div>
        )}
    </AccountLayout>
  );
}