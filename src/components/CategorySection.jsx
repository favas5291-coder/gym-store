import categories from "../data/categories.js";
import { useCatalog } from "../context/CatalogContext.jsx";
import CategoryCard from "./CategoryCard.jsx";
import { inStock, priceDetails } from "./StorefrontShared.jsx";
export default function CategorySection() {
  const { products } = useCatalog();
  return (
    <section
      className="gm-section gm-categories"
      id="categories"
      aria-labelledby="gm-category-title"
    >
      <div className="gm-section-head">
        <h2 id="gm-category-title">SHOP BY CATEGORY</h2>
      </div>
      <div className="gm-category-grid">
        {categories.map((category) => {
          const items = products.filter((p) => p.category === category.name),
            available = items.filter(inStock);
          const discount = Math.max(
            0,
            ...available.map((p) => priceDetails(p).discount),
          );
          return (
            <CategoryCard
              key={category.name}
              name={category.name}
              icon={category.image || available[0]?.image || items[0]?.image}
              offer={discount ? `UP TO ${discount}% OFF` : "SHOP THE EDIT"}
              comingSoon={!items.length}
              outOfStock={Boolean(items.length && !available.length)}
            />
          );
        })}
      </div>
    </section>
  );
}