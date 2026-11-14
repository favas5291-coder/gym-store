import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import CategorySection, { HomeCategoryLinks } from "../components/CategorySection.jsx";
const HomeProductSections = lazy(() => import("../components/HomeProductSections.jsx"));

export default function Home() {
  return <div className="cinematic-home">
    <HomeCategoryLinks />
    <h1 className="sr-only">GymDrobe workout clothing and gear</h1>
    <CategorySection />
    <div className="home-offer-strip">
      <Link to="/offers">Browse GymDrobe offers</Link>
      <a href="/shipping-and-returns.html">Delivery &amp; returns</a>
    </div>
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
  </div>;
}
