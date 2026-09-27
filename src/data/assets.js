// Original local photographs always take priority. No remote image dependency.
const files = import.meta.glob("../assets/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,avif,svg}", {
  eager: true, query: "?url", import: "default",
});
const normalize = name => name.split("/").pop().toLowerCase().replace(/\s+/g, "");
export function asset(name) {
  if (!name) return "";
  return files[`../assets/${name}`] || Object.entries(files).find(([path]) => normalize(path) === normalize(name))?.[1] || "";
}