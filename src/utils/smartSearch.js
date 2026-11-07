/**
 * Catalogue-aware, bounded on-device search for the public product list.
 * No network request or private supplier fields are needed for suggestions.
 * Alias terms only resolve when a matching published catalogue term exists.
 */

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
});

// Common verified-looking typos are hints; the catalogue is still the source
// of truth. These are not hardcoded search results.
const TYPOS = Object.freeze({
  protien: "protein", protine: "protein", shooes: "shoes",
  compresion: "compression", creatin: "creatine",
  glovs: "gloves", joger: "joggers", beg: "bag",
  resitance: "resistance", dumbel: "dumbbell",
});

const CANONICAL = new Map(
  Object.entries(SYNONYMS).flatMap(([head, variants]) =>
    [head, ...variants].map((variant) => [variant, head]),
  ),
);
const STOP = new Set(["a", "an", "and", "for", "from", "in", "my", "of", "the", "to", "with"]);

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
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\bt\s*shirts?\b/g, "tshirt")
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
  for (const item of entries) {
    for (const key of ["name", "brand", "category", "subcategory", "aliases", "tags"]) {
      for (const token of item[key].tokens) vocabulary.add(token);
    }
  }
  return { entries, vocabulary: [...vocabulary].slice(0, 10000), vocabularySet: vocabulary };
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
    if (strict) {
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

function tokenScore(fieldData, token, weight) {
  if (fieldData.tokens.has(token)) return weight;
  if (token.length >= 2 &&
    [...fieldData.tokens].some((value) => value.startsWith(token))) {
    return Math.floor(weight * 0.65);
  }
  return 0;
}

function score(item, terms, queryText) {
  if (!terms.length) return 0;
  let total = 0;
  for (const token of terms) {
    const best = Math.max(
      tokenScore(item.name, token, 140),
      tokenScore(item.brand, token, 110),
      tokenScore(item.category, token, 105),
      tokenScore(item.subcategory, token, 95),
      tokenScore(item.aliases, token, 90),
      tokenScore(item.tags, token, 65),
      tokenScore(item.description, token, 12),
    );
    if (!best) return 0;
    total += best;
  }
  if (item.name.normalized === queryText) total += 1500;
  else if (item.name.normalized.includes(queryText)) total += 260;
  if (item.brand.normalized === queryText || item.category.normalized === queryText) total += 450;
  // Availability is a tie-breaker, never a replacement for relevance.
  if (Number(item.product.stock) > 0) total += 1;
  return total;
}

export function searchCatalogue(productsOrIndex, query, { strict = false, limit = Infinity } = {}) {
  const index = Array.isArray(productsOrIndex)
    ? createSearchIndex(productsOrIndex) : productsOrIndex;
  const clean = normalizeSearchText(String(query ?? "").slice(0, 120));
  if (!clean) {
    return { matches: [], products: [], correctedQuery: "", ambiguous: false,
      categories: [], brands: [], related: [] };
  }
  const resolved = resolveTokens(index, clean, strict);
  const relevant = index.entries
    .map((item) => ({ product: item.product, score: score(item, resolved.tokens, resolved.tokens.join(" ")) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const counts = (property) => {
    const tally = new Map();
    for (const { product } of relevant) {
      const value = String(product[property] ?? "").trim();
      if (value) tally.set(value, (tally.get(value) || 0) + 1);
    }
    return [...tally].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label]) => label);
  };
  // When there are no exact/fuzzy matches, suggest *real* nearby categories.
  const related = relevant.length ? [] : index.entries
    .map((item) => {
      const tokens = resolved.tokens.filter((token) =>
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
  return {
    matches, products: matches.map((item) => item.product),
    correctedQuery: resolved.changed && relevant.length ? resolved.correctedQuery : "",
    ambiguous: resolved.ambiguous,
    categories: counts("category"), brands: counts("brand"), related,
  };
}
