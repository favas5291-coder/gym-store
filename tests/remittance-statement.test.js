import test from "node:test";
import assert from "node:assert/strict";
import { parseStatement, verifyPreview } from "../src/services/remittanceStatement.js";

test("spreadsheet rows preserve references and convert explicit rupees to integer paise", () => {
  const rows = parseStatement("\uFEFF 001-ABC\t470.05\t29.95\r\n001-DEF\t0\t0\r\n");
  assert.deepEqual(rows, [
    { reference: "001-ABC", remittedPaise: 47005, feePaise: 2995 },
    { reference: "001-DEF", remittedPaise: 0, feePaise: 0 },
  ]);
  for (const text of ["", "REF\t100", "REF\t100\t", "REF\t0\t-1", "REF\t0.001\t0",
    "REF\t0\t0\textra", Array(201).fill("REF\t0\t0").join("\n")]) assert.throws(() => parseStatement(text));
});

test("results must match submitted references, units, status and arithmetic", () => {
  const rows = parseStatement("REF\t470\t30");
  const line = { ...rows[0], rowNumber: 1, statementGrossPaise: 50000, recordedCollectionPaise: 51000, differencePaise: -1000, status: "difference" };
  const result = { currency: "INR", scope: "submitted_marketplace_collection_references", lines: [line] };
  assert.equal(verifyPreview(result, rows), true);
  for (const change of [{ reference: "OTHER" }, { feePaise: 0 }, { remittedPaise: 1 }, { rowNumber: 3 }, { status: "matched" },
    { status: "unknown" }, { differencePaise: 1000 }, { recordedCollectionPaise: "51000" }, { status: "constructor" }]) {
    assert.equal(verifyPreview({ ...result, lines: [{ ...line, ...change }] }, rows), false);
  }
  assert.equal(verifyPreview({ ...result, currency: "USD" }, rows), false);
  assert.equal(verifyPreview({ ...result, lines: [{ ...rows[0], rowNumber: 1, statementGrossPaise: 50000, status: "unknown" }] }, rows), true);
});
