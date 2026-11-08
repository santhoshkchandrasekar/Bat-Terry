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

  // the map as one SVG; big adds labels and per-hex titles
  function mapSvg(big) {
    const g = geo(), W = g.x1 - g.x0, H = g.y1 - g.y0, E = Q();
    const hexes = g.hs.map((h, k) => {
      const t = tint(h.wait), nb = E.neighborhoods[h.nb], d = reduced() || !big ? 0 : Math.round((h.y - g.y0) / H * 520 + (k % 7) * 9);
      const tip = "";
      return `<g class="qh w-${t}" data-nb="${h.nb}" data-i="${k}"${d ? ` style="animation-delay:${d}ms"` : ""}>${tip}<path class="ring" d="${hexPath(h.x, h.y, .9)}"/><path class="core" d="${hexPath(h.x, h.y, fillS(h.sil) * .9)}"/></g>`;
    }).join("");
    const V = big ? vb() : { x: g.x0, y: g.y0, w: W, h: H };
    return `<svg class="qmap${big ? " big" : ""}" viewBox="${V.x.toFixed(2)} ${V.y.toFixed(2)} ${V.w.toFixed(2)} ${V.h.toFixed(2)}" ${big ? `role="img" aria-label="Echolocation: the equity map of Boston in hexagons, with Downtown, Logan Airport, Boston Harbor, the Charles River and Dorchester Bay marked. ${esc(E.headline)}"` : 'aria-hidden="true"'}><g class="qhs">${hexes}</g><g class="qlm"></g><g class="qlabels"></g><g class="qdot"></g></svg>`;
  }
  // labels for the named neighborhoods (and any highlighted ones), nudged apart; drawn in map units, sized for the rendered width
  function drawLabels(svg) {
    const L = svg.querySelector(".qlabels"); if (!L) return; const g = geo(), r = svg.getBoundingClientRect(), u = vb().w / Math.max(200, r.width);   // map units per pixel, for the current view
    const want = new Set(NAMED()); if (hl) hl.forEach(n => want.add(n));
    const boxes = [], out = [], hit = (x, y, w, h) => boxes.some(b => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
    if (dotEntry) { const d = g.nbs.find(n => n.name === dotEntry.place.neighborhood); if (d) boxes.push({ x: d.x - 80 * u, y: d.y + 10 * u, w: 72 * u, h: 16 * u }); }   // the ticket's "your report" tag
    { const M = svg.querySelector(".qlm"); if (M) { M.innerHTML = g.lms.map(l => { const w = l.t.length * 6.4 * u, h = 13 * u; boxes.push({ x: l.x - w / 2, y: l.y - h * .8, w, h }); return `<text class="${l.k}" x="${l.x.toFixed(2)}" y="${l.y.toFixed(2)}" text-anchor="middle" style="font-size:${(11.5 * u).toFixed(3)}px">${esc(l.t)}</text>`; }).join(""); } }
    const ls = g.nbs.filter(n => want.has(n.name)), dots = ls.map(n => ({ x: n.x - 4 * u, y: n.y - 4 * u, w: 8 * u, h: 8 * u }));
    boxes.push(...dots);
    ls.sort((a, b) => a.y - b.y).forEach(n => {
      const l2 = `${callsTxt(n.silence)} · ${lateTxt(n.wait)}`, w = Math.max(n.short.length * 7.6, l2.length * 5.7) * u, h = 28 * u;
      // beside the dot first (the side with more room), then the other side, above, below; never far from the dot
      const east = n.x > (g.x0 + g.x1) / 2, R = { x: n.x + 9 * u, y: n.y - 13 * u }, Lf = { x: n.x - 9 * u - w, y: n.y - 13 * u };
      const cands = (east ? [R, Lf] : [Lf, R]).concat([{ x: n.x - w / 2, y: n.y - 9 * u - h }, { x: n.x - w / 2, y: n.y + 9 * u }, { x: R.x, y: R.y + 20 * u }, { x: Lf.x, y: Lf.y + 20 * u }, { x: R.x, y: R.y - 20 * u }, { x: Lf.x, y: Lf.y - 20 * u }]);
      const self = dots[ls.indexOf(n)], others = () => boxes.filter(b => b !== self);
      let pick = cands.find(c => c.x >= g.x0 && c.x + w <= g.x1 + 40 * u && !others().some(b => c.x < b.x + b.w && c.x + w > b.x && c.y < b.y + b.h && c.y + h > b.y)) || cands[0];
      const { x, y } = pick; boxes.push({ x, y, w, h }); void hit;
      const on = !hl || hl.has(n.name), side = x > n.x ? x - 2 * u : x + w < n.x ? x + w + 2 * u : null, ly = y + h / 2 > n.y ? y : y + h;
      out.push(`<g class="ql${on ? "" : " off"}"><circle cx="${n.x.toFixed(2)}" cy="${n.y.toFixed(2)}" r="${(3 * u).toFixed(2)}"/>` + (side === null && Math.abs(ly - n.y) < 6 * u ? "" : `<line x1="${n.x.toFixed(2)}" y1="${n.y.toFixed(2)}" x2="${(side === null ? n.x : side).toFixed(2)}" y2="${(side === null ? ly : y + 8 * u).toFixed(2)}" stroke-width="${u.toFixed(3)}"/>`) +
        `<text x="${x.toFixed(2)}" y="${(y + 11 * u).toFixed(2)}" style="font-size:${(12.5 * u).toFixed(3)}px;stroke-width:${(3.4 * u).toFixed(3)}px">${esc(n.short)}</text>` +
        `<text class="s" x="${x.toFixed(2)}" y="${(y + 24 * u).toFixed(2)}" style="font-size:${(10.5 * u).toFixed(3)}px;stroke-width:${(3 * u).toFixed(3)}px">${esc(l2)}</text></g>`);
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
  function groups() {
    const E = Q(), by = new Map(E.neighborhoods.map((n, i) => [n.name, Object.assign({ i }, yv(n))]));
    const G3 = [["Quiet but well served", E.named.quiet_well_served], ["Slowest for their mix", E.named.slowest], ["A little of both", E.named.both]];
    return `<div class="qgroups">${G3.map(([t, ns]) => `<div class="qg"><span class="qgh">${t}</span>${ns.map(nm => { const n = by.get(nm); return n ? `<button type="button" class="qn" data-nb="${esc(n.name)}" aria-pressed="false"><b>${esc(n.short)}</b><span>${callsTxt(n.silence)}, ${lateTxt(n.wait)}</span></button>` : ""; }).join("")}</div>`).join("")}</div>`;
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
    sec.innerHTML = `<header class="guide"><div class="gh"><h2 class="disp" id="qs-h">Echolocation</h2><span class="heard">${E.stats.neighborhoods} neighborhoods, ${E.year} requests</span></div><p class="qs-line">Boston, mapped by who calls and who waits.</p></header>
      <div class="board"><div class="qrow">
        <button type="button" class="pp ok qs-card" aria-expanded="false" aria-controls="qs-sheet"><span class="art rust" aria-hidden="true"><svg viewBox="0 0 120 80" width="100%" height="100%"><use href="#r2-p-quiet"/></svg></span>
          <span class="where">Boston, by neighborhood</span><span class="nm">Quiet and slow</span>
          <span class="key"><span class="num"><span class="disp t">2 problems, ${nPlaces()} places</span></span><span class="u">${Math.abs(st.rho_2024) < .3 ? "quiet in some, slow in others" : "quiet and slow together"}</span></span>
          <span class="ans on"><span><span class="lab">How Terry plans to escape it</span>Not one problem. Outreach where it is quiet; a look at the queue where it runs late.</span></span><svg class="chev i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="qprev plate" aria-hidden="true">${mapSvg(false)}<p class="disp">${esc(short())}</p><span class="qopen">Open the map</span></div>
      </div>${whoRow()}</div>`;
    tt.appendChild(sec);
    card = sec.querySelector(".qs-card");
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
    if (y === yr || !sheet) return; yr = y; G = null;
    sheet.querySelectorAll(".qyr button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.y === yr)));
    { const old = sheet.querySelector(".qmap.big"); if (old) old.outerHTML = mapSvg(true); }
    sheet.querySelector(".qhead").textContent = headFor();
    sheet.querySelector(".qgw").innerHTML = groups();
    sheet.querySelectorAll(".qn").forEach(b => b.addEventListener("click", () => { const n = b.dataset.nb; highlight(hl && hl.size === 1 && hl.has(n) ? null : [n]); }));
    sheet.querySelector(".qsrc").textContent = `From: ${yr} resident requests, src/09_equity.py`;
    requestAnimationFrame(paint);
  }
  function makeSheet() {
    const E = Q(), st = E.stats;
    sheet = doc.createElement("div"); sheet.className = "qs-sheet"; sheet.id = "qs-sheet";
    sheet.innerHTML = `<button type="button" class="xb" aria-label="Close Echolocation"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      <div class="qmapw">${mapSvg(true)}<div class="qtip" role="status" aria-live="polite"></div>
        <div class="qzoom" role="group" aria-label="Map zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">&minus;</button><button type="button" data-z="fit" aria-label="Show the whole city">Fit</button></div>
        <p class="qzhint">Zoom in, then drag to move. Ctrl + scroll or pinch also zooms.</p></div>
      <div class="qside"><div class="qtop"><p class="qey">Echolocation, the equity map</p><div class="qyr" role="group" aria-label="Year">${[2024, 2023].map(y => `<button type="button" data-y="${y}" aria-pressed="${y === yr}">${y}</button>`).join("")}</div></div><p class="qhead disp">${esc(headFor())}</p>${legend()}<div class="qgw">${groups()}</div>
        <p class="qnote">${esc(heldLine())} Late is measured against the city rate for the same request types.</p>
        <p class="qsrc">From: ${yr} resident requests, src/09_equity.py</p></div>`;
    sheet.querySelector(".xb").addEventListener("click", () => toggle(false));
    wireMap(sheet.querySelector(".qmapw"));
    sheet.querySelectorAll(".qyr button").forEach(b => b.addEventListener("click", () => setYear(+b.dataset.y)));
    sheet.querySelectorAll(".qn").forEach(b => b.addEventListener("click", () => { const n = b.dataset.nb; highlight(hl && hl.size === 1 && hl.has(n) ? null : [n]); }));
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
  root.TerryQuiet = { open, toggle, highlight, dot, setYear: y => { if (open(false)) setYear(y); }, get year() { return yr; }, get isOpen() { return !!(sheet && sheet.isConnected); } };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
