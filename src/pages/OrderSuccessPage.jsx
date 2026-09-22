import { Link } from "react-router-dom";

function OrderSuccessPage() {
  const savedOrder = localStorage.getItem(
    "gymdrobe-last-order"
  );

  let order = null;

  if (savedOrder) {
    try {
      order = JSON.parse(savedOrder);
    } catch {
      order = null;
    }
  }

  if (!order) {
    return (
      <section className="min-h-screen bg-gray-100 text-black flex items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mb-5 text-6xl">📦</div>

          <h1 className="mb-3 text-3xl font-black">
            No Order Found
          </h1>

          <p className="mb-6 text-gray-500">
            We couldn't find your recent order.
          </p>

          <Link
            to="/shop"
            className="inline-block rounded-lg bg-orange-600 px-6 py-3 font-bold text-white transition hover:bg-orange-700"
          >
            Continue Shopping
          </Link>
        </div>
      </section>
    );
  }

  const pricing = order.pricing || {};

  const customer = order.customer || {};

  const shippingAddress =
    order.shippingAddress || {};

  const delivery = order.delivery || {};

  const payment = order.payment || {};

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const orderDate = order.createdAt
    ? new Date(order.createdAt)
    : null;

  const formattedDate =
    orderDate && !Number.isNaN(orderDate.getTime())
      ? orderDate.toLocaleDateString(
          "en-IN",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        )
      : "—";

  const formattedTime =
    orderDate && !Number.isNaN(orderDate.getTime())
      ? orderDate.toLocaleTimeString(
          "en-IN",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      : "—";

  const paymentMethod =
    payment.method ||
    order.paymentMethod ||
    "cod";

  const paymentStatus =
    payment.status ||
    (paymentMethod === "cod"
      ? "pending"
      : "paid");

  const deliveryMethod =
    delivery.method ||
    order.deliveryMethod ||
    "standard";

  const deliveryLabel =
    delivery.label ||
    (deliveryMethod === "express"
      ? "Express Delivery"
      : "Standard Delivery");

  const deliveryTime =
    delivery.estimatedTime ||
    (deliveryMethod === "express"
      ? "1–2 business days"
      : "3–5 business days");

  const total =
    Number(
      pricing.finalTotal ??
        pricing.total ??
        0
    );

  const subtotal =
    Number(pricing.subtotal ?? 0);

  const couponDiscount =
    Number(
      pricing.couponDiscount ?? 0
    );

  const shipping =
    Number(pricing.shipping ?? 0);

  const getPaymentLabel = () => {
    if (paymentMethod === "cod") {
      return "Cash on Delivery";
    }

    if (paymentMethod === "card") {
      return "Card Payment";
    }

    if (paymentMethod === "upi") {
      return "UPI Payment";
    }

    return "Online Payment";
  };

  const getPaymentStatusLabel = () => {
    if (paymentStatus === "paid") {
      return "Paid";
    }

    if (paymentStatus === "payment-pending") {
      return "Payment Pending";
    }

    return "Pay on Delivery";
  };

  return (
    <section className="min-h-screen bg-gray-100 px-4 py-10 text-black sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">

        {/* SUCCESS HEADER */}

        <div className="mb-8 rounded-3xl bg-white p-6 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
            ✓
          </div>

          <h1 className="mb-3 text-3xl font-black sm:text-4xl">
            Order Confirmed!
          </h1>

          <p className="mx-auto max-w-xl text-gray-500">
            Thank you for shopping with GymDrobe.
            Your order has been successfully placed.
          </p>

          {/* ORDER ID */}

          <div className="mt-6 inline-flex max-w-full flex-col items-center rounded-xl bg-gray-100 px-5 py-3 sm:flex-row sm:gap-2">
            <span className="text-sm text-gray-500">
              Order ID
            </span>

            <strong className="break-all text-sm sm:text-base">
              {order.id || "—"}
            </strong>
          </div>

          {/* DATE */}

          <div className="mt-4 flex flex-col justify-center gap-1 text-sm text-gray-500 sm:flex-row sm:gap-4">
            <span>
              Date: {formattedDate}
            </span>

            <span className="hidden sm:block">
              •
            </span>

            <span>
              Time: {formattedTime}
            </span>
          </div>
        </div>

        {/* ORDER STATUS */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-6 text-xl font-black">
            Order Status
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">

            {/* CONFIRMED */}

            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="mb-2 text-2xl">
                ✓
              </div>

              <p className="font-bold text-green-700">
                Order Confirmed
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Your order has been received.
              </p>
            </div>

            {/* DELIVERY */}

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="mb-2 text-2xl">
                🚚
              </div>

              <p className="font-bold text-blue-700">
                {deliveryLabel}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Estimated: {deliveryTime}
              </p>
            </div>

            {/* PAYMENT */}

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 text-2xl">
                💳
              </div>

              <p className="font-bold">
                {getPaymentStatusLabel()}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {getPaymentLabel()}
              </p>
            </div>

          </div>
        </div>

        {/* DELIVERY INFORMATION */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-6 text-2xl font-black">
            Delivery Information
          </h2>

          <div className="grid gap-6 md:grid-cols-2">

            {/* CUSTOMER */}

            <div>
              <h3 className="mb-3 font-bold">
                Customer
              </h3>

              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong className="text-black">
                    Name:
                  </strong>{" "}
                  {customer.name || "—"}
                </p>

                <p className="break-words">
                  <strong className="text-black">
                    Email:
                  </strong>{" "}
                  {customer.email || "—"}
                </p>

                <p>
                  <strong className="text-black">
                    Phone:
                  </strong>{" "}
                  {customer.phone || "—"}
                </p>
              </div>
            </div>

            {/* ADDRESS */}

            <div>
              <h3 className="mb-3 font-bold">
                Shipping Address
              </h3>

              <div className="text-sm leading-6 text-gray-600">
                {shippingAddress.name ||
                shippingAddress.address ||
                customer.address ? (
                  <>
                    <p>
                      {shippingAddress.name ||
                        customer.name}
                    </p>

                    <p>
                      {shippingAddress.address ||
                        customer.address}
                    </p>

                    <p>
                      {shippingAddress.city ||
                        customer.city}
                      ,{" "}
                      {shippingAddress.state ||
                        customer.state}
                    </p>

                    <p>
                      {shippingAddress.pincode ||
                        customer.pincode}
                    </p>

                    {(shippingAddress.phone ||
                      customer.phone) && (
                      <p className="mt-2">
                        Phone:{" "}
                        {shippingAddress.phone ||
                          customer.phone}
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    Shipping address unavailable.
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* DELIVERY METHOD */}

          <div className="mt-6 border-t pt-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row">
              <div>
                <p className="font-bold">
                  {deliveryLabel}
                </p>

                <p className="text-sm text-gray-500">
                  Estimated delivery:{" "}
                  {deliveryTime}
                </p>
              </div>

              <div className="font-bold">
                {shipping === 0
                  ? "FREE"
                  : `₹${shipping.toLocaleString(
                      "en-IN"
                    )}`}
              </div>
            </div>
          </div>
        </div>

        {/* ORDER ITEMS */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-6 text-2xl font-black">
            Order Items
          </h2>

          {items.length === 0 ? (
            <p className="text-gray-500">
              No items found for this order.
            </p>
          ) : (
            <div className="space-y-5">

              {items.map((item, index) => {
                const itemPrice =
                  Number(item.price || 0);

                const quantity =
                  Number(item.quantity || 0);

                const itemTotal =
                  itemPrice * quantity;

                return (
                  <div
                    key={
                      item.itemKey ||
                      `${item.id}-${item.selectedSize}-${item.selectedColor}-${index}`
                    }
                    className="flex min-w-0 gap-3 border-b pb-5 last:border-b-0 last:pb-0 sm:gap-4"
                  >

                    {/* IMAGE */}

                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name || "Product"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl">
                          📦
                        </div>
                      )}
                    </div>

                    {/* DETAILS */}

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-bold">
                        {item.name ||
                          "Product"}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Quantity: {quantity}
                      </p>

                      {item.selectedSize && (
                        <p className="text-sm text-gray-500">
                          Size:{" "}
                          {item.selectedSize}
                        </p>
                      )}

                      {item.selectedColor && (
                        <p className="text-sm text-gray-500">
                          Color:{" "}
                          {item.selectedColor}
                        </p>
                      )}

                      <p className="mt-2 text-sm text-gray-500">
                        ₹
                        {itemPrice.toLocaleString(
                          "en-IN"
                        )}{" "}
                        × {quantity}
                      </p>
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
              })}

            </div>
          )}
        </div>

        {/* PRICE SUMMARY */}

        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-2xl font-black">
            Payment Summary
          </h2>

          <div className="space-y-3">

            <div className="flex justify-between gap-4">
              <span className="text-gray-600">
                Subtotal
              </span>

              <span className="font-medium">
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

          {/* COUPON */}

          {order.coupon?.code && (
            <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              Coupon applied:{" "}
              <strong>
                {order.coupon.code}
              </strong>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS */}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row">

          <Link
            to="/orders"
            className="flex-1 rounded-xl bg-orange-600 px-6 py-4 text-center font-bold text-white transition hover:bg-orange-700"
          >
            VIEW MY ORDERS
          </Link>

          <Link
            to="/shop"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-4 text-center font-bold transition hover:bg-gray-50"
          >
            CONTINUE SHOPPING
          </Link>

          <Link
            to="/"
            className="flex-1 rounded-xl bg-gray-900 px-6 py-4 text-center font-bold text-white transition hover:bg-gray-800"
          >
            BACK TO HOME
          </Link>

        </div>

      </div>
    </section>
  );
}

export default OrderSuccessPage;