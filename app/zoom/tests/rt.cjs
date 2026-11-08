process.env.PORT = '8826';
const B = require('../bshoot.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { await new Promise(r => B.srv.listen(B.PORT, r));
  const b = await B.chromium.launch({ args: B.ARGS }); const ctx = await b.newContext({ viewport: { width: 1280, height: 760 } });
  await ctx.addInitScript(() => { localStorage.setItem('terry.opening', 'seen'); localStorage.setItem('terry.toured', '1'); localStorage.setItem('terry.seen', '1'); localStorage.setItem('terry.guide', 'off'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ path: (process.env.THREE_JS || __dirname + '/three.min.js'), contentType: 'text/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`http://localhost:${B.PORT}/?landing=1`); await sleep(3500);
  const trip = async tag => {
    await p.evaluate(() => TerryLanding.enter()); for (let i = 0; i < 80; i++) { await sleep(250); if (await p.evaluate(() => !TerryLanding.active)) break; }
    const inS = await p.evaluate(() => [TerryLanding.u(), Math.round(scrollY)]);
    await p.evaluate(() => scrollTo(0, 0)); await sleep(300); await p.mouse.move(640, 400);
    for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, -400); await sleep(400); }
    for (let i = 0; i < 80; i++) { await sleep(250); if (await p.evaluate(() => TerryLanding.u() === 0)) break; }
    await sleep(500);
    const at = await p.evaluate(() => { const st = document.querySelector('.ld-terry-top canvas'); return [TerryLanding.u(), document.elementFromPoint(640, 380) && (document.elementFromPoint(640, 380).id || document.elementFromPoint(640, 380).className).toString().slice(0, 40)]; });
    await p.click('#landing [data-sheet=ld-311]'); await sleep(500);
    const open = await p.evaluate(() => document.getElementById('ld-311').classList.contains('open'));
    await p.keyboard.press('Escape'); await sleep(300);
    console.log(tag, JSON.stringify({ inS, at, sheetOpens: open }));
  };
  await trip('trip1'); await trip('trip2');
  console.log(errs); await b.close(); B.srv.close(); })();
