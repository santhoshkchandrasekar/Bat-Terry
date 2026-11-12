/* Terry v3 shell: the leaf frames (Echolocation left, Terrytory right, the Ping dock at the bottom), pin and reflow, and the
 * Echolocation timeline with Go back here and Compare picking. Spec: redesign/V3_SPEC.md B, D5, E2, I3.
 *
 *   window.TerryShell = { LEAF, leaf(side) -> {el, body, setBadge(n), open(), close(), pin(on), isPinned()}, dock, fabricRect(),
 *                         logAction(entry), emitCompare(a, b), onReady(fn), setHandlers(h), h }
 *
 * Talks to the other engineers only through TerryBus / TerryState / TerryRoost (spec I1); each is feature-detected, so the shell
 * also runs (with an empty timeline) when they are not loaded.
 */
(function (root) {
  "use strict";
  const doc = document;
  const $ = (s, r) => (r || doc).querySelector(s);
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---------------------------------------------------------------- bus access (feature-detected)
  const local = {}; const LB = { on(e, f) { (local[e] = local[e] || []).push(f); }, off(e, f) { local[e] = (local[e] || []).filter(x => x !== f); }, emit(e, p) { (local[e] || []).slice().forEach(f => { try { f(p); } catch (x) { console.warn(e, x); } }); } };
  const bus = () => root.TerryBus || LB;
  const on = (e, f) => bus().on(e, f);
  const emit = (e, p) => bus().emit(e, p);
  const State = () => root.TerryState || { roosts: [], log: [], activeRoost: null, busy: false, compare: null, theme: "day" };
  const Roost = () => root.TerryRoost || null;

  // ---------------------------------------------------------------- the leaf silhouette (one source for every size)
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const PROFILE = {
    // broad ovate blade, widest a little past the middle, a drip tip at the end
    blade: u => 47 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 0.85))), 0.45) * (1 - 0.5 * sstep(0.8, 1, u)),
    // the dock: a long leaf, nearly full height along the input, rounded at the stem end, pointed at the tip
    dock: u => 49 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 0.55))), 0.3) * (1 - 0.4 * sstep(0.9, 1, u)),
  };
  const cx = (kind, u) => (kind === "blade" ? 50 + 3 * Math.sin(Math.PI * u) : 50);
  const r2 = v => Math.round(v * 100) / 100;
  function outline(kind, N) {
    N = N || 56; const f = PROFILE[kind], right = [], left = [];
    for (let i = 0; i <= N; i++) { const u = i / N, c = cx(kind, u), h = f(u); right.push([c + h * 0.94, u * 100]); left.push([c - h * 1.04, u * 100]); }
    const pts = right.concat(left.reverse().slice(1));
    return kind === "dock" ? pts.map(p => [p[1], p[0]]) : pts;   // the dock lies along the ground: stem left, tip right
  }
  const pathOf = pts => "M" + pts.map(p => r2(p[0]) + " " + r2(p[1])).join("L") + "Z";
  const unit = pts => "M" + pts.map(p => r2(p[0] / 100) + " " + r2(p[1] / 100)).join("L") + "Z";
  function veins(kind) {
    const f = PROFILE[kind], rib = [], sides = [];
    if (kind === "blade") {
      for (let i = 0; i <= 20; i++) { const u = i / 20; rib.push(r2(cx(kind, u)) + " " + r2(u * 100)); }
      for (let k = 0; k < 7; k++) {
        const u0 = 0.2 + k * 0.095, u1 = u0 + 0.1;
        for (const s of [-1, 1]) {
          const sx = cx(kind, u0), sy = u0 * 100, ex = cx(kind, u1) + s * f(u1) * 0.82 * (s < 0 ? 1.04 : 0.94), ey = u1 * 100 + 2;
          sides.push(`M${r2(sx)} ${r2(sy)}Q${r2(sx + s * f(u0) * 0.5)} ${r2(sy + 0.4)} ${r2(ex)} ${r2(ey)}`);
        }
      }
      return { rib: "M" + rib.join("L"), sides };
    }
    return { rib: "M0 0", sides };
  }
  // the open form: a glass sheet with a leaf-shaped head and straight sides (unit box; the head is .14 of the height)
  function sheetPts() {
    const P = [], bez = (p0, p1, p2, p3, n) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; P.push([u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]); } };
    P.push([50, 0]);
    bez([50, 0], [80, 2], [98, 6], [100, 14], 10); P.push([100, 90]);
    bez([100, 90], [100, 95], [62, 98.5], [50, 100], 8); bez([50, 100], [38, 98.5], [0, 95], [0, 90], 8); P.push([0, 14]);
    bez([0, 14], [2, 6], [20, 2], [50, 0], 10);
    return P;
  }
  const LEAF = {
    // blade(w, h): the silhouette as a path in pixel coordinates for a w x h box (spec B1)
    blade(w, h, kind) { const pts = outline(kind || "blade").map(p => [p[0] * w / 100, p[1] * h / 100]); return "M" + pts.map(p => r2(p[0]) + " " + r2(p[1])).join("L") + "Z"; },
    outline, veins,
    sheet(w, h) { return "M" + sheetPts().map(p => r2(p[0] * w / 100) + " " + r2(p[1] * h / 100)).join("L") + "Z"; },
  };

  function injectDefs() {
    if ($("#lf-defs")) return;
    const bl = outline("blade"), dk = outline("dock");
    const d = unit(bl), dd = unit(dk);
    const s = el("div", "lf-defs"); s.id = "lf-defs"; s.setAttribute("aria-hidden", "true");
    s.innerHTML = `<svg width="0" height="0" focusable="false"><defs>
      <clipPath id="lf-clip-l" clipPathUnits="objectBoundingBox"><path d="${d}"/></clipPath>
      <clipPath id="lf-clip-r" clipPathUnits="objectBoundingBox"><path transform="translate(1 0) scale(-1 1)" d="${d}"/></clipPath>
      <clipPath id="lf-clip-s" clipPathUnits="objectBoundingBox"><path d="${unit(sheetPts())}"/></clipPath>
      <clipPath id="lf-clip-d" clipPathUnits="objectBoundingBox"><path d="${dd}"/></clipPath>
      <linearGradient id="lfe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--lf-edge-a)"/><stop offset=".55" stop-color="var(--lf-edge-b)"/><stop offset="1" stop-color="var(--lf-edge-c)"/></linearGradient>
      <linearGradient id="lfed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--lf-edge-a)"/><stop offset=".6" stop-color="var(--lf-edge-b)"/><stop offset="1" stop-color="var(--lf-edge-c)"/></linearGradient>
      <radialGradient id="lft" cx=".5" cy=".52" r=".62"><stop offset=".5" stop-color="var(--lf-edge-b)" stop-opacity="0"/><stop offset="1" stop-color="var(--lf-edge-c)" stop-opacity=".34"/></radialGradient>
    </defs></svg>`;
    doc.body.appendChild(s);
  }
  function artSVG(kind) {
    const pts = outline(kind), d = pathOf(pts), v = veins(kind);
    return `<svg class="lf-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="lf-tint" d="${d}"/>
      <path class="lf-rib" d="${v.rib}"/>${v.sides.map(x => `<path class="lf-vein" d="${x}"/>`).join("")}
      <path class="lf-edge" d="${d}"/><path class="lf-hi" d="${d}" transform="translate(0.4 0.5)"/></svg>`;
  }
  const ICON = {
    sonar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10 10 4.5 19.5 4.5 19.5 14 14.5 19 5 19Z"/><path d="M5 19 14 10.5"/><circle cx="16.8" cy="16.8" r=".9" fill="currentColor" stroke="none"/><circle cx="19.2" cy="13.6" r=".9" fill="currentColor" stroke="none"/><circle cx="13.2" cy="18.9" r=".9" fill="currentColor" stroke="none"/></svg>',
    ear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C7 5.2 4.6 9.2 4.2 14.5c1.8-1.4 3.4-1.6 4.6-.8.8-1.6 2-2.3 3.2-2.3s2.4.7 3.2 2.3c1.2-.8 2.8-.6 4.6.8C19.4 9.2 17 5.2 12 3Z" fill="currentColor" fill-opacity=".18"/><path d="M9.4 18.6c.8.9 1.7 1.4 2.6 1.4s1.8-.5 2.6-1.4"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3.5 20.5 9.5 17.6 10.6 13.8 14.4 14 18 12.2 19.8 4.2 11.8 6 10 9.6 10.2 13.4 6.4Z"/><path d="M8.2 15.8 3.5 20.5"/></svg>',
  };

  // ---------------------------------------------------------------- geometry
  const W = () => doc.documentElement.clientWidth || innerWidth;
  const H = () => innerHeight;
  function fabricRect() {
    const f = $("#fab"), r = f && f.getBoundingClientRect();
    if (r && r.width > 40) return r;
    const w = W(), l = Math.round(w * 0.215); return { left: l, right: w - l * 1.01, top: 400, bottom: 815, width: w - 2 * l, height: 415 };
  }
  const wide = () => W() >= 1560;
  const sizes = {
    rest: () => ({ w: wide() ? 116 : 108, h: wide() ? 206 : 196 }),
  };
  let pins = { left: store.get("terry.leaf.left") === "1", right: store.get("terry.leaf.right") === "1" };

  // ---------------------------------------------------------------- the leaf factory
  const leaves = {};
  function makeLeaf(side, cfg) {
    const host = $("#leaf-" + side) || doc.body.appendChild(el("aside"));
    host.id = "leaf-" + side; host.className = "leaf"; host.dataset.side = side; host.dataset.state = "rest"; host.dataset.shape = "blade";
    host.setAttribute("aria-label", cfg.title);
    host.innerHTML = `<svg class="lf-stem" viewBox="0 0 10 26" aria-hidden="true"><path d="M3.6 0H6.4L7 14C7.1 19 6 23 5 26 4 23 2.9 19 3 14Z"/></svg>
      <div class="lf-blade"><i class="lf-shadow"></i><div class="lf-glass"></div>${artSVG("blade")}<div class="lf-cap" aria-hidden="true"><i class="lf-capg"></i><svg viewBox="0 0 140 30"><path d="M0 30C30 30 58 16 70 0C82 16 110 30 140 30"/></svg></div><i class="lf-spill"></i>
        <div class="lf-label" aria-hidden="true">${esc(cfg.label || cfg.title)}</div><span class="lf-count" hidden></span>
        <div class="lf-body"><h2><span class="lf-t">${esc(cfg.title)}</span><button type="button" class="lf-info" aria-label="About this" data-tip="${esc(cfg.info || cfg.sub)}">i</button></h2><p class="lf-sub">${esc(cfg.sub)}</p><div class="lf-scroll" data-scroll></div></div>
        <button type="button" class="lf-pin" aria-pressed="false" aria-label="Pin open" title="Pin open">${ICON.pin}</button>
        <button type="button" class="lf-stembtn" aria-expanded="false" aria-label="${esc(cfg.title)}: ${esc(cfg.tip)}" title="${esc(cfg.tip)}">${ICON[cfg.icon]}</button>
      </div>`;
    const L = { side, el: host, cfg, state: "rest", count: 0, h: 0, timers: {} };
    L.stem = $(".lf-stembtn", host); L.pinBtn = $(".lf-pin", host); L.body = $("[data-scroll]", host); L.badge = $(".lf-count", host);
    L.setBadge = n => { L.count = n; L.badge.hidden = !n; L.badge.textContent = n > 9 ? "9+" : String(n); L.stem.setAttribute("aria-label", `${cfg.title}: ${cfg.tip}${n ? ", " + n + " new" : ""}`); };
    L.dims = () => {
      const fr = fabricRect(), w = W(), vh = H(), both = pins.left && pins.right;
      const room = side === "left" ? fr.left - 18 : w - fr.right - 18;
      if (L.state === "pinned") {
        // a pinned sheet that would crush the fabric floats over the page instead (see applyGutters)
        const pw = both ? Math.min(300, Math.max(240, room)) : Math.min(360, Math.max(260, room));
        return { w: pw, h: Math.max(420, vh - 58) };
      }
      if (L.state === "open") {
        const maxw = wide() ? 330 : 300, ow = Math.min(maxw, w - 40);   // a hover-open sheet floats over the page, so it takes its full width instead of squeezing into the gutter
        const hh = cfg.height ? cfg.height(L) : Math.min(620, vh - 60);
        return { w: ow, h: Math.max(cfg.minH || 420, Math.min(hh, vh - 130)) };
      }
      return sizes.rest();
    };
    L.shape = s => { host.dataset.shape = s; };
    L.apply = () => {
      const was = host.dataset.state, d = L.dims(); L.h = d.h;
      host.style.setProperty("--w", d.w + "px"); host.style.setProperty("--h", d.h + "px");
      host.classList.toggle("compact", L.state !== "rest" && d.w < 250);
      host.dataset.state = L.state; L.stem.setAttribute("aria-expanded", String(L.state !== "rest")); L.pinBtn.setAttribute("aria-pressed", String(L.state === "pinned"));
      const t = L.state === "pinned" ? "Unpin" : "Pin open"; L.pinBtn.setAttribute("aria-label", t); L.pinBtn.title = t;
      // the silhouette is the collapsed state only: an open leaf is a sheet with a leaf-shaped head and straight sides
      clearTimeout(L.timers.shape);
      if (L.state !== "rest") L.shape("sheet");
      else if (was !== "rest" && !reduced()) L.timers.shape = setTimeout(() => L.shape("blade"), 400); else L.shape("blade");
      // the expanded body is laid out in its target box so text never reflows mid-unfurl
      const ex = L.state === "rest" ? (() => { const s = L.state; L.state = "open"; const o = L.dims(); L.state = s; return o; })() : d;
      const bd = $(".lf-body", host); bd.style.width = ex.w + "px"; bd.style.height = ex.h + "px"; bd.style.inset = "auto"; bd.style.left = "0"; bd.style.top = "0";
      if (side === "right") bd.style.left = "auto", bd.style.right = "0";
      // a hover-open leaf keeps the nav (brand, Day and Night) clear of itself, as a pinned overlay does
      const pg = $("#page"); if (pg && L.state !== "pinned") { const padNow = Math.max(124, (W() - 1220) / 2); pg.style.setProperty("--ov-" + (side === "left" ? "l" : "r"), (L.state === "open" ? Math.max(0, d.w + 26 - padNow) : 0) + "px"); }
    };
    L.open = () => { clearTimeout(L.timers.close); if (L.state === "rest") { clearTimeout(L.timers.open); L.state = "open"; L.apply(); if (cfg.onOpen) cfg.onOpen(L); } };
    L.close = (now) => {
      clearTimeout(L.timers.open); clearTimeout(L.timers.close);
      const go = () => { if (L.state === "open") { L.state = "rest"; L.apply(); } };
      if (now || reduced()) go(); else L.timers.close = setTimeout(go, 420);
    };
    L.pin = (v, quiet) => {
      v = !!v; if (v === (L.state === "pinned")) return;
      L.state = v ? "pinned" : (host.matches(":hover") || host.contains(doc.activeElement) ? "open" : "rest");
      pins[side] = v; store.set("terry.leaf." + side, v ? "1" : "0");
      leaves.left && leaves.left.apply(); leaves.right && leaves.right.apply(); reflow(side);
      if (!quiet) emit("leaf:pinned", { side, pinned: v });
      if (v && cfg.onOpen) cfg.onOpen(L);
    };
    L.isPinned = () => L.state === "pinned";
    host.addEventListener("pointerover", () => { if (L.state !== "rest") { clearTimeout(L.timers.close); return; } clearTimeout(L.timers.open); L.timers.open = setTimeout(L.open, reduced() ? 0 : 120); });
    host.addEventListener("pointerout", e => { if (e.relatedTarget && host.contains(e.relatedTarget)) return; clearTimeout(L.timers.open); if (L.state === "open" && !host.contains(doc.activeElement)) L.close(); });
    host.addEventListener("focusin", () => { if (L.state === "rest") L.open(); });
    host.addEventListener("focusout", e => { if (L.state === "open" && !host.contains(e.relatedTarget) && !host.matches(":hover")) L.close(); });
    L.stem.addEventListener("click", () => { L.pin(L.state !== "pinned"); if (L.state === "rest") L.open(); });
    L.pinBtn.addEventListener("click", () => L.pin(L.state !== "pinned"));
    host.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (cfg.onEsc && cfg.onEsc(L)) { e.stopPropagation(); return; }
      if (L.state === "pinned") { L.pin(false); L.stem.focus(); e.stopPropagation(); } else if (L.state === "open") { L.close(true); L.stem.focus({ preventScroll: true }); e.stopPropagation(); }
    });
    L.apply(); leaves[side] = L; return L;
  }

  // ---------------------------------------------------------------- reflow for pinned leaves (B5), deferred while the projector is busy
  let reflowSide = null, pendingReflow = false;
  function applyGutters() {
    const page = $("#page"); if (!page) return;
    const both = pins.left && pins.right, vw = W(), MINPAGE = 1300;
    // a pinned leaf narrows the page only while the fabric survives (page content of 1300 or more, so the cloth keeps four rows); otherwise it floats over the page
    const want = { left: pins.left ? 376 : 0, right: pins.right ? 376 : 0 };
    const reflowOK = !both && vw - (want.left + want.right) >= MINPAGE;
    const gl = reflowOK ? want.left : 0, gr = reflowOK ? want.right : 0;
    doc.documentElement.dataset.both = both ? "1" : "";
    for (const sd of ["left", "right"]) { const L = leaves[sd]; if (L) L.el.dataset.overlay = L.state === "pinned" && !reflowOK ? "1" : ""; }
    // an overlay sheet keeps the nav (brand, Day and Night) clear of itself
    const padNow = Math.max(124, (vw - 1220) / 2), ovw = side => { const L = leaves[side]; return L && L.state === "pinned" && !reflowOK ? Math.max(0, (parseFloat(L.el.style.getPropertyValue("--w")) || 360) + 26 - padNow) : 0; };
    page.style.setProperty("--ov-l", ovw("left") + "px"); page.style.setProperty("--ov-r", ovw("right") + "px");
    page.style.setProperty("--gutter-l", gl + "px"); page.style.setProperty("--gutter-r", gr + "px");
    // the page is narrowed with margins so its clientWidth is the room that is left; the rig and the chart fit themselves to it on resize
    const refit = () => { try { dispatchEvent(new Event("resize")); } catch (e) {} setTimeout(() => { try { root.__zoom && root.__zoom.relayout && root.__zoom.relayout(0); } catch (e) { console.warn("relayout", e && e.message); } }, 320); };
    refit(); clearTimeout(applyGutters.t); applyGutters.t = setTimeout(refit, 1100);
    if (!page._tend) { page._tend = true; page.addEventListener("transitionend", e => { if (e.target === page && /margin/.test(e.propertyName)) { clearTimeout(applyGutters.t); refit(); } }); }
  }
  function reflow(side) {
    reflowSide = side;
    if (State().busy) { pendingReflow = true; return; }
    pendingReflow = false; applyGutters();
  }

  // ---------------------------------------------------------------- Echolocation: one card per plan Terry found; tick two, then Compare
  const VCOL = { escaped: ["ESCAPED", "work"], already: ["ALREADY SAFE", "work"], partial: ["PARTLY", "behind"], unreachable: ["NO EXIT LEFT", "short"], short: ["SHORT OF GOAL", "short"] };
  const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let cards = [], ticks = [], cmpNow = null, newCards = 0, cardSeq = 1;
  const baseOf = c => cards.find(x => x.roostId === c.roostId && x.view === "stay" && x.kind === "roost");
  function goalShort(r) {
    const g = r.goal || {}, ms = (g.months || []).slice().sort((a, b) => a - b), mo = !ms.length || ms.length === 12 ? "2025" : ms.length === 1 ? MON3[ms[0] - 1] : `${MON3[ms[0] - 1]} to ${MON3[ms[ms.length - 1] - 1]}`;
    const SH = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional" }, dn = g.scope === "CITY" ? "Boston" : SH[g.scope] || g.scope || "Boston";
    return `${dn}, ${mo}, ${Math.round((g.target || 0) * 100)}%`;
  }
  function mkCard(o) {
    const R = Roost(); if (!R || !R.scenario) return null;
    const sc = R.scenario(o.spec); if (!sc) return null;
    return Object.assign({ id: "c" + cardSeq++, ref: Object.assign({}, o.spec, { label: o.name }), ontime: sc.ontime, win: sc.windowOntime, target: sc.target, months: sc.window.months }, o, { sc: null });
  }
  function reconcile() {
    const R = Roost(), S = State(), roosts = S.roosts || [];
    cards = cards.filter(c => roosts.some(r => r.id === c.roostId));
    for (const r of roosts) {
      if (cards.some(c => c.roostId === r.id && c.kind === "roost")) continue;
      const x = r.escape, dept = x && Object.keys(x.depts)[0], D = x && x.depts[dept], hire = D && (D.escape.added || []).find(h => h.action === "hire");
      const sign = hire ? `+${hire.crews} by ${hire.sign_by ? (+hire.sign_by.slice(8)) + " " + MON3[+hire.sign_by.slice(5, 7) - 1] : "in time"}` : "No change";
      const v = VCOL[x && x.verdict] || VCOL.partial;
      const fly = mkCard({ kind: "roost", roostId: r.id, view: "flyway", name: "Flyway", sub: sign, spec: { roostId: r.id, view: "flyway" }, stamp: v });
      const stay = mkCard({ kind: "roost", roostId: r.id, view: "stay", name: "Original plan", sub: "No change", spec: { roostId: r.id, view: "stay" }, stamp: null, base: true });
      if (fly && stay) { cards.push(fly, stay); newCards += 2; }
    }
  }
  function addAlertCard(name, sub, spec) {
    const S = State(), rid = S.activeRoost; if (rid == null || !Roost()) return;
    const r = (S.roosts || []).find(x => x.id === rid); if (!r) return;
    const c = mkCard({ kind: "alert", roostId: rid, view: r.view || "flyway", name, sub, spec: Object.assign({ roostId: rid, view: r.view || "flyway" }, spec) }); if (!c) return;
    c.stamp = c.win >= c.target ? VCOL.already : VCOL.short; cards.unshift(c); cards = cards.filter((x, i) => x.kind !== "alert" || i < 6); newCards++; renderEcho();
  }
  function spark(c) {
    const b = baseOf(c); if (!b || c === b || !c.ontime || !b.ontime) return "";
    if (!c.ontime.some((v, i) => Math.abs(v - b.ontime[i]) >= 0.005)) return "";
    const W = 64, H = 18, vals = c.ontime, lo = Math.min(...vals, ...b.ontime), hi = Math.max(...vals, ...b.ontime), rng = Math.max(0.01, hi - lo);
    const pts = vals.map((v, i) => `${(i * W / 11).toFixed(1)},${(2 + (H - 7) * (1 - (v - lo) / rng)).toFixed(1)}`).join(" ");
    const ticksM = (c.months || []).map(m => `<rect x="${((m - 1) * W / 11 - 2.5).toFixed(1)}" y="0" width="${(W / 11).toFixed(1)}" height="${H}" fill="var(--pred)" opacity=".13"><title>${MON3[m - 1]}: the goal month</title></rect>`).join("");
    return `<svg class="ec-sp" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="On time by month">${ticksM}<polyline points="${pts}" fill="none" stroke="var(--planned, #5F82AB)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  }
  function cardEl(c) {
    const S = State(), r = (S.roosts || []).find(x => x.id === c.roostId), ti = ticks.indexOf(c.id), full = ticks.length >= 2 && ti < 0;
    const cur = !cmpNow && r && S.activeRoost === r.id && c.kind === "roost" && (r.view || "flyway") === c.view;
    const li = el("li", "ec" + (c.base && ti < 0 && !cur ? " dim" : "")); if (cur) li.setAttribute("aria-current", "true"); li.dataset.id = c.id;
    const st = c.stamp ? `<span class="ec-st ${c.stamp[1]}"><i></i>${c.stamp[0]}</span>` : "";
    li.innerHTML = `<button type="button" class="ec-tick" role="checkbox" aria-checked="${ti >= 0}" ${full ? 'aria-disabled="true"' : ""} aria-label="Tick ${esc(c.name)} to compare">${ti === 0 ? '<b class="a">A</b>' : ti === 1 ? '<b>B</b>' : ""}${ti < 0 ? "" : ""}</button>
      <div class="ec-main" tabindex="0" role="button" aria-label="Show ${esc(c.name)} on the screen"><span class="ec-n">${esc(c.name)}</span><span class="ec-s">${esc(c.sub)}</span>${spark(c)}</div>
      <div class="ec-r"><span class="ec-v">${(c.win * 100).toFixed(1)}%</span><span class="ec-g">of ${Math.round((c.target || 0) * 100)}% goal</span>${st}</div>`;
    const tk = li.querySelector(".ec-tick");
    tk.addEventListener("click", () => toggleTick(c.id));
    const go = () => { const R = Roost(); if (!R || c.kind !== "roost" && !c.spec) return; if (cmpNow) emit("compare:close", {}); if (R.activate && State().activeRoost !== c.roostId) R.activate(c.roostId); if (c.kind === "roost" && R.setView) R.setView(c.roostId, c.view); else R.openCompare && R.openCompare({ roostId: c.roostId, view: c.view, label: "Today's plan" }, c.ref); };
    const mn = li.querySelector(".ec-main"); mn.addEventListener("click", go); mn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    tk.addEventListener("keydown", e => { if (e.key === " ") { e.preventDefault(); toggleTick(c.id); } });
    return li;
  }
  function toggleTick(id) {
    const i = ticks.indexOf(id); if (i >= 0) ticks.splice(i, 1); else if (ticks.length < 2) ticks.push(id); renderEcho();
    const t = $(`#leaf-left .ec[data-id="${id}"] .ec-tick`); if (t) t.focus({ preventScroll: true });
  }
  function doCompare() {
    const a = cards.find(c => c.id === ticks[0]), b = cards.find(c => c.id === ticks[1]); if (!a || !b) return;
    shell.emitCompare(Object.assign({}, a.ref, { _key: a.id }), Object.assign({}, b.ref, { _key: b.id }));
  }
  function renderEcho() {
    const L = leaves.left; if (!L) return; reconcile();
    const S = State(), roosts = S.roosts || [], box = L.body, keep = box.scrollTop;
    ticks = ticks.filter(id => cards.some(c => c.id === id));
    const sub = $(".lf-body .lf-sub", L.el); if (sub) { sub.textContent = ticks.length === 1 ? "Tick one more to compare." : ""; sub.hidden = ticks.length !== 1; }
    box.textContent = "";
    if (!cards.length) { box.appendChild(el("p", "el-empty", "No echoes yet. Chase a goal and its plan lands here as a card.")); renderFoot(L); return; }
    const ul = el("div", "ec-stack");
    for (const r of roosts) {
      const mine = cards.filter(c => c.roostId === r.id && c.kind === "roost"); if (!mine.length) continue;
      const g = el("section", "ec-group"), trace = (document.querySelector(`.rbody[data-r="${r.id}"]`) || {}).dataset, tt = trace && trace.trace || "";
      g.innerHTML = `<h3 title="${esc(tt)}"><span class="el-plate">R${esc(r.n)}</span>${esc(goalShort(r).replace(/, (\d+%)$/, ", $1"))}</h3>`;
      const ol = el("ol", "ec-list"); mine.forEach(c => ol.appendChild(cardEl(c))); g.appendChild(ol); ul.appendChild(g);
    }
    const al = cards.filter(c => c.kind === "alert");
    if (al.length) { const g = el("section", "ec-group"); g.innerHTML = `<h3>AFTER A PING</h3>`; const ol = el("ol", "ec-list"); al.forEach(c => ol.appendChild(cardEl(c))); g.appendChild(ol); ul.appendChild(g); }
    box.appendChild(ul); box.scrollTop = keep; renderFoot(L); if (L.state === "open") requestAnimationFrame(() => L.apply());
  }
  function renderFoot(L) {
    let f = $(".ec-foot", L.el.querySelector(".lf-body")); if (!f) { f = el("div", "ec-foot"); L.el.querySelector(".lf-body").appendChild(f); }
    f.textContent = ""; f.hidden = !(ticks.length === 2 || cmpNow);
    if (cmpNow) { const b = el("button", "ec-btn ghost", "Close comparison"); b.type = "button"; b.addEventListener("click", () => emit("compare:close", {})); f.appendChild(b); }
    else if (ticks.length === 2) { const b = el("button", "ec-btn", "Compare these two"); b.type = "button"; b.addEventListener("click", doCompare); f.appendChild(b); }
  }
  // the Echolocation sheet hugs its cards: header, the cards as laid out, the footer button, never taller than 620 or the window
  const echoHeight = () => {
    const L = leaves.left, sc = L && L.body, bd = sc && sc.closest(".lf-body"); if (!sc || !bd || !sc.clientHeight) return 420;
    const f = sc.firstElementChild, l = sc.lastElementChild, content = f ? l.offsetTop + l.offsetHeight - f.offsetTop : 0, over = bd.offsetHeight - sc.clientHeight; return Math.min(620, Math.max(250, over + content + 30 + 14));
  };

  // ---------------------------------------------------------------- the dock frame (ping.js fills the body)
  function makeDock() {
    const host = $("#dock") || doc.body.appendChild(el("div")); host.id = "dock"; host.className = "dock"; host.dataset.mode = "rest";
    host.setAttribute("role", "search"); host.setAttribute("aria-label", "Ping Terry"); host.removeAttribute("style");
    host.innerHTML = `<button type="button" class="dk-terry" aria-label="Ping Terry"><svg class="i" aria-hidden="true"><use href="#i-bat"/></svg></button><span class="dk-rings" aria-hidden="true"><i></i><i></i><i></i></span><div class="dk-cap"><div class="lf-body"></div></div>`;
    host.querySelector(".dk-terry").addEventListener("click", () => { const f = host.querySelector(".dk-in"); if (f) f.focus({ preventScroll: true }); });
    host.style.removeProperty("--w"); return { el: host, body: $(".lf-body", host) };
  }

  // ---------------------------------------------------------------- public pieces
  let handlers = null; const readyFns = [];
  const shell = {
    LEAF, ICON, el, esc, reduced, store, fabricRect, emit, on, State, Roost, leaves,
    leaf: s => leaves[s],
    // open a leaf from code (CORE's next-step links). Focus stays inside it, so it does not close when no pointer is over it.
    open(side) { const L = leaves[side === "right" ? "right" : "left"]; if (!L) return false; L.open(); try { L.stem.focus({ preventScroll: true }); } catch (e) {} return true; },
    // one place that builds the model-or-rules services (ask agent, intake, stream, flyover); used by Ping and Terrytory
    ensure() {
      if (shell._ctx) return shell._ctx;
      shell._ctx = (async () => {
        const h = handlers || {}; let sample = null;
        try { sample = h.getSample ? await h.getSample() : root.terryHost && root.terryHost.use ? await root.terryHost.use("sample") : null; } catch (e) { sample = null; }
        const Tl = root.TerryLive && h.E ? root.TerryLive.create(h.E, sample) : null;
        return { sample, Tl, A: root.TerryAsk && h.E ? root.TerryAsk.create(h.E, h.Z, sample, { plan: h.plan }) : null, I: root.TerryIntake && h.E ? root.TerryIntake.create(h.E, sample) : null,
                 S: root.TerryStream && Tl ? root.TerryStream.create(h.E, Tl, sample) : null, F: root.TerryFlyover && Tl ? root.TerryFlyover.create(h.E, Tl, sample) : null };
      })();
      return shell._ctx;
    },
    get h() { return handlers; },
    setHandlers(h) { handlers = h; readyFns.splice(0).forEach(f => { try { f(h); } catch (e) { console.warn("shell ready", e); } }); },
    onReady(f) { if (handlers) f(handlers); else readyFns.push(f); },
    logAction(entry) {
      const R = Roost(); const S = State();
      const e = Object.assign({ kind: "action", roostId: S.activeRoost == null ? null : S.activeRoost, t: Date.now() }, entry);
      if (R && R.log) R.log(e); else { (root.TerryState || (root.TerryState = State())); (root.TerryState.log = root.TerryState.log || []).push(Object.assign({ id: "s" + Date.now() }, e)); emit("action:logged", { entry: e }); }
    },
    emitCompare(a, b) {
      // a and b are scenario specs {label, roostId, view, events, _key}; TerryRoost.scenario builds the sides from the model (spec E1)
      const c = x => { const o = Object.assign({}, x); delete o._key; return o; };
      cmpNow = { aKey: a._key, bKey: b._key }; const R = Roost(); let ok = false;
      if (R && R.openCompare) { try { ok = R.openCompare(c(a), c(b)); } catch (e) { console.warn("compare", e && e.message); } }
      if (!ok) { shell.logAction({ kind: "compare", label: "Opened a comparison" }); emit("compare:open", { a: c(a), b: c(b) }); }
      renderEcho(); return ok;
    },
    // exposed for tests and for the other engineers' call sites
    pins: () => Object.assign({}, pins), render: renderEcho, applyGutters,
  };

  function init() {
    try {
      injectDefs();
      const left = makeLeaf("left", { title: "Roost", label: "Roost", sub: "", info: "Every plan Terry found, as a card: the flyway and the original plan for each goal. Tick two cards to compare them on the screen.", tip: "Every plan Terry found, as a card", icon: "sonar", height: echoHeight, minH: 250,
        onOpen: L => { newCards = 0; L.setBadge(0); L.el.dataset.seen = "1"; renderEcho(); }, onEsc: () => { if (!ticks.length) return false; ticks = []; renderEcho(); return true; } });
      const right = makeLeaf("right", { title: "Terrytory", label: "Terrytory", sub: "What residents are saying, and what Terry heard.", tip: "Residents, intake and alerts", icon: "leaf", height: () => 560,
        onOpen: () => {} });
      shell.dock = makeDock();
      let unread = 0;
      const refresh = () => { renderEcho(); if (left.state === "rest") left.setBadge(newCards); };
      for (const ev of ["roost:created", "roost:activated", "roost:closed", "action:restore", "plan:view"]) on(ev, refresh);
      on("compare:open", () => { if (!cmpNow) cmpNow = {}; renderEcho(); });
      on("compare:close", () => { cmpNow = null; ticks = []; renderEcho(); });
      on("stream:alert", p => { const a = p && p.alert; if (a && a.kind === "surge" && a.scene && root.TerryStream) { const E = root.__zoom && root.__zoom.E; addAlertCard(`If the ${a.dept && E && E.depts[a.dept] ? E.depts[a.dept].name : "department"} surge lasts a week`, `+${Math.round(a.scene.surge * 100)}% for 7 days`, { dept: a.dept, dayMult: root.TerryStream.surgeMult(root.TerryTerritory.surgeStart((State().roosts || []).find(x => x.id === State().activeRoost) || {}, a.scene.t), 7, a.scene.surge) }); left.setBadge(newCards); } });
      on("ask:answered", p => { const r = p && p.r, evs = r && r.events; if (evs && evs.length) { addAlertCard("After: " + String(p.q || r.label || "an alert").slice(0, 32), String(r.label || "").slice(0, 60), { events: evs, dept: evs[0].dept }); left.setBadge(newCards); } });
      on("proj:idle", () => { if (pendingReflow) { pendingReflow = false; applyGutters(); } });
      on("theme:changed", () => {});
      addEventListener("resize", () => { left.apply(); right.apply(); });
      // the dock steps aside while the page scrolls down and returns on scroll up; it never hides while in use
      const dock = shell.dock.el, handle = el("button", "dock-handle"); handle.type = "button"; handle.setAttribute("aria-label", "Show Ping Terry"); handle.hidden = true; doc.body.appendChild(handle);
      let lastY = scrollY;
      const busyDock = () => dock.contains(doc.activeElement) || dock.dataset.mode === "chips" || dock.dataset.mode === "answer" || dock.dataset.busy === "1" || dock.matches(":hover");
      const showDock = () => { dock.removeAttribute("data-hidden"); handle.hidden = true; };
      const hideDock = () => { if (busyDock()) return; dock.dataset.hidden = "1"; handle.hidden = false; };
      const onScroll = () => {
        const y = scrollY, max = doc.documentElement.scrollHeight - innerHeight;
        dock.dataset.overContent = y > 120 ? "1" : "";
        if (y > lastY + 8 && y > 120 && y < max - 8) { hideDock(); lastY = y; }
        else if (y < lastY - 8 || y <= 4 || y >= max - 8) { showDock(); lastY = y; }
      };
      addEventListener("scroll", onScroll, { passive: true });
      handle.addEventListener("pointerenter", showDock); handle.addEventListener("click", () => { showDock(); const i = $(".dk-in", dock); if (i) i.focus({ preventScroll: true }); });
      dock.addEventListener("focusin", showDock);
      doc.addEventListener("keydown", e => { if (e.key === "/" && dock.dataset.hidden === "1" && !/INPUT|TEXTAREA/.test((doc.activeElement || {}).tagName || "")) showDock(); });
      // keep the Night edge glow tied to the screen's brightness when the screen layer publishes it
      renderEcho();
      if (pins.left) left.pin(true, true); if (pins.right) right.pin(true, true);
      if (pins.left || pins.right) { left.apply(); right.apply(); applyGutters(); }
    } catch (e) { console.warn("shell init failed", e); try { emit("error", { module: "shell", e }); } catch (x) {} }
  }
  root.TerryShell = shell;
  // the sidebars' "i" note (owner 7 Nov: it was cut off by the leaf's edge): drawn in one floating box on the page, not inside the leaf,
  // placed under the button and kept on screen (above it when there is no room below); Escape, leaving or scrolling hides it
  (function infoTips() {
    let box = null, on = null;
    const make = () => { if (box) return box; box = doc.createElement("div"); box.className = "lf-tipfloat"; box.setAttribute("role", "tooltip"); box.id = "lf-tipfloat"; doc.body.appendChild(box); return box; };
    const hide = () => { if (!box || !on) return; box.classList.remove("on"); on.removeAttribute("aria-describedby"); on = null; };
    const show = b => {
      const t = b.getAttribute("data-tip"); if (!t) return; const x = make(); x.textContent = t; on = b; b.setAttribute("aria-describedby", x.id);
      x.style.left = "0px"; x.style.top = "0px"; x.classList.add("on");
      const r = b.getBoundingClientRect(), w = x.offsetWidth, h = x.offsetHeight, m = 8;
      const left = Math.max(m, Math.min(innerWidth - w - m, r.left + r.width / 2 - w / 2));
      const top = r.bottom + 8 + h <= innerHeight - m ? r.bottom + 8 : Math.max(m, r.top - 8 - h);
      x.style.left = Math.round(left) + "px"; x.style.top = Math.round(top) + "px";
    };
    doc.addEventListener("pointerover", e => { const b = e.target.closest && e.target.closest(".lf-info"); if (b && b !== on) show(b); else if (!b && on) hide(); });
    doc.addEventListener("focusin", e => { const b = e.target.closest && e.target.closest(".lf-info"); if (b) show(b); else hide(); });
    doc.addEventListener("focusout", e => { if (on && e.target === on) hide(); });
    doc.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
    const follow = () => { if (on) { const b = on; if (!b.isConnected || !b.getClientRects().length) hide(); else show(b); } };   // a scroll or an opening leaf moves the button: the note follows it
    addEventListener("scroll", follow, { passive: true, capture: true }); addEventListener("resize", hide);
  })();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
