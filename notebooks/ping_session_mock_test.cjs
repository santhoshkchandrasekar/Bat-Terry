// Ping Terry knows the page (FEEDBACK_NOV4_1808 items 2, 3 and 6): the session_state tool and summary, follow-ups with the chat's memory,
// and emergencies. No network, no key: a scripted stand-in for the page's sample capability.
// Run from the repo root: node notebooks/ping_session_mock_test.cjs   (exits 1 on any failure)
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const req = p => require(path.join(ROOT, p));
const E = req("app/live/engine.js").create(JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8")));
const Z = req("app/zoom/levels.js").create(E);
const TA = req("app/zoom/ask.js");
global.TerryAsk = TA;   // intake.js finds the shared sanitizer and the emergency test through it, as in the page
const TI = req("app/zoom/intake.js");

// what session.js returns on the page after a Parks summer chase (the shape, with figures as the page prints them)
const SNAP = { active_roost: { roost: "Roost 1", department: "Parks", goal: "At least 80% of Parks & Recreation requests close on time in June to August 2025", window: "June to August", target: "80%", verdict: "Escaped: the flyway clears the goal", view: "Flyway",
  on_time_in_window_original_plan: "69.3%", on_time_in_window_flyway: "100.0%", payroll_added: "$160,000", overdue_cost_avoided: "$196,120",
  predators: [{ name: "Equipment Repair backlog in East Boston", verdict: "CONFIRMED", where: "East Boston, Parks", cost_2024: "$2,880", late_share: "26%", department_late_share: "7%", how_terry_answers: "Flyway covers it: Parks 100.0% on time in Jun." },
    { name: "Equipment Repair capacity squeeze in summer", verdict: "CONFIRMED", where: "Parks", cost_2024: "$8,640", late_share: "18%", department_late_share: "7%" },
    { name: "Tree work backlog in Roxbury", verdict: "REJECTED", where: "Roxbury, Parks", cost_2024: "$40,000" }],
  predator_counts: { confirmed: 2, rejected: 1, untestable: 0 }, most_dangerous_predator: "Equipment Repair capacity squeeze in summer" },
  other_roosts: [{ roost: "Roost 2", department: "Transportation", goal: "Every Transportation request on time in November", window: "November", target: "100%", verdict: "Partly" }], roost_count: 2,
  screen: { level: "a department's year", department: "Parks", month: null, mode: "Flyway", maximized: false }, compare: null,
  last_ticket: { type: "Pothole Repair", department: "Public Works", queue: "District crew", day: "Wed 15 Oct", neighborhood: null }, open_surge: null };
const SUMMARY = "Active: Roost 1, At least 80% of Parks & Recreation requests close on time in June to August 2025 (Flyway; 2 confirmed predators, most dangerous: Equipment Repair capacity squeeze in summer).";
const ui = (snap = SNAP) => ({ session: () => snap, sessionSummary: () => SUMMARY });

function fakeSample(script) {
  const prompts = [];
  const s = async () => { throw new Error("unused"); };
  s.json = async (prompt, opts = {}) => {
    prompts.push(prompt);
    if (opts.modelTier === "quick") return { answer: script.fix || "" };
    const byName = Object.fromEntries((opts.tools || []).map(t => [t.name, t]));
    for (const [name, input] of script.calls || []) await byName[name].execute(input);
    return typeof script.out === "function" ? script.out(prompt) : script.out;
  };
  s.prompts = prompts; return s;
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("offline: the most dangerous predator in this roost comes from the page, not the glossary", async () => {
  const A = TA.create(E, Z, null, ui());
  const r = await A.ask("whats the dangerous predator in this roost");
  assert.strictEqual(r.route, "question"); assert.strictEqual(r.mode, "rules");
  assert(/most dangerous predator is Equipment Repair capacity squeeze in summer/.test(r.answer), r.answer);
  assert(/\$8,640/.test(r.answer) && /18% late against 7%/.test(r.answer), "cost and late share from the state");
  assert(!/Tree work/.test(r.answer), "a rejected predator is never the dangerous one, whatever its cost");
  assert(r.source_chips.some(c => c.label === "This page, right now") && !r.source_chips.some(c => /Glossary/.test(c.label)));
  assert(r.trace.some(t => t.tool === "session_state"));
});
test("offline: the costliest predator, and none yet before any chase", async () => {
  const A = TA.create(E, Z, null, ui());
  assert(/most dangerous predator is Equipment Repair capacity squeeze/.test((await A.ask("Which is the costliest predator?")).answer));
  const B = TA.create(E, Z, null, ui(Object.assign({}, SNAP, { active_roost: null, other_roosts: [], roost_count: 0 })));
  assert(/There is no Roost yet/.test((await B.ask("What is the most dangerous predator in this roost?")).answer));
});
test("offline: what am I looking at", async () => {
  const A = TA.create(E, Z, null, ui());
  const r = await A.ask("what am I looking at");
  assert.strictEqual(r.route, "question");
  assert(/^The projector shows Parks' year/.test(r.answer) && /The Flip Side holds Roost 1/.test(r.answer) && /2 Roosts open/.test(r.answer) && /Pothole Repair/.test(r.answer), r.answer);
});
test("with the model: the state summary is in the prompt, session_state is a tool, and its figures pass the number check", async () => {
  const smp = fakeSample({ calls: [["session_state", {}]], out: { answer: "The most dangerous one in Roost 1 is the summer capacity squeeze: 18% late against 7% for Parks, $8,640 in 2024. The flyway lifts June to August from 69.3% to 100.0%.", actions: [], sources: [] } });
  const A = TA.create(E, Z, smp, ui());
  const r = await A.ask("which predator should worry me most in this roost?");
  assert.strictEqual(r.mode, "live"); assert.strictEqual(r.checked, true, "every figure is in the page state"); assert(/\$8,640/.test(r.answer));
  assert(smp.prompts[0].includes("On the page now (data, from the page itself): Active: Roost 1"), "the summary is in the prompt");
  assert(/call session_state/.test(smp.prompts[0]));
  assert(r.source_chips.some(c => c.label === "This page, right now"));
});
test("with the model: a figure that is not in the page state is still removed", async () => {
  const said = "The capacity squeeze costs $99,999 a year.";
  const smp = fakeSample({ calls: [["session_state", {}]], out: { answer: said, actions: [], sources: [] }, fix: said });
  const r = await TA.create(E, Z, smp, ui()).ask("what is the costliest predator here?");
  assert(!/99,999/.test(r.answer), "never shown"); assert(r.checked === false || r.mode === "rules", "dropped, or the rules answer from the page state instead");
});
test("a follow-up uses the chat: the history keeps the last six turns", async () => {
  let n = 0; const smp = fakeSample({ out: () => ({ answer: `Answer ${++n}.`, actions: [], sources: [] }) });
  const A = TA.create(E, Z, smp, ui());
  for (let i = 1; i <= 8; i++) await A.ask(`Why does Transportation hire in month ${i}?`);
  const last = smp.prompts[smp.prompts.length - 1], hist = last.slice(last.indexOf("<history>"), last.indexOf("</history>"));
  assert(!/month 1\?/.test(hist) && /month 2\?/.test(hist) && /month 7\?/.test(hist), "turns 2 to 7 are in the history, turn 1 has dropped out");
  assert.strictEqual((hist.match(/^Q: /gm) || []).length, 6);
  A.reset(); assert.strictEqual(A.history().length, 0, "New chat clears the memory");
});
test("offline follow-up: 'and Transportation?' carries the question over", async () => {
  const A = TA.create(E, Z, null, ui());
  await A.ask("Why does Parks hire in June?");
  const r = await A.ask("and Transportation?");
  assert(/^Transportation/.test(r.answer), r.answer);
});
test("a ticket the dock routed joins the memory, so a follow-up can refer to it", async () => {
  const smp = fakeSample({ out: { answer: "It goes to the district crew.", actions: [], sources: [] } });
  const A = TA.create(E, Z, smp, ui());
  A.note("There is a pothole on Centre St", "Your report became a ticket: Pothole Repair, Public Works.");
  await A.ask("Which department handles the ticket I just reported?");
  assert(/Pothole Repair, Public Works/.test(smp.prompts[0]));
});
test("emergencies: call 911 first, no model call, no ticket", async () => {
  const smp = fakeSample({ out: { answer: "x", actions: [], sources: [] } });
  const A = TA.create(E, Z, smp, ui());
  for (const t of ["there is fire in Roxbury", "I smell gas in my building", "a live wire is down on Centre St", "someone is hurt in the park", "hay un incendio en Dorchester"]) {
    const r = await A.ask(t);
    assert.strictEqual(r.route, "emergency", t); assert(r.answer.startsWith("This sounds like an emergency. Call 911 now."), t);
    assert(!r.handoff, "never handed to the intake");
    const k = await TI.create(E, null).route(t); assert(k.emergency && !k.choice && !k.ask, "the intake refuses to ticket it: " + t);
  }
  assert.strictEqual(smp.prompts.length, 0, "the model is never asked");
  for (const t of ["The fire hydrant on my street is leaking", "What if I fire 2 Parks crews in June?", "Fireworks every night on Dorchester Ave", "My smoke detector keeps chirping"]) assert.notStrictEqual(TA.create(E, Z, null, ui()).route(t).route, "emergency", t);
});

// the failure card and the flyway as session.js now reports them
const SNAP2 = JSON.parse(JSON.stringify(SNAP));
Object.assign(SNAP2.active_roost, { failure: { goal: "80% on time in June to August", last_year_on_time: "74%", last_year_requests: 5120, forecast_plan_on_time: "69.3%", breaks_at: "+20% demand", holds_at_busier_year: false, flip_line: null },
  flyway: { decisions: [{ department: "Parks", action: "hire", crews: 2, starts: "June", sign_by: "30 April" }], payroll_added: "$160,000", overdue_cost_avoided: "$196,120", on_time_original_plan: "69.3%", on_time_flyway: "100.0%" } });
test("offline: what does the flip mean here comes from the failure card, not the glossary", async () => {
  const A = TA.create(E, Z, null, ui(SNAP2));
  for (const q of ["What does the flip mean here?", "explain this flip"]) {
    const r = await A.ask(q);
    assert.strictEqual(r.mode, "rules"); assert(!/^From the glossary/.test(r.answer), r.answer);
    assert(/80% on time in June to August/.test(r.answer) && /74%/.test(r.answer) && /69\.3%/.test(r.answer) && /\+20% demand/.test(r.answer), r.answer);
    assert(r.source_chips.some(c => c.label === "This page, right now") && !r.source_chips.some(c => /Glossary/.test(c.label)));
  }
});
test("offline: the current flyway lists its dated decisions, crews, months and cost", async () => {
  const r = await TA.create(E, Z, null, ui(SNAP2)).ask("What does the current Flyway?");
  assert(/Hire 2 Parks crews from June, signed by 30 April/.test(r.answer) && /\$160,000/.test(r.answer) && /69\.3% to 100\.0%/.test(r.answer), r.answer);
  assert(!/^From the glossary/.test(r.answer)); assert.deepStrictEqual(r.actions, [{ type: "zoom", level: 1, dept: "PARK", month: null }]);
  const n = await TA.create(E, Z, null, ui(Object.assign({}, SNAP2, { active_roost: null }))).ask("what is this flyway");
  assert(/There is no flyway yet/.test(n.answer), n.answer);
  const w = await TA.create(E, Z, null, ui(SNAP2)).ask("what am I looking at");
  assert(/last year was 74%/.test(w.answer) && /breaks at \+20% demand/.test(w.answer), w.answer);
});
test("offline: you are wrong shows the numbers behind the last answer; thanks gets a short reply; unrelated stays out of scope", async () => {
  const A = TA.create(E, Z, null, ui(SNAP2));
  await A.ask("What does the current Flyway?");
  const w = await A.ask("you are wrong");
  assert.strictEqual(w.route, "chat"); assert(/^Which part looks wrong\? Here are the numbers behind my last answer: /.test(w.answer) && /\$160,000|69\.3%|Roost 1/.test(w.answer), w.answer);
  assert(!/outside what I can help/.test(w.answer));
  const t = await A.ask("thank you!"); assert(t.answer.length < 90 && /Glad/.test(t.answer), t.answer);
  const n = await A.ask("no"); assert(/^Which part looks wrong/.test(n.answer), "small talk does not become the last answer");
  const o = await A.ask("what's the capital of France?"); assert.strictEqual(o.route, "out_of_scope");
});

// ---- the screen block: session.js run over a stand-in for the page's renderer state (Compare on Parks' year, A the Original plan, B the Flyway)
function screenSnap(compare = true) {
  const mo = (have, need, state) => ({ have, need, state });
  const months = [mo(6, 5, "spare"), mo(6, 5, "spare"), mo(6, 5, "spare"), mo(6, 5, "spare"), mo(6, 6, "spare"), mo(6, 8, "short"), mo(6, 9, "short"), mo(6, 7, "behind_not_late"), mo(6, 5, "spare"), mo(6, 5, "spare"), mo(6, 5, "spare"), mo(6, 5, "spare")];
  const ont = v => Array.from({ length: 12 }, (_, i) => (i >= 5 && i <= 7 ? v : 0.95));
  const sc = (label, w, ot, crews) => ({ label, dept: "PARK", depts: ["PARK"], windowOntime: w, ontime: ot, window: { months: [6, 7, 8] }, plan: { crews, seasonal: Array(12).fill(0) } });
  const A = sc("Roost 1 · Original plan", 0.693, ont(0.693), Array(12).fill(6)), B = sc("Roost 1 · Flyway", 1.0, ont(1.0), [6, 6, 6, 6, 6, 8, 8, 8, 6, 6, 6, 6]);
  global.__zoom = { info: { PARK: { name: "Parks", months, training: [{ month: 4, crews: 2 }], decisions: [] } }, DEPTS: ["PWDx", "BTDT", "PARK", "ISD"], S: { lvl: 1, d: "PARK", m: 6 }, planFly: true,
    goalSpec: { depts: ["PARK"], goal: { months: [6, 7, 8] }, dusk: { day: 119, date: "2025-04-30" }, owls: [{ dept: "PARK", months: [6, 7], name: "Equipment Repair capacity squeeze in summer" }] },
    hires: () => [{ crews: 2, month: 5, decide_by: "2025-04-30" }], newHires: () => [], Z: { forecast: () => ({ ready: true }) } };
  global.TerryState = { roosts: [], activeRoost: null, screen: { level: 1, dept: "PARK" }, compare: compare ? { a: A, b: B } : null };
  global.TerryAlmanac = { beats: [{ when: "JUN", num: "+31PTS", text: "Flyway leads in <b>June</b>" }] };
  delete require.cache[require.resolve(path.join(ROOT, "app/zoom/session.js"))]; req("app/zoom/session.js");
  const s = global.TerrySession.snapshot(), line = global.TerrySession.summary();
  return { snap: Object.assign({}, SNAP, { screen: Object.assign({}, s.screen, { mode: compare ? "Compare" : "Flyway" }), compare: s.compare }), line };
}
test("screen block: session.js says what is drawn in Compare, from the renderers' state", async () => {
  const { snap, line } = screenSnap(), d = snap.screen.drawn;
  assert(/^the black outlines are B, the Flyway/.test(d.outlines) && /solid filled bars are A, the Original plan/.test(d.solid), JSON.stringify(d));
  assert(/"Flyway \+30\.7 pts" is B's on-time lead over A in the goal window \(June to August\)/.test(d.header), d.header);
  assert(/green where B is ahead/.test(d.numbers) && /Jun \+30\.7/.test(d.numbers), d.numbers);
  assert(/owls mark predator months \(Equipment Repair capacity squeeze in summer: Jun, Jul\)/.test(d.owls), d.owls);
  assert(/hatched ochre is behind but not late \(Aug\)/.test(d.hatched) && /red is short.*\(Jun, Jul\)/.test(d.red) && /30 April/.test(d.dusk) && /\+2 Jun/.test(d.pills) && d.band, JSON.stringify(d));
  assert(/Screen \(exactly what is drawn now\):/.test(line) && /Almanac board: JUN \+31PTS Flyway leads in June/.test(line), line);
  assert(!/[–—]|--/.test(line), "no dashes");
});
test("with the model: the Compare outlines question gets the screen block in the prompt", async () => {
  const { snap, line } = screenSnap();
  const smp = fakeSample({ out: { answer: "Yes, the black outlines are B, the Flyway, drawn over the Original plan's solid bars.", actions: [], sources: [] } });
  const r = await TA.create(E, Z, smp, { session: () => snap, sessionSummary: () => line }).ask("the black outlines are B?");
  assert.strictEqual(r.mode, "live");
  assert(smp.prompts[0].includes("the black outlines are B, the Flyway") && smp.prompts[0].includes("Flyway +30.7 pts"), "the screen block reaches the model");
  assert(/Never say you cannot see the screen/.test(smp.prompts[0]));
});
test("offline: outlines, owls, hatched and green numbers come from the screen block", async () => {
  const { snap, line } = screenSnap(), A = TA.create(E, Z, null, { session: () => snap, sessionSummary: () => line });
  const o = await A.ask("the black outlines are B?"); assert.strictEqual(o.mode, "rules"); assert(/^The black outlines are B, the Flyway/.test(o.answer), o.answer);
  const w = await A.ask("what are the owls?"); assert(/owls mark predator months \(Equipment Repair capacity squeeze in summer: Jun, Jul\)/.test(w.answer), w.answer);
  const h = await A.ask("what does hatched mean here"); assert(/behind but not late \(Aug\)/.test(h.answer) && /paid training/.test(h.answer), h.answer);
  const g = await A.ask("what are the green numbers under the months?"); assert(/B minus A on-time points/.test(g.answer) && /green where B is ahead/.test(g.answer), g.answer);
  const { snap: s2, line: l2 } = screenSnap(false), N = TA.create(E, Z, null, { session: () => s2, sessionSummary: () => l2 });
  assert(/no black outlines on the screen right now: they appear in Compare/.test((await N.ask("what are the black outlines")).answer));
  assert(/^The blue bars are crews planned/.test((await N.ask("what are the solid bars")).answer));
});
(async () => {
  let bad = 0;
  for (const [name, fn] of tests) { try { await fn(); console.log("ok   ", name); } catch (e) { bad++; console.log("FAIL ", name, "\n      ", e && e.message); } }
  console.log(`\n${tests.length - bad} of ${tests.length} passed`); process.exit(bad ? 1 : 0);
})();
