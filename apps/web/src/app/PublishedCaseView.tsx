import type { LabSection } from "../store";
import { referenceCaseForCompound } from "../lib/referenceStudies";
import { useStore } from "../store";

const missing = [
  ["Pharmacokinetics", "No measured plasma concentration series is bundled."],
  ["Clinical chemistry", "Raw ALT, AST and bilirubin values are not yet imported."],
  ["NOAEL / LOAEL", "The available processed hits do not establish an adversity threshold."],
  ["Population variability", "Animal-level outcome data are not available in this package."],
];

function SourceBadge() {
  return <span className="published-badge">Observed-derived · Open TG-GATEs</span>;
}

function PathologyTimeline() {
  const item = referenceCaseForCompound("hepatotoxin")!;
  return <ol className="published-timeline">{item.publishedFindings!.map((finding) => <li key={`${finding.dose}-${finding.time}`}><span>{finding.time}</span><b>{finding.dose.toLocaleString()} mg/kg</b><p>{finding.finding}</p></li>)}</ol>;
}

export function PublishedCaseView({ section }: { section: LabSection }) {
  const setup = useStore((s) => s.setup);
  const item = referenceCaseForCompound(setup.compoundKey);
  if (!item || item.id !== "acetaminophen-liver") return null;

  if (section === "design") return <section className="published-case panel"><SourceBadge /><h2>What this evidence package contains</h2><p>The study design comes from E-MTAB-799 and E-MTAB-800 metadata. Pathology below comes from a published, discretized processing of Open TG-GATEs—not raw slides or animal-level grades.</p><div className="published-scope"><span><b>Protocol</b>Available</span><span><b>Pathology hits</b>Available, processed</span><span><b>Transcriptomics</b>Referenced, not bundled</span><span><b>PK and NOAEL</b>Unavailable</span></div></section>;

  if (section === "overview") return <section className="published-case"><div className="published-hero"><div><SourceBadge /><span className="eyebrow">Acetaminophen · rat liver</span><h2>What was observed?</h2><p>At higher doses, liver pathology findings appeared earlier and became more substantial across the recorded sacrifice times.</p></div><div className="published-conclusion"><span>Evidence-supported conclusion</span><b>Dose- and time-associated hepatic pathology</b><small>No source-supported NOAEL is claimed.</small></div></div><PathologyTimeline /><div className="banner info"><b>Interpret carefully.</b> These are discretized pathology hits. They establish that a finding crossed the processing threshold, not its raw incidence, individual severity or causal PK relationship.</div></section>;

  if (section === "animal") return <section className="published-case panel"><SourceBadge /><h2>One animal cannot be reconstructed</h2><p>The available package describes condition-level transcriptomic samples and processed pathology associations. It does not provide a complete longitudinal record for a named rat, so VAST will not manufacture one.</p><PathologyTimeline /></section>;

  if (section === "data") return <section className="published-case"><div className="published-hero"><div><SourceBadge /><h2>Evidence coverage</h2><p>Only endpoints present in the curated package are shown as observed.</p></div></div><div className="coverage-grid"><article className="available"><span>Available</span><h3>Protocol metadata</h3><p>Species, strain, sex, age, gavage route, dose arms and sacrifice times.</p></article><article className="available"><span>Available · derived</span><h3>Pathology hits</h3><p>Dose/time-associated liver findings from a reproducible discretization workflow.</p></article>{missing.slice(0, 3).map(([title, note]) => <article key={title}><span>Not available</span><h3>{title}</h3><p>{note}</p></article>)}</div></section>;

  if (section === "population") return <section className="published-case panel"><SourceBadge /><h2>No virtual cohort in published mode</h2><p>{missing[3]![1]} A simulated population belongs to Model Sandbox and is intentionally excluded here.</p></section>;

  return <section className="published-case"><div className="published-hero"><div><SourceBadge /><h2>What this case can support</h2><p>Teaching study design, evidence classification and cautious pathology interpretation.</p></div></div><div className="coverage-grid"><article className="available"><span>Appropriate</span><h3>Education</h3><p>Compare a published protocol with a clearly separated model sandbox.</p></article><article><span>Not supported</span><h3>Regulatory decisions</h3><p>No raw full dataset, fitted model or independent validation.</p></article><article><span>Not supported</span><h3>Human dosing</h3><p>No human translation should be calculated from this limited package.</p></article></div><p className="small muted">Sources: Open TG-GATEs; ArrayExpress E-MTAB-799 and E-MTAB-800; Igarashi et al. 2015, DOI 10.1093/nar/gku955. Reuse terms and independent transcription review remain open.</p></section>;
}
