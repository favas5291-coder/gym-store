import { normalizeCatalogText } from "./catalog.js";

export const STOREFRONT_COLLECTIONS = {
  "/collections/compression-t-shirts": {
    category: "Compression T-shirt",
    heading: "Compression T-shirts",
    title: "Shop Compression T-Shirts for Gym Training | GymDrobe",
    description: "Explore compression T-shirts for gym training. Compare available colours and sizes, and check each product page for fit and fabric details.",
  },
  "/collections/gym-joggers": {
    category: "Joggers",
    heading: "Gym joggers and track pants",
    title: "Shop Gym Joggers & Track Pants | GymDrobe",
    description: "Browse gym joggers and track pants, including straight-leg and baggy fits. Compare colours, size options and product details.",
  },
  "/collections/gym-bags": {
    category: "BAG",
    heading: "Gym bags",
    title: "Shop Gym Bags & Training Duffels | GymDrobe",
    description: "Shop gym bags and sports duffels. Compare bag sizes and product details to find room for the kit you carry to training.",
  },
};

export function collectionPathForCategory(category) {
  const name = normalizeCatalogText(category);
  return Object.keys(STOREFRONT_COLLECTIONS).find(
    path => normalizeCatalogText(STOREFRONT_COLLECTIONS[path].category) === name,
  );
}

export function collectionMatchesProduct(collection, product) {
  return Boolean(product && product.isActive !== false &&
    normalizeCatalogText(product.category) === normalizeCatalogText(collection.category));
}

export function collectionBreadcrumbs(origin, path, collection) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin + "/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: origin + "/shop" },
      { "@type": "ListItem", position: 3, name: collection.heading, item: origin + path },
    ],
  };
}
