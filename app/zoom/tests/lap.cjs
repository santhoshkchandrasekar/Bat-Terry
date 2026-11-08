process.env.PORT = '8810';
const B = require('../bshoot.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [W, H, D] = [+process.argv[2], +process.argv[3], +process.argv[4]];
(async () => { await new Promise(r => B.srv.listen(B.PORT, r));
  const b = await B.chromium.launch({ args: B.ARGS }); const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: D });
  await ctx.addInitScript(() => { localStorage.setItem('terry.opening', 'seen'); localStorage.setItem('terry.toured', '1'); localStorage.setItem('terry.seen', '1'); localStorage.setItem('terry.guide', 'off'); sessionStorage.setItem('terry.narrow', '1'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/three.min.js', r => r.fulfill({ path: (process.env.THREE_JS || __dirname + '/three.min.js'), contentType: 'text/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`http://localhost:${B.PORT}/?landing=1&ldhold=1`); await sleep(3500);
  const info = [];
  for (const u of [0, 0.3, 0.6, 0.85, 0.95, 1]) { await p.evaluate(u => TerryLanding.seek(u), u); await sleep(500);
    info.push(u + ':' + JSON.stringify(await p.evaluate(() => { const pg = document.getElementById('page'); return [pg.style.transform, Math.round(document.getElementById('screen').getBoundingClientRect().top)]; })));
    await p.screenshot({ path: __dirname + `/out/lap-${W}-${u}.png`, timeout: 120000, scale: 'css' }); }
  console.log(W, H, D, info.join(' '), errs); await b.close(); B.srv.close(); })();
