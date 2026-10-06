# Changelog

## Lab redesign: simpler, with motion and rat sounds

- **Overview first.** The Lab now opens on "Your study at a glance": the verdict in one sentence ("No adverse effect up to 2.4 mg/kg/day. Adverse from 8 mg/kg/day."), the first sign of harm in plain words, a dose ladder (control to high dose, each marked), an organ map for the animal shown, four tiles (highest safe dose, first organ affected, humane endpoints, peak drug level) that each open their analysis, and the same trust verdicts as the Story.
- **Simple and Expert.** A switch in the Lab toolbar, remembered between visits. Simple (the default) folds expert-only material behind "Show …" buttons: the full endpoint table and adverse-call rules, the compound parameter table, the 3D layer, speed and quality controls, the observation battery, learning curve and track, every animal's humane-endpoint reason, and the constants list. Nothing was removed. The palette has a command for it.
- **Plain language.** Endpoint keys are now names ("chem.troponinI" reads "Troponin I (heart damage)"), adverse findings read as sentences ("AST (liver and muscle enzyme) in males, up 416%"), organ cards show a grade word, colour dot and bar instead of raw numbers, blood markers and behaviour items are named, and the 3D view starts with an Outside/X-ray switch instead of twelve checkboxes.
- **Motion.** Section icons with a highlight that glides to the active section, a sliding tab pill, a fade-and-rise for each view with its blocks one after another, count-up numbers, a growing dose ladder, a gentle glow on injured organs, and cards that lift under the pointer. All of it stops under reduced motion.
- **Rat sounds** (off by default; the engine loads only when switched on). Synthesised, quiet sniffing while a rat is on screen, footsteps in the arenas, a short curious chirp when you click an organ, and "Listen to the heart" at the modelled rate. A sicker rat is quieter and sniffs less often; it never makes a distress sound, and at a humane endpoint it is silent. The toolbar tooltip says that real rats make most of their calls above the range of human hearing.
- **Bugs fixed.** The pre-baked default study had written number arrays as objects, which left the Behaviour tab's 24-hour activity and temperature charts empty; it is now written correctly, a test guards it, and the file is a fingerprinted asset so a stale copy can never be served from a browser cache. The Story's sound bed could keep playing after switching to the Lab. The Design hint pointed to a "left panel" that does not exist. In Expert mode the 3D layer checkboxes were below the WCAG 2.2 target size.
- **Tests.** New unit tests for the plain-language names, the verdict and dose ladder, the rat-sound rules and the pre-baked file's shape; new end-to-end tests for the Overview, Simple/Expert, the sound toggle and the rat voices; the accessibility gate now covers the Overview and Expert mode; visual baselines updated on purpose and an Overview baseline added at three sizes.

## Front-end upgrade, phase (g): performance, accessibility and QA gates, README, demo script

- **Performance.** Lighthouse performance on the production build went from 66 to 94 to 99 on desktop (accessibility 100, best practices 100, SEO 100; mobile profile 84). Entry JavaScript fell from 437 kB to 112 kB gzipped. What did it: the 3D engine left the entry bundle; the rat body mesh is built in a Web Worker; shaders compile in parallel before the first frame; Auto quality starts light and rises when frames are steady; the WebGL probe and the live scene wait for idle (on phones, for the first touch or scroll); Framer Motion was replaced with 30 lines and CSS; Geist is self-hosted, with the stylesheet and Latin font inlined and the hero present in the HTML before any script runs. On a computer that renders WebGL on the CPU, the page shows the still picture with a "Turn on 3D" button. `?3d=0` opens a light version. Details and caveats in `docs/quality-gates.md`.
- **Accessibility.** axe-core (WCAG 2.2 AA and best practice) is now a test gate over the Story, all Lab sections and views, the palette, the drawer, presenter mode and the notes window, in light, dark and colour-blind palettes. It found and I fixed: light-theme teal, amber and orange a little under 4.5:1 contrast, no level-one heading in the Lab, keyboard-unreachable scrollable tables, empty table headers, an invalid dialog role, the presenter controls outside a landmark, grade colours used as text, `role="row"` without cells, and accessible names that did not start with the visible text.
- **Visual regression.** 15 baselines: five pages at 1440x900, 1920x1080 and 390x844.
- **Bundle report and budgets.** `npm run bundle` writes `docs/bundle-report.md` and fails if a budget is exceeded.
- **Lint.** ESLint 9 with typescript-eslint, react-hooks and jsx-a11y. Clean. Two behaviour-neutral `let` to `const` changes in sim-core (`analysis.ts`, `specialfns.ts`); all 199 simulation tests pass.
- **CI.** `.github/workflows/ci.yml` runs generation, lint, types, unit tests, the bundle budgets and the end-to-end suite.
- **Docs.** README rewritten for the product as it now is; `docs/demo-script-3min.md` is a timed, spoken script matching the 3-minute presenter track; `docs/quality-gates.md` records what was measured and what was not.
- **Bugs fixed on the way.** A missing favicon and `robots.txt`; the Story's 3D import that made every visitor download three.js.

## Front-end upgrade, phase (f): command palette, chart rebuild

- **Command palette (Ctrl/Cmd+K, or the Search button).** One box for everything: the 12 Story chapters, all 16 Lab views, the six compounds, the four disease models, re-run, the 3- and 8-minute demos, the speaker-notes window, theme, colour-blind palette, 3D quality, sound, and the three exports (only when there is data). Every word you type must match; title starts and whole words rank above keyword hits. It is an accessible combobox dialog: arrow keys, Home and End, Enter to run, Escape to close with focus returned, a result count read out to screen readers, and no focus escape. Toggles are worded by their current state ("Turn sound off").
- **Lab.** The five-section layout from phase (a) stays; its navigation data moved to `lib/nav.ts` so the palette can use it without loading the Lab.
- **Charts rebuilt.** Units now sit above the y axis as horizontal text. Series are labelled on the lines themselves (a legend row appears instead on narrow screens, or when a line stops short of the right edge), so the separate legends under the charts are gone. Lines break at missing values instead of joining across them. One readout reads every series at the same x (the old one used the first series' index for all, which was wrong when series had different lengths), with a marker on each line and step-correct values for survival curves. The y axis widens for long numbers. Keyboard: focus a chart and use left and right arrows, Home, End and Escape; the reading is announced. A collapsible data table sits under every chart (evenly sampled to 40 rows for long series). Lines draw in once on mount, and not at all under reduced motion.
- **Bug fixed.** A Latin-1 multiplication sign in the Behaviour tab would have shown as a broken character ("4? speed"); it is now proper UTF-8.
- **Phone.** The secondary top-bar buttons (sound, present, colour-blind palette) hide below 720 px; all of them stay in the palette.
- **Tests.** 15 new unit tests (chart maths, command list and matching) and 3 end-to-end tests (palette open, run, empty state, focus return and Story jump; chart labels, keyboard readout and data table) plus a screenshot test.

## Front-end upgrade, phase (e): presenter mode, audience prediction, instant first run, optional sound

- **Presenter mode.** Press **P** (or the Present button). The top bar hides, type grows, the page goes full screen where the browser allows it, and the footer disclaimer stays. Right arrow, Page Down, Space or Enter go forward; left arrow or Page Up go back; Home and End jump; **A** toggles auto-advance; **N** opens the notes window; Escape exits. A thin progress bar tracks the whole track. The controls fade out when the mouse is still.
- **Two scripted tracks.** A 3-minute (12 slides) and an 8-minute (14 slides) demo. Each slide scrolls to its chapter and drifts through it, so day counters and the humane-endpoint lines play in order. With auto-advance on, each slide moves on after its planned time. Reduced motion jumps instead of drifting.
- **Speaker notes on a second screen.** `#notes` opens a light window linked over BroadcastChannel (same browser, nothing leaves the machine): notes for this slide, the next slide, elapsed and planned time, the room's tally, and Back, Next, Auto-advance and End buttons that drive the main window. The notes state the caveats out loud (does not replace animal studies, parameters unverified, never guide a real dose, behaviour is not a claim about feelings).
- **"Which organ will fail first?"** Five big buttons (keys 1 to 5), counted on this device only, with Undo and Clear. The reveal slide shows which organ first reached mild injury in the simulation (or, if none did, the highest peak), the share of the room that chose it, and a plain note that it is a modelled result for a virtual rat. The answer is visible to the presenter in the notes window before the reveal.
- **Instant first run.** `npm run gen:prewarm` bakes the default study, its twin and the 1,000-rat population into `public/prewarm/default.json` (about 1.9 MB). It is used only when the simulator version and the whole setup match, otherwise the study computes live. A unit test fails if the file goes stale, and `npm run ci` regenerates it.
- **Optional sound.** Off by default, never starts by itself, and loads its code only when switched on. Quiet interface ticks on chapter changes and votes, a low ambient bed and a soft heartbeat (the model's resting heart rate, scaled down) during dose day and the damage chapter. The heartbeat and bed fade to complete silence during the humane-endpoint moment. Suspends when the tab is hidden.
- **Tests.** 17 new unit tests (tracks, prediction answer and tally, scroll arithmetic, sound plan, prebaked file) and 5 end-to-end tests (keyboard navigation, prediction and reveal, notes window sync, auto-advance, sound off by default).


## Front-end upgrade, phase (d): Story chapters 7 to 12

- **7 · Meet the twin.** The treated rat and its untreated twin are drawn in the same scene, split by a draggable divider (a real slider: pointer, arrow keys, Home and End). A table beside it compares tumour, weight, sickness and heart injury on the day the untreated twin reaches its humane endpoint.
- **8 · A thousand rats.** One dot per virtual rat, 1,000 treated and the same 1,000 untreated, simulated in 100-rat chunks in their own worker lane so the dots fill in as results arrive. Dots are coloured by the worst organ injury grade, with a ring for a humane endpoint. Survival curves draw themselves as the reader scrolls, with 95% ranges. The ranges state that they cover chance only and not the model's unverified parameters. Results are cached by simulator version. The population run uses a 0.5 h time step (twice as fast); a test confirms the mean grade stays within 0.6 of the 0.25 h result.
- **9 · How it behaves.** The open-field arena with both rats and their movement trails, labelled as modelled endpoints.
- **10 · Toward humans.** Rat to human scale-up, arithmetic only, with the Km factors flagged unverified. The safety-margin gauge and the human exposure projection were left out on purpose. If no dose is free of adverse effects, it says so.
- **11 · How far to trust it.** An intended-use selector drives the V&V 40 style verdict: teaching passes, and screening, study design and replacing an animal study do not. One chip per subsystem, plus the real unverified count and "None yet" for animal validation.
- **12 · Every animal we spare.** An editable animals-spared calculator, three differentiators, and only VERIFIED references. Virtual controls start at 0%.
- **New sim-core function** `simulatePopulation`: one outcome per virtual rat. Additive; no existing function changed.

### Bug found by reviewing the screenshots, and fixed
- **Benefit was being called harm.** In the tumour scenario, the NOAEL rule reported "no dose level free of adverse effects". Cause: the control animals have tumours and waste, so treated animals looked 18 to 26% heavier and had heavier absolute spleens, and the rule counted any large change in either direction. Now:
  - Rises in body weight, food intake, albumin and blood counts are not adverse.
  - Adversity is judged on relative organ weights only.
  - Result: NOAEL 2.4 mg/kg, LOAEL 8 mg/kg, with the real cardiac signal (AST, troponin, CK, heart weight) at the top dose only.
  - New test: `NOAEL in a disease model`.

### Other fixes
- **Phone layout:** a later CSS rule overrode the mobile offset, so text could cover the 3D stage. Fixed, and tall chapters get more scroll room on phones.
- **Misleading ranges:** a "0.0% to 79.3%" range was shown with zero rats loaded. It now says "waiting for the first rats", and says "so far" while the run is partial.
- **Intended-use switcher:** it was clipped in chapter 11. It now wraps.
- **Mid-animation label:** the human-scale graphic said "human equivalent dose" while its number was still moving. It now says "scaling by body surface area" until it arrives.
- **Damage colours:** the mild and moderate grades (amber and orange) were hard to tell apart in the dot field. Mild is now yellow.
- **Slow tests:** tests that only check the Lab, footer or layout can skip the 3D scene with a `no3d` local-storage flag. Five of them dropped from several minutes to 47 seconds.

### Known
- Under the default scenario most treated rats show moderate heart injury at the top dose (79% grade 3 in the thousand-rat run), which matches the single-study result. Only 0.1% reach a humane endpoint.
- The earlier finding stands: in the core, severe organ injury on its own rarely reaches a humane endpoint. Recalibrating that is a simulation-core change and needs approval.

## Front-end upgrade, phase (c): Story chapters 1 to 6

- **One pinned 3D scene** for the whole story, lazy-loaded behind a poster frame. The camera choreography is bound to scroll: a turntable hero, a side view for the X-ray sweep, a three-quarter view for choosing, close-up flow for dose day, a slow orbit for damage, and a pull-back for the moment. The distance adapts to the stage's shape so the whole rat stays in frame. Lenis smooth scrolling is used, except under reduced motion.
- **Chapters.**
  - Hero: turntable rat and an animals-spared count whose assumptions show on hover.
  - Meet the rat: an X-ray sweep from head to tail as you scroll, with organs named.
  - Choose: compound cards and a single dose dial. The dial is a real slider, by drag or keyboard, with announced values. Changing either re-runs the study.
  - Dose day: a capsule travels to the stomach, then glowing particles carry the dose through the gut, portal vein, liver, vena cava, heart, aorta and kidneys. Particle density follows plasma concentration and organ glow follows tissue concentration, both from the PBPK output hour by hour.
  - Damage: the day advances with scroll. It shows organ grade pills in the damage scale, a biomarker ribbon (ALT, bilirubin, creatinine, troponin as multiples of the upper limit, with sparklines), a Hy's Law alert when met, visible signs, and the treated against untreated tumour size.
  - The moment: the screen dims, the rat's motion slows, three calm lines appear in turn, then the count of virtual rats and how many would have reached a humane endpoint. There are no alarms or red flashing. Under reduced motion the text shows at once.
- **Default scenario changed** from the liver-toxic compound to the heart-toxic anticancer compound in tumour-bearing rats. It shows efficacy and toxicity together, and untreated tumours reach the humane limit (16 of 20 control rats, from day 16), which the moment needs in order to be honest.
- **Finding for review, not changed.** In the current core mapping, severe organ injury on its own almost never reaches a humane endpoint. Of the five toxic compounds at 1, 1.5 and 2 times their reference dose, only the nerve-toxic one did, through convulsions. Weight loss, grimace and sickness stay under their thresholds even with grade 4 to 5 liver damage. This is likely under-calibrated. Recalibrating the sickness mapping is a change to the simulation core and needs approval.
- **Tests.** 5 new end-to-end story tests: the full chapter run, dial keyboard control, the moment text, reduced motion, and screenshots of all 6 chapters at 1440, 1920 and 390 wide with no horizontal scroll.

## Front-end upgrade, phase (b): 3D rat rebuild

- **One continuous body.** The rat is now a signed distance field (torso, chest, head, snout, four legs and paws blended smoothly) meshed by surface nets into a single closed mesh. A test proves it is one connected piece and that the paws rest on the floor.
- **Anatomy checked by tests.** Every organ, the gut, the major vessels and the marrow sites stay inside the skin, also at maximum wasting. Eyes, ears, nose, tear stains and the tumour are seated on the skin by ray marching, and the eyes are mirrored left and right. Two placement errors were caught by these tests and fixed: the liver poked through when wasted, and the ears landed below the eyes.
- **Organs in rat topography.** Brain in the skull, heart between the lungs, two-lobed liver behind it, stomach, coiled intestine, dorsal kidneys, spleen, bladder, femoral and vertebral marrow, plus aorta, vena cava, portal vein, and renal and femoral branches.
- **Shading.**
  - Fur shells (12 on High), with ruffled fur driven by piloerection.
  - Bare-skin areas (paws, nose, ears, tail) take the jaundice tint.
  - Ruby eyes with a glossy cornea, as in albino lab strains.
  - Fresnel rim light.
  - An X-ray shell with an edge glow that lets organs read clearly.
- **Organ appearance by state.** The liver goes pale yellow-brown, the kidney pale, the heart dark, and the brain shimmers. The marrow glows. Grade 2 and above pulse in the damage colour. The heart beats at the simulated rate.
- **Signs on the body.** Wasting thins the trunk, the back arches with hunching, and the head drops. Tremor and convulsion jitter, and ataxia sways. Red tear stains, a cataract overlay, a growing tumour, a grimace that squints the eyes and flattens the ears, and a gait for the arenas.
- **Environment.** Studio environment lighting from procedural light panels, with no downloaded files. Contact shadows. On High only: a soft reflective floor, bloom, vignette, and depth of field when an organ is selected.
- **Interaction.** Clicking an organ or its card flies the camera in and opens its detail card. Dragging or zooming hands control back. Clicking empty space clears the selection. Organ labels keep a fixed size on screen and show only in X-ray or for the selected organ.
- **Performance.**
  - The Quality setting (Auto, High, Low) is remembered, and Auto drops to Low when frame rate falls.
  - Pixel density adapts.
  - Arenas use the Low model.
  - Geometry is built once and shared, and per-instance geometries and materials are disposed on unmount.
  - The body mesh builds in under 4 s in tests (typically much less).
- **Licensing.** No third-party 3D assets were used.

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
