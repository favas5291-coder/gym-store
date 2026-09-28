// Synthetic photos and a mock AI provider. No paid calls or customer photos.
// A separate scenario exercises the real, locally served MediaPipe worker.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createHandler } from "../server/virtual-try-on/handler.mjs";
import { memoryStore } from "../server/virtual-try-on/store.mjs";
import { testImage, imageData } from "./vto-fixture.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(
  process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright"
);
const origin = "http://localhost:4198",
  out = path.join(root, "test-results/vto");
fs.mkdirSync(out, { recursive: true });
let mode = "success",
  analysisMode = "one",
  starts = 0;
const catalog = { products: {}, assets: new Map() };
for (const id of ["1", "2"]) {
  catalog.products[id] = {
    id,
    category: id === "1" ? "tops" : "shoes",
    colors: ["Black", "White"],
    images: { Black: "/vto-test-image.png", White: "/vto-test-image.png" },
  };
  for (const color of ["Black", "White"])
    catalog.assets.set(JSON.stringify([id, color]), imageData());
}
const provider = {
  start: async () => {
    starts++;
    return "job-test";
  },
  status: async () =>
    mode === "failed"
      ? {
          status: "failed",
          code: "GENERATION_FAILED",
          message: "Please try a clearer photo.",
        }
      : mode === "pending"
        ? { status: "processing" }
        : { status: "completed", image: imageData() },
};
const api = http.createServer(
  createHandler({
    catalog,
    provider,
    store: memoryStore(),
    secret: "test-only-secret-at-least-thirty-two-characters",
    origin,
    limits: { visitor: 100, ip: 200, daily: 200 },
  }),
);
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const vite = await createServer({
  root,
  server: {
    host: "localhost",
    port: 4198,
    strictPort: true,
    proxy: {
      "/api/virtual-try-on": {
        target: `http://127.0.0.1:${api.address().port}`,
        changeOrigin: false,
      },
    },
  },
  logLevel: "error",
});
vite.middlewares.use((req, res, next) => {
  if (req.url === "/vto-test-image.png") {
    res.setHeader("Content-Type", "image/png");
    res.end(testImage());
  } else next();
});
await vite.listen();
const browser = await chromium.launch({
  executablePath: process.env.GYMDROBE_CHROMIUM_PATH || undefined,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-zygote",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [],
  passed = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = async (name, fn) => {
  await fn();
  passed.push(name);
  console.log("PASS " + name);
};
const fixturePose = Array.from({ length: 33 }, () => ({
  x: 0.5,
  y: 0.5,
  visibility: 0.9,
}));
const mockWorker = async (route) => {
  const poses =
    analysisMode === "none"
      ? []
      : analysisMode === "multiple"
        ? [fixturePose, fixturePose]
        : [fixturePose];
  await route.fulfill({
    contentType: "application/javascript",
    body: `self.onmessage=()=>self.postMessage(${JSON.stringify({ poses, mean: 120, sharpness: 100 })});`,
  });
};
await page.route("**/vto-assets/check-photo.worker.js", mockWorker);
await page.route("**/vto-test-image.png", (route) =>
  route.fulfill({ contentType: "image/png", body: testImage() }),
);
const dialog = () =>
  page.getByRole("dialog", { name: "Virtual Try-On", exact: true });
const open = async () => {
  await page
    .getByRole("button", { name: /Virtual Try-On See this style/ })
    .click();
  await dialog().waitFor();
  await dialog()
    .getByRole("button", { name: "Try It On", exact: true })
    .waitFor();
};
const photo = async () => {
  await dialog()
    .getByLabel("Upload your photo", { exact: true })
    .setInputFiles({
      name: "synthetic-test.png",
      mimeType: "image/png",
      buffer: testImage(),
    });
  await dialog().getByAltText("Your original photo", { exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector(".vto-processing"));
};
const generate = async () => {
  await dialog().getByRole("checkbox").check();
  await dialog()
    .getByRole("button", { name: "Try It On", exact: true })
    .click();
  await dialog()
    .getByRole("link", { name: "↓ Download result", exact: true })
    .waitFor();
};
try {
  await page.goto(origin + "/product/1");
  await check(
    "prominent entry, useful missing-photo error, modal keyboard close and focus restoration",
    async () => {
      await open();
      await dialog()
        .getByRole("button", { name: "Try It On", exact: true })
        .click();
      await dialog()
        .getByRole("alert")
        .filter({ hasText: "Add a photo" })
        .waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.match(await page.locator(":focus").innerText(), /Virtual Try-On/);
    },
  );
  await check(
    "unsupported uploads and multiple/no-person checks block generation",
    async () => {
      await open();
      await dialog()
        .getByLabel("Upload your photo", { exact: true })
        .setInputFiles({
          name: "bad.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from("<svg/>"),
        });
      await dialog().getByRole("alert").filter({ hasText: "JPEG" }).waitFor();
      analysisMode = "multiple";
      await photo();
      await dialog()
        .getByRole("alert")
        .filter({ hasText: "more than one" })
        .waitFor();
      await dialog().getByRole("checkbox").check();
      await dialog()
        .getByRole("button", { name: "Try It On", exact: true })
        .click();
      assert.equal(starts, 0);
      analysisMode = "none";
      await photo();
      await dialog()
        .getByRole("alert")
        .filter({ hasText: "could not find a clear person" })
        .waitFor();
      analysisMode = "one";
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "consent, AI loading, comparison, download, sharing fallback and size-specific cart",
    async () => {
      await open();
      await photo();
      await dialog()
        .getByRole("button", { name: "Try It On", exact: true })
        .click();
      await dialog()
        .getByRole("alert")
        .filter({ hasText: "agree to photo processing" })
        .waitFor();
      assert.equal(starts, 0);
      await generate();
      assert.equal(starts, 1);
      await dialog()
        .getByRole("slider", { name: "Before and after comparison" })
        .fill("27");
      assert.equal(await dialog().getByRole("slider").inputValue(), "27");
      const download = page.waitForEvent("download");
      await dialog().getByRole("link", { name: "↓ Download result" }).click();
      assert.match(
        (await download).suggestedFilename(),
        /GymDrobe-AI-preview-1/,
      );
      await dialog().getByRole("button", { name: "↗ Share result" }).click();
      await dialog()
        .getByRole("status")
        .filter({ hasText: "cannot share image files" })
        .waitFor();
      await dialog().getByRole("button", { name: "M", exact: true }).click();
      await dialog()
        .getByRole("button", { name: "Add to Cart", exact: true })
        .click();
      await dialog().getByRole("link", { name: "View your bag →" }).waitFor();
      const cart = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("gymdrobe-cart")),
      );
      assert.equal(cart[0].selectedSize, "M");
      assert.equal(cart[0].selectedColor, "Black");
      const stored = await page.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      );
      assert.equal(stored.includes("data:image"), false);
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .locator(".option-list.sizes")
          .getByRole("button", { name: "M", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
    },
  );
  await check(
    "changing colour clears stale output; unapproved colour is unavailable",
    async () => {
      await open();
      await photo();
      await generate();
      await dialog()
        .getByRole("button", { name: "White", exact: true })
        .click();
      assert.equal(
        await dialog().getByRole("link", { name: "↓ Download result" }).count(),
        0,
      );
      await generate();
      await dialog().getByRole("button", { name: "Blue", exact: true }).click();
      await dialog()
        .getByText("This colour is not ready for try-on", { exact: true })
        .waitFor();
      assert.equal(
        await dialog()
          .getByRole("button", { name: "Try It On", exact: true })
          .isDisabled(),
        true,
      );
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "another product retains the photo and adds the right variant",
    async () => {
      await open();
      await photo();
      await dialog()
        .getByLabel("Choose your product", { exact: true })
        .selectOption("2");
      assert.equal(
        await dialog().getByAltText("Your original photo").count(),
        1,
      );
      await dialog().getByRole("button", { name: "8", exact: true }).click();
      await dialog()
        .getByRole("button", { name: "Add to Cart", exact: true })
        .click();
      const cart = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("gymdrobe-cart")),
      );
      const shoes = cart.find((p) => String(p.id) === "2");
      assert.equal(String(shoes.selectedSize), "8");
      assert.equal(shoes.selectedColor, "Black");
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "provider failure and cancellation show no invented result",
    async () => {
      mode = "failed";
      await open();
      await photo();
      await dialog().getByRole("checkbox").check();
      await dialog()
        .getByRole("button", { name: "Try It On", exact: true })
        .click();
      await dialog()
        .getByRole("alert")
        .filter({ hasText: "clearer photo" })
        .waitFor();
      assert.equal(
        await dialog().getByRole("link", { name: "↓ Download result" }).count(),
        0,
      );
      mode = "pending";
      await dialog()
        .getByRole("button", { name: "Try It On", exact: true })
        .click();
      await dialog()
        .getByRole("status")
        .filter({ hasText: "Creating your virtual try-on..." })
        .waitFor();
      await dialog().getByRole("button", { name: "Stop waiting" }).click();
      await dialog()
        .getByRole("status")
        .filter({ hasText: "Preview stopped here" })
        .waitFor();
      await page.keyboard.press("Escape");
      mode = "success";
      await open();
      assert.equal(
        await dialog().getByAltText("Your original photo").count(),
        0,
      );
      assert.equal(await dialog().getByRole("checkbox").isChecked(), false);
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "native share receives the generated image when browser supports files",
    async () => {
      await page.evaluate(() => {
        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value: () => true,
        });
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (data) => {
            window.testShared = {
              name: data.files[0].name,
              type: data.files[0].type,
              size: data.files[0].size,
            };
          },
        });
      });
      await open();
      await photo();
      await generate();
      await dialog().getByRole("button", { name: "↗ Share result" }).click();
      const shared = await page.evaluate(() => window.testShared);
      assert.match(shared.name, /GymDrobe-AI-preview/);
      assert.ok(shared.size > 0);
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "camera opens, captures, and stops all tracks when closed",
    async () => {
      await page.evaluate(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices,
        );
        navigator.mediaDevices.getUserMedia = async (c) => {
          const s = await original(c);
          window.testCameraStream = s;
          return s;
        };
      });
      await open();
      await dialog()
        .getByRole("button", { name: "Use camera", exact: true })
        .click();
      await dialog()
        .getByRole("button", { name: "Take photo", exact: true })
        .waitFor();
      await page.waitForFunction(
        () => document.querySelector("video")?.readyState >= 2,
      );
      await dialog()
        .getByRole("button", { name: "Take photo", exact: true })
        .click();
      await dialog().getByAltText("Your original photo").waitFor();
      assert.equal(
        await page.evaluate(() =>
          window.testCameraStream
            .getTracks()
            .every((t) => t.readyState === "ended"),
        ),
        true,
      );
      await page.keyboard.press("Escape");
    },
  );
  await check("camera denial gives an upload alternative", async () => {
    await page.evaluate(
      () =>
        (navigator.mediaDevices.getUserMedia = async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        }),
    );
    await open();
    await dialog()
      .getByRole("button", { name: "Use camera", exact: true })
      .click();
    await dialog()
      .getByRole("alert")
      .filter({ hasText: "Camera access was denied" })
      .waitFor();
    await dialog().getByRole("button", { name: "Close camera" }).click();
    await dialog()
      .getByRole("button", { name: "Upload photo", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
  });
  await check(
    "responsive layout has no horizontal overflow at 320, 390, 768 and 1440 px",
    async () => {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 950 });
        await open();
        assert.equal(
          await dialog().evaluate((el) => el.scrollWidth > el.clientWidth + 1),
          false,
          `overflow at ${width}`,
        );
        const box = await dialog().boundingBox();
        if (width === 1440)
          assert.ok(
            box.width > 1000,
            "desktop modal should retain its wide layout",
          );
        if (width === 390)
          assert.ok(
            Math.abs(box.width - 390) < 2,
            "mobile modal should fill the viewport",
          );
        assert.equal(
          await dialog()
            .locator(".vto-primary")
            .first()
            .evaluate((el) => getComputedStyle(el).color),
          "rgb(255, 255, 255)",
        );
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: path.join(out, `virtual-try-on-${width}.png`),
          });
        await page.keyboard.press("Escape");
      }
    },
  );
  await check(
    "real MediaPipe worker loads and rejects a synthetic image with no person",
    async () => {
      await page.unroute("**/vto-assets/check-photo.worker.js", mockWorker);
      await open();
      await dialog()
        .getByLabel("Upload your photo", { exact: true })
        .setInputFiles({
          name: "not-a-person.png",
          mimeType: "image/png",
          buffer: testImage(),
        });
      await dialog()
        .getByRole("alert")
        .filter({ hasText: "could not find a clear person" })
        .waitFor({ timeout: 65000 });
      await page.keyboard.press("Escape");
    },
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        passed,
        errors,
        testing:
          "Mock AI provider; synthetic test photo; most person-check scenarios stub the worker. One scenario loads the real MediaPipe model. No paid generation or visual realism validation.",
      },
      null,
      2,
    ),
  );
  console.log(`Completed ${passed.length} browser scenarios.`);
} catch (error) {
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  await vite.close();
  await new Promise((r) => api.close(r));
}