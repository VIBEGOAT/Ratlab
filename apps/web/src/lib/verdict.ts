import type { GroupFinding, NoaelResult } from "@eliminate/sim-core";
import { readableFinding } from "./endpoints";

/** Formats a dose without trailing zeros: 2.4, 8, 0.75. */
export function doseText(d: number): string {
  if (!Number.isFinite(d)) return "n/a";
  return d >= 10 ? d.toFixed(0) : Number(d.toFixed(2)).toString();
}

export interface Verdict {
  /** one plain sentence for the top of the Overview */
  headline: string;
  /** the finding that made the lowest adverse dose adverse, in plain words, if any */
  reason: string | null;
  tone: "good" | "warn" | "bad";
}

/** The study's answer in one sentence, from the NOAEL analysis. Never stronger than the analysis itself. */
export function studyVerdict(n: Pick<NoaelResult, "noael" | "loael" | "noaelIsAtLeast" | "groups">): Verdict {
  const firstAdverse = [...n.groups].sort((a, b) => a.dose - b.dose).find((g) => g.adverse) ?? null;
  const reason = firstAdverse?.reasons[0] ? readableFinding(firstAdverse.reasons[0]) : null;
  if (n.noaelIsAtLeast || !firstAdverse) {
    const top = Math.max(0, ...n.groups.map((g) => g.dose));
    return { headline: `No adverse effect at any dose tested, up to ${doseText(top)} mg/kg/day.`, reason: null, tone: "good" };
  }
  if (n.noael === null) {
    return { headline: `Adverse effects even at the lowest dose, ${doseText(firstAdverse.dose)} mg/kg/day.`, reason, tone: "bad" };
  }
  return { headline: `No adverse effect up to ${doseText(n.noael)} mg/kg/day. Adverse from ${doseText(firstAdverse.dose)} mg/kg/day.`, reason, tone: "warn" };
}

export interface LadderStep { id: string; label: string; dose: number; status: "control" | "clear" | "adverse"; finding: string | null }

/** Control plus each treated group, lowest dose first, with its adverse call. */
export function doseLadder(groups: Array<{ id: string; label: string; doseMgPerKg: number; kind: string }>, findings: GroupFinding[]): LadderStep[] {
  return groups
    .filter((g) => g.kind === "main")
    .sort((a, b) => a.doseMgPerKg - b.doseMgPerKg)
    .map((g) => {
      const f = findings.find((x) => x.groupId === g.id);
      if (g.doseMgPerKg === 0) return { id: g.id, label: g.label, dose: 0, status: "control" as const, finding: null };
      return { id: g.id, label: g.label, dose: g.doseMgPerKg, status: f?.adverse ? "adverse" as const : "clear" as const, finding: f?.adverse && f.reasons[0] ? readableFinding(f.reasons[0]) : null };
    });
}
