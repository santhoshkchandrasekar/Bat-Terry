"""End to end: goal -> flip -> echolocation -> hunt -> decision calendar.

Usage: python3 -m terry.run "I close every Transportation request on time in 2025" [mode]
"""
from __future__ import annotations

import json
import sys
import time

from . import calendar as cal
from .echo import echolocate
from .flip import flip
from .hunt import hunt


def run(goal: str, mode: str = "neutral", max_hunts: int = 3) -> dict:
    t0 = time.time()
    f = flip(goal)
    print(f"\nGOAL: {f.goal}\nFLIP: {f.inverted}\n")
    hyps = f.predators
    if f.target_department:
        off = [h for h in hyps if h.department != f.target_department]
        hyps = [h for h in hyps if h.department == f.target_department]
        if off:
            print(f"(dropped {len(off)} predators outside {f.target_department}: {', '.join(h.name for h in off)})\n")
    preds = echolocate(hyps)
    for p in preds:
        h, e = p.hypothesis, p.evidence
        print(f"[{e.verdict:10}] {h.name}  ({h.department} / {h.request_type} / {h.neighborhood} / months {h.months})")
        print(f"             {e.detail}")
    confirmed = [p for p in preds if p.evidence.verdict == "CONFIRMED"]
    confirmed.sort(key=lambda p: -p.evidence.cost_2024_usd)
    # Silence predators are fixed by outreach and inspection, not crews: report them, don't hunt them.
    for p in confirmed:
        if p.hypothesis.kind == "silence":
            p.fix = {"lever": "outreach", "rationale": "Residents under-report here; staffing to reported demand "
                     "underserves it. Recommend proactive inspection or outreach rather than crews."}
    confirmed = [p for p in confirmed if p.hypothesis.kind != "silence"]
    print(f"\n{len(confirmed)} confirmed, {sum(p.evidence.verdict == 'REJECTED' for p in preds)} rejected, "
          f"{sum(p.evidence.verdict == 'UNTESTABLE' for p in preds)} untestable\n")

    hunted = {}
    for p in confirmed[:max_hunts]:
        dept = p.hypothesis.department
        if dept in hunted:  # one plan per department; later predators attach to it
            hunted[dept]["kills"].append(p.hypothesis.name)
            p.fix = hunted[dept]["fix"]
            continue
        fix, trace = hunt(p, mode)
        p.fix = fix
        hunted[dept] = {"fix": fix, "trace": trace, "kills": [p.hypothesis.name]}
        print(f"HUNT {p.hypothesis.name} ({dept}, {mode}): {len(trace)} tool calls")
        print(f"  baseline ${fix.get('baseline_total_cost', 0):,.0f} @ {fix.get('baseline_ontime')} -> "
              f"plan ${fix.get('plan_total_cost', 0):,.0f} @ {fix.get('plan_ontime')}, breaks at +{fix.get('break_pct')}%")
        print(f"  {fix.get('rationale')}")

    all_decisions = []
    for dept, h in hunted.items():
        fx = h["fix"]
        if "recommended_crews_by_month" in fx:
            all_decisions += cal.decisions(dept, fx["recommended_crews_by_month"], fx.get("seasonal_by_month"), h["kills"])
    print("\nDECISION CALENDAR")
    print(cal.as_table(sorted(all_decisions, key=lambda d: d.decide_by)))
    print(f"\n({time.time() - t0:.0f}s)")
    return {"flip": f.model_dump(), "predators": [p.model_dump() for p in preds],
            "hunts": {d: {"fix": h["fix"], "trace": h["trace"], "kills": h["kills"]} for d, h in hunted.items()},
            "decisions": [d.model_dump() for d in all_decisions]}


if __name__ == "__main__":
    goal = sys.argv[1] if len(sys.argv) > 1 else "I close every Transportation request on time in 2025."
    mode = sys.argv[2] if len(sys.argv) > 2 else "neutral"
    out = run(goal, mode)
    with open("data/processed/terry_last_run.json", "w") as fh:
        json.dump(out, fh, indent=1, default=str)
