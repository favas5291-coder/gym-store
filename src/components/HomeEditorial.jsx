import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const workout = "/shop?department=workout";
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

    </div>
  );
}
