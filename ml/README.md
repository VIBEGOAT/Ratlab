# RatLab model training

This directory trains a bounded clinical-pathology estimator from measured Open TG-GATEs repeated-dose rat studies. It does not train on RatLab's simulated output.

## Current scope

- Inputs: compound identity, dose, dose level, duration, sex, strain, route and age.
- Outputs: measured clinical chemistry, haematology, terminal body weight, liver weight and kidney weight.
- Validation: complete compound/dose/time conditions are held out. A separate held-out-compound diagnostic exposes out-of-domain performance.
- Uncertainty: 90% split-conformal absolute residual intervals per endpoint.

The first model is intentionally limited to compounds present in Open TG-GATEs. Predictions for unseen compounds remain unsupported until molecular descriptors are added and external validation against DrugMatrix is complete.

## Reproduce

1. Download the official Open TG-GATEs `individual`, `biochemistry`, `hematology`, `organ_weight`, `body_weight`, `pathology` and `main` ZIP files into `ml/data/raw`.
2. Install `ml/requirements.txt` into a virtual environment.
3. Run:

```bash
python ml/prepare_tggates.py
python ml/train_clinpath.py
```

The model and its machine-readable model card are written to `ml/artifacts/clinpath-v1`.

Run a guarded prediction for an observed condition:

```bash
python ml/predict_clinpath.py --compound acetaminophen --dose 600 --days 28
```

The adapter rejects unseen compounds and compound/dose/duration combinations
outside the observed study design. Every endpoint is returned with a calibrated
90% error interval.

## Student-facing major-organ model

The website exposes only three repeat-dose models with complete measured
dose-by-day grids: acetaminophen (liver), gentamicin (kidneys), and
cyclophosphamide (blood/bone-marrow readouts). Train that focused artifact with:

```bash
python ml/train_clinpath.py \
  --output ml/artifacts/major-organs-v1 \
  --compounds acetaminophen,gentamicin,cyclophosphamide \
  --targets 'chem__ALP(IU/L),chem__TBIL(mg/dL),chem__AST(IU/L),chem__ALT(IU/L),chem__BUN(mg/dL),chem__CRE(mg/dL),hema__RBC(x10_4/ul),hema__Hb(g/dL),hema__Plat(x10_4/uL),hema__WBC(x10_2/uL),organ__LIVER(g),organ__KIDNEY_TOTAL(g)'
```

## Required next validation

Before connecting predictions to the student Sandbox, add molecular descriptors, benchmark unseen-compound generalisation, and perform external validation against DrugMatrix. The Sandbox must display intervals and refuse conditions outside the supported domain.

## Multi-organ pathology audit

`prepare_drugmatrix_pathology.py` converts the official NTP DrugMatrix
histopathology workbook into one maximum severity grade per animal and organ.
`train_organ_pathology.py` benchmarks CatBoost and Extra Trees with complete
compound/organ/dose/day conditions held out.

```bash
python ml/prepare_drugmatrix_pathology.py
python ml/train_organ_pathology.py
```

Current release decision:

- Liver and kidney: released only for the bounded, measured-data teaching models.
- Bone marrow: released as a blood-count proxy, not direct marrow histology.
- Heart and gut: trained as research models, but held-out performance does not
  yet pass the student-facing release gate.
- Brain: no direct outcome in the current Open TG-GATEs or DrugMatrix exports;
  anatomy only until a validated neurobehavior dataset is added.

The website must never display research/anatomy-only grades as validated organ
predictions.
