// Local test fixture only. Never import from application code or deploy this server.
// Uses the real portal routes/services with an in-memory persistence adapter.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { once } from "node:events";
import { createServer } from "vite";

export async function startSupplierPortalFixture({ port = 4198 } = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const backendRoot = process.env.GYMDROBE_BACKEND_DIR || path.resolve(root, "../gym-drobe-backend");
  const require = createRequire(path.join(backendRoot, "package.json"));
  const express = require("express");
  const cors = require("cors");
  const { memoryStore } = require(path.join(backendRoot, "tests/helpers/supplierPortalStore.cjs"));
  const { createSupplierPortalService } = require(path.join(backendRoot, "utils/supplierPortalService.js"));
  const { createSupplierPortalHandlers } = require(path.join(backendRoot, "middleware/controllers/supplierPortalController.js"));
  const { createSupplierPortalRouter } = require(path.join(backendRoot, "routes/supplierPortalRoutes.js"));
  const store = memoryStore();
  const service = createSupplierPortalService(store);
  const users = {
    supplier: { _id: "507f1f77bcf86cd799439011", id: "507f1f77bcf86cd799439011", name: "Fixture Supplier", email: "supplier@example.test", role: "customer", isActive: true },
    admin: { _id: "507f1f77bcf86cd799439012", id: "507f1f77bcf86cd799439012", name: "Fixture Admin", email: "admin@example.test", role: "admin", isActive: true },
    outsider: { _id: "507f1f77bcf86cd799439013", id: "507f1f77bcf86cd799439013", name: "Other Supplier", email: "other@example.test", role: "customer", isActive: true },
  };
  const app = express();
  app.use(cors()); app.use(express.json());
  app.use((req, res, next) => { req.user = users[req.headers.authorization?.replace("Bearer fixture-", "")]; next(); });
  const authenticate = (req, res, next) => req.user ? next() : res.status(401).json({ success: false });
  app.get("/api/auth/me", authenticate, (req, res) => res.json({ success: true, user: req.user }));
  app.use("/api/supplier-portal", createSupplierPortalRouter({ enabled: () => true, authenticate,
    rateLimit: (req, res, next) => next(), handlers: createSupplierPortalHandlers(service) }));
  app.get("/api/suppliers", (req, res) => res.json({ success: true, suppliers: [], total: 0, page: 1, pages: 1 }));
  app.get("/api/products", (req, res) => res.json({ success: true, products: [], total: 0, page: 1, pages: 1 }));
  app.use((req, res) => res.json({ success: true, config: { enabled: false, allowedEvents: [] }, settings: { enabled: false }, products: [] }));
  const backend = app.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const apiURL = `http://127.0.0.1:${backend.address().port}/api`;
  const frontend = await createServer({ root, server: { host: "127.0.0.1", port, strictPort: true }, logLevel: "error",
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(apiURL), "import.meta.env.VITE_SUPPLIER_PORTAL_ENABLED": '"true"' },
    plugins: [{ name: "supplier-local-fixture", configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const role = /^\/__fixture\/login\/(supplier|admin|outsider)$/.exec(req.url || "")?.[1];
        if (!role) return next();
        res.setHeader("Content-Type", "text/html");
        res.end(`<script>localStorage.clear(); localStorage.setItem('gymdrobe-auth-token', 'fixture-${role}'); location.replace('${role === "admin" ? "/admin/supplier-onboarding" : "/supplier"}');</script>`);
      });
    } }],
  });
  await frontend.listen();
  return { url: `http://127.0.0.1:${port}`, apiURL, service, store, users,
    async close() { await frontend.close(); await new Promise((resolve) => { backend.close(resolve); backend.closeAllConnections(); }); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const fixture = await startSupplierPortalFixture();
  console.log(`Local supplier fixture: ${fixture.url}/__fixture/login/supplier`);
  console.log(`Local admin fixture: ${fixture.url}/__fixture/login/admin`);
  process.once("SIGINT", async () => { await fixture.close(); process.exit(0); });
  process.once("SIGTERM", async () => { await fixture.close(); process.exit(0); });
}
