import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import products from "../data/products";

const css = `
.gd-products{color:#20241f;background:#fff;padding:64px 0;font-family:inherit;scroll-margin-top:100px}
.gd-products *{box-sizing:border-box}
.gd-products button,.gd-products select{font:inherit}
.gd-products button{cursor:pointer}
.gd-products a{color:inherit;text-decoration:none}
.gd-products :is(a,button,select):focus-visible{outline:3px solid #c74713;outline-offset:4px}
.gd-products .gdp-wrap{max-width:1500px;margin:auto;padding:0 32px}
.gd-products .gdp-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
.gd-products .gdp-eyebrow{margin:0 0 12px;color:#b83e10;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.18em}
.gd-products h2{margin:0;font-size:clamp(28px,3.2vw,46px);font-weight:850;letter-spacing:-.045em;line-height:1.1;color:#20241f}
.gd-products .gdp-intro{font-size:14px;color:#626b58;line-height:1.7;margin:14px 0 0}
.gd-products .gdp-all{display:inline-flex;align-items:center;gap:16px;min-height:44px;border-bottom:1px solid #20241f;font-size:13px;font-weight:750;white-space:nowrap}
.gd-products .gdp-toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:30px 0 14px;flex-wrap:wrap}
.gd-products .gdp-filters{display:flex;flex-wrap:wrap;gap:8px}
.gd-products .gdp-filter{border:1px solid #dee3d6;border-radius:30px;padding:11px 17px;min-height:44px;color:#59644d;background:#fff;font-size:12px;font-weight:700;transition:background .2s,color .2s}
.gd-products .gdp-filter[aria-pressed=true]{background:#20241f;border-color:#20241f;color:white}
.gd-products .gdp-filter:hover{border-color:#69765b}
.gd-products .gdp-sort{display:flex;align-items:center;gap:10px;font-size:12px;color:#58634c}
.gd-products select{min-height:44px;border:1px solid #dee3d6;background:#fff;border-radius:8px;padding:8px;color:#20241f;max-width:100%}
.gd-products .gdp-count{margin:0 0 22px;color:#66705c;font-size:12px}
.gd-products .gdp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:26px 18px}
.gd-products .gdp-card{min-width:0;position:relative}
.gd-products .gdp-media{position:relative;aspect-ratio:3/4;background:#f1f3ed;border:1px solid #e6e9df;border-radius:16px;overflow:hidden}
.gd-products .gdp-photo-link{display:flex;align-items:center;justify-content:center;position:absolute;inset:0;padding:22px}
.gd-products .gdp-image{width:100%;height:100%;object-fit:contain;transition:transform .45s,opacity .3s}
.gd-products .gdp-card:hover .gdp-image{transform:scale(1.045)}
.gd-products .gdp-alternate{position:absolute;inset:22px;width:calc(100% - 44px);height:calc(100% - 44px);opacity:0}
@media(hover:hover){.gd-products .gdp-card:hover .gdp-alternate{opacity:1}.gd-products .gdp-card:hover .gdp-has-alternate{opacity:0}}
.gd-products .gdp-fallback{padding:30px;font-weight:750;text-align:center;color:#647354}
.gd-products .gdp-heart{position:absolute;right:12px;top:12px;display:grid;place-items:center;width:44px;height:44px;border:1px solid #e5e8df;background:#fff;border-radius:50%;color:#30382a;transition:transform .2s,color .2s}
.gd-products .gdp-heart[aria-pressed=true]{color:#b83e10}.gd-products .gdp-heart:hover{transform:scale(1.08)}
.gd-products .gdp-heart:disabled{opacity:.4;cursor:default}
.gd-products .gdp-badge{position:absolute;left:12px;top:18px;max-width:calc(100% - 80px);border-radius:6px;background:#20241f;color:#fff;font-size:9px;font-weight:750;padding:6px 9px;line-height:1.4}
.gd-products .gdp-quick{position:absolute;bottom:12px;left:12px;right:12px;min-height:44px;border:1px solid #dce2d3;border-radius:8px;background:#fffffff2;color:#20241f;font-size:12px;font-weight:750;transition:background .2s}
.gd-products .gdp-quick:hover{background:#20241f;color:#fff}
.gd-products .gdp-body{padding:15px 2px 0}
.gd-products .gdp-brand{margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b745f}
.gd-products h3{margin:0;color:#20241f;font-size:14px;font-weight:750;line-height:1.5}
.gd-products .gdp-rating{margin:8px 0 0;color:#58664a;font-size:11px}
.gd-products .gdp-price{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;font-size:15px;font-weight:750}
.gd-products .gdp-price del{font-size:12px;color:#77816b;font-weight:400}
.gd-products .gdp-discount{font-size:11px;font-weight:650;color:#b83e10}
.gd-products .gdp-stock{font-size:11px;color:#a43821;margin:8px 0 0}
.gd-products .gdp-empty{padding:44px 24px;background:#f3f4ef;border:1px solid #e4e8dd;border-radius:16px;text-align:center;color:#616c55;font-size:14px;line-height:1.7}
.gd-products .gdp-more{display:block;margin:28px auto 0;min-height:46px;padding:10px 26px;border:1px solid #20241f;border-radius:8px;background:#fff;color:#20241f;font-weight:700;font-size:13px}
.gd-products .gdp-modal{width:min(850px,calc(100% - 32px));max-height:90dvh;padding:0;border:1px solid #dce2d3;border-radius:20px;background:white;color:#20241f;overflow:auto;margin:auto}
.gd-products .gdp-modal::backdrop{background:#131b16b3;backdrop-filter:blur(4px)}
.gd-products .gdp-modal-inner{position:relative;display:grid;grid-template-columns:1fr 1fr}
.gd-products .gdp-close{position:absolute;right:12px;top:12px;z-index:1;width:44px;height:44px;border:1px solid #dee3d6;border-radius:50%;background:#fff;color:#20241f;font-size:25px}
.gd-products .gdp-modal-media{display:flex;align-items:center;justify-content:center;background:#f0f3e9;padding:30px;min-height:330px}
.gd-products .gdp-modal-media img{width:100%;height:330px;object-fit:contain}
.gd-products .gdp-modal-copy{padding:65px 28px 32px;display:flex;flex-direction:column;justify-content:center}
.gd-products .gdp-modal-copy h3{font-size:26px;line-height:1.2;letter-spacing:-.035em}
.gd-products .gdp-modal-copy p{font-size:13px;line-height:1.7;color:#616b55}
.gd-products .gdp-detail-link{display:block;text-align:center;margin-top:20px;padding:14px 20px;background:#c74713;border-radius:8px;color:#fff;font-size:13px;font-weight:750}
@keyframes gdp-enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.gd-products .gdp-grid{animation:gdp-enter .4s both}
@media(max-width:1000px){.gd-products .gdp-wrap{padding:0 20px}.gd-products .gdp-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:700px){.gd-products{padding:40px 0}.gd-products .gdp-wrap{padding:0 16px}.gd-products .gdp-heading{display:block}.gd-products .gdp-all{margin-top:12px}.gd-products .gdp-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 12px}.gd-products .gdp-photo-link{padding:12px}.gd-products .gdp-alternate{inset:12px;width:calc(100% - 24px);height:calc(100% - 24px)}.gd-products .gdp-filter{padding:10px 12px;font-size:11px}.gd-products .gdp-toolbar{gap:14px}.gd-products .gdp-heart{top:8px;right:8px}.gd-products .gdp-badge{left:8px;max-width:calc(100% - 64px);font-size:8px}.gd-products .gdp-modal-inner{grid-template-columns:1fr}.gd-products .gdp-modal-media{min-height:200px;padding:24px}.gd-products .gdp-modal-media img{height:200px}.gd-products .gdp-modal-copy{padding:24px}.gd-products h3{font-size:13px}}
@media(prefers-reduced-motion:reduce){.gd-products *{animation:none!important;transition:none!important}.gd-products .gdp-card:hover .gdp-image,.gd-products .gdp-heart:hover{transform:none}}
`;

const collections = [
  { id: "all", label: "All gear" },
  { id: "featured", label: "Featured" },
  { id: "bestsellers", label: "Bestsellers" },
  { id: "new", label: "New arrivals" },
];
const isAvailable = (product) => Number(product.stock || 0) > 0 && product.stockStatus !== "out-of-stock";
const pathFor = (product) => `/product/${encodeURIComponent(product.id)}`;
const money = (value) => `₹${value.toLocaleString("en-IN")}`;

// Uses the same price + percentage-discount model as your original file.
function pricing(product) {
  const rawPrice = Number(product.price);
  const rawDiscount = Number(product.discount);
  const price = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : null;
  const discount = Number.isFinite(rawDiscount) ? Math.min(100, Math.max(0, rawDiscount)) : 0;
  return { price, discount, selling: price === null ? null : Math.round(price * (1 - discount / 100)) };
}
function Price({ product }) {
  const { price, discount, selling } = pricing(product);
  return <div className="gdp-price">
    <span>{selling === null ? "Price unavailable" : money(selling)}</span>
    {selling !== null && discount > 0 && <><del>{money(price)}</del><span className="gdp-discount">{discount}% off</span></>}
  </div>;
}
function Rating({ product }) {
  const rating = Number(product.rating);
  const count = Math.max(0, Math.floor(Number(product.reviewCount) || 0));
  if (!Number.isFinite(rating) || rating <= 0 || rating > 5) return null;
  return <p className="gdp-rating"><span aria-label={`${rating} out of 5 stars`}>★ {rating.toFixed(1)}</span>{count > 0 ? ` · ${count.toLocaleString("en-IN")} reviews` : ""}</p>;
}
function Photo({ src, name, className = "gdp-image", alternate = false }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return alternate ? null : <span className="gdp-fallback">{name}</span>;
  return <img src={src} alt={alternate ? "" : name} className={className} width="500" height="650"
    loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
function Heart({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} aria-hidden="true">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>;
}
function ProductCard({ product, wishlist, toggleWishlist, onPreview }) {
  const saved = wishlist.some((item) => item && String(item.id) === String(product.id));
  const secondary = Array.isArray(product.images)
    ? product.images.find((src) => typeof src === "string" && src && src !== product.image) : null;
  // Keep the first image visible under the alternate so failed alternate loads never leave a blank card.
  return <article className="gdp-card">
    <div className="gdp-media">
      <Link className="gdp-photo-link" to={pathFor(product)} aria-label={`View ${product.name}`}>
        <Photo key={product.image} src={product.image} name={product.name} />
        {secondary && <Photo key={secondary} src={secondary} name={product.name} alternate className="gdp-image gdp-alternate" />}
      </Link>
      {product.badge && <span className="gdp-badge">{String(product.badge)}</span>}
      <button type="button" className="gdp-heart" aria-pressed={saved}
        disabled={typeof toggleWishlist !== "function"}
        aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} wishlist`}
        onClick={() => toggleWishlist?.(product)}><Heart active={saved} /></button>
      <button type="button" className="gdp-quick" aria-haspopup="dialog" onClick={() => onPreview(product)}>Quick view</button>
    </div>
    <div className="gdp-body">
      <p className="gdp-brand">{product.brand || "GymDrobe"}</p>
      <Link to={pathFor(product)}><h3>{product.name}</h3></Link>
      <Rating product={product} /><Price product={product} />
      {!isAvailable(product) && <p className="gdp-stock">Currently out of stock</p>}
    </div>
  </article>;
}

export default function HomeProductSections({ wishlist = [], toggleWishlist }) {
  const [collection, setCollection] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [limit, setLimit] = useState(8);
  const [preview, setPreview] = useState(null);
  const dialogRef = useRef(null);
  const dialogTitle = useId();
  const sortId = useId();
  const headingId = useId();
  const safeWishlist = Array.isArray(wishlist) ? wishlist : [];
  const catalog = (Array.isArray(products) ? products : []).filter((p) => p && p.id != null);
  const filtered = catalog.filter((p) => collection === "featured" ? p.isFeatured : collection === "bestsellers" ? p.isBestSeller : collection === "new" ? p.isNew : true);
  filtered.sort((a, b) => {
    if (sort === "price-low" || sort === "price-high") {
      const first = pricing(a).selling;
      const second = pricing(b).selling;
      if (first === null) return second === null ? 0 : 1;
      if (second === null) return -1;
      return sort === "price-low" ? first - second : second - first;
    }
    if (sort === "rating") return (Number(b.rating) || 0) - (Number(a.rating) || 0);
    return Number(isAvailable(b)) - Number(isAvailable(a)) || Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
  });

  useEffect(() => {
    if (!preview) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [preview]);

  return <section id="home-products" className="gd-products" aria-labelledby={headingId}>
    <style>{css}</style>
    <div className="gdp-wrap">
      <div className="gdp-heading">
        <div><p className="gdp-eyebrow">The GymDrobe collection</p><h2 id={headingId}>Find your next favourite.</h2><p className="gdp-intro">Explore the gear. Save your picks. Make it your next workout.</p></div>
        <Link className="gdp-all" to="/shop">Explore the full shop <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="gdp-toolbar">
        <div className="gdp-filters" role="group" aria-label="Product collections">
          {collections.map((item) => <button key={item.id} type="button" className="gdp-filter" aria-pressed={collection === item.id}
            onClick={() => { setCollection(item.id); setLimit(8); }}>{item.label}</button>)}
        </div>
        <label className="gdp-sort" htmlFor={sortId}>Sort by
          <select id={sortId} value={sort} onChange={(event) => { setSort(event.target.value); setLimit(8); }}>
            <option value="recommended">Recommended</option><option value="price-low">Price: Low to high</option><option value="price-high">Price: High to low</option><option value="rating">Highest rated</option>
          </select>
        </label>
      </div>
      <p className="gdp-count" role="status">Showing {Math.min(limit, filtered.length)} of {filtered.length} products</p>
      {filtered.length ? <div className="gdp-grid" key={`${collection}-${sort}`}>
        {filtered.slice(0, limit).map((product) => <ProductCard key={product.id} product={product} wishlist={safeWishlist} toggleWishlist={toggleWishlist} onPreview={setPreview} />)}
      </div> : <div className="gdp-empty">No products in this collection yet. Choose All gear to explore the rest of the shop.</div>}
      {filtered.length > limit && <button type="button" className="gdp-more" onClick={() => setLimit((value) => value + 8)}>Show more products</button>}
    </div>
    {preview && <dialog ref={dialogRef} className="gdp-modal" aria-labelledby={dialogTitle}
      onCancel={(event) => { event.preventDefault(); setPreview(null); }}
      onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setPreview(null); } }}>
      <div className="gdp-modal-inner">
        <button type="button" className="gdp-close" aria-label="Close quick view" onClick={() => setPreview(null)}>×</button>
        <div className="gdp-modal-media"><Photo key={preview.image} src={preview.image} name={preview.name} /></div>
        <div className="gdp-modal-copy">
          <p className="gdp-brand">{preview.brand || "GymDrobe"}</p>
          <h3 id={dialogTitle}>{preview.name}</h3><Rating product={preview} /><Price product={preview} />
          <p>{isAvailable(preview) ? "Explore available sizes, colours and product details before adding this item to your bag." : "This product is currently out of stock. You can still view its details or save it to your wishlist."}</p>
          <Link className="gdp-detail-link" to={pathFor(preview)} onClick={() => setPreview(null)}>View product & options →</Link>
        </div>
      </div>
    </dialog>}
  </section>;
}
