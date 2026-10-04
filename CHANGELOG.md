# Changelog

## Front-end upgrade, phase (a): bug fixes, design system, shell, Story and Lab modes

The simulation core's behaviour is unchanged. The original 188 simulation tests pass unchanged. New tests: 5 simulation, 21 interface, 9 end-to-end.

### Bugs fixed (from the review screenshots)
1. **Timeline did not follow the study length.** Results now re-run automatically about 0.65 s after any setting changes, and a status line says "Settings changed. Updating results…" meanwhile. With recovery groups, the default animal is the high-dose recovery animal, so the timeline covers dosing plus recovery. Tests: `pkIntervals.test.ts` (90-day and 104-day records), `shell.test.ts` (focus choice), end-to-end "timeline length follows the configured study length".
2. **Tmax of 73 h for once-daily dosing.** It was the time of the single highest point of the whole study. A new `intervalPk` helper reports Cmax, Tmax after the dose, AUC over the interval and trough for the first dose and the last complete dose, at full 15-minute resolution. The accumulation ratio carries a plain-English explanation. Tests: `pkIntervals.test.ts`, end-to-end "PK reports Tmax per dose".
3. **Duplicate "MECHANISTIC" badges.** Chips now name their subsystem ("PBPK · Mechanistic"), are de-duplicated, and show the justification on hover or keyboard focus.
4. **Overflowing 16-tab bar.** Replaced by a Story and Lab mode switch. Lab has five sections (Design, Animal, Data, Population, Translate & Trust). Every previous view is kept.
5. **3D anatomy.** Scheduled for phase (b).
6. **Cryptic sidebar.** Replaced by a setup panel with plain-language compound cards, four primary choices and an "Advanced" drawer.
7. **Incomplete chart axes.** Axis titles are now required by the chart's type, and every chart has a title with units. Tooltips and ticks use locale number formatting. The PK chart switches between first dose, last dose and whole study.

### Found in the audit and fixed
- **Hang on first visit:** the selected animal could stay on "Preparing…" forever when the browser cache was blocked by another connection. Cache calls now close their connection and give up after 1.5 s.
- **Re-runs piling up:** rapid re-runs queued behind each other in one worker. Workers now run in lanes and a new study cancels the previous one.
- **Horizontal scroll at phone width (390 px):** top bar, view switchers and panel headers now wrap or scroll inside themselves.
- **NaN or Infinity on screen:** numbers now go through one formatter that shows "n/a" for non-finite values.
- **Default study:** 5 animals per sex per group, now 10 (TG 407 style).
- **First run:** each completed run is cached in the browser by simulator version and setup, so the default study opens instantly the second time.
- **Clinical pathology tables:** these had no units column. Added.

### Removed because it could be questioned
- **Forced swim test:** removed from the interface. It is scientifically and ethically contested. The function remains in the core so existing tests are unchanged.
- **MABEL stub:** removed from the core and the interface. It had no real calculation.
- **Honesty banner:** the long banner is replaced by a slim footer chip showing the true count (117 of 125 parameters unverified) that opens a clear panel.

### Known, not yet fixed
- The 3D rat still uses the old model, and its canvas still relies on the resize workaround. Both are replaced in phase (b).
- Headless screenshots render WebGL in software, so lighting quality in screenshots is not final.
