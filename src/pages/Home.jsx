import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import HomeProductCarousel from "../components/HomeProductCarousel.jsx";
import { isNativeApp } from "../native/platform.js";
import CategorySection, { HomeCategoryLinks } from "../components/CategorySection.jsx";
const HomeProductSections = lazy(() => import("../components/HomeProductSections.jsx"));

export default function Home() {
  return <div className="cinematic-home">
    <HomeCategoryLinks />
    <HomeProductCarousel />
    <CategorySection />
    <Suspense fallback={<section className="gm-section catalog-status" role="status">Loading products…</section>}><HomeProductSections /></Suspense>
    <section className="gm-section home-shopping-care" aria-label="Delivery and customer support">
      <a href="/shipping-and-returns.html">
        <strong>Delivery &amp; returns</strong>
        <span>Read GymDrobe’s policy →</span>
      </a>
      <Link to="/help">
        <strong>Need help choosing?</strong>
        <span>Contact GymDrobe →</span>
      </Link>
    </section>
    {!isNativeApp() && <section className="gm-section home-app-discovery" aria-labelledby="home-app-title">
      <img src="/brand/external/gymdrobe-app-icon-1024.png" alt="" width="88" height="88" loading="lazy" />
      <div>
        <h2 id="home-app-title">GymDrobe on your home screen</h2>
        <p>Open your wishlist, bag and orders from your phone.</p>
        <Link className="button" to="/install">Get App</Link>
      </div>
    </section>}
  </div>;
}
