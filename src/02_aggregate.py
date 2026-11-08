"""Stage 2: build the aggregates every later stage reads.

Outputs (data/processed/):
  monthly_demand.csv     department x month: requests, on-time, overdue, 30-day-cliff, no-target
  sla_profile.csv        department: SLA-days quantiles and shares (feeds the simulator)
  request_types.csv      type x department x queue with counts and sample titles (feeds RAG)
  neighborhood.csv       neighborhood x department: volume, overdue rate, resident vs employee share
  predators_raw.csv      type x neighborhood x month overdue counts and modeled cost (feeds the flip)

Usage: python3 -I src/02_aggregate.py data/processed
"""
import sys
from pathlib import Path

import pandas as pd

P = Path(sys.argv[1])
df = pd.read_parquet(P / "requests_4dept.parquet")
DATA_END = pd.Timestamp("2026-11-01")  # snapshot date: open cases are judged as of download

df["overdue"] = df.on_time == "OVERDUE"
# 30-day cliff: closed more than 30 days late, or still open and 30+ days past target at snapshot
still_open_late = df.closed_dt.isna() & ((DATA_END - df.sla_target_dt).dt.days > 30)
df["cliff"] = df.overdue & ((df.late_days > 30) | still_open_late)
df["cost"] = df.overdue * 20 + df.cliff * 100

# 1. Monthly demand
m = df.groupby(["department", "month"]).agg(
    requests=("case_enquiry_id", "size"),
    overdue=("overdue", "sum"),
    cliff=("cliff", "sum"),
    no_target=("sla_target_dt", lambda s: s.isna().sum()),
    employee=("is_employee", "sum"),
    overdue_cost=("cost", "sum"),
).reset_index()
m["ontime_rate"] = 1 - m.overdue / m.requests
m.to_csv(P / "monthly_demand.csv", index=False)

# 2. SLA profile
def sla_stats(g):
    s = g.sla_days.dropna()
    return pd.Series({
        "n": len(g),
        "share_no_target": g.sla_days.isna().mean(),
        "sla_p10": s.quantile(0.10), "sla_p25": s.quantile(0.25),
        "sla_median": s.median(), "sla_p75": s.quantile(0.75), "sla_p90": s.quantile(0.90),
        "share_sla_ge_300d": (s >= 300).mean(),
        "close_median_days": g.close_days.median(),
    })
sla = df[df.file_year == 2024].groupby("department").apply(sla_stats, include_groups=False)
sla.to_csv(P / "sla_profile.csv")

# 3. Request types for RAG
types = (df.groupby(["type", "department", "queue"])
           .agg(count=("case_enquiry_id", "size"),
                reason=("reason", "first"), subject=("subject", "first"),
                overdue_rate=("overdue", "mean"))
           .reset_index())
titles = (df.groupby("type").case_title
            .agg(lambda s: " | ".join(s.value_counts().head(5).index.astype(str))))
types["sample_titles"] = types.type.map(titles)
types = types.sort_values("count", ascending=False)
types.to_csv(P / "request_types.csv", index=False)

# 4. Neighborhood view (silence lives here)
nb = df[df.file_year == 2024].groupby(["neighborhood", "department"]).agg(
    requests=("case_enquiry_id", "size"),
    overdue_rate=("overdue", "mean"),
    employee_share=("is_employee", "mean"),
    median_close_days=("close_days", "median"),
).reset_index()
nb.to_csv(P / "neighborhood.csv", index=False)

# 5. Raw predators: where the overdue cost actually landed in 2024
pr = (df[(df.file_year == 2024) & df.overdue]
        .groupby(["department", "type", "neighborhood", "month"])
        .agg(overdue=("case_enquiry_id", "size"), cliff=("cliff", "sum"), cost=("cost", "sum"))
        .reset_index().sort_values("cost", ascending=False))
pr.to_csv(P / "predators_raw.csv", index=False)

# ---- Print the findings that matter tonight ----
pd.set_option("display.width", 160)
y24 = m[m.month.str.startswith("2024")]
print("== 2024 monthly requests by department ==")
print(y24.pivot(index="month", columns="department", values="requests").to_string())

print("\n== 2024 overdue cost by department (USD, $20 + $100 cliff) ==")
print(y24.groupby("department")[["requests", "overdue", "cliff", "overdue_cost"]].sum().to_string())

print("\n== SLA profile, 2024 ==")
print(sla.round(2).to_string())

print(f"\n== {types.type.nunique()} distinct types across the 4 depts; top 12 ==")
print(types.head(12)[["type", "department", "queue", "count", "overdue_rate"]].round(2).to_string(index=False))

print("\n== Top 10 single predators of 2024 (type x neighborhood x month) ==")
print(pr.head(10).to_string(index=False))

print("\n== Top predators by type, full year 2024 ==")
print(pr.groupby(["department", "type"])[["overdue", "cliff", "cost"]].sum()
        .sort_values("cost", ascending=False).head(10).to_string())
