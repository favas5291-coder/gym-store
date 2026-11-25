import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useCatalog } from "../context/CatalogContext.jsx";
import HomeEditorial from "../components/HomeEditorial.jsx";
import { Link } from "react-router-dom";
import { isNativeApp } from "../native/platform.js";
const HomeProductSections = lazy(() => import("../components/HomeProductSections.jsx"));

export default function Home() {
  const { ensureProducts, loaded } = useCatalog();
  const grid = useRef(null);
  const [nearProducts, setNearProducts] = useState(false);
  useEffect(() => {
    if (loaded) return;
    if (!window.IntersectionObserver) { setNearProducts(true); ensureProducts(); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        setNearProducts(true);
        ensureProducts();
      }
    }, { rootMargin: "0px" });
    observer.observe(grid.current);
    return () => observer.disconnect();
  }, [ensureProducts, loaded]);
  const fallback = <section id="featured" className="gm-section catalog-status home-catalog-loading" role="status">Loading products…</section>;
  return <div className="cinematic-home">
    <HomeEditorial />
    <div ref={grid}>{loaded || nearProducts ? <Suspense fallback={fallback}><HomeProductSections /></Suspense> : fallback}</div>
    {!isNativeApp() && <section className="gm-section home-app-discovery" aria-labelledby="home-app-title">
      <img srcSet="/brand/app-icon-192.webp 192w" sizes="88px" src="/brand/external/gymdrobe-app-icon-1024.png" alt="" width="88" height="88" loading="lazy" />
      <div>
        <h2 id="home-app-title">GymDrobe on your home screen</h2>
        <p>Add the GymDrobe web app from your browser to shop and open your wishlist, bag and orders.</p>
        <Link className="button" to="/install">Get App</Link>
      </div>
    </section>}
  </div>;
}
