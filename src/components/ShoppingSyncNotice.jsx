import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext.jsx";

export default function ShoppingSyncNotice({ standalone = false }) {
  const { shoppingSyncStatus: status, retryShoppingSync, useAccountShopping, keepDeviceShopping } = useStore();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  if (!status || status === "local") return null;
  const review = status === "review" || status === "storage";
  async function choose(action, question) {
    if (locked.current || !window.confirm(question)) return;
    locked.current = true; setBusy(true); setError("");
    try { await action(); }
    catch { setError("Your lists are still kept on this device. Please reconnect and retry."); }
    finally { locked.current = false; setBusy(false); }
  }
  const notice = <aside className="notice shopping-sync-notice" role="status" style={{ marginBlock: 16 }}>
    {status === "saved" ? "Your bag and wishlist are saved to your account." :
      status === "syncing" ? "Saving your bag and wishlist…" :
      status === "sign-in" ? <>Sign in again to save your changes across devices. <Link to="/login?next=/cart">Sign in</Link></> :
      review ? "Your bag is kept on this device. Review which lists to keep before syncing." :
      status === "unavailable" ? "Account saving is unavailable. Your lists are kept on this device." :
      "Your changes are kept on this device and will sync when you reconnect."}
    {error && <p role="alert">{error}</p>}
    {review ? <div className="purchase-actions" style={{ marginTop: 12 }}>
      <button className="button secondary" type="button" disabled={busy} onClick={() => choose(useAccountShopping, "Replace this device’s bag and wishlist with your account’s saved lists?")}>Use account lists</button>
      <button className="button secondary" type="button" disabled={busy} onClick={() => choose(keepDeviceShopping, "Replace your account’s saved bag and wishlist with the lists on this device?")}>Keep this device’s lists</button>
    </div> : ["offline", "waiting", "unavailable"].includes(status) && <button className="text-link" style={{ marginLeft: 12 }} type="button" disabled={busy} onClick={retryShoppingSync}>Retry saving</button>}
  </aside>;
  return standalone ? <div className="page" style={{ paddingBottom: 0 }}>{notice}</div> : notice;
}
