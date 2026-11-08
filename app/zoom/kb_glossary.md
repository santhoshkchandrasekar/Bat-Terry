# Glossary

Each section below becomes one knowledge chunk for Ping Terry. Facts come from the engine (app/live/engine.js), the timeline levels (app/zoom/levels.js), the stream (app/zoom/stream.js) and the notebook (notebooks/build_notebook.py).

## Crews needed

Aliases: crews needed, how many crews, required crews, staffing level, capacity per crew, gap, spare crews, short of crews

Crews needed is how many crews a department needs in a month to close everything that arrives. The formula is the month's forecast requests divided by what one crew closes in a month. What one crew closes in a month is the daily capacity from the brief times 21 working days. The brief's daily capacity per crew is 12 requests for Public Works, 15 for Transportation, 6 for Parks and 4 for Inspectional Services, so one crew closes 252, 315, 126 and 84 a month. Crews planned minus crews needed is the gap. When planned is below needed the month is short, or behind but not late for the departments with long due dates. January's crews are fixed at 50 for Public Works, 18 for Transportation, 10 for Parks and 16 for Inspectional Services. On the timeline the bars are crews planned and the black line is crews needed. Crews needed is a monthly average, so a single spike day such as move-in weekend can still make requests late in a month where planned crews are at or above needed.

## Sign by M-2, train in M-1

Aliases: sign by, signing date, signing deadline, hiring lag, training month, lead time, notice, release cost, when to hire, decide by

A crew change that takes effect in month M must be signed by the last day of month M minus 2. The crew then spends month M minus 1 in hiring and training, and the city pays them for that training month, and they work from month M. So crews who should work from February are signed by 31 December of the year before, crews for March by 31 January, and crews for December by 31 October. Nothing can change in January, because January's crews are already set. If you decide on a day in a given month, the earliest month the new crews can work is two months later. Releasing a crew needs the same one month of notice, and it costs a quarter of a crew's annual cost, which is three months of pay. This is why the plan is a calendar of dated decisions, each made two months ahead of the month it takes effect.

## Dusk

Aliases: dusk, last day to act, deadline, too late to hire, last signing day

Dusk is the last day you can still sign a crew so that it is working by the first month of the goal window. It is the sign by date for that month: the last day of the month two months before. After Dusk, a new crew can no longer work in time, so waiting past it means the goal's window will be served by the crews already on the plan. For a goal that starts in January there is no Dusk to act on, because January's crews are already set. For a goal that starts in February, Dusk is 31 December of the year before. On the timeline, Dusk is drawn as a dashed amber line at the end of the signing month, with a small label, and each hire has its own Dusk. Terry's flyway always tells you to sign by Dusk. Ping Terry can tell you the Dusk of a hire by asking about that department's decision.

## Flyway

Aliases: flyway, escape plan, escape, why february, runner-up, start month, no exit, unreachable

The flyway is Terry's escape plan for one goal: the cheapest change to the 2025 crew plan that lifts the goal's department to the goal in its window. Terry tries every start month from February (a crew signed now needs January to train) and crew counts up to 80% more than the department starts with (at least 6), keeps crews to December or lets them go after the window, and for Parks also tries seasonal crews. The cheapest by total cost wins: payroll plus the brief's overdue costs plus the backlog carried into 2026. One crew from February wins often because it is the smallest step, and an early start keeps the backlog from building. The flyway says why its start month won by naming the latest start that also works and what it costs more. When a storm or heat wave among the predators can be sized by a real past event and lands in or just before the window, the flyway is built to fly through it. When no crew plan reaches the goal for a department, the flyway changes nothing there and says how close the most crews Terry tests get; for a city goal, the other departments still get their moves. A city goal holds only when every department holds, so its bars compare the weakest department with the goal. It comes with a bill: the payroll it adds and the overdue cost it avoids.

## Crews or process

Aliases: crews or process, process fix, best months, crews alone, more crews won't fix it, kept up

A confirmed predator can be a crew problem or a process problem, and the data tells them apart. Terry looks at the predator's request type in its department's three best months of 2024, the months with the lowest late share, when the department was keeping up best. If the type still closed under the goal's on-time rate then, more crews are unlikely to lift it on their own: the likely cause is in how that work is handled, such as short due dates, contractors or inspections, which the crew model does not change. The card says Crews alone are unlikely to fix it, with the number of requests behind the figure. A confirmed predator already runs later than its department, so it often stays under the goal in the best months too: the test is a second look, not independent proof, and it gets stricter as the goal rises (at 100%, almost everything reads as a process problem). If the type kept up when its department did, the flyway's crews cover it. When even the whole department stayed under the goal in its three best months, as Transportation did in 2024 (about 70% on time across February to April), the card says the lateness runs through the department, so the record cannot show that crews alone reach the goal, even though the crew model says they would. The same test on 2023's best months is shown beside it, and the card says when the two years disagree. For example, Public Works' Sidewalk Repair closed under 20% on time even in the department's best months of 2024, while Parks' New Tree Requests kept up.

## Predators

Aliases: predator, predators, threat, flip, flipped goal, hypothesis, silence, failure

A predator is a specific, testable way a goal could fail. Terry starts by flipping the goal into the year it went wrong, for example I failed to close every Transportation request on time. It then proposes 5 to 7 predators, most likely first. A predator names the real things that would cause the failure: a department, a request type such as Parking Enforcement, a neighborhood, the months involved, or an outside shock such as a snowstorm or a surge of requests. Terry must use the city's real request types and neighborhoods, so a made up name is dropped. Some predators are about silence: a neighborhood that reports less than the rest of the city for the same kinds of problems, which hides real demand. Every predator is then tested against two years of real 311 records. The test is called echolocation, and its answer is the predator's verdict.

## Predator verdicts

Aliases: verdict, verdicts, confirmed, rejected, untestable, evidence, thresholds

Every predator gets one of three verdicts from echolocation. CONFIRMED means 2024 data backs it. For a request type in a place and months, it is confirmed when at least 20 requests closed late and the late rate is more than 10 points above the department's, or when the late cost is at least $5,000 and the late rate is at least 2 points above the department's. For a silence predator, it is confirmed when the neighborhood reports at less than 0.85 times the city rate. REJECTED means the data does not back it, for one of four reasons the card names: no later than the department; only a little later (under 10 points above, and under $5,000 of late cost); far later but too small to count (under 20 late and under $5,000, so it cannot move the department's rate); or no 2024 request matches the named cell. REJECTED predators are shown, not hidden, because they show where Terry's idea met the data and lost. UNTESTABLE means history cannot test it. Weather and event spikes are tested in the simulator instead, using real spikes from past years as the size.

## Both years

Aliases: 2023, two years, both years, held in both years, new in 2024, one-off, lasting, second year

Every predator is tested twice with the same rule: on 2024, which gives the verdict the plan uses, and again on 2023 against the department's 2023 late rate (or, for a silence predator, the 2023 report rate with the same problem types). The card then says Late in 2023 and 2024 or Quiet in 2023 and 2024 when it held in both years, Late in 2024 only when 2023 was fine, Late in 2023, recovered in 2024 when it has already eased, and Not late in either year when neither year backs it. A predator that held in both years is a lasting pattern rather than a one-year blip. Whether crews or a process fix answers it is a separate test (Crews or process). The map's Echolocation layer can also be read for 2023.

## Behind but not late

Aliases: behind, long due dates, hatched ochre, backlog carried, grace, parks, inspectional services

Behind but not late is a state for Parks and Inspectional Services. Most of their requests have long target dates, so a month with fewer crews than needed does not make requests late. For example most Parks requests have a 365 day target. The unfinished work waits in the backlog and is carried forward. A month is short when crews planned are below crews needed and on time stays at or above 90 percent for a department with ordinary due dates. For Parks and Inspectional Services the same month is called behind, not late, and it is drawn hatched ochre. A month is late when the on-time rate for that month is under 90 percent. This is why Parks stays near 100 percent on time almost whatever it staffs, and why the plan prices the backlog left at year end: falling behind shows up as work carried into the next year.

## Overdue and the 30 day cliff

Aliases: overdue, late, cliff, 30 day cliff, penalty, fees, trust cost, backlog cost, $20, $100

A request is overdue when it is closed after its target date, or when it is still open and past its target date at year end. The brief prices each overdue request at $20. A request that stays open more than 30 days past its target date falls off the 30 day cliff and costs an extra $100 on top. Overdue and backlog costs are the brief's price for repeat calls, rework and lost resident trust, so the page calls them trust cost. Payroll is different: it is cash. Requests still open on 31 December are also charged, with the crew cost to close them and the overdue fees they are projected to incur in early 2026, so a plan cannot look good by pushing work into the next year. Requests with no target date use crew capacity but never count as late. In Public Works that is 19 percent of requests.

## Forecast method and backtest

Aliases: forecast, forecasting, prediction, predict, demand forecast, backtest, accuracy, error, seasonal average, holt winters, method

Terry forecasts each month's requests for 2025 with a seasonal average. For each month it takes the same month in 2023 and in 2024, averages them, and scales the result to 2024's yearly level. The method was chosen by a backtest. Four methods forecast every month of 2024 using only 2022 and 2023: seasonal naive, damped growth, a seasonal average re-leveled to the latest year, and Holt-Winters. The seasonal average had the lowest mean monthly error across the four departments, about 10.0 percent, against 13.1 percent for seasonal naive, 14.1 percent for Holt-Winters and 15.4 percent for damped growth. The same method then forecasts 2025 from 2023 and 2024. The backtest error is the uncertainty the plan must survive, about 6.7 percent on yearly totals, which is why plans are tested at demand 14 percent under and over the forecast. A plan built on the point forecast alone broke at 5 percent more demand.

## A busier or quieter year

Aliases: 20 percent, 20%, plus 20, minus 20, busier year, quieter year, demand higher, demand lower, sensitivity, stress test, idle crews, overstaffed, insurance, what if demand drops

In a year 20 percent busier than forecast, the recommended neutral plan falls to 51.5 percent on time across the city, because Public Works drops to 58 percent and Transportation to 17 percent while Inspectional Services and Parks hold. In a year 20 percent quieter it is 99.8 percent on time and still costs $15.09M, because $15.08M of that is payroll that does not shrink with demand, so crews sit partly idle. The brief asks for both directions, and the ledger shows them for every plan. Over the planning range, demand 14 percent under to 14 percent over forecast, the neutral plan is 98.0 percent on time at an expected $15.62M. The aggressive plan is the insurance against a busy year: $679k more payroll, and 92.1 percent on time at plus 20 percent. The two directions are not symmetric: too few crews costs on-time and late fees fast, too many costs only payroll, and releasing a crew mid-year costs a quarter of a year's pay. The notebook's answer for Public Works and Transportation is to watch demand against forecast every month and, if the first half of the year runs 20 percent hot, re-plan on 1 July.

## City workers and residents

Aliases: city workers, employees, employee generated, residents, who reports, source, patrol, constituent, 53 percent

City workers logged 53 percent of the four departments' 2024 requests: 50 percent in Public Works, 62 percent in Transportation, 60 percent in Parks and 40 percent in Inspectional Services. Workers log what they find on patrol, and it closes fast; a resident's request waits in the queue. Residents' requests took longer to close in three of the four departments: a median of 1.6 days against 0.9 in Transportation, 3.2 against 2.2 in Inspectional Services and 0.5 against 0.1 in Public Works; in Parks residents' requests closed faster, 1.9 days against 2.8. They ran late about as often as workers' in Public Works (10 percent each) and Transportation (50 percent each), and more often in Parks (10 against 5 percent) and Inspectional Services (29 against 25 percent). The plan staffs for both, since crews close both. Echolocation shows the second effect: where residents report less of the problems crews find, the answer is outreach, not crews.

## The brief's simulator rules

Aliases: simulator, simulation, brief, rules, replay, capacity, assumptions, seasonal crews, release, hiring lag, earliest due first

The simulator replays 2024's real requests into 2025, keeping each request's real target date offset, and rescales them to the forecast. Crews work Monday to Friday and close the requests that are due earliest first, up to their daily capacity, which is 21 days' worth a month. The rules from the brief are: hiring takes one month and the crew is paid while training, a release needs one month of notice and costs 25 percent of a crew's annual cost, Parks may add seasonal crews that cost 1.3 times a regular crew and have no hiring lag, every overdue request costs $20 and $100 more past 30 days, and there is no backlog on 1 January. A full year runs in about 15 milliseconds, so the optimizer and Terry can try thousands of plans. The on-time rate it reports is what crew capacity allows, not a forecast of the city's measured rate.

## Terrytory

Aliases: terrytory, right sidebar, residents, intake, alerts, resident stream, surge, warning, messages

Terrytory is the right sidebar, the resident side of the page. It holds three things. The intake assistant routes a resident's plain words to the city's real request types and departments, using retrieval over the request type catalog. The resident message stream replays real held-out messages and watches for a surge: a department gets a warning when it has at least 6 messages, they run at least 10 percent above its usual share, and the jump is unlikely by chance, a Poisson z score of 2 or more. Alerts let you paste a weather warning or a move-in note, and Terry turns it into an event sized by a real past spike in 2022 to 2024, never by guesswork. The event is then run through the plan to show what it does to on-time rates.

## Echolocation

Aliases: echolocation, echo, equity map, map, neighborhoods, who calls, who waits, testing predators

Echolocation has two meanings on the page. As the method, it is how Terry tests a predator against real 2024 records with plain data code and no language model, and it returns CONFIRMED, REJECTED or UNTESTABLE with an evidence line. The model proposes, the data decides. As a section of the page, Echolocation is the equity map under The Flip Side: Boston drawn in hexagons, mapped by who calls 311 and who waits. A full hex calls more than the city for the same problems, a hollow one calls less, and the tint shows how often its requests run late against the city rate for the same request types. Ping Terry can light the neighborhoods it talks about on this map.

## Roost

Aliases: roost, roosts, left sidebar, compare plans, saved plans, history, cards, Roost 1, Roost 2

ROOST is the left sidebar: the stack of plans Terry brought back, one card for each. Each chase of a goal makes a new numbered plan, Roost 1, Roost 2 and Roost 3, and Terry keeps at most three. You can open any Roost again, tick two cards and press compare to see two plans together, one drawn solid and the other as outlines, and you can go back to the state of any earlier card. Pings from the dock are logged there too.

## The Flip Side

Aliases: the flip side, flip side, plan section, flip, failure card, predators heard, verdict, bill, active roost

The Flip Side is the plan section under the projector. It shows the active Roost: your goal flipped into the year it failed, the evidence card with the 2024 figure, the predators Terry heard with their verdicts, the flyway with its dated steps, the verdict and Terry's bill. Before any chase it shows the 2025 crew plan, crews by department for each month with the hires marked. The tabs at the top switch between Roosts.

## The intake assistant

Aliases: intake assistant, resident message, request type, retrieval, 311 front door, report a problem

The intake assistant is Terry's 311 front door. It takes a resident's plain message, rewrites it, retrieves candidate request types with BM25 and reciprocal rank fusion over the catalog, and chooses one with a structured answer. It asks a follow-up question when the message is too vague. On 200 held-out messages it picked the right request type 89.0 percent of the time and the right department 98.8 percent of the time on routable messages. A message about an emergency, such as a fire, a gas smell, a downed live wire or someone hurt, gets no ticket: call 911.

## BUDGETerry

Aliases: BUDGETerry, budget, battery, how much does the plan cost, cost of the plan, spend, spending, how much is left, money left, remaining budget, what does the flyway cost, flyway cost, insurance

BUDGETerry is the year's crew budget, drained month by month. It is the battery resting on the projector machine under the screen. Full charge is the recommended plan's expected 2025 spend from the notebook's section 4: payroll plus the expected overdue and backlog costs, split into the four departments' shares, one band each behind the glass. As the projector plays, each band drains with that department's monthly payroll and that month's overdue costs at the brief's rates, $20 for a late request and $100 for one past 30 days, from the engine's simulator for the plan on the screen. A city or department year shows the whole year; a month shows the spend through that month. The figure etched on the right is the share and the dollars left. A thin red line is the late penalties spent. A Roost's Flyway adds a pulsing segment on its department's band for the crews it adds, and a cell with what it changes in the year, crews and late costs. Compare shows two batteries, A and B. The insurance plan's extra payroll is the cost of the 20% extra crews. Ping Terry answers how much the plan costs, how much is left and what a flyway costs from the same numbers.

## Record versus model

Aliases: why does the flip differ, why does the flip say it cannot fail, last year missed it, 2024 was lower, 2023 and 2024, the record and the model disagree, why is the model higher, why is the model lower, is the flip wrong, best case

The flip card puts two different things side by side. The record is what really happened: the share of a department's requests closed on time in the same months of 2023 and 2024, with the crews Boston actually had. The model is what Terry's simulator says this 2025 plan reaches, with the plan's crews, following the brief's rules: a fixed number of requests one crew closes in a month, weekdays only, earliest due first. The two can disagree for three reasons. First, the plan's crews are not last year's crews. Second, the brief's capacities are planning assumptions, not measurements, so the model does not reproduce 2024's real on-time rates. Third, the model is gentler than reality on Inspectional Services and Parks, because their long due dates mean few requests go late in the model, and harsher on Public Works and Transportation. So a card that says the plan cannot fail while 2024 missed the goal is the plan's best case on paper, and the record shows how real work can fall short. Comparisons between plans are the reliable part; absolute on-time rates are model outputs.
