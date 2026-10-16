import { lazy, Suspense } from "react";

import Hero from "../components/Hero.jsx";
import CategorySection from "../components/CategorySection.jsx";

const HomeProductSections = lazy(
  () => import("../components/HomeProductSections.jsx"),
);

const HomeReviews = lazy(
  () => import("../components/HomeReviews.jsx"),
);

export default function Home() {
  return (
    <>
      <Hero />

      <section
        className="gm-home-trust-bar"
        aria-label="Why shop with GymDrobe"
      >
        <div className="gm-home-trust-item">
          <strong>Secure payments</strong>
          <span>
            Online payments through Razorpay
          </span>
        </div>

        <div className="gm-home-trust-item">
          <strong>Flexible payment</strong>
          <span>
            Pay online or choose COD with 10% advance
          </span>
        </div>

        <div className="gm-home-trust-item">
          <strong>Clear delivery details</strong>
          <span>
            Delivery information shown before purchase
          </span>
        </div>

        <div className="gm-home-trust-item">
          <strong>Product transparency</strong>
          <span>
            Stock, variants and customer reviews
          </span>
        </div>
      </section>

      <CategorySection />

      <Suspense
        fallback={
          <section
            className="gm-section"
            role="status"
            style={{ minHeight: 360 }}
          >
            Loading workout products…
          </section>
        }
      >
        <HomeProductSections />
      </Suspense>

      <Suspense fallback={null}>
        <HomeReviews />
      </Suspense>
    </>
  );
}