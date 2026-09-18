import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function CheckoutPage({ cart,setCart  }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  const [errors, setErrors] = useState({});

  /*
    -------------------------
    PRICE CALCULATIONS
    -------------------------
  */

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const FREE_SHIPPING_LIMIT = 2000;

  const deliveryCharge =
    subtotal === 0
      ? 0
      : subtotal >= FREE_SHIPPING_LIMIT
      ? 0
      : deliveryMethod === "express"
      ? 199
      : 99;

  const finalTotal = subtotal + deliveryCharge;

  /*
    -------------------------
    FORM HANDLER
    -------------------------
  */

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [name]: "",
    }));
  }

  /*
    -------------------------
    VALIDATION
    -------------------------
  */

  function validateForm() {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your name.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Please enter your email.";
    } else if (!formData.email.includes("@")) {
      newErrors.email = "Please enter a valid email.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Please enter your phone number.";
    } else if (formData.phone.length !== 10) {
      newErrors.phone = "Phone number must contain 10 digits.";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Please enter your delivery address.";
    }

    if (!formData.city.trim()) {
      newErrors.city = "Please enter your city.";
    }

    if (!formData.state.trim()) {
      newErrors.state = "Please enter your state.";
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = "Please enter your PIN code.";
    } else if (formData.pincode.length !== 6) {
      newErrors.pincode = "PIN code must contain 6 digits.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  /*
    -------------------------
    PLACE ORDER
    -------------------------
  */

  function handlePlaceOrder(e) {
    e.preventDefault();

    if (cart.length === 0) {
      alert("Your cart is empty.");
      navigate("/shop");
      return;
    }

    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    const order = {
      id: `GD${Date.now()}`,
      customer: formData,
      items: cart,
      deliveryMethod,
      paymentMethod,
      subtotal,
      deliveryCharge,
      total: finalTotal,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(
  "gymdrobe-last-order",
  JSON.stringify(order)
);

setCart([]);

navigate("/order-success");
  }

  /*
    -------------------------
    EMPTY CART
    -------------------------
  */

  if (cart.length === 0) {
    return (
      <section className="min-h-screen bg-gray-100 px-6 py-20">
        <div className="max-w-xl mx-auto bg-white rounded-xl p-10 text-center shadow-sm">
          <div className="text-6xl mb-5">🛒</div>

          <h1 className="text-3xl font-bold mb-3">
            Your cart is empty
          </h1>

          <p className="text-gray-500 mb-7">
            Add some products before proceeding to checkout.
          </p>

          <Link
            to="/shop"
            className="inline-block bg-orange-600 hover:bg-orange-700 text-white px-7 py-3 rounded-lg font-semibold"
          >
            CONTINUE SHOPPING
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gray-100 py-16 px-6">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold mb-3">
          CHECKOUT
        </h1>

        <p className="text-gray-500 mb-10">
          Complete your details to place your order.
        </p>

        <form onSubmit={handlePlaceOrder}>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* CUSTOMER DETAILS */}

            <div className="lg:col-span-2 space-y-6">

              <div className="bg-white rounded-xl p-6 shadow-sm">

                <h2 className="text-2xl font-bold mb-6">
                  Customer Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div>
                    <label className="block font-semibold mb-2">
                      Full Name
                    </label>

                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                      className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                    />

                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold mb-2">
                      Email
                    </label>

                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="example@email.com"
                      className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                    />

                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold mb-2">
                      Phone Number
                    </label>

                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);

                        setFormData((currentData) => ({
                          ...currentData,
                          phone: value,
                        }));

                        setErrors((currentErrors) => ({
                          ...currentErrors,
                          phone: "",
                        }));
                      }}
                      placeholder="10 digit phone number"
                      className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                    />

                    {errors.phone && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.phone}
                      </p>
                    )}
                  </div>

                </div>

              </div>

              {/* ADDRESS */}

              <div className="bg-white rounded-xl p-6 shadow-sm">

                <h2 className="text-2xl font-bold mb-6">
                  Delivery Address
                </h2>

                <div className="space-y-5">

                  <div>
                    <label className="block font-semibold mb-2">
                      Address
                    </label>

                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="House number, street, area"
                      rows="3"
                      className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                    />

                    {errors.address && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.address}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                    <div>
                      <label className="block font-semibold mb-2">
                        City
                      </label>

                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="City"
                        className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                      />

                      {errors.city && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold mb-2">
                        State
                      </label>

                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="State"
                        className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                      />

                      {errors.state && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.state}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold mb-2">
                        PIN Code
                      </label>

                      <input
                        type="text"
                        name="pincode"
                        value={formData.pincode}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6);

                          setFormData((currentData) => ({
                            ...currentData,
                            pincode: value,
                          }));

                          setErrors((currentErrors) => ({
                            ...currentErrors,
                            pincode: "",
                          }));
                        }}
                        placeholder="6 digit PIN"
                        className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                      />

                      {errors.pincode && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.pincode}
                        </p>
                      )}
                    </div>

                  </div>

                </div>

              </div>

              {/* DELIVERY */}

              <div className="bg-white rounded-xl p-6 shadow-sm">

                <h2 className="text-2xl font-bold mb-6">
                  Delivery Method
                </h2>

                <div className="space-y-4">

                  <label className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:border-orange-500">

                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="delivery"
                        value="standard"
                        checked={deliveryMethod === "standard"}
                        onChange={(e) =>
                          setDeliveryMethod(e.target.value)
                        }
                      />

                      <div>
                        <p className="font-semibold">
                          Standard Delivery
                        </p>
                        <p className="text-sm text-gray-500">
                          Delivery within 3–7 days
                        </p>
                      </div>
                    </div>

                    <span className="font-bold">
                      {subtotal >= FREE_SHIPPING_LIMIT
                        ? "FREE"
                        : "₹99"}
                    </span>

                  </label>

                  <label className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:border-orange-500">

                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="delivery"
                        value="express"
                        checked={deliveryMethod === "express"}
                        onChange={(e) =>
                          setDeliveryMethod(e.target.value)
                        }
                      />

                      <div>
                        <p className="font-semibold">
                          Express Delivery
                        </p>
                        <p className="text-sm text-gray-500">
                          Delivery within 1–2 days
                        </p>
                      </div>
                    </div>

                    <span className="font-bold">
                      ₹199
                    </span>

                  </label>

                </div>

              </div>

              {/* PAYMENT */}

              <div className="bg-white rounded-xl p-6 shadow-sm">

                <h2 className="text-2xl font-bold mb-6">
                  Payment Method
                </h2>

                <div className="space-y-4">

                  <label className="flex items-center gap-3 border rounded-lg p-4 cursor-pointer hover:border-orange-500">
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={(e) =>
                        setPaymentMethod(e.target.value)
                      }
                    />

                    <div>
                      <p className="font-semibold">
                        Cash on Delivery
                      </p>
                      <p className="text-sm text-gray-500">
                        Pay when your order arrives.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 border rounded-lg p-4 cursor-pointer hover:border-orange-500">
                    <input
                      type="radio"
                      name="payment"
                      value="online"
                      checked={paymentMethod === "online"}
                      onChange={(e) =>
                        setPaymentMethod(e.target.value)
                      }
                    />

                    <div>
                      <p className="font-semibold">
                        Online Payment
                      </p>
                      <p className="text-sm text-gray-500">
                        Payment gateway will be connected later.
                      </p>
                    </div>
                  </label>

                </div>

              </div>

            </div>

            {/* ORDER SUMMARY */}

            <div>

              <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">

                <h2 className="text-2xl font-bold mb-6">
                  Order Summary
                </h2>

                <div className="space-y-4 mb-6">

                  {cart.map((item) => (
                    <div
                      key={`${item.id}-${item.selectedSize || "default"}-${item.selectedColor || "default"}`}
                      className="flex gap-3"
                    >

                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />

                      <div className="flex-1">
                        <p className="font-semibold text-sm">
                          {item.name}
                        </p>

                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity}
                        </p>

                        {item.selectedSize && (
                          <p className="text-xs text-gray-500">
                            Size: {item.selectedSize}
                          </p>
                        )}

                        {item.selectedColor && (
                          <p className="text-xs text-gray-500">
                            Color: {item.selectedColor}
                          </p>
                        )}
                      </div>

                      <p className="font-semibold">
                        ₹{(
                          item.price * item.quantity
                        ).toLocaleString("en-IN")}
                      </p>

                    </div>
                  ))}

                </div>

                <hr className="mb-5" />

                <div className="flex justify-between mb-3">
                  <span>Subtotal</span>

                  <span>
                    ₹{subtotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex justify-between mb-3">
                  <span>Delivery</span>

                  <span>
                    {deliveryCharge === 0
                      ? "FREE"
                      : `₹${deliveryCharge}`}
                  </span>
                </div>

                <hr className="my-4" />

                <div className="flex justify-between text-xl font-bold mb-6">
                  <span>Total</span>

                  <span>
                    ₹{finalTotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-lg font-bold transition"
                >
                  PLACE ORDER
                </button>

                <Link
                  to="/cart"
                  className="block text-center text-gray-500 hover:text-black mt-4"
                >
                  ← Back to Cart
                </Link>

              </div>

            </div>

          </div>

        </form>

      </div>
    </section>
  );
}

export default CheckoutPage;