
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ORDERS_STORAGE_KEY = "gymdrobe-orders";

function OrdersPage() {
  const { user, isAuthenticated } = useAuth();

  /*
    If the user is not logged in,
    redirect to login.
  */

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /*
    Get all saved orders.
  */

  let allOrders = [];

  try {
    const savedOrders = localStorage.getItem(
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
    Get logged-in user's email safely.
  */

  const userEmail = String(
    user?.email || ""
  )
    .trim()
    .toLowerCase();

  /*
    IMPORTANT:
    Only show orders belonging to the
    currently logged-in user.

    Checkout stores user information as:

    order.user.email
    OR
    order.customer.email
  */

  const orders = allOrders.filter((order) => {
    const orderEmail = String(
      order?.user?.email ||
        order?.customer?.email ||
        ""
    )
      .trim()
      .toLowerCase();

    return (
      orderEmail &&
      userEmail &&
      orderEmail === userEmail
    );
  });

  /*
    Format order date.
  */

  function formatDate(dateValue) {
    if (!dateValue) {
      return "Date unavailable";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /*
    Format order time.
  */

  function formatTime(dateValue) {
    if (!dateValue) {
      return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /*
    Get order status.
  */

  function getOrderStatus(order) {
    return order?.status || "confirmed";
  }

  /*
    Status badge styling.
  */

  function getStatusStyle(status) {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700";

      case "cancelled":
        return "bg-red-100 text-red-700";

      case "return-requested":
        return "bg-yellow-100 text-yellow-700";

      case "returned":
        return "bg-gray-200 text-gray-700";

      case "shipped":
        return "bg-blue-100 text-blue-700";

      case "out-for-delivery":
        return "bg-purple-100 text-purple-700";

      case "payment-pending":
        return "bg-yellow-100 text-yellow-700";

      case "processing":
        return "bg-orange-100 text-orange-700";

      default:
        return "bg-orange-100 text-orange-700";
    }
  }

  /*
    Human-readable status.
  */

  function getStatusLabel(status) {
    switch (status) {
      case "payment-pending":
        return "Payment Pending";

      case "return-requested":
        return "Return Requested";

      case "out-for-delivery":
        return "Out for Delivery";

      case "cancelled":
        return "Cancelled";

      case "delivered":
        return "Delivered";

      case "returned":
        return "Returned";

      case "shipped":
        return "Shipped";

      case "processing":
        return "Processing";

      case "confirmed":
        return "Confirmed";

      default:
        return "Processing";
    }
  }

  /*
    Payment method label.
  */

  function getPaymentLabel(order) {
    const method =
      order?.payment?.method ||
      order?.paymentMethod;

    switch (method) {
      case "cod":
        return "Cash on Delivery";

      case "upi":
        return "UPI";

      case "card":
        return "Card";

      default:
        return "Online Payment";
    }
  }

  /*
    Get final order total.
  */

  function getTotal(order) {
    return Number(
      order?.pricing?.finalTotal ??
        order?.pricing?.total ??
        0
    );
  }

  /*
    Count total products in the order.
  */

  function getItemCount(order) {
    if (!Array.isArray(order?.items)) {
      return 0;
    }

    return order.items.reduce(
      (total, item) =>
        total + Number(item?.quantity || 0),
      0
    );
  }

  /*
    LOGGED-IN USER WITH NO ORDERS
  */

  if (orders.length === 0) {
    return (
      <section className="min-h-screen bg-gray-100 px-4 py-10 text-black sm:px-6 sm:py-14">
        <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
          <div className="w-full rounded-3xl bg-white p-8 text-center shadow-sm sm:p-12">

            <div className="mb-5 text-6xl">
              📦
            </div>

            <h1 className="mb-3 text-3xl font-black sm:text-4xl">
              My Orders
            </h1>

            <p className="mb-7 text-gray-500">
              You haven't placed any orders yet.
            </p>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">

              <Link
                to="/shop"
                className="rounded-xl bg-orange-600 px-7 py-3 font-bold text-white transition hover:bg-orange-700"
              >
                START SHOPPING
              </Link>

              <Link
                to="/account"
                className="rounded-xl border border-gray-300 bg-white px-7 py-3 font-bold transition hover:bg-gray-50"
              >
                MY ACCOUNT
              </Link>

            </div>

          </div>
        </div>
      </section>
    );
  }

  /*
    ORDERS PAGE
  */

  return (
    <section className="min-h-screen bg-gray-100 px-4 py-8 text-black sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-8">
          <h1 className="text-3xl font-black sm:text-4xl">
            My Orders
          </h1>

          <p className="mt-2 text-gray-500">
            View and manage your GymDrobe orders.
          </p>
        </div>

        {/* ORDER COUNT */}

        <div className="mb-6 rounded-xl bg-white px-5 py-4 shadow-sm">
          <p className="text-sm text-gray-500">
            Total Orders
          </p>

          <p className="text-2xl font-black">
            {orders.length}
          </p>
        </div>

        {/* ORDERS */}

        <div className="space-y-6">

          {orders.map((order) => {
            const status =
              getOrderStatus(order);

            const total =
              getTotal(order);

            const itemCount =
              getItemCount(order);

            const items =
              Array.isArray(order.items)
                ? order.items
                : [];

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm"
              >

                {/* ORDER HEADER */}

                <div className="border-b p-5 sm:p-6">

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-3">

                        <h2 className="break-all text-lg font-black">
                          Order #{order.id}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(
                            status
                          )}`}
                        >
                          {getStatusLabel(
                            status
                          )}
                        </span>

                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">

                        <span>
                          {formatDate(
                            order.createdAt
                          )}
                        </span>

                        {formatTime(
                          order.createdAt
                        ) && (
                          <span>
                            {formatTime(
                              order.createdAt
                            )}
                          </span>
                        )}

                        <span>
                          {itemCount}{" "}
                          {itemCount === 1
                            ? "item"
                            : "items"}
                        </span>

                      </div>

                    </div>

                    <div className="shrink-0 lg:text-right">

                      <p className="text-sm text-gray-500">
                        Order Total
                      </p>

                      <p className="text-2xl font-black">
                        ₹
                        {total.toLocaleString(
                          "en-IN"
                        )}
                      </p>

                    </div>

                  </div>

                </div>

                {/* PRODUCTS */}

                <div className="p-5 sm:p-6">

                  <div className="space-y-4">

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
                            className="flex gap-4"
                          >

                            {/* IMAGE */}

                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24">

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
                                <div className="flex h-full items-center justify-center text-2xl">
                                  📦
                                </div>
                              )}

                            </div>

                            {/* INFO */}

                            <div className="min-w-0 flex-1">

                              <h3 className="break-words font-bold">
                                {item?.name ||
                                  "Product"}
                              </h3>

                              <p className="mt-1 text-sm text-gray-500">
                                ₹
                                {price.toLocaleString(
                                  "en-IN"
                                )}{" "}
                                ×{" "}
                                {quantity}
                              </p>

                              {item?.selectedSize && (
                                <p className="text-sm text-gray-500">
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

                            {/* ITEM TOTAL */}

                            <div className="shrink-0 text-right">

                              <p className="font-bold">
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

                  {/* ORDER META */}

                  <div className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2">

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                        Payment
                      </p>

                      <p className="mt-1 font-medium">
                        {getPaymentLabel(
                          order
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                        Delivery
                      </p>

                      <p className="mt-1 font-medium">
                        {order?.delivery?.label ||
                          (order?.deliveryMethod ===
                          "express"
                            ? "Express Delivery"
                            : "Standard Delivery")}
                      </p>
                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">

                    <Link
                      to={`/orders/${order.id}`}
                      className="rounded-xl bg-orange-600 px-6 py-3 text-center font-bold text-white transition hover:bg-orange-700"
                    >
                      VIEW DETAILS
                    </Link>

                    <Link
                      to={`/orders/${order.id}/track`}
                      className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center font-bold transition hover:bg-gray-50"
                    >
                      TRACK ORDER
                    </Link>

                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
}

export default OrdersPage;

