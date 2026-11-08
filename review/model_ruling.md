# Model ruling: crew planning under forecast uncertainty

Reviewer: senior OR review, 2026-11-02. Inputs read: `src/sim.py`, `src/optimize.py`,
`review/full_plan_v1.log`, `review/forecast_backtest_winner.txt`, plus three small
experiments run against the simulator (numbers quoted below are from those runs).

## 1. Optimization under uncertainty: expected cost over a 3-node scenario fan

**Ruling: minimize expected cost over three uniform-year demand multipliers, not a
single percentile.** The backtest tells us the forecast error is a *level* error, not
month-to-month noise: for the two fragile departments the annual error is as large as the
monthly MAPE (BTDT 7.3% MAPE vs 7.5% annual; PWDx 10.8% vs 8.7%). Independent monthly
noise would average down to a much smaller annual error, so the dominant risk is "the
whole year runs x% hot", which is exactly what compounds in a queue. Uniform-year
multipliers are therefore the right scenario shape; monthly-shape risk is already covered
by the shock scenarios (snowstorm, heat wave) and stays an evaluation, not an
optimization input. Calibrate one pooled level sigma from the four annual errors
(RMS of 8.7, 7.5, 6.4, 2.7 = 6.7%; inflate to **8%** for n=4) and use 3-point
Gauss-Hermite nodes: multipliers **0.86 / 1.00 / 1.14** with weights **1/6, 2/3, 1/6**.
That is three simulations per objective evaluation, and the prototype on BTDT converged in
23-83 s per mode. Do not "plan to P90" as the base method: the expected-cost objective
already buys the buffer because the loss is one-sided (over-staffing costs ~$9k/crew-month,
under-staffing collapses on-time to 17%); in the BTDT prototype the expected-cost plan
(18,24,25,...,26 crews) holds 0.99 on-time at +10% for $2.79M vs the v1 plan's $2.50M base
cost that collapses to 0.17 at +10%. Percentiles come back in as the *modes* (section 2).

## 2. Modes: same objective, increasing service floor (chance constraint), not an overdue multiplier

**Ruling: drop the 1x/2x/6x overdue weights.** Under scenarios they are an unexplainable
fudge ("why 6?") and the prototype shows a risk-attitude axis does not separate the modes
either: expected-cost, 0.5E+0.5CVaR and pure-CVaR all produced the same BTDT plan, because
the high node dominates every risk measure. Define the modes as a cost-vs-service
frontier, which a grader recognizes:

| mode | objective | service floor (penalty M = $1M per percentage point of shortfall) | extra sims |
|---|---|---|---|
| passive | E[cost] over the 3 nodes, overdue at face value | none; lateness is just a cost | 3 |
| neutral | same | on-time >= 90% in **every** node (incl. 1.14) | 3 |
| aggressive | same | on-time >= 95% in every node **and** >= 90% at a 1.20 stress node (weight 0 in cost) | 4 |

Report, for each department, a plan x scenario table (0.80, 0.86, 1.00, 1.14, 1.20) with
on-time and total cost, and the "bill" of each mode = E[cost] minus E[cost] of passive.
If two modes coincide for a department (likely for BTDT), say so: it means the service
floor is free there, which is a finding, not a failure.

## 3. Parks: regular 10 -> 15 and no seasonal crews is economically right in kind, wrong in level

**Ruling: not a search weakness; the seasonal result stands, but the level 15 is driven by a
terminal-cost bug (item 5.1).** Verified directly: starting the local search from a
seasonal plan (10 regular + 5 seasonal Apr-Oct) converges to the identical regular-only
plan, and every hand-built seasonal plan is worse (10 regular + 4..7 seasonal: +$95k to
+$212k vs the optimizer's $1.627M). The economics: 57% of Parks requests carry a 365-day
target, so the Apr-Oct peak (2,100-2,700/month vs 750-900 in winter) does not have to be
served in season; a regular crew smooths it across the year at $79 per closure, whereas a
seasonal crew costs 1.3x and only works 7 months. Seasonal crews would only win if short-SLA
Parks work (the 7-10 day items, 32% of volume) were going late in summer, and it is not.
However: annual demand is 18,736 vs 1,512 closures per crew-year, i.e. **12.4 crews at
steady state**; the optimizer carries 15 for Aug-Dec only because the current terminal
cost adds $20 to every open request at year-end (including 365-day items that are not
late), and without that add-on the do-nothing plan (10 crews) is cheaper than the 15-crew
plan ($1.576M vs $1.626M). Expect roughly 12-13 crews from July after the fix. Optional
only: add a swap move (-1 regular from month m onward, +1 seasonal Apr-Oct) so the report
can state the seasonal option was searched explicitly; it will not change the answer.

## 4. Inspectional Services: "process-driven" is correct but incomplete; fix the horizon, not the ISD mechanics

**Ruling: report ISD lateness as not fixable by crew count, with evidence, and correct the
"100% at any staffing" claim.** Evidence from 2024 closures: lateness sits in reasons whose
realized close time exceeds the target regardless of queue (Building: 7-day target, 44%
late, median close 10 days, p90 435 days; Health: 2-day target, 26% late; 1-day targets
73% late) while the volume reasons are fine (Environmental Services, 30-day target, 1%
late; Housing, 120-day, 10% late). A pooled EDF crew model cannot reproduce that, so the
sim's on-time rate for ISD is a *capacity-feasible* rate; present the 2024 by-reason table
beside it and say the remaining 28% is inspection scheduling / legal process, out of scope
for the brief's staffing lever. But "100% at any staffing" is a horizon artifact, not
evidence: 16 crews close 16,128/yr against ~18,600 requests; the shortfall is pushed by EDF
into the 120- and 720-day requests, which come due after 31 Dec and never count. Do-nothing
ISD ends with 2,538 open requests and still shows 0.999. The projected-lateness terminal
cost in item 5.1 fixes this for ISD and Parks together; no ISD-specific mechanics change.
Do not add a type-level "process delay" to the sim: it would be calibrated on the same
year it is validated against and would hide the real message.

## 5. Other flags, most severe first

1. **Terminal backlog valuation is wrong and is the swing factor for Parks and ISD.**
   `backlog_cost = backlog_end * (cost_per_closure + 20)` charges $20 to untargeted
   requests, to targeted requests not yet due (365-day Parks items), and *again* to requests
   already counted in `m_over[11]`. Meanwhile requests that will go late in January 2026
   because of a persistent deficit are charged nothing beyond $20. Replace with a
   net-clearing projection (spec in the checklist).
2. **Year-end truncation hides lateness for long-SLA departments.** Any request due after
   31 Dec can never be overdue, so Parks and ISD look perfect while backlog grows. Same fix.
3. **Plans are open-loop but judged as if no recourse exists.** The +10% collapse and the
   $1.2-6.3M regret assume the department never re-plans. Real operations would re-forecast
   mid-year. Add one cheap test: at 1 July, re-optimize Aug-Dec given the true H1 demand
   of the scenario; report the recovered regret. This both tempers the fragility story and
   shows the value of monitoring demand against forecast (a strong closing recommendation).

Minor, not ranked: training cost is booked in the month the crew becomes active rather
than the month before (annual totals correct, monthly table off by one); the cliff test
`due < t-30` triggers at 31 days, brief says 30+ (use `<=`).

## Do exactly this

1. `sim.py`, in `simulate()` after the day loop: replace the backlog cost with a projected
   clearing cost.
   - `cap_dec` = mean daily capacity over December workdays x 5/7 (per calendar day).
   - `arr_jan` = `arr.monthly_counts()[0] / 31` (January 2025 replay as the January 2026
     arrival-rate proxy).
   - `net = max(cap_dec - arr_jan, 0.05 * cap_dec)`.
   - EDF projection over the remaining queue: `clear_day = end + cumsum(q_t + q_n) / net`
     (array over `due_idx`, queue is already sorted by due day).
   - `proj_late = q_t[(due_idx >= end) & (clear_day > due_idx)].sum()`
   - `proj_cliff = q_t[(due_idx >= end - 30) & (clear_day > due_idx + 30)].sum()`
   - `backlog_cost = backlog_end * cost_per_closure(dept) + 20 * proj_late + 100 * proj_cliff`
   - Add `proj_late` and `proj_cliff` to `totals`; leave `ontime_rate` as the within-2025
     rate but report `proj_late` next to it.
2. `optimize.py`: delete `MODE_WEIGHT`. Add `SIGMA = 0.08`, `NODES = (1 - 3**0.5*SIGMA, 1.0,
   1 + 3**0.5*SIGMA)`, `WEIGHTS = (1/6, 2/3, 1/6)`, `STRESS = 1.20`.
3. `optimize.py`: `optimize(req, dept, fc, mode)` builds the node arrivals once:
   `arrs = [build_arrivals(req, dept, monthly_target=fc*m, seed=1) for m in NODES]`, plus
   `stress = build_arrivals(..., fc*STRESS, ...)` when `mode == "aggressive"`. Pass the
   list into `_search`.
4. `optimize.py`, new `objective(results, mode, stress_result=None)`:
   `E = sum(w * (r.totals["crew_cost"] + r.totals["overdue_cost"] + r.totals["backlog_cost"]))`;
   floors: neutral `min_ontime >= 0.90` over the 3 nodes; aggressive `>= 0.95` over the 3
   nodes and `stress_result.totals["ontime_rate"] >= 0.90`; penalty `1e8 * max(0, floor - rate)`
   per violated floor. Passive has no floor.
5. `_search`: each candidate evaluates `[simulate(a, cand) for a in arrs]` (and the stress
   arrival for aggressive). Keep the moves, starts and acceptance rule as they are. Optional
   Parks swap move: `c[mi:] -= 1; s[3:10] += 1`.
6. `06_full_plan.py`: evaluate every mode's plan on multipliers 0.80, 0.86, 1.00, 1.14, 1.20
   and the two shocks; output the plan x scenario table and the per-mode bill vs passive.
   Keep perfect-foresight regret, and add the 1-July re-plan test (re-run `optimize` on
   months 8-12 with months 1-7 fixed to the chosen plan and the scenario's true demand).
7. Report text: Parks: "seasonal crews searched and dominated because 57% of work has a
   365-day target"; ISD: show the 2024 by-reason lateness table and label the sim rate
   "capacity-feasible on-time"; state the pooled 8% level sigma and where it comes from.
