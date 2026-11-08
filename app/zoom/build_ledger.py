"""Build the 2025 crew plan ledger's data from the notebook's outputs (section 4): all four plans, with the recommended neutral plan at the top level.

    python3 -I app/zoom/build_ledger.py        writes app/zoom/plan2025.js (window.TerryPlan2025)

Sources: data/processed/plan_monthly.csv (crews, hires, releases, seasonal by month for each plan), plan_expected.csv (cost and on-time
averaged over demand 14% under, on and 14% over forecast), plan_scenarios.csv (on-time at +20% demand, and on-time and cost at -20%). Nothing is computed here that
the notebook did not already compute, except the city totals: costs are summed and on-time rates are weighted by each department's demand.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "data" / "processed"
PLAN = "neutral"   # notebook section 4 recommends the neutral plan (at least 90% on time at every planning level)
DEPTS = [("PWDx", "Public Works"), ("BTDT", "Transportation"), ("PARK", "Parks"), ("ISD", "Inspectional Services")]

PLANS = ["do_nothing", "passive", "neutral", "aggressive"]   # the notebook's four plans, in the order of the ledger's index tabs
LABELS = {"do_nothing": "Do nothing", "passive": "Passive", "neutral": "Neutral", "aggressive": "Aggressive"}
MONTHLY = list(csv.DictReader(open(P / "plan_monthly.csv")))
EXP = list(csv.DictReader(open(P / "plan_expected.csv")))
SCN = list(csv.DictReader(open(P / "plan_scenarios.csv")))


def one(plan):
    """One plan's ledger: crews, hires, releases and seasonal by month, expected cost and on time, on time at +20% demand."""
    rows = [r for r in MONTHLY if r["plan"] == plan]
    exp = {r["dept"]: r for r in EXP if r["plan"] == plan}
    hot = {r["dept"]: r for r in SCN if r["plan"] == plan and r["scenario"] == "x1.20"}
    cold = {r["dept"]: r for r in SCN if r["plan"] == plan and r["scenario"] == "x0.80"}   # a quieter year: payroll stays, crews sit partly idle
    o = {"depts": []}
    tot_cost = tot_dem = on_w = hot_w = cold_w = cold_cost = pay = 0.0
    for d, name in DEPTS:
        m = sorted((r for r in rows if r["dept"] == d), key=lambda r: r["month"])
        assert len(m) == 12, (plan, d)
        dem = sum(float(r["demand"]) for r in m)
        e, h, c = exp[d], hot[d], cold[d]
        o["depts"].append({"dept": d, "name": name, "crews": [int(float(r["crews"])) for r in m], "seasonal": [int(float(r["seasonal"])) for r in m],
                           "hire": [int(float(r["hire"])) for r in m], "release": [int(float(r["release"])) for r in m],
                           "cost": round(float(e["total_cost"])), "payroll": round(float(e["crew_cost"])), "ontime": round(float(e["ontime_rate"]), 4),
                           "ontime_hot20": round(float(h["ontime_rate"]), 4), "ontime_cold20": round(float(c["ontime_rate"]), 4),
                           "cost_cold20": round(float(c["total_cost"])), "demand": round(dem)})
        tot_cost += float(e["total_cost"]); tot_dem += dem; on_w += float(e["ontime_rate"]) * dem; hot_w += float(h["ontime_rate"]) * dem
        cold_w += float(c["ontime_rate"]) * dem; cold_cost += float(c["total_cost"]); pay += float(e["crew_cost"])
    o["city"] = {"cost": round(tot_cost), "ontime": round(on_w / tot_dem, 4), "ontime_hot20": round(hot_w / tot_dem, 4),
                 "ontime_cold20": round(cold_w / tot_dem, 4), "cost_cold20": round(cold_cost), "payroll": round(pay)}
    return o


plans = {k: one(k) for k in PLANS}
# the top level stays the recommended plan (budget.js, roost.js and Ping read it); "plans" holds all four for the ledger's switch
out = {"plan": PLAN, "source": "notebook section 4 (data/processed/plan_monthly.csv, plan_expected.csv, plan_scenarios.csv)", "depts": plans[PLAN]["depts"],
       "recommended": PLAN, "order": PLANS, "labels": LABELS, "plans": plans}
# the insurance: what the notebook's aggressive plan costs in payroll over this one, and where it lands at +20% demand
sc = SCN
pay = lambda pl: sum(float(r["crew_cost"]) for r in sc if r["plan"] == pl and r["scenario"] == "x1.00")
out["insure"] = {"plan": "aggressive", "extra_payroll": round(pay("aggressive") - pay(PLAN)),
                 "ontime_hot20": {r["dept"]: round(float(r["ontime_rate"]), 4) for r in sc if r["plan"] == "aggressive" and r["scenario"] == "x1.20"}}
out["city"] = plans[PLAN]["city"]
js = "/* Built by app/zoom/build_ledger.py from the notebook's outputs. Do not edit by hand. */\nwindow.TerryPlan2025 = " + json.dumps(out, separators=(",", ":")) + ";\n"
(Path(__file__).resolve().parent / "plan2025.js").write_text(js)
for k in PLANS:
    print(k, json.dumps(plans[k]["city"]))
