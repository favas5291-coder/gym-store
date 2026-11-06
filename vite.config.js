import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { STOREFRONT_COLLECTIONS } from "./src/utils/storefrontCollections.js";

function publicCatalogueStartup(env, mode) {
  const api = URL.parse(env.VITE_API_URL || "");
  const site = URL.parse(env.VITE_SITE_URL || "");
  return {
    name: "public-catalogue-startup",
    apply: "build",
    transformIndexHtml() {
      if (["ios", "android"].includes(mode) || api?.protocol !== "https:" ||
          api.username || api.password || api.search || api.hash || !/\/api\/?$/.test(api.pathname)) return;
      const paths = ["/", "/shop", ...Object.keys(STOREFRONT_COLLECTIONS)];
      const url = api.href.replace(/\/+$/, "") + "/products";
      const tags = [{
        tag: "script",
        injectTo: "head",
        children: `(() => {
          const path = location.pathname.replace(/\\/+$/, "") || "/";
          if (!${JSON.stringify(paths)}.includes(path)) return;
          const url = ${JSON.stringify(url)};
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 60000);
          const response = fetch(url, {
            headers: { Accept: "application/json" },
            credentials: "omit",
            cache: "no-store",
            signal: controller.signal
          }).finally(() => clearTimeout(timer));
          response.catch(() => {});
          window.__gymdrobeCatalogueRequest = { url, response, controller };
        })();`,
      }];
      if (api.origin !== site?.origin) {
        tags.unshift({ tag: "link", attrs: { rel: "preconnect", href: api.origin, crossorigin: true }, injectTo: "head-prepend" });
      }
      return tags;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), publicCatalogueStartup(loadEnv(mode, process.cwd()), mode)],
  server: {
    allowedHosts: ["terminal.local"],
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/virtual-try-on": {
        target: "http://127.0.0.1:3001",
        changeOrigin: false,
      },
      "/api/try-on": {
        target: "http://127.0.0.1:3001",
        changeOrigin: false,
      },
    },
  },
}));
