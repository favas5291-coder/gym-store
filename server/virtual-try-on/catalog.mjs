import fs from "node:fs/promises";
import path from "node:path";
import { validateImage } from "./image.mjs";
export async function loadCatalog(root, config) {
  const products = {},
    assets = new Map();
  const base = path.resolve(root, "public/tryon-products");
  for (const [id, product] of Object.entries(config.products || {})) {
    if (!product.enabled) continue;
    const entry = {
      id,
      name: product.name,
      category: product.category,
      colors: [],
      images: {},
    };
    products[id] = entry;
    for (const [color, photo] of Object.entries(product.colors || {})) {
      if (
        photo.approved !== true ||
        !/^\/tryon-products\/[\w.-]+\.(?:jpg|jpeg|png)$/.test(photo.image || "")
      )
        continue;
      try {
        const file = await fs.realpath(
          path.resolve(root, "public" + photo.image),
        );
        const realBase = await fs.realpath(base);
        if (!file.startsWith(realBase + path.sep)) continue;
        const info = await fs.stat(file);
        if (info.size > 3 * 1024 * 1024 || !info.isFile()) continue;
        const bytes = await fs.readFile(file),
          type = photo.image.endsWith(".png") ? "image/png" : "image/jpeg";
        const image = `data:${type};base64,${bytes.toString("base64")}`;
        validateImage(image, { maxBytes: 3 * 1024 * 1024 });
        assets.set(JSON.stringify([id, color]), image);
        entry.colors.push(color);
        entry.images[color] = photo.image;
      } catch {
        /* Missing or invalid product references remain visibly unavailable. */
      }
    }
  }
  return { products, assets };
}