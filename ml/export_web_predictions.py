"""Export the bounded major-organ prediction grid for the browser client."""
from __future__ import annotations

import argparse
import json
from argparse import Namespace
from pathlib import Path

from predict_clinpath import predict

MODELS = {
    "hepatotoxin": {"compound": "acetaminophen", "doses": [300, 600, 1000], "days": [3, 7, 14, 28]},
    "nephrotoxin": {"compound": "gentamicin", "doses": [10, 30, 100], "days": [3, 7, 14, 28]},
    "myelotoxin": {"compound": "cyclophosphamide", "doses": [2, 5, 15], "days": [3, 7, 14, 28]},
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", type=Path, default=Path("ml/artifacts/major-organs-v1"))
    parser.add_argument("--data", type=Path, default=Path("ml/data/tggates_repeated.csv"))
    parser.add_argument("--output", type=Path, default=Path("apps/web/src/data/organPredictions.json"))
    args = parser.parse_args()

    card = json.loads((args.artifact / "model-card.json").read_text())
    grid: dict = {
        "model": card["model"],
        "source": card["training_source"],
        "medianHeldOutR2": card["benchmark"][card["model"]]["median_r2"],
        "models": {},
    }
    for key, spec in MODELS.items():
        conditions = {}
        for dose in spec["doses"]:
            for days in spec["days"]:
                result = predict(Namespace(
                    artifact=args.artifact, data=args.data, compound=spec["compound"],
                    dose=dose, days=days, all=True,
                ))
                conditions[f"{dose}:{days}"] = result["estimates"]
        grid["models"][key] = {**spec, "conditions": conditions}

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(grid, separators=(",", ":")) + "\n")
    print(f"wrote {args.output} with {sum(len(v['conditions']) for v in grid['models'].values())} conditions")


if __name__ == "__main__":
    main()
