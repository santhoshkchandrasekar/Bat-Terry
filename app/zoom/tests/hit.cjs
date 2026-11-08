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
  for (const u of [1]) { await p.evaluate(u => TerryLanding.seek(u), u); await sleep(4000);
    info.push(u + ':' + JSON.stringify(await p.evaluate(() => { const pg = document.getElementById('page'); return [pg.style.transform, Math.round(document.getElementById('screen').getBoundingClientRect().top)]; })));
    info.push(await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.top < 60 && r.top >= 0; }).map(b => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return (b.textContent.trim().slice(0,12)) + ':' + (b.contains(e) ? 'ok' : (e && (e.id || e.className || e.tagName))); }).join(' '))); }
  console.log(W, H, D, info.join(' '), errs); await b.close(); B.srv.close(); })();
