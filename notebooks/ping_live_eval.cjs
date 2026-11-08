// Ping Terry evaluation, LIVE: the same 40 questions as ping_eval.cjs, answered by the model through ask.js (the page's code),
// on OpenAI gpt-4o-mini through deploy/host.js, exactly as on the hosted site (key in config/llm.local or the environment). Reports
// how often the model answers (versus the rules fallback), time per answer, the guardrail (every number traced), and the content checks.
//   NODE_USE_ENV_PROXY=1 node notebooks/ping_live_eval.cjs [--json] [--limit N]
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const req = p => require(path.join(ROOT, p));
const E = req("app/live/engine.js").create(JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8")));
const Z = req("app/zoom/levels.js").create(E);
const KB = JSON.parse(fs.readFileSync(path.join(ROOT, "app/zoom/kb.json"), "utf8"));
global.TerryAsk = req("app/zoom/ask.js");
const EV = JSON.parse(fs.readFileSync(path.join(ROOT, "app/zoom/ping_eval.json"), "utf8"));
// The hosted site's path, end to end. deploy/host.js runs the tool loop; its calls to
// /api/llm go straight to OpenAI here, built exactly as deploy/netlify/functions/llm.mjs builds them (gpt-4o-mini, JSON mode, 900 tokens).
function openaiSample() {
  const f = path.join(ROOT, "config/llm.local"), kv = fs.existsSync(f) ? Object.fromEntries(fs.readFileSync(f, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])) : {};
  const key = process.env.OPENAI_API_KEY || kv.OPENAI_API_KEY; if (!key) return null;
  const calls = [], realFetch = global.fetch;
  global.window = global.window || {};
  global.fetch = async (url, o) => {
    if (url !== "/api/llm") return realFetch(url, o);
    const body = JSON.parse(o.body), wantJson = !!body.json && body.messages.some(m => typeof m.content === "string" && /json/i.test(m.content));
    const r = await realFetch("https://api.openai.com/v1/chat/completions", { method: "POST", signal: o.signal, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: body.messages, tools: body.tools, response_format: wantJson ? { type: "json_object" } : undefined, max_tokens: 900, temperature: 0.2 }) });
    const j = await r.json(); if (!r.ok) return { ok: false, status: r.status, json: async () => j };
    const u = j.usage || {}; calls.push({ model: "gpt-4o-mini", stop: j.choices[0].finish_reason, usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 } });
    return { ok: true, status: 200, json: async () => ({ message: j.choices[0].message, finish: j.choices[0].finish_reason }) };
  };
  require(path.join(ROOT, "deploy/host.js"));
  const s0 = null; const use = global.window.terryHost && global.window.terryHost.use; if (!use) return null;
  const base = { json: null };
  const wrap = async () => { const s = await use("sample");
    const out = async (i, o) => s(i, o);
    out.json = (prompt, opts = {}) => s.json(prompt, Object.assign({}, opts, { tools: (opts.tools || []).map(t => Object.assign({}, t, { execute: async x => {
      try { const r = await t.execute(x); calls.push({ tool: t.name, input: x, ok: true }); return r; } catch (e) { calls.push({ tool: t.name, input: x, ok: false }); throw e; } } })) }));
    out.calls = calls; return out; };
  return wrap();
}

(async () => {
  const sample = await openaiSample();
  if (!sample) { console.log(JSON.stringify({ error: "no OPENAI_API_KEY (environment or config/llm.local)" })); return; }
  const lim = process.argv.includes("--limit") ? +process.argv[process.argv.indexOf("--limit") + 1] : 1e9, rows = [];
  const pick = process.argv.includes("--ids") ? new Set(process.argv[process.argv.indexOf("--ids") + 1].split(",")) : null;
  for (const it of EV.items.filter(x => !pick || pick.has(x.id)).slice(0, lim)) {
    const A = global.TerryAsk.create(E, Z, sample, { kb: KB }), c0 = sample.calls.length, t0 = Date.now();
    let r; try { r = await A.ask(it.q, { history: it.history || [] }); } catch (e) { rows.push({ id: it.id, error: String(e.message || e) }); continue; }
    const facts = r.trace.filter(t => t.result && t.tool !== "search_knowledge").map(t => t.result).concat((r.sources || []).map(id => (KB.chunks.find(c => c.id === id) || {}).text || ""));
    const checks = []; for (const p of it.must || []) checks.push(new RegExp(p, "i").test(r.answer)); for (const p of it.must_not || []) checks.push(!new RegExp(p, "i").test(r.answer));
    checks.push(!/[\u2014\u2013]|--/.test(r.answer) && !/\bAI\b|generated/i.test(r.answer));
    rows.push({ id: it.id, group: it.group, mode: r.mode, fallback: r.fallback || null, seconds: Math.round((Date.now() - t0) / 100) / 10,
                rounds: sample.calls.slice(c0).filter(c => c.stop).length, guardrail_ok: r.mode !== "live" || r.checked !== false, content_ok: checks.every(Boolean), answer: r.answer,
                tools: sample.calls.slice(c0).filter(c => c.tool).map(c => c.tool + (c.ok ? "" : "!") + (c.input && c.input.query ? `(${String(c.input.query).slice(0, 30)})` : "")) });
  }
  // the real bill, from the API's own token counts (gpt-4o-mini $0.15 / $0.60 per million tokens)
  const PRICE = { "gpt-4o-mini": [0.15, 0.6] };
  let inTok = 0, outTok = 0, usd = 0;
  for (const c of sample.calls) { if (!c.usage) continue; const p = PRICE[c.model] || [2, 10], i = (c.usage.input_tokens || 0) + (c.usage.cache_creation_input_tokens || 0) * 1.25 + (c.usage.cache_read_input_tokens || 0) * 0.1, o = c.usage.output_tokens || 0;
    inTok += (c.usage.input_tokens || 0) + (c.usage.cache_creation_input_tokens || 0) + (c.usage.cache_read_input_tokens || 0); outTok += o; usd += (i * p[0] + o * p[1]) / 1e6; }
  const ok = rows.filter(r => !r.error), cl = ok.filter(r => r.mode === "live"), med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const sum = { questions: rows.length, errors: rows.length - ok.length, answered_by_model: cl.length, rules_fallback: ok.filter(r => r.mode === "rules" && r.fallback).length,
                rules_by_design: ok.filter(r => r.mode === "rules" && !r.fallback).length, median_seconds_model: med(cl.map(r => r.seconds)), max_seconds: Math.max(0, ...ok.map(r => r.seconds)),
                guardrail_pass: ok.filter(r => r.guardrail_ok).length, content_pass: ok.filter(r => r.content_ok).length,
                input_tokens: inTok, output_tokens: outTok, cost_usd: Math.round(usd * 1000) / 1000, cost_per_question_usd: rows.length ? Math.round(usd / rows.length * 1000) / 1000 : null };
  if (process.argv.includes("--json")) { console.log(JSON.stringify({ summary: sum, rows })); return; }
  for (const r of rows) console.log(r.error ? `${r.id} ERROR ${r.error}` : `${r.id.padEnd(18)} ${r.mode.padEnd(6)} ${String(r.seconds).padStart(5)}s rounds ${r.rounds} ${r.fallback ? "fallback " + r.fallback : ""}${r.content_ok ? "" : " CONTENT FAIL"} ${(r.tools || []).join(" ")}${r.guardrail_ok ? "" : " GUARD FAIL"}`);
  console.log(JSON.stringify(sum, null, 1));
})();
