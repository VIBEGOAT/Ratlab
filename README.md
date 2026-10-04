# ELIMINATE-Lab

A web-based in-silico rat laboratory that simulates a repeated-dose rat study: dosing, PK/PD, organ toxicity, disease progression, behaviour, clinical pathology, necropsy, statistics, humane endpoints and a human-translation outlook, all shown on a rotatable 3D virtual rat. The aim is to help replace, reduce and refine animal testing (the 3Rs).

> **Research and education tool. Not validated for regulatory or safety decisions.**
> It does not replace animal studies. Compounds are fictional archetypes. Most parameters are unverified placeholders (see `data/needs-expert-check.md`). Nothing has been validated against real animal data.

## Run it
```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # static site in apps/web/dist
npm run ci         # regenerate generated docs, type-check, run all tests
```

## What is where
| Path | Purpose |
|---|---|
| `packages/sim-core` | Pure TypeScript simulation library, seeded and deterministic, no UI imports |
| `apps/web` | React and Vite interface. The simulation runs in a Web Worker. 3D uses react-three-fiber |
| `data/reference.json` | Every numeric constant with source, confidence and VERIFIED or UNVERIFIED status |
| `data/references.json` | Bibliography with verification status |
| `data/needs-expert-check.md` | Generated list of everything unverified |
| `docs/fidelity-table.md` | Generated MECHANISTIC, SEMI-QUANTITATIVE and ILLUSTRATIVE table |
| `docs/expert-review-checklist.md` | Checklist for toxicologist, pathologist, pharmacokineticist, behavioural neuroscientist, biostatistician, regulatory affairs |
| `docs/validation-roadmap.md` | Which datasets are needed and what each subsystem needs to move up |

## The 16 tabs
Study Design, Live Rat 3D, Behaviour, PK/PD, Disease Progression, Clinical Obs, Clinical Pathology, Necropsy and Histopath, Statistics and NOAEL, Untreated Twin, Population and Humane Endpoints, Human Translation, Uncertainty and Credibility, Validation, Pitch, Model Fidelity and Assumptions.

Exports: CSV (one row per animal), JSON (full run) and a self-contained HTML report you can print to PDF. Each carries the seed, simulator version and fidelity labels.

## Using your own data
The Validation tab accepts historical control data as CSV (`dataset,source,strain,sex,ageWeeks,endpoint,n,mean,sd`). Until real data is loaded, validation reads `NO_DATA`.

## How it is built
- Whole-body PBPK (17 compartments) propagated exactly with a matrix exponential, checked against an adaptive RK45 solver and for mass balance.
- PD library: Emax, effect compartment, indirect response (types I to IV), transit compartments, tolerance.
- Organ toxicodynamics: threshold, saturating injury, defence depletion, regeneration, adaptation.
- Disease overlays: Gompertz tumor with resistance, STZ-like and type-2-like diabetes with complications.
- Study engine in the style of OECD TG 407 and 408, with litter effects, recovery and TK satellites.
- Statistics implemented and tested from the published formulas: ANOVA, Dunnett, Kruskal-Wallis with Dunn, trend, Fisher, Kaplan-Meier, log-rank.
- Monte Carlo toxicity forecasts, Morris sensitivity screening, a validation harness, a V&V 40 style credibility report, virtual control group mechanics.

## Status
Phases (a) to (g) are complete. 188 simulation tests and 14 interface tests pass.

## Known limits
- No real animal data. No subsystem is validated.
- Behaviour is ILLUSTRATIVE.
- The 3D rat is a low-poly procedural model.
- Optional disease modules (CKD, NASH, heart failure, neurodegeneration, sepsis-like response), multi-species support and ML surrogate models are not implemented. The code has hooks where they would go.
- The Brown et al. 1997 physiology tables could not be read in full, so most physiology constants remain UNVERIFIED.
