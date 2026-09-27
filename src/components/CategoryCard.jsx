import { Link } from "react-router-dom";
import { ProductImage, categoryPath } from "./StorefrontShared.jsx";
export default function CategoryCard({
  name,
  icon,
  offer,
  comingSoon = false,
  outOfStock = false,
}) {
  const content = (
    <>
      <div className="gm-category-image">
        <ProductImage product={{ name, image: icon }} decorative />
      </div>
      <div className="gm-category-copy">
        <h3>{name}</h3>
        <strong>
          {comingSoon
            ? "COMING SOON"
            : outOfStock
              ? "OUT OF STOCK"
              : offer || "SHOP THE EDIT"}
        </strong>
        <span>
          {comingSoon
            ? "More gear on the way"
            : outOfStock
              ? "View collection"
              : "Shop Now"}
        </span>
      </div>
    </>
  );
  return comingSoon ? (
    <article className="gm-category-card gm-coming-soon">{content}</article>
  ) : (
    <Link className="gm-category-card" to={categoryPath(name)}>
      {content}
    </Link>
  );
}