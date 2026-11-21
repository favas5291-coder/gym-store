import { parsePaise } from "./marketplaceApi.js";

export const remittanceStatuses = {
  matched: "Matched", difference: "Amount differs", duplicate: "Duplicate reference",
  unknown: "Unknown reference", invalid_record: "Invalid collection record",
};

export function parseStatement(text) {
  const entries = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  while (entries.length && entries.at(-1) === "") entries.pop();
  if (!entries.length || entries.length > 200) throw new Error("Paste between 1 and 200 statement rows.");
  return entries.map((entry, index) => {
    const cells = entry.split("\t");
    const reference = cells[0].trim();
    if (cells.length !== 3 || reference.length < 3 || reference.length > 200 || /[\x00-\x1F]/.test(reference)) {
      throw new Error(`Row ${index + 1} needs a collection reference and two tab-separated amounts.`);
    }
    return {
      reference,
      remittedPaise: parsePaise(cells[1], `Row ${index + 1} net remittance`),
      feePaise: parsePaise(cells[2], `Row ${index + 1} fee`),
    };
  });
}

export function verifyPreview(preview, rows) {
  if (preview?.currency !== "INR" || preview.scope !== "submitted_marketplace_collection_references" ||
      !Array.isArray(preview.lines) || preview.lines.length !== rows.length) return false;
  return preview.lines.every((line, index) => {
    const row = rows[index];
    if (!line || !Object.hasOwn(remittanceStatuses, line.status) || line.rowNumber !== index + 1 ||
        line.reference !== row.reference || line.remittedPaise !== row.remittedPaise || line.feePaise !== row.feePaise ||
        line.statementGrossPaise !== row.remittedPaise + row.feePaise) return false;
    if (!["matched", "difference"].includes(line.status)) return line.differencePaise == null && line.recordedCollectionPaise == null;
    return Number.isSafeInteger(line.recordedCollectionPaise) && line.recordedCollectionPaise > 0 &&
      line.differencePaise === line.statementGrossPaise - line.recordedCollectionPaise &&
      (line.status === "matched") === (line.differencePaise === 0);
  });
}
