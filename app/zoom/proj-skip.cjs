// node proj-skip.cjs : reduced-motion end states and Skip during intro and goal (no live model)
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path");
const H = __dirname, SRC = { "engine.js": "../live/engine.js", "data.json": "../live/data.json", "terry-bat.js": "../brand/terry-bat.js", "terry.js": "../live/terry.js", "flyover.js": "../live/flyover.js" };
http.createServer((q, r) => { const p = q.url.split("?")[0].slice(1) || "index.html", f = path.join(H, SRC[p] || p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } const body = fs.readFileSync(f);
  if (p === "index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(`<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`); }
  r.writeHead(200, { "content-type": p.endsWith(".json") ? "application/json" : "text/javascript; charset=utf-8" }); r.end(body); }).listen(8792);
const sleep = ms => new Promise(r => setTimeout(r, ms)), out = path.join(H, "shots");
(async () => { const b = await chromium.launch(), log = [];
  async function page(rm, seen) { const c = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: rm ? "reduce" : "no-preference" }), p = await c.newPage(), errs = [];
    p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/fonts\.g|ERR_|Failed to load/.test(m.text()) && errs.push(m.text()));
    if (seen) await p.addInitScript(() => { try { localStorage.setItem("terry.seen", "1"); } catch (e) {} });
    await p.goto("http://localhost:8792/"); await p.waitForSelector("body[data-ready]"); return { p, errs }; }
  // 1 skip during intro
  let { p, errs } = await page(false, false); await sleep(4000); await p.click("#skipbtn"); await sleep(1500); await p.screenshot({ path: path.join(out, "proj-skip-intro.png") });
  log.push("intro skip: running=" + await p.evaluate(() => TerryProj.running) + " box=" + await p.evaluate(() => !document.querySelector("#goalbox").hidden) + " errs " + JSON.stringify(errs));
  // 2 skip during goal
  ({ p, errs } = await page(false, true)); await sleep(2000); await p.click(".gchip >> nth=0"); await sleep(1500);
  for (let k = 0; k < 4; k++) { const c = await p.$(".gchip.act"); if (!c) break; await c.click(); await sleep(1500); }
  await sleep(6000); await p.click("#skipbtn"); await sleep(3000); log.push("goal skip +3s running=" + await p.evaluate(() => TerryProj.running)); await sleep(9000); await p.screenshot({ path: path.join(out, "proj-skip-goal.png") });
  log.push("goal skip: running=" + await p.evaluate(() => TerryProj.running) + " pill=" + await p.evaluate(() => !document.querySelector("#goalpill").hidden) + " errs " + JSON.stringify(errs));
  // 3 reduced motion
  ({ p, errs } = await page(true, false)); await sleep(2500); await p.screenshot({ path: path.join(out, "proj-rm-start.png") });
  await p.click(".gchip >> nth=0"); await sleep(1500);
  for (let k = 0; k < 4; k++) { const c = await p.$(".gchip.act"); if (!c) break; await c.click(); await sleep(1500); }
  await sleep(5000); await p.screenshot({ path: path.join(out, "proj-rm-goal.png") });
  log.push("rm: running=" + await p.evaluate(() => TerryProj.running) + " pill=" + await p.evaluate(() => !document.querySelector("#goalpill").hidden) + " errs " + JSON.stringify(errs));
  // 4 pill edit + toggle
  await p.click("#goalpill"); await sleep(1200); log.push("edit: box=" + await p.evaluate(() => !document.querySelector("#goalbox").hidden) + " pill=" + await p.evaluate(() => !document.querySelector("#goalpill").hidden));
  console.log(log.join("\n")); await b.close(); process.exit(0); })();
