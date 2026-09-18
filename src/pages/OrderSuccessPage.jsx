import { Link } from "react-router-dom";

function OrderSuccessPage() {
  const savedOrder = localStorage.getItem(
    "gymdrobe-last-order"
  );

  const order = savedOrder
    ? JSON.parse(savedOrder)
    : null;

  // =====================================================
  // NO ORDER FOUND
  // =====================================================

  if (!order) {
    return (
      <section className="min-h-screen bg-gray-100 px-6 py-20">
        <div className="max-w-xl mx-auto bg-white rounded-2xl p-10 text-center shadow-sm">

          <div className="text-6xl mb-6">
            📦
          </div>

          <h1 className="text-3xl font-bold mb-3">
            No Order Found
          </h1>

          <p className="text-gray-500 mb-7">
            We couldn't find your recent order.
          </p>

          <Link
            to="/shop"
            className="
              inline-block
              bg-orange-600
              hover:bg-orange-700
              text-white
              px-7
              py-3
              rounded-lg
              font-semibold
              transition
            "
          >
            CONTINUE SHOPPING
          </Link>

        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gray-100 py-16 px-6">

      <div className="max-w-5xl mx-auto">

        {/* =================================================
            SUCCESS MESSAGE
        ================================================= */}

        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12 text-center mb-8">

          <div className="
            w-20
            h-20
            mx-auto
            mb-6
            rounded-full
            bg-green-100
            flex
            items-center
            justify-center
            text-4xl
          ">
            ✓
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            ORDER CONFIRMED!
          </h1>

          <p className="text-gray-500 text-lg mb-6">
            Thank you for shopping with GymDrobe.
          </p>

          <div className="inline-block bg-gray-100 rounded-lg px-6 py-3">

            <p className="text-sm text-gray-500">
              Order ID
            </p>

            <p className="font-bold text-lg">
              {order.id}
            </p>

          </div>

        </div>

        {/* =================================================
            ORDER INFORMATION
        ================================================= */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* CUSTOMER */}

          <div className="bg-white rounded-xl p-6 shadow-sm">

            <h2 className="text-xl font-bold mb-4">
              Customer
            </h2>

            <p className="font-semibold">
              {order.customer.name}
            </p>

            <p className="text-gray-500 mt-1">
              {order.customer.email}
            </p>

            <p className="text-gray-500 mt-1">
              {order.customer.phone}
            </p>

          </div>

          {/* DELIVERY */}

          <div className="bg-white rounded-xl p-6 shadow-sm">

            <h2 className="text-xl font-bold mb-4">
              Delivery Address
            </h2>

            <p className="text-gray-600">
              {order.customer.address}
            </p>

            <p className="text-gray-600 mt-1">
              {order.customer.city},{" "}
              {order.customer.state}
            </p>

            <p className="text-gray-600 mt-1">
              PIN: {order.customer.pincode}
            </p>

          </div>

          {/* PAYMENT */}

          <div className="bg-white rounded-xl p-6 shadow-sm">

            <h2 className="text-xl font-bold mb-4">
              Payment
            </h2>

            <p className="font-semibold">
              {order.paymentMethod === "cod"
                ? "Cash on Delivery"
                : "Online Payment"}
            </p>

            <p className="text-gray-500 mt-2">
              {order.deliveryMethod === "express"
                ? "Express Delivery"
                : "Standard Delivery"}
            </p>

          </div>

        </div>

        {/* =================================================
            ORDER ITEMS
        ================================================= */}

        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 mb-8">

          <h2 className="text-2xl font-bold mb-6">
            Order Items
          </h2>

          <div className="space-y-5">

            {order.items.map((item) => (

              <div
                key={`${item.id}-${item.selectedSize || "default"}-${item.selectedColor || "default"}`}
                className="
                  flex
                  flex-col
                  sm:flex-row
                  sm:items-center
                  justify-between
                  gap-4
                  border-b
                  pb-5
                  last:border-b-0
                  last:pb-0
                "
              >

                <div className="flex items-center gap-4">

                  <img
                    src={item.image}
                    alt={item.name}
                    className="
                      w-20
                      h-20
                      object-cover
                      rounded-lg
                    "
                  />

                  <div>

                    <h3 className="font-bold">
                      {item.name}
                    </h3>

                    <p className="text-sm text-gray-500">
                      Quantity: {item.quantity}
                    </p>

                    {item.selectedSize && (
                      <p className="text-sm text-gray-500">
                        Size: {item.selectedSize}
                      </p>
                    )}

                    {item.selectedColor && (
                      <p className="text-sm text-gray-500">
                        Color: {item.selectedColor}
                      </p>
                    )}

                  </div>

                </div>

                <p className="font-bold">
                  ₹
                  {(
                    item.price * item.quantity
                  ).toLocaleString("en-IN")}
                </p>

              </div>

            ))}

          </div>

        </div>

        {/* =================================================
            PRICE SUMMARY
        ================================================= */}

        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 mb-8">

          <h2 className="text-2xl font-bold mb-6">
            Order Summary
          </h2>

          <div className="max-w-md ml-auto">

            {/* SUBTOTAL */}

            <div className="flex justify-between mb-3">
              <span>
                Subtotal
              </span>

              <span>
                ₹
                {order.subtotal.toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>

            {/* DELIVERY */}

            <div className="flex justify-between mb-3">
              <span>
                Delivery
              </span>

              <span>
                {order.deliveryCharge === 0
                  ? "FREE"
                  : `₹${order.deliveryCharge}`}
              </span>
            </div>

            <hr className="my-4" />

            {/* TOTAL */}

            <div className="flex justify-between text-2xl font-bold">

              <span>
                Total
              </span>

              <span>
                ₹
                {order.total.toLocaleString(
                  "en-IN"
                )}
              </span>

            </div>

          </div>

        </div>

        {/* =================================================
            DELIVERY MESSAGE
        ================================================= */}

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">

          <h2 className="font-bold text-lg mb-2">
            🚚 Your order is being prepared
          </h2>

          <p className="text-gray-600">
            {order.deliveryMethod === "express"
              ? "Your order will be delivered within 1–2 days."
              : "Your order will be delivered within 3–7 days."}
          </p>

        </div>

        {/* =================================================
            ACTION BUTTONS
        ================================================= */}

        <div className="flex flex-col sm:flex-row justify-center gap-4">

          <Link
            to="/shop"
            className="
              bg-orange-600
              hover:bg-orange-700
              text-white
              px-8
              py-4
              rounded-lg
              font-semibold
              text-center
              transition
            "
          >
            CONTINUE SHOPPING
          </Link>

          <Link
            to="/"
            className="
              bg-black
              hover:bg-gray-800
              text-white
              px-8
              py-4
              rounded-lg
              font-semibold
              text-center
              transition
            "
          >
            BACK TO HOME
          </Link>

        </div>

      </div>

    </section>
  );
}

export default OrderSuccessPage;