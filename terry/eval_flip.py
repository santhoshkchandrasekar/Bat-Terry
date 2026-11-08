"""Evaluate Terry's flip, not just use it.

For a fixed set of goals, run the flip several times and measure:
  confirmed share   how many proposed predators the 2024 data confirms (the rest are rejected or untestable)
  invalid names     request types or neighborhoods that do not exist (0 by construction: the schema only allows real names)
  number check      how often the failure sentence used a figure not in the evidence on the first try, and whether the fix worked
  consistency       how much the predator lists agree across repeats of the same goal (Jaccard overlap of type x neighborhood cells)
  baseline          the confirmed share if we skip the model and just list the costliest 2024 cells for that department

Writes data/processed/eval_flip.csv (one row per predator) and eval_flip_summary.json.
Usage (repo root): python3 -m terry.eval_flip [repeats]
"""
from __future__ import annotations

import itertools
import json
import sys
import time
from pathlib import Path

import pandas as pd

from . import data
from .echo import echolocate
from .flip import flip
from .llm import load_keys
from .schemas import PredatorHypothesis

GOALS = [
    "I close every Public Works request on time in 2025.",
    "Every pothole and sidewalk repair in the South End is fixed on time this summer.",
    "I close every Transportation request on time in 2025.",
    "Parking enforcement in Dorchester keeps up in the fall.",
    "Parks keeps up with every request through the summer.",
    "No Parks request goes late in 2025.",
    "Inspectional Services closes every housing complaint on time in 2025.",
    "Rodent complaints in Dorchester are handled on time all year.",
]
OUT = Path(__file__).resolve().parents[1] / "data" / "processed"


def baseline(dept: str | None, k: int) -> list[PredatorHypothesis]:
    pr = data.predators_raw()
    if dept:
        pr = pr[pr.department == dept]
    top = pr.groupby(["department", "type", "neighborhood"]).cost.sum().sort_values(ascending=False).head(k).reset_index()
    return [PredatorHypothesis(name=f"{r.type} in {r.neighborhood}", department=r.department, request_type=r.type,
                               neighborhood=r.neighborhood, months=[], kind="miss", suspected_cause="top 2024 cost") for r in top.itertuples()]


def main(repeats: int = 3) -> None:
    load_keys()
    rows, runs = [], []
    for gi, goal in enumerate(GOALS):
        for rep in range(repeats):
            st, t0 = {}, time.time()
            f = flip(goal, stats=st)
            preds = echolocate(f.predators)
            runs.append({"goal": gi, "rep": rep, "dept": f.target_department, "n": len(preds), "seconds": round(time.time() - t0, 1),
                         "first_pass_bad": len(st.get("first_pass_bad", [])), "fixed": st.get("fixed", False), "stripped": st.get("stripped", False),
                         "cells": sorted({(p.hypothesis.request_type or "*", p.hypothesis.neighborhood or "*") for p in preds})})
            for p in preds:
                rows.append({"goal": gi, "rep": rep, "dept": f.target_department, "kind": p.hypothesis.kind, "type": p.hypothesis.request_type,
                             "neighborhood": p.hypothesis.neighborhood, "verdict": p.evidence.verdict})
            print(f"goal {gi} rep {rep}: {len(preds)} predators, verdicts {[p.evidence.verdict[0] for p in preds]}, number check first pass bad={len(st.get('first_pass_bad', []))}")
    df = pd.DataFrame(rows)
    df.to_csv(OUT / "eval_flip.csv", index=False)
    # consistency: mean Jaccard overlap of cells between repeats of the same goal
    jac = []
    for gi in range(len(GOALS)):
        cs = [set(map(tuple, r["cells"])) for r in runs if r["goal"] == gi]
        for a, b in itertools.combinations(cs, 2):
            jac.append(len(a & b) / max(len(a | b), 1))
    # baseline: costliest cells, same count as Terry proposed on average, tested the same way
    base = []
    for gi in range(len(GOALS)):
        dept = next(r["dept"] for r in runs if r["goal"] == gi)
        k = round(sum(r["n"] for r in runs if r["goal"] == gi) / repeats)
        base += [p.evidence.verdict for p in echolocate(baseline(dept, k))]
    testable = df[df.verdict != "UNTESTABLE"]
    summary = {
        "flips": len(runs), "predators": len(df), "goals": len(GOALS), "repeats": repeats,
        "confirmed_share_all": round((df.verdict == "CONFIRMED").mean(), 3),
        "confirmed_share_testable": round((testable.verdict == "CONFIRMED").mean(), 3),
        "untestable_share": round((df.verdict == "UNTESTABLE").mean(), 3),
        "invalid_names": 0,
        "number_check_first_pass_fail_rate": round(sum(r["first_pass_bad"] > 0 for r in runs) / len(runs), 3),
        "number_check_fixed_by_retry": sum(r["fixed"] for r in runs), "number_check_stripped": sum(r["stripped"] for r in runs),
        "consistency_jaccard_mean": round(sum(jac) / max(len(jac), 1), 3),
        "baseline_confirmed_share": round(sum(v == "CONFIRMED" for v in base) / max(len(base), 1), 3),
        "mean_seconds_per_flip": round(sum(r["seconds"] for r in runs) / len(runs), 1),
        "by_kind": df.groupby("kind").verdict.apply(lambda s: round((s == "CONFIRMED").mean(), 3)).to_dict(),
    }
    (OUT / "eval_flip_summary.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 3)
