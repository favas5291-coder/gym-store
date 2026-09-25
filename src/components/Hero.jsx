import { useState } from "react";
import { Link } from "react-router-dom";
import products from "../data/products";

const styles = `
.gd-hero{--gd-ink:#20241f;--gd-orange:#c74713;background:#fff;color:var(--gd-ink);font-family:inherit}
.gd-hero *{box-sizing:border-box}
.gd-hero a{text-decoration:none}
.gd-hero button{font:inherit;cursor:pointer}
.gd-hero a:focus-visible,.gd-hero button:focus-visible{outline:3px solid var(--gd-orange);outline-offset:5px}
.gd-hero .gd-strip{display:flex;justify-content:center;gap:12px;align-items:center;padding:13px 20px;background:#20241f;color:white;font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-align:center}
.gd-hero .gd-strip span{color:#ffad77}
.gd-hero .gd-wrap{max-width:1500px;margin:auto;padding:24px 32px 0}
.gd-hero .gd-stage{display:grid;grid-template-columns:1fr 1fr;background:#f3f1ea;border:1px solid #e8e6df;border-radius:24px;overflow:hidden}
.gd-hero .gd-copy{display:flex;flex-direction:column;justify-content:center;padding:64px 52px}
.gd-hero .gd-eyebrow{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:750;letter-spacing:.18em;text-transform:uppercase;color:#575d51;margin:0 0 26px}
.gd-hero .gd-eyebrow:before{content:'';width:25px;height:2px;background:var(--gd-orange)}
.gd-hero h1{font-size:clamp(44px,5.7vw,86px);line-height:.98;letter-spacing:-.065em;font-weight:900;margin:0}
.gd-hero h1 span{display:block;color:var(--gd-orange)}
.gd-hero .gd-description{max-width:365px;font-size:15px;line-height:1.8;color:#5c6258;margin:26px 0 0}
.gd-hero .gd-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}
.gd-hero .gd-cta{display:inline-flex;align-items:center;justify-content:center;gap:22px;min-height:50px;padding:0 22px;border-radius:8px;background:var(--gd-orange);color:#fff;font-size:13px;font-weight:750;transition:transform .2s,background .2s}
.gd-hero .gd-cta:hover{background:#a7380e;transform:translateY(-2px)}
.gd-hero .gd-secondary{background:transparent;color:var(--gd-ink);border:1px solid #b9beb1}
.gd-hero .gd-secondary:hover{background:#e5e7dc}
.gd-hero .gd-note{margin:28px 0 0;font-size:11px;letter-spacing:.05em;color:#626858}
.gd-hero .gd-visual{background:#e5e8dd;display:flex;flex-direction:column;min-width:0;padding:24px;position:relative}
.gd-hero .gd-visual-top{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;font-weight:750;z-index:1}
.gd-hero .gd-count{font-variant-numeric:tabular-nums;color:#58614e}
.gd-hero .gd-product-link{position:relative;display:flex;flex:1;min-height:320px;align-items:center;justify-content:center;margin:20px 0;isolation:isolate;color:var(--gd-ink);border-radius:16px}
.gd-hero .gd-product-link:before{content:'';position:absolute;width:75%;aspect-ratio:1;border:1px solid #cad0be;border-radius:50%;z-index:-1}
.gd-hero .gd-product-link:after{content:'GD';position:absolute;z-index:-1;font-size:clamp(120px,18vw,260px);font-weight:900;letter-spacing:-.1em;color:#d5dcc9;line-height:1}
.gd-hero .gd-image{display:block;width:100%;height:320px;object-fit:contain;transition:transform .45s cubic-bezier(.2,.8,.2,1);border-radius:12px}
.gd-hero .gd-product-link:hover .gd-image{transform:scale(1.04) rotate(-2deg)}
.gd-hero .gd-fallback{padding:30px;text-align:center;background:#f3f1ea;border-radius:12px;max-width:80%;font-size:20px;font-weight:700}
.gd-hero .gd-product-meta{background:#fff;border:1px solid #dce0d4;border-radius:12px;padding:18px;display:flex;justify-content:space-between;gap:16px;align-items:center}
.gd-hero .gd-product-name{font-size:16px;font-weight:750;color:var(--gd-ink);line-height:1.4;margin:0}
.gd-hero .gd-product-caption{font-size:11px;color:#626858;margin:5px 0 0}
.gd-hero .gd-open{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;border-radius:50%;background:var(--gd-ink);color:white;transition:background .2s}
.gd-hero .gd-open:hover{background:var(--gd-orange)}
.gd-hero .gd-controls{display:flex;gap:8px;margin-top:14px}
.gd-hero .gd-choice{min-height:48px;flex:1;border:1px solid #b9c2ab;border-radius:8px;background:transparent;color:#48533d;font-size:12px;font-weight:700;transition:background .2s,color .2s}
.gd-hero .gd-choice[aria-pressed=true]{background:var(--gd-ink);border-color:var(--gd-ink);color:white}
.gd-hero .gd-choice:hover{border-color:var(--gd-ink)}
.gd-hero .gd-benefits{display:grid;grid-template-columns:repeat(3,1fr);padding:26px 0;border-bottom:1px solid #e7e8e2;margin-bottom:12px}
.gd-hero .gd-benefit{padding:4px 24px;display:flex;align-items:center;gap:14px}
.gd-hero .gd-benefit+.gd-benefit{border-left:1px solid #e1e4da}
.gd-hero .gd-benefit-number{color:var(--gd-orange);font-size:11px;font-weight:750}
.gd-hero .gd-benefit strong{font-size:12px;display:block}
.gd-hero .gd-benefit p{margin:5px 0 0;color:#687060;font-size:11px;line-height:1.5}
@keyframes gd-enter{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes gd-product-enter{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
.gd-hero .gd-enter{animation:gd-enter .65s both}
.gd-hero .gd-delay-1{animation-delay:.1s}.gd-hero .gd-delay-2{animation-delay:.2s}.gd-hero .gd-delay-3{animation-delay:.3s}
.gd-hero .gd-product-enter{width:100%;display:flex;justify-content:center;animation:gd-product-enter .35s both}
@media(min-width:1600px){.gd-hero h1{font-size:86px}}
@media(max-width:1000px){.gd-hero .gd-copy{padding:40px 28px}.gd-hero .gd-wrap{padding:20px 20px 0}.gd-hero .gd-visual{padding:20px}.gd-hero .gd-benefit{padding:4px 14px}}
@media(max-width:700px){.gd-hero .gd-wrap{padding:12px 12px 0}.gd-hero .gd-stage{grid-template-columns:1fr;border-radius:18px}.gd-hero .gd-copy{padding:36px 24px}.gd-hero h1{font-size:clamp(44px,11vw,70px)}.gd-hero .gd-eyebrow{margin-bottom:20px}.gd-hero .gd-description{margin-top:20px}.gd-hero .gd-actions{margin-top:24px}.gd-hero .gd-note{margin-top:22px}.gd-hero .gd-product-link{min-height:250px;margin:12px 0}.gd-hero .gd-image{height:250px}.gd-hero .gd-product-link:before{width:60%;max-width:280px}.gd-hero .gd-product-link:after{font-size:200px}.gd-hero .gd-benefits{grid-template-columns:1fr;padding:10px 0}.gd-hero .gd-benefit{padding:14px 12px}.gd-hero .gd-benefit+.gd-benefit{border-left:0;border-top:1px solid #e7e8e2}.gd-hero .gd-strip{font-size:9px;letter-spacing:.08em}}
@media(prefers-reduced-motion:reduce){.gd-hero *{animation:none!important;transition:none!important}.gd-hero .gd-product-link:hover .gd-image,.gd-hero .gd-cta:hover{transform:none}}
`;

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product.image || failed) {
    return <div className="gd-fallback">{product.name}</div>;
  }
  return (
    <img
      className="gd-image"
      src={product.image}
      alt={product.name}
      width="600"
      height="600"
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Hero() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Keep the same stock field used by your original Hero.
  const heroProducts = (Array.isArray(products) ? products : [])
    .filter((product) => product && product.id != null && Number(product.stock || 0) > 0)
    .slice(0, 3);
  const currentIndex = Math.min(selectedIndex, Math.max(heroProducts.length - 1, 0));
  const activeProduct = heroProducts[currentIndex];
  const productPath = activeProduct
    ? `/product/${encodeURIComponent(activeProduct.id)}`
    : "/shop";

  return (
    <section className="gd-hero" aria-labelledby="gd-hero-title">
      <style>{styles}</style>
      <Link className="gd-strip" to="/shop">
        Everything you need for every workout <span aria-hidden="true">↗</span>
      </Link>
      <div className="gd-wrap">
        <div className="gd-stage">
          <div className="gd-copy">
            <p className="gd-eyebrow gd-enter">The GymDrobe training edit</p>
            <h1 id="gd-hero-title" className="gd-enter gd-delay-1">
              YOUR GOALS.<br />YOUR GEAR.<span>YOUR MOVE.</span>
            </h1>
            <p className="gd-description gd-enter gd-delay-2">
              Find your next training favourite. Explore workout clothing,
              shoes and the essentials that go in your gym bag.
            </p>
            <div className="gd-actions gd-enter gd-delay-3">
              <Link className="gd-cta" to="/shop">Explore the collection <Arrow /></Link>
              {activeProduct && (
                <Link className="gd-cta gd-secondary" to={productPath}>View featured gear</Link>
              )}
            </div>
            <p className="gd-note gd-enter gd-delay-3">Made for your next chapter of training.</p>
          </div>
          <div className="gd-visual">
            <div className="gd-visual-top">
              <span>In the spotlight</span>
              {activeProduct && <span className="gd-count">0{currentIndex + 1} / 0{heroProducts.length}</span>}
            </div>
            <Link className="gd-product-link" to={productPath}
              aria-label={activeProduct ? `View ${activeProduct.name}` : "Browse the collection"}>
              <div className="gd-product-enter" key={activeProduct?.id ?? "empty"}>
                {activeProduct ? <ProductImage product={activeProduct} /> : (
                  <div className="gd-fallback">Your next workout starts here.</div>
                )}
              </div>
            </Link>
            <div className="gd-product-meta">
              <div aria-live="polite" aria-atomic="true">
                <p className="gd-product-name">{activeProduct?.name || "Explore GymDrobe"}</p>
                <p className="gd-product-caption">{activeProduct ? "Explore product details and available options" : "Browse the full collection"}</p>
              </div>
              <Link className="gd-open" to={productPath}
                aria-label={activeProduct ? `Shop ${activeProduct.name}` : "Go to shop"}><Arrow /></Link>
            </div>
            {heroProducts.length > 1 && (
              <div className="gd-controls" role="group" aria-label="Choose a featured product">
                {heroProducts.map((product, index) => (
                  <button key={product.id} type="button" className="gd-choice"
                    aria-label={`Preview ${product.name}`}
                    aria-pressed={index === currentIndex}
                    onClick={() => setSelectedIndex(index)}>
                    0{index + 1} <span aria-hidden="true">{index === currentIndex ? "— Selected" : "— Explore"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="gd-benefits">
          <div className="gd-benefit"><span className="gd-benefit-number" aria-hidden="true">01</span><div><strong>Build your workout wardrobe</strong><p>Clothing, shoes and training essentials.</p></div></div>
          <div className="gd-benefit"><span className="gd-benefit-number" aria-hidden="true">02</span><div><strong>Save your favourites</strong><p>Use your wishlist to keep your next picks together.</p></div></div>
          <div className="gd-benefit"><span className="gd-benefit-number" aria-hidden="true">03</span><div><strong>Find your next fit</strong><p>Explore product details before choosing your gear.</p></div></div>
        </div>
      </div>
    </section>
  );
}
