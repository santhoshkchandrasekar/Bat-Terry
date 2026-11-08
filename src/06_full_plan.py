"""Stage 6: the full 2025 plan under uncertainty, its baselines, and its sensitivity.

For every department:
  - do-nothing baseline (January crews all year)
  - plans in three modes (passive / neutral / aggressive), optimized for expected cost over the
    demand nodes 0.86 / 1.00 / 1.14 (see src/optimize.py)
  - every plan evaluated on demand x0.80, x0.86, x1.00, x1.14, x1.20 and on the two shocks
  - perfect foresight per multiplier (optimizer told the true level in advance) -> regret
  - mid-year re-plan: at 1 July, re-optimize Aug-Dec knowing the scenario's true level ->
    how much of the regret monitoring recovers
  - break point: smallest uniform demand increase that drops the neutral plan below 90% on time

Shock anchors:
  snowstorm: PWDx February x1.55. The 29 Jan 2022 blizzard brought ~9,800 Public Works requests in
             the following two weeks vs ~4,200 normal: ~5,600 extra, about 55% of a February.
  heat wave: PARK and ISD July x1.20. The largest single-month spike either department showed in
             2022-2024 vs its three-year same-month average was about 1.3, in winter months; 1.20 in July is
             an analogue, not an observed heat wave.

Usage: python3 -I src/06_full_plan.py   (from repo root; ~20-30 minutes on 2 cores)
"""
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from optimize import MODES, expected, forecast_2025, optimize  # noqa: E402
from sim import DEPTS, Plan, build_arrivals, flat_plan, simulate  # noqa: E402

P = Path("data/processed")
MULTS = (0.80, 0.86, 1.00, 1.14, 1.20)
SHOCKS = {"snowstorm": {"PWDx": {1: 1.55}}, "heatwave": {"PARK": {6: 1.20}, "ISD": {6: 1.20}}}


def row(res, **extra):
    t = res.totals
    return {**extra, **{k: float(t[k]) for k in ("ontime_rate", "overdue", "cliff", "backlog_end", "proj_late",
                                                  "proj_cliff", "crew_cost", "overdue_cost", "backlog_cost")},
            "total_cost": float(t["crew_cost"] + t["overdue_cost"] + t["backlog_cost"])}


def run_dept(dept: str):
    t0 = time.time()
    req = pd.read_parquet(P / "requests_4dept.parquet")
    md = pd.read_csv(P / "monthly_demand.csv")
    fc = forecast_2025(md, dept)
    arr = {m: build_arrivals(req, dept, monthly_target=fc * m, seed=1) for m in MULTS}
    shock_arr = {k: build_arrivals(req, dept, monthly_target=fc, shock=v[dept], seed=1)
                 for k, v in SHOCKS.items() if dept in v}

    plans, exp_rows, eval_rows, monthly = {}, [], [], []
    plans["do_nothing"] = flat_plan(dept)
    for mode in MODES:
        p, obj, rs, ev = optimize(req, dept, fc, mode)
        plans[mode] = p
        exp_rows.append({"dept": dept, "plan": mode, "evals": ev.evals, **expected(rs)})
        m = simulate(arr[1.00], p).monthly.copy(); m["dept"] = dept; m["plan"] = mode
        monthly.append(m)
    from optimize import Evaluator  # expected cost of do-nothing over the same nodes
    ev0 = Evaluator(req, dept, fc, "passive")
    exp_rows.append({"dept": dept, "plan": "do_nothing", "evals": 0, **expected(ev0.results(plans["do_nothing"]))})
    m = simulate(arr[1.00], plans["do_nothing"]).monthly.copy(); m["dept"] = dept; m["plan"] = "do_nothing"
    monthly.append(m)

    for name, p in plans.items():
        for mult, a in arr.items():
            eval_rows.append(row(simulate(a, p), dept=dept, plan=name, scenario=f"x{mult:.2f}"))
        for k, a in shock_arr.items():
            eval_rows.append(row(simulate(a, p), dept=dept, plan=name, scenario=k))

    # perfect foresight and mid-year re-plan, for the neutral plan
    regret = []
    for mult in MULTS:
        pf, *_ = optimize(req, dept, fc * mult, "neutral", nodes=(1.0,), weights=(1.0,))
        rp, *_ = optimize(req, dept, fc * mult, "neutral", nodes=(1.0,), weights=(1.0,),
                          fixed_plan=plans["neutral"], fixed_months=7)
        ours = simulate(arr[mult], plans["neutral"])
        pf_r = simulate(arr[mult], pf)
        rp_r = simulate(arr[mult], rp)
        c = lambda r: r.totals["crew_cost"] + r.totals["overdue_cost"] + r.totals["backlog_cost"]  # noqa: E731
        regret.append({"dept": dept, "scenario": f"x{mult:.2f}", "neutral_cost": c(ours), "neutral_ontime": ours.totals["ontime_rate"],
                       "pf_cost": c(pf_r), "pf_ontime": pf_r.totals["ontime_rate"],
                       "replan_cost": c(rp_r), "replan_ontime": rp_r.totals["ontime_rate"],
                       "regret": c(ours) - c(pf_r), "regret_after_replan": c(rp_r) - c(pf_r),
                       "replan_crews": rp.crews.tolist()})

    bp = None
    for pct in range(0, 61, 2):
        a = build_arrivals(req, dept, monthly_target=fc * (1 + pct / 100), seed=1)
        if simulate(a, plans["neutral"]).totals["ontime_rate"] < 0.90:
            bp = pct
            break
    plan_json = {k: {"crews": v.crews.tolist(), "seasonal": v.seasonal.tolist()} for k, v in plans.items()}
    print(f"{dept} done in {time.time() - t0:.0f}s", flush=True)
    return dept, exp_rows, eval_rows, regret, pd.concat(monthly), plan_json, bp


if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=2) as ex:
        results = list(ex.map(run_dept, ["PWDx", "BTDT", "PARK", "ISD"]))
    exp_rows, eval_rows, regret, monthly, plans, bps = [], [], [], [], {}, {}
    for dept, e, ev, rg, m, pj, bp in results:
        exp_rows += e; eval_rows += ev; regret += rg; monthly.append(m); plans[dept] = pj; bps[dept] = bp
    E = pd.DataFrame(exp_rows); V = pd.DataFrame(eval_rows); R = pd.DataFrame(regret)
    E.to_csv(P / "plan_expected.csv", index=False)
    V.to_csv(P / "plan_scenarios.csv", index=False)
    R.to_csv(P / "plan_regret.csv", index=False)
    pd.concat(monthly).to_csv(P / "plan_monthly.csv", index=False)
    json.dump({"plans": plans, "break_points": bps, "mults": MULTS, "shocks": SHOCKS,
               "sigma": 0.08, "nodes": [0.8614, 1.0, 1.1386], "weights": [1 / 6, 2 / 3, 1 / 6]},
              open(P / "plan_summary.json", "w"), indent=1)

    pd.set_option("display.width", 220)
    print("\n== Expected over demand nodes (0.86/1.00/1.14, weights 1/6, 2/3, 1/6) ==")
    print(E[["dept", "plan", "ontime_rate", "worst_ontime", "backlog_end", "proj_late", "crew_cost", "overdue_cost",
             "backlog_cost", "total_cost"]].round(3).to_string(index=False))
    tot = E.groupby("plan").total_cost.sum()
    print("\nCity total expected cost by plan ($M):", (tot / 1e6).round(2).to_dict())
    print("Bill of each mode vs passive ($k):", ((tot - tot["passive"]) / 1e3).round(0).to_dict())
    print("\n== On-time by scenario ==")
    print(V.pivot_table(index=["dept", "plan"], columns="scenario", values="ontime_rate").round(3).to_string())
    print("\n== Neutral plan: perfect-foresight regret and what a 1 July re-plan recovers ($k) ==")
    print((R.set_index(["dept", "scenario"])[["neutral_ontime", "replan_ontime", "pf_ontime", "regret", "regret_after_replan"]]
           .assign(regret=lambda d: d.regret / 1e3, regret_after_replan=lambda d: d.regret_after_replan / 1e3)).round(2).to_string())
    print("\nBreak points (+% demand before neutral plan drops below 90% on time):", bps)
    for d in plans:
        print(d, "neutral crews:", plans[d]["neutral"]["crews"], "seasonal:", plans[d]["neutral"]["seasonal"])
