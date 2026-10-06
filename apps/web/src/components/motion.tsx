import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useStore } from "../store";
import { tween, useReducedMotion } from "../lib/motion";
import { Icon } from "./icons";

/** A number that glides to its new value. Reduced motion shows the value at once. */
export function AnimatedNumber({ value, format, duration = 0.9 }: { value: number; format: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce || !Number.isFinite(value)) { setShown(value); from.current = value; return; }
    const start = from.current;
    const stop = tween(start, value, duration, (v) => { from.current = v; setShown(v); });
    return stop;
  }, [value, duration, reduce]);
  return <>{format(Number.isFinite(value) ? shown : value)}</>;
}

/**
 * Positions a pill behind the active item of a group (sidebar or tabs) and lets CSS glide it between items.
 * The active item is found by `selector` inside `container`.
 */
export function useSlidingPill(container: RefObject<HTMLElement>, selector: string, deps: unknown[]): { style: React.CSSProperties; ready: boolean } {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const a = el.querySelector<HTMLElement>(selector);
      if (!a) { setBox(null); return; }
      setBox({ x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return box ? { ready: true, style: { transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h } } : { ready: false, style: {} };
}

/**
 * Expert-only content. In Simple mode it waits behind a "Show …" button; in Expert mode it is always shown.
 * Nothing is removed from the product, only folded away.
 */
export function Expert({ label, children }: { label: string; children: ReactNode }) {
  const detail = useStore((s) => s.detail);
  const [open, setOpen] = useState(false);
  if (detail === "expert") return <>{children}</>;
  return (
    <div className={"expert" + (open ? " open" : "")}>
      <button type="button" className="expert-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{open ? `Hide ${label}` : `Show ${label}`}</span><Icon name="chevron" size={16} className="chev" />
      </button>
      {open && <div className="expert-body">{children}</div>}
    </div>
  );
}
