# Changelog

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
