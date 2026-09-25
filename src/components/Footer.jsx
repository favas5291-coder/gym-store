import { Link } from "react-router-dom";
import categories from "../data/categories";

const styles = `
.gd-footer{background:#20241f;color:#f3f4ed;font-family:inherit;scroll-margin-top:100px}
.gd-footer *{box-sizing:border-box}
.gd-footer a{color:inherit;text-decoration:none}
.gd-footer button{font:inherit;cursor:pointer}
.gd-footer :is(a,button,summary):focus-visible{outline:3px solid #ffb38b;outline-offset:5px}
.gd-footer .gdf-wrap{max-width:1500px;margin:auto;padding:0 32px}
.gd-footer .gdf-invite{display:flex;justify-content:space-between;align-items:center;gap:30px;padding:48px 0;border-bottom:1px solid #ffffff24}
.gd-footer .gdf-eyebrow{margin:0 0 12px;font-size:10px;font-weight:750;letter-spacing:.18em;text-transform:uppercase;color:#ffb38b}
.gd-footer .gdf-invite h2{margin:0;font-size:clamp(28px,3.6vw,48px);line-height:1.1;letter-spacing:-.045em;font-weight:850;color:#f3f4ed}
.gd-footer .gdf-description{margin:14px 0 0;font-size:13px;color:#c0c8b7;line-height:1.8;max-width:400px}
.gd-footer .gdf-cta{display:inline-flex;align-items:center;justify-content:center;gap:24px;min-height:50px;padding:12px 24px;border-radius:8px;background:#f1f3e8;color:#20241f;font-size:13px;font-weight:750;white-space:nowrap;transition:background .2s,transform .2s}
.gd-footer .gdf-cta:hover{background:#ffb38b;transform:translateY(-2px)}
.gd-footer .gdf-columns{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:40px;padding:48px 0}
.gd-footer .gdf-brand{display:inline-block;font-size:32px;font-weight:900;letter-spacing:-.06em;color:#f3f4ed;line-height:1.2}
.gd-footer .gdf-brand span{color:#ffb38b}
.gd-footer .gdf-tagline{margin:18px 0 0;color:#f3f4ed;font-size:13px;font-weight:650;line-height:1.7}
.gd-footer .gdf-about{margin:12px 0 0;font-size:12px;line-height:1.8;color:#c0c8b7;max-width:280px}
.gd-footer h3{margin:0 0 18px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:750;color:#f3f4ed}
.gd-footer ul{list-style:none;padding:0;margin:0}
.gd-footer .gdf-links a{display:inline-flex;align-items:center;min-height:38px;font-size:12px;color:#c0c8b7;transition:color .2s,transform .2s}
.gd-footer .gdf-links a:hover{color:#ffb38b;transform:translateX(3px)}
.gd-footer details{border-bottom:1px solid #ffffff24}
.gd-footer summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;list-style:none;cursor:pointer;font-size:12px;color:#dce2d4}
.gd-footer summary::-webkit-details-marker{display:none}
.gd-footer summary:after{content:'+';font-size:20px;color:#ffb38b}
.gd-footer details[open] summary:after{content:'−'}
.gd-footer .gdf-answer{margin:0;padding:2px 0 16px;color:#c0c8b7;font-size:12px;line-height:1.8}
.gd-footer .gdf-answer a{color:#ffb38b;text-decoration:underline;text-underline-offset:3px}
.gd-footer .gdf-discover{border-top:1px solid #ffffff24;padding:28px 0}
.gd-footer .gdf-chips{display:flex;flex-wrap:wrap;gap:10px}
.gd-footer .gdf-chip{display:inline-flex;align-items:center;min-height:44px;padding:8px 14px;border:1px solid #ffffff35;border-radius:30px;color:#d2dac9;font-size:11px;transition:border-color .2s,background .2s}
.gd-footer .gdf-chip:hover{border-color:#ffb38b;background:#ffffff08}
.gd-footer .gdf-bottom{display:flex;justify-content:space-between;align-items:center;gap:20px;border-top:1px solid #ffffff24;padding:22px 0}
.gd-footer .gdf-bottom p{margin:0;color:#b9c3ae;font-size:11px;line-height:1.7}
.gd-footer .gdf-top{display:inline-flex;align-items:center;gap:12px;min-height:44px;padding:8px 14px;border:1px solid #ffffff35;border-radius:8px;color:#e8eddf;background:transparent;font-size:11px;white-space:nowrap;transition:border-color .2s}
.gd-footer .gdf-top:hover{border-color:#ffb38b}
@media(max-width:1050px){.gd-footer .gdf-wrap{padding:0 20px}.gd-footer .gdf-columns{grid-template-columns:repeat(2,minmax(0,1fr));gap:36px}}
@media(max-width:600px){.gd-footer .gdf-wrap{padding:0 20px}.gd-footer .gdf-invite{display:block;padding:36px 0}.gd-footer .gdf-cta{margin-top:22px}.gd-footer .gdf-columns{gap:32px 20px;padding:36px 0}.gd-footer .gdf-brand-column,.gd-footer .gdf-help{grid-column:1/-1}.gd-footer .gdf-bottom{align-items:flex-start}.gd-footer .gdf-brand{font-size:30px}.gd-footer .gdf-about{max-width:360px}}
@media(prefers-reduced-motion:reduce){.gd-footer *{transition:none!important}.gd-footer .gdf-cta:hover,.gd-footer .gdf-links a:hover{transform:none}}
`;

const accountLinks = [
  ["My account", "/account"],
  ["My orders", "/orders"],
  ["My wishlist", "/wishlist"],
  ["Shopping bag", "/cart"],
  ["Saved addresses", "/addresses"],
  ["Sign in", "/login"],
  ["Create an account", "/signup"],
];
const categoryPath = (name) => `/shop?${new URLSearchParams({ category: name }).toString()}`;

export default function Footer() {
  const names = [...new Set((Array.isArray(categories) ? categories : [])
    .map((category) => category?.name)
    .filter((name) => typeof name === "string" && name.trim()))];

  function backToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
  }

  return (
    <footer id="offers" className="gd-footer">
      <style>{styles}</style>
      <div className="gdf-wrap">
        <div className="gdf-invite">
          <div>
            <p className="gdf-eyebrow">Your next session starts here</p>
            <h2>Build a kit that moves with you.</h2>
            <p className="gdf-description">Find your training essentials and save the gear you want to come back for.</p>
          </div>
          <Link to="/shop" className="gdf-cta">Explore GymDrobe <span aria-hidden="true">↗</span></Link>
        </div>

        <div className="gdf-columns">
          <div className="gdf-brand-column">
            <Link className="gdf-brand" to="/" aria-label="GymDrobe home">GYM<span>DROBE.</span></Link>
            <p className="gdf-tagline">Everything You Need for Every Workout.</p>
            <p className="gdf-about">Training wear, gym shoes, hydration and everyday workout essentials. Find your favourites and make your kit your own.</p>
          </div>
          <nav aria-label="Footer shopping">
            <h3>Explore the shop</h3>
            <ul className="gdf-links">
              <li><Link to="/shop">All products</Link></li>
              {names.slice(0, 8).map((name) => <li key={name}><Link to={categoryPath(name)}>{name}</Link></li>)}
            </ul>
          </nav>
          <nav aria-label="Footer account">
            <h3>Your GymDrobe</h3>
            <ul className="gdf-links">
              {accountLinks.map(([label, path]) => <li key={path}><Link to={path}>{label}</Link></li>)}
            </ul>
          </nav>
          <div className="gdf-help">
            <h3>A little shopping help</h3>
            <details>
              <summary>How do I choose my gear?</summary>
              <p className="gdf-answer">Open a product to explore its details and available sizes or colours. Choose your options before adding it to your bag.</p>
            </details>
            <details>
              <summary>Where are my saved favourites?</summary>
              <p className="gdf-answer">Tap a product’s heart button to save it, then open <Link to="/wishlist">your wishlist</Link> to see your picks.</p>
            </details>
            <details>
              <summary>Where can I see my orders?</summary>
              <p className="gdf-answer">Sign in with the account used at checkout, then visit <Link to="/orders">My Orders</Link> to view your saved order details.</p>
            </details>
          </div>
        </div>

        {names.length > 0 && <nav className="gdf-discover" aria-label="Browse all categories">
          <h3>More ways to explore</h3>
          <div className="gdf-chips">{names.map((name) => <Link key={name} className="gdf-chip" to={categoryPath(name)}>{name}</Link>)}</div>
        </nav>}

        <div className="gdf-bottom">
          <p>© {new Date().getFullYear()} GymDrobe. All rights reserved.</p>
          <button type="button" className="gdf-top" onClick={backToTop}>Back to top <span aria-hidden="true">↑</span></button>
        </div>
      </div>
    </footer>
  );
}
