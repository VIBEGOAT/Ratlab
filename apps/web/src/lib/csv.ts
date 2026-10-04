import type { HistoricalRow, Sex } from "@eliminate/sim-core";

/**
 * Parse historical control data from CSV with the header:
 * dataset,source,strain,sex,ageWeeks,endpoint,n,mean,sd
 * The endpoint names must match those the simulator produces, for example bodyWeightG, chem.alt, organ.liver.relative.
 */
export function parseHistoricalCsv(text: string): { rows: HistoricalRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };
  const head = splitLine(lines[0]!).map((h) => h.toLowerCase());
  const need = ["dataset", "source", "strain", "sex", "ageweeks", "endpoint", "n", "mean", "sd"];
  const idx = Object.fromEntries(need.map((k) => [k, head.indexOf(k)]));
  const missing = need.filter((k) => idx[k]! < 0);
  if (missing.length) return { rows: [], errors: [`Missing column(s): ${missing.join(", ")}`] };
  const rows: HistoricalRow[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = splitLine(line);
    const num = (k: string) => Number(c[idx[k]!]);
    const sex = (c[idx.sex!] ?? "").toUpperCase();
    const row = { n: num("n"), mean: num("mean"), sd: num("sd"), age: num("ageweeks") };
    if (sex !== "M" && sex !== "F") errors.push(`Line ${i + 2}: sex must be M or F.`);
    else if (![row.n, row.mean, row.sd].every(Number.isFinite) || row.n < 2 || row.sd < 0) errors.push(`Line ${i + 2}: n, mean and sd must be numbers (n of at least 2, sd of at least 0).`);
    else rows.push({
      dataset: c[idx.dataset!]!, source: c[idx.source!]!, strain: c[idx.strain!]!, sex: sex as Sex, ageWeeks: Number.isFinite(row.age) ? row.age : undefined,
      endpoint: c[idx.endpoint!]!, n: row.n, mean: row.mean, sd: row.sd, provenance: "real",
    });
  });
  return { rows, errors };
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
