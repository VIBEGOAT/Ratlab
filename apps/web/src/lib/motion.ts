import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the viewer has asked their system for less motion. Follows changes while the page is open. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Ease-out with a long, soft tail (close to cubic-bezier(0.22, 1, 0.36, 1)). */
export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);

/** Runs `onUpdate(value)` from `from` to `to` over `seconds`. Returns a function that stops it. */
export function tween(from: number, to: number, seconds: number, onUpdate: (v: number) => void): () => void {
  let raf = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / (seconds * 1000));
    onUpdate(from + (to - from) * easeOut(k));
    if (k < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
