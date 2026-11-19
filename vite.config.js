import { readFileSync } from "node:fs";
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
  plugins: [react(), {
    name: "web-opening-wordmark",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (["ios", "android"].includes(mode)) return html;
        const logo = readFileSync(new URL("./public/brand/gymdrobe-wordmark-cream.png", import.meta.url));
        // Parse the static entrance before WebKit encounters module startup resources.
        const resources = [];
        html = html.replace(/<script type="module"[^>]* src="[^"]+"[^>]*><\/script>|<link rel="modulepreload"[^>]+>/g, tag => {
          resources.push(tag);
          return "";
        }).replace("</body>", resources.join("\n") + "\n</body>");
        return html.replace('src="/brand/gymdrobe-wordmark-cream.png"', 'src="data:image/png;base64,' + logo.toString("base64") + '"')
          .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (tag, href) => {
            // On the homepage the inline opening and shell can paint while the main CSS downloads.
            return `<script>
              if (document.documentElement.hasAttribute("data-home-boot")) {
                const root = document.documentElement;
                root.dataset.stylePending = String(Number(root.dataset.stylePending || 0) + 1);
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.media = "print";
                link.crossOrigin = "anonymous";
                link.href = ${JSON.stringify(href)};
                link.onload = link.onerror = event => {
                  link.onload = link.onerror = null;
                  if (event.type === "load") link.media = "all";
                  else root.dataset.homeStyleError = "";
                  const remaining = Number(root.dataset.stylePending) - 1;
                  if (remaining) root.dataset.stylePending = String(remaining);
                  else delete root.dataset.stylePending;
                };
                document.head.append(link);
              } else {
                document.write(${JSON.stringify(tag)});
              }
            </script><noscript>${tag}</noscript>`;
          });
      },
    },
  }, publicCatalogueStartup(loadEnv(mode, process.cwd()), mode)],
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
