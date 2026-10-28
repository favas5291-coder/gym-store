import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import CategorySection from "../components/CategorySection.jsx";
const HomeProductSections = lazy(() => import("../components/HomeProductSections.jsx"));
const HomeReviews = lazy(() => import("../components/HomeReviews.jsx"));

export default function Home() {
  return <div className="cinematic-home">
    <Hero />
    <CategorySection />
    <Suspense fallback={<section className="gm-section catalog-status" role="status">Loading products…</section>}><HomeProductSections /></Suspense>
    <Suspense fallback={null}><HomeReviews /></Suspense>
    <section className="service-strip" aria-label="Shopping with GymDrobe">
      <div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h12v12H3zM15 10h4l3 4v4h-7M6 18a2 2 0 1 0 4 0M16 18a2 2 0 1 0 4 0" /></svg><strong>Delivery, clearly priced</strong><p>Check your pincode for available options.</p></div>
      <div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></svg><strong>Flexible payment</strong><p>Razorpay or COD with 10% advance.</p></div>
      <div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 16 0M4 11h3v8H4zM17 11h3v8h-3zM20 18v3h-6" /></svg><strong>A little help, whenever you need it</strong><p><Link to="/help">Contact support</Link> · <a href="/shipping-and-returns.html">Delivery & returns</a></p></div>
    </section>
  </div>;
}
