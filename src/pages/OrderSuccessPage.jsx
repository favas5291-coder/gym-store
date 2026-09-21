import { Link } from "react-router-dom";

function OrderSuccessPage() {
  const savedOrder =
    localStorage.getItem(
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

  const pricing = order?.pricing || order;

  if (!order) {
    return (
      <section className="min-h-screen bg-gray-100 text-black flex items-center justify-center px-6">

        <div className="bg-white rounded-2xl p-10 text-center max-w-lg">

          <h1 className="text-3xl font-black mb-4">
            No Order Found
          </h1>

          <Link
            to="/shop"
            className="text-orange-600 font-bold"
          >
            Continue Shopping
          </Link>

        </div>

      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gray-100 text-black py-16 px-6">

      <div className="max-w-4xl mx-auto">

        {/* SUCCESS */}

        <div className="bg-white rounded-3xl p-10 text-center shadow-sm mb-8">

          <div className="text-6xl mb-5">
            ✅
          </div>

          <h1 className="text-4xl font-black mb-3">
            Order Confirmed!
          </h1>

          <p className="text-gray-500">
            Thank you for shopping with
            GymDrobe.
          </p>

          <div className="mt-6 inline-block bg-gray-100 px-5 py-3 rounded-lg">
            <span className="text-gray-500">
              Order ID:
            </span>{" "}
            <strong>
              {order.id}
            </strong>
          </div>

        </div>

        {/* CUSTOMER */}

        <div className="bg-white rounded-2xl p-6 mb-8">

          <h2 className="text-2xl font-black mb-5">
            Delivery Information
          </h2>

          <div className="space-y-2 text-gray-600">

            <p>
              <strong>Name:</strong>{" "}
              {order.customer.name}
            </p>

            <p>
              <strong>Email:</strong>{" "}
              {order.customer.email}
            </p>

            <p>
              <strong>Phone:</strong>{" "}
              {order.customer.phone}
            </p>

            <p>
              <strong>Address:</strong>{" "}
              {order.customer.address},{" "}
              {order.customer.city},{" "}
              {order.customer.state}{" "}
              -{" "}
              {order.customer.pincode}
            </p>

            <p>
              <strong>Delivery:</strong>{" "}
              {order.deliveryMethod ===
              "express"
                ? "Express Delivery"
                : "Standard Delivery"}
            </p>

            <p>
              <strong>Payment:</strong>{" "}
              {order.paymentMethod ===
              "cod"
                ? "Cash on Delivery"
                : "Online Payment"}
            </p>

          </div>

        </div>

        {/* ITEMS */}

        <div className="bg-white rounded-2xl p-6">

          <h2 className="text-2xl font-black mb-6">
            Order Items
          </h2>

          <div className="space-y-5">

            {order.items.map(
              (item) => (
                <div
                  key={`${item.id}-${item.selectedSize}-${item.selectedColor}`}
                  className="flex gap-4 border-b pb-5"
                >

                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />

                  <div className="flex-1">

                    <h3 className="font-bold">
                      {item.name}
                    </h3>

                    <p className="text-sm text-gray-500">
                      Quantity:{" "}
                      {item.quantity}
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

                  </div>

                  <p className="font-bold">
                    ₹
                    {(
                      item.price *
                      item.quantity
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </p>

                </div>
              )
            )}

          </div>

          {/* TOTAL */}

          <div className="mt-6 space-y-3">

            <div className="flex justify-between">
              <span>Subtotal</span>

              <span>
                ₹
                {pricing.subtotal.toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>

            {pricing.couponDiscount >
              0 && (
              <div className="flex justify-between text-green-600">
                <span>
                  Coupon Discount
                </span>

                <span>
                  −₹
                  {pricing.couponDiscount.toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Shipping</span>

              <span>
                {pricing.shipping ===
                0
                  ? "FREE"
                  : `₹${pricing.shipping}`}
              </span>
            </div>

            <div className="border-t pt-4 flex justify-between text-2xl font-black">

              <span>Total</span>

              <span>
                ₹
                {pricing.finalTotal.toLocaleString(
                  "en-IN"
                )}
              </span>

            </div>

          </div>

        </div>

        {/* BUTTONS */}

        <div className="flex flex-col sm:flex-row gap-4 mt-8">

          <Link
            to="/shop"
            className="flex-1 text-center bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-lg font-bold"
          >
            CONTINUE SHOPPING
          </Link>

          <Link
            to="/"
            className="flex-1 text-center bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-lg font-bold"
          >
            BACK TO HOME
          </Link>

        </div>

      </div>

    </section>
  );
}

export default OrderSuccessPage;