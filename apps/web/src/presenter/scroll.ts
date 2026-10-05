/** Scroll arithmetic for the presenter. Mirrors how useStoryScroll measures progress through a chapter. */

/**
 * The window scroll position that puts the viewport's middle `progress` of the way through an element.
 * `topAbs` is the element's top relative to the document, `height` its height.
 */
export function scrollYFor(topAbs: number, height: number, viewportHeight: number, progress: number): number {
  return topAbs + Math.min(1, Math.max(0, progress)) * height - viewportHeight * 0.5;
}

export function chapterScrollY(chapter: number, progress: number): number | null {
  const el = document.querySelector<HTMLElement>(`[data-chapter='${chapter}']`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return Math.max(0, scrollYFor(r.top + window.scrollY, r.height, window.innerHeight, progress));
}

/** Lenis instance, set by the Story page so presenter scrolling stays in step with smooth scrolling. */
export const lenisHolder: { current: { scrollTo: (y: number, o?: { immediate?: boolean; duration?: number; easing?: (t: number) => number }) => void } | null } = { current: null };

export interface ScrollJob { cancel: () => void }

/**
 * Move to the start of a slide, then drift to its end over `seconds`. Under reduced motion it jumps to the end
 * at once. Returns a handle to cancel the drift (for example when the presenter navigates).
 */
export function runSlideScroll(chapter: number, from: number, to: number, seconds: number, reduceMotion: boolean): ScrollJob {
  let raf = 0, cancelled = false;
  const set = (y: number, immediate = false) => {
    if (lenisHolder.current) lenisHolder.current.scrollTo(y, { immediate: true });
    else window.scrollTo({ top: y, behavior: immediate || reduceMotion ? "auto" : "auto" });
  };
  const yEnd = chapterScrollY(chapter, to);
  if (reduceMotion || yEnd === null) {
    if (yEnd !== null) set(yEnd, true);
    return { cancel() {} };
  }
  const yStart = chapterScrollY(chapter, from) ?? yEnd;
  // arrive at the slide start with an eased move, then drift linearly
  const here = window.scrollY;
  const t0 = performance.now();
  const travel = Math.min(1.4, Math.max(0.5, Math.abs(yStart - here) / 4000)) * 1000;
  const drift = Math.max(0.5, seconds - travel / 1000 - 0.5) * 1000;
  const tick = (now: number) => {
    if (cancelled) return;
    const dt = now - t0;
    if (dt < travel) {
      const k = dt / travel;
      set(here + (yStart - here) * (1 - Math.pow(1 - k, 3)));
      raf = requestAnimationFrame(tick);
    } else if (dt < travel + drift) {
      set(yStart + (yEnd - yStart) * ((dt - travel) / drift));
      raf = requestAnimationFrame(tick);
    } else set(yEnd);
  };
  raf = requestAnimationFrame(tick);
  return { cancel() { cancelled = true; cancelAnimationFrame(raf); } };
}
