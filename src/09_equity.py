"""Stage 9: the equity map, two sides of the coin.

Silence: a neighborhood's resident reporting share against the citywide share for the same patrol-and-report request types
(the src/05_silence.py method, Bayesian shrink K=40). Below 1 = quieter than the city.
Waiting, type adjusted: among resident requests with a target date, the observed overdue rate divided by the overdue rate
expected from the citywide rates of the same request types. Above 1 = slower than expected for its mix. The raw late rate is
never written here: it mixes the request types (it made South Boston look slow).

Both are the definitions of app/zoom/redesign/loop_test_draft.py, which the lead verified. 2024, neighborhoods with at least 1000
patrol-and-report requests. Hexes use the grid of src/08_map_data.py; a hex is shrunk toward 1 by its own size (K=40 pseudo
requests at the city rate) so small hexes do not scream, and hexes with too few requests are dropped.

There is no street text in the processed data (requests_4dept.parquet has latitude, longitude and neighborhood; data/raw is
empty), so no street lookup is derived. Places the page can recognise are the neighborhood names and their parts.

Writes data/processed/equity.json and app/zoom/equity.js (the same data as a script, as kb.js is, so the page needs no new fetch).
Usage: python3 -I src/09_equity.py data/processed
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

P = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parents[1]
K = 40
MIN_NB = 1000          # patrol-and-report requests in 2024 for a neighborhood to be shown
MIN_HEX = 60           # requests of any kind in 2024 for a hex to be drawn
MIN_CELL = 30          # resident requests for a neighborhood x type wait
BAND = 0.05            # within 5% of 1 is "about the city norm" for both sides (the notebook, section 8.1); only clear cases are quiet or slow


def side(v, lo, hi):
    return lo if v < 1 - BAND else hi if v > 1 + BAND else "norm"

df = pd.read_parquet(P / "requests_4dept.parquet")
df = df[df.neighborhood.notna() & (df.neighborhood.str.strip() != "") & (df.neighborhood != "Boston")].copy()
df["late"] = (df.on_time == "OVERDUE").astype(float)
df.loc[df.on_time.isna() | df.sla_target_dt.isna(), "late"] = np.nan
d23, d24 = df[df.file_year == 2023], df[df.file_year == 2024].copy()

mix = d24.groupby("type").agg(n=("case_enquiry_id", "size"), emp=("is_employee", "mean"))
TYPES = mix[(mix.n >= 1500) & (mix.emp.between(.15, .85))].index


def silence_cells(d, key):
    x = d[d.type.isin(TYPES)]
    city = x.groupby("type").is_employee.agg(lambda s: 1 - s.mean()).rename("c")
    cell = x.groupby([key, "type"]).agg(n=("case_enquiry_id", "size"), r=("is_employee", lambda s: (~s).sum())).reset_index().merge(city, on="type")
    cell["s"] = ((cell.r + K * cell.c) / (cell.n + K)) / cell.c
    return cell


def silence(d, key):
    cell = silence_cells(d, key)
    nb = cell.groupby(key).apply(lambda g: pd.Series({"n": g.n.sum(), "sil": np.average(g.s, weights=g.n),
                                                      "quietest_type": g.sort_values("s").iloc[0].type}), include_groups=False)
    return nb, cell


def resident(d):
    x = d[~d.is_employee & d.late.notna()].copy()
    x["exp"] = x.type.map(x.groupby("type").late.mean())
    return x


def wait(x, key):
    g = x.groupby(key).agg(obs=("late", "mean"), exp=("exp", "mean"), m=("late", "size"), lsum=("late", "sum"), esum=("exp", "sum"))
    g["wait"] = g.obs / g.exp
    g["wait_shrunk"] = (g.lsum + K * g.exp) / (g.m + K) / g.exp       # for hexes and cells: pull small groups toward 1
    return g


s24, c24 = silence(d24, "neighborhood")
s23, _ = silence(d23, "neighborhood")
r24, r23 = resident(d24), resident(d23)
w24, w23 = wait(r24, "neighborhood"), wait(r23, "neighborhood")

# the slowest type of each neighborhood, for its mix: neighborhood x type wait, shrunk, among types with enough resident requests
cw = wait(r24, ["neighborhood", "type"]).reset_index()
cw = cw[cw.m >= MIN_CELL]
slowest = cw.sort_values("wait_shrunk", ascending=False).groupby("neighborhood").head(1).set_index("neighborhood")

t = pd.DataFrame({"silence": s24.sil, "n": s24.n, "wait": w24.wait, "m": w24.m, "sil23": s23.sil, "w23": w23.wait}).dropna()
t = t[t.n >= MIN_NB]
rho, p = spearmanr(t.silence, t.wait)
rs, _ = spearmanr(t.sil23, t.silence)
rw, _ = spearmanr(t.w23, t.wait)
t["dsil"] = t.silence - t.sil23
rl, pl = spearmanr(t.w23, t.dsil)


def short(name, names):
    if len(name) <= 20 or " / " not in name:
        return name
    parts = name.split(" / ")
    return parts[-1] if parts[0] in names else parts[0]


names = set(t.index)
nbs = []
for nb, r in t.sort_values("wait", ascending=False).iterrows():
    sl = slowest.loc[nb]
    nbs.append({"name": nb, "short": short(nb, names), "silence": round(r.silence, 3), "wait": round(r.wait, 3), "n": int(r.n), "m": int(r.m),
                "quietest_type": s24.loc[nb, "quietest_type"], "slowest_type": sl.type, "slowest_wait": round(sl.wait_shrunk, 3),
                "calls": side(r.silence, "quiet", "loud"), "waits": side(r.wait, "fast", "slow"),
                "silence_2023": round(r.sil23, 3), "wait_2023": round(r.w23, 3), "calls_2023": side(r.sil23, "quiet", "loud"), "waits_2023": side(r.w23, "fast", "slow"),
                "lon": round(float(d24[d24.neighborhood == nb].longitude.median()), 5), "lat": round(float(d24[d24.neighborhood == nb].latitude.median()), 5)})

# by type, for questions like "which neighborhoods wait longest for pothole repairs": the 16 busiest resident types with a target date
top_types = r24.type.value_counts().head(16).index
by_type = {}
for ty in top_types:
    rows = cw[(cw.type == ty) & cw.neighborhood.isin(names)].sort_values("wait_shrunk", ascending=False)
    city = float(r24[r24.type == ty].late.mean())
    by_type[ty] = {"city_late": round(city, 3), "m": int((r24.type == ty).sum()),
                   "wait": [[nb, round(w, 3), int(m)] for nb, w, m in zip(rows.neighborhood, rows.wait_shrunk, rows.m)]}
sil_type = {}
for ty in TYPES:
    rows = c24[(c24.type == ty) & c24.neighborhood.isin(names) & (c24.n >= MIN_CELL)].sort_values("s")
    sil_type[ty] = [[nb, round(s, 3), int(n)] for nb, s, n in zip(rows.neighborhood, rows.s, rows.n)]

# hexes: the grid of src/08_map_data.py; the same grid for 2023 so the map can switch years (owner 21:48)
LAT0, R = 42.32, 0.25
KX, KY = 111.32 * np.cos(np.radians(LAT0)), 110.57
nb_ix = {nb: i for i, nb in enumerate(n["name"] for n in nbs)}


def hexgrid(src):
    d = src[src.latitude.between(42.22, 42.41) & src.longitude.between(-71.20, -70.98)].copy()
    x = (d.longitude.values + 71.09) * KX
    y = (d.latitude.values - LAT0) * KY
    cx, cz = (np.sqrt(3) / 3 * x - y / 3) / R, (2 / 3 * y) / R
    cy = -cx - cz
    rx, ry, rz = np.round(cx), np.round(cy), np.round(cz)
    dx, dy, dz = np.abs(rx - cx), np.abs(ry - cy), np.abs(rz - cz)
    fx = (dx > dy) & (dx > dz)
    fy = ~fx & (dy > dz)
    rx = np.where(fx, -ry - rz, rx)
    ry = np.where(fy, -rx - rz, ry)
    rz = np.where(~fx & ~fy, -rx - ry, rz)
    d["hex"] = [f"{a},{b}" for a, b in zip(rx.astype(int), rz.astype(int))]
    hn = d.groupby("hex").agg(n=("case_enquiry_id", "size"), nb=("neighborhood", lambda s: s.value_counts().index[0]))
    hs = silence_cells(d, "hex").groupby("hex").apply(lambda g: pd.Series({"sil": np.average(g.s, weights=g.n), "pn": g.n.sum()}), include_groups=False)
    # a hex with few patrol-and-report requests is pulled further toward 1 (cells are already shrunk; this weighs the hex as a whole)
    hs["sil"] = (hs.sil * hs.pn + 1.0 * K) / (hs.pn + K)
    hw = wait(resident(d.assign(exp=np.nan).drop(columns="exp")), "hex")
    H = hn.join(hs, how="left").join(hw[["wait_shrunk", "m"]], how="left")
    H = H[H.n >= MIN_HEX]
    H["sil"] = H.sil.fillna(1.0)
    H["wait_shrunk"] = H.wait_shrunk.fillna(1.0)
    out = []
    for h, r in H.iterrows():
        q, rr = map(int, h.split(","))
        out.append([q, rr, round(float(r.sil), 3), round(float(r.wait_shrunk), 3), int(r.n), nb_ix.get(r.nb, -1)])
    return out, H


hexes, H = hexgrid(d24)
hexes_2023, _ = hexgrid(d23)

by = {n["name"]: n for n in nbs}
quiet = min(nbs, key=lambda n: n["silence"])
slow = max(nbs, key=lambda n: n["wait"])
headline = (f"The quiet places are not the slow ones: {quiet['short']} calls {1 - quiet['silence']:.0%} less than the city yet runs late "
            f"{1 - quiet['wait']:.0%} less often than expected, while {slow['short']} runs late {slow['wait'] - 1:.0%} more often for the same kinds of request.")
named = ["South Boston / South Boston Waterfront", "Mission Hill", "Charlestown", "Jamaica Plain", "Hyde Park", "Greater Mattapan"]
out = {"year": 2024, "k": K, "band": BAND, "min_requests": MIN_NB, "headline": headline,
       "stats": {"rho_2024": round(float(rho), 2), "p_2024": round(float(p), 2), "stable_silence": round(float(rs), 2), "stable_wait": round(float(rw), 2),
                 "loop_rho": round(float(rl), 2), "loop_p": round(float(pl), 2), "neighborhoods": len(nbs)},
       "named": {"quiet_well_served": named[:2], "slowest": named[2:4], "both": named[4:]},
       "grid": {"radius_km": R, "lat0": LAT0, "lon0": -71.09, "kx": round(KX, 4), "ky": KY},
       "neighborhoods": nbs, "hexes": hexes, "hexes_2023": hexes_2023, "hex_cols": ["q", "r", "silence", "wait", "n", "nb"],
       "wait_by_type": by_type, "silence_by_type": sil_type,
       "streets": None, "streets_note": "No street text in the processed data; places are neighborhood names only."}
s = json.dumps(out, separators=(",", ":"))
(P / "equity.json").write_text(s)
(ROOT / "app" / "zoom" / "equity.js").write_text("/* Built by src/09_equity.py from data/processed/requests_4dept.parquet. Do not edit. */\n(function (r) { r.TerryEquity = " + s + "; })(typeof window !== \"undefined\" ? window : globalThis);\nif (typeof module !== \"undefined\") module.exports = (typeof window !== \"undefined\" ? window : globalThis).TerryEquity;\n")

pd.set_option("display.width", 200)
print(f"{len(TYPES)} patrol-and-report types; {len(nbs)} neighborhoods with n >= {MIN_NB}; {len(hexes)} hexes (n >= {MIN_HEX}) covering {int(H.n.sum()):,} requests")
print(f"2024 silence vs wait: rho {rho:+.2f} (p {p:.2f}); stability silence {rs:.2f}, wait {rw:.2f}; 2023 wait -> change in calling rho {rl:+.2f} (p {pl:.2f})")
print("headline:", headline)
print(pd.DataFrame(nbs)[["name", "silence", "wait", "calls", "waits", "n", "quietest_type", "slowest_type", "slowest_wait"]].to_string(index=False))
for g, ns in out["named"].items():
    print(g, [(n, by[n]["silence"], by[n]["wait"]) for n in ns])
print(f"wrote {P / 'equity.json'} and app/zoom/equity.js ({len(s) / 1e3:.0f} kB)")
