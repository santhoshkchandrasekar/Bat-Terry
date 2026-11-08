"""Stage 4: pick a forecast method honestly.

Backtest: forecast every month of 2024 using only 2022-2023, compare with real 2024.
Then apply the winner to 2023-2024 to forecast 2025.

Methods:
  seasonal_naive   2024 month = 2023 month
  damped_growth    2024 month = 2023 month x (1 + g/2), g = 2022->2023 growth
  seasonal_avg     2024 month = mean(2022, 2023 month) x level adjustment to 2023 total
  holt_winters     additive trend + multiplicative season, fit on 24 months

Usage: python3 -I src/04_forecast_backtest.py <raw_dir> <processed_dir>
"""
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

warnings.filterwarnings("ignore")
RAW, P = Path(sys.argv[1]), Path(sys.argv[2])
DEPTS = ["PWDx", "BTDT", "PARK", "ISD"]

# 2022 monthly counts (only need department + open_dt)
d22 = pd.read_csv(RAW / "311_2022.csv", usecols=["open_dt", "department"], dtype=str)
d22 = d22[d22.department.isin(DEPTS)]
d22["month"] = pd.to_datetime(d22.open_dt, format="ISO8601").dt.to_period("M").astype(str)
m22 = d22.groupby(["department", "month"]).size().rename("requests").reset_index()

md = pd.read_csv(P / "monthly_demand.csv")[["department", "month", "requests"]]
m = pd.concat([m22, md]).sort_values(["department", "month"])
m.to_csv(P / "monthly_demand_2022_2024.csv", index=False)


def series(dept, years):
    s = m[(m.department == dept) & m.month.str[:4].isin(years)].set_index("month").requests
    return s.values.astype(float)


def methods(hist):  # hist = 24 months (two years), returns dict of 12-month forecasts
    y1, y2 = hist[:12], hist[12:]
    g = y2.sum() / y1.sum() - 1
    out = {
        "seasonal_naive": y2.copy(),
        "damped_growth": y2 * (1 + g / 2),
        "seasonal_avg": (y1 + y2) / 2 * (y2.sum() / ((y1 + y2) / 2).sum()),
    }
    try:
        hw = ExponentialSmoothing(hist, trend="add", damped_trend=True, seasonal="mul",
                                  seasonal_periods=12, initialization_method="estimated").fit()
        out["holt_winters"] = np.maximum(hw.forecast(12), 1)
    except Exception as e:  # noqa: BLE001
        out["holt_winters"] = y2.copy()
    return out


def mape(a, f):
    return float(np.mean(np.abs(a - f) / a))


rows, best = [], {}
for dept in DEPTS:
    hist = series(dept, ["2022", "2023"])
    actual = series(dept, ["2024"])
    fc = methods(hist)
    for name, f in fc.items():
        rows.append({"department": dept, "method": name, "mape": mape(actual, f),
                     "annual_err": f.sum() / actual.sum() - 1})
bt = pd.DataFrame(rows)
pd.set_option("display.width", 160)
print("== Backtest: forecast 2024 from 2022-2023, error vs real 2024 ==")
print(bt.pivot(index="method", columns="department", values="mape").round(3).to_string())
print("\nannual total error:")
print(bt.pivot(index="method", columns="department", values="annual_err").round(3).to_string())

# Pick one method for all departments by mean MAPE (simpler to defend than per-dept picks)
winner = bt.groupby("method").mape.mean().idxmin()
print(f"\nwinner by mean MAPE: {winner}")
bt.to_csv(P / "forecast_backtest.csv", index=False)

# Forecast 2025 from 2023-2024 with the winner, plus the backtest MAPE as its error band
fc_rows = []
for dept in DEPTS:
    hist = series(dept, ["2023", "2024"])
    f = methods(hist)[winner]
    err = bt[(bt.department == dept) & (bt.method == winner)].mape.iloc[0]
    for i, v in enumerate(f):
        fc_rows.append({"department": dept, "month": f"2025-{i+1:02d}", "forecast": round(v),
                        "low": round(v * (1 - err)), "high": round(v * (1 + err)), "backtest_mape": round(err, 3)})
fc = pd.DataFrame(fc_rows)
fc.to_csv(P / "forecast_2025.csv", index=False)
print("\n== 2025 forecast (winner) ==")
print(fc.pivot(index="month", columns="department", values="forecast").to_string())
