"""The simulator and data, exposed as tools an agent can call.

Each function has a plain signature and a docstring; `TOOLS` is the OpenAI function-calling
spec built from them. Plans for the base forecast come from the full run (plan_summary.json), so
the agent quotes exactly the numbers in the report; other scenarios are optimized on demand.
"""
from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from optimize import MODES, expected, forecast_2025, optimize  # noqa: E402
from sim import DEPTS, Plan, build_arrivals, flat_plan, simulate  # noqa: E402

from . import data  # noqa: E402

_ARR = {}


def _fc(dept: str, demand_mult: float = 1.0, shock_month: int | None = None, shock_mult: float = 1.0):
    fc = forecast_2025(data.monthly(), dept) * demand_mult
    if shock_month:
        fc = fc.copy(); fc[shock_month - 1] *= shock_mult
    return fc


def arrivals(dept, demand_mult=1.0, shock_month=None, shock_mult=1.0):
    key = (dept, round(demand_mult, 4), shock_month, round(shock_mult, 4))
    if key not in _ARR:
        _ARR[key] = build_arrivals(data.requests(), dept, monthly_target=_fc(dept, demand_mult, shock_month, shock_mult), seed=1)
    return _ARR[key]


MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def schedule_text(crews, seasonal=None) -> str:
    """Run-length crew schedule in words, e.g. 'Jan-Feb 50, Mar 56, Aug-Dec 70 (+3 seasonal Jun-Aug)'."""
    def runs(v):
        out, i = [], 0
        while i < 12:
            j = i
            while j + 1 < 12 and v[j + 1] == v[i]:
                j += 1
            out.append((i, j, v[i])); i = j + 1
        return out
    txt = ", ".join(f"{MON[a]}{'-' + MON[b] if b > a else ''} {c}" for a, b, c in runs(list(crews)))
    if seasonal is not None and any(seasonal):
        txt += " (seasonal: " + ", ".join(f"{MON[a]}{'-' + MON[b] if b > a else ''} +{c}" for a, b, c in runs(list(seasonal)) if c) + ")"
    return txt


def _summary(res) -> dict:
    t = res.totals
    return {"dept": t["dept"], "crew_schedule": schedule_text(res.plan.crews, res.plan.seasonal), "ontime_rate": round(float(t["ontime_rate"]), 3), "overdue": int(t["overdue"]),
            "cliff": int(t["cliff"]), "backlog_end": int(t["backlog_end"]), "projected_late_in_2026": int(t["proj_late"]),
            "crew_cost": round(float(t["crew_cost"])), "overdue_cost": round(float(t["overdue_cost"])),
            "backlog_cost": round(float(t["backlog_cost"])),
            "total_cost": round(float(t["crew_cost"] + t["overdue_cost"] + t["backlog_cost"])),
            "crews_by_month": res.plan.crews.tolist(), "seasonal_by_month": res.plan.seasonal.tolist()}


@lru_cache
def saved_plans() -> dict:
    p = data.P / "plan_summary.json"
    return json.loads(p.read_text())["plans"] if p.exists() else {}


def simulate_plan(department: str, crews_by_month: list[int], seasonal_by_month: list[int] | None = None,
                  demand_mult: float = 1.0, shock_month: int | None = None, shock_mult: float = 1.0) -> dict:
    """Simulate 2025 for one department with a given crew plan. Returns on-time rate, overdue counts and costs.
    crews_by_month: 12 ints (January must equal current crews). seasonal_by_month: Parks only, Apr-Oct.
    demand_mult scales the whole forecast (0.8 = 20% lower). shock_month/shock_mult spike one month."""
    crews = np.array(crews_by_month, dtype=int)
    seas = np.array(seasonal_by_month or [0] * 12, dtype=int)
    if len(crews) != 12 or len(seas) != 12:
        return {"error": "crews_by_month and seasonal_by_month must each have 12 values"}
    if (crews < 0).any() or (seas < 0).any():
        return {"error": "crew counts cannot be negative"}
    note = None
    if crews[0] != DEPTS[department][3]:
        note = f"January set to {DEPTS[department][3]}, the crews on hand (hiring takes a month)"
        crews[0] = DEPTS[department][3]
    if department != "PARK" and seas.any():
        note = "seasonal crews exist only for Parks; ignored"
        seas[:] = 0
    seas[[0, 1, 2, 10, 11]] = 0  # seasonal crews only Apr-Oct
    out = _summary(simulate(arrivals(department, demand_mult, shock_month, shock_mult), Plan(crews, seas)))
    if note:
        out["note"] = note
    return out


def optimize_plan(department: str, mode: str = "neutral", demand_mult: float = 1.0,
                  shock_month: int | None = None, shock_mult: float = 1.0) -> dict:
    """Best 2025 crew plan for a department, planned against forecast uncertainty (demand x0.86/1.00/1.14).
    mode: passive (cheapest, lateness is just a cost), neutral (>= 90% on time in every scenario),
    aggressive (>= 95% in every scenario and >= 90% even at +20% demand).
    Returns the plan and its result at the given demand level."""
    saved = saved_plans().get(department, {}).get(mode)
    if saved and demand_mult == 1.0 and not shock_month:
        plan = Plan(np.array(saved["crews"]), np.array(saved["seasonal"]))
    else:
        plan, *_ = optimize(data.requests(), department, _fc(department, demand_mult, shock_month, shock_mult), mode)
    out = _summary(simulate(arrivals(department, demand_mult, shock_month, shock_mult), plan))
    out["mode"] = mode
    return out


def do_nothing(department: str, demand_mult: float = 1.0) -> dict:
    """Baseline: keep January 2025 crews all year."""
    return _summary(simulate(arrivals(department, demand_mult), flat_plan(department)))


def overdue_lookup(department: str, request_type: str | None = None, neighborhood: str | None = None) -> dict:
    """2024 overdue counts and modeled cost for a department, optionally one type and/or neighborhood, by month."""
    pr = data.predators_raw()
    d = pr[pr.department == department]
    if request_type:
        d = d[d.type == request_type]
    if neighborhood:
        d = d[d.neighborhood == neighborhood]
    by_month = d.groupby("month")[["overdue", "cliff", "cost"]].sum()
    return {"total_overdue": int(d.overdue.sum()), "total_cost": float(d.cost.sum()),
            "by_month": {m: {"overdue": int(r.overdue), "cost": float(r.cost)} for m, r in by_month.iterrows()}}


def break_point(department: str, crews_by_month: list[int], target_ontime: float = 0.90) -> dict:
    """Smallest uniform demand increase (in %) at which a plan's on-time rate falls below target (default 0.90).
    Pass the plan's crews_by_month exactly as returned by optimize_plan."""
    if target_ontime > 1:          # accept 90 as well as 0.90
        target_ontime /= 100
    if len(crews_by_month) != 12 or not any(crews_by_month):
        return {"error": "pass the plan's 12 monthly crew counts (from optimize_plan), not zeros"}
    for pct in range(0, 61, 2):
        r = simulate_plan(department, crews_by_month, demand_mult=1 + pct / 100)
        if r["ontime_rate"] < target_ontime:
            return {"break_pct": pct, "ontime_at_break": r["ontime_rate"]}
    return {"break_pct": None, "ontime_at_break": None, "note": "holds beyond +60%"}


FUNCTIONS = {f.__name__: f for f in (simulate_plan, optimize_plan, do_nothing, overdue_lookup, break_point)}

_P = {"department": {"type": "string", "enum": list(DEPTS)}}
TOOLS = [
    {"type": "function", "function": {"name": "optimize_plan", "description": optimize_plan.__doc__,
     "parameters": {"type": "object", "properties": {**_P, "mode": {"type": "string", "enum": list(MODES)},
                    "demand_mult": {"type": "number"}, "shock_month": {"type": "integer"}, "shock_mult": {"type": "number"}},
                    "required": ["department"]}}},
    {"type": "function", "function": {"name": "simulate_plan", "description": simulate_plan.__doc__,
     "parameters": {"type": "object", "properties": {**_P, "crews_by_month": {"type": "array", "items": {"type": "integer"}},
                    "seasonal_by_month": {"type": "array", "items": {"type": "integer"}}, "demand_mult": {"type": "number"},
                    "shock_month": {"type": "integer"}, "shock_mult": {"type": "number"}},
                    "required": ["department", "crews_by_month"]}}},
    {"type": "function", "function": {"name": "do_nothing", "description": do_nothing.__doc__,
     "parameters": {"type": "object", "properties": {**_P, "demand_mult": {"type": "number"}}, "required": ["department"]}}},
    {"type": "function", "function": {"name": "overdue_lookup", "description": overdue_lookup.__doc__,
     "parameters": {"type": "object", "properties": {**_P, "request_type": {"type": "string"}, "neighborhood": {"type": "string"}},
                    "required": ["department"]}}},
    {"type": "function", "function": {"name": "break_point", "description": break_point.__doc__,
     "parameters": {"type": "object", "properties": {**_P, "crews_by_month": {"type": "array", "items": {"type": "integer"}},
                    "target_ontime": {"type": "number"}}, "required": ["department", "crews_by_month"]}}},
]


def call(name: str, args: dict):
    return FUNCTIONS[name](**args)
