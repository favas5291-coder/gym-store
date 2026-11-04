import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, MapPin, Heart, Bookmark, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { getOrders } from "../services/orderApi.js";
import { getAddresses } from "../services/addressApi.js";
import AccountLayout, { AccountMenu, openProfile } from "../components/AccountLayout.jsx";

function orderId(order) { return order?.orderNumber || order?.id || order?._id || ""; }
function statusLabel(value) { return String(value || "confirmed").replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function formatDate(value) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""; }

const quickActions = [["/orders", "My orders", Package], ["/addresses", "Saved addresses", MapPin], ["/wishlist", "Wishlist", Heart], ["/saved", "Saved for later", Bookmark]];

export default function AccountPage() {
  const { user, token, updateProfile, logout } = useAuth();
  const { notify } = useStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState({});
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  useEffect(() => { setProfile({ name: user?.name || "", phone: user?.phone || "" }); }, [user?.id, user?.name, user?.phone]);
  useEffect(() => { if (window.location.hash === "#profile-details") openProfile(); }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAccount() {
      if (!user || !token) { setOrders([]); setAddresses([]); setLoading(false); return; }
      setLoading(true); setDataErrors({});
      const [orderResult, addressResult] = await Promise.allSettled([getOrders(token), getAddresses(token)]);
      if (cancelled) return;
      const errors = {};
      if (orderResult.status === "fulfilled" && Array.isArray(orderResult.value)) setOrders(orderResult.value);
      else { setOrders([]); errors.orders = orderResult.reason?.message || "Orders could not be loaded."; }
      if (addressResult.status === "fulfilled" && Array.isArray(addressResult.value)) setAddresses(addressResult.value);
      else { setAddresses([]); errors.addresses = addressResult.reason?.message || "Saved addresses could not be loaded."; }
      setDataErrors(errors); setLoading(false);
    }
    loadAccount();
    return () => { cancelled = true; };
  }, [user?.id, token, reloadAttempt]);

  const activeOrders = useMemo(() => orders.filter(order => !["delivered", "cancelled", "returned", "refunded"].includes(String(order?.status || "").toLowerCase())).length, [orders]);
  const defaultAddress = addresses.find(address => address.isDefault);
  const recentOrders = useMemo(() => [...orders].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 3), [orders]);

  async function handleProfileSave(event) {
    event.preventDefault();
    if (savingProfile) return;
    setProfileError("");
    const name = String(profile.name || "").trim();
    const phone = String(profile.phone || "").replace(/\D/g, "");
    if (name.length < 2) { setProfileError("Enter a valid full name."); return; }
    if (name.length > 60) { setProfileError("Name cannot exceed 60 characters."); return; }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) { setProfileError("Enter a valid 10-digit mobile number."); return; }
    setSavingProfile(true);
    try {
      const result = await updateProfile({ name, phone });
      if (result?.user) setProfile({ name: result.user.name || "", phone: result.user.phone || "" });
      notify(result?.message || "Profile updated successfully.");
    } catch (error) { setProfileError(error.message || "Unable to update your profile."); }
    finally { setSavingProfile(false); }
  }
  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true); setSignOutError("");
    try { await logout(); notify("Signed out successfully."); navigate("/login", { replace: true }); }
    catch (error) { setSignOutError(error.message || "Unable to sign out. Please try again."); }
    finally { setSigningOut(false); }
  }

  return <AccountLayout title="Account overview">
    <nav className="gd-account-quick" aria-label="Quick account actions">
      {quickActions.map(([to, label, Icon]) => <Link to={to} key={to}><Icon size={22} aria-hidden="true"/><span>{label}</span><ChevronRight size={16} aria-hidden="true"/></Link>)}
    </nav>
    <section className="gd-account-summary" aria-labelledby="account-overview-title">
      <h2 id="account-overview-title">Account overview</h2>
      <div className="gd-account-stats" aria-busy={loading}>
        <Link to="/orders"><span>Total orders</span><strong>{loading || dataErrors.orders ? "—" : orders.length}</strong><small>{loading ? "Loading…" : dataErrors.orders ? "Currently unavailable" : `${activeOrders} active`}</small></Link>
        <Link to="/addresses"><span>Saved addresses</span><strong>{loading || dataErrors.addresses ? "—" : addresses.length}</strong><small>{loading ? "Loading…" : dataErrors.addresses ? "Currently unavailable" : defaultAddress ? "Default address ready" : addresses.length ? "Choose a default address" : "Add a delivery address"}</small></Link>
      </div>
    </section>
    {Object.keys(dataErrors).length > 0 && <div className="gd-account-notice" role="alert"><strong>Some account details are unavailable.</strong><p>{Object.values(dataErrors).join(" ")}</p><button type="button" onClick={() => setReloadAttempt(attempt => attempt + 1)}>Retry account details</button></div>}
    <section className="gd-account-recent" aria-labelledby="account-recent-title">
      <div className="gd-account-section-heading"><h2 id="account-recent-title">Recent orders</h2><Link to="/orders">View all<ChevronRight size={16} aria-hidden="true"/></Link></div>
      {loading ? <div className="gd-account-skeleton" role="status">Loading your recent orders…</div> : dataErrors.orders ? <p className="gd-account-muted">Your recent orders could not load. Use Retry account details to try again.</p> : recentOrders.length === 0 ? <div className="gd-account-empty"><Package size={26} aria-hidden="true"/><h3>Your next workout starts here</h3><p>You haven't placed an order yet.</p><Link to="/shop">Explore the collection<ChevronRight size={16} aria-hidden="true"/></Link></div> : <div className="gd-account-order-list">{recentOrders.map(order => <Link className="gd-account-order" key={order.id || order._id || orderId(order)} to={`/orders/${encodeURIComponent(order.id || order._id || orderId(order))}`}><Package size={20} aria-hidden="true"/><span><strong>{orderId(order)}</strong><small>{formatDate(order.createdAt)}</small></span><em>{statusLabel(order.status)}</em><ChevronRight size={16} aria-hidden="true"/></Link>)}</div>}
    </section>
    <AccountMenu/>
    <details className="gd-account-profile" id="profile-details">
      <summary>Personal information<span>Edit your name and mobile number</span></summary>
        <form
          className="profile-form"
          onSubmit={
            handleProfileSave
          }
          style={{
            marginTop:
              "20px",
          }}
        >
          <div
            className="field"
          >
            <label
              htmlFor="profile-name"
            >
              Full name
            </label>

            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength="2"
              maxLength="60"
              value={
                profile.name
              }
              onChange={
                (
                  event
                ) =>
                  setProfile(
                    (
                      current
                    ) => ({
                      ...current,

                      name:
                        event.target
                          .value,
                    })
                  )
              }
            />
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="profile-email"
            >
              Email
            </label>

            <input
              id="profile-email"
              type="email"
              value={
                user?.email ||
                ""
              }
              readOnly
            />

            <small
              className="muted"
            >
              Email changes are not available from this page.
            </small>
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="profile-phone"
            >
              Mobile number
            </label>

            <input
              id="profile-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              maxLength="10"
              value={
                profile.phone
              }
              onChange={
                (
                  event
                ) =>
                  setProfile(
                    (
                      current
                    ) => ({
                      ...current,

                      phone:
                        event.target
                          .value
                          .replace(
                            /\D/g,
                            ""
                          )
                          .slice(
                            0,
                            10
                          ),
                    })
                  )
              }
            />

            <small
              className="muted"
            >
              Optional. Used for delivery and account contact.
            </small>
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="profile-role"
            >
              Account type
            </label>

            <input
              id="profile-role"
              value={
                user?.role ===
                "admin"
                  ? "Administrator"
                  : "Customer"
              }
              readOnly
            />
          </div>


          {profileError && (
            <p
              className="field-error"
              role="alert"
            >
              {
                profileError
              }
            </p>
          )}


          <button
            type="submit"
            className="button"
            disabled={
              savingProfile
            }
          >
            {savingProfile
              ? "Saving changes…"
              : "Save changes"}
          </button>
        </form>
    </details>
    <div className="gd-account-signout">{signOutError && <p role="alert">{signOutError}</p>}<button type="button" onClick={handleLogout} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button><p>You’re in control of your account.</p></div>
  </AccountLayout>;
}
