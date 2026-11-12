/* The street scene: the year as a little fall cartoon under the chart.
 *
 *   const sc = TerryScene.mount(hostEl, { Z, plan, depts, names, longDue, risk, TerryBat, level: "city",
 *                                         reduced: () => bool, onDay: (t, monthFloat) => {}, onHover: d => {}, events: { PWDx: dayIndex } })
 *   sc.setDay(t) sc.play() sc.pause() sc.toggle() sc.setSpeed(0..3) sc.setHover(d) sc.seekMonth(m) sc.monthFloat(t) sc.setVisible(bool) sc.setClock(0..1|null)
 *
 * Everything counted is a scaled real number from Z.year(d, plan): 1 ticket = N requests waiting, 1 figure = N crews.
 * Decoration (weather, light, emotes, vehicles, the move-in truck) never changes those counts.
 * Each department has its own world: crew uniform and tool, vehicles, ticket icons, task animation, sky and ground tint.
 * Levels: LEVELS.city is the only one built. Department / month / day versions reuse mount() with another time scale (daysPerSec).
 */
(function (root) {
  "use strict";
  const T = { ink: "#f7ebd5", ink2: "#e0c9a6", ink3: "#b99c7a", have: "#d2b27e", spare: "#b4cf4d", short: "#ff5a3d", grace: "#4fc7b6", bolt: "#ffb938", owl: "#e2a9db", soon: "#e8762c", dark: "#231510", brown: "#3b2620" };
  const LEVELS = { city: { daysPerSec: 0.5, dayLabel: "1x is one day every 2 seconds" } };   // department: ~3 days/s, month: 1 day/s, day: 1 hour/s
  const SPEEDS = [0.5, 1, 2, 4], SPEEDLAB = ["0.5x", "1x", "2x", "4x"];
  const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = u => u * u * (3 - 2 * u);
  const CHIPH = 24, CHW = 100, CHB = 52, DW = 300, DH = 186;                                         // design size of one street
  const SKYB = 100, SIDE = 124, ROAD = 178, LANE = 174;             // sky bottom, sidewalk front, road bottom, wheel line
  const ROWS = [126, 140, 154];

  // one world per department: accent, sky and ground tints, signs
  const W = {
    PWDx: { ac: "#e8762c", skyD: ["#f0a85c", "#f8d89e"], skyN: ["#2a1420", "#5a2a2c"], side: "#7a5238", road: "#2f1e17", dash: "rgba(247,235,213,.42)", sign: "WORKS", bld: ["#8a4a30", "#9a5636", "#7a3e2a"], wall: "#7a3e2a", roof: "#5a2a1c", sk: { w: [18, 30], h: [26, 44], win: [5, 6, 9, 10] }, bench: "#a06a3a", road2: true },
    BTDT: { ac: "#5b9bb8", skyD: ["#8fa9bc", "#d8e0dc"], skyN: ["#161c2a", "#34405a"], side: "#5c616b", road: "#24272d", dash: "rgba(247,235,213,.5)", sign: "TRAFFIC", bld: ["#5d6672", "#6c7480", "#505a68"], wall: "#4a5260", roof: "#343c48", sk: { w: [20, 30], h: [34, 58], win: [5, 6, 9, 10] }, bench: "#3f6f8a", road2: true },
    PARK: { ac: "#9bbd45", skyD: ["#e6c25c", "#f6e6a8"], skyN: ["#141c12", "#34462a"], side: "#5e7430", road: "#344420", dash: "", sign: "PARKS", bld: [], wall: "#5a6a30", roof: "#3a4a1c", sk: null, bench: "#8a5a34", road2: false },
    ISD: { ac: "#c4474a", skyD: ["#b86a72", "#e6b49c"], skyN: ["#1e0f18", "#4a2434"], side: "#7a4448", road: "#432127", dash: "", sign: "INSPECT", bld: ["#8a3a30", "#7a3028", "#98443a", "#823630"], wall: "#6a2a28", roof: "#4a1c1c", sk: { w: [38, 38], h: [52, 62], win: [7, 10, 15, 18] }, bench: "#6a4a30", road2: false },
  };
  const UNI = { PWDx: { body: "#e8762c", hat: "hard", hatc: "#f7ebd5", vest: true }, BTDT: { body: "#4f86ad", hat: "cap", hatc: "#2f5878" }, PARK: { body: "#6fa23a", hat: "helmet", hatc: "#d9e6a0" }, ISD: { body: "#c9a36a", hat: "hard", hatc: "#f7ebd5" } };
  const KINDS = {
    PWDx: q => (q % 2 ? "bag" : "hole"), BTDT: q => (q % 4 === 3 ? "sig" : "car"), PARK: q => (q % 2 ? "leaf" : "branch"), ISD: q => (q % 2 ? "rat" : "house"),
  };
  const TOOL = { hole: "shovel", bag: "toss", car: "pad", sig: "wave", branch: "saw", leaf: "rake", house: "clip", rat: "torch" };
  const VEH = { PWDx: [["dump", "bag"], ["roller", "hole"]], BTDT: [["tow", "car"], ["lift", "sig"]], PARK: [["bucket", "branch"]], ISD: [["car", "house"]] };
  const SHORT = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspections" };
  const ZW = { PWDx: "#f09a5a", BTDT: "#7fb4d6", PARK: "#9bc95a", ISD: "#e0c28f" }, ZI = "#b99c7a", ZT = "#ffb938";
  const TASKTXT = { hole: "Filling a pothole", bag: "Clearing trash bags", car: "Writing a parking ticket", sig: "Fixing a traffic light", branch: "Sawing a fallen branch", leaf: "Raking leaves", house: "Inspecting a house", rat: "Checking a rat report" };
  const CARCOL = ["#d2b27e", "#5b9bb8", "#a8431f", "#9bbd45", "#e2a9db"];

  const CSS = `
  .sc { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
  .sc.hide { display: none; }
  .sc-cell { position: absolute; pointer-events: auto; }
  .sc-cell[hidden] { display: none; }
  .sc-cv { display: block; width: 100%; border: 1px solid var(--line2, #BDB8AA); border-radius: 10px; background: #EFE2C6; touch-action: pan-y; box-shadow: 0 1px 0 rgba(255,255,255,.6) inset; }
  .sc-zones { display: flex; gap: 2px 14px; flex-wrap: nowrap; align-items: center; height: 24px; padding: 4px 2px 0; font: 500 12.5px/1.3 var(--ui, sans-serif); color: var(--ink2, #444C59); pointer-events: none; white-space: nowrap; overflow: hidden; }
  .sc-cell.r { display: flex; gap: 14px; align-items: stretch; }
  .sc-cell.r .sc-cv { flex: none; }
  .sc-cell.r .sc-zones { flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; height: auto; padding: 0; width: 100px; flex: none; overflow: visible; }
  .sc-zones .z { display: inline-flex; align-items: baseline; gap: 6px; white-space: nowrap; position: relative; padding-left: 14px; }
  .sc-zones .z i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex: none; position: absolute; left: 0; top: 50%; margin-top: -4px; }
  .sc-zones .z[data-z="m"] { display: none; }
  .sc-zones .z[data-z="w"] i { background: var(--work, #17775D); } .sc-zones .z[data-z="i"] i { background: var(--idle, #7D8696); } .sc-zones .z[data-z="t"] i { background: var(--hire, #2B5A86); }
  .sc-zones .z b { display: inline-flex; align-items: baseline; gap: 7px; font-weight: 500; }
  .sc-zones .z em { font: 500 18px/1 var(--display, Georgia, serif); font-style: normal; color: var(--ink, #14171C); min-width: 22px; text-align: right; }
  .sc-zones .z span { font-size: 11.5px; line-height: 1.2; }
  .sc-cell:not(.r) .sc-zones .z em { font-size: 15px; min-width: 0; }
  .sc-cell:not(.r) .sc-zones { justify-content: space-between; gap: 2px 8px; }   /* the three counts share the width; none is cut ("Training") */
  .sc-cell:not(.r) .sc-zones .z { min-width: 0; flex: 0 1 auto; }
  .sc-cell.r .sc-zones { width: 96px; }
  .sc-cell.b .sc-zones { height: 52px; justify-content: space-between; gap: 10px; padding: 10px 4px 0; overflow: hidden; }
  .sc-cell.b .sc-zones .z em { font-size: clamp(18px, 1.6vw, 24px); min-width: 0; }
  .sc-cell.b .sc-zones .z b { font-size: clamp(11px, .9vw, 13px); gap: 5px; }
  .sc-zones .z.pulse em { animation: tick .5s var(--ease, ease); }
  @keyframes tick { 0% { transform: translateY(-5px); opacity: .3; } 100% { transform: none; opacity: 1; } }
  .sc-tip { position: absolute; pointer-events: none; z-index: 3; background: #14171C; border: 0; color: #F1EFEA; font: 12px/1.3 var(--ui, sans-serif); padding: 5px 9px; border-radius: 8px; white-space: nowrap; transform: translate(-50%, -120%); }
  .sc-terry { display: none; }
  .sc-badge { position: absolute; z-index: 4; pointer-events: none; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 6px; font: 700 11px var(--ui, sans-serif); letter-spacing: .06em; text-transform: uppercase; color: #fff; background: var(--hire, #2B5A86); box-shadow: 0 4px 10px -4px rgba(0,0,0,.4); transform: translate(-50%, -100%); transition: background .4s, opacity .4s; }
  .sc-badge.work { background: var(--work, #17775D); } .sc-badge[hidden] { display: none; }
  .sc-ctl { display: inline-flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
  .sc-ctl[hidden] { display: none; }
  .sc-speed[hidden] { display: none; }
  .sc .sr, .sc-ctl .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `;

  const CROWN = ["#cdb28a", "#cdb28a", "#a8bf5a", "#8fb04a", "#6f9a3a", "#5c8f34", "#4f8a34", "#5a8a2e", "#9a9a2e", "#e8762c", "#b8431f", "#cdb28a", "#cdb28a"];
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, u) => { const p = hex(a), q = hex(b); return `rgb(${lerp(p[0], q[0], u) | 0},${lerp(p[1], q[1], u) | 0},${lerp(p[2], q[2], u) | 0})`; };
  const crownAt = mf => { const a = Math.floor(mf), u = mf - a; return mix(CROWN[a], CROWN[Math.min(12, a + 1)], u); };
  const nice = (v, opts) => opts.find(o => o >= v) || opts[opts.length - 1];
  const rr = (c, x, y, w, h, r, f) => { c.fillStyle = f; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
  const dot = (c, x, y, r, f) => { c.fillStyle = f; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };

  function mount(host, o) {
    const Z = o.Z, depts = o.depts, reduced = o.reduced || (() => false), level = LEVELS[o.level || "city"];
    if (!document.getElementById("sc-css")) { const s = document.createElement("style"); s.id = "sc-css"; s.textContent = CSS; document.head.appendChild(s); }
    host.textContent = ""; host.classList.add("sc");
    const ctl = o.ctl || host; ctl.innerHTML = `<button type="button" class="sc-btn" data-a="play">Play</button>
      <div class="sc-speed" role="group" aria-label="Playback speed">${SPEEDLAB.map((l, i) => `<button type="button" data-sp="${i}" aria-pressed="${i === 1}">${l}</button>`).join("")}</div>
      <button type="button" class="sc-btn ghost" data-a="prev" hidden>Week back</button><button type="button" class="sc-btn ghost" data-a="next" hidden>Week on</button>
      <input class="sc-scrub" type="range" min="0" max="364" step="1" value="0" aria-label="Day of the year"><span class="sc-date" aria-hidden="true"></span><span class="sr" aria-live="polite" data-live></span>`;
    ctl.classList.add("sc-ctl");
    const grid = host, btn = ctl.querySelector('[data-a="play"]'), prev = ctl.querySelector('[data-a="prev"]'), next = ctl.querySelector('[data-a="next"]');
    const speedBox = ctl.querySelector(".sc-speed"), speedBtns = [...speedBox.querySelectorAll("button")];
    const scrub = ctl.querySelector(".sc-scrub"), dateEl = ctl.querySelector(".sc-date"), liveEl = ctl.querySelector("[data-live]");

    // ------------------------------------------------------------ data: scales chosen per street so the figures fit
    const streets = depts.map((d, idx) => {
      const y = Z.year(d, o.plan[d]), D = y.days, maxCrews = Math.max(...D.map(x => x.crews));
      const tscale = nice(y.max_backlog / 46, [5, 10, 20, 25, 50, 100, 200, 500]);
      const fscale = [1, 2, 3, 5, 10].find(s => maxCrews / s <= 14) || 10;
      let rs = 7 + idx * 13; const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
      const slots = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 16; c++) slots.push({ x: 66 + c * 14 + (rnd() - 0.5) * 4, y: ROWS[r] + (rnd() - 0.5) * 3 });
      const order = slots.map((s, i) => i).sort((a, b) => slots[a].x + slots[a].y * 3 - (slots[b].x + slots[b].y * 3));   // fill from the depot outward
      const hot = D.reduce((b, x, i) => (x.arrivals > D[b].arrivals ? i : b), 0);
      const risk = (o.risk && o.risk[d]) || [];
      const first = []; D.forEach((x, i) => { if (first[x.month] === undefined) first[x.month] = i; });
      const mood = D.map((x, i) => {
        const late = x.past_due + (D[i - 1] ? D[i - 1].late_closed : 0) + (D[i - 2] ? D[i - 2].late_closed : 0) + x.late_closed;
        if (late / tscale >= 0.8) return "strained"; if (x.crews > 0 && x.idle / x.crews < 0.08 && x.working) return "busy"; return "calm";
      });
      const owlFrom = {}; risk.forEach(m => { owlFrom[m] = first[m] - 21; });
      // skyline buildings (and their windows, lit after dark)
      const w = W[d], bld = [], wins = [];
      if (w.sk) {
        let x = -4, n = 0; while (x < DW) { const bw = lerp(w.sk.w[0], w.sk.w[1], rnd()), bh = lerp(w.sk.h[0], w.sk.h[1], rnd()); bld.push({ x, w: bw, h: bh, c: w.bld[n % w.bld.length] }); x += bw + (d === "ISD" ? 0 : 1); n++; }
        const [ww, wh, px, py] = w.sk.win; bld.forEach((b, bi) => { for (let wy = SKYB - b.h + 6; wy + wh < SKYB - 10; wy += py) for (let wx = b.x + 4; wx + ww < b.x + b.w - 2; wx += px) wins.push([wx, wy, ww, wh, ((wx * 7 + wy * 3 + bi) | 0) % 5 < 3]); });
      }
      const trees = d === "PARK" ? [[118, 15], [150, 17], [186, 14], [224, 18], [266, 15], [86, 12]] : [];
      const ev = d === "PWDx" && first[8] !== undefined ? ((o.events && o.events[d] !== undefined) ? o.events[d] : first[8]) : -1;
      return { d, idx, w, u: UNI[d], kindOf: KINDS[d], y, D, tscale, fscale, maxCrews, slots, order, hot, risk, mood, first, owlFrom, bld, wins, trees, ev, born: new Array(48).fill(-9), fx: [], wasFilled: new Array(48).fill(false), hover: false,
        vehs: (VEH[d] || []).map(([type, kind], vi) => ({ type, kind, x: 8 + vi * 40, home: 8 + vi * 40, vx: 0, dir: 1, rot: 0, off: vi * 5.5, job: -1, tx: 8 + vi * 40, work: 0 })),
        swoopAt: -9, evAt: -9, lastI: 0, events: [], mail: [], mailN: 0 };
    });
    const monthOfDay = i => streets[0].D[clamp(Math.floor(i), 0, 364)].month;
    const firstDay = streets[0].first;
    const mFloat = t => { const i = clamp(Math.floor(t), 0, 364), m = monthOfDay(i), n = (firstDay[m + 1] === undefined ? 365 : firstDay[m + 1]) - firstDay[m]; return m + (t - firstDay[m]) / n; };

    // ------------------------------------------------------------ one canvas per street, placed by the page beside its chart row
    let A = streets[0];
    streets.forEach(s => {
      s.ctx = null; s.uniIdle = { body: mix(s.u.body, "#8a7a68", 0.65), hat: s.u.hat, hatc: mix(s.u.hatc, "#8a7a68", 0.5) }; s.hits = []; s.vis = false; s.y0 = 0; s.k = 1; s.dpr = 1;
      const c = document.createElement("div"); c.className = "sc-cell"; c.hidden = true; c.style.setProperty("--ac", s.w.ac);
      c.innerHTML = `<canvas class="sc-cv" aria-hidden="true"></canvas><div class="sc-zones" role="group"><span class="z" data-z="m"><i></i></span><span class="z" data-z="w"><i></i><b></b></span><span class="z" data-z="i"><i></i><b></b></span><span class="z" data-z="t"><i></i><b></b></span></div><div class="sc-tip" hidden></div>`;
      host.appendChild(c); s.cell = c; s.cv = c.querySelector("canvas"); s.ctx = s.cv.getContext("2d"); s.tip = c.querySelector(".sc-tip");
      s.zw = c.querySelector('[data-z="w"] b'); s.zi = c.querySelector('[data-z="i"] b'); s.zt = c.querySelector('[data-z="t"] b'); s.zm = c.querySelector('[data-z="m"] i');
      const hitAt = ev => { const r = s.cv.getBoundingClientRect(), x = (ev.clientX - r.left) / s.k, y = (ev.clientY - r.top) / s.k + s.y0; let best = null, bd = 15; for (const h of s.hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } } return best; };
      const showTip = ev => { const h = hitAt(ev); if (!h) { s.tip.hidden = true; return; } s.tip.textContent = h.txt; s.tip.hidden = false; s.tip.style.left = clamp((h.x) * s.k, 70, s.cell.clientWidth - 70) + "px"; s.tip.style.top = Math.max(26, (h.y - s.y0 - 20) * s.k) + "px"; };
      s.cv.addEventListener("pointermove", showTip); s.cv.addEventListener("pointerdown", showTip); s.cv.addEventListener("pointerleave", () => { s.tip.hidden = true; });
      c.addEventListener("pointerenter", () => { if (A !== s) api.setActive(s.d, true); });
    });

    // ------------------------------------------------------------ Terry hangs over the active street
    const NS = "http://www.w3.org/2000/svg", tsvg = document.createElementNS(NS, "svg"); tsvg.setAttribute("class", "sc-terry"); tsvg.setAttribute("aria-hidden", "true");
    const tlayer = document.createElementNS(NS, "g"); tsvg.appendChild(tlayer); host.appendChild(tsvg);
    let bat = null, hangAt = null, tAlive = true, box = null, hostBox = { w: 1, h: 1 };
    function layout(items) {
      // items: [{d, x, y, w, h, y0}] in the host's own pixels; streets not listed are hidden
      const dpr = Math.min(2, window.devicePixelRatio || 1); hostBox = { w: host.clientWidth || 1, h: host.clientHeight || 1 };
      tsvg.setAttribute("width", hostBox.w); tsvg.setAttribute("height", hostBox.h); tsvg.setAttribute("viewBox", `0 0 ${hostBox.w} ${hostBox.h}`);
      streets.forEach(s => {
        const it = items.find(i => i.d === s.d); s.vis = !!it; s.cell.hidden = !it; if (!it) { s.rect = null; return; }
        const wasVis = s.rect; s.rect = it; Object.assign(s.cell.style, { left: it.x + "px", top: it.y + "px", width: it.w + "px", height: it.h + "px" });
        const right = it.chips === "right", below = it.chips === "below"; s.cell.classList.toggle("r", right); s.cell.classList.toggle("b", below);
        const cw = Math.max(80, Math.round(it.w) - (right ? CHW : 0)), ch = Math.max(40, Math.round(it.h) - (right ? 0 : below ? CHB : CHIPH)); s.cv.style.height = ch + "px"; s.cv.style.width = right ? cw + "px" : "100%";
        if (s.cv.width !== Math.round(cw * dpr) || s.cv.height !== Math.round(ch * dpr)) { s.cv.width = Math.round(cw * dpr); s.cv.height = Math.round(ch * dpr); }
        s.k = cw / DW; s.dpr = dpr; s.y0 = it.y0 || 0; if (!wasVis) resetStreet(s);
      });
      if (!A.vis) { const f = streets.find(s => s.vis); if (f) A = f; }
      if (bat) { hangAt = null; }
      lastEmit = -1; if (vis) render(performance.now(), 0.016);
    }
    const measure = () => {};
    const branchPos = () => { const r = A.rect || { x: 0, y: 0, w: 300, h: 100 }; return { x: r.x + (r.w - (r.chips === "right" ? CHW : 0)) * 0.5, y: r.y + 6 }; };
    const tscaleNow = () => ((A.rect && A.rect.w < 330) || (A.rect && A.rect.h < 200) ? 0.26 : 0.36);
    function makeTerry() {
      if (!o.TerryBat || bat) return; const b0 = branchPos(), r = A.rect || { x: 0, y: 0, w: 300, h: 150 };
      bat = o.TerryBat.create(tsvg, { layer: tlayer, home: { x: b0.x, y: b0.y + 70 }, branch: b0, flyCenter: { x: r.x + r.w / 2, y: r.y + r.h * 0.4 }, flyRadius: { x: r.w * 0.36, y: r.h * 0.2 } });
      bat.setScale(tscaleNow()); if (reduced()) { bat.hangNow(); hangAt = A.d; }
      terryLoop();
    }
    async function terryLoop() {
      while (tAlive) {
        await sleep(150);
        if (!bat || host.classList.contains("hide") || document.hidden || !A.vis) continue;
        const b = branchPos();
        if (reduced()) { bat.setBranch(b.x, b.y); bat.setScale(tscaleNow()); bat.hangNow(); hangAt = A.d; continue; }
        if (bat.busy()) continue;
        if (hangAt !== A.d) { if (bat.mode() === "hang") await bat.flip(); bat.setHome(b.x, b.y + 60); bat.setBranch(b.x, b.y); bat.setScale(tscaleNow()); await bat.flip(); hangAt = A.d; }
      }
    }
    // days in the current training stretch, from the data
    function trainRun(s, i) {
      if (!(s.D[i].training > 0)) return null; const n = s.D[i].training; let a = i, b = i; while (a > 0 && s.D[a - 1].training === n) a--; while (b < 364 && s.D[b + 1].training === n) b++;
      return { day: i - a + 1, len: b - a + 1 };
    }

    // ------------------------------------------------------------ state
    let t = 0, playing = false, vis = true, raf = 0, last = 0, lastDraw = 0, now = 0, lastEmit = -1, lastLive = "", spd = 1, clockOverride = null, prevT = 0;
    const hovered = { d: null };
    function counts(s, i) {
      const x = s.D[i], N = Math.min(48, Math.round(x.backlog / s.tscale) || (x.backlog > 0.3 * s.tscale ? 1 : 0));
      const lateNow = x.past_due + x.late_closed + (s.D[i - 1] ? s.D[i - 1].late_closed : 0);
      let red = clamp(Math.round(lateNow / s.tscale) || (lateNow > 0.25 * s.tscale ? 1 : 0), 0, N);
      const cap = x.crews * s.y.per_crew_day, amber = o.longDue && o.longDue[s.d] ? 0 : clamp(Math.round(Math.max(0, x.backlog - cap) / s.tscale), 0, N - red);
      const pf = v => (v > 0.4 ? Math.max(1, Math.round(v / s.fscale)) : 0), F = x.working ? pf(x.busy) : 0, I = x.working ? pf(x.idle) : 0, Tn = x.training > 0 ? Math.min(6, Math.max(1, Math.round(x.training / s.fscale))) : 0;
      return { x, N, red, amber, B: F, I, Tn };
    }

    // ------------------------------------------------------------ light and season for this frame
    function env(mf, anim) {
      const m = Math.floor(mf) % 12, cyc = clockOverride !== null ? clockOverride : anim ? ((now / 14) + 0.12) % 1 : 0.3;
      let lit, sun = null, moon = null;
      if (cyc < 0.62) { const u = cyc / 0.62, h = Math.sin(u * Math.PI); lit = clamp(h * 1.9, 0, 1); sun = { x: lerp(24, 276, u), y: 64 - h * 46 }; }
      else { const u = (cyc - 0.62) / 0.38; lit = 0; moon = { x: lerp(40, 260, u), y: 62 - Math.sin(u * Math.PI) * 40 }; }
      return { now, anim, lit, sun, moon, cyc, mf, m, snow: m === 11 || m <= 1, spring: m >= 2 && m <= 4, summer: m >= 5 && m <= 7, fall: m >= 8 && m <= 10, heat: m === 6 || (m === 7 && mf % 1 < 0.5) || (m === 5 && mf % 1 > 0.6), crown: crownAt(mf), bare: m === 11 || m <= 1 || (m === 2 && mf % 1 < 0.4) };
    }

    // ------------------------------------------------------------ people
    function fig(c, x, y, f, E) {
      // x,y = feet. f: {uni, walk, face, tool, act, sit, vest, coffee, yawn, hop, trainee, kind}
      const u = f.uni || UNI.PWDx, walk = f.walk || 0, bounce = walk ? Math.abs(Math.sin(walk)) : 0;
      c.save(); c.translate(x, y - (f.hop || 0) - bounce * 1.6); c.scale(f.face || 1, 1);
      const sq = walk ? Math.sin(walk * 2) * 0.07 : (f.hop ? 0.06 : 0); c.scale(1 + sq, 1 - sq); c.scale(1.3, 1.3);
      c.lineCap = "round"; c.lineWidth = 2.2; c.strokeStyle = "#3a2a22";
      if (f.sit) { c.beginPath(); c.moveTo(0, -4); c.lineTo(5, -4); c.lineTo(5, 0); c.stroke(); }
      else { const sw = Math.sin(walk) * 3; c.beginPath(); c.moveTo(-1, -5); c.lineTo(-1 - sw, 0); c.moveTo(1, -5); c.lineTo(1 + sw, 0); c.stroke(); }
      const by = f.sit ? -4 : -5;
      rr(c, -3.2, by - 8, 6.4, 8.5, 2, u.body);
      if (f.vest || u.vest) { c.fillStyle = f.vest ? T.bolt : "#ffd25a"; c.fillRect(-3.2, by - 6, 6.4, 2.6); c.fillStyle = "rgba(35,21,16,.55)"; c.fillRect(-0.6, by - 6, 1.2, 2.6); }
      dot(c, 0, by - 11.5, 2.9, "#f0cfae");
      if (f.badge) { c.fillStyle = "#fffaf0"; c.fillRect(-2.6, by - 3.6, 3, 3); c.fillStyle = "#231510"; c.font = "700 3px sans-serif"; c.textAlign = "center"; c.fillText("L", -1.1, by - 1.2); }
      // hat
      if (u.hat === "hard") { c.fillStyle = f.vest ? T.bolt : u.hatc; c.beginPath(); c.arc(0, by - 12.3, 3.2, Math.PI, 0); c.fill(); c.fillRect(-3.8, by - 12.4, 7.6, 1.2); }
      else if (u.hat === "cap") { c.fillStyle = u.hatc; c.beginPath(); c.arc(0, by - 12.3, 3.1, Math.PI, 0); c.fill(); c.fillRect(0, by - 12.3, 5, 1.1); }
      else { c.fillStyle = u.hatc; c.beginPath(); c.arc(0, by - 12.2, 3.3, Math.PI * 0.95, Math.PI * 0.05); c.fill(); c.fillStyle = "#3a2a22"; c.fillRect(-3.4, by - 12.3, 6.8, 0.9); }
      // face: eyes, yawn
      if (f.yawn) { c.fillStyle = "#3a2a22"; c.beginPath(); c.ellipse(1.4, by - 10.4, 1, 1.4, 0, 0, 7); c.fill(); } else { c.fillStyle = "#3a2a22"; c.fillRect(1.2, by - 11.8, 0.9, 0.9); }
      // tool and arm
      const sx = 2, sy = by - 6, tool = f.tool, a = f.act === undefined ? 0 : f.act, sn = Math.sin(now * 9), L = f.sit ? 0 : 1;
      c.lineWidth = 1.8; c.strokeStyle = u.body;
      if (f.coffee) { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 4, sy + 1); c.stroke(); rr(c, sx + 3, sy - 2, 3.6, 4, 0.8, "#f7ebd5"); c.fillStyle = "#8a5a34"; c.fillRect(sx + 3, sy - 1.2, 3.6, 1); if (E.anim) { c.strokeStyle = "rgba(247,235,213,.55)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(sx + 4.2, sy - 3); c.quadraticCurveTo(sx + 5.5, sy - 5, sx + 4.2, sy - 7 + sn * 0.4); c.stroke(); } }
      else if (tool === "shovel") { const an = lerp(-1.1, 0.7, (sn + 1) / 2); const ex = sx + Math.cos(an) * 6, ey = sy + Math.sin(an) * 6; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = "#9a7a52"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + Math.cos(an) * 6, ey + Math.sin(an) * 6 + 3); c.stroke(); c.fillStyle = "#c9c0b0"; c.fillRect(ex + Math.cos(an) * 6 - 1.5, ey + Math.sin(an) * 6 + 3, 3.4, 2.4); }
      else if (tool === "toss") { const an = lerp(0.9, -1.4, ease(clamp((a * 3) % 1, 0, 1))); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(an) * 6, sy + Math.sin(an) * 6); c.stroke(); }
      else if (tool === "pad") { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 5, sy + 1 + Math.sin(now * 14) * 0.6); c.stroke(); rr(c, sx + 4, sy - 3.6, 4.4, 6, 0.8, "#f7ebd5"); c.fillStyle = "#3a2a22"; c.fillRect(sx + 5, sy - 2, 2.4, 0.7); c.fillRect(sx + 5, sy - 0.6, 2.4, 0.7); }
      else if (tool === "wave") { const an = -1.9 + sn * 0.5; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(an) * 6, sy + Math.sin(an) * 6); c.stroke(); c.beginPath(); c.moveTo(-2, sy); c.lineTo(-2 - Math.cos(an) * 5, sy + Math.sin(an) * 5); c.stroke(); }
      else if (tool === "saw") { const off = Math.sin(now * 16) * 2.2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 5 + off, sy - 1); c.stroke(); c.fillStyle = "#c9c0b0"; c.fillRect(sx + 4 + off, sy - 2.4, 8, 1.6); c.fillStyle = "#8a5a34"; c.fillRect(sx + 2 + off, sy - 2.6, 2.6, 2.2); }
      else if (tool === "rake") { const off = Math.sin(now * 8) * 2.6; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 5 + off, sy + 2); c.stroke(); c.strokeStyle = "#9a7a52"; c.lineWidth = 1.1; c.beginPath(); c.moveTo(sx + 5 + off, sy + 2); c.lineTo(sx + 11 + off, sy + 7); c.stroke(); c.fillStyle = "#c9c0b0"; c.fillRect(sx + 9 + off, sy + 6.5, 4.6, 1.4); }
      else if (tool === "clip") { const ph = a % 1, knock = ph < 0.3, stamp = ph > 0.6; const lift = knock ? -0.9 + Math.abs(Math.sin(ph * 30)) * 0.9 : stamp ? Math.abs(Math.sin((ph - 0.6) * 12)) * 0.9 : 0.2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(lift) * 5, sy + Math.sin(lift) * 5 - (stamp ? 1 : 0)); c.stroke(); if (!knock) { rr(c, sx + 4, sy - 3.8 + (stamp ? Math.abs(Math.sin((ph - 0.6) * 12)) * 1.5 : 0), 4.6, 6.2, 0.8, "#f7ebd5"); c.fillStyle = "#c4474a"; c.fillRect(sx + 5, sy - 1, 2.6, 1.4); } }
      else if (tool === "torch") { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 5, sy + 0.5); c.stroke(); c.fillStyle = "#5a5a60"; c.fillRect(sx + 4, sy - 0.8, 4, 1.8); const g = c.createLinearGradient(sx + 8, 0, sx + 26, 0); g.addColorStop(0, "rgba(255,226,150,.65)"); g.addColorStop(1, "rgba(255,226,150,0)"); c.fillStyle = g; c.beginPath(); c.moveTo(sx + 8, sy - 0.5); c.lineTo(sx + 26, sy - 6); c.lineTo(sx + 26, sy + 6); c.lineTo(sx + 8, sy + 1.2); c.fill(); }
      else if (!f.sit && walk) { const sw = Math.sin(walk) * 0.5; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(0.9 + sw) * 4.5, sy + Math.sin(0.9 + sw) * 4.5); c.stroke(); }
      else if (f.cheer) { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 2, sy - 6); c.stroke(); }
      c.restore();
    }
    function emote(c, x, y, kind, E) {
      c.save(); c.translate(x, y);
      if (kind === "sweat") { const b = E.anim ? Math.sin(now * 5) * 0.8 : 0; c.fillStyle = "#bfe3f2"; c.beginPath(); c.moveTo(0, -4 + b); c.quadraticCurveTo(2.6, -0.5 + b, 0, 1.2 + b); c.quadraticCurveTo(-2.6, -0.5 + b, 0, -4 + b); c.fill(); }
      else if (kind === "zzz") { c.fillStyle = T.ink2; c.font = "700 8px sans-serif"; c.textAlign = "left"; for (let i = 0; i < 3; i++) { const u = E.anim ? ((now * 0.5 + i / 3) % 1) : i / 3; c.globalAlpha = 1 - u * 0.8; c.font = `700 ${6 + i * 2}px sans-serif`; c.fillText("z", i * 5 + u * 3, -u * 14); } }
      else if (kind === "aah") { c.fillStyle = T.ink2; c.font = "700 6px sans-serif"; c.textAlign = "left"; c.fillText("aah", 0, 0); }
      c.restore();
    }

    // ------------------------------------------------------------ tickets (one icon per kind, plus a status pin)
    function pin(c, kind, hot) {
      if (kind === "n") return;
      if (kind === "red") { dot(c, 0, -20, 3.4, T.short); c.fillStyle = "#231510"; c.beginPath(); c.arc(0, -20, 2.3, 0, 7); c.fill(); c.strokeStyle = T.short; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -21.4); c.moveTo(0, -20); c.lineTo(1.2, -19.8); c.stroke(); }
      else { dot(c, 0, -19, 2.4, T.soon); c.fillStyle = "#231510"; c.fillRect(-0.4, -20.2, 0.9, 1.6); c.fillRect(-0.4, -18.1, 0.9, 0.9); }
    }
    function icon(c, k, x, y, q, st) {
      c.save(); c.translate(x, y);
      if (k === "hole") { c.fillStyle = "#1a0e0a"; c.beginPath(); c.ellipse(0, -2, 7.5, 3, 0, 0, 7); c.fill(); c.strokeStyle = "#8a6a52"; c.lineWidth = 1; c.stroke(); c.strokeStyle = "#1a0e0a"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-7, -2); c.lineTo(-11, -4); c.moveTo(7, -2); c.lineTo(11, -1); c.stroke(); c.fillStyle = st === "n" ? "#e8dcc2" : "#ffb938"; c.fillRect(-0.5, -14, 1, 10); c.fillRect(-3, -14, 6, 3); }
      else if (k === "bag") { c.fillStyle = "#6a7a2e"; c.beginPath(); c.ellipse(0, -5, 5.5, 5, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-2, -9); c.lineTo(0, -13); c.lineTo(2, -9); c.fill(); c.fillStyle = "rgba(255,255,255,.22)"; c.beginPath(); c.ellipse(-2, -6.5, 1.6, 2.4, 0.3, 0, 7); c.fill(); c.fillStyle = "#9a6a3a"; c.fillRect(5, -3, 2.6, 2.6); c.fillStyle = "#c9c0b0"; c.fillRect(-7, -2.5, 2.6, 2); }
      else if (k === "car") { const col = CARCOL[q % CARCOL.length]; rr(c, -9, -7, 18, 6, 2.4, col); rr(c, -5, -11.5, 10, 6, 2.4, col); c.fillStyle = "rgba(35,21,16,.65)"; c.fillRect(-4, -10.5, 3.6, 3.6); c.fillRect(0.4, -10.5, 3.6, 3.6); dot(c, -5, -1.2, 2.2, "#1a0e0a"); dot(c, 5, -1.2, 2.2, "#1a0e0a"); c.fillStyle = "#f7ebd5"; c.fillRect(-0.6, -9.5, 2.4, 2.8); }
      else if (k === "sig") { c.fillStyle = "#6a6a70"; c.fillRect(-0.8, -17, 1.6, 17); rr(c, -3.4, -19, 6.8, 13, 2, "#1a1414"); for (let i = 0; i < 3; i++) dot(c, 0, -16 + i * 4, 1.5, "#3a3030"); c.strokeStyle = "#6a6a70"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3, -18); c.lineTo(3, -4); c.stroke(); }
      else if (k === "branch") { c.strokeStyle = "#7a4a2a"; c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath(); c.moveTo(-8, -1.5); c.lineTo(8, -6); c.stroke(); c.lineWidth = 1.2; c.beginPath(); c.moveTo(-1, -3.8); c.lineTo(2, -9); c.moveTo(3, -4.8); c.lineTo(8, -2); c.stroke(); dot(c, 2, -10, 2.2, "#b8431f"); dot(c, 8.5, -2, 2, "#d9942a"); dot(c, -8.5, -2, 1.8, "#8a3a22"); }
      else if (k === "leaf") { c.fillStyle = "#c9741f"; c.beginPath(); c.ellipse(0, -2.5, 8.5, 4.4, 0, Math.PI, 0); c.fill(); dot(c, -3, -4.5, 1.8, "#a8431f"); dot(c, 2, -5.5, 1.8, "#e8b030"); dot(c, 5, -3, 1.6, "#7a2230"); dot(c, -6, -2.6, 1.5, "#e8762c"); c.fillStyle = "#d9942a"; c.beginPath(); c.arc(-9, -0.8, 1.4, 0, 7); c.arc(9, -0.5, 1.3, 0, 7); c.fill(); }
      else if (k === "house") { c.fillStyle = "#8a3a30"; c.fillRect(-6, -9, 12, 9); c.fillStyle = "#4a1c1c"; c.beginPath(); c.moveTo(-7.5, -9); c.lineTo(0, -15); c.lineTo(7.5, -9); c.fill(); c.fillStyle = "#2a1a18"; c.fillRect(-4.6, -6.6, 3.4, 3.4); c.fillRect(0.6, -8, 3.4, 8); c.fillStyle = "#6a6a70"; c.fillRect(7, -9, 1, 9); c.fillStyle = "#ffb938"; c.beginPath(); c.moveTo(7.5, -16); c.lineTo(11, -10); c.lineTo(4, -10); c.fill(); c.fillStyle = "#231510"; c.fillRect(7.1, -14, 0.9, 2.6); c.fillRect(7.1, -11, 0.9, 0.9); }
      else if (k === "rat") { c.fillStyle = "#8a8078"; c.beginPath(); c.ellipse(0, -3, 5.6, 3, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(5.4, -3.4, 2.6, 1.8, 0, 0, 7); c.fill(); dot(c, 4.2, -5.3, 1.2, "#8a8078"); dot(c, 6.4, -3.8, 0.55, "#1a0e0a"); c.strokeStyle = "#b99c7a"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-5.4, -3); c.quadraticCurveTo(-10, -8, -12, -2); c.stroke(); c.strokeStyle = "#8a8078"; c.lineWidth = 0.5; c.beginPath(); c.moveTo(7.5, -3.6); c.lineTo(10, -4.6); c.moveTo(7.5, -3.2); c.lineTo(10, -2.6); c.stroke(); c.fillStyle = "#6a6a70"; c.fillRect(-0.5, -14, 1, 8); c.fillStyle = "#ffb938"; c.beginPath(); c.moveTo(0, -17); c.lineTo(3.2, -11.5); c.lineTo(-3.2, -11.5); c.fill(); }
      c.restore();
    }
    function ticket(c, s, q, x, y, st, sc) { c.save(); c.translate(x, y); c.scale(sc * 1.15, sc * 1.15); icon(c, s.kindOf(q), 0, 0, q, st); c.translate(0, -(s.kindOf(q) === "sig" ? 2 : 0)); pin(c, st); c.restore(); }

    // ------------------------------------------------------------ world: sky, buildings, ground
    function sky(c, s, E) {
      const w = s.w, g = c.createLinearGradient(0, 0, 0, SKYB); g.addColorStop(0, mix(w.skyN[0], w.skyD[0], E.lit)); g.addColorStop(1, mix(w.skyN[1], w.skyD[1], E.lit)); c.fillStyle = g; c.fillRect(0, 0, DW, SKYB + 1);
      if (E.lit < 0.6) { c.fillStyle = `rgba(247,235,213,${(0.6 - E.lit) * 0.9})`; for (let q = 0; q < 16; q++) { const tw = E.anim ? 0.6 + 0.4 * Math.sin(now * 2 + q) : 1; c.globalAlpha = tw; c.fillRect((q * 83 + 17) % DW, (q * 37 + 9) % 44 + 8, 1.2, 1.2); } c.globalAlpha = 1; }
      if (E.sun) { c.fillStyle = "rgba(255,225,150,.22)"; c.beginPath(); c.arc(E.sun.x, E.sun.y, 15, 0, 7); c.fill(); dot(c, E.sun.x, E.sun.y, 7, E.heat ? "#fff0b0" : "#ffd98a"); }
      if (E.moon) { c.fillStyle = "rgba(247,235,213,.16)"; c.beginPath(); c.arc(E.moon.x, E.moon.y, 13, 0, 7); c.fill(); dot(c, E.moon.x, E.moon.y, 6, "#f7ebd5"); dot(c, E.moon.x + 2.6, E.moon.y - 1.4, 5.2, mix(s.w.skyN[0], s.w.skyN[1], 0.5)); }
      if (s.d === "PARK") { c.fillStyle = mix("#3a4a24", "#7a8a3a", E.lit * 0.8); c.beginPath(); c.moveTo(0, SKYB); c.quadraticCurveTo(60, 62, 130, SKYB - 12); c.quadraticCurveTo(210, SKYB - 38, 300, SKYB - 8); c.lineTo(300, SKYB); c.fill(); }
    }
    function buildings(c, s, E) {
      const w = s.w; if (!s.bld.length) return;
      s.bld.forEach((b, bi) => {
        c.fillStyle = b.c; c.fillRect(b.x, SKYB - b.h, b.w, b.h);
        if (s.d === "ISD") { c.fillStyle = w.roof; c.fillRect(b.x - 1, SKYB - b.h - 3, b.w + 2, 5); c.fillStyle = "rgba(255,255,255,.07)"; c.fillRect(b.x, SKYB - b.h + 5, b.w, 2); c.fillStyle = "rgba(0,0,0,.16)"; c.fillRect(b.x + b.w - 1.5, SKYB - b.h, 1.5, b.h); c.fillStyle = "#2a1414"; c.fillRect(b.x + b.w / 2 - 4, SKYB - 18, 8, 18); c.fillStyle = "#4a2a22"; c.fillRect(b.x + b.w / 2 - 7, SKYB - 3, 14, 3); }
        else if (s.d === "PWDx") { c.fillStyle = w.roof; if (bi % 3 === 0) { c.fillRect(b.x + 4, SKYB - b.h - 9, 5, 9); } else { c.beginPath(); c.moveTo(b.x, SKYB - b.h); c.lineTo(b.x + b.w * 0.5, SKYB - b.h - 7); c.lineTo(b.x + b.w, SKYB - b.h); c.fill(); } }
        else { c.fillStyle = w.roof; c.fillRect(b.x, SKYB - b.h - 2, b.w, 3); if (bi % 4 === 1) c.fillRect(b.x + b.w / 2, SKYB - b.h - 12, 1.2, 10); }
        if (E.snow) { c.fillStyle = "rgba(247,235,213,.85)"; c.fillRect(b.x - 1, SKYB - b.h - 4, b.w + 2, 3); }
      });
      c.fillStyle = "#1a0e0a"; s.wins.forEach(([x, y, ww, wh]) => c.fillRect(x, y, ww, wh));
    }
    function groundBands(c, s, E) {
      const w = s.w, snowy = E.snow ? 0.5 : 0, sd = E.snow ? mix(w.side, "#efe4d0", 0.5) : E.fall && s.d !== "PARK" ? mix(w.side, "#a8431f", 0.12) : w.side;
      c.fillStyle = sd; c.fillRect(0, SKYB, DW, SIDE - SKYB);
      c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(0, SIDE - 3, DW, 3);
      c.fillStyle = E.snow ? mix(w.road, "#d9ccb8", 0.22) : w.road; c.fillRect(0, SIDE, DW, ROAD - SIDE);
      c.fillStyle = "rgba(0,0,0,.28)"; c.fillRect(0, ROAD, DW, DH - ROAD);
      c.fillStyle = "rgba(255,255,255,.06)"; c.fillRect(0, SIDE, DW, 1.5);
      if (w.road2) { c.strokeStyle = w.dash; c.lineWidth = 1.2; c.setLineDash([8, 7]); c.beginPath(); c.moveTo(0, 165); c.lineTo(DW, 165); c.stroke(); c.setLineDash([]); }
      if (s.d === "BTDT") { c.fillStyle = "rgba(247,235,213,.35)"; for (let i = 0; i < 6; i++) c.fillRect(48 + i * 4.2, 128, 2.4, 44); }
      if (s.d === "PARK") { c.strokeStyle = "rgba(0,0,0,.12)"; c.lineWidth = 1; for (let i = 0; i < 18; i++) { c.beginPath(); c.moveTo(i * 17 + 3, SIDE + 4); c.lineTo(i * 17 + 7, SIDE + 10); c.stroke(); } c.fillStyle = E.snow ? "rgba(239,228,208,.7)" : "#8a7048"; c.beginPath(); c.moveTo(0, 168); c.quadraticCurveTo(150, 160, 300, 170); c.lineTo(300, 178); c.lineTo(0, 178); c.fill(); }
      if (s.d === "ISD") { c.strokeStyle = "rgba(0,0,0,.2)"; c.lineWidth = 1; for (let y = SIDE + 12; y < ROAD; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(DW, y); c.stroke(); } for (let r = 0; r < 4; r++) for (let x = (r % 2) * 10; x < DW; x += 20) { c.beginPath(); c.moveTo(x, SIDE + r * 12); c.lineTo(x, SIDE + r * 12 + 12); c.stroke(); } }
      if (E.snow) { c.fillStyle = "rgba(247,235,213,.3)"; c.fillRect(0, SIDE - 4, DW, 5); }
    }
    function decor(c, s, E) {
      const w = s.w;
      if (s.d === "PWDx") {
        for (const bx of [198, 244]) { rr(c, bx - 9, 100, 18, 12, 1.5, "#7a3a22"); rr(c, bx - 10, 97, 20, 4, 1.5, "#5a2a1a"); if (E.snow) { c.fillStyle = "rgba(247,235,213,.85)"; c.fillRect(bx - 10, 95, 20, 3); } }
        for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#f7ebd5" : "#e8762c"; c.fillRect(118 + i * 5, 106, 5, 6); } c.fillStyle = "#6a4a38"; c.fillRect(117, 112, 2, 6); c.fillRect(135, 112, 2, 6);
        c.fillStyle = "#3a2a22"; c.fillRect(150, 56, 4, 44); c.fillRect(150, 56, 40, 4); c.fillRect(184, 56, 1.6, 14); rr(c, 181, 70, 8, 6, 1, "#e8762c"); if (E.snow) c.fillRect(150, 52, 40, 3);
        for (let i = 0; i < 3; i++) dot(c, 270 + (i % 2) * 7, 106 - Math.floor(i / 2) * 7, 3.6, "#b9926a");
      } else if (s.d === "BTDT") {
        c.fillStyle = "#5a6670"; c.fillRect(214, 76, 2.4, 40); rr(c, 204, 68, 22, 12, 2, "#2f5878"); c.fillStyle = "#f7ebd5"; c.font = "700 6px sans-serif"; c.textAlign = "center"; c.fillText("BUS", 215, 77);
        rr(c, 250, 84, 34, 30, 2, "rgba(150,190,210,.28)"); c.fillStyle = "#34405a"; c.fillRect(248, 82, 38, 3); c.fillRect(249, 84, 2, 30); c.fillRect(283, 84, 2, 30);
        c.fillStyle = "#6a7a8a"; c.fillRect(100, 98, 3, 16);
      } else if (s.d === "PARK") {
        c.fillStyle = "#6a4a30"; for (let i = 0; i < 9; i++) c.fillRect(176 + i * 8, 108, 1.6, 10); c.fillRect(176, 110, 72, 1.5); c.fillRect(176, 114, 72, 1.5);
        s.trees.forEach(([tx, r]) => {
          const cy = 86 - r * 0.7; c.fillStyle = "#4a3022"; c.fillRect(tx - 2, cy, 4, SKYB + 8 - cy);
          if (E.bare) { c.strokeStyle = "#4a3022"; c.lineWidth = 1.6; c.beginPath(); for (const a of [-0.9, -0.4, 0.4, 0.9]) { c.moveTo(tx, cy + 6); c.lineTo(tx + Math.sin(a) * r, cy + 6 - Math.cos(a) * r * 0.9); } c.stroke(); if (E.snow) { c.fillStyle = "rgba(247,235,213,.85)"; c.beginPath(); c.ellipse(tx, cy - r * 0.2, r * 0.8, 2.2, 0, 0, 7); c.fill(); } }
          else { const cc = E.spring && E.mf % 1 < 0.9 && Math.floor(E.mf) === 3 ? "#e8b8c8" : E.crown; c.fillStyle = cc; c.beginPath(); c.arc(tx, cy - 2, r, 0, 7); c.arc(tx - r * 0.7, cy + 2, r * 0.7, 0, 7); c.arc(tx + r * 0.7, cy + 2, r * 0.7, 0, 7); c.fill(); c.fillStyle = "rgba(35,21,16,.16)"; c.beginPath(); c.arc(tx + 3, cy + 3, r * 0.7, 0, 7); c.fill(); }
        });
      }
    }
    function lampPost(c, x) { c.strokeStyle = "#8a7a68"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 120); c.lineTo(x, 70); c.lineTo(x + 8, 70); c.stroke(); dot(c, x + 8, 72, 2.4, "#f7ebd5"); }
    function depot(c, s, open, E) {
      const w = s.w; c.fillStyle = s.d === "PARK" ? "#6a4a30" : s.d === "ISD" ? "#5a2a28" : s.d === "BTDT" ? "#3f4a58" : "#6a3a26"; c.fillRect(4, 64, 54, 60);
      c.fillStyle = w.roof; c.beginPath(); c.moveTo(0, 66); c.lineTo(31, 52); c.lineTo(62, 66); c.fill(); if (E.snow) { c.fillStyle = "rgba(247,235,213,.85)"; c.beginPath(); c.roundRect(6, 52, 50, 3, 1.5); c.fill(); }
      c.fillStyle = "#14090a"; c.fillRect(16, 84, 30, 40);
      if (open) { c.fillStyle = "#5a4a3a"; c.fillRect(16, 82, 30, 5); }
      else { c.fillStyle = "#8a7a68"; c.fillRect(16, 84, 30, 40); c.strokeStyle = "#5a4a3a"; c.lineWidth = 1; for (let y = 88; y < 124; y += 5) { c.beginPath(); c.moveTo(16, y); c.lineTo(46, y); c.stroke(); } }
      c.fillStyle = w.ac; c.fillRect(8, 68, 46, 10); c.fillStyle = "#231510"; c.font = "700 8px sans-serif"; c.textAlign = "center"; c.fillText(w.sign, 31, 76);
    }
    function bench(c, s) { const col = s.w.bench; c.fillStyle = col; c.fillRect(110, 111, 70, 3.5); c.fillRect(110, 101, 70, 2.5); c.fillRect(112, 114, 3, 7); c.fillRect(175, 114, 3, 7); c.fillRect(112, 101, 2.5, 11); c.fillRect(176, 101, 2.5, 11);
      c.fillStyle = "#8a7a68"; c.fillRect(144, 84, 1.8, 17); rr(c, 132, 77, 26, 9, 2, "#5a4a3c"); c.fillStyle = "#f7ebd5"; c.font = "700 6.5px sans-serif"; c.textAlign = "center"; c.fillText("Idle", 145, 84);
      c.fillStyle = "#8a7a68"; c.fillRect(236, 90, 1.8, 30); rr(c, 217, 83, 40, 9, 2, s.w.ac); c.fillStyle = "#231510"; c.fillText("Working", 237, 90); }

    // ------------------------------------------------------------ vehicles
    function wheel(c, x, y, r, rot) { dot(c, x, y, r, "#1a0e0a"); dot(c, x, y, r * 0.45, "#8a7a68"); c.strokeStyle = "#b99c7a"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + Math.cos(rot) * r * 0.45, y + Math.sin(rot) * r * 0.45); c.lineTo(x - Math.cos(rot) * r * 0.45, y - Math.sin(rot) * r * 0.45); c.stroke(); }
    function vehicle(c, v, s, E, on) {
      // v.x = center, ground at LANE, drawn facing right then mirrored by v.dir
      c.save(); c.translate(v.x, LANE); c.scale(v.dir, 1); const rot = v.rot, w = v.work, an = E.anim;
      if (v.type === "dump") {
        rr(c, -16, -9, 24, 5, 1, "#3a2a22");
        c.save(); c.translate(-14, -9); c.rotate(-w * 0.5); rr(c, 0, -9, 21, 9, 1.5, "#e8762c"); c.fillStyle = "rgba(0,0,0,.2)"; c.fillRect(0, -2, 21, 2); c.restore();
        rr(c, 8, -14, 9, 10, 2, "#e8762c"); c.fillStyle = "rgba(247,235,213,.8)"; c.fillRect(11, -12.4, 5, 4); wheel(c, -9, -3, 3.4, rot); wheel(c, 3, -3, 3.4, rot); wheel(c, 13, -3, 3.4, rot);
        if (w > 0.1) { c.fillStyle = "#6a7a2e"; for (let i = 0; i < 3; i++) dot(c, -9 + i * 4, -11 - w * 4 + Math.sin(now * 8 + i), 2, "#6a7a2e"); }
      } else if (v.type === "roller") {
        rr(c, -6, -13, 14, 9, 2, "#e8762c"); c.fillStyle = "#231510"; c.fillRect(-7, -17, 16, 3); c.fillStyle = "#f7ebd5"; c.fillRect(-5, -16.4, 12, 1); c.fillStyle = "#6a3a26"; c.fillRect(-2, -20, 3, 4);
        dot(c, 10, -6.5, 6.4, "#9a928a"); dot(c, 10, -6.5, 2.4, "#5a5450"); c.strokeStyle = "#5a5450"; c.lineWidth = 1; c.beginPath(); c.moveTo(10, -6.5); c.lineTo(10 + Math.cos(rot * 0.5) * 6, -6.5 + Math.sin(rot * 0.5) * 6); c.stroke(); dot(c, -9, -4.4, 4.2, "#2a2420");
        if (an && (v.moving || w > 0.1)) for (let i = 0; i < 3; i++) { const u = ((now * 0.9 + i / 3) % 1); c.fillStyle = `rgba(247,235,213,${0.55 * (1 - u)})`; c.beginPath(); c.arc(-1 - u * 3, -22 - u * 12, 2 + u * 3, 0, 7); c.fill(); }
      } else if (v.type === "tow") {
        rr(c, -17, -8, 26, 5, 1, "#2f5878"); rr(c, 4, -14, 11, 10, 2, "#5b9bb8"); c.fillStyle = "rgba(247,235,213,.8)"; c.fillRect(8, -12.4, 5, 4);
        c.strokeStyle = "#1a2a38"; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, -9); c.lineTo(-17 - w * 4, -16 + w * 0); c.stroke(); c.lineWidth = 0.8; c.beginPath(); c.moveTo(-17 - w * 4, -16); c.lineTo(-17 - w * 4, -9 + w * 3); c.stroke();
        wheel(c, -10, -3, 3.4, rot); wheel(c, 11, -3, 3.4, rot); dot(c, -2, -10, 1.6, an && Math.sin(now * 8) > 0 ? T.bolt : "#8a5a14");
      } else if (v.type === "lift") {
        rr(c, -13, -9, 28, 5, 1, "#4f86ad"); rr(c, 6, -15, 10, 11, 2, "#4f86ad"); c.fillStyle = "rgba(247,235,213,.8)"; c.fillRect(10, -13.4, 5, 4);
        const ex = -8 - w * 6, ey = -9 - 6 - w * 22; c.strokeStyle = "#f7ebd5"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-8, -9); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = "#2f5878"; c.lineWidth = 1; c.stroke();
        rr(c, ex - 4, ey - 2, 8, 5, 1, "#e8762c"); if (w > 0.1) { dot(c, ex, ey - 5, 2, "#f0cfae"); rr(c, ex - 2.4, ey - 8.6, 4.8, 2, 1, "#2f5878"); }
        wheel(c, -8, -3, 3.4, rot); wheel(c, 10, -3, 3.4, rot);
      } else if (v.type === "bucket") {
        rr(c, -14, -9, 26, 5, 1, "#6fa23a"); rr(c, 5, -15, 10, 11, 2, "#6fa23a"); c.fillStyle = "rgba(247,235,213,.8)"; c.fillRect(9, -13.4, 5, 4);
        const ex = -6 - w * 6, ey = -9 - 5 - w * 18; c.strokeStyle = "#d9e6a0"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, -9); c.lineTo(ex, ey); c.stroke();
        rr(c, ex - 4, ey - 2, 8, 5, 1, "#3a4a1c"); if (w > 0.1) { dot(c, ex, ey - 5, 2, "#f0cfae"); c.fillStyle = "#d9e6a0"; c.beginPath(); c.arc(ex, ey - 5.4, 2.2, Math.PI, 0); c.fill(); if (an) { c.fillStyle = "#e8d8a8"; for (let i = 0; i < 3; i++) c.fillRect(ex + 4 + ((now * 20 + i * 3) % 6), ey + 3 + i, 0.9, 0.9); } }
        wheel(c, -8, -3, 3.4, rot); wheel(c, 9, -3, 3.4, rot);
      } else if (v.type === "car") {
        rr(c, -12, -8, 24, 6, 2.4, "#f7ebd5"); rr(c, -6, -13, 13, 6, 2.4, "#f7ebd5"); c.fillStyle = "rgba(35,21,16,.65)"; c.fillRect(-5, -12, 5, 4); c.fillRect(1, -12, 5, 4); c.fillStyle = "#c4474a"; c.fillRect(-12, -5, 24, 1.4);
        wheel(c, -7, -2.6, 3, rot); wheel(c, 7, -2.6, 3, rot); const on2 = an ? Math.sin(now * 9) > 0 : true; dot(c, 0, -14.4, 1.6, on2 ? T.bolt : "#8a5a14");
      }
      c.restore();
    }
    function updVehicles(s, cnt, dt, E) {
      const open = cnt.x.working && cnt.B > 0, anim = E.anim;
      s.vehs.forEach((v, vi) => {
        const filledKinds = []; for (let q = 0; q < cnt.N; q++) if (s.kindOf(q) === v.kind) filledKinds.push(q);
        const period = 11, cyc = Math.floor((now + v.off) / period), ph = ((now + v.off) / period) % 1;
        if (cyc !== v.job) { v.job = cyc; v.tq = filledKinds.length ? filledKinds[(cyc * 3 + vi) % filledKinds.length] : -1; }
        let tx = v.home, working = false;
        if (!cnt.x.working) tx = DW + 56;
        else if (open && v.tq >= 0 && filledKinds.includes(v.tq) && ph > 0.08 && ph < 0.78) { const p = s.slots[s.order[v.tq]]; tx = p.x + (v.type === "dump" ? 22 : v.type === "tow" ? 20 : 17); working = ph > 0.28 && ph < 0.7; }
        if (!anim) { v.x = cnt.x.working ? v.home : DW + 56; v.moving = false; v.work = 0; return; }
        const d = tx - v.x, sp = 70, step = clamp(d, -sp * dt, sp * dt); v.x += step; v.moving = Math.abs(step) > 0.01; if (v.moving) v.dir = step > 0 ? 1 : -1; v.rot += step * 0.4;
        if (working && Math.abs(tx - v.x) < 3) v.work = Math.min(1, v.work + dt * 1.4); else v.work = Math.max(0, v.work - dt * 1.6);
        if (!working && v.x > DW + 20) v.dir = 1;
      });
    }

    // ------------------------------------------------------------ owl
    function owl(c, s, E, i) {
      const sw = E.anim ? (now - s.swoopAt) / 2.8 : 2, flying = sw >= 0 && sw < 1;
      const oy = Math.max(64, (s.y0 || 0) + 26); let x = 272, y = oy; if (flying) { const a = Math.sin(sw * Math.PI); x = 272 - 120 * a; y = oy + 50 * a; }
      c.strokeStyle = "#5a3a26"; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(250, oy + 2); c.lineTo(298, oy + 2); c.stroke();
      c.save(); c.translate(x, y);
      if (flying) { const fl = Math.sin(now * 24) * 0.7; c.fillStyle = "#c98ac0"; for (const sd of [-1, 1]) { c.save(); c.scale(sd, 1); c.rotate(fl); c.beginPath(); c.ellipse(11, -9, 10, 4, 0.2, 0, 7); c.fill(); c.restore(); } }
      c.fillStyle = T.owl; c.beginPath(); c.ellipse(0, -9, 8, 9.5, 0, 0, 7); c.fill();
      const turn = E.anim ? Math.sin(now * 0.7 + s.idx) : 0, tv = Math.abs(turn) > 0.55 ? Math.sign(turn) : 0, hx = tv * 1.4;
      c.beginPath(); c.moveTo(-7 + hx, -16); c.lineTo(-5 + hx, -23); c.lineTo(-1 + hx, -17); c.moveTo(7 + hx, -16); c.lineTo(5 + hx, -23); c.lineTo(1 + hx, -17); c.fill();
      c.fillStyle = "#e8c8a8"; c.beginPath(); c.ellipse(0, -5, 4.4, 5, 0, 0, 7); c.fill();
      const blink = E.anim && ((now + s.idx * 1.3) % 3.4) < 0.16;
      for (const sd of [-1, 1]) { const ex = sd * 3.2 + hx; c.fillStyle = "#231510"; c.beginPath(); c.arc(ex, -11, 2.7, 0, 7); c.fill(); if (blink) { c.fillStyle = T.owl; c.fillRect(ex - 2.7, -11.4, 5.4, 2.8); } else { dot(c, ex + tv * 0.9, -11, 1.1, "#ffe08a"); } }
      c.fillStyle = "#e8a24a"; c.beginPath(); c.moveTo(hx - 1, -9); c.lineTo(hx + 1, -9); c.lineTo(hx, -6.6); c.fill();
      c.restore();
    }

    // ------------------------------------------------------------ effects, weather, move-in
    function fxDraw(c, s, E) {
      s.fx = s.fx.filter(e => now - e.at < 1.1);
      for (const e of s.fx) {
        const u = (now - e.at) / 1.1, x = e.x, y = e.y, k = e.k;
        if (k === "car") { c.globalAlpha = 1 - u * 0.5; icon(c, "car", x + u * u * 150, y, e.q, "n"); c.globalAlpha = 1; c.fillStyle = `rgba(247,235,213,${0.4 * (1 - u)})`; for (let i = 0; i < 3; i++) dot(c, x + u * u * 150 - 10 - i * 5, y - 2, 1.6 + i * 0.4, `rgba(247,235,213,${0.35 * (1 - u)})`); }
        else if (k === "sig") { c.save(); c.translate(x, y); c.fillStyle = "#6a6a70"; c.fillRect(-0.8, -17, 1.6, 17); rr(c, -3.4, -19, 6.8, 13, 2, "#1a1414"); const g = Math.floor(u * 7) % 2 === 0; dot(c, 0, -16, 1.5, "#3a3030"); dot(c, 0, -12, 1.5, "#3a3030"); dot(c, 0, -8, 1.7, g ? "#b4cf4d" : "#3a4a2a"); if (g) { c.fillStyle = "rgba(180,207,77,.3)"; c.beginPath(); c.arc(0, -8, 6, 0, 7); c.fill(); } c.restore(); }
        else if (k === "house") { c.save(); c.translate(x, y); c.globalAlpha = 1 - u * 0.4; icon(c, "house", 0, 0, 0, "n"); c.fillStyle = `rgba(255,205,110,${0.95 * (1 - u * 0.3)})`; c.fillRect(-4.6, -6.6, 3.4, 3.4); c.fillStyle = `rgba(255,190,90,${0.25 * (1 - u)})`; c.beginPath(); c.arc(-3, -5, 9, 0, 7); c.fill(); c.restore(); }
        else if (k === "hole") { for (let i = 0; i < 3; i++) { const uu = clamp(u * 1.3 - i * 0.12, 0, 1); c.fillStyle = `rgba(247,235,213,${0.55 * (1 - uu)})`; c.beginPath(); c.arc(x - 3 + i * 3, y - 5 - uu * 14, 2 + uu * 4, 0, 7); c.fill(); } c.fillStyle = `rgba(90,80,70,${1 - u})`; c.beginPath(); c.ellipse(x, y - 2, 7.5, 3, 0, 0, 7); c.fill(); }
        else if (k === "bag") { const px = x + u * 36, py = y - 6 - Math.sin(u * Math.PI) * 26; c.globalAlpha = 1 - u * 0.6; c.fillStyle = "#6a7a2e"; c.beginPath(); c.ellipse(px, py, 5, 4.4, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
        else if (k === "branch") { c.strokeStyle = `rgba(122,74,42,${1 - u})`; c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.moveTo(x - 8, y - 1.5 + u * 3); c.lineTo(x - 1, y - 3 + u * 3); c.moveTo(x + 1, y - 4 + u * 5); c.lineTo(x + 8, y - 6 + u * 5); c.stroke(); for (let i = 0; i < 5; i++) { const uu = u + i * 0.05; dot(c, x - 6 + i * 3, y - 4 - Math.sin(uu * 5) * 3 + u * 6, 1, "#e8d8a8"); } }
        else if (k === "leaf") { const cols = ["#c9741f", "#a8431f", "#e8b030", "#7a2230"]; for (let i = 0; i < 6; i++) { const uu = u; dot(c, x - 8 + i * 3 + Math.sin(uu * 6 + i) * 3, y - 3 - uu * 20 - i, 1.7, cols[i % 4]); } }
        else if (k === "rat") { c.globalAlpha = 1 - u; icon(c, "rat", x + u * 90, y, 0, "n"); c.globalAlpha = 1; }
        // the check pop for every kind
        const pu = clamp(u * 1.6, 0, 1), sc = pu < 1 ? ease(pu) * (1 + 0.3 * Math.sin(pu * 3.1)) : 1;
        c.save(); c.translate(x, y - 22 - u * 6); c.scale(sc, sc); c.globalAlpha = 1 - clamp((u - 0.55) * 2.2, 0, 1); dot(c, 0, 0, 4.4, "#b4cf4d"); c.strokeStyle = "#231510"; c.lineWidth = 1.5; c.lineCap = "round"; c.beginPath(); c.moveTo(-2, 0.2); c.lineTo(-0.5, 1.8); c.lineTo(2.2, -1.6); c.stroke(); c.restore();
        c.save(); c.translate(x, y - 22); c.globalAlpha = (1 - u) * 0.9; c.strokeStyle = "#ffe08a"; c.lineWidth = 1; for (let r = 0; r < 6; r++) { const a = r * 1.047 + u, r0 = 6 + u * 4, r1 = 8.5 + u * 9; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); } c.restore();
      }
    }
    function weather(c, s, E) {
      const m = E.m, an = E.anim;
      if (E.snow) { const n = m === 0 ? 34 : 24; c.fillStyle = "rgba(247,235,213,.85)"; for (let q = 0; q < n; q++) { const fx = (q * 47 + (an ? now * 9 : 0) * (1 + (q % 3) * 0.3) + Math.sin(q + now) * (an ? 4 : 0)) % DW, fy = ((q * 29 + (an ? now * 26 : 0) * (1 + (q % 4) * 0.2)) % 176); c.fillRect(fx, fy, q % 3 ? 1.6 : 2.2, q % 3 ? 1.6 : 2.2); } }
      else if (E.spring) { const ph = an ? ((now / 11) + s.idx * 0.23) % 1 : 0.1, on = ph < 0.38 ? Math.sin(ph / 0.38 * Math.PI) : 0; if (on > 0.02 || !an) { const a = !an ? 0.35 : on; c.fillStyle = `rgba(18,10,16,${0.14 * a})`; c.fillRect(0, 0, DW, DH); c.strokeStyle = `rgba(200,220,235,${0.55 * a})`; c.lineWidth = 0.9; c.beginPath(); for (let q = 0; q < 46; q++) { const fx = (q * 41 + (an ? now * 30 : 0)) % (DW + 20), fy = (q * 53 + (an ? now * 190 : 0)) % 190; c.moveTo(fx, fy); c.lineTo(fx - 2.4, fy + 8); } c.stroke(); c.strokeStyle = `rgba(200,220,235,${0.5 * a})`; for (let q = 0; q < 5; q++) { const u = an ? ((now * 1.6 + q * 0.2) % 1) : 0.4; c.beginPath(); c.ellipse(70 + q * 45, 166 + (q % 2) * 5, 2 + u * 6, 0.8 + u * 2, 0, 0, 7); c.stroke(); } } }
      else if (E.heat) { c.strokeStyle = "rgba(255,226,170,.16)"; c.lineWidth = 3; for (let r = 0; r < 4; r++) { c.beginPath(); for (let x = 0; x <= DW; x += 6) { const y = 134 + r * 11 - (an ? (now * 8 + r * 5) % 12 : 0) + Math.sin(x * 0.12 + (an ? now * 3 : 0) + r) * 2; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } c.fillStyle = "rgba(255,170,70,.07)"; c.fillRect(0, 0, DW, DH); }
      else if (E.fall) { const cols = ["#c9741f", "#a8431f", "#e8b030", "#7a2230", "#8a3a22"], gust = an ? Math.sin(now * 0.5) * 0.5 + 0.6 : 0.5; for (let q = 0; q < 16; q++) { const fx = ((q * 61 + (an ? now * (18 + (q % 4) * 7) * gust : 0)) % (DW + 20)) - 10, fy = ((q * 37 + (an ? now * 16 : 0)) % 160) + Math.sin(now * 2 + q) * (an ? 6 : 0); c.save(); c.translate(fx, fy); c.rotate((an ? now * 2.4 : 0) + q); c.fillStyle = cols[q % 5]; c.beginPath(); c.ellipse(0, 0, 2.8, 1.5, 0, 0, 7); c.fill(); c.restore(); } c.fillStyle = "rgba(232,118,44,.04)"; c.fillRect(0, 0, DW, DH); }
    }
    function moveIn(c, s, E, i) {
      if (s.ev < 0) return; const t0 = s.ev - 2, tt = t - t0; if (tt < 0 || t > s.ev + 3.6) return; const an = E.anim;
      const arrive = ease(clamp(tt / 0.5, 0, 1)), leave = ease(clamp((tt - 3.6) / 1.2, 0, 1)), tx = lerp(DW + 40, 214, arrive) + leave * 110, items = 8;
      // items tumble out onto the curb as the weekend goes on
      const shown = clamp((tt - 0.5) / 2.6, 0, 1) * items;
      for (let q = 0; q < items; q++) {
        if (q >= shown) break; const age = an ? clamp((shown - q) / 0.8, 0, 1) : 1, drop = (1 - ease(age)) * 18, ix = 150 + q * 15 + (q % 2) * 3, iy = 122 - drop, gone = clamp((t - (s.ev + 2.4)) / 1.2, 0, 1);
        c.save(); c.globalAlpha = 1 - gone; c.translate(ix, iy); const sq = age < 1 ? 0.8 + 0.2 * Math.sin(age * 9) : 1; c.scale(1, sq);
        if (q % 4 === 0) { rr(c, -9, -9, 18, 8, 2, "#7a2230"); rr(c, -10, -13, 5, 10, 2, "#8a3040"); rr(c, 5, -13, 5, 10, 2, "#8a3040"); c.fillStyle = "#4a1420"; c.fillRect(-9, -1, 2, 2); c.fillRect(7, -1, 2, 2); }
        else if (q % 4 === 1) { rr(c, -6, -10, 12, 10, 1, "#c9a56a"); c.fillStyle = "#a8844a"; c.fillRect(-1, -10, 2, 10); c.fillStyle = "#f7ebd5"; c.fillRect(-4, -7, 3, 2); }
        else if (q % 4 === 2) { c.fillStyle = "#6a4a30"; c.fillRect(-0.6, -16, 1.2, 16); c.fillStyle = "#e8b030"; c.beginPath(); c.moveTo(-4, -12); c.lineTo(4, -12); c.lineTo(2.6, -18); c.lineTo(-2.6, -18); c.fill(); }
        else { rr(c, -9, -6, 18, 6, 2, "#9db4c9"); rr(c, -8, -7.4, 16, 2.4, 1, "#c9d8e6"); }
        c.restore();
      }
      // the moving truck
      c.save(); c.translate(tx, LANE); rr(c, -22, -22, 28, 20, 2, "#f7ebd5"); rr(c, 6, -15, 12, 13, 2, "#c9741f"); c.fillStyle = "rgba(35,21,16,.7)"; c.fillRect(11, -13.4, 5.4, 4.4); c.fillStyle = "#e8762c"; c.fillRect(-22, -10, 28, 3); c.fillStyle = "#231510"; c.font = "700 6px sans-serif"; c.textAlign = "center"; c.fillText("MOVE-IN", -8, -14); wheel(c, -14, -2.6, 3.6, tx * 0.3); wheel(c, 11, -2.6, 3.6, tx * 0.3);
      if (tt > 0.4 && tt < 3.6) { c.fillStyle = "#14090a"; c.fillRect(-23, -18, 2, 16); }
      c.restore();
    }
    function glows(c, s, E) {
      const a = 1 - E.lit; if (a < 0.08) return;
      c.fillStyle = `rgba(255,205,110,${0.9 * a})`; s.wins.forEach(([x, y, w, h, lit]) => { if (lit) c.fillRect(x, y, w, h); });
      for (const lx of [90, 258]) { const g = c.createRadialGradient(lx + 8, 74, 1, lx + 8, 74, 28); g.addColorStop(0, `rgba(255,214,140,${0.55 * a})`); g.addColorStop(1, "rgba(255,214,140,0)"); c.fillStyle = g; c.fillRect(lx - 24, 44, 64, 64); }
      c.fillStyle = `rgba(255,205,110,${0.8 * a})`; c.fillRect(24, 90, 14, 4);
      if (s.d === "BTDT") { c.fillStyle = `rgba(190,225,235,${0.28 * a})`; c.fillRect(251, 85, 32, 28); }
      if (s.d === "ISD") { c.fillStyle = `rgba(255,205,110,${0.75 * a})`; s.bld.forEach(b => c.fillRect(b.x + b.w / 2 - 3, SKYB - 16, 6, 12)); }
    }

    // ------------------------------------------------------------ resident mail and pasted-alert weather (decoration; counts never change)
    const ARTNAME = { snow: "Snowstorm", wind: "Windstorm", cold: "Deep freeze", heat: "Heat wave", surge: "Surge", crew: "Crews out" };
    const artOf = e => { const l = String(e.label || "").toLowerCase(); return e.kind === "capacity" || /crew|quit/.test(l) ? "crew" : /snow|blizzard|winter storm/.test(l) ? "snow" : /wind|hurricane|rain/.test(l) ? "wind" : /freeze|cold/.test(l) ? "cold" : /heat/.test(l) ? "heat" : "surge"; };
    function mailDraw(c, s, E) {
      s.mail = s.mail.filter(m => !E.anim || now - m.at < 3.2);
      const bounce = u => u < 0.6 ? (u / 0.6) ** 2 : 1 - Math.sin((u - 0.6) / 0.4 * Math.PI) * 0.18;   // a short fall, then one small hop
      for (const m of s.mail) {
        const a = now - m.at, u = E.anim ? clamp(a / 0.55, 0, 1) : 1, fade = E.anim ? 1 - clamp((a - 2.4) / 0.8, 0, 1) : 1;
        const y0 = m.y - 46, y = y0 + (m.y - y0) * bounce(u);
        c.save(); c.globalAlpha = fade; c.translate(m.x, y - 6); c.rotate(u < 1 ? Math.sin(a * 14) * 0.18 : 0);
        c.fillStyle = "rgba(35,21,16,.28)"; c.fillRect(-10, -6, 22, 15);
        c.fillStyle = "#f7ebd5"; c.fillRect(-11, -8, 22, 15); c.strokeStyle = "#c4474a"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-11, -8); c.lineTo(0, 1); c.lineTo(11, -8); c.stroke();
        c.restore();
        if (u >= 1) { c.save(); c.globalAlpha = fade; c.strokeStyle = "#ffb938"; c.lineWidth = 1.4; c.beginPath(); c.arc(m.x, m.y - 6, 15 + (E.anim ? ((a - 0.55) * 8) % 6 : 0), 0, 7); c.stroke(); c.restore(); }
      }
      if (s.inN && s.inDay === Math.floor(t)) {   // messages in today: an envelope and its count, top right, in the street's sign style
        const lab = `${s.inN} new`; c.save(); c.font = "700 19px sans-serif"; const tw = c.measureText(lab).width, w = tw + 44, x0 = DW - 6 - w, y = 5 + (s.y0 || 0);
        rr(c, x0, y, w, 28, 5, "#5a4a3c"); c.fillStyle = "#f7ebd5"; c.fillRect(x0 + 8, y + 6, 22, 16);
        c.strokeStyle = "#c4474a"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x0 + 8, y + 6); c.lineTo(x0 + 19, y + 15); c.lineTo(x0 + 30, y + 6); c.stroke();
        c.fillStyle = "#f7ebd5"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(lab, x0 + 36, y + 15); c.restore();
      }
    }
    function eventArt(c, s, ev, E) {
      const k = ev.art, an = E.anim, tt = an ? now : 0;
      if (k === "snow") { c.fillStyle = "rgba(247,235,213,.14)"; c.fillRect(0, 0, DW, DH); c.fillStyle = "rgba(255,255,255,.9)"; for (let q = 0; q < 70; q++) { const fx = (q * 43 + tt * 26 * (1 + (q % 3) * 0.3)) % (DW + 30) - 10, fy = (q * 31 + tt * 60 * (1 + (q % 4) * 0.2)) % DH; c.fillRect(fx, fy, 2, 2); } c.strokeStyle = "rgba(247,235,213,.35)"; c.lineWidth = 1; for (let q = 0; q < 8; q++) { const y = 20 + q * 20, x = (tt * 120 + q * 70) % (DW + 80) - 40; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40, y + 4); c.stroke(); } }
      else if (k === "wind") { c.fillStyle = "rgba(20,12,22,.16)"; c.fillRect(0, 0, DW, DH); c.strokeStyle = "rgba(200,220,235,.55)"; c.lineWidth = 0.9; c.beginPath(); for (let q = 0; q < 50; q++) { const fx = (q * 41 + tt * 90) % (DW + 40) - 10, fy = (q * 53 + tt * 200) % (DH + 10); c.moveTo(fx, fy); c.lineTo(fx - 7, fy + 9); } c.stroke(); const cols = ["#c9741f", "#a8431f", "#7a4a2a"]; for (let q = 0; q < 10; q++) { c.save(); c.translate((q * 53 + tt * 130) % (DW + 40) - 20, 30 + (q * 37) % 120 + Math.sin(tt * 3 + q) * 8); c.rotate(tt * 4 + q); c.fillStyle = cols[q % 3]; c.fillRect(-4, -1, 8, 2); c.restore(); } }
      else if (k === "cold") { c.fillStyle = "rgba(150,195,230,.16)"; c.fillRect(0, 0, DW, DH); c.fillStyle = "rgba(235,245,255,.7)"; for (const [x0, y0, sx, sy] of [[0, 0, 1, 1], [DW, 0, -1, 1], [0, DH, 1, -1], [DW, DH, -1, -1]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + sx * 34, y0); c.lineTo(x0 + sx * 22, y0 + sy * 6); c.lineTo(x0 + sx * 8, y0 + sy * 18); c.lineTo(x0, y0 + sy * 30); c.fill(); } c.fillStyle = "rgba(235,245,255,.85)"; for (let x = 8; x < DW; x += 22) { c.beginPath(); c.moveTo(x, SKYB); c.lineTo(x + 3, SKYB); c.lineTo(x + 1.5, SKYB + 8 + (x % 3) * 2); c.fill(); } }
      else if (k === "heat") { c.fillStyle = "rgba(255,120,40,.14)"; c.fillRect(0, 0, DW, DH); c.fillStyle = "rgba(255,200,120,.35)"; c.beginPath(); c.arc(260, 28, 30 + (an ? Math.sin(tt * 2) * 3 : 0), 0, 7); c.fill(); c.strokeStyle = "rgba(255,226,170,.28)"; c.lineWidth = 3; for (let r = 0; r < 6; r++) { c.beginPath(); for (let x = 0; x <= DW; x += 6) { const y = 128 + r * 9 + Math.sin(x * 0.14 + tt * 4 + r) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } }
      else if (k === "crew") { c.fillStyle = "rgba(60,60,70,.22)"; c.fillRect(0, 0, DW, DH); c.fillStyle = "rgba(247,235,213,.8)"; c.font = "700 9px sans-serif"; c.textAlign = "center"; for (let q = 0; q < 3; q++) c.fillText("z", 40 + q * 8, 56 - q * 7 - (an ? (tt * 8 + q * 4) % 8 : 0)); }
      else { c.fillStyle = "rgba(25,12,30,.28)"; c.fillRect(0, 0, DW, DH); c.fillStyle = "rgba(70,60,80,.85)"; for (let q = 0; q < 5; q++) { const x = (q * 70 + (an ? tt * 10 : 0)) % (DW + 60) - 30; c.beginPath(); c.arc(x, 14, 20, 0, 7); c.arc(x + 20, 18, 16, 0, 7); c.arc(x - 18, 20, 14, 0, 7); c.fill(); } if (an && Math.sin(tt * 1.7) > 0.93) { c.strokeStyle = "#ffe08a"; c.lineWidth = 2; c.beginPath(); c.moveTo(150, 24); c.lineTo(142, 50); c.lineTo(152, 52); c.lineTo(140, 82); c.stroke(); } }
      const name = ARTNAME[k] || "Event"; c.font = "700 8px sans-serif"; c.textAlign = "left"; const w = c.measureText(name).width + 12; const by = Math.max(18, (s.y0 || 0) + 28); rr(c, 6, by, w, 14, 7, "rgba(35,21,16,.88)"); c.fillStyle = "#ffb938"; c.fillText(name, 12, by + 10);
    }
    // ------------------------------------------------------------ one street, one frame
    function drawStreet(s, E, dt) {
      const c = s.ctx, dpr = s.dpr || 1, i = clamp(Math.floor(t), 0, 364), cnt = counts(s, i), x = cnt.x, kk = s.k || 1, anim = E.anim, open = x.working;
      c.setTransform(dpr * kk, 0, 0, dpr * kk, 0, -dpr * kk * (s.y0 || 0)); c.clearRect(0, 0, DW, DH + 4); s.hits = [];
      sky(c, s, E);
      c.strokeStyle = "rgba(185,156,122,.55)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 8); c.quadraticCurveTo(DW / 2, 12, DW, 8); c.stroke();
      buildings(c, s, E); groundBands(c, s, E); decor(c, s, E); lampPost(c, 90); lampPost(c, 258);
      depot(c, s, open, E); bench(c, s);
      // weekends: zzz over the shut depot
      if (!open) emote(c, 40, Math.max(48, (s.y0 || 0) + 24), "zzz", E);
      // tickets
      const N = cnt.N;
      for (let q = 0; q < 48; q++) { const filled = q < N, was = s.wasFilled[q]; if (filled && !was) s.born[q] = now; if (!filled && was && anim && s.fx.length < 14) { const p = s.slots[s.order[q]]; s.fx.push({ q, k: s.kindOf(q), at: now, x: p.x, y: p.y }); } s.wasFilled[q] = filled; }
      const sl = s.slots, bagRoll = 0;
      for (let q = N - 1; q >= 0; q--) { const p = sl[s.order[q]], kind = q < cnt.red ? "red" : q < cnt.red + cnt.amber ? "soon" : "n", age = anim ? clamp((now - s.born[q]) / 0.35, 0, 1) : 1, sc = age < 1 ? 0.35 + 0.65 * (1 - Math.pow(1 - age, 3)) * (1 + 0.28 * Math.sin(age * 3.1)) : 1; ticket(c, s, q, p.x, p.y, kind, sc); }
      if (anim) fxDraw(c, s, E);
      // vehicles
      updVehicles(s, cnt, dt, E); s.vehs.forEach(v => { if (v.x < DW + 40 || !anim) vehicle(c, v, s, E); });
      // crews: idle on the bench with coffee, training in vests, busy walking to tickets
      const strained = s.mood[i] === "strained";
      const seat = i2 => (i2 < 6 ? { x: 117 + i2 * 11, y: 114, sit: true } : { x: 117 + (i2 - 6) * 11, y: 100, sit: false });
      const yawner = anim ? Math.floor(now / 4.3) % Math.max(1, cnt.I) : -1, yawning = anim && (now % 4.3) < 1.1;
      for (let q = 0; q < cnt.I; q++) { const p = seat(Math.min(q, 11)); const yw = yawning && q === yawner; fig(c, p.x, p.y, { sit: p.sit, uni: s.uniIdle, coffee: true, yawn: yw }, E); s.hits.push({ x: p.x, y: p.y - 14, txt: "Idle: waiting for the next ticket" }); if (yw) emote(c, p.x + 5, p.y - 24, "aah", E); }
      // classroom: a board and learners in yellow vests with a badge
      const tr = trainRun(s, i);
      rr(c, 64, 86, 44, 26, 2, "#2f4a34"); c.strokeStyle = "#8a6a44"; c.lineWidth = 1.4; c.strokeRect(64, 86, 44, 26); c.fillStyle = "#f7ebd5"; c.font = "700 6px sans-serif"; c.textAlign = "left"; c.fillText("TRAINING", 68, 94);
      c.fillStyle = "rgba(255,185,56,.28)"; c.fillRect(68, 100, 36, 4); if (tr) { c.fillStyle = "#ffb938"; c.fillRect(68, 100, 36 * tr.day / tr.len, 4); }
      for (let q = 0; q < cnt.Tn; q++) { const px = 72 + q * 7; fig(c, px, 120, { uni: s.u, vest: true, walk: 0, face: 1, badge: true }, E); s.hits.push({ x: px, y: 106, txt: tr ? `In training, paid: day ${tr.day} of ${tr.len}` : "In training, paid" }); }
      if (cnt.B) {
        const filled = []; for (let q = 0; q < N; q++) filled.push(q);
        for (let q = 0; q < cnt.B; q++) {
          const per = 3.6, ph0 = (anim ? now / per : 0.5) + q * 0.23, cyc = Math.floor(ph0), ph = ph0 - cyc;
          const tq = filled.length ? filled[(q * 3 + cyc * 5) % filled.length] : -1, tgt = tq >= 0 ? sl[s.order[tq]] : { x: 52, y: 128 }, kind = tq >= 0 ? s.kindOf(tq) : "hole";
          const sx = 34 + (q % 3) * 3, sy = 124, tx = tgt.x - 8, ty = tgt.y + 3;
          let px, py, walk = 0, face = 1, tool, act = 0, hop = 0;
          if (ph < 0.28) { const u = ph / 0.28; px = lerp(sx, tx, u); py = lerp(sy, ty, u); walk = anim ? now * 14 + q : 0; face = tx >= sx ? 1 : -1; }
          else if (ph < 0.72) { px = tx; py = ty; tool = TOOL[kind]; act = (ph - 0.28) / 0.44; if (!anim) act = 0.5; hop = anim && act > 0.9 ? Math.sin((act - 0.9) * 10 * Math.PI) * 3 : 0; }
          else { const u = (ph - 0.72) / 0.28; px = lerp(tx, sx, u); py = lerp(ty, sy, u); walk = anim ? now * 14 + q : 0; face = -1; if (u > 0.97 && anim) continue; }
          const arrive = anim && ph >= 0.28 && ph < 0.34 ? Math.sin((ph - 0.28) / 0.06 * Math.PI) * 2.6 : 0;
          fig(c, px, py - 0, { uni: s.u, walk, face, tool, act: tool === "clip" ? act * 1.4 : act, hop: hop + arrive, cheer: act > 0.9 }, E);
          s.hits.push({ x: px, y: py - 14, txt: tool ? `Working: ${TASKTXT[kind]}` : "Working: on the way to a ticket" });
          if (tool) { const ry = py - 31 - hop; c.lineWidth = 1.5; c.strokeStyle = "rgba(247,235,213,.28)"; c.beginPath(); c.arc(px, ry, 3.6, 0, 7); c.stroke(); c.strokeStyle = "#fffaf0"; c.beginPath(); c.arc(px, ry, 3.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, act / 0.92)); c.stroke();
            if (act > 0.92) { const u = Math.min(1, (act - 0.92) / 0.08); c.save(); c.translate(px, ry - u * 3); c.scale(0.7 + 0.5 * Math.sin(u * 3), 0.7 + 0.5 * Math.sin(u * 3)); dot(c, 0, 0, 4.4, "#b4cf4d"); c.strokeStyle = "#231510"; c.lineWidth = 1.4; c.lineCap = "round"; c.beginPath(); c.moveTo(-2, 0.2); c.lineTo(-0.5, 1.8); c.lineTo(2.2, -1.6); c.stroke(); c.restore(); } }
          if (tool && anim) {   // small extras for the task
            if (kind === "bag" && act > 0.35 && act < 0.8) { const u = (act - 0.35) / 0.45, vx = s.vehs[0] ? s.vehs[0].x : 20; c.fillStyle = "#6a7a2e"; c.beginPath(); c.ellipse(lerp(tx + 6, vx, u), py - 8 - Math.sin(u * Math.PI) * 26, 3.8, 3.4, 0, 0, 7); c.fill(); }
            if (kind === "leaf") { rr(c, tx + 10, ty - 3, 9, 4.4, 1, "#6a4a30"); c.fillStyle = "#c9741f"; c.beginPath(); c.ellipse(tx + 14.5, ty - 3, 4, 2, 0, Math.PI, 0); c.fill(); c.strokeStyle = "#3a2a22"; c.lineWidth = 1; c.beginPath(); c.moveTo(tx + 19, ty - 1); c.lineTo(tx + 23, ty - 6); c.stroke(); dot(c, tx + 12, ty + 2, 1.8, "#2a1a14"); }
            if (kind === "branch" && act > 0.2) { c.fillStyle = "#e8d8a8"; for (let r = 0; r < 3; r++) c.fillRect(tx + 14 + ((now * 22 + r * 4) % 8), ty - 8 + r * 2, 1, 1); }
            if (kind === "hole" && act > 0.55) { for (let r = 0; r < 2; r++) { const u = (act * 3 + r * 0.5) % 1; c.fillStyle = `rgba(247,235,213,${0.5 * (1 - u)})`; c.beginPath(); c.arc(tx + 9 + r * 3, ty - 10 - u * 10, 2 + u * 3, 0, 7); c.fill(); } }
            if (kind === "car" && act > 0.4 && act < 0.9) { c.fillStyle = "#f7ebd5"; const u = (act - 0.4) / 0.5; c.fillRect(tx + 13 + u * 3, ty - 16 - u * 6, 3.2, 2.4); }
            if (kind === "rat" && act > 0.2) { c.fillStyle = "rgba(255,226,150,.5)"; c.beginPath(); c.arc(tx + 27, ty - 6, 3.4, 0, 7); c.fill(); }
            if (kind === "house" && act > 0.55) { c.fillStyle = `rgba(196,71,74,${0.8})`; c.font = "700 5px sans-serif"; c.textAlign = "left"; c.fillText("OK", tx + 12, ty - 14); }
          }
          if (strained && anim && !tool) emote(c, px + 4, py - 26, "sweat", E); else if (strained && !anim && q === 0) emote(c, px + 4, py - 26, "sweat", E);
        }
      }
      if (strained && cnt.B === 0 && cnt.I === 0 && open) emote(c, 30, Math.max(62, (s.y0 || 0) + 30), "sweat", E);
      if (s.ev >= 0) moveIn(c, s, E, i);
      // light: darker after dusk, then windows and lamps glow
      if (E.lit < 1) { c.fillStyle = `rgba(22,10,26,${(1 - E.lit) * 0.46})`; c.fillRect(0, 0, DW, DH + 4); }
      glows(c, s, E);
      // owl ahead of its worst month
      let owlMonth = -1; for (const m of s.risk) { const f = s.owlFrom[m]; if (i >= f && i < f + 21 + (s.D.filter(d => d.month === m).length)) owlMonth = m; }
      if (owlMonth >= 0) owl(c, s, E, i);
      weather(c, s, E);
      mailDraw(c, s, E);
      const evAt = s.events.find(e => i >= e.start && i < e.start + (e.days || 365)); if (evAt) eventArt(c, s, evAt, E);
      if (hovered.d === s.d) { c.strokeStyle = "rgba(247,235,213,.6)"; c.lineWidth = 2; c.strokeRect(1, 1, DW - 2, DH - 2); }
      const inEvent = s.ev >= 0 && i >= s.ev - 2 && i <= s.ev + 3;
      return { cnt, owlMonth, i, inEvent, ev: evAt };
    }

    const MOODC = { calm: T.spare, busy: T.have, strained: T.short };
    function setZ(b, n, w) { const v = String(n); if (b.dataset.v === v) return; b.dataset.v = v; b.innerHTML = `<em>${v}</em><span>${w}</span>`; if (b.parentNode && !reduced()) { b.parentNode.classList.remove("pulse"); void b.parentNode.offsetWidth; b.parentNode.classList.add("pulse"); } }
    function writeText(infos) {
      const i = infos[0].i, dt = new Date(Date.UTC(2025, 0, 1 + i)), label = `${WD[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONS[dt.getUTCMonth()]}`;
      dateEl.textContent = label; scrub.value = i; scrub.setAttribute("aria-valuetext", label);
      for (const inf of infos) {
        const s = inf.s, x = inf.cnt.x, md = s.mood[i], wk = x.working;
        s.zm.style.background = MOODC[md]; s.zm.parentNode.title = `${o.names[s.d]}: ${md}`;
        setZ(s.zw, wk ? fmt(x.busy) : 0, "Working"); setZ(s.zi, wk ? fmt(x.idle) : 0, "Idle"); setZ(s.zt, fmt(x.training || 0), "Training");
        s.cell.setAttribute("aria-label", `${o.names[s.d]}: ${md}. Working ${wk ? fmt(x.busy) : 0}, idle ${wk ? fmt(x.idle) : 0}, training ${fmt(x.training || 0)}. 1 figure is ${s.fscale} crews, 1 ticket is ${s.tscale} requests waiting.`);
      }
      return label;
    }
    function frame(ts) {
      raf = 0; if (!vis || document.hidden) { last = 0; return; }
      const dt = last ? Math.min(0.08, (ts - last) / 1000) : 0; last = ts; now += dt;
      if (playing) { prevT = t; t += dt * level.daysPerSec * spd; if (t >= 365) { t = 0; prevT = 0; } const a = Math.floor(prevT), b = Math.floor(t); if (b - a <= 14) streets.forEach(s => s.risk.forEach(m => { const f = s.first[m]; if (a < f && b >= f) s.swoopAt = now; })); }
      render(ts, dt); if (playing || !reduced()) raf = requestAnimationFrame(frame);
    }
    function render(ts, dt) {
      const anim = !reduced(), E = env(mFloat(t), anim), vs = streets.filter(s => s.vis); if (!vs.length) return;
      const infos = vs.map(s => { const r = drawStreet(s, E, dt || 0.016); r.s = s; return r; }), i = infos[0].i;
      if (ts - lastDraw > 90 || i !== lastEmit) { lastDraw = ts; if (i !== lastEmit) { const lab = writeText(infos); lastEmit = i; o.onDay && o.onDay(t, mFloat(t)); if (reduced() || !playing) { const w = streets.map(s => `${o.names[s.d]}: ${fmt(s.D[i].arrivals)} arrived, ${fmt(Math.max(0, s.D[i].backlog))} waiting`).join(". "); if (w !== lastLive) { lastLive = w; liveEl.textContent = `${lab}. ${w}.`; } } } }
    }
    function kick() { if (!raf && vis) raf = requestAnimationFrame(frame); }
    function setPlayUi() { btn.innerHTML = `<svg class="i" aria-hidden="true" style="width:18px;height:18px"><use href="#i-${playing ? "pause" : "play"}"/></svg>`; btn.setAttribute("aria-label", playing ? "Pause" : "Play"); btn.setAttribute("aria-pressed", playing); }
    function setSpeedUi() { speedBtns.forEach((b, i) => b.setAttribute("aria-pressed", i === SPEEDS.indexOf(spd))); }
    function applyMode() {
      const rm = reduced(); btn.hidden = rm; speedBox.hidden = rm; prev.hidden = next.hidden = !rm; scrub.step = rm ? 7 : 1;
      if (rm) { playing = false; t = Math.round(t / 7) * 7; if (t > 364) t = 364; if (bat) bat.setSpeed(1); }
      setPlayUi(); setSpeedUi(); lastEmit = -1; render(0, 0.016); if (!rm) kick();
    }
    btn.addEventListener("click", () => api.toggle());
    speedBtns.forEach((b, i) => b.addEventListener("click", () => api.setSpeed(i)));
    prev.addEventListener("click", () => api.setDay(Math.max(0, t - 7))); next.addEventListener("click", () => api.setDay(Math.min(364, t + 7)));
    scrub.addEventListener("input", () => api.setDay(+scrub.value));
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener && mq.addEventListener("change", applyMode);
    const io = "IntersectionObserver" in window ? new IntersectionObserver(es => { vis = es[0].isIntersecting && !host.classList.contains("hide"); if (vis) { last = 0; kick(); } }, { threshold: 0.05 }) : null; io && io.observe(host);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = 0; kick(); } });
    

    function resetStreet(s) { s.wasFilled.fill(false); s.born.fill(-9); s.fx = []; const n = counts(s, Math.floor(t)).N; for (let q = 0; q < n; q++) s.wasFilled[q] = true; s.born.fill(-9); }
    const api = {
      level: o.level || "city", streets,
      setDay(v) { prevT = t = clamp(v, 0, 364.99); streets.forEach(x => x.vis && resetStreet(x)); resetStreet(A); lastEmit = -1; render(performance.now(), 0.016); kick(); },
      getDay: () => t, monthFloat: mFloat,
      seekMonth(m) { const keep = playing; this.setDay(firstDay[m]); playing = keep; },
      play() { if (reduced()) return; playing = true; setPlayUi(); kick(); }, pause() { playing = false; setPlayUi(); },
      toggle() { playing ? this.pause() : this.play(); }, isPlaying: () => playing,
      setSpeed(i) { spd = SPEEDS[clamp(i | 0, 0, 3)]; setSpeedUi(); }, getSpeed: () => spd,
      setClock(v) { clockOverride = v; lastEmit = -1; render(performance.now(), 0.016); },
      setActive(d, fromUser) { const n = streets.find(x => x.d === d); if (!n || n === A) return; A = n; if (fromUser && o.onSelect) o.onSelect(d); },
      // a resident message lands on this street. opts.keep leaves the active street alone; opts.quiet (reduced motion) skips the drop and
      // only moves the street's count of messages in today
      incoming(d, label, opts) {
        const n = streets.find(x => x.d === d); if (!n) return; opts = opts || {}; if (n !== A && !opts.keep) this.setActive(d, false);
        const day = Math.floor(t); if (n.inDay !== day) { n.inDay = day; n.inN = 0; } n.inN++; n.mailN++;
        if (!opts.quiet) { const q = n.mailN * 3 + 1; n.mail.push({ at: now, x: 70 + ((n.mailN * 47) % 200), y: ROWS[n.mailN % 3] + 6, q }); if (n.mail.length > 6) n.mail.shift(); }
        render(performance.now(), 0.016); kick();
      },
      shows: d => { const n = streets.find(x => x.d === d); return !!(n && n.vis && vis !== false && !host.classList.contains("hide")); },
      inCount: d => { const n = streets.find(x => x.d === d); return n && n.inDay === Math.floor(t) ? n.inN : 0; },
      setEvents(evs) { streets.forEach(s => { s.events = (evs || []).filter(e => e.dept === s.d).map(e => ({ start: e.start, days: e.days, label: e.label || "Event", art: artOf(e) })); }); lastEmit = -1; render(performance.now(), 0.016); kick(); },
      setPlan(d, pd) {   // run this street's year on a different crew plan (the flyway)
        const s = streets.find(x => x.d === d); if (!s || !pd) return;
        const y = Z.year(d, pd), D = y.days, maxCrews = Math.max(...D.map(x => x.crews));
        s.y = y; s.D = D; s.maxCrews = maxCrews; s.tscale = nice(y.max_backlog / 46, [5, 10, 20, 25, 50, 100, 200, 500]);
        s.fscale = [1, 2, 3, 5, 10].find(k => maxCrews / k <= 14) || 10;
        s.mood = D.map((x, i) => { const late = x.past_due + (D[i - 1] ? D[i - 1].late_closed : 0) + (D[i - 2] ? D[i - 2].late_closed : 0) + x.late_closed;
          if (late / s.tscale >= 0.8) return "strained"; if (x.crews > 0 && x.idle / x.crews < 0.08 && x.working) return "busy"; return "calm"; });
        s.hot = D.reduce((b, x, i) => (x.arrivals > D[b].arrivals ? i : b), 0);
        if (s.vis) resetStreet(s); lastEmit = -1; render(performance.now(), 0.016);
      },
      setHover(d) { if (d) this.setActive(d, false); }, active: () => A.d,
      setVisible(v) { host.classList.toggle("hide", !v); ctl.hidden = !v; if (!v) { playing = false; setPlayUi(); vis = false; } else { vis = true; makeTerry(); lastEmit = -1; render(performance.now(), 0.016); kick(); } },
      layout, active: () => A.d,
      destroy() { tAlive = false; cancelAnimationFrame(raf); io && io.disconnect(); },
    };
    host.classList.add("hide");
    api.measure = measure; api.boot = () => { applyMode(); };
    return api;
  }
  root.TerryScene = { mount, LEVELS, SPEEDS, CHIP_H: CHIPH, CHIP_W: CHW, CHIP_B: CHB };
})(typeof window !== "undefined" ? window : globalThis);
