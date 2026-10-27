import test from "node:test";
import assert from "node:assert/strict";
import { createSupplierPortalApi, commissionBps } from "../src/services/supplierPortalApi.js";

const workspace = { id: "507f1f77bcf86cd799439011", revision: 2 };
const reply = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

test("supplier writes use backend authentication, exact terms digest and no cache", async () => {
  let observed;
  const api = createSupplierPortalApi({ baseUrl: "https://api.example.test/api", fetchImpl: async (url, options) => {
    observed = { url, options }; return reply({ success: true, workspace });
  } });
  const body = { revision: 2, agreementId: workspace.id, digest: "a".repeat(64), signerName: "Supplier", accepted: true, authorized: true };
  await api.accept("test-token", body);
  assert.equal(observed.url, "https://api.example.test/api/supplier-portal/me/accept-terms");
  assert.equal(observed.options.headers.Authorization, "Bearer test-token");
  assert.equal(observed.options.cache, "no-store");
  assert.deepEqual(JSON.parse(observed.options.body), body);
});

test("network, server and malformed write replies are uncertain; writes are never automatically retried", async () => {
  for (const fetchImpl of [async () => { throw new Error("Lost response"); }, async () => reply({ success: false }, 503),
    async () => reply({ success: true }),
    async () => reply({ success: true, workspace: { ...workspace, revision: undefined } })]) {
    let calls = 0;
    const api = createSupplierPortalApi({ fetchImpl: (...args) => { calls++; return fetchImpl(...args); } });
    await assert.rejects(api.apply("token", {}), (error) => error.outcomeUnknown === true);
    assert.equal(calls, 1);
  }
});

test("stale edits preserve the conflict response and absent authentication never reaches the network", async () => {
  let calls = 0;
  const api = createSupplierPortalApi({ fetchImpl: async () => { calls++; return reply({ success: false, code: "SUPPLIER_CHANGED", message: "Reload" }, 409); } });
  await assert.rejects(api.updateProfile("token", 1, {}), { status: 409, code: "SUPPLIER_CHANGED" });
  await assert.rejects(api.me(""), { status: 401 });
  assert.equal(calls, 1);
});

test("commission input uses exact basis points and never assumes an omitted rate", () => {
  assert.equal(commissionBps("5"), 500);
  assert.equal(commissionBps("12.75"), 1275);
  assert.equal(commissionBps("0"), 0);
  assert.equal(commissionBps("100.00"), 10000);
  for (const value of ["", "-1", "101", "12.755", "1e2", "NaN"]) assert.throws(() => commissionBps(value));
});
