/* Terry's guide (owner 12:25, 12:30, 12:36): one set of parts for the guided chase, the intro tour and the "?" on each section.
 *   Terry speaks through Ping: each line is a Terry turn in the dock's thread, marked "Guide", typed in, kept in his memory.
 *   A spotlight scrim dims the rest of the page around what he presents (several cut-outs at once); the dock stays above it.
 *   Terry flies on a viewport-fixed layer to free space beside the presented rect, never over it, never under the dock.
 *   Skip (the corner button) and Escape: he flies to his perch, the scrim fades, the rest finishes fast. The viewer's own scroll,
 *   click or typing stops the narration.
 * Test switch: ?guide=off or localStorage terry.guide = "off" gives every chase the short version. The tour only plays on request.
 *   TerryGuide.chaseMode() -> "full" | "short" | "rm" | "none"   .tour({ replay })   .explain(key)   .TOUR (the stops, a data list)
 */
(function (root) {
  "use strict";
  const doc = document, $ = s => doc.querySelector(s);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const off = () => { try { if (/[?&]guide=off\b/.test(location.search)) return true; return localStorage.getItem("terry.guide") === "off"; } catch (e) { return false; } };
  const TOURKEY = "terry.toured";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = sel => [...doc.querySelectorAll(sel)].find(e => e.offsetParent !== null || getComputedStyle(e).position === "fixed") || null;
  // the flip card and the flyway lose their ids once a chase settles: find them by what they are as well (owner 11 Nov)
  const failEl = () => vis("#failcard") || vis("#rbodies section.plate.fail");
  const flyEl = () => { const f = vis("#flysec"); if (f) return f; const p = vis("#rbodies section.flyp"); return p ? (p.closest(".tt-fadein") || p) : null; };
  const bud = () => { const s = $(".bud-socket"); return s ? s.parentElement : null; };
  const kit = () => root.TerryProj && root.TerryProj.kit;
  const Ping = () => root.TerryPing;

  // ---------------------------------------------------------------- the tour (THU_BUILD B, owner 12:36 copy; a data list)
  const TOUR = [   // owner 20:53: Terry says hello from Ping, shows the 2025 plan, then hands over the Chase it box
    { els: () => [$("#dock")], fixed: true, wait: 5000, text: "Hey, Terry here. This is where we'll talk (or should I say echo) most of the time. I can do almost anything you ask on this page: take you somewhere, pick a day, compare plans. Ask me to do your math homework or anything that isn’t about Boston’s crews, though, and I might have to send you to the cave. Kidding. Y como llevo años escuchando a Boston, también aprendí español: cuéntame un problema en tu calle y se lo paso al equipo correcto." },   // owner 7 Nov: Spanish, visible from the start (the intake reads Spanish reports with or without the live model)
    { els: () => [$("#ledger"), $("#ledger .ldg-tabs")], union: true, whole: true, wait: 4800, text: "Anyway, this is the plan I worked out for 2025 from Boston's 2023 and 2024 requests. Take a look, and try the plan tabs: Do nothing, Passive, Neutral and Aggressive." },
    { els: () => { try { root.TerryProj && root.TerryProj.chips && root.TerryProj.chips(true); } catch (e) {} const c = vis("#goalchips"); return [$("#goalform"), c && c.textContent.trim() && getComputedStyle(c).opacity !== "0" ? c : null]; }, union: false, wait: 5200, text: "And this is the Chase it box. Give me a goal, like “every Transportation request on time in November”, and I'll chase it: flip it, find what could break it, and fly you a way past. Or pick one of the three below it: a storm, a walkout, a neighborhood." },
  ];

  const CSS = `
  .tg-scrim { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 28; pointer-events: none; opacity: 0; transition: opacity .45s var(--ease, ease); }
  .tg-scrim.on { opacity: 1; }
  .tg-scrim .tg-fill { fill: rgba(var(--shadow), .66); }   /* owner 20:53: dimmer, so the lit part stands out */
  :root[data-theme="night"] .tg-scrim .tg-fill { fill: rgba(0, 0, 0, .72); }
  body.tg-on #dock { z-index: 34; } body.tg-on #skipbtn:not([hidden]) { z-index: 61; }
  #tlayer.tg-fixed { position: fixed !important; top: 0 !important; left: var(--tg-l, 0px) !important; width: var(--tg-w, 100vw) !important; height: 100vh !important; z-index: 31; }
  .dk-glab { display: inline-block; margin-right: 8px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--lf-rule, var(--line2)); font: 600 10.5px/1.5 var(--ui); letter-spacing: .06em; text-transform: uppercase; color: var(--lf-text2, var(--ink3)); vertical-align: 2px; }
  .tg-q { display: inline-grid; place-items: center; width: 24px; height: 24px; margin-left: 8px; padding: 0; border-radius: 50%; border: 1px solid var(--line2); background: var(--paper); color: var(--ink2);
    font: 600 12.5px/1 var(--ui); cursor: pointer; opacity: 0; transition: opacity .2s var(--ease, ease); vertical-align: middle; }
  .tg-q.abs { position: absolute; z-index: 6; top: 10px; right: 10px; margin: 0; }
  .tg-q-host:hover .tg-q, .tg-q-host:focus-within .tg-q, .tg-q:focus-visible { opacity: 1; }
  .tg-q:hover { color: var(--ink); border-color: var(--ink3); } .tg-q:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  @media (hover: none) { .tg-q { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .tg-scrim, .tg-q { transition: none !important; } }`;
  const NS = "http://www.w3.org/2000/svg";
  let css = null, scrim = null, holes = [], targets = [], loopOn = false;
  function ensureUI() {
    if (!css) { css = doc.createElement("style"); css.id = "guide-css"; css.textContent = CSS; doc.head.appendChild(css); }
    if (!scrim || !scrim.isConnected) {
      scrim = doc.createElementNS(NS, "svg"); scrim.setAttribute("class", "tg-scrim"); scrim.setAttribute("aria-hidden", "true");
      scrim.innerHTML = `<defs><mask id="tg-mask" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="100%" height="100%" fill="#fff"/></mask></defs><rect class="tg-fill" x="0" y="0" width="100%" height="100%" mask="url(#tg-mask)"/>`;
      doc.body.appendChild(scrim);
    }
  }
  // ---------------------------------------------------------------- the spotlight: cut-outs follow their elements every frame
  const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  function spot(els, pad) {
    ensureUI(); pad = pad === undefined ? 12 : pad; doc.body.classList.add("tg-on");
    targets = (els || []).filter(Boolean).map(e => ({ el: e, pad }));
    const m = scrim.querySelector("mask");
    while (holes.length > targets.length) holes.pop().node.remove();
    while (holes.length < targets.length) { const n = doc.createElementNS(NS, "rect"); n.setAttribute("fill", "#000"); n.setAttribute("rx", "16"); m.appendChild(n); const r0 = holes.length ? holes[holes.length - 1].cur : null; holes.push({ node: n, cur: r0 ? { ...r0 } : null }); }
    scrim.classList.toggle("on", targets.length > 0);
    if (!loopOn && targets.length) { loopOn = true; requestAnimationFrame(track); }
  }
  function track() {
    if (!targets.length) { loopOn = false; return; }
    const snap = reduced();
    targets.forEach((t, i) => {
      const H = holes[i]; if (!H || !t.el.isConnected && !t.el.getBoundingClientRect) return; const r = rectOf(t.el);
      // eased in page coordinates (owner 21:36: the highlight moved too quickly), so a scroll never makes it trail
      const sy = scrollY, want = { x: r.x - t.pad, y: r.y - t.pad + sy, w: r.w + 2 * t.pad, h: r.h + 2 * t.pad };
      if (!H.cur || snap) H.cur = want; else for (const q of ["x", "y", "w", "h"]) H.cur[q] += (want[q] - H.cur[q]) * .085;
      const c = H.cur; H.node.setAttribute("x", c.x.toFixed(1)); H.node.setAttribute("y", (c.y - sy).toFixed(1)); H.node.setAttribute("width", Math.max(0, c.w).toFixed(1)); H.node.setAttribute("height", Math.max(0, c.h).toFixed(1));
    });
    requestAnimationFrame(track);
  }
  function unspot() { doc.body.classList.remove("tg-on"); if (!scrim) return; scrim.classList.remove("on"); targets = []; setTimeout(() => { if (!targets.length) { holes.forEach(h => h.node.remove()); holes = []; } }, 480); }

  // ---------------------------------------------------------------- Terry's voice: a guide line in the Ping dock
  async function say(text, o) {
    const P = Ping(); if (!P || !P.guide) return false;
    try { return await P.guide(text, o || {}); } catch (e) { console.warn("guide line", e && e.message); return false; }
  }
  const hush = () => {};

  // ---------------------------------------------------------------- placement in free space (page coordinates), above the dock
  // Terry's drawn box around the point he hovers at, measured (guide-probe.cjs: alpha bbox of the 3D layer): his wings reach about
  // 190 px left and 45 px right of it, 55 px above and 100 px below (wings down). TW is the half width used for room checks.
  const TL = 152, TR = 36, TU = 44, TD = 80, TW = (TL + TR) / 2, GAP = 16;   // Terry at 0.8 of his old size
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const tbox = p => ({ x: p.x - TL, y: p.y - TU, w: TL + TR, h: TU + TD });
  const dockY = () => { const d = $("#dock"); if (!d) return innerHeight; const r = d.getBoundingClientRect(); return r.height ? Math.min(innerHeight, r.top) : innerHeight; };
  const pageRect = el => kit().rel(el);
  // rects: the presented rects in page coordinates (the first leads); fixedEl: they do not scroll (the dock). Returns Terry's point and the scroll.
  function layout(rects, fixedEl, bottom, lead) {
    const K = kit(), W = K.page.clientWidth, top0 = K.page.getBoundingClientRect().top + scrollY, vh = innerHeight, dockTop = dockY(), U = lead || rects[0];
    const maxS = Math.max(0, doc.documentElement.scrollHeight - vh), room = dockTop - 72;   // the visible band between the top bar and the open dock
    // centre a section that fits in the band above the dock; a taller one starts near the top, or (bottom) ends just above the dock
    const fit = U.h < room - 24 ? U.y - 72 - (room - U.h) / 2 : bottom ? U.y + U.h + top0 - dockTop + 16 : U.y - 96;   // centre the section in the band above the dock, or start it near the top
    const C = [];
    for (const [l, r] of [[U.x + U.w + GAP, W - 10], [10, U.x - GAP]]) { if (r - l < 2 * TW) continue; const cx = (l + r) / 2 + (TL - TR) / 2; C.push({ t: { x: cx, y: Math.max(U.y + TU + 8, Math.min(U.y + U.h - TD, U.y + 140)) }, s: fit }); }
    { const t = { x: Math.min(W - TR - 12, U.x + U.w - TR - 40), y: U.y - TD - (fixedEl ? 80 : 40) }; C.push({ t, s: Math.min(fit, t.y - TU - 70) }); }   // above the dock, his wings clear its top edge
    { const t = { x: Math.min(W - TR - 12, U.x + U.w - TR - 40), y: U.y + U.h + TU + 14 }; C.push({ t, s: t.y + TD + 24 - dockTop }); }
    // a tall section fills the band: Terry keeps to the page edge beside it, as clear of it as the width allows
    for (const x of [TL + 8, W - 140]) C.push({ t: { x, y: 0 }, vy: Math.round((72 + dockTop) / 2), s: fit });
    const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    let best = null, bestBad = 1e9;
    for (const k of C) {
      const s = fixedEl ? scrollY : Math.max(0, Math.min(maxS, k.s)), dy = top0 - s; if (k.vy) k.t.y = k.vy - dy; const tb = tbox(k.t); let bad = 0;
      if (tb.x < 6 || tb.x + tb.w > W - 6) bad += 1; if (tb.y + dy < 56 || tb.y + tb.h + dy > dockTop - 4) bad += 2;
      for (const r of rects) bad += 12 * area(tb, r) / (tb.w * tb.h) + (hit(tb, r) ? .5 : 0);
      if (!fixedEl) { const top = U.y + dy, bot = top + Math.min(U.h, room); if (top < 56) bad += (56 - top) / 60; const need = U.h <= room ? bot : bottom ? U.y + U.h + dy : Math.min(bot, top + 260); if (need > dockTop) bad += (need - dockTop) / 40; }
      if (bad < bestBad) { bestBad = bad; best = { ...k, s }; } if (!bad) break;
    }
    if (best) { best.fit = fixedEl ? scrollY : Math.max(0, Math.min(maxS, fit)); best.bad = bestBad; }
    return best;
  }

  // where Terry hangs on a full width section: its top edge, left of anything set at the right end of its header row
  function hangSpot(el, U) {
    const hd = el.querySelector("header, .fw-h, .ldg-hd, .gh"), parts = hd ? [...hd.querySelectorAll("h2, h3, button, select, .sub, .heard, .ldg-sub, p")] : [];
    const ink = n => { if (/^(BUTTON|SELECT)$/.test(n.tagName)) return n.getBoundingClientRect(); const r = doc.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); };
    const pr = kit().page.getBoundingClientRect(); let x = U.x + U.w - 70;
    for (const n of parts) { const r = ink(n); if (r.width && r.right - pr.left > x - 50) x = Math.min(x, r.left - pr.left - 60); }
    const tabs = [...el.querySelectorAll(".ldg-tab")].map(n => n.getBoundingClientRect()); for (const r of tabs) if (r.right - pr.left > x - 50) x = Math.min(x, r.left - pr.left - 60);
    // headers now carry their count and "?" at the right end too: he hangs just past the title, in the gap before them, when that
    // gap is clear of every other word in the header (a long line under the title keeps him at the right, as before)
    const t0 = hd && hd.querySelector("h2, h3");
    if (t0) { const tx = ink(t0).right - pr.left + 110 + (TL - 9), L0 = tx - TL - 60, R0 = tx + 45 + 12;   // his drawn wings reach past the box: keep a wide margin
      const clear = parts.filter(n => n !== t0).every(n => { const r = ink(n); if (!r.width) return true; const a = r.left - pr.left, b = r.right - pr.left; return b < L0 || a > R0; });
      if (tx < x && clear) x = tx; }
    const hb0 = hd ? hd.getBoundingClientRect() : null, R0 = el.getBoundingClientRect(), b0 = hb0 ? Math.max(hb0.bottom, R0.top) : R0.top + 120;
    return { x, y: U.y + 2, hd: hd || el, below: { x: U.x, y: U.y + (b0 - R0.top), w: U.w, h: Math.max(0, U.h - (b0 - R0.top)) },
      avoid: headerOnly => { const hb = hd ? hd.getBoundingClientRect() : null, R = el.getBoundingClientRect(), out = [...parts.map(ink), ...[...el.querySelectorAll(".ldg-tab")].map(n => n.getBoundingClientRect())].map(r => ({ x: r.left, y: r.top, width: r.width, height: r.height })).filter(r => r.width);
        if (!headerOnly) { const below = hb ? Math.max(hb.bottom, R.top) : R.top + 120; out.push({ x: R.left, y: below, width: R.width, height: Math.max(0, R.bottom - below) }); } return out; } };
  }

  // ---------------------------------------------------------------- one guided session: Skip, Escape, the viewer's own scroll, click or typing
  let S = null;
  function session(kind, o) {
    if (S) S.end();
    const me = { kind, state: "run", onSkip: o.onSkip, onInterrupt: o.onInterrupt, ws: new Set() };
    const stopWith = st => { if (me.state !== "run") return; me.state = st; for (const f of [...me.ws]) f(); me.ws.clear(); };
    me.skip = () => { if (me.state !== "run") return; stopWith("skipped"); unspot(); try { me.onSkip && me.onSkip(); } catch (e) { console.warn("guide skip", e && e.message); } };
    me.interrupt = why => { if (me.state !== "run") return; (root.TerryGuide.trace = root.TerryGuide.trace || []).push(kind + " stopped by " + (why || "?")); stopWith("stopped"); unspot(); try { const f = me.onInterrupt || me.onSkip; f && f(); } catch (e) { console.warn("guide stop", e && e.message); } };
    me.wait = ms => new Promise(res => { if (me.state !== "run") return res(); const t = setTimeout(() => { me.ws.delete(f); res(); }, ms); const f = () => { clearTimeout(t); res(); }; me.ws.add(f); });
    me.nextWait = () => new Promise(res => { if (me.state !== "run") return res(); const f = () => { me.ws.delete(f); res(); }; me.ws.add(f); me.next = f; });
    me.live = () => me.state === "run";
    const mine = e => { const t = e.target; if (!t || !t.closest) return false; return !!t.closest("#skipbtn, .dk-next"); };
    const key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); me.skip(); return; } if (["Shift", "Control", "Alt", "Meta"].includes(e.key) || mine(e)) return; me.interrupt("key " + e.key); };
    const ptr = e => { if (mine(e)) return; me.interrupt("pointer on " + ((e.target && (e.target.id || e.target.className)) || "?")); };
    const wheel = e => me.interrupt(e.type);
    const sb = $("#skipbtn"), sbWas = sb ? sb.hidden : true, sbClick = () => me.skip();
    if (sb && kind !== "chase") { sb.hidden = false; sb.addEventListener("click", sbClick); }
    addEventListener("keydown", key, true); addEventListener("pointerdown", ptr, true); addEventListener("wheel", wheel, { capture: true, passive: true }); addEventListener("touchmove", wheel, { capture: true, passive: true });
    me.end = () => {
      stopWith(me.state === "run" ? "done" : me.state);
      removeEventListener("keydown", key, true); removeEventListener("pointerdown", ptr, true); removeEventListener("wheel", wheel, true); removeEventListener("touchmove", wheel, true);
      if (sb && kind !== "chase") { sb.removeEventListener("click", sbClick); sb.hidden = sbWas; const K = kit(); if (K && K.unskip) K.unskip(); }
      unspot(); if (S === me) { S = null; root.TerryGuide.active = null; }
    };
    S = me; root.TerryGuide.active = kind; return me;
  }

  // ---------------------------------------------------------------- the guided chase
  let chases = 0;
  function chaseMode() {
    const K = kit(), n = chases++;
    if (!K) return "none";
    if (reduced()) return n === 0 && !off() ? "rm" : "none";
    if (!K.is3d()) return "none";
    return n === 0 && !off() ? "full" : "short";
  }
  // present one section: the line goes into the dock (it opens), the page dims around the section, the section scrolls into the band above
  // the dock, and Terry flies to free space beside it. o.ask / o.q: an explanation (live model when on); o.slow: a slow flight.
  async function present(sess, els, text, o) {
    o = o || {}; const K = kit(); els = (els || []).filter(Boolean); if (!K || !sess.live() || !els.length) return false;
    spot(els, 12);
    // owner 7 Nov (sync): a section on the page scrolls into place first (the dim travels with it), and the words start once it has
    // landed, while Terry is still flying over. The dock itself (fixed) and reduced motion keep the words first, as before.
    const early = !!o.fixed || reduced(), speak = () => say(text, { ask: o.ask, q: o.q || "What is this part of the page?", next: o.next });
    let line = early ? speak() : null;
    if (o.fixed) await line;   // the dock grows as the line types: measure it once the line is in, so Terry clears it
    await sleep(early && !reduced() ? 200 : 0); { let t0 = -1; for (let k = 0; k < 25; k++) { const t = dockY(); if (Math.abs(t - t0) < 1) break; t0 = t; await sleep(60); } }   // the dock has opened and settled: measure the band above it
    const parts = (o.parts || els).filter(Boolean), rs = parts.map(pageRect).filter(r => r && r.w); if (!rs.length || !sess.live()) return false;
    const L = layout(rs, !!o.fixed, !!o.bottom, pageRect(els[0])); if (!L) return false;
    const W = K.page.clientWidth, U = pageRect(els[0]), H = !o.fixed && !o.whole && U.w > W * .7 && els[0].querySelector ? hangSpot(els[0], U) : null, sTo = H ? L.fit : L.s;   // a full width section: he hovers in its header row (there is nothing there to hang from)
    if (H) { H.px = H.x + 45 - TR; H.py = H.y + TU + 4; const box = tbox({ x: H.px, y: H.py }); if (!o.whole && H.below && hit(box, H.below)) H.headerOnly = true;   /* the whole section stays lit (the cards are what is presented); he keeps to its header row */ }
    if (reduced()) { if (!o.fixed) scrollTo(0, sTo); }
    else { const sc = o.fixed ? null : K.glideY(() => sTo, 1400), tx = H ? H.px : L.t.x, ty = H ? H.py : L.t.y;
      const fl = K.fly(tx, ty, o.slow ? 2800 : 2100);
      if (sc) { await sc; if (!line && sess.live()) line = speak(); }   // in place: now he speaks
      await fl; if (K.arrive) await K.arrive(tx, ty, 2500); }
    if (!line) line = speak();
    if (!o.fixed && sess.live() && (o.bottom || els[0].getBoundingClientRect().height <= dockY() - 84)) {   // it fits the band: keep its foot above the dock, even if it grew while he flew   // the dock may have grown while he flew: keep the bottom of the presented area just above it
      const d = els[0].getBoundingClientRect().bottom - (dockY() - 12); if (d > 2) { const to = scrollY + d; if (reduced()) scrollTo(0, to); else await K.glideY(() => to, 400); }
    }
    if (!sess.live()) return false;
    const pr = K.page.getBoundingClientRect();
    root.TerryGuide.last = { terry: reduced() ? null : K.terryBox(), hang: !!H,   /* hang: placed in a header row, judged against its words (the test's name) */ headerOnly: !!(H && H.headerOnly), avoid: H ? H.avoid(H.headerOnly) : null,
      rects: parts.map(e => e.getBoundingClientRect().toJSON()), dockTop: dockY(), lead: els[0].getBoundingClientRect().toJSON(), s: Math.round(sTo), sy: Math.round(scrollY) };
    await line;
    if (root.TerryGuide.hold && !o.next) {   // tests: hold each stop until released, so a slow renderer never misses one
      const TG = root.TerryGuide, h = sess.nextWait(); TG.held = true; TG.release = () => { TG.held = false; if (sess.next) sess.next(); }; await h; TG.held = false;
    }
    return true;
  }
  // reduced motion, first chase: the two lines beside their sections in turn with Next; the last returns to the projector
  async function chaseRM() {
    const K = kit(); if (!K || off()) return;
    // each section is looked up when its turn comes: the flyway is still being drawn while the predators are shown
    const steps = [[() => vis("#rbodies section.pred:not(.qs)"), "Beware of these predators."], [() => vis('#rbodies [data-id="flysec"]') || vis("#flysec"), "This is how I’d fly past them to reach your goal."]];
    for (let k = 0; k < 50 && !steps[0][0]() && !steps[1][0](); k++) await sleep(100);   // the Roost may still be drawing
    if (!steps[0][0]() && !steps[1][0]()) return;
    const sess = session("chase-rm", { onSkip() {}, onInterrupt() {} });
    for (let i = 0; i < steps.length && sess.live(); i++) {
      let e = steps[i][0](); for (let k = 0; !e && k < 40 && sess.live(); k++) { await sleep(100); e = steps[i][0](); }
      if (!e) continue;
      const nx = sess.nextWait(); await present(sess, [e], steps[i][1], { next: () => sess.next && sess.next(), q: "What am I looking at here?" }); await nx;
    }
    const back = sess.state === "run" || sess.state === "skipped"; sess.end();
    if (back) { const sc = $("#screen"); if (sc) scrollTo(0, Math.max(0, pageRect(sc).y + 30)); }
  }

  // ---------------------------------------------------------------- the intro tour
  let touring = false;
  function unionEl(els) {   // one cut-out around several parts (the projector, the machine and the battery)
    return { isConnected: true, getBoundingClientRect() { let a = null; for (const e of els) { const r = e.getBoundingClientRect(); if (!r.width) continue; a = a ? { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom }; }
      a = a || { l: 0, t: 0, r: 0, b: 0 }; return { left: a.l, top: a.t, right: a.r, bottom: a.b, width: a.r - a.l, height: a.b - a.t, x: a.l, y: a.t, toJSON() { return { x: a.l, y: a.t, width: a.r - a.l, height: a.b - a.t }; } }; } };
  }
  async function tour(opt) {
    opt = opt || {}; const K = kit(); if (!K || touring || K.busy()) return false;
    if (!opt.replay) return false;
    touring = true; markTour();
    const rm = reduced(), y0 = scrollY; root.TerryGuide.tourFrom = y0;
    const sess = session("tour", { onSkip: () => {} });
    try {
      if (!rm) K.fix(true);
      for (let i = 0; i < TOUR.length && sess.live(); i++) {
        const st = TOUR[i]; let els = st.els().filter(Boolean); const parts = els; if (st.union && els.length > 1) els = [unionEl(els)];
        if (rm) { const nx = sess.nextWait(); await present(sess, els, st.text, { parts, bottom: st.bottom, fixed: st.fixed, whole: st.whole, next: () => sess.next && sess.next(), q: "What is this part of the page?" }); await nx; continue; }
        if (!(await present(sess, els, st.text, { parts, bottom: st.bottom, fixed: st.fixed, whole: st.whole, q: "What is this part of the page?" }))) break;
        await sess.wait(st.wait || (st.text.length > 60 ? 4200 : 3000));
      }
    } catch (e) { console.warn("tour", e && e.message); }
    const fast = sess.state !== "run" && sess.state !== "done", took = sess.state === "stopped";   // took: the viewer clicked or typed, and is now where they want to be
    sess.end(); unspot();
    // owner 7 Nov: when the viewer takes over (a click on Chase it, typing a goal) the page stays where they are; it used to scroll back
    // to where the tour began (often the projector) and pull Terry home in the middle of the chase they had just started
    const chasing = () => !!(K.busy && K.busy());
    if (chasing()) { K.fix(false); touring = false; return true; }
    if (!took) { if (rm || fast) scrollTo(0, y0); else await K.glideY(() => y0, 700); }
    if (!chasing()) await K.flyHome(rm || fast); await sleep(rm ? 0 : 900); if (!chasing()) K.fix(false);
    const P = Ping(); if (P && P.fold && !chasing()) P.fold(); await sleep(rm ? 50 : 400); if (!took && !chasing()) scrollTo(0, y0);
    touring = false; return true;
  }
  const seenTour = () => { try { return localStorage.getItem(TOURKEY) === "1"; } catch (e) { return false; } };
  const markTour = () => { try { localStorage.setItem(TOURKEY, "1"); } catch (e) {} };
  // on a first visit the tour plays by itself (owner 18:24): once the opening has handed over, a second's pause, then Terry starts at the
  // goal box. Typing, a click or Escape ends it at once (the session's own rules), so it never stands between the viewer and a goal.
  async function afterIntro() {
    if (seenTour() || off()) return;
    const O = root.TerryOpening; if (O && O.active) await new Promise(res => doc.addEventListener("terry:opening", res, { once: true }));
    const L = root.TerryLanding; if (L && L.active) await new Promise(res => doc.addEventListener("terry:landing", res, { once: true }));   // and the landing has unfolded into the planner
    await sleep(1000);
    const K = kit(), inp = $("#goalin"); if (!K) return;
    for (let k = 0; k < 60 && K.busy(); k++) await sleep(100);   // let him finish a flight first
    if (touring || (inp && doc.activeElement === inp) || (root.TerryProj && root.TerryProj.running === true)) return;   // the viewer is already typing, or a chase runs
    (root.TerryGuide.trace = root.TerryGuide.trace || []).push("auto tour " + (await tour({ replay: true })));
  }

  // ---------------------------------------------------------------- "?" on each section: Terry explains it (owner 12:36)
  const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const first = (s, n) => { const m = String(s || "").match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(s || "")).trim().slice(0, n || 200); };
  const SECTIONS = [
    { key: "projector", name: "the projector", head: () => $(".ctrls") || $("#fab"), abs: () => !$(".ctrls"), els: () => [$("#fab")],
      say: () => { const A = root.TerryAlmanac; return `This is the projector: Boston's 311 crews for 2025, month by month, by department.${A && A.view ? ` It shows ${A.view}.` : ""} Each bar is the crews a month needs; hatched bars are behind, red ones are late.`; } },
    { key: "machine", name: "the Almanac machine and BUDGETerry", head: () => $("#almanac .alm-head") || $("#almanac"), abs: () => !$("#almanac .alm-head"), els: () => [unionEl([$("#almanac"), bud()].filter(Boolean))],
      say: () => { const A = root.TerryAlmanac, b = A && A.beats && A.beats[0]; return `The Almanac machine reads the screen out in up to three rows: when, how many, and what happens.${b && b.text ? ` Right now: ${first(b.text)}` : ""} BUDGETerry, the battery beside it, holds the year's crew budget and shows what the plan spends.`; } },
    { key: "fail", name: "the failure card", head: () => failEl(), abs: () => true, els: () => [failEl()],
      say: () => `This is your goal flipped: how it would fail. ${first(txt(failEl() && failEl().querySelector(".t")), 180)} Below it are the predators that would cause it.` },
    { key: "flipside", name: "The Flip Side", head: () => $("#terrytory .tt-head .fold-all"), els: () => [$("#terrytory")],
      say: () => `The Flip Side is where a chase lands: your goal turned into how it would fail, the predators that could cause it, and the flyway past them.${txt($("#ttsub")) ? ` Right now: ${txt($("#ttsub"))}` : ""}` },
    { key: "pred", name: "the predators", head: () => vis("#rbodies section.pred:not(.qs) .gh"), els: () => [vis("#rbodies section.pred:not(.qs)")],
      say: () => `Predators are what could make your goal fail. ${txt(vis("#heard")) ? txt(vis("#heard")) + ". " : ""}Each card says whether 2024's requests confirm it, and how Terry answers it.` },
    { key: "fly", name: "the flyway", head: () => vis("#flysec .fw-h h2") || vis('[data-id="flysec"] .fw-h h2') || (flyEl() && flyEl().querySelector(".fw-h h2")), els: () => [flyEl()],
      say: () => `The flyway is the cheapest way past the predators: which crews to sign, and when. ${first(txt(flyEl() && flyEl().querySelector(".fw-h .sub")), 160)}` },
    { key: "ledger", name: "the 2025 crew plan", head: () => $("#ldg-sec-h") || $("#ledger #ledger-h"), els: () => [$("#ledger")],
      say: () => { const L = root.TerryLedger, k = L && L.plan; return `This is the 2025 crew plan, kept like a ledger: crews hired and released each month, by department.${k ? ` You are reading the ${String(k).replace(/_/g, " ")} plan.` : ""} The tabs switch between Terry's four plans; Compare with puts a second one beside it.`; } },
    { key: "echo", name: "Echolocation", head: () => $("#qs-h"), els: () => [vis("#terrytory section.qs")],
      say: () => `Echolocation maps Boston by who calls 311 and who waits. ${first(txt($("#terrytory section.qs .qs-line")))} The quiet neighborhoods are the ones the city isn't hearing.` },
    { key: "roost", name: "the Roost leaf", head: () => $("#leaf-left .lf-body h2"), els: () => [$("#leaf-left")],
      say: () => { const n = ((root.TerryState || {}).roosts || []).length; return `The Roost leaf keeps every plan Terry found as a card${n ? `; ${n} so far` : ""}. Tick two and Compare puts them side by side on the screen.`; } },
    { key: "terrytory", name: "the Terrytory leaf", head: () => $("#leaf-right .lf-body h2"), els: () => [$("#leaf-right")],
      say: () => `The Terrytory leaf is what residents are reporting, replayed day by day. Press Play and each request lands on the projector at its own crew.` },
  ];
  function addQs() {
    for (const s of SECTIONS) {
      if (s.key === "roost" || s.key === "terrytory") continue;   // the leaves carry their own "i"
      const h = s.head(); if (!h || h.querySelector(":scope > .tg-q") || (h.nextElementSibling && h.nextElementSibling.classList.contains("tg-q"))) continue;
      if (h.parentElement && h.parentElement.querySelector(`:scope > .tg-q[data-q="${s.key}"]`)) continue;   // one "?" per heading, even after a redraw moves it
      const b = doc.createElement("button"); b.type = "button"; b.className = "tg-q" + (s.abs && s.abs() ? " abs" : ""); b.textContent = "?"; b.dataset.q = s.key;
      b.setAttribute("aria-label", `Ask Terry about ${s.name}`); b.title = `Ask Terry about ${s.name}`;
      b.addEventListener("click", e => { e.stopPropagation(); explain(s.key); });
      const sib = /^H\d$/.test(h.tagName) || s.after; if (sib) h.after(b); else h.appendChild(b);
      const host = sib ? (h.closest("section, .leaf, header, .tt-head") || h.parentElement) : h; host.classList.add("tg-q-host");
      if (s.abs && s.abs() && getComputedStyle(h).position === "static") h.style.position = "relative";
    }
  }
  let qT = 0; new MutationObserver(() => { clearTimeout(qT); qT = setTimeout(addQs, 300); }).observe(doc.body, { childList: true, subtree: true });
  async function explain(key) {
    const s = SECTIONS.find(x => x.key === key), K = kit(); if (!s || !K || K.busy() || touring) return false;
    const els = s.els().filter(Boolean); if (!els.length) return false;
    const sess = session("explain", { onSkip() {}, onInterrupt() {} }), rm = reduced();
    if (!rm) K.fix(true);
    let text = ""; try { text = s.say(); } catch (e) { text = ""; }
    await present(sess, els, text, { ask: `In two or three plain sentences, explain ${s.name} on the page as it is right now.`, q: `What is ${s.name}?`, slow: true });
    await sess.wait(rm ? 0 : 5000);
    sess.end(); if (!rm) { await K.flyHome(); await sleep(900); K.fix(false); }
    return true;
  }

  // ---------------------------------------------------------------- the dock: "Show me around" chip; "what is this" / "show me around" typed into Ping
  const ASK_TOUR = /^\s*(what is this|what's this|show me around|give me a tour|take me around)\s*[?.!]*\s*$/i;
  function hookDock() {
    const d = $("#dock"); if (!d) return false; const chips = d.querySelector(".dk-chips"); if (!chips) return false;
    if (!chips._tg) {
      chips._tg = true;
      const add = () => { if (chips.querySelector(".tg-tourchip")) return; const b = doc.createElement("button"); b.type = "button"; b.className = "dk-chip tg-tourchip"; b.textContent = "Show me around"; b.title = "Show me around";
        b.addEventListener("click", e => { e.stopPropagation(); tour({ replay: true }); }); if (seenTour()) chips.prepend(b); else chips.appendChild(b); };   // owner 7 Nov: on later visits it leads the suggestions
      new MutationObserver(add).observe(chips, { childList: true }); add();
    }
    return true;
  }
  doc.addEventListener("submit", e => {
    const f = e.target; if (!f || !f.closest || !f.closest("#dock")) return; const i = f.querySelector(".dk-in"); if (!i || !ASK_TOUR.test(i.value)) return;
    e.preventDefault(); e.stopImmediatePropagation(); i.value = ""; i.blur(); tour({ replay: true });
  }, true);
  (function wait(k) { if (hookDock() || k > 120) return; setTimeout(() => wait(k + 1), 250); })(0);

  ensureUI();
  // ---------------------------------------------------------------- navigation from Ping (owner 20:05): "go to the predators", "show me the flyway"
  // Unfolds or opens what it needs to, scrolls the part into the band above the dock, and lights it for a few seconds.
  const navTarget = text => (root.TerryNav ? root.TerryNav.navTarget(text) : null);   // the rules live in nav.js (the notebook evaluates them)
  let navT = 0;
  async function go(key) {
    const K = kit(); if (!K || S || touring) return { ok: false, why: "busy" };
    const R = root.TerryRoost, St = root.TerryState || {}, sh = root.TerryShell, act = St.activeRoost || null;
    if (["fail", "pred", "fly", "ledger"].includes(key) && R && R.setFold) { R.setFold(act, { [key]: false }); await sleep(reduced() ? 0 : 420); }
    if ((key === "roost" || key === "terrytory") && sh && sh.leaf) { const lf = sh.leaf(key === "roost" ? "left" : "right"); if (lf && lf.open) lf.open(); }
    const s = SECTIONS.find(x => x.key === key);
    const el = key === "goal" ? $("#goalform") : s ? (s.els().filter(Boolean)[0] || null) : null;
    if (!el || (!el.getBoundingClientRect().height && !el.getBoundingClientRect)) return { ok: false, why: "missing" };
    if (key !== "roost" && key !== "terrytory") {
      const r = el.getBoundingClientRect(), dockTop = dockY(), room = dockTop - 72, y = scrollY + r.top;
      const to = Math.max(0, r.height < room - 24 ? y - 72 - (room - r.height) / 2 : y - 96);
      if (reduced()) scrollTo(0, to); else if (K.glideY) await K.glideY(() => to, 800); else scrollTo({ top: to, behavior: "smooth" });
    }
    clearTimeout(navT); spot([el], 12); navT = setTimeout(() => { if (!S) unspot(); }, 4500);
    const off = () => { clearTimeout(navT); if (!S) unspot(); removeEventListener("wheel", off, true); removeEventListener("pointerdown", off, true); };
    addEventListener("wheel", off, { capture: true, passive: true, once: true }); setTimeout(() => addEventListener("pointerdown", off, { capture: true, once: true }), 50);
    return { ok: true, name: key === "goal" ? "the goal box" : s ? s.name : key };
  }
  root.TerryGuide = { navTarget, go, off, chaseMode, session, present, spot, unspot, say, hush, layout, tour, afterIntro, chaseRM, explain, TOUR, SECTIONS, addQs,
    active: null, last: null, get spotted() { return targets.map(t => (t.el && (t.el.id || (t.el.dataset && t.el.dataset.id) || String(t.el.className || ""))) || "union"); }, get touring() { return touring; }, get S() { return S; } };
})(typeof window !== "undefined" ? window : globalThis);
