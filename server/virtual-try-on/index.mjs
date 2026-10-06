import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createHandler } from "./handler.mjs";
import { loadCatalog } from "./catalog.mjs";
import { fashnProvider } from "./provider.mjs";
import { memoryStore } from "./store.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.join(root, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (process.env.NODE_ENV === "production") {
  throw new Error(
    "This launcher uses local memory storage. Production deployment requires a shared job store and deployment routing.",
  );
}
const origin = process.env.TRYON_ORIGIN || "http://localhost:5173";
const parsedOrigin = new URL(origin);
if (
  !["localhost", "127.0.0.1"].includes(parsedOrigin.hostname) ||
  parsedOrigin.protocol !== "http:"
) {
  throw new Error(
    "Use your local Vite URL as TRYON_ORIGIN, for example http://localhost:5173.",
  );
}
const port = Number(process.env.TRYON_PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("TRYON_PORT must be a valid port number.");
const config = JSON.parse(
  await fs.readFile(path.join(root, "config/virtual-try-on.json"), "utf8"),
);
const catalog = await loadCatalog(root, config);
const provider = process.env.FASHN_API_KEY
  ? fashnProvider(process.env.FASHN_API_KEY)
  : null;
const handler = createHandler({
  catalog,
  provider,
  store: memoryStore(),
  secret: process.env.TRYON_SESSION_SECRET || randomBytes(32).toString("hex"),
  origin: parsedOrigin.origin,
});
const server = http.createServer(handler);
server.requestTimeout = 60000;
server.headersTimeout = 15000;
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Stop the old try-on process or select another TRYON_PORT.`
      : "The local try-on server could not start.",
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`GymDrobe try-on server: http://127.0.0.1:${port}`);
  console.log(`Frontend origin: ${parsedOrigin.origin}`);
  console.log(
    `Provider: ${provider ? "configured" : "not configured"}; approved product photos: ${catalog.assets.size}`,
  );
});
