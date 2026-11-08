"""Echolocation: test every predator hypothesis against the real 2024 data.

No LLM here on purpose. The model proposes; the data decides.

A 'miss' or 'capacity' predator is CONFIRMED when the cell it names (department, type,
neighborhood, months) had a material share of overdue requests in 2024: at least 20 overdue
with an overdue rate 10 points above the department's average, or at least $5,000 of modeled cost
with a late rate at least 2 points above the department's.
A 'silence' predator is CONFIRMED when the neighborhood's silence ratio is below 0.85.
A 'shock' predator is UNTESTABLE from 311 data alone and is passed to the simulator.
"""
from __future__ import annotations

import pandas as pd

from . import data
from .schemas import Evidence, Predator, PredatorHypothesis

MIN_OVERDUE, MIN_COST, RATE_MARGIN = 20, 5_000, 0.10


def _cell(h: PredatorHypothesis) -> pd.DataFrame:
    r = data.requests()
    d = r[(r.file_year == 2024) & (r.department == h.department)]
    if h.request_type:
        d = d[d.type == h.request_type]
    if h.neighborhood:
        d = d[d.neighborhood == h.neighborhood]
    if h.months:
        d = d[d.open_dt.dt.month.isin(h.months)]
    return d


def test(h: PredatorHypothesis) -> Evidence:
    if h.kind == "silence":
        s = data.silence().set_index("neighborhood")
        if not h.neighborhood or h.neighborhood not in s.index:
            return Evidence(verdict="UNTESTABLE", detail="No neighborhood named, or not in the silence table.")
        row = s.loc[h.neighborhood]
        v = "CONFIRMED" if row.silence_ratio < 0.85 else "REJECTED"
        return Evidence(verdict=v, requests_2024=int(row.requests),
                        detail=f"Residents in {h.neighborhood} report at {row.silence_ratio:.2f}x the city rate for the "
                               f"same problem types (quietest: {row.quietest_type} at {row.quietest_ratio:.2f}x).")
    if h.kind == "shock":
        return Evidence(verdict="UNTESTABLE", detail="Weather and event spikes are tested in the simulator, not in history.")

    d = _cell(h)
    if len(d) == 0:
        return Evidence(verdict="REJECTED", detail="No 2024 requests match this cell. Check the type or neighborhood name.")
    overdue = d.on_time.eq("OVERDUE")
    cliff = overdue & ((d.late_days > 30) | (d.closed_dt.isna() & ((pd.Timestamp("2026-11-01") - d.sla_target_dt).dt.days > 30)))
    cost = overdue.sum() * 20 + cliff.sum() * 100
    dept_rate = data.requests().query("file_year == 2024 and department == @h.department").on_time.eq("OVERDUE").mean()
    rate = overdue.mean()
    # Confirmed when the cell is clearly worse than its department, or carries real cost at or above the
    # department's late rate. A big cell that is merely average is not a predator, just the department.
    confirmed = ((overdue.sum() >= MIN_OVERDUE and rate > dept_rate + RATE_MARGIN)
                 or (cost >= MIN_COST and rate >= dept_rate + 0.02))
    where = " in " + h.neighborhood if h.neighborhood else " citywide"
    when = f" in months {h.months}" if h.months else ""
    detail = (f"{len(d):,} requests{where}{when}; {overdue.sum():,} overdue ({rate:.0%} vs {dept_rate:.0%} for the department), "
              f"{cliff.sum():,} past the 30-day cliff; modeled cost ${cost:,.0f}.")
    return Evidence(verdict="CONFIRMED" if confirmed else "REJECTED", requests_2024=len(d),
                    overdue_2024=int(overdue.sum()), cliff_2024=int(cliff.sum()), cost_2024_usd=float(cost), detail=detail)


def echolocate(hyps: list[PredatorHypothesis]) -> list[Predator]:
    return [Predator(hypothesis=h, evidence=test(h)) for h in hyps]
