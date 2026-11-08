"""Forecast + crew-plan search under forecast uncertainty.

Forecast: seasonal average of the last two years, re-leveled to the latest year. Chosen by
backtest (src/04_forecast_backtest.py): forecasting 2024 from 2022-23 this way gave the lowest
mean monthly error across departments (MAPE 7% to 14%).

Uncertainty: the backtest shows forecast error is mostly a LEVEL error (annual error about as
large as monthly MAPE), so we plan against three whole-year demand multipliers. One pooled level
sigma from the four departments' annual backtest errors (RMS 6.7%, inflated to 8% for n=4), and
3-point Gauss-Hermite nodes: 0.86 / 1.00 / 1.14 with weights 1/6, 2/3, 1/6.

Objective: expected total cost (crews + overdue + year-end backlog) over the three nodes.
Modes are service floors under that same objective (penalty $1M per percentage point short):
  passive     no floor: lateness is just a cost
  neutral     on-time >= 90% in every node
  aggressive  on-time >= 95% in every node AND >= 90% at a +20% stress node (weight 0 in cost)

Search: multi-start local search over monthly crew levels. January is fixed (crews on hand);
changes from February on respect the 1-month hiring lag and notice period by construction
(the decision is made a month ahead). Moves: +/-1, +/-2 in one month, or from that month on.
Parks also gets seasonal moves (Apr-Oct) and a swap move (one regular for one seasonal).
`fixed_months` freezes the first months, for the mid-year re-plan test.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from sim import DEPTS, SEASONAL_MONTHS, Plan, build_arrivals, simulate

SIGMA = 0.08
NODES = (1 - 3 ** 0.5 * SIGMA, 1.0, 1 + 3 ** 0.5 * SIGMA)
WEIGHTS = (1 / 6, 2 / 3, 1 / 6)
STRESS = 1.20
FLOORS = {"passive": None, "neutral": 0.90, "aggressive": 0.95}
MODES = tuple(FLOORS)
PENALTY = 1e8  # per unit of on-time shortfall = $1M per percentage point


def forecast_2025(monthly_demand: pd.DataFrame, dept: str) -> np.ndarray:
    m = monthly_demand[monthly_demand.department == dept].copy()
    y23 = m[m.month.str.startswith("2023")].requests.values.astype(float)
    y24 = m[m.month.str.startswith("2024")].requests.values.astype(float)
    avg = (y23 + y24) / 2
    return avg * (y24.sum() / avg.sum())


def cost(res) -> float:
    t = res.totals
    return t["crew_cost"] + t["overdue_cost"] + t["backlog_cost"]


class Evaluator:
    """Holds the scenario arrivals for one department and scores plans against them."""

    def __init__(self, req, dept, fc, mode="neutral", nodes=NODES, weights=WEIGHTS, seed=1):
        self.dept, self.mode = dept, mode
        self.nodes, self.weights = nodes, weights
        self.arrs = [build_arrivals(req, dept, monthly_target=fc * m, seed=seed) for m in nodes]
        self.stress = (build_arrivals(req, dept, monthly_target=fc * STRESS, seed=seed)
                       if mode == "aggressive" else None)
        self.evals = 0

    def results(self, plan):
        self.evals += 1
        return [simulate(a, plan) for a in self.arrs]

    def score(self, plan):
        rs = self.results(plan)
        e = sum(w * cost(r) for w, r in zip(self.weights, rs))
        floor = FLOORS[self.mode]
        if floor is not None:
            worst = min(r.totals["ontime_rate"] for r in rs)
            e += PENALTY * max(0.0, floor - worst)
        if self.stress is not None:
            s = simulate(self.stress, plan)
            e += PENALTY * max(0.0, 0.90 - s.totals["ontime_rate"])
        return e, rs


def _search(ev: Evaluator, plan: Plan, fixed_months: int = 1, max_passes: int = 12):
    best_obj, best_rs = ev.score(plan)
    for _ in range(max_passes):
        improved = False
        cands = []
        for mi in range(fixed_months, 12):
            for step in (-2, -1, 1, 2):
                for block in (False, True):
                    c = plan.crews.copy()
                    if block:
                        c[mi:] += step
                    else:
                        c[mi] += step
                    cands.append(Plan(c, plan.seasonal.copy()))
        if ev.dept == "PARK":
            for mi in SEASONAL_MONTHS:
                if mi < fixed_months:
                    continue
                for step in (-1, 1, 2):
                    s = plan.seasonal.copy(); s[mi] += step
                    cands.append(Plan(plan.crews.copy(), s))
            for mi in range(max(fixed_months, 1), 12):   # swap: one regular out from mi on, one seasonal in Apr-Oct
                c = plan.crews.copy(); s = plan.seasonal.copy()
                c[mi:] -= 1
                s[[m for m in SEASONAL_MONTHS if m >= max(mi, fixed_months)]] += 1
                cands.append(Plan(c, s))
        for cand in cands:
            if (cand.crews < 0).any() or (cand.seasonal < 0).any():
                continue
            o, rs = ev.score(cand)
            if o < best_obj - 1:
                plan, best_obj, best_rs, improved = cand, o, rs, True
        if not improved:
            break
    return plan, best_obj, best_rs


def optimize(req, dept: str, fc: np.ndarray, mode: str = "neutral", nodes=NODES, weights=WEIGHTS,
             fixed_plan: Plan | None = None, fixed_months: int = 1):
    """Best plan for `dept` under `mode`. Returns (plan, expected_cost_incl_penalty, node_results, evaluator)."""
    _, cap, _, start = DEPTS[dept]
    ev = Evaluator(req, dept, fc, mode, nodes, weights)
    if fixed_plan is not None:
        starts = [Plan(fixed_plan.crews.copy(), fixed_plan.seasonal.copy())]
    else:
        hi = fc * max(nodes)
        matched = np.maximum(np.ceil(hi / (cap * 21)).astype(int), 1)
        matched[0] = start
        starts = [Plan(np.full(12, start, dtype=int), np.zeros(12, dtype=int)),
                  Plan(matched, np.zeros(12, dtype=int))]
        if dept == "PARK":
            s = np.zeros(12, dtype=int); s[list(SEASONAL_MONTHS)] = 5
            starts.append(Plan(np.full(12, start, dtype=int), s))
    best = None
    for st in starts:
        p, o, rs = _search(ev, st, fixed_months=fixed_months)
        if best is None or o < best[1]:
            best = (p, o, rs)
    return best[0], best[1], best[2], ev


def expected(rs, weights=WEIGHTS) -> dict:
    """Probability-weighted totals over node results."""
    keys = ("ontime_rate", "overdue", "cliff", "backlog_end", "proj_late", "proj_cliff",
            "crew_cost", "overdue_cost", "backlog_cost", "total_cost")
    out = {k: float(sum(w * r.totals[k] for w, r in zip(weights, rs))) for k in keys}
    out["worst_ontime"] = float(min(r.totals["ontime_rate"] for r in rs))
    return out
