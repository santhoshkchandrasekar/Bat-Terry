/* layers.js (Engineer 3): adds the F2 light layers to a fabric element at runtime, and the page-level spill.
   Loaded by pull.js. Screen.layers(el) is also used by the maximized window, so both are the same cloth. */
(function (root) {
  "use strict";
  const $ = s => document.querySelector(s);
  const mk = (cls) => { const d = document.createElement("div"); d.className = cls; d.setAttribute("aria-hidden", "true"); return d; };
  const Screen = root.Screen = root.Screen || {};
  Screen.layers = function (el, ids) {
    if (!el || el.querySelector(":scope > .s-beam")) return el;
    el.classList.add("rf");
    const beam = mk("s-beam"), grain = mk("s-grain"), lamp = mk("s-lamp"), cut = mk("s-cut");
    if (ids) { beam.id = "beam"; grain.id = "grain"; }
    el.insertBefore(beam, el.firstChild); el.insertBefore(grain, beam.nextSibling); el.appendChild(lamp); el.appendChild(cut);
    return el;
  };

  function init() {
    const page = $("#page"), fab = $("#fab"), rigMove = $("#rigMove");
    if (!page || !fab) return;
    Screen.layers(fab, true);
    // the spill: the fabric rectangle grown by 220 px, with the fabric itself cut out of it
    const sp = document.createElement("div"); sp.id = "spill"; sp.setAttribute("aria-hidden", "true"); page.appendChild(sp);
    const G = 220;
    const place = () => {
      const a = fab.getBoundingClientRect(), b = page.getBoundingClientRect();
      const x = a.left - b.left - G, y = a.top - b.top - G, w = a.width + 2 * G, h = a.height + 2 * G;
      Object.assign(sp.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
      const ph = Math.max(0, Math.min(1, root.Pull ? root.Pull.h : 1)); sp.style.setProperty("--ph", String(ph * ph));   // no light where the cloth has rolled up
      sp.style.setProperty("--hx", G + "px"); sp.style.setProperty("--hy", G + "px"); sp.style.setProperty("--hw", a.width + "px"); sp.style.setProperty("--hh", a.height + "px");
    };
    place();
    try { new MutationObserver(place).observe(rigMove, { attributes: true, attributeFilter: ["style"] }); new MutationObserver(place).observe(fab, { attributes: true, attributeFilter: ["style"] }); } catch (e) {}
    addEventListener("resize", () => setTimeout(place, 220));
    Screen.placeSpill = place;
    // the screen lights (Night): on first draw, on every plan:view and when Night is chosen
    const light = () => { page.classList.remove("s-lighting"); void page.offsetWidth; page.classList.add("s-lighting"); };
    Screen.light = light; light();
    page.addEventListener("animationend", e => { if (e.target === page) page.classList.remove("s-lighting"); });
    if (root.TerryBus && root.TerryBus.on) { root.TerryBus.on("plan:view", light); root.TerryBus.on("theme:changed", light); }
    else new MutationObserver(light).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  Screen.init = function () { try { init(); } catch (e) { console.warn("screen layers failed", e); if (root.TerryBus) root.TerryBus.emit("error", { module: "layers", e }); } };
})(window);
