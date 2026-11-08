// Plumbing test for terry.js with a scripted stand-in for the model (run from repo root: node app/live/test_terry.mjs)
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const E = require("./engine.js").create(JSON.parse(readFileSync("app/live/data.json", "utf8")));
const { create } = require("./terry.js");

const calls = [];
const fake = async (input, opts) => { throw new Error("plain sample not used"); };
fake.json = async (input, opts = {}) => {
  calls.push({ tier: opts.modelTier, tools: (opts.tools || []).map(t => t.name) });
  if (input.includes("Reply with only JSON {\"inverted\"")) return { inverted: "On December 31, 2025, I failed, just as in 2024." };
  if (input.startsWith("You are Terry, a planning")) return {
    target_department: "BTDT",
    inverted: "On December 31, 2025, I failed, just as in 2024, when 4,302 Parking Enforcement requests in South Boston / South Boston Waterfront went late, and 99,999 more.",
    predators: [
      { name: "Dorchester parking", department: "BTDT", request_type: "parking enforcement", neighborhood: "dorchester", months: [5, 9, 10], kind: "miss" },
      { name: "Made-up type", department: "BTDT", request_type: "Hoverboard Complaints", neighborhood: null, months: [], kind: "miss" },
      { name: "Wrong dept", department: "PWDx", request_type: "Request for Pothole Repair", neighborhood: null, months: [], kind: "miss" },
      { name: "Quiet Mission Hill", department: "BTDT", request_type: null, neighborhood: "Mission Hill", months: [], kind: "silence" },
      { name: "Snow", department: "BTDT", request_type: null, neighborhood: null, months: [2], kind: "shock" },
    ] };
  if (input.startsWith("You are Terry's hunting")) {
    const T = Object.fromEntries(opts.tools.map(t => [t.name, t]));
    const base = await T.do_nothing.execute({ department: "BTDT" }, {});
    const opt = await T.optimize_plan.execute({ department: "BTDT", mode: "neutral" }, {});
    const hot = await T.simulate_plan.execute({ department: "BTDT", crews_by_month: opt.crews_by_month, demand_mult: 1.14 }, {});
    const bp = await T.break_point.execute({ department: "BTDT", crews_by_month: opt.crews_by_month }, {});
    let err = null; try { await T.break_point.execute({ department: "BTDT", crews_by_month: new Array(12).fill(0) }, {}); } catch (e) { err = e.message; }
    console.log("tools:", base.ontime_rate, opt.ontime_rate, hot.ontime_rate, bp.break_pct, "| zeros rejected:", err);
    return { recommended_crews_by_month: opt.crews_by_month, seasonal_by_month: new Array(12).fill(0), why: "Hire early, 26 crews by May." };
  }
  if (input.startsWith("Rewrite a resident")) return { problem: "pothole in the street near the train stop", problem_is_stated: true };
  if (input.startsWith("You are the Boston 311 intake")) return { type: "request for pothole repair", department: "PWDx", queue: "x", confidence: 0.9, follow_up: null };
  throw new Error("unexpected prompt");
};

const T = create(E, fake);
const f = await T.flip("I close every Transportation request in Boston on time in 2025.");
console.log("dept:", f.target_department, "| inverted:", f.inverted);
console.log("kept:", f.predators.map(p => `${p.hypothesis.name} [${p.evidence.verdict}] ${p.hypothesis.request_type}/${p.hypothesis.neighborhood}`));
console.log("dropped:", f.dropped);
const h = await T.hunt(f.predators[0], "neutral", { onTool: s => {} });
console.log("hunt:", h.crews.join(","), "| why:", h.why, "\n ", h.rationale.join("\n  "));
console.log("trace tools:", h.trace.map(t => t.tool).join(" -> "), "| decisions:", h.decisions.length);
const i = await T.intake("hay un hueco enorme en la calle Centre cerca de la parada");
console.log("intake:", i.choice.type, i.choice.queue, "| in candidates:", i.candidates.some(c => c.type === "Request for Pothole Repair"));
console.log("replay PARK:", T.replay("PARK").predators.length, "predators");
console.log("tiers used:", calls.map(c => c.tier + (c.tools.length ? "+tools" : "")).join(", "));
