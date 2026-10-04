import { useState } from "react";
import { CONSTANTS, DISCLAIMER, REFERENCES, SIM_VERSION, listUnverifiedConstants, listUnverifiedReferences } from "@eliminate/sim-core";
import { useStore } from "../store";

/** Always-visible disclaimer plus an honest status chip that opens the verification panel. */
export function Footer() {
  const [open, setOpen] = useState(false);
  const goLab = useStore((s) => s.goLab);
  const nConst = listUnverifiedConstants().length;
  const totalConst = Object.keys(CONSTANTS).length;
  const nRef = listUnverifiedReferences().length;
  return (
    <>
      <footer className="footer" role="contentinfo">
        <span><b style={{ color: "var(--ink-2)", fontWeight: 600 }}>{DISCLAIMER}</b></span>
        <button type="button" className="status-chip" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Prototype. ${nConst} of ${totalConst} parameters awaiting expert verification. Open details.`}>
          <span className="dot" aria-hidden="true" /><span className="long">Prototype · {nConst} of {totalConst} parameters awaiting expert verification</span><span className="short" aria-hidden="true">Prototype · {nConst}/{totalConst} unverified</span>
        </button>
      </footer>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="honesty-title" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 id="honesty-title">What this prototype is</h2>
              <button className="ghost" onClick={() => setOpen(false)} autoFocus aria-label="Close">Close</button>
            </div>
            <p style={{ color: "var(--ink-2)" }}>A research and education tool. It reduces and refines animal use by screening, by choosing doses and by showing humane endpoints in advance. It does not replace animal studies, and it has not been validated against real animal data.</p>
            <div className="stats">
              <div className="stat warn"><span>Parameters awaiting verification</span><b>{nConst} / {totalConst}</b></div>
              <div className="stat warn"><span>References awaiting verification</span><b>{nRef} / {REFERENCES.length}</b></div>
              <div className="stat bad"><span>Validated against animal data</span><b>None yet</b></div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, color: "var(--ink-2)" }}>
              <li>All test compounds are fictional archetypes, not real substances.</li>
              <li>Every part of the model carries a fidelity label: mechanistic, semi-quantitative or illustrative.</li>
              <li>Behaviour outputs are modelled endpoints, not statements about what an animal feels.</li>
              <li>Simulator version {SIM_VERSION}. Every run is reproducible from its seed.</li>
            </ul>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="primary" onClick={() => { setOpen(false); goLab("trust", "fidelity"); }}>See every parameter and its source</button>
              <button onClick={() => { setOpen(false); goLab("trust", "validation"); }}>Validation status</button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
