# Terry for Boston 311: 2025 crew staffing analysis

*Built from `notebooks/Boston311_Terry.ipynb` (§11). In §2 the paragraph on the 2024 evidence is written by an LLM chain (marked) and checked against model outputs; code places every other figure.*

## 1. Headline

| plan | expected cost ($M) |
|---|---|
| do_nothing | 21.81 |
| passive | 15.21 |
| neutral | 15.62 |
| aggressive | 16.25 |

The neutral plan (at least 90% on time at every planning level, demand 14% under to 14% over forecast) spends $3.16M more on crew payroll than keeping January's crews and avoids $9.35M in overdue and year-end backlog costs, a net $6.19M less. Payroll is cash; overdue and backlog costs are the brief's price for repeat calls, rework and lost resident trust. It costs $410k more than the cheapest plan.

| neutral crews | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Public Works | 50 | 50 | 56 | 60 | 60 | 62 | 66 | 70 | 70 | 70 | 70 | 70 |
| Transportation | 18 | 24 | 24 | 24 | 26 | 26 | 26 | 26 | 26 | 26 | 26 | 26 |
| Parks | 10 | 10 | 10 | 10 | 10 | 12 | 12 | 12 | 12 | 12 | 12 | 12 |
| Inspectional Services | 16 | 16 | 16 | 16 | 18 | 18 | 19 | 19 | 19 | 19 | 19 | 19 |

| on time, neutral plan | x0.80 | x0.86 | x1.00 | x1.14 | x1.20 | snowstorm | heatwave |
|---|---|---|---|---|---|---|---|
| Transportation | 100% | 100% | 100% | 92% | 17% |  |  |
| Inspectional Services | 100% | 100% | 100% | 100% | 100% |  | 100% |
| Parks | 100% | 100% | 100% | 100% | 100% |  | 100% |
| Public Works | 100% | 99% | 98% | 90% | 58% | 98% |  |

**What happens at +20%.** The neutral plan is built for demand from 14% under to 14% over the forecast, the range the
forecast's own backtest error supports. At +20% it breaks in two departments: Transportation falls to 17% on time and
Public Works to 58%, and the year's total cost rises to $20.43M. The aggressive plan is the insurance against that: it
keeps every department at 90% or better even at +20% (Transportation 90%, Public Works 91%), for $0.68M more crew
payroll and $0.63M more expected cost ($16.25M against $15.62M). If demand does come in 20% high, the aggressive plan is
also the cheaper of the two ($18.16M against $20.43M). Choosing between them is a policy call: how much the city wants
to pay up front for cover against a rise its forecast error does not predict.

## 2. Department sections [LLM output, checked]

### Executive summary

The decision that matters most is in Transportation: sign for 6 new crews by December 31, 2024, so they train in January and work from February. That department alone accounts for $4.62M of the net savings. Across the four departments the plan spends $3.16M more on crew payroll than keeping January's crews all year, and avoids $9.35M in overdue and year-end backlog costs: an expected 2025 cost of $15.62M against $21.81M, a net $6.19M less. It costs $410k more than the cheapest plan; that difference buys at least 90% on time at every planning level (demand 14% under to 14% over forecast). Crews grow as follows: Public Works from 50 to 70 crews by Aug, Transportation from 18 to 26 crews by May, Parks from 10 to 12 crews by Jun, and Inspectional Services from 16 to 19 crews by Jul. Two cautions. The on-time rates in this report are what crew capacity allows under the brief's assumptions, not forecasts of the city's measured rates. And most of Inspectional Services' lateness comes from inspection and legal process, which more crews will not fix.

### Public Works

*Terry's flip (the imagined failure, built from 2024 figures):* "On December 31, 2025, I failed to close every Public Works request on time, just as in 2024, when 502 Sidewalk Repair (Make Safe) requests in the South End went late."

In 2024, citywide, Sidewalk Repair (Make Safe) requests closed late came to 3,802, costing $420k. Request for Pothole Repair requests closed late came to 4,052, costing $261k. Street Light Outages requests closed late came to 1,939, costing $186k. In the South End, Sidewalk Repair (Make Safe) requests closed late came to 502, costing $57k. In Dorchester, Sidewalk Repair (Make Safe) requests closed late came to 413, costing $48k.

My plan: hire 6 crews (sign by January 31, working from Mar); hire 4 crews (sign by February 28, working from Apr); hire 2 crews (sign by April 30, working from Jun); hire 4 crews (sign by May 31, working from Jul); hire 4 crews (sign by June 30, working from Aug). That takes us from 50 crews to 70 (Jan-Feb 50, Mar 56, Apr-May 60, Jun 62, Jul 66, Aug-Dec 70). Averaged over demand 14% under, on and 14% over forecast, it costs $8.46M for the year, against $9.68M if I keep January's crews, and the model has it closing 97% of requests on time against 56%. It also cuts the requests still open at year end from about 11,062 to about 0. If demand runs 14% hot it still closes 90% on time; at 20% hot, 58%. On-time falls below 90% once demand is 16% over forecast.

One caution: the brief's capacity of 12 requests per crew per day looks low for Public Works. With January's 50 crews the model closes about 56% on time, while the city actually closed 90% on time in 2024, so treat these crew numbers as an upper bound. What I will watch: demand against forecast every month. If the first half of the year runs 20% hot, re-planning on 1 July lifts on-time for the year from 58% to 90% in our tests.

*Figures placed by code; the LLM paragraph passed both guardrails.*

### Transportation

*Terry's flip (the imagined failure, built from 2024 figures):* "On December 31, 2025, I failed to close every Transportation request in Boston on time, just as in 2024, when 4,302 Parking Enforcement requests in South Boston / South Boston Waterfront went late."

In 2024, citywide, Parking Enforcement requests closed late came to 32,561, costing $2.16M at the brief's rates. Abandoned Vehicles requests closed late amounted to 3,658, with a cost of $288k at the brief's rates. Sign Repair requests closed late were 1,456, costing $109k at the brief's rates. In South Boston / South Boston Waterfront, Parking Enforcement requests closed late were 4,302, costing $290k at the brief's rates. In Dorchester, Parking Enforcement requests closed late came to 3,609, costing $236k at the brief's rates.

My plan: hire 6 crews (sign by December 31, 2024, working from Feb); hire 2 crews (sign by March 31, working from May). That takes us from 18 crews to 26 (Jan 18, Feb-Apr 24, May-Dec 26). Averaged over demand 14% under, on and 14% over forecast, it costs $2.83M for the year, against $7.44M if I keep January's crews, and the model has it closing 99% of requests on time against 20%. It also cuts the requests still open at year end from about 13,799 to about 0. If demand runs 14% hot it still closes 92% on time; at 20% hot, 17%. On-time falls below 90% once demand is 16% over forecast.

One caution: parking enforcement fits a crew model poorly, since most of those requests resolve when the car leaves. What I will watch: demand against forecast every month. If the first half of the year runs 20% hot, re-planning on 1 July lifts on-time for the year from 17% to 56% in our tests.

*Figures placed by code; the LLM paragraph passed both guardrails.*

### Parks

*Terry's flip (the imagined failure, built from 2024 figures):* "On December 31, 2025, I failed to keep up with every Parks request, with 54 Equipment Repair requests in East Boston going late, just as in 2024."

In 2024, citywide, Equipment Repair requests closed late came to 400, costing $22k. New Tree Requests closed late numbered 150, with a cost of $14k. Ground Maintenance requests closed late reached 170, costing $5k. Additionally, Equipment Repair requests closed late in East Boston were 54, costing $3k, and in Dorchester, 54 requests closed late also cost $3k.

My plan: hire 2 crews (sign by April 30, working from Jun). That takes us from 10 crews to 12 (Jan-May 10, Jun-Dec 12). It costs $1.60M for the year against $1.78M if I keep January's crews; the model has on-time near 100% either way. It also cuts the requests still open at year end from about 4,745 to about 2,981. If demand runs 14% hot it still closes 100% on time; at 20% hot, 100%. On-time falls below 90% once demand is 56% over forecast.

Most Parks requests have a 365-day target, so the on-time rate stays near 100% at almost any staffing; falling behind shows up as backlog carried into the next year, which is what this plan prevents. What I will watch: the number of open requests going into the autumn, because that backlog is how Parks falls behind.

*Figures placed by code; the LLM paragraph passed both guardrails.*

### Inspectional Services

*Terry's flip (the imagined failure, built from 2024 figures):* "On December 31, 2025, I failed to close every Inspectional Services request on time, just as in 2024, when 201 Unsatisfactory Living Conditions requests in Dorchester went late."

In 2024, citywide, there were 905 Unsatisfactory Living Conditions requests closed late, costing $94k at the brief's rates. There were 613 Work w/out Permit requests closed late, which cost $39k at the brief's rates. Additionally, 280 Maintenance Complaint - Residential requests closed late, resulting in a cost of $31k at the brief's rates. In Dorchester, 201 Unsatisfactory Living Conditions requests closed late incurred a cost of $21k at the brief's rates. In Roxbury, 126 Unsatisfactory Living Conditions requests closed late cost $13k at the brief's rates.

My plan: hire 2 crews (sign by March 31, working from May); hire 1 crew (sign by May 31, working from Jul). That takes us from 16 crews to 19 (Jan-Apr 16, May-Jun 18, Jul-Dec 19). Averaged over demand 14% under, on and 14% over forecast, it costs $2.73M for the year, against $2.91M if I keep January's crews, and the model has it closing 99.9% of requests on time against 98%. It also cuts the requests still open at year end from about 2,639 to about 1,005. If demand runs 14% hot it still closes 99.9% on time; at 20% hot, 99.9%. On-time falls below 90% once demand is 26% over forecast.

One caution: these on-time rates are what crew capacity allows. Our actual 2024 rate was 72%, and that lateness sits mostly in Housing and Building requests held up by inspection scheduling and legal process, which more crews will not fix. What I will watch: close times for Housing and Building requests, and a process review there, since crews are not the constraint.

*Flagged by the guardrail and not resolved: claim: The statement 'In Roxbury, 126 Unsatisfactory Living Conditions requests closed late cost $13k at the brief's rates' is incorrect because the 126 late requests in Roxbury were specifically for Unsatisfactory Living Conditions, but the cost of $13k is not attributed to that category in FACTS; it should be noted that the cost is not specified for Roxbury in the provided data.*


## 3. Decisions, assumptions and limitations

See §10 of the notebook; summarized: plan for the forecast's known error (expected cost over demand x0.86 / x1.00 / x1.14); modes are service floors; the year-end backlog is priced; every change is a dated decision two months ahead of the month it takes effect. Absolute on-time rates are model outputs under the brief's capacity assumptions; ISD lateness is process-driven; parking enforcement fits a crew model poorly. Of 33 confirmed crew predators, 28 closed under 90% on time even in their department's three best months of 2024, when crews kept up best (2 had too few requests to judge; 2023's best months give the same call for 26 of 31; §6.3). Confirmed predators lean late by construction, so this overstates the share somewhat, but the pattern is clear: much of the lateness Terry hears is in how the work is handled, which this crew plan does not model.
