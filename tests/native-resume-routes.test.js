import test from "node:test";
import assert from "node:assert/strict";
import { nativeResumeKey, resumableRoute } from "../src/native/resumeRoute.js";

test("operations tabs restore for their own role and exclude private detail queries", () => {
  assert.equal(resumableRoute("/admin/orders?email=fixture&token=private", "admin"), "/admin/orders");
  assert.equal(resumableRoute("/supplier/orders?shipment=private", "supplier"), "/supplier/orders");
  assert.equal(resumableRoute("/admin/returns", "supplier"), null);
  assert.equal(resumableRoute("/supplier/payouts", "customer"), null);
  assert.equal(resumableRoute("/orders/private/payment?token=private", "admin"), null);
  assert.notEqual(nativeResumeKey({id:"a",role:"supplier"}),nativeResumeKey({id:"b",role:"supplier"}));
});
