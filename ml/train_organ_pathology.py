"""Benchmark bounded DrugMatrix organ-pathology severity predictors."""
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
from sklearn.metrics import balanced_accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

CATEGORICAL = ["compound", "organ", "ROUTE", "SEX", "STRAIN", "TREATMENT"]
NUMERIC = ["dose_mg_kg", "duration_days"]


def split(frame: pd.DataFrame, groups: pd.Series, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    outer = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed)
    train_cal, test = next(outer.split(frame, groups=groups))
    inner = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed + 1)
    train_rel, cal_rel = next(inner.split(frame.iloc[train_cal], groups=groups.iloc[train_cal]))
    return train_cal[train_rel], train_cal[cal_rel], test


def stratified_condition_split(data: pd.DataFrame, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Keep whole conditions together while placing lesion-positive conditions in every split."""
    conditions = (
        data.groupby("condition_id", as_index=False)
        .agg(organ=("organ", "first"), positive=("has_lesion", "max"))
    )
    rng = np.random.default_rng(seed)
    buckets: dict[str, list[str]] = {"train": [], "cal": [], "test": []}
    for (_, _), group in conditions.groupby(["organ", "positive"]):
        ids = group["condition_id"].to_numpy(copy=True)
        rng.shuffle(ids)
        n_test = max(1, int(round(len(ids) * 0.2))) if len(ids) >= 3 else 0
        n_cal = max(1, int(round(len(ids) * 0.2))) if len(ids) >= 3 else 0
        while n_test + n_cal >= len(ids) and n_cal > 0:
            n_cal -= 1
        buckets["test"].extend(ids[:n_test].tolist())
        buckets["cal"].extend(ids[n_test:n_test + n_cal].tolist())
        buckets["train"].extend(ids[n_test + n_cal:].tolist())
    return tuple(
        data.index[data["condition_id"].isin(buckets[name])].to_numpy()
        for name in ("train", "cal", "test")
    )  # type: ignore[return-value]


def feature_frame(data: pd.DataFrame) -> pd.DataFrame:
    out = data[CATEGORICAL + NUMERIC].copy()
    for col in CATEGORICAL:
        out[col] = out[col].fillna("unknown").astype(str)
    for col in NUMERIC:
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)
    return out


def balanced_weights(data: pd.DataFrame, indices: np.ndarray) -> np.ndarray:
    subset = data.iloc[indices]
    weights = np.ones(len(subset), dtype=float)
    for organ in subset["organ"].unique():
        organ_mask = subset["organ"].eq(organ).to_numpy()
        for lesion in (0, 1):
            mask = organ_mask & subset["has_lesion"].eq(lesion).to_numpy()
            if mask.any():
                weights[mask] = organ_mask.sum() / (2 * mask.sum())
    return weights


def score(y: np.ndarray, pred: np.ndarray, organs: pd.Series) -> dict:
    def one(mask: np.ndarray) -> dict:
        yt, yp = y[mask], np.clip(pred[mask], 0, 5)
        binary_true = yt > 0
        binary_pred = yp >= 0.5
        labels_present = np.unique(binary_true)
        return {
            "rows": int(mask.sum()),
            "mae_grade": float(mean_absolute_error(yt, yp)),
            "r2": float(r2_score(yt, yp)) if len(yt) > 1 else None,
            "within_one_grade": float(np.mean(np.abs(yt - yp) <= 1)),
            "lesion_balanced_accuracy": float(balanced_accuracy_score(binary_true, binary_pred)) if len(labels_present) == 2 else None,
            "lesion_prevalence": float(np.mean(binary_true)),
        }
    result = {"overall": one(np.ones(len(y), dtype=bool)), "by_organ": {}}
    for organ in sorted(organs.unique()):
        result["by_organ"][organ] = one(organs.eq(organ).to_numpy())
    return result


def train(args: argparse.Namespace) -> dict:
    data = pd.read_csv(args.data, low_memory=False)
    metadata = json.loads(args.data.with_suffix(".metadata.json").read_text())
    data = data.dropna(subset=["severity", "condition_id"]).reset_index(drop=True)
    train_idx, cal_idx, test_idx = stratified_condition_split(data, args.seed)
    X = feature_frame(data)
    y = data["severity"].to_numpy(float)
    train_weights = balanced_weights(data, train_idx)

    cat = CatBoostRegressor(
        loss_function="RMSE", iterations=args.iterations, depth=7, learning_rate=0.05,
        l2_leaf_reg=7, random_seed=args.seed, verbose=False, thread_count=-1,
    )
    cat.fit(X.iloc[train_idx], y[train_idx], cat_features=CATEGORICAL, sample_weight=train_weights)
    cat_pred = cat.predict(X.iloc[test_idx])

    extra = Pipeline([
        ("preprocess", ColumnTransformer([
            ("categorical", OneHotEncoder(handle_unknown="ignore", min_frequency=2), CATEGORICAL),
            ("numeric", StandardScaler(), NUMERIC),
        ])),
        ("model", ExtraTreesRegressor(
            n_estimators=400, min_samples_leaf=3, max_features=0.8,
            random_state=args.seed, n_jobs=-1,
        )),
    ])
    extra.fit(X.iloc[train_idx], y[train_idx], model__sample_weight=train_weights)
    extra_pred = extra.predict(X.iloc[test_idx])

    benchmark = {
        "catboost": score(y[test_idx], cat_pred, data.iloc[test_idx]["organ"].reset_index(drop=True)),
        "extra_trees": score(y[test_idx], extra_pred, data.iloc[test_idx]["organ"].reset_index(drop=True)),
    }
    selected_name = min(benchmark, key=lambda name: benchmark[name]["overall"]["mae_grade"])
    selected = cat if selected_name == "catboost" else extra
    cal_pred = selected.predict(X.iloc[cal_idx])
    residual = np.abs(y[cal_idx] - cal_pred)
    q90 = {
        organ: float(np.quantile(residual[data.iloc[cal_idx]["organ"].to_numpy() == organ], 0.9, method="higher"))
        for organ in sorted(data["organ"].unique())
    }

    # Diagnostic only: completely unseen compounds are outside the supported domain.
    compound_train, _, compound_test = split(data, data["compound"], args.seed + 20)
    ood = CatBoostRegressor(
        loss_function="RMSE", iterations=args.ood_iterations, depth=7, learning_rate=0.05,
        l2_leaf_reg=7, random_seed=args.seed + 20, verbose=False, thread_count=-1,
    )
    ood.fit(
        X.iloc[compound_train], y[compound_train], cat_features=CATEGORICAL,
        sample_weight=balanced_weights(data, compound_train),
    )
    ood_pred = ood.predict(X.iloc[compound_test])
    benchmark["held_out_compounds_diagnostic"] = score(
        y[compound_test], ood_pred, data.iloc[compound_test]["organ"].reset_index(drop=True)
    )

    args.output.mkdir(parents=True, exist_ok=True)
    if selected_name == "catboost":
        cat.save_model(str(args.output / "organ_pathology.cbm"))
    else:
        joblib.dump(extra, args.output / "organ_pathology.joblib")
    card = {
        "model": selected_name,
        "training_source": metadata["source"],
        "scope": "DrugMatrix short-term rat liver, kidney, heart, and intestine histopathology",
        "features": CATEGORICAL + NUMERIC,
        "target": "maximum animal-level histopathology severity grade (0-5)",
        "rows": int(len(data)),
        "train_rows": int(len(train_idx)),
        "calibration_rows": int(len(cal_idx)),
        "test_rows": int(len(test_idx)),
        "supported_compounds": sorted(data.loc[data["compound"] != "Vehicle control", "compound"].unique().tolist()),
        "supported_organs": sorted(data["organ"].unique().tolist()),
        "conformal_absolute_error_q90_by_organ": q90,
        "benchmark": benchmark,
        "limitations": [
            "Not validated for regulatory, clinical, or safety decisions.",
            "Brain and bone-marrow histopathology are absent from this DrugMatrix export.",
            "Gut coverage is sparse and must pass an organ-specific release gate before display.",
            "Predictions for unseen compounds or unobserved conditions are out of domain.",
        ],
    }
    (args.output / "model-card.json").write_text(json.dumps(card, indent=2) + "\n")
    print(json.dumps(card, indent=2))
    return card


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("ml/data/drugmatrix_pathology.csv"))
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts/organ-pathology-v1"))
    parser.add_argument("--iterations", type=int, default=500)
    parser.add_argument("--ood-iterations", type=int, default=300)
    parser.add_argument("--seed", type=int, default=20261123)
    train(parser.parse_args())


if __name__ == "__main__":
    main()
