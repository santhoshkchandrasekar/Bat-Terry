// Ping's live model path under faults, end to end in the hosted build (deploy/site: host.js runs the tool loop, /api/llm is the
// Netlify function). The function is replaced by a scripted stand-in so every failure can be produced on purpose:
// slow, 500, 429, not JSON, a hang past the 45 s cap, a model that never stops calling tools, and user moves while it works
// (New chat, Escape, typing in the goal box, a second question). Run: node tests/ai-faults.cjs [only,names]   (exit 1 on a failure)
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const SITE = path.resolve(__dirname, "../../../deploy/site"), PORT = +(process.env.PORT || 8890);
const THREE = process.env.THREE_JS || path.join(__dirname, "three.min.js");
const ONLY = (process.argv[2] || "").split(",").filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);
let fails = 0; const check = (ok, what, extra) => { if (!ok) fails++; log(ok ? "ok  " : "FAIL", what, ok || extra === undefined ? "" : JSON.stringify(extra).slice(0, 400)); };

const srv = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split("?")[0]).slice(1) || "index.html", f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const ct = { ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".css": "text/css", ".html": "text/html; charset=utf-8" }[path.extname(f)] || "text/javascript; charset=utf-8";
  r.writeHead(200, { "content-type": ct }); r.end(fs.readFileSync(f));
});

// the scripted model: M.mode picks the behaviour; every request is counted
const M = { mode: "ok", delay: 0, calls: 0, prompts: [] };
const reply = content => ({ status: 200, contentType: "application/json", body: JSON.stringify({ message: { role: "assistant", content }, finish: "stop" }) });
const OKA = { answer: "A flyway is my cheapest change to the crew plan that gets a goal past its predators.", actions: [{ type: "zoom", level: 1, dept: "PARK", month: null }], sources: [] };
async function model(route) {
  M.calls++; let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
  const first = (body.messages || []).find(m => m.role === "user"); M.prompts.push(first ? String(first.content).slice(0, 60) : "");
  if (M.delay) await sleep(M.delay);
  const mode = M.mode;
  try {
    if (mode === "ok") return await route.fulfill(reply(JSON.stringify(OKA)));
    if (mode === "500") return await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "upstream_error" }) });
    if (mode === "429") return await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate_limited", scope: "visitor" }) });
    if (mode === "garbage") return await route.fulfill(reply("Sure! Here is what I think about flyways, no JSON today."));
    if (mode === "hang") { await sleep(70000); return await route.fulfill(reply(JSON.stringify(OKA))).catch(() => {}); }
    if (mode === "toolloop") {
      const hasTools = Array.isArray(body.tools) && body.tools.length;
      if (!hasTools) return await route.fulfill(reply(JSON.stringify({ answer: "A flyway is my cheapest fix for a goal.", actions: [], sources: [] })));
      return await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: { role: "assistant", content: null, tool_calls: [{ id: "c" + M.calls, type: "function", function: { name: "search_knowledge", arguments: JSON.stringify({ query: "flyway " + M.calls }) } }] }, finish: "tool_calls" }) });
    }
  } catch (e) { /* the page aborted the request: fine */ }
}

const state = p => p.evaluate(() => { const d = document.querySelector("#dock"); return { busy: d.dataset.busy, mode: d.dataset.mode, kind: d.dataset.kind,
  text: (document.querySelector(".dk-text") || {}).textContent || "", you: (document.querySelector(".dk-you") || {}).textContent || "",
  turns: document.querySelectorAll(".dk-thread .dk-turn").length, dis: document.querySelector(".dk-in").disabled, focus: document.activeElement && (document.activeElement.id || document.activeElement.className),
  lvl: window.__zoom && __zoom.S ? __zoom.S.lvl : null, y: Math.round(scrollY) }; });
async function until(p, fn, ms = 60000, arg) { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await sleep(150); } return false; }
const idle = p => until(p, () => document.querySelector("#dock").dataset.busy !== "1", 90000);
async function ask(p, q) { await p.click(".dk-in"); await p.fill(".dk-in", q); await p.press(".dk-in", "Enter"); }
async function fresh(p) { const b = await p.$(".dk-new"); if (b) { await b.click(); await sleep(400); } await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await sleep(300); }

const T = [];
const test = (name, fn) => T.push([name, fn]);

test("ok", async p => {
  M.mode = "ok"; M.delay = 300; const c0 = M.calls;
  await ask(p, "What is a flyway?"); await idle(p); await sleep(1500); const s = await state(p);
  check(M.calls > c0 && /cheapest change/.test(s.text) && s.busy === "0" && !s.dis, "a live answer shows, the field is free again", s);
  check(s.lvl === 1, "its page action ran (zoomed to Parks)", s);
});
test("500", async p => {
  M.mode = "500"; M.delay = 0; await fresh(p);
  await ask(p, "What is a flyway?"); await idle(p); await sleep(500); const s = await state(p);
  check(s.text.length > 20 && !/did not hear/.test(s.text) && s.busy === "0", "a failed model call still gets the rules answer", s);
  check(/quick answer|Live answers|live answer/i.test(s.text), "and says it is the quick answer, not a silent switch of voice", s);
});
test("429", async p => {
  M.mode = "429"; await fresh(p);
  await ask(p, "What is a flyway?"); await idle(p); await sleep(500); const s = await state(p);
  check(s.text.length > 20 && /used up/i.test(s.text), "over the daily limit: rules answer, labelled as today's live answers used up", s);
});
test("garbage", async p => {
  M.mode = "garbage"; await fresh(p);
  await ask(p, "What is a flyway?"); await idle(p); await sleep(500); const s = await state(p);
  check(s.text.length > 20 && !/no JSON today/.test(s.text) && s.busy === "0", "a reply that is not JSON is never shown raw; the rules answer stands", s);
});
test("toolloop", async p => {
  M.mode = "toolloop"; await fresh(p); const c0 = M.calls;
  await ask(p, "What is a flyway?"); await idle(p); await sleep(500); const s = await state(p), n = M.calls - c0;
  check(n <= 9 && s.busy === "0" && s.text.length > 10, `a model that never stops calling tools is cut off (${n} rounds) and an answer still shows`, s);
});
test("stop", async p => {
  M.mode = "ok"; M.delay = 6000; await fresh(p);
  await p.evaluate(() => window.__zoom && __zoom.goTo && __zoom.goTo({ lvl: 0 })); await sleep(1200);
  await ask(p, "What is a flyway?"); await sleep(1500);
  const lab = await p.evaluate(() => document.querySelector(".dk-go").getAttribute("aria-label"));
  check(lab === "Stop", "while Terry thinks the send button is Stop", lab);
  await p.click(".dk-go"); await sleep(800); const s = await state(p);
  check(/Stopped/.test(s.text) && s.busy === "0" && !s.dis, "Stop ends the turn at once and says so, with Try again", s);
  await sleep(6500); const s2 = await state(p);
  check(!/cheapest change/.test(s2.text) && s2.lvl === 0, "the cancelled answer never lands later, and its page action never runs", s2);
});
test("escape", async p => {
  M.mode = "ok"; M.delay = 4000; await fresh(p);
  await ask(p, "What is a flyway?"); await sleep(800); await p.keyboard.press("Escape"); await sleep(5500);
  const s = await state(p);
  check(s.busy === "0" && !s.dis, "Escape while Terry thinks: the field is not left disabled", s);
  await p.click(".dk-in"); await sleep(600); const s2 = await state(p);
  check(/cheapest change/.test(s2.text) || s2.turns > 0, "and the answer is there when the chat opens again", s2);
});
test("focus", async p => {
  M.mode = "ok"; M.delay = 4000; await fresh(p);
  await ask(p, "What is a flyway?"); await sleep(600);
  await p.click("#goalin"); await p.keyboard.type("Parks on time", { delay: 60 }); await sleep(5000); await p.keyboard.type(" in summer", { delay: 60 });
  const g = await p.evaluate(() => document.querySelector("#goalin").value), s = await state(p);
  check(g === "Parks on time in summer", "typing in the goal box while Terry answers: the answer does not steal the keyboard", { goal: g, focus: s.focus, dockText: s.text.slice(0, 60) });
  await p.fill("#goalin", ""); await p.evaluate(() => document.activeElement && document.activeElement.blur());
});
test("double", async p => {
  M.mode = "ok"; M.delay = 2500; await fresh(p); const c0 = M.calls;
  await p.click(".dk-in"); await p.fill(".dk-in", "go to the projector"); await p.press(".dk-in", "Enter");
  await sleep(150); await p.fill(".dk-in", "What is a flyway?").catch(() => {}); await p.press(".dk-in", "Enter").catch(() => {});
  await idle(p); await sleep(4000); const s = await state(p);
  check(s.busy === "0" && !s.dis && (/cheapest change|flyway/i.test(s.text) || /What is a flyway/.test(await p.evaluate(() => document.querySelector(".dk-in").value))), "a second question typed during a page move is answered or kept, never lost", { s, calls: M.calls - c0 });
});
test("guide", async p => {
  M.mode = "ok"; M.delay = 5000; await fresh(p);
  await ask(p, "What is a flyway?"); await sleep(1200);
  await p.evaluate(() => TerryPing.guide("Here is the projector. It shows the crews each month.")); await sleep(6500);
  const s = await state(p), th = await p.evaluate(() => [...document.querySelectorAll(".dk-thread .dk-turn")].map(t => t.textContent.trim().slice(0, 80)));
  check(s.busy === "0" && !s.dis, "the guide speaking over a question leaves the field usable", s);
  check(!th.some(t => /Listening/.test(t)), "and no 'Listening...' turn is left behind in the chat", th);
});
test("report-500", async p => {
  M.mode = "500"; M.delay = 0; await fresh(p);
  await ask(p, "There is a big pothole on my street"); await idle(p); await sleep(1500); const s = await state(p);
  check(s.busy === "0" && /Public Works|pothole/i.test(s.text + JSON.stringify(await p.evaluate(() => (document.querySelector(".dk-tk") || {}).textContent || ""))), "a resident report still routes by rules when the model fails", s);
});
test("report-hang", async p => {
  M.mode = "hang"; M.delay = 0; await fresh(p); const t0 = Date.now();
  await ask(p, "There is a big pothole on my street"); const ok = await until(p, () => document.querySelector("#dock").dataset.busy !== "1", 70000); await sleep(1500);
  const s = await state(p), tk = await p.evaluate(() => (document.querySelector(".dk-tk") || {}).textContent || ""), secs = Math.round((Date.now() - t0) / 1000);
  check(ok && secs <= 35 && /Public Works|pothole/i.test(s.text + tk), `a stalled model during a report is cut off (${secs} s) and the rules route it`, { s, tk: tk.slice(0, 120) });
});
test("flight", async p => {
  M.mode = "500"; M.delay = 0; await fresh(p);
  await ask(p, "There is a big pothole on my street"); await until(p, () => document.querySelector("#dock").dataset.busy !== "1", 30000);
  M.mode = "ok"; M.delay = 16000; await ask(p, "What is a flyway?"); await sleep(1000);   // longer than the ticket's flight, so it lands mid-question
  const seen = []; for (let k = 0; k < 50; k++) { const st = await state(p); seen.push(st.busy + (st.dis ? "d" : "")); if (/cheapest change/.test(st.text)) break; await sleep(400); }
  const firstFree = seen.findIndex(x => x === "0"), s = await state(p);
  check(/cheapest change/.test(s.text) && (firstFree === -1 || firstFree === seen.length - 1), "a report's ticket landing mid-question never frees the field before the answer", { seen, text: s.text.slice(0, 60) });
});
test("hang", async p => {
  M.mode = "hang"; M.delay = 0; await fresh(p); const t0 = Date.now();
  await ask(p, "What is a flyway?"); const ok = await until(p, () => document.querySelector("#dock").dataset.busy !== "1", 80000); const s = await state(p), secs = Math.round((Date.now() - t0) / 1000);
  check(ok && s.text.length > 20 && secs <= 70, `a model that never answers is cut off (${secs} s) and the rules answer shows`, s);
});

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("terry.opening", "seen"); localStorage.setItem("terry.toured", "1"); localStorage.setItem("terry.seen", "1"); localStorage.setItem("terry.guide", "off"); } catch (e) {} });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|status of (429|502)/.test(m.text()) && errs.push(m.text()));
  await p.route("**/three.min.js", r => r.fulfill({ path: THREE, contentType: "text/javascript" }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.route("**/api/llm", model);
  await p.goto(`http://localhost:${PORT}/index.html`);
  await until(p, () => window.__zoom && __zoom.ready && document.querySelector("#dock") && document.querySelector(".dk-in"), 120000); await sleep(4000);
  for (const [name, fn] of T) { if (ONLY.length && !ONLY.includes(name)) continue; log("--", name); try { await fn(p); } catch (e) { fails++; log("STEP FAIL", name, e.message.split("\n")[0]); } }
  check(!errs.length, "no page errors", errs.slice(0, 5));
  log("FAILS", fails, "model calls", M.calls); await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
