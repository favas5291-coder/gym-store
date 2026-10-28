// Mobile-sized WebKit engine regression; this is NOT a physical iPhone or
// a Low Power Mode emulator. Manual iPhone ON/OFF verification is still required.
import assert from "node:assert/strict";
import { webkit } from "playwright";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";

const fixture = await startStorefrontFixture(4219);
let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  await mockStorefront(context, fixture.products);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const visit = async path => {
    await page.goto(fixture.url + path, { waitUntil: "domcontentloaded" });
    await page.locator(".cinema-film").waitFor();
  };

  async function assertAdvancing(label) {
    await page.waitForFunction(() => {
      const video = document.querySelector(".cinema-film");
      return !!video && !video.paused && video.currentTime > 0.25 && video.videoWidth > 0;
    }, null, { timeout: 25000 });

    const before = await page.locator(".cinema-film").evaluate(v => v.currentTime);
    await page.waitForTimeout(1000);
    const result = await page.locator(".cinema-film").evaluate(video => ({
      paused: video.paused,
      currentTime: video.currentTime,
      muted: video.muted,
      defaultMuted: video.defaultMuted,
      inline: video.playsInline,
      loop: video.loop,
      controls: video.controls,
      fullscreen: Boolean(video.webkitDisplayingFullscreen),
      opacity: getComputedStyle(video).opacity,
      readyState: video.readyState,
      videoWidth: video.videoWidth,
    }));
    assert.ok(!result.paused && result.currentTime > before + 0.2, label + " not advancing: " + JSON.stringify(result));
    assert.ok(result.muted && result.defaultMuted && result.inline && result.loop && !result.controls && !result.fullscreen);
    assert.ok(Number(result.opacity) > 0.9, label + " video hidden by poster CSS");
    console.log("PASS WebKit", label, JSON.stringify(result));
  }

  await visit("/?heroDebug=1");
  await assertAdvancing("initial muted inline autoplay");
  const diagnostics = await page.waitForFunction(() => window.__gymdrobeHeroVideoState?.());
  const snapshot = await diagnostics.jsonValue();
  assert.ok(snapshot.videoWidth > 0 && snapshot.playAttempts > 0, JSON.stringify(snapshot));
  assert.equal(snapshot.lastPlayError, null);

  for (let cycle = 0; cycle < 2; cycle++) {
    await page.locator(".cinema-film").evaluate(video => {
      video.currentTime = Math.max(0, video.duration - 0.18);
    });
    await page.waitForFunction(() => {
      const video = document.querySelector(".cinema-film");
      return video && video.currentTime < 1 && !video.paused;
    }, null, { timeout: 25000 });
  }
  console.log("PASS WebKit two loop transitions");

  await page.evaluate(() => scrollTo(0, 1600));
  await page.waitForTimeout(400);
  await page.evaluate(() => scrollTo(0, 0));
  await assertAdvancing("after viewport re-entry");

  await page.reload({ waitUntil: "domcontentloaded" });
  await assertAdvancing("after hard reload");

  await page.getByRole("link", { name: /Shop Now/ }).click();
  await page.waitForURL("**/shop");
  await page.goBack();
  await assertAdvancing("after navigating home");

  assert.equal(await page.locator(".cinema-play-fallback,.cinema-control").count(), 0);
  console.log("PASS WebKit mobile-sized test; real iPhone low-power testing remains manual");
  await context.close();
} finally {
  await browser?.close();
  await fixture.server.close();
}
