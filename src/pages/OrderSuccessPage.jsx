import useOrderUpdates from "../hooks/useOrderUpdates.js";

import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  getOrder as getLocalOrder,
  orderTotal,
} from "../utils/customerData.js";

import {
  getOrderById,
} from "../services/orderApi.js";

import {
  money,
} from "../utils/productPricing.js";

import EmptyState from "../components/EmptyState.jsx";


// ======================================================
// ORDER SUCCESS PAGE
// ======================================================

export default function OrderSuccessPage() {
  const revision =
    useOrderUpdates();


  const [
    params,
  ] = useSearchParams();


  const {
    user,
    token,
  } = useAuth();


  const orderId =
    params.get(
      "orderId"
    );


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


      // No order ID in URL
      if (!orderId) {
        if (!cancelled) {
          setOrder(null);
          setLoading(false);
        }

        return;
      }


      // -----------------------------------------------
      // GUEST ORDER
      // -----------------------------------------------

      if (!user) {
        const localOrder =
          getLocalOrder(
            orderId,
            null
          );


        if (!cancelled) {
          setOrder(
            localOrder
          );

          setLoading(
            false
          );
        }


        return;
      }


      // -----------------------------------------------
      // SIGNED-IN USER WITHOUT TOKEN
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
      // LOAD MONGODB ORDER
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
          "Order success load error:",
          loadError
        );


        setOrder(
          null
        );


        setError(
          loadError.message ||
            "Your order could not be loaded."
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
      <div className="success-page">

        <div className="empty-state">

          <h3>
            Loading your order…
          </h3>

          <p>
            Confirming your GymDrobe order.
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
        title="Order could not be loaded"
        to="/orders"
        label="View my orders"
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
        label="View my orders"
      >
        Open your order history to see orders available for this account or guest session.
      </EmptyState>
    );
  }


  // ====================================================
  // TOTAL ITEMS
  // ====================================================

  const totalItems =
    (
      order.items ||
      []
    ).reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.quantity ||
            0
        ),
      0
    );


  // ====================================================
  // CUSTOMER NAME
  // ====================================================

  const customerName =
    order.customer
      ?.name ||
    order.shippingAddress
      ?.fullName ||
    order.shippingAddress
      ?.name ||
    user?.name ||
    "Customer";


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="success-page">

      <span
        className="success-check"
        aria-hidden="true"
      >
        ✓
      </span>


      <p className="eyebrow">
        THANK YOU FOR CHOOSING GYMDROBE
      </p>


      <h1>
        Your order is confirmed.
      </h1>


      <p>
        {user
          ? "Your order has been saved to your GymDrobe account."
          : "Your guest order has been saved on this device."}
      </p>


      {/* =================================================
          ORDER SUMMARY
      ================================================= */}

      <div className="success-order">

        <strong>
          {order.id}
        </strong>


        <span>
          {totalItems}{" "}
          {totalItems === 1
            ? "item"
            : "items"}{" "}
          ·{" "}
          {money(
            orderTotal(
              order
            )
          )}
        </span>


        <p>
          {customerName}

          <br />

          {order.shippingAddress
            ?.city}

          {order.shippingAddress
            ?.city &&
          order.shippingAddress
            ?.pincode
            ? ", "
            : ""}

          {order.shippingAddress
            ?.pincode}
        </p>

      </div>


      {/* =================================================
          PAYMENT STATUS
      ================================================= */}

      <p className="muted">
        Payment:{" "}

        {order.payment
          ?.method ===
          "cod" ||
        order.paymentMethod ===
          "cod"
          ? "Cash on delivery"
          : order.payment
              ?.method ||
            "Not recorded"}{" "}

        ·{" "}

        {order.payment
          ?.status ||
          "pending"}
      </p>


      {/* =================================================
          ACTIONS
      ================================================= */}

      <div className="purchase-actions">

        <Link
          className="button"
          to={`/orders/${encodeURIComponent(
            order.id
          )}`}
        >
          View order
        </Link>


        <Link
          className="button secondary"
          to="/orders"
        >
          My orders
        </Link>


        <Link
          className="button secondary"
          to="/shop"
        >
          Continue shopping
        </Link>

      </div>

    </div>
  );
}