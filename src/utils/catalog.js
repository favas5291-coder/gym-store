import { reviewStats } from "./reviews.js";

import {
  getDiscountedPrice,
  getDiscountPercentage,
  number,
} from "./productPricing.js";

import {
  getTotalStock,
  getVariantStock,
} from "./cartUtils.js";

export const SHOP_DEPARTMENTS = Object.freeze(
  [
    {
      id: "workout",
      label: "WORKOUT",
      title: "Workout clothing",
      accent: "#f97316",
    },
    {
      id: "shoes",
      label: "SHOES",
      title: "Shoes",
      accent: "#2563eb",
    },
    {
      id: "accessories",
      label: "ACCESSORIES",
      title: "Accessories",
      accent: "#9333ea",
    },
    {
      id: "hydration",
      label: "HYDRATION",
      title: "Hydration",
      accent: "#0891b2",
    },
    {
      id: "supplements",
      label: "SUPPLEMENTS",
      title: "Supplements",
      accent: "#16a34a",
    },
  ].map((department) => Object.freeze(department)),
);

function text(value) {
  return ["string", "number"].includes(typeof value)
    ? String(value).trim()
    : "";
}

export function normalizeCatalogText(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:t shirts?|tshirts?|tees?)\b/g, "tshirt")
    .replace(/\btrainers?\b/g, "shoes")
    .replace(/\s+/g, " ")
    .trim();
}

function values(value) {
  return (Array.isArray(value) ? value : [])
    .map(text)
    .filter(Boolean);
}

export function catalogProducts(catalogue) {
  return (Array.isArray(catalogue) ? catalogue : []).filter(
    (product) =>
      product &&
      typeof product === "object" &&
      !Array.isArray(product) &&
      product.isActive !== false,
  );
}

// Classify saved categories, never words in marketing descriptions.
export function productDepartment(product) {
  const category = normalizeCatalogText(product?.category);

  if (!category) return "";

  if (
    /\b(hydration|bottles?|shakers?|tumblers?|flasks?)\b/.test(
      category,
    )
  ) {
    return "hydration";
  }

  if (/\b(shoes?|footwear|sneakers?)\b/.test(category)) {
    return "shoes";
  }

  if (
    /\b(supplements?|nutrition|proteins?|whey|creatine|gainers?|bcaa|eaa|amino|electrolytes?|vitamins?|multivitamins?|omega3?|fish ?oil|pre ?workout|post ?workout|energy bars?|meal replacements?)\b/.test(
      category,
    )
  ) {
    return "supplements";
  }

  if (
    /\b(accessories|accessory|bags?|duffels?|duffles?|backpacks?|socks?|towels?|headphones?|earphones?|earbuds?|gloves?|belts?|straps?|wraps?|bands?|mats?|ropes?|rollers?|deodorants?|antiperspirants?|personal care|grooming)\b/.test(
      category,
    )
  ) {
    return "accessories";
  }

  if (
    /\b(workout|clothes|clothing|apparel|activewear|sportswear|gym wear|tshirt|shirts?|compression|pants?|joggers?|shorts?|leggings?|bras?|tights?|tanks?|vests?|hoodies?|sweatshirts?|tracksuits?)\b/.test(
      category,
    )
  ) {
    return "workout";
  }

  return "";
}

const CATEGORY_PARENTS = Object.freeze({
  workout: "workout",
  "workout clothes": "workout",
  "workout clothing": "workout",
  clothing: "workout",
  clothes: "workout",
  apparel: "workout",
  activewear: "workout",
  sportswear: "workout",
  "gym wear": "workout",

  shoes: "shoes",
  "gym shoes": "shoes",
  footwear: "shoes",

  accessories: "accessories",
  "gym accessories": "accessories",

  hydration: "hydration",

  supplements: "supplements",
  nutrition: "supplements",
  "fitness nutrition": "supplements",
});

export function matchesCategory(product, selected) {
  const requested = normalizeCatalogText(selected);
  const category = normalizeCatalogText(product?.category);

  if (!requested || category === requested) {
    return true;
  }

  const parent = CATEGORY_PARENTS[requested];

  if (typeof parent === "string") {
    return productDepartment(product) === parent;
  }

  if (requested === "tshirt") {
    return matchesSubcategory(product, selected);
  }

  if (requested === "socks") {
    return (
      productDepartment(product) === "accessories" &&
      /\bsocks?\b/.test(category)
    );
  }

  if (requested === "gym towels") {
    return (
      productDepartment(product) === "accessories" &&
      /\btowels?\b/.test(category)
    );
  }

  if (requested === "shaker bottles") {
    return (
      productDepartment(product) === "hydration" &&
      /\bshakers?\b/.test(category)
    );
  }

  if (requested === "water bottles") {
    return (
      productDepartment(product) === "hydration" &&
      /\b(bottles?|tumblers?|flasks?)\b/.test(category) &&
      !/\bshakers?\b/.test(category)
    );
  }

  return (
    requested === "protein" &&
    productDepartment(product) === "supplements" &&
    /\b(proteins?|whey)\b/.test(category)
  );
}

export function matchesSubcategory(product, selected) {
  const requested = normalizeCatalogText(selected);

  if (!requested) return true;

  const category = normalizeCatalogText(product?.category);

  if (
    normalizeCatalogText(product?.subcategory) === requested ||
    category === requested
  ) {
    return true;
  }

  // Keep old T-Shirts URLs working when the type is saved as category.
  return (
    requested === "tshirt" &&
    productDepartment(product) === "workout" &&
    /\btshirt\b/.test(category)
  );
}

export function catalogOptions(
  catalogue,
  field,
  selected = [],
) {
  const options = new Map();

  for (const product of catalogProducts(catalogue)) {
    const choices = Array.isArray(product[field])
      ? values(product[field])
      : [text(product[field])];

    for (const value of choices) {
      const key = normalizeCatalogText(value);

      if (key && !options.has(key)) {
        options.set(key, value);
      }
    }
  }

  for (const value of values(selected)) {
    const key = normalizeCatalogText(value);

    if (key && !options.has(key)) {
      options.set(key, value);
    }
  }

  return [...options.values()].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function matchesSearch(product, query) {
  if (
    !product ||
    typeof product !== "object" ||
    Array.isArray(product)
  ) {
    return false;
  }

  const queryText = normalizeCatalogText(query);

  if (!queryText) return true;

  if (["bestseller", "bestsellers"].includes(queryText)) {
    return Boolean(product.isBestSeller);
  }

  if (["new", "new arrivals"].includes(queryText)) {
    return Boolean(product.isNew ?? product.isNewArrival);
  }

  if (["trending", "featured"].includes(queryText)) {
    return Boolean(product.isFeatured);
  }

  if (queryText === "top rated") {
    return reviewStats(product).rating >= 4;
  }

  const haystack = normalizeCatalogText(
    [
      product.name,
      product.category,
      product.subcategory,
      product.brand,
      product.description,
      product.material,
      product.gender,
      product.badge,
      ...values(product.tags),
      ...values(product.colors),
      ...values(product.sizes),
    ]
      .map(text)
      .join(" "),
  );

  return queryText
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function filterProducts(
  catalogue,
  parameters = new URLSearchParams(),
) {
  const params =
    typeof parameters?.get === "function"
      ? parameters
      : new URLSearchParams(parameters || "");

  const selected = (key) =>
    String(params.get(key) || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const categories = selected("category");
  const sizes = selected("size");
  const colors = selected("color");

  const collection = params.get("collection");
  const department = params.get("department");
  const availability = params.get("availability");

  const same = (a, b) =>
    normalizeCatalogText(a) === normalizeCatalogText(b);

  const contains = (choices, value) =>
    !choices.length ||
    choices.some((choice) => same(choice, value));

  const result = catalogProducts(catalogue).filter(
    (product) => {
      const price = getDiscountedPrice(product);

      if (
        department &&
        productDepartment(product) !== department
      ) {
        return false;
      }

      if (!matchesSearch(product, params.get("search"))) {
        return false;
      }

      if (
        categories.length &&
        !categories.some((category) =>
          matchesCategory(product, category),
        )
      ) {
        return false;
      }

      if (
        !matchesSubcategory(
          product,
          params.get("subcategory"),
        )
      ) {
        return false;
      }

      if (
        collection &&
        !(
          (collection === "featured" &&
            product.isFeatured) ||
          (collection === "bestsellers" &&
            product.isBestSeller) ||
          (collection === "new" &&
            (product.isNew ?? product.isNewArrival))
        )
      ) {
        return false;
      }

      if (
        !contains(selected("gender"), product.gender) ||
        !contains(selected("brand"), product.brand)
      ) {
        return false;
      }

      const productSizes = values(product.sizes);
      const productColors = values(product.colors);

      if (
        sizes.length &&
        !productSizes.some((size) => contains(sizes, size))
      ) {
        return false;
      }

      if (
        colors.length &&
        !productColors.some((color) =>
          contains(colors, color),
        )
      ) {
        return false;
      }

      if (
        params.get("minPrice") &&
        price < number(params.get("minPrice"))
      ) {
        return false;
      }

      if (
        params.get("maxPrice") &&
        price > number(params.get("maxPrice"), Infinity)
      ) {
        return false;
      }

      if (
        params.get("rating") &&
        reviewStats(product).rating <
          number(params.get("rating"))
      ) {
        return false;
      }

      if (
        params.get("discount") &&
        getDiscountPercentage(product) <
          number(params.get("discount"))
      ) {
        return false;
      }

      if (availability === "in-stock") {
        if (getTotalStock(product) <= 0) {
          return false;
        }

        if (sizes.length || colors.length) {
          const availableSizes = productSizes.length
            ? productSizes.filter((size) =>
                contains(sizes, size),
              )
            : [null];

          const availableColors = productColors.length
            ? productColors.filter((color) =>
                contains(colors, color),
              )
            : [null];

          const combinationAvailable =
            availableColors.some((color) =>
              availableSizes.some(
                (size) =>
                  getVariantStock(product, size, color) > 0,
              ),
            );

          if (!combinationAvailable) {
            return false;
          }
        }
      } else if (availability === "out-of-stock") {
        if (getTotalStock(product) > 0) {
          return false;
        }
      } else if (availability) {
        return false;
      }

      return true;
    },
  );

  const comparators = {
    "price-low": (a, b) =>
      getDiscountedPrice(a) - getDiscountedPrice(b),

    "price-high": (a, b) =>
      getDiscountedPrice(b) - getDiscountedPrice(a),

    rating: (a, b) =>
      reviewStats(b).rating - reviewStats(a).rating,

    discount: (a, b) =>
      getDiscountPercentage(b) -
      getDiscountPercentage(a),

    newest: (a, b) =>
      Number(Boolean(b.isNew ?? b.isNewArrival)) -
      Number(Boolean(a.isNew ?? a.isNewArrival)),

    bestseller: (a, b) =>
      Number(Boolean(b.isBestSeller)) -
      Number(Boolean(a.isBestSeller)),
  };

  const recommended = (a, b) =>
    Number(getTotalStock(b) > 0) -
      Number(getTotalStock(a) > 0) ||
    Number(Boolean(b.isFeatured)) -
      Number(Boolean(a.isFeatured));

  const sort = Object.prototype.hasOwnProperty.call(
    comparators,
    params.get("sort"),
  )
    ? comparators[params.get("sort")]
    : recommended;

  return result.sort(sort);
}