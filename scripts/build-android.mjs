import { build, loadEnv } from "vite";
import { execFileSync } from "node:child_process";

const env = { ...loadEnv("android", process.cwd(), "VITE_"), ...process.env };
const api = new URL(env.VITE_API_URL || "");
const site = new URL(env.VITE_SITE_URL || "");
if (api.protocol !== "https:" || api.username || api.password || !api.pathname.endsWith("/api") || site.protocol !== "https:") {
  throw new Error("Android builds require a public HTTPS API ending in /api and an HTTPS website origin.");
}
if (!env.VITE_GOOGLE_CLIENT_ID?.endsWith(".apps.googleusercontent.com")) throw new Error("Set the Google Web client ID for native sign-in.");
execFileSync(process.execPath, ["scripts/generate-sitemap.mjs"], { env, stdio: "inherit" });
for (const name of ["VITE_API_URL", "VITE_SITE_URL", "VITE_GOOGLE_CLIENT_ID"]) process.env[name] = env[name];
await build({ mode: "android", build: { outDir: "dist-android" }, plugins: [{
  name: "android-native-insets",
  transformIndexHtml: (html) => html.replace("viewport-fit=cover", "viewport-fit=contain"),
}] });
