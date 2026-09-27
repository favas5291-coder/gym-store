import { Link } from "react-router-dom";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { watchChanges } from "../utils/commerce.js";
export default function StoreUtilityBar() {
  const { compared, savedItems, watches } = useShoppingTools(),
    { products } = useCatalog();
  const count = watchChanges(watches, products).filter(
    (w) => w.updates.length,
  ).length;
  return (
    <nav className="store-utility" aria-label="Shopping tools">
      <span>EVERYTHING FOR EVERY WORKOUT</span>
      <div>
        <Link to="/offers">Offers</Link>
        <Link to="/compare">
          Compare {compared.length ? `(${compared.length})` : ""}
        </Link>
        <Link to="/saved">
          Saved for later {savedItems.length ? `(${savedItems.length})` : ""}
        </Link>
        <Link to="/notifications">
          Watches {count ? `(${count} ${count === 1 ? "update" : "updates"})` : ""}
        </Link>
        <Link to="/help">Help</Link>
      </div>
    </nav>
  );
}