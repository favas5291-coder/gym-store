
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ADDRESS_STORAGE_KEY = "gymdrobe-addresses";

const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  landmark: "",
};

/*
 * ======================================================
 * USER STORAGE KEY
 * ======================================================
 *
 * Every user gets their own address storage.
 *
 * Example:
 * gymdrobe-addresses:123
 * gymdrobe-addresses:456
 */

function getUserStorageKey(user) {
  const userId = String(
    user?.id || user?.email || ""
  )
    .trim()
    .toLowerCase();

  if (!userId) {
    return `${ADDRESS_STORAGE_KEY}:guest`;
  }

  return `${ADDRESS_STORAGE_KEY}:${userId}`;
}

/*
 * ======================================================
 * GET SAVED ADDRESSES
 * ======================================================
 */

function getSavedAddresses(user) {
  if (!user) {
    return [];
  }

  try {
    const storageKey =
      getUserStorageKey(user);

    const saved =
      localStorage.getItem(storageKey);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

/*
 * ======================================================
 * COMPONENT
 * ======================================================
 */

function AddressesPage() {
  const {
    user,
    isAuthenticated,
  } = useAuth();

  const [addresses, setAddresses] =
    useState(() =>
      getSavedAddresses(user)
    );

  const [form, setForm] =
    useState(EMPTY_ADDRESS);

  const [editingId, setEditingId] =
    useState(null);

  const [showForm, setShowForm] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * ======================================================
   * LOAD USER'S ADDRESSES
   * ======================================================
   *
   * Runs whenever the logged-in user changes.
   */

  useEffect(() => {
    if (!user) {
      setAddresses([]);
      return;
    }

    setAddresses(
      getSavedAddresses(user)
    );

    setForm({
      ...EMPTY_ADDRESS,
      fullName: user?.name || "",
    });

    setEditingId(null);
    setShowForm(false);
    setError("");
  }, [user]);

  /*
   * ======================================================
   * SAVE USER'S ADDRESSES
   * ======================================================
   */

  useEffect(() => {
    if (!user) {
      return;
    }

    const storageKey =
      getUserStorageKey(user);

    localStorage.setItem(
      storageKey,
      JSON.stringify(addresses)
    );
  }, [addresses, user]);

  /*
   * ======================================================
   * FORM CHANGE
   * ======================================================
   */

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    let nextValue = value;

    /*
     * Phone should contain numbers only.
     */

    if (name === "phone") {
      nextValue = value
        .replace(/\D/g, "")
        .slice(0, 10);
    }

    /*
     * Pincode should contain numbers only.
     */

    if (name === "pincode") {
      nextValue = value
        .replace(/\D/g, "")
        .slice(0, 6);
    }

    setForm((previous) => ({
      ...previous,
      [name]: nextValue,
    }));
  }

  /*
   * ======================================================
   * OPEN ADD FORM
   * ======================================================
   */

  function openAddForm() {
    setEditingId(null);

    setForm({
      ...EMPTY_ADDRESS,
      fullName: user?.name || "",
    });

    setError("");
    setShowForm(true);
  }

  /*
   * ======================================================
   * EDIT ADDRESS
   * ======================================================
   */

  function editAddress(address) {
    setEditingId(address.id);

    setForm({
      fullName:
        address.fullName || "",

      phone:
        address.phone || "",

      addressLine:
        address.addressLine || "",

      city:
        address.city || "",

      state:
        address.state || "",

      pincode:
        address.pincode || "",

      landmark:
        address.landmark || "",
    });

    setError("");
    setShowForm(true);
  }

  /*
   * ======================================================
   * VALIDATE FORM
   * ======================================================
   */

  function validateForm() {
    if (!form.fullName.trim()) {
      return "Please enter your full name.";
    }

    if (!/^\d{10}$/.test(form.phone)) {
      return "Please enter a valid 10-digit phone number.";
    }

    if (!form.addressLine.trim()) {
      return "Please enter your address.";
    }

    if (!form.city.trim()) {
      return "Please enter your city.";
    }

    if (!form.state.trim()) {
      return "Please enter your state.";
    }

    if (!/^\d{6}$/.test(form.pincode)) {
      return "Please enter a valid 6-digit pincode.";
    }

    return "";
  }

  /*
   * ======================================================
   * SAVE ADDRESS
   * ======================================================
   */

  function handleSubmit(event) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");

    /*
     * EDIT EXISTING ADDRESS
     */

    if (editingId !== null) {
      setAddresses((previous) =>
        previous.map((address) =>
          address.id === editingId
            ? {
                ...address,
                ...form,
              }
            : address
        )
      );
    }

    /*
     * ADD NEW ADDRESS
     */

    else {
      const newAddress = {
        id: Date.now(),

        ...form,

        userId: user?.id || null,

        userEmail:
          user?.email || "",

        isDefault:
          addresses.length === 0,
      };

      setAddresses((previous) => [
        ...previous,
        newAddress,
      ]);
    }

    setForm({
      ...EMPTY_ADDRESS,
      fullName: user?.name || "",
    });

    setEditingId(null);
    setShowForm(false);
  }

  /*
   * ======================================================
   * DELETE ADDRESS
   * ======================================================
   */

  function deleteAddress(id) {
    const addressToDelete =
      addresses.find(
        (address) => address.id === id
      );

    if (!addressToDelete) {
      return;
    }

    const remaining =
      addresses.filter(
        (address) => address.id !== id
      );

    /*
     * If the deleted address was default,
     * automatically make the first remaining
     * address default.
     */

    if (
      addressToDelete.isDefault &&
      remaining.length > 0
    ) {
      remaining[0] = {
        ...remaining[0],
        isDefault: true,
      };
    }

    setAddresses(remaining);
  }

  /*
   * ======================================================
   * SET DEFAULT ADDRESS
   * ======================================================
   */

  function setDefaultAddress(id) {
    setAddresses((previous) =>
      previous.map((address) => ({
        ...address,

        isDefault:
          address.id === id,
      }))
    );
  }

  /*
   * ======================================================
   * CANCEL FORM
   * ======================================================
   */

  function cancelForm() {
    setForm({
      ...EMPTY_ADDRESS,
      fullName: user?.name || "",
    });

    setEditingId(null);
    setError("");
    setShowForm(false);
  }

  /*
   * ======================================================
   * AUTH CHECK
   * ======================================================
   */

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] bg-gray-50 px-4 py-16 text-black">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-3xl">
            📍
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Login Required
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Please login to manage your saved
            addresses.
          </p>

          <Link
            to="/login"
            className="
              mt-6
              inline-flex
              rounded-xl
              bg-slate-900
              px-6
              py-3
              text-sm
              font-bold
              text-white
              transition
              hover:bg-orange-600
            "
          >
            LOGIN
          </Link>
        </div>
      </div>
    );
  }

  /*
   * ======================================================
   * RENDER
   * ======================================================
   */

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 text-black md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
              Account
            </p>

            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              My Addresses
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage your saved delivery addresses.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="
              rounded-xl
              bg-slate-900
              px-5
              py-3
              text-sm
              font-bold
              uppercase
              tracking-wider
              text-white
              transition
              hover:bg-orange-600
            "
          >
            + Add New Address
          </button>
        </div>

        {/* ADD / EDIT FORM */}

        {showForm && (
          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-7">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId !== null
                    ? "Edit Address"
                    : "Add New Address"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter your delivery details.
                </p>
              </div>

              <button
                type="button"
                onClick={cancelForm}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-full
                  bg-gray-100
                  text-gray-500
                  hover:bg-gray-200
                "
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="grid gap-5 md:grid-cols-2"
            >

              {/* FULL NAME */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Full Name *
                </label>

                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    px-4
                    py-3
                    text-sm
                    outline-none
                    transition
                    focus:border-orange-400
                    focus:ring-2
                    focus:ring-orange-100
                  "
                />
              </div>

              {/* PHONE */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Phone Number *
                </label>

                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="10 digit mobile number"
                  maxLength={10}
                  inputMode="numeric"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    px-4
                    py-3
                    text-sm
                    outline-none
                    transition
                    focus:border-orange-400
                    focus:ring-2
                    focus:ring-orange-100
                  "
                />
              </div>

              {/* ADDRESS */}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Address *
                </label>

                <textarea
                  name="addressLine"
                  value={form.addressLine}
                  onChange={handleChange}
                  placeholder="House / Flat / Building / Street"
                  rows={3}
                  className="
                    w-full
                    resize-none
                    rounded-xl
                    border
                    border-gray-200
                    px-4
                    py-3
                    text-sm
                    outline-none
                    transition
                    focus:border-orange-400
                    focus:ring-2
                    focus:ring-orange-100
                  "
                />
              </div>

              {/* CITY */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  City *
                </label>

                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-orange-400
                    focus:ring-2
                    focus:ring-orange-100
                  "
                />
              </div>

              {/* STATE */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  State *
                </label>

                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="Enter state"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-orange-400
                    focus:ring-2
                    focus:ring-orange-100
                  "
                />
              </div>

              {/* PINCODE */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Pincode *
                </label>

                <input
                  type="text"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  placeholder="6 digit pincode"
                  maxLength={6}
                  inputMode="numeric"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-orange-400
                    focus:ring-2
                    focus:ring-orange-100
                  "
                />
              </div>

              {/* LANDMARK */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Landmark
                  <span className="ml-1 font-normal text-gray-400">
                    (Optional)
                  </span>
                </label>

                <input
                  type="text"
                  name="landmark"
                  value={form.landmark}
                  onChange={handleChange}
                  placeholder="Nearby landmark"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-orange-400
                    focus:ring-2
                    focus:ring-orange-100
                  "
                />
              </div>

              {/* BUTTONS */}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row md:col-span-2">

                <button
                  type="submit"
                  className="
                    rounded-xl
                    bg-slate-900
                    px-6
                    py-3
                    text-sm
                    font-bold
                    text-white
                    transition
                    hover:bg-orange-600
                  "
                >
                  {editingId !== null
                    ? "SAVE CHANGES"
                    : "SAVE ADDRESS"}
                </button>

                <button
                  type="button"
                  onClick={cancelForm}
                  className="
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    px-6
                    py-3
                    text-sm
                    font-semibold
                    text-gray-700
                    transition
                    hover:bg-gray-50
                  "
                >
                  CANCEL
                </button>

              </div>
            </form>
          </div>
        )}

        {/* ADDRESS LIST */}

        {addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-3xl">
              📍
            </div>

            <h2 className="text-xl font-bold text-gray-900">
              No saved addresses
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              Add your first delivery address so
              checkout becomes faster and easier.
            </p>

            <button
              type="button"
              onClick={openAddForm}
              className="
                mt-6
                rounded-xl
                bg-slate-900
                px-6
                py-3
                text-sm
                font-bold
                text-white
                hover:bg-orange-600
              "
            >
              ADD ADDRESS
            </button>

          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">

            {addresses.map((address) => (
              <div
                key={address.id}
                className="
                  rounded-2xl
                  border
                  border-gray-100
                  bg-white
                  p-5
                  shadow-sm
                  transition
                  hover:shadow-md
                "
              >

                {/* ADDRESS HEADER */}

                <div className="flex items-start justify-between gap-3">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50">
                      📍
                    </div>

                    <div>

                      <h2 className="font-bold text-gray-900">
                        {address.fullName}
                      </h2>

                      {address.isDefault && (
                        <span className="mt-1 inline-flex rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600">
                          Default Address
                        </span>
                      )}

                    </div>
                  </div>

                  <div className="flex gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        editAddress(address)
                      }
                      className="
                        rounded-lg
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        text-gray-600
                        hover:bg-gray-100
                      "
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteAddress(address.id)
                      }
                      className="
                        rounded-lg
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        text-red-600
                        hover:bg-red-50
                      "
                    >
                      Delete
                    </button>

                  </div>
                </div>

                {/* ADDRESS DETAILS */}

                <div className="mt-5 space-y-1 text-sm text-gray-600">

                  <p>
                    {address.addressLine}
                  </p>

                  <p>
                    {address.city},{" "}
                    {address.state} -{" "}
                    {address.pincode}
                  </p>

                  {address.landmark && (
                    <p>
                      Landmark:{" "}
                      {address.landmark}
                    </p>
                  )}

                  <p className="pt-2 font-medium text-gray-800">
                    Phone: {address.phone}
                  </p>

                </div>

                {/* DEFAULT BUTTON */}

                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() =>
                      setDefaultAddress(
                        address.id
                      )
                    }
                    className="
                      mt-5
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      px-4
                      py-3
                      text-xs
                      font-bold
                      uppercase
                      tracking-wider
                      text-gray-700
                      transition
                      hover:border-orange-300
                      hover:bg-orange-50
                      hover:text-orange-600
                    "
                  >
                    Set as Default
                  </button>
                )}

              </div>
            ))}

          </div>
        )}

        {/* BACK TO ACCOUNT */}

        <div className="mt-8">

          <Link
            to="/account"
            className="
              inline-flex
              items-center
              gap-2
              text-sm
              font-semibold
              text-gray-600
              hover:text-orange-600
            "
          >
            ← Back to My Account
          </Link>

        </div>

      </div>
    </div>
  );
}

export default AddressesPage;

