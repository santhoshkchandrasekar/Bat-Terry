// Guide shots and checks: the intro tour, the "?" explainers and the full guided chase, Day and Night; Skip leaves the page finished.
// Terry speaks through the Ping dock (guide lines in the thread); the presented section sits above the open dock, Terry never over it.
// A section with no room left above it for Terry (within 164 px of the band: his 124 px plus margins) only needs its top 120 px clear.
// Usage: node guide-shoot.cjs [day|night] (RM=1 for reduced motion). Shots: shots/guide-*.png
const B = require("./bshoot.cjs"), { sleep } = B, path = require("path");
const { until, chase, log } = require("./b1808-shoot.cjs");
const NIGHT = process.argv[2] === "night", RM = !!process.env.RM, T = (NIGHT ? "night" : "day") + (RM ? "-rm" : "");
const OUT = path.join(__dirname, "shots"); let fails = 0;
const check = (ok, what) => { log(ok ? "PASS" : "FAIL", what); if (!ok) fails++; };
const shot = async (p, n) => { await p.screenshot({ path: `${OUT}/guide-${n}-${T}.png`, timeout: 240000 }); log("shot", n); };
const hit = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const lineNow = p => p.evaluate(() => { const d = document.querySelector("#dock"); return d && d.dataset.kind === "guide" ? (d.querySelector(".dk-text .dk-stream") || {}).textContent || "" : ""; });
async function placed(p, label, fixed, keep) {
  const L = keep || await p.evaluate(() => TerryGuide.last); if (!L) return check(false, label + ": nothing recorded");
  log(label, "scroll asked", L.s, "scroll now", L.sy, L.hang ? "hanging" : "flying");
  if (L.terry) check(!(L.hang ? L.avoid : L.rects).some(r => r.width && hit(L.terry, r)), `${label}: Terry clear of ${L.hang ? (L.headerOnly ? "the header's words (header presented)" : "the header's words and the content") : "the presented rect"}`);
  if (!fixed) check((label === "tour stop 1" ? L.lead.y + L.lead.height : L.lead.y + (L.lead.height <= L.dockTop - 72 - 164 ? L.lead.height : 120)) <= L.dockTop + 1, `${label}: the section is above the open dock (top ${Math.round(L.lead.y)}, dock ${Math.round(L.dockTop)})`);
}
const finished = p => p.evaluate(() => ({ scrim: !!document.querySelector(".tg-scrim.on"), fixed: !!document.querySelector("#tlayer.tg-fixed"), roosts: TerryState.roosts.length,
  guides: document.querySelectorAll('#dock .dk-thread li[data-kind="guide"]').length + (document.querySelector("#dock").dataset.kind === "guide" ? 1 : 0), y: scrollY, from: TerryGuide.tourFrom, running: TerryProj.running, active: TerryGuide.active, skipHidden: document.querySelector("#skipbtn").hidden }));
async function waitLines(p, n, onLine) {   // each held stop: its guide line is in, then onLine(i, text), then release it
  let k = 0;
  for (let t = 0; t < 1200 && k < n; t++) {
    const st = await p.evaluate(() => ({ held: !!TerryGuide.held || (!!document.querySelector("#dock .dk-next") && !!TerryGuide.last), on: !!TerryGuide.active })).catch(() => ({}));
    if (!st.on && k) break;
    if (st.held) { k++; const full = await p.evaluate(() => { const d = document.querySelector("#dock .dk-text .dk-stream"); return d ? d.textContent : ""; }); const keep = await p.evaluate(() => TerryGuide.last);
      await p.evaluate(() => { TerryGuide.last = null; }); await onLine(k, full, keep); await p.evaluate(() => { if (TerryGuide.held) TerryGuide.release(); }); }
    await sleep(200);
  }
  return k;
}
(async () => {
  B.srv.listen(B.PORT); const b = await B.chromium.launch({ args: B.ARGS });
  const p = await B.open(b, { seen: true, w: 1440, h: 900, night: NIGHT, rm: RM });
  await until(p, () => window.__zoom && __zoom.ready && window.TerryGuide && window.TerryProj && TerryProj.kit, 90000); await p.evaluate(() => (TerryGuide.hold = true));
  let f; if (!process.env.CHASEONLY) {
  // 1 the tour plays by itself on a first visit; each line is a guide turn in the dock
  await sleep(12000); check(await p.evaluate(() => !TerryGuide.active), "the tour does not play by itself");
  await p.click(".dk-in"); await p.fill(".dk-in", "show me around"); await p.press(".dk-in", "Enter");   // Ping replays it on request
  check(await until(p, () => TerryGuide.active === "tour", 30000), "typing show me around into Ping starts the tour");
  const N = await p.evaluate(() => TerryGuide.TOUR.length), FIXI = await p.evaluate(() => TerryGuide.TOUR.findIndex(s => s.fixed) + 1);
  const got = await waitLines(p, N, async (i, text, keep) => { await sleep(500); await shot(p, `tour-${i}`); await placed(p, `tour stop ${i}`, i === FIXI, keep); log("line", i, text); if (RM) await p.click("#dock .dk-next"); });
  check(got === N, `tour said ${got} of ${N} lines in the dock`);
  await until(p, () => !TerryGuide.touring, 60000); await sleep(1500);
  f = await finished(p); log(JSON.stringify(f));
  check(!f.scrim && !f.fixed && f.roosts === 0 && Math.abs(f.y - f.from) <= 1 && f.skipHidden && f.guides >= N, "tour restores the page and keeps its lines in the thread");
  // 2 Skip at a stop (Escape at stop 2, the Skip button at stop 3): the page is restored
  for (const [stop, how] of [[2, "Escape"], [3, "button"]]) {
    await p.evaluate(() => { TerryGuide.tour({ replay: true }); });
    await waitLines(p, stop, async () => {});
    if (how === "Escape") await p.keyboard.press("Escape"); else await p.click("#skipbtn");
    await until(p, () => !TerryGuide.touring, 30000); await sleep(1500); f = await finished(p);
    check(!f.scrim && !f.fixed && Math.abs(f.y - f.from) <= 1 && f.skipHidden, `tour skipped at stop ${stop} (${how}) restores the page`);
  }
  // 3 "?" on the ledger: Terry flies there, the page dims, the dock explains it
  await p.evaluate(() => { const l = document.querySelector(".ldg-section") || document.querySelector("#ledger"); scrollTo(0, l.getBoundingClientRect().top + scrollY - 200); });
  await sleep(800); await p.hover("#ldg-sec-h"); await sleep(400);   // the "?" sits in the Ledger's section heading now (owner 6 Nov)
  check(await until(p, () => getComputedStyle(document.querySelector('.tg-q[data-q="ledger"]')).opacity === "1", 4000), "? shows on hover by the ledger heading");
  check(await p.evaluate(() => document.querySelector('.tg-q[data-q="ledger"]').getAttribute("aria-label") === "Ask Terry about the 2025 crew plan"), "? has its accessible label");
  await p.click('.tg-q[data-q="ledger"]');
  await waitLines(p, 1, async (i, text, keep) => { await sleep(400); await shot(p, "ask-ledger"); await placed(p, "? ledger", false, keep); log("explain", text); check(text.split(/[.!?](\s|$)/).filter(x => x && x.trim().length > 3).length >= 2, "the explanation has two or three sentences"); });
  await until(p, () => !TerryGuide.active, 30000); await sleep(1200);
  }
  // 4 the first chase: the full guided version
  const shots = []; let stop = false;
  const watch = (async () => {
    let lastSpot = "";
    while (!stop) {
      const st = await p.evaluate(() => ({ held: !!TerryGuide.held || (!!document.querySelector("#dock .dk-next") && !!TerryGuide.last), sp: TerryGuide.spotted.join(","), line: (document.querySelector("#dock .dk-text .dk-stream") || {}).textContent || "" })).catch(e => { if (!/closed|destroyed/.test(e.message)) log("watch error", e.message.slice(0, 160)); return {}; });
      if (st.held) { const nm = shots.some(x => x === "chase-predators") ? "chase-flyway" : "chase-predators"; /* the predators line always comes first */ await shot(p, nm); shots.push(nm); await placed(p, nm, false);
        await p.evaluate(() => { TerryGuide.last = null; if (TerryGuide.held) TerryGuide.release(); }); if (RM) await p.click("#dock .dk-next").catch(() => {}); }
      else if (st.sp && st.sp !== lastSpot) { lastSpot = st.sp; if (/failcard|almanac/.test(st.sp)) { await sleep(1800); const nm = /failcard/.test(st.sp) ? "chase-failcard" : "chase-machine"; await shot(p, nm); shots.push(nm); } }
      await sleep(250);
    }
  })();
  const ok1 = await chase(p, "Parks on time at least 80% in the summer", 1);
  if (RM) { await until(p, () => TerryGuide.active === "chase-rm", 8000); await until(p, () => !TerryGuide.active, 60000); }   // the walkthrough may start a moment after the chase
  stop = true; await watch; await sleep(1500); await shot(p, "chase-open");
  check(ok1, "first chase finished"); log("chase lines", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("#dock .dk-thread li, #dock .dk-text")].map(e => e.textContent.trim().slice(0, 70))))); log("chase shots", shots.join(" ")); log("guide trace", JSON.stringify(await p.evaluate(() => TerryGuide.trace || [])));
  check(shots.includes("chase-predators") && shots.includes("chase-flyway"), "full version said both lines");
  f = await finished(p); check(!f.scrim && !f.fixed && !f.active, "chase leaves no scrim or fixed layer");
  check(await p.evaluate(() => /predators/i.test(document.querySelector("#dock .dk-thread").textContent + document.querySelector("#dock .dk-text").textContent)), "the chase lines stay in the thread");
  // 5 the second chase: the short version (no lines), then Skip: Terry perches and the chase finishes fast
  if (!RM) {
    const g0 = (await finished(p)).guides;
    const go2 = chase(p, "Public Works on time at least 90% in August", 2);
    await until(p, () => (TerryGuide.spotted || []).includes("failcard"), 400000); await sleep(1500); await shot(p, "short-failcard");
    await p.click("#skipbtn").catch(e => log("skip click", e.message)); const t0 = Date.now();
    const ok2 = await go2; log("finished after Skip in", ((Date.now() - t0) / 1000).toFixed(1), "s");
    await sleep(5000); f = await finished(p); await shot(p, "short-skipped");
    check(ok2 && f.roosts === 2, "second chase finished after Skip"); check(f.guides === g0, "short version adds no lines");
    check(!f.scrim && !f.fixed, "Skip leaves no scrim or fixed layer");
    check(await p.evaluate(() => TerryProj.bat().mode() === "hang"), "Terry hangs on his perch after Skip");
  }
  log("errors", JSON.stringify(p.errs)); check(!p.errs.length, "zero console errors");
  log(fails ? `FAILS ${fails}` : "ALL PASS"); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
