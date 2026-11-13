import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getOrderInbox, markOrderUpdateRead, stopWhatsAppUpdates } from "../services/orderApi.js";
import { formatOrderDate } from "./OrderPaymentDetails.jsx";

export function CustomerOrderUpdates({ order }) {
  const { token } = useAuth();
  const [optOut, setOptOut] = useState("");
  const updates = order.orderUpdates || [];
  if (!updates.length && !order.whatsappOrderUpdates) return null;
  async function stop() {
    setOptOut("saving");
    try {
      await stopWhatsAppUpdates(order.orderNumber || order.id, order.isGuestOrder ? undefined : token);
      setOptOut("saved");
    } catch {
      setOptOut("error");
    }
  }
  return (
    <section className="panel" aria-label="Order updates">
      <h2>Order updates</h2>
      {updates.map(row => (
        <article className="gd-supplier-shipment" key={row.id}>
          <p>{row.message}</p>
          <small>{formatOrderDate(row.at)}</small>
        </article>
      ))}
      {order.whatsappOrderUpdates && optOut !== "saved" && (
        <button type="button" className="button secondary" disabled={optOut === "saving"} onClick={stop}>
          Turn off WhatsApp updates for this order
        </button>
      )}
      {optOut === "saved" && <p role="status">WhatsApp updates are off for this order.</p>}
      {optOut === "error" && <p role="alert">The change could not be confirmed. Please retry.</p>}
    </section>
  );
}

function Inbox({ token }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    function load() {
      getOrderInbox(token, controller.signal).then(items => {
        if (!controller.signal.aborted) { setRows(items); setStatus("ready"); }
      }).catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    }
    load();
    const refresh = () => { if (!document.hidden) load(); };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token, revision]);
  return (
    <section className="panel" aria-label="Order inbox">
      <h2>Order inbox</h2>
      {status === "loading" && <p role="status">Loading order updates…</p>}
      {status === "error" && <p role="alert">Order updates could not load. <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
      {status === "ready" && !rows.length && <p>No order updates yet.</p>}
      {rows.map(row => (
        <article className="gd-supplier-shipment" key={row.id}>
          {row.unread && <strong>New</strong>}
          <p>{row.message}</p>
          <small>{formatOrderDate(row.at)}</small>
          <p><Link className="text-link" to={`/orders/${encodeURIComponent(row.orderNumber)}/track`}>Track order</Link></p>
          {row.unread && <button type="button" className="text-link" onClick={async () => {
            try {
              await markOrderUpdateRead(row.orderNumber, row.id, token);
              setRevision(value => value + 1);
            } catch {
              setStatus("error");
            }
          }}>Mark read through this update</button>}
        </article>
      ))}
    </section>
  );
}

export function CustomerOrderInbox() {
  const { token, isAuthenticated } = useAuth();
  return isAuthenticated
    ? <Inbox key={token} token={token} />
    : <section className="panel"><h2>Order inbox</h2><Link to="/login">Sign in to see your order updates</Link></section>;
}
