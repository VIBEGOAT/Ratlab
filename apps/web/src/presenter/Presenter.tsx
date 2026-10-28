import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../lib/motion";
import { useStore } from "../store";
import { SoundToggle } from "../audio/SoundToggle";
import { uiTick } from "../audio";
import { TRACKS, trackSeconds, type TrackId } from "./tracks";
import { usePresenter, trackProgress } from "./store";
import { runSlideScroll } from "./scroll";
import { openChannel, openNotesWindow, type Cmd, type Msg, type SyncState } from "./channel";

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), ms);
    const wake = () => { setIdle(false); window.clearTimeout(t); t = window.setTimeout(() => setIdle(true), ms); };
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => { window.clearTimeout(t); window.removeEventListener("pointermove", wake); window.removeEventListener("keydown", wake); };
  }, [ms]);
  return idle;
}

/**
 * Presenter mode. Press P to start or stop. Hides the page chrome, enlarges type, steps through a scripted track
 * with the arrow keys, a clicker (Page Up/Down) or auto-advance, and mirrors the notes to a second window.
 */
export function Presenter() {
  const reduce = !!useReducedMotion();
  const p = usePresenter();
  const mode = useStore((s) => s.mode);
  const chan = useRef<BroadcastChannel | null>(null);
  const fs = useRef(false);
  const idle = useIdle(2800);
  const [hudFocus, setHudFocus] = useState(false);
  const slide = TRACKS[p.track].slides[p.index]!;

  const runCmd = (cmd: Cmd) => {
    const s = usePresenter.getState();
    if (cmd === "start3") s.start("3min");
    else if (cmd === "start8") s.start("8min");
    else if (!s.active) return;
    else if (cmd === "next") s.next();
    else if (cmd === "prev") s.prev();
    else if (cmd === "toggle") s.setPlaying(!s.playing);
    else if (cmd === "exit") s.stop();
  };
  const runCmdRef = useRef(runCmd);
  runCmdRef.current = runCmd;

  // keyboard and clicker
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = usePresenter.getState();
      if (typing(e.target) && !(s.active && e.key === "Escape")) return;
      const k = e.key;
      if (k === "p" || k === "P") { e.preventDefault(); if (s.active) s.stop(); else s.start(); return; }
      if (!s.active) return;
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); s.next(); }
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { e.preventDefault(); s.prev(); }
      else if (k === "Home") { e.preventDefault(); s.goto(0); }
      else if (k === "End") { e.preventDefault(); s.goto(TRACKS[s.track].slides.length - 1); }
      else if (k === "Escape") { s.stop(); }
      else if (k === "a" || k === "A") { s.setPlaying(!s.playing); }
      else if (k === "n" || k === "N") { openNotesWindow(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // page chrome, story mode, full screen
  useEffect(() => {
    const root = document.documentElement;
    if (!p.active) { root.classList.remove("presenting"); return; }
    root.classList.add("presenting");
    if (useStore.getState().mode !== "story") useStore.getState().setMode("story");
    if (!document.fullscreenElement && root.requestFullscreen) {
      root.requestFullscreen().then(() => { fs.current = true; }).catch(() => { /* full screen may be refused; presenting still works */ });
    }
    const onFs = () => { if (!document.fullscreenElement && fs.current) { fs.current = false; usePresenter.getState().stop(); } };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      root.classList.remove("presenting");
      if (fs.current && document.fullscreenElement) { fs.current = false; void document.exitFullscreen().catch(() => undefined); }
    };
  }, [p.active]);

  // scroll to the slide
  useEffect(() => {
    if (!p.active || mode !== "story") return;
    uiTick();
    let job: { cancel: () => void } | null = null;
    const t = window.setTimeout(() => { job = runSlideScroll(slide.chapter, slide.from, slide.to, slide.seconds, reduce); }, 60);
    return () => { window.clearTimeout(t); job?.cancel(); };
  }, [p.active, mode, p.track, p.index, slide.chapter, slide.from, slide.to, slide.seconds, reduce]);

  // auto-advance clock
  useEffect(() => {
    if (!p.active || !p.playing) return;
    const id = window.setInterval(() => usePresenter.getState().tickElapsed(0.25), 250);
    return () => window.clearInterval(id);
  }, [p.active, p.playing]);

  // second-screen link
  useEffect(() => {
    const c = openChannel();
    chan.current = c;
    if (!c) return;
    const snapshot = (): SyncState => {
      const s = usePresenter.getState();
      return { active: s.active, track: s.track, index: s.index, playing: s.playing, slideElapsed: s.slideElapsed, votes: s.votes, revealed: s.revealed, answer: null };
    };
    const push = () => c.postMessage({ type: "state", state: snapshot() } satisfies Msg);
    c.onmessage = (ev: MessageEvent<Msg>) => {
      if (ev.data.type === "hello") push();
      else if (ev.data.type === "cmd") runCmdRef.current(ev.data.cmd);
    };
    const unsub = usePresenter.subscribe(push);
    const t = window.setInterval(push, 1000);
    push();
    return () => { window.clearInterval(t); unsub(); c.close(); };
  }, []);

  if (!p.active) return null;

  const showHud = !idle || hudFocus;
  const progress = trackProgress(p.track, p.index, p.slideElapsed);
  const total = trackSeconds(p.track);

  return (
    <div role="region" aria-label="Presenter">
      <div className="p-progress" role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i style={{ width: `${progress * 100}%` }} />
      </div>

      <div className={"p-hud" + (showHud ? " show" : "")} onFocus={() => setHudFocus(true)} onBlur={() => setHudFocus(false)}>
        <div className="p-title"><b>{slide.title}</b><span>{p.index + 1} / {TRACKS[p.track].slides.length} · {TRACKS[p.track].label}{p.playing ? " · auto" : ""}</span></div>
        <div className="p-controls" role="group" aria-label="Presenter controls">
          <button type="button" onClick={() => p.prev()} aria-label="Previous slide" disabled={p.index === 0}>Back</button>
          <button type="button" className="primary" onClick={() => p.next()} aria-label="Next slide" disabled={p.index >= TRACKS[p.track].slides.length - 1}>Next</button>
          <button type="button" onClick={() => p.setPlaying(!p.playing)} aria-pressed={p.playing}>{p.playing ? "Pause" : "Auto"}</button>
          <select aria-label="Demo length" value={p.track} onChange={(e) => p.setTrack(e.target.value as TrackId)}>
            {(Object.keys(TRACKS) as TrackId[]).map((t) => <option key={t} value={t}>{TRACKS[t].label}</option>)}
          </select>
          <button type="button" onClick={() => openNotesWindow()}>Notes window</button>
          <SoundToggle className="" />
          <button type="button" className="ghost" onClick={() => p.stop()}>Exit</button>
        </div>
        <span className="sr-only" role="status">Slide {p.index + 1} of {TRACKS[p.track].slides.length}: {slide.title}. {Math.round(total / 60)} minute track.</span>
      </div>
    </div>
  );
}
