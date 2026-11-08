# QA report

Checked by Pradyuman Turlapati on November 8, 2026.
Version tested: commit b1895cc ("fe : same zoom fix to 200%")

## Automatic checks
Computer and OS: HP Omen laptop, Windows 11 (10.0.26300)  ·  Node: v24.18.0

| Check | Pass / Fail | Last line printed |
| --- | --- | --- |
| validate.mjs | Pass (ran with no errors; the script prints no pass/fail) | `retrieve: [ 'Sidewalk Repair (Make Safe)', 'Sidewalk Repair', 'Notification' ]` |
| ping_mock_test | Pass | `17 of 17 passed` |
| ping_session_mock_test | Pass | `15 of 15 passed` |
| ping_map_mock_test | Pass | `7 of 7 passed` |
| intake_mock_test | Pass | `15 of 15 passed` |
| card_audit | Pass | `}` (key lines: `"flagged": 0`, `"goal_flags": 0`, across 340 goals and 2,176 cards) |
| flip_audit | Pass | `}` (key lines: `"flagged": 0`, `"errors": 0`, across 240 goals) |
| event_audit | Pass | `}` (key lines: `"shrank": 0`, `"examples": []`, across 48 goals and 240 runs) |

## Live site
| Check | Edge (Windows) | Firefox (Windows) | iPhone 17 (Safari) |
| --- | --- | --- | --- |
| Opening | Pass | Pass | Pass. Intro played and the "bigger screen" message showed, as expected. Layout issues (see 4) |
| Tabs | Pass, but see problem 1 | Pass, but see problem 1 | Pass, but see problems 3 and 4 |
| Demo video | Pass | Pass | Pass |
| Dusk / Night | Pass | Pass | **Fail in portrait** (see 2). Pass in landscape |
| Into the planner | Pass | Pass | Pass |
| A goal | Pass | Pass | Pass, but see problem 6 |
| Spanish message | Pass | Pass | Pass, but see problem 5 |

The "Live" label showed in Ping on Edge and Firefox, so the live model was on during these tests.

## Problems found

1. **Tab pages turn see-through when you scroll (Edge and Firefox).** The tab pages fit on one screen and don't need scrolling, but scrolling with a mouse or trackpad moves the planner underneath, and the tab page stays on top, see-through. Text from both layers mixes and becomes unreadable. Seen on all three tabs in Edge (Who built me showed it after closing the demo video) and on What's 311 and What's this about in Firefox. Not seen on iPhone, where the tab pages don't scroll. The same thing happens behind the demo video and the 2025 crew plan pop-up: the page behind keeps scrolling while something is open on top.
   Screenshots: `edge-311-scroll-overlap-1.png`, `edge-311-scroll-overlap-2.png`, `edge-311-scroll-overlap-3.png`, `edge-about-scroll-overlap.png`, `edge-whobuilt-scroll-overlap.png`, `firefox-311-scroll-overlap.png`, `firefox-about-scroll-overlap.png`

2. **iPhone, portrait: the Dusk / Night switch is cut off and can't be used.** Only part of the sun icon shows at the top right, and there is no sideways scrolling to reach it. It works in landscape.
   Screenshot: `iphone-home-layout.jpeg`

3. **iPhone: the "‹ Boston" button is in the wrong place on all three tabs.** It sits on the bar chart (What's 311), on top of the "Bill" label (What's this about), and on the edge of the Sonar Bridge card (Who built me). In landscape it sits on top of "306,756". It still works.
   Screenshots: `iphone-311-layout.jpeg`, `iphone-about-layout.jpeg`, `iphone-whobuilt-layout.jpeg`, `iphone-landscape-311.jpeg`

4. **iPhone: content is cut off on the right, with no way to scroll to it.** Home: the line "2025 starts tomorrow, and its crews are sti..." runs off the screen, and the month labels are squished together ("TODAYJAN FEBMARAPRMAY..."). What's 311: "Inspectional Services 18,624" and the December bar are cut off. What's this about opens scrolled down, so the headline, $15.6M and 98% only show after scrolling up.
   Screenshots: `iphone-home-layout.jpeg`, `iphone-311-layout.jpeg`, `iphone-about-layout.jpeg`

5. **iPhone: the "Powered by Netlify" badge covers content.** It covers "SCROLL INTO 2025", the "Predators" label, the footer line (IE 5374, Northeastern University, 2026), "$679k" in the crew plan pop-up, and most of the Ping Terry box, which made Ping hard to find. The Spanish chat panel is also cut off on both sides.
   Screenshots: `iphone-home-layout.jpeg`, `iphone-about-layout.jpeg`, `iphone-whobuilt-layout.jpeg`, `iphone-crewplan-popup.jpeg`, `iphone-spanish-ticket.jpeg`

6. **iPhone: the planner is crowded.** The ROOST and TERRYTORY leaves cover the goal box and most of the Chase it button. The header tagline stacks down the middle of the screen. The projector is small (it only showed "Boston 2" and two departments) and doesn't expand. Almanac lines are cut off ("December: Sidewalk make-safe...", "runs 1 crew short; 41 requests..."). "The Flip Side" heading breaks across lines. The goal still ran and showed a result.
   Screenshots: `iphone-planner-goal-box.jpeg`, `iphone-goal-result.jpeg`

7. **iPhone, landscape: overlaps and a broken chart.** Home: the date line, "2025 starts tomorrow..." and the month timeline sit on top of the main headline. What's 311: the chart shows all 12 bars at the same height and only in the Public Works color. The left side of the page was also cut off in landscape.
   Screenshots: `iphone-landscape-text-overlap.jpeg`, `iphone-landscape-311-chart.jpeg`

8. **iPhone: the Close button in the 2025 crew plan pop-up covers the title** (the word "plan").
   Screenshot: `iphone-crewplan-popup.jpeg`

## Other things that looked odd (not failures)

- **validate.mjs:** in `optimize PWDx neutral`, JS and Python crews differ in one month: August is 68 in JS and 70 in Python. Every other month matches.
- **Open the plan for 2025** opens a "The 2025 crew plan" pop-up straight away (Edge, Firefox, iPhone). It isn't in the checklist, so please confirm it's intended. Close works everywhere.
- **Same goal, different predator months:** with the same goal and choices, Edge showed predator owls (×12) in January for Public Works, Transportation and Inspectional Services. Firefox showed Public Works ×12 in January, Transportation ×3 in September and Inspectional Services ×3 in July. The fix (+8 crews for Public Works in August) was the same in both.
- **Goal box text:** after picking "The whole city", the goal box shows "The whole city" instead of the goal. Terry still read the goal correctly.
- **Firefox:** the ticket card from the Spanish message appears at the bottom of the screen and covers part of the legend. In Edge it appears at the top.
- **iPhone:** a "Skipping" button appeared during the goal run without Skip being pressed.
- **Edge vs Firefox:** the site felt smoother in Firefox than in Edge. This is just how it felt, not a measurement.

## Suggestion

- **Spanish input gets English replies.** Terry understood the Spanish message, but asked "Which Centre, Jamaica Plain, Roslindale or West Roxbury?" in English. A Spanish-speaking resident might get stuck there. Consider replying in the resident's language, or offering a Spanish / English choice.
