// Read-only lab report: compares PR base and candidate under the same fixture.
import fs from "node:fs/promises";
import path from "node:path";

const root = process.env.PERFORMANCE_OUTPUT_ROOT || "test-results/performance";
const [before, after] = await Promise.all(
  ["before", "after"].map(async (phase) =>
    JSON.parse(await fs.readFile(path.join(root, phase, "audit.json"), "utf8")),
  ),
);

const metrics = ["lcp", "cls", "longTaskMs", "jsBytes", "imageBytes", "bytes", "apiRequests", "videoBytes", "videoRequests"];

function median(numbers) {
  const sorted = numbers.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sampleMetrics(sample) {
  const video = (sample.resources || []).filter((entry) => /\\.mp4(?:$|\\?)/i.test(entry.url || ""));
  return {
    lcp: sample.lcp,
    cls: sample.cls,
    longTaskMs: sample.longTaskMs,
    jsBytes: sample.jsBytes,
    imageBytes: sample.imageBytes,
    bytes: sample.bytes,
    apiRequests: sample.apiRequests,
    videoBytes: video.reduce((sum, entry) => sum + (entry.bytes || 0), 0),
    videoRequests: video.length,
  };
}

function groupSamples(audit) {
  const grouped = new Map();
  for (const sample of audit.samples || []) {
    const key = String(sample.width) + "px " + sample.route;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(sampleMetrics(sample));
  }
  return grouped;
}

const previous = groupSamples(before);
const candidate = groupSamples(after);
const keys = [...new Set([...previous.keys(), ...candidate.keys()])].sort();
const scenarios = {};
for (const key of keys) {
  const beforeRows = previous.get(key) || [];
  const afterRows = candidate.get(key) || [];
  if (beforeRows.length !== afterRows.length || !beforeRows.length) {
    scenarios[key] = { comparable: false, beforeSamples: beforeRows.length, afterSamples: afterRows.length };
    continue;
  }
  const values = {};
  for (const metric of metrics) {
    const beforeMedian = median(beforeRows.map((row) => row[metric]));
    const afterMedian = median(afterRows.map((row) => row[metric]));
    values[metric] = {
      before: beforeMedian,
      after: afterMedian,
      percentLower: beforeMedian > 0 && afterMedian !== null
        ? Math.round(((beforeMedian - afterMedian) / beforeMedian) * 1000) / 10
        : null,
    };
  }
  scenarios[key] = { comparable: true, samplesPerPhase: beforeRows.length, metrics: values };
}

const result = {
  kind: "same-fixture-lab-comparison",
  interpretation: "Median of independent fresh-context samples. Positive percentLower means a lower metric. A changed value is not proof of a production/field improvement.",
  measurementLimits: "HTTP compression/CDN, live backend cold starts, field INP and real mobile hardware are not measured.",
  beforeConditions: before.conditions,
  afterConditions: after.conditions,
  scenarios,
};
await fs.writeFile(path.join(root, "comparison.json"), JSON.stringify(result, null, 2));
for (const [key, row] of Object.entries(scenarios)) {
  console.log("LAB_COMPARISON", key, JSON.stringify(row));
}
