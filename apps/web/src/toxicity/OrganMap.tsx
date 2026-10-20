import { useId } from "react";
import { ORGANS, type Organ, type AnimalBundle } from "@eliminate/sim-core";
import { gradeVar } from "../design/damage";
import { ORGAN_LABEL } from "../lib/setup";
import { organResponse, type Experiment } from "./experiment";

const PINS: Record<Organ, [number, number]> = { brain: [79, 29], heart: [65, 42], liver: [55, 54], kidney: [46, 32], gut: [36, 56], marrow: [67, 77] };

/** The lightweight viewer shares the simulated state and selection with the 3D viewer. */
export function OrganMap({ experiment, animal, day, selected, onSelect }: {
  experiment: Experiment; animal: AnimalBundle; day: number; selected: Organ; onSelect: (organ: Organ) => void;
}) {
  const id = useId().replace(/:/g, "");
  const color = (organ: Organ) => { const r = organResponse(experiment, animal, organ, day); return r.grade === null ? "var(--map-idle)" : gradeVar(r.grade); };
  const style = (organ: Organ) => ({ fill: color(organ), opacity: selected === organ ? 1 : 0.6, stroke: "var(--surface-solid)", strokeWidth: 2 });
  return <div className="organ-map">
    <svg viewBox="0 0 640 350" className="tox-rat" role="img" aria-label={`Illustrative rat organ map at day ${day}. Organ buttons below select the same results as the 3D view.`}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="0.3" y2="1"><stop stopColor="var(--map-body-light)" /><stop offset="1" stopColor="var(--map-body)" /></linearGradient>
        <radialGradient id={`${id}-shadow`}><stop stopColor="var(--map-shadow)" stopOpacity=".3" /><stop offset="1" stopColor="var(--map-shadow)" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="345" cy="291" rx="260" ry="24" fill={`url(#${id}-shadow)`} />
      <path d="M168 236C105 254 68 240 31 265C7 281 30 302 64 287" stroke="var(--map-pink)" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M169 237C133 199 170 126 256 110C332 96 407 120 449 145C472 134 494 135 512 153C527 171 547 186 580 204C600 215 596 229 578 233C550 240 517 241 487 244L460 262L470 283L443 286L423 257C365 278 297 273 254 260L240 284L212 283L219 253C193 249 179 243 169 237Z" fill={`url(#${id}-body)`} stroke="var(--map-outline)" strokeWidth="1.3" />
      <path d="M462 153C438 126 453 105 473 114C496 123 495 145 485 159" fill="var(--map-pink)" stroke="var(--map-outline)" />
      <path d="M466 143C454 126 464 119 475 127C486 134 483 144 479 149" fill="var(--map-pink-deep)" opacity=".45" />
      <ellipse cx="527" cy="184" rx="4" ry="5" fill="var(--map-eye)" /><circle cx="528" cy="182" r="1.2" fill="#fff" />
      <ellipse cx="588" cy="214" rx="5" ry="4" fill="var(--map-pink-deep)" />
      <path d="M566 219L609 209M567 225L612 226M563 228L600 242" fill="none" stroke="var(--map-outline)" strokeLinecap="round" opacity=".6" />
      <path d="M480 160C473 149 488 143 500 151C514 156 524 172 515 179C503 183 486 173 480 160Z" style={style("brain")} />
      <path d="M417 192C406 179 391 187 397 200L411 219L429 201C438 185 425 180 417 192Z" style={style("heart")} />
      <path d="M341 196C348 178 386 185 390 209C382 232 355 236 333 222Z" style={style("liver")} />
      <path d="M292 159C273 149 267 174 278 186C289 196 304 183 294 175C286 169 303 170 292 159Z" style={style("kidney")} />
      <path d="M318 174C337 164 343 189 332 201C321 211 306 198 316 190C324 184 307 185 318 174Z" style={style("kidney")} />
      <path d="M244 201C229 184 272 189 279 205S239 216 249 228S296 230 298 244L277 247C263 233 225 243 224 222Z" style={style("gut")} />
      <path d="M230 247L224 273M433 251L451 275" stroke={color("marrow")} strokeWidth="8" strokeLinecap="round" />
    </svg>
    <div className="organ-map-pins" role="group" aria-label="Select an organ on the rat">{ORGANS.map((o) => <button key={o} aria-label={`Explore ${ORGAN_LABEL[o]}`} aria-pressed={selected === o} onClick={() => onSelect(o)} style={{ left: `${PINS[o][0]}%`, top: `${PINS[o][1]}%`, "--pin-color": color(o) } as React.CSSProperties}><i /><span>{ORGAN_LABEL[o]}</span></button>)}</div>
  </div>;
}
