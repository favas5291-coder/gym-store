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
// ORDERS PAGE
// ======================================================

export default function OrdersPage() {
  // Keeps guest/local orders reactive.
  useOrderUpdates();


  const {
    user,
    token,
  } = useAuth();


  // ====================================================
  // MONGODB ORDERS
  // ====================================================

  const [
    remoteOrders,
    setRemoteOrders,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(user)
  );


  const [
    loadError,
    setLoadError,
  ] = useState("");


  // ====================================================
  // FILTERS
  // ====================================================

  const [
    query,
    setQuery,
  ] = useState("");


  const [
    status,
    setStatus,
  ] = useState("");


  const [
    days,
    setDays,
  ] = useState("");


  // ====================================================
  // LOAD SIGNED-IN USER ORDERS FROM MONGODB
  // ====================================================

  useEffect(() => {
    let cancelled =
      false;


    async function loadOrders() {
      // Guest:
      // localStorage orders are used instead.

      if (!user) {
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


      // Logged-in user should have a JWT.

      if (!token) {
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


        if (cancelled) {
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
        if (cancelled) {
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
        if (!cancelled) {
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

  }, [
    user?.id,
    token,
  ]);


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
      (order) => {
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
              Number(days) *
                86400000
          );


        const searchableText =
          [
            order.id,
            order.orderNumber,

            ...(
              order.items ||
              []
            ).map(
              (item) =>
                item.name
            ),
          ]
            .filter(
              Boolean
            )
            .join(" ")
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

      {loading && user && (
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
          (order) => (
            <article
              className="order-card"
              key={
                order.id
              }
            >

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
                    {order.id}
                  </small>

                </div>


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


              {/* ===========================================
                  PRODUCT IMAGES
              =========================================== */}

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
                        key={`${order.id}-${item.id || item.productId || index}`}
                        product={
                          item
                        }
                      />
                    )
                  )}

              </div>


              {/* ===========================================
                  PRODUCT NAMES
              =========================================== */}

              <p>
                {(order.items || [])
                  .map(
                    (item) =>
                      item.name
                  )
                  .join(
                    ", "
                  )}
              </p>


              {/* ===========================================
                  TOTAL + DETAILS
              =========================================== */}

              <div className="order-card-bottom">

                <strong>
                  {money(
                    orderTotal(
                      order
                    )
                  )}
                </strong>


                <Link
                  className="text-link"
                  to={`/orders/${encodeURIComponent(
                    order.id
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