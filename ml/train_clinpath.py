"""Train and benchmark clinical-pathology predictors on Open TG-GATEs.

The primary test holds out entire compound/dose/time conditions. A second test
holds out compounds and is reported as an out-of-domain diagnostic. Prediction
interval widths are calibrated from held-out conditions using split conformal
absolute residuals.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

CATEGORICAL = [
    "COMPOUND_NAME", "DOSE_LEVEL", "SACRIFICE_PERIOD", "SEX_TYPE",
    "STRAIN_TYPE", "ADMINISTRATION_ROUTE_TYPE",
]
NUMERIC = ["dose_mg_kg", "duration_days", "ANIMAL_AGE(week)"]


def split_groups(frame: pd.DataFrame, groups: pd.Series, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    outer = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=seed)
    train_cal, test = next(outer.split(frame, groups=groups))
    inner_groups = groups.iloc[train_cal]
    inner = GroupShuffleSplit(n_splits=1, test_size=0.1765, random_state=seed + 1)  # 15% total
    train_rel, cal_rel = next(inner.split(frame.iloc[train_cal], groups=inner_groups))
    return train_cal[train_rel], train_cal[cal_rel], test


def metrics(y_true: np.ndarray, y_pred: np.ndarray, scale: np.ndarray) -> dict:
    standardized_mae = np.mean(np.abs(y_true - y_pred) / scale, axis=0)
    endpoint_r2 = np.array([r2_score(y_true[:, i], y_pred[:, i]) for i in range(y_true.shape[1])])
    return {
        "median_standardized_mae": float(np.median(standardized_mae)),
        "mean_standardized_mae": float(np.mean(standardized_mae)),
        "median_r2": float(np.median(endpoint_r2)),
        "endpoints_positive_r2": int(np.sum(endpoint_r2 > 0)),
        "endpoint_count": int(len(endpoint_r2)),
    }


def cat_frame(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame[CATEGORICAL + NUMERIC].copy()
    for col in CATEGORICAL:
        out[col] = out[col].fillna("unknown").astype(str)
    for col in NUMERIC:
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)
    return out


def train(args: argparse.Namespace) -> dict:
    data = pd.read_csv(args.data, low_memory=False)
    metadata = json.loads(args.data.with_suffix(".metadata.json").read_text())
    if args.compounds:
        requested = {name.strip().casefold() for name in args.compounds.split(",") if name.strip()}
        data = data[data["COMPOUND_NAME"].str.casefold().isin(requested)].reset_index(drop=True)
        missing = requested - set(data["COMPOUND_NAME"].str.casefold().unique())
        if missing:
            raise ValueError(f"Compounds absent from the dataset: {sorted(missing)}")
    targets = metadata["targets"]
    if args.targets:
        requested_targets = [name.strip() for name in args.targets.split(",") if name.strip()]
        missing_targets = set(requested_targets) - set(targets)
        if missing_targets:
            raise ValueError(f"Targets absent from the dataset: {sorted(missing_targets)}")
        targets = requested_targets
    data = data.dropna(subset=targets).reset_index(drop=True)
    train_idx, cal_idx, test_idx = split_groups(data, data["condition_id"], args.seed)

    y = data[targets].to_numpy(float)
    y_mean = y[train_idx].mean(axis=0)
    y_scale = y[train_idx].std(axis=0)
    y_scale[y_scale < 1e-8] = 1.0
    yz = (y - y_mean) / y_scale

    cat = CatBoostRegressor(
        loss_function="MultiRMSE", iterations=args.iterations, depth=8,
        learning_rate=0.055, l2_leaf_reg=5, random_seed=args.seed,
        random_strength=0.35, verbose=False, thread_count=-1,
    )
    Xcat = cat_frame(data)
    cat.fit(Xcat.iloc[train_idx], yz[train_idx], cat_features=CATEGORICAL)
    cat_pred = cat.predict(Xcat.iloc[test_idx]) * y_scale + y_mean

    pre = ColumnTransformer([
        ("categorical", OneHotEncoder(handle_unknown="ignore", min_frequency=2), CATEGORICAL),
        ("numeric", StandardScaler(), NUMERIC),
    ])
    extra = Pipeline([
        ("preprocess", pre),
        ("model", ExtraTreesRegressor(
            n_estimators=260, min_samples_leaf=2, max_features=0.75,
            random_state=args.seed, n_jobs=-1,
        )),
    ])
    extra.fit(data.iloc[train_idx], yz[train_idx])
    extra_pred = extra.predict(data.iloc[test_idx]) * y_scale + y_mean

    results = {
        "catboost": metrics(y[test_idx], cat_pred, y_scale),
        "extra_trees": metrics(y[test_idx], extra_pred, y_scale),
    }
    selected_name = min(results, key=lambda key: results[key]["mean_standardized_mae"])
    selected = cat if selected_name == "catboost" else extra
    selected_input = Xcat if selected_name == "catboost" else data
    cal_pred = selected.predict(selected_input.iloc[cal_idx]) * y_scale + y_mean
    q90 = np.quantile(np.abs(y[cal_idx] - cal_pred), 0.90, axis=0, method="higher")

    # Honest out-of-domain diagnostic: evaluate compounds absent from fitting.
    compound_train, _, compound_test = split_groups(data, data["COMPOUND_NAME"], args.seed + 20)
    ood = CatBoostRegressor(
        loss_function="MultiRMSE", iterations=args.ood_iterations, depth=8,
        learning_rate=0.06, l2_leaf_reg=5, random_seed=args.seed + 20,
        verbose=False, thread_count=-1,
    )
    ood_mean = y[compound_train].mean(axis=0)
    ood_scale = y[compound_train].std(axis=0)
    ood_scale[ood_scale < 1e-8] = 1.0
    ood.fit(Xcat.iloc[compound_train], (y[compound_train] - ood_mean) / ood_scale, cat_features=CATEGORICAL)
    ood_pred = ood.predict(Xcat.iloc[compound_test]) * ood_scale + ood_mean
    results["held_out_compounds_diagnostic"] = metrics(y[compound_test], ood_pred, ood_scale)

    args.output.mkdir(parents=True, exist_ok=True)
    if selected_name == "catboost":
        cat.save_model(str(args.output / "clinical_pathology.cbm"))
    else:
        joblib.dump(extra, args.output / "clinical_pathology.joblib")
    model_card = {
        "model": selected_name,
        "training_source": metadata["source"],
        "scope": "Open TG-GATEs rat repeated-dose clinical pathology; supported compounds and study conditions only",
        "features": CATEGORICAL + NUMERIC,
        "targets": targets,
        "target_mean": y_mean.tolist(),
        "target_scale": y_scale.tolist(),
        "conformal_absolute_error_q90": q90.tolist(),
        "splitting": "grouped by compound + dose level + duration; entire conditions held out",
        "rows": int(len(data)),
        "train_rows": int(len(train_idx)),
        "calibration_rows": int(len(cal_idx)),
        "test_rows": int(len(test_idx)),
        "supported_compounds": sorted(data["COMPOUND_NAME"].unique().tolist()),
        "benchmark": results,
        "limitations": [
            "Not validated for regulatory, clinical, or safety decisions.",
            "No molecular structure features are included in this first model; unseen-compound predictions are out of domain.",
            "Intervals quantify empirical residual error on held-out TG-GATEs conditions, not all biological uncertainty.",
            "Predictions must remain bounded to the observed study design and labelled as estimates.",
        ],
    }
    (args.output / "model-card.json").write_text(json.dumps(model_card, indent=2) + "\n")
    print(json.dumps(model_card, indent=2))
    return model_card


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("ml/data/tggates_repeated.csv"))
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts/clinpath-v1"))
    parser.add_argument("--iterations", type=int, default=900)
    parser.add_argument("--ood-iterations", type=int, default=300)
    parser.add_argument("--compounds", help="comma-separated compound names to retain")
    parser.add_argument("--targets", help="comma-separated endpoint columns to retain")
    parser.add_argument("--seed", type=int, default=20261123)
    train(parser.parse_args())


if __name__ == "__main__":
    main()

