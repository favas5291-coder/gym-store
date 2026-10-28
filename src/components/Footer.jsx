import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { categoryPath } from "./StorefrontShared.jsx";
import { WhatsAppLink } from "./WhatsAppSupport.jsx";

export default function Footer() {
  const { user } = useAuth();
  const { products } = useCatalog();
  const names = [...new Set(products.filter(p => p.isActive !== false).map(p => p.category).filter(Boolean))];
  function backToTop() { window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }
  return <footer className="gd-footer premium-footer">
    <div className="footer-statement"><Link to="/" aria-label="GymDrobe home">GYMDROBE<span>.</span></Link><p>Everything You Need<br />for Every Workout.</p></div>
    <div className="footer-grid">
      <div className="footer-about"><p>For the way you train.<br />For the life you build.</p><span>Your specialist fitness marketplace.</span></div>
      <nav aria-label="Footer online shopping"><h2>THE COLLECTION</h2><Link to="/shop">All essentials</Link>{names.slice(0, 5).map(name => <Link key={name} to={categoryPath(name)}>{name}</Link>)}<Link to="/kits">Workout kits</Link></nav>
      <nav aria-label="Footer account"><h2>YOUR GYMDROBE</h2><Link to="/account">My account</Link><Link to="/orders">Orders & tracking</Link><Link to="/addresses">Saved addresses</Link><Link to="/wishlist">Wishlist</Link><Link to="/cart">Shopping bag</Link>{user ? <Link to="/account/security">Account security</Link> : <Link to="/login">Sign in</Link>}</nav>
      <nav aria-label="Customer services"><h2>HERE TO HELP</h2><Link to="/help">Help & contact</Link><WhatsAppLink className="">WhatsApp support</WhatsAppLink><a href="/shipping-and-returns.html">Shipping & returns</a><a href="/virtual-try-on-privacy.html">Virtual try-on privacy</a><a href="mailto:support@gymdrobe.com">support@gymdrobe.com</a><details><summary>More shopping tools</summary><Link to="/offers">Offers & coupons</Link><Link to="/compare">Compare products</Link><Link to="/saved">Saved for later</Link><Link to="/notifications">Price & stock watches</Link>{import.meta.env.VITE_SUPPLIER_PORTAL_ENABLED === "true" && <Link to="/supplier">Supplier workspace</Link>}{import.meta.env.DEV && <Link to="/dev/store">Development console</Link>}</details></nav>
    </div>
    <div className="footer-base"><span>© {new Date().getFullYear()} GymDrobe. All rights reserved.</span><span>INDIA / MADE FOR MOVEMENT</span><button type="button" onClick={backToTop}>Back to top <ArrowUp size={15} strokeWidth={1.7} aria-hidden="true" /></button></div>
  </footer>;
}
