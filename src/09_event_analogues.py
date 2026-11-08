"""Real demand spikes that size Flyover's events (Ping never invents a magnitude).

For each department, daily request counts are compared with a 56-day centered median baseline; the largest
excess over a 3-, 7- and 14-day window is a candidate spike. The analogues below are the spikes with a known
real-world cause, measured here so the numbers in the app can be reproduced.

Usage (repo root): python3 -I src/09_event_analogues.py data/raw data/processed
"""
import json
import sys
from pathlib import Path

import pandas as pd

RAW, OUT = Path(sys.argv[1]), Path(sys.argv[2])
DEPTS = ["PWDx", "BTDT", "PARK", "ISD"]

frames = []
for y in (2022, 2023, 2024):
    x = pd.read_csv(RAW / f"311_{y}.csv", usecols=["open_dt", "department"], low_memory=False)
    x["open_dt"] = pd.to_datetime(x.open_dt, format="ISO8601", errors="coerce")
    frames.append(x[x.department.isin(DEPTS) & x.open_dt.notna()])
x = pd.concat(frames)
daily = x.groupby([x.open_dt.dt.normalize(), "department"]).size().unstack().reindex(columns=DEPTS).fillna(0)
daily = daily.asfreq("D", fill_value=0)


def spike(dept: str, end: str, days: int) -> dict:
    s = daily[dept]
    base = s.rolling(56, center=True, min_periods=28).median()
    e = pd.Timestamp(end)
    win = slice(e - pd.Timedelta(days=days - 1), e)
    got, exp = float(s[win].sum()), float(base[win].sum())
    return {"dept": dept, "days": days, "mult": round(got / exp, 2), "extra": int(round(got - exp)),
            "window": f"{(e - pd.Timedelta(days=days - 1)).date()} to {e.date()}"}


ANALOGUES = [
    {"kind": "snowstorm", "label": "the January 2022 blizzard", "effects": [spike("PWDx", "2022-02-12", 14), spike("BTDT", "2022-02-03", 7)]},
    {"kind": "windstorm", "label": "the December 2023 wind and rain storm", "effects": [spike("PARK", "2023-12-24", 14)]},
    {"kind": "deep_freeze", "label": "the February 2023 deep freeze", "effects": [spike("ISD", "2023-02-15", 14)]},
    {"kind": "move_in", "label": "the 1 September 2023 move-in weekend", "effects": [spike("PWDx", "2023-09-01", 7), spike("BTDT", "2023-09-07", 3)]},
    {"kind": "heat_wave", "label": "the July 2022 heat wave", "effects": [spike("PARK", "2022-07-21", 3)]},
]
(OUT / "event_analogues.json").write_text(json.dumps(ANALOGUES, indent=1))
for a in ANALOGUES:
    print(a["kind"], [(e["dept"], e["days"], e["mult"], e["extra"]) for e in a["effects"]])
