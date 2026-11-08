process.env.PORT = '8825';
const B = require('../bshoot.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { await new Promise(r => B.srv.listen(B.PORT, r));
  const b = await B.chromium.launch({ args: B.ARGS }); const ctx = await b.newContext({ viewport: { width: 1280, height: 760 } });
  await ctx.addInitScript(() => { localStorage.setItem('terry.opening', 'seen'); localStorage.setItem('terry.toured', '1'); localStorage.setItem('terry.seen', '1'); localStorage.setItem('terry.guide', 'off'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/three.min.js', r => r.fulfill({ path: (process.env.THREE_JS || __dirname + '/three.min.js'), contentType: 'text/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`http://localhost:${B.PORT}/?landing=1`); await sleep(3500);
  await p.evaluate(() => TerryLanding.seek(1)); await sleep(2000);
  await p.fill('#goalin', 'Every Transportation request on time in November'); await p.press('#goalin', 'Enter'); await sleep(1200);
  if (await p.evaluate(() => !!document.querySelector('.gchip.opt'))) await p.click('.gchip.opt >> nth=0');
  for (let i = 0; i < 300; i++) { await sleep(1000); if (await p.evaluate(() => !TerryProj.running && TerryState.roosts.length >= 1)) break; }
  await sleep(2000);
  const pb = () => p.evaluate(() => { const B = TerryProj.bat(); return [B.mode(), Math.round(B._debug.st.x), Math.round(B._debug.st.y)]; });
  console.log('after chase planner', JSON.stringify(await pb()));
  await p.evaluate(() => scrollTo(0, 0)); await sleep(500);
  for (const u of [0.6, 0.3, 0]) { await p.evaluate(u => TerryLanding.seek(u), u); await sleep(1200);
    console.log('u', u, 'landing terry y', await p.evaluate(() => { const B = document.querySelector('.ld-terry-top'); return Math.round(window.TerryLanding.u() * 100); }), JSON.stringify(await pb())); await p.screenshot({ path: __dirname + `/out/rc-${u}.png`, timeout: 120000 }); }
  await sleep(3000); await p.screenshot({ path: __dirname + `/out/rc-land.png`, timeout: 120000 });
  for (const u of [0.5, 1]) { await p.evaluate(u => TerryLanding.seek(u), u); await sleep(1500); await p.screenshot({ path: __dirname + `/out/rc2-${u}.png`, timeout: 120000 }); }
  console.log('back in planner', JSON.stringify(await pb()), errs); await b.close(); B.srv.close(); })();
