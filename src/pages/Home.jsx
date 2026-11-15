import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import HomeEditorial from "../components/HomeEditorial.jsx";
import { isNativeApp } from "../native/platform.js";
const HomeProductSections = lazy(() => import("../components/HomeProductSections.jsx"));

export default function Home() {
  return <div className="cinematic-home">
    <HomeEditorial />
    <Suspense fallback={<section className="gm-section catalog-status" role="status">Loading products…</section>}><HomeProductSections /></Suspense>
    {!isNativeApp() && <section className="gm-section home-app-discovery" aria-labelledby="home-app-title">
      <img src="/brand/external/gymdrobe-app-icon-1024.png" alt="" width="88" height="88" loading="lazy" />
      <div>
        <h2 id="home-app-title">GymDrobe on your home screen</h2>
        <p>Add the GymDrobe web app from your browser to shop and open your wishlist, bag and orders.</p>
        <Link className="button" to="/install">Get App</Link>
      </div>
    </section>}
  </div>;
}
