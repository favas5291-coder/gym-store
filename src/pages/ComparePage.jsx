import { Link } from "react-router-dom";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { getTotalStock } from "../utils/cartUtils.js";
import { getDiscountedPrice, money } from "../utils/productPricing.js";
import { reviewStats } from "../utils/reviews.js";
import { ProductImage, productPath } from "../components/StorefrontShared.jsx";
import EmptyState from "../components/EmptyState.jsx";
export default function ComparePage() {
  const { compared, toggleCompare } = useShoppingTools();
  if (!compared.length)
    return (
      <EmptyState title="Compare your next picks">
        Use Compare on a product card to compare up to four items side by side.
      </EmptyState>
    );
  const fields = [
    ["Price", (p) => money(getDiscountedPrice(p))],
    ["Brand", (p) => p.brand],
    ["Category", (p) => p.category],
    ["Material", (p) => p.material],
    ["Fit", (p) => p.specifications?.Fit],
    ["Sizes", (p) => p.sizes?.join(", ")],
    ["Colours", (p) => p.colors?.join(", ")],
    [
      "Availability",
      (p) => (getTotalStock(p) > 0 ? "In stock" : "Out of stock"),
    ],
    [
      "Rating",
      (p) => {
        const r = reviewStats(p);
        return r.count ? `${r.rating} ★ (${r.count} reviews)` : "No reviews";
      },
    ],
    ["In the box", (p) => p.whatsIncluded],
    ["Returns", (p) => p.returnPolicy],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <h1>
          Compare products <span>{compared.length} / 4</span>
        </h1>
        <Link to="/shop" className="text-link">
          Add more products →
        </Link>
      </div>
      <div
        className="comparison-scroll"
        role="region"
        tabIndex="0"
        aria-label="Product comparison table"
      >
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col">Your shortlist</th>
              {compared.map((p) => (
                <th key={p.id} scope="col">
                  <Link to={productPath(p.id)}>
                    <ProductImage product={p} />
                    <span>{p.name}</span>
                  </Link>
                  <button
                    type="button"
                    className="text-link"
                    aria-label={`Remove ${p.name} from comparison`}
                    onClick={() => toggleCompare(p)}
                  >
                    Remove
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(([label, get]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {compared.map((p) => (
                  <td key={p.id}>{get(p) || "Not specified"}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Choose your options</th>
              {compared.map((p) => (
                <td key={p.id}>
                  <Link className="button compact" to={productPath(p.id)}>
                    View product
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}