import clothingPhoto from "../assets/tshirt.jpg";
import accessoriesPhoto from "../assets/shaker.jpg";
import essentialsPhoto from "../assets/Towel.jpg";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import categories from "../data/categories.js";

import { useCatalog } from "../context/CatalogContext.jsx";

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

const featuredCategories = [
  { name: "Workout Clothing", department: "workout", fallback: clothingPhoto, to: "/shop?department=workout" },
  { name: "Accessories", department: "accessories", fallback: accessoriesPhoto, to: "/shop?department=accessories" },
  { name: "Starter Essentials", department: "hydration", fallback: essentialsPhoto, to: "/kits" },
];

export function HomeCategoryLinks() {
  return (
    <nav className="home-category-links" aria-label="Shop categories">
      {featuredCategories.map(({ name, to }) => <Link key={to} to={to}>{name}</Link>)}
    </nav>
  );
}

export default function CategorySection() {
  const { products, loading, error } = useCatalog();
  const cards = useMemo(() => categoryCards(products), [products]);

  return <section className="gm-section gm-categories" id="categories" aria-labelledby="home-category-title">
    <h2 className="home-category-title" id="home-category-title">Shop by category</h2>
    <div className="theme-category-grid">
      {featuredCategories.map(({ name, department, to, fallback }) => {
        const photo = cards.find(card => card.icon && productDepartment({ category: card.name }) === department)?.icon || fallback;
        return <Link key={name} to={to} className="theme-category">
          <img src={photo} alt="" loading="lazy" width="420" height="250" />
          <span>{name}</span>
        </Link>;
      })}
    </div>
    {loading && <p className="muted" role="status">Loading collections…</p>}
    {error && <p className="muted" role="status">Some collections are temporarily unavailable.</p>}
    {cards.length > 0 && <details className="category-directory"><summary>Explore all {cards.length} categories</summary><nav aria-label="All product categories">{cards.map(card => <Link to={categoryPath(card.name)} key={card.name}>{card.name}</Link>)}</nav></details>}
  </section>;
}
