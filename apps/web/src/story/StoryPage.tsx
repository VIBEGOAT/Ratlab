import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { animalsSpared } from "@eliminate/sim-core";
import { useStore } from "../store";
import { fmtInt, fmtPct } from "../design/format";

/** Conservative example assumptions. Shown on hover and editable in the Pitch view. */
export const SPARED_ASSUMPTIONS = { studiesPerYear: 20, treatedGroups: 3, animalsPerGroup: 20, screenedOutShare: 0.2, virtualControlShare: 0 };

export function CountUp({ to, duration = 1.6 }: { to: number; duration?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { setV(to); return; }
    const c = animate(0, to, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [to, duration, reduce]);
  return <>{fmtInt(v)}</>;
}

/** Poster rat used before the 3D scene loads. A single continuous silhouette. */
export function RatPoster() {
  return (
    <svg viewBox="0 0 640 360" role="img" aria-label="Laboratory rat, side view">
      <defs>
        <radialGradient id="pg" cx="45%" cy="40%" r="70%"><stop offset="0" stopColor="var(--ink)" stopOpacity="0.95" /><stop offset="1" stopColor="var(--ink)" stopOpacity="0.55" /></radialGradient>
        <linearGradient id="tail" x1="0" x2="1"><stop offset="0" stopColor="var(--ink)" stopOpacity="0.6" /><stop offset="1" stopColor="var(--ink)" stopOpacity="0.05" /></linearGradient>
      </defs>
      <path d="M150 230 C 90 236, 40 250, 8 286" stroke="url(#tail)" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path fill="url(#pg)" d="M150 228 C 140 170, 205 118, 300 116 C 360 115, 410 128, 450 150 C 470 130, 492 124, 504 134 C 512 142, 508 156, 498 164 C 530 176, 560 194, 586 214 C 600 224, 596 236, 582 238 C 560 242, 520 244, 486 248 C 470 262, 448 270, 430 270 L 436 292 C 437 300, 426 302, 422 296 L 410 270 C 360 276, 300 276, 250 270 L 246 296 C 245 304, 233 304, 232 296 L 228 266 C 190 260, 158 250, 150 228 Z" />
      <circle cx="532" cy="190" r="4.5" fill="var(--bg)" />
      <circle cx="590" cy="226" r="4" fill="var(--g3)" opacity="0.9" />
      <g stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="1.2"><path d="M578 222 L 632 204" /><path d="M578 226 L 634 226" /><path d="M578 230 L 630 246" /></g>
      <g opacity="0.85">
        <ellipse cx="400" cy="200" rx="34" ry="22" fill="var(--g4)" opacity="0.55" />
        <ellipse cx="455" cy="182" rx="13" ry="12" fill="var(--g3)" opacity="0.6" />
        <ellipse cx="330" cy="180" rx="15" ry="9" fill="var(--g1)" opacity="0.55" />
      </g>
    </svg>
  );
}

const CHAPTERS = [
  "Meet the rat", "Choose a compound", "Dose day", "Damage unfolds", "The humane endpoint", "The untreated twin",
  "A thousand virtual rats", "Behaviour", "Toward humans", "How much to trust this", "What it could spare",
];

export function StoryPage() {
  const goLab = useStore((s) => s.goLab);
  const study = useStore((s) => s.study);
  const r = animalsSpared(SPARED_ASSUMPTIONS);
  const a = SPARED_ASSUMPTIONS;
  return (
    <main className="story" id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <div className="eyebrow">Replace · Reduce · Refine</div>
          <h1 id="hero-title" style={{ marginTop: 14 }}>Every animal we spare starts with a simulation <span>we can trust.</span></h1>
          <p className="lede">A virtual laboratory rat that shows what a compound would do, before any animal is dosed.</p>
          <div className="cta">
            <motion.button className="primary" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 22 }} onClick={() => document.getElementById("chapters")?.scrollIntoView({ behavior: "smooth" })}>Begin</motion.button>
            <button onClick={() => goLab("design")}>Open the Lab</button>
          </div>
          <div style={{ marginTop: 40 }} className="hovercard">
            <div tabIndex={0} aria-describedby="spared-assumptions">
              <div className="big-number"><CountUp to={r.spared} /></div>
              <div className="big-caption">animals a year one lab could avoid using, on example assumptions. Hover or focus to see them.</div>
            </div>
            <span className="card" role="tooltip" id="spared-assumptions" style={{ left: 0, right: "auto" }}>
              <b>Example assumptions, not data</b><br />
              {a.studiesPerYear} studies a year, {a.treatedGroups} dose groups plus a control, {a.animalsPerGroup} animals per group, {fmtPct(a.screenedOutShare)} of studies avoided by screening first, {fmtPct(a.virtualControlShare)} of controls replaced. Baseline {fmtInt(r.baselineAnimals)} animals. Edit them in Lab, Translate &amp; Trust, Pitch.
            </span>
          </div>
        </div>
        <div className="hero-figure" aria-hidden={false}>
          <RatPoster />
          <div className="small muted" style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center" }} role="status">
            {study.status === "running" ? "Preparing the virtual study…" : study.status === "done" ? `${fmtInt(study.data!.study.animals.length)} virtual animals ready` : ""}
          </div>
        </div>
      </section>
      <section id="chapters" aria-label="Story chapters" className="chapters">
        {CHAPTERS.map((c, i) => (
          <div className="chapter" key={c}>
            <span className="n">{String(i + 2).padStart(2, "0")}</span>
            <h3>{c}</h3>
            <span className="small muted">Scroll chapter, built in the next phases.</span>
          </div>
        ))}
      </section>
    </main>
  );
}
