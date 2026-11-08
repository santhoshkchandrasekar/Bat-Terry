"""Decision calendar: a crew plan becomes dated decisions.

Hiring and training take a month (paid), so a crew who works from month M is signed by the last day of month M-2
and trains during month M-1. A release effective in month M is notified by the same date (a month's notice).
Parks seasonal crews need no lead time.
"""
from __future__ import annotations

import calendar as cal
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from sim import DEPTS  # noqa: E402

from .schemas import Decision  # noqa: E402


def _last_day(year: int, month: int) -> str:
    return f"{year}-{month:02d}-{cal.monthrange(year, month)[1]:02d}"


def decisions(department: str, crews_by_month: list[int], seasonal_by_month: list[int] | None = None,
              kills: list[str] | None = None, year: int = 2025) -> list[Decision]:
    _, _, annual, start = DEPTS[department]
    monthly = annual / 12
    seasonal_by_month = seasonal_by_month or [0] * 12
    out: list[Decision] = []
    prev = start
    prev_seasonal = 0
    for i, c in enumerate(crews_by_month):
        m = i + 1
        if c != prev:
            action = "hire" if c > prev else "release"
            n = abs(c - prev)
            decide_by = _last_day(year, m - 2) if m > 2 else (f"{year - 1}-12-31" if m == 2 else f"{year}-01-01")
            out.append(Decision(
                decide_by=decide_by, effective=f"{year}-{m:02d}", department=department, action=action, crews=n,
                monthly_cost_usd=round(n * monthly if action == "hire" else -n * monthly),
                one_time_cost_usd=round(n * 0.25 * annual if action == "release" else n * monthly),  # training month paid
                kills=kills or []))
        s = seasonal_by_month[i]
        if s != prev_seasonal:
            n = s - prev_seasonal
            out.append(Decision(
                decide_by=f"{year}-{m:02d}-01", effective=f"{year}-{m:02d}", department=department, action="seasonal",
                crews=n, monthly_cost_usd=round(n * monthly * 1.3), one_time_cost_usd=0, kills=kills or []))
        prev, prev_seasonal = c, s
    return out


def as_table(ds: list[Decision]) -> str:
    kills = any(d.kills for d in ds)
    head = "| Decide by | Effective | Dept | Action | Crews | Monthly cost | One-time |" + (" Kills |" if kills else "")
    lines = [head, "|---" * (7 + kills) + "|"]
    for d in ds:
        n = -d.crews if d.action == "release" else d.crews
        lines.append(f"| {d.decide_by} | {d.effective} | {d.department} | {d.action} | {n:+d} | "
                     f"${d.monthly_cost_usd:,.0f} | ${d.one_time_cost_usd:,.0f} |" + (f" {', '.join(d.kills)[:60]} |" if kills else ""))
    return "\n".join(lines)
