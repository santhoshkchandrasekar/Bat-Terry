// Pinged events never make the flyway smaller: for each goal, the flyway without an event and with a storm or a walkout. With the
// event the plan must still pass the goal's own busier-year test, so its added crew-months can only stay or grow.
// Run from the repo root: node notebooks/event_audit.cjs   (exits 1 on any goal where an event shrinks the flyway)
const fs = require("fs"), path = require("path"), ROOT = path.resolve(__dirname, "..");
global.window = global; window.TerryArt = { ic: n => `[${n}]` };
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8")), E = require(path.join(ROOT, "app/live/engine.js")).create(DATA);
const T = require(path.join(ROOT, "app/live/terry.js")).create(E, null), TF = require(path.join(ROOT, "app/live/flyover.js"));
const added = X => Object.values(X.depts).reduce((s, x) => s + x.escape.plan.crews.reduce((a, v, i) => a + v - x.stay.plan.crews[i], 0) + x.escape.plan.seasonal.reduce((a, v, i) => a + 1.3 * (v - x.stay.plan.seasonal[i]), 0), 0);
(async () => {
  const goals = [], events = ["A blizzard hits on February 3", "A windstorm hits on June 2", "A heat wave hits on July 15", "20% of crews quit on May 1", "Move-in weekend on September 1"];
  for (const scope of ["PWDx", "BTDT", "PARK", "ISD"]) for (const months of [[2], [6, 7, 8], [8], [11]]) for (const target of [0.8, 0.9, 0.95]) goals.push({ scope, hood: null, months, target });
  let n = 0, bad = [];
  for (const goal of goals) {
    const F = TF.create(E, T, null); F.setGoal(goal); const fl = await F.flip(goal), X0 = await F.escape(goal, { predators: fl.predators }), a0 = added(X0);
    for (const ev of events) {
      F.clearPings(); const msg = /quit/.test(ev) ? ev.replace("crews", `${E.depts[goal.scope].name} crews`) : ev;
      const r = await F.ping(msg); if (r.kind !== "ping") continue;
      const X1 = await F.escape(goal, { predators: fl.predators }), a1 = added(X1); n++;
      const shrank = a1 < a0 - 1e-9 && X0.verdict !== "unreachable" && X1.verdict !== "unreachable";
      if (shrank) bad.push(`${goal.scope} ${goal.months.join("-")} ${goal.target} + ${ev}: ${a0.toFixed(1)} -> ${a1.toFixed(1)} crew-months`);
    }
  }
  console.log(JSON.stringify({ goals: goals.length, runs: n, shrank: bad.length, examples: bad.slice(0, 10) }, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
