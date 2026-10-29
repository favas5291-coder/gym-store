export const DEFAULT_DESCRIPTION = "Discover training clothing, gym shoes and workout essentials at GymDrobe. Everything you need for every workout.";
export const DEFAULT_SHARE_IMAGE = "/gymdrobe-share-v1.png";
export const PAGES = {
  "/": { title: "GymDrobe | Everything for Every Workout", description: DEFAULT_DESCRIPTION },
  "/shop": { title: "Shop Gym Clothing & Workout Essentials | GymDrobe", description: "Explore gym clothing, shoes, bags and workout essentials at GymDrobe. Browse products, compare options and find gear for your next workout." },
  "/offers": { title: "Offers & Coupons | GymDrobe", description: "Explore current GymDrobe offers on gym clothing and workout essentials." },
  "/help": { title: "Shopping Help | GymDrobe", description: "Find help with shopping, delivery, payments and orders at GymDrobe." },
  "/install": { title: "Install GymDrobe | Your Fitness Store", description: "Add GymDrobe to your home screen for quick access to fitness essentials, your shopping bag and orders." },
};
export function cleanText(value) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}
export function getImages(product, origin) {
  const sources = [product.image, ...(Array.isArray(product.images) ? product.images : [])];
  return [...new Set(sources.flatMap(source => {
    if (typeof source !== "string" || !source.trim()) return [];
    try {
      const url = new URL(source.trim(), origin);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? [url.href] : [];
    } catch { return []; }
  }))];
}
export function productMetadata(product, origin) {
  const id = String(product?.id ?? product?._id ?? "");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid public product identifier");
  const name = cleanText(product.name) || "Product";
  const description = cleanText(product.description).slice(0, 5000) || `Explore ${name} at GymDrobe. View available options, pricing and stock.`;
  const canonical = `${origin}/product/${encodeURIComponent(id)}`;
  const images = getImages(product, origin);
  const schema = { "@context": "https://schema.org", "@type": "Product", name, description, url: canonical,
    ...(images.length ? { image: images } : {}),
    ...(cleanText(product.brand) ? { brand: { "@type": "Brand", name: cleanText(product.brand) } } : {}),
    ...(cleanText(product.sku) ? { sku: cleanText(product.sku) } : {}) };
  // Build snapshots intentionally omit mutable price, stock, shipping and return
  // offers. The existing client adds those from its fresh authoritative API read.
  return { title: `${name} | GymDrobe`, description: description.slice(0, 160), canonical, type: "product",
    image: images[0] || new URL(DEFAULT_SHARE_IMAGE, origin).href, imageAlt: images.length ? name : "GymDrobe wordmark", schema };
}
