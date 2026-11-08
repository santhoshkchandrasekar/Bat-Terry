"""Boston 311 crew simulator.

Day-level queue per department. Requests arrive with a due date; crews close
requests earliest-due-first up to daily capacity. Everything is bucketed by
due day, so one full-year run takes a few milliseconds.

Brief rules encoded here:
  - a crew works 21 days a month at a fixed daily capacity
  - hiring takes 1 month (crew is paid during training), release needs
    1 month notice and costs 25% of annual cost
  - Parks may add seasonal crews Apr-Oct at 1.3x monthly cost, no delay
  - overdue request: $20; still open 30+ days past target: +$100
  - no backlog on 1 Jan 2025

Modeling assumptions (ours, stated in the report):
  - requests with no target date use load but never count as overdue;
    for scheduling they get a 30-day nominal due date
  - crews work Mon-Fri; monthly capacity = crews x cap x 21, spread evenly
    over that month's weekdays
  - requests still open on 31 Dec are judged as of 31 Dec; the year-end backlog is charged its
    crew cost to clear plus the overdue fees it is projected to incur in early 2026
  - the on-time rate is "capacity-feasible": the share that crews could close on time. Process
    delays (inspection scheduling, legal steps) are not modeled; see the ISD discussion.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

YEAR = 2025
DAYS = pd.date_range(f"{YEAR}-01-01", f"{YEAR}-12-31", freq="D")
N_DAYS = len(DAYS)
HORIZON = N_DAYS + 400          # due days can run past year end (365-day SLAs)
MONTH_OF_DAY = DAYS.month.values - 1
IS_WORKDAY = DAYS.weekday.values < 5
NOMINAL_DUE_NO_TARGET = 30

DEPTS = {
    #        name,                  cap/day, annual cost, Jan-2025 crews
    "PWDx": ("Public Works",         12, 130_000, 50),
    "BTDT": ("Transportation",       15, 110_000, 18),
    "PARK": ("Parks & Recreation",    6, 120_000, 10),
    "ISD":  ("Inspectional Services", 4, 140_000, 16),
}
SEASONAL_MONTHS = range(3, 10)  # Apr..Oct (0-indexed)


@dataclass
class Arrivals:
    """Requests for one department in 2025, bucketed by (open day, due day)."""
    dept: str
    open_day: np.ndarray       # int, 0..364
    due_day: np.ndarray        # int, may exceed 364
    targeted: np.ndarray       # bool, False = no target date in source data

    @property
    def n(self) -> int:
        return len(self.open_day)

    def monthly_counts(self) -> np.ndarray:
        return np.bincount(MONTH_OF_DAY[self.open_day], minlength=12)


def build_arrivals(req: pd.DataFrame, dept: str, monthly_target: np.ndarray | None = None,
                   shock: dict[int, float] | None = None, seed: int = 0) -> Arrivals:
    """Replay 2024 requests of `dept` into 2025, rescaled to a monthly forecast.

    req: rows from requests_4dept.parquet (file_year 2024).
    monthly_target: 12 forecast counts; None keeps 2024 volumes.
    shock: {month_index: multiplier} applied on top (e.g. {1: 2.0} doubles February).
    """
    rng = np.random.default_rng(seed)
    d = req[(req.department == dept) & (req.open_dt.dt.year == 2024)]
    open_2025 = d.open_dt + pd.DateOffset(years=1)
    # Feb 29 2024 has no 2025 twin; DateOffset maps it to Feb 28.
    open_day = (open_2025.dt.normalize() - pd.Timestamp(f"{YEAR}-01-01")).dt.days.values
    sla = d.sla_days.values
    targeted = ~np.isnan(sla)
    due_day = open_day + np.where(targeted, np.ceil(np.nan_to_num(sla, nan=0)), NOMINAL_DUE_NO_TARGET)
    due_day = np.clip(due_day, 0, HORIZON - 1).astype(int)

    month = MONTH_OF_DAY[open_day]
    target = monthly_target if monthly_target is not None else np.bincount(month, minlength=12).astype(float)
    target = np.asarray(target, dtype=float).copy()
    if shock:
        for mi, mult in shock.items():
            target[mi] *= mult

    keep = []
    for mi in range(12):
        idx = np.flatnonzero(month == mi)
        k = int(round(target[mi]))
        if k <= len(idx):
            keep.append(rng.choice(idx, size=k, replace=False))
        else:  # resample extra requests from the same month, preserving its mix
            keep.append(np.concatenate([idx, rng.choice(idx, size=k - len(idx), replace=True)]))
    keep = np.concatenate(keep)
    return Arrivals(dept, open_day[keep], due_day[keep], targeted[keep])


@dataclass
class Plan:
    """Active regular crews per month (12 ints) plus Parks seasonal crews."""
    crews: np.ndarray
    seasonal: np.ndarray = field(default_factory=lambda: np.zeros(12, dtype=int))


@dataclass
class Result:
    dept: str
    plan: Plan
    monthly: pd.DataFrame
    totals: dict


def daily_capacity(dept: str, plan: Plan) -> np.ndarray:
    cap = DEPTS[dept][1]
    cap_cal = np.zeros(N_DAYS)
    for mi in range(12):
        days = np.flatnonzero((MONTH_OF_DAY == mi) & IS_WORKDAY)
        monthly = (plan.crews[mi] + plan.seasonal[mi]) * cap * 21
        cap_cal[days] = monthly / len(days)
    return cap_cal


def simulate(arr: Arrivals, plan: Plan) -> Result:
    dept = arr.dept
    cap_cal = daily_capacity(dept, plan)

    # arrivals[t] as sparse (due_day -> count) for targeted and untargeted
    add_t = np.zeros((N_DAYS, HORIZON))
    add_n = np.zeros((N_DAYS, HORIZON))
    np.add.at(add_t, (arr.open_day[arr.targeted], arr.due_day[arr.targeted]), 1)
    np.add.at(add_n, (arr.open_day[~arr.targeted], arr.due_day[~arr.targeted]), 1)

    q_t = np.zeros(HORIZON)
    q_n = np.zeros(HORIZON)
    due_idx = np.arange(HORIZON)
    m_closed = np.zeros(12); m_ontime = np.zeros(12); m_over = np.zeros(12); m_cliff = np.zeros(12)
    m_backlog = np.zeros(12)

    for t in range(N_DAYS):
        q_t += add_t[t]
        q_n += add_n[t]
        c = cap_cal[t]
        mi = MONTH_OF_DAY[t]
        if c > 0:
            tot = q_t + q_n
            served = np.diff(np.minimum(np.cumsum(tot), c), prepend=0.0)
            with np.errstate(invalid="ignore", divide="ignore"):
                frac_t = np.where(tot > 0, q_t / tot, 0.0)
            s_t = served * frac_t
            s_n = served - s_t
            q_t -= s_t
            q_n -= s_n
            late = due_idx < t
            m_closed[mi] += served.sum()
            m_over[mi] += s_t[late].sum()
            m_ontime[mi] += s_t[~late].sum()
            m_cliff[mi] += s_t[due_idx <= t - 30].sum()   # brief: open 30+ days past target
        m_backlog[mi] = q_t.sum() + q_n.sum()

    # still open at 31 Dec: already past due counts as overdue (and cliff if 30+ days)
    end = N_DAYS - 1
    open_late = q_t[due_idx < end].sum()
    open_cliff = q_t[due_idx <= end - 30].sum()
    m_over[11] += open_late
    m_cliff[11] += open_cliff

    annual = DEPTS[dept][2]
    monthly_cost = annual / 12
    prev = np.concatenate([[DEPTS[dept][3]], plan.crews[:-1]])
    hires = np.maximum(plan.crews - prev, 0)
    releases = np.maximum(prev - plan.crews, 0)
    crew_cost = plan.crews * monthly_cost
    # Paid during the training month, i.e. the month BEFORE the crew becomes active.
    train_cost = np.concatenate([hires[1:], [0]]) * monthly_cost
    release_cost = releases * 0.25 * annual
    seasonal_cost = plan.seasonal * 1.3 * monthly_cost
    overdue_cost = m_over * 20 + m_cliff * 100

    monthly = pd.DataFrame({
        "month": pd.period_range(f"{YEAR}-01", periods=12, freq="M").astype(str),
        "crews": plan.crews, "seasonal": plan.seasonal, "hire": hires, "release": releases,
        "demand": arr.monthly_counts(), "closed": m_closed.round(), "backlog_eom": m_backlog.round(),
        "overdue": m_over.round(), "cliff": m_cliff.round(),
        "crew_cost": crew_cost + train_cost + release_cost + seasonal_cost,
        "overdue_cost": overdue_cost,
    })
    targeted_n = arr.targeted.sum()
    # Year-end backlog is debt handed to 2026. Price it as (a) the crew cost to close it, plus
    # (b) the overdue charges it will incur, projected by clearing the queue earliest-due-first at
    # the net rate December crews can spare after January's new arrivals. Without this, long-SLA
    # departments (Parks 365-day targets, ISD 120-day) look perfect while backlog grows.
    backlog_end = q_t.sum() + q_n.sum()
    dec_days = (MONTH_OF_DAY == 11) & IS_WORKDAY
    cap_dec = cap_cal[dec_days].mean() * 5 / 7                  # per calendar day
    arr_jan = arr.monthly_counts()[0] / 31                       # Jan 2025 replay as Jan 2026 proxy
    net = max(cap_dec - arr_jan, 0.05 * cap_dec, 1.0)   # floor of 1/day keeps a zero-crew plan finite
    clear_day = end + np.cumsum(q_t + q_n) / net                 # queue is indexed by due day
    proj_late = q_t[(due_idx >= end) & (clear_day > due_idx)].sum()
    proj_cliff = q_t[(due_idx >= end - 30) & (clear_day > due_idx + 30)].sum()
    backlog_cost = backlog_end * cost_per_closure(dept) + 20 * proj_late + 100 * proj_cliff
    totals = {
        "dept": dept,
        "requests": arr.n,
        "ontime_rate": 1 - m_over.sum() / max(targeted_n, 1),
        "overdue": m_over.sum(), "cliff": m_cliff.sum(),
        "backlog_end": backlog_end,
        "proj_late": proj_late, "proj_cliff": proj_cliff,
        "crew_cost": monthly.crew_cost.sum(),
        "overdue_cost": overdue_cost.sum(),
        "backlog_cost": backlog_cost,
        "total_cost": monthly.crew_cost.sum() + overdue_cost.sum() + backlog_cost,
    }
    return Result(dept, plan, monthly, totals)


def cost_per_closure(dept: str) -> float:
    _, cap, annual, _ = DEPTS[dept]
    return annual / (cap * 21 * 12)


def flat_plan(dept: str) -> Plan:
    """Do-nothing baseline: keep January 2025 crews all year."""
    return Plan(np.full(12, DEPTS[dept][3], dtype=int))
