import { ArrowRight, MapPin, RotateCcw, Truck } from "lucide-react";
import { Link } from "react-router-dom";

const workout = "/shop?department=workout";
const delivery = "/product/6ad26896d8f991271e3d1f99#delivery-returns";

const categories = [
  { label: "Workout Clothing", to: workout, image: "training-top", srcSet: "/editorial/training-top-250.webp 250w, /editorial/training-top-560.webp 560w" },
  { label: "Accessories", to: "/shop?department=accessories", image: "shaker", srcSet: "/editorial/shaker-180.webp 180w, /editorial/shaker-360.webp 360w, /editorial/shaker-560.webp 560w" },
  { label: "Starter Essentials", to: "/collections/gym-bags", image: "starter-bag", srcSet: "/editorial/starter-bag-250.webp 250w, /editorial/starter-bag-560.webp 560w" },
];

export default function HomeEditorial() {
  return (
    <div className="home-editorial">
      <section className="editorial-hero" aria-labelledby="editorial-heading">
        <picture className="editorial-hero-media">
          <source
            media="(max-width: 719px)"
            srcSet="/editorial/flat-lay-480.webp 480w, /editorial/flat-lay-800.webp 800w"
            sizes="100vw"
          />
          <img
            src="/editorial/flat-lay-800.webp"
            srcSet="/editorial/flat-lay-800.webp 800w, /editorial/flat-lay-1280.webp 1280w"
            sizes="(max-width: 1480px) 55vw, 802px"
            width="1280"
            height="1185"
            fetchPriority="high"
            alt="Gymshark flat lay with an open black gym bag, folded workout clothes, a bottle, towels and accessories"
          />
        </picture>
        <div className="editorial-hero-copy">
          <h1 id="editorial-heading">Gear for every workout.</h1>
          <p>Workout clothing, accessories and starter essentials.</p>
          <Link className="editorial-primary" to={workout}>Shop workout gear <ArrowRight aria-hidden="true" size={18} /></Link>
        </div>
      </section>

      <section className="editorial-categories" id="categories" aria-labelledby="home-category-title">
        <div className="editorial-categories-heading">
          <h2 id="home-category-title">Shop by category</h2>
          <Link to="/shop" aria-label="View all products">View all <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className="editorial-category-grid">
          {categories.map(({ label, to, image, srcSet }) => (
            <Link className="editorial-category" key={to} to={to}>
              <span className={`editorial-category-photo editorial-category-${image}`}>
                <img srcSet={srcSet} sizes="(max-width: 719px) 30vw, (max-width: 1023px) 31vw, 420px" alt="" loading="lazy" decoding="async" width="560" height={image === "shaker" ? 747 : 560} />
              </span>
              <span className="editorial-category-label">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <nav className="editorial-care" aria-label="Delivery and exchange information">
        <Link to="/orders"><Truck aria-hidden="true" size={20} />Track Order</Link>
        <Link to={delivery}><MapPin aria-hidden="true" size={20} />Check delivery</Link>
        <a href="/shipping-and-returns.html"><RotateCcw aria-hidden="true" size={19} />Exchange policy</a>
      </nav>
    </div>
  );
}
