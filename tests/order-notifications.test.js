import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createOrderPushSession } from "../src/native/orderPushSession.js";
import { notificationApi } from "../src/services/notificationApi.js";
import { nativePushConfig, defaultPlugins } from "../scripts/native-push-config.mjs";
import { captureOrderPushOptOut, finishOrderPushOptOut } from "../src/native/orderPushCleanup.js";

const userId = "6ad2351ed8f991271e3d1a8b", now = 1793318400000;
test("logout can disable a previously enabled binding when the native push feature is rolled back", async () => {
  const rows = new Map(), storage = { getItem: key => rows.get(key), setItem: (key, value) => rows.set(key, value) };
  const original = { owner: userId, device: "a".repeat(64), binding: crypto.randomUUID(), optedIn: true };
  rows.set(`gymdrobe-order-push:${userId}`, JSON.stringify(original)); rows.set("gymdrobe-order-push:other", "untouched");
  const captured = captureOrderPushOptOut(userId, storage);
  assert.equal(JSON.parse(rows.get(`gymdrobe-order-push:${userId}`)).optedIn, false);
  const calls = []; await finishOrderPushOptOut(captured, { disable: async value => calls.push(value) }, storage);
  assert.deepEqual(calls, [{ device: original.device, binding: original.binding }]);
  assert.equal(JSON.parse(rows.get(`gymdrobe-order-push:${userId}`)).pendingDisable, false);
  assert.equal(rows.get("gymdrobe-order-push:other"), "untouched");
});
test("a rollback-build cleanup does not overwrite a newer opt-in or another account", async () => {
  const rows = new Map(), storage = { getItem: key => rows.get(key), setItem: (key, value) => rows.set(key, value) };
  const first = { owner: userId, device: "a".repeat(64), binding: crypto.randomUUID(), optedIn: true };
  rows.set(`gymdrobe-order-push:${userId}`, JSON.stringify(first));
  assert.equal(captureOrderPushOptOut("another-account", storage), null);
  const captured = captureOrderPushOptOut(userId, storage), next = { ...first, binding: crypto.randomUUID(), optedIn: true };
  rows.set(`gymdrobe-order-push:${userId}`, JSON.stringify(next));
  await finishOrderPushOptOut(captured, { disable: async () => {} }, storage);
  assert.deepEqual(JSON.parse(rows.get(`gymdrobe-order-push:${userId}`)), next);
});
test("failed rollback-build server cleanup leaves the opt-out and retry marker intact", async () => {
  const rows = new Map(), storage = { getItem: key => rows.get(key), setItem: (key, value) => rows.set(key, value) };
  rows.set(`gymdrobe-order-push:${userId}`, JSON.stringify({ owner: userId, device: "a".repeat(64), binding: crypto.randomUUID(), optedIn: true }));
  const captured = captureOrderPushOptOut(userId, storage);
  await assert.rejects(finishOrderPushOptOut(captured, { disable: async () => { throw new Error("offline"); } }, storage));
  const saved = JSON.parse(rows.get(`gymdrobe-order-push:${userId}`)); assert.equal(saved.optedIn, false); assert.equal(saved.pendingDisable, true);
});
function fixture({ available = true, permission = "prompt", storage: shared, saved, delay } = {}) {
  const memory = shared || new Map(), calls = [], handlers = {}, states = [], opened = [];
  const storage = { getItem: k => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) };
  if (saved) storage.setItem(`gymdrobe-order-push:${userId}`, JSON.stringify(saved));
  const plugin = {
    async addListener(name, callback) { handlers[name] = callback; return { remove: async () => { delete handlers[name]; } }; },
    async checkPermissions() { calls.push("check"); return { receive: permission }; },
    async requestPermissions() { calls.push("permission"); return { receive: "granted" }; },
    async register() { calls.push("register"); }, async unregister() { calls.push("unregister"); }, async createChannel() { calls.push("channel"); },
  };
  const device = "a".repeat(64);
  const api = { async read() { return { available, devices: saved?.device ? [{ _id: saved.device, binding: saved.binding, enabled: true }] : [] }; },
    async register(value) { calls.push({ register: value }); if (delay) await delay; return { device, binding: value.binding }; },
    async disable(value) { calls.push({ disable: value }); } };
  const session = createOrderPushSession({ userId, plugin, api, storage, platform: "ios", environment: "sandbox", now: () => now,
    uuid: () => crypto.randomUUID(), changed: value => states.push(value), openOrder: value => opened.push(value) });
  return { ...session, memory, handlers, calls, states, opened, api, plugin, device, get record() { return JSON.parse(memory.get(`gymdrobe-order-push:${userId}`)); } };
}
test("startup and an unavailable backend never prompt, register or collect a push token", async () => {
  for (const available of [true, false]) {
    const f = fixture({ available }); await f.start();
    assert.deepEqual(f.calls, []); assert.equal(f.states.at(-1).status, available ? "off" : "unavailable");
    if (!available) { await f.enable(); assert.deepEqual(f.calls, []); }
    await f.dispose();
  }
});
test("explicit opt-in checks permission, scopes the binding and keeps raw tokens out of storage", async () => {
  const f = fixture(); await f.start(); await f.enable();
  assert.deepEqual(f.calls, ["check", "permission", "register"]);
  await f.handlers.registration({ value: "9".repeat(64) });
  const posted = f.calls.find(value => value.register)?.register;
  assert.equal(posted.orderUpdates, true); assert.equal(posted.refresh, false); assert.equal(posted.platform, "ios");
  assert.equal(f.record.owner, userId); assert.equal(f.record.registered, true);
  assert.ok(!JSON.stringify([...f.memory.values()]).includes("9".repeat(64)));
  assert.equal(f.states.at(-1).status, "on"); await f.dispose();
});
test("a denied permission does not create a token or save an opt-in", async () => {
  const f = fixture({ permission: "denied" }); await f.start(); await f.enable();
  assert.deepEqual(f.calls, ["check"]); assert.equal(f.states.at(-1).status, "denied");
  assert.equal(f.memory.has(`gymdrobe-order-push:${userId}`), false); await f.dispose();
});
test("restart refreshes only a previously consented owned binding without prompting again", async () => {
  const saved = { owner: userId, installationId: crypto.randomUUID(), binding: crypto.randomUUID(), claimAt: now - 1000000, optedIn: true, registered: true, device: "a".repeat(64) };
  const f = fixture({ permission: "granted", saved }); await f.start();
  assert.deepEqual(f.calls, ["check", "register"]); await f.handlers.registration({ value: "b".repeat(64) });
  assert.equal(f.calls.find(value => value.register).register.refresh, true);
  assert.equal(f.record.binding, saved.binding); await f.dispose();
});
test("sign-out disables a registration acknowledged late and ignores subsequent callbacks", async () => {
  let release;
  const delay = new Promise(resolve => { release = resolve; });
  const f = fixture({ delay }); await f.start(); await f.enable();
  const callback = f.handlers.registration, registration = callback({ value: "a".repeat(64) });
  await new Promise(setImmediate);
  const stopped = f.dispose(); release(); await Promise.all([registration, stopped]);
  assert.equal(f.record.optedIn, false);
  assert.equal(f.calls.filter(value => value.disable).length, 1);
  assert.equal(f.calls.filter(value => value.register).length, 1);
  await callback({ value: "b".repeat(64) });
  assert.equal(f.calls.filter(value => value.register).length, 1);
  assert.equal(f.states.some(value => value.status === "on"), false);
});
test("opt-out retains a failed server cleanup for reconnect, while unregistering the native token", async () => {
  const f = fixture(); await f.start(); await f.enable(); await f.handlers.registration({ value: "a".repeat(64) });
  f.api.disable = async () => { throw new Error("offline"); };
  await f.disable(); assert.equal(f.record.optedIn, false); assert.equal(f.record.pendingDisable, true);
  assert.ok(f.calls.includes("unregister")); assert.equal(f.states.at(-1).status, "error");
  await f.dispose();
  const restored = fixture({ storage: f.memory }); await restored.start();
  assert.equal(restored.calls.filter(value => value.disable).length, 1); assert.equal(restored.record.pendingDisable, false);
  assert.equal(restored.calls.includes("register"), false); await restored.dispose();
});
test("notification taps accept only exact order URLs and disappear with the session", async () => {
  const f = fixture(); await f.start(); const tap = f.handlers.pushNotificationActionPerformed;
  for (const url of ["https://evil.test/orders/" + userId, "https://www.gymdrobe.com/admin", "https://www.gymdrobe.com/orders/" + userId + "?paid=true", "javascript:alert(1)"]) tap({ notification: { data: { url } } });
  assert.deepEqual(f.opened, []);
  tap({ notification: { data: { url: "https://www.gymdrobe.com/orders/" + userId } } });
  assert.deepEqual(f.opened, ["/orders/" + userId]); await f.dispose();
  tap({ notification: { data: { url: "https://www.gymdrobe.com/orders/" + userId } } }); assert.equal(f.opened.length, 1);
});
test("notification APIs use authenticated no-store requests without exposing tokens in URLs", async () => {
  const calls = [], api = notificationApi("fixture-jwt", { request: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ success: true }) }; } });
  await api.read(); await api.register({ token: "device-token" }); await api.disable({ device: "opaque" });
  assert.deepEqual(calls.map(call => call.options.method), ["GET", "POST", "DELETE"]);
  for (const call of calls) { assert.equal(call.options.cache, "no-store"); assert.equal(call.options.headers.Authorization, "Bearer fixture-jwt"); assert.ok(!call.url.includes("token")); }
});
test("unconfigured native builds exclude Firebase and iOS push requires an explicit environment", () => {
  const config = { includePlugins: ["@capacitor/push-notifications"], android: { includePlugins: ["@capacitor/push-notifications"] } };
  const disabled = nativePushConfig(config, {}, "android"); assert.deepEqual(disabled.includePlugins, defaultPlugins);
  assert.equal(disabled.android.includePlugins, undefined);
  assert.throws(() => nativePushConfig(config, { VITE_PUSH_ENABLED: "true" }, "ios"));
  assert.throws(() => nativePushConfig(config, { VITE_PUSH_ENABLED: "true" }, "android"));
  assert.throws(() => nativePushConfig(config, { VITE_PUSH_ENABLED: "true" }, "android", { project_info: { project_id: "fixture" }, client: [{ client_info: { android_client_info: { package_name: "wrong.app" } } }] }));
  assert.ok(nativePushConfig(config, { VITE_PUSH_ENABLED: "true", VITE_APNS_ENVIRONMENT: "sandbox" }, "ios").includePlugins.includes("@capacitor/push-notifications"));
});
