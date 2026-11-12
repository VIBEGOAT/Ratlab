import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "data/reference-studies");
const files = readdirSync(root).filter((name) => name.endsWith(".json"));
const statuses = new Set(["source-needed", "source-mapped", "curating", "reviewed", "ready"]);
const evidenceLabels = new Set(["observed", "observed-derived", "fitted", "predicted"]);
let failed = false;
const empty = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

for (const name of files) {
  const item = JSON.parse(readFileSync(resolve(root, name), "utf8"));
  const missing = [];
  const errors = [];
  const need = (value, label) => { if (empty(value)) missing.push(label); };

  if (item.schemaVersion !== 2) errors.push("schemaVersion must be 2");
  if (!statuses.has(item.status)) errors.push(`unknown status ${JSON.stringify(item.status)}`);
  need(item.id, "case id");
  need(item.drug?.genericName, "generic drug name");
  need(item.source?.datasetRecord, "stable dataset record");
  need(item.source?.primaryProtocolCitation, "primary protocol citation");
  need(item.source?.stableIdentifiers, "stable source identifiers");

  for (const [key, label] of [
    ["species", "species"], ["strain", "strain"], ["sex", "sex"], ["route", "route"],
    ["formulation", "formulation"], ["doseUnit", "dose unit"], ["doseGroups", "dose groups"],
    ["frequency", "dose frequency"], ["durationDays", "duration"], ["groupSize", "group size"],
    ["control", "control definition"], ["studyArms", "sampling schedule"]
  ]) need(item.protocol?.[key], label);
  if (empty(item.protocol?.ageWeeks) && empty(item.protocol?.bodyWeightG)) missing.push("age or body weight");

  const rows = Object.entries(item.observations ?? {}).flatMap(([table, values]) =>
    Array.isArray(values) ? values.map((row, index) => ({ table, index, row })) : []
  );
  if (!rows.length) missing.push("observed endpoint rows");
  for (const { table, index, row } of rows) {
    const where = `${table}[${index}]`;
    if (!evidenceLabels.has(row?.evidence)) errors.push(`${where} has invalid evidence label`);
    if ((row?.evidence === "observed" || row?.evidence === "observed-derived") &&
        empty(row.accession) && empty(row.accessions) && empty(row.sourceRow) && empty(row.studyArm)) {
      errors.push(`${where} lacks row-level provenance`);
    }
    if (typeof row?.value === "number") {
      if (empty(row.valueUnit) && empty(row.unit)) errors.push(`${where} numeric value lacks unit`);
      if (empty(row.n)) missing.push(`${where} sample size`);
      if (empty(row.variability)) missing.push(`${where} variability`);
    }
  }

  if (item.doseConclusion?.sourceStatementChecked !== true) missing.push("source NOAEL/LOAEL statement check");
  need(item.review?.transcribedBy, "transcriber");
  need(item.review?.checkedBy, "second reviewer");
  need(item.review?.checkedOn, "review date");
  if (item.source?.licenceChecked !== true) missing.push("licence/reuse check");
  if (["reviewed", "ready"].includes(item.status) && item.review?.transcribedBy === item.review?.checkedBy) {
    errors.push("transcriber and checker must be different people");
  }

  const blockers = item.review?.blockingIssues ?? [];
  if (item.status === "ready" && (missing.length || errors.length || blockers.length)) {
    errors.push(`READY is invalid (${missing.length} missing checks, ${blockers.length} declared blockers)`);
  }
  if (errors.length) {
    console.error(`${name}: ${errors.join("; ")}`);
    failed = true;
  }
  console.log(`${name}: ${item.status}; ${missing.length} readiness checks remaining; ${blockers.length} declared blockers`);
}

if (failed) process.exit(1);
