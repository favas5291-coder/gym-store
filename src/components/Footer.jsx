import { Link } from "react-router-dom";
import categories from "../data/categories";
import { Arrow, categoryPath } from "./StorefrontShared";
import "./GymDrobeStorefront.css";

export default function Footer() {
  const names = [
    ...new Set(
      (Array.isArray(categories) ? categories : [])
        .map((item) => (typeof item === "string" ? item : item?.name))
        .filter(Boolean),
    ),
  ];
  return (
    <footer className="gd-footer">
      <div className="gm-footer-wrap">
        <div className="gm-footer-columns">
          <nav aria-label="Footer online shopping">
            <h2>ONLINE SHOPPING</h2>
            <Link to="/shop">All products</Link>
            {names.slice(0, 8).map((name) => (
              <Link key={name} to={categoryPath(name)}>
                {name}
              </Link>
            ))}
          </nav>
          <nav aria-label="Footer account">
            <h2>YOUR ACCOUNT</h2>
            <Link to="/account">My profile</Link>
            <Link to="/orders">My orders</Link>
            <Link to="/addresses">Saved addresses</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/cart">Shopping bag</Link>
            <Link to="/login">Login</Link>
            <Link to="/signup">Create an account</Link>
          </nav>
          <div className="gm-footer-about">
            <Link to="/" className="gm-footer-brand">
              GYM<span>DROBE</span>
            </Link>
            <p>Everything You Need for Every Workout.</p>
            <p>
              Discover clothing, shoes and the everyday essentials that go in
              your gym bag.
            </p>
            <Link className="gm-footer-browse" to="/shop">
              EXPLORE THE COLLECTION <Arrow />
            </Link>
          </div>
          <div className="gm-footer-help">
            <h2>SHOPPING MADE SIMPLE</h2>
            <nav
              className="footer-service-links"
              aria-label="Customer services"
            >
              <Link to="/help">Help & contact support</Link>
              <Link to="/offers">Offers & coupons</Link>
              <Link to="/compare">Compare products</Link>
              <Link to="/saved">Saved for later</Link>
              <Link to="/notifications">Price & stock watches</Link>
              {import.meta.env.DEV && (
                <Link to="/dev/store">Development store console</Link>
              )}
            </nav>
            <details>
              <summary>Find your fit</summary>
              <p>
                Open a product to explore its available sizes, colours and
                product details before adding it to your bag.
              </p>
            </details>
            <details>
              <summary>Keep your favourites</summary>
              <p>
                Use the wishlist button to save your picks, then find them in{" "}
                <Link to="/wishlist">your wishlist</Link>.
              </p>
            </details>
            <details>
              <summary>View your orders</summary>
              <p>
                Open <Link to="/orders">My orders</Link> after signing in to see
                your order details and available tracking information.
              </p>
            </details>
          </div>
        </div>
        {names.length > 0 && (
          <nav className="gm-footer-searches" aria-label="Browse categories">
            <h2>EXPLORE GYMDROBE</h2>
            <div>
              {names.map((name) => (
                <Link key={name} to={categoryPath(name)}>
                  {name}
                </Link>
              ))}
            </div>
          </nav>
        )}
        <div className="gm-footer-bottom">
          <p>© {new Date().getFullYear()} GymDrobe. All rights reserved.</p>
          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            BACK TO TOP ↑
          </button>
        </div>
      </div>
    </footer>
  );
}