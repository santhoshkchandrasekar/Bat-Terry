# Day 1 findings (Mon Nov 2)

Data: Boston 311, 2023 + 2024, four departments (558,663 requests).
Status: first pass. Numbers will move as the forecast and simulator improve.

## The data checks out

2024 counts and on-time rates match the brief exactly:

| Dept | Requests 2024 | On time | No target date | Logged by city workers |
|---|---|---|---|---|
| Public Works (PWDx) | 157,610 | 89.7% | 18.6% | 49.6% |
| Transportation (BTDT) | 81,447 | 49.9% | 2.0% | 61.6% |
| Parks (PARK) | 18,736 | 93.2% | 2.2% | 60.3% |
| Inspectional Services (ISD) | 18,624 | 72.4% | 0.4% | 40.3% |

Data trap fixed: raw timestamps mix two formats. Default parsing silently dropped the dates on
29% of Transportation rows and 44% of Public Works rows. We parse as ISO8601 and assert zero failures.

## Every department starts 2025 short

January 2025 crews x capacity x 21 days vs average 2024 monthly demand:
Public Works -4%, Inspectional -13%, Transportation -17%, Parks -19%.

## What 2024's misses cost (the brief's pricing: $20 overdue, +$100 past 30 days)

About $4.4M in total. Transportation is $2.8M of it. Parking Enforcement alone is $2.16M,
almost half the city's overdue cost. South Boston and Dorchester parking in July,
November and December are the single worst cells.

Other top predators by cost: Sidewalk Repair (Make Safe) $420k, Abandoned Vehicles $288k,
Pothole Repair $261k, Street Light Outages $186k.

## First-pass plan (simulated 2025, cost-minimizing "passive" mode)

| Dept | Do nothing: on time / total cost | Plan: on time / total cost | Crews Jan -> Dec |
|---|---|---|---|
| Public Works | 75% / $7.21M | 80% / $7.13M | 50 -> 51 |
| Transportation | 18% / $8.28M | 99% / $2.60M | 18 -> 24 |
| Parks | 100%* / $1.71M | 100% / $1.65M | 10 -> 15 |
| Inspectional | 100%* / $2.68M | 100% / $2.68M | 16 -> 20 |
| **Total** | **$19.9M** | **$14.1M** | |

*Long targets (Parks: 58% of requests have 365-day targets) hide the problem: on-time looks
perfect while 5,000+ requests pile up into 2026. We price year-end backlog as debt
(crew cost to clear it + $20 each). Without that, the optimizer understaffs Parks and ISD.

Headline: adding 6 Transportation crews by March (+$0.6M crew cost) removes ~$6.3M of
overdue and carried-backlog cost, a net saving of ~$5.7M. Transportation is the one department where hiring pays for itself
many times over.

Mode trade-off for Public Works: passive (80% on time) vs neutral (95%) differs by only
~$77k a year. That's a decision a manager should make, not an optimizer.

## Silence: who isn't calling

Share of street-condition problems (potholes, sidewalks, streetlights, barrels) reported by
residents rather than found by city workers, 2024:
Hyde Park 24%, Mission Hill 32%, Greater Mattapan 36%, Dorchester 38% ...
South End 57%, Back Bay 67%, Fenway 67%.

Preliminary: needs per-type breakdown and normalization (population, road miles) before
we call it a predator.

## Model caveats to state in the report

- Under the brief's capacities the simulator does not reproduce 2024 on-time rates (it is
  harsher for PWDx/BTDT, gentler for ISD/PARK). ISD's real 72% looks like process delay,
  not crew capacity: the brief's crew model cannot explain it. Say so.
- Crews close requests earliest-due-first. Real dispatch is not that clean.
- Forecast v1 = 2024 x (1 + half of 2023->2024 growth). Replace with a backtested method.
- Parking enforcement as "crew work" is the weakest fit to the brief's model.

## Next (Tue)

1. Backtest the forecast: predict 2024 from 2022-2023, report error per department.
2. Check Parks seasonal vs regular crew split (first pass kept regulars through winter to
   clear 365-day backlog; verify that's the real optimum).
3. LLM pass to clean and group the 163 request types (feeds the intake assistant).
4. Silence: per-type and normalized.
