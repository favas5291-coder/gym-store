
import { useState } from "react";
import {
  Link,
  Navigate,
  useParams,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ORDERS_STORAGE_KEY = "gymdrobe-orders";
const LAST_ORDER_STORAGE_KEY =
  "gymdrobe-last-order";

function OrderDetailsPage() {
  const { orderId } = useParams();

  const {
    user,
    isAuthenticated,
  } = useAuth();

  const [actionMessage, setActionMessage] =
    useState("");

  const [
    showCancelConfirm,
    setShowCancelConfirm,
  ] = useState(false);

  const [
    showReturnConfirm,
    setShowReturnConfirm,
  ] = useState(false);

  /*
  ==========================================
  AUTHENTICATION
  ==========================================
  */

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
  ==========================================
  LOAD ORDERS
  ==========================================
  */

  let allOrders = [];

  try {
    const savedOrders =
      localStorage.getItem(
        ORDERS_STORAGE_KEY
      );

    const parsedOrders = savedOrders
      ? JSON.parse(savedOrders)
      : [];

    if (Array.isArray(parsedOrders)) {
      allOrders = parsedOrders;
    }
  } catch {
    allOrders = [];
  }

  /*
  ==========================================
  USER EMAIL
  ==========================================
  */

  const userEmail = String(
    user?.email || ""
  )
    .trim()
    .toLowerCase();

  /*
  ==========================================
  FIND USER'S ORDER
  ==========================================
  */

  const order = allOrders.find((item) => {
    const itemOrderId =
      String(item?.id) ===
      String(orderId);

    const orderEmail = String(
      item?.user?.email ||
        item?.customer?.email ||
        ""
    )
      .trim()
      .toLowerCase();

    const belongsToUser =
      orderEmail &&
      userEmail &&
      orderEmail === userEmail;

    return (
      itemOrderId &&
      belongsToUser
    );
  });

  /*
  ==========================================
  DATE
  ==========================================
  */

  function formatDate(dateValue) {
    if (!dateValue) {
      return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  /*
  ==========================================
  TIME
  ==========================================
  */

  function formatTime(dateValue) {
    if (!dateValue) {
      return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  /*
  ==========================================
  ORDER STATUS LABEL
  ==========================================
  */

  function getStatusLabel(status) {
    switch (status) {
      case "payment-pending":
        return "Payment Pending";

      case "confirmed":
        return "Confirmed";

      case "processing":
        return "Processing";

      case "shipped":
        return "Shipped";

      case "out-for-delivery":
        return "Out for Delivery";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Cancelled";

      case "return-requested":
        return "Return Requested";

      case "returned":
        return "Returned";

      default:
        return "Processing";
    }
  }

  /*
  ==========================================
  ORDER STATUS STYLE
  ==========================================
  */

  function getStatusStyle(status) {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700";

      case "cancelled":
        return "bg-red-100 text-red-700";

      case "shipped":
        return "bg-blue-100 text-blue-700";

      case "out-for-delivery":
        return "bg-purple-100 text-purple-700";

      case "payment-pending":
        return "bg-yellow-100 text-yellow-700";

      case "returned":
        return "bg-gray-200 text-gray-700";

      case "return-requested":
        return "bg-yellow-100 text-yellow-700";

      case "processing":
        return "bg-blue-100 text-blue-700";

      default:
        return "bg-orange-100 text-orange-700";
    }
  }

  /*
  ==========================================
  UPDATE ORDER STATUS
  ==========================================
  */

  function updateOrderStatus(
    newStatus,
    refundData = null
  ) {
    if (!order || !userEmail) {
      return false;
    }

    try {
      const savedOrders =
        localStorage.getItem(
          ORDERS_STORAGE_KEY
        );

      const parsedOrders = savedOrders
        ? JSON.parse(savedOrders)
        : [];

      if (!Array.isArray(parsedOrders)) {
        return false;
      }

      const updatedAt =
        new Date().toISOString();

      let orderWasUpdated = false;

      /*
        Update only:
        1. The requested order
        2. If it belongs to current user
      */

      const updatedOrders =
        parsedOrders.map((item) => {
          const sameOrder =
            String(item?.id) ===
            String(orderId);

          if (!sameOrder) {
            return item;
          }

          const itemEmail = String(
            item?.user?.email ||
              item?.customer?.email ||
              ""
          )
            .trim()
            .toLowerCase();

          const belongsToUser =
            itemEmail &&
            itemEmail === userEmail;

          /*
            NEVER update another user's order.
          */

          if (!belongsToUser) {
            return item;
          }

          orderWasUpdated = true;

          const updatedOrder = {
            ...item,
            status: newStatus,
            updatedAt,
          };

          /*
            Update refund information
            when provided.
          */

          if (refundData) {
            updatedOrder.refund = {
              ...(item.refund || {}),
              ...refundData,
              updatedAt,
            };
          }

          return updatedOrder;
        });

      if (!orderWasUpdated) {
        return false;
      }

      /*
      ========================================
      SAVE UPDATED ORDERS
      ========================================
      */

      localStorage.setItem(
        ORDERS_STORAGE_KEY,
        JSON.stringify(updatedOrders)
      );

      /*
      ========================================
      FIND UPDATED USER ORDER
      ========================================
      */

      const updatedOrder =
        updatedOrders.find((item) => {
          const sameOrder =
            String(item?.id) ===
            String(orderId);

          const itemEmail = String(
            item?.user?.email ||
              item?.customer?.email ||
              ""
          )
            .trim()
            .toLowerCase();

          return (
            sameOrder &&
            itemEmail === userEmail
          );
        });

      if (!updatedOrder) {
        return false;
      }

      /*
      ========================================
      UPDATE LAST ORDER
      ========================================
      */

      localStorage.setItem(
        LAST_ORDER_STORAGE_KEY,
        JSON.stringify(updatedOrder)
      );

      return true;
    } catch {
      return false;
    }
  }

  /*
  ==========================================
  CANCEL ORDER
  ==========================================
  */

  function cancelOrder() {
    if (!order) {
      return;
    }

    /*
      Calculate refund amount.
    */

    const refundAmount =
      Number(
        order?.pricing?.finalTotal ??
          order?.pricing?.total ??
          0
      );

    /*
      Check whether payment was completed.
    */

    const isPaid =
      order?.payment?.status ===
      "paid";

    const success =
      updateOrderStatus(
        "cancelled",
        {
          status: isPaid
            ? "refund-pending"
            : "not-required",

          amount: isPaid
            ? refundAmount
            : 0,

          requestedAt: isPaid
            ? new Date().toISOString()
            : null,

          completedAt: null,

          refundId: null,
        }
      );

    if (!success) {
      setActionMessage(
        "Unable to cancel the order. Please try again."
      );

      return;
    }

    setShowCancelConfirm(false);

    setActionMessage(
      "Your order has been cancelled successfully."
    );

    /*
      Reload after a short delay so
      the updated order state is visible.
    */

    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  /*
  ==========================================
  REQUEST RETURN
  ==========================================
  */

  function requestReturn() {
    if (!order) {
      return;
    }

    const success =
      updateOrderStatus(
        "return-requested",
        {
          status: "not-started",

          amount: Number(
            order?.pricing?.finalTotal ??
              order?.pricing?.total ??
              0
          ),

          requestedAt:
            new Date().toISOString(),

          completedAt: null,

          refundId: null,
        }
      );

    if (!success) {
      setActionMessage(
        "Unable to submit the return request. Please try again."
      );

      return;
    }

    setShowReturnConfirm(false);

    setActionMessage(
      "Your return request has been submitted successfully."
    );

    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  /*
  ==========================================
  ORDER NOT FOUND / NOT OWNED
  ==========================================
  */

  if (!order) {
    return (
      <section className="min-h-screen bg-gray-100 px-4 py-10 text-black sm:px-6">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-3xl bg-white p-8 text-center shadow-sm sm:p-10">

            <div className="mb-5 text-6xl">
              📦
            </div>

            <h1 className="mb-3 text-3xl font-black">
              Order Not Found
            </h1>

            <p className="mb-7 text-gray-500">
              We couldn't find this order in your
              account.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">

              <Link
                to="/orders"
                className="rounded-xl bg-orange-600 px-6 py-3 font-bold text-white transition hover:bg-orange-700"
              >
                MY ORDERS
              </Link>

              <Link
                to="/shop"
                className="rounded-xl border border-gray-300 px-6 py-3 font-bold transition hover:bg-gray-50"
              >
                SHOP
              </Link>

            </div>

          </div>
        </div>
      </section>
    );
  }

  /*
  ==========================================
  ORDER DATA
  ==========================================
  */

  const pricing =
    order.pricing || {};

  const customer =
    order.customer || {};

  const address =
    order.shippingAddress || {};

  const delivery =
    order.delivery || {};

  const payment =
    order.payment || {};

  const items =
    Array.isArray(order.items)
      ? order.items
      : [];

  const status =
    order.status || "confirmed";

  /*
  ==========================================
  PRICE DATA
  ==========================================
  */

  const subtotal = Number(
    pricing.subtotal || 0
  );

  const couponDiscount =
    Number(
      pricing.couponDiscount || 0
    );

  const shipping =
    Number(pricing.shipping || 0);

  const total = Number(
    pricing.finalTotal ??
      pricing.total ??
      0
  );

  /*
  ==========================================
  PAYMENT DATA
  ==========================================
  */

  const paymentMethod =
    payment.method ||
    order.paymentMethod ||
    "cod";

  const paymentStatus =
    payment.status ||
    "pending";

  /*
  ==========================================
  DELIVERY DATA
  ==========================================
  */

  const deliveryMethod =
    delivery.method ||
    order.deliveryMethod ||
    "standard";

  const deliveryLabel =
    delivery.label ||
    (deliveryMethod === "express"
      ? "Express Delivery"
      : "Standard Delivery");

  const estimatedDelivery =
    delivery.estimatedTime ||
    (deliveryMethod === "express"
      ? "1–2 business days"
      : "3–5 business days");

  /*
  ==========================================
  ORDER ACTION RULES
  ==========================================
  */

  const canCancel =
    status === "confirmed" ||
    status === "processing";

  const canReturn =
    status === "delivered";

  /*
  ==========================================
  REFUND DATA
  ==========================================
  */

  const refund =
    order.refund || null;

  /*
  ==========================================
  PAYMENT LABEL
  ==========================================
  */

  function getPaymentLabel() {
    if (paymentMethod === "cod") {
      return "Cash on Delivery";
    }

    if (paymentMethod === "upi") {
      return "UPI Payment";
    }

    if (paymentMethod === "card") {
      return "Card Payment";
    }

    return "Online Payment";
  }

  /*
  ==========================================
  PAYMENT STATUS
  ==========================================
  */

  function getPaymentStatus() {
    if (paymentStatus === "paid") {
      return "Paid";
    }

    if (
      paymentStatus ===
      "payment-pending"
    ) {
      return "Payment Pending";
    }

    if (paymentStatus === "failed") {
      return "Payment Failed";
    }

    return "Pending";
  }

  /*
  ==========================================
  REFUND LABEL
  ==========================================
  */

  function getRefundStatusLabel() {
    if (!refund) {
      return "—";
    }

    switch (refund.status) {
      case "not-required":
        return "Not Required";

      case "not-started":
        return "Not Started";

      case "refund-pending":
        return "Refund Pending";

      case "refunded":
        return "Refunded";

      case "failed":
        return "Refund Failed";

      default:
        return "Processing";
    }
  }

  /*
  ==========================================
  REFUND STYLE
  ==========================================
  */

  function getRefundStatusStyle() {
    if (!refund) {
      return "text-gray-500";
    }

    switch (refund.status) {
      case "refunded":
        return "text-green-600";

      case "refund-pending":
        return "text-orange-600";

      case "failed":
        return "text-red-600";

      case "not-required":
        return "text-gray-500";

      default:
        return "text-gray-700";
    }
  }

  /*
  ==========================================
  RENDER
  ==========================================
  */

  return (
    <section className="min-h-screen bg-gray-100 px-4 py-8 text-black sm:px-6 sm:py-12">

      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-8">

          <Link
            to="/orders"
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-gray-500 transition hover:text-orange-600"
          >
            ← Back to My Orders
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>

              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                Order Details
              </p>

              <h1 className="break-all text-2xl font-black sm:text-3xl">
                #{order.id}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Placed on{" "}
                {formatDate(
                  order.createdAt
                )}{" "}
                at{" "}
                {formatTime(
                  order.createdAt
                )}
              </p>

            </div>

            <span
              className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${getStatusStyle(
                status
              )}`}
            >
              {getStatusLabel(status)}
            </span>

          </div>

        </div>

        {/* ACTION MESSAGE */}

        {actionMessage && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 font-bold text-green-700">
            {actionMessage}
          </div>
        )}

        {/* DELIVERY */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-sm font-bold uppercase tracking-wide text-gray-400">
                Delivery
              </p>

              <h2 className="mt-1 text-xl font-black">
                {deliveryLabel}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Estimated delivery:{" "}
                {estimatedDelivery}
              </p>

            </div>

            <Link
              to={`/orders/${order.id}/track`}
              className="rounded-xl bg-gray-900 px-6 py-3 text-center font-bold text-white transition hover:bg-gray-800"
            >
              TRACK ORDER
            </Link>

          </div>

        </div>

        {/* ITEMS */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <h2 className="mb-6 text-2xl font-black">
            Items
          </h2>

          <div className="space-y-6">

            {items.map(
              (item, index) => {
                const quantity =
                  Number(
                    item?.quantity || 0
                  );

                const price =
                  Number(
                    item?.price || 0
                  );

                const itemTotal =
                  price * quantity;

                return (
                  <div
                    key={
                      item?.itemKey ||
                      `${item?.id || "item"}-${
                        item?.selectedSize || ""
                      }-${
                        item?.selectedColor || ""
                      }-${index}`
                    }
                    className="flex gap-4 border-b pb-6 last:border-b-0 last:pb-0"
                  >

                    {/* IMAGE */}

                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-28 sm:w-28">

                      {item?.image ? (
                        <img
                          src={item.image}
                          alt={
                            item?.name ||
                            "Product"
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">
                          📦
                        </div>
                      )}

                    </div>

                    {/* INFORMATION */}

                    <div className="min-w-0 flex-1">

                      <h3 className="break-words font-bold sm:text-lg">
                        {item?.name ||
                          "Product"}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        ₹
                        {price.toLocaleString(
                          "en-IN"
                        )}{" "}
                        × {quantity}
                      </p>

                      {item?.selectedSize && (
                        <p className="mt-1 text-sm text-gray-500">
                          Size:{" "}
                          {
                            item.selectedSize
                          }
                        </p>
                      )}

                      {item?.selectedColor && (
                        <p className="text-sm text-gray-500">
                          Color:{" "}
                          {
                            item.selectedColor
                          }
                        </p>
                      )}

                    </div>

                    {/* TOTAL */}

                    <div className="shrink-0 text-right">

                      <p className="font-black sm:text-lg">
                        ₹
                        {itemTotal.toLocaleString(
                          "en-IN"
                        )}
                      </p>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </div>

        {/* ADDRESS + PAYMENT */}

        <div className="mb-8 grid gap-8 lg:grid-cols-2">

          {/* ADDRESS */}

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">

            <h2 className="mb-5 text-xl font-black">
              Shipping Address
            </h2>

            <div className="space-y-2 text-sm leading-6 text-gray-600">

              <p className="font-bold text-black">
                {address.name ||
                  customer.name ||
                  "—"}
              </p>

              <p>
                {address.address ||
                  customer.address ||
                  "—"}
              </p>

              <p>
                {address.city ||
                  customer.city ||
                  "—"}
                ,{" "}
                {address.state ||
                  customer.state ||
                  "—"}
              </p>

              <p>
                {address.pincode ||
                  customer.pincode ||
                  "—"}
              </p>

              <div className="mt-4 border-t pt-4">

                <p>
                  Phone:{" "}
                  {address.phone ||
                    customer.phone ||
                    "—"}
                </p>

                <p className="break-words">
                  Email:{" "}
                  {customer.email ||
                    order.user?.email ||
                    "—"}
                </p>

              </div>

            </div>

          </div>

          {/* PAYMENT */}

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">

            <h2 className="mb-5 text-xl font-black">
              Payment Information
            </h2>

            <div className="space-y-4">

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Payment Method
                </p>

                <p className="mt-1 font-bold">
                  {getPaymentLabel()}
                </p>

              </div>

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Payment Status
                </p>

                <p
                  className={`mt-1 font-bold ${
                    paymentStatus ===
                    "paid"
                      ? "text-green-600"
                      : paymentStatus ===
                        "failed"
                      ? "text-red-600"
                      : "text-gray-700"
                  }`}
                >
                  {getPaymentStatus()}
                </p>

              </div>

              {payment.transactionId && (
                <div>

                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    Transaction ID
                  </p>

                  <p className="mt-1 break-all font-mono text-sm">
                    {
                      payment.transactionId
                    }
                  </p>

                </div>
              )}

              {/* REFUND */}

              {refund && (
                <div className="border-t pt-4">

                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    Refund Status
                  </p>

                  <p
                    className={`mt-1 font-bold ${getRefundStatusStyle()}`}
                  >
                    {getRefundStatusLabel()}
                  </p>

                  {Number(
                    refund.amount || 0
                  ) > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      Refund Amount: ₹
                      {Number(
                        refund.amount
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  )}

                  {refund.refundId && (
                    <p className="mt-1 break-all text-sm text-gray-500">
                      Refund ID:{" "}
                      {refund.refundId}
                    </p>
                  )}

                </div>
              )}

            </div>

          </div>

        </div>

        {/* PRICE DETAILS */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <h2 className="mb-5 text-2xl font-black">
            Price Details
          </h2>

          <div className="max-w-xl space-y-4">

            <div className="flex justify-between gap-4">

              <span className="text-gray-600">
                Subtotal
              </span>

              <span>
                ₹
                {subtotal.toLocaleString(
                  "en-IN"
                )}
              </span>

            </div>

            {couponDiscount > 0 && (
              <div className="flex justify-between gap-4 text-green-600">

                <span>
                  Coupon Discount
                </span>

                <span>
                  −₹
                  {couponDiscount.toLocaleString(
                    "en-IN"
                  )}
                </span>

              </div>
            )}

            <div className="flex justify-between gap-4">

              <span className="text-gray-600">
                Shipping
              </span>

              <span>
                {shipping === 0
                  ? "FREE"
                  : `₹${shipping.toLocaleString(
                      "en-IN"
                    )}`}
              </span>

            </div>

            {order.coupon?.code && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                Coupon applied:{" "}
                <strong>
                  {order.coupon.code}
                </strong>
              </div>
            )}

            <div className="border-t pt-4">

              <div className="flex justify-between gap-4 text-2xl font-black">

                <span>
                  Total
                </span>

                <span>
                  ₹
                  {total.toLocaleString(
                    "en-IN"
                  )}
                </span>

              </div>

            </div>

          </div>

        </div>

        {/* ORDER ACTIONS */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <h2 className="mb-5 text-xl font-black">
            Order Actions
          </h2>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">

            {/* CANCEL */}

            {canCancel && (
              <button
                type="button"
                onClick={() =>
                  setShowCancelConfirm(
                    true
                  )
                }
                className="rounded-xl border border-red-300 px-6 py-3 font-bold text-red-600 transition hover:bg-red-50"
              >
                CANCEL ORDER
              </button>
            )}

            {/* RETURN */}

            {canReturn && (
              <button
                type="button"
                onClick={() =>
                  setShowReturnConfirm(
                    true
                  )
                }
                className="rounded-xl border border-orange-300 px-6 py-3 font-bold text-orange-600 transition hover:bg-orange-50"
              >
                REQUEST RETURN
              </button>
            )}

            {/* CANCELLED */}

            {status ===
              "cancelled" && (
              <div className="rounded-xl bg-red-50 px-5 py-3 text-sm font-bold text-red-600">
                This order has been
                cancelled.
              </div>
            )}

            {/* RETURN REQUESTED */}

            {status ===
              "return-requested" && (
              <div className="rounded-xl bg-yellow-50 px-5 py-3 text-sm font-bold text-yellow-700">
                Your return request is
                being processed.
              </div>
            )}

            {/* RETURNED */}

            {status ===
              "returned" && (
              <div className="rounded-xl bg-gray-100 px-5 py-3 text-sm font-bold text-gray-600">
                This order has already
                been returned.
              </div>
            )}

            {/* NO ACTION */}

            {!canCancel &&
              !canReturn &&
              status !== "cancelled" &&
              status !==
                "return-requested" &&
              status !== "returned" && (
                <p className="text-sm text-gray-500">
                  No actions are available
                  for this order at its
                  current stage.
                </p>
              )}

          </div>

        </div>

        {/* BOTTOM ACTIONS */}

        <div className="mb-10 flex flex-col gap-3 sm:flex-row">

          <Link
            to={`/orders/${order.id}/track`}
            className="flex-1 rounded-xl bg-orange-600 px-6 py-4 text-center font-bold text-white transition hover:bg-orange-700"
          >
            TRACK ORDER
          </Link>

          <Link
            to="/orders"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-4 text-center font-bold transition hover:bg-gray-50"
          >
            MY ORDERS
          </Link>

          <Link
            to="/shop"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-4 text-center font-bold transition hover:bg-gray-50"
          >
            CONTINUE SHOPPING
          </Link>

        </div>

      </div>

      {/* =======================================
          CANCEL CONFIRMATION MODAL
      ======================================== */}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">

          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">

            <div className="mb-5 text-5xl">
              ⚠️
            </div>

            <h2 className="text-2xl font-black">
              Cancel Order?
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Are you sure you want to
              cancel this order?
            </p>

            {paymentStatus ===
              "paid" && (
              <div className="mt-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-700">

                <strong>
                  Refund information:
                </strong>

                <p className="mt-1">
                  ₹
                  {total.toLocaleString(
                    "en-IN"
                  )}{" "}
                  will be marked as
                  refund pending.
                </p>

              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">

              <button
                type="button"
                onClick={() =>
                  setShowCancelConfirm(
                    false
                  )
                }
                className="flex-1 rounded-xl border border-gray-300 px-5 py-3 font-bold transition hover:bg-gray-50"
              >
                KEEP ORDER
              </button>

              <button
                type="button"
                onClick={cancelOrder}
                className="flex-1 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700"
              >
                YES, CANCEL
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =======================================
          RETURN CONFIRMATION MODAL
      ======================================== */}

      {showReturnConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">

          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">

            <div className="mb-5 text-5xl">
              ↩️
            </div>

            <h2 className="text-2xl font-black">
              Request Return?
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Your return request will
              be submitted for this
              delivered order.
            </p>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">

              <p>
                Order:{" "}
                <strong>
                  #{order.id}
                </strong>
              </p>

              <p className="mt-1">
                Refund amount:{" "}
                <strong>
                  ₹
                  {total.toLocaleString(
                    "en-IN"
                  )}
                </strong>
              </p>

            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">

              <button
                type="button"
                onClick={() =>
                  setShowReturnConfirm(
                    false
                  )
                }
                className="flex-1 rounded-xl border border-gray-300 px-5 py-3 font-bold transition hover:bg-gray-50"
              >
                GO BACK
              </button>

              <button
                type="button"
                onClick={requestReturn}
                className="flex-1 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white transition hover:bg-orange-700"
              >
                REQUEST RETURN
              </button>

            </div>

          </div>

        </div>
      )}

    </section>
  );
}

export default OrderDetailsPage;

