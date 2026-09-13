function Cart({ cart }) {
  const totalPrice = cart.reduce(
    (total, item) => total + item.price,
    0
  );

  return (
    <section className="bg-white py-20 px-6">

      <div className="max-w-4xl mx-auto">

        <h2 className="text-4xl font-bold mb-8">
          MY CART
        </h2>

        <p className="mb-6 text-lg">
          Total Items: {cart.length}
        </p>

        {cart.length === 0 ? (
          <p className="text-gray-500">
            Your cart is empty.
          </p>
        ) : (
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div
                key={index}
                className="
                bg-gray-100
                p-4
                rounded-lg
                flex
                justify-between
              "
              >
                <span>{item.name}</span>

                <span>
                  ₹{item.price.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-2xl font-bold">
          Total: ₹{totalPrice.toLocaleString("en-IN")}
        </div>

      </div>

    </section>
  );
}

export default Cart;