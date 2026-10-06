/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events --
   Combobox pattern: focus stays in the input, which handles the keys; options are chosen by pointer or by Enter. The backdrop
   only adds a pointer way to dismiss; Escape is the keyboard way. */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../lib/motion";
import { ARCHETYPES } from "@eliminate/sim-core";
import { useStore } from "../store";
import { download, studyToCsv, studyToHtml, studyToJson } from "../lib/export";
import { disableSound, enableSound, soundIsOn } from "../audio";
import { usePresenter } from "../presenter/store";
import { openNotesWindow } from "../presenter/channel";
import { runSlideScroll } from "../presenter/scroll";
import { buildCommands, filterCommands, type PaletteActions } from "./commands";

export const OPEN_PALETTE_EVENT = "eliminate:open-palette";
export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

/** Cmd/Ctrl+K. Jump to a Story chapter or Lab view, pick a compound, start a demo, change the look, export. */
export function CommandPalette() {
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [soundOn, setSoundOn] = useState(soundIsOn());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const uid = useId().replace(/:/g, "");

  const cb = useStore((s) => s.cbPalette);
  const data = useStore((s) => s.study.data);
  const detail = useStore((s) => s.detail);

  useEffect(() => {
    const show = () => { returnTo.current = document.activeElement as HTMLElement | null; setQuery(""); setActive(0); setSoundOn(soundIsOn()); setOpen(true); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); if (open) setOpen(false); else show(); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_PALETTE_EVENT, show); };
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const close = () => {
    setOpen(false);
    const el = returnTo.current;
    if (el && document.contains(el)) window.setTimeout(() => el.focus(), 0);
  };

  const commands = useMemo(() => {
    const st = useStore.getState;
    const actions: PaletteActions = {
      goStory: (chapter) => {
        const wasLab = st().mode !== "story";
        if (usePresenter.getState().active) usePresenter.getState().stop();
        if (wasLab) st().setMode("story");
        window.setTimeout(() => runSlideScroll(chapter, 0.08, 0.08, 1.2, reduce), wasLab ? 250 : 30);
      },
      goLab: (section, view) => { if (usePresenter.getState().active) usePresenter.getState().stop(); st().goLab(section, view); window.scrollTo({ top: 0 }); },
      setCompound: (key) => st().setSetup({ compoundKey: key, highDose: ARCHETYPES[key]?.defaultDoseMgPerKg ?? st().setup.highDose }),
      setDisease: (d) => st().setSetup({ disease: d }),
      startPresenter: (track) => usePresenter.getState().start(track),
      openNotes: () => { openNotesWindow(); },
      setTheme: (t) => st().setTheme(t),
      toggleCb: () => st().setCbPalette(!st().cbPalette),
      cbOn: cb,
      setQuality: (q) => st().setQuality(q),
      toggleSound: () => { if (soundIsOn()) disableSound(); else void enableSound(); },
      soundOn,
      hasData: !!data,
      exportCsv: () => { const d = st().study.data; if (d) download("study-animals.csv", studyToCsv(d.study), "text/csv"); },
      exportJson: () => { const d = st().study.data; if (d) download("study.json", studyToJson(d), "application/json"); },
      exportHtml: () => { const d = st().study.data; if (d) download("study-report.html", studyToHtml(d), "text/html"); },
      rerun: () => { void st().runStudy(); },
      detail,
      toggleDetail: () => st().setDetail(st().detail === "simple" ? "expert" : "simple"),
    };
    return buildCommands(actions);
  }, [cb, data, soundOn, reduce, detail]);

  const results = useMemo(() => filterCommands(query, commands, 40), [query, commands]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({ block: "nearest" }); }, [active, results]);

  if (!open) return null;

  const run = (i: number) => { const c = results[i]; if (!c) return; close(); c.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(Math.max(0, results.length - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") { e.preventDefault(); }
  };

  return (
    <div className="palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey}>
        <input
          ref={inputRef}
          className="palette-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${uid}-list`}
          aria-activedescendant={results[active] ? `${uid}-${results[active]!.id}` : undefined}
          aria-autocomplete="list"
          aria-label="Search commands"
          placeholder="Search chapters, views, compounds…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <ul className="palette-list" id={`${uid}-list`} role="listbox" aria-label="Commands" ref={listRef}>
          {results.map((c, i) => (
            <li key={c.id} id={`${uid}-${c.id}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseMove={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => run(i)}>
              <span className="t">{c.title}</span>
              <span className="g">{c.group}</span>
            </li>
          ))}
          {results.length === 0 && <li className="none" role="presentation">Nothing matches “{query}”.</li>}
        </ul>
        <div className="palette-foot" aria-hidden="true"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>Esc</kbd> close</span></div>
        <span className="sr-only" role="status" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"}</span>
      </div>
    </div>
  );
}
