
import {
  Link,
  Navigate,
  useParams,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ORDERS_STORAGE_KEY = "gymdrobe-orders";

function OrderTrackingPage() {
  const { orderId } = useParams();

  const {
    user,
    isAuthenticated,
  } = useAuth();

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

    allOrders = savedOrders
      ? JSON.parse(savedOrders)
      : [];

    if (!Array.isArray(allOrders)) {
      allOrders = [];
    }
  } catch {
    allOrders = [];
  }

  /*
  ==========================================
  FIND USER'S ORDER
  ==========================================
  */

  const order = isAuthenticated
    ? allOrders.find((item) => {
        const sameOrder =
          String(item.id) ===
          String(orderId);

        const orderEmail =
          item.user?.email ||
          item.customer?.email ||
          "";

        const belongsToUser =
          orderEmail.toLowerCase() ===
          user?.email?.toLowerCase();

        return (
          sameOrder &&
          belongsToUser
        );
      })
    : null;

  /*
  ==========================================
  LOGIN PROTECTION
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
  ORDER NOT FOUND
  ==========================================
  */

  if (!order) {
    return (
      <section className="min-h-screen bg-gray-100 px-4 py-10 text-black">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-3xl bg-white p-8 text-center shadow-sm sm:p-10">

            <div className="mb-5 text-6xl">
              🚚
            </div>

            <h1 className="mb-3 text-3xl font-black">
              Order Not Found
            </h1>

            <p className="mb-7 text-gray-500">
              We couldn't find this order in
              your account.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">

              <Link
                to="/orders"
                className="rounded-xl bg-orange-600 px-6 py-3 text-center font-bold text-white transition hover:bg-orange-700"
              >
                MY ORDERS
              </Link>

              <Link
                to="/shop"
                className="rounded-xl border border-gray-300 px-6 py-3 text-center font-bold transition hover:bg-gray-50"
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
  ORDER STATUS
  ==========================================
  */

  const status =
    order.status || "confirmed";

  /*
  ==========================================
  TRACKING STEPS
  ==========================================
  */

  const trackingSteps = [
    {
      key: "confirmed",
      title: "Order Confirmed",
      description:
        "Your order has been successfully placed.",
      icon: "✓",
    },
    {
      key: "processing",
      title: "Processing",
      description:
        "Your order is being prepared.",
      icon: "📦",
    },
    {
      key: "shipped",
      title: "Shipped",
      description:
        "Your package has left our warehouse.",
      icon: "🚚",
    },
    {
      key: "out-for-delivery",
      title: "Out for Delivery",
      description:
        "Your package is on the way to you.",
      icon: "🛵",
    },
    {
      key: "delivered",
      title: "Delivered",
      description:
        "Your order has been delivered.",
      icon: "🏠",
    },
  ];

  const statusOrder = [
    "confirmed",
    "processing",
    "shipped",
    "out-for-delivery",
    "delivered",
  ];

  const currentIndex =
    statusOrder.indexOf(status);

  const activeIndex =
    currentIndex === -1
      ? 0
      : currentIndex;

  /*
  ==========================================
  DELIVERY DATA
  ==========================================
  */

  const delivery =
    order.delivery || {};

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
  DATE FORMAT
  ==========================================
  */

  const formatDate = (dateValue) => {
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
  };

  /*
  ==========================================
  SPECIAL STATUSES
  ==========================================
  */

  const isCancelled =
    status === "cancelled";

  const isReturnRequested =
    status === "return-requested";

  const isReturned =
    status === "returned";

  return (
    <section className="min-h-screen bg-gray-100 px-4 py-8 text-black sm:px-6 sm:py-12">

      <div className="mx-auto max-w-5xl">

        {/* =====================================
            HEADER
        ====================================== */}

        <div className="mb-8">

          <Link
            to={`/orders/${order.id}`}
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-gray-500 transition hover:text-orange-600"
          >
            ← Back to Order Details
          </Link>

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-sm font-bold uppercase tracking-wide text-gray-400">
                  Tracking Order
                </p>

                <h1 className="mt-1 break-all text-2xl font-black sm:text-3xl">
                  #{order.id}
                </h1>

                <p className="mt-2 text-sm text-gray-500">
                  Ordered on{" "}
                  {formatDate(
                    order.createdAt
                  )}
                </p>

              </div>

              <div className="rounded-xl bg-gray-100 px-5 py-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Delivery
                </p>

                <p className="mt-1 font-bold">
                  {deliveryLabel}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {estimatedDelivery}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* =====================================
            CANCELLED
        ====================================== */}

        {isCancelled && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 sm:p-6">

            <h2 className="font-black">
              Order Cancelled
            </h2>

            <p className="mt-1 text-sm">
              This order has been cancelled.
            </p>

          </div>
        )}

        {/* =====================================
            RETURN
        ====================================== */}

        {(isReturnRequested ||
          isReturned) && (
          <div className="mb-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800 sm:p-6">

            <h2 className="font-black">
              {isReturned
                ? "Order Returned"
                : "Return Requested"}
            </h2>

            <p className="mt-1 text-sm">
              {isReturned
                ? "This order has been returned."
                : "Your return request is being processed."}
            </p>

          </div>
        )}

        {/* =====================================
            TRACKING
        ====================================== */}

        {!isCancelled &&
          !isReturnRequested &&
          !isReturned && (
            <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-8">

              <h2 className="mb-8 text-2xl font-black">
                Order Tracking
              </h2>

              <div className="relative">

                {/* VERTICAL LINE */}

                <div className="absolute bottom-5 left-5 top-5 w-0.5 bg-gray-200" />

                <div className="space-y-8">

                  {trackingSteps.map(
                    (step, index) => {
                      const completed =
                        index <=
                        activeIndex;

                      const current =
                        index ===
                        activeIndex;

                      return (
                        <div
                          key={step.key}
                          className="relative flex gap-5"
                        >

                          {/* ICON */}

                          <div
                            className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                              completed
                                ? "bg-orange-600 text-white"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {completed
                              ? step.icon
                              : index + 1}
                          </div>

                          {/* CONTENT */}

                          <div className="flex-1 pb-1">

                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                              <h3
                                className={`font-black ${
                                  current
                                    ? "text-orange-600"
                                    : completed
                                    ? "text-black"
                                    : "text-gray-400"
                                }`}
                              >
                                {step.title}
                              </h3>

                              {current && (
                                <span className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                                  CURRENT
                                </span>
                              )}

                            </div>

                            <p className="mt-1 text-sm text-gray-500">
                              {step.description}
                            </p>

                            {current && (
                              <p className="mt-2 text-xs font-medium text-gray-400">
                                Your order is currently
                                at this stage.
                              </p>
                            )}

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

            </div>
          )}

        {/* =====================================
            DELIVERY INFORMATION
        ====================================== */}

        <div className="mb-8 grid gap-6 md:grid-cols-2">

          {/* DELIVERY ADDRESS */}

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">

            <h2 className="mb-5 text-xl font-black">
              Delivery Address
            </h2>

            <div className="space-y-1 text-sm leading-6 text-gray-600">

              <p className="font-bold text-black">
                {order.shippingAddress
                  ?.name ||
                  order.customer?.name ||
                  "—"}
              </p>

              <p>
                {order.shippingAddress
                  ?.address ||
                  order.customer?.address ||
                  "—"}
              </p>

              <p>
                {order.shippingAddress
                  ?.city ||
                  order.customer?.city ||
                  "—"}
                ,{" "}
                {order.shippingAddress
                  ?.state ||
                  order.customer?.state ||
                  "—"}
              </p>

              <p>
                {order.shippingAddress
                  ?.pincode ||
                  order.customer?.pincode ||
                  "—"}
              </p>

              {order.shippingAddress
                ?.landmark && (
                <p>
                  Landmark:{" "}
                  {
                    order.shippingAddress
                      .landmark
                  }
                </p>
              )}

            </div>

          </div>

          {/* DELIVERY DETAILS */}

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">

            <h2 className="mb-5 text-xl font-black">
              Delivery Details
            </h2>

            <div className="space-y-4">

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Method
                </p>

                <p className="mt-1 font-bold">
                  {deliveryLabel}
                </p>

              </div>

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Estimated Delivery
                </p>

                <p className="mt-1 font-bold">
                  {estimatedDelivery}
                </p>

              </div>

              {order.updatedAt && (
                <div>

                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    Last Updated
                  </p>

                  <p className="mt-1 font-bold">
                    {formatDate(
                      order.updatedAt
                    )}
                  </p>

                </div>
              )}

            </div>

          </div>

        </div>

        {/* =====================================
            ACTIONS
        ====================================== */}

        <div className="flex flex-col gap-3 sm:flex-row">

          <Link
            to={`/orders/${order.id}`}
            className="flex-1 rounded-xl bg-gray-900 px-6 py-4 text-center font-bold text-white transition hover:bg-gray-800"
          >
            ORDER DETAILS
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

    </section>
  );
}

export default OrderTrackingPage;

