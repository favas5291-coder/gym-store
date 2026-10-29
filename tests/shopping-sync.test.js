import test from "node:test";
import assert from "node:assert/strict";
import { compactShopping, shoppingChanges, initializeShoppingJournal, pendingShopping, appendShopping, acknowledgeShopping, journalPrefix } from "../src/utils/shoppingJournal.js";
import { createShoppingSync } from "../src/utils/shoppingSync.js";
import { importGuestShopping } from "../src/utils/shopperStorage.js";
import { userKey } from "../src/utils/storage.js";
import { shoppingApi } from "../src/services/shoppingApi.js";

const user = { id: "507f1f77bcf86cd799439011" };
const productId = "507f1f77bcf86cd799439015";
const row = { id: productId, quantity: 1, selectedSize: "M", selectedColor: "Black", price: 1000 };
const line = { productId, selectedSize: "M", selectedColor: "Black" };
const clone = value => structuredClone(value);
function storage() {
  const data = new Map();
  return { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function server() {
  let state = { version: 1, revision: 0, cart: [], wishlist: [], updatedAt: null };
  const receipts = new Map();
  let loseReply = false, rejectOld = false;
  const api = {
    async read() { return { success: true, state: clone(state) }; },
    async mutate(op) {
      const fingerprint = JSON.stringify(op.changes);
      if (receipts.has(op.id)) {
        assert.equal(receipts.get(op.id), fingerprint);
        return { success: true, state: clone(state), duplicate: true };
      }
      if (rejectOld && op.changes[0]?.type !== "replace") throw Object.assign(new Error("Review offline changes"), { code: "SHOPPING_REVIEW_REQUIRED", status: 409 });
      if (op.baseRevision !== state.revision) throw Object.assign(new Error("Changed on another device"), { code: "SHOPPING_REVISION_CONFLICT", status: 409, data: { state: clone(state) } });
      const cart = new Map(state.cart.map(row => [JSON.stringify([row.productId, row.selectedSize, row.selectedColor]), row]));
      const key = row => JSON.stringify([row.productId, row.selectedSize, row.selectedColor]);
      let wishes = new Set(state.wishlist);
      for (const change of op.changes) {
        if (change.type === "seed") {
          for (const row of change.selection.cart) cart.set(key(row), { ...row, quantity: Math.max(cart.get(key(row))?.quantity || 0, row.quantity) });
          for (const id of change.selection.wishlist) wishes.add(id);
        } else if (change.type === "adjust") {
          const quantity = (cart.get(key(change.line))?.quantity || 0) + change.delta;
          if (quantity <= 0) cart.delete(key(change.line));
          else cart.set(key(change.line), { ...change.line, quantity });
        } else if (change.type === "remove") cart.delete(key(change.line));
        else if (change.type === "wish") { if (change.saved) wishes.add(change.productId); else wishes.delete(change.productId); }
        else if (change.type === "replace") {
          assert.equal(change.confirmed, true);
          cart.clear(); for (const row of change.selection.cart) cart.set(key(row), row);
          wishes = new Set(change.selection.wishlist);
        }
      }
      state = { ...state, revision: state.revision + 1, cart: [...cart.values()], wishlist: [...wishes] };
      receipts.set(op.id, fingerprint);
      if (loseReply) { loseReply = false; throw new Error("Fixture network interruption after commit"); }
      return { success: true, state: clone(state) };
    },
  };
  return { api, loseNextReply() { loseReply = true; }, requireReview() { rejectOld = true; }, state: () => clone(state) };
}
function device(api, data = storage()) {
  let visible, status;
  const engine = createShoppingSync({ user, storage: data, api,
    publish: value => { visible = clone(value); }, status: value => { status = value; },
    snapshot: () => ({ cart: [{ ...line, quantity: 4 }], wishlist: [productId] }),
  });
  return { engine, data, visible: () => visible, status: () => status };
}

test("shopping synchronization sends choices rather than client prices or payment data", () => {
  const compact = compactShopping([{ ...row, paymentStatus: "paid" }], [row]);
  assert.deepEqual(compact, { cart: [{ ...line, quantity: 1 }], wishlist: [productId] });
  const changes = shoppingChanges(compact, compactShopping([{ ...row, quantity: 3 }, { ...row, selectedSize: "L" }], []));
  assert.deepEqual(changes, [
    { type: "adjust", line, delta: 2 },
    { type: "adjust", line: { ...line, selectedSize: "L" }, delta: 1 },
    { type: "wish", productId, saved: false },
  ]);
});

test("each tab journals immutable independent changes without replacing another pending edit", () => {
  const data = storage();
  initializeShoppingJournal(user, { storage: data });
  const first = appendShopping(user, [{ type: "adjust", line, delta: 1 }], { storage: data });
  const second = appendShopping(user, [{ type: "adjust", line, delta: 2 }], { storage: data });
  assert.equal(pendingShopping(user, { storage: data }).length, 3);
  acknowledgeShopping(user, first, { storage: data });
  acknowledgeShopping(user, first, { storage: data });
  assert.ok(pendingShopping(user, { storage: data }).some(op => op.id === second.id));
});

test("a lost server acknowledgement survives restart without doubling bag quantity", async () => {
  const backend = server(), first = device(backend.api);
  await first.engine.flush();
  appendShopping(user, [{ type: "adjust", line, delta: 2 }], { storage: first.data });
  backend.loseNextReply();
  await first.engine.flush();
  assert.equal(first.status(), "offline");
  assert.equal(pendingShopping(user, { storage: first.data }).length, 1);
  first.engine.dispose();
  const restarted = device(backend.api, first.data);
  await restarted.engine.flush();
  assert.equal(restarted.visible().cart[0].quantity, 2);
  assert.equal(backend.state().cart[0].quantity, 2);
  assert.deepEqual(pendingShopping(user, { storage: first.data }), []);
});

test("two devices rebase concurrent quantity edits and converge after refresh", async () => {
  const backend = server(), phone = device(backend.api), website = device(backend.api);
  await Promise.all([phone.engine.flush(), website.engine.flush()]);
  appendShopping(user, [{ type: "adjust", line, delta: 1 }], { storage: phone.data });
  appendShopping(user, [{ type: "adjust", line, delta: 2 }, { type: "wish", productId, saved: true }], { storage: website.data });
  await Promise.all([phone.engine.flush(), website.engine.flush()]);
  await phone.engine.flush();
  assert.equal(phone.visible().cart[0].quantity, 3);
  assert.equal(website.visible().cart[0].quantity, 3);
  assert.deepEqual(phone.visible().wishlist, [productId]);
});

test("logout during a request cannot publish another account's state or clear its pending change", async () => {
  let finish;
  const d = device({ read: () => new Promise(resolve => { finish = resolve; }), mutate() { throw new Error("Must not mutate after disposal"); } });
  const flushing = d.engine.flush();
  d.engine.dispose();
  finish({ state: { version: 1, revision: 0, cart: [], wishlist: [] } });
  await flushing;
  assert.equal(d.visible(), undefined);
  assert.equal(pendingShopping(user, { storage: d.data }).length, 1);
});

test("reviewing expired changes replaces only after explicit confirmation and does not replay discarded operations", async () => {
  const backend = server(), d = device(backend.api);
  await d.engine.flush();
  appendShopping(user, [{ type: "adjust", line, delta: 9 }], { storage: d.data });
  backend.requireReview();
  await d.engine.flush();
  assert.equal(d.status(), "review");
  assert.equal(backend.state().cart.length, 0);
  await d.engine.keepDevice();
  assert.equal(d.status(), "saved");
  assert.equal(backend.state().cart[0].quantity, 4);
  assert.equal(pendingShopping(user, { storage: d.data }).length, 0);
});

test("choosing account lists preserves edits added while the review request is running", async () => {
  const backend = server(), d = device(backend.api);
  await d.engine.flush();
  appendShopping(user, [{ type: "adjust", line, delta: 9 }], { storage: d.data });
  const realRead = backend.api.read;
  let finish;
  backend.api.read = () => new Promise(resolve => { finish = resolve; });
  const choosing = d.engine.useAccount();
  appendShopping(user, [{ type: "adjust", line, delta: 2 }], { storage: d.data });
  backend.api.read = realRead;
  finish(await realRead());
  await choosing;
  assert.equal(d.visible().cart[0].quantity, 2);
});

test("unavailable device storage does not overwrite the local bag or contact the server", async () => {
  const data = storage(); data.getItem = () => { throw new Error("Device storage blocked"); };
  const d = device({ read() { throw new Error("Must not contact server without durable changes"); } }, data);
  await d.engine.flush();
  assert.equal(d.status(), "storage");
  assert.equal(d.visible(), undefined);
});

test("failed authentication keeps pending changes for a later verified session", async () => {
  const backend = server(), d = device({ read: async () => { throw Object.assign(new Error("Session expired"), { status: 401 }); } });
  await d.engine.flush();
  assert.equal(d.status(), "sign-in");
  assert.equal(pendingShopping(user, { storage: d.data }).length, 1);
  d.engine.dispose();
  const signedIn = device(backend.api, d.data);
  await signedIn.engine.flush();
  assert.equal(signedIn.status(), "saved");
});

test("an interrupted guest transfer journals the addition once and retains the guest copy until saved", async () => {
  const previous = globalThis.localStorage;
  const data = storage(); globalThis.localStorage = data;
  try {
    data.setItem(userKey("gymdrobe-cart", user), JSON.stringify([row]));
    data.setItem("gymdrobe-cart", JSON.stringify([{ ...row, quantity: 2 }]));
    initializeShoppingJournal(user, { storage: data });
    const onTransfer = ({ base, before, after, id, issuedAt }) => {
      if (base !== "gymdrobe-cart") return;
      appendShopping(user, shoppingChanges(compactShopping(before, []), compactShopping(after, [])), { storage: data, id, issuedAt });
    };
    const remove = data.removeItem;
    data.removeItem = key => { if (key !== "gymdrobe-cart") remove(key); };
    const first = importGuestShopping(user, { onTransfer });
    assert.equal(first.pending.length, 1);
    assert.notEqual(data.getItem("gymdrobe-cart"), null);
    data.removeItem = remove;
    const retry = importGuestShopping(user, { onTransfer });
    assert.equal(retry.pending.length, 0);
    const pending = pendingShopping(user, { storage: data });
    assert.equal(pending.filter(op => op.changes[0].type === "adjust").length, 1);
    const backend = server(), d = device(backend.api, data);
    await d.engine.flush();
    assert.equal(backend.state().cart[0].quantity, 3);
    assert.equal(data.getItem("gymdrobe-cart"), null);
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});

test("shopping API uses authenticated uncached requests and preserves conflict state for rebasing", async () => {
  let captured;
  const api = shoppingApi("fixture-session", { request: async (url, options) => {
    captured = { url, ...options };
    return { ok: false, status: 409, json: async () => ({ success: false, code: "SHOPPING_REVISION_CONFLICT", state: { revision: 8 } }) };
  } });
  await assert.rejects(api.mutate({ id: "fixture-change" }), error => error.data.state.revision === 8);
  assert.equal(captured.cache, "no-store");
  assert.equal(captured.headers.Authorization, "Bearer fixture-session");
  assert.equal(captured.method, "POST");
  assert.equal(JSON.parse(captured.body).id, "fixture-change");
});

test("one account cannot enumerate another account's pending changes", () => {
  const data = storage(), other = { id: "507f1f77bcf86cd799439012" };
  initializeShoppingJournal(user, { storage: data });
  initializeShoppingJournal(other, { storage: data });
  const own = pendingShopping(user, { storage: data }), theirs = pendingShopping(other, { storage: data });
  assert.equal(own.length, 1); assert.equal(theirs.length, 1);
  acknowledgeShopping(user, own[0], { storage: data });
  assert.equal(pendingShopping(other, { storage: data }).length, 1);
  assert.notEqual(journalPrefix(user), journalPrefix(other));
});
