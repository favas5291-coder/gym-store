import { getOrders, getAddresses } from "../utils/customerData.js";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import AccountLayout from "../components/AccountLayout.jsx";
export default function AccountPage() {
  const { user, updateProfile, logout } = useAuth(),
    { notify } = useStore(),
    navigate = useNavigate();
  const [data, setData] = useState({
      name: user.name,
      phone: user.phone || "",
    }),
    [error, setError] = useState("");
  function save(event) {
    event.preventDefault();
    if (data.phone && !/^[6-9]\d{9}$/.test(data.phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (updateProfile(data)) {
      setError("");
      notify("Profile updated.");
    } else
      setError(
        "Unable to save your profile. Check your name and browser storage.",
      );
  }
  return (
    <AccountLayout title="Profile details">
      <div className="account-stats">
        <Link to="/orders">
          <strong>{getOrders(user).length}</strong>
          <span>Orders</span>
        </Link>
        <Link to="/addresses">
          <strong>{getAddresses(user).length}</strong>
          <span>Addresses</span>
        </Link>
        <Link to="/account/security">
          <strong>Account</strong>
          <span>Password & data</span>
        </Link>
      </div>
      <form onSubmit={save} className="profile-form">
        <div className="field">
          <label htmlFor="profile-name">Full name</label>
          <input
            id="profile-name"
            required
            minLength="2"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" value={user.email} readOnly />
        </div>
        <div className="field">
          <label htmlFor="profile-phone">Mobile number (optional)</label>
          <input
            id="profile-phone"
            type="tel"
            maxLength="10"
            value={data.phone}
            onChange={(e) =>
              setData({ ...data, phone: e.target.value.replace(/\D/g, "") })
            }
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button">
          Save changes
        </button>
      </form>
      <button
        className="button secondary signout"
        type="button"
        onClick={() => {
          try {
            logout();
            navigate("/login");
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Sign out
      </button>
      <p className="muted">This preview account is stored on this device.</p>
    </AccountLayout>
  );
}