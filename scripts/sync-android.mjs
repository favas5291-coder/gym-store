import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { loadEnv } from "vite";
import { nativePushConfig } from "./native-push-config.mjs";
const env = { ...loadEnv("android", process.cwd(), "VITE_"), ...process.env };
const file = "capacitor.config.json", original = await readFile(file, "utf8");
let firebase;
if (env.VITE_PUSH_ENABLED === "true") firebase = JSON.parse(await readFile("android/app/google-services.json", "utf8"));
const config = nativePushConfig(JSON.parse(original), env, "android", firebase);
try {
  await writeFile(file, JSON.stringify(config, null, 2));
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "sync", "android"], { stdio: "inherit", shell: process.platform === "win32" });
} finally { await writeFile(file, original); }
