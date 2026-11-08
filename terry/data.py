"""Cached access to the processed data every Terry stage reads."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"

DEPT_NAMES = {"PWDx": "Public Works", "BTDT": "Transportation", "PARK": "Parks & Recreation",
              "ISD": "Inspectional Services"}


@lru_cache
def requests() -> pd.DataFrame:
    return pd.read_parquet(P / "requests_4dept.parquet")


@lru_cache
def monthly() -> pd.DataFrame:
    return pd.read_csv(P / "monthly_demand.csv")


@lru_cache
def predators_raw() -> pd.DataFrame:
    return pd.read_csv(P / "predators_raw.csv")


@lru_cache
def types() -> pd.DataFrame:
    return pd.read_csv(P / "request_types.csv")


@lru_cache
def silence() -> pd.DataFrame:
    return pd.read_csv(P / "silence.csv")


@lru_cache
def forecast() -> pd.DataFrame:
    return pd.read_csv(P / "forecast_2025.csv")


def type_names(dept: str | None = None) -> list[str]:
    t = types()
    if dept:
        t = t[t.department == dept]
    return sorted(t.type.unique().tolist())


def neighborhoods() -> list[str]:
    s = silence()
    return sorted(s.neighborhood.tolist())
