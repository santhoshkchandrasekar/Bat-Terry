# Browser checks for the landing, the projector and the laptop sizes

Each script serves app/zoom through `../bshoot.cjs`, opens it in Playwright's Chromium and writes screenshots to `tests/out/`. Set `THREE_JS` to a local copy of three.min.js (r128) if the CDN is not reachable.

| Script | What it checks |
| --- | --- |
| `lap.cjs W H DPR` | The landing to planner zoom at one screen size: frames at u = 0, 0.3, 0.6, 0.85, 0.95, 1 and any page errors. Run at 1366 768 1.5, 1280 800 2 and 1536 864 1.25 for laptops. |
| `settle.cjs W H DPR` | The planner after the zoom has settled, at one screen size. |
| `hit.cjs W H DPR` | Every header button is clickable once the planner settles (nothing, Terry's hit area included, covers it). |
| `lg.cjs` | The projector legend at city, department and month level: labels, hover notes, and that the legend fits the cloth. |
| `rt.cjs`, `rtc.cjs` | Round trips landing to planner and back, without and with a chase: the landing's buttons still work, Terry returns from the top. |
| `fold.cjs` | Fold all and Open all in The Flip Side keep the section header where it was (the page does not jump to the projector). |
| `glide.cjs` | Terry's glide in from the top after the intro. |
| `theme2.cjs` | Dusk and Night switch: the one page gradient changes on one clock, no pale bands. |
| `ai-faults.cjs [names]` | Ping's live-model path on the hosted build (deploy/site) with a scripted `/api/llm`: slow, 502, 429, not JSON, endless tool calls, no answer; Stop, Escape, typing elsewhere, the guide speaking, a ticket landing mid-question, reports under a failing model. See docs/STATES.md. |
| `stress.cjs [seed] [steps]` | Random-order stress test on the hosted build with the landing forced: mixed actions at random timings, the page's rules checked after each (docs/STATES.md lists them). `W` and `H` set the window. |
| `chase-probe.cjs [noguide]` | One guided chase at the 8x slow test clock, printing what the "chase finished" check waits on every 20 s. |

The longer suites (guide-shoot, b1808-shoot, bud-shoot, opening-check) sit one level up in app/zoom; the data and GenAI audits sit in notebooks/.
