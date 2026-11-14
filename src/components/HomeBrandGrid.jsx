import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { brandLogoUrl, getBrandLogos } from "../services/productApi.js";
import { brandFilterPath, catalogueBrands } from "../utils/brandIdentity.js";

function BrandTile({ brand, logo }) {
  const [failed, setFailed] = useState(false);
  const hasLogo = Boolean(logo && !failed);
  return <Link to={brandFilterPath(brand.name)} className="home-brand-tile" aria-label={brand.name}>
    {hasLogo && <img src={logo} alt="" width="128" height="40" loading="lazy" decoding="async"
      onError={() => setFailed(true)} />}
    <span className={hasLogo ? "home-brand-caption" : "home-brand-name"}>{brand.name}</span>
  </Link>;
}

export default function HomeBrandGrid({ products }) {
  const section = useRef(null);
  const [logos, setLogos] = useState({});
  const brands = catalogueBrands(products);

  useEffect(() => {
    if (!section.current) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      getBrandLogos({ signal: controller.signal }).then(rows => {
        setLogos(Object.fromEntries(rows.filter(row => typeof row.key === "string" &&
          /^\/brands\/[^/]+\/logo\/[a-f\d]{24}$/i.test(row.logoPath))
          .map(row => [row.key, brandLogoUrl(row.logoPath)])));
      }).catch(() => { /* Storefront tiles retain their brand names. */ });
    }, { rootMargin: "500px" });
    observer.observe(section.current);
    return () => { controller.abort(); observer.disconnect(); };
  }, [brands.length > 0]);

  function tiles(entries) {
    return entries.map(brand => {
      const logo = brand.key === "gymdrobe" ? "/brand/gymdrobe-wordmark-green.png" : logos[brand.key];
      return <BrandTile key={`${brand.key}:${logo || ""}`} brand={brand} logo={logo} />;
    });
  }

  if (!brands.length) return null;
  return <section ref={section} className="home-brands" aria-labelledby="home-brands">
    <h3 id="home-brands">Shop by brand</h3>
    <div className="home-brand-grid">{tiles(brands.slice(0, 6))}</div>
    {brands.length > 6 && <details className="home-brand-more"><summary>View all brands</summary>
      <div className="home-brand-grid">{tiles(brands.slice(6))}</div>
    </details>}
  </section>;
}
