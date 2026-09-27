import { reviewStats } from "./reviews.js";
import {
  getDiscountedPrice,
  getDiscountPercentage,
  number,
} from "./productPricing.js";
import { getTotalStock, getVariantStock } from "./cartUtils.js";

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const SEARCH_ALIASES = {
  tee: ["tee", "t-shirt", "t shirt", "tshirt", "shirt"],
  trainer: ["trainer", "trainers", "shoe", "shoes", "sneaker", "sneakers"],
};

function searchVariants(query) {
  const text = normalize(query);
  if (!text) return [""];

  const variants = new Set([text, text.replace(/\s+/g, ""), text.replace(/\s+/g, "-")]);
  for (const term of text.split(/\s+/)) {
    variants.add(term);
    for (const [key, values] of Object.entries(SEARCH_ALIASES)) {
      if (key === term || values.includes(term)) {
        values.forEach((value) => variants.add(value));
      }
    }
  }
  return [...variants];
}

export function matchesSearch(product, query) {
  const text = normalize(query);
  if (!text) return true;
  if (["bestseller", "bestsellers"].includes(text))
    return Boolean(product.isBestSeller);
  if (["new", "new arrivals"].includes(text)) return Boolean(product.isNew);
  if (text === "top rated") return reviewStats(product).rating >= 4;

  const haystack = normalize(
    [
      product.name,
      product.category,
      product.subcategory,
      product.brand,
      product.description,
      product.material,
      product.gender,
      product.badge,
      ...(product.tags || []),
      ...(product.colors || []),
      ...(product.sizes || []),
    ].join(" "),
  );

  return searchVariants(text).every((term) => {
    if (!term) return true;
    const matches = [term, ...SEARCH_ALIASES[term] || []];
    return matches.some((variant) => haystack.includes(variant));
  });
}
export function filterProducts(catalogue, params) {
  const selected = (key) => (params.get(key) || "").split(",").filter(Boolean);
  const collection = params.get("collection"),
    category = selected("category"),
    sub = params.get("subcategory");
  let result = catalogue.filter((product) => {
    const price = getDiscountedPrice(product);
    return (
      matchesSearch(product, params.get("search")) &&
      (!category.length || category.includes(product.category)) &&
      (!sub || product.subcategory === sub) &&
      (!collection ||
        (collection === "featured" && product.isFeatured) ||
        (collection === "bestsellers" && product.isBestSeller) ||
        (collection === "new" && product.isNew)) &&
      (!selected("gender").length ||
        selected("gender").includes(product.gender)) &&
      (!selected("brand").length ||
        selected("brand").includes(product.brand)) &&
      (!selected("size").length ||
        selected("size").some((size) =>
          (product.sizes || []).map(String).includes(size),
        )) &&
      (!selected("color").length ||
        selected("color").some((color) =>
          (product.colors || []).includes(color),
        )) &&
      (!params.get("minPrice") || price >= number(params.get("minPrice"))) &&
      (!params.get("maxPrice") ||
        price <= number(params.get("maxPrice"), Infinity)) &&
      (!params.get("rating") ||
        reviewStats(product).rating >= number(params.get("rating"))) &&
      (!params.get("discount") ||
        getDiscountPercentage(product) >= number(params.get("discount"))) &&
      (!(
        params.get("availability") === "in-stock" &&
        (selected("size").length || selected("color").length)
      ) ||
        (selected("color").length
          ? selected("color")
          : product.colors?.length
            ? product.colors
            : [null]
        ).some((color) =>
          (selected("size").length
            ? selected("size")
            : product.sizes?.length
              ? product.sizes
              : [null]
          ).some((size) => getVariantStock(product, size, color) > 0),
        )) &&
      (!params.get("availability") ||
        (params.get("availability") === "in-stock"
          ? getTotalStock(product) > 0
          : getTotalStock(product) === 0))
    );
  });
  const comparators = {
    "price-low": (a, b) => getDiscountedPrice(a) - getDiscountedPrice(b),
    "price-high": (a, b) => getDiscountedPrice(b) - getDiscountedPrice(a),
    rating: (a, b) => reviewStats(b).rating - reviewStats(a).rating,
    discount: (a, b) => getDiscountPercentage(b) - getDiscountPercentage(a),
    newest: (a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)),
    bestseller: (a, b) =>
      Number(Boolean(b.isBestSeller)) - Number(Boolean(a.isBestSeller)),
  };
  const recommended = (a, b) =>
    Number(getTotalStock(b) > 0) - Number(getTotalStock(a) > 0) ||
    Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
  return result.sort(comparators[params.get("sort")] || recommended);
}