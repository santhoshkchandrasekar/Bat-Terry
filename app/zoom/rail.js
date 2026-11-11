/* Section rail: a slim glass capsule of section icons at the left edge of the screen; it never sits up among the branch.
   Hovering widens it into a labelled list. Each entry makes the same move as Ping's "go to ..." (TerryGuide.go), so the rail and Ping always agree.
   Entries that only exist after a chase stay faded. Laptops only (rail.css hides it on phones and narrow windows). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const part = s => { for (const b of document.querySelectorAll("#rbodies > .rbody")) { if (b.hidden) continue; const e = b.querySelector(s); if (e && e.getBoundingClientRect().height > 0) return e; } return null; };
  const I = {
    goal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.2" class="f"/>',
    projector: '<path d="M9 2.5 7.5 4.5M15 2.5l1.5 2"/><rect x="3" y="4.5" width="18" height="2.4" rx="1.2"/><path d="M4.8 6.9v10.6h14.4V6.9"/><path d="M7.8 14.5l2.9-3 2.3 2 3.4-3.6"/><path d="M12 17.5v2.2"/>',
    machine: '<path d="M2.5 20c3-1.3 6.5-1.3 9.5.5 3-1.8 6.5-1.8 9.5-.5"/><path d="M2.5 20v-3.6c1.4-.6 2.9-.9 4.5-.9M21.5 20v-3.6c-1.4-.6-2.9-.9-4.5-.9"/><rect x="7.5" y="4" width="9" height="13" rx="1.6"/><path d="M10.6 2.6h2.8"/><path d="M14.1 8.1c-.5-.6-1.2-.9-2-.9-1.1 0-1.9.6-1.9 1.4 0 2 3.9 1.1 3.9 3.2 0 .8-.8 1.4-1.9 1.4-.9 0-1.6-.4-2.1-1M12 6v8.8"/>',
    fail: '<defs><mask id="srail-mk"><rect width="24" height="24" fill="#fff"/><circle cx="12" cy="11.68" r="3.60" fill="#000"/></mask></defs><path d="M6.5 3h11"/><path d="M12 3V6.17"/><g mask="url(#srail-mk)"><g transform="translate(12 9.60) scale(1.30) translate(-12 -9) rotate(180 12 9)"><path d="M12 7.4c-.5-.9-1.4-1.4-2-1.5l.3 1.6C8.3 6.8 5 5.5 2 6c1.6.9 2.5 2.4 2.6 4.2 1-.7 2.3-.8 3.3-.1.4-1.1 1.3-1.7 2.3-1.7.3 1.6 1 2.9 1.8 3.8.8-.9 1.5-2.2 1.8-3.8 1 0 1.9.6 2.3 1.7 1-.7 2.3-.6 3.3.1.1-1.8 1-3.3 2.6-4.2-3-.5-6.3.8-8.3 1.5l.3-1.6c-.6.1-1.5.6-2 1.5z" class="f"/></g></g><circle cx="12" cy="11.68" r="2.60"/><circle cx="12" cy="11.68" r="0.99" class="f"/><path d="M10.3 13.68 9.6 15.98 11.4 14.48z M13.7 13.68 14.4 15.98 12.6 14.48z" class="f"/>',
    pred: '<path d="M5 10.5C5 7 8 5 12 5s7 2 7 5.5V14a7 7 0 0 1-14 0z"/><path d="M5.5 8.8L12 11l6.5-2.2"/><circle cx="9" cy="13" r="1.9"/><circle cx="15" cy="13" r="1.9"/><path d="M11.2 16.2h1.6L12 17.6z" class="f"/>',
    fly: '<path d="M3 21c1.5-3.6 4.4-8 8.4-10.2" stroke-dasharray="1.5 2.1"/><g transform="translate(1 -2.6)"><path d="M12 7.4c-.5-.9-1.4-1.4-2-1.5l.3 1.6C8.3 6.8 5 5.5 2 6c1.6.9 2.5 2.4 2.6 4.2 1-.7 2.3-.8 3.3-.1.4-1.1 1.3-1.7 2.3-1.7.3 1.6 1 2.9 1.8 3.8.8-.9 1.5-2.2 1.8-3.8 1 0 1.9.6 2.3 1.7 1-.7 2.3-.6 3.3.1.1-1.8 1-3.3 2.6-4.2-3-.5-6.3.8-8.3 1.5l.3-1.6c-.6.1-1.5.6-2 1.5z" class="f"/></g>',
    ledger: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="M9.5 10v9"/><path d="M14.8 10v9"/>',
    echo: '<circle cx="12" cy="2.8" r="1.3" class="f"/><path d="M9.3 5.4c1.6 1.3 3.8 1.3 5.4 0"/><path d="M6.8 7.8c3.1 2.4 7.3 2.4 10.4 0"/><path d="M2.8 14.2l6-2 6.4 2 6-2v7.8l-6 2-6.4-2-6 2z"/><path d="M8.8 12.2v7.8M15.2 14.2v7.8"/>',
  };
  const ITEMS = [
    { key: "goal", label: "Goal", el: () => { const f = $("#goalform"); return f && f.getBoundingClientRect().height > 0 ? f : $("#goalpill"); } },
    { key: "projector", label: "Projector", el: () => $("#fab") },
    { key: "machine", label: "Almanac & BUDGETerry", el: () => $("#almanac") },
    { key: "fail", label: "Flip side", el: () => part(".tt-top") || $("#failcard"), needsChase: true },
    { key: "pred", label: "Predators", sub: true, el: () => part("section.pred:not(.qs)"), needsChase: true },
    { key: "fly", label: "Flyway", sub: true, el: () => { const f = part("section.flyp"); return f ? (f.closest(".tt-fadein") || f) : $("#flysec"); }, needsChase: true },
    { key: "echo", label: "Echolocation", el: () => $("#terrytory section.qs") },
    { key: "ledger", label: "2025 crew plan", el: () => $("#ledger") },
  ];
  const nav = document.createElement("nav"); nav.id = "srail"; nav.setAttribute("aria-label", "Sections on this page");
  nav.innerHTML = `<span class="lns" aria-hidden="true"></span>` + ITEMS.map(x => `<button type="button" data-k="${x.key}" aria-label="Go to ${x.label}" title="${x.label}"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${I[x.key]}</svg></span><span class="lb">${x.label}</span></button>`).join("");
  document.body.appendChild(nav);
  const btn = k => nav.querySelector(`[data-k="${k}"]`), lns = nav.querySelector(".lns");
  nav.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b || b.classList.contains("later")) return;
    const k = b.dataset.k, item = ITEMS.find(x => x.key === k), G = window.TerryGuide;
    const r = G && G.go ? await G.go(k) : null;
    // Ping could not take you (busy with something, or the spot moved): the rail scrolls there itself
    if (!r || !r.ok) { const el = item && item.el(); if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
  });
  let raf = 0;
  function update() {
    raf = 0; if (getComputedStyle(nav).display === "none") return;
    // every section that is properly in view is lit (most of a small one, or a good part of the screen for a tall one);
    // when nothing is, the nearest one is. Lit icons that sit next to each other in the list are joined by a line.
    const mid = innerHeight * 0.45, lit = []; let best = null, bestScore = 1e12;
    for (const x of ITEMS) {
      const e = x.el(), r = e && e.getBoundingClientRect(), live = !!(r && r.height > 0);
      btn(x.key).classList.toggle("later", !!x.needsChase && !live);
      if (!live) continue;
      const seen = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (seen > 24 && seen >= Math.min(r.height * 0.6, innerHeight * 0.3)) lit.push(x.key);
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestScore) { bestScore = d; best = x.key; }
    }
    if (!lit.length && best) lit.push(best);
    const keys = ITEMS.map(x => x.key), idx = lit.map(k => keys.indexOf(k)).sort((a, b) => a - b);
    nav.querySelectorAll("button").forEach(b => { const on = lit.includes(b.dataset.k); b.classList.toggle("here", on); if (on && b.dataset.k === keys[idx[0]]) b.setAttribute("aria-current", "location"); else b.removeAttribute("aria-current"); });
    // the joining line runs in the gaps between icons, from the first lit icon to the last, so it never crosses an icon
    let segs = "";
    if (idx.length > 1) for (let i = idx[0]; i < idx[idx.length - 1]; i++) {
      const a = btn(keys[i]), b2 = btn(keys[i + 1]), y1 = a.offsetTop + a.offsetHeight / 2 + 11, y2 = b2.offsetTop + b2.offsetHeight / 2 - 11;
      if (y2 > y1) segs += `<i style="top:${y1}px;height:${y2 - y1}px"></i>`;
    }
    if (lns.innerHTML !== segs) lns.innerHTML = segs;
    // vertically centered, but never up among the branch and the rig: at the top of the page it starts level with the projector
    // cloth, and it always stays clear of the Ping dock at the bottom
    const h = nav.offsetHeight, fab = $("#fab"), ft = fab ? fab.getBoundingClientRect().top : -1e4;
    nav.style.top = Math.round(Math.max(16, Math.min(Math.max(innerHeight / 2 - h / 2, ft + 12), innerHeight - h - 110))) + "px";
    // the Roost leaf takes this margin when it opens or pins, so the rail steps aside
    const L = $("#leaf-left"); document.documentElement.classList.toggle("rail-hide", !!L && L.dataset.state !== "rest");
  }
  const ask = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener("scroll", ask, { passive: true }); addEventListener("resize", ask); setInterval(ask, 700); ask();
})();
