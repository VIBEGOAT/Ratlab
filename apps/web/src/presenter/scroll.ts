/** Legacy element arithmetic remains available to consumers outside the six-station Story. */
export function scrollYFor(topAbs: number, height: number, viewportHeight: number, progress: number): number {
  return topAbs + Math.min(1, Math.max(0, progress)) * height - viewportHeight * .5;
}

export function chapterScrollY(chapter: number, progress: number): number | null {
  const section = document.querySelector<HTMLElement>('#story');
  const stage = section?.querySelector<HTMLElement>('.journey-stage');
  if (!section || !stage) return null;
  const rect = section.getBoundingClientRect();
  const p = (Math.min(5, Math.max(0, chapter)) + Math.min(.99, Math.max(.35, progress))) / 6;
  return rect.top + window.scrollY + p * (rect.height - stage.getBoundingClientRect().height);
}

export interface ScrollJob { cancel: () => void }
/** Presenter navigation lands at a station. It must never keep dragging the page after a user scrolls. */
export function runSlideScroll(chapter: number, _from: number, to: number, _seconds: number, _reduceMotion: boolean): ScrollJob {
  const y = chapterScrollY(chapter, to);
  if (y !== null) window.scrollTo({ top: y, behavior: 'instant' });
  return { cancel() {} };
}
