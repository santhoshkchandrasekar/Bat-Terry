process.env.PORT = '8835';
const B = require('../bshoot.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { await new Promise(r => B.srv.listen(B.PORT, r));
  const b = await B.chromium.launch({ args: B.ARGS }); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { localStorage.setItem('terry.opening', 'seen'); localStorage.setItem('terry.toured', '1'); localStorage.setItem('terry.seen', '1'); localStorage.setItem('terry.guide', 'off'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/three.min.js', r => r.fulfill({ path: (process.env.THREE_JS || __dirname + '/three.min.js'), contentType: 'text/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`http://localhost:${B.PORT}/?landing=0`); await sleep(4000);
  await p.evaluate(() => { const s = document.getElementById('screen'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 40); }); await sleep(600);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const lvl = await p.evaluate(() => { const leg = document.querySelector('#legend'); const z = window.__zoom; window.__dbg = z && z.G; return [document.querySelector('#stage') && document.querySelector('#stage').className, leg && leg.className, leg && Math.round(leg.getBoundingClientRect().top), leg && Math.round(leg.getBoundingClientRect().height), document.getElementById('fab').getBoundingClientRect().bottom | 0, innerHeight, leg.style.display, leg.className, leg.offsetHeight, leg.style.top, z && z.G && JSON.stringify({F: z.G.F, z1: z.G.z1, top: z.G.top, pho: z.G.pho})]; });
    out.push(await p.evaluate(() => [...document.querySelectorAll('#legend span[title]')].map(x => x.textContent).join('|') + ' W=' + document.querySelector('#legend').scrollWidth + '/' + document.querySelector('#legend').clientWidth)); await p.screenshot({ path: __dirname + `/out/lg${i}.png`, timeout: 120000 });
    const plus = await p.$('button[aria-label*="Zoom in"], .zoombtn.in, #zin'); if (!plus) { out.push('no plus'); break; } await plus.click(); await sleep(1800);
  }
  console.log(JSON.stringify(out), errs); await b.close(); B.srv.close(); })();
