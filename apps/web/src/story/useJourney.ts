import { useLayoutEffect, useRef, useState } from 'react';
import { CHAPTER_IDS, chapterProgress, sectionProgress } from './journey';

/** The document is the only scroll owner. No animation clock and no wheel interception. */
export function useJourney() {
  const section = useRef<HTMLElement>(null), stage = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0), [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const jumpRef = useRef<(chapter: number, hash?: boolean) => void>(() => {});
  useLayoutEffect(() => {
    let frame = 0, initial = 0, timer = 0;
    const measure = () => {
      frame = 0;
      if (!section.current || !stage.current) return;
      const rect = section.current.getBoundingClientRect();
      setProgress(sectionProgress(rect.top, rect.height, stage.current.getBoundingClientRect().height));
      setReady(true);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    jumpRef.current = (chapter, hash = true) => {
      if (!section.current || !stage.current) return;
      const rect = section.current.getBoundingClientRect();
      if (hash) history.pushState(null, '', `#story/${CHAPTER_IDS[chapter]}`);
      window.scrollTo({ top: window.scrollY + rect.top + chapterProgress(chapter) * (rect.height - stage.current.getBoundingClientRect().height), behavior: 'instant' });
      measure();
    };
    const hash = () => {
      if (!location.hash.startsWith('#story')) return;
      const slug = location.hash.replace(/^#story[/-]?/, '');
      const chapter = CHAPTER_IDS.findIndex(id => id === slug);
      if (chapter >= 0) jumpRef.current(chapter, false);
      else if (!slug && section.current) window.scrollTo({ top: window.scrollY + section.current.getBoundingClientRect().top, behavior: 'instant' });
      measure();
    };
    const resize = () => {
      schedule();
      clearTimeout(timer);
      timer = window.setTimeout(() => { setRevision(n => n + 1); schedule(); }, 80);
    };
    const observer = new ResizeObserver(resize);
    if (section.current) observer.observe(section.current);
    if (stage.current) observer.observe(stage.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', resize);
    window.addEventListener('hashchange', hash);
    window.addEventListener('popstate', hash);
    window.addEventListener('pageshow', schedule);
    hash(); measure();
    initial = requestAnimationFrame(hash);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(initial); clearTimeout(timer); observer.disconnect();
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize); window.removeEventListener('hashchange', hash);
      window.removeEventListener('popstate', hash); window.removeEventListener('pageshow', schedule);
    };
  }, []);
  return { section, stage, progress, ready, revision, jump: (chapter: number) => jumpRef.current(chapter) };
}
