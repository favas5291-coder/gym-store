// Real React UI + actual backend router/JWT/service, using isolated in-memory
// persistence. No real database, identity provider, customer or payment call.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";

process.env.VITE_SHOPPING_SYNC_ENABLED = "true";
process.env.VITE_API_URL = "http://127.0.0.1:4232/api";
const backendDir = path.resolve(process.env.GYMDROBE_SHOPPING_BACKEND_DIR || "../gym-backend-audit");
const backendRequire = createRequire(path.join(backendDir, "package.json"));
const { startShoppingFixture } = backendRequire("./tests/helpers/shoppingFixture.cjs");
const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
const output = path.resolve("test-results/shopping-sync");
await fs.mkdir(output, { recursive: true });
const results = [], errors = [];
let backend, fixture, browser;
const waitFor = async (work, message) => {
  const until = Date.now() + 20000;
  while (Date.now() < until) { if (await work()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(message);
};
const check = async (name, work) => {
  try { await work(); results.push({ name, passed: true }); console.log("PASS", name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); throw error; }
};
try {
  backend = await startShoppingFixture();
  fixture = await startStorefrontFixture(4232);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.GYMDROBE_CHROMIUM_PATH ? { executablePath: process.env.GYMDROBE_CHROMIUM_PATH } : {}) });
  const product = fixture.products[0], quantityName = `Quantity for ${product.name}`;
  async function device(name, width, seed = false) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 700, hasTouch: width < 700, reducedMotion: "reduce" });
    const mock = await mockStorefront(context, fixture.products);
    const user = { ...mock.user, id: backend.ids[name], _id: backend.ids[name] };
    if (name === "bob") await context.route("**/api/auth/me", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, user }) }));
    await context.addInitScript(({ token, user, product, seed }) => {
      localStorage.setItem("gymdrobe-auth-token", token);
      const key = `gymdrobe-cart:${user.id}`;
      if (seed && localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify([{ ...product, selectedSize: "M", selectedColor: "Black", quantity: 1 }]));
        localStorage.setItem(`gymdrobe-wishlist:${user.id}`, JSON.stringify([product.id]));
      }
    }, { token: backend.tokens[name], user, product, seed });
    const switches = { loseReply: false };
    await context.route("**/api/shopping-state**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { Authorization: request.headers().authorization || "" };
      const body = request.postData();
      if (body) headers["Content-Type"] = "application/json";
      const response = await fetch(backend.url + url.pathname, { method: request.method(), headers, ...(body ? { body } : {}) });
      const text = await response.text();
      if (switches.loseReply && request.method() === "POST" && response.ok) {
        switches.loseReply = false;
        await route.abort("failed");
      } else await route.fulfill({ status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: text });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(fixture.url + "/cart");
    await page.getByText("Your bag and wishlist are saved to your account.", { exact: true }).waitFor();
    return { context, page, switches, user, requests: mock.requests };
  }
  const phone = await device("alice", 390, true);
  const website = await device("alice", 1440);
  const qty = device => device.page.getByRole("combobox", { name: quantityName, exact: true });
  await check("website and mobile sessions load the same saved bag and wishlist", async () => {
    await qty(website).waitFor();
    assert.equal(await qty(website).inputValue(), "1");
    assert.deepEqual(backend.state(backend.ids.alice).wishlist, [product.id]);
  });
  await check("offline quantity changes combine with another device's edits on reconnect", async () => {
    await phone.context.setOffline(true);
    await qty(phone).selectOption("3");
    await phone.page.getByText("Your changes are kept on this device and will sync when you reconnect.").waitFor();
    await qty(website).selectOption("2");
    await waitFor(() => backend.state(backend.ids.alice).cart[0]?.quantity === 2, "Website edit did not save");
    await phone.context.setOffline(false);
    await waitFor(() => backend.state(backend.ids.alice).cart[0]?.quantity === 4, "Offline edit was not rebased");
    await waitFor(async () => await qty(phone).inputValue() === "4", "Phone did not display the merged quantity");
    await website.page.bringToFront();
    await website.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await waitFor(async () => await qty(website).inputValue() === "4", "Website did not refresh the merged quantity");
  });
  await check("a dropped save acknowledgement retries without adding the quantity twice", async () => {
    website.switches.loseReply = true;
    await qty(website).selectOption("5");
    await website.page.getByRole("button", { name: "Retry saving", exact: true }).waitFor();
    assert.equal(backend.state(backend.ids.alice).cart[0].quantity, 5);
    await website.page.getByRole("button", { name: "Retry saving", exact: true }).click();
    await website.page.getByText("Your bag and wishlist are saved to your account.", { exact: true }).waitFor();
    assert.equal(backend.state(backend.ids.alice).cart[0].quantity, 5);
    await website.page.reload();
    await qty(website).waitFor();
    await waitFor(async () => await qty(website).inputValue() === "5", "Saved quantity did not survive reload");
  });
  await check("another authenticated account cannot see the first account's saved lists", async () => {
    const other = await device("bob", 390);
    assert.equal(await qty(other).count(), 0);
    assert.deepEqual(backend.state(backend.ids.bob).cart, []);
    assert.deepEqual(backend.state(backend.ids.bob).wishlist, []);
    await other.context.close();
  });
  await check("saving never starts a payment and raises no uncaught UI errors", async () => {
    assert.equal([...phone.requests, ...website.requests].filter(request => ["/api/payments/razorpay/order", "/api/payments/razorpay/verify"].includes(request.path)).length, 0);
    assert.deepEqual(errors, []);
  });
  await website.page.screenshot({ path: path.join(output, "shared-bag-desktop.png"), fullPage: true });
  await phone.page.screenshot({ path: path.join(output, "shared-bag-mobile.png"), fullPage: true });
} finally {
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ results, errors,
    backendCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: backendDir, encoding: "utf8" }).trim(),
    note: "Actual React/router/JWT/service with isolated repository; no real MongoDB/provider/physical-device result." }, null, 2));
  await browser?.close();
  await fixture?.server.close();
  await backend?.close();
}
