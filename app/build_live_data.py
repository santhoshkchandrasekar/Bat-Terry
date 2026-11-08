"""Build app/live/data.json: everything the live page needs to run Terry in the browser.

  arrivals   per department, 2024 requests replayed into 2025 as (open day, due offset, targeted, count)
  months     2024 monthly counts (to rescale arrivals) and the backtested 2025 forecast
  cells      2024 department x type x neighborhood x month: requests, overdue, past-30-day cliff
  silence    the silence table
  catalog    the intake assistant's request types with resident-language descriptions
  plans      the Python optimizer's saved plans (all modes), used as starting points and as the replay fallback
  showcase   saved Terry runs, shown when the live model is unavailable

Usage (repo root): python3 -I app/build_live_data.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src")); sys.path.insert(0, str(ROOT))
P = ROOT / "data" / "processed"
OUT = ROOT / "app" / "live"; OUT.mkdir(parents=True, exist_ok=True)

from optimize import forecast_2025  # noqa: E402
from sim import DEPTS, build_arrivals  # noqa: E402
from terry.intake import catalog  # noqa: E402

req = pd.read_parquet(P / "requests_4dept.parquet")
md = pd.read_csv(P / "monthly_demand.csv")
fcb = pd.read_csv(P / "forecast_2025.csv")         # the 2025 forecast with its likely range (+/- the 2024 backtest error)

depts = {}
for d, (name, cap, annual, start) in DEPTS.items():
    a = build_arrivals(req, d)                      # unscaled 2024 replay
    df = pd.DataFrame({"o": a.open_day, "u": a.due_day - a.open_day, "t": a.targeted.astype(int)})
    g = df.groupby(["o", "u", "t"]).size().reset_index(name="n")
    m24 = md[(md.department == d) & md.month.str.startswith("2024")].requests.tolist()
    m23 = md[(md.department == d) & md.month.str.startswith("2023")].requests.tolist()
    depts[d] = {"name": name, "cap": cap, "annual": annual, "start": start,
                "arr": [g.o.tolist(), g.u.tolist(), g.t.tolist(), g.n.tolist()],
                "m2023": m23, "m2024": m24, "fc2025": [round(x, 2) for x in forecast_2025(md, d).tolist()],
                "fc_low": fcb[fcb.department == d].sort_values("month").low.tolist(),
                "fc_high": fcb[fcb.department == d].sort_values("month").high.tolist(),
                "fc_mape": float(fcb[fcb.department == d].backtest_mape.iloc[0])}

# Evidence cells (same definitions as terry/echo.py)
y = req[req.file_year == 2024].copy()
y["neighborhood"] = y.neighborhood.fillna("").str.strip()
y["late"] = y.on_time.eq("OVERDUE")
open_late = y.closed_dt.isna() & ((pd.Timestamp("2026-11-01") - y.sla_target_dt).dt.days > 30)
y["cliff"] = y.late & ((y.late_days > 30) | open_late)
y["m"] = y.open_dt.dt.month
c = y.groupby(["department", "type", "neighborhood", "m"]).agg(n=("case_enquiry_id", "size"), late=("late", "sum"),
                                                               cliff=("cliff", "sum")).reset_index()
types = sorted(c.type.unique()); hoods = sorted(c.neighborhood.unique()); dl = list(DEPTS)
ti = {t: i for i, t in enumerate(types)}; ni = {h: i for i, h in enumerate(hoods)}
cells = {"types": types, "hoods": hoods,
         "rows": [[dl.index(r.department), ti[r.type], ni[r.neighborhood], int(r.m), int(r.n), int(r.late), int(r.cliff)]
                  for r in c.itertuples()]}
dept_late = {d: round(float(y[y.department == d].late.mean()), 4) for d in DEPTS}
dept_ontime = {d: round(1 - float(y[y.department == d].late.mean()), 4) for d in DEPTS}
# the 2023 record, department x month (requests, late), same definition: shown beside 2024 on the flip (owner 21:16)
z = req[req.file_year == 2023].copy(); z["late"] = z.on_time.eq("OVERDUE"); z["m"] = z.open_dt.dt.month
g23 = z.groupby(["department", "m"]).agg(n=("case_enquiry_id", "size"), late=("late", "sum")).reset_index()
hist_2023 = {d: [[0, 0] for _ in range(12)] for d in DEPTS}
for r in g23.itertuples():
    if r.department in hist_2023: hist_2023[r.department][int(r.m) - 1] = [int(r.n), int(r.late)]

# 2023 evidence on the same index (owner 21:48): predators are tested on both years with the same rule;
# types or neighborhoods that only appear in 2023 are dropped so the 2024 indices stay put
y3 = req[req.file_year == 2023].copy()
y3["neighborhood"] = y3.neighborhood.fillna("").str.strip()
y3["late"] = y3.on_time.eq("OVERDUE")
open_late3 = y3.closed_dt.isna() & ((pd.Timestamp("2026-11-01") - y3.sla_target_dt).dt.days > 30)
y3["cliff"] = y3.late & ((y3.late_days > 30) | open_late3)
y3["m"] = y3.open_dt.dt.month
c3 = y3.groupby(["department", "type", "neighborhood", "m"]).agg(n=("case_enquiry_id", "size"), late=("late", "sum"),
                                                                 cliff=("cliff", "sum")).reset_index()
c3 = c3[c3.type.isin(ti) & c3.neighborhood.isin(ni) & c3.department.isin(dl)]
cells_2023 = [[dl.index(r.department), ti[r.type], ni[r.neighborhood], int(r.m), int(r.n), int(r.late), int(r.cliff)] for r in c3.itertuples()]
dept_late_2023 = {d: round(float(y3[y3.department == d].late.mean()), 4) for d in DEPTS}
s23 = pd.read_csv(P / "silence_2023.csv")
silence_2023 = s23[["neighborhood", "requests", "silence_ratio", "quietest_type", "quietest_ratio"]].round(3).to_dict(orient="records")

sil = pd.read_csv(P / "silence.csv")
silence = sil[["neighborhood", "requests", "silence_ratio", "quietest_type", "quietest_ratio"]].round(3).to_dict(orient="records")

cat = catalog()
catalog_rows = [{"type": r.type, "dept": r.department, "queue": r.queue, "queue_share": float(r.queue_share),
                 "count": int(r.count), "desc": str(r.description), "examples": str(r.examples)} for r in cat.itertuples()]

S = json.loads((P / "plan_summary.json").read_text())
showcase = json.loads((P / "showcase_runs.json").read_text())
hexes = json.loads((P / "map_hex.json").read_text())
nbh = json.loads((P / "map_neighborhoods.json").read_text())
analogues = json.loads((P / "event_analogues.json").read_text())
bt = pd.read_csv(P / "forecast_backtest.csv")
backtest = bt.round(4).to_dict(orient="records")
mean_mape = bt.groupby("method").mape.mean()           # the same pick as src/04_forecast_backtest.py: lowest mean error on 2024
forecast_method = {"chosen": str(mean_mape.idxmin()), "mean_mape": {k: round(float(v), 4) for k, v in mean_mape.items()},
                   "tested_on": 2024, "trained_on": [2022, 2023], "fit_on": [2023, 2024]}
held = pd.read_csv(ROOT / "data" / "tests" / "intake_heldout.csv")
held = held[held.expected_department.isin(list(DEPTS))]
ev = pd.read_csv(P / "intake_eval_heldout_final.csv").set_index("id")
type_dept = {r["type"]: r["dept"] for r in catalog_rows} if "catalog_rows" in dir() else {}
def saved(i):
    if i not in ev.index:
        return None
    r = ev.loc[i]
    asked = bool(r.asked) if not pd.isna(r.asked) else False
    t = None if pd.isna(r.predicted) else str(r.predicted)
    return {"type": t, "asked": asked}
stream = [{"text": str(r.message), "dept": r.expected_department, "type": str(r.expected_type), "saved": saved(r.id)} for r in held.itertuples()]

type_dept = {r["type"]: r["dept"] for r in catalog_rows}
for m in stream:
    if m["saved"] and m["saved"]["type"]:
        m["saved"]["dept"] = type_dept.get(m["saved"]["type"])
data = {"version": "2026-11-03", "year": 2025, "depts": depts, "cells": cells, "dept_late_2024": dept_late,
        "dept_ontime_2024": dept_ontime, "hist_2023": hist_2023, "cells_2023": cells_2023, "dept_late_2023": dept_late_2023, "silence_2023": silence_2023, "silence": silence, "catalog": catalog_rows, "plans": S["plans"],
        "nodes": [1 - 3 ** 0.5 * 0.08, 1.0, 1 + 3 ** 0.5 * 0.08], "weights": [1 / 6, 2 / 3, 1 / 6],
        "showcase": showcase, "hex": hexes, "neighborhoods": nbh, "analogues": analogues, "backtest": backtest, "forecast_method": forecast_method, "stream": stream}
def clean(o):  # JSON has no NaN/Infinity: turn them into null
    if isinstance(o, float):
        return o if np.isfinite(o) else None
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    return o


s = json.dumps(clean(data), separators=(",", ":"), default=str, allow_nan=False)
(OUT / "data.json").write_text(s)
print(f"wrote app/live/data.json ({len(s) / 1e6:.2f} MB); {len(cells['rows']):,} evidence cells; {len(catalog_rows)} types")
