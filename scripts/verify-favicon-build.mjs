import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const assets=[
  "favicon-16x16.png","favicon-32x32.png","favicon-48x48.png",
  "favicon.ico","apple-touch-icon.png",
  "android-chrome-192x192.png","android-chrome-512x512.png",
  "site.webmanifest"
];
for(const filename of assets){
  const [source,build]=await Promise.all([
    readFile(path.join(root,"public",filename)),
    readFile(path.join(root,"dist",filename))
  ]);
  assert.ok(source.equals(build),"Built asset differs from generated source: "+filename);
  console.log("PASS favicon production asset:",filename,build.length,"bytes");
}
const html=await readFile(path.join(root,"dist","index.html"),"utf8");
assert.ok(html.includes("/favicon-32x32.png?v=2"));
assert.ok(html.includes("/apple-touch-icon.png?v=2"));
assert.ok(html.includes("/site.webmanifest?v=2"));
assert.ok(!html.includes('href="/favicon.jpeg"'));
console.log("PASS production HTML references transparent, cache-busted GD icon URLs");
