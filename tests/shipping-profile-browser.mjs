// Runs only inside the loopback marketplace browser fixture.
import assert from "node:assert/strict";
import path from "node:path";

export async function verifyShippingProfile(page, fixture, output) {
  const { Product, fixtures } = fixture;
  const baseProduct = {
    brand: fixtures.draft.brand,
    category: fixtures.draft.category,
    price: 550,
    image: fixtures.draft.images[0],
    images: fixtures.draft.images,
    sizes: ["M"],
    colors: ["Black"],
    stock: 3,
    variants: { Black: { M: 3 } },
    isActive: true,
    delivery: { available: true },
  };
  const fulfillment = {
    stockSource: "gymdrobe",
    dispatchBy: "gymdrobe",
    preparationDaysMin: 1,
    preparationDaysMax: 2,
  };
  await Product.create([
    { ...baseProduct, name: "Fixture shipping ready", slug: "fixture-shipping-ready", sku: "FIX-SHIP-READY", fulfillment },
    { ...baseProduct, name: "Fixture shipping missing preparation", slug: "fixture-shipping-missing", sku: "FIX-SHIP-MISSING", fulfillment: { stockSource: "gymdrobe", dispatchBy: "gymdrobe" } },
    { ...baseProduct, name: "Fixture shipping wrong origin", slug: "fixture-shipping-origin", sku: "FIX-SHIP-ORIGIN", fulfillment: { ...fulfillment, stockSource: "supplier", dispatchBy: "supplier" } },
  ]);

  const api = (route = "", { actor, method = "GET", body } = {}) =>
    fetch(fixture.apiURL + "/shipping-profiles" + route, {
      method,
      headers: {
        ...(actor && { Authorization: "Bearer " + fixture.token(actor) }),
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body && JSON.stringify(body),
    });
  assert.equal((await api()).status, 401);
  const forbidden = await api("", { actor: fixture.customer });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("cache-control"), "no-store");

  const field = name => page.locator("label.shipping-field")
    .filter({ has: page.getByText(name, { exact: true }) })
    .locator("input, select, textarea");
  const button = name => page.getByRole("button", { name, exact: true });
  await page.goto(fixture.url + "/admin/shipping-profiles");
  await button("Add shipping profile").click();
  await field("Profile name").fill("Fixture Kozhikode Standard");
  await field("Origin type").selectOption("gymdrobe");
  await field("Find a product by name, brand or SKU").fill("Fixture shipping");
  await button("Search / reload products").click();

  const product = name => page.locator(".shipping-option").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
  for (const [name, reason] of [
    ["Fixture shipping missing preparation", "Record product preparation times first."],
    ["Fixture shipping wrong origin", "Configure GymDrobe-held stock and direct dispatch first."],
  ]) {
    const row = product(name);
    await row.getByText(reason, { exact: true }).waitFor();
    assert.equal(await row.getByRole("button", { name: "Add product" }).isEnabled(), false);
  }
  await product("Fixture shipping ready").getByRole("button", { name: "Add product" }).click();

  for (const [name, value] of [
    ["Actual dispatch origin name", "Fixture dispatch"],
    ["Actual pickup pincode", "673001"],
    ["Exact destination pincodes", "673001"],
    ["Courier name", "Fixture Courier"],
    ["Courier service name", "Standard prepaid"],
    ["Minimum courier transit days", "2"],
    ["Maximum courier transit days", "5"],
    ["Maximum packed weight (grams)", "1000"],
    ["Maximum parcel length (mm)", "300"],
    ["Maximum parcel width (mm)", "250"],
    ["Maximum parcel height (mm)", "150"],
    ["Maximum product units per parcel", "1"],
    ["Complete customer shipping charge (INR)", "79.00"],
  ]) await field(name).fill(value);

  const mutation = (method, suffix, action) => Promise.all([
    page.waitForResponse(response => response.request().method() === method &&
      new URL(response.url()).pathname.endsWith(suffix)),
    action(),
  ]).then(([response]) => response);
  const created = await mutation("POST", "/shipping-profiles", () => button("Save draft profile").click());
  assert.equal(created.status(), 201);
  const { profile } = await created.json();
  assert.equal(profile.status, "draft");
  assert.equal(profile.charges.shippingPaise, 7900);

  const section = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "6. Confirm and activate" }),
  });
  const agreement = field("Actual courier coverage and rate agreement reference");
  const expiry = field("Agreement expiry date and time");
  const acknowledgment = page.getByRole("checkbox", { name: /I have verified this courier/ });
  const confirm = button("Confirm actual courier terms");
  const activate = button("Activate profile");
  await agreement.fill("FIXTURE-RATE-001");
  await acknowledgment.check();

  // Native datetime-local exposes an empty value until date and time are complete.
  await expiry.evaluate(input => {
    input.value = "2030-01-01";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await expiry.inputValue(), "");
  assert.equal(await confirm.isEnabled(), false);
  assert.equal(await activate.isEnabled(), false);
  await section.getByText(/Enter both an expiry date and a time/).waitFor({ timeout: 3000 });
  assert.equal(await expiry.getAttribute("aria-describedby"), "shipping-agreement-expiry-help");
  await section.screenshot({ path: path.join(output, "shipping-profile-incomplete-expiry.png") });

  const expired = await api("/" + profile.id + "/confirm", {
    actor: fixture.admin, method: "POST",
    body: { version: profile.version, arrangementReference: "FIXTURE-RATE-001", validUntil: "2000-01-01T10:00:00Z" },
  });
  assert.equal(expired.status, 400);
  assert.match((await expired.json()).message, /valid future date/i);

  const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16);
  await expiry.fill(future);
  assert.equal(await acknowledgment.isChecked(), false);
  await acknowledgment.check();
  assert.equal(await confirm.isEnabled(), true);
  await agreement.fill("FIXTURE-RATE-002");
  assert.equal(await acknowledgment.isChecked(), false);
  assert.equal(await confirm.isEnabled(), false);
  await acknowledgment.check();
  const confirmed = await mutation("POST", "/confirm", () => confirm.click());
  assert.equal(confirmed.status(), 200);
  assert.equal((await confirmed.json()).profile.verification.arrangementReference, "FIXTURE-RATE-002");
  await section.getByText("Reference: FIXTURE-RATE-002", { exact: true }).waitFor();

  const profilePath = "/shipping-profiles/" + profile.id;
  const activated = await mutation("PUT", profilePath, () => activate.click());
  assert.equal(activated.status(), 200);
  assert.equal((await activated.json()).profile.status, "active");
  await page.getByText("Profile status: active.", { exact: true }).waitFor();
  await section.screenshot({ path: path.join(output, "shipping-profile-active-fixture.png") });

  await field("Complete customer shipping charge (INR)").fill("85.00");
  const changed = await mutation("PUT", profilePath, () => button("Save changes").click());
  assert.equal(changed.status(), 200);
  const updated = (await changed.json()).profile;
  assert.equal(updated.status, "paused");
  assert.equal(updated.verification.confirmedAt, null);
  await section.getByText("Confirmed: Not recorded", { exact: true }).waitFor();
  assert.equal(await activate.isEnabled(), false);
  await page.waitForLoadState("networkidle");
}
