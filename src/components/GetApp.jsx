import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Smartphone, X } from "lucide-react";
import { isNativeApp } from "../native/platform.js";

const dismissalKey = "gymdrobe-app-card-dismissed";

function readDismissal() {
  try {
    return sessionStorage.getItem(dismissalKey) === "1";
  } catch {
    return false;
  }
}

export default function GetApp({ showPromotion }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [dismissed, setDismissed] = useState(readDismissal);

  if (isNativeApp()) return null;

  function dismissPromotion() {
    setDismissed(true);
    try { sessionStorage.setItem(dismissalKey, "1"); } catch { /* The card remains dismissed in this view. */ }
  }

  return <>
    <button ref={trigger} type="button" className="get-app-trigger" onClick={() => dialog.current.showModal()}>
      <Smartphone size={16} aria-hidden="true" /> Get App
    </button>
    <dialog ref={dialog} className="get-app-dialog" aria-labelledby="get-app-title" onClose={() => trigger.current?.focus()}>
      <button className="get-app-close" type="button" aria-label="Close Get App" onClick={() => dialog.current.close()}><X size={20} /></button>
      <img src="/brand/external/gymdrobe-app-icon-1024.png" alt="GymDrobe app icon" width="72" height="72" />
      <h2 id="get-app-title">Get GymDrobe</h2>
      <p>Scan on your phone for installation instructions.</p>
      <img src="/brand/gymdrobe-install-qr.svg" alt="QR code for gymdrobe.com/install" width="152" height="152" />
      <Link to="/install" onClick={() => dialog.current.close()}>iPhone and Android home-screen instructions</Link>
    </dialog>
    {showPromotion && !dismissed && <aside className="get-app-promotion" aria-label="GymDrobe app">
      <img src="/brand/gymdrobe-install-qr.svg" alt="" width="64" height="64" />
      <Link to="/install">Get GymDrobe<br /> <small>Scan or open install options</small></Link>
      <button type="button" aria-label="Dismiss app promotion" onClick={dismissPromotion}><X size={16} /></button>
    </aside>}
  </>;
}
