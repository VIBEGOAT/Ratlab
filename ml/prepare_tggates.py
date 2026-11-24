"""Build an animal-level Open TG-GATEs repeated-dose training table.

The upstream CSV files are encoded as CP932. Each output row represents one rat.
Only measured values are retained; no RatLab simulation outputs enter the table.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

KEYS = ["EXP_ID", "GROUP_ID", "INDIVIDUAL_ID"]
META = [
    "COMPOUND_NAME", "SINGLE_REPEAT_TYPE", "SEX_TYPE", "STRAIN_TYPE",
    "ADMINISTRATION_ROUTE_TYPE", "ANIMAL_AGE(week)", "SACRIFICE_PERIOD",
    "DOSE", "DOSE_UNIT", "DOSE_LEVEL",
]


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="cp932", dtype={key: str for key in KEYS})


def numeric_columns(frame: pd.DataFrame, exclude: set[str]) -> list[str]:
    cols: list[str] = []
    for col in frame.columns:
        if col in exclude:
            continue
        converted = pd.to_numeric(frame[col], errors="coerce")
        if converted.notna().mean() >= 0.95:
            frame[col] = converted
            cols.append(col)
    return cols


def build(raw: Path) -> tuple[pd.DataFrame, dict]:
    individuals = read_csv(raw / "open_tggates_individual.csv")
    individuals = individuals[individuals["SINGLE_REPEAT_TYPE"] == "Repeat"]
    individuals = individuals[KEYS + META].copy()

    targets: list[str] = []
    merged = individuals
    for name, prefix in [
        ("biochemistry", "chem__"),
        ("hematology", "hema__"),
        ("organ_weight", "organ__"),
    ]:
        table = read_csv(raw / f"open_tggates_{name}.csv")
        if "SINGLE_REPEAT_TYPE" in table.columns:
            table = table[table["SINGLE_REPEAT_TYPE"] == "Repeat"]
        values = numeric_columns(table, set(KEYS + META + ["BARCODE", "SP_FLG"]))
        renamed = {col: f"{prefix}{col}" for col in values}
        targets.extend(renamed.values())
        merged = merged.merge(table[KEYS + values].rename(columns=renamed), on=KEYS, how="inner", validate="one_to_one")

    merged["duration_days"] = (
        merged["SACRIFICE_PERIOD"].str.extract(r"(\d+)")[0].astype(float) - 1
    ).clip(lower=1)
    merged["dose_mg_kg"] = pd.to_numeric(merged["DOSE"], errors="coerce")
    merged = merged[merged["DOSE_UNIT"].eq("mg/kg")].copy()
    merged = merged.dropna(subset=targets + ["dose_mg_kg", "duration_days"])

    # Stable condition identifier for leakage-safe splitting.
    merged["condition_id"] = (
        merged["COMPOUND_NAME"].astype(str) + "|" +
        merged["SACRIFICE_PERIOD"].astype(str) + "|" +
        merged["DOSE_LEVEL"].astype(str)
    )
    metadata = {
        "source": "Open TG-GATEs LSDB Archive",
        "source_url": "https://dbarchive.biosciencedbc.jp/en/open-tggates/download.html",
        "scope": "rat in-vivo repeated-dose studies",
        "rows": int(len(merged)),
        "compounds": int(merged["COMPOUND_NAME"].nunique()),
        "conditions": int(merged["condition_id"].nunique()),
        "targets": targets,
        "target_count": len(targets),
        "notice": "Research/education model. Training data do not establish regulatory validity.",
    }
    return merged, metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, default=Path("ml/data/raw"))
    parser.add_argument("--output", type=Path, default=Path("ml/data/tggates_repeated.csv"))
    args = parser.parse_args()
    frame, metadata = build(args.raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.output, index=False)
    args.output.with_suffix(".metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()

