/* TerryBus and TerryState: the one place the page's parts talk to each other. No dependencies.
 * Load this before every other script. State is a snapshot that is replaced on every change; only TerryRoost (roost.js) writes it. */
(function (root) {
  "use strict";
  if (root.TerryBus) return;
  const subs = new Map();
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const Bus = {
    on(evt, fn) { if (!subs.has(evt)) subs.set(evt, new Set()); subs.get(evt).add(fn); return () => Bus.off(evt, fn); },
    off(evt, fn) { const s = subs.get(evt); if (s) s.delete(fn); },
    emit(evt, payload) {
      const s = subs.get(evt); if (!s) return;
      for (const fn of [...s]) { try { fn(payload === undefined ? {} : payload); } catch (e) { if (evt !== "error") Bus.emit("error", { module: "bus:" + evt, e }); else console.warn("bus error", e && e.message); } }
    },
    once(evt) { return new Promise(res => { const f = p => { Bus.off(evt, f); res(p); }; Bus.on(evt, f); }); },
    // one tween for every module: instant under reduced motion. ease is cubic in-out.
    tween(ms, fn) {
      return new Promise(res => {
        if (reduced() || !(ms > 0)) { fn(1); return res(); }
        const t0 = performance.now();
        (function f(now) { const u = Math.min(1, (now - t0) / ms); fn(u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2); if (u < 1) requestAnimationFrame(f); else res(); })(t0);
      });
    },
    reduced,
  };
  root.TerryBus = Bus;
  root.TerryState = {
    theme: "day", busy: false, roosts: [], activeRoost: null,
    screen: { level: 0, dept: null, month: null, h: 1, maximized: false },
    compare: null, log: [],
  };
  Bus.on("error", p => { try { console.warn("terry module error", p && p.module, p && p.e && p.e.message); } catch (e) {} });
})(typeof window !== "undefined" ? window : globalThis);
