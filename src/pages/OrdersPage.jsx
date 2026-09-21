import { Link } from "react-router-dom";

function OrdersPage() {
  const orders =
    JSON.parse(
      localStorage.getItem(
        "gymdrobe-orders"
      )
    ) || [];

  return (
    <section className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold mb-8">
          My Orders
        </h1>

        {orders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl">
            <p>No orders found.</p>

            <Link
              to="/shop"
              className="text-orange-600 mt-4 inline-block"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">

            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white p-6 rounded-2xl shadow-sm"
              >
                <div className="flex justify-between mb-4">
                  <div>
                    <h2 className="font-bold">
                      Order #{order.id}
                    </h2>

                    <p className="text-sm text-gray-500">
                      {new Date(
                        order.createdAt
                      ).toLocaleString()}
                    </p>
                  </div>

                  <div className="font-bold">
                    ₹
                    {order.pricing.total.toLocaleString(
                      "en-IN"
                    )}
                  </div>
                </div>

                <div className="space-y-3">

                  {order.items.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="flex justify-between"
                      >
                        <span>
                          {item.name} ×{" "}
                          {item.quantity}
                        </span>

                        <span>
                          ₹
                          {(
                            item.price *
                            item.quantity
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </span>
                      </div>
                    )
                  )}

                </div>
              </div>
            ))}

          </div>
        )}
      </div>
    </section>
  );
}

export default OrdersPage;