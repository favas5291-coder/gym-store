import {
  Link,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

/* =========================================================
   STORAGE KEYS
========================================================= */

const ORDERS_STORAGE_KEY =
  "gymdrobe-orders";

const LAST_ORDER_STORAGE_KEY =
  "gymdrobe-last-order";

/* =========================================================
   HELPERS
========================================================= */

function readStorage(
  key,
  fallback = null
) {
  try {
    const saved =
      localStorage.getItem(
        key
      );

    if (!saved) {
      return fallback;
    }

    return JSON.parse(
      saved
    );
  } catch {
    return fallback;
  }
}

function getUserStorageKey(
  baseKey,
  user
) {
  const userId = String(
    user?.id ||
      user?.email ||
      ""
  )
    .trim()
    .toLowerCase();

  if (!userId) {
    return `${baseKey}:guest`;
  }

  return `${baseKey}:${userId}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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

/* =========================================================
   ICONS
========================================================= */

function SuccessIcon() {
  return (
    <div
      className="
        flex
        h-20
        w-20
        items-center
        justify-center
        rounded-full
        bg-green-100
        text-4xl
        text-green-700
      "
    >
      ✓
    </div>
  );
}

function DeliveryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M3 5h11v11H3z" />
      <path d="M14 9h4l3 3v4h-7z" />
      <circle
        cx="7"
        cy="18"
        r="2"
      />
      <circle
        cx="18"
        cy="18"
        r="2"
      />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />

      <path d="M3 10h18" />
    </svg>
  );
}

/* =========================================================
   PAGE
========================================================= */

function OrderSuccessPage() {
  const [
    searchParams,
  ] = useSearchParams();

  const { user } =
    useAuth();

  const requestedOrderId =
    searchParams
      .get("orderId")
      ?.trim() || "";

  /* =======================================================
     FIND THE CORRECT ORDER
  ======================================================= */

  const allOrders =
    readStorage(
      ORDERS_STORAGE_KEY,
      []
    );

  let order = null;

  /*
    1. FIRST PRIORITY:
       Find the exact order requested in the URL.

       Example:
       /order-success?orderId=GD-123
  */

  if (
    requestedOrderId &&
    Array.isArray(
      allOrders
    )
  ) {
    order =
      allOrders.find(
        (item) =>
          String(
            item?.id
          ) ===
          String(
            requestedOrderId
          )
      ) || null;
  }

  /*
    2. SECOND PRIORITY:
       User-scoped last order.
  */

  if (
    !order &&
    !requestedOrderId
  ) {
    const scopedLastOrder =
      readStorage(
        getUserStorageKey(
          LAST_ORDER_STORAGE_KEY,
          user
        ),
        null
      );

    if (
      scopedLastOrder
    ) {
      order =
        scopedLastOrder;
    }
  }

  /*
    3. LEGACY FALLBACK:
       Old projects stored one global last order.

       IMPORTANT:
       We only use this when there is NO orderId
       in the URL so an old order cannot replace
       the requested order.
  */

  if (
    !order &&
    !requestedOrderId
  ) {
    order =
      readStorage(
        LAST_ORDER_STORAGE_KEY,
        null
      );
  }

  /* =======================================================
     ORDER NOT FOUND
  ======================================================= */

  if (!order) {
    return (
      <main
        className="
          flex
          min-h-[75vh]
          items-center
          justify-center
          bg-[#f5f5f6]
          px-5
          text-[#282c3f]
        "
      >
        <div
          className="
            w-full
            max-w-[520px]
            border
            border-[#eaeaec]
            bg-white
            px-6
            py-12
            text-center
            sm:px-10
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

          <h1
            className="
              mt-6
              text-2xl
              font-bold
            "
          >
            Order Not Found
          </h1>

          <p
            className="
              mt-3
              text-sm
              leading-6
              text-[#696b79]
            "
          >
            {requestedOrderId
              ? `We couldn't find order ${requestedOrderId}.`
              : "We couldn't find your recent order."}
          </p>

          <div
            className="
              mt-7
              flex
              flex-col
              gap-3
              sm:flex-row
              sm:justify-center
            "
          >
            <Link
              to="/orders"
              className="
                bg-[#282c3f]
                px-6
                py-3
                text-xs
                font-bold
                uppercase
                text-white
              "
            >
              View My Orders
            </Link>

            <Link
              to="/shop"
              className="
                border
                border-[#d4d5d9]
                bg-white
                px-6
                py-3
                text-xs
                font-bold
                uppercase
              "
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     ORDER DATA
  ======================================================= */

  const pricing =
    order.pricing || {};

  const customer =
    order.customer || {};

  const shippingAddress =
    order.shippingAddress ||
    {};

  const delivery =
    order.delivery || {};

  const payment =
    order.payment || {};

  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];

  /* =======================================================
     DATE
  ======================================================= */

  const formattedDate =
    formatDate(
      order.createdAt
    );

  const formattedTime =
    formatTime(
      order.createdAt
    );

  /* =======================================================
     DELIVERY
  ======================================================= */

  const deliveryMethod =
    delivery.method ||
    order.deliveryMethod ||
    "standard";

  const deliveryLabel =
    delivery.label ||
    (deliveryMethod ===
    "express"
      ? "Express Delivery"
      : "Standard Delivery");

  const deliveryTime =
    delivery.estimatedTime ||
    (deliveryMethod ===
    "express"
      ? "1–3 business days"
      : "3–7 business days");

  /* =======================================================
     PAYMENT
  ======================================================= */

  const paymentMethod =
    payment.method ||
    order.paymentMethod ||
    "cod";

  const paymentStatus =
    payment.status ||
    (paymentMethod ===
    "cod"
      ? "pending"
      : "payment-pending");

  function getPaymentLabel() {
    if (
      paymentMethod ===
      "cod"
    ) {
      return "Cash on Delivery";
    }

    if (
      paymentMethod ===
      "card"
    ) {
      return "Card Payment";
    }

    if (
      paymentMethod ===
      "upi"
    ) {
      return "UPI Payment";
    }

    return "Online Payment";
  }

  function getPaymentStatusLabel() {
    if (
      paymentStatus ===
      "paid"
    ) {
      return "Paid";
    }

    if (
      paymentStatus ===
      "payment-pending"
    ) {
      return "Payment Pending";
    }

    return "Pay On Delivery";
  }

  /* =======================================================
     PRICING
  ======================================================= */

  const subtotal =
    Number(
      pricing.subtotal ??
        0
    );

  const couponDiscount =
    Number(
      pricing.couponDiscount ??
        0
    );

  const shipping =
    Number(
      pricing.shipping ??
        0
    );

  const total =
    Number(
      pricing.finalTotal ??
        pricing.total ??
        0
    );

  const totalMrp =
    items.reduce(
      (
        totalAmount,
        item
      ) => {
        const price =
          Number(
            item.originalPrice ??
              item.price ??
              0
          );

        const quantity =
          Number(
            item.quantity ||
              1
          );

        return (
          totalAmount +
          price *
            quantity
        );
      },
      0
    );

  const productDiscount =
    Math.max(
      totalMrp -
        subtotal,
      0
    );

  const totalItems =
    items.reduce(
      (
        totalCount,
        item
      ) =>
        totalCount +
        Number(
          item.quantity ||
            0
        ),
      0
    );

  /* =======================================================
     ADDRESS
  ======================================================= */

  const addressName =
    shippingAddress.fullName ||
    shippingAddress.name ||
    customer.name ||
    "—";

  const addressLine =
    shippingAddress.addressLine ||
    shippingAddress.address ||
    customer.address ||
    "";

  const addressLandmark =
    shippingAddress.landmark ||
    "";

  const addressCity =
    shippingAddress.city ||
    customer.city ||
    "";

  const addressState =
    shippingAddress.state ||
    customer.state ||
    "";

  const addressPincode =
    shippingAddress.pincode ||
    customer.pincode ||
    "";

  const addressPhone =
    shippingAddress.phone ||
    customer.phone ||
    "";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main
      className="
        min-h-screen
        bg-[#f5f5f6]
        py-8
        text-[#282c3f]
        sm:py-10
      "
    >
      <div
        className="
          mx-auto
          max-w-[1050px]
          px-4
          sm:px-6
        "
      >
        {/* =================================================
            SUCCESS HEADER
        ================================================= */}

        <section
          className="
            border
            border-[#eaeaec]
            bg-white
            px-5
            py-10
            text-center
            sm:px-10
            sm:py-12
          "
        >
          <div
            className="
              flex
              justify-center
            "
          >
            <SuccessIcon />
          </div>

          <p
            className="
              mt-6
              text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-green-600
            "
          >
            Order Placed
          </p>

          <h1
            className="
              mt-2
              text-3xl
              font-bold
              sm:text-4xl
            "
          >
            Order Confirmed!
          </h1>

          <p
            className="
              mx-auto
              mt-3
              max-w-xl
              text-sm
              leading-6
              text-[#696b79]
            "
          >
            Thank you
            {customer.name
              ? `, ${customer.name}`
              : ""}
            . Your GymDrobe
            order has been
            successfully placed.
          </p>

          {/* ORDER ID */}

          <div
            className="
              mx-auto
              mt-6
              flex
              max-w-[420px]
              flex-col
              border
              border-[#eaeaec]
              bg-[#fafafa]
              px-5
              py-4
              sm:flex-row
              sm:items-center
              sm:justify-center
              sm:gap-2
            "
          >
            <span
              className="
                text-xs
                text-[#696b79]
              "
            >
              Order ID
            </span>

            <strong
              className="
                mt-1
                break-all
                text-sm
                sm:mt-0
              "
            >
              {order.id}
            </strong>
          </div>

          <div
            className="
              mt-4
              flex
              flex-col
              justify-center
              gap-1
              text-xs
              text-[#696b79]
              sm:flex-row
              sm:gap-4
            "
          >
            <span>
              {formattedDate}
            </span>

            <span
              className="
                hidden
                sm:block
              "
            >
              •
            </span>

            <span>
              {formattedTime}
            </span>
          </div>
        </section>

        {/* =================================================
            STATUS
        ================================================= */}

        <section
          className="
            mt-5
            border
            border-[#eaeaec]
            bg-white
            p-5
            sm:p-6
          "
        >
          <h2
            className="
              text-sm
              font-bold
              uppercase
              tracking-[0.04em]
            "
          >
            Order Status
          </h2>

          <div
            className="
              mt-5
              grid
              gap-0
              border
              border-[#eaeaec]
              sm:grid-cols-3
            "
          >
            {/* CONFIRMED */}

            <div
              className="
                border-b
                border-[#eaeaec]
                bg-green-50
                p-5
                sm:border-b-0
                sm:border-r
              "
            >
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-full
                  bg-green-100
                  font-bold
                  text-green-700
                "
              >
                ✓
              </div>

              <p
                className="
                  mt-4
                  text-sm
                  font-bold
                  text-green-700
                "
              >
                Order Confirmed
              </p>

              <p
                className="
                  mt-1
                  text-[11px]
                  leading-5
                  text-[#696b79]
                "
              >
                Your order has
                been received.
              </p>
            </div>

            {/* DELIVERY */}

            <div
              className="
                border-b
                border-[#eaeaec]
                p-5
                sm:border-b-0
                sm:border-r
              "
            >
              <div
                className="
                  text-[#282c3f]
                "
              >
                <DeliveryIcon />
              </div>

              <p
                className="
                  mt-4
                  text-sm
                  font-bold
                "
              >
                {deliveryLabel}
              </p>

              <p
                className="
                  mt-1
                  text-[11px]
                  leading-5
                  text-[#696b79]
                "
              >
                Estimated:{" "}
                {
                  deliveryTime
                }
              </p>
            </div>

            {/* PAYMENT */}

            <div
              className="
                p-5
              "
            >
              <div>
                <PaymentIcon />
              </div>

              <p
                className="
                  mt-4
                  text-sm
                  font-bold
                "
              >
                {
                  getPaymentStatusLabel()
                }
              </p>

              <p
                className="
                  mt-1
                  text-[11px]
                  leading-5
                  text-[#696b79]
                "
              >
                {
                  getPaymentLabel()
                }
              </p>
            </div>
          </div>
        </section>

        {/* =================================================
            MAIN DETAILS
        ================================================= */}

        <div
          className="
            mt-5
            grid
            gap-5
            lg:grid-cols-[minmax(0,1fr)_330px]
          "
        >
          {/* =================================================
              LEFT
          ================================================= */}

          <div
            className="
              space-y-5
            "
          >
            {/* ORDER ITEMS */}

            <section
              className="
                border
                border-[#eaeaec]
                bg-white
                p-5
                sm:p-6
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                  border-b
                  border-[#eaeaec]
                  pb-4
                "
              >
                <h2
                  className="
                    text-sm
                    font-bold
                    uppercase
                    tracking-[0.04em]
                  "
                >
                  Order Items
                </h2>

                <span
                  className="
                    text-[11px]
                    text-[#696b79]
                  "
                >
                  {totalItems}{" "}
                  {totalItems ===
                  1
                    ? "item"
                    : "items"}
                </span>
              </div>

              {items.length ===
              0 ? (
                <p
                  className="
                    py-8
                    text-sm
                    text-[#696b79]
                  "
                >
                  No products
                  found for this
                  order.
                </p>
              ) : (
                <div
                  className="
                    divide-y
                    divide-[#eaeaec]
                  "
                >
                  {items.map(
                    (
                      item,
                      index
                    ) => {
                      const itemPrice =
                        Number(
                          item.price ||
                            0
                        );

                      const quantity =
                        Number(
                          item.quantity ||
                            1
                        );

                      const itemTotal =
                        itemPrice *
                        quantity;

                      return (
                        <article
                          key={
                            item.itemKey ||
                            `${item.id}-${item.selectedSize}-${item.selectedColor}-${index}`
                          }
                          className="
                            flex
                            gap-4
                            py-5
                            first:pt-5
                          "
                        >
                          {/* IMAGE */}

                          <Link
                            to={`/product/${item.id}`}
                            className="
                              h-[120px]
                              w-[90px]
                              shrink-0
                              overflow-hidden
                              bg-[#f5f5f6]
                            "
                          >
                            {item.image ? (
                              <img
                                src={
                                  item.image
                                }
                                alt={
                                  item.name ||
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
                              {item.brand ||
                                "GymDrobe"}
                            </p>

                            <Link
                              to={`/product/${item.id}`}
                              className="
                                mt-1
                                block
                                text-[13px]
                                text-[#696b79]
                                hover:text-orange-600
                              "
                            >
                              {item.name ||
                                "Product"}
                            </Link>

                            <div
                              className="
                                mt-3
                                flex
                                flex-wrap
                                gap-x-4
                                gap-y-1
                                text-[11px]
                                text-[#696b79]
                              "
                            >
                              {item.selectedSize && (
                                <span>
                                  Size:{" "}
                                  {
                                    item.selectedSize
                                  }
                                </span>
                              )}

                              {item.selectedColor && (
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
                                mt-4
                                text-sm
                                font-bold
                              "
                            >
                              ₹
                              {formatCurrency(
                                itemPrice
                              )}
                            </p>
                          </div>

                          {/* TOTAL */}

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
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            {/* DELIVERY ADDRESS */}

            <section
              className="
                border
                border-[#eaeaec]
                bg-white
                p-5
                sm:p-6
              "
            >
              <h2
                className="
                  text-sm
                  font-bold
                  uppercase
                  tracking-[0.04em]
                "
              >
                Delivery Address
              </h2>

              <div
                className="
                  mt-5
                  text-[13px]
                  leading-6
                  text-[#696b79]
                "
              >
                <p
                  className="
                    font-bold
                    text-[#282c3f]
                  "
                >
                  {addressName}
                </p>

                {addressLine && (
                  <p className="mt-2">
                    {addressLine}

                    {addressLandmark
                      ? `, ${addressLandmark}`
                      : ""}
                  </p>
                )}

                {(addressCity ||
                  addressState ||
                  addressPincode) && (
                  <p>
                    {addressCity}

                    {addressCity &&
                    addressState
                      ? ", "
                      : ""}

                    {addressState}

                    {addressPincode
                      ? ` - ${addressPincode}`
                      : ""}
                  </p>
                )}

                {addressPhone && (
                  <p className="mt-2">
                    Mobile:{" "}
                    <span
                      className="
                        font-semibold
                        text-[#282c3f]
                      "
                    >
                      {
                        addressPhone
                      }
                    </span>
                  </p>
                )}

                {customer.email && (
                  <p>
                    Email:{" "}
                    {
                      customer.email
                    }
                  </p>
                )}
              </div>

              {/* DELIVERY TYPE */}

              <div
                className="
                  mt-5
                  flex
                  flex-col
                  justify-between
                  gap-3
                  border-t
                  border-[#eaeaec]
                  pt-5
                  sm:flex-row
                "
              >
                <div>
                  <p
                    className="
                      text-sm
                      font-bold
                    "
                  >
                    {deliveryLabel}
                  </p>

                  <p
                    className="
                      mt-1
                      text-[11px]
                      text-[#696b79]
                    "
                  >
                    Expected in{" "}
                    {
                      deliveryTime
                    }
                  </p>
                </div>

                <span
                  className="
                    text-sm
                    font-bold
                  "
                >
                  {shipping === 0
                    ? "FREE"
                    : `₹${formatCurrency(
                        shipping
                      )}`}
                </span>
              </div>
            </section>
          </div>

          {/* =================================================
              RIGHT
          ================================================= */}

          <aside
            className="
              space-y-5
              lg:sticky
              lg:top-[100px]
              lg:self-start
            "
          >
            {/* PRICE DETAILS */}

            <section
              className="
                border
                border-[#eaeaec]
                bg-white
                p-5
              "
            >
              <h2
                className="
                  text-[12px]
                  font-bold
                  uppercase
                  tracking-[0.04em]
                "
              >
                Price Details
              </h2>

              <div
                className="
                  mt-5
                  space-y-4
                  text-[13px]
                "
              >
                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Total MRP
                  </span>

                  <span>
                    ₹
                    {formatCurrency(
                      totalMrp
                    )}
                  </span>
                </div>

                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Discount on
                    MRP
                  </span>

                  <span
                    className="
                      text-green-600
                    "
                  >
                    {productDiscount >
                    0
                      ? `- ₹${formatCurrency(
                          productDiscount
                        )}`
                      : "₹0"}
                  </span>
                </div>

                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Coupon Discount
                  </span>

                  <span
                    className={
                      couponDiscount >
                      0
                        ? "text-green-600"
                        : ""
                    }
                  >
                    {couponDiscount >
                    0
                      ? `- ₹${formatCurrency(
                          couponDiscount
                        )}`
                      : "₹0"}
                  </span>
                </div>

                <div
                  className="
                    flex
                    justify-between
                    gap-4
                  "
                >
                  <span>
                    Delivery Charges
                  </span>

                  <span
                    className={
                      shipping ===
                      0
                        ? "text-green-600"
                        : ""
                    }
                  >
                    {shipping === 0
                      ? "FREE"
                      : `₹${formatCurrency(
                          shipping
                        )}`}
                  </span>
                </div>
              </div>

              {/* TOTAL */}

              <div
                className="
                  mt-6
                  border-t
                  border-[#eaeaec]
                  pt-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-4
                  "
                >
                  <span
                    className="
                      text-sm
                      font-bold
                    "
                  >
                    Total Amount
                  </span>

                  <span
                    className="
                      text-xl
                      font-bold
                    "
                  >
                    ₹
                    {formatCurrency(
                      total
                    )}
                  </span>
                </div>
              </div>

              {/* COUPON */}

              {order.coupon?.code && (
                <div
                  className="
                    mt-5
                    bg-green-50
                    px-3
                    py-3
                    text-[11px]
                    text-green-700
                  "
                >
                  Coupon{" "}
                  <strong>
                    {
                      order
                        .coupon
                        .code
                    }
                  </strong>{" "}
                  applied successfully.
                </div>
              )}
            </section>

            {/* PAYMENT */}

            <section
              className="
                border
                border-[#eaeaec]
                bg-white
                p-5
              "
            >
              <h2
                className="
                  text-[12px]
                  font-bold
                  uppercase
                  tracking-[0.04em]
                "
              >
                Payment
              </h2>

              <p
                className="
                  mt-4
                  text-sm
                  font-bold
                "
              >
                {
                  getPaymentLabel()
                }
              </p>

              <p
                className="
                  mt-1
                  text-[11px]
                  text-[#696b79]
                "
              >
                Status:{" "}
                {
                  getPaymentStatusLabel()
                }
              </p>
            </section>
          </aside>
        </div>

        {/* =================================================
            ACTIONS
        ================================================= */}

        <section
          className="
            mt-5
            grid
            gap-3
            sm:grid-cols-2
            lg:grid-cols-3
          "
        >
          <Link
            to={`/orders/${encodeURIComponent(
              order.id
            )}`}
            className="
              flex
              min-h-[50px]
              items-center
              justify-center
              bg-orange-600
              px-5
              text-xs
              font-bold
              uppercase
              tracking-[0.04em]
              text-white
              transition
              hover:bg-orange-700
            "
          >
            View Order
          </Link>

          <Link
            to={`/orders/${encodeURIComponent(
              order.id
            )}/track`}
            className="
              flex
              min-h-[50px]
              items-center
              justify-center
              border
              border-[#282c3f]
              bg-white
              px-5
              text-xs
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

          <Link
            to="/shop"
            className="
              flex
              min-h-[50px]
              items-center
              justify-center
              border
              border-[#d4d5d9]
              bg-white
              px-5
              text-xs
              font-bold
              uppercase
              tracking-[0.04em]
              text-[#282c3f]
              transition
              hover:border-[#282c3f]
            "
          >
            Continue Shopping
          </Link>
        </section>

        {/* ALL ORDERS */}

        <div
          className="
            mt-5
            text-center
          "
        >
          <Link
            to="/orders"
            className="
              text-[11px]
              font-bold
              uppercase
              tracking-wide
              text-orange-600
            "
          >
            View All My Orders →
          </Link>
        </div>
      </div>
    </main>
  );
}

export default OrderSuccessPage;