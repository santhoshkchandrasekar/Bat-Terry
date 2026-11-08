/* BUDGETerry: the year's crew budget, drained month by month. A battery resting on the projector machine (the Almanac board),
 * left of the lens, in two brass cradles, its plug seated in a socket on the machine. Owner decisions: REMAINING.md, "Budget battery,
 * named BUDGETerry" and "Almanac machine and BUDGETerry placement".
 *
 * Behind the glass: the four departments' bands, left to right, sized by their share of the recommended plan's 2025 spend. Each drains
 * with its payroll and overdue costs through the month the projector shows (city and department years: the whole year; a month: through
 * that month); playing the plan drains it month by month. A thin red leak line is the late penalties spent. A Roost's Flyway adds a
 * pulsing segment on its band and a labelled cell; Compare shows two batteries, A and B. Department view dims the other bands.
 * Hover a band for its dollars. Enlarged screen and narrow windows (under 1100 px): a compact gauge instead.
 * Numbers: TerryBudget (budget.js) over the engine; nothing is typed.
 *
 *   window.TerryBudgeterry = { fit(el, w) -> room px above the housing, clear, state, refresh() }   (almanac.js calls fit)
 */
(function (root) {
  "use strict";
  const Bus = root.TerryBus; if (!Bus) return;
  const doc = root.document;
  const GEO = { w: 1779, h: 334, window: [209, 102, 1198, 236], glass: [199, 95, 1205, 236], r: 34, plug: [1776, 295], body: 320, cap: 200, saddles: [360, 1080], top: 78 };   // budgeterry-rest-geo.json, plus the glass's inner rounded rect (inside the bezel), the body's foot, the minus cap's length and the two cradles, measured on the image
  const PLATE = 22;   // the name plate's height plus its bracket, above the body's top edge
  const SRC = { day: "assets/battery/budgeterry-rest-day.webp", night: "assets/battery/budgeterry-rest-night.webp" };
  const SHEEN = { day: "assets/battery/budgeterry-sheen-day.webp", night: "assets/battery/budgeterry-sheen-night.webp" };   // the photo's own glass highlights (its window, high passed), laid back over the bands
  const COL = { PWDx: "var(--rust)", BTDT: "var(--harbour)", PARK: "var(--pine)", ISD: "var(--ochre)" };
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const LABEL = "BUDGETerry · 2025 spend";
  const theme = () => (doc.documentElement.dataset.theme === "night" ? "night" : "day");
  const reduced = () => Bus.reduced();
  const Z_ = () => root.__zoom;
  let cell = null, B = null, host = null, units = [], socketA = null, socketB = null, gauge = null, mxGauge = null, tip = null, sr = null;
  let compact = false, lay = null, cursor = 12, sweepT = 0, sweeping = false, held = false, last = null, sig = "", playing = false, settleT = 0;
  const term = s => (root.TerryTerms ? root.TerryTerms.term(s).replace(/ tabindex="0" aria-describedby="[^"]*"/g, "") : s);   // hover only: the battery is drawn, its text is in .bud-sr
  const money = v => B.money(v);

  function model() {
    const z = Z_(); if (!z || !z.ready || !z.Z || !z.plan) return null;
    if (!B) B = root.TerryBudget && root.TerryBudget.create(z.Z); return B;
  }
  function activeRoost() { const st = root.TerryState || {}; return (st.roosts || []).find(r => r.id === st.activeRoost) || null; }
  // what the projector shows, in budget terms
  function view() {
    const z = Z_(), S = z.S, st = root.TerryState || {}, cmp = st.compare, r = activeRoost(), g = z.goalSpec;
    const t = S.lvl >= 2 ? S.m + 1 : held ? 12 : 0;   // year views show the full charge (the year's budget); a month drains to that month; played to December it holds until the view changes
    const fly = !cmp && !!(g && z.basePlan && z.plan !== z.basePlan && r);
    const one = { plan: z.plan, tag: "" };
    let list = [one], dim = S.lvl >= 1 ? S.d : null, L = root.TerryLedger, lp = L && L.plan, lc = L && L.compare, lr = L && L.recommended;
    if (cmp && cmp.a && cmp.b && cmp.a.plan && cmp.b.plan) { const d = cmp.b.dept || cmp.a.dept, mk = x => Object.assign({}, z.plan, { [d]: { crews: x.plan.crews, seasonal: x.plan.seasonal } }); const nm = x => String(x.label || "").replace(/^Roost\s*\d+\s*[\u00b7.:]\s*/i, "").trim(), na = nm(cmp.a), nb = nm(cmp.b), same = na === nb, base = z.basePlan || z.plan, md = model();
      const pa = mk(cmp.a), pb = mk(cmp.b);   // each battery holds its own plan's budget and names it on its plate
      list = [{ plan: pa, ref: md ? md.refFor(pa, base) : null, tag: same ? cmp.a.label : na }, { plan: pb, ref: md ? md.refFor(pb, base) : null, tag: same ? cmp.b.label : nb }]; dim = d; }
    else if (L && (lc || (lp && lp !== lr))) {   // the ledger's plan switch: the selected notebook plan, or its two plans side by side (the projector stays on the recommended plan)
      const led = k => { const P = L.planOf(k); if (!P) return null; const pl = {}; P.depts.forEach(x => { pl[x.dept] = { crews: x.crews, seasonal: x.seasonal }; }); return { plan: Object.assign({}, z.plan, pl), ref: P, tag: L.label(k), key: k }; };
      const a = led(lp), b = lc ? led(lc) : null;
      if (a) { list = b ? [a, b] : [a]; if (b) dim = null; }
    }
    const ledgerOn = !cmp && list[0].ref != null;
    return { t, lvl: S.lvl, d: S.d, m: S.m, list, dim, fly: fly && !ledgerOn ? { base: z.basePlan, depts: (g.depts || []).slice() } : null };
  }

  // ==== the battery's parts
  const mk = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function unit(tag) {
    const u = mk("div", "bud" + (tag === "B" ? " bud-b" : "")); u.setAttribute("aria-hidden", "true");
    u.innerHTML = `<i class="bud-shadow"></i><img class="bud-img" alt="" draggable="false" decoding="async">` +
      `<div class="bud-win"><i class="bud-glass"></i><img class="bud-sheen" alt="" draggable="false" decoding="async"><span class="bud-frost"><span class="bud-fig"></span></span></div>` +
      `<i class="bud-saddle"></i><i class="bud-saddle"></i><i class="bud-stem"></i>` +
      `<span class="bud-label">${term("BUDGETerry")} · <span class="bud-pl">2025 spend</span></span>`;
    const win = u.querySelector(".bud-win");
    const bands = B.depts.map(d => { const b = mk("span", "bud-band"); b.dataset.d = d; b.style.setProperty("--c", COL[d]); b.innerHTML = '<i class="bb-lit"></i><i class="bb-fly"></i><i class="bb-leak"></i>'; win.insertBefore(b, win.querySelector(".bud-glass")); return b; });
    bands.forEach(b => { b.addEventListener("pointerenter", () => showTip(u, b)); b.addEventListener("pointerleave", hideTip); });
    u._bands = bands; u._tag = tag; u.querySelector(".bud-img").src = SRC[theme()]; u.querySelector(".bud-sheen").src = SHEEN[theme()];
    return u;
  }
  function gaugeEl(cls) {
    const g = mk("div", "bud-gauge " + (cls || "")); g.setAttribute("role", "img");
    g.innerHTML = `<span class="bg-name">${term("BUDGETerry")}</span><span class="bg-bar">${B.depts.map(d => `<i data-d="${d}" style="--c:${COL[d]}"><b></b></i>`).join("")}</span><span class="bg-fig"></span>`;
    return g;
  }
  function build(el) {
    if (host === el || !model()) return !!host;
    host = el;
    units = [unit(""), unit("B")]; units[1].hidden = true;
    socketA = mk("i", "bud-socket"); socketB = mk("i", "bud-socket bud-b"); socketB.hidden = true;
    [socketA, socketB].forEach(s => s.setAttribute("aria-hidden", "true"));
    units.forEach(u => el.appendChild(u)); el.append(socketA, socketB);
    gauge = gaugeEl("in-head"); const head = el.querySelector(".alm-head");
    cell = mk("span", "bud-cell"); cell.setAttribute("aria-hidden", "true");
    if (head) { const hint = head.querySelector(".alm-hint"); head.insertBefore(cell, hint); head.appendChild(gauge); }
    sr = mk("p", "sr bud-sr"); el.appendChild(sr);
    tip = mk("div", "bud-tip"); tip.setAttribute("role", "tooltip"); tip.hidden = true; doc.body.appendChild(tip);
    return true;
  }

  // ==== layout: scale the photo to fit left of the lens; the window, brackets and socket follow the image's geometry
  function fit(el, w, k) {
    if (!model()) return 0;
    build(el);
    compact = root.innerWidth < 1100;
    el.classList.toggle("bud-compact", compact); el.classList.toggle("bud-on", !compact);
    if (compact) { units.forEach(u => (u.hidden = true)); socketA.hidden = socketB.hidden = true; lay = null; api.clear = 0; api.top = 0; render(true); return 0; }
    // right of the battery: its socket, a gap, then the lens's flange (centred). It may overhang the housing's left end by most of its minus cap
    // (the cradles carry the body), and grows to a 280 px window where there is room.
    const lensHalf = 32, gapLens = 12, sockW = 18, pin = 30, R = w / 2 - lensHalf - gapLens - sockW, over = GEO.cap * 0.8;
    const s = Math.min(280 / (GEO.window[2] - GEO.window[0]), (R - 6) / (GEO.plug[0] - pin - over)) * (k || 1);   // k: smaller in watch on screen
    const iw = GEO.w * s, ih = GEO.h * s, foot = (GEO.h - GEO.body) * s, left = Math.max(6 - over * s, R - (GEO.plug[0] - pin) * s);
    lay = { s, iw, ih, left, foot };
    const cmp = last && last.list.length > 1;
    const [g0, gy0, g1, gy1] = GEO.glass, IN = 2.5;   // the bands sit 2.5 px inside the bezel, clipped to the glass's rounded rect
    units.forEach((u, i) => {
      const L = i ? w - left - iw : left;
      Object.assign(u.style, { left: L + "px", width: iw + "px", height: ih + "px", bottom: `calc(100% + 3px - ${foot.toFixed(1)}px)` });
      u.style.setProperty("--s", s.toFixed(4)); u.style.setProperty("--foot", foot.toFixed(1) + "px");
      const gx = i ? GEO.w - g1 : g0;   // B is the mirrored photo: its window sits mirrored, its bands read left to right
      const win = u.querySelector(".bud-win");
      Object.assign(win.style, { left: gx * s + IN + "px", top: gy0 * s + IN + "px", width: (g1 - g0) * s - 2 * IN + "px", height: (gy1 - gy0) * s - 2 * IN + "px", borderRadius: Math.max(2, GEO.r * s - IN).toFixed(1) + "px" });
      Object.assign(u.querySelector(".bud-sheen").style, { left: -IN + "px", top: -IN + "px", width: (g1 - g0) * s + "px", height: (gy1 - gy0) * s + "px" });
      const sd = u.querySelectorAll(".bud-saddle"); GEO.saddles.forEach((x, n) => { const cx = i ? GEO.w - x : x; Object.assign(sd[n].style, { left: cx * s + "px", width: Math.max(18, 170 * s) + "px", height: (46 * s + 4).toFixed(1) + "px" }); });
      // the engraved plate: on the machine's rail under the body, between the cradles
      const lab = u.querySelector(".bud-label"), mid = ((GEO.saddles[0] + GEO.saddles[1]) / 2) * s;
      // above the battery (owner 08:50: below, it sat beside the ALMANAC nameplate), on a short bracket down to the body's top edge
      Object.assign(lab.style, { left: (i ? iw - mid : mid) + "px", top: (GEO.top * s - PLATE).toFixed(1) + "px" });
      Object.assign(u.querySelector(".bud-stem").style, { left: (i ? iw - mid : mid) + "px", top: (GEO.top * s - 6).toFixed(1) + "px" });
      u.hidden = i === 1 && !cmp;
    });
    // the socket: a brass block on the rail, its mouth at the plug's height; the pins and the plug's tip go in behind its face
    const plugY = (GEO.body - GEO.plug[1]) * s, sh = plugY + 16, sx = left + (GEO.plug[0] - pin) * s;
    [socketA, socketB].forEach((k, i) => { Object.assign(k.style, { left: (i ? w - sx - sockW : sx) + "px", width: sockW + "px", height: sh.toFixed(1) + "px" }); k.style.setProperty("--py", plugY.toFixed(1) + "px"); k.hidden = i === 1 && !cmp; });
    el.classList.toggle("bud-two", !!cmp);   // the B battery sits right of the lens, over the chase slot
    api.clear = w / 2 - (left + 1460 * s) - 4; api.top = ih - foot;   // the beam starts above the socket: it only has to clear the battery's plus cap and the cable's rise
    render(true);
    return ih - foot + 3 + 4 + Math.max(0, PLATE - GEO.top * s);
  }

  // ==== state to pixels
  function compute() {
    const z = Z_(); if (!model()) return null;
    const v = view(), t = sweeping ? cursor : v.t;
    const states = v.list.map(x => ({ tag: x.tag, st: B.state(x.plan, t, x.ref) }));
    const fx = v.fly ? B.flyway(v.fly.base, Z_().plan, v.fly.depts, t > 0 ? t : 12) : null, fxYear = v.fly ? B.flyway(v.fly.base, Z_().plan, v.fly.depts, 12) : null;
    return { v, t, states, fx, fxYear, dim: v.dim };
  }
  // the figure is etched at the glass's bottom right, inside one cell: the rightmost cell wide enough for it, so it never crosses a cell wall
  function placeFig(u, fig) {
    const win = u.querySelector(".bud-win"), W = win.clientWidth; if (!W) return;
    const need = fig.offsetWidth + 8, cells = u._bands.slice().reverse();
    const c = cells.find(b => b.offsetWidth >= need) || u._bands.reduce((a, b) => (b.offsetWidth > a.offsetWidth ? b : a));
    fig.style.right = Math.max(0, W - (c.offsetLeft + c.offsetWidth)) + 4 + "px";
  }
  // the reading: full before January; held at December after a play it names what the year spent, not a nearly empty percent
  const reading = (st, t) => (t <= 0 ? `${money(st.full)} for 2025` : held && !sweeping && t >= 12 ? B.spentBy(st) : B.figure(st));
  const throughTxt = t => (t >= 12 ? "the whole year" : t <= 0 ? "before January" : `through ${MON[Math.ceil(t) - 1]}`);
  function render(force) {
    if (!host || !B) return;
    let c; try { c = compute(); } catch (e) { Bus.emit("error", { module: "budgeterry", e }); return; }
    if (!c) return;
    last = c.v;
    const key = JSON.stringify([c.states.map(x => [x.tag, Math.round(x.st.spent), Math.round(x.st.full)]), c.dim, c.fx && Math.round(c.fx.crews), compact, theme(), held && !sweeping]);
    if (key === sig && !force) return; sig = key;
    const anim = !reduced() && !force;
    host.classList.toggle("bud-anim", !reduced());
    units.forEach((u, i) => {
      const x = c.states[i]; if (!x) { u.hidden = true; return; }
      if (!compact) u.hidden = false;
      const st = x.st;
      u._st = st; u._fx = i === 0 ? c.fx : null; u._t = c.t;
      u._bands.forEach((b, k) => {
        const dd = st.depts[k], lit = Math.max(0, Math.min(1, dd.frac));
        b.style.flexGrow = (dd.share * 1000).toFixed(1);
        b.style.setProperty("--lit", (lit * 100).toFixed(2) + "%");
        const fl = c.fx && i === 0 ? c.fx.depts.find(f => f.dept === dd.dept) : null, fw = fl && fl.crews > 0 ? Math.min(1, fl.crews / dd.cap) : 0;
        b.style.setProperty("--fly", (fw * 100).toFixed(2) + "%"); b.style.setProperty("--fly-l", (Math.max(0, Math.min(lit, 1 - fw)) * 100).toFixed(2) + "%"); b.classList.toggle("has-fly", fw > 0);   // past the charge, or at its end when the cell is full
        const lk = dd.late > 1000 ? Math.max(0.03, Math.min(1 - lit, dd.late / dd.cap * 20)) : 0;   // late costs are small next to payroll: drawn at 20x so the line reads, sized on hover in dollars
        b.style.setProperty("--leak", (lk * 100).toFixed(2) + "%"); b.classList.toggle("has-leak", lk > 0);
        b.classList.toggle("dim", !!c.dim && dd.dept !== c.dim);
      });
      const fig = u.querySelector(".bud-fig"); fig.textContent = held && !sweeping && c.t >= 12 ? `${money(st.spent)} spent` : reading(st, c.t); placeFig(u, fig);
      const pl = u.querySelector(".bud-pl"); if (pl) pl.textContent = (x.tag ? x.tag + " \u00b7 " : "") + reading(st, c.t);   // the reading lives on the plate, where it can be read
    });
    // a Roost's Flyway: one labelled cell on the machine's head, what it changes in the year
    const fy = c.fxYear && c.fxYear.depts.length ? c.fxYear : null, sg = v => (v > 0 ? "+" : "\u2212") + money(Math.abs(v));
    cell.innerHTML = fy ? `<em>${term("Flyway")}</em> ` + [Math.abs(fy.crews) >= 500 ? sg(fy.crews) + " crews" : "", Math.abs(fy.late) >= 500 ? sg(fy.late) + " late costs" : ""].filter(Boolean).join(" \u00b7 ") : "";
    cell.classList.toggle("on", !!fy);
    if (!anim) { const ns = host.querySelectorAll(".bud-band, .bud-band i"); ns.forEach(n => { n.style.transition = "none"; }); void host.offsetWidth; ns.forEach(n => { n.style.transition = ""; }); }   // one forced layout, not one per band
    // the compact gauge: the first battery's figure (in Compare: A and B)
    const g0 = c.states[0].st, figs = c.states.map(x => (x.tag ? x.tag + " " : "") + reading(x.st, c.t)).join("  ");
    [gauge, mxGauge].forEach(g => { if (!g) return;
      g.querySelectorAll(".bg-bar i").forEach((n, k) => { const dd = g0.depts[k]; n.style.flexGrow = (dd.share * 1000).toFixed(1); n.firstChild.style.width = (Math.max(0, Math.min(1, dd.frac)) * 100).toFixed(1) + "%"; n.classList.toggle("dim", !!c.dim && dd.dept !== c.dim); });
      g.querySelector(".bg-fig").textContent = figs; g.setAttribute("aria-label", `${LABEL}: ${figs}, ${throughTxt(c.t)}.`); });
    const fxs = c.fxYear && c.fxYear.depts.length ? ` The flyway changes the year by ${money(c.fxYear.crews)} in crews${Math.abs(c.fxYear.late) >= 500 ? ` and ${money(c.fxYear.late)} in late costs` : ""}.` : "";
    sr.textContent = `${LABEL}: ` + c.states.map(x => (c.t <= 0 ? `${x.tag ? x.tag + ", " : ""}full, ${money(x.st.full)} for 2025` : `${x.tag ? x.tag + ", " : ""}${B.figure(x.st)} of ${money(x.st.full)}, spent ${throughTxt(c.t)}, of it ${money(x.st.late)} in late costs`)).join("; ") + "." + fxs;
  }

  // ==== hover: one band's dollars
  function showTip(u, b) {
    const st = u._st; if (!st) return; const k = u._bands.indexOf(b), dd = st.depts[k], fl = u._fx && u._fx.depts.find(f => f.dept === dd.dept);
    tip.innerHTML = `${root.TerryIcons ? root.TerryIcons.dept(dd.dept, "tip-ic", "width:15px;height:15px;margin:-3px 5px 0 0;vertical-align:middle") : ""}<b>${dd.name}</b> <span>${Math.round(dd.share * 100)}% of the budget</span><br>${money(dd.cap)} budget; ${money(dd.spent)} spent ${throughTxt(u._t)}` +
      `${dd.late >= 500 ? `, of it ${money(dd.late)} late costs` : ""}; ${dd.left >= 0 ? money(dd.left) + " left" : money(-dd.left) + " over"}.` +
      (fl ? `<br><em>Flyway</em>: ${[Math.abs(fl.crews) >= 500 ? (fl.crews >= 0 ? "+" : "\u2212") + money(Math.abs(fl.crews)) + " crews" : "", Math.abs(fl.late) >= 500 ? (fl.late >= 0 ? "+" : "\u2212") + money(Math.abs(fl.late)) + " late costs" : ""].filter(Boolean).join(", ")} ${throughTxt(u._t)}.` : "") +
      (k === 0 && B.insure && !u._tag ? "" : "");
    tip.hidden = false;
    const r = b.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + "px"; tip.style.top = Math.max(8, r.top - th - 10) + "px";
  }
  function hideTip() { if (tip) tip.hidden = true; }

  // ==== playing the plan drains it month by month
  function sweep() {
    clearInterval(sweepT); if (reduced()) return;
    sweeping = true; held = false; cursor = 0; render();
    clearTimeout(settleT);
    sweepT = setInterval(() => { cursor += 1; if (cursor >= 12) { clearInterval(sweepT); sweeping = false; held = true; if (!playing) settle(); } render(); }, 260);
  }
  function stopSweep() { clearInterval(sweepT); sweeping = false; }
  // after the play ends, December's reading holds about 2 seconds, then the battery settles back to the full year
  function settle() { clearTimeout(settleT); settleT = setTimeout(() => { settleT = 0; if (sweeping || !held) return; held = false; render(); }, 2000); }

  // ==== the enlarged screen: a compact gauge in its window
  function maxi(on) {
    if (!B) return;
    if (on) { const w = doc.querySelector(".mx-win"); if (w && !w.contains(mxGauge)) { mxGauge = gaugeEl("in-mx"); w.appendChild(mxGauge); } }
    else if (mxGauge) { mxGauge.remove(); mxGauge = null; }
    render(true);
  }

  let tmr = 0; const poke = () => { clearTimeout(tmr); tmr = setTimeout(() => render(), 120); };
  ["screen:level", "screen:draw", "plan:view", "roost:activated", "roost:closed", "compare:open", "compare:close"].forEach(e => Bus.on(e, () => { if (!sweeping) poke(); }));
  ["screen:level", "roost:activated", "roost:closed", "compare:open", "compare:close"].forEach(e => Bus.on(e, () => { if (!sweeping) held = false; }));   // a new view settles back to full
  Bus.on("compare:open", () => setTimeout(() => { if (host && root.TerryAlmanac) root.TerryAlmanac.fit(); }, 140));
  Bus.on("compare:close", () => setTimeout(() => { if (host && root.TerryAlmanac) root.TerryAlmanac.fit(); }, 140));
  Bus.on("ledger:plan", () => { if (sweeping) return; held = false; if (host && root.TerryAlmanac) root.TerryAlmanac.fit(); else poke(); });   // the ledger's plan switch: one battery or two
  Bus.on("plan:play", p => { playing = true; if (!(p && p.reduced)) sweep(); });
  Bus.on("plan:stop", () => { playing = false; stopSweep(); poke(); if (held) settle(); });
  Bus.on("theme:changed", () => { units.forEach(u => { const i = u.querySelector(".bud-img"), h = u.querySelector(".bud-sheen"); if (i) i.src = SRC[theme()]; if (h) h.src = SHEEN[theme()]; }); render(true); });
  Bus.on("screen:pull", p => { if (p && p.maximized !== undefined) { const on = !!p.maximized; if (on !== !!mxGauge) setTimeout(() => maxi(on), 60); } });
  Bus.on("almanac:settled", () => { if (!host && root.TerryAlmanac) root.TerryAlmanac.fit(); poke(); });
  addEventListener("scroll", hideTip, { passive: true });

  const api = { fit, clear: 0, top: 0, refresh: () => render(true), get state() { return last && compute(); }, get sweeping() { return sweeping; } };
  root.TerryBudgeterry = api;
})(typeof window !== "undefined" ? window : globalThis);
