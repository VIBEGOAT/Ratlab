import { useEffect, useRef } from "react";
import { onSoundChange, ratPatter, ratSniff, soundIsOn } from "./index";
import { ambiencePlan } from "./soundPlan";

/**
 * While a rat is on screen and sound is on: sniffing every few seconds (and footsteps when `moving`), set by the
 * animal's modelled condition. Pauses when the tab is hidden; nothing plays while sound is off.
 */
export function useRatAmbience(opts: { active: boolean; sickness: number; humane: boolean; activity?: number; moving?: boolean }): void {
  const ref = useRef(opts);
  ref.current = opts;
  useEffect(() => {
    let timer = 0, stopped = false;
    const schedule = () => {
      window.clearTimeout(timer);
      if (stopped || !soundIsOn() || !ref.current.active) return;
      const p = ambiencePlan(ref.current.sickness, ref.current.humane, ref.current.activity ?? 1);
      if (!p.sniffEvery) { timer = window.setTimeout(schedule, 4000); return; }
      const [lo, hi] = p.sniffEvery;
      timer = window.setTimeout(() => {
        if (!document.hidden && soundIsOn() && ref.current.active) {
          ratSniff(p.sniffStrength);
          if (ref.current.moving && p.steps > 0) window.setTimeout(() => ratPatter(p.steps), 450);
        }
        schedule();
      }, (lo + Math.random() * (hi - lo)) * 1000);
    };
    schedule();
    const off = onSoundChange(() => schedule());
    return () => { stopped = true; window.clearTimeout(timer); off(); };
  }, [opts.active]);
}
