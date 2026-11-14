export function brandName(value) {
  return typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
}

export function brandKey(value) {
  return brandName(value).toLowerCase();
}

export function catalogueBrands(products) {
  const names = new Map();
  for (const product of products) {
    if (product.isActive === false) continue;
    const name = brandName(product.brand);
    if (name && !names.has(brandKey(name))) names.set(brandKey(name), name);
  }
  return [...names].map(([key, name]) => ({ key, name }));
}

export function brandFilterPath(name) {
  const query = name.includes(",") ? "brandKey" : "brand";
  return `/shop?${query}=${encodeURIComponent(query === "brandKey" ? brandKey(name) : name)}`;
}
