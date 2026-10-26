import { lazy, Suspense } from "react";
import Hero from "../components/Hero.jsx";
import CategorySection from "../components/CategorySection.jsx";
const HomeProductSections = lazy(() => import("../components/HomeProductSections.jsx"));
const HomeReviews = lazy(() => import("../components/HomeReviews.jsx"));

export default function Home() {
  return <div className="cinematic-home">
    <Hero />
    <div className="brand-intro"><p>One destination.<br /><strong>Every part of your workout.</strong></p><span>A considered collection of fitness brands & essentials.</span><a href="#categories" aria-label="Explore workout categories">↘</a></div>
    <CategorySection />
    <Suspense fallback={<section className="gm-section catalog-status" role="status">Loading workout products…</section>}><HomeProductSections /></Suspense>
    <Suspense fallback={null}><HomeReviews /></Suspense>
    <section className="service-strip" aria-label="Shopping with GymDrobe">
      <div><span aria-hidden="true">01</span><strong>Secure checkout</strong><p>Online payments through Razorpay.</p></div>
      <div><span aria-hidden="true">02</span><strong>Your payment, your choice</strong><p>Pay online or COD with 10% advance.</p></div>
      <div><span aria-hidden="true">03</span><strong>Know before you buy</strong><p>Delivery, stock and return details upfront.</p></div>
    </section>
  </div>;
}
