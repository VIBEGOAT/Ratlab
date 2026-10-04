import referenceJson from "../../../data/reference.json";
import referencesJson from "../../../data/references.json";

export type Status = "VERIFIED" | "UNVERIFIED";
export type Confidence = "high" | "medium" | "low";

export interface RefConstant {
  value: number;
  unit: string;
  source: string;
  confidence: Confidence;
  status: Status;
  verifiedOn?: string;
  note?: string;
}

export interface Reference {
  id: string;
  authors: string;
  year: number | null;
  title: string;
  venue: string;
  doi: string | null;
  url: string | null;
  usedFor: string;
  status: Status;
  verifiedOn: string | null;
  note: string;
}

export const CONSTANTS = referenceJson.constants as Record<string, RefConstant>;
export const REFERENCES = referencesJson.references as Reference[];

/** Read a constant by key. Throws on unknown keys so a typo cannot silently become NaN. */
export function constant(key: string): number {
  const c = CONSTANTS[key];
  if (!c) throw new Error(`Unknown reference constant: ${key}`);
  return c.value;
}

export function listUnverifiedConstants(): string[] {
  return Object.entries(CONSTANTS)
    .filter(([, c]) => c.status !== "VERIFIED")
    .map(([k]) => k);
}

export function listUnverifiedReferences(): string[] {
  return REFERENCES.filter((r) => r.status !== "VERIFIED").map((r) => r.id);
}

/** Return a list of schema problems (empty when the data files are well formed). */
export function validateReferenceData(): string[] {
  const problems: string[] = [];
  const refIds = new Set(REFERENCES.map((r) => r.id));
  const doiRe = /^10\.\d{4,9}\/\S+$/;

  for (const [key, c] of Object.entries(CONSTANTS)) {
    if (typeof c.value !== "number" || !Number.isFinite(c.value)) problems.push(`${key}: value is not a finite number`);
    if (!c.unit) problems.push(`${key}: missing unit`);
    if (!c.source) problems.push(`${key}: missing source`);
    else if (c.source !== "design" && !refIds.has(c.source)) problems.push(`${key}: source '${c.source}' is not in references.json`);
    if (!["high", "medium", "low"].includes(c.confidence)) problems.push(`${key}: bad confidence`);
    if (!["VERIFIED", "UNVERIFIED"].includes(c.status)) problems.push(`${key}: bad status`);
    if (c.status === "VERIFIED" && !c.verifiedOn) problems.push(`${key}: VERIFIED without verifiedOn`);
    if (c.status === "VERIFIED" && c.source === "design") problems.push(`${key}: a design placeholder cannot be VERIFIED`);
  }
  const seen = new Set<string>();
  for (const r of REFERENCES) {
    if (seen.has(r.id)) problems.push(`${r.id}: duplicate id`);
    seen.add(r.id);
    if (!r.authors || !r.title || !r.venue || !r.usedFor) problems.push(`${r.id}: missing required field`);
    if (r.doi !== null && !doiRe.test(r.doi)) problems.push(`${r.id}: malformed DOI`);
    if (r.status === "VERIFIED" && !r.verifiedOn) problems.push(`${r.id}: VERIFIED without verifiedOn`);
    if (r.status === "VERIFIED" && !r.doi && !r.url && !r.venue) problems.push(`${r.id}: VERIFIED without any locator`);
  }
  return problems;
}
