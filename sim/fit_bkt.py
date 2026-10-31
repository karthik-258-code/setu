#!/usr/bin/env python3
"""Fit an exploratory pyBKT model to the repository's synthetic readiness export."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "sim" / "data" / "readiness-synthetic.csv"
DEFAULT_OUTPUT = ROOT / "sim" / "data" / "bkt-fit.json"
REQUIRED_COLUMNS = {"user_id", "skill_name", "correct", "order_id"}
DEFAULTS = {
    "user_id": "user_id",
    "skill_name": "skill_name",
    "correct": "correct",
    "order_id": "order_id",
}


def load_responses(path: Path) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(
            f"Synthetic responses not found at {path}. Run `pnpm sim:export` first."
        )
    data = pd.read_csv(path)
    missing = REQUIRED_COLUMNS - set(data.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    if data.empty:
        raise ValueError("The synthetic response file contains no rows.")
    if data[list(REQUIRED_COLUMNS)].isna().any().any():
        raise ValueError("Required response fields cannot be blank.")
    if not data["correct"].isin([0, 1]).all():
        raise ValueError("correct values must be 0 or 1.")
    if (data["order_id"] < 0).any():
        raise ValueError("order_id values must be non-negative.")
    duplicate_order = data.duplicated(["user_id", "skill_name", "order_id"])
    if duplicate_order.any():
        raise ValueError("Each user/skill sequence must have unique order_id values.")
    return data.sort_values(["user_id", "skill_name", "order_id"]).reset_index(drop=True)


def parameter_rows(params: pd.DataFrame) -> list[dict[str, Any]]:
    aliases = {
        "pL0": "prior",
        "pT": "learns",
        "pG": "guesses",
        "pS": "slips",
    }
    if not isinstance(params, pd.DataFrame):
        raise TypeError("pyBKT returned parameters in an unexpected format.")
    data = params.reset_index()
    required = {"skill", "param", "class", "value"}
    missing_columns = required - set(data.columns)
    if missing_columns:
        raise ValueError(
            f"pyBKT parameters are missing columns: {', '.join(sorted(missing_columns))}"
        )

    mapped = []
    for skill, rows in data.groupby("skill", sort=True):
        parameters = {}
        for name, parameter in aliases.items():
            matches = rows[(rows["param"] == parameter) & (rows["class"] == "default")]
            if len(matches) != 1:
                raise ValueError(
                    f"Expected one default {parameter} parameter for skill {skill}."
                )
            parameters[name] = float(matches.iloc[0]["value"])
        mapped.append({"conceptId": str(skill), **parameters})
    return mapped


def fit(data: pd.DataFrame, seed: int) -> dict[str, Any]:
    from pyBKT.models import Model

    skills = sorted(data["skill_name"].astype(str).unique())
    model = Model(seed=seed, num_fits=1, parallel=False)
    model.fit(data=data, skills=skills, defaults=DEFAULTS)
    return {
        "source": "synthetic readiness simulation; not classroom evidence",
        "seed": seed,
        "observations": len(data),
        "students": int(data["user_id"].nunique()),
        "skills": parameter_rows(model.params()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--seed", type=int, default=20261029)
    args = parser.parse_args()

    report = fit(load_responses(args.input), args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        f"Fitted {len(report['skills'])} synthetic skill models from "
        f"{report['observations']} responses; wrote {args.output}"
    )


if __name__ == "__main__":
    main()
