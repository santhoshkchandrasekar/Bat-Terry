// How much of the screen is repainted (re-rasterized) per frame during the landing move, and by which elements.
// Repaints are what a laptop graphics chip at 200% cannot keep up with (tiles show blank); moving or fading a layer that is already
// drawn costs almost nothing. Run: node tests/paint-profile.cjs [W H DPR]   -> total painted megapixels and the top painters.
const B = require("../bshoot.cjs"), { sleep } = B;
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900), DPR = +(process.argv[4] || 2);
(async () => {
  await new Promise(r => B.srv.listen(B.PORT, r));
  const b = await B.chromium.launch({ args: B.ARGS });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  await ctx.addInitScript(() => { try { localStorage.setItem("terry.opening", "seen"); localStorage.setItem("terry.toured", "1"); localStorage.setItem("terry.seen", "1"); } catch (e) {} });
  const p = await ctx.newPage();
  await p.route("**/three.min.js", r => r.fulfill({ path: __dirname + "/three.min.js", contentType: "text/javascript" }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`http://localhost:${B.PORT}/?landing=${process.env.PLANNER ? 0 : 1}${process.env.LDX ? '&ldx=' + process.env.LDX : ''}`);   // PLANNER=1 IDLE=1: what the planner redraws when nobody touches it await sleep(14000);
  await p.evaluate(() => { window.__uLog = []; (function f() { __uLog.push([performance.now(), window.TerryLanding && TerryLanding.u ? TerryLanding.u() : 1]); requestAnimationFrame(f); })(); });
  if (process.env.FREEZE) await p.evaluate(() => { try { TerryProj.bat()._debug.freeze(true); } catch (e) {} });   // FREEZE=1: Terry holds still (is he what repaints?)
  const cdp = await ctx.newCDPSession(p);
  const events = []; cdp.on("Tracing.dataCollected", d => events.push(...d.value));
  const done = new Promise(r => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame"].concat(process.env.WHY ? ["disabled-by-default-devtools.timeline.invalidationTracking"] : []) } });
  // the real input: wheel down through the whole move, then back up (IDLE=1: no input, the same length of time, for a baseline)
  await p.mouse.move(W / 2, H / 2);
  const tIn = await p.evaluate(() => performance.now()); let mid = null;
  if (process.env.IDLE) { await sleep(9000); }
  else if (process.env.SWEEP) {   // step the move by seek, marking each step in the trace, down then up
    const us = []; for (let i = 0; i <= 20; i++) us.push(i / 20); const all = process.env.UP ? us.slice().reverse() : us;
    for (const u of all) { process.stderr.write(u.toFixed(2) + " "); await p.evaluate(u => { console.timeStamp("u=" + u.toFixed(2)); TerryLanding.seek(u); }, u); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
    await sleep(800);
  }
  else {
  for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, 240); await sleep(40); }
  await sleep(2500);
  mid = await p.evaluate(() => TerryLanding.u());
  await p.evaluate(() => scrollTo(0, 0)); await sleep(300); for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, -240); await sleep(40); }
  await sleep(2500);
  }
  await cdp.send("Tracing.end"); await done;
  const paints = events.filter(e => e.name === "Paint" && e.args && e.args.data);
  const byNode = new Map(); let total = 0;
  for (const e of paints) {
    const c = e.args.data.clip || []; const xs = [c[0], c[2], c[4], c[6]], ys = [c[1], c[3], c[5], c[7]];
    const a = c.length ? Math.min(W * H, Math.max(0, Math.min(W, Math.max(...xs)) - Math.max(0, Math.min(...xs))) * Math.max(0, Math.min(H, Math.max(...ys)) - Math.max(0, Math.min(...ys)))) : 0;   // CSS px, clipped to the screen
    total += a; const k = e.args.data.nodeId || e.args.data.layerId || "?"; const v = byNode.get(k) || { n: 0, a: 0 }; v.n++; v.a += a; byNode.set(k, v);
  }
  // name the painting nodes
  const top = [...byNode.entries()].sort((x, y) => y[1].a - x[1].a).slice(0, 8);
  await cdp.send("DOM.getDocument", { depth: -1 });
  const names = [];
  for (const [id, v] of top) {
    let nm = String(id);
    try { const { object } = await cdp.send("DOM.resolveNode", { backendNodeId: +id }); const r = await cdp.send("Runtime.callFunctionOn", { objectId: object.objectId, functionDeclaration: "function(){ const e = this.nodeType === 1 ? this : this.parentElement; return e ? (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : '')).slice(0, 60) : '?'; }", returnByValue: true }); nm = r.result.value; } catch (e) {}
    names.push(`${nm}: ${v.n} paints, ${(v.a / 1e6).toFixed(1)} Mpx`);
  }
  if (process.env.DUMP) { const q = paints.filter(e => !(e.args.data.nodeId || e.args.data.layerId)).slice(0, 4).map(e => JSON.stringify(e.args.data).slice(0, 300)); console.log(q.join("\n")); }
  if (process.env.SWEEP) {
    const marks = events.filter(e => e.name === "TimeStamp" && e.args && e.args.data && /^u=/.test(e.args.data.message)).map(e => [e.ts, e.args.data.message]).sort((x, y) => x[0] - y[0]);
    const buck = new Map();
    for (const e of paints) { let m = null; for (const k of marks) { if (k[0] <= e.ts) m = k; else break; } const key = m ? m[1] : "before"; const c = e.args.data.clip || [], xs = [c[0], c[2], c[4], c[6]], ys = [c[1], c[3], c[5], c[7]];
      const a = c.length ? Math.min(W * H, Math.max(0, Math.min(W, Math.max(...xs)) - Math.max(0, Math.min(...xs))) * Math.max(0, Math.min(H, Math.max(...ys)) - Math.max(0, Math.min(...ys)))) : 0; buck.set(key, (buck.get(key) || 0) + a); }
    console.log("full screens repainted at each step (down then up):"); console.log([...buck.entries()].map(([k, v]) => k.slice(2) + ":" + (v / (W * H)).toFixed(1)).join(" "));
  }
  if (process.env.WHY) {   // why things were repainted: invalidation reasons by node
    const inv = events.filter(e => /Invalidation/.test(e.name) && e.args && e.args.data); const m = new Map();
    for (const e of inv) { const d = e.args.data; const k = e.name + " | " + (d.reason || "") + " | " + (d.nodeName || d.nodeId || ""); m.set(k, (m.get(k) || 0) + 1); }
    console.log("invalidations:"); [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log("  " + v + "  " + k.slice(0, 160)));
  }
  const frames = events.filter(e => e.name === "DrawFrame" || e.name === "BeginFrame").length;
  console.log(JSON.stringify({ W, H, DPR, uAtBottom: mid, paints: paints.length, paintedMpx: +(total / 1e6).toFixed(1), frames }));
  names.forEach(n => console.log("  " + n));
  await b.close(); B.srv.close(); process.exit(0);
})();
