"""Run a bounded Open TG-GATEs clinical-pathology prediction.

This interface deliberately accepts only compound/dose/duration conditions
present in the training corpus. It is a development adapter, not a regulatory
or clinical prediction service.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from catboost import CatBoostRegressor

from train_clinpath import CATEGORICAL, NUMERIC, cat_frame

DEFAULT_ENDPOINTS = [
    "chem__ALT(IU/L)",
    "chem__AST(IU/L)",
    "chem__BUN(mg/dL)",
    "chem__CRE(mg/dL)",
    "hema__RBC(x10_4/ul)",
    "hema__WBC(x10_2/uL)",
    "organ__TERMINAL_BW(g)",
    "organ__LIVER(g)",
    "organ__KIDNEY_TOTAL(g)",
]


def one_value(rows: pd.DataFrame, column: str):
    values = rows[column].dropna()
    if values.empty:
        raise ValueError(f"No observed value for {column}")
    return values.mode().iloc[0]


def predict(args: argparse.Namespace) -> dict:
    card = json.loads((args.artifact / "model-card.json").read_text())
    data = pd.read_csv(args.data, low_memory=False)
    compound_rows = data[data["COMPOUND_NAME"].str.casefold() == args.compound.casefold()]
    if compound_rows.empty:
        suggestions = sorted(card["supported_compounds"])[:12]
        raise ValueError(
            f"Unsupported compound {args.compound!r}. This model does not extrapolate to unseen compounds. "
            f"Examples of supported compounds: {', '.join(suggestions)}"
        )

    condition = compound_rows[
        np.isclose(compound_rows["dose_mg_kg"], args.dose)
        & np.isclose(compound_rows["duration_days"], args.days)
    ]
    if condition.empty:
        supported = (
            compound_rows[["dose_mg_kg", "duration_days"]]
            .drop_duplicates()
            .sort_values(["duration_days", "dose_mg_kg"])
        )
        pairs = ", ".join(
            f"{row.dose_mg_kg:g} mg/kg for {row.duration_days:g} d"
            for row in supported.itertuples(index=False)
        )
        raise ValueError(f"Unsupported condition. Observed {args.compound} conditions: {pairs}")

    row = {
        "COMPOUND_NAME": one_value(condition, "COMPOUND_NAME"),
        "DOSE_LEVEL": one_value(condition, "DOSE_LEVEL"),
        "SACRIFICE_PERIOD": one_value(condition, "SACRIFICE_PERIOD"),
        "SEX_TYPE": one_value(condition, "SEX_TYPE"),
        "STRAIN_TYPE": one_value(condition, "STRAIN_TYPE"),
        "ADMINISTRATION_ROUTE_TYPE": one_value(condition, "ADMINISTRATION_ROUTE_TYPE"),
        "dose_mg_kg": float(args.dose),
        "duration_days": float(args.days),
        "ANIMAL_AGE(week)": float(one_value(condition, "ANIMAL_AGE(week)")),
    }
    frame = cat_frame(pd.DataFrame([row], columns=CATEGORICAL + NUMERIC))
    if card["model"] == "catboost":
        model = CatBoostRegressor()
        model.load_model(str(args.artifact / "clinical_pathology.cbm"))
        standardized = np.asarray(model.predict(frame))[0]
    elif card["model"] == "extra_trees":
        model = joblib.load(args.artifact / "clinical_pathology.joblib")
        standardized = np.asarray(model.predict(frame))[0]
    else:
        raise ValueError(f"Unsupported model artifact {card['model']!r}")
    mean = np.asarray(card["target_mean"])
    scale = np.asarray(card["target_scale"])
    point = standardized * scale + mean
    q90 = np.asarray(card["conformal_absolute_error_q90"])

    requested = card["targets"] if args.all else DEFAULT_ENDPOINTS
    indices = {name: i for i, name in enumerate(card["targets"])}
    estimates = {}
    for name in requested:
        if name not in indices:
            continue
        i = indices[name]
        estimates[name] = {
            "estimate": float(point[i]),
            "interval90": [float(max(0.0, point[i] - q90[i])), float(point[i] + q90[i])],
        }

    return {
        "status": "in-domain estimate",
        "condition": row,
        "estimates": estimates,
        "warning": card["limitations"][0],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compound", required=True)
    parser.add_argument("--dose", type=float, required=True, help="mg/kg/day")
    parser.add_argument("--days", type=float, required=True)
    parser.add_argument("--all", action="store_true", help="return all 43 endpoints")
    parser.add_argument("--data", type=Path, default=Path("ml/data/tggates_repeated.csv"))
    parser.add_argument("--artifact", type=Path, default=Path("ml/artifacts/clinpath-v1"))
    args = parser.parse_args()
    try:
        print(json.dumps(predict(args), indent=2))
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
