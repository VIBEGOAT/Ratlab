# ELIMINATE-Lab

**Every animal we spare starts with a simulation we can trust.**

A web-based in-silico rat laboratory. It simulates a repeated-dose rat study (dosing, PK/PD, organ toxicity, disease progression, behaviour, clinical pathology, necropsy, statistics, humane endpoints and a human-translation outlook) on a 3D virtual rat, to help replace, reduce and refine animal testing (the 3Rs).

> **Research and education tool. Not validated for regulatory or safety decisions.**
> It does not replace animal studies. Compounds are fictional archetypes. Most parameters are unverified placeholders (see `data/needs-expert-check.md`). Nothing has been validated against real animal data.

## Start with toxicity

The opening **VAST Toxicity** workbench connects dose and duration to simulated organ responses, pharmacokinetic curves, and human-equivalent dose conversion. Compare a selected daily dose with half that dose, inspect organ changes by day, and add a recovery period. The compound profiles are fictional; missing organ mechanisms are labeled **Not modeled**. See [workbench scope and methods](docs/toxicity-workbench.md).

- **Toxicity** (`#toxicity` or the root page): focused experiment dashboard.
- **Learn** (`#learn`): a guided dose/exposure practical with a student notebook.
- **Story** (`#story`): the original twelve-chapter introduction around a virtual rat.
- **Lab** (`#lab`): the full exploratory simulator, study design, animal, data, population, and translation tools.

Also: **presenter mode** (press `P`; 3- and 8-minute scripted tracks, speaker notes on a second screen, a "which organ fails first?" audience prediction), a **command palette** (`Ctrl/Cmd+K`), optional **sound** (off by default), light, dark and colour-blind-safe themes, and exports (CSV, JSON, a printable HTML report).

## VAST classroom

Choose **Learn** in the top navigation, or open `#learn`, for a guided college practical on dose, clearance, and repeated dosing. Students predict outcomes, compare concentration curves, record reflections, and complete a formative knowledge check. Includes locally saved notebooks, CSV exports, a printable worksheet, and instructor guidance.

The practical uses an explicitly fictional one-compartment teaching model, separate from the exploratory rat PBPK simulator. No account or WebGL is required. See [the practical guide](docs/teaching-practical.md) for scope, equations, storage behavior, and verification. Classroom learning outcomes have not yet been evaluated.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in apps/web/dist
npm run ci           # everything below, in order
```

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint with TypeScript, React hooks and jsx-a11y rules |
| `npm run typecheck` | Strict TypeScript, both packages |
| `npm test` | 266 unit tests (199 simulation, 67 interface) unit tests (simulation core and web app) |
| `npm run bundle` | Builds, then enforces bundle-size budgets and writes `docs/bundle-report.md` |
| `npm run test:e2e` | Playwright: behaviour, axe accessibility scans, visual regression. Takes 20+ minutes in full; run one Playwright command at a time |
| `npm run gen:prewarm` | Rebuilds the pre-baked default study (a unit test fails if it goes stale) |

Visual baselines live in `apps/web/e2e/visual.spec.ts-snapshots` (Windows renderings). Update them on purpose with `npx playwright test e2e/visual.spec.ts --update-snapshots` from `apps/web`.

## Keys and links

| | |
|---|---|
| `P` | Start or stop presenter mode |
| Right arrow, Page Down, Space | Next slide. Left arrow or Page Up goes back |
| `A` / `N` | Auto-advance / open the speaker notes window |
| `1` to `5` | Count a vote on the prediction slide |
| `Ctrl/Cmd+K` | Command palette: any chapter, Lab view, compound, demo, theme, export |
| `Esc` | Close a dialog, or leave presenter mode |
| `#lab/<section>` | Open a Lab section directly (`overview`, `design`, `animal`, `data`, `population`, `trust`) |
| `?3d=0` | Open the lightweight version without the live 3D scene |

On a computer that renders WebGL on the CPU, the page shows a still picture and a "Turn on 3D" button instead of a slow scene.

## Quality gates

Measured on the production build (`vite preview`) with Lighthouse 12, desktop preset, headless Chrome with an Intel UHD integrated GPU. See `docs/quality-gates.md` for method, mobile numbers and caveats.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---:|---:|---:|---:|
| Story, live 3D | 96 | 100 | 100 | 100 |
| Story, `?3d=0` | 99 | 100 | 100 | 100 |
| Lab (PK/PD) | 99 | 100 | 100 | 100 |

Mobile profile (simulated slow 4G and a 4x slower CPU): performance 84, the other three 100. Desktop performance varies by a few points from run to run (94 to 99 seen).

- **Accessibility:** axe-core finds no violations (WCAG 2.2 AA and best practice) in the Story, all five Lab sections and seventeen views, the palette, the honesty drawer, presenter mode and the notes window, in light, dark and colour-blind palettes. Charts are keyboard-readable and have data tables. Reduced motion is respected.
- **Bundle:** the entry JavaScript is 111.7 kB gzipped; the 3D engine, the audio engine and each Lab view are separate chunks. Budgets are enforced by `npm run bundle`.
- **Visual regression:** 18 screenshots (six pages at 1440x900, 1920x1080 and 390x844).

## What is where

| Path | Purpose |
|---|---|
| `packages/sim-core` | Pure TypeScript simulation library, seeded and deterministic, no UI imports |
| `apps/web` | React and Vite interface. The simulation runs in a Web Worker. 3D uses react-three-fiber |
| `apps/web/src/story`, `three`, `presenter`, `palette`, `audio` | Story chapters, the procedural 3D rat, presenter mode, command palette, optional sound |
| `apps/web/src/prewarm` | The pre-baked default study (a fingerprinted asset), so a first visit is instant |
| `data/reference.json` | Every numeric constant with source, confidence and VERIFIED or UNVERIFIED status |
| `data/references.json` | Bibliography with verification status |
| `data/needs-expert-check.md` | Generated list of everything unverified |
| `docs/fidelity-table.md` | Generated MECHANISTIC, SEMI-QUANTITATIVE and ILLUSTRATIVE table |
| `docs/expert-review-checklist.md` | Checklist for toxicologist, pathologist, pharmacokineticist, behavioural neuroscientist, biostatistician, regulatory affairs |
| `docs/validation-roadmap.md` | Which datasets are needed and what each subsystem needs to move up |
| `docs/demo-script-3min.md` | A timed, spoken three-minute demo script |
| `docs/quality-gates.md`, `docs/bundle-report.md` | Measured quality and size |

## How the science is built

- Whole-body PBPK (17 compartments) propagated exactly with a matrix exponential, checked against an adaptive RK45 solver and for mass balance.
- PD library: Emax, effect compartment, indirect response (types I to IV), transit compartments, tolerance.
- Organ toxicodynamics: threshold, saturating injury, defence depletion, regeneration, adaptation.
- Disease overlays: Gompertz tumour with resistance, STZ-like and type-2-like diabetes with complications.
- Study engine in the style of OECD TG 407 and 408, with litter effects, recovery and TK satellites.
- Statistics implemented and tested from the published formulas: ANOVA, exact Dunnett, Kruskal-Wallis with Dunn, trend, Fisher, Kaplan-Meier, log-rank. NOAEL logic is direction-aware (a higher body weight or red-cell count is not read as harm).
- A thousand-rat population run (treated and untreated), Monte Carlo forecasts, Morris sensitivity screening, a validation harness, a V&V 40 style credibility report, virtual control group mechanics.

## Integrity rules the interface keeps

- One fidelity chip per subsystem (MECHANISTIC, SEMI-QUANTITATIVE, ILLUSTRATIVE), with the justification on hover or focus.
- A footer that is always visible and states what the tool is not.
- Every reference carries VERIFIED or UNVERIFIED in `data/references.json`; the Story shows only verified ones. No invented citations.
- The animals-spared number shows its assumptions, which you can edit; virtual controls start at 0%.
- Behaviour is a modelled endpoint, not a claim about what an animal feels. The humane-endpoint moment is serious and unhurried.
- Honest status: 115 of 125 constants and 8 of 32 references are still unverified, and no real animal data is loaded.

## Using your own data

The Validation view accepts historical control data as CSV (`dataset,source,strain,sex,ageWeeks,endpoint,n,mean,sd`). Until real data is loaded, validation reads `NO_DATA`.

## Known limits

- No real animal data. No subsystem is validated.
- Behaviour is ILLUSTRATIVE.
- The core's sickness-to-humane-endpoint mapping rarely triggers from organ injury alone; the default scenario reaches humane endpoints through untreated tumour growth. Recalibrating it is a change to the core and needs a decision.
- The Brown et al. 1997 physiology tables could not be read in full, so most physiology constants remain UNVERIFIED.
- The 3D rat is procedural (one signed-distance-field body, fur shells, organ shapes), not an anatomical scan.
- Live 3D has been measured on an integrated GPU only; there is no 60 fps figure for other laptops yet.
- The colour-blind palette has not been reviewed with the dot field by a person with colour-vision deficiency.
- Optional disease modules (CKD, NASH, heart failure, neurodegeneration, sepsis-like response), multi-species support and ML surrogate models are not implemented.
