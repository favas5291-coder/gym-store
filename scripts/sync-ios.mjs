import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { loadEnv } from "vite";

const env = { ...loadEnv("ios", process.cwd(), "VITE_"), ...process.env };
const file = "capacitor.config.json";
const original = await readFile(file, "utf8");
const config = JSON.parse(original);
config.webDir = "dist-ios";
config.ios = { contentInset: "never", backgroundColor: "#ffffff", preferredContentMode: "mobile", limitsNavigationsToAppBoundDomains: false };
const client = env.VITE_GOOGLE_IOS_CLIENT_ID?.trim();
if (client && !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(client)) throw new Error("Invalid Google iOS client ID.");
const schemes = ["gymdrobe", ...(client ? [client.split(".").reverse().join(".")] : [])];
const plistPath = "ios/App/App/Info.plist";
const plist = await readFile(plistPath, "utf8");
await writeFile(plistPath, plist.replace(/<!-- GYMDROBE_URLS_START -->[\s\S]*?<!-- GYMDROBE_URLS_END -->/, `<!-- GYMDROBE_URLS_START -->\n<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array>${schemes.map((value) => `<string>${value}</string>`).join("")}</array></dict></array>\n<!-- GYMDROBE_URLS_END -->`));
try {
  await writeFile(file, JSON.stringify(config, null, 2));
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "sync", "ios"], { stdio: "inherit", shell: process.platform === "win32" });
} finally {
  await writeFile(file, original);
}
