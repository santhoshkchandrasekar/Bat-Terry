# Bat-Terry: state machines, rules and the bugs they caught

This file maps the states the page can be in, the rules that must always hold, and the bugs a fault-injection test and a random-order stress test found. It covers the five parts that change state on their own (the landing camera, Terry's flight, the chase, the guide, and Ping's chat) and, in the most depth, the path a question takes through the language model. Every bug listed was reproduced on the old code by a test that now passes; nothing here is a guess.

Tests that back this file (all in `app/zoom/tests/`, see its README):

- `ai-faults.cjs`: Ping's live-model path end to end on the hosted build, with `/api/llm` replaced by a scripted model that is slow, fails, is over its limit, returns text that is not JSON, never stops calling tools, or never answers; plus user moves while Terry thinks. 22 checks.
- `stress.cjs [seed] [steps]`: hundreds of mixed actions at random timings (scrolling between the landing and the planner, theme, chase, Fold all, projector zoom, Ping questions against a model that is randomly slow, failing or limited, Stop, Escape, New chat, window resizes), checking the rules below after each one. Seeded, so a failure replays exactly.

## 1. The landing camera (`landing.js`)

One number drives the move between the landing and the planner: `u`, from 0 (landing) to 1 (planner). `uT` is where input wants it; `uD` is what is drawn, eased toward `uT` each frame.

| State | Meaning |
| --- | --- |
| Landing | `uD = uT = 0`. The landing is on top; its buttons take clicks; the planner underneath is cleaned up (`rest()`). |
| Moving | `0 < uD < 1`. The camera pulls back (or pushes in); only transform and opacity change per frame. |
| Gliding | Input stopped mid-way: 650 ms later `go()` snaps `uT` to the nearer end and the move finishes on its own. |
| Planner | `uD = uT = 1`. The landing is gone; the document scrolls normally. |

| From | Event | To |
| --- | --- | --- |
| Landing | wheel, touch or key down | Moving (toward 1) |
| Moving | input continues | Moving |
| Moving | input stops for 650 ms | Gliding to the nearer end |
| Gliding | reaches 0 or 1 | Landing or Planner |
| Planner | scroll up while the page is at its top | Moving (toward 0) |
| Planner | any other scroll | Planner (normal page scroll) |

Rules (checked by `stress.cjs` after every full settle):

1. The move never rests mid-way: at rest `u` is 0 or 1.
2. Only one Terry shows at rest. The landing's Terry hands over to the planner's at `u >= 0.95`, with the same pose and wing phase.
3. At the landing, its buttons take clicks (nothing from the planner sits over them).
4. At the planner, the page can scroll and its overflow is not left hidden.

## 2. Terry's flight (`proj.js`, `terry-bat3d.js`)

| Mode | Meaning |
| --- | --- |
| hover | At home, flapping slowly. |
| fly | Moving between two points. |
| flip | Turning to hang. |
| hang | Hanging from the branch or beside the Almanac after a chase. |

Flags beside the mode: `introRunning`, `ferrying` (carrying a ticket card to the screen), `running` (a chase), `gone` (off screen for the landing).

Rules: after a chase Terry stays hanging until the next chase; when the planner's Terry hangs, the landing's Terry leaves and returns through the top of the frame rather than flying back to him; a ticket is only ferried when nothing else is flying (`canFly()`).

## 3. The chase (`proj.js` `runGoal`, `app.js` plan play)

| State | Meaning |
| --- | --- |
| idle | The goal box is free. |
| reading (`goalBusy`) | The goal is being read; chips may offer a choice. |
| chasing (`running`) | Terry works the goal: predators, the flip, the flyway, narrated by the guide. |
| playing (`PL.running`) | The projector plays the plan, beat by beat. |
| done | A Roost is added; the "+" for another goal shows. |

Rules: one chase at a time (`goalBusy || running` refuses a second); the goal box is locked while a chase runs and free otherwise (checked by `stress.cjs`); the plan play is cancelled by bumping `PL.token`, and every await inside it checks the token before drawing, so a skipped or restarted play never finishes on top of a newer one.

`TerryProj.running` now exposes `running || goalBusy` read-only, so tests (and later Ping) can see a chase in progress.

## 4. The guide (`guide.js`)

`TerryGuide.active` is the kind of guided run (the tour, or a chase) or null. The tour waits for the `terry:landing` event, so it never starts under the landing. When the guide speaks it takes Ping's dock (`TerryPing.guide`): a question still in flight is cancelled and the chat says so (see S3).

## 5. Ping's chat (`ping.js`)

| Variable | States |
| --- | --- |
| `D.el.dataset.mode` | `rest` (the bar), `chips` (suggestions), `answer` (the open chat) |
| `D.el.dataset.kind` | `answer`, `ticket` (a resident report), `ask` (a follow-up question to the resident), `guide` |
| `working` + `ctl` | a turn in flight and its AbortController |
| `turnSeq` | the number of the current turn (new, see S5) |
| `stopWhy` | who cancelled the turn: `you` (Stop) or `guide` (new, see S1 and S3) |
| `pending` | a resident report waiting for one more detail |

| From | Event | To |
| --- | --- | --- |
| idle | submit | working (the field is disabled, the send button becomes Stop) |
| working | answer or rules answer arrives | idle, answer shown, its page actions run |
| working | Stop | idle, "Stopped. Ask again whenever you like." with Try again; the late answer and its actions are dropped |
| working | the guide speaks | idle, the cut question stays in the chat as "I stopped this to show you something" |
| working | Escape | still working, chat folded; the answer is there when the chat opens |
| working (report) | the ticket starts flying | idle (the field is free during the flight) |
| idle | a ticket from an older turn lands | idle; the older turn may only redraw its own ticket |
| idle | New chat | idle, empty chat, Terry's memory cleared |

Rules (checked by `stress.cjs` after every action):

1. Idle means the field is enabled; busy means there is a Stop.
2. Idle never shows "Listening...".
3. Only the current turn may change the busy state (`turnSeq`).
4. An answer never takes the keyboard from another field.

## 6. A question's path through the model (`ask.js`, `intake.js`, `host.js`, `netlify/functions/llm.mjs`)

```
typed text
  -> emergency?            yes: "call 911" from code, no model, no ticket
  -> page command or "go to ..."?   done by code, no model
  -> route (code): resident report | alert | question
       resident -> intake: rewrite (model, 20 s cap) -> retrieve request types (code) -> choose (model, 20 s cap)
                           -> rules fallback on any failure -> ticket
       question -> askLive: prompt with page state and chat history as data
                    -> tool loop (soft budget: after 4 calls "reply now"; hard stop past 6 calls; host.js caps rounds at 10)
                    -> JSON answer (not JSON: invalid_response)
                    -> number check: every figure must be in a tool result, a cited chunk or the page state
                         -> one model rewrite of unsupported numbers -> sentences still unsupported are dropped
                    -> actions cleaned to the allowed set, codes replaced by department names
                 time cap 45 s; if the cap or the call budget stops it, one last call with no tools (20 s cap) from the facts so far
       any failure -> the rules answer, labelled ("quick answer", or "Today's live answers are used up" on 429)
```

Who can cancel: only the viewer (Stop, or the guide taking the dock). A cancel is `cancelled` and shows nothing from the model. Every cap is ours, so it falls back to the rules instead of looking like a cancel; in `intake.js` the two are told apart by whether the viewer's own signal was aborted.

On the hosted site, `host.js` gives the page its `sample` interface: it runs the tool loop in the page and posts one round at a time to `/api/llm`, which holds the key, accepts only prompts that start like the page's own, and enforces a daily dollar cap for the site and a call cap per visitor.

Proven by `ai-faults.cjs`: a live answer shows and its page action runs; a 502 and a 429 each give the labelled rules answer; a reply that is not JSON is never shown raw; a model that never stops calling tools is cut off after 8 rounds and still answers; a model that never answers is cut off at 46 s; a resident report routes by rules under a failing or stalled model.

## 7. Bugs found and fixed

Each one reproduced on the old code by the named test and passes now.

| ID | Impact | What happened | Evidence | Fix |
| --- | --- | --- | --- | --- |
| S5 | High | A resident report frees the field while its ticket flies. If the viewer asked something else in that window, the old turn's cleanup ran when the ticket landed and marked the new turn idle: the field unlocked mid-answer, a second question could start, and the two turns shared one AbortController. | `ai-faults.cjs flight`: busy flag went `1 ... 1, 0` about 11 s in, before the answer arrived. | Each turn takes a number (`turnSeq`); only the current turn may clear busy or show "Stopped". |
| S2 | Medium | When an answer arrived, Ping took the keyboard back even if the viewer had moved on. Typing a goal while Terry answered sent the rest of the keystrokes into Ping. | `ai-faults.cjs focus`: the goal box held "Parks on time " and lost " in summer". | The field refocuses only if focus is nowhere, on the send button, or already in the dock. |
| S4 | Medium | The intake's two model calls had no time cap: a stalled model left a report spinning until the network gave up (72 s in the test). | `ai-faults.cjs report-hang`. | A 20 s cap per call, separate from the viewer's own cancel; a capped call falls back to the rules (now 22 s end to end). |
| S1 | Medium | There was no way to stop a slow answer (up to the 45 s cap); New chat is not on screen while Terry thinks. | `ai-faults.cjs stop`: no Stop control. | While Terry works, the send button is Stop (a square). Stop cancels the request, says so, offers Try again, and the late answer and its page actions never land. |
| S3 | Low | When the guide spoke over a question, the chat kept a turn reading "What is a flyway? Listening...". | `ai-faults.cjs guide`. | The cut turn now reads "I stopped this to show you something. Ask it again whenever you like." |

Grouped as issues: Ping turn ownership (S1, S3, S5), focus (S2), model time caps (S4).

Earlier state bugs, fixed this week from the owner's reports and now guarded by `stress.cjs` rules: the landing's buttons dead after a round trip (rule 1.3), two Terrys at the hand-over (rule 1.2), Fold all jumping the page to the projector (`fold.cjs`), and Terry flying back from the Almanac to the landing after a chase (section 2).

A test, not the page: the Ping vocabulary step in `b1808-steps.cjs` read the dock before the new answer replaced the last one. It now waits for this answer's own words.

## 8. Known and left as they are

- The Netlify function's limits are read, then written. Two requests at the same instant can both pass just under a cap, so the site can overshoot by one round per simultaneous visitor. The daily dollar cap still bounds it.
- The function forwards any prompt that starts like one of the page's own. Anyone could use it as a small model proxy, up to the per-visitor and daily dollar caps (defaults: 60 rounds, $3 a day).
- The guide's own model call (when live answers are on) does not take the viewer's signal; if a viewer's question and a guide line run at once, Terry's chat memory records them in finishing order. Rare and harmless to the plan.
- After a chase, the goal box takes focus back; that is deliberate (the next goal is the next step).

## 9. Results

| Run | Result |
| --- | --- |
| `ai-faults.cjs` (hosted build) | 22 of 22 |
| `stress.cjs 7 200` at 1440x900 | 200 actions, 0 broken rules, 0 page errors |
| `stress.cjs 23 200` at 1366x768 | 200 actions, 0 broken rules, 0 page errors |
| guided tour and chase, Ping, Almanac, BUDGETerry, opening, round trips, Fold all, theme, glide | all pass |
| notebook audits and the four mock suites (ask, intake, map, session) | all pass |
