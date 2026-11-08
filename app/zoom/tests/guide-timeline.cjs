// The guided chase at real speed, as a timeline: each Ping line (start, typed, text), each move of the highlight, the scroll, the
// Almanac's prints and the screen rolling, so sync between Terry's words and what is on screen can be read off. Run:
// node tests/guide-timeline.cjs [goal]   -> tests/out/guide-timeline.txt and a few frames
const B = require("../bshoot.cjs"), { sleep } = B;
const fs = require("fs"), path = require("path"), OUT = path.join(__dirname, "out");
const GOAL = process.argv[2] || "Parks on time at least 80% in the summer";
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => B.srv.listen(B.PORT, r)); const b = await B.chromium.launch({ args: B.ARGS });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("terry.opening", "seen"); localStorage.setItem("terry.toured", "1"); localStorage.setItem("terry.seen", "1"); localStorage.removeItem("terry.guide"); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("**/three.min.js", r => r.fulfill({ path: path.join(__dirname, "three.min.js"), contentType: "text/javascript" }));
  await p.goto(`http://localhost:${B.PORT}/?landing=0`);
  await p.waitForFunction(() => window.__zoom && __zoom.ready && window.TerryGuide && window.TerryPing && window.TerryAlmanac, null, { timeout: 120000 }); await sleep(5000);
  await p.evaluate(() => {
    const T0 = performance.now(), L = window.__tl = [], t = () => ((performance.now() - T0) / 1000).toFixed(2);
    const name = e => !e ? "?" : e.id ? "#" + e.id : (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/)[0] : e.tagName ? e.tagName.toLowerCase() : "union");
    const g = TerryPing.guide; TerryPing.guide = async function (text, o) { L.push([t(), "SAY  ", text.slice(0, 90)]); const r = await g.apply(this, arguments); L.push([t(), "SAID ", text.slice(0, 40)]); return r; };
    const sp = TerryGuide.spot; TerryGuide.spot = function (els) { L.push([t(), "SPOT ", (els || []).filter(Boolean).map(name).join(" + ")]); return sp.apply(this, arguments); };
    const us = TerryGuide.unspot; TerryGuide.unspot = function () { L.push([t(), "UNSPOT", ""]); return us.apply(this, arguments); };
    const step = TerryAlmanac.chaseStep; if (step) TerryAlmanac.chaseStep = function (x) { L.push([t(), "ALM  ", String(x).slice(0, 60)]); return step.apply(this, arguments); };
    let lastY = -1, lastRoll = null, lastScrim = null;
    (function f() { const y = Math.round(scrollY); if (Math.abs(y - lastY) > (window.__tlFine ? 4 : 40)) { L.push([t(), "SCROLL", String(y)]); lastY = y; }
      const sc = document.querySelector(".tg-scrim"), on = !!(sc && sc.classList.contains("on")); if (on !== lastScrim) { L.push([t(), "DIM  ", on ? "on" : "off"]); lastScrim = on; }
      const st = document.querySelector("#stage"), rl = st ? (st.className.match(/\b(rolled|rolling|open|closed|half)\w*\b/g) || []).join(",") : ""; if (rl !== lastRoll) { L.push([t(), "SCREEN", rl || "(none)"]); lastRoll = rl; }
      if (!window.__tlStop) requestAnimationFrame(f); })();
  });
  await p.evaluate(() => scrollTo(0, 0)); await sleep(500);
  if (process.env.TOUR) await p.evaluate(() => { window.__tlFine = true; TerryGuide.tour({ replay: true }); });   // TOUR=1: the intro tour instead of a chase
  else { await p.fill("#goalin", GOAL); await p.press("#goalin", "Enter"); await sleep(1500);
    if (await p.evaluate(() => !!document.querySelector(".gchip.opt"))) await p.click(".gchip.opt >> nth=0"); }
  // frames at a few moments, for the eye
  const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < 240000) {
    const done = await p.evaluate(tour => tour ? !TerryGuide.active : !TerryProj.running && !__zoom.planRunning && TerryState.roosts.length >= 1 && !TerryGuide.active, !!process.env.TOUR).catch(() => false);
    if (done) break;
    if (k < 40 && (Date.now() - t0) > k * 4000) { await p.screenshot({ path: path.join(OUT, `gt-${String(k).padStart(2, "0")}.png`), timeout: 60000 }).catch(() => {}); k++; }
    await sleep(500);
  }
  await sleep(3000);
  const tl = await p.evaluate(() => { window.__tlStop = true; return window.__tl; });
  const txt = tl.map(r => r.join("  ")).join("\n") + `\nerrors: ${JSON.stringify(errs)}\n`;
  fs.writeFileSync(path.join(OUT, process.env.TOUR ? "tour-timeline.txt" : "guide-timeline.txt"), txt); console.log(txt);
  await b.close(); B.srv.close(); process.exit(0);
})();
