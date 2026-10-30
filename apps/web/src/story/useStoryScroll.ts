import { useEffect, useRef, useState } from "react";

/**
 * Scroll position as (chapter, progress within chapter). Sections mark themselves with data-chapter.
 * React state changes only when the chapter changes or progress moves by 1%, while the ref is updated
 * every frame for smooth 3D animation without re-rendering.
 */
export interface StoryPos { chapter: number; progress: number }

export function useStoryScroll(): { pos: StoryPos; ref: React.MutableRefObject<StoryPos> } {
  const ref = useRef<StoryPos>({ chapter: 0, progress: 0 });
  const [pos, setPos] = useState<StoryPos>({ chapter: 0, progress: 0 });
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
      const mid = window.innerHeight * 0.5;
      let best: StoryPos = { chapter: 0, progress: 0 };
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const clamp=(v:number)=>Math.max(0,Math.min(1,v));
        const presence=Math.min(clamp((window.innerHeight*.95-r.top)/(window.innerHeight*.25)),clamp((r.bottom-window.innerHeight*.15)/(window.innerHeight*.25)));
        el.style.setProperty("--chapter-presence",presence.toFixed(3));
        if (r.top <= mid) best = { chapter: Number(el.dataset.chapter), progress: Math.min(1, Math.max(0, (mid - r.top) / Math.max(1, r.height))) };
      }
      ref.current = best;
      setPos((p) => (p.chapter !== best.chapter || Math.abs(p.progress - best.progress) >= 0.01 ? best : p));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(onScroll);
    document.querySelectorAll("[data-chapter]").forEach(el=>observer.observe(el));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return { pos, ref };
}
