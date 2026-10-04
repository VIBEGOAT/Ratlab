# ELIMINATE-Lab (working name)

In-silico rat study simulator aimed at replacing, reducing and refining animal testing (3Rs).

**Research and education tool. Not validated for regulatory or safety decisions.**

## Layout
- `data/reference.json` all numeric constants, each with source, confidence and VERIFIED or UNVERIFIED status
- `data/references.json` bibliography with verification status
- `data/needs-expert-check.md` generated list of everything still unverified (`npm run gen:needs`)
- `packages/sim-core` pure TypeScript simulation library (seeded, deterministic, no UI imports)
- `apps/web` Vite + React + Zustand interface; simulation runs in a Web Worker

## Commands
- `npm run ci` regenerate review file, type-check, run tests

## Status
Phase (a) done: seeded forkable RNG, reference data schema and validator, fidelity registry, tests.
Phase (b) done: 17-compartment PBPK (exact matrix-exponential propagation), RK45 solver, PD library, organ toxicodynamics with defence depletion, regeneration and adaptation, DDI and organ-feedback on clearance, six fictional archetypes, 82 tests.
Phase (c) done: tumor and diabetes overlays, disease-toxicity interaction, untreated twin, observables (weight, intake, sickness, pain, clinical signs, clinical chemistry, haematology, Hy's Law, QT-like marker, necropsy), humane endpoints, behaviour (home cage, observation battery, open field, EPM, sucrose, forced swim, water maze, tracks), 129 tests.
Phase (d) done: study engine (control plus low, mid, high, recovery and TK satellites, litter effects, humane early termination), Dunnett and Kruskal-Wallis analysis with trend and Fisher tests, NOAEL, LOAEL and MTD, Monte Carlo forecast with Kaplan-Meier and log-rank, Morris sensitivity, validation harness, V&V 40 style credibility report, virtual control groups, human translation, 184 tests.
Phase (e) done: React + Vite web app with a Web Worker running the simulation, 16 tabs, study setup rail with custom compound editor, charts, CSV/JSON/HTML exports, theme toggle, keyboard-navigable tabs, CSV upload for historical controls, 8 UI tests.
Phase (f) done: rotatable procedural 3D rat (react-three-fiber) with X-ray and skeleton layers, organ colour and grade labels driven by damage, clickable organs with timelines and markers, visible signs (wasting, jaundice, ruffled fur, hunching, tremor, ataxia, red tears, cataract, tumor, grimace), day scrubber with play and speed, treated and untreated twins side by side, and 3D behaviour arenas (open field, water maze, home cage). The model reads one RatVisualState so a glTF model can replace it.
Next: (g) pitch polish, report export, expert-review checklist, validation roadmap, final fidelity table.

## Run the app
`npm install` then `npm run dev` and open http://127.0.0.1:5173 . `npm run build` makes a static site in apps/web/dist.

Try it: `npx tsx scripts/explore.ts hepatotoxin 28` prints PK and damage versus dose.
