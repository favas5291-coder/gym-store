import { build, loadEnv } from "vite";
import { execFileSync } from "node:child_process";

const env = { ...loadEnv("ios", process.cwd(), "VITE_"), ...process.env };
const api = new URL(env.VITE_API_URL || "");
const site = new URL(env.VITE_SITE_URL || "");
if (api.protocol !== "https:" || api.username || api.password || !api.pathname.endsWith("/api") || site.protocol !== "https:") throw new Error("iOS requires a public HTTPS API ending in /api and HTTPS website.");
for (const key of Object.keys(env).filter((key) => key.startsWith("VITE_"))) process.env[key] = env[key];
// Native builds have no analytics/tracking integrations or remote-code updater.
process.env.VITE_GA_MEASUREMENT_ID = "";
execFileSync(process.execPath, ["scripts/generate-sitemap.mjs"], { env, stdio: "inherit" });
await build({ mode: "ios", build: { outDir: "dist-ios" } });
