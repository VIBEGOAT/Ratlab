# Validation roadmap (draft)

Status today: **no real animal data is loaded**, so no subsystem is validated. The harness in `packages/sim-core/src/validation.ts` reports `NO_DATA` until data is supplied.

## Datasets to source (licence and availability must be checked for each)

| Dataset | Used for | Moves which subsystem |
|---|---|---|
| Vendor historical control reports (Charles River, Inotiv) for the chosen strain, sex, age and duration | Body weight curves, organ weights, clinical chemistry and haematology ranges, variability | physiology, clinical pathology mapping, virtual control groups |
| Open TG-GATEs (Igarashi et al. 2015) | Rat repeated-dose studies with pathology and clinical chemistry for compounds with known liver and kidney outcomes | toxicodynamics (liver, kidney), clinical pathology |
| DrugMatrix | Rat toxicogenomics and pathology across many compounds | toxicodynamics, benchmarking |
| eTOX and eTRANSAFE resources | Legacy preclinical safety reports | toxicodynamics (heart, brain, marrow) |
| Published rat plasma concentration-time profiles for reference compounds | PBPK calibration and prospective prediction tests | PBPK |
| VICT3R project data (IHI) | Virtual control group methods and shared historical control data | virtual controls |
| Rat telemetry and cage-monitoring recordings | Circadian activity, temperature and feeding | behaviour (still ILLUSTRATIVE) |
| Published water-maze, open-field and elevated plus maze control data | Behavioural baselines | behaviour |

## Steps toward credibility
1. Replace placeholder constants with verified values (see `data/needs-expert-check.md`).
2. Calibrate PBPK on a small set of reference compounds, then predict held-out compounds and held-out studies.
3. Report prediction error (fold error for PK, concordance for pathology) with intervals.
4. Define a context of use and re-run the V&V 40 style credibility assessment.
5. Blind prospective test: predict a new study, then compare with the real result.
