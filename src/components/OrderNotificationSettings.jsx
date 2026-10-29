import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { orderPushEnabled, orderPushStatus, enableOrderPush, disableOrderPush } from "../native/orderPush.js";
export default function OrderNotificationSettings() {
  const { user } = useAuth(), [state, setState] = useState(orderPushStatus), [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setState(orderPushStatus());
    window.addEventListener("gymdrobe-order-push-status", update); update();
    return () => window.removeEventListener("gymdrobe-order-push-status", update);
  }, []);
  if (!orderPushEnabled()) return null;
  const owned = state.userId === user?.id;
  const change = async action => { setBusy(true); try { await action(); } finally { setBusy(false); } };
  return <section className="panel" style={{ marginBottom: 24 }} aria-busy={busy}>
    <h2>Order updates</h2>
    <p>Choose push updates for orders, dispatch, delivery, returns and refunds on this device. They use a general message on your lock screen. Open the app to view the details.</p>
    <p className="muted">This preference covers order updates. It does not subscribe you to marketing or price alerts.</p>
    {!user ? <Link className="button secondary" to="/login">Sign in to choose updates</Link> : <>
      <p role="status">{owned ? state.message || "Order updates are off for this device." : "Loading notification settings…"}</p>
      <div className="purchase-actions">
        <button type="button" className="button secondary" disabled={busy || !owned || state.status === "registering" || state.status === "unavailable"} onClick={() => change(enableOrderPush)}>{state.status === "on" ? "Refresh this device" : "Enable order updates"}</button>
        {owned && state.optedIn && <button type="button" className="button secondary" disabled={busy} onClick={() => change(disableOrderPush)}>Turn off on this device</button>}
      </div>
    </>}
  </section>;
}
