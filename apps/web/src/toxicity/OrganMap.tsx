import { type Organ, type AnimalBundle } from "@eliminate/sim-core";
import { gradeVar } from "../design/damage";
import { organResponse, type Experiment } from "./experiment";

/** Schematic side view, deliberately labeled rather than presented as anatomical evidence. */
export function OrganMap({ experiment, animal, day, selected }: { experiment: Experiment; animal: AnimalBundle; day: number; selected: Organ }) {
  const color = (organ: Organ) => { const r = organResponse(experiment, animal, organ, day); return r.grade === null ? "var(--muted)" : gradeVar(r.grade); };
  const style = (organ: Organ) => ({ fill: color(organ), opacity: selected === organ ? 0.95 : 0.45, stroke: selected === organ ? "var(--ink)" : color(organ), strokeWidth: selected === organ ? 2 : 1 });
  return <svg viewBox="0 0 640 350" className="tox-rat" role="img" aria-label={`Schematic rat organ map at day ${day}; select an organ card for its response.`}>
    <defs><pattern id="tox-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="var(--line)" strokeWidth="0.5" /></pattern></defs>
    <rect width="640" height="350" fill="url(#tox-grid)" />
    <path d="M150 228C90 236 40 250 8 286" stroke="var(--muted)" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M150 228C140 170 205 118 300 116C360 115 410 128 450 150C470 130 492 124 504 134C512 142 508 156 498 164C530 176 560 194 586 214C600 224 596 236 582 238C560 242 520 244 486 248C470 262 448 270 430 270L436 292C437 300 426 302 422 296L410 270C360 276 300 276 250 270L246 296C245 304 233 304 232 296L228 266C190 260 158 250 150 228Z" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="2" />
    <circle cx="532" cy="190" r="4" fill="var(--ink)" />
    <path d="M470 166C464 149 485 145 496 155C514 161 522 176 510 183C494 186 480 178 470 166Z" style={style("brain")} />
    <path d="M414 194C399 174 381 188 388 205L408 228L429 207C440 187 424 179 414 194Z" style={style("heart")} />
    <path d="M335 196C342 174 384 184 387 211C381 237 357 241 330 226Z" style={style("liver")} />
    <path d="M292 170C273 160 267 185 278 197C289 207 304 194 294 186C286 180 303 181 292 170Z" style={style("kidney")} />
    <path d="M310 184C329 174 335 199 324 211C313 221 298 208 308 200C316 194 299 195 310 184Z" style={style("kidney")} />
    <path d="M228 204C215 185 264 193 268 210S222 220 235 232S289 233 290 249L263 251C252 238 214 246 209 225Z" style={style("gut")} />
    <path d="M226 246L240 283M409 246L426 283" stroke={color("marrow")} strokeWidth={selected === "marrow" ? 9 : 6} opacity={selected === "marrow" ? 1 : 0.5} fill="none" strokeLinecap="round" />
    <text x="24" y="35" fill="var(--muted)" fontSize="11" fontFamily="monospace">VAST / ORGAN RESPONSE</text>
    <text x="24" y="325" fill="var(--muted)" fontSize="11">Schematic · not anatomical scale</text>
  </svg>;
}
