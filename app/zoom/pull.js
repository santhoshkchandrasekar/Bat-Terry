/* pull.js (Engineer 3): the bottom bar of the projector screen is a handle, and Pull is the one owner of the screen height.
   h = how much of the screen is unrolled, 0 (rolled up under the case) to 1 (full). It keeps proj.js's setTy semantics:
   the same transform on #rigMove and the same --rig-h on #screen, so nothing else has to change.
     Pull = { to(h, ms), get h(), lock(on), maximize(), restore() }
   Gestures: drag to any height and it stays; a quick tug or an upward flick rolls it up; 96 % or more opens it fully;
   hold still for 650 ms and let go to maximize. Keyboard: the ring is a button. */
(function (root) {
  "use strict";
  const $ = s => document.querySelector(s);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const Bus = () => (root.TerryBus && root.TerryBus.emit ? root.TerryBus : null);
  const GEO = { day: { w: 1916, slat: 752, cb: 192 }, night: { w: 1915, slat: 743, cb: 186 } };   // the same constants as proj.js fitRig
  const HOLD_MS = 650, SLOP = 6, TUG_MS = 260, TUG_PX = 24, FLICK = -0.0018, OVER = 1.04;
  const COPY = { closed: "Pull down to open the screen", open: "Drag to set the height. Hold to enlarge.", busy: "Terry is projecting. Skip or wait." };

  // cubic-bezier easing (the CSS definition), for the roll-up
  function bez(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => { let t = x; for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; } return Y(clamp(t, 0, 1)); };
  }
  const EASE = { io: u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), roll: bez(.5, 0, .75, 0), out: u => 1 - Math.pow(1 - u, 3) };

  let rig, rigMove, screen, fab, page, slatref, zone, ring, tip, tipTimer = 0;
  const S = { locked: false, tw: 0, maxed: false, res: null };

  // ------------------------------------------------------------ geometry and the one write
  const theme = () => (document.documentElement.dataset.theme === "night" ? "night" : "day");
  function geo() {
    const g = GEO[theme()], k = rig.offsetWidth / g.w;
    return { k, rh: rig.offsetHeight, full: Math.max(1, (g.slat - g.cb - 6) * k) };
  }
  function readTy() { const m = /translateY\((-?[\d.]+(?:e-?\d+)?)px\)/.exec(rigMove.style.transform || ""); return m ? -parseFloat(m[1]) : 0; }
  const hOf = () => 1 - readTy() / geo().full;
  function setH(h) {                                  // the same two writes as setTy in proj.js
    const G = geo(), ty = G.full * (1 - h);
    rigMove.style.transform = `translateY(${-ty}px)`; screen.style.setProperty("--rig-h", (G.rh - ty) + "px");
    return ty;
  }
  function emit(live) { const b = Bus(); if (b) b.emit("screen:pull", { h: clamp(hOf(), 0, 1), maximized: S.maxed, live: !!live }); }

  // the content stays attached to the top: the fabric slides up under the case, the content is counter-shifted, and the bottom edge cuts it
  function sync() {
    const G = geo(), ty = Math.max(0, readTy());
    fab.style.setProperty("--ty", ty.toFixed(2) + "px");
    fab.classList.toggle("pulled", ty > 2);
    const h = clamp(1 - ty / G.full, 0, 1);
    if (ring) { ring.setAttribute("aria-expanded", String(h > .02)); ring.dataset.h = h.toFixed(2); }
    place();
  }
  function place() {
    if (!zone) return;
    const a = fab.getBoundingClientRect(), b = page.getBoundingClientRect(), s = slatref.getBoundingClientRect();
    const left = a.left - b.left - 40, w = a.width + 80, cy = s.top - b.top;
    Object.assign(zone.style, { left: left + "px", width: w + "px", top: (cy - 23) + "px" });
  }

  // ------------------------------------------------------------ tween: Pull.to
  function run(from, to, ms, ease) {
    cancel();
    return new Promise(res => {
      if (reduced() || !(ms > 0)) { setH(to); sync(); emit(true); return res(); }
      const id = ++S.tw, t0 = performance.now();
      S.res = res;
      (function f(now) {
        if (id !== S.tw) return;
        const u = clamp((now - t0) / ms, 0, 1); setH(from + (to - from) * ease(u)); sync(); emit(true);
        if (u < 1) requestAnimationFrame(f); else { S.res = null; res(); }
      })(t0);
    });
  }
  function cancel() { S.tw++; if (S.res) { const r = S.res; S.res = null; r(); } }

  async function rollUp() {
    const h0 = clamp(hOf(), 0, OVER); swing();
    if (reduced()) { await run(h0, 0, 0); emit(false); return; }
    const k = clamp(h0 * 1.4, .45, 1);
    await run(h0, -0.02, 600 * k, EASE.roll);
    await run(-0.02, 0, 120, EASE.out); emit(false);
  }
  function swing() { if (!ring || reduced()) return; ring.animate([{ transform: "rotate(0)" }, { transform: "rotate(6deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(0)" }], { duration: 300, easing: "ease-out" }); }
  function pulse() { if (!ring || reduced()) return; ring.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 160, easing: "ease-out" }); }

  const Pull = root.Pull = {
    to(h, ms) { h = clamp(+h, -0.02, OVER); if (ms === undefined) ms = 600; return run(hOf(), h, ms, EASE.io).then(() => emit(false)); },
    get h() { return clamp(hOf(), 0, 1); },
    get maximized() { return S.maxed; },
    get locked() { return S.locked; },
    lock(on) { S.locked = !!on; if (zone) zone.classList.toggle("locked", S.locked); },
    maximize() { if (S.locked) { nudge(); return Promise.resolve(); } const m = root.Screen && root.Screen.maxi; return m ? m.open() : Promise.resolve(); },
    restore() { const m = root.Screen && root.Screen.maxi; return m ? m.close() : Promise.resolve(); },
    rollUp,
    _setMaxed(on) { S.maxed = !!on; if (zone) zone.hidden = S.maxed; emit(false); },
  };

  // ------------------------------------------------------------ the tooltip and the locked nudge
  function say(text, ms) { if (!tip) return; tip.textContent = text; zone.classList.add("tipon"); clearTimeout(tipTimer); if (ms) tipTimer = setTimeout(() => zone.classList.remove("tipon"), ms); }
  function hint() { say(Pull.h < .02 ? COPY.closed : COPY.open); }
  function nudge() {
    say(COPY.busy, 1900);
    if (!reduced()) ring.animate([{ transform: "translateY(0)" }, { transform: "translateY(4px)" }, { transform: "translateY(0)" }], { duration: 260, easing: "cubic-bezier(.3,.7,.3,1)" });
  }

  // ------------------------------------------------------------ pointer: grab, drag, hold, release
  function gestures() {
    let g = null;
    function startHold() {
      clearTimeout(g.timer); ring.classList.remove("filling", "full", "armed"); void ring.offsetWidth;
      g.armed = false; g.hold0 = performance.now(); zone.classList.remove("hold");
      if (!reduced()) ring.classList.add("filling");
      g.timer = setTimeout(() => { g.armed = true; ring.classList.remove("filling"); ring.classList.add("full", "armed"); zone.classList.add("hold"); pulse(); }, HOLD_MS);
    }
    function stopHold() { if (g) { clearTimeout(g.timer); g.armed = false; } ring.classList.remove("filling", "full", "armed"); zone.classList.remove("hold"); }
    zone.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (S.locked) { e.preventDefault(); nudge(); return; }
      cancel(); zone.setPointerCapture(e.pointerId); e.preventDefault();
      const G = geo(), now = performance.now();
      g = { id: e.pointerId, t0: now, y0: e.clientY, h0: hOf(), full: G.full, ax: e.clientX, ay: e.clientY, s: [{ t: now, y: e.clientY }], timer: 0, armed: false };
      zone.classList.add("grabbing"); zone.classList.remove("tipon"); startHold();
    });
    zone.addEventListener("pointermove", e => {
      if (!g || e.pointerId !== g.id) return;
      const now = performance.now(), dy = e.clientY - g.y0; g.s.push({ t: now, y: e.clientY }); while (g.s.length > 2 && now - g.s[0].t > 160) g.s.shift();
      if (Math.hypot(e.clientX - g.ax, e.clientY - g.ay) > SLOP) { g.ax = e.clientX; g.ay = e.clientY; startHold(); }   // moving cancels the hold; it restarts when the pointer rests
      let h = g.h0 + dy / g.full; if (h > 1) h = 1 + (h - 1) * .25;                                                  // resistance past full length
      setH(clamp(h, 0, OVER)); sync(); emit(true);
    });
    const finish = (e, cancelled) => {
      if (!g || e.pointerId !== g.id) return;
      const gg = g; g = null;
      const now = performance.now(), dt = now - gg.t0, travel = Math.abs(e.clientY - gg.y0), h = clamp(hOf(), 0, OVER);
      const a = gg.s.find(p => now - p.t <= 80) || gg.s[0], v = now - a.t > 4 ? ((e.clientY - a.y) / gg.full) / (now - a.t) : 0;   // fraction per ms (negative is up)
      Pull._last = { win: gg.s.map(p => [Math.round(now - p.t), Math.round(p.y)]), dt: Math.round(dt), travel: Math.round(travel), v: +v.toFixed(5), h: +h.toFixed(3), armed: now - gg.hold0 >= HOLD_MS };
      const armed = now - gg.hold0 >= HOLD_MS, startedClosed = gg.h0 < .05, wasDown = e.clientY > gg.y0;
      clearTimeout(gg.timer); ring.classList.remove("filling", "full", "armed"); zone.classList.remove("hold", "grabbing");
      try { zone.releasePointerCapture(e.pointerId); } catch (x) {}
      if (cancelled) { sync(); return; }
      if (armed) { sync(); Pull.maximize(); return; }                                                  // held still, then let go
      if (dt < TUG_MS && travel >= TUG_PX && !(startedClosed && wasDown)) { rollUp(); return; }        // a quick tug (a quick pull down from closed is an opening, not a tug)
      if (v < FLICK && !(startedClosed && h < .05)) { rollUp(); return; }                              // flicked up
      if (h >= .96) { run(h, 1, 280, EASE.out).then(() => emit(false)); return; }                       // nearly full: open
      if (h < .18) { rollUp(); return; }                                                               // nearly closed: roll up
      sync(); emit(false);                                                                             // anywhere else: it stays where it was left
    };
    zone.addEventListener("pointerup", e => finish(e, false));
    zone.addEventListener("pointercancel", e => finish(e, true));
    zone.addEventListener("pointerenter", e => { if (!g && e.pointerType === "mouse") { if (S.locked) say(COPY.busy); else hint(); } });
    zone.addEventListener("pointerleave", () => { if (!g) zone.classList.remove("tipon"); });
    ring.addEventListener("focus", () => { if (ring.matches(":focus-visible")) { if (S.locked) say(COPY.busy); else hint(); } });
    ring.addEventListener("blur", () => zone.classList.remove("tipon"));
    // keyboard: arrows move by .1, Enter or Space toggle, Alt+Enter (or Shift+Enter) maximizes
    ring.addEventListener("keydown", e => {
      const k = e.key; if (!["ArrowUp", "ArrowDown", "Enter", " "].includes(k)) return;
      e.preventDefault(); if (S.locked) { nudge(); return; }
      if (k === "ArrowDown") Pull.to(Math.min(1, Pull.h + .1), 160);
      else if (k === "ArrowUp") Pull.to(Math.max(0, Pull.h - .1), 160);
      else if (k === "Enter" && (e.altKey || e.shiftKey)) Pull.maximize();
      else if (Pull.h > .02) rollUp(); else Pull.to(1, 600);
    });
  }

  // ------------------------------------------------------------ build and wire
  function build() {
    zone = document.createElement("div"); zone.id = "pullzone";
    zone.innerHTML = '<span class="pr-glow" aria-hidden="true"></span><button type="button" id="pullring" aria-label="Projector screen pull" aria-expanded="false" aria-describedby="pulltip">' +
      '<svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true"><circle class="pr-track" cx="15" cy="15" r="11.5"/><circle class="pr-fill" cx="15" cy="15" r="11.5" pathLength="100" transform="rotate(-90 15 15)"/>' +
      '<path class="pr-chev" d="M10.5 13.2 15 17.6l4.5-4.4"/></svg></button><span class="pr-tip" id="pulltip" role="tooltip"></span>';
    page.appendChild(zone); ring = zone.querySelector("#pullring"); tip = zone.querySelector("#pulltip"); tip.textContent = COPY.open;   // a tooltip always has its words
    gestures();
  }
  function init() {
    rig = $("#rig"); rigMove = $("#rigMove"); screen = $("#screen"); fab = $("#fab"); page = $("#page"); slatref = $("#slatref");
    if (!rig || !rigMove || !screen || !fab || !page || !slatref) { console.warn("pull.js: projector markup not found"); return; }
    if (root.Screen && root.Screen.init) root.Screen.init();
    build(); sync();
    // anything that moves the screen (this file, or proj.js's own roll) keeps the counter-shift and the handle in step
    try { new MutationObserver(sync).observe(rigMove, { attributes: true, attributeFilter: ["style"] }); } catch (e) {}
    // proj.js re-fits the rig on resize and on theme change with its own idea of the height (setTy(RG.ty)); take the true height
    // just before that happens and put it back just after
    let keep = 0, rt = 0;
    const snap = () => { if (!rt) keep = clamp(hOf(), 0, 1); };
    const back = ms => { clearTimeout(rt); rt = setTimeout(() => { rt = 0; if (!S.res) { setH(keep); sync(); } }, ms); };
    addEventListener("resize", () => { snap(); back(280); });
    document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-theme-set]")) { snap(); back(120); } }, true);
    const b = Bus();
    if (b) {
      b.on("theme:changed", () => { snap(); back(60); });
      b.on("proj:busy", () => Pull.lock(true)); b.on("proj:idle", () => Pull.lock(false));
      b.on("action:restore", p => { const h = p && p.entry && p.entry.restore && p.entry.restore.h; if (typeof h === "number") Pull.to(h, 500); });
    } else console.warn("pull.js: TerryBus is missing, the pull works without events");
  }
  function loadNext(list, done) {
    const f = list.shift(); if (!f) { done(); return; }
    const s = document.createElement("script"); s.src = f; s.async = false; s.onload = () => loadNext(list, done); s.onerror = () => { console.warn("pull.js: could not load " + f); loadNext(list, done); };
    document.head.appendChild(s);
  }
  function start() { try { init(); } catch (e) { console.warn("pull.js init failed", e); const b = Bus(); if (b) b.emit("error", { module: "pull", e }); } }
  // the layers and the window are loaded from here so index.html needs a single script tag
  const here = (document.currentScript && document.currentScript.src) || "";
  const base = here ? here.replace(/[^/]*$/, "") : "";
  loadNext([base + "layers.js", base + "maxi.js"], () => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); });
})(window);
