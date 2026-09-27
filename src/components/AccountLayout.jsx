import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
export default function AccountLayout({ title, children }) {
  const { user } = useAuth();
  return (
    <div className="page account-page">
      <div className="page-heading">
        <div>
          <h1>Account</h1>
          <p className="muted">{user?.name || "Your shopping activity"}</p>
        </div>
      </div>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Account navigation">
          <NavLink to="/account" end>
            Profile
          </NavLink>
          <NavLink to="/orders">Orders & returns</NavLink>
          <NavLink to="/addresses">Saved addresses</NavLink>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/saved">Saved for later</Link>
          <Link to="/notifications">Price & stock watches</Link>
          <Link to="/help">Help & support</Link>
          {user && <NavLink to="/account/security">Password & data</NavLink>}
        </nav>
        <section className="account-content">
          <h2>{title}</h2>
          {children}
        </section>
      </div>
    </div>
  );
}