"""Stage 5: the silence signal. Which neighborhoods have stopped calling?

For request types that city workers also find on patrol, compare the share reported by
residents (app, call, web) against the citywide share for the same type. A neighborhood
whose residents report far less than the city norm, for the same kind of problem, is one
where problems exist (workers found them) but people are not asking.

Normalization: per type, so a neighborhood is only compared with itself-shaped demand.
Shrinkage: Bayesian, toward the citywide rate, so small cells don't scream.

Usage: python3 -I src/05_silence.py data/processed
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

P = Path(sys.argv[1])
df = pd.read_parquet(P / "requests_4dept.parquet")
d = df[df.file_year == 2024]
d = d[d.neighborhood.notna() & (d.neighborhood.str.strip() != "") & (d.neighborhood != "Boston")]

# Types with a real mix of resident and employee reporting (both >= 15% citywide), min volume
mix = d.groupby("type").agg(n=("case_enquiry_id", "size"), emp=("is_employee", "mean"))
types = mix[(mix.n >= 1500) & (mix.emp.between(0.15, 0.85))].index
print(f"{len(types)} patrol-and-report types used:", list(types)[:12], "...")

x = d[d.type.isin(types)]
city = x.groupby("type").is_employee.agg(lambda s: 1 - s.mean()).rename("city_resident_share")
cell = x.groupby(["neighborhood", "type"]).agg(n=("case_enquiry_id", "size"),
                                                resident=("is_employee", lambda s: (~s).sum())).reset_index()
cell = cell.merge(city, on="type")
K = 40  # pseudo-count toward the citywide rate
cell["resident_share_shrunk"] = (cell.resident + K * cell.city_resident_share) / (cell.n + K)
cell["silence_ratio"] = cell.resident_share_shrunk / cell.city_resident_share  # <1 = quieter than the city

nb = (cell.groupby("neighborhood")
          .apply(lambda g: pd.Series({
              "requests": g.n.sum(),
              "silence_ratio": np.average(g.silence_ratio, weights=g.n),
              "quietest_type": g.sort_values("silence_ratio").iloc[0].type,
              "quietest_ratio": g.silence_ratio.min(),
          }), include_groups=False)
          .sort_values("silence_ratio"))
nb["flag"] = np.where(nb.silence_ratio < 0.8, "QUIET", np.where(nb.silence_ratio > 1.2, "LOUD", ""))
nb.to_csv(P / "silence.csv")
cell.to_csv(P / "silence_cells.csv", index=False)

# The same test on 2023, with the 2024 type list and the same shrinkage, so a predator can say whether
# the quiet held in both years (owner 21:48: predators and echolocation compared for both years)
d3 = df[df.file_year == 2023]
d3 = d3[d3.neighborhood.notna() & (d3.neighborhood.str.strip() != "") & (d3.neighborhood != "Boston") & d3.type.isin(types)]
city3 = d3.groupby("type").is_employee.agg(lambda s: 1 - s.mean()).rename("city_resident_share")
c3 = d3.groupby(["neighborhood", "type"]).agg(n=("case_enquiry_id", "size"), resident=("is_employee", lambda s: (~s).sum())).reset_index()
c3 = c3.merge(city3, on="type")
c3["silence_ratio"] = ((c3.resident + K * c3.city_resident_share) / (c3.n + K)) / c3.city_resident_share
nb3 = (c3.groupby("neighborhood")
          .apply(lambda g: pd.Series({"requests": g.n.sum(), "silence_ratio": np.average(g.silence_ratio, weights=g.n),
                                      "quietest_type": g.sort_values("silence_ratio").iloc[0].type,
                                      "quietest_ratio": g.silence_ratio.min()}), include_groups=False)
          .sort_values("silence_ratio"))
nb3.to_csv(P / "silence_2023.csv")

pd.set_option("display.width", 160)
print("\n== Silence ratio by neighborhood (1.0 = city norm; lower = residents report less for the same problems) ==")
print(nb.round(2).to_string())
print("\n== 2023, same types ==")
print(nb3.round(2).to_string())
