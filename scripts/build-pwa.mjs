import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../dist/", import.meta.url);
const files = ["offline.html", "offline.js", "icons/gymdrobe-maskable-512.png"];
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(new URL(file, root)));
const worker = await readFile(new URL("sw.js", root), "utf8");
if (!worker.includes("__GYMDROBE_PWA_VERSION__")) throw new Error("PWA worker version marker is missing");
const revision = hash.update(worker).digest("hex").slice(0, 16);
await writeFile(new URL("sw.js", root), worker.replaceAll("__GYMDROBE_PWA_VERSION__", revision));
console.log(`PWA offline support built (${revision})`);
