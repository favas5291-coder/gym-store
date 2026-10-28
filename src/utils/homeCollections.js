import { productDepartment } from './catalog.js';
import { getTotalStock } from './cartUtils.js';

// Small, distinct selections; labels are derived from saved catalog flags.
export function homeCollections(products = []) {
  const seen = new Set();
  const available = products.filter(p => {
    const id = String(p?.id ?? p?._id ?? '');
    if (!id || seen.has(id) || !p.name || p.isActive === false || p.delivery?.available === false || getTotalStock(p) <= 0) return false;
    seen.add(id);
    return Number.isFinite(Number(p.price)) && p.price != null;
  });
  const used = new Set();
  const pick = (items, limit = 4) => {
    const selection = [];
    for (const product of items) {
      const id = String(product.id ?? product._id);
      if (used.has(id)) continue;
      used.add(id);
      selection.push(product);
      if (selection.length === limit) break;
    }
    return selection;
  };
  // Diversify editorial selection without pretending that it is a sales ranking.
  const departments = ['workout', 'shoes', 'accessories', 'hydration', 'supplements'];
  const varied = [...departments.map(d => available.find(p => productDepartment(p) === d)).filter(Boolean), ...available];
  const bestsellers = available.filter(p => p.isBestSeller === true);
  const lead = pick(bestsellers.length ? bestsellers : varied);
  const fresh = pick([...available.filter(p => p.isNew === true)].sort((a,b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)));
  const trending = available.filter(p => p.isTrending === true);
  const more = pick(trending.length ? trending : available.filter(p => p.isFeatured === true));
  return { available, lead, leadTitle: bestsellers.length ? 'Best sellers' : 'Selected for your routine', fresh, more, moreTitle: trending.length ? 'Trending now' : 'More to explore' };
}
