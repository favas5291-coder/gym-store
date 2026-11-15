import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { asset } from "../data/assets.js";
import { getTotalStock } from "../utils/cartUtils.js";
import { productImageSources } from "../utils/productImages.js";
import { getFitnessKit, getFitnessKits } from "../services/kitApi.js";
import { homeCollections, latestCollectionProduct, publicationTime } from "../utils/homeCollections.js";
import HomeBrandGrid from "./HomeBrandGrid.jsx";
import { money, priceDetails, ProductImage } from "./StorefrontShared.jsx";
import ProductRow from "./ProductRow.jsx";
import HomeStoryMedia from "./HomeStoryMedia.jsx";
import HomeProductVideo from "./HomeProductVideo.jsx";

function HomeCollectionTiles({ available }) {
  const grid = useRef(null);
  const [kitCover, setKitCover] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const options = { signal: controller.signal };
      try {
        const kits = await getFitnessKits(options);
        const kit = kits.filter(item => item.level === "beginner" && item.isActive !== false)
          .sort((a, b) => publicationTime(b) - publicationTime(a) || b.id.localeCompare(a.id))[0];
        if (!kit || controller.signal.aborted) return;
        const details = await getFitnessKit(kit.id, options);
        const defaults = new Set(details.kit.slots.map(slot => slot.defaultProduct));
        const cover = details.products.find(product => defaults.has(product.id) &&
          getTotalStock(product) > 0 && productImageSources(product).length > 0);
        if (cover && !controller.signal.aborted) setKitCover({ to: `/kits/${kit.id}`, product: cover });
      } catch { /* Keep the collection cover available if kits cannot be loaded. */ }
    }, { rootMargin: "300px" });
    observer.observe(grid.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, []);

  const collections = [
    { title: "Your First Gym Kit", to: "/kits", image: asset("Towel.jpg"), ...kitCover },
    { title: "Training Apparel", to: "/shop?department=workout", product: latestCollectionProduct(available, "workout"), image: asset("tshirt.jpg") },
    { title: "Hydration", to: "/shop?department=hydration", product: latestCollectionProduct(available, "hydration"), image: asset("shaker.jpg") },
    { title: "Gym Bag Essentials", to: "/shop?department=accessories", image: asset("Towel.jpg"),
      product: latestCollectionProduct(available, "accessories", product => /\b(?:duffel|duffle|gym bag|sports bag)\b/i.test(product.name)) },
  ];

  return <div className="home-collection-grid" ref={grid}>
    {collections.map(({ title, to, image, product }) => <Link key={title} to={to}>
      <div className="home-collection-media">
        {product ? <ProductImage product={product} decorative /> : <img src={image} alt="" loading="lazy" width="480" height="360" />}
      </div>
      <strong>{title}</strong>
    </Link>)}
  </div>;
}

export default function HomeProductSections() {
  const { products, loading, error, refreshProducts } = useCatalog();
  const { lead, available, fresh } = useMemo(() => homeCollections(products), [products]);

  if (!lead.length) {
    return (
      <section className="gm-section catalog-status" aria-live="polite">
        <h2>{loading ? "Loading featured gear…" : error ? "Featured gear couldn’t load." : "More gear is on the way."}</h2>
        {error && <button type="button" className="button" onClick={refreshProducts}>Retry collection</button>}
      </section>
    );
  }

  const productPath = product => `/product/${encodeURIComponent(product.id || product._id)}`;
  return <>
    <ProductRow title={lead.some(product => product.isBestSeller) ? "Bestsellers" : "Featured Gear"} id="featured" products={lead} grid to="/shop" />
    <section className="gm-section home-story" aria-labelledby="home-story-title">
      <HomeStoryMedia />
      <div>
        <h2 id="home-story-title">Why GymDrobe</h2>
        <p>We built GymDrobe to help people in India find workout clothing and gear for the way they train, from their first gym session to their everyday routine.</p>
        <Link className="text-link" to="/shop">Explore workout gear</Link>
      </div>
    </section>
    <HomeProductVideo products={available} fallback={fresh[0] || lead[0]} />
    <section className="gm-section home-spotlight" aria-labelledby="home-spotlight-title">
      <h2 id="home-spotlight-title">In the Spotlight</h2>
      <div className="home-spotlight-grid">
        {available.slice(0, 6).map(product => <Link key={product.id || product._id} to={productPath(product)}>
          <div className="home-spotlight-media"><ProductImage product={product} decorative /></div>
          <div className="home-spotlight-copy"><strong title={product.name}>{product.name}</strong><span>{money(priceDetails(product).selling)}</span></div>
        </Link>)}
      </div>
    </section>
    <section className="gm-section home-collections" aria-labelledby="home-collections-title">
      <h2 id="home-collections-title">Shop collections</h2>
      <HomeCollectionTiles available={available} />
      <HomeBrandGrid products={available} />
    </section>
    {fresh.length > 0 && <ProductRow title="New Arrivals" products={fresh} grid to="/shop?collection=new" />}
  </>;
}
