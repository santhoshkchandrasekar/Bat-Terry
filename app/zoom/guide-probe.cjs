// Probe: where Terry is drawn against the point he flies to (fixed layer and page layer). Prints the drawn box (alpha bbox of the 3D layer).
const B = require("./bshoot.cjs"), { sleep } = B; let N = 0; const SCR = process.env.SCR || "/tmp";
(async () => {
  B.srv.listen(B.PORT); const b = await B.chromium.launch({ args: B.ARGS });
  const p = await B.open(b, { seen: true, noguide: true, w: 1440, h: 900 });
  await p.waitForFunction(() => window.TerryProj && TerryProj.kit && window.__zoom && __zoom.ready, null, { timeout: 240000 }); await sleep(6000);
  const drawn = async () => {
    await p.evaluate(() => { document.documentElement.classList.add("probe"); const st = document.createElement("style"); st.id = "probe-css"; st.textContent = "html.probe body *:not(#tlayer):not(#tlayer *):not(#page){visibility:hidden!important} html.probe, html.probe body, html.probe #page{background:transparent!important} html.probe #tlayer{visibility:visible!important}"; document.head.appendChild(st); });
    const buf = await p.screenshot({ omitBackground: true, timeout: 240000 });
    await p.evaluate(() => { document.documentElement.classList.remove("probe"); document.getElementById("probe-css").remove(); });
    const f = `${SCR}/probe-${N++}.png`; require("fs").writeFileSync(f, buf); return f;
  };
  for (const [fixed, sy, tx, vy] of [[false, 0, 158, 194], [true, 0, 158, 194], [true, 0, 1166, 400], [true, 900, 700, 400]]) {
    await p.evaluate(([f, sy]) => { scrollTo(0, sy); TerryProj.kit.fix(f); }, [fixed, sy]); await sleep(500);
    const info = await p.evaluate(async ([tx, vy]) => { const K = TerryProj.kit, top = K.page.getBoundingClientRect().top; const y = vy - top; await K.fly(tx, y, 1500); await K.arrive(tx, y, 4000); const a = TerryProj.bat().anchor("body"), f = TerryProj.bat().anchor("feet"); return { target: [tx, vy], body: [Math.round(a.x), Math.round(a.y + top)], feet: [Math.round(f.x), Math.round(f.y + top)] }; }, [tx, vy]);
    await sleep(3000); const d = await drawn();
    console.log(JSON.stringify({ fixed, sy, ...info, drawn: d }));
    await p.evaluate(() => TerryProj.kit.fix(false));
  }
  console.log("errors", JSON.stringify(p.errs)); await b.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
