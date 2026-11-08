// Runs the page's own GenAI code (app/zoom/ask.js, app/zoom/stream.js, app/live/flyover.js) headless in Node, so the
// notebook (section 6.5) can show what each feature does. Prints one JSON object to stdout.
//
//   node notebooks/genai_demo.cjs ask             Ask Terry, rules path (no key needed)
//   node notebooks/genai_demo.cjs stream          the resident message stream: a normal day and a surge day
//   node notebooks/genai_demo.cjs alerts          alert to event (F.ping), sized from real analogues
//
// Run from the repo root. The live model path is evaluated separately on OpenAI (notebooks/ping_live_eval.cjs).
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const req = p => require(path.join(ROOT, p));

const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8"));
const E = req("app/live/engine.js").create(DATA);
const Z = req("app/zoom/levels.js").create(E);
const TerryAsk = req("app/zoom/ask.js"), TerryStream = req("app/zoom/stream.js");
const TerryLive = req("app/live/terry.js"), TerryFlyover = req("app/live/flyover.js");
const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const r3 = v => Math.round(v * 1000) / 1000;


// ------------------------------------------------------------------ Ask Terry
function guardrail(answer, trace) {
  const facts = trace.filter(t => t.result).map(t => t.result);
  const NUM = /\$?\d[\d,]*\.?\d*\s*(?:%|[kKmM]\b)?/g;
  const numbers = [...String(answer).matchAll(NUM)].map(m => m[0].trim());
  return { numbers_in_answer: numbers, unverified: E.unverifiedNumbers(answer, facts) };
}
async function ask(questions) {
  const A = TerryAsk.create(E, Z, null);
  const out = [];
  for (const q of questions) {
    const r = await A.ask(q);
    out.push({ question: q, mode: r.mode, answer: r.answer, actions: r.actions, trace: r.trace, guardrail: guardrail(r.answer, r.trace) });
  }
  // the tool the model agent reaches for on a what-if, called directly (the rules path has no what-if branch)
  const whatIf = A.tools.what_if_crews.run({ dept: "BTDT", from: "November", change: 2 });
  return { questions: out, what_if_tool: whatIf };
}

// ------------------------------------------------------------------ the resident stream
function stream() {
  const T = TerryLive.create(E, null);
  const plan = Z.plans.terry;
  const run = async (iso, n, tilt) => {
    const S = TerryStream.create(E, T, null), t = E.dayOf(iso);
    const msgs = S.batch(t, n, tilt), routed = [];
    for (const m of msgs) routed.push(await S.route(m));
    const w = S.warn(t, routed, plan);
    const exp = S.expectedShare(t), nRouted = routed.filter(r => r.dept).length || 1;
    for (const d of DEPTS) { const s = w.shares[d]; s.z = r3((s.seen - exp[d] * nRouted) / Math.sqrt(Math.max(exp[d] * nRouted, 1))); }
    return { date: iso, messages: routed.length, tilt, routed: routed.map(r => ({ text: r.text.slice(0, 110), routed_type: r.type, routed_dept: r.dept,
             follow_up: r.follow_up, true_dept: r.truth, mode: r.mode })),
             dept_correct: routed.filter(r => r.dept === r.truth).length, asked: routed.filter(r => !r.dept).length,
             shares: w.shares, alerts: w.alerts.map(a => ({ ...a, month_ontime_plan: r3(a.month_ontime_plan), month_ontime_week: r3(a.month_ontime_week), month_ontime_month: r3(a.month_ontime_month) })) };
  };
  return (async () => ({
    held_out_messages: (E.data.stream || []).length,
    normal: await run("2025-07-15", 20, {}),
    // Transportation running hot: at 2.2x its usual weight the count is up but not past z = 2, so nothing fires;
    // at 3x it is past both bars (6 or more seen, z of 2 or more) and the warning fires
    near_miss: await run("2025-09-10", 40, { BTDT: 2.2 }),
    surge: await run("2025-09-10", 40, { BTDT: 3.0 }),
  }))();
}

// ------------------------------------------------------------------ alert to event
async function alerts() {
  const T = TerryLive.create(E, null);
  const cases = [
    { alert: "Winter storm warning: 12 to 18 inches of snow expected from February 3, heaviest overnight.", goal: { scope: "CITY", hood: null, months: [2], target: 0.9 } },
    { alert: "Move-in weekend note: students arrive September 1, expect heavy curbside trash and double parking around the colleges.", goal: { scope: "CITY", hood: null, months: [9], target: 0.9 } },
  ];
  const out = [];
  for (const c of cases) {
    const F = TerryFlyover.create(E, T, null);
    F.setGoal(c.goal);
    const r = await F.ping(c.alert);
    if (r.kind !== "ping") { out.push({ alert: c.alert, reply: r }); continue; }
    const analogue = (E.data.analogues || []).find(a => r.label.includes(a.label)) || null;
    const months = [...new Set(r.events.map(e => E.MONTH_OF_DAY[e.start]))];
    const before_after = [];
    for (const d of [...new Set(r.events.map(e => e.dept))]) {
      const p = Z.plans.terry[d], ev = E.eventArrays(d, r.events);
      const base = E.simulate(d, p.crews, p.seasonal, {}), hit = E.simulate(d, p.crews, p.seasonal, { dayMult: ev.dayMult, capMult: ev.capMult });
      const ot = (s, m) => { const x = s.monthly[m]; return x.closed_targeted > 0 ? Math.max(0, 1 - x.overdue / x.closed_targeted) : 1; };
      for (const m of months) before_after.push({ dept: d, name: NAMES[d], month: MONTHS[m], requests_before: Math.round(base.monthly[m].demand),
        requests_after: Math.round(hit.monthly[m].demand), ontime_before: r3(ot(base, m)), ontime_after: r3(ot(hit, m)),
        overdue_cost_change: Math.round(hit.overdue_cost + hit.backlog_cost - base.overdue_cost - base.backlog_cost) });
    }
    out.push({ alert: c.alert, goal: F.goalText(c.goal), label: r.label, source: r.source, analogue,
               events: r.events.map(e => ({ dept: e.dept, start: E.isoOf(e.start), days: e.days, mult: e.mult, kind: e.kind })),
               lines: r.lines, verdict: r.verdict, before_after });
  }
  return { alerts: out };
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  let res;
  if (cmd === "ask") res = await ask(rest.length ? rest : ["Why does Parks need more crews in summer?", "What happens if I add 2 Transportation crews in November?"]);
  else if (cmd === "stream") res = await stream();
  else if (cmd === "alerts") res = await alerts();
  else { console.error("usage: node notebooks/genai_demo.cjs ask|stream|alerts"); process.exit(2); }
  process.stdout.write(JSON.stringify(res, (k, v) => (v instanceof Float64Array ? undefined : v)));
})().catch(e => { process.stdout.write(JSON.stringify({ error: String(e && e.message || e) })); process.exit(1); });
