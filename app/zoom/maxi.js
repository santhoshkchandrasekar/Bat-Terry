/* maxi.js (Engineer 3): the maximized projector window (F4).
   The screen unrolls in front of you: a FLIP from the fabric on the page to a large window. The chart's own DOM (#stage) is
   moved in, not cloned, and __zoom.relayout() redraws it at the larger size, then again after it goes home.
   Close with Esc, the X, a click outside, or by pulling the window's bottom bar up (120 px, or a quick flick). */
(function (root) {
  "use strict";
  const $ = s => document.querySelector(s);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const Bus = () => (root.TerryBus && root.TerryBus.emit ? root.TerryBus : null);
  const Screen = root.Screen = root.Screen || {};
  const OPEN_MS = 480, CLOSE_MS = 420, PULL_CLOSE = 120, FLICK = -0.0018;
  let mx, win, back, mxFab, xbtn, bar, grip, st = { open: false, busy: false, from: null, opener: null };


  // ---- a small Terry silhouette that flaps slowly with sonar rings; it fades in only after 250 ms, so quick opens never flash it
  const BAT_SVG = '<svg viewBox="0 0 120 64" width="96" height="51" aria-hidden="true"><g class="bl-wl"><path d="M60 30C48 14 28 12 6 20c8 2 10 6 10 12 6-4 10-2 12 4 4-4 8-4 12 0 4-2 8 0 12 2z"/></g><g class="bl-wr"><path d="M60 30C72 14 92 12 114 20c-8 2-10 6-10 12-6-4-10-2-12 4-4-4-8-4-12 0-4-2-8 0-12 2z"/></g><path d="M52 22l3-9 5 6 5-6 3 9c1 12-3 22-8 28-5-6-9-16-8-28z"/></svg>';
  const Loader = {
    timer: 0, el: null, host: null,
    // caption: shown under the bat (a projector wait: "Visualizing the Flyway…"); without one it reads "Opening" to screen readers only.
    // cls "pv": the element is placed at once and fades in after 250 ms by a CSS delay, so it still appears while the main thread is busy
    show(host, delay, caption, cls) {
      this.hide(true); this.host = host; const d = delay === undefined ? 250 : delay;
      const put = () => {
        const e = document.createElement("div"); e.className = "bat-loader" + (cls ? " " + cls : ""); e.setAttribute("role", "status");
        const t = caption || "Opening";
        e.innerHTML = '<span class="bl-rings" aria-hidden="true"><i></i><i></i><i></i></span>' + BAT_SVG + (caption || reduced() ? `<span class="bl-t">${t}</span>` : `<span class="sr-only">${t}</span>`);
        host.appendChild(e); this.el = e; requestAnimationFrame(() => e.classList.add("on"));
      };
      if (cls) put(); else this.timer = setTimeout(put, d);
    },
    // the bat leaves: up and to the right, wings faster, rings stopped; resolves when it is gone
    async fly() {
      const e = this.el; if (!e || reduced()) return; e.classList.add("fast");
      try { await e.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: "translate(200px,-320px)", opacity: 0 }], { duration: 420, easing: "ease-in", fill: "forwards" }).finished; } catch (err) {}
    },
    hide(quick) { clearTimeout(this.timer); const e = this.el; this.el = null; if (!e) return; if (quick || reduced()) e.remove(); else { e.classList.remove("on"); setTimeout(() => e.remove(), 200); } },
  };
  Screen.loader = Loader;

  function build() {
    if (mx) return;
    mx = document.createElement("div"); mx.id = "maxi"; mx.hidden = true;
    mx.innerHTML = '<div class="mx-back"></div>' +
      '<div class="mx-win" role="dialog" aria-modal="true" aria-label="Projector screen, enlarged">' +
      '<span class="mx-hint">Esc to close</span>' +
      '<button type="button" class="mx-x" aria-label="Close the enlarged screen"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg></button>' +
      '<div class="mx-roller" aria-hidden="true"></div><div class="mx-fab screen"></div>' +
      '<div class="mx-bar" role="presentation"><span class="mx-grip" aria-hidden="true"></span></div></div>';
    document.body.appendChild(mx);
    back = mx.querySelector(".mx-back"); win = mx.querySelector(".mx-win"); mxFab = mx.querySelector(".mx-fab"); xbtn = mx.querySelector(".mx-x"); bar = mx.querySelector(".mx-bar"); grip = mx.querySelector(".mx-grip");
    if (Screen.layers) Screen.layers(mxFab);
    back.addEventListener("click", () => close());
    xbtn.addEventListener("click", () => close());
    pullUp();
  }

  // the rectangle of the screen as it shows on the page now (the part below the case)
  function pageRect() {
    const fab = $("#fab"), r = fab.getBoundingClientRect(), rig = $("#rigBot").getBoundingClientRect();
    const g = (document.documentElement.dataset.theme === "night") ? 186 : 192, k = $("#rig").offsetWidth / (document.documentElement.dataset.theme === "night" ? 1915 : 1916);
    const caseB = rig.top + g * k, top = Math.max(r.top, caseB), h = Math.max(36, r.bottom - top);
    return { l: r.left, t: r.bottom - h, w: r.width, h };
  }
  const flip = (from, to, extra) => `translate(${from.l - to.left}px, ${from.t - to.top}px) scale(${from.w / to.width}, ${from.h / to.height})${extra || ""}`;
  const relayout = () => { const z = root.__zoom; return z && z.relayout ? Promise.resolve(z.relayout(0)).catch(e => console.warn("relayout failed", e)) : Promise.resolve(); };
  const settle = el => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  async function open() {
    if (st.open || st.busy) return;
    const stage = $("#stage"), fab = $("#fab"); if (!stage || !fab) return;
    const P = root.__mxPerf = { t0: performance.now() }; st.busy = true; st.opening = true; st.wantClose = false; build();
    st.opener = document.activeElement; st.from = pageRect();
    mx.hidden = false; mx.classList.add("on"); mx.classList.remove("closing");
    document.documentElement.classList.add("mx-open");
    // the chart goes in as it is and is scaled up to fill the window while the window grows; it is redrawn once, after the grow, and swapped in
    const sw0 = stage.offsetWidth, sh0 = stage.offsetHeight; mxFab.insertBefore(stage, mxFab.querySelector(".s-lamp"));
    win.style.transform = ""; const to = win.getBoundingClientRect(); st.open = true;
    const kk = Math.max(0.3, Math.min((mxFab.clientWidth - 32) / Math.max(1, sw0), (mxFab.clientHeight) / Math.max(1, sh0)));
    stage.style.transformOrigin = "0 0"; stage.style.transform = `scale(${kk})`; stage.style.marginTop = ""; stage.classList.add("mx-dim"); Loader.show(mxFab, 0);
    if (root.Pull) root.Pull._setMaxed(true);
    const anims = [];
    if (!reduced()) {
      anims.push(win.animate([{ transform: flip(st.from, to), transformOrigin: "0 0", borderRadius: "0px" }, { transform: "none", transformOrigin: "0 0", borderRadius: "12px" }], { duration: OPEN_MS, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" }).finished);
      anims.push(back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing: "ease-out", fill: "backwards" }).finished);
    }
    P.setup = performance.now() - P.t0;
    await Promise.all(anims.map(p => Promise.resolve(p).catch(() => {}))); P.flip = performance.now() - P.t0;
    await settle(); await relayout(); P.relayout = performance.now() - P.t0;
    stage.style.transform = ""; stage.style.transformOrigin = ""; center(stage); stage.classList.remove("mx-hold");
    await Loader.fly(); Loader.hide(true); stage.classList.add("mx-lift"); stage.classList.remove("mx-dim"); setTimeout(() => stage.classList.remove("mx-lift"), 300); P.ready = performance.now() - P.t0;
    xbtn.focus({ preventScroll: true }); requestAnimationFrame(() => { P.painted = performance.now() - P.t0; P.rl = window.__rlPerf; try { console.log("mx-perf", JSON.stringify(P)); } catch (e) {} });
    st.busy = false; st.opening = false; if (Bus()) Bus().emit("screen:pull", { h: root.Pull ? root.Pull.h : 1, maximized: true });
    if (st.wantClose) { st.wantClose = false; close(); }   // Esc pressed while the window was still opening
  }

  // the chart keeps its own height, so in the big window it sits a little above the middle rather than hugging the roller
  function center(stage) { stage.style.marginTop = Math.max(0, Math.round((mxFab.clientHeight - stage.offsetHeight) * .3)) + "px"; }

  async function close(fromDrag) {
    if (st.busy) { if (st.open || st.opening) st.wantClose = true; return; }   // a close asked for mid-animation waits for it
    if (!st.open) return;
    st.busy = true;
    const stage = $("#stage"), fab = $("#fab"); mx.classList.add("closing");
    const dragY = fromDrag || 0;
    // the chart fades, goes home and is redrawn at its page size while the window is still there
    if (!reduced()) { try { await stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" }).finished; } catch (e) {} }
    stage.style.marginTop = ""; stage.classList.add("mx-hold"); fab.insertBefore(stage, fab.querySelector(".s-lamp"));
    stage.getAnimations().forEach(a => a.cancel());
    await relayout();
    const target = pageRect(); win.style.transform = ""; const cur = win.getBoundingClientRect();
    if (!reduced()) {
      const a = win.animate([{ transform: dragY ? `translateY(${dragY}px)` : "none", transformOrigin: "0 0", borderRadius: "12px" }, { transform: flip(target, cur), transformOrigin: "0 0", borderRadius: "0px" }], { duration: CLOSE_MS, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" });
      const b = back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: "ease-in", fill: "forwards" });
      try { await Promise.all([a.finished, b.finished]); } catch (e) {}
      a.cancel(); b.cancel();
    }
    mx.classList.remove("on", "closing"); mx.hidden = true; win.style.transform = ""; document.documentElement.classList.remove("mx-open");
    stage.classList.remove("mx-hold");
    if (!reduced()) stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
    st.open = false; st.busy = false;
    if (root.Pull) root.Pull._setMaxed(false);
    const o = st.opener; st.opener = null;
    const ring = $("#pullring"); try { (o && o.isConnected && o !== document.body ? o : ring).focus({ preventScroll: true }); } catch (e) {}
    if (Bus()) Bus().emit("screen:pull", { h: root.Pull ? root.Pull.h : 1, maximized: false });
  }

  // pulling the window's bottom bar up closes it: 120 px or more, or a quick upward flick
  function pullUp() {
    let g = null;
    bar.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button !== 0) return; if (st.busy) return; bar.setPointerCapture(e.pointerId); e.preventDefault(); const t = performance.now(); g = { id: e.pointerId, y0: e.clientY, s: [{ t, y: e.clientY }], dy: 0 }; bar.classList.add("grabbing"); });
    bar.addEventListener("pointermove", e => {
      if (!g || e.pointerId !== g.id) return; const now = performance.now(); g.s.push({ t: now, y: e.clientY }); while (g.s.length > 2 && now - g.s[0].t > 160) g.s.shift();
      const dy = e.clientY - g.y0; g.dy = dy < 0 ? dy : dy * .2;                              // up follows the hand, down resists
      win.style.transform = `translateY(${g.dy}px)`;
    });
    const end = (e, cancelled) => {
      if (!g || e.pointerId !== g.id) return; const gg = g; g = null; bar.classList.remove("grabbing"); try { bar.releasePointerCapture(e.pointerId); } catch (x) {}
      const now = performance.now(), a = gg.s.find(p => now - p.t <= 80) || gg.s[0], v = now - a.t > 4 ? ((e.clientY - a.y) / Math.max(1, win.offsetHeight)) / (now - a.t) : 0;
      if (!cancelled && (gg.dy <= -PULL_CLOSE || (v < FLICK && gg.dy < -12))) { close(gg.dy); return; }
      if (reduced()) { win.style.transform = ""; return; }
      const an = win.animate([{ transform: `translateY(${gg.dy}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.3,1.3,.5,1)" }); win.style.transform = ""; an.finished.catch(() => {});
    };
    bar.addEventListener("pointerup", e => end(e, false)); bar.addEventListener("pointercancel", e => end(e, true));
  }

  // Esc closes the window, but an open sheet, info popover or table closes first (nearest first)
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !(st.open || st.opening) || e.defaultPrevented) return;
    if (document.getElementById("why") || ($("#infopop") && !$("#infopop").hidden) || ($("#tablewrap") && !$("#tablewrap").hidden)) return;
    e.preventDefault(); e.stopImmediatePropagation(); close();
  }, true);

  // switching Roosts redraws the cloth: the same loader shows if that takes longer than 250 ms
  try { const B = root.TerryBus; if (B) { let safety = 0; const pvUp = () => !!(Loader.el && Loader.el.classList.contains("pv"));   // the chase's own loader is showing: leave it be
      B.on("roost:activated", () => { const f = $("#fab"); if (!f || st.open || pvUp()) return; const S = root.TerryState || {}, r = (S.roosts || []).find(x => x.id === S.activeRoost); Loader.show(f, 250, r && r.view === "stay" ? "Visualizing the original plan\u2026" : "Visualizing the Flyway\u2026"); clearTimeout(safety); safety = setTimeout(() => Loader.hide(), 6000); }); B.on("screen:draw", () => { if (!st.opening && !pvUp()) { clearTimeout(safety); Loader.hide(); } }); } } catch (e) {}
  Screen.maxi = { open, close: () => close(), get isOpen() { return st.open; } };
})(window);
