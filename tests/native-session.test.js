import test from "node:test";
import assert from "node:assert/strict";
import { createSessionStorage, TOKEN_KEY } from "../src/native/session.js";

function fixture(token = null) {
  const map = new Map(token ? [[TOKEN_KEY, token]] : []);
  const storage = { getItem: (key) => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
  let value;
  const secure = { read: async () => ({ token: value }), write: async ({ token }) => { value = token; }, clear: async () => { value = null; } };
  return { storage, secure, value: () => value };
}
test("iOS migrates the browser JWT to Keychain and removes the browser copy", async () => {
  const f = fixture("legacy-session");
  const session = createSessionStorage({ ios: true, ...f });
  assert.equal(await session.read(), "legacy-session");
  assert.equal(f.value(), "legacy-session");
  assert.equal(f.storage.getItem(TOKEN_KEY), undefined);
  assert.equal(await session.read(), "legacy-session");
});
test("failed Keychain migration preserves the existing session for a retry", async () => {
  const f = fixture("legacy-session");
  f.secure.write = async () => { throw new Error("device locked"); };
  const session = createSessionStorage({ ios: true, ...f });
  await assert.rejects(session.read(), /locked/);
  assert.equal(f.storage.getItem(TOKEN_KEY), "legacy-session");
});
test("logout waits for an outstanding secure write and removes it", async () => {
  const f = fixture();
  const session = createSessionStorage({ ios: true, ...f });
  await Promise.all([session.write("new-session"), session.write(null)]);
  assert.equal(await session.read(), null);
  assert.equal(f.value(), null);
});
test("web and existing Android sessions retain the established browser storage", async () => {
  const f = fixture("existing-session");
  f.secure.read = async () => { throw new Error("must not access Keychain"); };
  const session = createSessionStorage({ ios: false, ...f });
  assert.equal(await session.read(), "existing-session");
  await session.write("replacement");
  assert.equal(f.storage.getItem(TOKEN_KEY), "replacement");
  await session.write(null);
  assert.equal(await session.read(), null);
});
test("storage-restricted browsers can browse as guests without claiming a persisted login", async () => {
  const unavailable = () => { throw new Error("Storage blocked"); };
  const session = createSessionStorage({ ios: false, secure: { read: unavailable }, storage: { getItem: unavailable, setItem: unavailable, removeItem: unavailable } });
  assert.equal(await session.read(), null);
  await assert.rejects(session.write("session"), /Storage blocked/);
});
