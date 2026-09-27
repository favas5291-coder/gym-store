import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext.jsx";
import { filterProducts } from "../utils/catalog.js";
import ProductCard from "../components/ProductCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
export default function WishlistPage() {
  const { wishlist } = useStore(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("recommended"),
    [available, setAvailable] = useState(false);
  if (!wishlist.length)
    return (
      <EmptyState title="Your wishlist is waiting">
        Save the gear you love using the heart on any product.
      </EmptyState>
    );
  const result = filterProducts(
    wishlist,
    new URLSearchParams({
      search,
      sort,
      availability: available ? "in-stock" : "",
    }),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <h1>
          My wishlist <span>{wishlist.length} items</span>
        </h1>
        <Link className="text-link" to="/saved">
          Saved for later →
        </Link>
      </div>
      <div className="browse-controls">
        <div className="field">
          <label htmlFor="wishlist-search">Search your wishlist</label>
          <input
            id="wishlist-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="sort-label">
          Sort by{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recommended">Recommended</option>
            <option value="price-low">Price: Low to high</option>
            <option value="price-high">Price: High to low</option>
            <option value="rating">Customer rating</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          In stock only
        </label>
      </div>
      <p className="muted">{result.length} matching items</p>
      {result.length ? (
        <div className="product-grid wishlist-grid">
          {result.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="panel">
          No saved items match. Try another search or turn off the stock filter.
        </p>
      )}
    </div>
  );
}