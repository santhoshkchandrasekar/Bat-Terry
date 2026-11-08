// Ping Terry evaluation, headless, rules path only (no live model, no network). Run from the repo root:
//
//   node notebooks/ping_eval.cjs            a table and the three headline numbers
//   node notebooks/ping_eval.cjs --json     the same as one JSON object (the notebook's section 6.6 reads this)
//
// Reads app/zoom/ping_eval.json and runs every question through app/zoom/ask.js with sample = null. It reports:
//   route accuracy        the router's class equals the expected one
//   retrieval hit@4       an expected knowledge chunk is among the top 4 for the (resolved) question
//   guardrail pass        every number in the answer is in a tool result or a cited chunk (E.unverifiedNumbers finds none)
// and, as support, tool match, content checks (must and must_not patterns, injection stripped) and citation validity.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const req = p => require(path.join(ROOT, p));
const E = req("app/live/engine.js").create(JSON.parse(fs.readFileSync(path.join(ROOT, "app/live/data.json"), "utf8")));
const Z = req("app/zoom/levels.js").create(E);
const KB = JSON.parse(fs.readFileSync(path.join(ROOT, "app/zoom/kb.json"), "utf8"));
const A = req("app/zoom/ask.js").create(E, Z, null, { kb: KB });
const EV = JSON.parse(fs.readFileSync(path.join(ROOT, "app/zoom/ping_eval.json"), "utf8"));
const ids = new Set(KB.chunks.map(c => c.id).concat(["data-equity-2024", "page-state", "data-forecast-2025"]));   // knowledge chunks plus the page's data chips

(async () => {
  const rows = [];
  for (const it of EV.items) {
    const hist = it.history || [], rt = A.route(it.q, hist);
    A.reset();
    const r = await A.ask(it.q, { history: hist });
    const called = r.trace.map(t => t.tool), top4 = A.retrieveKB(rt.text, 4).map(c => c.id);
    const row = { id: it.id, group: it.group, q: it.q, route: r.route, expected_route: it.route, route_ok: r.route === it.route, called, answer: r.answer, sources: r.sources };
    if (it.chunks) { row.hit4 = it.chunks.some(c => top4.includes(c)); row.top4 = top4; row.expected_chunks = it.chunks; }
    if (it.tools) row.tools_ok = it.tools.every(t => called.includes(t)) && (it.tools.length > 0 || called.length === 0);
    if (r.answer) {
      const facts = r.trace.filter(t => t.result && t.tool !== "search_knowledge").map(t => t.result).concat(r.sources.map(id => (KB.chunks.find(c => c.id === id) || {}).text || ""));
      row.unverified = A.unverified(r.answer, facts); row.guardrail_ok = !row.unverified.length;
    }
    const checks = [];
    for (const p of it.must || []) checks.push(new RegExp(p, "i").test(r.answer));
    for (const p of it.must_not || []) checks.push(!new RegExp(p, "i").test(r.answer));
    if (it.sanitized) checks.push(r.sanitized === true);
    checks.push(r.sources.every(id => ids.has(id)) && r.source_chips.length === r.sources.length && !/[—–]|--/.test(r.answer) && !/\bAI\b|generated/i.test(r.answer));
    row.content_ok = checks.every(Boolean);
    rows.push(row);
  }
  const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
  const hit = rows.filter(r => "hit4" in r), tl = rows.filter(r => "tools_ok" in r), gr = rows.filter(r => "guardrail_ok" in r);
  const sum = { questions: rows.length,
    route_accuracy: pct(rows.filter(r => r.route_ok).length, rows.length),
    retrieval_hit_at_4: pct(hit.filter(r => r.hit4).length, hit.length), retrieval_n: hit.length,
    guardrail_pass: pct(gr.filter(r => r.guardrail_ok).length, gr.length), guardrail_n: gr.length,
    tool_match: pct(tl.filter(r => r.tools_ok).length, tl.length), tool_n: tl.length,
    content_checks: pct(rows.filter(r => r.content_ok).length, rows.length) };
  // navigation (checked before the router in the page): each nav case lands where it should, and no eval question is mistaken for a trip
  const N = req("app/zoom/nav.js"), nav = (EV.nav || []).map(c => { const got = N.navTarget(c.q); return { q: c.q, expected: c.key, got, ok: got === c.key }; });
  const stray = rows.filter(r => N.navTarget(r.q)).map(r => r.id);
  sum.nav_cases = nav.length; sum.nav_accuracy = pct(nav.filter(x => x.ok).length, nav.length); sum.nav_to_place = nav.filter(x => x.expected).length; sum.nav_not_trip = nav.filter(x => !x.expected).length;
  sum.questions_mistaken_for_navigation = stray.length;
  const cmds = (EV.commands || []).map(c => { const got = N.parseCommand(c.q), w = c.want; const ok = w === null ? got === null : !!got && Object.keys(w).every(k => got[k] === w[k]); return { q: c.q, want: w, got, ok }; });
  const strayC = rows.filter(r => N.parseCommand(r.q)).map(r => r.id);
  sum.command_cases = cmds.length; sum.command_accuracy = pct(cmds.filter(x => x.ok).length, cmds.length); sum.command_actions = cmds.filter(x => x.want).length; sum.command_not_action = cmds.filter(x => !x.want).length;
  sum.questions_mistaken_for_commands = strayC.length;
  if (process.argv.includes("--json")) { process.stdout.write(JSON.stringify({ summary: sum, rows, nav, stray, cmds, strayC }) + "\n"); return; }
  const f = v => (v ? "ok" : "FAIL");
  for (const r of rows) console.log(`${r.id.padEnd(18)} ${r.group.padEnd(12)} route ${f(r.route_ok).padEnd(4)} (${r.route}${r.route_ok ? "" : ", wanted " + r.expected_route})  hit@4 ${("hit4" in r ? f(r.hit4) : "-").padEnd(4)}  tools ${("tools_ok" in r ? f(r.tools_ok) : "-").padEnd(4)}  guard ${("guardrail_ok" in r ? f(r.guardrail_ok) : "-").padEnd(4)}  content ${f(r.content_ok)}`);
  for (const x of nav) console.log(`nav  ${x.ok ? "ok  " : "FAIL"}  ${String(x.got).padEnd(10)} (wanted ${x.expected})  ${x.q}`);
  console.log(`navigation: ${sum.nav_accuracy}% of ${sum.nav_cases} cases; eval questions taken for a trip: ${sum.questions_mistaken_for_navigation}`);
  for (const x of cmds) console.log(`cmd  ${x.ok ? "ok  " : "FAIL"}  ${JSON.stringify(x.got)}  ${x.q}`);
  console.log(`commands: ${sum.command_accuracy}% of ${sum.command_cases} cases; eval questions taken for a command: ${sum.questions_mistaken_for_commands}`);
  console.log(`\n${sum.questions} questions\n  route accuracy        ${sum.route_accuracy}%\n  retrieval hit@4       ${sum.retrieval_hit_at_4}%  (${sum.retrieval_n} questions with expected chunks)\n  guardrail pass        ${sum.guardrail_pass}%  (${sum.guardrail_n} answers with text)\n  tool match            ${sum.tool_match}%  (${sum.tool_n})\n  content checks        ${sum.content_checks}%`);
})();
