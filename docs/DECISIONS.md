# Design decisions: what we chose, what we didn't, and why

Every major choice in Bat-Terry, with the alternatives we considered and what each choice costs us. Numbers come from the
notebook (`notebooks/Boston311_Terry.ipynb`, section numbers in brackets) and the files in `data/processed/`. For how to
use the site, see [USER_GUIDE.md](USER_GUIDE.md).

Each decision reads the same way: **Chose** (what we did), **Instead of** (what we considered), **Why**, and **Cost** (what
we give up).

---

## Data

### 1. Use 2022 to 2024, not just 2023 and 2024

- **Chose:** three years of the four in-scope departments, cut to monthly counts early (§1).
- **Instead of:** only 2023 and 2024, as the brief suggests.
- **Why:** to test a forecast honestly we need to forecast a year we already know. With 2022 added, we forecast 2024 from
  2022 and 2023 and compare against what really happened (§2). That backtest error then sets how much uncertainty the
  staffing plan must survive (decision 6).
- **Cost:** one more large file to download and process.

### 2. Parse every timestamp as ISO 8601 and assert zero failures

- **Chose:** explicit ISO 8601 parsing, with a check that no date fails (`src/01_load.py`).
- **Instead of:** pandas' default date parsing.
- **Why:** the raw timestamps mix two formats (`…:00` and `…:00.123`). Default parsing guesses the format from the first
  row and silently turns the rest into missing dates, which lost 29% to 44% of the dates in two departments (§1). Every
  on-time and backlog number depends on these dates.
- **Cost:** none worth mentioning.

---

## Forecast

### 3. A seasonal two-year average, chosen by backtest

- **Chose:** for each month, the average of the same month in the last two years, re-leveled to the latest year (§2).
- **Instead of:** seasonal naive (repeat last year), damped growth, and Holt-Winters exponential smoothing.
- **Why:** it had the lowest error forecasting real 2024. Monthly error (MAPE):

  | Department | Seasonal average | Seasonal naive | Damped growth | Holt-Winters |
  |---|---|---|---|---|
  | Public Works | **10.8%** | 13.6% | 23.2% | 28.2% |
  | Transportation | 7.3% | 7.6% | 7.6% | **5.4%** |
  | Parks | **14.0%** | 17.7% | 17.2% | 14.4% |
  | Inspectional Services | **7.8%** | 13.3% | 13.6% | 8.5% |

- **Cost:** Holt-Winters fits Transportation better (5.4% against 7.3%). We kept one method for all four departments
  because it wins on average and in three of four, and because the plan is built to absorb a forecast error of this size
  anyway (decision 6).

### 4. Not a more complex forecaster

- **Chose:** a simple, explainable method.
- **Instead of:** ARIMA, Prophet or a machine-learning model.
- **Why:** each department has only 24 to 36 monthly points, too few for a complex model to beat a seasonal average
  reliably. More importantly, the backtest shows the error is mostly a **whole-year level shift**: the annual error is
  about as large as the monthly error (Transportation 7.5% annual against 7.3% monthly; Public Works 8.7% against 10.8%).
  Random monthly noise would average out over a year; this didn't. No forecaster removes a level shift it can't see
  coming, so we plan for it instead.
- **Cost:** a better model might shave a point or two of monthly error. It would not change the plan's structure.

### 5. Test, but don't adopt, mid-year forecast updates

- **Chose:** a fixed 2025 forecast, plus a tested recommendation on when updating it pays (§4.8).
- **Instead of:** an automatic re-forecast every month.
- **Why:** we re-ran 2024 with updates after 3 and 6 months. Updating helps the large, steady departments (Public Works,
  Transportation) and hurts Parks, whose spring is too erratic to extrapolate. So the advice is department-specific, not
  "always update".
- **Cost:** the page doesn't re-forecast on its own; a manager has to act on the advice.

---

## The planning model

### 6. Plan for the forecast's known error, not for the forecast

- **Chose:** minimize **expected cost over three whole-year demand levels**: demand 14% under (×0.86), on forecast (×1.00)
  and 14% over (×1.14), weighted 1/6, 2/3, 1/6 (§4). The spread comes from the backtest: the four annual errors pooled to
  6.7%, inflated to 8% because there are only four departments, then turned into three points with a standard
  Gauss-Hermite rule.
- **Instead of:** (a) optimizing on the single forecast, or (b) planning to a high percentile such as "staff for P90
  demand".
- **Why:** (a) failed in testing. Our first point-forecast plan broke at +5% demand, and Transportation's on-time rate fell
  from 99% to 17% at +10%. A queue punishes under-staffing far more than over-staffing, so a plan tuned to the exact
  forecast collapses in an ordinary bad year. (b) isn't needed: because the loss is one-sided, minimizing expected cost
  already buys the right buffer, and a percentile rule would add an arbitrary number.
- **Cost:** the plan carries more crews than the forecast alone needs, which costs money in a quiet year. §4.4 prices this
  (the gap to perfect foresight) and shows how much a 1 July re-plan wins back.

### 7. Modes are service floors, not penalty weights

- **Chose:** three modes on the same objective, each a promise a manager can say out loud: **passive** (no floor),
  **neutral** (at least 90% on time at every planning level), **aggressive** (at least 95%, and 90% even at +20% demand).
- **Instead of:** multiplying the overdue cost by 1x, 2x or 6x for each mode, and risk measures such as CVaR.
- **Why:** a multiplier of 6 can't be explained ("why 6?"), and in testing the risk measures all produced the same
  Transportation plan. A service floor is something a city can commit to and check.
- **Cost:** the floors (90%, 95%) are policy choices, not derived numbers. We state them as such.

### 8. A day-by-day simulator, not a capacity formula

- **Chose:** `src/sim.py` replays 2024's real requests into 2025, each with its real target date, scaled to the forecast.
  Crews close the earliest-due requests first, Monday to Friday, up to capacity. It encodes every rule in the brief (§3).
- **Instead of:** "crews needed = requests ÷ (capacity × 21 days)".
- **Why:** the brief's goal is on-time performance, and on-time depends on each request's due date, which a monthly ratio
  can't see. The simulator also carries backlog from month to month and applies the hiring delay, notice and release
  fee exactly. It runs a year in about 15 ms, so the optimizer and Terry can call it thousands of times.
- **Cost:** on-time rates are model outputs under the brief's assumed capacities, not predictions of real-world rates. We
  say so in §10 and compare plans with each other rather than with 2024 reality.

### 9. Charge for the backlog left on 31 December

- **Chose:** requests still open at year-end are charged the crew cost to close them, plus the overdue fees they are
  projected to incur in early 2026 (§3).
- **Instead of:** ignoring what's open at year-end.
- **Why:** without it, any request due after 31 December can never count as late, so departments with long targets look
  perfect while work piles up. 57% of Parks requests have a 365-day target. Before this charge was added, a do-nothing plan for
  Inspectional Services ended 2025 with about 2,500 open requests and still showed nearly 100% on time.
- **Cost:** the year-end charge relies on a projection of early 2026.

### 10. Never release crews after the peak

- **Chose:** plans that hold crews through the slow months (§4.7).
- **Instead of:** releasing crews when demand falls (Parks drops about 70% from June to December).
- **Why:** a release costs 25% of a crew's annual cost, which is three months of pay, plus a month of notice. After the
  summer peak there are never more than three idle months left in 2025, so keeping the crew is cheaper. Tested on Parks,
  the deepest drop: releasing 2 crews from September costs $153,147 more than keeping them.
- **Cost:** some crews sit under-used in late autumn. That's the cheaper option, not a mistake.

### 11. No seasonal crews for Parks, even though the brief offers them

- **Chose:** regular crews only. The search tried seasonal options explicitly (seasonal moves, swapping a regular for a
  seasonal crew, and starting from a seasonal-heavy plan), and none won (§5).
- **Instead of:** seasonal crews from April to October at 1.3x the monthly cost.
- **Why:** most Parks requests have a 365-day target, so the summer peak can be worked off over the winter by regular
  crews at the base cost. Seasonal crews cost 30% more and only work seven months.
- **Cost:** none in this model. They would win if short-target Parks work started going late in summer, which it doesn't
  in the data.

### 12. Don't add crews to fix Inspectional Services' lateness

- **Chose:** report it as a process problem, with the evidence (§5).
- **Instead of:** hiring until the on-time rate improves.
- **Why:** the model says ISD already has the capacity to close nearly everything on time, yet 28% of its 2024 requests
  were late. The lateness concentrates in request reasons with short targets and very long real close times (inspection
  scheduling, legal steps), while its high-volume reasons are almost never late. More crews wouldn't fix that; a process
  review would.
- **Cost:** our plan doesn't move ISD's real-world on-time rate, and we say so rather than promise it.

### 13. Show decisions as dated signatures, not headcounts

- **Chose:** every change appears as a date by which a crew must be signed: a crew who works from month M is signed by the
  last day of month M-2, because month M-1 is paid hiring and training (§10, §6). That's why Transportation's key decision
  is "sign 6 crews by 31 December 2024" (to work from February).
- **Instead of:** a table of crews per month alone.
- **Why:** a manager acts on deadlines. A headcount table hides that the decision for February has to be made in December.
- **Cost:** none. The monthly table is still there (§4.1, §4.2).

---

## The GenAI layer

### 14. The model never supplies a number

- **Chose:** the forecast, simulator and optimizer compute every figure. The language model reads goals, names risks to
  test, routes messages and writes sentences around numbers it's given. A guardrail checks every number the model writes
  against the facts it was shown; a number that isn't there is rewritten once, then removed.
- **Instead of:** letting the model reason about costs and staffing directly, or answer from its own knowledge.
- **Why:** language models produce confident, wrong numbers. In a staffing plan, a wrong number is the worst possible
  error. For the written report (§9) we went further: testing showed the model would sometimes attach a correct figure to
  the wrong place or period, which a number check can't catch, so code now places those figures.
- **Cost:** the model's writing is more constrained, and some sentences are assembled by code rather than written freely.

### 15. Terry's predators are tested against the data

- **Chose:** the model proposes threats ("predators") using only the city's real request types and neighborhoods; each
  one is then confirmed or rejected against 2024 records (§6).
- **Instead of:** trusting the model's list of risks.
- **Why:** "the model proposes, the data decides". In the evaluation (§6.4: 24 flips across 8 goals) no predator named an
  invented request type, which the schema makes impossible, no failure sentence used a number outside the evidence on the
  first try, and the data confirmed 56% of the testable predators.
- **Cost:** some of the model's suggestions are rejected. That's the point.

### 16. The intake assistant chooses only from the city's real request types

- **Chose:** retrieval over 124 real routing targets (types used at least 25 times in 2023 and 2024, covering 99.9% of
  requests), using both embeddings and keyword search (BM25). The model picks one of the retrieved candidates as
  structured output, or asks one follow-up question (§7).
- **Instead of:** asking the model to name a request type freely, or fine-tuning a classifier.
- **Why:** a free answer can name a type that doesn't exist in the city's system. Fine-tuning needs labeled resident
  messages, and the data has none: it has no free text from residents. An LLM wrote one plain-language description per
  type, once, so retrieval matches how residents talk rather than the city's internal labels. A **rewrite** step turns
  Spanish or rambling messages into a short English problem statement before retrieval, and both versions are searched.
- **Cost:** a request type used fewer than 25 times in two years can't be chosen.

### 17. Keep the test sets honest

- **Chose:** three separate sets (§7): a 50-message seed set written by hand (we tuned on it, so its score is
  optimistic); 200 held-out messages generated once by a different model (gpt-4o), which never saw our descriptions,
  frozen before scoring; and a second held-out set for comparing versions.
- **Instead of:** reporting accuracy on the messages we tuned on.
- **Why:** a score on your own tuning set says little. The headline is **82.5%** on messages the assistant had never seen.
  After one fix those misses pointed to (the rewrite step for Spanish), it scored 89.0% on the same set, and we label that
  figure optimistic because it was measured after looking. The final version sends 98.8% of routable messages to the right department.
- **Cost:** a lower headline number than we could have reported. The held-out messages are model-written and were
  reviewed by us, not by 311 staff (§10).

### 18. Ping's page navigation is rules, not the model

- **Chose:** commands such as "open Parks in July" or "compare plans" are matched by text rules. Questions go to the
  model, with tools over the plan, at most 4 tool calls, a hard stop at 6 and a 45-second cap (§6.6).
- **Instead of:** letting the model drive the page.
- **Why:** rules are predictable and can never invent a place or a plan. The model is used where language matters:
  understanding questions and explaining answers.
- **Cost:** rules only recognize the page's own names. Other phrasings get an ordinary answer that points to the words
  that work.

### 19. Everything still works without the model

- **Chose:** a rules fallback for every AI feature: Ping answers from rules over the same tools, the intake routes by
  retrieval alone, and every number on screen comes from the engine either way.
- **Instead of:** a page that depends on the model being available.
- **Why:** models time out, rate limits are hit, keys run out. A city tool can't go blank when that happens, and neither
  can a demo in front of a professor.
- **Cost:** answers without the model are plainer.

---

## Product and architecture

### 20. A static site with one serverless function

- **Chose:** the page is static files on Netlify. The only server code is one function (`/api/llm`) that holds the
  OpenAI key and enforces two daily limits: $3.00 of model spend for the whole site, and 60 model rounds per visitor
  (`deploy/README.md`).
- **Instead of:** a backend server with an API, or calling OpenAI directly from the browser.
- **Why:** calling OpenAI from the browser would expose the key. A full backend would mean hosting and maintaining a server
  for what is mostly a calculation the browser can do. Over a limit, the page simply answers from its rules.
- **Cost:** live AI answers are capped each day, by design.

### 21. The engine runs in the browser

- **Chose:** a JavaScript port of the simulator and plan (`app/live/engine.js`), checked to stay within 0.5% of the Python
  (`app/live/validate.mjs`).
- **Instead of:** asking a server for every number.
- **Why:** a goal, a what-if or a plan comparison answers instantly, needs no server, and costs nothing per use.
- **Cost:** two implementations to keep in step, which is why the validation check exists.

### 22. OpenAI models, chosen per job

- **Chose:** in the notebook, `gpt-4o-mini` runs the intake assistant, the flip and the report; `gpt-4o` generated the
  held-out test messages. On the live page, `gpt-6.1-sol` at low reasoning effort answers Ping and Terry's chase.
- **Instead of:** one model everywhere.
- **Why:** the notebook's evaluations make hundreds of calls, and a small model keeps a full live run under $1. The page
  makes few calls, each a multi-round tool loop, and is capped at $3 a day. The course requires OpenAI, so we use only
  OpenAI models.
- **Cost:** the notebook's live Ping evaluation (§6.6) ran on `gpt-4o-mini`, before the page moved to `gpt-6.1-sol`. The
  README says so.

### 23. One story, not a dashboard

- **Chose:** the page is built around a single idea: name a goal, Terry flips it into the year it failed, finds the
  predators, and draws the cheapest escape (the flyway).
- **Instead of:** a dashboard of charts and filters.
- **Why:** a manager's question is "will this goal hold, and what does it take?", not "show me all the data". Planning
  from failure (a pre-mortem) surfaces risks a forward plan misses. The 2025 plan, the sensitivity analysis and the report
  all come out of that one mechanism.
- **Cost:** a first-time visitor needs a moment to learn the idea, which is why the page has a guided tour and
  [USER_GUIDE.md](USER_GUIDE.md) exists.

### 24. A lighter landing animation on very dense screens

- **Chose:** the landing's full camera move runs on screens up to 200% scaling. Denser screens (225% and up) get a lighter
  version where the planner fades in place.
- **Instead of:** the same animation everywhere.
- **Why:** the full move redraws the whole planner every frame. Tested on a 200% Windows laptop, it runs smoothly. Denser
  screens are where frames start to drop.
- **Cost:** a few visitors see a simpler transition.
