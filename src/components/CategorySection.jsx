import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import categories from "../data/categories";
import products from "../data/products";

const styles = `
.gd-categories{background:#fafaf7;color:#20241f;padding:64px 0;font-family:inherit;scroll-margin-top:100px}
.gd-categories *{box-sizing:border-box}
.gd-categories .gdc-wrap{max-width:1500px;margin:auto;padding:0 32px}
.gd-categories .gdc-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:30px}
.gd-categories .gdc-eyebrow{margin:0 0 12px;color:#b83e10;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:750}
.gd-categories h2{margin:0;color:#20241f;font-size:clamp(28px,3.2vw,46px);font-weight:850;letter-spacing:-.045em;line-height:1.1}
.gd-categories .gdc-intro{margin:14px 0 0;color:#63695e;font-size:14px;line-height:1.7;max-width:480px}
.gd-categories .gdc-all{display:inline-flex;align-items:center;gap:18px;min-height:44px;color:#20241f;font-size:13px;font-weight:750;text-decoration:none;border-bottom:1px solid #20241f;white-space:nowrap}
.gd-categories .gdc-all:hover{color:#b83e10;border-color:#b83e10}
.gd-categories .gdc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.gd-categories .gdc-card{display:flex;flex-direction:column;min-width:0;border:1px solid #e1e5d9;border-radius:16px;background:#fff;overflow:hidden;text-decoration:none;color:#20241f;transition:transform .3s,box-shadow .3s,border-color .3s}
.gd-categories a.gdc-card:hover{transform:translateY(-6px);box-shadow:0 18px 36px -24px #20241f60;border-color:#bcc5af}
.gd-categories a:focus-visible{outline:3px solid #c74713;outline-offset:5px}
.gd-categories .gdc-picture{position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:1.05;background:var(--gdc-bg,#edf0e6);padding:35px 22px 20px;overflow:hidden}
.gd-categories .gdc-picture:before{content:'';position:absolute;width:74%;aspect-ratio:1;border:1px solid #20241f12;border-radius:50%}
.gd-categories .gdc-image{position:relative;width:100%;height:100%;object-fit:contain;border-radius:8px;transition:transform .5s}
.gd-categories a.gdc-card:hover .gdc-image{transform:scale(1.06)}
.gd-categories .gdc-index{position:absolute;left:16px;top:15px;color:#59624e;font-size:10px;font-weight:750;letter-spacing:.1em}
.gd-categories .gdc-label{position:absolute;right:12px;top:12px;max-width:72%;border-radius:20px;padding:6px 9px;background:#fff;color:#474f3d;font-size:10px;font-weight:750;line-height:1.3;text-align:center;z-index:1}
.gd-categories .gdc-monogram{position:relative;font-size:68px;line-height:1;font-weight:900;letter-spacing:-.06em;color:#657452}
.gd-categories .gdc-body{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:20px 18px;flex:1}
.gd-categories h3{margin:0;font-size:17px;font-weight:750;letter-spacing:-.02em;line-height:1.25;overflow-wrap:anywhere}
.gd-categories .gdc-count{margin:7px 0 0;font-size:11px;line-height:1.5;color:#66705c}
.gd-categories .gdc-arrow{display:grid;place-items:center;width:36px;height:36px;border:1px solid #dde3d4;border-radius:50%;flex-shrink:0;transition:background .25s,color .25s,transform .25s}
.gd-categories a.gdc-card:hover .gdc-arrow{background:#20241f;color:#fff;transform:rotate(-35deg)}
.gd-categories .gdc-empty{padding:26px;background:#edf0e6;border-radius:12px;color:#59624e;font-size:14px}
@keyframes gdc-reveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
.gd-categories .gdc-reveal{animation:gdc-reveal .55s both;animation-delay:var(--gdc-delay,0ms)}
@media(max-width:1000px){.gd-categories .gdc-wrap{padding:0 20px}.gd-categories .gdc-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
@media(max-width:700px){.gd-categories{padding:40px 0}.gd-categories .gdc-wrap{padding:0 16px}.gd-categories .gdc-header{display:block;margin-bottom:24px}.gd-categories .gdc-all{margin-top:14px}.gd-categories .gdc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gd-categories .gdc-picture{padding:38px 14px 16px}.gd-categories .gdc-body{padding:16px 12px;gap:8px}.gd-categories h3{font-size:14px}.gd-categories .gdc-arrow{width:28px;height:28px}.gd-categories .gdc-label{font-size:9px}.gd-categories .gdc-index{left:12px}.gd-categories .gdc-monogram{font-size:48px}}
@media(prefers-reduced-motion:reduce){.gd-categories *{animation:none!important;transition:none!important}.gd-categories a.gdc-card:hover,.gd-categories a.gdc-card:hover .gdc-image,.gd-categories a.gdc-card:hover .gdc-arrow{transform:none}}
`;
const backgrounds = ["#e8ecdf", "#f1e7dd", "#e6eaed", "#ece8df"];
const normalize = (value) => String(value ?? "").trim().toLowerCase();

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CategoryImage({ src, name }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img className="gdc-image" src={src} alt="" loading="lazy"
      decoding="async" width="400" height="400" onError={() => setFailed(true)} />
  ) : (
    <span className="gdc-monogram" aria-hidden="true">
      {name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase()}
    </span>
  );
}

function CategoryTile({ category, index, catalog }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    // Content remains visible if IntersectionObserver is unavailable.
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setRevealed(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const name = String(category.name);
  const items = catalog.filter((product) => normalize(product?.category) === normalize(name));
  const available = items.filter((product) => Number(product.stock || 0) > 0);
  const featured = available.find((product) => product.image) || items.find((product) => product.image);
  const comingSoon = items.length === 0;
  const Wrapper = comingSoon ? "div" : Link;
  const destination = `/shop?${new URLSearchParams({ category: name }).toString()}`;

  return (
    <div ref={ref} className={revealed ? "gdc-reveal" : ""}
      style={{ "--gdc-delay": `${(index % 4) * 55}ms` }}>
      <Wrapper className="gdc-card" style={{ height: "100%", "--gdc-bg": backgrounds[index % backgrounds.length] }}
        {...(comingSoon ? {} : { to: destination })}>
        <div className="gdc-picture">
          <span className="gdc-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="gdc-label">{comingSoon ? "Coming soon" : available.length ? "Explore collection" : "Currently out of stock"}</span>
          <CategoryImage key={featured?.image || name} src={featured?.image} name={name} />
        </div>
        <div className="gdc-body">
          <div>
            <h3>{name}</h3>
            <p className="gdc-count">{comingSoon ? "A new collection is on the way" : `${items.length} ${items.length === 1 ? "product" : "products"} to explore`}</p>
          </div>
          {!comingSoon && <span className="gdc-arrow"><Arrow /></span>}
        </div>
      </Wrapper>
    </div>
  );
}

export default function CategorySection() {
  const catalog = Array.isArray(products) ? products : [];
  const collectionList = (Array.isArray(categories) ? categories : [])
    .filter((category) => category && typeof category.name === "string" && category.name.trim());
  return (
    <section id="categories" className="gd-categories" aria-labelledby="gdc-title">
      <style>{styles}</style>
      <div className="gdc-wrap">
        <div className="gdc-header">
          <div>
            <p className="gdc-eyebrow">Find your gear</p>
            <h2 id="gdc-title">Every session. Every essential.</h2>
            <p className="gdc-intro">Build your kit, one favourite at a time. Explore the collections for your next workout.</p>
          </div>
          <Link to="/shop" className="gdc-all">Shop all products <Arrow /></Link>
        </div>
        {collectionList.length ? (
          <div className="gdc-grid">
            {collectionList.map((category, index) => (
              <CategoryTile key={category.name} category={category} index={index} catalog={catalog} />
            ))}
          </div>
        ) : <p className="gdc-empty">Our collections are being organised. Browse the shop to see available products.</p>}
      </div>
    </section>
  );
}
