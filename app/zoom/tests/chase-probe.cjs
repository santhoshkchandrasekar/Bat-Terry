// Probe: one guided chase at the test clock; prints what the "chase finished" check waits on, every 20 s.
const B = require("../bshoot.cjs"), { sleep } = B;
const { chase } = require("../b1808-shoot.cjs");
(async () => {
  await new Promise(r => B.srv.listen(B.PORT, r));
  const b = await B.chromium.launch({ args: B.ARGS });
  const p = await B.open(b, { seen: true, w: 1440, h: 900, noguide: process.argv[2] === "noguide" });
  const t0 = Date.now(); let fin = false;
  chase(p, "Parks on time at least 80% in the summer", 1).then(ok => { fin = true; console.log("done", ok, ((Date.now() - t0) / 1000) | 0, "s"); });
  while (!fin && Date.now() - t0 < 20 * 60000) {
    await sleep(20000);
    const st = await p.evaluate(() => ({ plan: !!__zoom.planRunning, run: !!TerryProj.running, roosts: TerryState.roosts.length, add: !!document.querySelector("#addroost") && !document.querySelector("#addroost").hidden,
      guide: TerryGuide.active || null, held: !!TerryGuide.held, next: !!document.querySelector("#dock .dk-next"), mode: TerryProj.bat && TerryProj.bat() ? TerryProj.bat().mode() : "?", sp: (TerryGuide.spotted || []).join(",") })).catch(e => String(e));
    console.log(((Date.now() - t0) / 1000) | 0, JSON.stringify(st));
    // the guide holds a line until it is read: release it, as a reader would
    await p.evaluate(() => { if (TerryGuide.held) { TerryGuide.last = null; TerryGuide.release(); } }).catch(() => {});
  }
  console.log("errs", JSON.stringify(p.errs)); await b.close(); B.srv.close(); process.exit(0);
})();
