/* The landing's three tabs, as pages of the landing itself (owner 8 Nov): What's this about, What's 311, Who built me.
   Clicking a tab turns the whole landing into that page (tabs.css has the move); the same tab again, Escape or the Boston link
   returns the landing. One picture per page, few words. The three old floating sheets in landing.js stay in the markup but are
   never opened. Team names and links: fill TEAM below. */
(function () {
  "use strict";
  const doc = document, html = doc.documentElement, root = doc.getElementById("landing");
  { const ua = navigator.userAgent; if (/AppleWebKit/.test(ua) && !/Chrome\/|Chromium|Edg\//.test(ua)) html.classList.add("tz-wk"); }
  if (!root) return;
  const TEAM = [
    { role: "Wing Lead", name: "Santhoshkumar Chandrasekar", link: "https://iamsanthosh.com", scope: "GenAI system, data, simulator and design", lead: true },
    { role: "Sonar Bridge", name: "Harrish Ebi Francis P", link: "https://www.linkedin.com/in/harrishebifrancis", scope: "Reproducibility check of the data and forecast" },
    { role: "Night Watch", name: "Pradyuman Turlapati", link: "https://www.linkedin.com/in/pradyturlapati", scope: "Testing, QA and deployment" },
  ];
  const REPO = "https://github.com/santhoshkchandrasekar/Bat-Terry";
  // 2024 requests by month, the four departments (data/processed/monthly_demand_2022_2024.csv)
  const M24 = { PWDx: [13582, 11550, 13092, 13998, 13333, 12917, 13915, 16398, 15912, 11639, 10172, 11102], BTDT: [5620, 5954, 7209, 7008, 7511, 7176, 6678, 6719, 7633, 7675, 6606, 5658],
    PARK: [928, 794, 1291, 1519, 2029, 2881, 2640, 2143, 1587, 1153, 935, 836], ISD: [1491, 1285, 1342, 1415, 1555, 1779, 1796, 2077, 1809, 1610, 1215, 1250] };
  const DEP = [["PWDx", "Public Works", "#F0A468"], ["BTDT", "Transportation", "#8FB3DB"], ["PARK", "Parks", "#8CC9A0"], ["ISD", "Inspectional Services", "#D99AA8"]];
  const P = window.TerryPlan2025 || null, city = P ? P.city : { cost: 15621855, ontime: 0.9801 };
  const I = {   // line icons, 24 x 24
    goal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
    flip: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
    owl: '<path d="M5 6l3 2h8l3-2v8a7 7 0 0 1-14 0z"/><circle cx="9.5" cy="12" r="1.6"/><circle cx="14.5" cy="12" r="1.6"/><path d="M11 15.5l1 1 1-1"/>',
    fly: '<path d="M3 17c4-8 10-11 18-10M15 4l6 3-4 5"/>',
    bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    wing: '<path d="M8 72C26 40 56 22 90 18c-8 10-10 20-6 30-12-2-22 2-28 10-6-6-14-8-22-6-6 10-16 18-26 20z"/><path d="M90 18c-4 14-14 26-34 32M84 48C70 50 58 58 52 70"/>',
    sonar: '<circle cx="22" cy="50" r="6"/><path d="M38 30a28 28 0 0 1 0 40M52 20a42 42 0 0 1 0 60M66 12a56 56 0 0 1 0 76"/>',
    moon: '<path d="M70 14A38 38 0 1 0 86 70 30 30 0 0 1 70 14z"/><circle cx="62" cy="54" r="4"/>'
  };
  const BAT = "M12 6.2l1.5 2.2C15 7.2 17.2 6.4 21.3 6.6c-1 1.5-1.2 3-.8 4.6-1.4-.3-2.6.2-3.4 1.4-.9-.9-1.8-1.3-2.9-1.3L12 14.3l-1.9-2.8c-1.1 0-2 .4-2.9 1.3-.8-1.2-2-1.7-3.4-1.4.4-1.6.2-3.1-.8-4.6 4.1-.2 6.3.6 7.8 1.8z";

  // ---- What's this about: one loop, three numbers
  const STEPS = [["goal", "Goal"], ["flip", "Flip"], ["owl", "Predators"], ["fly", "Flyway"], ["bill", "Bill"]];
  const R0 = 190, CX = 260, CY = 250;
  const nodes = STEPS.map(([k, n], i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5, x = CX + R0 * Math.cos(a), y = CY + R0 * Math.sin(a), lx = CX + (R0 + 62) * Math.cos(a), ly = CY + (R0 + 62) * Math.sin(a) + 6;
    return `<g class="tz-node" style="--i:${i}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34" class="tz-nb"/><svg x="${(x - 14).toFixed(1)}" y="${(y - 14).toFixed(1)}" width="28" height="28" viewBox="0 0 24 24" class="tz-ni">${I[k]}</svg>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" class="tz-nl">${n}</text></g>`; }).join("");
  const about = `
  <div class="tz-split">
    <div class="tz-left">
      <h2 class="tz-rv" style="--d:0">A crew plan for 2025, <em>tested by a bat.</em></h2>
      <div class="tz-nums">
        <div class="tz-rv" style="--d:2"><b data-count="${(city.cost / 1e6).toFixed(1)}" data-pre="$" data-suf="M">$0M</b><span>cost of the plan</span></div>
        <div class="tz-rv" style="--d:3"><b data-count="${Math.round(city.ontime * 100)}" data-suf="%">0%</b><span>on time, in the crew model</span></div>
        <div class="tz-rv" style="--d:4"><b data-count="82" data-suf="%">0%</b><span>messages routed right</span></div>
      </div>
      <p class="tz-note tz-rv" style="--d:5">Built on every Boston 311 request from 2022 to 2024. The model writes the words; the engine computes every number.</p>
    </div>
    <div class="tz-right tz-rv" style="--d:1">
      <svg class="tz-loop" viewBox="0 0 520 520" aria-label="Goal, flip, predators, flyway, bill">
        <circle cx="${CX}" cy="${CY}" r="${R0}" class="tz-ring"/>
        <circle cx="${CX}" cy="${CY}" r="${R0}" class="tz-ring2" stroke-dasharray="${(2 * Math.PI * R0).toFixed(1)}" stroke-dashoffset="${(2 * Math.PI * R0).toFixed(1)}" transform="rotate(-90 ${CX} ${CY})"/>
        <g class="tz-orbit" style="transform-origin:${CX}px ${CY}px"><circle cx="${CX}" cy="${CY - R0}" r="5" class="tz-dot"/></g>
        <g transform="translate(${CX - 56},${CY - 52}) scale(4.7)"><path d="${BAT}" transform="translate(-2.2,-.45)" class="tz-bat"/></g>
        ${nodes}
      </svg>
    </div>
  </div>`;

  // ---- What's 311: one number, one chart, four steps
  const W = 760, H = 300, mx = Math.max(...M24.PWDx.map((_, i) => DEP.reduce((s, [k]) => s + M24[k][i], 0)));
  let bars = "", lbl = "";
  for (let i = 0; i < 12; i++) { let y = H; const bw = W / 12 * 0.56, x = i * W / 12 + (W / 12 - bw) / 2;
    DEP.forEach(([k, , c], j) => { const h = M24[k][i] / mx * (H - 30); y -= h; bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${c}" style="transition-delay:${(450 + i * 55 + j * 25)}ms"/>`; });
    lbl += `<text x="${(x + bw / 2).toFixed(1)}" y="${H + 22}" text-anchor="middle">${["Jan", "", "", "Apr", "", "", "Jul", "", "", "Oct", "", ""][i]}</text>`; }
  const tot = DEP.map(([k]) => M24[k].reduce((a, b) => a + b, 0));
  const r311 = `
  <div class="tz-split tz-s311">
    <div class="tz-left">
      <h2 class="tz-rv" style="--d:0">Boston's line for <em>everything but emergencies.</em></h2>
      <div class="tz-hero tz-rv" style="--d:2"><b data-count="306756" data-int="1">0</b><span>requests in 2024, about 840 a day</span></div>
      <ol class="tz-path tz-rv" style="--d:4"><li>Reported</li><li>Routed</li><li class="tz-us">Worked<small>where Bat-Terry plans crews</small></li><li>Closed</li></ol>
    </div>
    <div class="tz-right tz-rv" style="--d:1">
      <svg class="tz-chart" viewBox="0 -10 ${W} ${H + 40}" aria-label="2024 requests by month and department"><g class="tz-bars">${bars}</g>${lbl}</svg>
      <ul class="tz-legend">${DEP.map(([, n, c], i) => `<li><i style="background:${c}"></i>${n}<b data-count="${tot[i]}" data-int="1">0</b></li>`).join("")}</ul>
      <p class="tz-src">2024 requests, the four crew departments. Source: <a href="https://data.boston.gov/dataset/311-service-requests" target="_blank" rel="noopener">Analyze Boston</a></p>
    </div>
  </div>`;

  // ---- Who built me: three badges
  const who = `
  <h2 class="tz-rv tz-c" style="--d:0">Three roles. <em>One bat.</em></h2>
  <div class="tz-crew">${TEAM.map((m, i) => `${i === 1 ? `<svg class="tz-tie tz-rv" style="--d:2" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0V18M22.9 40V18H77.1V40"/></svg>` : ""}<article class="tz-badge tz-rv${m.lead ? " tz-lead" : ""}" style="--d:${i ? 2 + i : 1}">
      <svg class="tz-em" viewBox="0 0 100 100" aria-hidden="true">${I[["wing", "sonar", "moon"][i]]}</svg>
      <div class="tz-role">${m.role}</div><div class="tz-nm">${m.link && m.link !== "#" ? `<a href="${m.link}" target="_blank" rel="noopener">${m.name}</a>` : m.name}</div><div class="tz-sc">${m.scope}</div></article>`).join("")}</div>
  <div class="tz-links tz-rv" style="--d:5"><button class="tz-play" type="button"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7.2v9.6l7.6-4.8z"/></svg></i>Watch the demo<span>3:00</span></button><a class="tz-gh" href="${REPO}" target="_blank" rel="noopener">Code on GitHub<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16L16 8M9.5 8H16v6.5"/></svg></a></div>
  <p class="tz-built tz-rv tz-c" style="--d:6">IE 5374 Applied Generative AI · Northeastern University · 2026</p>`;

  // ---- mount
  const veil = doc.createElement("i"); veil.className = "ld-veil"; veil.setAttribute("aria-hidden", "true");
  const photo = root.querySelector(".ld-scrim"); (photo || root.firstChild).after(veil);
  const charge = doc.createElement("i"); charge.className = "ld-charge"; charge.setAttribute("aria-hidden", "true"); root.appendChild(charge);
  const stage = doc.createElement("div"); stage.id = "ld-stage"; stage.setAttribute("data-scrolls", "");
  stage.innerHTML = `<section class="tz-tb tz-tb-about" data-tab="about" aria-label="What's this about">${about}</section><section class="tz-tb tz-tb-311" data-tab="311" aria-label="What's 311">${r311}</section><section class="tz-tb tz-tb-who" data-tab="who" aria-label="Who built me">${who}</section><button class="tz-back" type="button" aria-label="Back to the landing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Boston</button>`;
  root.appendChild(stage);
  const nav = root.querySelector(".ld-navr"), ind = doc.createElement("i"); ind.className = "ld-ind"; nav.appendChild(ind);
  const KEYS = { "ld-about": "about", "ld-311": "311", "ld-who": "who" };
  const links = [...root.querySelectorAll(".ld-link")];
  links.forEach(l => { l.setAttribute("role", "tab"); l.setAttribute("aria-selected", "false"); l.removeAttribute("aria-expanded"); l.setAttribute("aria-controls", "ld-stage"); });

  let cur = null, swapT = 0;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function placeInd(l) { if (!l) return; const a = l.getBoundingClientRect(), b = nav.getBoundingClientRect(); ind.style.left = (a.left - b.left) + "px"; ind.style.width = a.width + "px"; }
  function count(sec) {
    sec.querySelectorAll("[data-count]").forEach(el => { const to = +el.dataset.count, int = !!el.dataset.int, dec = int ? 0 : (String(el.dataset.count).split(".")[1] || "").length, pre = el.dataset.pre || "", suf = el.dataset.suf || "";
      const t0 = performance.now() + 450, D = reduced ? 1 : 1500;
      (function f(now) { const u = Math.min(1, Math.max(0, (now - t0) / D)), e = 1 - Math.pow(1 - u, 4), v = to * e;
        el.textContent = pre + (int ? Math.round(v).toLocaleString("en-US") : v.toFixed(dec)) + suf; if (u < 1 && cur) requestAnimationFrame(f); else el.textContent = pre + (int ? to.toLocaleString("en-US") : to.toFixed(dec)) + suf; })(performance.now()); });
    sec.querySelectorAll("[data-dash]").forEach(c => { c.style.strokeDashoffset = "251.3"; requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.dash; })); });
  }
  function show(key) {
    const next = stage.querySelector(`.tz-tb[data-tab="${key}"]`), prev = cur && stage.querySelector(`.tz-tb[data-tab="${cur}"]`);
    const first = !cur; cur = key; clearTimeout(swapT);
    links.forEach(l => l.setAttribute("aria-selected", KEYS[l.dataset.sheet] === key ? "true" : "false"));
    placeInd(links.find(l => KEYS[l.dataset.sheet] === key));
    if (first) { html.classList.add("ld-tab"); charge.classList.remove("run"); void charge.offsetWidth; charge.classList.add("run"); }
    const enter = () => { stage.querySelectorAll(".tz-tb").forEach(s => { if (s !== next) s.classList.remove("tz-cur", "tz-on", "tz-off"); });
      next.classList.remove("tz-off"); next.classList.add("tz-cur"); stage.scrollTop = 0; void next.offsetWidth;
      requestAnimationFrame(() => { next.classList.add("tz-on"); count(next); }); };
    if (prev && prev !== next) { prev.classList.add("tz-off"); prev.classList.remove("tz-on"); swapT = setTimeout(enter, reduced ? 0 : 300); }
    else enter();
  }
  function hide() {
    if (!cur) return; closeFilm(); const s = stage.querySelector(`.tz-tb[data-tab="${cur}"]`); cur = null;
    links.forEach(l => l.setAttribute("aria-selected", "false"));
    s.classList.add("tz-off"); s.classList.remove("tz-on");
    swapT = setTimeout(() => { s.classList.remove("tz-cur", "tz-off"); }, 320);
    html.classList.remove("ld-tab");
  }
  // the tab links: intercepted before landing.js's sheet handlers
  root.addEventListener("click", e => {
    const l = e.target.closest && e.target.closest(".ld-link");
    if (l) { e.stopPropagation(); e.preventDefault(); const k = KEYS[l.dataset.sheet]; if (k === cur) hide(); else show(k); return; }
    if (e.target.closest && e.target.closest("#ld-stage .tz-back")) { e.stopPropagation(); hide(); }
  }, true);
  // the demo film: a player over everything; Escape, the close button or a click outside closes it (and pauses it)
  let film = null;
  function openFilm() {
    if (!film) {
      film = doc.createElement("div"); film.className = "tz-film"; film.setAttribute("role", "dialog"); film.setAttribute("aria-modal", "true"); film.setAttribute("aria-label", "Bat-Terry demo video");
      film.innerHTML = `<button class="tz-film-x" type="button" aria-label="Close the video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><video controls playsinline preload="metadata" poster="assets/demo/demo-poster.jpg"><source src="assets/demo/demo.mp4" type="video/mp4"><track kind="captions" src="assets/demo/demo.vtt" srclang="en" label="English"></video>`;
      film.addEventListener("click", e => { if (e.target === film || e.target.closest(".tz-film-x")) closeFilm(); });
      doc.body.appendChild(film);
    }
    film.hidden = false; void film.offsetWidth; film.classList.add("on");
    const v = film.querySelector("video"); try { v.currentTime = 0; } catch (e) {} const p = v.play(); if (p && p.catch) p.catch(() => {});
    film.querySelector(".tz-film-x").focus({ preventScroll: true });
  }
  function closeFilm() { if (!film || film.hidden) return; film.querySelector("video").pause(); film.classList.remove("on"); setTimeout(() => { if (!film.classList.contains("on")) film.hidden = true; }, 350); const b = stage.querySelector(".tz-play"); if (b) b.focus({ preventScroll: true }); }
  const filmOpen = () => film && !film.hidden && film.classList.contains("on");
  stage.addEventListener("click", e => { if (e.target.closest && e.target.closest(".tz-play")) openFilm(); });
  root.querySelector(".ld-brand").addEventListener("click", () => hide());
  addEventListener("keydown", e => { if (e.key !== "Escape") return; if (filmOpen()) { e.stopPropagation(); closeFilm(); return; } if (cur) { e.stopPropagation(); hide(); } }, true);
  addEventListener("resize", () => { if (cur) placeInd(links.find(l => KEYS[l.dataset.sheet] === cur)); });
  // while a tab, the film or the 2025 plan is open the page must not scroll under it (a document scroll would carry the landing
  // into the planner): only the open layer scrolls, when it has more to show, and nothing else moves
  const planOpen = () => doc.querySelector("#landing .ld-plan.open");
  const locked = () => cur || filmOpen() || planOpen();
  const layer = () => filmOpen() ? null : planOpen() ? planOpen().querySelector(".ld-ledger") : cur ? stage : null;
  // the nearest box between the touch and the open layer that can scroll, either way (the plan table also scrolls sideways on phones)
  const scroller = t => {
    const b = layer(); if (!b || !t || !b.contains(t)) return null;
    for (let e = t.nodeType === 1 ? t : t.parentElement; e; e = e.parentElement) {
      const cs = getComputedStyle(e), y = /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2, x = /auto|scroll/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2;
      if (x || y) return e; if (e === b) break;
    }
    return null;
  };
  const hold = e => { if (!locked()) return; if (cur || filmOpen()) e.stopImmediatePropagation(); if (!scroller(e.target) && e.cancelable) e.preventDefault(); };
  addEventListener("wheel", hold, { capture: true, passive: false });
  addEventListener("touchmove", hold, { capture: true, passive: false });
  const KSTEP = { ArrowDown: 60, ArrowUp: -60, PageDown: .85, PageUp: -.85, " ": .85, End: 1e6, Home: -1e6 };
  addEventListener("keydown", e => {
    const K = e["key"], step = KSTEP[K]; if (step === undefined || !locked()) return;
    const a = doc.activeElement, tag = (a && a.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (a && a.isContentEditable) || (K === " " && /^(BUTTON|A|VIDEO)$/.test(tag))) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const b = layer(); if (!b) return;
    const dy = Math.abs(step) < 1 ? step * b.clientHeight : step; b.scrollBy({ top: K === " " && e.shiftKey ? -dy : dy });
  }, true);
  window.TerryTabs = { show, hide, cur: () => cur };
})();
