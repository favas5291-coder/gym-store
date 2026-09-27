// Keep your existing src/assets files. Missing images use an accessible fallback.
const files = import.meta.glob("../assets/*.{png,jpg,jpeg,webp,avif,svg}", {
  eager: true,
  query: "?url",
  import: "default",
});
export function asset(name) {
  return files[`../assets/${name}`] || "";
}