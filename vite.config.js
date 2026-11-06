import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function cataloguePreconnect(env) {
  const api = URL.parse(env.VITE_API_URL || "");
  const site = URL.parse(env.VITE_SITE_URL || "");
  return {
    name: "catalogue-preconnect",
    transformIndexHtml() {
      if (api?.protocol !== "https:" || api.username || api.password || api.origin === site?.origin) return;
      return [{ tag: "link", attrs: { rel: "preconnect", href: api.origin, crossorigin: true }, injectTo: "head-prepend" }];
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), cataloguePreconnect(loadEnv(mode, process.cwd()))],
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
