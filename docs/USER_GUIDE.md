# How to use Bat-Terry

Bat-Terry plans how many 311 field crews four Boston departments need in each month of 2025. You give Terry the bat a
goal; he imagines the year it failed, finds what would cause the failure, checks each cause against real 2024 records,
and shows the cheapest crew plan that avoids it.

**Open it:** https://bat-terry.netlify.app · **Watch the 3-minute demo:** https://youtu.be/U-ltQXELWZ0

Use a laptop or desktop in Chrome, Edge, Safari or Firefox. A phone works for a look around, but the planner needs a
bigger screen. Why the site is built this way is in [DECISIONS.md](DECISIONS.md).

---

## 1. The landing page

You arrive in Boston on the evening of 31 December 2024: *"2025 starts tomorrow, and its crews are still unplanned."*

- **Open the plan for 2025:** the glass button under the headline. Shows the recommended 2025 crew plan as a table
  straight away. Press **Close** or Escape to go back.
- **What's 311, What's this about, Who built me:** the tabs at the top right. Each one turns the landing into a short
  page: Boston's 311 numbers, the idea behind Bat-Terry, and the team. **Who built me** also has the demo video and the
  link to the code. **‹ Boston** (bottom left) or Escape brings you back.
- **Dusk / Night:** switches the photographs and colors. It works on every page.
- **Scroll down** (or follow *Scroll into 2025* at the bottom) to move into the planner. Scrolling up at the very top
  brings you back.

## 2. Find your way around the planner

From top to bottom:

| Part | What it is |
|---|---|
| **Name a goal. Terry finds the flyway.** | The goal box and the **Chase it** button. The main thing you do here. |
| **Projector** (*Boston 2025*) | The 2025 plan as a chart: crews on plan against crews needed, by month. |
| **Almanac** and **BUDGETerry** | A board that reads out each month, and a battery that drains with the year's crew budget. |
| **The Flip Side** | Where a chase lands: your goal flipped, its predators, the flyway, the verdict and the bill. |
| **The Ledger** | The 2025 crew plan as a table, with four plans to switch between and compare. |
| **Echolocation** | Who calls 311 less than expected, and who waits longer. Opens a neighborhood map. |
| **Roost** (left leaf) | The plans Terry has found for you. He keeps up to three. |
| **Terrytory** (right leaf) | The residents' side: reports, the incoming message stream and alerts. |
| **Ping Terry** (the dock at the bottom) | Ask Terry anything about the plan, report a street problem, or tell him where to go. |

On your first visit Terry gives a short guided tour. **Skip** ends it; **Show me around** in the Ping dock replays it.

## 3. Read the 2025 plan

**On the projector**

- **−** and **+** zoom between the whole city, one department, and one month.
- **How to read this** (the **?** button) explains every mark on the chart.
- Drag the projector's pull to set its height; **hold** it to enlarge the screen.

**In The Ledger**

- The tabs **Do nothing**, **Passive**, **Neutral** (recommended) and **Aggressive** switch between the four plans.
  - **Do nothing:** keep January's crews all year.
  - **Passive:** the cheapest plan; lateness is just a cost.
  - **Neutral:** at least 90% on time even if demand runs 14% above or below forecast.
  - **Aggressive:** at least 95% on time, and 90% even if demand runs 20% hot.
- Numbers like **+6** under a month are crews hired for that month.
- **Compare with** puts a second plan beside the first, and shows only where they differ.
- The columns at the right: **Cost** for 2025, **On time** in the crew model, **At +20%** (a year 20% busier), and
  **Record**, what really happened in 2023 and 2024.
- **Download CSV** saves the table.

## 4. Chase a goal

This is the heart of Bat-Terry.

1. **Type a goal** in the box at the top. A good goal names a department, a time and a target, for example:
   - *Every Transportation request on time in November*
   - *Public Works 95% on time all summer*
   - *Every Parks request in Dorchester closed on time in June*

   If your goal leaves something out (which department, which months, how high), Terry asks before he starts.
2. **Press Chase it.** Terry carries your goal to the projector and works through five steps, shown as a progress bar:
   *Reading your goal → Chasing it → Listening for predators → Testing against 2024 data → Finding a flyway.*
   **Skip** jumps straight to the finished result.
3. **Read the flip.** Terry writes the goal as if it had already failed, dated 31 December 2025. It's an imagined
   failure, built from real 2024 figures.
4. **Read the predators.** Each card is one specific way the goal could fail, tested against 2024 records:
   - **Confirmed:** the data shows this problem was real (for example, *55% late vs 50% for the department*).
   - **Rejected:** the data shows it wasn't a problem.
   - **Untestable:** there were no 2024 requests to test it with.
   - A tag such as *Late in 2024 only* or *Not late in either year* says whether 2023 agrees.
5. **Read the flyway, the verdict and the bill.** The flyway is Terry's cheapest crew plan that gets past the confirmed
   predators: who to sign, by when, and what it costs. **Dusk** is the last day a new crew can still be signed in time to
   help. The verdict says whether the goal escapes; the bill shows the payroll against the late costs it avoids.
6. The plan Terry found goes into the **Roost** (left leaf). Chase up to three goals and compare any two there.

Some confirmed predators are about *how* the work is handled, not crew numbers. Terry says so when more crews won't fix
it.

## 5. Ask Ping Terry

The dock at the bottom of every page. Type and press Enter, or tap one of the suggestions.

- **Questions about the plan:** *Why does Transportation hire in February?* · *What happens if demand is 20% higher?*
  · *What does Dusk mean?* Terry answers from the plan's own numbers and moves the page to show you.
- **Report a street problem**, in English or Spanish: *There is a huge pothole on Centre St by the T stop* or *Hay un
  bache enorme en la calle Centre.* Terry asks a follow-up if needed (*which Centre Street?*), then routes the report to
  the right city request type and team.
- **Tell him where to go:** *open Parks in July* · *compare plans* · *go to the predators* · *show me the flyway*.
- While Terry is thinking, the send button becomes **Stop**.

## 6. Explore the residents' side and the map

- **Terrytory** (right leaf) shows the resident side of 311: reports routed by the intake assistant, a replay of a real
  day's incoming messages (pick a day, then **Play**), and alerts sized by real past spikes.
- **Echolocation** compares neighborhoods two ways: who reports *less* than expected for the same kinds of problems, and
  who *waits longer* than their mix of requests predicts. **Open the map** shows Boston in hexagons; hover a hexagon for
  its neighborhood and numbers, and zoom or drag to explore. The finding: the quiet places are not the slow ones, so they
  need two different fixes.

## 7. If something seems off

- **Terry answers more plainly than usual, or says *Today's live answers are used up*.** The site caps how much AI it
  uses each day. Everything keeps working on Terry's built-in rules, and every number is still computed the same way.
- **A chase is slow.** The AI steps can take up to about a minute. Press **Skip** to see the finished result.
- **On a phone** the site says it needs a bigger screen. Tap **Look around anyway** to browse, or **Email me the link**
  to open it later on a laptop.
- **The landing animation looks simpler than in the video.** On very dense screens the site uses a lighter transition
  so it stays smooth. Nothing is missing.

## 8. Words Terry uses

| Word | Meaning |
|---|---|
| **The flip** | Your goal turned upside down: the year it went wrong. |
| **Predator** | A specific way your goal could fail, tested on 2024 data. |
| **Flyway** | Terry's cheapest crew plan that gets past the predators. |
| **Dusk** | The last day to sign a crew that still helps in time. |
| **The Flip Side** | The plan section: your goal flipped, its predators, the flyway. |
| **Roost** | A plan Terry brought back. He keeps up to three. |
| **Terrytory** | The resident side: reports, the message stream and alerts. |
| **Echolocation** | Testing an idea against real records; also the neighborhood equity map. |
| **BUDGETerry** | The year's crew budget, drained month by month. |
| **Ping** | Ask Terry anything from the dock at the bottom of the page. |

Hover any of these words on the page for the same one-line definition.
