/* Quiet and slow: the equity map, a standing predator in the Roost (data from equity.js, built by src/09_equity.py).
 *
 * Two sides of one coin, drawn per hex of about 250 m: how loudly residents call (the hex's fill: a full hex calls more than the city
 * for the same patrol-and-report problems, a hollow ring calls less) and how often its requests run late for their mix (the tint: maple
 * when late more often than the citywide rates of the same types predict, slate when less often). Within 5% of 1 is the city norm and
 * stays neutral. No map tiles: Boston's shape is the hexes themselves.
 *
 *   TerryQuiet.open(scroll)            expand the card into the map
 *   TerryQuiet.highlight(names|null)   light those neighborhoods (Ping's map answers come in as ask:highlight {map: [...]})
 *   TerryQuiet.dot(entry)              a resident's ticket with a place: a dot at its neighborhood
 *   TerryQuiet.goal(spec|null)         after a chase, the goal view (owner 11 Nov): each neighborhood tinted by how often the goal's
 *                                      department ran late there in the goal's months of 2024, for its mix of request types, against the
 *                                      city; the places the chase's predators named are outlined. Page data only (the 2024 cells).
 */
(function (root) {
  "use strict";
  const doc = document, Q = () => root.TerryEquity, Bus = () => root.TerryBus;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const S3 = Math.sqrt(3), BAND = () => (Q() && Q().band) || 0.05;
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const pct = v => Math.round(Math.abs(v - 1) * 100);
  const callsTxt = v => `calls ${pct(v) < 1 ? "at the city rate" : `${pct(v)}% ${v < 1 ? "less" : "more"}`}`;
  const lateTxt = v => `late ${pct(v) < 1 ? "as often as expected" : `${pct(v)}% ${v < 1 ? "less" : "more"} often`}`;
  const HEX = [[S3 / 2, .5], [0, 1], [-S3 / 2, .5], [-S3 / 2, -.5], [0, -1], [S3 / 2, -.5]];
  const hexPath = (x, y, s) => "M" + HEX.map(([a, b]) => (x + a * s).toFixed(2) + " " + (y + b * s).toFixed(2)).join("L") + "Z";
  // tint bucket by wait (f = less often late, s = more often), neutral inside the band
  const tint = w => { const d = w - 1, a = Math.abs(d); if (a <= BAND()) return "n"; const k = a < .12 ? 1 : a < .25 ? 2 : 3; return (d < 0 ? "f" : "s") + k; };
  // fill scale by silence: hollow when quiet, full when loud, a middle hex at the norm
  const fillS = v => { const d = v - 1; if (Math.abs(d) <= BAND()) return .56; return d < 0 ? Math.max(.2, .5 - (Math.abs(d) - BAND()) * 1.6) : Math.min(.9, .66 + (d - BAND()) * 1.6); };
  let sec = null, card = null, sheet = null, G = null, hl = null, dotEntry = null, yr = 2024;
  let GV = null, view = "city", pendingGoal;   // the goal view's numbers, and which view is on show ("goal" | "city")
  // the big map's view (owner 21:48): zoom k (1 = the whole city) about a centre; pan by dragging; labels keep their size on screen
  const Z = { k: 1, cx: null, cy: null, KMAX: 6 };
  function vb() { const g = geo(), W = g.x1 - g.x0, H = g.y1 - g.y0, w = W / Z.k, h = H / Z.k;
    if (Z.cx === null) { Z.cx = g.x0 + W / 2; Z.cy = g.y0 + H / 2; }
    Z.cx = Math.max(g.x0 + w / 2, Math.min(g.x1 - w / 2, Z.cx)); Z.cy = Math.max(g.y0 + h / 2, Math.min(g.y1 - h / 2, Z.cy));
    return { x: Z.cx - w / 2, y: Z.cy - h / 2, w, h }; }
  // the year on show (owner 21:48: echolocation compared for both years); 2023 uses the same grid, types and shrinkage
  const yv = n => yr === 2023 && n.silence_2023 != null ? Object.assign({}, n, { silence: n.silence_2023, wait: n.wait_2023 }) : n;

  function geo() {
    if (G) return G; const E = Q(), g = E.grid;
    const mk = list => list.map(h => ({ q: h[0], r: h[1], sil: h[2], wait: h[3], n: h[4], nb: h[5], x: S3 * h[0] + S3 / 2 * h[1], y: -1.5 * h[1] }));
    const all = mk(E.hexes.concat(E.hexes_2023 || []));   // bounds over both years so the map does not jump when the year switches
    const hs = (yr === 2023 && E.hexes_2023 ? E.hexes_2023 : E.hexes).map(h => ({ q: h[0], r: h[1], sil: h[2], wait: h[3], n: h[4], nb: h[5], x: S3 * h[0] + S3 / 2 * h[1], y: -1.5 * h[1] }));
    const xs = all.map(h => h.x), ys = all.map(h => h.y), pad = 1.6;
    const at = (lat, lon) => ({ x: (lon - g.lon0) * g.kx / g.radius_km, y: -(lat - g.lat0) * g.ky / g.radius_km });
    const nbs = E.neighborhoods.map((n, i) => Object.assign({ i }, at(n.lat, n.lon), yv(n)));
    const lms = LANDMARKS.map(l => Object.assign({}, l, at(l.lat, l.lon)));
    G = { hs, nbs, lms, x0: Math.min(...xs, ...lms.map(l => l.x - 4)) - pad, x1: Math.max(...xs, ...lms.map(l => l.x + 4)) + pad, y0: Math.min(...ys, ...lms.map(l => l.y - 1)) - pad, y1: Math.max(...ys, ...lms.map(l => l.y + 1)) + pad };
    return G;
  }
  // places anyone knows, drawn as faint text at their real coordinates (no coastline is invented)
  const LANDMARKS = [{ t: "Downtown", lat: 42.3555, lon: -71.0590, k: "land" }, { t: "Logan Airport", lat: 42.3656, lon: -71.0096, k: "land" },
    { t: "Boston Harbor", lat: 42.3420, lon: -71.0180, k: "water" }, { t: "Charles River", lat: 42.3585, lon: -71.0860, k: "water" }, { t: "Dorchester Bay", lat: 42.3040, lon: -71.0330, k: "water" }];
  const short = () => String(Q().headline || "").split(":")[0].replace(/\.?$/, ".");   // the data's headline, first clause only
  const NAMED = () => { const n = Q().named; return [].concat(n.quiet_well_served, n.slowest, n.both); };

  // ------------------------------------------------------------ the goal view (owner 11 Nov)
  // For the goal's department(s) and months: each neighborhood's late requests against what the city's late rate for the same request
  // types predicts (observed / expected), lightly shrunk toward 1 like the city map (k = 40). A neighborhood with fewer than 40 requests
  // in those months is judged on its full year; fewer than 40 in the year is too few to judge.
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DL = ["PWDx", "BTDT", "PARK", "ISD"], MIN_N = 40, K = 40;
  function monthsText(ms) {
    const m = [...new Set(ms || [])].sort((a, b) => a - b); if (!m.length || m.length === 12) return "2024";
    const run = m.every((v, i) => !i || v === m[i - 1] + 1);
    return (m.length === 1 ? MONTHS[m[0] - 1] : run ? `${MONTHS[m[0] - 1]} to ${MONTHS[m[m.length - 1] - 1]}` : m.map(v => MONTHS[v - 1]).join(", ").replace(/, ([^,]*)$/, " and $1")) + " 2024";
  }
  function goalMap(spec) {
    const Z = root.__zoom, E = Z && Z.E, C = E && E.data && E.data.cells, EQ = Q(); if (!C || !EQ) return null;
    const ds = new Set(spec.scope === "CITY" ? [0, 1, 2, 3] : [DL.indexOf(spec.scope)]); if (ds.has(-1)) return null;
    const ms = spec.months && spec.months.length && spec.months.length < 12 ? new Set(spec.months) : null;
    // city rates per (department, type), in the months and in the year; per neighborhood, requests and late per (department, type)
    const cityM = new Map(), cityY = new Map(), hoodM = new Map(), hoodY = new Map(), add = (m, k, n, l) => { const v = m.get(k) || [0, 0]; v[0] += n; v[1] += l; m.set(k, v); };
    let cn = 0, cl = 0;
    for (const row of C.rows) {
      if (!ds.has(row[0])) continue; const k = row[0] + ":" + row[1], inM = !ms || ms.has(row[3]);
      add(cityY, k, row[4], row[5]); add(hoodY, row[2] + "|" + k, row[4], row[5]);
      if (inM) { add(cityM, k, row[4], row[5]); add(hoodM, row[2] + "|" + k, row[4], row[5]); cn += row[4]; cl += row[5]; }
    }
    const judge = (hi, hood, city) => {   // observed and expected late for one neighborhood
      let n = 0, obs = 0, exp = 0;
      for (const [key, v] of hood) { const [h, k] = key.split("|"); if (+h !== hi) continue; const c = city.get(k); if (!c || !c[0]) continue; n += v[0]; obs += v[1]; exp += v[0] * c[1] / c[0]; }
      return { n, obs, exp };
    };
    const by = {}, list = [];
    EQ.neighborhoods.forEach((nb, i) => {
      const hi = C.hoods.indexOf(nb.name); let j = hi < 0 ? { n: 0, obs: 0, exp: 0 } : judge(hi, hoodM, cityM), basis = ms ? "months" : "year";
      if (j.n < MIN_N && ms && hi >= 0) { j = judge(hi, hoodY, cityY); basis = "year"; }
      const thin = j.n < MIN_N || j.exp <= 0, rate = j.exp / Math.max(1, j.n);
      const ratio = thin ? 1 : (j.obs + K * rate) / (j.exp + K * rate);
      by[i] = { i, name: nb.name, short: nb.short || nb.name, n: j.n, late: j.obs / Math.max(1, j.n), r: ratio, thin, basis };
      list.push(by[i]);
    });
    const judged = list.filter(x => !x.thin), band = BAND();
    const top = judged.filter(x => x.r > 1 + band).sort((a, b) => b.r - a.r).slice(0, 3), low = judged.filter(x => x.r < 1 - band).sort((a, b) => a.r - b.r).slice(0, 2);
    // the places the chase named (a predator with a neighborhood), confirmed or ruled out by the 2024 records
    const named = new Map();
    for (const p of spec.preds || []) {
      const hn = p && p.hood; if (!hn) continue; const k = String(hn).toLowerCase();
      const nb = EQ.neighborhoods.findIndex(n => n.name.toLowerCase() === k) >= 0 ? EQ.neighborhoods.findIndex(n => n.name.toLowerCase() === k) : EQ.neighborhoods.findIndex(n => n.name.toLowerCase().includes(k) || k.includes((n.short || n.name).toLowerCase()));
      if (nb < 0) continue; const ok = p.verdict === "CONFIRMED", prev = named.get(nb);
      if (!prev || ok) named.set(nb, { ok, label: p.label || "" });
    }
    return { spec, by, list, top, low, named, cityLate: cl / Math.max(1, cn), n: cn, dept: spec.deptName || "These departments", when: monthsText(spec.months),
      thinCount: list.filter(x => x.thin).length };
  }
  const isGoal = () => view === "goal" && !!GV;
  // the edge of a neighborhood: every hexagon side whose neighbour across it belongs elsewhere, drawn in the gap between hexagons
  function outlines() {
    const g = geo(), out = [];
    for (const [nb, v] of GV.named) {
      const own = g.hs.filter(h => h.nb === nb), key = (x, y) => Math.round(x * 20) + "," + Math.round(y * 20), have = new Set(own.map(h => key(h.x, h.y)));
      let d = "";
      for (const h of own) for (let i = 0; i < 6; i++) {
        const a = HEX[i], b = HEX[(i + 1) % 6], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (have.has(key(h.x + 2 * mx, h.y + 2 * my))) continue;
        d += `M${(h.x + a[0]).toFixed(2)} ${(h.y + a[1]).toFixed(2)}L${(h.x + b[0]).toFixed(2)} ${(h.y + b[1]).toFixed(2)}`;
      }
      if (d) out.push(`<path class="qedge ${v.ok ? "ok" : "no"}" d="${d}"/>`);
    }
    return `<g class="qedges">${out.join("")}</g>`;
  }
  const gvTint = d => (d.thin ? "thin" : tint(d.r));
  const gvLine = d => d.thin ? "too few requests to judge" : `late ${pct(d.r) < 1 ? "as often as expected" : `${pct(d.r)}% ${d.r < 1 ? "less" : "more"} often`}`;
  function gvHead() {
    const g = GV, t = g.top.map(x => x.short), when = g.when.replace(/ 2024$/, "");
    const tail = g.when === "2024" ? "in 2024" : `in ${when} 2024`;
    if (!t.length) return `${g.dept} ran late about evenly across Boston ${tail}, for the kinds of requests each place sends.`;
    return `${g.dept} ran late most often in ${t.length > 1 ? t.slice(0, -1).join(", ") + " and " + t[t.length - 1] : t[0]} ${tail}.`;
  }

  // the map as one SVG; big adds labels and per-hex titles
  function mapSvg(big) {
    const g = geo(), W = g.x1 - g.x0, H = g.y1 - g.y0, E = Q();
    const hexes = g.hs.map((h, k) => {
      const gd = isGoal() ? GV.by[h.nb] : null, t = gd ? gvTint(gd) : tint(h.wait), d = reduced() || !big ? 0 : Math.round((h.y - g.y0) / H * 520 + (k % 7) * 9);
      const cz = "";
      const core = gd ? (gd.thin ? 0 : .78) : fillS(h.sil);   // the goal view tints whole hexes: only lateness is on show
      return `<g class="qh w-${t}${cz}" data-nb="${h.nb}" data-i="${k}"${d ? ` style="animation-delay:${d}ms"` : ""}><path class="ring" d="${hexPath(h.x, h.y, .9)}"/>${core ? `<path class="core" d="${hexPath(h.x, h.y, core * .9)}"/>` : ""}</g>`;
    }).join("");
    const V = big ? vb() : { x: g.x0, y: g.y0, w: W, h: H };
    return `<svg class="qmap${big ? " big" : ""}${isGoal() ? " gview" : ""}" viewBox="${V.x.toFixed(2)} ${V.y.toFixed(2)} ${V.w.toFixed(2)} ${V.h.toFixed(2)}" ${big ? `role="img" aria-label="Echolocation: ${isGoal() ? `your goal's map of Boston in hexagons. ${esc(gvHead())}` : `the equity map of Boston in hexagons, with Downtown, Logan Airport, Boston Harbor, the Charles River and Dorchester Bay marked. ${esc(E.headline)}`}"` : 'aria-hidden="true"'}><g class="qhs">${hexes}</g>${isGoal() ? outlines() : ""}<g class="qlm"></g><g class="qlabels"></g><g class="qdot"></g></svg>`;
  }
  // labels for the named neighborhoods (and any highlighted ones), nudged apart; drawn in map units, sized for the rendered width
  function drawLabels(svg) {
    const L = svg.querySelector(".qlabels"); if (!L) return; const g = geo(), r = svg.getBoundingClientRect(), u = vb().w / Math.max(200, r.width);   // map units per pixel, for the current view
    const want = new Set(hl ? [...hl] : []), must = new Set(want);
    (isGoal() ? GV.top.map(x => x.name).concat([...GV.named].filter(([, v]) => v.ok).map(([i]) => Q().neighborhoods[i].name), GV.low.map(x => x.name)) : NAMED()).forEach(n => want.add(n));
    if (isGoal()) GV.top.forEach(x => must.add(x.name)); else NAMED().forEach(n => must.add(n));   // the city view keeps all six of its named places
    const order = [...want];
    const boxes = [], out = [], hit = (x, y, w, h) => boxes.some(b => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
    if (dotEntry) { const d = g.nbs.find(n => n.name === dotEntry.place.neighborhood); if (d) boxes.push({ x: d.x - 80 * u, y: d.y + 10 * u, w: 72 * u, h: 16 * u }); }   // the ticket's "your report" tag
    { const M = svg.querySelector(".qlm"); if (M) { M.innerHTML = g.lms.map(l => { const w = l.t.length * 6.4 * u, h = 13 * u; boxes.push({ x: l.x - w / 2, y: l.y - h * .8, w, h }); return `<text class="${l.k}" x="${l.x.toFixed(2)}" y="${l.y.toFixed(2)}" text-anchor="middle" style="font-size:${(11.5 * u).toFixed(3)}px">${esc(l.t)}</text>`; }).join(""); } }
    const ls = g.nbs.filter(n => want.has(n.name)).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)), dots = ls.map(n => ({ x: n.x - 4 * u, y: n.y - 4 * u, w: 8 * u, h: 8 * u }));
    boxes.push(...dots);
    ls.forEach(n => {
      const w = n.short.length * 7.4 * u, h = 16 * u;   // one line: the name (owner 11 Nov: the map was crowded)
      // beside the dot first (the side with more room), then the other side, above, below; never far from the dot
      const east = n.x > (g.x0 + g.x1) / 2, R = { x: n.x + 9 * u, y: n.y - 13 * u }, Lf = { x: n.x - 9 * u - w, y: n.y - 13 * u };
      const cands = (east ? [R, Lf] : [Lf, R]).concat([{ x: n.x - w / 2, y: n.y - 9 * u - h }, { x: n.x - w / 2, y: n.y + 9 * u }, { x: R.x, y: R.y + 20 * u }, { x: Lf.x, y: Lf.y + 20 * u }, { x: R.x, y: R.y - 20 * u }, { x: Lf.x, y: Lf.y - 20 * u }]);
      const self = dots[ls.indexOf(n)], others = () => boxes.filter(b => b !== self);
      let pick = cands.find(c => c.x >= g.x0 && c.x + w <= g.x1 + 40 * u && !others().some(b => c.x < b.x + b.w && c.x + w > b.x && c.y < b.y + b.h && c.y + h > b.y));
      if (!pick) { if (!must.has(n.name)) return; pick = cands[0]; }
      const { x, y } = pick; boxes.push({ x, y, w, h }); void hit;
      const on = !hl || hl.has(n.name), side = x > n.x ? x - 2 * u : x + w < n.x ? x + w + 2 * u : null, ly = y + h / 2 > n.y ? y : y + h;
      out.push(`<g class="ql${on ? "" : " off"}"><circle cx="${n.x.toFixed(2)}" cy="${n.y.toFixed(2)}" r="${(3 * u).toFixed(2)}"/>` + (side === null && Math.abs(ly - n.y) < 6 * u ? "" : `<line x1="${n.x.toFixed(2)}" y1="${n.y.toFixed(2)}" x2="${(side === null ? n.x : side).toFixed(2)}" y2="${(side === null ? ly : y + 8 * u).toFixed(2)}" stroke-width="${u.toFixed(3)}"/>`) +
        `<text x="${x.toFixed(2)}" y="${(y + 12 * u).toFixed(2)}" style="font-size:${(13 * u).toFixed(3)}px;stroke-width:${(3.6 * u).toFixed(3)}px">${esc(n.short)}</text></g>`);
    });
    L.innerHTML = out.join("");
  }
  function drawDot(svg) {
    const D = svg.querySelector(".qdot"); if (!D) return; D.textContent = ""; if (!dotEntry) return;
    const n = geo().nbs.find(x => x.name === dotEntry.place.neighborhood); if (!n) return; const big = svg.classList.contains("big");
    const u = big ? vb().w / Math.max(200, svg.getBoundingClientRect().width) : .9;
    D.innerHTML = `<circle class="pulse" cx="${n.x.toFixed(2)}" cy="${n.y.toFixed(2)}" r="${(big ? 9 * u : 2.4).toFixed(2)}"/><circle class="pin" cx="${n.x.toFixed(2)}" cy="${n.y.toFixed(2)}" r="${(big ? 5 * u : 1.6).toFixed(2)}" stroke-width="${(big ? 2 * u : .5).toFixed(2)}"><title>Your report, in ${esc(n.short)}</title></circle>` +
      (big ? `<text class="you" x="${(n.x - 8 * u).toFixed(2)}" y="${(n.y + 22 * u).toFixed(2)}" text-anchor="end" style="font-size:${(11 * u).toFixed(3)}px;stroke-width:${(3 * u).toFixed(3)}px">your report</text>` : "");
  }
  function paint() {
    doc.querySelectorAll(".qmap").forEach(svg => {
      const on = hl ? new Set(Q().neighborhoods.map((n, i) => (hl.has(n.name) ? String(i) : null)).filter(Boolean)) : null;
      svg.classList.toggle("hl", !!hl); svg.querySelectorAll(".qh").forEach(h => h.classList.toggle("on", !!on && on.has(h.dataset.nb)));
      if (svg.classList.contains("big")) drawLabels(svg); drawDot(svg);
    });
    if (sheet) sheet.querySelectorAll(".qn").forEach(b => b.setAttribute("aria-pressed", String(!!hl && hl.has(b.dataset.nb))));
  }

  const legend = () => `<div class="qleg" aria-label="Legend">
      <div class="qlr"><span class="qlh">How loudly it calls</span><span class="qli"><svg viewBox="-1 -1 2 2" aria-hidden="true"><path class="ring" d="${hexPath(0, 0, .9)}"/><path class="core" d="${hexPath(0, 0, .2 * .9)}"/></svg>quieter than the city</span><span class="qli"><svg viewBox="-1 -1 2 2" aria-hidden="true"><path class="ring" d="${hexPath(0, 0, .9)}"/><path class="core" d="${hexPath(0, 0, .9 * .9)}"/></svg>louder</span></div>
      <div class="qlr"><span class="qlh">How often it runs late, for its mix</span><span class="qli w-f3"><i></i>less often than expected</span><span class="qli w-n"><i></i>about as expected</span><span class="qli w-s3"><i></i>more often</span></div></div>`;
  const legendGoal = () => `<div class="qleg" aria-label="Legend">
      <div class="qlr"><span class="qlh">How often it ran late, for its mix of requests</span><span class="qli w-f3"><i></i>less often</span><span class="qli w-n"><i></i>about as expected</span><span class="qli w-s3"><i></i>more often</span><span class="qli thin"><i></i>too few to judge</span></div>
      ${GV && GV.named.size ? `<div class="qlr"><span class="qlh">Places your chase named</span><span class="qli cz-ok"><i></i>confirmed by 2024</span><span class="qli cz-no"><i></i>ruled out</span></div>` : ""}</div>`;
  const dv = d => d.thin ? "n/a" : pct(d.r) < 1 ? "even" : `${d.r > 1 ? "+" : "\u2212"}${pct(d.r)}%`;
  const row = (d, extra) => `<button type="button" class="qn qr w-${gvTint(d)}" data-nb="${esc(d.name)}" aria-pressed="false" aria-label="${esc(d.short)}: ${esc(gvLine(d))}"><i aria-hidden="true"></i><span class="qrn"><b>${esc(d.short)}</b><span>${extra ? esc(extra) + " · " : ""}${d.thin ? "too few requests" : `${d.n.toLocaleString("en-US")} requests, ${Math.round(d.late * 100)}% late`}</span></span><span class="qrv">${dv(d)}</span></button>`;
  function groupsGoal() {
    const g = GV, nm = [...g.named.entries()];
    const out = [];
    if (g.top.length) out.push(["Ran late most", g.top.map(d => row(d))]);
    if (g.low.length) out.push(["Ran late least", g.low.map(d => row(d))]);
    const yes = nm.filter(([, v]) => v.ok), no = nm.filter(([, v]) => !v.ok);
    if (yes.length) out.push(["Your chase named, and 2024 confirmed", yes.map(([i]) => row(g.by[i]))]);
    const ruled = no.length ? `<p class="qruled"><span>Named, then ruled out by 2024:</span> ${no.map(([i]) => esc(g.by[i].short)).join(", ")}.</p>` : "";
    if (!out.length) return `<p class="qempty">No neighborhood stood apart for this goal; every judged place ran late within 5% of what its mix predicts.</p>${ruled}`;
    return `<div class="qgroups">${out.map(([t, rows]) => `<div class="qg qrl"><span class="qgh">${t}</span>${rows.join("")}</div>`).join("")}${ruled}</div>`;
  }
  function groups() {
    const E = Q(), by = new Map(E.neighborhoods.map((n, i) => [n.name, Object.assign({ i }, yv(n))]));
    const G3 = [["Quiet but well served", E.named.quiet_well_served], ["Slowest for their mix", E.named.slowest], ["A little of both", E.named.both]];
    return `<div class="qgroups">${G3.map(([t, ns]) => `<div class="qg qrl"><span class="qgh">${t}</span>${ns.map(nm => { const n = by.get(nm); return n ? `<button type="button" class="qn qr w-${tint(n.wait)}" data-nb="${esc(n.name)}" aria-pressed="false"><i aria-hidden="true"></i><span class="qrn"><b>${esc(n.short)}</b><span>${callsTxt(n.silence)}, ${lateTxt(n.wait)}</span></span><span class="qrv"></span></button>` : ""; }).join("")}</div>`).join("")}</div>`;
  }

  const nPlaces = () => { const n = Q().named; return new Set([].concat(n.quiet_well_served, n.slowest, n.both)).size; };
  function build() {
    const tt = doc.querySelector("#terrytory"), E = Q(); if (!tt || !E || sec) return !!sec;
    // the brief's other consideration: city workers logged about half of these requests. Who reports changes how long people wait.
    // Figures from the notebook's section 8 (2024, the four departments): share logged by city workers; share closed late and the
    // median days to close, residents' requests against workers'.
    const WHO = [["Public Works", 50, 10, 10, 0.5, 0.1], ["Transportation", 62, 50, 50, 1.6, 0.9], ["Parks", 60, 10, 5, 1.9, 2.8], ["Inspectional Services", 40, 29, 25, 3.2, 2.2]];
    const whoRow = () => `<div class="qrow qs-who"><div class="pp ok qs-card who-card"><span class="art ochre" aria-hidden="true"><svg viewBox="0 0 120 80" width="100%" height="100%"><use href="#r2-p-quiet"/></svg></span>
        <span class="where">Boston, by who reports</span><span class="nm">City workers and residents</span>
        <span class="key"><span class="num"><span class="disp t">53%</span></span><span class="u">logged by city workers</span></span>
        <span class="ans on"><span><span class="lab">How Terry plans to escape it</span>The plan staffs for both. Residents wait longer in three of four departments, so on time alone hides their wait.</span></span></div>
        <div class="plate who-plate"><table class="who-t"><caption class="sr">Requests logged by city workers and by residents, 2024</caption>
          <thead><tr><th scope="col">Department</th><th scope="col">Logged by workers</th><th scope="col">Late<small>residents / workers</small></th><th scope="col">Days to close<small>residents / workers</small></th></tr></thead>
          <tbody>${WHO.map(([n, w, lr, lw, dr, dw]) => `<tr><th scope="row">${n}</th><td>${w}%</td><td>${lr}% / ${lw}%</td><td${dr > dw ? ' class="slow"' : ""}>${dr} / ${dw}</td></tr>`).join("")}</tbody></table>
          <p class="who-note">Median days, 2024. Workers log what they find on patrol, and it closes fast; a resident's request waits in the queue.</p></div></div>`;
    if (!tt.querySelector("#rbodies")) return false;
    sec = doc.createElement("section"); sec.className = "pred qs"; sec.setAttribute("aria-labelledby", "qs-h");
    const st = E.stats;
    sec.innerHTML = `<header class="guide"><div class="gh"><button type="button" class="fold-chev" data-fold="echo" aria-expanded="true" aria-label="Fold Echolocation">${root.TerryArt && root.TerryArt.ic ? root.TerryArt.ic("chev", "fold-i") : ""}</button><h2 class="disp" id="qs-h"><span class="bw">Echolocation</span></h2><span class="heard">${E.stats.neighborhoods} neighborhoods, ${E.year} requests</span></div><p class="qs-line">Boston, mapped by who calls and who waits.</p></header>
      <div class="board"><div class="qrow">
        <button type="button" class="pp ok qs-card" aria-expanded="false" aria-controls="qs-sheet"><span class="art rust" aria-hidden="true"><svg viewBox="0 0 120 80" width="100%" height="100%"><use href="#r2-p-quiet"/></svg></span>
          <span class="where">Boston, by neighborhood</span><span class="nm">Quiet and slow</span>
          <span class="key"><span class="num"><span class="disp t">2 problems, ${nPlaces()} places</span></span><span class="u">${Math.abs(st.rho_2024) < .3 ? "quiet in some, slow in others" : "quiet and slow together"}</span></span>
          <span class="ans on"><span><span class="lab">How Terry plans to escape it</span>Not one problem. Outreach where it is quiet; a look at the queue where it runs late.</span></span><svg class="chev i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="qprev plate" aria-hidden="true">${mapSvg(false)}<p class="disp">${esc(short())}</p><span class="qopen">Open the map</span></div>
      </div>${whoRow()}</div>`;
    tt.appendChild(sec);
    card = sec.querySelector(".qs-card");
    if (pendingGoal !== undefined) { const pg = pendingGoal; pendingGoal = undefined; GV = pg ? goalMap(pg) : null; view = GV ? "goal" : "city"; if (GV) rerender(); }
    card.addEventListener("click", () => toggle());
    sec.querySelector(".qprev").addEventListener("click", () => toggle(true));
    paint();
    return true;
  }
  // the headline for the year on show: 2024 is the data's own; 2023 names that year's quietest and slowest places
  function headFor() {
    if (yr !== 2023) return short(); const ns = Q().neighborhoods.map(yv);
    const q = ns.reduce((a, b) => (b.silence < a.silence ? b : a)), w = ns.reduce((a, b) => (b.wait > a.wait ? b : a));
    return `In 2023, ${q.short} called least and ${w.short} ran late most often for its mix.`;
  }
  // how much of the map held from 2023 to 2024 (rank agreement across the neighborhoods)
  function heldLine() {
    const st = Q().stats, w = v => (v >= .85 ? "barely changed" : v >= .6 ? "mostly held" : "moved a lot");
    return `From 2023 to 2024, who calls quietly ${w(st.stable_silence)} (rank agreement ${st.stable_silence.toFixed(2)}) and who runs late ${w(st.stable_wait)} (${st.stable_wait.toFixed(2)}).`;
  }
  function setYear(y) {
    if (y === yr || !sheet) return; yr = y; view = "city"; rerender();   // the year belongs to the city view (the goal view is 2024's)
  }
  const seg = () => GV ? `<div class="qyr qview" role="group" aria-label="Map view"><button type="button" data-v="goal" aria-pressed="${view === "goal"}">Your goal</button><button type="button" data-v="city" aria-pressed="${view === "city"}">The city</button></div>` : "";
  function sideHtml() {
    if (isGoal()) {
      const g = GV, st = Q().stats;
      return `<div class="qtop"><p class="qey">Echolocation · your goal</p>${seg()}</div>
        <div class="qlede"><p class="qhead disp">${esc(gvHead())}</p><p class="qgoal">${esc(g.spec.goalText || "")}</p></div><div class="qgw">${groupsGoal()}</div>`;
    }
    return `<div class="qtop"><p class="qey">Echolocation · the city</p><div class="qsegs">${seg()}<div class="qyr" role="group" aria-label="Year">${[2024, 2023].map(y => `<button type="button" data-y="${y}" aria-pressed="${y === yr}">${y}</button>`).join("")}</div></div></div>
      <p class="qhead disp">${esc(headFor())}</p><div class="qgw">${groups()}</div>`;
  }
  // under the map: its legend and its fine print
  function underHtml() { return isGoal() ? legendGoal() : legend(); }
  // the method note, in two parts that sit under the two columns: how it is measured, and how far to trust it
  function moreHtml() {
    const st = Q().stats;
    if (isGoal()) {
      const g = GV;
      return `<div class="qm"><b>How it is measured</b><p>${esc(g.dept)} requests in ${esc(g.when)}, each neighborhood against the city's late rate for the same request types (${Math.round(g.cityLate * 100)}% closed late citywide). A place with under ${MIN_N} requests in those months is judged on its full year${g.thinCount ? "; outlined hexagons had too few to judge" : ""}.</p></div>
        <div class="qm"><b>How steady it is</b><p>Neighborhood lateness held fairly steady from 2023 to 2024 (rank agreement ${st.stable_wait.toFixed(2)}).</p><p class="qsrc">From: the page's 2024 records, the same ones the predators are tested against</p></div>`;
    }
    return `<div class="qm"><b>How it is measured</b><p>Calls are compared with the city for the same patrol-and-report problems; late is measured against the city rate for the same request types.</p></div>
      <div class="qm"><b>How steady it is</b><p>${esc(heldLine())}</p><p class="qsrc">From: ${yr} resident requests, src/09_equity.py</p></div>`;
  }
  function wireSide() {
    if (!sheet) return;
    sheet.querySelectorAll(".qyr:not(.qview) button").forEach(b => b.addEventListener("click", () => setYear(+b.dataset.y)));
    sheet.querySelectorAll(".qview button").forEach(b => b.addEventListener("click", () => setView(b.dataset.v)));
    sheet.querySelectorAll(".qn").forEach(b => b.addEventListener("click", () => { const n = b.dataset.nb; highlight(hl && hl.size === 1 && hl.has(n) ? null : [n]); }));
  }
  // redraw everything that depends on the view: both maps, the side panel, the section's line and the preview's line
  function rerender() {
    G = null; if (!sec) return;
    const pv = sec.querySelector(".qprev .qmap"); if (pv) pv.outerHTML = mapSvg(false);
    const pt = sec.querySelector(".qprev p"); if (pt) pt.textContent = isGoal() ? gvHead() : short();
    const ln = sec.querySelector(".qs-line"); if (ln) ln.textContent = isGoal() ? `Boston, mapped for your goal: where ${GV.dept} ran late in ${GV.when === "2024" ? "2024" : GV.when}.` : "Boston, mapped by who calls and who waits.";
    sec.classList.toggle("goalview", isGoal());
    if (sheet) { const old = sheet.querySelector(".qmap.big"); if (old) old.outerHTML = mapSvg(true); const un = sheet.querySelector(".qunder"); if (un) un.innerHTML = underHtml(); const mt = sheet.querySelector(".qmoretx"); if (mt) mt.innerHTML = moreHtml(); const sd = sheet.querySelector(".qside"); if (sd) { sd.innerHTML = sideHtml(); wireSide(); } }
    requestAnimationFrame(paint);
  }
  function setView(v) { if (v === view || (v === "goal" && !GV)) return; view = v; if (v === "goal") yr = 2024; rerender(); }
  function setGoal(spec) {
    if (!sec) { pendingGoal = spec; return; }
    GV = spec ? goalMap(spec) : null; view = GV ? "goal" : "city"; yr = 2024; rerender();
  }
  function makeSheet() {
    const E = Q(), st = E.stats; void st; void E;
    sheet = doc.createElement("div"); sheet.className = "qs-sheet"; sheet.id = "qs-sheet";
    sheet.innerHTML = `<button type="button" class="xb" aria-label="Close Echolocation"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      <div class="qleft"><div class="qmapw">${mapSvg(true)}<div class="qtip" role="status" aria-live="polite"></div>
        <div class="qzoom" role="group" aria-label="Map zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">&minus;</button><button type="button" data-z="fit" aria-label="Show the whole city">Fit</button></div>
        <p class="qzhint">Ctrl + scroll or pinch to zoom</p></div><div class="qunder">${underHtml()}</div></div>
      <div class="qside">${sideHtml()}</div>
      <div class="qmore"><button type="button" class="qmorebtn" aria-expanded="false" aria-controls="qmoretx"><span>About these numbers</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="qmoretx" id="qmoretx" hidden>${moreHtml()}</div></div>`;
    sheet.querySelector(".xb").addEventListener("click", () => toggle(false));
    wireMap(sheet.querySelector(".qmapw")); wireSide();
    { const mb = sheet.querySelector(".qmorebtn"), mt = sheet.querySelector(".qmoretx");
      mb.addEventListener("click", () => { const on = mb.getAttribute("aria-expanded") !== "true"; mb.setAttribute("aria-expanded", String(on)); mt.hidden = !on; }); }
    return sheet;
  }

  // the big map's tooltip, zoom and drag
  function wireMap(wrap) {
    const tip = wrap.querySelector(".qtip"), svgOf = () => wrap.querySelector(".qmap.big");
    let raf = 0;
    const apply = () => { raf = 0; const svg = svgOf(); if (!svg) return; const V = vb();
      svg.setAttribute("viewBox", `${V.x.toFixed(2)} ${V.y.toFixed(2)} ${V.w.toFixed(2)} ${V.h.toFixed(2)}`);
      wrap.classList.toggle("zoomed", Z.k > 1.01); drawLabels(svg); drawDot(svg); };
    const later = () => { if (!raf) raf = requestAnimationFrame(apply); };
    // map units under a point on screen
    const at = (svg, cx, cy) => { const r = svg.getBoundingClientRect(), V = vb(); return { x: V.x + (cx - r.left) / r.width * V.w, y: V.y + (cy - r.top) / r.height * V.h, r }; };
    function zoomBy(f, cx, cy) {
      const svg = svgOf(); if (!svg) return; const k2 = Math.max(1, Math.min(Z.KMAX, Z.k * f)); if (k2 === Z.k) return;
      const r = svg.getBoundingClientRect(); cx = cx == null ? r.left + r.width / 2 : cx; cy = cy == null ? r.top + r.height / 2 : cy;
      const p = at(svg, cx, cy), fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
      Z.k = k2; const g = geo(), w = (g.x1 - g.x0) / k2, h = (g.y1 - g.y0) / k2;
      Z.cx = p.x - (fx - .5) * w; Z.cy = p.y - (fy - .5) * h;   // the point under the pointer stays under it
      hide(); later();
    }
    wrap.querySelector(".qzoom").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.z === "in") zoomBy(1.6); else if (b.dataset.z === "out") zoomBy(1 / 1.6); else { Z.k = 1; Z.cx = Z.cy = null; hide(); later(); } });
    wrap.addEventListener("wheel", e => { if (!(e.ctrlKey || e.metaKey) || !e.target.closest(".qmap")) return; e.preventDefault(); zoomBy(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)), e.clientX, e.clientY); }, { passive: false });
    wrap.addEventListener("dblclick", e => { if (!e.target.closest(".qmap")) return; zoomBy(e.shiftKey ? 1 / 1.8 : 1.8, e.clientX, e.clientY); });
    // drag to move (only once zoomed in; at the whole city there is nowhere to go)
    let drag = null;
    wrap.addEventListener("pointerdown", e => { const svg = e.target.closest(".qmap"); if (!svg || Z.k <= 1.01 || e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: Z.cx, cy: Z.cy, r: svg.getBoundingClientRect(), moved: false }; svg.setPointerCapture(e.pointerId); wrap.classList.add("dragging"); hide(); });
    wrap.addEventListener("pointermove", e => {
      if (drag && e.pointerId === drag.id) { const V = vb(), dx = (e.clientX - drag.x) / drag.r.width * V.w, dy = (e.clientY - drag.y) / drag.r.height * V.h;
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true; Z.cx = drag.cx - dx; Z.cy = drag.cy - dy; later(); return; }
      const h = e.target.closest && e.target.closest(".qh"); if (!h) { hide(); return; } show(h, e);
    });
    const end = e => { if (drag && e.pointerId === drag.id) { drag = null; wrap.classList.remove("dragging"); } };
    wrap.addEventListener("pointerup", end); wrap.addEventListener("pointercancel", end);
    wrap.addEventListener("pointerleave", () => { if (!drag) hide(); });
    function hide() { tip.classList.remove("on"); }
    function show(h, e) {
      const g = geo(), d = g.hs[+h.dataset.i]; if (!d) return; const nb = Q().neighborhoods[d.nb], name = nb ? (nb.name || nb.short) : "Boston";
      if (isGoal()) { const v = GV.by[d.nb]; if (!v) { hide(); return; }
        const when = v.basis === "year" && GV.when !== "2024" ? "2024 (its full year: too few in the goal's months)" : GV.when;
        tip.innerHTML = `<b>${esc(name)}</b>${v.thin ? `<span>Too few ${esc(GV.dept)} requests to judge</span>` : `<span>Ran ${gvLine(v).replace(/^late /, "late ")}, for its mix of requests</span><span>${Math.round(v.late * 100)}% of ${v.n.toLocaleString("en-US")} requests closed late</span>`}${GV.named.has(d.nb) ? `<span>${GV.named.get(d.nb).ok ? "Your chase named it; 2024 confirmed it" : "Your chase named it; 2024 ruled it out"}</span>` : ""}<i>${esc(GV.dept)}, ${esc(when)}. The whole neighborhood shares one value in this view.</i>`;
        const r = wrap.getBoundingClientRect(); tip.classList.add("on"); const tw = tip.offsetWidth, th = tip.offsetHeight; let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
        if (x + tw > r.width - 4) x = e.clientX - r.left - tw - 14; if (y + th > r.height - 4) y = e.clientY - r.top - th - 14;
        tip.style.transform = `translate(${Math.max(4, x).toFixed(0)}px,${Math.max(4, y).toFixed(0)}px)`; return; }
      const calls = pct(d.sil) < 1 ? "Calls 311 at the city's rate" : `Calls 311 ${pct(d.sil)}% ${d.sil < 1 ? "less" : "more"} than the city`;
      const late = pct(d.wait) < 1 ? "Runs late as often as expected" : `Runs late ${pct(d.wait)}% ${d.wait < 1 ? "less" : "more"} often than expected`;
      tip.innerHTML = `<b>${esc(name)}</b><span>${calls}, for the same kinds of problem</span><span>${late}, for its mix of requests</span><i>${d.n.toLocaleString("en-US")} resident requests in this hexagon (about 250 m across), ${yr}</i>`;
      const r = wrap.getBoundingClientRect(); tip.classList.add("on");
      const tw = tip.offsetWidth, th = tip.offsetHeight; let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + tw > r.width - 4) x = e.clientX - r.left - tw - 14; if (y + th > r.height - 4) y = e.clientY - r.top - th - 14;
      tip.style.transform = `translate(${Math.max(4, x).toFixed(0)}px,${Math.max(4, y).toFixed(0)}px)`;
    }
  }
  function toggle(force) {
    if (!sec && !build()) return false;
    const open = force === undefined ? !sheet || !sheet.isConnected : !!force;
    if (!open) { if (sheet) sheet.remove(); card.setAttribute("aria-expanded", "false"); sec.classList.remove("open"); return false; }
    if (!sheet || !sheet.isConnected) { sec.querySelector(".board").appendChild(sheet || makeSheet()); card.setAttribute("aria-expanded", "true"); sec.classList.add("open"); requestAnimationFrame(paint); }
    return true;
  }
  function open(scroll) {
    if (!toggle(true)) return false;
    if (scroll) { const r = sheet.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 90) scrollTo({ top: scrollY + r.top - 72, behavior: reduced() ? "auto" : "smooth" }); }
    return true;
  }
  function highlight(names) { hl = names && names.length ? new Set(names) : null; paint(); }
  function dot(entry) { dotEntry = entry && entry.place && entry.place.neighborhood ? entry : null; paint(); }

  function start() {
    if (!Q()) return;
    let k = 0; const iv = setInterval(() => { if (build() || ++k > 120) clearInterval(iv); }, 250);
    const B = Bus(); if (!B) return;
    B.on("ask:highlight", p => { if (!p) return; if (p.clear) { highlight(null); return; } if (p.map) { p.handled = true; open(true); highlight(p.map); } });
    B.on("intake:routed", p => { const e = p && p.entry; if (e && e.place && e.place.neighborhood) dot(e); });
    let rz = 0; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(paint, 150); });
  }
  root.TerryQuiet = { open, toggle, highlight, dot, goal: setGoal, setView, setYear: y => { if (open(false)) setYear(y); }, get year() { return yr; }, get view() { return view; }, get goalView() { return GV; }, get isOpen() { return !!(sheet && sheet.isConnected); } };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
