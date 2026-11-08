process.env.PORT = '8830';
const B = require('../bshoot.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { await new Promise(r => B.srv.listen(B.PORT, r));
  const b = await B.chromium.launch({ args: B.ARGS }); const ctx = await b.newContext({ viewport: { width: 1280, height: 760 } });
  await ctx.addInitScript(() => { localStorage.setItem('terry.opening', 'seen'); localStorage.setItem('terry.toured', '1'); localStorage.setItem('terry.seen', '1'); });
  const p = await ctx.newPage(); await p.route('**/three.min.js', r => r.fulfill({ path: (process.env.THREE_JS || __dirname + '/three.min.js'), contentType: 'text/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`http://localhost:${B.PORT}/?landing=1`); await sleep(3500); await p.mouse.move(640, 400);
  await p.mouse.wheel(0, 300); const t0 = Date.now(); const tr = [];
  for (let i = 0; i < 80; i++) { await sleep(250); const u = await p.evaluate(() => TerryLanding.u()); tr.push(((Date.now() - t0) / 1000).toFixed(2) + ':' + u.toFixed(2)); if (u >= 1) break; }
  console.log(tr.join(' ')); await b.close(); B.srv.close(); })();
