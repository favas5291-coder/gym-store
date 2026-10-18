import { getTotalStock } from "./cartUtils.js";
import { getDiscountedPrice } from "./productPricing.js";
import { calculateShipping } from "./orderCalculations.js";

import {
  productPriceAvailable,
  productReference,
} from "./productPurchase.js";

export const FITNESS_GOALS = [
  ["gain-weight", "Gain weight"],
  ["build-muscle", "Build muscle"],
  ["lose-fat", "Lose fat / cut"],
  ["strength", "Improve strength"],
  ["stamina", "Improve stamina"],
  ["general-fitness", "General fitness"],
  ["browsing", "Just browsing"],
];

const GOAL_TAGS = {
  "gain-weight": ["gain-weight", "weight-gain"],
  "build-muscle": [
    "build-muscle",
    "muscle-building",
    "muscle-gain",
  ],
  "lose-fat": ["lose-fat", "fat-loss", "cut"],
  strength: ["strength", "strength-training"],
  stamina: ["stamina", "endurance"],
  "general-fitness": ["general-fitness"],
};

export function parseShoppingBudget(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return {
      paise: null,
      error: "",
    };
  }

  const amount = Number(text);
  const paise = Math.round(amount * 100);

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(text) ||
    !Number.isSafeInteger(paise) ||
    amount < 1 ||
    amount > 1000000
  ) {
    return {
      paise: null,
      error:
        "Enter ₹1 to ₹10,00,000, with up to two decimal places, or choose No fixed budget.",
    };
  }

  return {
    paise,
    error: "",
  };
}

export function assistantRoute(pathname) {
  const path =
    String(pathname || "/").replace(/\/+$/, "") || "/";

  return /^(?:\/|\/shop|\/offers|\/product\/[^/]+|\/kits(?:\/[^/]+)?)$/.test(
    path,
  );
}

export function createGuideSession(getStorage) {
  const key = "gymdrobe-fitness-guide-seen-v1";

  let shown = false;
  let elapsed = 0;

  function seen() {
    if (shown) {
      return true;
    }

    try {
      return getStorage().getItem(key) === "1";
    } catch {
      return true;
    }
  }

  function dismiss() {
    shown = true;

    try {
      getStorage().setItem(key, "1");
    } catch {
      // Manual access remains available.
    }
  }

  return {
    seen,
    dismiss,

    advance(milliseconds) {
      if (seen()) {
        return false;
      }

      if (
        Number.isFinite(milliseconds) &&
        milliseconds > 0
      ) {
        elapsed += Math.min(1000, milliseconds);
      }

      return elapsed >= 10000;
    },

    claim() {
      if (seen()) {
        return false;
      }

      // Avoid repeated automatic prompts when storage is blocked.
      try {
        getStorage().setItem(key, "1");
      } catch {
        shown = true;
        return false;
      }

      shown = true;
      return true;
    },
  };
}

function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^goal\s*:\s*/, "")
    .replace(/[\s_]+/g, "-");
}

function supplementProduct(product) {
  const category =
    `${product.category || ""} ${product.subcategory || ""}`;

  return (
    /supplement|nutrition|\bprotein\b|\bcreatine\b|\bvitamin|\bbcaa\b|\beaa\b/i.test(
      category,
    ) ||
    /\bwhey\b|\bcreatine\b|pre[ -]?workout|mass[ -]?gainer|protein powder|multivitamin/i.test(
      product.name || "",
    )
  );
}

export function recommendationProductAvailable(product) {
  return Boolean(
    product &&
      String(productReference(product)).trim() &&
      typeof product.name === "string" &&
      product.name.trim() &&
      product.isActive !== false &&
      product.isPublished !== false &&
      (!product.status ||
        ["published", "active"].includes(product.status)) &&
      (!product.publicationStatus ||
        product.publicationStatus === "published") &&
      product.delivery?.available !== false &&
      productPriceAvailable(product) &&
      Number.isSafeInteger(
        Math.round(getDiscountedPrice(product) * 100),
      ) &&
      getTotalStock(product) > 0,
  );
}

export function availableGuideCategories(products = []) {
  const counts = new Map();

  for (const product of products) {
    const category =
      typeof product?.category === "string"
        ? product.category.trim()
        : "";

    if (
      category &&
      recommendationProductAvailable(product)
    ) {
      counts.set(
        category,
        (counts.get(category) || 0) + 1,
      );
    }
  }

  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({
      name,
      count,
    }));
}

export function selectionEstimate(
  subtotalPaise,
  count = 1,
) {
  const shippingPaise = count
    ? Math.round(
        calculateShipping(subtotalPaise / 100) * 100,
      )
    : 0;

  return {
    subtotalPaise,
    shippingPaise,
    totalPaise: subtotalPaise + shippingPaise,
  };
}

export function recommendFitnessProducts(
  products = [],
  answers = {},
) {
  const parsed = parseShoppingBudget(answers.budget);

  const categories = Array.isArray(answers.categories)
    ? answers.categories
    : [];

  const combined = answers.kit === true;
  const seen = new Set();

  const pool = parsed.error
    ? []
    : products
        .filter((product) => {
          if (!recommendationProductAvailable(product)) {
            return false;
          }

          const id = String(productReference(product));

          if (seen.has(id)) {
            return false;
          }

          seen.add(id);

          const category = String(
            product.category || "",
          ).trim();

          if (
            categories.length &&
            !categories.includes(category)
          ) {
            return false;
          }

          // A fitness goal alone never opts into supplements.
          return (
            !supplementProduct(product) ||
            categories.includes(category)
          );
        })
        .map((product) => {
          const pricePaise = Math.round(
            getDiscountedPrice(product) * 100,
          );

          const tags = Array.isArray(product.tags)
            ? product.tags.map(normalizeTag)
            : [];

          const goalMatched = (
            GOAL_TAGS[answers.goal] || []
          ).some((tag) => tags.includes(tag));

          const category = String(
            product.category || "",
          ).trim();

          const goalLabel = FITNESS_GOALS.find(
            ([key]) => key === answers.goal,
          )?.[1];

          return {
            product,
            pricePaise,
            category,
            goalMatched,
            estimate: selectionEstimate(pricePaise),

            reason: [
              categories.includes(category)
                ? `Matches your ${category} choice.`
                : category
                  ? `An available ${category} option.`
                  : "An available store product.",

              goalMatched
                ? `Store goal tag: ${goalLabel}.`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          };
        });

  const within = (value) =>
    parsed.paise == null || value <= parsed.paise;

  let rows;

  if (combined) {
    const usedCategories = new Set();

    let subtotal = 0;
    rows = [];

    // Select up to four affordable products from distinct categories.
    // Goal tags break price ties; needs and total budget come first.
    const sorted = [...pool].sort(
      (a, b) =>
        a.pricePaise - b.pricePaise ||
        Number(b.goalMatched) - Number(a.goalMatched) ||
        a.product.name.localeCompare(b.product.name),
    );

    for (const row of sorted) {
      if (rows.length >= 4) {
        break;
      }

      if (usedCategories.has(row.category)) {
        continue;
      }

      const estimate = selectionEstimate(
        subtotal + row.pricePaise,
      );

      if (!within(estimate.totalPaise)) {
        continue;
      }

      rows.push(row);
      subtotal += row.pricePaise;
      usedCategories.add(row.category);
    }
  } else {
    rows = pool
      .filter((row) =>
        within(
          selectionEstimate(row.pricePaise).totalPaise,
        ),
      )
      .sort(
        (a, b) =>
          Number(b.goalMatched) -
            Number(a.goalMatched) ||
          a.pricePaise - b.pricePaise ||
          a.product.name.localeCompare(b.product.name),
      )
      .slice(0, 4);
  }

  const subtotal = rows.reduce(
    (sum, row) => sum + row.pricePaise,
    0,
  );

  return {
    rows,
    combined,
    budgetPaise: parsed.paise,
    error: parsed.error,

    estimate: combined
      ? selectionEstimate(subtotal, rows.length)
      : null,

    goalMatched: rows.some((row) => row.goalMatched),
  };
}