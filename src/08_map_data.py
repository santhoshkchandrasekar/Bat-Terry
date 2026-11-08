"""Stage 8: map data for the product page.

Hex-bins every located 2024 request in the four departments (~250 m hexagons). Each hex carries
volume, overdue share, dominant department and top request type. Neighborhood centroids carry
the silence ratio and overdue rate. Output: data/processed/map_hex.json, map_neighborhoods.json

Usage: python3 -I src/08_map_data.py data/processed
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

P = Path(sys.argv[1])
df = pd.read_parquet(P / "requests_4dept.parquet")
d = df[(df.file_year == 2024) & df.latitude.between(42.22, 42.41) & df.longitude.between(-71.20, -70.98)].copy()

LAT0 = 42.32
KX = 111.32 * np.cos(np.radians(LAT0))   # km per degree longitude
KY = 110.57                               # km per degree latitude
R = 0.25                                  # hex radius, km (pointy-top)
x = (d.longitude.values + 71.09) * KX
y = (d.latitude.values - LAT0) * KY
q = (np.sqrt(3) / 3 * x - y / 3) / R
r = (2 / 3 * y) / R
# cube rounding
cx, cz = q, r
cy = -cx - cz
rx, ry, rz = np.round(cx), np.round(cy), np.round(cz)
dx, dy, dz = np.abs(rx - cx), np.abs(ry - cy), np.abs(rz - cz)
fix_x = (dx > dy) & (dx > dz)
fix_y = ~fix_x & (dy > dz)
rx = np.where(fix_x, -ry - rz, rx)
ry = np.where(fix_y, -rx - rz, ry)
rz = np.where(~fix_x & ~fix_y, -rx - ry, rz)
d["hq"], d["hr"] = rx.astype(int), rz.astype(int)
d["late"] = d.on_time.eq("OVERDUE")

g = d.groupby(["hq", "hr"])
hexes = g.agg(n=("case_enquiry_id", "size"), late=("late", "mean"),
              resident=("is_employee", lambda s: 1 - s.mean())).reset_index()
hexes["dept"] = g.department.agg(lambda s: s.value_counts().index[0]).values
hexes["top_type"] = g.type.agg(lambda s: s.value_counts().index[0]).values
hexes = hexes[hexes.n >= 15]
# hex centre back to lon/lat
hx = R * (np.sqrt(3) * hexes.hq + np.sqrt(3) / 2 * hexes.hr)
hy = R * (1.5 * hexes.hr)
hexes["lon"] = (hx / KX - 71.09).round(5)
hexes["lat"] = (hy / KY + LAT0).round(5)
out = hexes[["lon", "lat", "n", "late", "resident", "dept", "top_type"]].round({"late": 3, "resident": 3})
json.dump({"radius_km": R, "lat0": LAT0, "hexes": out.to_dict(orient="records")}, open(P / "map_hex.json", "w"))

sil = pd.read_csv(P / "silence.csv").set_index("neighborhood")
nb = d.groupby("neighborhood").agg(lon=("longitude", "median"), lat=("latitude", "median"),
                                    n=("case_enquiry_id", "size"), late=("late", "mean")).reset_index()
nb = nb[nb.n >= 300]
nb["silence_ratio"] = nb.neighborhood.map(sil.silence_ratio).round(3)
nb["quietest_type"] = nb.neighborhood.map(sil.quietest_type)
json.dump(nb.round({"lon": 5, "lat": 5, "late": 3}).to_dict(orient="records"), open(P / "map_neighborhoods.json", "w"))
print(f"{len(out)} hexes covering {out.n.sum():,} requests; {len(nb)} neighborhoods")
print(out.sort_values("n", ascending=False).head(5).to_string(index=False))
