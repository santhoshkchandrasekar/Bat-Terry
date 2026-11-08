from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Dept = Literal["PWDx", "BTDT", "PARK", "ISD"]


class PredatorHypothesis(BaseModel):
    """One concrete way the goal fails. Specific enough that data can confirm or reject it."""
    name: str = Field(description="Short name, e.g. 'South Boston parking backlog in winter'")
    department: Dept
    request_type: Optional[str] = Field(description="Exact request type from the list, or null if department-wide")
    neighborhood: Optional[str] = Field(description="Exact neighborhood name from the list, or null if citywide")
    months: list[int] = Field(description="Months (1-12) when this failure bites; empty = all year")
    kind: Literal["miss", "silence", "shock", "capacity"] = Field(
        description="miss = requests closed late; silence = residents stopped reporting; "
                    "shock = weather/event spike; capacity = crews short of demand")
    suspected_cause: str = Field(description="One sentence on why this would happen")


class Flip(BaseModel):
    goal: str
    target_department: Optional[Dept] = Field(description="The department the goal is about, or null if citywide")
    inverted: str = Field(description="The goal rewritten as a first-person failure, dated Dec 31 2025")
    predators: list[PredatorHypothesis] = Field(description="5 to 8 hypotheses, most likely first")


class Evidence(BaseModel):
    verdict: Literal["CONFIRMED", "REJECTED", "UNTESTABLE"]
    requests_2024: int = 0
    overdue_2024: int = 0
    cliff_2024: int = 0
    cost_2024_usd: float = 0
    detail: str = ""


class Predator(BaseModel):
    hypothesis: PredatorHypothesis
    evidence: Evidence
    fix: Optional[dict] = None  # filled by the hunt


class Decision(BaseModel):
    decide_by: str          # date the paperwork must be signed
    effective: str          # month the crews are active
    department: Dept
    action: Literal["hire", "release", "seasonal"]
    crews: int
    monthly_cost_usd: float
    one_time_cost_usd: float
    kills: list[str] = []   # predator names this decision addresses
