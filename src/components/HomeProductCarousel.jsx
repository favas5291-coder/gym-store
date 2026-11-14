import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { productDepartment } from "../utils/catalog.js";
import { homeCollections } from "../utils/homeCollections.js";
import { productImageSources } from "../utils/productImages.js";
import { money, priceDetails, productPath, ProductImage, resolveProductImage } from "./StorefrontShared.jsx";
import "./HomeProductCarousel.css";

function selectProducts(products) {
  const eligible = homeCollections(products).available
    .filter(product => priceDetails(product).valid && priceDetails(product).selling > 0 &&
      productImageSources(product).some(resolveProductImage))
    .sort((a, b) => Number(Boolean(b.isFeatured || b.isBestSeller)) -
      Number(Boolean(a.isFeatured || a.isBestSeller)));
  const departments = ["workout", "accessories", "hydration"];
  const varied = departments.map(department =>
    eligible.find(product => productDepartment(product) === department)).filter(Boolean);
  return [...new Set([...varied, ...eligible])].slice(0, 6);
}

export default function HomeProductCarousel() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const slides = useMemo(() => selectProducts(products), [products]);
  const rail = useRef(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [playback, setPlayback] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const multiple = slides.length > 1;
  const playing = playback ?? !reducedMotion;

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setReducedMotion(preference.matches);
    const onVisibility = () => setHidden(document.hidden);
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const element = rail.current;
    if (!element || !multiple) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= 0.4), { threshold: 0.4 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [multiple]);

  useEffect(() => {
    if (!multiple || !playing || !visible || hidden || focused || hovered) return;
    const timer = window.setTimeout(() => {
      const index = (Math.min(active, slides.length - 1) + 1) % slides.length;
      const element = rail.current;
      element.scrollTo({ left: element.children[index].offsetLeft, behavior: reducedMotion || index === 0 ? "instant" : "smooth" });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [active, focused, hidden, hovered, multiple, playing, reducedMotion, slides.length, visible]);

  function move(offset) {
    setPlayback(false);
    const index = (Math.min(active, slides.length - 1) + offset + slides.length) % slides.length;
    const element = rail.current;
    element.scrollTo({ left: element.children[index].offsetLeft, behavior: reducedMotion ? "instant" : "smooth" });
  }

  function onScroll() {
    const element = rail.current;
    const width = element.children[1]?.offsetLeft;
    if (width) setActive(Math.min(slides.length - 1, Math.round(element.scrollLeft / width)));
  }

  function onKeyDown(event) {
    if (!multiple || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  }

  return (
    <section className="home-product-carousel" aria-labelledby="home-carousel-title"
      onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={onKeyDown}>
      <header className="home-carousel-header">
        <h1 id="home-carousel-title">Shop Featured Gear</h1>
        {multiple && <div className="home-carousel-controls" aria-label="Carousel controls">
          <button type="button" aria-label="Previous product" onClick={() => move(-1)}><ArrowLeft size={19} aria-hidden="true" /></button>
          <button type="button" aria-label={playing ? "Pause slideshow" : "Play slideshow"} onClick={() => setPlayback(!playing)}>
            {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <button type="button" aria-label="Next product" onClick={() => move(1)}><ArrowRight size={19} aria-hidden="true" /></button>
        </div>}
      </header>
      {slides.length === 0 ? <div className="home-carousel-state" role="status">
        <p>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "Explore the full collection."}</p>
        {error ? <button type="button" className="button" onClick={refreshProducts}>Retry collection</button> :
          !loading && <Link className="button" to="/shop">Shop all</Link>}
      </div> : <div className="home-carousel-rail" ref={rail} onScroll={onScroll}
        onPointerDown={event => { if (event.pointerType === "touch" || !event.target.closest("a")) setPlayback(false); }}
        onWheel={event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setPlayback(false); }}>
        {slides.map((product, index) => (
          <article className="home-carousel-card" key={product.id ?? product._id} aria-label={`${index + 1} of ${slides.length}`}>
            <div className="home-carousel-photo">
              <ProductImage product={product} eager={index === 0} fetchPriority={index === 0 ? "high" : "auto"}
                sizes="(max-width: 699px) 85vw, 440px" />
            </div>
            <div className="home-carousel-details">
              <h2>{product.name}</h2>
              <p>{money(priceDetails(product).selling)}</p>
              <Link to={productPath(product.id ?? product._id)} className="button" aria-label={`View Product: ${product.name}`}>View Product</Link>
            </div>
          </article>
        ))}
      </div>}
    </section>
  );
}
