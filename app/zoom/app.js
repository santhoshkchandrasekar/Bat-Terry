/* Terry timeline: semantic zoom over the 2025 crew plan.
 *
 * Z0 city year, Z1 department year, Z2 department month (Z3 day, owls, Dusk-for-predators and escape come later: see HOOKS).
 * Every number comes from TerryLevels (levels.js) on top of TerryEngine (engine.js). This file only draws.
 *
 * How the world moves: each level is a list of marks {layer, key, tag, attrs}. Going between levels reconciles marks by key:
 * marks present in both tween (bars grow, the line stretches), new marks fade in, old ones fade out. So the Z0 bar for
 * Transportation in March becomes the Z1 bar for March, not a different picture. Z1 to Z2 is a camera push (scaleX).
 *
 * HOOKS (phase 2): z3Marks(d, day) + case 3 in goTo(); owlMarks(d) pushed from z0Marks/z1Marks (layer "owls"); duskMarks
 * for predators next to the hire Dusk lines in z1Marks; echo rings use #rings via bat.echo().
 */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = s => document.querySelector(s);
  const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
  const SHORTN = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional" };
  const FULLN = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks & Recreation", ISD: "Inspectional Services" };   // on hover, where a short name shows
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MS = MON.map(m => m.slice(0, 3));
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const money = v => "$" + Math.round(v).toLocaleString("en-US");
  const moneyK = v => (Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(2) + " million" : "$" + fmt(Math.round(v / 1e3) * 1e3));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = { camera: bezier(.22, .8, .2, 1), pop: bezier(.3, 1.5, .5, 1), soft: bezier(.4, 0, .2, 1) };
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 24; i++) { const v = X(t); if (Math.abs(v - x) < 1e-4) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } return Y(t); };
  }
  const reducedQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => reducedQ.matches;
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  const sceneEl = $("#scene"), stage = $("#stage"), svg = $("#chart"), world = $("#world"), hitsG = $("#hits"), whyG = $("#whyLayer");
  const LAYERS = ["grid", "bars", "gaps", "floors", "deco", "lines", "dots", "labels"];
  const layerEl = {}; LAYERS.forEach(n => (layerEl[n] = el("g", { "data-layer": n }, world)));

  let scene = null, lastMf = 0, lastSceneM = -1;   // SO: streets on (the toggle at city level; the month and day levels always show a street)
  let basePlan = null, GV = null;                              // GV: the goal view (window, owls, Dusk) while a goal is flown
  const SOn = () => S.lvl >= 2;   // the street scene and its counts only at month zoom and closer
  const pj = () => document.querySelector(".page").classList.contains("pj");   // projector layout (desktop)
  let data = null, E = null, Z = null, plan = null, city = null, info = {}, axes = {}, bat = null;
  const NOBAT = { setBranch() {}, setScale() {}, setHome() {}, setSpeed() {}, hangNow() {}, mode: () => "hang", busy: () => false, flip: async () => {}, echo: async () => {}, flap: async () => {} };   // Terry lives on the page, not inside the chart
  let G = null, S = { lvl: 0, d: null, m: null }, busy = false, firstTouch = false, expandCrumbs = false;
  const monthCache = new Map();

  // ---------------------------------------------------------------- data helpers (formatting only, no new numbers)
  const needC = mo => Math.ceil(mo.need - 0.01);               // crews needed, rounded up
  const gapC = mo => mo.have - needC(mo);
  const kindOf = mo => (mo.state === "spare" || (mo.state === "late" && mo.have >= mo.need - 0.01) ? "spare" : mo.state === "behind_not_late" ? "grace" : "short");
  const fmtDate = iso => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MS[m - 1]}${y !== 2025 ? " " + y : ""}`; };
  const signMonth = dec => (dec.decide_by.startsWith("2025") ? Number(dec.decide_by.slice(5, 7)) - 1 : -1);
  const monthData = (d, m) => { const k = d + m; if (!monthCache.has(k)) monthCache.set(k, Z.month(d, m, plan[d])); return monthCache.get(k); };
  const hires = d => info[d].decisions.filter(x => x.action === "hire");
  function computeAxes() {
    const steps = [2, 5, 6, 10, 20, 25, 50];
    for (const d of DEPTS) {
      const mx = Math.max(...info[d].months.map(mo => Math.max(mo.have, mo.need)));
      const step = steps.find(s => s >= mx / 4) || 50;
      let max = Math.ceil(mx / step) * step; if ((max - mx) / max < 0.04) max += step;
      axes[d] = { max, step };
    }
  }

  // ---------------------------------------------------------------- geometry
  // the city rows' label column: as wide as its longest status line (measured, so no font or window can run text into the plot)
  let mctx = null;
  function textW(txt, font) { try { mctx = mctx || document.createElement("canvas").getContext("2d"); mctx.font = font; return mctx.measureText(txt).width; } catch (e) { return txt.length * 7; } }
  function labelCol(W) {
    if (!info.PWDx) return 0; const ff = getComputedStyle(svg).fontFamily || "sans-serif"; let w = 0;
    for (const d of DEPTS) { w = Math.max(w, textW(deptStatus(d).t, `600 12px ${ff}`)); w = Math.max(w, textW(`Peak 99 crews`, `400 12px ${ff}`)); }
    return Math.min(Math.round(W * 0.34), Math.ceil(26 + w + 16));
  }
  const root_cmp = () => !!(window.TerryState && window.TerryState.compare);
  function computeG() {
    const bar = $("#bar"), W = Math.max(320, stage.clientWidth), phone = W < 480, pho = W >= 480 && W < 900;   // pho: the photographic projector fabric
    const maxi = document.documentElement.classList.contains("mx-open"), cloth = stage.parentElement, F = !maxi && cloth && cloth.clientHeight > 120 ? cloth.clientHeight : 0;   // F: the cloth's real height; the chart is laid out inside it
    stage.classList.toggle("tight", !!F && F < 470);                                                 // a small cloth: the title bar gives back its spare height
    const T = Math.round(bar.offsetTop + bar.offsetHeight) + (F && F < 470 ? 6 : pho ? 10 : 22) + (document.body.classList.contains("cmp-on") && S.lvl < 2 ? 46 : 0);   // where the content starts (a comparison puts its A and B row under the title bar)
    const mode = !SOn() ? "off" : W >= 660 ? "side" : "stack", side = mode === "side", stack = mode === "stack", compact = phone || stack;
    const cw = side ? clamp(Math.round(W * 0.34), pho ? 270 : 280, 400) : 0, x1 = side ? W - cw - 16 : (S.lvl === 1 ? W - 16 : W - 4), x0 = phone ? 32 : S.lvl === 0 ? Math.max(pho ? (W < 640 ? 150 : 176) : 208, labelCol(W)) : (S.lvl === 2 ? 86 : 56), mw = (x1 - x0) / 12;
    const sw = Math.min(W, 460), sh = Math.round(sw * 0.37) + 24;
    const bw = Math.round(mw * 0.62), g = { W, phone, mode, side, stack, compact, top: T, cw, sw, sh, x0, x1, mw, bw, bo: (mw - bw) / 2 };
    // Z0: four rows. In "side" mode each row's street sits beside it at the same height. In "stack" mode it sits under it.
    if (pho) g.z0 = { T0: T, pitch: 64, base: 52, plotH: 40, ch: 58 };
    else if (side) g.z0 = { T0: T, pitch: 168, base: 150, plotH: 118, ch: 160 };
    else if (stack) { const ch = phone ? 112 : 124; g.z0 = { T0: T, pitch: ch + 8 + sh + 20, base: phone ? 88 : 100, plotH: phone ? 66 : 76, ch }; }
    else g.z0 = phone ? { T0: T, pitch: 108, base: 92, plotH: 70, ch: 100 } : { T0: T, pitch: 86, base: 76, plotH: 58, ch: 82 };
    if (side && document.documentElement.classList.contains("mx-open")) {   // the enlarged window: the four rows share its height (capped), so the cloth is not left empty below
      const mf = document.querySelector(".mx-fab"), per = mf ? Math.floor((mf.clientHeight - T - 84) / 4) : 0;
      if (per > g.z0.pitch) { const pitch = Math.min(per, 230); g.z0 = { T0: T, pitch, base: Math.round(pitch * .89), plotH: Math.round(pitch * .70), ch: pitch - 8 }; }
    }
    if (F && !side) {   // fit guard: the title, four rows, the month axis and the legend strip all sit inside the cloth
      const z = g.z0, pitch = clamp(Math.floor((F - 72 - T) / 4), 40, z.pitch);   /* 72: under the last row, the axis (pitch - 8 + 22), the gap to the legend (24), the legend (26) and 4 to spare; at 66 the city legend hid on laptops */
      if (pitch < z.pitch) g.z0 = { T0: T, pitch, base: pitch - 8, plotH: Math.max(24, pitch - 22), ch: pitch - 6 };
    }
    g.z0.axisY = g.z0.T0 + 3 * g.z0.pitch + g.z0.base + 22;
    g.z1 = pho ? { ribT: T, ribH: 0, plotT: T + 34, plotH: 196, sky: 40 } : compact ? { ribT: T, ribH: 0, plotT: T + 34, plotH: 230, sky: 44 } : { ribT: T, ribH: 0, plotT: T + 34, plotH: side ? 280 : 292, sky: 58 };
    g.z1.base = g.z1.plotT + g.z1.plotH;
    g.z2 = pho ? { axisY: T + 12, aT: T + 22, aH: 74, bT: T + 108, bH: 38, cT: T + 158, cH: 54, lT: T + 222, lH: 20 } : compact ? { axisY: T + 12, aT: T + 22, aH: 104, bT: T + 140, bH: 50, cT: T + 208, cH: 76, lT: T + 296, lH: 20 }
                   : { axisY: T + 12, aT: T + 22, aH: 140, bT: T + 178, bH: 64, cT: T + 270, cH: 92, lT: T + 378, lH: 24 };
    if (side && !pho && document.documentElement.classList.contains("mx-open")) {   // the enlarged window: levels 1 and 2 stretch to the cloth so no empty band is left above or below the chart
      const mf = document.querySelector(".mx-fab"), avail = mf ? mf.clientHeight - 6 : 0;
      const e1 = Math.min(420, avail - (g.z1.base + 36 + 16 + 50));
      if (e1 > 0) { g.z1.plotH += e1; g.z1.base = g.z1.plotT + g.z1.plotH; }
      const z = g.z2, end = z.lT + z.lH, e2 = Math.min(420, avail - (end + 16 + 50));
      if (e2 > 0) { const s = (end - (T + 22) + e2) / (end - (T + 22)), at = v => T + 22 + (v - T - 22) * s; g.z2 = Object.assign({}, z, { aH: z.aH * s, bT: at(z.bT), bH: z.bH * s, cT: at(z.cT), cH: z.cH * s, lT: at(z.lT) }); }
    }
    if (F) {   // level 1: title bar, owl sky, plot, month axis and a 76 px strip (legend, or the playback bar) all inside the cloth
      const z = g.z1, tight = F < 470, cmpOn = document.body.classList.contains("cmp-on");
      const otRow = !cmpOn && window.TerryState && (window.TerryState.roosts || []).length ? 34 : 0;   // a Roost's on-time callout (#ontime) gets its own row above the plot, so it never covers a mark
      z.plotT = T + (tight ? 10 : 34) + otRow; z.sky = tight ? 36 : z.sky;
      z.plotH = clamp(F - z.plotT - 112 - (cmpOn ? 26 : 0), 110, 420); /* 112: the month axis (36), the gap (16) and the legend strip (26) all inside the cloth; at 76 the legend never fit and hid */ g.cmpPad = cmpOn ? 26 : 0; /* a comparison adds a delta strip under the month axis */ z.base = z.plotT + z.plotH;
      const z2 = g.z2, end = z2.lT + z2.lH, room = F - 10 - (T + 22), sc = (end - (T + 22)) > room ? Math.max(.55, room / (end - (T + 22))) : 1;   // level 2 shrinks to the cloth, never grows
      if (sc < 1 && !stack) { const at = v => T + 22 + (v - T - 22) * sc; g.z2 = Object.assign({}, z2, { aH: z2.aH * sc, bT: at(z2.bT), bH: z2.bH * sc, cT: at(z2.cT), cH: z2.cH * sc, lT: at(z2.lT) }); }
    }
    const sh1 = side ? Math.round(cw * 186 / 300) + 52 : 0, shz = Math.round(sw * 0.52) + 24;
    const bottoms = [stack ? T + 4 * g.z0.pitch - 20 : g.z0.axisY + 8,
      Math.max(g.z1.base + 36 + (g.cmpPad || 0), side ? T + sh1 + 130 : 0, stack ? g.z1.base + 84 + shz : 0),
      Math.max(g.z2.lT + g.z2.lH, side ? g.z2.aT + sh1 : 0, stack ? g.z2.lT + g.z2.lH + 16 + shz : 0)];
    g.legY = lvl => bottoms[lvl] + (pho ? 10 : 16); g.F = F; g.legOK = lvl => !F || lvl > 1 || g.legY(lvl) + 26 <= F - 4;
    g.hOf = lvl => { const h = g.legY(lvl) + (pho ? 28 : 50); return F && lvl < 2 ? Math.min(h, F) : h; }; g.pho = pho; g.Hmax = Math.max(g.hOf(0), g.hOf(1), g.hOf(2));
    g.H = g.hOf(S.lvl); g.sh1 = sh1;
    g.street = lvl => {   // the street cells for a level, in stage pixels
      if (lvl === 0) return DEPTS.map((d, i) => (side ? { d, x: x1 + 16, y: T + i * g.z0.pitch, w: cw, h: g.z0.pitch - 8, chips: "right" } : { d, x: 0, y: T + i * g.z0.pitch + g.z0.ch + 8, w: sw, h: sh }));
      const d = S.d; if (!d) return [];
      if (lvl === 1) return [side ? { d, x: x1 + 16, y: T, w: cw, h: sh1, chips: "below" } : { d, x: 0, y: g.z1.base + 84, w: sw, h: shz }];
      return [side ? { d, x: x1 + 16, y: g.z2.aT, w: cw, h: sh1, chips: "below" } : { d, x: 0, y: g.z2.lT + g.z2.lH + 16, w: sw, h: shz }];
    };
    return g;
  }
  const rowT = i => G.z0.T0 + i * G.z0.pitch, rowB = i => rowT(i) + G.z0.base, hitH = () => (G.stack ? G.z0.ch : G.z0.pitch - 8);
  const s0 = d => G.z0.plotH / axes[d].max, s1 = d => (G.z1.plotH - G.z1.sky) / axes[d].max;
  const colX = m => G.x0 + G.mw * m, colC = m => G.x0 + G.mw * (m + 0.5);
  const bolt = (cx, cy, w, h) => [[.55, 0], [.05, .58], [.42, .58], [.3, 1], [.95, .36], [.56, .36]].flatMap(([px, py]) => [cx + (px - .5) * w, cy + (py - .5) * h]);

  // ---------------------------------------------------------------- the mark engine
  const NUM = new Set(["x", "y", "width", "height", "cx", "cy", "r", "x1", "x2", "y1", "y2", "opacity", "font-size", "stroke-width", "points", "stroke-opacity", "fill-opacity"]);
  const reg = new Map();
  let anim = null;
  const ptsStr = a => { let s = ""; for (let i = 0; i < a.length; i += 2) s += (i ? " " : "") + a[i].toFixed(1) + "," + a[i + 1].toFixed(1); return s; };
  function setNum(e, k, v) { if (k === "points") e.setAttribute("points", ptsStr(v)); else e.setAttribute(k, +v.toFixed(2)); }
  function lerpV(a, b, t) { return Array.isArray(b) ? b.map((v, i) => lerp(a[i] === undefined ? v : a[i], v, t)) : lerp(a === undefined ? b : a, b, t); }
  function put(r) { // write a mark's text and tspans after position changes
    if (r.lines) for (const t of r.el.childNodes) if (t.nodeName === "tspan") t.setAttribute("x", r.el.getAttribute("x"));
  }
  function setText(r, m) {
    if (m.lines) { r.lines = m.lines; r.el.textContent = ""; m.lines.forEach((ln, i) => { const t = el("tspan", i ? { dy: "1.05em" } : {}, r.el); t.textContent = ln; t.setAttribute("x", r.el.getAttribute("x") || 0); }); }
    else if (m.txt !== undefined && (r.txt !== m.txt || r.tip !== m.tip)) { r.txt = m.txt; r.tip = m.tip; r.lines = null; r.el.textContent = m.txt; if (m.tip) el("title", {}, r.el).textContent = m.tip; }   // tip: the full name on hover
  }
  function mkMark(layer, key, tag, a, o) { return Object.assign({ layer, key: layer + ":" + key, tag, a }, o || {}); }
  function finishAnim() { if (anim) { const a = anim; anim = null; a.finish(); } }
  function morph(marks, opt) {
    finishAnim();
    opt = Object.assign({ dur: 650, exitMs: 240, snap: false, easing: ease.camera }, opt);
    if (reduced()) { opt.snap = true; opt.dur = 120; }
    const items = [], seen = new Set();
    for (const m of marks) {
      seen.add(m.key);
      let r = reg.get(m.key), enter = false;
      if (r && r.tag !== m.tag) { r.el.remove(); reg.delete(m.key); r = null; }
      if (!r) { r = { el: el(m.tag, {}, layerEl[m.layer]), tag: m.tag, cur: {}, key: m.key }; reg.set(m.key, r); enter = true; }
      if (m.cls !== undefined) r.el.setAttribute("class", m.cls);
      const to = {}, fixed = {};
      for (const k in m.a) { if (NUM.has(k)) to[k] = m.a[k]; else fixed[k] = m.a[k]; }
      for (const k in fixed) r.el.setAttribute(k, fixed[k]);
      if (to.opacity === undefined) to.opacity = 1;
      const from = enter ? Object.assign({}, to, opt.snap ? {} : (m.from || {}), { opacity: opt.instant ? to.opacity : 0 }) : Object.assign({}, r.cur);
      if (!enter) for (const k in to) if (from[k] === undefined) from[k] = to[k];
      setText(r, m);
      const it = { r, kind: enter ? "enter" : "upd", from, to, delay: m.delay || 0, md: m.dur || 280, draw: m.draw };
      for (const k in (enter ? from : to)) if (NUM.has(k)) setNum(r.el, k, enter ? from[k] : (opt.snap ? to[k] : from[k]));
      if (opt.snap && !enter) r.cur = Object.assign({}, to); else r.cur = Object.assign({}, from);
      if (it.draw && !opt.snap) { try { it.len = r.el.getTotalLength(); r.el.style.strokeDasharray = it.len; r.el.style.strokeDashoffset = it.len; } catch (e) { it.draw = false; } }
      items.push(it); put(r);
    }
    for (const [k, r] of reg) if (!seen.has(k)) items.push({ r, kind: "exit", from: Object.assign({ opacity: 1 }, r.cur), to: { opacity: 0 }, delay: 0, md: opt.exitMs });
    let total = opt.dur;
    for (const it of items) { if (it.kind === "enter") total = Math.max(total, it.delay + it.md); if (it.kind === "exit") total = Math.max(total, it.md); }
    if (opt.snap) { total = 120; for (const it of items) { it.delay = 0; it.md = 120; if (it.kind === "upd") it.kind = "done"; } }
    if (opt.instant) { for (const it of items) if (it.kind === "exit") { it.r.el.remove(); reg.delete(it.r.key); } return Promise.resolve(); }
    return new Promise(res => {
      const t0 = performance.now();
      const apply = (it, t) => {
        const r = it.r; let q;
        if (it.kind === "done") return;
        if (it.kind === "upd") q = opt.easing(clamp(t / opt.dur, 0, 1));
        else if (it.kind === "enter") q = opt.snap ? clamp((t - it.delay) / it.md, 0, 1) : ease.camera(clamp((t - it.delay) / it.md, 0, 1));
        else q = ease.soft(clamp(t / it.md, 0, 1));
        if (it.kind === "enter" && opt.snap) { setNum(r.el, "opacity", lerp(0, it.to.opacity, q)); r.cur.opacity = it.to.opacity * q; return; }
        for (const k in it.to) { const v = lerpV(it.from[k], it.to[k], q); r.cur[k] = v; setNum(r.el, k, v); }
        if (it.kind === "enter" && t - it.delay < 0) setNum(r.el, "opacity", 0);
        if (it.draw && it.len) r.el.style.strokeDashoffset = it.len * (1 - clamp((t - it.delay) / 700, 0, 1));
        put(r);
      };
      const end = () => {
        for (const it of items) {
          if (it.kind === "exit") { it.r.el.remove(); reg.delete(it.r.key); continue; }
          for (const k in it.to) { setNum(it.r.el, k, it.to[k]); it.r.cur[k] = it.to[k]; }
          if (it.draw) { it.r.el.style.strokeDasharray = ""; it.r.el.style.strokeDashoffset = ""; }
          put(it.r);
        }
        anim = null; res();
      };
      anim = { finish: end };
      const tick = now => {
        if (!anim || anim.finish !== end) return;
        const t = now - t0;
        for (const it of items) apply(it, t);
        if (t >= total) end(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  function clearWorld() { finishAnim(); for (const [, r] of reg) r.el.remove(); reg.clear(); }

  // ---------------------------------------------------------------- Z0 marks
  function gapShape(mo, base, s, xL, w, ctr) {
    const k = kindOf(mo), barTop = base - mo.have * s, needY = base - mo.need * s;
    if (k === "spare") { const h = Math.max(0, mo.have - mo.need) * s; return { k, y: barTop, h, notch: [ctr, barTop, ctr, barTop, ctr, barTop] }; }
    const h = Math.max(3, (mo.need - mo.have) * s), y = barTop - h;
    const nz = k === "short" && h >= 9 ? [ctr - 5, y, ctr + 5, y, ctr, y + 6] : [ctr, y, ctr, y, ctr, y];
    return { k, y, h, notch: nz, needY };
  }
  function floorMarks(out, d, base, s, x0, x1, pre, delay) {
    const f = axes[d].step; for (let v = f, i = 1; v <= axes[d].max + 1e-6; v += f, i++) {
      const y = base - v * s;
      out.push(mkMark("grid", `${pre}g:${d}:${i}`, "line", { x1: x0, x2: x1, y1: y, y2: y, "stroke-opacity": 1 }, { cls: "floor-grid", delay }));
      out.push(mkMark("floors", `${pre}f:${d}:${i}`, "line", { x1: x0, x2: x1, y1: y, y2: y }, { cls: "floor-over", delay }));
    }
  }
  const DICON = { PWDx: "truck", BTDT: "light", PARK: "leaf", ISD: "house" };
  function deptStatus(d) {
    const ms = info[d].months, sh = ms.filter(m => kindOf(m) === "short").length, gr = ms.filter(m => kindOf(m) === "grace").length, pl = (n, w) => `${n} month${n === 1 ? "" : "s"} ${w}`;
    if (sh && gr) return { cls: "bad", t: `${sh} short, ${gr} behind` }; if (sh) return { cls: "bad", t: pl(sh, "short") }; if (gr) return { cls: "soft", t: pl(gr, "behind, not late") };
    return { cls: "ok", t: "Covered all year" };
  }
  // the forecast's likely range (low to high from forecast_2025.csv) around the crews-needed line, clipped to the plot
  function bandPts(d, B, s, mh = 0) {
    const F = Z.forecast().depts[d]; if (!F || !F.lo_ratio) return null;
    // mh: the least half height in px, so the band still reads on the city's short rows
    const top = B - axes[d].max * s, ms = info[d].months, y = (mo, r) => Math.max(top, Math.min(B, B - mo.need * r * s)), c = mo => B - mo.need * s;
    const hi = (mo, m) => Math.max(top, Math.min(y(mo, F.hi_ratio[m]), c(mo) - mh)), lo = (mo, m) => Math.min(B, Math.max(y(mo, F.lo_ratio[m]), c(mo) + mh));
    return ms.map((mo, m) => [colC(m), hi(mo, m)]).concat(ms.map((mo, m) => [colC(m), lo(mo, m)]).reverse()).flat();
  }
  function z0Marks(opts) {
    opts = opts || {}; const out = [], z = G.z0, ph = G.phone, first = !!opts.first;
    DEPTS.forEach((d, i) => {
      const I = info[d], T = rowT(i), B = rowB(i), s = s0(d), rd = i * 80, dl = opts.enterDelay === undefined ? 0 : opts.enterDelay + rd;
      floorMarks(out, d, B, s, G.x0, G.x1, "", dl);
      out.push(mkMark("grid", `base:${d}`, "line", { x1: G.x0, x2: G.x1, y1: B, y2: B }, { cls: "ground", delay: dl }));
      I.months.forEach((mo, m) => {
        const bd = dl + (first ? m * 30 : m * 12), L = colX(m) + G.bo, ctr = colC(m), g = gapShape(mo, B, s, L, G.bw, ctr);
        out.push(mkMark("bars", `b:${d}:${m}`, "rect", { x: L, y: B - mo.have * s, width: G.bw, height: mo.have * s }, { cls: "bar", delay: bd, dur: 400, from: first ? { y: B, height: 0 } : null }));
        out.push(mkMark("gaps", `g:${d}:${m}`, "rect", { x: L, y: g.y, width: G.bw, height: g.h }, { cls: "g-" + g.k, delay: bd, dur: 400, from: first ? { y: B, height: 0 } : null }));
        out.push(mkMark("gaps", `e:${d}:${m}`, "line", { x1: L, x2: L + G.bw, y1: g.k === "spare" && g.h > 1 ? g.y : -50, y2: g.k === "spare" && g.h > 1 ? g.y : -50, opacity: g.k === "spare" && g.h > 1 ? 1 : 0 }, { cls: "edge-dot", delay: bd }));
        out.push(mkMark("gaps", `n:${d}:${m}`, "polygon", { points: g.notch }, { cls: "notch", delay: bd }));
      });
      const pts = I.months.flatMap((mo, m) => [colC(m), B - mo.need * s]), bp = bandPts(d, B, s, ph ? 2 : 3.5);
      if (bp) out.push(mkMark("deco", `fb:${d}`, "polygon", { points: bp }, { cls: "fc-band z0", delay: dl + 200 }));
      out.push(mkMark("lines", `lh:${d}`, "polyline", { points: pts }, { cls: "l-halo", delay: dl + 200, draw: first }));
      out.push(mkMark("lines", `ln:${d}`, "polyline", { points: pts }, { cls: "l-need", delay: dl + 200, draw: first }));
      I.months.forEach((mo, m) => out.push(mkMark("dots", `d:${d}:${m}`, "circle", { cx: colC(m), cy: B - mo.need * s, r: ph ? 3 : 3.4 }, { cls: "dot", delay: dl + 200 + (first ? m * 40 : 0) })));
      if (ph) out.push(mkMark("labels", `rn:${d}`, "text", { x: G.x0 + 4, y: B - z.plotH + 14, opacity: 1 }, { cls: "t-name halo", txt: SHORTN[d], tip: FULLN[d] !== SHORTN[d] ? FULLN[d] : undefined, delay: dl }));
      else {
        const mid = B - z.plotH / 2, st = deptStatus(d), pk = Math.max(...I.months.map(needC)), nm = (G.side && I.name.length > 16) || textW(I.name, `600 14.5px ${getComputedStyle(svg).fontFamily || "sans-serif"}`) > G.x0 - 26 - 14 ? SHORTN[d] : I.name;
        out.push(mkMark("labels", `ic:${d}`, "use", { x: 0, y: mid - (z.pitch < 72 ? 17 : 21), width: 18, height: 18, href: "#i-" + DICON[d], opacity: 1 }, { cls: "ico", delay: dl }));
        out.push(mkMark("labels", `rn:${d}`, "text", { x: 26, y: z.pitch < 72 ? mid - 3 : mid - 7, opacity: 1 }, { cls: "t-name", txt: nm, tip: nm !== FULLN[d] ? FULLN[d] : undefined, delay: dl }));
        const tight = z.pitch < 72;   // compact rows: the name and the status only, nothing overlaps
        if (!tight) out.push(mkMark("labels", `pk:${d}`, "text", { x: 26, y: mid + 11, opacity: 1 }, { cls: "t-peak", txt: `Peak ${pk} crews`, delay: dl }));
        out.push(mkMark("labels", `st:${d}`, "text", { x: 26, y: tight ? mid + 12 : mid + 28, opacity: 1 }, { cls: "t-stat " + st.cls, txt: st.t, delay: dl }));
      }
      if (G.stack) monthAxis(out, B + 18, dl, i + ":");
    });
    if (!G.stack) monthAxis(out, G.z0.axisY, opts.enterDelay || 0);
    return out;
  }
  function monthAxis(out, y, delay, pre) {
    MON.forEach((n, m) => out.push(mkMark("labels", `ax:${pre || ""}${m}`, "text", { x: colC(m), y, opacity: 1 }, { cls: "t-axis", txt: n[0], delay: delay || 0 })));
  }

  // ---------------------------------------------------------------- Z1 marks
  let baseInfo = {};                                                          // the stay-the-course plan, to tell a flyway hire from a planned one
  const hireKey = dec => dec.decide_by + ":" + dec.crews;
  const isNewHire = (d, dec) => plan !== basePlan && !!baseInfo[d] && !baseInfo[d].decisions.some(x => x.action === "hire" && hireKey(x) === hireKey(dec));
  const addedCap = (d, m) => (plan === basePlan || !baseInfo[d] ? 0 : Math.max(0, info[d].months[m].have - baseInfo[d].months[m].have));
  function hireGeom(d, dec) { const p = pillGeom(d, dec, { y1: G.z1.plotT }); return Object.assign(p, { bx: p.cx, by: p.cy, M: dec.month, sm: signMonth(dec) }); }
  const trainMonth = M => MON[(M + 11) % 12];
  const hireTip = (d, dec) => `<h4>Sign ${WORDS[dec.crews] ? dec.crews : dec.crews} crew${dec.crews === 1 ? "" : "s"} by ${fmtDate(dec.decide_by)}</h4><div>Trains in ${trainMonth(dec.month)}, works from ${MON[dec.month]}.</div>`;
  function z1Marks(d, opts) {
    opts = opts || {}; const out = [], z = G.z1, I = info[d], B = z.base, s = s1(d), ph = G.phone, base = opts.enterDelay === undefined ? 300 : opts.enterDelay;
    floorMarks(out, d, B, s, G.x0, G.x1, "", base);
    for (let v = axes[d].step, i = 1; v <= axes[d].max + 1e-6; v += axes[d].step, i++)
      out.push(mkMark("labels", `yl:${d}:${i}`, "text", { x: G.x0 - 10, y: B - v * s + 4, opacity: 1 }, { cls: "t-tick", txt: `${v}`, delay: base }));
    out.push(mkMark("labels", `yu:${d}`, "text", { x: G.x0 - 10, y: B - axes[d].max * s - 14, opacity: 1 }, { cls: "t-tick t-unit", txt: "crews", delay: base }));
    out.push(mkMark("grid", `base:${d}`, "line", { x1: G.x0, x2: G.x1, y1: B, y2: B }, { cls: "ground" }));
    I.months.forEach((mo, m) => {
      const L = colX(m) + G.bo, ctr = colC(m), g = gapShape(mo, B, s, L, G.bw, ctr), ac = addedCap(d, m);
      out.push(mkMark("bars", `b:${d}:${m}`, "rect", { x: L, y: B - mo.have * s, width: G.bw, height: mo.have * s }, { cls: "bar" }));
      out.push(mkMark("gaps", `g:${d}:${m}`, "rect", { x: L, y: g.y, width: G.bw, height: g.h }, { cls: "g-" + g.k }));
      out.push(mkMark("gaps", `e:${d}:${m}`, "line", { x1: L, x2: L + G.bw, y1: g.k === "spare" && g.h > 1 ? g.y : -50, y2: g.k === "spare" && g.h > 1 ? g.y : -50, opacity: g.k === "spare" && g.h > 1 ? 1 : 0 }, { cls: "edge-dot" }));
      out.push(mkMark("gaps", `n:${d}:${m}`, "polygon", { points: g.notch }, { cls: "notch" }));
      out.push(mkMark("deco", `fc:${d}:${m}`, "rect", { x: L, y: B - mo.have * s, width: G.bw, height: ac * s }, { cls: "flycap", opacity: ac > 0 ? 1 : 0 }));
      if (GV) out.push(mkMark("deco", `oc:${d}:${m}`, "rect", { x: L, y: B - mo.have * s - 1, width: G.bw, height: 2 }, { cls: "capo " + (FLY.on ? (ac > 0 ? "hv" : "none") : "og") }));   // item 4: graphite cap on the original plan, harbour on changed months
    });
    const pts = I.months.flatMap((mo, m) => [colC(m), B - mo.need * s]), bp = bandPts(d, B, s);
    if (bp) out.push(mkMark("deco", `fb:${d}`, "polygon", { points: bp }, { cls: "fc-band" }));
    out.push(mkMark("lines", `lh:${d}`, "polyline", { points: pts }, { cls: "l-halo" }));
    out.push(mkMark("lines", `ln:${d}`, "polyline", { points: pts }, { cls: "l-need" }));
    I.months.forEach((mo, m) => out.push(mkMark("dots", `d:${d}:${m}`, "circle", { cx: colC(m), cy: B - mo.need * s, r: ph ? 3 : 3.8 }, { cls: "dot" })));
    // a crew in paid training sits on top of the bar the month before it works
    I.training.forEach((t, i) => out.push(mkMark("deco", `tr:${d}:${i}`, "rect", { x: colX(t.month) + G.bo, y: B - (I.months[t.month].have + t.crews) * s, width: G.bw, height: t.crews * s }, { cls: "train-o", delay: base + 100 })));
    monthAxis(out, B + 20, 0);
    // hires planned before any goal: outlined markers on the bars. A flyway hire is drawn by the plan overlay.
    hires(d).forEach((dec, id) => {
      if (isNewHire(d, dec)) return; const pg = pillGeom(d, dec, { y1: z.plotT });
      out.push(mkMark("deco", `hp:${d}:${id}`, "rect", { x: pg.cx - pg.w / 2, y: pg.cy - pg.h / 2, width: pg.w, height: pg.h, rx: pg.h / 2 }, { cls: "pillm", delay: base + id * 60 }));
      out.push(mkMark("labels", `hl:${d}:${id}`, "text", { x: pg.cx, y: pg.cy + 4.2, opacity: 1 }, { cls: "t-hire", txt: `+${dec.crews}`, delay: base + id * 60 }));
    });
    return out;
  }

  // ---------------------------------------------------------------- Z2 marks
  const niceUp = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))); for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p; return 10 * p; };
  function z2Marks(d, m, opts) {
    opts = opts || {}; const out = [], z = G.z2, ph = G.phone, I = info[d], MD = monthData(d, m), n = MD.days.length, x0 = G.x0, dw = (G.x1 - G.x0) / n, ded = I.long_due;
    const dx = i => x0 + dw * i, dc = i => x0 + dw * (i + 0.5), bw = Math.max(2, dw - (ph ? 3 : 6));
    const D0 = opts.delay === undefined ? 0 : opts.delay, rv = k => D0 + k * 120;
    // day axis and weekend shading
    MD.days.forEach((day, i) => {
      const wk = day.weekday === 0 || day.weekday === 6;
      if (wk) out.push(mkMark("deco", `wk:${i}`, "rect", { x: dx(i), y: z.axisY - 14, width: dw, height: z.lT + z.lH - z.axisY + 14 }, { cls: "wk-shade", delay: rv(0) }));
      const num = i + 1; if (!(ph || dw < 24) || num === 1 || num % 5 === 0)
        out.push(mkMark("labels", `dn:${i}`, "text", { x: dc(i), y: z.axisY, opacity: 1 }, { cls: "t-day" + (wk ? "" : " wk"), txt: `${num}`, delay: rv(0) + i * 6 }));
    });
    // band A: arrived (up) and closed (down) around a center line
    const aMax = niceUp(Math.max(...MD.days.map(x => Math.max(x.arrivals, x.closed)))), aC = z.aT + z.aH / 2, ah = z.aH / 2 - 8;
    out.push(mkMark("grid", "ac", "line", { x1: x0, x2: G.x1, y1: aC, y2: aC }, { cls: "ground", delay: rv(1) }));
    MD.days.forEach((day, i) => {
      out.push(mkMark("bars", `ar:${i}`, "rect", { x: dx(i) + (dw - bw) / 2, y: aC - ah * day.arrivals / aMax, width: bw, height: ah * day.arrivals / aMax }, { cls: "a-arr", delay: rv(1) + i * 8, from: { y: aC, height: 0 }, dur: 260 }));
      out.push(mkMark("bars", `cl:${i}`, "rect", { x: dx(i) + (dw - bw) / 2, y: aC, width: bw, height: ah * day.closed / aMax }, { cls: "a-clo", delay: rv(1) + i * 8, from: { height: 0 }, dur: 260 }));
    });
    out.push(mkMark("labels", "aly1", "text", { x: x0 - 8, y: z.aT + 10, opacity: 1 }, { cls: "t-tick t-band", lines: ["Requests", "in \u2191 out \u2193", `${fmt(aMax)}/day`], delay: rv(1) }));
    // band B: the waiting pile, with the past-due part in coral
    const bMax = niceUp(Math.max(...MD.days.map(x => x.backlog), 1)), bB = z.bT + z.bH, bh = z.bH - 10;
    const by = v => bB - bh * v / bMax;
    out.push(mkMark("grid", "bb", "line", { x1: x0, x2: G.x1, y1: bB, y2: bB }, { cls: "ground", delay: rv(2) }));
    const bpts = MD.days.flatMap((x, i) => [dc(i), by(x.backlog)]);
    out.push(mkMark("lines", "barea", "polygon", { points: [dc(0), bB, ...bpts, dc(n - 1), bB] }, { cls: "b-area", delay: rv(2) }));
    if (MD.days.some(x => x.past_due > 0.5)) out.push(mkMark("lines", "bpast", "polygon", { points: [dc(0), bB, ...MD.days.flatMap((x, i) => [dc(i), by(Math.min(x.past_due, x.backlog))]), dc(n - 1), bB] }, { cls: "b-past", delay: rv(2) }));
    out.push(mkMark("lines", "bline", "polyline", { points: bpts }, { cls: "b-line" + (ded ? " slow" : ""), delay: rv(2) }));
    out.push(mkMark("labels", "bly", "text", { x: x0 - 8, y: z.bT + 10, opacity: 1 }, { cls: "t-tick t-band", lines: ["Waiting", `${fmt(bMax)} open`], delay: rv(2) }));
    // band C: crews as bricks, solid when working, hollow when idle
    const maxOn = Math.max(...MD.days.map(x => x.crews_on), 1), trn = I.training.find(t => t.month === m), tn = trn ? trn.crews : 0;
    const block = maxOn >= 40 ? 5 : maxOn >= 14 ? 2 : 1, cB = z.cT + z.cH, uh = (z.cH - 8) / Math.ceil((maxOn + tn) / block), sw = Math.max(2, dw - (ph ? 3 : 6));
    out.push(mkMark("grid", "cb", "line", { x1: x0, x2: G.x1, y1: cB, y2: cB }, { cls: "ground", delay: rv(3) }));
    let firstWk = -1;
    MD.days.forEach((day, i) => {
      if (!day.working) { if (firstWk < 0) firstWk = i; return; }
      const units = day.crews_on / block, busyU = day.crews_busy / block;
      for (let k = 0; k < Math.ceil(units - 1e-6); k++) {
        const y = cB - (k + 1) * uh + 1, f = clamp(busyU - k, 0, 1), top = y, hh = uh - 1.5;
        out.push(mkMark("bars", `cs:${i}:${k}`, "rect", { x: dx(i) + (dw - sw) / 2, y: top, width: sw, height: hh }, { cls: f < 0.5 ? "c-off c-idle" : "c-off", delay: rv(3) + i * 8, dur: 200, from: { y: top + 8 } }));
        if (f > 0) out.push(mkMark("bars", `cf:${i}:${k}`, "rect", { x: dx(i) + (dw - sw) / 2, y: top + hh * (1 - f), width: sw, height: hh * f }, { cls: "c-on", delay: rv(3) + i * 8, dur: 200, from: { y: top + hh } }));
      }
      for (let k = 0; k < Math.ceil(tn / block - 1e-6); k++) {
        const kk = Math.ceil(units - 1e-6) + k; out.push(mkMark("bars", `ct:${i}:${k}`, "rect", { x: dx(i) + (dw - sw) / 2, y: cB - (kk + 1) * uh + 1, width: sw, height: uh - 1.5 }, { cls: "train-o", delay: rv(3) + i * 8, dur: 200 }));
      }
    });
    out.push(mkMark("labels", "cly", "text", { x: x0 - 8, y: z.cT + 12, opacity: 1 }, { cls: "t-tick t-band", lines: ["Crews", `${maxOn} on staff`, `1 box = ${block} crew${block > 1 ? "s" : ""}`], delay: rv(3) }));
    G.z2block = block;
    // late strip
    const lMax = Math.max(...MD.days.map(x => x.late_closed)), unit = Math.max(1, lMax / 4), lB = z.lT + z.lH;
    MD.days.forEach((day, i) => { const c = Math.min(4, Math.ceil(day.late_closed / unit - 1e-6)); for (let k = 0; k < c; k++)
      out.push(mkMark("bars", `ls:${i}:${k}`, "rect", { x: dx(i) + (dw - bw) / 2, y: lB - (k + 1) * 7, width: bw, height: 5 }, { cls: "late-sq", delay: rv(4) + i * 8, dur: 200 })); });
    out.push(mkMark("labels", "lly", "text", { x: x0 - 8, y: lB - 2, opacity: 1 }, { cls: "t-tick t-band", txt: MD.days.some(x => x.late_closed > 0) ? "Closed late" : "", delay: rv(4) }));
    return out;
  }

  // ---------------------------------------------------------------- text: one compact legend, and the "how to read this" popover
  // each legend entry says, on hover, what the mark measures (owner 7 Nov: planned vs needed vs range were unclear)
  const LTIP = {
    "Crews on plan": "Bar height: the crews the 2025 plan has on staff that month",
    "Crews needed": "The forecast of 2025 requests, divided by what one crew closes in a month",
    "Likely need": "Where the crews needed will probably fall, given how far the forecast was off on 2024",
    "Spare": "Crews on the plan beyond the need: the pale top of a bar, capped by a blue line",
    "Short": "Crews needed that the plan does not have",
    "Behind, not late": "Fewer crews than needed, but the work still closes inside its deadline",
    "Training": "Crews hired but still in paid training, not yet closing requests",
    "Requests in": "311 requests forecast to arrive each day (bars up)",
    "Requests closed": "Requests the crews close each day (bars down)",
    "Requests waiting": "Requests open at the end of each day",
    "Overdue": "The part of the waiting pile already past its deadline",
    "Closed late": "Requests closed after their deadline that day",
  };
  const sw = (cls, t) => { const tip = LTIP[t] || (/^Crews (working|idle)/.test(t) ? (t.startsWith("Crews working") ? "Crews busy closing requests that day" : "Crews on staff with nothing to close that day") : ""); return `<span${tip ? ` title="${tip}"` : ""}><i class="${cls}"></i>${t}</span>`; };
  // ---------------------------------------------------------------- Show: which marks the screen draws (owner 6 Nov). All on by default;
  // untick one to declutter. A class on #stage hides it (index.html); the legend greys the same key. Kept for the visit.
  const SHOWL = {
    0: [["planned", "Crews on plan"], ["need", "Crews needed"], ["band", "Likely need"], ["spare", "Spare"], ["short", "Short"], ["grace", "Behind, not late"], ["roost", "Roost marks: predators, flyway"]],
    1: [["planned", "Crews on plan"], ["need", "Crews needed"], ["band", "Likely need"], ["spare", "Spare"], ["short", "Short"], ["grace", "Behind, not late"], ["hire", "Crews added (+N)"], ["train", "Training"], ["roost", "Roost marks: predators, Dusk, flyway"]],
    2: [["arr", "Requests in"], ["clo", "Requests closed"], ["wait", "Requests waiting"], ["crews", "Crews working and idle"], ["train", "Training"], ["late", "Closed late"]] };
  // each item carries the mark's own swatch, so the menu is also the full key when the legend has no room for one
  const SWK = { planned: '<i class="lg-have"></i>', need: '<i class="lg-line"></i>', band: '<i class="lg-band"></i>', spare: '<i class="lg-spare"></i>', short: '<i class="lg-short"></i>',
    grace: '<i class="lg-grace"></i>', hire: '<svg class="i" style="color:var(--hire)" aria-hidden="true"><use href="#i-hire"/></svg>', train: '<i class="lg-train"></i>',
    roost: '<svg class="i" style="color:var(--pred)" aria-hidden="true"><use href="#i-owl"/></svg>', arr: '<i class="lg-arr"></i>', clo: '<i class="lg-have"></i>',
    wait: '<i class="lg-wait"></i>', crews: '<i class="lg-work"></i>', late: '<i class="lg-late"></i>' };
  const LKEYS = [...new Set(Object.values(SHOWL).flat().map(x => x[0]))];
  let hiddenL = new Set(); try { hiddenL = new Set(JSON.parse(sessionStorage.getItem("terry.layers") || "[]").filter(k => LKEYS.includes(k))); } catch (e) {}
  function applyLayers() { const st = $("#stage"); if (!st) return; for (const k of LKEYS) st.classList.toggle("hide-" + k, hiddenL.has(k)); }
  function layersHtml() {
    const L = (SHOWL[S.lvl] || []).filter(([k]) => k !== "roost" || GV), off = L.filter(([k]) => hiddenL.has(k)).length;
    return `<div class="lyr"><button type="button" class="lyr-b" aria-expanded="false" aria-controls="lyr-m" aria-haspopup="true">Show<span class="lyr-n">${off ? `${L.length - off} of ${L.length}` : "all"}</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` +
      `<div class="lyr-m" id="lyr-m" role="group" aria-label="Marks on the screen" hidden>${L.map(([k, t]) => `<label><input type="checkbox" data-k="${k}"${hiddenL.has(k) ? "" : " checked"}>${SWK[k] || ""}<span>${t}</span></label>`).join("")}` +
      `<button type="button" class="lyr-all"${off ? "" : " disabled"}>Show all</button></div></div>`;
  }
  // the legend's swatches carry the same keys, so a hidden mark greys its key
  const LGK = { "lg-have": l => (l === 2 ? "clo" : "planned"), "lg-line": () => "need", "lg-band": () => "band", "lg-spare": () => "spare", "lg-short": () => "short", "lg-grace": () => "grace",
    "lg-train": () => "train", "lg-arr": () => "arr", "lg-wait": () => "wait", "lg-past": () => "wait", "lg-work": () => "crews", "lg-hollow": () => "crews", "lg-late": () => "late" };
  function keyLegend(lg) {
    lg.querySelectorAll(":scope > span").forEach(sp => { const i = sp.querySelector("i"), u = sp.querySelector("use");
      let k = null; if (i) { const c = [...i.classList].find(x => LGK[x]); if (c) k = LGK[c](S.lvl); }
      else if (u) { const h = (u.getAttribute("href") || "").replace("#i-", ""); k = h === "hire" ? "hire" : h === "owl" || h === "dusk" ? "roost" : null; }
      if (k) sp.dataset.k = k; });
  }
  function fillLegend(lg, html) { lg.innerHTML = layersHtml() + html; keyLegend(lg); applyLayers(); }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".lyr-b"), m = document.querySelector("#lyr-m");
    if (b) { const open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(open)); if (m) m.hidden = !open; if (open && m) { const f = m.querySelector("input"); if (f) f.focus(); } return; }
    if (e.target.closest && e.target.closest(".lyr-all")) { hiddenL.clear(); saveLayers(); return; }
    if (m && !m.hidden && !(e.target.closest && e.target.closest(".lyr"))) closeLayers();
  });
  document.addEventListener("change", e => { const c = e.target; if (!c || !c.matches || !c.matches(".lyr-m input[data-k]")) return; if (c.checked) hiddenL.delete(c.dataset.k); else hiddenL.add(c.dataset.k); saveLayers(true); });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; const m = document.querySelector("#lyr-m"); if (m && !m.hidden) { e.stopPropagation(); closeLayers(true); } }, true);
  function closeLayers(focus) { const m = document.querySelector("#lyr-m"), b = document.querySelector(".lyr-b"); if (m) m.hidden = true; if (b) { b.setAttribute("aria-expanded", "false"); if (focus) b.focus(); } }
  function saveLayers(keepOpen) {
    try { sessionStorage.setItem("terry.layers", JSON.stringify([...hiddenL])); } catch (e) {}
    applyLayers(); const lg = $("#legend"); if (!lg) return;
    const was = !keepOpen ? false : !(document.querySelector("#lyr-m") || {}).hidden, foc = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
    const T = levelText(); fillLegend(lg, T.legend);
    if (was) { const m = document.querySelector("#lyr-m"), b = document.querySelector(".lyr-b"); if (m) m.hidden = false; if (b) b.setAttribute("aria-expanded", "true"); const f = foc && m && m.querySelector(`input[data-k="${foc}"]`); if (f) f.focus(); }
    const L = (SHOWL[S.lvl] || []).filter(([k]) => k !== "roost" || GV), on = L.filter(([k]) => !hiddenL.has(k)).map(x => x[1]);
    const lv = document.querySelector("#live"); if (lv) lv.textContent = on.length === L.length ? "Showing everything." : `Showing ${on.length ? on.join(", ") : "nothing"}.`;
  }
  const swi = (name, color, t) => `<span><svg class="i" style="color:${color}" aria-hidden="true"><use href="#i-${name}"/></svg>${t}</span>`;
  const cmpOn = () => !!(window.TerryState && window.TerryState.compare);
  const FCB = () => { try { return !!(Z && Z.forecast && Z.forecast().ready); } catch (e) { return false; } };
  const pc = v => `${Math.round(v * 100)}%`;
  function fcLine(d) {   // the one quiet line under the title: how far off the forecast was when tested on 2024
    const F = Z.forecast(); if (!F.ready) return null;
    if (d) return `Forecast tested on ${F.tested_on}: off by ${pc(F.depts[d].mape)} a month on average`;
    return `Forecast tested on ${F.tested_on}: off by ${pc(F.mape_min)} to ${pc(F.mape_max)} a month, by department`;
  }
  function fcShort(d) {   // the same line for a narrow bar; the full line moves into the explanation
    const F = Z.forecast(); return d ? `Tested on ${F.tested_on}: off ${pc(F.depts[d].mape)} a month` : `Tested on ${F.tested_on}: off ${pc(F.mape_min)} to ${pc(F.mape_max)} a month`;
  }
  function fcTiny(d) { const F = Z.forecast(); return d ? `Forecast off ${pc(F.depts[d].mape)}` : `Forecast off ${pc(F.mape_min)} to ${pc(F.mape_max)}`; }
  function fitFc() {   // never an ellipsis: the full line when it fits, else the short one (screen readers keep the full line)
    const w = $("#fcwrap"), a = $("#fcacc"), tip = $("#fctip"); if (!w || w.hidden || !a || !a.dataset.full) return;
    const full = a.dataset.full, why = a.dataset.why || ""; a.textContent = full; tip.textContent = why;
    if (a.scrollWidth > a.clientWidth + 1) { a.innerHTML = `<span aria-hidden="true">${esc2(a.dataset.short)}</span><span class="sr">${esc2(full)}</span>`; tip.textContent = `${full}. ${why}`; }
    // narrower still (about 1000 px): the bare figure; the hover note keeps the whole sentence (never an ellipsis)
    if (a.dataset.tiny && a.scrollWidth > a.clientWidth + 1) a.innerHTML = `<span aria-hidden="true">${esc2(a.dataset.tiny)}</span><span class="sr">${esc2(full)}</span>`;
  }
  function fcWhy(d) {
    const F = Z.forecast(), om = F.others.map(o => o.mean_mape).filter(v => typeof v === "number"), x = d && F.depts[d], bb = x && x.beaten_by[0];
    return `The forecast is ${F.chosen_words}, chosen because it beat ${WORDS[F.others.length] || F.others.length} other methods on ${F.tested_on}` + (om.length ? ` (off by ${pc(F.chosen_mean_mape)} a month across the four departments, against ${pc(Math.min(...om))} to ${pc(Math.max(...om))}).` : ".")
      + (bb ? ` For ${x.name} alone, ${bb.words} did a little better (${pc(bb.mape)}); one method for all four is simpler to check.` : "")
      + ` The shaded band is the likely range: the forecast plus or minus ${d ? "that error" : "each department's error"}.`;
  }
  function fcInfo(d) {
    if (!FCB()) return ""; const F = Z.forecast(), n = d ? F.depts[d].above_plus20 : F.above_plus20, tot = d ? 12 : F.months_total;
    const p20 = n > tot / 2 ? ` The ledger's +20% demand test sits above the likely range in ${n === tot ? (d ? "all 12 months" : `all ${tot} department months`) : `${n} of ${tot} ${d ? "months" : "department months"}`}, so it is a stress test, not a likely year.` : "";
    return `<p><b>Forecast.</b> ${esc2(fcWhy(d))}${p20}</p>`;
  }
  function placeFc() {
    const w = $("#fcwrap"); if (!w) return; const t = S.lvl < 2 && FCB() ? fcLine(S.lvl === 1 ? S.d : null) : null;
    w.hidden = !t; if (!t) return; const a = $("#fcacc"), dd = S.lvl === 1 ? S.d : null; a.dataset.full = t; a.dataset.short = fcShort(dd); a.dataset.tiny = fcTiny(dd); a.dataset.why = fcWhy(dd); fitFc();
  }
  function levelText() {
    if (S.lvl === 0) {
      const all = DEPTS.flatMap(d => info[d].months), has = k => all.some(m => kindOf(m) === k);
      const parts = [sw("lg-have", "Crews on plan"), sw("lg-line", "Crews needed")].concat(FCB() ? [sw("lg-band", "Likely need")] : []);
      if (has("spare")) parts.push(sw("lg-spare", "Spare")); if (has("short")) parts.push(sw("lg-short", "Short")); if (has("grace")) parts.push(sw("lg-grace", "Behind, not late"));
      if (GV) parts.push(swi("owl", "var(--pred)", "Predator months"));
      return { sr: "Do we have enough crews?", legend: parts.join("") + `<span class="r">Click a department to open its year</span>`,
        info: `<p>Everything here is counted in <b>crews</b>. A <b>bar</b> is the crews the plan has on staff that month. The <b>black line</b> is the crews needed: the forecast of 2025 requests divided by what one crew closes in a month.${FCB() ? " The <b>shaded band</b> is where that need will likely fall." : ""} Each row has its own scale.</p><p>The pale cap on a bar is spare crews. <b>Red</b> is short. <b>Hatched ochre</b> means behind but not late.</p><p>Click a row to open its year, or use + to zoom in. Click a dot to see why that many crews are needed.</p>` + fcInfo(null) };
    }
    const d = S.d, I = info[d], ms = I.months;
    if (S.lvl === 1) {
      const n = k => ms.filter(m => kindOf(m) === k).length, sp = n("spare"), sh = n("short"), gr = n("grace"), hh = hires(d), tot = hh.reduce((a, x) => a + x.crews, 0), cmp = cmpOn();
      const list = [];
      if (cmp) list.push(`<span>A solid, B outlined</span>`);
      list.push(sw("lg-have", "Crews on plan"), sw("lg-line", "Crews needed")); if (FCB()) list.push(sw("lg-band", "Likely need"));
      let spare = sp ? sw("lg-spare", "Spare") : "", dusk = GV && GV.dusk ? swi("dusk", "var(--dusk)", `Dusk, ${fmtDate(GV.dusk.date)}`) : "";
      const rest = [sh ? sw("lg-short", "Short") : "", gr ? sw("lg-grace", "Behind, not late") : "", !cmp && (hh.length || (GV && newHires(d).length)) ? swi("hire", "var(--hire)", "Crew added") : "", !cmp && I.training.length ? sw("lg-train", "Training") : "", GV ? swi("owl", "var(--pred)", "Predator month") : ""].filter(Boolean);
      let count = list.length + rest.length + (spare ? 1 : 0) + (dusk ? 1 : 0), duskMoved = false;
      if (count > 7 && spare) { spare = ""; count--; } if (count > 7 && dusk) { dusk = ""; duskMoved = true; }
      const lg = list.join("") + spare + rest.join("") + dusk;
      return { sr: `${I.name}, 2025`, legend: lg,
        info: `<p><b>${I.name}.</b> Spare in ${sp} month${sp === 1 ? "" : "s"}, short in ${sh}${I.long_due ? `, behind but not late in ${gr}` : ""}. ${tot ? `The plan signs <b>${tot} crews</b> on ${hh.length} date${hh.length === 1 ? "" : "s"}.` : "No hiring is planned."}</p><p>Counted in crews. A bar is the crews the plan has on staff that month. The black line is the crews needed: the forecast of requests for that month divided by what one crew closes in a month.${FCB() ? " The shaded band is the likely range of that need." : ""} A <b>+N</b> marker is a hire: N crews who start working that month. Hatched blue is a crew in paid training.${GV && GV.dusk ? ` The dashed ink tick is Dusk (${fmtDate(GV.dusk.date)}), the last day to act.` : ""}</p><p>Click a month to open it, or use + to zoom in.</p>` + fcInfo(d) };
    }
    const MD = monthData(d, S.m), f = MD.days[0], l = MD.days[MD.days.length - 1], dn = x => Number(x.date.slice(8)), blk = G.z2block || 1;
    return { sr: `${I.name}, ${MON[S.m]} 2025`, legend: sw("lg-arr", "Requests in") + sw("lg-have", "Requests closed") + sw("lg-wait", "Requests waiting") + (MD.days.some(x => x.past_due > 0.5) ? sw("lg-past", "Overdue") : "") + sw("lg-work", `Crews working${blk > 1 ? `, 1 box = ${blk} crews` : ""}`) + sw("lg-hollow", "Crews idle") + (I.training.some(t => t.month === S.m) ? sw("lg-train", "Training") : "") + (MD.days.some(x => x.late_closed > 0) ? sw("lg-late", "Closed late") : ""),
      info: `<p><b>${I.name}, ${MON[S.m]}.</b> From ${dn(f)} to ${dn(l)} ${MON[S.m]}, <b>${fmt(MD.requests)}</b> requests are forecast and <b>${fmt(MD.closed)}</b> close. ${fmt(MD.late)} closed late. The month ended with <b>${fmt(MD.backlog_end)}</b> waiting.</p><p>Top band: forecast requests (up) and closed (down) each day, spread over the days like 2024's. Middle band: the waiting pile${MD.days.some(x => x.past_due > 0.5) ? ", with the past due part in red" : ""}. Lower band: crews, solid when working and hollow when idle${blk > 1 ? `, one block is ${blk} crews` : ""}. ${fmt(MD.idle_crew_days)} idle crew days. Red squares are requests closed late. Shaded days are weekends.</p>` };
  }
  document.addEventListener("click", e => { const b = e.target.closest("#infopop .pops button"); if (!b) return; if (b.dataset.act === "table") $("#tablebtn").click(); else { const r = $("#replaybtn"); if (r) r.click(); } infoPop.hidden = true; });
  function refreshLegend() { if (!data || !G) return; const T = levelText(); fillLegend($("#legend"), T.legend); }
  ["compare:open", "compare:close"].forEach(ev => { try { window.TerryBus.on(ev, () => { if (G && S.lvl === 1) relayout(0); }); } catch (e) {} });
  ["compare:open", "compare:close", "plan:view", "roost:activated", "screen:draw"].forEach(ev => { try { window.TerryBus.on(ev, refreshLegend); } catch (e) {} });
  function placeText() {
    const T = levelText(), lg = $("#legend");
    fillLegend(lg, T.legend); placeFc(); $("#sr-h1").textContent = T.sr; $("#infopop").innerHTML = `<p><b>Bat-Terry</b> plans Boston's 311 crews from 2024 requests.</p>` + T.info + `<p class="pops"><button type="button" data-act="table">Show as table</button>${S.lvl < 2 && GV ? `<button type="button" data-act="replay">Replay the plan</button>` : ""}</p>`;
    G.H = G.hOf(S.lvl); stage.style.height = G.H + "px"; G.curLegendY = G.legY(S.lvl); lg.style.top = G.curLegendY + "px"; lg.style.display = ""; lg.classList.remove("tight");
    if (G.F && S.lvl < 2 && G.legOK(S.lvl) && G.curLegendY + lg.offsetHeight > G.F - 4) lg.classList.add("tight");   // too tall: drop the hint and close up, so the key stays on one line
    lg.classList.remove("keys-off");
    if (G.F && S.lvl < 2 && G.legOK(S.lvl) && G.curLegendY + lg.offsetHeight > G.F - 4) lg.classList.add("keys-off");   // still too tall: keep the Show menu, drop the keys (Show names every mark)
    if (G.F && S.lvl < 2 && (!G.legOK(S.lvl) || G.curLegendY + lg.offsetHeight > G.F - 4)) lg.style.display = "none";   // the legend shows only when all of it fits inside the cloth
    $("#tablewrap").style.top = G.top - 20 + "px";
  }

  // ---------------------------------------------------------------- breadcrumb
  let roostLabel = null;   // "Roost 2": the screen title reads "Boston 2025 > Transportation . Roost 2"
  function setRoostLabel(l) { roostLabel = l || null; if (data && G) renderCrumbs(false); }
  const bus = (e, pl) => { try { if (window.TerryBus) window.TerryBus.emit(e, pl); } catch (err) {} };
  function crumbList() {
    const c = [{ t: "Boston 2025", to: { lvl: 0 } }];
    if (S.lvl >= 1) c.push({ t: info[S.d].name + (roostLabel ? " \u00b7 " + roostLabel : ""), to: { lvl: 1, d: S.d, m: S.m } });
    if (S.lvl >= 2) c.push({ t: MON[S.m], to: { lvl: 2, d: S.d, m: S.m } });
    return c;
  }
  function renderCrumbs(pulse) {
    const box = $("#crumbs"), list = crumbList(); box.textContent = "";
    list.forEach((c, i) => {
      const last = i === list.length - 1; if (i > 0) sep(box);
      if (last) { const s = document.createElement("span"); s.className = "cur"; s.textContent = c.t; s.setAttribute("aria-current", "page"); box.appendChild(s); }
      else { const b = document.createElement("button"); b.type = "button"; b.textContent = c.t; b.onclick = () => goTo(c.to); box.appendChild(b); }
    });
    if (S.lvl === 0) { const s = document.createElement("span"); s.className = "sub"; s.textContent = "Crews planned vs needed, by month"; box.appendChild(s); }
    document.documentElement.dataset.lvl = S.lvl; $("#zout").hidden = true; $("#zout").querySelector("span").textContent = S.lvl === 2 ? "Back" : "Back to Boston"; $("#zout").setAttribute("aria-label", S.lvl === 2 ? "Back to " + info[S.d].name : "Back to Boston");
    syncZoom();
  }
  // ---- the zoom capsule: one step in or out at the current focus
  const capStep = dir => {
    if (dir > 0) { if (S.lvl === 0) { const d = GV && GV.depts && GV.depts.length ? GV.depts[0] : tightAll().d; return { lvl: 1, d, m: tightest(d) }; }
      if (S.lvl === 1) { const ms = GV && GV.goal && GV.goal.months && GV.goal.months.length ? Math.min(...GV.goal.months) - 1 : tightest(S.d); return { lvl: 2, d: S.d, m: ms }; } return null; }
    if (S.lvl === 2) return { lvl: 1, d: S.d, m: S.m }; if (S.lvl === 1) return { lvl: 0 }; return null;
  };
  function syncZoom() {
    const zi = $("#zoomplus"), zo = $("#zoomminus"); if (!zi || !zo) return; const up = capStep(1), dn = capStep(-1);
    zi.disabled = !up; zo.disabled = !dn; zi.title = up ? (up.lvl === 1 ? "Zoom in to " + info[up.d].name : "Zoom in to " + MON[up.m]) : "Closest view"; zi.setAttribute("aria-label", zi.title);
    zo.title = dn ? (dn.lvl === 0 ? "Zoom out to Boston" : "Zoom out to " + info[S.d].name) : "Whole city"; zo.setAttribute("aria-label", zo.title);
  }
  document.addEventListener("click", e => { const b = e.target.closest("#zoomplus, #zoomminus"); if (!b || b.disabled) return; const t = capStep(b.id === "zoomplus" ? 1 : -1); if (t) goTo(t); });
  function sep(box) { const s = document.createElement("span"); s.className = "sep"; s.setAttribute("aria-hidden", "true"); s.textContent = "›"; box.appendChild(s); }

  // ---------------------------------------------------------------- Terry
  let tq = Promise.resolve(), terryAt = { x: 0, y: 56 };
  const perchScale = () => (G.phone ? 0.34 : 0.42);
  function perchPos() {
    const box = $("#crumbs"), last = box.lastElementChild, sr = stage.getBoundingClientRect();
    let x = 70; if (last) { const r = last.getBoundingClientRect(); x = r.left - sr.left + r.width / 2; }
    const bar = $("#bar"); return { x: clamp(x, G.phone ? 36 : 70, G.W - (G.phone ? 140 : 160)), y: bar.offsetTop + bar.offsetHeight };
  }
  function relocateTerry() { const p = perchPos(); terryAt = p; bat.setBranch(p.x, p.y); bat.setScale(perchScale()); if (bat.mode() === "hang" || reduced()) bat.hangNow(); }
  function terryMove(p, snap) {
    terryAt = p;
    tq = tq.then(async () => {
      if (reduced() || snap) { bat.setBranch(p.x, p.y); bat.setScale(perchScale()); bat.hangNow(); return; }
      bat.setSpeed(2.2);
      bat.setHome(p.x + 26, p.y + 78);
      let guard = 0; while (bat.busy() && guard++ < 200) await sleep(30);
      if (bat.mode() === "hang") await bumpScale(bat.flip(), 1.0);
      bat.setBranch(p.x, p.y);
      guard = 0; while (bat.busy() && guard++ < 200) await sleep(30);
      await bumpScale(bat.flip(), 0.8);
      bat.setScale(perchScale()); bat.setSpeed(1);
    }).catch(() => {});
    return tq;
  }
  function bumpScale(promise, peak) {
    const base = perchScale(), t0 = performance.now();
    let on = true; promise.then(() => (on = false));
    return new Promise(res => { (function f() { if (!on) { res(); return; } const u = clamp((performance.now() - t0) / 1500, 0, 1); bat.setScale(base + (peak - base) * Math.sin(Math.PI * u)); requestAnimationFrame(f); })(); });
  }

  // ---------------------------------------------------------------- bubbles (Terry's voice)
  const liveEl = $("#live"), bubEl = $("#bubbles");
  let bubbles = [], bubIdx = 0;
  function clearBubbles() { for (const b of bubEl.querySelectorAll(".say")) b.remove(); const l = $("#leaders"); if (l) l.remove(); bubbles = []; }
  function say(text, x, y, opt) {
    const b = document.createElement("div"); b.className = "say " + (opt && opt.tail || "tail-l"); b.textContent = text; b.style.left = x + "px"; b.style.top = y + "px"; bubEl.appendChild(b); return b;
  }
  function z1Bubbles(d) {
    const I = info[d], gaps = I.months.map(gapC), out = [];
    let hi = 0; gaps.forEach((g, i) => { if (g > gaps[hi]) hi = i; });
    if (gaps[hi] >= 2 && kindOf(I.months[hi]) === "spare") out.push({ m: hi, text: "Plenty of crews here. Fine." });
    const neg = I.months.findIndex(mo => kindOf(mo) !== "spare");
    if (neg >= 0) out.push({ m: neg, text: kindOf(I.months[neg]) === "grace" ? "Behind here, but not late." : `Short by ${-gaps[neg]} here. I would watch it.` });
    else { let lo = -1; gaps.forEach((g, i) => { if (i !== hi && (lo < 0 || g < gaps[lo])) lo = i; }); if (lo >= 0) out.push({ m: lo, text: `This is the tight month. ${gaps[lo]} crew${gaps[lo] === 1 ? "" : "s"} of slack.` }); }
    const hs = hires(d); if (hs.length) { const big = hs.reduce((a, b) => (b.crews > a.crews ? b : a)), sm = signMonth(big);
      out.push({ m: big.month, text: `I would sign these ${WORDS[big.crews] || big.crews} before the end of ${MON[sm < 0 ? 11 : sm]}.` }); }
    return out.slice(0, 3);
  }
  let bubT = 0;
  function showBubbles() { clearBubbles(); }
  function hideBubblesQuiet() { for (const b of bubEl.querySelectorAll(".say")) b.classList.add("out"); }

  // ---------------------------------------------------------------- tooltips
  const tip = $("#tip");
  function tipRow(color, shape, label, val) { return `<div class="r"><i style="background:${shape === "line" ? "transparent" : color};${shape === "line" ? `border-top:3px solid ${color}` : shape === "dot" ? "border-radius:50%" : ""}"></i><span>${label}</span><b style="margin-left:auto">${val}</b></div>`; }
  const esc2 = t => String(t).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  function predAt(d, m) { if (!GV) return ""; const o = GV.owls.find(x => (!x.dept || x.dept === d) && x.months.includes(m + 1)); return o ? o.name : ""; }
  function gapText(mo) { const g = gapC(mo), k = kindOf(mo); const t = k === "spare" ? (g ? `Spare ${g}` : "On target") : k === "grace" ? `Behind ${-g}, not late` : `Short ${-g}`; return k === "spare" && mo.state === "late" ? `${t}. Late on spike days.` : t; }
  function monthTip(d, m) {
    const mo = info[d].months[m], k = kindOf(mo), col = k === "spare" ? "#B4BFCB" : k === "grace" ? "#D7AE4A" : "#F0826A", pr = predAt(d, m);
    return `<h4>${MON[m]}</h4>` + tipRow("#fff", "dot", "Crews needed", `${needC(mo)} crews`) + (FCB() && Z.forecast().depts[d].lo_ratio ? `<div class="r" style="opacity:.85"><span>Likely ${Math.round(mo.need * Z.forecast().depts[d].lo_ratio[m])} to ${Math.round(mo.need * Z.forecast().depts[d].hi_ratio[m])} crews</span></div>` : "") + tipRow("#8A98A8", "sq", "Planned", `${mo.have} crews`) + `<div class="r" style="color:${col}"><span><b>${gapText(mo)}</b></span></div>` + (pr ? `<div class="r" style="color:#CDA98B;white-space:normal;margin-top:4px"><span>Predator: ${esc2(pr)}</span></div>` : "");
  }
  function showTip(html, x, y, pin) {
    tip.innerHTML = html; tip.hidden = false; tip.classList.toggle("pin", !!pin);
    const w = tip.offsetWidth, h = tip.offsetHeight; let tx = x + 14, ty = y + 14;
    if (tx + w > G.W) tx = x - w - 14; if (tx < 0) tx = Math.max(0, G.W - w); if (ty + h > G.H) ty = y - h - 14; if (ty < 0) ty = 4;
    tip.style.left = tx + "px"; tip.style.top = ty + "px";
  }
  function hideTip() { tip.hidden = true; tip.classList.remove("pin"); pinned = null; }
  let pinned = null;

  // ---------------------------------------------------------------- hits, focus, interaction
  function clearHits() { hitsG.textContent = ""; }
  const rel = ev => { const r = stage.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  let hover = { d: null, m: null };
  function roving(rects) {
    rects.forEach((r, i) => r.setAttribute("tabindex", i === 0 ? "0" : "-1"));
    rects.forEach((r, i) => r.addEventListener("keydown", e => {
      let j = null; if (e.key === "ArrowRight") j = Math.min(rects.length - 1, i + 1); else if (e.key === "ArrowLeft") j = Math.max(0, i - 1); else if (e.key === "Home") j = 0; else if (e.key === "End") j = rects.length - 1;
      if (j !== null) { e.preventDefault(); rects[i].setAttribute("tabindex", "-1"); rects[j].setAttribute("tabindex", "0"); rects[j].focus(); }
    }));
  }
  function buildHits() {
    clearHits(); if (busy || !G) return;
    if (S.lvl === 0) {
      const rows = [];
      DEPTS.forEach((d, i) => {
        const I = info[d], T = rowT(i), nd = I.months.map(needC), hv = I.months.map(m => m.have), sh = I.months.filter(m => kindOf(m) === "short").length, gr = I.months.filter(m => kindOf(m) === "grace").length;
        const r = el("rect", { class: "hit row", x: 0, y: T, width: G.x1, height: hitH(), tabindex: 0, role: "button",
          "aria-label": `${I.name}, 2025. Needed ${Math.min(...nd)} to ${Math.max(...nd)} crews. Planned ${Math.min(...hv)} to ${Math.max(...hv)}. Short in ${sh} months${gr ? `, behind but not late in ${gr}` : ""}. Enter to look closer, arrow keys to pick a month, W to ask why.` }, hitsG);
        let cur = 0;
        const dotNear = (x, y) => { const m = clamp(Math.floor((x - G.x0) / G.mw), 0, 11); const dy = rowB(i) - I.months[m].need * s0(d); return Math.abs(x - colC(m)) <= (G.phone ? 12 : 14) && Math.abs(y - dy) <= 14 ? m : -1; };
        r.addEventListener("pointermove", e => { const p = rel(e); if (p.x < G.x0 || p.x > G.x1) { hideTip(); return; } hover = { d, m: clamp(Math.floor((p.x - G.x0) / G.mw), 0, 11) }; sceneFromChart(d, hover.m); if (e.pointerType !== "touch") showTip(monthTip(d, hover.m), p.x, p.y); r.style.cursor = dotNear(p.x, p.y) >= 0 ? "help" : "pointer"; });
        r.addEventListener("pointerleave", () => { if (!pinned) hideTip(); });
        r.addEventListener("click", e => { const p = rel(e); if (e.detail === 0) return; firstTouchNow(); const m = dotNear(p.x, p.y);
          if (m >= 0) { openWhy({ type: "demand", d, m }); return; }
          const mm = p.x >= G.x0 ? clamp(Math.floor((p.x - G.x0) / G.mw), 0, 11) : 0; goTo({ lvl: 1, d, m: mm }); });
        r.addEventListener("focus", () => { hover = { d, m: cur }; sceneFromChart(d, cur); const x = colC(cur); showTip(monthTip(d, cur), x, rowT(i) + 20); });
        r.addEventListener("blur", () => hideTip());
        r.addEventListener("keydown", e => {
          if (e.key === "ArrowRight") { cur = Math.min(11, cur + 1); e.preventDefault(); } else if (e.key === "ArrowLeft") { cur = Math.max(0, cur - 1); e.preventDefault(); }
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); firstTouchNow(); if (e.key === " ") openWhy({ type: "demand", d, m: cur }); else goTo({ lvl: 1, d, m: cur }); return; }
          else if (e.key.toLowerCase() === "w") { openWhy({ type: "demand", d, m: cur }); return; } else return;
          hover = { d, m: cur }; sceneFromChart(d, cur); showTip(monthTip(d, cur), colC(cur), rowT(i) + 20);
        });
        rows.push(r);
      });
    } else if (S.lvl === 1) {
      const d = S.d, z = G.z1, cols = [];
      for (let m = 0; m < 12; m++) {
        const mo = info[d].months[m];
        const r = el("rect", { class: "hit col", x: colX(m), y: z.plotT - 4, width: G.mw, height: z.plotH + 8, role: "button", "aria-label": `${MON[m]}. Needed ${needC(mo)} crews. Planned ${mo.have}. ${gapText(mo)}. Left and Right move by a working day, Enter zooms in on that day, D for details, W to ask why.` }, hitsG);
        const dy = z.base - mo.need * s1(d);
        const pin = () => { pinned = m; const cx = colC(m); showTip(monthTip(d, m) + `<div class="btns"><button type="button" data-a="zoom">Zoom into ${MON[m]}</button><button type="button" class="ghost" data-a="why">Why ${needC(mo)} crews?</button></div>`, cx, z.plotT + 20, true);
          tip.querySelector('[data-a="zoom"]').onclick = () => goTo({ lvl: 2, d, m }); tip.querySelector('[data-a="why"]').onclick = () => openWhy({ type: "demand", d, m }); };
        const nearDot = p => Math.abs(p.y - dy) < 16 && Math.abs(p.x - colC(m)) < 20;
        r.addEventListener("pointermove", e => { const p = rel(e); hover = { d, m }; if (!pinned && e.pointerType !== "touch") showTip(monthTip(d, m), p.x, p.y); const dot = nearDot(p); r.style.cursor = dot ? "help" : "pointer"; drawDayLine(dot ? null : yearDayAt(p.x)); });
        r.addEventListener("pointerleave", () => { if (pinned === null) hideTip(); if (document.activeElement !== r) drawDayLine(null); });
        r.addEventListener("click", e => { if (e.detail === 0) return; firstTouchNow(); const p = rel(e); if (nearDot(p)) { openWhy({ type: "demand", d, m }); return; } pickDay(d, yearDayAt(p.x)); });
        const keyDay = () => (DL.t != null && mOfDay(DL.t) === m ? DL.t : workDay(yDay(m, 15)) ? yDay(m, 15) : stepWork(yDay(m, 15), 1));
        r.addEventListener("focus", () => { hover = { d, m }; drawDayLine(keyDay()); if (!pinned) showTip(monthTip(d, m), colC(m), z.plotT + 20); });
        r.addEventListener("blur", () => { if (!pinned) hideTip(); drawDayLine(null); });
        r.addEventListener("keydown", e => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const t = stepWork(keyDay(), e.key === "ArrowRight" ? 1 : -1), j = mOfDay(t); if (j !== m && cols[j]) { cols[m].setAttribute("tabindex", "-1"); cols[j].setAttribute("tabindex", "0"); DL.t = t; cols[j].focus(); } drawDayLine(t); return; }
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickDay(d, keyDay()); } else if (e.key.toLowerCase() === "z") goTo({ lvl: 2, d, m }); else if (e.key.toLowerCase() === "w") openWhy({ type: "demand", d, m }); else if (e.key.toLowerCase() === "d") { e.preventDefault(); pin(); tip.querySelector("button").focus(); } });
        cols.push(r);
      }
      cols.forEach((c, i) => c.setAttribute("tabindex", i === 0 ? "0" : "-1"));
      hires(d).forEach((dec, id) => { const h = hireGeom(d, dec);
        const b = el("rect", { class: "hit", x: h.cx - h.w / 2 - 3, y: h.cy - h.h / 2 - 3, width: h.w + 6, height: h.h + 6, rx: 12, tabindex: 0, role: "button", "aria-label": `Hire: ${dec.crews} crews signed by ${fmtDate(dec.decide_by)}. Enter to ask why.` }, hitsG);
        b.addEventListener("pointerenter", e => { if (!pinned) showTip(hireTip(d, dec), h.cx + 18, h.cy + 8); }); b.addEventListener("pointerleave", () => { if (pinned === null) hideTip(); });
        b.addEventListener("focus", () => { if (!pinned) showTip(hireTip(d, dec), h.cx + 18, h.cy + 8); }); b.addEventListener("blur", () => { if (!pinned) hideTip(); });
        b.addEventListener("click", () => openWhy({ type: "hire", d, id })); b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWhy({ type: "hire", d, id }); } }); });
    } else {
      const d = S.d, m = S.m, z = G.z2, MD = monthData(d, m), n = MD.days.length, dw = (G.x1 - G.x0) / n, cols = [];
      MD.days.forEach((day, i) => {
        const txt = `${WD[day.weekday]} ${i + 1} ${MS[m]}. Forecast ${fmt(day.arrivals)}. Closed ${fmt(day.closed)}. Crews ${day.crews_on}, working ${fmt(day.crews_busy)}, idle ${fmt(day.crews_idle)}.`;
        const r = el("rect", { class: "hit col", x: G.x0 + dw * i, y: z.axisY - 14, width: dw, height: z.lT + z.lH - z.axisY + 14, role: "button", "aria-label": txt }, hitsG);
        const show = (x, y) => showTip(`<h4>${WD[day.weekday]} ${i + 1} ${MS[m]}</h4><div>Forecast ${fmt(day.arrivals)}</div><div>Closed ${fmt(day.closed)}</div><div>Crews ${day.crews_on}, working ${fmt(day.crews_busy)}, idle ${fmt(day.crews_idle)}</div>${day.late_closed >= 0.5 ? `<div style="color:var(--short)">Closed late ${fmt(day.late_closed)}</div>` : ""}`, x, y);
        r.addEventListener("pointermove", e => { const p = rel(e); if (e.pointerType !== "touch") show(p.x, p.y); });
        const pickCol = () => { if (scene && !busy) { scene.pause(); scene.setDay(yDay(m, i + 1) + 0.5); markSceneDay(); bus("screen:day", { day: yDay(m, i + 1) }); } };
        r.addEventListener("click", e => { const p = rel(e); show(p.x, p.y); pickCol(); });
        r.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickCol(); } });
        r.addEventListener("pointerleave", () => hideTip()); r.addEventListener("focus", () => show(G.x0 + dw * (i + 0.5), z.aT + 30)); r.addEventListener("blur", () => hideTip());
        cols.push(r);
      });
      roving(cols);
    }
  }
  function firstTouchNow() { if (!firstTouch) { firstTouch = true; hideBubblesQuiet(); } }
  document.addEventListener("click", e => { if (pinned !== null && !tip.contains(e.target) && !e.target.classList.contains("hit")) hideTip(); });
  tip.addEventListener("pointerdown", e => e.stopPropagation());

  // ---------------------------------------------------------------- the Why panel
  const why = { open: false, token: 0, el: null, returnFocus: null };
  const scrim = document.createElement("div"); scrim.id = "scrim"; scrim.hidden = true; stage.appendChild(scrim); scrim.onclick = () => closeWhy();
  function miniChart(v23, v24, av, fc) {
    const lo = Math.floor(Math.min(v23, v24, fc) / 500) * 500, hi = Math.ceil(Math.max(v23, v24, fc) / 500) * 500, H = 96, y = v => 24 + H - H * (v - lo) / (hi - lo);
    const xs = [34, 94, 154, 214];
    return `<svg viewBox="0 0 280 ${H + 66}" role="img" aria-label="2023 ${fmt(v23)}, 2024 ${fmt(v24)}, average ${fmt(av)}, forecast ${fmt(fc)} requests">
      <line x1="10" x2="270" y1="${y(lo)}" y2="${y(lo)}" stroke="#c9a98a" stroke-width="2"/>
      ${[[v23, "2023", "var(--ink2)"], [v24, "2024", "var(--ink2)"], [fc, "forecast", "var(--ink)"]].map(([v, t, c], i) => { const x = [34, 94, 214][i]; return `<line x1="${x}" x2="${x}" y1="${y(lo)}" y2="${y(v)}" stroke="${c}" stroke-width="${i === 2 ? 4 : 3}"/><circle cx="${x}" cy="${y(v)}" r="5" fill="${c}"/><text x="${x}" y="${y(v) - 10}" text-anchor="middle" fill="${c}" style="fill:${c};font-weight:700">${fmt(v)}</text><text x="${x}" y="${y(lo) + 16}" text-anchor="middle">${t}</text>`; }).join("")}
      <line x1="94" x2="214" y1="${y(av)}" y2="${y(av)}" stroke="var(--hire)" stroke-dasharray="4 3" stroke-width="1.5"/>
      <text x="154" y="${y(av) - 6}" text-anchor="middle" style="fill:var(--hire)">average ${fmt(av)}</text>
      <text x="270" y="${H + 62}" text-anchor="end" style="fill:var(--ink3)">Scale starts at ${fmt(lo)} requests</text></svg>`;
  }
  function panelBox() {
    const p = document.createElement("aside"); p.id = "why"; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "false");
    return p;
  }
  function placePanel(p, dotX, dotY) {
    const ph = G.phone; p.classList.toggle("sheet", ph);
    if (ph) { const h = Math.round(G.H * 0.52); p.style.left = "0"; p.style.right = "0"; p.style.width = "auto"; p.style.height = h + "px"; const low = dotY > G.H - h - 40; p.style.top = low ? "60px" : "auto"; p.style.bottom = low ? "auto" : "0"; }
    else { const left = dotX + Math.max(36, G.mw * 0.42) + 24 > G.W - 352; p.style.width = "352px"; p.style.top = "64px"; p.style.bottom = "0"; p.style.right = left ? "auto" : "0"; p.style.left = left ? "0" : "auto"; if (left) p.style.borderLeft = "0", p.style.borderRight = "1px solid rgba(185,156,122,.4)"; }
  }
  function openWhy(w) {
    if (busy) return; closeWhy(true); hideTip(); firstTouchNow(); clearBubblesFast();
    why.open = true; const token = ++why.token; why.returnFocus = document.activeElement;
    const p = panelBox(); why.el = p; stage.appendChild(p); scrim.hidden = false;
    let anchor = { x: 0, y: 0 };
    if (w.type === "demand") anchor = demandPanel(p, w, token); else anchor = hirePanel(p, w, token);
    placePanel(p, anchor.x, anchor.y);
    const xb = document.createElement("button"); xb.type = "button"; xb.className = "x"; xb.setAttribute("aria-label", "Close"); xb.innerHTML = "&times;"; xb.onclick = () => closeWhy(); p.prepend(xb);
    const gr = document.createElement("div"); gr.className = "grab"; p.prepend(gr);
    world.classList.add("dim"); xb.focus({ preventScroll: true });
  }
  function clearBubblesFast() { for (const b of bubEl.querySelectorAll(".say")) b.remove(); const l = $("#leaders"); if (l) l.style.opacity = 0; }
  function closeWhy(quick) {
    if (!why.open) return; why.open = false; why.token++;
    if (why.el) { why.el.remove(); why.el = null; } scrim.hidden = true; world.classList.remove("dim");
    const g = whyG; if (quick) g.textContent = ""; else { g.style.transition = "opacity .3s"; g.style.opacity = 0; setTimeout(() => { g.textContent = ""; g.style.opacity = 1; g.style.transition = ""; }, 320); }
    const l = $("#leaders"); if (l) l.style.opacity = 1;
    if (!quick && why.returnFocus && why.returnFocus.focus) { try { why.returnFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (!quick) showBubbles();
  }
  function demandPanel(p, w, token) {
    const { d, m } = w, DM = Z.demand(d), mo = info[d].months[m], pcm = DM.per_crew_month;
    const v23 = DM.y2023[m], v24 = DM.y2024[m], av = DM.average[m], fc = DM.forecast[m], n = needC(mo);
    p.innerHTML = `<h2>Why ${n} crews in ${MON[m]}?</h2><p class="cap">${info[d].name}, ${MON[m]}</p>
      <p>We looked at two ${MON[m]}s.</p>
      <div class="tbl"><span>2023</span><span>${fmt(v23)} requests</span><span>2024</span><span>${fmt(v24)} requests</span><span>Average</span><span>${fmt(av)}</span></div>
      <p>Scaled ${DM.factor >= 1 ? "up" : "down"} to 2024's level (<span class="bolt">x${DM.factor.toFixed(3)}</span>)</p>
      <div class="tbl"><span></span><span>${fmt(fc)} requests</span></div>
      <p>One crew closes ${fmt(pcm)} a month.<br>${fmt(fc)} / ${fmt(pcm)} = ${(fc / pcm).toFixed(1)}, so <span class="big">${n}</span> crews.</p>
      ${miniChart(v23, v24, av, fc)}
      <p>You plan <b>${mo.have}</b> in ${MON[m]}. ${gapText(mo)}.</p>
      <p class="foot">This is a forecast, not a promise.</p>`;
    const lvl = S.lvl, cx = colC(m), base = lvl === 0 ? rowB(DEPTS.indexOf(d)) : G.z1.base, sc = lvl === 0 ? s0(d) : s1(d), yOf = v => base - v / pcm * sc;
    liveEl.textContent = `Why ${n} crews in ${MON[m]}?`;
    runSplit({ token, d, m, cx, yOf, v23, v24, av, fc, factor: DM.factor, lvl });
    return { x: cx, y: yOf(fc) };
  }
  async function runSplit(c) {
    const g = whyG; g.textContent = ""; g.style.opacity = 1;
    const ph = G.phone, fan = Math.max(ph ? 16 : 36, G.mw * 0.42), ms = G.x0;
    const need = info[c.d].months.map(mo => mo.need), B = c.lvl === 0 ? rowB(DEPTS.indexOf(c.d)) : G.z1.base, sc = c.lvl === 0 ? s0(c.d) : s1(c.d);
    const seg = []; for (let k = Math.max(0, c.m - 1); k <= Math.min(11, c.m + 1); k++) seg.push(colC(k), B - need[k] * sc);
    el("polyline", { points: ptsStr(seg), class: "l-halo" }, g); el("polyline", { points: ptsStr(seg), class: "l-need" }, g);
    const main = el("circle", { cx: c.cx, cy: c.yOf(c.fc), r: ph ? 3.5 : 5, class: "dot" }, g);
    const mkG = (txt, anchor) => { const dot = el("circle", { cx: c.cx, cy: c.yOf(c.fc), r: ph ? 3.5 : 5, class: "ghost-dot", fill: "var(--ink2)", opacity: 0 }, g), t = el("text", { class: "t-ghost", x: c.cx, y: c.yOf(c.fc), opacity: 0 }, g); t.textContent = txt; return { dot, t }; };
    const a = mkG(ph ? fmt(c.v23) : `2023: ${fmt(c.v23)}`), b = mkG(ph ? fmt(c.v24) : `2024: ${fmt(c.v24)}`);
    const tick = el("line", { x1: ms - 8, x2: ms, y1: c.yOf(c.av), y2: c.yOf(c.av), stroke: "var(--hire)", "stroke-width": 2, opacity: 0 }, g);
    const guide = el("line", { x1: ms, x2: c.cx, y1: c.yOf(c.av), y2: c.yOf(c.av), stroke: "var(--hire)", "stroke-dasharray": "2 4", "stroke-width": 1, opacity: 0 }, g);
    const tl = el("text", { class: "t-ghost", x: c.cx, y: c.yOf(c.av) + 22, opacity: 0, style: "fill:var(--hire)" }, g); tl.textContent = `average ${fmt(c.av)}`;
    const fl = el("text", { class: "t-ghost", x: c.cx, y: c.yOf(c.fc) - 14, opacity: 0, style: "fill:var(--hire)" }, g); fl.textContent = ph ? `x${c.factor.toFixed(3)}` : `x${c.factor.toFixed(3)} = ${fmt(c.fc)}`;
    const pos = (o, x, y, side) => { o.dot.setAttribute("cx", x); o.dot.setAttribute("cy", y); o.t.setAttribute("x", x + side * 10); o.t.setAttribute("y", y + (side ? 4 : -10)); o.t.style.textAnchor = side > 0 ? "start" : side < 0 ? "end" : "middle"; };
    const T = (dur, fn, e) => new Promise(res => { const t0 = performance.now(); (function f(now) { if (c.token !== why.token) return res(false); const u = clamp((now - t0) / dur, 0, 1); fn((e || ease.camera)(u)); if (u < 1) requestAnimationFrame(f); else res(true); })(t0); });
    const ok = () => c.token === why.token;
    if (reduced()) {
      pos(a, c.cx - fan, c.yOf(c.v23), -1); pos(b, c.cx + fan, c.yOf(c.v24), 1);
      for (const o of [a.dot, a.t, b.dot, b.t, tick, tl, fl, guide]) o.setAttribute("opacity", 1);
      g.style.opacity = 0; requestAnimationFrame(() => { g.style.transition = "opacity .12s"; g.style.opacity = 1; }); return;
    }
    await sleep(150); if (!ok()) return;
    main.setAttribute("opacity", 0);
    a.dot.setAttribute("opacity", 1); b.dot.setAttribute("opacity", 1);
    // 1) split to the true heights of the two Augusts
    await T(450, u => { pos(a, lerp(c.cx, c.cx - fan, u), lerp(c.yOf(c.fc), c.yOf(c.v23), u), -1); pos(b, lerp(c.cx, c.cx + fan, u), lerp(c.yOf(c.fc), c.yOf(c.v24), u), 1); a.t.setAttribute("opacity", u); b.t.setAttribute("opacity", u); });
    if (!ok()) return; await sleep(220); if (!ok()) return;
    // 2) slide together to the average
    await T(350, u => { pos(a, lerp(c.cx - fan, c.cx, u), lerp(c.yOf(c.v23), c.yOf(c.av), u), 0); pos(b, lerp(c.cx + fan, c.cx, u), lerp(c.yOf(c.v24), c.yOf(c.av), u), 0); a.t.setAttribute("opacity", 1 - u); b.t.setAttribute("opacity", 1 - u); tick.setAttribute("opacity", u); guide.setAttribute("opacity", u * 0.8); tl.setAttribute("opacity", u); }, ease.soft);
    if (!ok()) return;
    // 3) scale up by the factor, back to the line's own height
    await T(250, u => { const y = lerp(c.yOf(c.av), c.yOf(c.fc), u); pos(a, c.cx, y, 0); pos(b, c.cx, y, 0); a.t.setAttribute("opacity", 0); b.t.setAttribute("opacity", 0); fl.setAttribute("opacity", u); }, ease.pop);
    if (!ok()) return;
    a.dot.setAttribute("opacity", 0); b.dot.setAttribute("opacity", 0); main.setAttribute("opacity", 1); main.setAttribute("r", (ph ? 3.5 : 5) + 2);
  }
  function hirePanel(p, w, token) {
    const { d, id } = w, dec = hires(d)[id], I = info[d], M = dec.month, mo = I.months[M], prev = I.months[M - 1];
    const D = Z.decision(d, dec, plan[d]), h = hireGeom(d, dec);
    p.innerHTML = `<h2>Why sign ${dec.crews} crews by ${fmtDate(dec.decide_by)}?</h2><p class="cap">${I.name}, hire</p>
      <ul>
        <li>Needed in ${MON[M]}: <b>${needC(mo)} crews</b> (${fmt(mo.requests)} requests / ${fmt(I.per_crew_month)}).</li>
        <li>Planned in ${MON[M - 1]}: ${prev.have}. Planned from ${MON[M]}: ${mo.have}.</li>
        <li>Signing deadline: <b>${fmtDate(dec.decide_by)}</b>. They train in ${MON[M - 1]} and work from 1 ${MS[M]}.</li>
        <li>Cost: ${dec.crews} crews cost ${money(dec.monthly_cost_usd)} a month once they work, and ${money(dec.one_time_cost_usd)} for the training month. Letting a crew go later costs a quarter of a year's pay.</li>
        <li>With them, about <b>${Math.round(D.with.ontime * 100)}%</b> of requests close on time (${moneyK(D.with.trust_cost)} lost to late work). Without them, <b>${Math.round(D.without.ontime * 100)}%</b> (${moneyK(D.without.trust_cost)}).</li>
      </ul><p class="foot">${D.note}</p>`;
    liveEl.textContent = `Why sign ${dec.crews} crews by ${fmtDate(dec.decide_by)}?`;
    runBolt({ token, d, dec, h });
    return { x: h.bx, y: h.by };
  }
  async function runBolt(c) {
    const g = whyG; g.textContent = ""; const h = c.h, z = G.z1, B = z.base, s = s1(c.d), I = info[c.d];
    const tr = el("rect", { x: colX(c.dec.month - 1) + G.bo, y: B - (I.months[c.dec.month - 1].have + c.dec.crews) * s, width: G.bw, height: c.dec.crews * s, class: "train-o", opacity: reduced() ? 1 : 0 }, g);
    const ring = el("circle", { cx: h.cx, cy: h.cy, r: 14, fill: "none", stroke: "var(--hire)", "stroke-width": 2, opacity: reduced() ? 0.8 : 0 }, g);
    if (reduced()) return;
    const T = (dur, fn, e) => new Promise(res => { const t0 = performance.now(); (function f(now) { if (c.token !== why.token) return res(false); const u = clamp((now - t0) / dur, 0, 1); fn((e || ease.soft)(u)); if (u < 1) requestAnimationFrame(f); else res(true); })(t0); });
    T(700, u => { ring.setAttribute("r", 14 + 18 * u); ring.setAttribute("opacity", 0.9 * (1 - u)); });
    await T(500, u => tr.setAttribute("opacity", Math.sin(Math.PI * u) * 0.9 + 0.1 * u));
    tr.setAttribute("opacity", 1);
  }

  // ---------------------------------------------------------------- tables
  function tableHtml() {
    const row = (...c) => "<tr>" + c.map(x => `<td>${x}</td>`).join("") + "</tr>", head = (...c) => "<tr>" + c.map(x => `<th scope="col">${x}</th>`).join("") + "</tr>";
    if (S.lvl === 0) return `<table><caption>Crews needed / planned, by month and department</caption>${head("Month", ...DEPTS.map(d => SHORTN[d]))}` + MON.map((n, m) => row(n, ...DEPTS.map(d => `${needC(info[d].months[m])} / ${info[d].months[m].have}`))).join("") + "</table>";
    if (S.lvl === 1) return `<table><caption>${info[S.d].name}, 2025</caption>${head("Month", "Needed", "Planned", "Gap")}` + info[S.d].months.map((mo, m) => row(MON[m], needC(mo), mo.have, gapText(mo))).join("") + "</table>";
    const MD = monthData(S.d, S.m);
    return `<table><caption>${info[S.d].name}, ${MON[S.m]}</caption>${head("Day", "Forecast", "Closed", "Waiting", "Crews", "Working", "Idle")}` + MD.days.map((x, i) => row(`${WD[x.weekday]} ${i + 1}`, fmt(x.arrivals), fmt(x.closed), fmt(x.backlog), x.crews_on, fmt(x.crews_busy), fmt(x.crews_idle))).join("") + "</table>";
  }
  $("#tablebtn").addEventListener("click", () => { const w = $("#tablewrap"), open = w.hidden; w.hidden = !open; $("#tablebtn").setAttribute("aria-expanded", open); $("#tablebtn").setAttribute("aria-label", open ? "Hide table" : "Show as table"); if (open) { closeInfo(); w.innerHTML = tableHtml(); } });
  // the "i" popover: everything the page used to say in sentences
  { const fw = $("#fcwrap"); if (fw) { const off = () => fw.classList.remove("esc");   // Escape hides the accuracy note's explanation (WCAG 1.4.13)
    fw.addEventListener("keydown", e => { if (e.key === "Escape") fw.classList.add("esc"); }); fw.addEventListener("mouseleave", off); fw.addEventListener("focusout", off); } }
  const infoBtn = $("#infobtn"), infoPop = $("#infopop");
  function closeInfo() { infoPop.hidden = true; infoBtn.setAttribute("aria-expanded", "false"); }
  infoBtn.addEventListener("click", e => { e.stopPropagation(); const open = infoPop.hidden; if (open) { const w = $("#tablewrap"); if (!w.hidden) $("#tablebtn").click(); } infoPop.hidden = !open; infoBtn.setAttribute("aria-expanded", String(open)); if (open) fitInfo(); });
  // owner 7 Nov: the panel never runs past the screen's edge (it was cut off on a small window); it scrolls inside instead
  function fitInfo() {
    infoPop.style.maxHeight = ""; const top = infoPop.getBoundingClientRect().top; let lim = innerHeight - 12;
    for (let el = infoPop.parentElement; el && el !== document.body; el = el.parentElement) { const cs = getComputedStyle(el); if (cs.overflow !== "visible" || cs.overflowY !== "visible") lim = Math.min(lim, el.getBoundingClientRect().bottom - 12); }
    const dk = document.querySelector("#dock"); if (dk && dk.offsetHeight) lim = Math.min(lim, dk.getBoundingClientRect().top - 10);
    infoPop.style.maxHeight = Math.max(140, Math.round(lim - top)) + "px";
  }
  addEventListener("resize", () => { if (!infoPop.hidden) fitInfo(); });
  document.addEventListener("click", e => { if (!infoPop.hidden && !infoPop.contains(e.target)) closeInfo(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !infoPop.hidden) { closeInfo(); infoBtn.focus(); } });

  // ---------------------------------------------------------------- fall backdrop: faint maple and oak leaves plus paper grain, a few drifting
  const bg = $("#bgmap");
  const LEAF = (() => {
    const maple = new Path2D(), oak = new Path2D();
    for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2, lobe = Math.pow(Math.abs(Math.cos(2.5 * (t - Math.PI / 2))), 0.7), r = 0.35 + 0.65 * lobe * (1 - 0.35 * Math.max(0, Math.cos(t + Math.PI / 2))); const x = Math.cos(t) * r, y = Math.sin(t) * r; i ? maple.lineTo(x, y) : maple.moveTo(x, y); }
    maple.closePath();
    for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2, r = 1 + 0.16 * Math.sin(t * 8); const x = Math.cos(t) * r * 0.55, y = Math.sin(t) * r; i ? oak.lineTo(x, y) : oak.moveTo(x, y); }
    oak.closePath();
    return { maple, oak };
  })();
  const LEAFCOL = ["#7a2230", "#a8431f", "#c9741f", "#d9a23a", "#6f7a2a", "#8c3a22"];
  let bgFrame = 0, bgLeaves = [], bgStatic = null, bgW = 0, bgH = 0, bgDpr = 1, bgLast = 0;
  function leafAt(ctx, l) {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot); ctx.scale(l.s, l.s); ctx.globalAlpha = l.a; ctx.fillStyle = l.c;
    ctx.fill(l.k === 0 ? LEAF.maple : LEAF.oak);
    ctx.globalAlpha = l.a * 0.8; ctx.strokeStyle = "#231510"; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0, -0.9); ctx.lineTo(0, 1.25); ctx.stroke();
    ctx.restore();
  }
  function drawBg() {
    if (!data) return; cancelAnimationFrame(bgFrame);
    bgDpr = Math.min(2, window.devicePixelRatio || 1); bgW = innerWidth; bgH = innerHeight;
    bg.width = bgW * bgDpr; bg.height = bgH * bgDpr;
    let sd = 11; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const n = bgW < 640 ? 22 : 44; bgLeaves = [];
    for (let i = 0; i < n; i++) bgLeaves.push({ x: rnd() * bgW, y: rnd() * bgH, rot: rnd() * 6.28, s: 14 + rnd() * 26, a: 0.02 + rnd() * 0.025, c: LEAFCOL[(rnd() * LEAFCOL.length) | 0], k: rnd() < 0.55 ? 0 : 1, vx: 0, vy: 0, ph: rnd() * 6.28 });
    // a handful drift: slightly stronger, they stay on the live layer
    const drift = bgLeaves.splice(0, reduced() ? 0 : bgW < 640 ? 5 : 9); drift.forEach(l => { l.a = 0.035 + rnd() * 0.03; l.vy = 6 + rnd() * 8; l.vx = -3 - rnd() * 6; });
    const off = document.createElement("canvas"); off.width = bg.width; off.height = bg.height; const o = off.getContext("2d"); o.setTransform(bgDpr, 0, 0, bgDpr, 0, 0);
    bgLeaves.forEach(l => leafAt(o, l));
    const g = document.createElement("canvas"); g.width = g.height = 120; const gc = g.getContext("2d"), im = gc.createImageData(120, 120);
    for (let i = 0; i < im.data.length; i += 4) { const v = rnd() < 0.5 ? 255 : 0; im.data[i] = v; im.data[i + 1] = v * 0.85; im.data[i + 2] = v * 0.7; im.data[i + 3] = rnd() * 9; }
    gc.putImageData(im, 0, 0); o.fillStyle = o.createPattern(g, "repeat"); o.fillRect(0, 0, bgW, bgH);
    // faint brick courses along the bottom edge
    o.globalAlpha = 0.03; o.strokeStyle = "#a8431f"; o.lineWidth = 1; for (let y = bgH - 90, r = 0; y < bgH; y += 18, r++) { o.beginPath(); o.moveTo(0, y); o.lineTo(bgW, y); for (let x = (r % 2) * 24; x < bgW; x += 48) { o.moveTo(x, y); o.lineTo(x, y + 18); } o.stroke(); }
    bgStatic = off; const ctx = bg.getContext("2d");
    const paint = (t) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bg.width, bg.height); ctx.drawImage(bgStatic, 0, 0);
      ctx.setTransform(bgDpr, 0, 0, bgDpr, 0, 0);
      const dt = Math.min(0.05, (t - bgLast) / 1000 || 0); bgLast = t;
      for (const l of drift) { l.x += (l.vx + Math.sin(t / 1800 + l.ph) * 6) * dt; l.y += l.vy * dt; l.rot += Math.sin(t / 2300 + l.ph) * dt * 0.6; if (l.y > bgH + 40) { l.y = -40; l.x = Math.random() * (bgW + 80); } if (l.x < -50) l.x = bgW + 40; leafAt(ctx, l); }
    };
    paint(0);
    if (!reduced() && drift.length) { const tick = (t) => { if (!document.hidden) paint(t); bgFrame = requestAnimationFrame(tick); }; bgFrame = requestAnimationFrame(tick); }
  }
  const drawMap = () => {}, stars = () => {};

  // ---------------------------------------------------------------- level changes
  const levelMarks = (opts) => (S.lvl === 0 ? z0Marks(opts) : S.lvl === 1 ? z1Marks(S.d, opts) : z2Marks(S.d, S.m, opts));
  let wheelAcc = 0, wheelT = 0, navId = 0;
  async function swapText() {
    const parts = [$("#legend")];
    parts.forEach(p => p.classList.add("off")); $("#tablewrap").hidden = true; $("#tablebtn").setAttribute("aria-label", "Show as table"); $("#tablebtn").setAttribute("aria-expanded", "false"); closeInfo();
    await sleep(reduced() ? 60 : 160); placeText(); await sleep(30); parts.forEach(p => p.classList.remove("off"));
  }
  async function goTo(next) {
    if (busy || !data) return; if (next.lvl === S.lvl && next.d === S.d && next.m === S.m) return;
    stopArc(); busy = true; world.classList.remove("settled"); closeWhy(true); dlG.textContent = ""; if (scene) { phG.textContent = ""; sceneEl.classList.add("away"); } hideTip(); clearBubbles(); clearHits(); firstTouchNow(); expandCrumbs = false;
    const prev = S, rd = reduced();
    S = { lvl: next.lvl, d: next.lvl ? next.d : null, m: next.lvl ? (next.m === undefined ? tightest(next.d) : next.m) : null };
    sizeStage(); renderCrumbs(next.lvl > prev.lvl); $("#zout").disabled = true;
    const tcp = stage.getBoundingClientRect(); const p = perchPos(); const tmove = terryMove(p);
    swapText();
    const kind = rd ? "snap" : (prev.lvl === 0 && S.lvl === 1) || (prev.lvl === 1 && S.lvl === 0) ? "morph" : prev.lvl === 1 && S.lvl === 2 ? "zin" : prev.lvl === 2 && S.lvl === 1 && prev.d === S.d ? "zout" : "cross";
    const nav = ++navId;
    try {
      if (kind === "snap") { await fadeWorld(0, 120); clearWorld(); showWorld(); await morph(levelMarks({ enterDelay: 0, delay: 0 }), { snap: true }); }
      else if (kind === "morph") await morph(levelMarks(S.lvl === 1 ? { enterDelay: 300 } : { enterDelay: 200 }), { dur: S.lvl === 1 ? 650 : 520 });
      else if (kind === "zin") { await pushCamera(colX(S.m), "in", 320); clearWorld(); showWorld(); await morph(levelMarks({ delay: 80 }), { dur: 300 }); }
      else if (kind === "zout") { await fadeWorld(0, 160); clearWorld(); showWorld(); await morph(levelMarks({ enterDelay: 0 }), { snap: true }); await pushCamera(colX(prev.m), "out", 460); }
      else { await fadeWorld(0, 260); clearWorld(); showWorld(); await morph(levelMarks({ delay: 0, enterDelay: 0 }), { dur: 420 }); }
    } finally { showWorld(); }
    busy = false; world.classList.add("settled"); renderCrumbs(false); buildHits(); drawBands(); lastSceneM = -1; placeStreets(); movePlayhead(); markSceneDay();
    await tmove; if (nav !== navId) return; relocateTerry(); buildHits(); showBubbles();
    bus("screen:level", { level: S.lvl, dept: S.d, month: S.m }); bus("screen:draw", {});
    syncArcBtn(); if (S.lvl === 1 && (prev.lvl !== 1 || prev.d !== S.d) && prev.lvl !== 2) queueArc();   // the hire arc plays on arrival from the city or another department
  }
  function tightest(d) { const g = info[d].months.map(gapC); let b = 0; g.forEach((v, i) => { if (v < g[b]) b = i; }); return b; }
  const showWorld = () => { world.style.opacity = ""; world.style.transform = ""; };
  function fadeWorld(to, ms) {
    return new Promise(res => { const a = world.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease", fill: "forwards" }); a.onfinish = () => { world.style.opacity = "0"; a.cancel(); res(); }; });
  }
  function pushCamera(x, dir, ms) {
    world.style.transformOrigin = `${x}px 0px`;
    const kf = dir === "in" ? [{ transform: "scaleX(1)", opacity: 1 }, { transform: "scaleX(12)", opacity: 0 }] : [{ transform: "scaleX(12)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }];
    return new Promise(res => { const a = world.animate(kf, { duration: ms, easing: "cubic-bezier(.22,.8,.2,1)", fill: "forwards" }); a.onfinish = () => { world.style.opacity = dir === "in" ? "0" : ""; a.cancel(); world.style.transformOrigin = ""; res(); }; });
  }

  // ---------------------------------------------------------------- zoom controls: buttons, keys, wheel, pinch
  function focusTarget(dir) {
    if (dir > 0) {
      if (S.lvl === 0) return { lvl: 1, d: (hover.d || DEPTS[0]), m: hover.m === null || hover.m === undefined ? undefined : hover.m };
      if (S.lvl === 1) return { lvl: 2, d: S.d, m: hover.d === S.d && hover.m !== null ? hover.m : tightest(S.d) };
      return null;
    }
    if (S.lvl === 2) return { lvl: 1, d: S.d, m: S.m }; if (S.lvl === 1) return { lvl: 0 }; return null;
  }
  function zoomStep(dir) { const t = focusTarget(dir); if (t) goTo(t); }
  $("#zout").addEventListener("click", () => zoomStep(-1));
  document.addEventListener("keydown", e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "Escape") { if (why.open) { closeWhy(); e.preventDefault(); } else if (pinned !== null) hideTip(); else if (!$("#tablewrap").hidden) $("#tablebtn").click(); else if (S.lvl > 0) { zoomStep(-1); e.preventDefault(); } }
    else if (e.key === "Backspace" && S.lvl > 0 && !why.open) { zoomStep(-1); e.preventDefault(); }
    else if ((e.key === "+" || e.key === "=") && !why.open) { zoomStep(1); } else if ((e.key === "-" || e.key === "_") && !why.open) { zoomStep(-1); }
  });
  stage.addEventListener("wheel", e => {
    if (why.open || !data) return; if (e.target.closest && e.target.closest("#tablewrap")) return;
    if (!(e.ctrlKey || e.metaKey)) return;   // a plain wheel scrolls the page (owner 22:28: it was trapped over the projector); Ctrl + wheel or a pinch zooms
    e.preventDefault(); if (busy) return;
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 40 : 1); clearTimeout(wheelT); wheelT = setTimeout(() => (wheelAcc = 0), 400);
    if (Math.abs(wheelAcc) >= 120) { const dir = wheelAcc < 0 ? 1 : -1; wheelAcc = 0; const p = rel(e); if (S.lvl === 0) { const i = Math.floor((p.y - G.z0.T0) / G.z0.pitch); if (i >= 0 && i < 4) hover = { d: DEPTS[i], m: p.x >= G.x0 ? clamp(Math.floor((p.x - G.x0) / G.mw), 0, 11) : 0 }; else if (dir > 0) return; } zoomStep(dir); }
  }, { passive: false });
  let pinch = null;
  stage.addEventListener("touchstart", e => { if (e.touches.length === 2) { pinch = { d0: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), done: false, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 }; } }, { passive: true });
  stage.addEventListener("touchmove", e => {
    if (!pinch || e.touches.length !== 2 || pinch.done) return; const dd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) / pinch.d0;
    if (dd > 1.25 || dd < 0.8) { pinch.done = true; const r = stage.getBoundingClientRect(), x = pinch.cx - r.left, y = pinch.cy - r.top; if (dd > 1) { if (S.lvl === 0) { const i = clamp(Math.floor((y - G.z0.T0) / G.z0.pitch), 0, 3); hover = { d: DEPTS[i], m: clamp(Math.floor((x - G.x0) / G.mw), 0, 11) }; } else hover = { d: S.d, m: clamp(Math.floor((x - G.x0) / G.mw), 0, 11) }; } zoomStep(dd > 1 ? 1 : -1); }
  }, { passive: true });
  stage.addEventListener("touchend", e => { if (e.touches.length < 2) pinch = null; }, { passive: true });

  // ---------------------------------------------------------------- streets beside their rows, one shared playhead
  const phG = $("#playhead");
  function movePlayhead(mf) {
    if (mf !== undefined) lastMf = mf; phG.textContent = "";
    if (!G || !scene || !SOn() || busy || S.lvl === 2) return;
    const x = G.x0 + G.mw * lastMf, mk = (y1, y2) => { el("line", { x1: x, x2: x, y1, y2, stroke: "var(--ink2)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }, phG); el("polygon", { points: `${x - 4},${y1 - 6} ${x + 4},${y1 - 6} ${x},${y1 + 1}`, fill: "var(--ink2)" }, phG); };
    if (S.lvl === 1) { mk(G.z1.plotT, G.z1.base); return; }
    if (G.stack) DEPTS.forEach((d, i) => mk(rowB(i) - G.z0.plotH, rowB(i))); else mk(rowB(0) - G.z0.plotH, rowB(3));
  }
  // ---------------------------------------------------------------- the day line: a quiet vertical line for one day of 2025
  // Year view: follows the pointer (or Left/Right on a focused month), click or Enter zooms to that month with that day picked.
  // Month view: marks the projector's day; clicking a day's column picks it. The projector's day is the one source of truth.
  const DL = { t: null, el: null };
  const dlG = (() => { const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("id", "dayline"); g.setAttribute("aria-hidden", "true"); g.setAttribute("pointer-events", "none"); phG.after(g); return g; })();
  const yDay = (m, dd) => Math.round((Date.UTC(2025, m, dd) - Date.UTC(2025, 0, 1)) / 864e5);
  const dDate = t => new Date(Date.UTC(2025, 0, 1 + t));
  const mOfDay = t => dDate(t).getUTCMonth(), nDays = m => new Date(Date.UTC(2025, m + 1, 0)).getUTCDate();
  const dTag = t => dDate(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const workDay = t => { const w = dDate(t).getUTCDay(); return w > 0 && w < 6; };
  const stepWork = (t, dir) => { for (let x = t + dir; x >= 0 && x <= 364; x += dir) if (workDay(x)) return x; return t; };
  function dayX(t) {
    if (!G) return null; const m = mOfDay(t), dd = dDate(t).getUTCDate();
    if (S.lvl === 1) return colX(m) + G.mw * (dd - 0.5) / nDays(m);
    if (S.lvl === 2 && S.m === m) return G.x0 + (G.x1 - G.x0) * (dd - 0.5) / nDays(m);
    return null;
  }
  function yearDayAt(x) { const m = clamp(Math.floor((x - G.x0) / G.mw), 0, 11), f = clamp((x - colX(m)) / G.mw, 0, 0.999); return yDay(m, 1) + Math.floor(f * nDays(m)); }
  function drawDayLine(t) {
    DL.t = t; dlG.textContent = ""; if (t == null || busy || !G || !(S.lvl === 1 || S.lvl === 2)) return;
    const x = dayX(t); if (x == null) return;
    const y1 = S.lvl === 1 ? G.z1.plotT : G.z2.aT, y2 = S.lvl === 1 ? G.z1.base : G.z2.lT + G.z2.lH;
    el("line", { x1: x, x2: x, y1, y2, stroke: "var(--ink)", "stroke-opacity": 0.38, "stroke-width": 1 }, dlG);
    if (S.lvl === 1) {
      const lab = dTag(t), w = lab.length * 6 + 12, tx = clamp(x - w / 2, G.x0, G.x1 - w), ty = y1 - 20;
      el("rect", { x: tx, y: ty, width: w, height: 16, rx: 4, fill: "var(--raised)", stroke: "var(--ink)", "stroke-opacity": 0.18 }, dlG);
      const tt = el("text", { x: tx + w / 2, y: ty + 11.5, "text-anchor": "middle", fill: "var(--ink2)", style: "font: 600 10.5px var(--ui); font-variant-numeric: tabular-nums" }, dlG); tt.textContent = lab;
    }
  }
  const sceneDayNow = () => (scene ? Math.floor(scene.getDay()) : null);
  function markSceneDay() { if (S.lvl === 2) drawDayLine(sceneDayNow()); else if (S.lvl !== 1) dlG.textContent = ""; }
  async function pickDay(d, t) {
    if (busy) return; firstTouchNow(); hideTip(); pinned = null; const m = mOfDay(t);
    if (!(S.lvl === 2 && S.d === d && S.m === m)) await goTo({ lvl: 2, d, m });
    await waitSettled(); if (S.lvl !== 2 || !scene) return; scene.pause(); scene.setDay(t + 0.5); markSceneDay();
    bus("screen:day", { day: t });
  }
  function sceneFromChart(d, m) { if (!scene || !SOn()) return; scene.setHover(d); if (m !== undefined && m !== lastSceneM && !scene.isPlaying()) { lastSceneM = m; scene.seekMonth(m); } }
  // the street cells for this level; d swaps the department drawn in the month's street cell (the resident replay drops each envelope at its own crew)
  function streetItems(d) { return G.street(S.lvl).map(it => { const right = it.chips === "right", k = (it.w - (right ? TerryScene.CHIP_W : 0)) / 300, dh = Math.min(186, (it.h - (right ? 0 : it.chips === "below" ? TerryScene.CHIP_B : TerryScene.CHIP_H)) / k); return Object.assign(it, { y0: Math.max(0, 182 - dh) }, d ? { d } : {}); }); }
  function showStreet(d) {
    if (!scene || busy || !G || S.lvl !== 2 || !DEPTS.includes(d)) return false;
    const its = streetItems(d); if (!its.length) return false;
    if (!scene.shows(d)) scene.layout(its); scene.setActive(d, false); return scene.shows(d);
  }
  function placeStreets() {
    if (!scene) return;
    if (!SOn()) { scene.setVisible(false); sceneEl.classList.add("away"); return; }
    scene.setVisible(true); if (S.d) scene.setActive(S.d); scene.layout(streetItems());
    sceneEl.classList.remove("away");
    // month zoom starts on the month's first day, not on 1 Jan
    if (S.lvl === 2 && scene.seekMonth && Math.floor(scene.monthFloat(scene.getDay())) !== S.m) { lastSceneM = S.m; scene.seekMonth(S.m); }
  }
  async function relayout(dur, keepScene) {
    if (!data) return; const T0 = performance.now(), M = window.__rlPerf = {}; for (let k = 0; k < 400 && busy; k++) await sleep(25); M.wait = performance.now() - T0;
    stopArc(); busy = true; closeWhy(true); hideTip(); closeInfo(); clearBubbles(); clearHits(); phG.textContent = ""; sceneEl.classList.add("away");
    if (scene) scene.setVisible(SOn());                         // the playback controls join or leave the bar
    let t = performance.now(); sizeStage(); placeText(); renderCrumbs(false); M.size = performance.now() - t; t = performance.now();
    let lm; try { lm = levelMarks({ enterDelay: 0 }); M.marks = performance.now() - t; M.n = lm.length; } catch (e) { throw e; }
    try { await morph(lm, dur === 0 ? { snap: true } : { dur: dur || 520 }); } finally { showWorld(); } M.morph = performance.now() - t; t = performance.now();
    busy = false; world.classList.add("settled"); relocateTerry(); buildHits(); drawBands(); lastSceneM = -1; placeStreets(); movePlayhead(); markSceneDay(); showBubbles(); syncArcBtn(); bus("screen:draw", {}); M.after = performance.now() - t; M.total = performance.now() - T0;
  }
  async function setStreets() {}   // city streets are gone; kept so older callers do not break
  function mountScene() {
    const risk = {}, longDue = {}, names = {};
    DEPTS.forEach(d => { risk[d] = info[d].months.filter(m => kindOf(m) === "short" || m.state === "late").map(m => m.month); longDue[d] = info[d].long_due; names[d] = info[d].name; });
    scene = TerryScene.mount(sceneEl, { Z, plan, depts: DEPTS, names, longDue, risk, TerryBat, reduced, level: "city", ctl: $("#sc-ctl"), onDay: (t, mf) => { movePlayhead(mf); markSceneDay(); }, onSelect: d => { hover = { d, m: hover.m }; } });
    scene.boot(); scene.setVisible(false); window.__scene = scene;
    const tt = ["One day every 4 seconds", "One day every 2 seconds", "One day every second", "Two days every second"]; $("#sc-ctl").querySelectorAll("[data-sp]").forEach((b, i) => { b.title = tt[i]; });
  }

  // ---------------------------------------------------------------- Ask Terry hooks: highlight, event bands, waiting for the camera
  const askHi = $("#askHi"), bandsG = $("#bands"); let bandEvents = [], bandLabel = "";
  function highlightCol(d, ms, what) {
    askHi.textContent = ""; if (!G) return; const i = DEPTS.indexOf(d); let y1, y2;
    if (S.lvl === 0) { y1 = rowT(i); y2 = rowB(i); } else if (S.lvl === 1) { y1 = G.z1.plotT; y2 = G.z1.base; } else return;
    for (const m of Array.isArray(ms) ? ms : [ms]) {      // one month, or several (an answer can point at a run of months)
      if (m === null || m === undefined || m < 0 || m > 11) continue;
      el("rect", { x: colX(m) + 1, y: y1 - 4, width: G.mw - 2, height: y2 - y1 + 8, rx: 6, fill: "rgba(43,90,134,.10)", stroke: "var(--hire)", "stroke-width": 2.5, class: "askpulse" }, askHi);
      const lab = what === "bolt" ? "hire starts" : what === "line" ? "crews needed" : "crews planned";
      el("text", { x: colC(m), y: y1 - 8, class: "t-note halo", "text-anchor": "middle" }, askHi).textContent = lab;
    }
    clearTimeout(highlightCol.t); highlightCol.t = setTimeout(() => { askHi.textContent = ""; }, 7000);
  }
  function drawBands(evs, label) {
    if (evs !== undefined) { bandEvents = evs || []; bandLabel = label || ""; } bandsG.textContent = ""; drawGoal(); if (!G || !bandEvents.length || S.lvl === 2 || busy) return;
    const mf = d => (scene ? scene.monthFloat(Math.max(0, Math.min(364, d))) : 0);
    for (const e of bandEvents) {
      const di = DEPTS.indexOf(e.dept); if (di < 0) continue; let y1, y2;
      if (S.lvl === 0) { y1 = rowT(di); y2 = rowB(di); } else if (S.d === e.dept) { y1 = G.z1.plotT; y2 = G.z1.base; } else continue;
      const xa = G.x0 + G.mw * mf(e.start), xb = G.x0 + G.mw * mf(Math.min(364.9, e.start + (e.days || 365))), w = Math.max(5, xb - xa);
      el("rect", { x: xa, y: y1 - 2, width: w, height: y2 - y1 + 4, fill: "rgba(156,122,31,.16)", stroke: "var(--behind)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }, bandsG);
      el("text", { x: xa + 3, y: y1 + 10, class: "t-note halo" }, bandsG).textContent = "alert";
    }
  }
  const goalG = el("g", { id: "goalG", "aria-hidden": "true", "pointer-events": "none" }, svg); svg.insertBefore(goalG, $("#playhead"));
  // ---- the plan Terry found: drawn on the chart, and acted out one beat at a time at every level
  const PL = { speed: 1, skip: false, running: false, token: 0, paused: false, beat: 0 };
  const REV = { dim: true, owls: true, dusk: true, hires: true };          // which parts are visible in the still picture
  const FLY = { on: true };                                                  // flyway shown (true) or stay the course (false)
  const TT = ms => ms / PL.speed;
  const pwait = async ms => { if (PL.skip || reduced()) return; await new Promise(res => setTimeout(res, TT(ms))); while (PL.paused && !PL.skip) await new Promise(r => setTimeout(r, 80)); };
  const growIn = (node, kf, ms, delay, ease) => { if (!node.animate || reduced() || PL.skip) return null; return node.animate(kf, { duration: TT(ms), delay: TT(delay || 0), easing: ease || "cubic-bezier(.3,1.5,.5,1)", fill: "backwards" }); };
  const pop = (parent, x, y) => { const o = el("g", { transform: `translate(${x},${y})` }, parent); return { o, i: el("g", { class: "pop" }, o) }; };
  function firstPerPredator(spots) {          // level 0: one owl per predator at its first month, the wash on all its months
    const by = new Map(); for (const sp of spots) { const b = by.get(sp.name); if (b) { b.all.push(sp.m); b.m = Math.min(b.m, sp.m); } else by.set(sp.name, { m: sp.m, name: sp.name, all: [sp.m] }); }
    return [...by.values()].map(o => ({ ...o, all: o.all.sort((a, b) => a - b) }));
  }
  function owlSpots(d) {                                                      // where predators sit on the current level for a department
    const out = [], seen = new Set(); if (!GV) return out;
    const gm = GV.goal && GV.goal.months && GV.goal.months.length ? GV.goal.months : null, lo = gm ? Math.min(...gm) - 2 : 1, hi = gm ? Math.max(...gm) : 12;   // an owl sits only on the goal window and the two lead-in months before it
    for (const ow of GV.owls) { if (ow.dept && ow.dept !== d) continue; for (const m of ow.months) { if (seen.has(m) || (gm && (m < lo || m > hi))) continue; seen.add(m); out.push({ m: m - 1, name: ow.name }); } }
    return out.sort((a, b) => a.m - b.m);
  }
  function newHires(d) { return hires(d).filter(dec => isNewHire(d, dec)); }
  function goalRows() {
    const out = []; if (!GV || !G) return out;
    for (const d of GV.depts) { const i = DEPTS.indexOf(d);
      if (S.lvl === 0) out.push({ d, i, y1: rowB(i) - G.z0.plotH, y2: rowB(i), top: rowT(i), bot: rowT(i) + G.z0.pitch - 4 });
      else if (S.lvl === 1 && S.d === d) out.push({ d, i, y1: G.z1.plotT, y2: G.z1.base, top: G.z1.plotT - 6, bot: G.z1.base }); }
    return out;
  }
  // build the overlay. o.animate names a part to act out ("dim", "owls", "dusk", "hires"); returns how long that takes (ms at 1x)
  function drawGoal(spec, o) {
    if (spec !== undefined) GV = spec; goalG.textContent = ""; if (!GV || !G || busy || S.lvl === 2) return 0;
    o = o || {}; const rows = goalRows(); if (!rows.length) return 0; const big = S.lvl === 1; let total = 0;
    const act = (part, n, per) => { if (o.animate === part) total = Math.max(total, n * per + 500); return o.animate === part; };
    // Boston view: the goal's rows lift, the others dim
    if (S.lvl === 0 && REV.dim) {
      const g = el("g", {}, goalG), a = act("dim", 1, 0);
      for (const rw of rows) { const r = el("rect", { class: "liftrow", x: -8, y: rw.top - 4, width: G.W + 16, height: G.z0.pitch - 2, rx: 10, "fill-opacity": .55 }, g); if (a) growIn(r, [{ opacity: 0 }, { opacity: 1 }], 500, 0, "ease"); }
      DEPTS.forEach((dd, i) => { if (GV.depts.includes(dd)) return;
        const r = el("rect", { class: "dimrow", x: -10, y: rowT(i) - 4, width: G.W + 20, height: G.z0.pitch - 4, rx: 10 }, g); if (a) growIn(r, [{ opacity: 0 }, { opacity: 1 }], 500, 0, "ease"); });
    }
    for (const rw of rows) {
      const d = rw.d, spotsAll = owlSpots(d), spots = big ? spotsAll : firstPerPredator(spotsAll);
      // predator months: a violet wash and an owl that lands on each one, one per ping
      if (REV.owls) {
        const a = act("owls", spots.length, 520);
        spots.forEach((sp, k) => { const cx = colC(sp.m), cy = big ? rw.y1 + 16 : rw.y1 + 10, rr = big ? 15 : 9;
          (big ? [sp.m] : (sp.all || [sp.m])).forEach(wm => { const w = el("rect", { class: "wash", x: colX(wm) + 2, y: rw.y1 - (big ? 6 : 2), width: G.mw - 4, height: rw.y2 - rw.y1 + (big ? 6 : 2), rx: 6 }, goalG); if (a) growIn(w, [{ opacity: 0 }, { opacity: 1 }], 450, k * 520 + 250, "ease"); });
          const ring = el("circle", { class: "ring", cx, cy, r: rr, opacity: 0 }, goalG);
          if (a) growIn(ring, [{ opacity: 0, transform: "scale(1)", offset: 0 }, { opacity: .9, transform: "scale(1)", offset: .02 }, { opacity: 0, transform: "scale(3.2)" }], 800, k * 520, "ease-out"); ring.style.transformBox = "fill-box"; ring.style.transformOrigin = "center";
          const p = pop(goalG, cx, cy), bg = el("circle", { r: rr + 3, fill: "var(--raised)", stroke: "var(--line2)", "stroke-width": 1.2 }, p.i);
          const u = el("use", { href: "#i-owl", x: -rr * .85, y: -rr * .85, width: rr * 1.7, height: rr * 1.7, class: "ico owl" }, p.i); void bg;
          el("title", {}, p.o).textContent = `Predator: ${sp.name}, ${(sp.all || [sp.m]).map(x => MON[x]).join(", ")}`;
          if (!big && sp.all && sp.all.length > 1) { const bt = el("text", { class: "t-owlx", x: rr + 6, y: 4 }, p.i); bt.textContent = "x" + sp.all.length; }
          if (a) growIn(p.i, [{ opacity: 0, transform: "translateY(-30px) scale(.7)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], 520, k * 520); });
      }
      // Dusk: the last day to act, a thin tick that draws down the plot
      if (big && REV.dusk && GV.dusk && GV.dusk.day !== undefined && GV.dusk.day >= 0) {
        const x = G.x0 + G.mw * (scene ? scene.monthFloat(Math.min(364, GV.dusk.day)) : 0), a = act("dusk", 1, 600);
        const ln = el("line", { class: "dusk", x1: x, x2: x, y1: rw.y1 - 10, y2: rw.y2 }, goalG); ln.style.strokeOpacity = ".7"; ln.style.transformBox = "fill-box"; ln.style.transformOrigin = "50% 0%"; if (a) growIn(ln, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], 600, 0, "ease-out");
        const dg = pop(goalG, x, rw.y2 + 36); const du = el("use", { href: "#i-dusk", x: -9, y: -9, width: 18, height: 18, class: "ico dusk-i" }, dg.i); void du;
        const t = el("text", { class: "t-dusk halo", x: x + 6, y: rw.y1 + 4 }, goalG); t.textContent = "Dusk"; if (a) growIn(t, [{ opacity: 0 }, { opacity: 1 }], 400, 450, "ease"); if (a) growIn(dg.i, [{ opacity: 0 }, { opacity: 1 }], 400, 450, "ease");
        el("title", {}, dg.o).textContent = `Dusk, ${fmtDate(GV.dusk.date)}: the last day to act`;
      }
      // the flyway's new hires drop onto their months, with a small bounce
      if (REV.hires && FLY.on) {
        const nh = newHires(d), a = act("hires", nh.length, 380);
        nh.forEach((dec, k) => { const pg = pillGeom(d, dec, rw), p = pop(goalG, pg.cx, pg.cy), sm = pg.w, hh = pg.h;
          el("rect", { class: "pill new", x: -sm / 2, y: -hh / 2, width: sm, height: hh, rx: hh / 2 }, p.i);
          el("text", { class: "t-hire new", x: 0, y: 4.2 }, p.i).textContent = `+${dec.crews}`;
          el("title", {}, p.o).textContent = `Sign ${dec.crews} crew${dec.crews === 1 ? "" : "s"} by ${fmtDate(dec.decide_by)}`;
          if (a) growIn(p.i, [{ opacity: 0, transform: "translateY(-44px)" }, { opacity: 1, transform: "translateY(0)", offset: .7 }, { opacity: 1, transform: "translateY(-5px)", offset: .85 }, { opacity: 1, transform: "translateY(0)" }], 620, k * 380, "ease-in"); });
      }
    }
    return total;
  }
  // a hire's marker, sitting on top of the bar in the month the crew starts working
  function pillGeom(d, dec, rw) {
    const M = dec.month, I = info[d], mo = I.months[M], big = S.lvl === 1, B = big ? G.z1.base : rowB(DEPTS.indexOf(d)), s = big ? s1(d) : s0(d), w = big ? 36 : 30, h = big ? 22 : 18;
    const top = B - Math.max(mo.have, mo.need) * s; return { cx: colC(M), cy: Math.max((rw ? rw.y1 : B - 60) + (big ? 30 : 8), top - h / 2 - 5), w, h };
  }
  // act out the plan at the current level: Boston rows (0) or one department's year (1). Month and day levels are played by the streets.
  const BEATS = [["dim", "The goal's rows lift, the rest dims"], ["owls", "An owl lands on each predator month"], ["dusk", "Dusk: the last day to sign a crew"], ["hires", "The flyway: +N crews land on their start month"], ["grow", "Bars grow into the new plan; short months clear"], ["train", "New crews train a month before they close requests"]];
  async function animateGoal(opts) {
    opts = opts || {}; if (!GV || !G || S.lvl === 2) return; const tok = ++PL.token; PL.skip = false; PL.running = true; PL.paused = false;
    const planX = opts.planX, from = Math.max(0, opts.from || 0), ALL = { dim: true, owls: true, dusk: true, hires: true };
    const fin = () => { Object.assign(REV, ALL); FLY.on = true; PL.running = false; bus("plan:stop", {}); };
    const nNew = () => (GV ? GV.depts.reduce((a, d) => a + newHires(d).reduce((x, h2) => x + h2.crews, 0), 0) : 0);
    const beat = i => { PL.beat = i; bus("plan:beat", { i, caption: nNew() > 0 ? BEATS[i][1].replace("+N", "+" + nNew()) : BEATS[i][1].replace("+N crews", "crews") }); };
    bus("plan:play", { reduced: reduced() });
    try {
      if (reduced()) { FLY.on = true; if (planX) await setPlanView(planX, 0); Object.assign(REV, ALL); drawGoal(); PL.beat = 5; bus("plan:beat", { i: 5, caption: BEATS[5][1] }); fin(); return; }
      Object.assign(REV, { dim: false, owls: false, dusk: false, hires: false }); FLY.on = false;
      BEATS.slice(0, from).forEach(([k]) => { if (k in REV) REV[k] = true; }); if (from >= 3) FLY.on = true;
      if (planX && (from >= 4 ? plan !== planX : plan !== basePlan)) await setPlanView(from >= 4 ? planX : basePlan, 0); else drawGoal();
      await waitSettled(); if (tok !== PL.token) return;
      const run = async part => { REV[part] = true; const ms = drawGoal(undefined, { animate: part }); await pwait(ms); return tok === PL.token; };
      if (from <= 0 && S.lvl === 0) { beat(0); await run("dim"); }
      if (from <= 1) { beat(1); if (!(await run("owls"))) return; await pwait(250); }
      if (from <= 2 && S.lvl === 1) { beat(2); if (!(await run("dusk"))) return; }
      // the flyway: markers drop in, then the bars grow to their new heights and short months turn blue
      if (from <= 3) { beat(3); FLY.on = true; if (!(await run("hires"))) return; await pwait(200); }
      if (from <= 4 && planX) { beat(4); const dur = Math.round(TT(900)); await setPlanView(planX, dur, true); if (tok !== PL.token) return; await pwait(300); }
      if (S.lvl === 1) { beat(5); await pwait(350); world.querySelectorAll(".train-o").forEach(n => n.classList.add("working")); await pwait(500); }
    } finally { if (tok === PL.token) fin(); }
  }
  // jump to the finished picture of a plan (no replay): used when another Roost becomes the active one
  async function settleGoal(spec, planX, dur) {
    skipPlan(); GV = spec; FLY.on = true; Object.assign(REV, { dim: true, owls: true, dusk: true, hires: true });
    await setPlanView(planX || basePlan, dur === undefined ? 0 : dur); drawGoal();
  }
  function skipPlan() { const was = PL.running; PL.skip = true; PL.paused = false; PL.token++; Object.assign(REV, { dim: true, owls: true, dusk: true, hires: true }); FLY.on = true; PL.running = false;  if (was) bus("plan:stop", {}); }
  function tightAll() { let best = null; for (const d of DEPTS) info[d].months.forEach((mo, m) => { const g = gapC(mo); if (!best || g < best.g) best = { d, m, g }; }); return best; }
  function applyPlan(p) {
    plan = p || basePlan; city = Z.city(plan); city.depts.forEach(x => (info[x.dept] = x)); computeAxes(); monthCache.clear();
    if (scene) for (const d of DEPTS) scene.setPlan(d, plan[d]);
  }
  async function setPlanView(p, dur) { applyPlan(p); await relayout(dur === undefined ? 380 : dur); }
  const waitSettled = async () => { for (let k = 0; k < 400 && busy; k++) await sleep(25); };

  // ==== the hire arc (department year): the one motion that teaches lead time
  // Each hire appears on its sign date, a dotted arc carries it through its training month and lands it as the +N pill on its
  // start month, that month's bar grows, and Dusk's tick draws last. 1.2 s at most, once per arrival, never loops, nothing under
  // reduced motion. It only styles marks that already exist (inline style, cleared at the end), so the still picture is unchanged.
  // Bus: arc:play, arc:beat { dept, month, crews, kind: "land" | "dusk" } as each hire lands (the Almanac can light its row), arc:stop.
  const arcG = el("g", { id: "arcG", "aria-hidden": "true", "pointer-events": "none" }, svg); svg.insertBefore(arcG, $("#playhead"));
  const ARC = { raf: 0, styled: [], timer: 0, on: false };
  const arcBtn = (() => {
    const b = document.createElement("button"); b.type = "button"; b.className = "ib"; b.id = "arcbtn"; b.hidden = true;
    b.setAttribute("aria-label", "Replay how hires land"); b.title = "Replay how hires land";
    b.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.8v3.6h3.6"/><path class="d" d="M10.2 9.2v5.6l4.6-2.8z"/></svg>';
    const ib = $("#infobtn"); if (ib && ib.parentNode) ib.parentNode.insertBefore(b, ib);
    b.addEventListener("click", () => { if (!busy && !PL.running && S.lvl === 1) playArc(); });
    return b;
  })();
  function syncArcBtn() { arcBtn.hidden = !(data && S.lvl === 1 && S.d && hires(S.d).length); arcBtn.disabled = PL.running; }
  function stopArc() {
    clearTimeout(ARC.timer); ARC.timer = 0; if (ARC.raf) cancelAnimationFrame(ARC.raf); ARC.raf = 0;
    for (const n of ARC.styled) { n.style.opacity = ""; n.style.transform = ""; n.style.transformBox = ""; n.style.transformOrigin = ""; }
    ARC.styled = []; arcG.textContent = "";
    if (ARC.on) { ARC.on = false; world.classList.remove("arcing"); bus("arc:stop", {}); }
  }
  function queueArc() { stopArc(); if (reduced()) return; ARC.timer = setTimeout(() => { ARC.timer = 0; if (!PL.running && !busy && S.lvl === 1) playArc(); }, 90); }   // a goal flight that follows at once (plan:play) wins
  function arcPlan(d) {
    const I = info[d], B = G.z1.base, s = s1(d), hs = hires(d), nh = newHires(d);
    const newPops = [...goalG.querySelectorAll("rect.pill.new")].map(r => r.closest("g.pop"));
    const dateX = iso => { const [y, m, dd] = iso.split("-").map(Number); if (y < 2025) return G.x0 - 6; const dim = new Date(Date.UTC(2025, m, 0)).getUTCDate(); return G.x0 + G.mw * (m - 1 + (dd - 1) / dim); };
    return hs.map((dec, k) => {
      const M = dec.month, pg = pillGeom(d, dec, { y1: G.z1.plotT }), mo = I.months[M], xs = dateX(dec.decide_by), ys = B;
      const xt = M > 0 ? colC(M - 1) : Math.max(G.x0 - 6, (xs + pg.cx) / 2), trTop = M > 0 ? B - (I.months[M - 1].have + dec.crews) * s : B;
      const top = Math.max(G.z1.plotT - 6, Math.min(trTop, pg.cy) - 24), cx = 2 * xt - (xs + pg.cx) / 2, cy = 2 * top - (ys + pg.cy) / 2;
      let pill = []; const ni = nh.indexOf(dec);
      if (ni >= 0) { if (newPops[ni]) pill = [newPops[ni]]; }
      else { const a = reg.get(`deco:hp:${d}:${k}`), b = reg.get(`labels:hl:${d}:${k}`); pill = [a, b].filter(Boolean).map(r => r.el); }
      const bar = reg.get(`bars:b:${d}:${M}`), trs = I.training.map((t, i) => (t.month === M - 1 ? reg.get(`deco:tr:${d}:${i}`) : null)).filter(Boolean).map(r => r.el);
      return { dec, M, xs, ys, cx, cy, px: pg.cx, py: pg.cy, pill, trs, bar: bar && bar.el, f0: mo.have > 0 ? clamp((mo.have - dec.crews) / mo.have, 0, 1) : 1 };
    });
  }
  function playArc() {
    stopArc(); if (!data || !G || S.lvl !== 1 || !S.d || PL.running) return;
    const d = S.d, list = arcPlan(d); if (!list.length) return;
    if (reduced()) { list.forEach(h => bus("arc:beat", { dept: d, month: h.M, crews: h.dec.crews, kind: "land" })); return; }
    const n = list.length, st = n > 1 ? Math.min(70, 220 / (n - 1)) : 0, last = (n - 1) * st;
    const dl = GV && GV.dusk && REV.dusk ? goalG.querySelector("line.dusk") : null, dLab = dl ? [goalG.querySelector("text.t-dusk"), (goalG.querySelector('use[href="#i-dusk"]') || { closest: () => null }).closest("g.pop")].filter(Boolean) : [];
    const D0 = 800 + last, DD = 380 - last, END = D0 + DD;                    // the last hire's bar finishes at D0; Dusk and the fade fill the rest; END is 1180 ms at most
    const sty = n2 => { if (n2 && !ARC.styled.includes(n2)) ARC.styled.push(n2); return n2; };
    list.forEach(h => {
      h.mk = el("circle", { cx: h.xs, cy: h.ys, r: G.phone ? 3 : 4, class: "arc-sign" }, arcG);
      h.path = el("path", { d: "", class: "arc-path" }, arcG);
      h.head = el("circle", { cx: h.xs, cy: h.ys, r: G.phone ? 2.4 : 3.2, class: "arc-head" }, arcG);
      h.pill.forEach(p => { if (p.closest("#goalG")) { sty(p).style.opacity = "0"; return; } sty(p).style.opacity = "0"; p.style.transformBox = "fill-box"; p.style.transformOrigin = "center"; });
      h.trs.forEach(t => (sty(t).style.opacity = "0"));
      if (h.bar && h.f0 < 1) { sty(h.bar).style.transformBox = "fill-box"; h.bar.style.transformOrigin = "50% 100%"; h.bar.style.transform = `scaleY(${h.f0})`; }
    });
    if (dl) { sty(dl).style.transform = "scaleY(0)"; dLab.forEach(x => (sty(x).style.opacity = "0")); }
    const qx = (h, t) => (1 - t) * (1 - t) * h.xs + 2 * (1 - t) * t * h.cx + t * t * h.px, qy = (h, t) => (1 - t) * (1 - t) * h.ys + 2 * (1 - t) * t * h.cy + t * t * h.py;
    const P = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
    ARC.on = true; world.classList.add("arcing"); bus("arc:play", { dept: d, hires: n });
    const t0 = performance.now();
    const frame = () => {
      const t = performance.now() - t0, fade = 1 - P(t, D0, END);
      list.forEach((h, k) => {
        const o = k * st, a = P(t, o, o + 120), u = ease.soft(P(t, o + 100, o + 560)), l = P(t, o + 540, o + 680), g = ease.camera(P(t, o + 600, o + 800));
        h.mk.setAttribute("opacity", (a * fade).toFixed(3)); h.mk.setAttribute("r", ((G.phone ? 3 : 4) * ease.pop(a)).toFixed(2));
        const pts = []; for (let i = 0, N = 28; i <= N; i++) { const q = (u * i) / N; pts.push(qx(h, q).toFixed(1) + " " + qy(h, q).toFixed(1)); }
        h.path.setAttribute("d", u > 0 ? "M" + pts.join(" L") : ""); h.path.setAttribute("opacity", (0.95 * fade).toFixed(3));
        h.head.setAttribute("cx", qx(h, u).toFixed(1)); h.head.setAttribute("cy", qy(h, u).toFixed(1)); h.head.setAttribute("opacity", u > 0 && u < 0.97 ? 1 : 0);
        h.trs.forEach(x => (x.style.opacity = P(u, 0.3, 0.55).toFixed(3)));
        h.pill.forEach(p => { p.style.opacity = l.toFixed(3); p.style.transform = l < 1 ? `translateY(${((1 - ease.pop(l)) * -8).toFixed(2)}px)` : ""; });
        if (l > 0 && !h.landed) { h.landed = true; bus("arc:beat", { dept: d, month: h.M, crews: h.dec.crews, kind: "land" }); }
        if (h.bar && h.f0 < 1) h.bar.style.transform = `scaleY(${lerp(h.f0, 1, g).toFixed(4)})`;
      });
      if (dl) { const q = ease.soft(P(t, D0, D0 + DD * 0.8)); dl.style.transform = `scaleY(${q.toFixed(4)})`; dLab.forEach(x => (x.style.opacity = P(t, D0 + DD * 0.4, END).toFixed(3))); if (q > 0 && !ARC.dusk) { ARC.dusk = true; bus("arc:beat", { dept: d, kind: "dusk", day: GV.dusk.day }); } }
      if (t >= END) { ARC.raf = 0; stopArc(); return; }
      ARC.raf = requestAnimationFrame(frame);
    };
    ARC.dusk = false; ARC.raf = requestAnimationFrame(frame);
  }
  if (window.TerryBus) window.TerryBus.on("plan:play", () => { stopArc(); syncArcBtn(); });
  if (window.TerryBus) window.TerryBus.on("plan:stop", () => syncArcBtn());
  function mountAsk() {
    TerryAskUI.mount($("#ask-slot"), { getSample: window.TerryProj && TerryProj.getSample, E, Z, plan: () => plan, DEPTS, scene, reduced, goTo, streets: setStreets, settled: waitSettled, state: () => S, openWhy: (d, m) => openWhy({ type: "demand", d, m }), highlight: highlightCol, bands: drawBands });
  }

  // ---------------------------------------------------------------- boot
  function sizeStage() { G = computeG(); stage.style.height = G.H + "px"; stage.style.minHeight = "0"; svg.setAttribute("width", G.W); svg.setAttribute("height", G.Hmax); svg.setAttribute("viewBox", `0 0 ${G.W} ${G.Hmax}`); }
  async function load() {
    $("#err").hidden = true; $("#state").hidden = false; $("#state").style.top = "200px";
    try {
      data = await (await fetch("data.json")).json();
      E = TerryEngine.create(data); Z = TerryLevels.create(E); plan = basePlan = Z.plans.terry; city = Z.city(plan);
      city.depts.forEach(x => (info[x.dept] = x)); computeAxes(); Z.city(basePlan).depts.forEach(x => (baseInfo[x.dept] = x));
    } catch (err) { $("#state").hidden = true; $("#err").hidden = false; console.warn("load failed", err && err.message); return; }
    $("#state").hidden = true; $("#tablebtn").hidden = true;
    renderCrumbs(false); sizeStage(); stars(); drawMap(null); placeText();
    const first = z0Marks({ first: true, enterDelay: 0 }); clearWorld();
    const mp = morph(first, { dur: 900 });
    relocateTerry(); await mp; world.classList.add("settled"); buildHits(); showBubbles(); mountScene(); movePlayhead(0); if (window.TerryAskUI && window.TerryAsk) mountAsk();
    document.body.setAttribute("data-ready", "1");
  }
  let rzT = 0, fcT = 0;
  { const refit = () => { cancelAnimationFrame(fcT); fcT = requestAnimationFrame(fitFc); }, fw = $("#fcwrap");   // the bar changes width with the window and the cloth
    if (window.ResizeObserver && fw && fw.parentElement) new ResizeObserver(refit).observe(fw.parentElement); else addEventListener("resize", refit); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitFc);
  addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => {
    if (!data || busy) return; const w = G.W, tp = G.top; sizeStage(); if (G.W === w && G.top === tp) return;
    closeWhy(true); hideTip(); closeInfo(); clearBubbles(); stars(); drawMap(S.lvl ? S.d : null); renderCrumbs(false); sizeStage(); placeText();
    morph(levelMarks({ enterDelay: 0 }), { snap: true }).then(() => { relocateTerry(); buildHits(); drawBands(); placeStreets(); movePlayhead(); showBubbles(); });
  }, 150); });
  if (window.ResizeObserver && stage.parentElement) {   // the cloth changed size (window, rig or plate): lay the chart out inside it again
    let lastF = 0, roT = 0;
    new ResizeObserver(() => { const f = stage.parentElement.clientHeight; if (!G || !lastF) { lastF = f; return; } if (Math.abs(f - lastF) < 2) return; lastF = f; clearTimeout(roT); roT = setTimeout(() => { if (data && !busy && G && G.F !== f && !document.documentElement.classList.contains("mx-open")) relayout(0); }, 120); }).observe(stage.parentElement);
  }
  $("#retry").addEventListener("click", load);

  sizeStage(); bat = NOBAT;
  window.__zoom = { get G() { return G; }, goTo, setRoostLabel, settleGoal, get info() { return info; }, scale1: d => s1(d), colX, get DEPTS() { return DEPTS; }, get goalSpec() { return GV; }, get S() { return S; }, openWhy, setStreets, relayout, settled: () => waitSettled(), highlight: highlightCol, setPlanView, drawGoal, applyPlan, animateGoal, skipPlan,
    setPlanSpeed(v) { PL.speed = v; if (scene) scene.setSpeed(v === 0.5 ? 0 : v === 2 ? 2 : 1); }, get planSpeed() { return PL.speed; }, get planRunning() { return PL.running; }, get planBeat() { return PL.beat; }, get planPaused() { return PL.paused; }, setPaused(v) { PL.paused = !!v; }, skipPlan, setFly(on) { FLY.on = !!on; drawGoal(); }, get planFly() { return FLY.on; },
    get G() { return G; }, get scene() { return scene; }, get E() { return E; }, get Z() { return Z; }, tightAll, get plan() { return plan; }, get basePlan() { return basePlan; }, get ready() { return !!data; }, get streets() { return SO; }, tightest, newHires,
    hires: d => hires(d).map(h => ({ crews: h.crews, month: h.month, decide_by: h.decide_by })),
    colRect: (d, m) => { const i = DEPTS.indexOf(d); return S.lvl === 0 ? { x: colX(m), y: rowB(i) - G.z0.plotH, w: G.mw, h: G.z0.plotH } : { x: colX(m), y: G.z1.plotT, w: G.mw, h: G.z1.plotH }; },
    // for ticket.js: the day column at month zoom in stage pixels (null at other levels) and the month's day table
    dayRect: i => { if (!G || S.lvl !== 2 || S.d == null || S.m == null) return null; const z = G.z2, n = monthData(S.d, S.m).days.length, dw = (G.x1 - G.x0) / n; i = Math.max(0, Math.min(n - 1, i | 0)); return { x: G.x0 + dw * i, y: z.axisY - 14, w: dw, h: z.lT + z.lH - z.axisY + 14, plotLeft: G.x0, plotRight: G.x1 }; },
    dayInfo: (d, m) => monthData(d, m), showStreet, get busy() { return busy; }, get stage() { return stage; } };
  load();
})();
