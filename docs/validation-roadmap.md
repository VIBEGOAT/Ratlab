# Validation roadmap

**Status today: no real animal data is loaded, so no subsystem is validated.** The harness in `packages/sim-core/src/validation.ts` reports `NO_DATA` until data is supplied through the Validation tab.

## Datasets to source (licence and availability must be checked for each)

| Dataset | Used for |
|---|---|
| Vendor historical control reports (Charles River, Inotiv) for the chosen strain, sex, age and duration | Body weight curves, organ weights, clinical chemistry and haematology ranges and variability |
| Open TG-GATEs (Igarashi et al. 2015, verified reference) | Rat repeated-dose studies with pathology and clinical chemistry for compounds with known liver and kidney outcomes |
| DrugMatrix | Rat toxicogenomics and pathology across many compounds |
| eTOX and eTRANSAFE resources | Legacy preclinical safety reports (availability to be verified) |
| Published rat plasma concentration-time profiles for reference compounds | PBPK calibration and prospective prediction tests |
| VICT3R project data (IHI) | Virtual control group methods and shared historical control data |
| Rat telemetry and cage-monitoring recordings | Circadian activity, temperature and feeding |
| Published water-maze, open-field, elevated plus maze and sucrose preference control data | Behavioural baselines |

## What each subsystem needs to move up

| Subsystem | Today | Needed to reach the next level | Next level |
|---|---|---|---|
| PBPK and PD solvers | MECHANISTIC | Independent comparison with PK-Sim on 3 to 5 compounds | Verified numerics |
| Rat physiology | SEMI-QUANTITATIVE | Primary tables (Brown 1997, Davies and Morris 1993) read and every constant verified; strain-specific data | Verified inputs |
| Compound parameters | Fictional archetypes | Real compound ADME data, or in vitro to in vivo extrapolation | Real-compound predictions |
| Toxicodynamics (liver, kidney, heart, marrow, gut, brain) | SEMI-QUANTITATIVE | Dose-response and time-course data per organ (TG-GATEs, DrugMatrix), Bayesian calibration, held-out compounds | Calibrated, with prediction intervals |
| Clinical pathology mapping | SEMI-QUANTITATIVE | Paired organ injury and biomarker data, vendor reference ranges | Calibrated mapping |
| Disease overlays | SEMI-QUANTITATIVE | Published xenograft growth and STZ time courses, with treated groups | Calibrated overlays |
| Humane endpoints | SEMI-QUANTITATIVE | Institutional policy and historical incidence of early euthanasia | Policy-aligned |
| NOAEL logic | SEMI-QUANTITATIVE | Retrospective NOAELs from real studies | Concordance estimate |
| Behaviour | ILLUSTRATIVE | Tracking and telemetry data; agreement metrics per endpoint | Semi-quantitative at best |
| Human translation | ILLUSTRATIVE | Compounds with both rat NOAEL and human first-in-human outcomes | Concordance estimate |

## Steps
1. Replace placeholder constants with verified values (`data/needs-expert-check.md`).
2. Load vendor historical controls. Re-run the Validation tab. Fix any failing endpoints.
3. Calibrate PBPK on a few reference compounds, then predict held-out compounds and held-out studies. Report fold error with intervals.
4. Calibrate toxicodynamics per organ on public repeated-dose data. Report concordance of grade and biomarker predictions on held-out compounds.
5. Define a context of use and re-run the credibility assessment. The aim is to reach the evidence level its risk needs.
6. Run a blind prospective test: predict a new study, then compare with the real result.
7. Take the evidence package to a toxicologist panel, and then a regulator if the use needs one.
