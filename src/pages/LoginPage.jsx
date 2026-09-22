import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const navigate = useNavigate();

  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }

    const result = login(email);

    if (!result.success) {
      setError(result.message);
      return;
    }

    navigate("/account");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-black">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            Welcome Back
          </h1>

          <p className="text-gray-500 mt-2">
            Login to your GymDrobe account
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 text-red-600 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-medium mb-2">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white rounded-lg py-3 font-semibold hover:bg-gray-800 transition"
          >
            LOGIN
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{" "}

          <Link
            to="/signup"
            className="font-semibold text-black"
          >
            Create Account
          </Link>
        </p>

      </div>
    </div>
  );
}

export default LoginPage;