// Checks the equity map tool in app/zoom/ask.js (neighborhood_profile) with a scripted stand-in for the model, and the offline rules
// for the common map phrasings. No network, no key. Run from the repo root: node notebooks/ping_map_mock_test.cjs   (exits 1 on any failure)
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const req = p => require(path.join(ROOT, p));
const E = req("app/live/engine.js").create(JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8")));
const Z = req("app/zoom/levels.js").create(E);
const TA = req("app/zoom/ask.js"), EQ = req("app/zoom/equity.js");
const pc = v => Math.round(Math.abs(v - 1) * 100);

function fakeSample(script) {
  const prompts = [], s = async () => { throw new Error("unused"); };
  s.json = async (prompt, opts = {}) => {
    prompts.push(prompt);
    if (opts.modelTier === "quick") return { answer: script.fix || "" };
    const byName = Object.fromEntries((opts.tools || []).map(t => [t.name, t]));
    for (const [name, input] of script.calls || []) await byName[name].execute(input);
    return typeof script.out === "function" ? script.out() : script.out;
  };
  s.prompts = prompts; return s;
}
const tests = [], test = (name, fn) => tests.push([name, fn]);
const A0 = TA.create(E, Z, null, {});

test("map questions are questions, not resident reports or out of scope", async () => {
  for (const q of ["Which neighborhoods wait longest for pothole repairs?", "Which neighborhoods are quiet?", "How is Charlestown doing?", "Where do residents call least about street lights?"])
    assert.strictEqual(A0.route(q).route, "question", q);
  assert.strictEqual(A0.route("There is a pothole on Elm St in Charlestown").route, "resident", "a report with a place is still a report");
});
test("rules: the brief's own example names the slowest neighborhoods for that type, cites the map and lights them", async () => {
  const r = await A0.ask("Which neighborhoods wait longest for pothole repairs?");
  const T = EQ.wait_by_type["Request for Pothole Repair"], top = T.wait.slice(0, 3);
  assert.strictEqual(r.mode, "rules"); assert(r.trace.some(t => t.tool === "neighborhood_profile"));
  top.forEach(([n, w]) => assert(r.answer.includes(`${n} (late ${pc(w)}% more often`), n + " in " + r.answer));
  assert(r.answer.includes(`${Math.round(T.city_late * 100)}% of these requests go late`));
  assert.deepStrictEqual(r.actions, [{ type: "map", neighborhoods: top.map(x => x[0]) }]);
  assert(r.source_chips.some(c => c.label === "Equity map, 2024 requests")); assert.strictEqual(r.checked, true);
  assert.deepStrictEqual(A0.unverified(r.answer, r.trace.map(t => t.result)), [], "every number comes from the tool");
});
test("rules: quiet and slow overall tells two places apart and stays inside the 5% band", async () => {
  const r = await A0.ask("Which neighborhoods are quiet?");
  const sb = EQ.neighborhoods.find(n => n.name === "South Boston / South Boston Waterfront"), ch = EQ.neighborhoods.find(n => n.name === "Charlestown");
  assert(r.answer.includes(`South Boston / South Boston Waterfront calls ${pc(sb.silence)}% less than the city`), r.answer);
  assert(r.answer.includes(`Charlestown is late ${pc(ch.wait)}% more often`)); assert(!/Roxbury calls/.test(r.answer), "a place at the norm is never called quiet");
  assert.deepStrictEqual(r.actions[0].neighborhoods, ["South Boston / South Boston Waterfront", "Mission Hill"]);
});
test("rules: one neighborhood's profile, at the norm when within 5%", async () => {
  const r = await A0.ask("How is Charlestown doing?");
  assert(/Charlestown calls about the city norm/.test(r.answer), r.answer); assert.deepStrictEqual(r.actions, [{ type: "map", neighborhoods: ["Charlestown"] }]);
});
test("model: the tool result grounds the numbers, map actions are kept only for real neighborhoods, the chip is added", async () => {
  const ch = EQ.neighborhoods.find(n => n.name === "Charlestown");
  const smp = fakeSample({ calls: [["neighborhood_profile", { neighborhood: "Charlestown" }]],
    out: { answer: `Charlestown calls at about the city norm, but its requests are late ${pc(ch.wait)}% more often than expected for its mix.`, actions: [{ type: "map", neighborhoods: ["Charlestown", "Gotham"] }], sources: [] } });
  const A = TA.create(E, Z, smp, {}), r = await A.ask("How is Charlestown doing?");
  assert.strictEqual(r.mode, "live"); assert.strictEqual(r.checked, true);
  assert.deepStrictEqual(r.actions, [{ type: "map", neighborhoods: ["Charlestown"] }]);
  assert.deepStrictEqual(r.source_chips.map(c => c.label), ["Equity map, 2024 requests"]);
});
test("model: an invented number about a neighborhood is removed", async () => {
  const smp = fakeSample({ calls: [["neighborhood_profile", { neighborhood: "Charlestown" }]],
    out: { answer: "Charlestown runs late more often than expected for its mix. Its crews are 47% short every winter.", actions: [], sources: [] }, fix: "Charlestown runs late more often than expected for its mix. Its crews are 47% short every winter." });
  const r = await TA.create(E, Z, smp, {}).ask("How is Charlestown doing?");
  assert.strictEqual(r.checked, false); assert(!/47/.test(r.answer)); assert(/runs late/.test(r.answer));
});
test("tool: a request type filter, a neighborhood filter, and an unknown neighborhood fails loudly", async () => {
  const t = A0.tools.neighborhood_profile;
  const a = t.run({ request_type: "pothole" }); assert.strictEqual(a.request_type, "Pothole Repair"); assert.strictEqual(a.neighborhoods.length, 5);
  const b = t.run({ request_type: "pothole", neighborhood: "Charlestown" }); assert.deepStrictEqual(b.neighborhoods.map(x => x.neighborhood), ["Charlestown"]);
  const c = t.run({ request_type: "street lights", sort: "silence" }); assert.strictEqual(c.request_type, "Street Light Outages"); assert(c.neighborhoods[0].calls);
  assert.throws(() => t.run({ neighborhood: "Gotham" }));
});
(async () => {
  let bad = 0;
  for (const [name, fn] of tests) { try { await fn(); console.log("ok   ", name); } catch (e) { bad++; console.log("FAIL ", name, "\n      ", e && e.message); } }
  console.log(`\n${tests.length - bad} of ${tests.length} passed`); process.exit(bad ? 1 : 0);
})();
