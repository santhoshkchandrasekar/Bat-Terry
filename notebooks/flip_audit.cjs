// The flip audit (owner 21:16): run the page's own flip for every goal a viewer can set, and check each failure card.
// Run from the repo root:
//   node notebooks/flip_audit.cjs            the rule checks, a table of what breaks
//   node notebooks/flip_audit.cjs --json     one JSON object (the notebook's section 6.4 reads it)
//   node notebooks/flip_audit.cjs --judge    also asks a model, as an inspector, whether each card reads as misleading
// Goals: each department and the whole city, each month, at 80%, 90%, 95% and 100% (240). Each card is the page's: the flip
// headline and small print (F.failLine), and the 2023 and 2024 record beside it. Nothing here is re-implemented.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const req = p => require(path.join(ROOT, p));
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8"));
const E = req("app/live/engine.js").create(DATA);
const TerryLive = req("app/live/terry.js"), TerryFlyover = req("app/live/flyover.js");
const SCOPES = ["PWDx", "BTDT", "PARK", "ISD", "CITY"], TARGETS = [0.8, 0.9, 0.95, 1.0];
const JSONOUT = process.argv.includes("--json"), JUDGE = process.argv.includes("--judge");

// the rules a card must keep (each returns a reason, or "")
const RULES = {
  // a sentence dated 2025 must not carry 2024's counts as if they were the model's
  past_as_future: c => /^It is 31 December 2025/.test(c.line) && !/^It is 31 December 2025\. With the plan|held|ran \d+% busier|could not find/.test(c.line) && /It is 31 December 2025/.test(c.line) && c.hist && c.line.includes(c.hist.late.toLocaleString("en-US")) ? "a 2025 sentence quotes 2024's late count" : "",
  // "cannot fail" while the record missed the goal must say why the two differ
  safe_vs_record: c => c.kase === "safe" && c.hist && c.hist.ontime < c.goal.target && !/missed it/.test(c.facts) ? "says it cannot fail, record missed, no explanation" : "",
  // the departments the model is known to be gentle on get the caveat when it says it cannot fail
  gentle_caveat: c => c.kase === "safe" && c.hist && c.hist.ontime < c.goal.target && /ISD|PARK/.test(c.goal.scope) && !/gentler/.test(c.facts) ? "gentle department, no caveat" : "",
  // the fallback sentence is a placeholder, not an answer
  unfinished: c => /still looking/i.test(c.line) ? "the card says it is still looking" : "",
  // the headline and the small print must agree about the model's 2025 result
  headline_vs_model: c => c.X && ((c.kase === "short" && c.wS >= c.goal.target) || (c.kase === "holds" && c.wS < c.goal.target)) ? "headline and the model's forecast plan disagree" : "",
  // a card with a plan result must not fall back to the record-only wording
  record_only: c => c.X && c.kase === "record" ? "the plan ran, but the card shows only 2024" : "",
  // every percentage on the card must be a real one (goal, record, model)
  numbers: c => { const ok = new Set(c.allowed); const bad = (c.line + " " + c.facts).match(/\d+(\.\d+)?%/g) || []; const off = bad.filter(x => !ok.has(x)); return off.length ? "numbers not in the data: " + off.join(", ") : ""; },
};

(async () => {
  const T = TerryLive.create(E, null), out = [];
  for (const scope of SCOPES) for (let m = 1; m <= 12; m++) for (const target of TARGETS) {
    const goal = { scope, hood: null, months: [m], target };
    const F = TerryFlyover.create(E, T, null); F.setGoal(goal);
    let fl = null, X = null;
    try { fl = await F.flip(goal); } catch (e) { out.push({ goal, error: "flip: " + e.message }); continue; }
    try { X = await F.escape(goal, { predators: fl.predators }); } catch (e) { X = null; }   // the page order: the flyway hears the predators first
    const L = F.failLine(fl, X, goal), hs = fl.history || null;
    const pctS = v => Math.round(v * 100) + "%", pct1 = v => (Math.round(v * 1000) / 10).toFixed(1).replace(/\.0$/, "") + "%";
    const allowed = [pctS(target), "60%", ...(hs ? [pctS(hs.ontime)] : []), ...(fl.history2023 ? [pctS(fl.history2023.ontime)] : [])];
    const fmt = w => [pct1(w), pctS(w), (Math.round(w * 1000) / 10).toFixed(1) + "%"];
    if (X) for (const k of ["stay", "escape"]) { allowed.push(...fmt(X.totals[k].window)); for (const d in (X.depts || {})) if (X.depts[d][k]) allowed.push(...fmt(X.depts[d][k].window)); }
    const weakest = k => !X ? null : scope === "CITY" ? Math.min(...Object.values(X.depts).map(x => x[k].window)) : X.totals[k].window;
    if (X && X.hot_pct) allowed.push(X.hot_pct + "%");
    const c = { goal, wS: weakest("stay"), kase: L.case, line: L.line, facts: L.facts, hist: hs ? { n: hs.n, late: hs.n - Math.round(hs.ontime * hs.n), ontime: hs.ontime } : null, X, allowed };
    c.flags = Object.entries(RULES).map(([k, f]) => [k, f(c)]).filter(x => x[1]).map(([k, why]) => ({ rule: k, why }));
    delete c.X; c.model = X ? { stay: X.totals.stay.window, escape: X.totals.escape.window, hot: X.hot_pct || null, verdict: X.verdict } : null;
    out.push(c);
  }
  const flagged = out.filter(c => c.flags && c.flags.length), byRule = {};
  for (const c of flagged) for (const f of c.flags) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  const byCase = {}; for (const c of out) byCase[c.kase || "error"] = (byCase[c.kase || "error"] || 0) + 1;
  const summary = { goals: out.length, flagged: flagged.length, by_rule: byRule, by_case: byCase, errors: out.filter(c => c.error).length };
  if (JUDGE) summary.judge = await judge(out);
  if (JSONOUT) { process.stdout.write(JSON.stringify({ summary, cards: out }) + "\n"); return; }
  console.log(JSON.stringify(summary, null, 1));
  for (const c of flagged.slice(0, 40)) console.log(`${c.goal.scope} m${c.goal.months[0]} ${c.goal.target}: ${c.flags.map(f => f.rule).join(", ")}\n   ${c.line}\n   ${c.facts}`);
})();

// the inspector: one model call per distinct card wording (cards repeat across months), asked one question
async function judge(cards) {
  const f = path.join(ROOT, "config/llm.local"); if (!fs.existsSync(f)) return { skipped: "no key" };
  const kv = Object.fromEntries(fs.readFileSync(f, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
  const key = kv.OPENAI_API_KEY || process.env.OPENAI_API_KEY; if (!key) return { skipped: "no key" };
  const seen = new Map();
  for (const c of cards) { if (!c.line) continue; const norm = t => t.replace(/\d[\d,.]*%?/g, "#").replace(/Public Works|Transportation|Parks|Inspectional Services|every department/g, "D").replace(/January|February|March|April|May|June|July|August|September|October|November|December/g, "M"); const k = c.kase + "|" + (c.goal.target === 1) + "|" + norm(c.line) + "|" + norm(c.facts); if (!seen.has(k)) seen.set(k, c); }
  const res = [];
  for (const c of seen.values()) {
    const prompt = `You are checking one card on a public planning page about Boston's 311 crews in 2025. Read it as a careful city manager would.
How the card works: it is a premortem. The headline is written as if it were 31 December 2025 and the goal had failed: either under a demand surge the planner tested (the stress), or with the plan as forecast; when no failure is found it says so. The small print gives the real 2023 and 2024 record for the same months, the model's result at forecast, and the flyway (the planner's changed crew plan). Record and model can differ: the record is what happened with last year's crews; the model is this plan.
Goal: ${JSON.stringify(c.goal)} (target is a share of requests closed on time). Real record: 2024 on time ${c.hist ? Math.round(c.hist.ontime * 1000) / 10 + "%" : "none"}. Model at forecast: ${c.model ? Math.round(c.model.stay * 1000) / 10 + "%" : "none"}${c.model && c.model.hot ? `; the stress tested: demand ${c.model.hot}% over forecast` : ""}.
Card headline: "${c.line}"
Card small print: "${c.facts}"
Given how the card works, is anything on it false, self-contradicting, or likely to be misread by a careful reader? Do not flag the premortem framing itself or a record that differs from the model; flag wording that states something untrue or confusing. Answer only JSON: {"ok": true|false, "issue": "one short sentence, empty if ok"}`;
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }) });
      const j = await r.json(); const v = JSON.parse(j.choices[0].message.content);
      res.push({ goal: c.goal, kase: c.kase, ok: !!v.ok, issue: v.issue || "", line: c.line, facts: c.facts });
    } catch (e) { res.push({ goal: c.goal, kase: c.kase, ok: null, issue: "judge failed: " + e.message }); }
  }
  return { distinct_cards: res.length, judged_ok: res.filter(r => r.ok === true).length, judged_issue: res.filter(r => r.ok === false).length, results: res };
}
