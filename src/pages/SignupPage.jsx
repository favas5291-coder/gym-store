import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function SignupPage() {
  const navigate = useNavigate();

  const { signup } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!form.name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email.");
      return;
    }

    if (
      form.phone &&
      !/^\d{10}$/.test(form.phone)
    ) {
      setError("Phone number must contain 10 digits.");
      return;
    }

    const result = signup(form);

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
            Create Account
          </h1>

          <p className="text-gray-500 mt-2">
            Join GymDrobe today
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
              Full Name
            </label>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your name"
              className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Email
            </label>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Phone
            </label>

            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="10 digit mobile number"
              maxLength={10}
              className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white rounded-lg py-3 font-semibold hover:bg-gray-800 transition"
          >
            CREATE ACCOUNT
          </button>

        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}

          <Link
            to="/login"
            className="font-semibold text-black"
          >
            Login
          </Link>
        </p>

      </div>
    </div>
  );
}

export default SignupPage;