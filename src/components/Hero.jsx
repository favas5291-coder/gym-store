import { heroMedia } from "../data/campaignMedia.js";
import { PremiumButton } from "./PremiumControls.jsx";

export default function Hero() {
  return (
    <section className="cinema-hero" aria-labelledby="cinema-title">
      <div className="cinema-content">
        <h1 id="cinema-title">Built for Every Workout</h1>
        <p className="cinema-tagline">Shop workout clothing, gym accessories and training essentials.</p>
        <div className="cinema-actions">
          <PremiumButton to="/shop" className="cinema-shop">Shop Workout Gear</PremiumButton>
        </div>
      </div>
      <div className="cinema-stage">
        <picture className="cinema-poster">
          <img src={heroMedia.desktop} alt="" width="1920" height="1080" fetchPriority="high" decoding="async" />
        </picture>
      </div>
    </section>
  );
}
