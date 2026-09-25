import {
  useMemo,
  useState,
} from "react";

import {
  Link,
  Navigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const ORDERS_STORAGE_KEY =
  "gymdrobe-orders";

/* =========================================================
   HELPERS
========================================================= */

function readOrders() {
  try {
    const savedOrders =
      localStorage.getItem(
        ORDERS_STORAGE_KEY
      );

    const parsed =
      savedOrders
        ? JSON.parse(
            savedOrders
          )
        : [];

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function formatDate(
  dateValue
) {
  if (!dateValue) {
    return "Date unavailable";
  }

  const date =
    new Date(
      dateValue
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unavailable";
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

function formatTime(
  dateValue
) {
  if (!dateValue) {
    return "";
  }

  const date =
    new Date(
      dateValue
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatCurrency(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    }
  );
}

function getOrderStatus(
  order
) {
  return (
    order?.status ||
    "confirmed"
  );
}

function getStatusLabel(
  status
) {
  switch (status) {
    case "payment-pending":
      return "Payment Pending";

    case "return-requested":
      return "Return Requested";

    case "out-for-delivery":
      return "Out For Delivery";

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

function getStatusStyle(
  status
) {
  switch (status) {
    case "delivered":
      return `
        bg-green-50
        text-green-700
        border-green-200
      `;

    case "cancelled":
      return `
        bg-red-50
        text-red-700
        border-red-200
      `;

    case "return-requested":
      return `
        bg-yellow-50
        text-yellow-700
        border-yellow-200
      `;

    case "returned":
      return `
        bg-gray-100
        text-gray-700
        border-gray-200
      `;

    case "shipped":
      return `
        bg-blue-50
        text-blue-700
        border-blue-200
      `;

    case "out-for-delivery":
      return `
        bg-purple-50
        text-purple-700
        border-purple-200
      `;

    case "payment-pending":
      return `
        bg-yellow-50
        text-yellow-700
        border-yellow-200
      `;

    case "processing":
      return `
        bg-orange-50
        text-orange-700
        border-orange-200
      `;

    default:
      return `
        bg-orange-50
        text-orange-700
        border-orange-200
      `;
  }
}

function getPaymentLabel(
  order
) {
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

function getPaymentStatus(
  order
) {
  const status =
    order?.payment?.status;

  if (
    status === "paid"
  ) {
    return "Paid";
  }

  if (
    status ===
    "payment-pending"
  ) {
    return "Payment Pending";
  }

  if (
    order?.payment?.method ===
      "cod" ||
    order?.paymentMethod ===
      "cod"
  ) {
    return "Pay On Delivery";
  }

  return "Pending";
}

function getDeliveryLabel(
  order
) {
  return (
    order?.delivery?.label ||
    (
      order?.deliveryMethod ===
      "express"
        ? "Express Delivery"
        : "Standard Delivery"
    )
  );
}

function getTotal(
  order
) {
  return Number(
    order?.pricing
      ?.finalTotal ??
      order?.pricing
        ?.total ??
      0
  );
}

function getItemCount(
  order
) {
  if (
    !Array.isArray(
      order?.items
    )
  ) {
    return 0;
  }

  return order.items.reduce(
    (
      total,
      item
    ) =>
      total +
      Number(
        item?.quantity ||
          0
      ),
    0
  );
}

/* =========================================================
   SEARCH ICON
========================================================= */

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />

      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/* =========================================================
   ORDERS PAGE
========================================================= */

function OrdersPage() {
  const {
    user,
    isAuthenticated,
  } = useAuth();

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  /* =======================================================
     AUTH
  ======================================================= */

  if (
    !isAuthenticated
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /* =======================================================
     USER ORDERS
  ======================================================= */

  const orders =
    useMemo(() => {
      const allOrders =
        readOrders();

      const userEmail =
        String(
          user?.email || ""
        )
          .trim()
          .toLowerCase();

      return allOrders
        .filter(
          (order) => {
            const orderEmail =
              String(
                order?.user
                  ?.email ||
                  order
                    ?.customer
                    ?.email ||
                  ""
              )
                .trim()
                .toLowerCase();

            return (
              orderEmail &&
              userEmail &&
              orderEmail ===
                userEmail
            );
          }
        )
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.createdAt ||
                0
            ).getTime() -
            new Date(
              first.createdAt ||
                0
            ).getTime()
        );
    }, [
      user,
    ]);

  /* =======================================================
     FILTERED ORDERS
  ======================================================= */

  const filteredOrders =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          const status =
            getOrderStatus(
              order
            );

          const matchesStatus =
            statusFilter ===
              "all" ||
            status ===
              statusFilter;

          if (
            !matchesStatus
          ) {
            return false;
          }

          if (
            !searchText
          ) {
            return true;
          }

          const productNames =
            Array.isArray(
              order?.items
            )
              ? order.items
                  .map(
                    (item) =>
                      item?.name ||
                      ""
                  )
                  .join(" ")
              : "";

          const searchable =
            [
              order?.id,
              status,
              getStatusLabel(
                status
              ),
              productNames,
              getPaymentLabel(
                order
              ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            searchText
          );
        }
      );
    }, [
      orders,
      search,
      statusFilter,
    ]);

  /* =======================================================
     COUNTS
  ======================================================= */

  const statusCounts =
    useMemo(() => {
      const counts = {
        all:
          orders.length,

        confirmed: 0,
        processing: 0,
        shipped: 0,
        "out-for-delivery": 0,
        delivered: 0,
        cancelled: 0,
      };

      orders.forEach(
        (order) => {
          const status =
            getOrderStatus(
              order
            );

          if (
            Object.prototype.hasOwnProperty.call(
              counts,
              status
            )
          ) {
            counts[
              status
            ] += 1;
          }
        }
      );

      return counts;
    }, [
      orders,
    ]);

  /* =======================================================
     NO ORDERS
  ======================================================= */

  if (
    orders.length === 0
  ) {
    return (
      <main
        className="
          min-h-screen
          bg-[#f5f5f6]
          px-4
          py-10
          text-[#282c3f]
          sm:px-6
        "
      >
        <div
          className="
            mx-auto
            flex
            min-h-[70vh]
            max-w-[700px]
            items-center
            justify-center
          "
        >
          <div
            className="
              w-full
              border
              border-[#eaeaec]
              bg-white
              px-6
              py-12
              text-center
              sm:px-12
            "
          >
            <div
              className="
                mx-auto
                flex
                h-20
                w-20
                items-center
                justify-center
                rounded-full
                bg-orange-50
                text-4xl
              "
            >
              📦
            </div>

            <p
              className="
                mt-6
                text-[10px]
                font-bold
                uppercase
                tracking-[0.18em]
                text-orange-600
              "
            >
              GymDrobe Orders
            </p>

            <h1
              className="
                mt-2
                text-3xl
                font-bold
              "
            >
              No Orders Yet
            </h1>

            <p
              className="
                mx-auto
                mt-3
                max-w-md
                text-sm
                leading-6
                text-[#696b79]
              "
            >
              You haven't
              placed any orders
              yet. Explore
              GymDrobe and find
              your next workout
              essential.
            </p>

            <div
              className="
                mt-7
                flex
                flex-col
                justify-center
                gap-3
                sm:flex-row
              "
            >
              <Link
                to="/shop"
                className="
                  bg-orange-600
                  px-7
                  py-3
                  text-xs
                  font-bold
                  uppercase
                  text-white
                  transition
                  hover:bg-orange-700
                "
              >
                Start Shopping
              </Link>

              <Link
                to="/account"
                className="
                  border
                  border-[#d4d5d9]
                  bg-white
                  px-7
                  py-3
                  text-xs
                  font-bold
                  uppercase
                "
              >
                My Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     FILTER TABS
  ======================================================= */

  const tabs = [
    {
      value: "all",
      label: "All",
    },

    {
      value:
        "confirmed",
      label:
        "Confirmed",
    },

    {
      value:
        "processing",
      label:
        "Processing",
    },

    {
      value:
        "shipped",
      label:
        "Shipped",
    },

    {
      value:
        "out-for-delivery",
      label:
        "Out For Delivery",
    },

    {
      value:
        "delivered",
      label:
        "Delivered",
    },

    {
      value:
        "cancelled",
      label:
        "Cancelled",
    },
  ];

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main
      className="
        min-h-screen
        bg-[#f5f5f6]
        text-[#282c3f]
      "
    >
      <div
        className="
          mx-auto
          max-w-[1100px]
          px-4
          py-8
          sm:px-6
          lg:py-10
        "
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            flex
            flex-col
            gap-5
            sm:flex-row
            sm:items-end
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.18em]
                text-orange-600
              "
            >
              Your Purchases
            </p>

            <h1
              className="
                mt-2
                text-3xl
                font-bold
              "
            >
              My Orders
            </h1>

            <p
              className="
                mt-2
                text-sm
                text-[#696b79]
              "
            >
              Track, view and
              manage your
              GymDrobe orders.
            </p>
          </div>

          <div
            className="
              text-left
              sm:text-right
            "
          >
            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-wide
                text-[#94969f]
              "
            >
              Total Orders
            </p>

            <p
              className="
                mt-1
                text-2xl
                font-bold
              "
            >
              {
                orders.length
              }
            </p>
          </div>
        </div>

        {/* =================================================
            SEARCH
        ================================================= */}

        <div
          className="
            mt-7
            border
            border-[#eaeaec]
            bg-white
          "
        >
          <div
            className="
              flex
              h-[48px]
              items-center
            "
          >
            <span
              className="
                flex
                h-full
                w-12
                shrink-0
                items-center
                justify-center
                text-[#696b79]
              "
            >
              <SearchIcon />
            </span>

            <input
              type="search"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search by order ID or product name"
              className="
                min-w-0
                flex-1
                bg-transparent
                pr-4
                text-sm
                outline-none
                placeholder:text-[#94969f]
              "
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="
                  px-4
                  text-xl
                  text-[#696b79]
                "
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* =================================================
            STATUS FILTER
        ================================================= */}

        <div
          className="
            hide-scrollbar
            mt-4
            flex
            gap-2
            overflow-x-auto
            pb-2
          "
        >
          {tabs.map(
            (tab) => {
              const count =
                statusCounts[
                  tab.value
                ] ?? 0;

              return (
                <button
                  key={
                    tab.value
                  }
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      tab.value
                    )
                  }
                  className={`
                    shrink-0
                    border
                    px-4
                    py-2
                    text-[11px]
                    font-bold
                    transition

                    ${
                      statusFilter ===
                      tab.value
                        ? "border-orange-600 bg-orange-600 text-white"
                        : "border-[#d4d5d9] bg-white text-[#696b79] hover:border-[#282c3f]"
                    }
                  `}
                >
                  {tab.label}

                  {count > 0 && (
                    <span
                      className="
                        ml-1
                      "
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>

        {/* =================================================
            RESULTS COUNT
        ================================================= */}

        <div
          className="
            mt-4
            flex
            items-center
            justify-between
            gap-4
          "
        >
          <p
            className="
              text-[11px]
              text-[#696b79]
            "
          >
            Showing{" "}
            {
              filteredOrders.length
            }{" "}
            order
            {filteredOrders.length !==
            1
              ? "s"
              : ""}
          </p>

          {(
            search ||
            statusFilter !==
              "all"
          ) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");

                setStatusFilter(
                  "all"
                );
              }}
              className="
                text-[10px]
                font-bold
                uppercase
                text-orange-600
              "
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* =================================================
            NO FILTER RESULTS
        ================================================= */}

        {filteredOrders.length ===
          0 && (
          <div
            className="
              mt-6
              border
              border-[#eaeaec]
              bg-white
              px-6
              py-14
              text-center
            "
          >
            <div
              className="
                text-4xl
              "
            >
              🔍
            </div>

            <h2
              className="
                mt-4
                text-lg
                font-bold
              "
            >
              No Orders Found
            </h2>

            <p
              className="
                mt-2
                text-sm
                text-[#696b79]
              "
            >
              Try another search
              or status filter.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");

                setStatusFilter(
                  "all"
                );
              }}
              className="
                mt-5
                border
                border-orange-600
                px-5
                py-2.5
                text-xs
                font-bold
                uppercase
                text-orange-600
              "
            >
              Show All Orders
            </button>
          </div>
        )}

        {/* =================================================
            ORDER LIST
        ================================================= */}

        <div
          className="
            mt-6
            space-y-5
          "
        >
          {filteredOrders.map(
            (order) => {
              const status =
                getOrderStatus(
                  order
                );

              const total =
                getTotal(
                  order
                );

              const itemCount =
                getItemCount(
                  order
                );

              const items =
                Array.isArray(
                  order.items
                )
                  ? order.items
                  : [];

              const firstItems =
                items.slice(
                  0,
                  3
                );

              const extraItems =
                Math.max(
                  items.length -
                    firstItems.length,
                  0
                );

              return (
                <article
                  key={
                    order.id
                  }
                  className="
                    border
                    border-[#eaeaec]
                    bg-white
                  "
                >
                  {/* =======================================
                      ORDER HEADER
                  ======================================= */}

                  <div
                    className="
                      flex
                      flex-col
                      gap-4
                      border-b
                      border-[#eaeaec]
                      px-5
                      py-5
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                      sm:px-6
                    "
                  >
                    <div
                      className="
                        min-w-0
                      "
                    >
                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-3
                        "
                      >
                        <h2
                          className="
                            break-all
                            text-sm
                            font-bold
                          "
                        >
                          Order{" "}
                          {
                            order.id
                          }
                        </h2>

                        <span
                          className={`
                            border
                            px-2.5
                            py-1
                            text-[9px]
                            font-bold
                            uppercase
                            tracking-wide
                            ${getStatusStyle(
                              status
                            )}
                          `}
                        >
                          {getStatusLabel(
                            status
                          )}
                        </span>
                      </div>

                      <div
                        className="
                          mt-2
                          flex
                          flex-wrap
                          gap-x-4
                          gap-y-1
                          text-[11px]
                          text-[#696b79]
                        "
                      >
                        <span>
                          Placed on{" "}
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
                          {itemCount ===
                          1
                            ? "item"
                            : "items"}
                        </span>
                      </div>
                    </div>

                    <div
                      className="
                        shrink-0
                        sm:text-right
                      "
                    >
                      <p
                        className="
                          text-[10px]
                          uppercase
                          text-[#94969f]
                        "
                      >
                        Order Total
                      </p>

                      <p
                        className="
                          mt-1
                          text-xl
                          font-bold
                        "
                      >
                        ₹
                        {formatCurrency(
                          total
                        )}
                      </p>
                    </div>
                  </div>

                  {/* =======================================
                      PRODUCTS
                  ======================================= */}

                  <div
                    className="
                      px-5
                      py-5
                      sm:px-6
                    "
                  >
                    <div
                      className="
                        divide-y
                        divide-[#eaeaec]
                      "
                    >
                      {firstItems.map(
                        (
                          item,
                          index
                        ) => {
                          const quantity =
                            Number(
                              item?.quantity ||
                                1
                            );

                          const price =
                            Number(
                              item?.price ||
                                0
                            );

                          const itemTotal =
                            price *
                            quantity;

                          return (
                            <div
                              key={
                                item?.itemKey ||
                                `${item?.id}-${item?.selectedSize}-${item?.selectedColor}-${index}`
                              }
                              className="
                                flex
                                gap-4
                                py-4
                                first:pt-0
                              "
                            >
                              {/* IMAGE */}

                              <Link
                                to={`/product/${item?.id}`}
                                className="
                                  h-[105px]
                                  w-[80px]
                                  shrink-0
                                  overflow-hidden
                                  bg-[#f5f5f6]
                                "
                              >
                                {item?.image ? (
                                  <img
                                    src={
                                      item.image
                                    }
                                    alt={
                                      item?.name ||
                                      "Product"
                                    }
                                    className="
                                      h-full
                                      w-full
                                      object-cover
                                    "
                                  />
                                ) : (
                                  <div
                                    className="
                                      flex
                                      h-full
                                      items-center
                                      justify-center
                                      text-2xl
                                    "
                                  >
                                    📦
                                  </div>
                                )}
                              </Link>

                              {/* INFO */}

                              <div
                                className="
                                  min-w-0
                                  flex-1
                                "
                              >
                                <p
                                  className="
                                    text-sm
                                    font-bold
                                  "
                                >
                                  {item?.brand ||
                                    "GymDrobe"}
                                </p>

                                <Link
                                  to={`/product/${item?.id}`}
                                  className="
                                    mt-1
                                    block
                                    text-[13px]
                                    text-[#696b79]
                                    hover:text-orange-600
                                  "
                                >
                                  {item?.name ||
                                    "Product"}
                                </Link>

                                <div
                                  className="
                                    mt-2
                                    flex
                                    flex-wrap
                                    gap-x-4
                                    gap-y-1
                                    text-[11px]
                                    text-[#696b79]
                                  "
                                >
                                  {item?.selectedSize && (
                                    <span>
                                      Size:{" "}
                                      {
                                        item.selectedSize
                                      }
                                    </span>
                                  )}

                                  {item?.selectedColor && (
                                    <span>
                                      Color:{" "}
                                      {
                                        item.selectedColor
                                      }
                                    </span>
                                  )}

                                  <span>
                                    Qty:{" "}
                                    {
                                      quantity
                                    }
                                  </span>
                                </div>

                                <p
                                  className="
                                    mt-3
                                    text-sm
                                    font-bold
                                  "
                                >
                                  ₹
                                  {formatCurrency(
                                    price
                                  )}
                                </p>
                              </div>

                              {/* ITEM TOTAL */}

                              <div
                                className="
                                  hidden
                                  shrink-0
                                  text-right
                                  sm:block
                                "
                              >
                                <p
                                  className="
                                    text-sm
                                    font-bold
                                  "
                                >
                                  ₹
                                  {formatCurrency(
                                    itemTotal
                                  )}
                                </p>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>

                    {extraItems >
                      0 && (
                      <p
                        className="
                          mt-3
                          text-[11px]
                          text-[#696b79]
                        "
                      >
                        + {extraItems} more{" "}
                        {extraItems ===
                        1
                          ? "product"
                          : "products"}{" "}
                        in this order
                      </p>
                    )}

                    {/* =====================================
                        META
                    ===================================== */}

                    <div
                      className="
                        mt-5
                        grid
                        gap-4
                        border-t
                        border-[#eaeaec]
                        pt-5
                        sm:grid-cols-3
                      "
                    >
                      <div>
                        <p
                          className="
                            text-[9px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-[#94969f]
                          "
                        >
                          Payment
                        </p>

                        <p
                          className="
                            mt-1
                            text-[12px]
                            font-semibold
                          "
                        >
                          {getPaymentLabel(
                            order
                          )}
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            text-[#696b79]
                          "
                        >
                          {getPaymentStatus(
                            order
                          )}
                        </p>
                      </div>

                      <div>
                        <p
                          className="
                            text-[9px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-[#94969f]
                          "
                        >
                          Delivery
                        </p>

                        <p
                          className="
                            mt-1
                            text-[12px]
                            font-semibold
                          "
                        >
                          {getDeliveryLabel(
                            order
                          )}
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            text-[#696b79]
                          "
                        >
                          {order?.delivery
                            ?.estimatedTime ||
                            "Delivery estimate available in tracking"}
                        </p>
                      </div>

                      <div>
                        <p
                          className="
                            text-[9px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-[#94969f]
                          "
                        >
                          Order Status
                        </p>

                        <p
                          className="
                            mt-1
                            text-[12px]
                            font-semibold
                          "
                        >
                          {getStatusLabel(
                            status
                          )}
                        </p>
                      </div>
                    </div>

                    {/* =====================================
                        ACTIONS
                    ===================================== */}

                    <div
                      className="
                        mt-5
                        flex
                        flex-col
                        gap-3
                        border-t
                        border-[#eaeaec]
                        pt-5
                        sm:flex-row
                        sm:justify-end
                      "
                    >
                      <Link
                        to={`/orders/${encodeURIComponent(
                          order.id
                        )}`}
                        className="
                          flex
                          min-h-[44px]
                          items-center
                          justify-center
                          bg-orange-600
                          px-6
                          text-[11px]
                          font-bold
                          uppercase
                          tracking-[0.04em]
                          text-white
                          transition
                          hover:bg-orange-700
                        "
                      >
                        View Details
                      </Link>

                      {status !==
                        "cancelled" &&
                        status !==
                          "returned" && (
                          <Link
                            to={`/orders/${encodeURIComponent(
                              order.id
                            )}/track`}
                            className="
                              flex
                              min-h-[44px]
                              items-center
                              justify-center
                              border
                              border-[#282c3f]
                              bg-white
                              px-6
                              text-[11px]
                              font-bold
                              uppercase
                              tracking-[0.04em]
                              text-[#282c3f]
                              transition
                              hover:bg-[#282c3f]
                              hover:text-white
                            "
                          >
                            Track Order
                          </Link>
                        )}
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
      </div>
    </main>
  );
}

export default OrdersPage;