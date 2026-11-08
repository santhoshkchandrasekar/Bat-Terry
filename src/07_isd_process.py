"""Stage 7: why Inspectional Services is late, by reason (2024).

The crew model says ISD has enough capacity to close nearly everything on time, yet 28% of its
2024 requests were late. If lateness were a capacity problem it would hit every reason in
proportion to volume. Instead it concentrates in reasons with short targets and long realized
close times: inspection scheduling and legal process, not crew count.

Usage: python3 -I src/07_isd_process.py data/processed
"""
import sys
from pathlib import Path

import pandas as pd

P = Path(sys.argv[1])
df = pd.read_parquet(P / "requests_4dept.parquet")
d = df[(df.file_year == 2024) & (df.department == "ISD")]
t = (d.groupby("reason")
       .agg(requests=("case_enquiry_id", "size"),
            target_days_median=("sla_days", "median"),
            late_share=("on_time", lambda s: (s == "OVERDUE").mean()),
            close_days_median=("close_days", "median"),
            close_days_p90=("close_days", lambda s: s.quantile(0.9)))
       .query("requests >= 100")
       .sort_values("requests", ascending=False))
t["late_requests"] = (t.requests * t.late_share).round().astype(int)
t["share_of_all_isd_late"] = t.late_requests / (d.on_time == "OVERDUE").sum()
t.round(2).to_csv(P / "isd_by_reason.csv")
pd.set_option("display.width", 200)
print(t.round(2).to_string())
print(f"\nISD 2024: {len(d):,} requests, {(d.on_time == 'OVERDUE').mean():.1%} late")
