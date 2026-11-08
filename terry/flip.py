"""The flip: a goal becomes its failure, and the failure gets named predators.

Technique: prompt engineering + structured output, in two steps.
  1. Read the goal: which department (if any) is it about?
  2. Flip it, with a schema built for that department: request types and neighborhoods are enums of the
     city's real names, so every predator is testable by construction. The model sees that department's
     own 2024 evidence (seasonality, costliest late types, costliest type x neighborhood cells), so it
     reasons from the shape of the data rather than from priors.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, create_model

from . import data
from .llm import parse
from .schemas import Dept, Flip, PredatorHypothesis


class GoalRead(BaseModel):
    target_department: Optional[Dept] = Field(description="PWDx Public Works, BTDT Transportation, PARK Parks, "
                                                          "ISD Inspectional Services; null if citywide")


SYSTEM = """You are Terry, a planning assistant for Boston city departments. You think by inversion.
Given a manager's goal, you (1) rewrite it as a vivid first-person statement of failure dated 31 December 2025,
with one concrete detail from the evidence (a request type and a neighborhood), and (2) list the specific,
testable ways that failure would come about: the predators.

Rules for predators:
- 5 to 7 predators, most likely first. Stay inside the goal's department.
- Lead with the request types and type x neighborhood cells that carried the most 2024 overdue cost in the
  evidence. Then add hypotheses the evidence does not settle (a season, a neighborhood, a capacity squeeze),
  because the data will confirm or reject them and both outcomes are useful.
- Size matters: a request type citywide, or a type in one neighborhood over a 2-4 month season. Never one
  neighborhood in one month.
- Kinds: mostly 'miss' (requests closed late) or 'capacity' (crews short of demand in peak months);
  at most one 'silence' (a neighborhood whose residents under-report) and at most one 'shock' (weather or event spike).
- Never invent numbers. Rejected predators are shown to the user, so be specific and falsifiable.

Scope rule for the failure statement: every figure in the evidence is a FULL-YEAR 2024 total. If you quote one, say it
is the 2024 figure (e.g. 'just as in 2024, when 502 Sidewalk Repair requests in the South End went late'), and never
attach it to a single month or season."""


def _evidence(dept: str | None) -> str:
    m = data.monthly()
    y24 = m[m.month.str.startswith("2024")]
    lines = []
    depts = [dept] if dept else list(data.DEPT_NAMES)
    for d in depts:
        g = y24[y24.department == d]
        peak = g.sort_values("requests", ascending=False).month.str[-2:].head(3).tolist()
        lines.append(f"{d} {data.DEPT_NAMES[d]} 2024: {g.requests.sum():,} requests, "
                     f"{1 - g.overdue.sum() / g.requests.sum():.0%} on time, peak months {', '.join(peak)}")
    pr = data.predators_raw()
    if dept:
        pr = pr[pr.department == dept]
    t = pr.groupby(["department", "type"]).agg(overdue=("overdue", "sum"), cost=("cost", "sum")).sort_values("cost", ascending=False).head(10)
    lines.append("\nCostliest late request types in 2024 (overdue count, cost at $20 + $100 past 30 days):")
    lines += [f"  {d} / {ty}: {r.overdue:,} late, ${r.cost:,.0f}" for (d, ty), r in t.iterrows()]
    cells = (pr.groupby(["type", "neighborhood"]).agg(overdue=("overdue", "sum"), cost=("cost", "sum"))
               .sort_values("cost", ascending=False).head(8))
    lines.append("\nCostliest type x neighborhood cells in 2024:")
    lines += [f"  {ty} in {nb}: {r.overdue:,} late, ${r.cost:,.0f}" for (ty, nb), r in cells.iterrows()]
    s = data.silence().sort_values("silence_ratio").head(4)
    lines.append("\nNeighborhoods whose residents report least for the same problems: " + ", ".join(s.neighborhood))
    return "\n".join(lines)


def _schema(dept: str | None):
    types = tuple(data.type_names(dept)) if dept else tuple(data.type_names())
    hoods = tuple(data.neighborhoods())
    T = Literal[types]  # type: ignore[valid-type]
    N = Literal[hoods]  # type: ignore[valid-type]
    D = Literal[(dept,)] if dept else Dept  # type: ignore[valid-type]
    Pred = create_model("Predator", __base__=PredatorHypothesis,
                        department=(D, ...),
                        request_type=(Optional[T], Field(description="Exact request type, or null if department-wide")),
                        neighborhood=(Optional[N], Field(description="Exact neighborhood, or null if citywide")))
    return create_model("FlipOut", goal=(str, ...), inverted=(str, ...), predators=(list[Pred], ...))


def flip(goal: str, stats: dict | None = None) -> Flip:
    """stats (optional) records what the guardrail did: first_pass_bad, fixed, stripped."""
    dept = parse([{"role": "user", "content": f"Which Boston 311 department is this goal about?\n\n{goal}"}],
                 GoalRead, temperature=0).target_department
    ev = _evidence(dept)
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"Evidence:\n{ev}\n\nGoal: {goal}"}]
    out = parse(msgs, _schema(dept), temperature=0.4)
    # Guardrail: any number in the flipped sentence must come from the evidence.
    from .report import unverified_numbers
    bad = unverified_numbers(out.inverted, {"evidence": ev})
    if stats is not None:
        stats.update(first_pass_bad=list(bad), fixed=False, stripped=False)
    if bad:
        msgs.append({"role": "user", "content": f"The failure statement uses numbers not in the evidence: {', '.join(bad)}. "
                     "Return the same answer with those numbers removed or replaced by numbers from the evidence."})
        out = parse(msgs, _schema(dept), temperature=0)
        still = unverified_numbers(out.inverted, {"evidence": ev})
        if stats is not None:
            stats.update(fixed=not still, stripped=bool(still))
        if still:
            import re
            out.inverted = re.sub(r"\$?\d[\d,]*\.?\d*\s*%?", "many", out.inverted)  # last resort: no unverified figures
    return Flip(goal=out.goal, target_department=dept, inverted=out.inverted,
                predators=[PredatorHypothesis(**p.model_dump()) for p in out.predators])
