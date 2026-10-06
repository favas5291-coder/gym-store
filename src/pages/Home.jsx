import Hero from "../components/Hero.jsx";
import CategorySection from "../components/CategorySection.jsx";
import HomeProductSections from "../components/HomeProductSections.jsx";
import HomeReviews from "../components/HomeReviews.jsx";

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
          <span>Online payments through Razorpay</span>
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

      <HomeProductSections />

      <HomeReviews />
    </>
  );
}