import categories from "../data/categories.js";

import { useCatalog } from "../context/CatalogContext.jsx";

import CategoryCard from "./CategoryCard.jsx";

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

    const images = [
      ...new Set(
        [...available, ...remaining]
          .flatMap(categoryPhotos),
      ),
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
  const {
    products,
    loading,
    error,
  } = useCatalog();

  const cards = categoryCards(products);

  if (
    !cards.length &&
    !loading &&
    !error
  ) {
    return null;
  }

  return (
    <section
      className="gm-section gm-categories"
      id="categories"
      aria-labelledby="gm-category-title"
    >
      <div className="gm-section-head">
        <h2 id="gm-category-title">
          SHOP BY CATEGORY
        </h2>
      </div>

      {!cards.length ? (
        <p className="muted" role="status">
          {error
            ? "Categories could not be loaded. Please try again shortly."
            : "Loading product categories…"}
        </p>
      ) : (
        <div className="gm-category-grid">
          {cards.map((category) => (
            <CategoryCard
              key={category.name}
              {...category}
            />
          ))}
        </div>
      )}
    </section>
  );
}