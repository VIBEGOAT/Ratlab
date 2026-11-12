import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "data/reference-studies");
const files = readdirSync(root).filter((name) => name.endsWith(".json"));
let failed = false;

for (const name of files) {
  const item = JSON.parse(readFileSync(resolve(root, name), "utf8"));
  const missing = [];
  const need = (value, label) => { if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) missing.push(label); };
  need(item.source?.primaryProtocolCitation, "primary protocol citation");
  need(item.protocol?.strain, "strain");
  need(item.protocol?.sex, "sex");
  need(item.protocol?.route, "route");
  need(item.protocol?.doseUnit, "dose unit");
  need(item.protocol?.doseGroups, "dose groups");
  need(item.protocol?.durationDays, "duration");
  const observations = item.observations ?? {};
  if (!Object.values(observations).some((rows) => Array.isArray(rows) && rows.length > 0)) missing.push("observations");
  need(item.review?.transcribedBy, "transcriber");
  need(item.review?.checkedBy, "second reviewer");
  need(item.review?.checkedOn, "review date");
  if (item.source?.licenceChecked !== true) missing.push("licence check");

  if (item.status === "ready" && missing.length) {
    console.error(`${name}: READY is invalid; missing ${missing.join(", ")}`);
    failed = true;
  } else {
    console.log(`${name}: ${item.status}; ${missing.length} readiness checks remaining`);
  }
}

if (failed) process.exit(1);
