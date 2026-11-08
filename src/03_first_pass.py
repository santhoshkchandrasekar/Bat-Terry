"""Stage 3: forecast 2025, run do-nothing baseline and three-mode optimizer for all departments.

Usage (from repo root): python3 -I src/03_first_pass.py
"""
import sys, time
sys.path.insert(0, "src")
import pandas as pd, numpy as np
from sim import build_arrivals, simulate, flat_plan, DEPTS
from optimize import forecast_2025, optimize
req = pd.read_parquet("data/processed/requests_4dept.parquet")
md = pd.read_csv("data/processed/monthly_demand.csv")
pd.set_option("display.width", 220)
rows = []
plans = {}
for d in DEPTS:
    fc = forecast_2025(md, d)
    arr = build_arrivals(req, d, monthly_target=fc, seed=1)
    base = simulate(arr, flat_plan(d))
    rows.append({**base.totals, "mode": "do-nothing"})
    for mode in ("passive", "neutral", "aggressive"):
        t0 = time.time()
        r = optimize(arr, d, mode)
        r.totals["secs"] = round(time.time() - t0, 1)
        rows.append(r.totals)
        plans[(d, mode)] = r.monthly
out = pd.DataFrame(rows)
cols = ["dept","mode","ontime_rate","overdue","cliff","backlog_end","crew_cost","overdue_cost","backlog_cost","total_cost","evals","secs"]
print(out[cols].round(3).to_string(index=False))
for d in DEPTS:
    print(f"\n{d} crews by month:")
    print(pd.DataFrame({m: plans[(d,m)].crews.values + plans[(d,m)].seasonal.values for m in ("passive","neutral","aggressive")}, index=plans[(d,"passive")].month).T.to_string())
out.to_csv("data/processed/first_pass_results.csv", index=False)
