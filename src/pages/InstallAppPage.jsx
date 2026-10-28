import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpRight, Check, Smartphone } from "lucide-react";
import { usePwa } from "../context/PwaContext.jsx";
import "./InstallAppPage.css";

export default function InstallAppPage() {
  const { canInstall, installed, online, updateReady, install, update } = usePwa();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);

  async function handleInstall() {
    setBusy(true);
    const outcome = await install();
    setMessage(outcome === "accepted"
      ? "Follow your browser’s instructions to finish installing GymDrobe."
      : outcome === "dismissed"
        ? "Installation dismissed. You can install later using your browser menu."
        : "Use the browser instructions below to add GymDrobe to your device.");
    setBusy(false);
  }

  return <section className="install-app" aria-labelledby="install-title">
    <div className="install-app-copy">
      <span className="install-app-eyebrow">GYMDROBE / ON YOUR HOME SCREEN</span>
      <h1 id="install-title">Your next workout.<br />One tap away.</h1>
      <p className="install-app-intro">Keep your fitness essentials close. Add GymDrobe to your home screen and open your store in its own window.</p>
      <ul className="install-app-benefits">
        <li><Check aria-hidden="true" size={18} />Shop the same collection and workout kits.</li>
        <li><Check aria-hidden="true" size={18} />Use your existing GymDrobe account.</li>
        <li><Check aria-hidden="true" size={18} />Access your wishlist, bag and orders.</li>
      </ul>
      {!online && <p className="install-app-message" role="status">You’re offline. Reconnect to install, shop or check your orders.</p>}
      {installed ? <p className="install-app-message" role="status"><Check size={18} aria-hidden="true" />GymDrobe is running as an app.</p>
        : canInstall ? <button className="install-app-primary" type="button" disabled={busy || !online} onClick={handleInstall}><ArrowDownToLine size={18} aria-hidden="true" />{busy ? "Opening installer…" : "Install GymDrobe"}</button>
          : <p className="install-app-hint">Add GymDrobe using your browser menu. Instructions are below.</p>}
      {message && !installed && <p role="status" className="install-app-message">{message}</p>}
      {updateReady && <div className="install-app-update"><p>A new version is ready. Updating will reload this page.</p><button className="install-app-primary" type="button" onClick={update}>Update GymDrobe</button></div>}
      <Link className="install-app-shop" to="/shop">Explore the collection <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    <aside className="install-app-card" aria-label="Installation instructions">
      <div className="install-app-icon"><img src="/icons/gymdrobe-maskable-512.png?v=1" width="88" height="88" alt="GymDrobe GD monogram" /><Smartphone size={22} aria-hidden="true" /></div>
      <h2>Add to your home screen</h2>
      <details open={ios}>
        <summary>iPhone & iPad</summary>
        <ol><li>Open GymDrobe in Safari.</li><li>Open the Share menu.</li><li>Choose <strong>Add to Home Screen</strong>, then confirm <strong>Add</strong>.</li></ol>
      </details>
      <details open={android}>
        <summary>Android</summary>
        <ol><li>Open GymDrobe in Chrome.</li><li>Open the three-dot browser menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong> and follow the instructions.</li></ol>
      </details>
      <details open={!ios && !android}>
        <summary>Computer</summary>
        <p>In Chrome or Edge, look for the install icon in the address bar or the install option in the browser menu.</p>
      </details>
      <p className="install-app-note">Installation options depend on your browser and device. Shopping, payments and order updates need an internet connection.</p>
    </aside>
  </section>;
}
