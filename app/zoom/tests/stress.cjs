// Random-order stress test: hundreds of mixed actions at random timings across the landing, the zoom, the chase, the theme,
// The Flip Side's Fold all, the projector and Ping (with a scripted live model that is sometimes slow, failing or limited),
// checking the page's invariants after each one settles. Seeded, so a failure replays: node tests/stress.cjs [seed] [steps]
// Runs on the hosted build (deploy/site) with the landing forced. Exit 1 on any broken invariant.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const SITE = path.resolve(__dirname, "../../../deploy/site"), PORT = +(process.env.PORT || 8891), OUT = path.join(__dirname, "out");
const THREE = process.env.THREE_JS || path.join(__dirname, "three.min.js");
const SEED = +(process.argv[2] || 7), STEPS = +(process.argv[3] || 200), W = +(process.env.W || 1440), H = +(process.env.H || 900);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);
let seed = SEED; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296), pick = a => a[Math.floor(rnd() * a.length)];
fs.mkdirSync(OUT, { recursive: true });

const srv = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split("?")[0]).slice(1) || "index.html", f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const ct = { ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".css": "text/css", ".html": "text/html; charset=utf-8" }[path.extname(f)] || "text/javascript; charset=utf-8";
  r.writeHead(200, { "content-type": ct }); r.end(fs.readFileSync(f));
});
// the live model: mostly fine, sometimes slow, failing or over the limit
let modelMode = "ok";
async function model(route) {
  const m = modelMode, d = m === "slow" ? 7000 : 400; await sleep(d);
  try {
    if (m === "500") return await route.fulfill({ status: 502, body: "{}" });
    if (m === "429") return await route.fulfill({ status: 429, body: "{}" });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: { role: "assistant", content: JSON.stringify({ answer: "That is the plan's busiest stretch.", actions: [{ type: "zoom", level: 1, dept: pick(["PARK", "BTDT", "PWDx", "ISD"]), month: null }], sources: [] }) } }) });
  } catch (e) {}
}

const QS = ["What is a flyway?", "Why does Parks hire in June?", "There is a pothole on Main Street", "what am I looking at", "go to the predators", "switch to night", "compare plans", "zoom out"];
const GOALS = ["Parks on time at least 80% in the summer", "Transportation on time 85% all year", "Public Works under 30 days backlog in winter"];
// what the page looks like now, read in one go
const snap = p => p.evaluate(() => {
  const L = window.TerryLanding, d = document.querySelector("#dock"), op = el => { let o = 1, e = el; while (e && e.nodeType === 1) { const s = getComputedStyle(e); o *= +s.opacity; if (s.visibility === "hidden" || s.display === "none") o = 0; e = e.parentElement; } return o; };
  const lt = document.querySelector(".ld-terry-top canvas, canvas.ld-terry, .ld-terry canvas") || [...document.querySelectorAll("canvas")].find(c => /ld-terry/.test(c.parentElement.className));
  const pt = document.querySelector("#tlayer canvas") || [...document.querySelectorAll("canvas")].find(c => c.parentElement.id === "tlayer");
  const lk = document.querySelector("#landing .ld-link");
  let hit = null; if (lk) { const r = lk.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); hit = !!(e && lk.contains(e)); }
  return { u: L ? L.u() : 1, uT: L && L.uT ? L.uT() : null, active: L ? !!L.active : false, lTerry: lt ? +op(lt).toFixed(2) : 0, pTerry: pt ? +op(pt).toFixed(2) : 0, linkHit: hit,
    sh: document.documentElement.scrollHeight, ih: innerHeight, y: Math.round(scrollY), ovf: getComputedStyle(document.documentElement).overflowY + "/" + getComputedStyle(document.body).overflowY,
    busy: d ? d.dataset.busy : null, dis: d ? document.querySelector(".dk-in").disabled : null, goLab: d ? document.querySelector(".dk-go").getAttribute("aria-label") : null,
    dockText: d ? ((document.querySelector(".dk-text") || {}).textContent || "").slice(0, 60) : "", running: !!(window.TerryProj && TerryProj.running), planRunning: !!(window.__zoom && __zoom.planRunning),
    goalDis: document.querySelector("#goalin") ? document.querySelector("#goalin").disabled : null, theme: document.documentElement.dataset.theme, bat: window.TerryProj && TerryProj.bat && TerryProj.bat() ? TerryProj.bat().mode() : null };
});
// the rules that must hold whenever the page is at rest
function broken(s, prev) {
  const out = [];
  const rest = s.uT === null || Math.abs(s.u - s.uT) < 0.002;
  if (rest && s.u > 0.01 && s.u < 0.99) out.push(`the landing move rests mid-way (u=${s.u})`);
  if (rest && s.lTerry > 0.05 && s.pTerry > 0.05) out.push(`two Terrys at rest (landing ${s.lTerry}, planner ${s.pTerry})`);
  if (rest && s.u < 0.01 && s.active && s.linkHit === false) out.push("the landing shows but its buttons do not take clicks");
  if (rest && s.u > 0.99 && s.sh < s.ih * 2) out.push(`the planner shows but the page cannot scroll (height ${s.sh})`);
  if (rest && s.u > 0.99 && /hidden/.test(s.ovf.split("/")[0])) out.push(`the planner shows but the page's overflow is ${s.ovf}`);
  if (s.busy === "0" && s.dis) out.push("Ping is idle but its field is disabled");
  if (s.busy === "1" && s.goLab !== "Stop") out.push("Ping is busy but there is no Stop");
  if (s.busy === "0" && /^Listening/.test(s.dockText)) out.push("Ping is idle but still says Listening...");
  if (!s.running && !s.planRunning && s.goalDis) out.push("no chase is running but the goal box is disabled");
  return out;
}

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => { try { localStorage.setItem("terry.opening", "seen"); localStorage.setItem("terry.toured", "1"); localStorage.setItem("terry.seen", "1"); localStorage.setItem("terry.guide", "off"); } catch (e) {} });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|status of (429|502)/.test(m.text()) && errs.push(m.text()));
  p.on("dialog", d => d.dismiss().catch(() => {}));
  await p.route("**/three.min.js", r => r.fulfill({ path: THREE, contentType: "text/javascript" }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.route("**/api/llm", model);
  await p.goto(`http://localhost:${PORT}/index.html?landing=1`);
  for (let k = 0; k < 200 && !(await p.evaluate(() => !!(window.__zoom && __zoom.ready && window.TerryLanding)).catch(() => false)); k++) await sleep(300);
  await sleep(6000);
  const hist = []; let problems = 0, nErr = 0;
  const A = {
    wheelDown: async () => { await p.mouse.move(W / 2, H / 2); for (let i = 0, n = 1 + Math.floor(rnd() * 8); i < n; i++) { await p.mouse.wheel(0, 120 + rnd() * 500); await sleep(rnd() * 120); } },
    wheelUp: async () => { await p.mouse.move(W / 2, H / 2); for (let i = 0, n = 1 + Math.floor(rnd() * 10); i < n; i++) { await p.mouse.wheel(0, -(120 + rnd() * 600)); await sleep(rnd() * 120); } },
    flick: async () => { await p.mouse.move(W / 2, H / 2); await p.mouse.wheel(0, 300); await sleep(rnd() * 200); await p.mouse.wheel(0, -300); },
    key: async () => { await p.keyboard.press(pick(["PageDown", "PageUp", "Space", "ArrowDown", "ArrowUp", "Home", "End"])); },
    theme: async () => { const t = pick(["day", "night"]); await p.evaluate(t => { const bs = [...document.querySelectorAll(`[data-theme-set="${t}"]`)].filter(b => b.offsetParent); bs.length && bs[0].click(); }, t); },
    landingLink: async () => { await p.evaluate(() => { const l = [...document.querySelectorAll("#landing .ld-link")]; const b = l[Math.floor(Math.random() * l.length)]; if (b && b.offsetParent) b.click(); }); await sleep(500); await p.keyboard.press("Escape"); },
    terryFact: async () => { await p.evaluate(() => { const b = document.querySelector("#landing .ld-hit"); b && b.offsetParent && b.click(); }); },
    planOverlay: async () => { await p.evaluate(() => { const b = [...document.querySelectorAll("#landing button, #landing a")].find(x => /plan for 2025/i.test(x.textContent)); b && b.offsetParent && b.click(); }); await sleep(600 + rnd() * 800); await p.keyboard.press("Escape"); },
    chase: async () => {
      const ok = await p.evaluate(() => { const g = document.querySelector("#goalin"); return !!(g && !g.disabled && TerryLanding.u() > 0.99 && !TerryProj.running && !__zoom.planRunning); });
      if (!ok) return "skip";
      if (await p.evaluate(() => { const a = document.querySelector("#addroost"); return !!(a && !a.hidden && TerryState.roosts.length); })) { await p.click("#addroost").catch(() => {}); await sleep(700); }
      await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await p.fill("#goalin", pick(GOALS)).catch(() => {}); await p.press("#goalin", "Enter").catch(() => {}); await sleep(1200);
      if (await p.evaluate(() => !!document.querySelector(".gchip.opt"))) await p.click(".gchip.opt >> nth=0").catch(() => {});
    },
    fold: async () => { await p.evaluate(f => { const b = document.querySelector(`[data-all="${f}"]`); if (b && b.offsetParent) { b.scrollIntoView({ block: "center" }); b.click(); } }, pick(["fold", "open"])); },
    zoom: async () => { await p.evaluate(l => { if (window.__zoom && __zoom.goTo && TerryLanding.u() > 0.99) __zoom.goTo(l === 0 ? { lvl: 0 } : l === 1 ? { lvl: 1, d: "PARK" } : { lvl: 2, d: "BTDT", m: 6 }); }, Math.floor(rnd() * 3)); },
    scrollTo: async () => { await p.evaluate(f => { if (TerryLanding.u() > 0.99) scrollTo({ top: f * (document.documentElement.scrollHeight - innerHeight), behavior: Math.random() < .5 ? "smooth" : "instant" }); }, rnd()); },
    ask: async () => {
      modelMode = pick(["ok", "ok", "ok", "slow", "500", "429"]);
      const ok = await p.evaluate(() => { const i = document.querySelector(".dk-in"); return !!(i && !i.disabled && i.offsetParent && TerryLanding.u() > 0.99); });
      if (!ok) return "skip";
      await p.click(".dk-in").catch(() => {}); await p.fill(".dk-in", pick(QS)).catch(() => {}); await p.press(".dk-in", "Enter").catch(() => {});
      return modelMode;
    },
    stop: async () => { await p.evaluate(() => { const g = document.querySelector(".dk-go"); if (g && g.getAttribute("aria-label") === "Stop") g.click(); }); },
    escape: async () => { await p.keyboard.press("Escape"); },
    newChat: async () => { await p.evaluate(() => { const b = document.querySelector(".dk-new"); b && b.offsetParent && b.click(); }); },
    resize: async () => { const w = pick([1280, 1366, 1440, 1536]), h = pick([720, 768, 800, 864, 900]); await p.setViewportSize({ width: w, height: h }); },
  };
  const WEIGHT = { wheelDown: 6, wheelUp: 5, flick: 2, key: 2, theme: 3, landingLink: 2, terryFact: 1, planOverlay: 1, chase: 2, fold: 2, zoom: 3, scrollTo: 3, ask: 4, stop: 1, escape: 1, newChat: 1, resize: 1 };
  const bag = Object.entries(WEIGHT).flatMap(([k, w]) => Array(w).fill(k));
  for (let step = 1; step <= STEPS; step++) {
    const name = pick(bag), t0 = Date.now(); let note = "";
    try { note = (await A[name]()) || ""; } catch (e) { note = "threw " + e.message.split("\n")[0].slice(0, 80); }
    hist.push(`${step}:${name}${note ? "(" + note + ")" : ""}`);
    // settle: random short waits most of the time (actions pile up), a full settle now and then
    const full = rnd() < 0.3; await sleep(full ? 2600 : 150 + rnd() * 900);
    if (full) { for (let k = 0; k < 30; k++) { const s = await snap(p).catch(() => null); if (s && (s.uT === null || Math.abs(s.u - s.uT) < 0.002)) break; await sleep(200); } await sleep(700); }
    const s = await snap(p).catch(e => ({ err: e.message }));
    if (s.err) { log("snap failed", s.err); continue; }
    const bad = full ? broken(s) : broken(s).filter(x => !/rests mid-way|two Terrys|buttons do not|cannot scroll|overflow is/.test(x));   // the at-rest rules only after a full settle
    if (errs.length > nErr) { bad.push("page error: " + errs.slice(nErr).join(" | ").slice(0, 300)); nErr = errs.length; }
    if (bad.length) {
      problems++; log(`STEP ${step} BROKEN:`, bad.join("; ")); log("  state:", JSON.stringify(s)); log("  last:", hist.slice(-10).join(" "));
      await p.screenshot({ path: path.join(OUT, `stress-${SEED}-${step}.png`) }).catch(() => {});
      if (problems >= 12) break;
    }
    if (step % 25 === 0) log(`step ${step} ok so far, problems ${problems}, u=${s.u} theme=${s.theme} roosts? running=${s.running}`);
  }
  log("DONE seed", SEED, "steps", STEPS, "problems", problems, "errors", errs.length);
  await b.close(); srv.close(); process.exit(problems ? 1 : 0);
})();
