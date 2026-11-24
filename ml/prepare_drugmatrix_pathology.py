"""Prepare animal-level DrugMatrix histopathology severity for organ modeling."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

TISSUE_MAP = {
    "Liver": "liver",
    "Kidney": "kidney",
    "Heart": "heart",
    "Intestine": "gut",
}


def build(source: Path) -> tuple[pd.DataFrame, dict]:
    raw = pd.read_excel(source, sheet_name="DrugMatrix_Histopathology")
    raw = raw[raw["TISSUE"].isin(TISSUE_MAP)].copy()
    raw["organ"] = raw["TISSUE"].map(TISSUE_MAP)
    raw["severity"] = pd.to_numeric(raw["SEVERITY"], errors="coerce").fillna(0).clip(0, 5)
    raw["compound"] = raw["TEST_ARTICLE"].fillna("Vehicle control").astype(str)
    raw["dose_mg_kg"] = pd.to_numeric(raw["DOSE"], errors="coerce").fillna(0)
    raw["duration_days"] = pd.to_numeric(raw["DURATION"], errors="coerce")

    keys = [
        "ANIMAL_ID", "compound", "dose_mg_kg", "duration_days", "ROUTE",
        "SEX", "SPECIES", "STRAIN", "STUDY_ID", "TREATMENT", "organ",
    ]
    animals = (
        raw.groupby(keys, dropna=False, as_index=False)
        .agg(
            severity=("severity", "max"),
            finding_count=("severity", lambda values: int((values > 0).sum())),
        )
    )
    animals["has_lesion"] = (animals["severity"] > 0).astype(int)
    animals["condition_id"] = (
        animals["compound"].astype(str) + "|" + animals["organ"] + "|" +
        animals["ROUTE"].astype(str) + "|" + animals["dose_mg_kg"].astype(str) + "|" +
        animals["duration_days"].astype(str)
    )
    metadata = {
        "source": "NTP DrugMatrix Histopathology",
        "source_url": "https://cebs.niehs.nih.gov/cebs/paper/15670",
        "scope": "short-term male rat histopathology",
        "rows": int(len(animals)),
        "animals": int(animals["ANIMAL_ID"].nunique()),
        "compounds": int(animals["compound"].nunique() - ("Vehicle control" in set(animals["compound"]))),
        "organs": animals["organ"].value_counts().to_dict(),
        "notice": "Research/education model. Sparse organ coverage and shared vehicle controls limit generalisation.",
    }
    return animals, metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("ml/data/raw/DrugMatrix_Histopathology.xlsx"))
    parser.add_argument("--output", type=Path, default=Path("ml/data/drugmatrix_pathology.csv"))
    args = parser.parse_args()
    frame, metadata = build(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.output, index=False)
    args.output.with_suffix(".metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
