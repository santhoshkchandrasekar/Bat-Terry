"""Stage 1: load raw 311 files, keep the four in-scope departments, save a slim parquet.

Usage: python3 -I src/01_load.py <raw_dir> <out_dir>
"""
import sys
from pathlib import Path

import pandas as pd

RAW, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

DEPTS = ["PWDx", "BTDT", "PARK", "ISD"]
COLS = [
    "case_enquiry_id", "open_dt", "sla_target_dt", "closed_dt", "on_time",
    "case_status", "case_title", "subject", "reason", "type", "queue",
    "department", "neighborhood", "latitude", "longitude", "source",
]
EMPLOYEE_SOURCES = {"Employee Generated", "City Worker App"}

frames = []
for year in (2023, 2024):
    df = pd.read_csv(RAW / f"311_{year}.csv", usecols=COLS, dtype=str, low_memory=False)
    print(f"{year}: {len(df):,} rows total, departments: {df.department.nunique()}")
    df = df[df.department.isin(DEPTS)].copy()
    df["file_year"] = year
    frames.append(df)

df = pd.concat(frames, ignore_index=True)
for c in ("open_dt", "sla_target_dt", "closed_dt"):
    # Raw timestamps mix "...:00" and "...:00.123" styles; ISO8601 parses both.
    df[c] = pd.to_datetime(df[c], format="ISO8601", errors="coerce")
df["latitude"] = pd.to_numeric(df.latitude, errors="coerce")
df["longitude"] = pd.to_numeric(df.longitude, errors="coerce")
df["case_title"] = df.case_title.str.replace("&amp;", "&", regex=False).str.strip()
df["is_employee"] = df.source.isin(EMPLOYEE_SOURCES)
df["sla_days"] = (df.sla_target_dt - df.open_dt).dt.total_seconds() / 86400
df["close_days"] = (df.closed_dt - df.open_dt).dt.total_seconds() / 86400
df["late_days"] = (df.closed_dt - df.sla_target_dt).dt.total_seconds() / 86400
df["month"] = df.open_dt.dt.to_period("M").astype(str)

bad = df.open_dt.isna().sum()
assert bad == 0, f"{bad} rows failed to parse open_dt"
df.to_parquet(OUT / "requests_4dept.parquet", index=False)
print(f"saved {len(df):,} rows, {df.memory_usage(deep=True).sum()/1e6:.0f} MB in memory")

# Sanity check against the brief: 2024 counts and on-time rates
y24 = df[df.file_year == 2024]
check = y24.groupby("department").agg(
    requests=("case_enquiry_id", "size"),
    ontime_rate=("on_time", lambda s: (s == "ONTIME").mean()),
    no_target=("sla_target_dt", lambda s: s.isna().mean()),
    employee_share=("is_employee", "mean"),
)
print("\n2024 check (brief: PWDx 157,610 / 90%, BTDT 81,447 / 50%, PARK 18,736 / 93%, ISD 18,624 / 72%)")
print(check.round(3).to_string())
print("\nsource values:", df.source.value_counts().to_dict())
print("on_time values:", df.on_time.value_counts(dropna=False).to_dict())
