import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import CategorySection, { HomeCategoryLinks } from "../components/CategorySection.jsx";
const HomeProductSections = lazy(() => import("../components/HomeProductSections.jsx"));

export default function Home() {
  return <div className="cinematic-home">
    <HomeCategoryLinks />
    <Hero />
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
  </div>;
}
