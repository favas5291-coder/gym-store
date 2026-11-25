/**
 * Catalogue-aware, bounded on-device search for the public product list.
 * No network request or private supplier fields are needed for suggestions.
 * Alias terms only resolve when a matching published catalogue term exists.
 */

import { getDiscountedPrice } from "./productPricing.js";
import { optionLabels } from "./productInformation.js";
import { getVariantStock } from "./cartUtils.js";

const SYNONYMS = Object.freeze({
  tshirt: ["tee", "tees", "shirt", "shirts", "tshirts", "teeshirt", "jersey", "trainingtop"],
  shoes: ["shoe", "footwear", "sneaker", "sneakers", "trainer", "trainers"],
  joggers: ["jogger", "trackpants", "trackpant", "workoutpants"],
  leggings: ["legging", "tights"],
  compression: ["compressions"],
  protein: ["proteins"],
  creatine: ["creatines"],
  dumbbell: ["dumbbells", "dumbell", "dumbells"],
  gloves: ["glove"],
  bag: ["bags", "duffel", "duffle", "backpack"],
  bottle: ["bottles", "flask", "flasks"],
  shaker: ["shakers"],
  resistance: ["resistant"],
  bands: ["band"],
  lifting: ["lift"],
  shorts: ["short"],
  supplements: ["supplement"],
  women: ["woman", "womens", "female"],
  men: ["man", "mens", "male"],
});

// Common verified-looking typos are hints; the catalogue is still the source
// of truth. These are not hardcoded search results.
const TYPOS = Object.freeze({
  protien: "protein", protine: "protein", shooes: "shoes",
  compresion: "compression", creatin: "creatine",
  glovs: "gloves", joger: "joggers", jogers: "joggers", beg: "bag",
  resitance: "resistance", dumbel: "dumbbell",
});

const CANONICAL = new Map(
  Object.entries(SYNONYMS).flatMap(([head, variants]) =>
    [head, ...variants].map((variant) => [variant, head]),
  ),
);
const STOP = new Set(["a", "an", "and", "for", "from", "in", "my", "of", "the", "to", "with"]);
const GENDERS = new Set(["men", "women", "unisex"]);

// Narrow shopping-intent rewrites. These select product vocabulary, never
// create products or claim a product meets a medical/fitness outcome.
const INTENTS = Object.freeze({
  "protein for muscle": "protein",
  "shirt for gym": "tshirt",
  "weight lifting belt": "lifting belt",
  "hand protection gym": "gloves",
  "gym hand cover": "gloves",
  "workout pant": "joggers",
  "gym bottle": "bottle",
  "running footwear": "shoes",
  "workout equipment for home": "equipment",
});

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\b(men|women)['’]s\b/g, "$1s").replace(/[^a-z0-9]+/g, " ")
    .replace(/\bt\s*shirts?\b/g, "tshirt")
    .replace(/\bt\s+(s|sh|shi|shir)\b/g, "t$1")
    .replace(/\s+/g, " ").trim();
}

function words(value) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function canonical(word) {
  return CANONICAL.get(word) || word;
}

function significant(value) {
  const tokens = words(value).slice(0, 10).filter((word) => !STOP.has(word));
  return tokens.length > 1 ? tokens.filter((word) => word !== "gym") : tokens;
}

function distance(a, b, maximum = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maximum) return maximum + 1;
  // Optimal-string-alignment distance catches adjacent transpositions.
  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let low = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = Number(a[i - 1] !== b[j - 1]);
      let best = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, matrix[i - 2][j - 2] + 1);
      }
      matrix[i][j] = best;
      low = Math.min(low, best);
    }
    if (low > maximum && i > b.length + maximum) return maximum + 1;
  }
  return matrix[a.length][b.length];
}

function field(value) {
  const normalized = normalizeSearchText(Array.isArray(value) ? value.join(" ") : value);
  const tokens = new Set(words(normalized).map(canonical));
  return { normalized, tokens };
}

function entry(product) {
  return {
    product,
    name: field(product.name),
    brand: field(product.brand),
    category: field(product.category),
    subcategory: field(product.subcategory),
    gender: field(product.gender),
    colors: field(product.colors),
    sizes: field(product.sizes),
    aliases: field(product.searchAliases),
    tags: field(product.tags),
    description: field(product.description),
  };
}

export function createSearchIndex(products) {
  const entries = (Array.isArray(products) ? products : [])
    .filter((product) => product && typeof product === "object" &&
      !Array.isArray(product) && product.isActive !== false)
    .map(entry);
  const vocabulary = new Set();
  const colors = new Set();
  const sizes = new Set();
  for (const item of entries) {
    for (const key of ["name", "brand", "category", "subcategory", "aliases", "tags", "gender", "colors", "sizes"]) {
      for (const token of item[key].tokens) vocabulary.add(token);
    }
    // Use complete catalogue options for constraints. "PUMA Black" is a
    // colour, but "PUMA" alone is a brand. Flavours are searchable separately.
    const labels = optionLabels(item.product);
    if (labels.color === "Colour" && Array.isArray(item.product.colors)) {
      for (const color of item.product.colors) colors.add(normalizeSearchText(color));
    }
    if (labels.size === "Size" && Array.isArray(item.product.sizes)) {
      for (const size of item.product.sizes) sizes.add(normalizeSearchText(size));
    }
  }
  return { entries, vocabulary: [...vocabulary].slice(0, 10000), vocabularySet: vocabulary, colors, sizes };
}

// Catalogue context publishes a new array on refresh. Keep the built index
// across search panel closes, while letting superseded catalogues be collected.
const catalogueIndexes = new WeakMap();
export function indexForCatalogue(products) {
  if (!Array.isArray(products)) return createSearchIndex([]);
  if (!catalogueIndexes.has(products)) catalogueIndexes.set(products, createSearchIndex(products));
  return catalogueIndexes.get(products);
}

function resolveTokens(index, query, strict) {
  const original = significant(INTENTS[normalizeSearchText(query)] || query);
  let changed = false;
  let ambiguous = false;
  const corrected = [];
  const tokens = original.map((token) => {
    const equivalent = canonical(token);
    if (index.vocabularySet.has(equivalent)) {
      corrected.push(token);
      return equivalent;
    }
    if (strict || GENDERS.has(equivalent)) {
      corrected.push(token);
      return equivalent;
    }
    // A partial word is deliberate typing, not a spelling error.
    if (equivalent.length >= 2 &&
      index.vocabulary.some((candidate) => candidate.startsWith(equivalent))) {
      corrected.push(token);
      return equivalent;
    }
    const known = TYPOS[token];
    if (known && index.vocabularySet.has(canonical(known))) {
      changed = true;
      corrected.push(known);
      return canonical(known);
    }
    const max = equivalent.length >= 6 ? 2 : equivalent.length >= 4 ? 1 : 0;
    if (!max) {
      corrected.push(token);
      return equivalent;
    }
    let closest = null;
    let best = max + 1;
    let ties = 0;
    for (const candidate of index.vocabulary) {
      if (Math.abs(candidate.length - equivalent.length) > max) continue;
      if (candidate[0] !== equivalent[0]) continue;
      const d = distance(equivalent, candidate, max);
      if (d < best) { best = d; closest = candidate; ties = 1; }
      else if (d === best) ties++;
    }
    if (closest && best <= max && ties === 1) {
      changed = true;
      corrected.push(closest);
      return closest;
    }
    if (ties > 1 && best <= max) ambiguous = true;
    corrected.push(token);
    return equivalent;
  });
  return {
    tokens, changed, ambiguous,
    // Only show a correction for an actual typo, never for a harmless synonym.
    correctedQuery: changed ? corrected.join(" ") : "",
  };
}

function tokenScore(fieldData, token, weight, minimumPrefix = 2) {
  if (fieldData.tokens.has(token)) return weight;
  // A complete department or product type is not a partial word: "bag"
  // must never return "baggy joggers".
  if (token.length >= minimumPrefix && !Object.hasOwn(SYNONYMS, token)) {
    for (const value of fieldData.tokens) {
      if (value.startsWith(token)) return Math.floor(weight * 0.65);
    }
  }
  return 0;
}

function score(item, terms, queryText, originalQuery, index) {
  if (!terms.length) return 1;
  let total = 0;
  for (const token of terms) {
    let attribute;
    if (GENDERS.has(token)) attribute = item.gender;
    else if (index.colors.has(token)) attribute = item.colors;
    else if (index.sizes.has(token)) attribute = item.sizes;
    if (attribute?.tokens.size && !attribute.tokens.has(token)) return 0;
    // Descriptions often mention other equipment, e.g. a shaker that fits a gym bag.
    const descriptionMatch = !attribute && !Object.hasOwn(SYNONYMS, token)
      ? tokenScore(item.description, token, 12) : 0;
    const minimumPrefix = !attribute && token === terms.at(-1) ? 1 : 2;
    const best = Math.max(
      tokenScore(item.name, token, 140, minimumPrefix),
      tokenScore(item.brand, token, 110, minimumPrefix),
      tokenScore(item.category, token, 105, minimumPrefix),
      tokenScore(item.subcategory, token, 95),
      tokenScore(item.aliases, token, 90),
      tokenScore(item.tags, token, 65),
      tokenScore(item.gender, token, 118),
      tokenScore(item.colors, token, 118),
      tokenScore(item.sizes, token, 118),
      descriptionMatch,
    );
    if (!best) return 0;
    total += best;
  }
  if (item.name.normalized === originalQuery) total += 3000;
  else if (item.name.normalized === queryText) total += 1500;
  else if (item.name.normalized.includes(queryText)) total += 260;
  if (item.brand.normalized === queryText || item.category.normalized === queryText) total += 450;
  // Availability is a tie-breaker, never a replacement for relevance.
  if (Number(item.product.stock) > 0) total += 1;
  return total;
}

function matchingOptions(options, terms, query) {
  if (!Array.isArray(options) || !options.length) return [null];
  const fullMatches = options.filter(option => {
    const name = normalizeSearchText(option);
    return name.includes(" ") && (" " + query + " ").includes(" " + name + " ");
  });
  return fullMatches.length ? fullMatches : options.filter(option =>
    terms.every(term => words(option).includes(term)));
}

export function matchingOffer(product, colors = [], sizes = [], query = "") {
  const matchingColors = matchingOptions(product.colors, colors, query);
  const matchingSizes = matchingOptions(product.sizes, sizes, query);
  if (Array.isArray(product.variantPrices) && product.variantPrices.length) {
    let cheapest = Infinity;
    let cheapestAvailable = Infinity;
    for (const row of product.variantPrices) {
      if (!Number.isSafeInteger(row?.customerUnitAmount) || row.customerUnitAmount <= 0 ||
        !matchingColors.includes(row.color || null) || !matchingSizes.includes(row.size || null)) continue;
      cheapest = Math.min(cheapest, row.customerUnitAmount);
      if (getVariantStock(product, row.size, row.color) > 0) {
        cheapestAvailable = Math.min(cheapestAvailable, row.customerUnitAmount);
      }
    }
    if (!Number.isFinite(cheapest)) return null;
    const available = Number.isFinite(cheapestAvailable);
    return { price: (available ? cheapestAvailable : cheapest) / 100, available };
  }
  const price = product.price != null && product.price !== "" && Number.isFinite(Number(product.price))
    ? getDiscountedPrice(product) : null;
  const available = matchingColors.some(color =>
    matchingSizes.some(size => getVariantStock(product, size, color) > 0));
  return { price, available };
}

export function searchCatalogue(productsOrIndex, query, { strict = false, limit = Infinity } = {}) {
  const index = Array.isArray(productsOrIndex)
    ? createSearchIndex(productsOrIndex) : productsOrIndex;
  const raw = String(query ?? "").slice(0, 120).trim();
  // Parse the amount before normalization strips currency, commas and decimals.
  const budget = raw.match(/\b(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)(?![\d.])\b/i);
  const ceiling = budget ? Number(budget[1].replaceAll(",", "")) : Infinity;
  const withoutBudget = budget ? raw.replace(budget[0], " ").replace(/\s+/g, " ").trim() : raw;
  const clean = normalizeSearchText(withoutBudget);
  const matchingText = clean.replace(/\bsize\s+([\da-z]+)\b/g, (phrase, value) =>
    index.sizes.has(value) ? value : phrase);
  const resolved = resolveTokens(index, matchingText, strict);
  if (!budget && !resolved.tokens.length) {
    return { matches: [], products: [], correctedQuery: "", ambiguous: false,
      categories: [], brands: [], related: [], suggestedQueries: [], broaderQuery: "" };
  }
  const queryText = resolved.tokens.join(" ");
  const colors = resolved.tokens.filter(term => index.colors.has(term));
  const sizes = resolved.tokens.filter(term => index.sizes.has(term));
  const textMatches = index.entries
    .map((item) => ({ product: item.product, score: score(item, resolved.tokens, queryText, clean, index) }))
    .filter((item) => item.score > 0);
  const relevant = [];
  for (const match of textMatches) {
    const offer = matchingOffer(match.product, colors, sizes, clean);
    if (offer && (!budget || (offer.price != null && offer.price < ceiling))) {
      relevant.push({ ...match, ...offer });
    }
  }
  relevant.sort((a, b) => b.score - a.score);
  const counts = (property) => {
    const tally = new Map();
    for (const { product } of relevant) {
      const value = String(product[property] ?? "").trim();
      if (value) tally.set(value, (tally.get(value) || 0) + 1);
    }
    return [...tally].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label]) => label);
  };
  // Keep the shopping subject when broadening: women's joggers should lead
  // to Joggers, not a supplement with "women" in its title.
  const subjectTerms = resolved.tokens.filter(token =>
    !GENDERS.has(token) && !index.colors.has(token) && !index.sizes.has(token));
  const related = relevant.length ? [] : index.entries
    .map((item) => {
      const tokens = subjectTerms.filter((token) =>
        ["name", "category", "subcategory", "tags", "aliases"]
          .some((key) => tokenScore(item[key], token, 1) > 0));
      return { product: item.product, count: tokens.length };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item) => item.product.category)
    .filter((value, i, all) => value && all.indexOf(value) === i);
  const matches = relevant.slice(0, limit);
  const suggestedQueries = new Set();
  if (clean) {
    for (const { product } of matches.slice(0, 4)) {
      for (const phrase of [product.subcategory, ...(Array.isArray(product.searchAliases) ? product.searchAliases : []), product.name]) {
        const normalized = normalizeSearchText(phrase);
        if (normalized !== clean && normalized.startsWith(clean)) {
          suggestedQueries.add(budget ? phrase + " " + budget[0] : phrase);
        }
      }
    }
  }
  return {
    matches, products: matches.map((item) => item.product),
    correctedQuery: resolved.changed && relevant.length
      ? [resolved.correctedQuery, budget?.[0]].filter(Boolean).join(" ") : "",
    ambiguous: resolved.ambiguous,
    suggestedQueries: [...suggestedQueries].slice(0, 2),
    broaderQuery: !relevant.length && textMatches.length && budget ? withoutBudget : "",
    categories: counts("category"), brands: counts("brand"), related,
  };
}
