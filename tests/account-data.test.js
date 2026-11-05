import test from "node:test";
import assert from "node:assert/strict";
import { clearDeletedAccountData } from "../src/native/accountData.js";

function storage(values) {
  const area = { ...values };
  Object.defineProperties(area, {
    getItem: { value: (key) => area[key] ?? null },
    setItem: { value: (key, value) => { area[key] = value; } },
    removeItem: { value: (key) => { delete area[key]; } },
  });
  return area;
}
test("account deletion clears only the affected customer's local shopping and support records", () => {
  const local = storage({ "gymdrobe-cart:alice": "private", "gymdrobe-cart:bob": "other", "gymdrobe-cart": "guest", "unrelated:alice": "keep", "gymdrobe-shopping-sync::alice:op:fixture": "private", "gymdrobe-shopping-sync::bob:op:fixture": "other", "gymdrobe-support-tickets": JSON.stringify([{ ownerKey: "user:alice" }, { ownerKey: "user:bob" }]) });
  const transient = storage({ "gymdrobe-buy-now:alice": "private", "gymdrobe-buy-now:bob": "other" });
  clearDeletedAccountData({ id: "alice" }, local, transient);
  assert.equal(local.getItem("gymdrobe-cart:alice"), null);
  assert.equal(transient.getItem("gymdrobe-buy-now:alice"), null);
  assert.equal(local.getItem("gymdrobe-cart:bob"), "other");
  assert.equal(local.getItem("gymdrobe-cart"), "guest");
  assert.equal(local.getItem("unrelated:alice"), "keep");
  assert.equal(local.getItem("gymdrobe-shopping-sync::alice:op:fixture"), null);
  assert.equal(local.getItem("gymdrobe-shopping-sync::bob:op:fixture"), "other");
  assert.deepEqual(JSON.parse(local.getItem("gymdrobe-support-tickets")), [{ ownerKey: "user:bob" }]);
});
