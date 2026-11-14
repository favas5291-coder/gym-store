import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { productDepartment } from "../utils/catalog.js";
import { homeCollections } from "../utils/homeCollections.js";
import { productImageSources } from "../utils/productImages.js";
import { priceDetails, productPath, ProductImage, resolveProductImage } from "./StorefrontShared.jsx";
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
  const frame = useRef(null);
  const gesture = useRef(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [playback, setPlayback] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const multiple = slides.length > 1;
  const playing = playback ?? !reducedMotion;
  const product = slides[active % slides.length];

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
    if (!frame.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= 0.45), { threshold: 0.45 });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [multiple]);

  useEffect(() => {
    if (!multiple || !playing || !visible || hidden || focused || hovered || interacting) return;
    const timer = setTimeout(() => setActive(index => (index + 1) % slides.length), 3000);
    return () => clearTimeout(timer);
  }, [active, focused, hidden, hovered, interacting, multiple, playing, slides.length, visible]);

  function move(offset) {
    setPlayback(false);
    setActive(index => (index % slides.length + offset + slides.length) % slides.length);
  }

  function finishGesture(event, cancelled = false) {
    const start = gesture.current;
    if (!start || start.pointer !== event.pointerId) return;
    setInteracting(false);
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    start.suppressClick = cancelled || Math.abs(x) > 12 || Math.abs(y) > 12;
    if (!cancelled && multiple && Math.abs(x) >= 40 && Math.abs(x) > Math.abs(y)) move(x < 0 ? 1 : -1);
  }

  return (
    <section className="home-product-carousel" aria-labelledby="home-carousel-title"
      onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={event => {
        if (multiple && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}>
      <h1 id="home-carousel-title" className="sr-only">Featured GymDrobe products</h1>
      <div className="home-carousel-frame" ref={frame}>
        {product ? <Link className="home-carousel-photo"
          to={productPath(product.id ?? product._id)}
          aria-label={`View ${product.name}`}
          onPointerDown={event => {
            if (!event.isPrimary) return;
            gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
            if (event.pointerType !== "mouse") event.currentTarget.setPointerCapture(event.pointerId);
            setInteracting(true);
          }}
          onPointerUp={event => finishGesture(event)}
          onPointerCancel={event => finishGesture(event, true)}
          onPointerLeave={event => { if (event.pointerType === "mouse") finishGesture(event, true); }}
          onDragStart={event => event.preventDefault()}
          onClick={event => {
            if (event.detail && gesture.current?.suppressClick) event.preventDefault();
            gesture.current = null;
          }}>
          <ProductImage key={product.id ?? product._id} product={product} decorative eager
            fetchPriority={active === 0 ? "high" : "auto"} sizes="(max-width: 699px) 94vw, 1000px" />
        </Link> : <div className="home-carousel-state" role="status">
          <p>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "Explore the full collection."}</p>
          {error ? <button type="button" className="button" onClick={refreshProducts}>Retry collection</button> :
            !loading && <Link className="button" to="/shop">Shop all</Link>}
        </div>}
        {multiple && <div className="home-carousel-controls" role="group" aria-label="Photo showcase controls">
          <button type="button" aria-label="Previous product" onClick={() => move(-1)}><ArrowLeft size={17} aria-hidden="true" /></button>
          <button type="button" aria-label={playing ? "Pause slideshow" : "Play slideshow"} onClick={() => setPlayback(!playing)}>
            {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          </button>
          <button type="button" aria-label="Next product" onClick={() => move(1)}><ArrowRight size={17} aria-hidden="true" /></button>
        </div>}
      </div>
      {multiple && <div className="home-carousel-dots" aria-hidden="true">
        {slides.map((item, index) => <span key={item.id ?? item._id} className={index === active % slides.length ? "is-active" : undefined} />)}
      </div>}
    </section>
  );
}
