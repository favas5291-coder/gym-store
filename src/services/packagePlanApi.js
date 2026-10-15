const API_URL = String(import.meta.env.VITE_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");
const ID = /^[a-f0-9]{24}$/i;
const KEY = /^[a-z][a-z0-9-]{0,59}$/;
const STATES = ["draft", "active", "paused", "archived"];
export const MEASUREMENTS = [
  ["weightGrams", "Packed weight (grams)", 500000],
  ["lengthMm", "Length (mm)", 10000],
  ["widthMm", "Width (mm)", 10000],
  ["heightMm", "Height (mm)", 10000],
];
const whole = (value, max, min = 0) => Number.isSafeInteger(value) && value >= min && value <= max;
const object = value => value && typeof value === "object" && !Array.isArray(value);
const optionalId = value => value == null || (typeof value === "string" && ID.test(value));

export function packageAllocationIssues(plan) {
  const totals = new Map();
  const issues = [];
  for (const parcel of plan.parcels) {
    if (!parcel.contents.length) issues.push(`${parcel.label || parcel.key}: select its contents.`);
    for (const row of parcel.contents) totals.set(row.componentKey, (totals.get(row.componentKey) || 0) + row.quantity);
    if (MEASUREMENTS.some(([key, , max]) => !whole(parcel[key], max, 1))) issues.push(`${parcel.label || parcel.key}: record actual packed weight and dimensions.`);
  }
  for (const row of plan.components) {
    const allocated = totals.get(row.key) || 0;
    if (allocated !== row.quantity) issues.push(`${row.key}: ${allocated} of ${row.quantity} units allocated. Allocate each unit exactly once.`);
  }
  if (!plan.components.length || !plan.parcels.length) issues.push("Choose components and at least one parcel.");
  return issues;
}

// Whitelist editable fields. Confirmation identity and dates belong to the server.
export function packagePlanBody(plan) {
  if (!object(plan) || typeof plan.name !== "string" || plan.name.trim().length < 2 || plan.name.trim().length > 200) throw new Error("Enter a plan name with 2–200 characters.");
  if (!STATES.includes(plan.status)) throw new Error("Choose a valid plan status.");
  const origin = plan.origin;
  if (!object(origin) || !["unconfigured", "gymdrobe", "supplier", "packing-location"].includes(origin.kind)) throw new Error("Choose the dispatch origin.");
  if (typeof origin.name !== "string" || origin.name.length > 200 || typeof origin.pickupPincode !== "string" || (origin.pickupPincode && !/^[1-9]\d{5}$/.test(origin.pickupPincode))) throw new Error("Check the origin name and six-digit pickup pincode.");
  if (!optionalId(origin.supplier) || !optionalId(origin.packingLocation)) throw new Error("Choose a valid supplier or packing location.");
  if (!Array.isArray(plan.components) || !Array.isArray(plan.parcels) || plan.components.length > 50 || plan.parcels.length > 50) throw new Error("Use at most 50 components and 50 parcels.");
  const variants = new Set();
  const keys = new Set();
  const components = plan.components.map(row => {
    if (!object(row) || !KEY.test(row.key) || keys.has(row.key) || typeof row.product !== "string" || !ID.test(row.product) || !whole(row.quantity, 999, 1)) throw new Error("Each component needs a unique key, product and quantity from 1 to 999.");
    keys.add(row.key);
    for (const field of ["selectedSize", "selectedColor"]) if (row[field] != null && (typeof row[field] !== "string" || row[field].length > 200)) throw new Error("Check the selected product variants.");
    const selectedSize = row.selectedSize || null, selectedColor = row.selectedColor || null;
    const variant = JSON.stringify([row.product.toLowerCase(), selectedSize, selectedColor]);
    if (variants.has(variant)) throw new Error("Combine matching product variants into one component and adjust its quantity.");
    variants.add(variant);
    return {key: row.key, product: row.product, selectedSize, selectedColor, quantity: row.quantity};
  });
  const parcelKeys = new Set();
  const parcels = plan.parcels.map(row => {
    if (!object(row) || !KEY.test(row.key) || parcelKeys.has(row.key) || typeof row.label !== "string" || row.label.length > 150 || !Array.isArray(row.contents) || row.contents.length > 50) throw new Error("Check parcel names and contents. Each parcel needs a unique key.");
    parcelKeys.add(row.key);
    const measurements = Object.fromEntries(MEASUREMENTS.map(([field, , max]) => {
      if (row[field] != null && !whole(row[field], max, 1)) throw new Error(`${field}: enter a positive whole number up to ${max}, or leave it blank in a draft.`);
      return [field, row[field] ?? null];
    }));
    const allocated = new Set();
    const contents = row.contents.map(item => {
      if (!object(item) || !keys.has(item.componentKey) || allocated.has(item.componentKey) || !whole(item.quantity, 999, 1)) throw new Error("Allocate existing components once per parcel, using quantities from 1 to 999.");
      allocated.add(item.componentKey);
      return {componentKey: item.componentKey, quantity: item.quantity};
    });
    return {key: row.key, label: row.label, ...measurements, contents};
  });
  if (typeof plan.notes !== "string" || plan.notes.length > 2000) throw new Error("Notes must contain at most 2,000 characters.");
  return {
    name: plan.name.trim(), status: plan.status,
    origin: {kind: origin.kind, name: origin.name.trim(), pickupPincode: origin.pickupPincode, supplier: origin.kind === "supplier" ? origin.supplier : null, packingLocation: origin.kind === "packing-location" ? origin.packingLocation : null},
    components, parcels, notes: plan.notes,
  };
}

function planId(value) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("Package plan ID is invalid.");
  return encodeURIComponent(value.toLowerCase());
}
function checkRecord(record) {
  planId(record?.id);
  if (!whole(record.version, Number.MAX_SAFE_INTEGER)) throw new Error("Reload the plan to get its current version before saving.");
}
function validPlan(plan) {
  try {
    checkRecord(plan);
    packagePlanBody(plan);
    return typeof plan.ready === "boolean" && plan.purchaseEnabled === false && whole(plan.packageCount, 50) && plan.packageCount === plan.parcels.length && Array.isArray(plan.readinessIssues) && plan.readinessIssues.every(issue => typeof issue === "string") && object(plan.verification);
  } catch { return false; }
}
async function request(token, path, {method = "GET", body, signal} = {}) {
  if (typeof token !== "string" || !token.trim()) throw new Error("Please sign in as an admin.");
  if (signal?.aborted) throw new DOMException("Request cancelled.", "AbortError");
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, {once: true});
  const timer = setTimeout(abort, 45000);
  try {
    const response = await fetch(`${API_URL}/package-plans${path}`, {
      method, signal: controller.signal, cache: "no-store",
      headers: {Accept: "application/json", Authorization: `Bearer ${token.trim()}`, ...(body === undefined ? {} : {"Content-Type": "application/json"})},
      body: serialized,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true) {
      const error = new Error(typeof data?.message === "string" ? data.message : "The package service returned an unreadable response.");
      error.status = response.status;
      error.resultUnknown = method !== "GET" && (response.status >= 500 || response.ok || !data);
      throw error;
    }
    return data;
  } catch (failure) {
    if (failure.status || (method === "GET" && signal?.aborted)) throw failure;
    const error = new Error(method === "GET" ? "Cannot load package plans. Check your connection and retry." : "The save result is unknown. Reload before trying again.");
    error.resultUnknown = method !== "GET";
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
function readPlan(data, writing = false, expectedId = "") {
  if (!validPlan(data.plan) || (expectedId && data.plan.id.toLowerCase() !== expectedId.toLowerCase())) {
    const error = new Error("The package plan could not be read. Reload before another save.");
    error.resultUnknown = writing;
    throw error;
  }
  return data.plan;
}
export async function getPackagePlans(token, {page = 1, search = "", status = "", signal} = {}) {
  if (!whole(page, 100000, 1) || typeof search !== "string" || search.trim().length > 100 || (status && !STATES.includes(status))) throw new Error("Check the search, status and page filters.");
  const query = new URLSearchParams({page: String(page), limit: "12", search: search.trim(), status});
  const data = await request(token, `?${query}`, {signal});
  if (!Array.isArray(data.plans) || !data.plans.every(validPlan) || !whole(data.page, 100000, 1) || !whole(data.pages, Number.MAX_SAFE_INTEGER, 1) || !whole(data.total, Number.MAX_SAFE_INTEGER)) throw new Error("The package plan list could not be read.");
  return data;
}
export async function getPackagePlan(token, id, options = {}) {
  return readPlan(await request(token, `/${planId(id)}`, {...options, method: "GET"}), false, id);
}
export async function savePackagePlan(token, record, body, options = {}) {
  if (record?.id) checkRecord(record);
  const clean = packagePlanBody(body);
  return readPlan(await request(token, record?.id ? `/${planId(record.id)}` : "", {
    ...options, method: record?.id ? "PUT" : "POST", body: record?.id ? {...clean, version: record.version} : clean,
  }), true, record?.id || "");
}
export async function confirmPackagePlan(token, record, {measurementReference, validUntil} = {}, options = {}) {
  checkRecord(record);
  if (!["draft", "paused"].includes(record.status)) throw new Error("Save as draft or paused before confirming measurements.");
  if (typeof measurementReference !== "string" || !measurementReference.trim() || measurementReference.trim().length > 200) throw new Error("Enter the actual measurement reference, up to 200 characters.");
  if (typeof validUntil !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(validUntil) || !Number.isFinite(Date.parse(validUntil)) || Date.parse(validUntil) <= Date.now()) throw new Error("Choose a future measurement review expiry with a timezone.");
  const plan = readPlan(await request(token, `/${planId(record.id)}/confirm`, {...options, method: "POST", body: {version: record.version, measurementReference: measurementReference.trim(), validUntil}}), true, record.id);
  if (!plan.verification.confirmedAt || !plan.verification.confirmedBy || plan.verification.measurementReference !== measurementReference.trim() || Date.parse(plan.verification.validUntil) !== Date.parse(validUntil)) {
    const error = new Error("Measurement confirmation could not be verified. Reload before trying again."); error.resultUnknown = true; throw error;
  }
  return plan;
}
