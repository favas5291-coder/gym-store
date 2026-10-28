import { Link } from "react-router-dom";
import { TextLink } from "./PremiumControls.jsx";

import categories from "../data/categories.js";

import { useCatalog } from "../context/CatalogContext.jsx";

import CategoryCard from "./CategoryCard.jsx";
import { productDepartment } from "../utils/catalog.js";
import { categoryPath } from "./StorefrontShared.jsx";

import {
  inStock,
  priceDetails,
  resolveProductImage,
} from "./StorefrontShared.jsx";

import {
  productImageSources,
} from "../utils/productImages.js";

function categoryPhotos(product) {
  const defaults = productImageSources(
    product,
    null,
  );

  const colours = Array.isArray(product.colorImages)
    ? product.colorImages.flatMap((row) =>
        Array.isArray(row?.images)
          ? row.images
          : [],
      )
    : [];

  return [
    ...new Set(
      [...defaults, ...colours]
        .map(resolveProductImage)
        .filter(Boolean),
    ),
  ];
}

export function categoryCards(products = []) {
  const groups = new Map();

  const catalogue = Array.isArray(products)
    ? products
    : [];

  for (const product of catalogue) {
    if (
      !product ||
      product.isActive === false ||
      !(product.id ?? product._id) ||
      !product.name ||
      typeof product.category !== "string" ||
      !product.category.trim()
    ) {
      continue;
    }

    const name = product.category.trim();

    if (!groups.has(name)) {
      groups.set(name, []);
    }

    groups.get(name).push(product);
  }

  const names = [
    ...new Set([
      ...categories
        .map((category) => category.name)
        .filter((name) => groups.has(name)),

      ...groups.keys(),
    ]),
  ];

  return names.map((name) => {
    const items = groups.get(name);

    const available = items.filter(
      (product) =>
        inStock(product) &&
        product.delivery?.available !== false,
    );

    const remaining = items.filter(
      (product) => !available.includes(product),
    );

    const galleries = [
      ...available,
      ...remaining,
    ].map(categoryPhotos);

    // Show different products before additional views.
    const images = [
      ...new Set([
        ...galleries
          .map((photos) => photos[0])
          .filter(Boolean),

        ...galleries.flatMap((photos) =>
          photos.slice(1),
        ),
      ]),
    ].slice(0, 12);

    const discount = Math.max(
      0,
      ...available
        .filter(
          (product) => priceDetails(product).valid,
        )
        .map(
          (product) =>
            priceDetails(product).discount,
        ),
    );

    return {
      name,

      images,

      icon: images[0] || "",

      offer: discount
        ? `UP TO ${discount}% OFF`
        : "SHOP THE EDIT",

      outOfStock: items.every(
        (product) => !inStock(product),
      ),
    };
  });
}

export default function CategorySection() {
  const { products, loading, error } = useCatalog();
  const cards = categoryCards(products);
  const ordered = [...cards].sort((a,b) => {
    const stock = name => products.filter(p => p.category === name).reduce((sum,p) => sum + Number(p.stock || 0),0);
    return stock(b.name) - stock(a.name);
  });
  const picks = [];
  for (const department of ['workout','workout','shoes','accessories','hydration','supplements']) {
    const next = ordered.find(c => !picks.includes(c) && productDepartment({category:c.name}) === department);
    if (next) picks.push(next);
  }
  for (const card of ordered) if (picks.length < 6 && !picks.includes(card)) picks.push(card);
  if (!cards.length && !loading && !error) return null;
  return <section className="gm-section gm-categories" id="categories" aria-labelledby="gm-category-title">
    <div className="gm-section-head"><h2 id="gm-category-title">Shop by category</h2><TextLink to="/shop">Shop all</TextLink></div>
    {!cards.length ? <p className="muted" role="status">{error ? "Categories are temporarily unavailable." : "Loading collections…"}</p> : <div className="gm-category-grid">{picks.map(category => <CategoryCard key={category.name} {...category} offer="" autoRotate={false} minimal />)}</div>}
    {cards.length > picks.length && <details className="category-directory"><summary>Explore all {cards.length} categories</summary><nav aria-label="All product categories">{cards.map(c => <Link to={categoryPath(c.name)} key={c.name}>{c.name}</Link>)}</nav></details>}
  </section>;
}
