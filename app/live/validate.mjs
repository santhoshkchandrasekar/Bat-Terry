// Validate the browser engine against the Python results (run: node app/live/validate.mjs from repo root).
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { create } = require("./engine.js");
const DATA = JSON.parse(readFileSync("app/live/data.json", "utf8"));
const E = create(DATA);

function csv(path) {
  const [h, ...rows] = readFileSync(path, "utf8").trim().split("\n");
  const keys = h.split(",");
  return rows.map(r => Object.fromEntries(r.split(",").map((v, i) => [keys[i], isNaN(+v) ? v : +v])));
}
const PE = csv("data/processed/plan_expected.csv");
const PS = csv("data/processed/plan_scenarios.csv");

let worst = { cost: 0, ontime: 0 };
console.log("dept  plan        py_cost     js_cost    diff%   py_ontime js_ontime");
for (const d of ["PWDx", "BTDT", "PARK", "ISD"]) {
  for (const plan of ["do_nothing", "passive", "neutral", "aggressive"]) {
    const p = DATA.plans[d][plan];
    const js = E.expected(d, p.crews, p.seasonal);
    const py = PE.find(r => r.dept === d && r.plan === plan);
    const dc = (js.total_cost / py.total_cost - 1) * 100, dot = (js.ontime_rate - py.ontime_rate) * 100;
    worst.cost = Math.max(worst.cost, Math.abs(dc)); worst.ontime = Math.max(worst.ontime, Math.abs(dot));
    console.log(`${d.padEnd(5)} ${plan.padEnd(11)} ${(py.total_cost / 1e6).toFixed(3).padStart(8)}M ${(js.total_cost / 1e6).toFixed(3).padStart(8)}M ${dc.toFixed(2).padStart(6)}%   ${py.ontime_rate.toFixed(3)}     ${js.ontime_rate.toFixed(3)}`);
  }
}
console.log(`\nworst |cost diff| ${worst.cost.toFixed(2)}%, worst |on-time diff| ${worst.ontime.toFixed(2)} pts`);

console.log("\nScenario on-time, neutral plan (py vs js):");
for (const d of ["PWDx", "BTDT", "PARK", "ISD"]) {
  const p = DATA.plans[d].neutral, row = [];
  for (const m of [0.8, 0.86, 1.0, 1.14, 1.2]) {
    const py = PS.find(r => r.dept === d && r.plan === "neutral" && r.scenario === "x" + m.toFixed(2));
    const js = E.simulate(d, p.crews, p.seasonal, { mult: m });
    row.push(`x${m.toFixed(2)} ${py.ontime_rate.toFixed(3)}/${js.ontime_rate.toFixed(3)}`);
  }
  console.log(d, row.join("  "));
}

let t0 = performance.now(); for (let i = 0; i < 50; i++) E.simulate("PWDx", DATA.plans.PWDx.neutral.crews, null, { mult: 1 + i * 0.001 });
console.log(`\nsimulate: ${((performance.now() - t0) / 50).toFixed(1)} ms per year (fresh arrivals each run)`);
const a = E.arrivals("PWDx", E.target("PWDx")); t0 = performance.now();
for (let i = 0; i < 200; i++) E.simulate("PWDx", DATA.plans.PWDx.neutral.crews, null, { arrivals: a });
console.log(`simulate: ${((performance.now() - t0) / 200).toFixed(2)} ms per year (cached arrivals)`);

for (const [d, mode] of [["BTDT", "neutral"], ["PARK", "neutral"], ["PWDx", "neutral"]]) {
  t0 = performance.now();
  const r = E.optimize(d, mode);
  console.log(`optimize ${d} ${mode}: ${((performance.now() - t0) / 1000).toFixed(1)} s, ${r.evals} evals`);
  console.log("   js crews", r.crews.join(","), "| py crews", DATA.plans[d][mode].crews.join(","), "| seasonal js", r.seasonal.join(","));
}
const bp = E.breakPoint("BTDT", DATA.plans.BTDT.neutral.crews, DATA.plans.BTDT.neutral.seasonal);
console.log("\nbreak point BTDT neutral (py 16):", bp);
console.log("echo check:", JSON.stringify(E.echo({ kind: "miss", department: "BTDT", request_type: "Parking Enforcement", neighborhood: "Dorchester", months: [5, 9, 10] })));
console.log("calendar BTDT:", JSON.stringify(E.decisions("BTDT", DATA.plans.BTDT.neutral.crews)));
console.log("unverified('$2.81M and 92%', {a: 2805080, b: 0.917}):", E.unverifiedNumbers("$2.81M and 92%", { a: 2805080, b: 0.917 }));
console.log("retrieve:", E.retrieve("big hole on Centre St near the T stop", "pothole in the street").slice(0, 3).map(c => c.type));
