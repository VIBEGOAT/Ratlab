import { useState } from "react";
import { CONSTANTS, DISCLAIMER, FIDELITY, SIM_VERSION, listUnverifiedConstants } from "@eliminate/sim-core";
import { Banner, Chip, Panel, Stat, TabHead, ScrollBox } from "../components/ui";
import { useStore } from "../store";

const ASSUMPTIONS = [
  "All compounds are fictional archetypes with design parameters. None represents a real substance.",
  "Tissue distribution is flow-limited and the linear PK is propagated exactly in 15 minute steps. Saturable metabolism and transporters are not modelled.",
  "Organ damage follows a threshold, saturating injury, defence depletion, regeneration and adaptation scheme. Parameters are tuned, not fitted.",
  "Blood markers are mapped from organ damage with assumed functions. Reference limits are placeholders, not vendor data.",
  "Behaviour is derived from sickness, pain, CNS exposure and disease burden. It makes no claim about the animal's experience.",
  "Humane endpoint thresholds are placeholders and must be replaced by institutional policy.",
  "NOAEL and LOAEL use a rule-based adversity call with design thresholds.",
  "Human translation is body-surface-area arithmetic and allometric scaling only.",
];

export default function FidelityTab() {
  const [q, setQ] = useState("");
  const seed = useStore((s) => s.setup.seed);
  const unverified = listUnverifiedConstants();
  const total = Object.keys(CONSTANTS).length;
  const list = unverified.filter((k) => k.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <TabHead title="Model fidelity and assumptions" blurb="What each part of the model is, how much to trust it, and what it assumes." />
      <Banner tone="info"><b>{DISCLAIMER}</b></Banner>
      <div className="stats">
        <Stat label="Version" value={SIM_VERSION} />
        <Stat label="Seed" value={seed} />
        <Stat label="Unverified constants" value={`${unverified.length} of ${total}`} tone="bad" />
      </div>
      <Panel title="Fidelity by subsystem">
        <ScrollBox><table>
          <thead><tr><th>Subsystem</th><th>Label</th><th>Why</th></tr></thead>
          <tbody>{FIDELITY.map((f) => <tr key={f.id}><td>{f.name}</td><td><Chip kind={f.label}>{f.label}</Chip></td><td className="small">{f.justification}</td></tr>)}</tbody>
        </table></ScrollBox>
        <p className="small muted">MECHANISTIC: standard equations that can be checked. SEMI-QUANTITATIVE: mechanism-shaped with parameters not fitted to data. ILLUSTRATIVE: shows how pieces connect, with no predictive claim.</p>
      </Panel>
      <Panel title="Assumptions"><ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul></Panel>
      <Panel title="Constants that need an expert check">
        <input type="text" placeholder="Filter, for example rat.clinchem" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter constants" style={{ maxWidth: 320 }} />
        <ScrollBox><table>
          <thead><tr><th>Key</th><th className="num">Value</th><th>Unit</th><th>Our confidence</th><th>Source</th></tr></thead>
          <tbody>{list.slice(0, 200).map((k) => { const c = CONSTANTS[k]!; return <tr key={k}><td className="mono small">{k}</td><td className="num">{c.value}</td><td className="small">{c.unit}</td><td>{c.confidence}</td><td className="small">{c.source}</td></tr>; })}</tbody>
        </table></ScrollBox>
        <p className="small muted">{list.length} shown. The same list is written to data/needs-expert-check.md.</p>
      </Panel>
    </>
  );
}
