import { Link, NavLink, useLocation } from "react-router-dom";
import { UserRound, Pencil, Package, MapPin, Heart, Bookmark, Bell, ShieldCheck, CircleHelp, RotateCcw, ChevronRight, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import "./account-dashboard.css";

const groups = [
  { title: "Shopping & activity", items: [["/orders", "Orders & returns", Package], ["/notifications", "Price & stock watches", Bell]] },
  { title: "Account settings", items: [["/account#profile-details", "Personal information", UserRound], ["/account/security", "Password & security", ShieldCheck]] },
  { title: "Support", items: [["/help", "Help & support", CircleHelp], ["/shipping-and-returns.html", "Returns & refunds", RotateCcw]] },
];

export function openProfile(event) {
  const panel = document.getElementById("profile-details");
  if (!panel) return;
  event?.preventDefault();
  panel.open = true;
  panel.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  requestAnimationFrame(() => document.getElementById("profile-name")?.focus({ preventScroll: true }));
}

export function AccountMenu({ compact = false }) {
  const sections = compact ? [...groups, { title: "Saved items", items: [["/addresses", "Saved addresses", MapPin], ["/wishlist", "Wishlist", Heart], ["/saved", "Saved for later", Bookmark]] }] : groups;
  return <nav className="gd-account-menu" aria-label="Account navigation">
    {sections.map(group => <section key={group.title}>
      <h2>{group.title}</h2>
      {group.items.map(([to, label, Icon]) => {
        const contents = <><Icon size={20} aria-hidden="true"/><span>{label}</span><ChevronRight size={17} aria-hidden="true"/></>;
        return to.endsWith(".html") ? <a className="gd-account-row" key={to} href={to}>{contents}</a> :
          <NavLink className="gd-account-row" key={to} to={to} end={to.startsWith("/account#")} onClick={to.includes("#profile-details") ? openProfile : undefined}>{contents}</NavLink>;
      })}
    </section>)}
  </nav>;
}

export default function AccountLayout({ title, children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const dashboard = pathname === "/account";
  const initials = String(user?.name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase();
  return <div className={`page gd-account-page${dashboard ? " gd-account-dashboard" : ""}`}>
    <header className="gd-account-header">
      <div className="gd-account-avatar" aria-hidden="true">{initials || <UserRound size={23}/>}</div>
      <div className="gd-account-identity"><p>Good to see you</p><h1>{user?.name || "Your account"}</h1>{(user?.email || user?.phone) && <p className="gd-account-contact">{user.email || user.phone}</p>}</div>
      <Link className="gd-account-edit" to="/account#profile-details" onClick={openProfile}><Pencil size={15} aria-hidden="true"/>Edit profile</Link>
    </header>
    <div className={`gd-account-body${dashboard ? "" : " gd-account-with-menu"}`}>
      {!dashboard && <aside className="gd-account-sidebar"><Link to="/account">← Account overview</Link><AccountMenu compact/></aside>}
      <section className="gd-account-content" aria-label={title}>{!dashboard && <h2>{title}</h2>}{children}</section>
    </div>
    {user?.role === "admin" && <aside className="gd-account-admin"><Settings2 size={20} aria-hidden="true"/><div><strong>Store management</strong><p>Administrator workspace</p></div><Link to="/admin">Open admin<ChevronRight size={16} aria-hidden="true"/></Link></aside>}
  </div>;
}
