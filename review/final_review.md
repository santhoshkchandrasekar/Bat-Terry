# Final pre-submission review: Boston 311 / Terry (IE 5374 Module 7)

Reviewed against the brief (`IE5374_Hackathon_Brief_Boston_311-1.pdf`), with numbers re-derived from
`data/processed/requests_4dept.parquet` and the processed CSV/JSON files. No files other than this one were changed.
No API calls were made; `config/llm.local` was not read.

Counts: **Blocking 3 · Should fix 8 · Nice to have 7 · Verified 24.**

---

## Blocking (must fix before submission)

### B1. Contributions table is a placeholder
- **Where:** `README.md`, section "Contributions".
- **Problem:** The brief requires "each team member's contributions" in the README. The table currently reads
  `Santhoshkumar Chandrasekar | Concept (goal inversion / Terry), product direction, …` and two rows of `*Teammate* | …`,
  under a blockquote instruction telling members to replace it. A grader will read this as unfinished.
- **Fix:** Replace the table with real names and concrete deliverables per member (data pipeline / forecast, simulator +
  optimizer, intake assistant + test set, Terry agent + report, app, video). Delete the blockquote instruction line.

### B2. `<!--HEADLINES-->` placeholder left in the README
- **Where:** `README.md` line 11.
- **Problem:** An HTML comment placeholder sits between the intro and "What's in the repo". It is invisible when rendered
  but shows in the raw file and signals an unfinished template; nothing in `app/build_app.py` or `notebooks/build_notebook.py`
  fills it.
- **Fix:** Either delete the line, or replace it with 3 headline bullets (the numbers are all verified below):
  `Neutral plan: $15.62M expected 2025 cost, $6.19M below keeping January's crews; ≥90% on time at ×0.86–×1.14 demand.`
  `Intake assistant: 89.0% type accuracy on 200 held-out messages (98.8% department).`
  `Transportation: sign for 6 crews by 31 Jan 2025; that single decision carries $4.62M of the savings.`

### B3. The folder is not a git repository, and the notebook cannot run from a clone as the repo is configured
- **Where:** `the project folder` (no `.git`); `.gitignore` line `data/processed/*.parquet`; notebook cell 2 fallback.
- **Problem:** (a) The brief requires a GitHub repo link; there is no repo yet. (b) `requests_4dept.parquet` (32 MB) is
  gitignored, but notebook cells 4, 5, 11, 29, 43 and `terry.data.requests()` (used by echolocation in cell 32) read it.
  A grader who clones and runs the notebook hits the cell-2 fallback, which requires the ~550 MB raw CSVs in `data/raw/`
  and then runs `02_aggregate.py`, which **overwrites** the committed `predators_raw.csv`, `monthly_demand.csv`, etc.
  with a fresh snapshot; because the 311 feed is live (open cases close over time), the numbers in the notebook would
  drift from the committed outputs.
- **Fix:** 1) Remove `data/processed/*.parquet` from `.gitignore` and commit the parquet (32 MB is under GitHub's 100 MB
  hard limit; above the 50 MB warning it is not). 2) `git init`, confirm `git status` does **not** list
  `config/llm.local` before the first commit, push, and put the URL in the README. 3) In notebook cell 2, change the
  fallback to run only `01_load.py` (not `02_aggregate.py`), or drop the fallback and print a clear message pointing to
  the README. 4) In the README "Setup", add a "Just run the notebook" path: `pip install -r requirements.txt`, create
  `config/llm.local` (or run without a key; cells fall back to saved runs), open the notebook.

---

## Should fix

### S1. Terry's flipped sentences attach full-year figures to a single month or season, and the report calls them "checked"
- **Where:** `docs/analysis_report.md` §2 and notebook cell 45 (the three flips), notebook cell 32 (live flip),
  `data/processed/showcase_runs.json`, `terry/flip.py` SYSTEM prompt.
- **Problem:** The number guardrail checks that each figure appears in the evidence, but not its scope. All three
  showcase flips misattribute:
  - Public Works: "during peak months like August and September, I had over 500 overdue sidewalk repair requests in the
    South End" — 502 is the **full-year** 2024 count; Aug–Sep in the South End was 87 (the predator evidence on the same page says so).
  - Transportation: "4,302 late ... $290,340" is the full-year South Boston/Waterfront figure (correct scope in the
    report version, but the live flip in cell 32 says "during the peak month of October ... 4,302", and October was 421).
  - ISD: "In August, the peak month ... Dorchester ... 201 requests unresolved ... $21,120" — 201 / $21,120 is the full-year
    Dorchester figure.
  Each is introduced as "*built from 2024 figures and checked against them*". A grader who cross-reads the predator
  table will see the guardrail does not catch this, which undercuts the report's main selling point.
- **Fix (cheapest, no API calls):** change the label in `notebooks/build_notebook.py` (the string used in cell 45 and
  written to the report) and the matching app copy to: *"Terry's flip (an imagined failure; its figures are 2024
  full-year totals, number-checked against the data; the month it names is the dramatization)"*. Re-run cells 45 and
  49 to regenerate `docs/analysis_report.md`.
  **Fix (better, ~8 API calls):** add to `terry/flip.py` SYSTEM: "Every figure in the evidence is a full-year 2024
  total. If you quote one, say 'in 2024' and never attach it to a single month or season." Then
  `python3 -m terry.showcase`, re-run cells 32, 45, 49, `python3 -I app/build_app.py`.

### S2. "At least 90% on time at every demand level we tested" contradicts the table directly above it
- **Where:** Executive summary string in notebook cell 45 (`build_notebook.py`), `docs/analysis_report.md` §1 headline
  sentence ("at every demand level") and the summary, README "Key modeling decisions" item 3.
- **Problem:** The neutral floor applies to the three planning nodes (×0.86/1.00/1.14). The ×1.20 column, which *was*
  tested and is printed in the same report, shows Transportation 17% and Public Works 58%.
- **Fix:** Replace "at every demand level we tested" / "at every demand level" with "at every planning level
  (demand 14% under to 14% over forecast)" in the summary f-string, the cell-49 headline string, and README item 3.

### S3. "42% of requests are logged by city workers" is the citywide brief figure, not this data
- **Where:** Notebook cell 41 (§8 markdown), first sentence.
- **Problem:** In the four in-scope departments the 2024 employee share is **53.2%** (cell 4's own table shows 49.6% /
  61.6% / 60.3% / 40.3%; the app's `stats.employee_share` is 0.532). The narrative number does not match the outputs.
- **Fix:** "42% of all 2024 requests citywide were logged by city workers (brief); in the four departments here it is 53%."

### S4. The A/B result is reported one-sidedly, and the "final model" is not what the narrative describes
- **Where:** Notebook cells 35, 37 and 39; `terry/intake.py` `classify()`.
- **Problem:** Cell 39's table shows rewrite-only retrieval **hurts** the English tiers on held-out v2 (clear 61% vs 64%,
  compound 71% vs 79%, messy 63% vs 70%) while helping Spanish (73% vs 55%). The text says only "the v2 A/B confirms the
  rewrite helps Spanish". The code comment in `classify()` explains the actual final design: retrieval on **both** the
  original message and the rewrite, union of candidates. Cell 35 describes it as rewrite-then-retrieve, and the A/B column
  label "rewrite only" is unexplained.
- **Fix:** In cell 35: "retrieves candidates with both the original message and the rewrite (union)". In cell 37/39:
  "On v2, rewrite-only retrieval helped Spanish by 18 points but cost the English tiers 3–8 points, so the final model
  retrieves with both and keeps the better candidates of each." Rename the columns "rewrite-only retrieval" / "original only".

### S5. The hunt's numbers are point-forecast values; the rest of the notebook reports expected values
- **Where:** Notebook cell 33 output vs cells 13/14/45.
- **Problem:** Terry's recommendation says "$2.81M vs $7.64M, 100% vs 20%"; §4 and the report say "$2.83M vs $7.44M,
  99% vs 20%" for the same plan. Both are correct (`optimize_plan` with `demand_mult=1.0` simulates at the point
  forecast; `plan_expected.csv` averages the three nodes) but the reader is not told.
- **Fix:** Add one line to the cell-33 print: `print("(hunt figures are at the point forecast; §4 and §9 average over the three demand levels)")`.

### S6. Notebook cell 27 says Parks' summer peak is "worked off through the winter"; the table shows it is not within 2025
- **Where:** Cell 27 markdown, cell 18 Parks table, cell 13.
- **Problem:** With 12 crews Parks closes exactly 1,512/month from June and still carries 2,972 open on 31 Dec (expected
  2,981), which the model prices as $237k of 2026 backlog. The sentence reads as if the backlog clears in 2025.
- **Fix:** "...can be worked off over the winter and into early 2026 by regular crews at the base cost rather than 1.3×;
  the plan prices that carried backlog ($237k) and it is still cheaper than seasonal crews."

### S7. Demo video link has no home
- **Where:** `README.md`.
- **Problem:** The brief asks for a 3-minute demo video link. Nothing in the repo points to it; the Canvas submitter
  will need it and graders often look in the README.
- **Fix:** Add a "Demo video" line under the title with the URL once recorded (and a placeholder now so it is not forgotten).

### S8. Cell-2 fallback can silently rewrite committed outputs
- **Where:** Notebook cell 2: `os.system("python3 -I src/01_load.py ... && python3 -I src/02_aggregate.py ...")`.
- **Problem:** See B3(b). Even after committing the parquet, keep this from running `02_aggregate.py`, which regenerates
  `predators_raw.csv`, `monthly_demand.csv`, `silence`-inputs and the map data from whatever raw snapshot is present.
- **Fix:** Limit the fallback to `01_load.py`, or replace with `raise FileNotFoundError("see README › Setup")`.

---

## Nice to have

### N1. Snowstorm anchor cannot be verified from repo data
- **Where:** Cell 20, `src/06_full_plan.py` docstring, README item 5 ("~9,800 requests in two weeks vs ~4,200 normal").
- The parquet holds 2023–24 only; `monthly_demand_2022_2024.csv` shows PWDx Feb 2022 = 13,269 vs 9,978 (2023) and
  11,550 (2024), i.e. +15% to +33% for the month, consistent with a ×1.55 two-week spike being conservative-to-generous.
  Consider adding the one-line monthly comparison so a grader can check it without 2022 raw data.

### N2. Heat-wave anchor rounds slightly low
- **Where:** Cell 20 ("1.22–1.29"). Recomputed from `monthly_demand_2022_2024.csv` against the three-year same-month mean:
  PARK 1.29 (Dec 2023), ISD 1.30 (Feb 2023). Write "about 1.3" or state the exact definition used. Note both spikes are
  winter months, so the heat-wave label is an analogy; say so in one clause.

### N3. The live flip in cell 32 is rejected for the right reason, but the reader has to work that out
- Add one sentence under cell 32: "The first predator is REJECTED: the 4,302 figure is South Boston's full-year count,
  and October alone was 421. That is what echolocation is for."

### N4. Parks on-time 100.0% "against 100.0%" sentence
- Cell 45 / report, Parks plan paragraph: "the model has it closing 100.0% of requests on time against 100.0%" reads as
  a bug. In `plan_paragraph()` skip the on-time clause when both rates ≥ 99.5% and say "on-time is already near 100%
  at either staffing; the plan is about the year-end backlog".

### N5. Styler outputs render only where `text/html` is honoured
- Cells 4, 5, 6, 8, 11, 13, 18, 21, 22, 24, 28, 38, 43 output pandas Stylers. GitHub and nbviewer render them, but a
  plain `text/plain` view shows `<pandas.io.formats.style.Styler at 0x...>`. If the grader opens in Canvas's previewer,
  consider `display(df.round(...))` for the key tables (cells 13, 16, 21) as a fallback.

### N6. App map count
- `app/index.html` says "built from 274,583 located requests"; the parquet has 275,241 2024 rows with coordinates.
  The ~0.2% difference is presumably bounds clipping in `src/08_map_data.py`; harmless, but "about 275,000" avoids the question.

### N7. `review/` folder in the submission
- `review/full_plan_v1.log`, `ambiguous_to_label.csv`, `routing_targets.csv` and this file are working artefacts. Fine to
  keep (they back the "independent reviewer" claims), but add a one-line `review/README.md` saying what each is.

---

## Verified (checked and found correct)

Data checks were run with `python3 -I` against `data/processed/requests_4dept.parquet` and the processed files.

1. **2024 request counts per department** (cell 4): PWDx 157,610 / BTDT 81,447 / PARK 18,736 / ISD 18,624. Exact match to
   the brief and to the parquet. Total 2023–24 rows 558,663 as printed.
2. **2024 on-time rates** (cell 4): 89.7% / 49.9% / 93.2% / 72.4% recomputed; match the brief's 90/50/93/72.
3. **No-target-date share**: PWDx 18.6% (cell 46's "19% in Public Works" is a fair rounding); BTDT 2.0%, PARK 2.2%, ISD 0.4%.
4. **2024 overdue cost at brief rates** (cell 6): `predators_raw.csv` sums to overdue 62,846, cliff 31,147,
   cost $4,371,620 = 20×62,846 + 100×31,147. Parking Enforcement $2,157,520 = 49.4%. The cliff rule in
   `src/02_aggregate.py` (closed >30 days late, or still open and >30 days past target at snapshot) matches the brief.
   (A stricter recompute that judges still-open cases as of 31 Dec 2024 gives $4.06M; the repo's snapshot-based
   definition is defensible and is stated in the code.)
5. **Flip figures**: South Boston/Waterfront Parking Enforcement 4,302 overdue / $290,340; October alone 421 / $32,520;
   South End Sidewalk Repair 502 / $56,740. All exact.
6. **Parks targets** (cells 10, 29): 57.0% of 2024 Parks requests have sla ≥300 days (10,672 of them exactly 365); 38.2% ≤10 days.
7. **ISD by reason** (cell 28): Housing 7,180 (30% late, median target 120 d, median close 5.6 d), Environmental
   Services 4,892 (1%), Building 4,747 (46%), Health 1,248 (26%), Highway Maintenance 245 (84%). Recomputed exactly.
8. **Forecast backtest** (cell 8, cell 12): seasonal_avg MAPE 10.8/7.3/14.0/7.8% is the row-wise winner for PWDx, PARK and
   ISD (holt_winters wins BTDT at 5.4%, as the highlighted table shows). Pooled RMS of annual errors = 0.067, matching
   "6.7%"; σ = 8% and nodes 0.8614/1.1386 = 1 ± √3·0.08 match `optimize.py`.
9. **City totals** (cell 14): do_nothing $21.81M, passive $15.21M, neutral $15.62M, aggressive $16.25M recomputed from
   `plan_expected.csv`; neutral−passive = $410k; aggressive−passive = $1,037k. Transportation savings $4,615,235 ≈ "$4.62M".
10. **Neutral crew plan** (cell 16, report, app): `plan_summary.json`, `plan_monthly.csv` and `app/index.html` DATA.plans all
    agree: PWDx 50,50,56,60,60,62,66,70×5; BTDT 18,24,24,24,26×8; PARK 10×5,12×7; ISD 16×4,18,18,19×6. No seasonal crews.
11. **Crew-cost arithmetic** (cell 18): Jan PWDx $541,667 = 50×130,000/12; Feb $606,667 = (50 active + 6 in training)
    ×10,833; BTDT Jan $220,000 = (18+6)×9,167. Training-month pay is applied the month before activation as the brief requires.
12. **Decision calendar** (cell 34): every change is dated the last day of the prior month; one-time cost = training-month
    pay for hires (6×$9,167 = $55,000). Matches `terry/calendar.py` and the brief's one-month lag.
13. **Sensitivity table** (cells 21–22): matches `plan_scenarios.csv` and the app's DATA.scenarios (e.g. BTDT neutral ×1.14
    = 0.9169, ×1.20 = 0.1654). Snowstorm = PWDx month index 1 (Feb) ×1.55; heat wave = PARK/ISD index 6 (Jul) ×1.20,
    consistent with cell 20 and `06_full_plan.py`.
14. **"First version broke at +5%, Transportation 99%→17% at +10%"** (cell 12): `review/full_plan_v1.log` shows v1 break
    points {PWDx 5, BTDT 5} and BTDT on-time 0.173 at plus10. Verified.
15. **Break points** (cell 26): {16, 16, 56, 26} in `plan_summary.json`; consistent with the ×1.14/×1.20 columns.
16. **Regret footnote** (cell 46): the one negative regret-after-replan is PWDx ×1.14 at −$1,443 ≈ "$1.4k". Verified.
17. **Do-nothing simulation** (cell 11): re-ran `simulate(build_arrivals(... seed=1), flat_plan("PWDx"))`: on-time 0.546,
    total $8,904,708, identical to the cell output. One run took 16 ms (cell 10 says "about 15 ms").
18. **Intake routing targets** (cell 36): 163 types in the four departments; 124 used ≥25 times covering 99.93% of requests.
19. **Intake accuracy** (cells 38–39): held-out v1 final 89.0% (178/200), first model 82.5%; 160 routable messages: type
    90.0%, queue 91.2%, department 98.8%, retriever recall 98.1%; 40 vague: 18 labelled ASK, 22 routable; seed 82.0% (n=50);
    v2 rewrite 66.7% vs no-rewrite 65.8% (n=120). Tier sizes 42/43/35/40/40 and sampling 120 frequency / 40 uniform / 40
    ambiguous match cell 37. `also_ok` is set on exactly 32 non-ambiguous rows, matching "32 messages got an accepted alternate".
20. **Weakest/strongest style** (cell 47): compound 83.7%, spanish 95.0%. Verified.
21. **Silence table** (cell 42): Mission Hill 0.785, quietest type Improper Storage of Trash (Barrels) 0.455; matches the
    live echolocation output in cell 32 (0.78×, 0.45×).
22. **Employee vs resident** (cell 43): per-department employee shares 49.6/61.6/60.3/40.3% recomputed exactly.
23. **Code vs brief** (`src/sim.py`, `src/optimize.py`, `terry/tools.py`): 21 working days × daily capacity, 1-month hiring
    lag with training pay, 1-month notice + 25% release cost, Parks-only seasonal crews Apr–Oct at 1.3× with no lag and
    no release cost, $20 overdue + $100 past 30 days, no 1-Jan backlog, January crews fixed at the brief's levels (the
    optimizer never hires in January; `simulate_plan` resets January and strips non-Parks or off-season seasonal crews).
    The hunt agent's guardrails (`unverified_numbers`, `_claim_errors`, `finalize`) work as described; the saved hunt has
    `unverified: []` and recommends the same crews as the neutral plan.
24. **Security**: no `sk-…` key or bearer token anywhere in the repo outside `config/llm.local` (the only hits are the
    README's `sk-...` placeholder and the word "risk"). `config/llm.local` is listed in `.gitignore`; the notebook's 30
    outputs contain no key. `terry/llm.py` reads the key only from that file or the environment. The repo must be
    `git init`-ed with that `.gitignore` in place before the first commit (B3).

Requirement coverage against the brief: GenAI app with ≥2 techniques (structured output, prompt engineering, RAG,
agent/tool calling, LangChain, API calls) — present and part of the solution (§6–§9); month-by-month 2025 plan for four
departments with hires/releases — §4.1–4.2, §6; forecast with backtest — §2; intake assistant with a measured test set
(50 seed + 200 held-out + 120 A/B) — §7; sensitivity ±20% plus snowstorm and heat wave — §4.3–4.5; equity and
employee-vs-resident — §8; analysis report — §9/§11 and `docs/analysis_report.md`; notebook fully executed (30 code
cells, execution counts 1–30, no errors, no empty outputs); README with setup and architecture diagram — present;
contributions — **missing (B1)**; GitHub repo and video link — **missing (B3, S7)**.
