import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AccountPage() {
  const navigate = useNavigate();

  const {
    user,
    logout,
    isAuthenticated,
  } = useAuth();

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 text-black">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            My Account
          </h1>

          <p className="text-gray-500 mt-2">
            Welcome back, {user?.name}
          </p>
        </div>

        {/* Account Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* Orders */}
          <Link
            to="/orders"
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="text-2xl mb-3">
              📦
            </div>

            <h2 className="text-xl font-semibold">
              My Orders
            </h2>

            <p className="text-gray-500 mt-2">
              View your orders and track deliveries.
            </p>
          </Link>

          {/* Wishlist */}
          <Link
            to="/wishlist"
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="text-2xl mb-3">
              ❤️
            </div>

            <h2 className="text-xl font-semibold">
              Wishlist
            </h2>

            <p className="text-gray-500 mt-2">
              View your saved products.
            </p>
          </Link>

          {/* Addresses */}
          <Link
            to="/addresses"
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="text-2xl mb-3">
              📍
            </div>

            <h2 className="text-xl font-semibold">
              Addresses
            </h2>

            <p className="text-gray-500 mt-2">
              Manage your delivery addresses.
            </p>
          </Link>

        </div>

        {/* Profile */}
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm">

          <h2 className="text-xl font-semibold mb-5">
            Profile
          </h2>

          <div className="space-y-4 text-gray-700">

            <div>
              <p className="text-sm text-gray-500">
                Full Name
              </p>

              <p className="font-medium">
                {user?.name}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Email
              </p>

              <p className="font-medium">
                {user?.email}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Phone
              </p>

              <p className="font-medium">
                {user?.phone || "Not added"}
              </p>
            </div>

          </div>

        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-6 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
        >
          LOGOUT
        </button>

      </div>
    </div>
  );
}

export default AccountPage;