"""Precompute Terry runs for one goal per department (flip -> echolocation -> hunt), for the app and video.

Usage: python3 -m terry.showcase   (needs plan_summary.json from src/06_full_plan.py)
"""
from __future__ import annotations

import json

from . import data
from .echo import echolocate
from .flip import flip
from .hunt import hunt

GOALS = {
    "PWDx": "I close every Public Works request in Boston on time in 2025.",
    "BTDT": "I close every Transportation request in Boston on time in 2025.",
    "PARK": "I keep up with every Parks request in 2025 without falling behind.",
    "ISD": "I close every Inspectional Services request on time in 2025.",
}


def run_one(dept: str, goal: str) -> dict:
    f = flip(goal)
    hyps = [h for h in f.predators if h.department == dept]
    preds = echolocate(hyps)
    conf = sorted([p for p in preds if p.evidence.verdict == "CONFIRMED" and p.hypothesis.kind != "silence"],
                  key=lambda p: -p.evidence.cost_2024_usd)
    hunt_out = None
    if conf:
        fix, trace = hunt(conf[0], mode="neutral")
        hunt_out = {"predator": conf[0].hypothesis.name, "fix": fix, "trace": trace}
    v = [p.evidence.verdict for p in preds]
    print(f"{dept}: {len(preds)} predators ({v.count('CONFIRMED')} confirmed, {v.count('REJECTED')} rejected, "
          f"{v.count('UNTESTABLE')} untestable); hunt: {'yes' if hunt_out else 'no'}")
    return {"dept": dept, "goal": goal, "inverted": f.inverted, "predators": [p.model_dump() for p in preds], "hunt": hunt_out}


if __name__ == "__main__":
    runs = [run_one(d, g) for d, g in GOALS.items()]
    (data.P / "showcase_runs.json").write_text(json.dumps(runs, indent=1, default=str))
    print("saved showcase_runs.json")
