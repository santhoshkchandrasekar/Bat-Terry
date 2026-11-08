// The page's flyway, run from the notebook: the same engine and flyover code the page uses (no model, no browser).
//   node notebooks/flyway_demo.cjs goal   < {"goal": {...}, "predators": [{hypothesis, evidence}]}   -> the flyway and each predator's fix
//   node notebooks/flyway_demo.cjs split                                                             -> crews-or-process for every confirmed predator, 2024 vs 2023
const fs = require("fs"), path = require("path"), ROOT = path.resolve(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8"));
const E = require(path.join(ROOT, "app/live/engine.js")).create(DATA);
const T = require(path.join(ROOT, "app/live/terry.js")).create(E, null), TF = require(path.join(ROOT, "app/live/flyover.js"));
const rG = (v, t) => { const a = Math.round(v * 1000) / 10; return v < t && a >= t * 100 ? Math.floor(v * 10000) / 100 : a; };   // never rounds a miss up to the goal
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], r1 = v => Math.round(v * 1000) / 10;

async function goalRun(inp) {
  const goal = { hood: null, ...inp.goal }, F = TF.create(E, T, null); F.setGoal(goal);
  // place the predators the way the page's flip does (months in or just before the window), with the page's echolocation
  const preds = (inp.predators || []).map(p => { const h = p.hypothesis || p, ms = h.months && h.months.length ? h.months : goal.months;
    return { hypothesis: h, evidence: E.echo(h), place: { months: ms, in_window: ms.some(m => goal.months.includes(m)) } }; });
  const X = await F.escape(goal, { predators: preds });
  const moves = Object.entries(X.depts).filter(([, x]) => x.changed).map(([d, x]) => ({ department: E.depts[d].name, crews: x.how.k, from: MON[x.how.m - 1], kind: x.how.kind,
    why: x.how.alt ? (x.how.alt.latest ? "starting any later misses the goal" : `starting in ${MON[x.how.alt.m - 1]} also works with ${x.how.alt.k} crew(s) but costs $${Math.round(x.how.alt.extra_cost / 1000)}k more`) : "" }));
  const fixes = preds.filter(p => X.preds[p.hypothesis.name]).map(p => { const o = X.preds[p.hypothesis.name], f = o.floor_2024, g = o.floor_2023;
    return { predator: p.hypothesis.name, fix: o.kind, best_months_2024: f ? `${r1(f.type_ontime)}% on time (${f.months.map(m => MON[m - 1]).join(", ")}; department ${r1(f.dept_ontime)}%)` : "too few",
             best_months_2023: g ? `${r1(g.type_ontime)}% on time` : "too few", department_in_flyway: `${r1(o.dept_flyway.o)}% in ${MON[o.dept_flyway.m - 1]}` }; });
  return { goal: F.goalText(goal), verdict: X.verdict, hot_year_pct: X.hot_pct, original_plan: rG(X.totals.stay.window, goal.target), flyway: rG(X.totals.escape.window, goal.target), moves, flies_through: X.shocks,
           cannot_reach: (X.limits || []).map(l => l.dusk_passed ? `${l.name}: Dusk has passed` : `${l.name}: even +${l.k} crews from ${MON[l.from - 1]} reach ${rG(l.best_window, goal.target)}%`), predator_fixes: fixes };
}
// every confirmed crew predator Terry has (the saved sets and the flip evaluation): does the 2024 best-months test agree with 2023's?
function split() {
  const rows = [], seen = new Set(), csv = path.join(ROOT, "data/processed/eval_flip.csv");
  const hyps = DATA.showcase.flatMap(s => s.predators.map(p => p.hypothesis));
  if (fs.existsSync(csv)) { const [hd, ...ls] = fs.readFileSync(csv, "utf8").trim().split("\n"), H = hd.split(",");
    const ix = k => H.indexOf(k); for (const l of ls) { const c = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(x => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
      if (ix("type") >= 0 && c[ix("type")]) hyps.push({ kind: "miss", department: c[ix("dept")], request_type: c[ix("type")], neighborhood: c[ix("neighborhood")] || null, months: [] }); } }
  for (const h of hyps) {
    if (!h.request_type || h.kind === "silence" || h.kind === "shock") continue;
    const key = [h.department, h.request_type, h.neighborhood || ""].join("|"); if (seen.has(key)) continue; seen.add(key);
    if (E.echo(h).verdict !== "CONFIRMED") continue;
    const a = E.typeFloor(h.department, h.request_type, h.neighborhood || null), b = E.typeFloor(h.department, h.request_type, h.neighborhood || null, DATA.cells_2023);
    rows.push({ department: E.depts[h.department].name, type: h.request_type, neighborhood: h.neighborhood || "citywide",
                best_2024: a ? r1(a.type_ontime) : null, best_2023: b ? r1(b.type_ontime) : null,
                fix_2024: a ? (a.type_ontime >= 0.9 ? "crews" : "process") : "unknown", fix_2023: b ? (b.type_ontime >= 0.9 ? "crews" : "process") : "unknown" });
  }
  return rows;
}
(async () => {
  const mode = process.argv[2];
  if (mode === "goal") { const inp = JSON.parse(fs.readFileSync(0, "utf8")); console.log(JSON.stringify(await goalRun(inp))); }
  else if (mode === "split") console.log(JSON.stringify(split()));
  else { console.error("usage: flyway_demo.cjs goal|split"); process.exit(2); }
})();
