import Hero from "../components/Hero.jsx";
import CategorySection from "../components/CategorySection.jsx";
import HomeProductSections from "../components/HomeProductSections.jsx";


// ======================================================
// HOME PAGE
// ======================================================

export default function Home() {
  return (
    <>
      {/* ===============================================
          1. HERO
          Main value proposition + primary shopping CTA
      =============================================== */}

      <Hero />


      {/* ===============================================
          2. TRUST / BENEFIT BAR
          Reinforce confidence before product discovery
      =============================================== */}

      <section
        className="gm-home-trust-bar"
        aria-label="Why shop with GymDrobe"
      >
        <div className="gm-home-trust-item">
          <strong>
            Secure payments
          </strong>

          <span>
            Razorpay-verified checkout
          </span>
        </div>


        <div className="gm-home-trust-item">
          <strong>
            Flexible payment
          </strong>

          <span>
            Pay online or choose COD with 10% advance
          </span>
        </div>


        <div className="gm-home-trust-item">
          <strong>
            Clear delivery details
          </strong>

          <span>
            Delivery information shown before purchase
          </span>
        </div>


        <div className="gm-home-trust-item">
          <strong>
            Product transparency
          </strong>

          <span>
            Real stock, variants, ratings and reviews
          </span>
        </div>
      </section>


      {/* ===============================================
          3. SHOP BY CATEGORY
      =============================================== */}

      <CategorySection />


      {/* ===============================================
          4+.
          BESTSELLERS
          TRENDING
          OFFERS
          WHY GYMDROBE
          REVIEWS
          RECOMMENDATIONS
          RECENTLY VIEWED

          These are controlled in HomeProductSections.
      =============================================== */}

      <HomeProductSections />
    </>
  );
}