// Public, read-only production response sample from GitHub-hosted CI.
// No customer identifiers, authentication, order, checkout, payment or writes.
// These timings are from the CI runner region: NOT Indian mobile/field CWV.
import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";

const targets = [
  ["home", "https://www.gymdrobe.com/"],
  ["shop", "https://www.gymdrobe.com/shop"],
  ["health", "https://gym-drobe-backend.onrender.com/api/health"],
  ["catalogue", "https://gym-drobe-backend.onrender.com/api/products"],
];

const results = [];
for (const [label, url] of targets) {
  for (let run = 1; run <= 2; run++) {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: label === "home" || label === "shop" ? "text/html" : "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      const headersMs = performance.now() - start;
      // Consume a public response to capture transferred payload size, but
      // cap bytes in memory and avoid printing any response/customer content.
      const size = Number(response.headers.get("content-length") || 0);
      const data = size <= 15_000_000 ? await response.arrayBuffer() : null;
      if (!data) await response.body?.cancel();
      const record = {
        label, run, timestamp: new Date().toISOString(), status: response.status,
        headersMs: Math.round(headersMs), totalMs: Math.round(performance.now() - start),
        responseBytes: data?.byteLength ?? null, oversized: data === null,
        serverTiming: response.headers.get("server-timing"),
        cacheControl: response.headers.get("cache-control"),
        contentEncoding: response.headers.get("content-encoding"),
        contentType: response.headers.get("content-type"),
        vercelCache: response.headers.get("x-vercel-cache"),
        redirected: response.redirected,
      };
      results.push(record);
      console.log("LIVE_HTTP_SAMPLE", JSON.stringify(record));
    } catch (error) {
      const record = {
        label, run, timestamp: new Date().toISOString(),
        error: error?.name || "NetworkError", detail: "Request unavailable; no latency measurement made",
      };
      results.push(record);
      console.log("LIVE_HTTP_UNAVAILABLE", JSON.stringify(record));
    }
  }
}
await mkdir("test-results/performance", { recursive: true });
await writeFile("test-results/performance/public-http.json", JSON.stringify({
  conditions: "GitHub Actions hosted runner; two independent public GET requests per URL; connection/TLS/server timing included; no throttling, no India location, no browser rendering, no cookies, no customer data",
  limitations: "Not Lighthouse, CrUX, LCP, INP, CLS, India-region latency, cold-start diagnosis, CDN field data or checkout acceptance",
  results,
}, null, 2));
if (!results.some((row) => row.status === 200))
  console.log("LIVE_HTTP_RESULT unavailable: no successful public response; do not claim production responsiveness.");
