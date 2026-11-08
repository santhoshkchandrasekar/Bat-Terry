// Every predator card the page can print, checked for contradictions (no browser): for each goal a viewer can set, run the
// page's flip (saved predators, as with live answers off) and flyway, then the card's own answer() and the tally line, and test
// rules a reader would catch. Run from the repo root: node notebooks/card_audit.cjs [--json]
const fs = require("fs"), path = require("path"), ROOT = path.resolve(__dirname, "..");
global.window = global; window.TerryArt = { ic: n => `[${n}]` };
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8"));
const E = require(path.join(ROOT, "app/live/engine.js")).create(DATA);
const T = require(path.join(ROOT, "app/live/terry.js")).create(E, null), TF = require(path.join(ROOT, "app/live/flyover.js"));
require(path.join(ROOT, "app/zoom/plates.js")); const P = window.TerryPlates;
const strip = s => String(s || "").replace(/<[^>]+>/g, "").replace(/\[[a-z]+\]/g, "").replace(/\s+/g, " ").trim();
const RULES = {
  // a rejected card never calls a cell "not a threat" while it ran 10+ points later than its department
  rejected_but_late: (c) => c.v === "REJECTED" && /Not a threat in 2024/.test(c.line) && c.rate != null && c.rate > c.dept + 0.10 ? "says not a threat while far later than the department" : "",
  // the years label never says "not late" about a cell that was late but too small
  years_label: (c) => c.v === "REJECTED" && c.reason === "small" && /Not late in either year/.test(c.years) ? "too small shown as not late" : "",
  // "covers it" only when the department reaches the goal in the predator's months and the type keeps up when it does
  covers_claim: (c) => /Flyway covers it/.test(c.line) && (c.o && (c.o.kind === "process" || c.o.dept_flyway.o < c.goal.target - 0.0005)) ? "covers it, but the department or the type does not reach the goal" : "",
  // a process card names real best-month numbers, and they are under the goal
  process_numbers: (c) => c.kind === "process" && (!c.o || !c.o.floor_2024 || c.o.floor_2024.type_ontime >= c.goal.target) ? "process card without a best-months figure under the goal" : "",
  // department-wide wording only when the department itself stayed under the goal in its best months
  dept_wide: (c) => /Not this predator alone/.test(c.line) && !(c.o && c.o.floor_2024 && c.o.floor_2024.dept_ontime < c.goal.target) ? "department-wide wording, but the department did reach the goal" : "",
  // "too small to count" only for a cell under 20 late and under $5,000
  small_claim: (c) => /Too small to threaten/.test(c.line) && (c.late >= 20 || c.cost >= 5000) ? "too small, but it has 20+ late or $5,000+" : "",
  // a share beside a goal it misses never rounds up to the goal
  rounding: (c) => /(\d+(\.\d+)?)% on time/.test(c.line + " " + c.detail) && c.goal.target === 1 && /100\.0% on time in the crew model/.test(c.detail) && c.o && c.o.dept_flyway.o < 1 ? "a miss of 100% printed as 100.0%" : "",
};
(async () => {
  const out = [], tallies = new Set(), goalFlags = [], goals = [];
  for (const scope of ["PWDx", "BTDT", "PARK", "ISD", "CITY"]) {
    for (let m = 1; m <= 12; m++) for (const target of [0.8, 0.9, 0.95, 1.0]) goals.push({ scope, hood: null, months: [m], target });
    for (const months of [[6, 7, 8], [1, 2, 3], [11, 12], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]) for (const target of [0.5, 0.7, 0.9]) goals.push({ scope, hood: null, months, target });
    for (const hood of ["Dorchester", "Roxbury", "South End", "East Boston"]) for (const target of [0.8, 0.9]) goals.push({ scope, hood, months: [8], target });
  }
  for (const goal of goals) {
    const scope = goal.scope, m = goal.months.join("-"), target = goal.target, F = TF.create(E, T, null); F.setGoal(goal);
    const fl = await F.flip(goal), X = await F.escape(goal, { predators: fl.predators }), ctx = { E, F, X, goal };
    // the verdict agrees with the weakest department's bars (a city goal holds only when every department does)
    { const w = X.weakest, t = goal.target, v = X.verdict, bad = v === "escaped" && !(w.stay.window < t && w.escape.window >= t) ? "escaped, but the weakest department's bars disagree"
        : v === "already" && w.stay.window < t ? "already safe, but a department is under the goal" : v === "unreachable" && (w.escape.window >= t || !X.limits.length) ? "unreachable, but every department reaches it" : "";
      if (bad) goalFlags.push(`${scope} ${m}${goal.hood ? " " + goal.hood : ""} ${t}: ${bad}`); }
    tallies.add(strip(P.tallyText(fl.predators, ctx)));
    for (const p of fl.predators) {
      const a = P.answer(p, ctx); if (!a) continue;
      const ev = p.evidence, c = { goal, v: ev.verdict, reason: ev.reason, late: ev.overdue_2024 || 0, cost: ev.cost_2024_usd || 0, years: ev.years_text || "", kind: a.kind, line: strip(a.line), detail: strip(a.detail.join(" ")), o: X.preds && X.preds[p.hypothesis.name],
        rate: ev.requests_2024 ? ev.overdue_2024 / ev.requests_2024 : null, dept: DATA.dept_late_2024[p.hypothesis.department] };
      c.flags = Object.entries(RULES).map(([k, f]) => [k, f(c)]).filter(x => x[1]);
      out.push({ g: `${scope} ${m}${goal.hood ? " " + goal.hood : ""} ${target}`, name: p.hypothesis.name, verdict: c.v, kind: c.kind, line: c.line, flags: c.flags });
    }
  }
  const bad = out.filter(c => c.flags.length), kinds = {}; out.forEach(c => (kinds[c.kind] = (kinds[c.kind] || 0) + 1));
  const summary = { goals: goals.length, cards: out.length, flagged: bad.length, goal_flags: goalFlags.length, kinds, distinct_lines: new Set(out.map(c => c.line)).size, tally_lines: [...tallies].slice(0, 12) };
  if (process.argv.includes("--json")) console.log(JSON.stringify({ summary, flagged: bad.slice(0, 40) }));
  else { console.log(JSON.stringify(summary, null, 1)); for (const c of bad.slice(0, 20)) console.log(c.g, "|", c.name, "|", c.line, "|", c.flags.map(f => f.join(": ")).join("; ")); goalFlags.slice(0, 10).forEach(g => console.log("GOAL", g)); }
  process.exit(bad.length || goalFlags.length ? 1 : 0);
})();
