/* The landing: the first screen of every visit (owner's vision). The opening plays over it on a first visit and its lockup lands
   on the landing's brand; then the line and the eve of 2025 come up. The page does not scroll: the first scroll (or "Scroll into
   2025") unfolds it into the planner. The photograph shrinks into the hero, the line shrinks into the header's tagline, the dot steps
   into January and the page comes up under it. It shows on every visit and every reload, after the opening.
   Flags: ?landing=1 forces it, ?landing=0 turns it off. Automated browsers skip it unless forced, so the page's own checks are unchanged.
   Hooks: window.TerryLanding = { active, enter(), T }. Event "terry:landing" on document when the page is in. */
(function () {
  "use strict";
  const Q = location.search, doc = document, html = doc.documentElement;
  const forced = /[?&]landing=1\b/.test(Q), off = /[?&]landing=0\b/.test(Q);
  const LDX = ((Q.match(/[?&]ldx=([\w,]+)/) || [])[1] || "");   // test switches for the repaint profiler (nomask, nonear, nopage); never set by the page
  // the lighter move (owner 7 Nov, 200% laptop screen): magnifying the whole planner makes the browser redraw it every frame, which
  // laptop graphics at 2x cannot keep up with (unfinished tiles). On sharp screens the planner stays at its own size and fades up
  // under the pulling-back photograph; the leaves and the dock still fly in. ?ldx=lite / ?ldx=full force either for testing.
  const LITE = LDX.includes("lite") || (!LDX.includes("full") && (window.devicePixelRatio || 1) >= 1.5);
  const KEY = "terry.entered";
  const entered = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
  const api = window.TerryLanding = { active: false, T: 2.4 };
  if (off || (!forced && (navigator.webdriver || location.hash.length > 1))) return;   // every visit and every reload (owner 17:06)
  try { if (localStorage.getItem("terry.theme") === "night") html.dataset.theme = "night"; } catch (e) {}
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const IMG = '<img class="day" src="assets/boston-dusk.webp" alt="" width="1916" height="821" decoding="async"><img class="night" src="assets/boston-night.webp" alt="" width="1916" height="821" decoding="async">';
  const root = doc.createElement("div"); root.id = "landing";
  root.innerHTML = `
<div class="ld-bg"></div><div class="ld-ground" aria-hidden="true"></div>
<div class="ld-photo" aria-hidden="true">${IMG}<i class="ld-hscrim"></i></div><i class="ld-scrim" aria-hidden="true"></i>
<div class="ld-terry" aria-hidden="true"></div>
<header class="ld-nav">
  <div class="ld-brand"><svg class="i" aria-hidden="true"><use href="#i-bat"/></svg><span class="nm">Bat-Terry</span><span class="sub">The battery that keeps Boston's 311 crews moving.</span></div>
  <nav class="ld-navr ld-a" aria-label="About Bat-Terry">
    <button class="ld-link" type="button" aria-expanded="false" aria-controls="ld-about" data-sheet="ld-about">What's this about</button>
    <button class="ld-link" type="button" aria-expanded="false" aria-controls="ld-311" data-sheet="ld-311">What's 311</button>
    <button class="ld-link" type="button" aria-expanded="false" aria-controls="ld-who" data-sheet="ld-who">Who built me</button>
    <div class="seg" role="group" aria-label="Theme"><button type="button" data-theme-set="day" aria-pressed="true"><svg class="i" aria-hidden="true"><use href="#i-dusk"/></svg>Dusk</button><button type="button" data-theme-set="night" aria-pressed="false"><svg class="i" aria-hidden="true"><use href="#i-moon"/></svg>Night</button></div>
  </nav>
</header>

<section class="ld-sheet wide" id="ld-about" aria-labelledby="ld-about-h">
  <button class="ld-close" type="button" data-close>Close</button>
  <h2 id="ld-about-h">What's this about</h2>
  <p>A month-by-month crew plan for four of Boston's 311 departments in 2025, built from every request the city logged in 2023 and 2024, and a bat named Terry who helps you test it.</p>
  <div class="ld-idx">
    <button class="ld-pill" type="button" id="ld-b1" aria-expanded="true" aria-controls="ld-p1">What's asked</button>
    <button class="ld-pill" type="button" id="ld-b2" aria-expanded="false" aria-controls="ld-p2">What we built</button>
    <button class="ld-pill" type="button" id="ld-b3" aria-expanded="false" aria-controls="ld-p3">Why we're proud</button>
  </div>
  <div class="ld-reveal">
    <section class="ld-panel on show" id="ld-p1" aria-labelledby="ld-b1"><ol>
      <li><span>A month-by-month crew plan for 2025 for <strong>Public Works, Transportation, Parks and Inspectional Services</strong>.</span></li>
      <li><span>Balance cost, on-time service (especially Transportation) and seasonal swings, under the brief's hiring, release and seasonal-crew rules.</span></li>
      <li><span>A 2025 demand forecast built from 2023 and 2024 requests.</span></li>
      <li><span>A GenAI intake assistant that turns a resident's message into the right request type and queue.</span></li>
      <li><span>A sensitivity test: demand 20% higher or lower, a snowstorm or a heat wave.</span></li>
    </ol></section>
    <section class="ld-panel" id="ld-p2" aria-labelledby="ld-b2"><ol>
      <li><span>A recommended 2025 plan: <strong>$15.6M, 98% on time</strong> in the crew model.</span></li>
      <li><span>A day-by-day replay of 2024's real requests under the brief's rules, to test any plan.</span></li>
      <li><span><strong>Terry:</strong> name a goal; he turns it into how it could fail, tests each cause on 2023 and 2024 data, and finds the cheapest fix.</span></li>
      <li><span><strong>An intake assistant:</strong> the right request type on 82% of 200 unseen messages, 89% after the fix they pointed to.</span></li>
      <li><span><strong>Ping Terry:</strong> ask anything about the plan; every number in an answer is traced to the data.</span></li>
    </ol></section>
    <section class="ld-panel" id="ld-p3" aria-labelledby="ld-b3"><ol>
      <li><span>Transportation, on time 50% of the time in 2024, reaches <strong>98.7%</strong> in our plan.</span></li>
      <li><span>Every number on the page traces back to the data; an answer that can't be sourced is cut.</span></li>
      <li><span>It says when crews won't help: some problems need a process fix or outreach, not more hiring.</span></li>
      <li><span>Storms, walkouts and a 20% busier year are tested, not assumed away.</span></li>
    </ol></section>
  </div>
</section>

<section class="ld-sheet wide" id="ld-311" aria-labelledby="ld-311-h">
  <button class="ld-close" type="button" data-close>Close</button>
  <h2 id="ld-311-h">What's 311</h2>
  <p class="ld-lead">Boston's number for everything that isn't an emergency: a pothole, a missed pickup, a dark streetlight, a rat in the alley.</p>
  <p>Anyone can file one, by phone, app or the web. Each request goes to the department that owns it, joins that department's queue, and has a target date to be closed by.</p>
  <div class="ld-eyebrow">How a request travels</div>
  <ol class="ld-path">
    <li><i>01</i><b>Reported</b>by a resident or a city worker</li>
    <li><i>02</i><b>Routed</b>to the department that owns it</li>
    <li><i>03</i><b>Worked</b>by a crew, when one is free</li>
    <li><i>04</i><b>Closed</b>on time, or overdue</li>
  </ol>
  <div class="ld-eyebrow">2024, in three numbers</div>
  <div class="ld-figs">
    <div><b>306,756</b><span>requests to Boston 311</span></div>
    <div><b>840</b><span>a day, on average</span></div>
    <div><b>42%</b><span>logged by city workers, not residents</span></div>
  </div>
  <div class="ld-eyebrow">The four departments we plan for</div>
  <ul class="ld-depts">
    <li><b>Public Works</b>Potholes, trash, streetlights, snow</li>
    <li><b>Transportation</b>Parking, signs, signals</li>
    <li><b>Parks</b>Trees, playgrounds, park upkeep</li>
    <li><b>Inspectional Services</b>Rodents, housing, building code</li>
  </ul>
  <p class="ld-src">Step 03 is where this project lives: too few crews and the queue backs up; too many and the city pays for idle hands. Data: City of Boston 311 Service Requests, <a href="https://data.boston.gov/dataset/311-service-requests" target="_blank" rel="noopener">Analyze Boston</a>.</p>
</section>

<section class="ld-sheet" id="ld-who" aria-labelledby="ld-who-h">
  <button class="ld-close" type="button" data-close>Close</button>
  <h2 id="ld-who-h">Who built me</h2>
  <ul class="ld-crew">
    <li><span class="role">Wing Lead</span><span class="who">Name · <a href="#">LinkedIn</a></span><span class="scope">GenAI system, product and design</span></li>
    <li><span class="role">Sonar Bridge</span><span class="who">Name · <a href="#">LinkedIn</a></span><span class="scope">Data, forecast and crew simulator</span></li>
    <li><span class="role">Night Watch</span><span class="who">Name · <a href="#">LinkedIn</a></span><span class="scope">Quality, deployment and the neighborhood map</span></li>
  </ul>
</section>

<div class="ld-sky">
  <h1 class="ld-line ld-a">The <span class="batt">battery</span> that keeps<br>Boston's <span class="tn">311</span> <span class="tn">crews</span> <em>moving.</em></h1>
  <button class="ld-see ld-a ld-a2" type="button" aria-haspopup="dialog" aria-controls="ld-plan"><span class="rule" aria-hidden="true"></span>Open the plan for <span class="yr">2025</span></button>
</div>

<button class="ld-hit" type="button" aria-label="Ask Terry for a Boston 311 fact"></button>
<div class="ld-cap" role="status"><span class="k">Did you know?</span><span class="f"></span></div>

<section class="ld-eve ld-a ld-a3" aria-label="Where you are">
  <div class="ld-date">Boston · Tuesday, 31 December 2024</div>
  <p class="ld-sit">2025 starts tomorrow, and its crews are still unplanned.</p>
  <div class="ld-year" aria-hidden="true"><b class="ld-now"></b></div>
  <button class="ld-go" type="button">Scroll into 2025</button>
</section>

<div class="ld-plan" id="ld-plan" role="dialog" aria-modal="true" aria-labelledby="ld-plan-h">
  <div class="ld-ledger">
    <button class="ld-x" type="button">Close</button>
    <h2 id="ld-plan-h">The 2025 crew plan</h2>
    <p class="sub">Crews by department, month by month, in the recommended Neutral plan. On time is the crew model, averaged over demand 14% under to 14% over forecast; At +20% is a year 20% busier; Record is what really happened, 2023 / 2024.</p>
    <table class="ld-lt"></table>
    <p class="ld-ltline"></p>
  </div>
</div>`;
  doc.body.insertBefore(root, doc.body.firstChild);
  // Terry flies above everything (the landing and the planner coming in under him), so his layer lives outside the landing's
  const tzLayer = root.querySelector(".ld-terry"); tzLayer.classList.add("ld-terry-top"); doc.body.insertBefore(tzLayer, root.nextSibling);
  html.classList.add("ld-on");
  api.active = true;
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
  scrollTo(0, 0);

  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, u) => a + (b - a) * u, seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const sstep = u => u * u * (3 - 2 * u), eIO3 = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), eOut3 = u => 1 - Math.pow(1 - u, 3);

  /* arrival: after the opening hands over, or at once */
  let entryT0 = null;   // when Terry starts gliding in from above the frame
  const arrive = () => requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.add("ld-in"); entryT0 = performance.now() + 250; }));
  const O = window.TerryOpening;
  if (O && O.active) doc.addEventListener("terry:opening", arrive, { once: true }); else arrive();

  /* the year ahead: today, then twelve months; the dot waits on today */
  const year = $(".ld-year"), now = $(".ld-now");
  ["Today", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].forEach((n, k) => {
    const t = doc.createElement("span"); t.style.left = ((2 * k + 1) * 100 / 26) + "%"; if (!k) t.className = "here"; t.innerHTML = "<i>" + n + "</i>"; year.insertBefore(t, now); });
  now.style.left = (100 / 26) + "%";

  /* Terry's facts: from the 2024 data or the brief, in a new order each visit */
  const FACTS = [
    "Boston 311 took 306,756 requests in 2024, about 840 a day.",
    "Parking Enforcement is the most common request in these four departments: 63,064 in 2024, more than one in five.",
    "The busiest day of 2024 was Tuesday, 3 September, two days after the city's move-in weekend.",
    "The quietest day of 2024 was Thanksgiving.",
    "Most requests arrive in the morning; 9 a.m. is the busiest hour.",
    "Tuesday is the busiest day of the week for 311, and Sunday the quietest.",
    "Parks requests triple between January and June.",
    "Public Works is busiest in August: 16,398 requests in 2024.",
    "Rodent complaints go to Inspectional Services, not Public Works.",
    "A pothole reported in 2024 was closed in under a day, at the median.",
    "City workers, not residents, logged 42% of 2024's requests.",
    "Dorchester sends more requests than any other neighborhood.",
    "More than half of these departments' 2024 requests closed within a day.",
    "Some Parks requests have a target of 365 days to close.",
    "About one 2024 request in six has no target date at all."
  ];
  for (let i = FACTS.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [FACTS[i], FACTS[j]] = [FACTS[j], FACTS[i]]; }
  let fi = 0, capT = 0;
  const hit = $(".ld-hit"), cap = $(".ld-cap");
  const say = () => { $(".ld-cap .f").textContent = FACTS[fi++ % FACTS.length]; cap.classList.add("on"); clearTimeout(capT); };
  const hush = () => { clearTimeout(capT); capT = setTimeout(() => cap.classList.remove("on"), 900); };
  hit.addEventListener("mouseenter", say); hit.addEventListener("focus", say); hit.addEventListener("mouseleave", hush); hit.addEventListener("blur", hush);
  hit.addEventListener("click", () => { cap.classList.remove("on"); setTimeout(say, 220); });

  /* What's this about: one list open at a time */
  const reveal = $(".ld-reveal"); let cur = $("#ld-b1");
  const panelOf = b => root.querySelector("#" + b.getAttribute("aria-controls"));
  $$(".ld-pill").forEach(b => b.addEventListener("click", () => {
    if (b === cur) return;
    const from = reveal.offsetHeight; panelOf(cur).classList.remove("show", "on"); cur.setAttribute("aria-expanded", "false");
    const p = panelOf(b); p.classList.add("on"); b.setAttribute("aria-expanded", "true"); cur = b;
    if (reduced) { p.classList.add("show"); return; }
    const to = reveal.offsetHeight; reveal.style.height = from + "px"; void reveal.offsetHeight; reveal.style.height = to + "px";
    requestAnimationFrame(() => p.classList.add("show")); setTimeout(() => { reveal.style.height = ""; }, 720);
  }));

  /* the three sheets */
  const links = $$(".ld-link");
  const sheetOpen = () => !!root.querySelector(".ld-sheet.open");
  function closeSheets(focus) { links.forEach(n => { if (n.getAttribute("aria-expanded") === "true") { n.setAttribute("aria-expanded", "false"); root.querySelector("#" + n.dataset.sheet).classList.remove("open"); if (focus) n.focus(); } }); }
  links.forEach(n => n.addEventListener("click", e => { e.stopPropagation(); const was = n.getAttribute("aria-expanded") === "true"; closeSheets(false);
    if (!was) { n.setAttribute("aria-expanded", "true"); root.querySelector("#" + n.dataset.sheet).classList.add("open"); } }));
  $$("[data-close]").forEach(c => c.addEventListener("click", () => closeSheets(true)));
  root.addEventListener("click", e => { if (!e.target.closest(".ld-sheet")) closeSheets(false); });

  /* the 2025 plan (the notebook's recommended plan, plan2025.js), built when first opened */
  const plan = $(".ld-plan"), see = $(".ld-see");
  const REC = { PWDx: "90% / 90%", BTDT: "65% / 50%", PARK: "87% / 93%", ISD: "74% / 72%", CITY: "82% / 77%" };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const money = v => "$" + (v / 1e6).toFixed(2) + "M", pct = v => (Math.round(v * 1000) / 10).toFixed(1) + "%", p0 = v => Math.round(v * 100) + "%";
  let built = false;
  function buildPlan() {
    const P = window.TerryPlan2025; if (built || !P) return; built = true;
    const head = "<thead><tr><th class='d'>Department</th>" + MON.map(m => "<th>" + m + "</th>").join("") + "<th class='n'>Cost</th><th class='n'>On time</th><th class='n'>At +20%</th><th class='n'>Record 23 / 24</th></tr></thead>";
    const body = P.depts.map(x => "<tr><th class='d'>" + x.name + "</th>" + x.crews.map((c, m) => "<td><b>" + (c + (x.seasonal[m] || 0)) + "</b>" + (x.hire[m] ? "<i>+" + x.hire[m] + "</i>" : "") + "</td>").join("") +
      "<td class='n'>" + money(x.cost) + "</td><td class='n'>" + pct(x.ontime) + "</td><td class='n'>" + p0(x.ontime_hot20) + "</td><td class='n'>" + (REC[x.dept] || "") + "</td></tr>").join("");
    const tot = m => P.depts.reduce((s, x) => s + x.crews[m] + (x.seasonal[m] || 0), 0);
    const foot = "<tfoot><tr><th class='d'>City</th>" + MON.map((_, m) => "<td><b>" + tot(m) + "</b></td>").join("") + "<td class='n'>" + money(P.city.cost) + "</td><td class='n'>" + pct(P.city.ontime) + "</td><td class='n'>" + p0(P.city.ontime_hot20) + "</td><td class='n'>" + REC.CITY + "</td></tr></tfoot>";
    $(".ld-lt").innerHTML = head + "<tbody>" + body + "</tbody>" + foot;
    const bt = P.depts.find(x => x.dept === "BTDT");
    $(".ld-ltline").innerHTML = "Neutral plan (recommended): <b>" + money(P.city.cost) + "</b>, <b>" + pct(P.city.ontime) + "</b> on time." + (bt ? " Transportation, 50% on time in 2024, is <b>" + pct(bt.ontime) + "</b> in this plan." : "") + " If demand runs 20% hot, the aggressive plan insures against it for <b>$679k</b> more payroll.";
  }
  const openPlan = () => { buildPlan(); closeSheets(false); plan.classList.add("open"); setTimeout(() => $(".ld-x").focus(), 50); };
  const closePlan = () => { plan.classList.remove("open"); see.focus(); };
  see.addEventListener("click", e => { e.stopPropagation(); openPlan(); });
  $(".ld-x").addEventListener("click", closePlan);
  plan.addEventListener("click", e => { if (e.target === plan) closePlan(); });

  /* Terry over the skyline: hovering, wings beating slowly, facing us */
  let bat = null, tx = 0, ty = 0, lift = 0, alive = true, path = null;
  // the flight on the scroll: from (tx, ty) over the skyline to the planner's Terry, on a gentle arc, his size easing to the planner's
  function flight() {
    if (!path) return null;
    const u = path.u(), e = eIO3(seg(u, 0.06, 0.84)), x = lerp(path.x0, path.x1, e), lift2 = Math.sin(Math.PI * e) * path.arc, y = lerp(path.y0, path.y1, e) - lift2;
    const dx = path.x1 - path.x0, v = Math.sin(Math.PI * e);
    return { e, x, y, s: lerp(path.s0, path.s1, e), yaw: clamp(dx / 30, -28, 28) * v, roll: clamp(-dx / 40, -14, 14) * v };
  }
  const place = () => { tx = innerWidth * 0.79; ty = innerHeight * 0.24; hit.style.left = tx + "px"; hit.style.top = ty + "px"; cap.style.left = tx + "px"; cap.style.top = (ty + 70) + "px"; };
  place(); addEventListener("resize", place);
  /* the photograph covers the landing's own box, whatever that box turns out to be (a window, or a frame that is resized after
     load): measured, and re-measured whenever the box changes size, never assumed from the window */
  function layPhoto() { const R = root.getBoundingClientRect(), W = R.width || innerWidth, H = R.height || innerHeight, sL = Math.max(W / 1916, H / 821);
    const r = { inset: "auto", left: ((W - 1916 * sL) * 0.5).toFixed(1) + "px", top: ((H - 821 * sL) * 0.66).toFixed(1) + "px", width: (1916 * sL).toFixed(1) + "px", height: (821 * sL).toFixed(1) + "px" };
    root.querySelectorAll(".ld-photo img").forEach(im => Object.assign(im.style, r)); return { W, H, r }; }
  layPhoto();
  try { new ResizeObserver(() => { if (api.active && uD === 0) layPhoto(); }).observe(root); } catch (e) { addEventListener("resize", () => { if (api.active && uD === 0) layPhoto(); }); }
  /* the landing's header sits exactly on the page's (same brand, same switch), so the hand-over is invisible */
  const align = () => { const n = doc.querySelector("#page .hero .nav"); if (!n) return; const r = n.getBoundingClientRect(), w = root.getBoundingClientRect().width || innerWidth;   // the landing spans the scrollbar gutter; measure against it
    root.style.setProperty("--ld-l", r.left + "px"); root.style.setProperty("--ld-r", (w - r.right) + "px"); root.style.setProperty("--ld-t", r.top + "px"); };
  align(); addEventListener("resize", align); addEventListener("load", align);
  function terry() {
    if (!alive || reduced || bat || !window.TerryBat3D || !window.THREE) return;
    try { bat = TerryBat3D.create(tzLayer, { scale: Math.min(1.05, innerWidth / 1500), shadow: false, noDrop: true, theme: html.dataset.theme === "night" ? "dark" : "light", home: { x: tx, y: ty } }); } catch (e) { bat = null; return; }
    const dbg = bat._debug, st = dbg.st; dbg.freeze(true); st.nextBlink = 3; st.nextTwitch = st.nextTilt = 1e9;
    spin();
  }
  let spinning = false;
  function spin() {
    if (!bat || spinning) return; spinning = true;
    const dbg = bat._debug, st = dbg.st, t0 = performance.now(); let lastT = t0;
    (function f(nowT) {
      if (!alive) { spinning = false; return; } requestAnimationFrame(f);
      const dt = Math.min((nowT - lastT) / 1000, 0.05), s = (nowT - t0) / 1000; lastT = nowT;
      if (O && O.active) return;   // nothing drawn while the opening plays: it has the GPU to itself
      if (G && G.awake && !inside) return;   // handed over: the planner's Terry is the one on screen, so this one stops drawing
      // his entrance (owner 22:16): from above the frame he glides down to his place on a slow arc, wings beating slowly, settling into his hover
      const ent = reduced || entryT0 === null ? (entryT0 === null ? 0 : 1) : clamp((nowT - entryT0) / 2800, 0, 1);
      // after a chase (owner 23:13) the planner's Terry stays where he is; this one leaves the way he came in, up and out of the top of
      // the frame as the camera pulls back, and glides back down along the same arc as the camera comes in: the loop closes
      const ex = !path && G && uD > 0 ? eIO3(seg(uD, 0, 0.45)) : 0, ee = eOut3(ent) * (1 - ex);
      // on the scroll he flies from his place over the skyline to his place in the planner, beating harder on the way
      const F = flight(), sw = F ? 1 - F.e : 1;
      // only as he arrives (the last stretch of the move) does he ease into the planner Terry's own hover (turned 28 degrees, a quicker
      // beat), so the hand-over to that Terry is the same pose at the same point of the wing beat; the rest of the way he keeps facing us
      const hb = F ? sstep(seg(uD, 0.7, 0.93)) : 0;
      const fx = F ? F.x : lerp(tx + 170, tx, ee), fy = F ? F.y : lerp(-170, ty, ee) - Math.sin(Math.PI * ee) * 30 * (1 - ee);
      if (F && bat.setScale) try { bat.setScale(F.s); } catch (e) {}
      Object.assign(st, { mode: "fly", x: fx + Math.sin(s * 0.35) * 10 * sw, y: fy + Math.sin(s * 0.9) * 7 * sw * ee, z: 0, yaw: F ? 28 * hb : -14 * (1 - ee), roll: F ? Math.sin(s * 0.35) * 2 * (1 - hb) : Math.sin(s * 0.35) * 2 * ee + 9 * (1 - ee),   /* in the move he keeps facing us (owner 22:22) */ pitch: F ? -6 - 6 * hb : -6 + 14 * (1 - ee), pin: 0, fold: 0,
        amp: F ? 0.75 + 0.25 * hb : 0.55 + 0.2 * ee, glide: 0, hover: 1, rate: F ? 1.0 + 2.2 * hb : 0.7 + 0.3 * ee,   /* and the same slow beat as on the landing, never harder */
        headYaw: 0, headPitch: 0, look: 0, lookTo: 0, sway: 0, busy: false });
      dbg.step(dt, 1);
    })(t0);
  }
  if (doc.readyState === "complete") terry(); else addEventListener("load", terry);
  // everything the move will bring into view is decoded ahead, while the landing sits still, so no picture is decoded mid-move
  const warm = () => { const imgs = [...doc.querySelectorAll("#page img, .leaf img, #landing img")];
    (window.requestIdleCallback || (f => setTimeout(f, 300)))(() => imgs.forEach(i => { try { i.decode && i.decode().catch(() => {}); } catch (e) {} })); };
  if (doc.readyState === "complete") warm(); else addEventListener("load", () => setTimeout(warm, 600));
  new MutationObserver(() => { if (bat) try { bat.setTheme(html.dataset.theme === "night" ? "dark" : "light"); } catch (e) {} }).observe(html, { attributes: true, attributeFilter: ["data-theme"] });

  /* The landing is the top of the page. Scrolling down pulls the camera back from the skyline into the planner, a little at a time,
     exactly as far as you scroll; scrolling up at the top of the planner brings the camera back in to the landing. The scroll does not
     move the document while the camera moves: the wheel, the keys and a swipe drive u (0 = the landing, 1 = the planner), smoothed, and
     once u reaches 1 the page scrolls as it always has. The page keeps its own coordinates throughout, so nothing in it changes.
     Everything that moves is a transform or an opacity on a layer the graphics card holds.

     The camera: the landing is a close-up of the planner's first screen, magnified until the branch is below the frame; pulling back
     widens the frame, so the branch, the projector, the side leaves and the Ping bar come in from beyond the edges, while the far
     skyline zooms out onto the hero's own crop, and Terry flies from the skyline to his place in the planner. */
  const IMW = 1916, IMH = 821;
  let G = null, uT = 0, uD = 0, inside = false, told = false, raf = 0, last = 0;
  const C = {
    a: u => reduced ? u : seg(u, 0, 0.24),                    // the landing's words go
    z: u => reduced ? 1 : eIO3(seg(u, 0.04, 0.92)),           // the pull-back
    zn: u => reduced ? 1 : eIO3(seg(u, 0.1, 0.88)),           // the nearest things, a little later
    end: u => reduced ? u : sstep(seg(u, 0.86, 1)),           // the hand-over: landing onto the page
  };
  function prep() {
    const page = doc.getElementById("page"); ["height", "minHeight", "overflow", "transform"].forEach(k => { page.style[k] = ""; });
    const box = layPhoto(), H = box.H, W = box.W;
    const hero = page.querySelector(".hero"), hp = page.querySelector(".hero .photo"), q = s => page.querySelector(s);
    const heroH = hp ? hp.offsetHeight : 448, bandH = hero ? hero.offsetHeight : 400;
    const scr = q("#screen"), scrTop = scr ? scr.getBoundingClientRect().top + scrollY : bandH;
    const k0 = Math.max(1.6, H / bandH, (H + 24) / Math.max(120, scrTop));
    // one photograph, zoomed: from the landing's crop (cover, the window) to the hero's (cover, W x heroH), about the one point that
    // carries the first exactly onto the second
    const sL = Math.max(W / IMW, H / IMH), sH = Math.max(W / IMW, heroH / IMH), m = sH / sL;
    const LL = (W - IMW * sL) * 0.5, TL = (H - IMH * sL) * 0.66, LH = (W - IMW * sH) * 0.5, TH = (heroH - IMH * sH) * 0.66;
    const ox = Math.abs(1 - m) > 1e-3 ? (LH - LL * m) / (1 - m) : W / 2, oy = Math.abs(1 - m) > 1e-3 ? (TH - TL * m) / (1 - m) : 0;
    const hidden = [q(".hero .photo"), q(".hero .nav"), q("#flow")].filter(Boolean), copy = q("#herocopy"), extras = [q("#addroost"), q("#goalpill")].filter(Boolean);   // after a chase: the + and the goal pill sit where the goal box was
    const near = [...doc.querySelectorAll(".leaf, .dock")];
    near.forEach(e => { e.style.transform = ""; }); const nearR = near.map(e => e.getBoundingClientRect());
    path = null;
    const chased = (((window.TerryState || {}).roosts) || []).length > 0;   // after a chase Terry stays in the planner (hanging, or wherever he is)
    try { const PB = window.TerryProj && TerryProj.bat && TerryProj.bat(), st2 = PB && PB._debug && PB._debug.st, tl = q("#tlayer");
      if (bat && st2 && tl) { const r = tl.getBoundingClientRect();
        const hm = TerryProj.home ? TerryProj.home() : null, pr = page.getBoundingClientRect();
        const x1 = hm ? pr.left + hm.x : r.left + st2.x, y1 = hm ? hm.y : r.top + scrollY + st2.y;
        if (!chased && PB.mode && PB.mode() !== "hang") path = { x0: tx, y0: ty, x1: clamp(x1, 80, innerWidth - 80), y1: clamp(y1, 60, innerHeight * 0.5), s0: Math.min(1.05, innerWidth / 1500), s1: 0.8 / 1.15, arc: 60, u: () => uD }; } } catch (e) { path = null; }
    const bL = $(".ld-brand"), sgL = $(".ld-navr .seg"), bP = q(".hero .brand"), sgP = q(".hero .seg");
    bL.style.transform = sgL.style.transform = "";
    const subP = q(".hero .brand .sub"), subL = $(".ld-brand .sub");
    if (subP && subL) { const cs = getComputedStyle(subP); ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "fontFeatureSettings", "fontVariantNumeric", "fontKerning", "fontOpticalSizing", "fontVariationSettings", "paddingLeft", "borderLeft", "color"].forEach(k => { subL.style[k] = cs[k]; }); }
    const nmP = q(".hero .brand .nm"), nmL = $(".ld-brand .nm");
    if (nmP && nmL) { const cs = getComputedStyle(nmP); ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "fontFeatureSettings", "fontVariantNumeric", "fontVariantLigatures"].forEach(k => { nmL.style[k] = cs[k]; }); }
    const dB = bP ? bP.getBoundingClientRect().left - bL.getBoundingClientRect().left : 0, dS = sgP ? sgP.getBoundingClientRect().right - sgL.getBoundingClientRect().right : 0;
    G = { extras, bL, sgL, dB, dS, tl: q("#tlayer"), settled: false, page, H, W, k0, m, ox, oy, LL, TL, heroH, hidden, copy, near, nearR,
      ph: $(".ld-photo"), imgs: $$(".ld-photo img"), bg: $(".ld-bg"), ground: $(".ld-ground"), scrim: $(".ld-scrim"), hs: $(".ld-hscrim"), sub: $(".ld-brand .sub"), tz: tzLayer,
      words: [see, $(".ld-eve"), hit, ...$$(".ld-link")], line: $(".ld-line") };
  }
  function arm() {
    doc.querySelectorAll("*").forEach(e => { if (e.__ld) e.__ld = null; });   // the page and its near layers take their places for the move
    const { page, W, ox, oy, LL, TL, imgs, hidden, copy, near, hs, heroH, H } = G;
    // the page stands on the landing's ground (which is the page's own background), so its sky can be the landing's photograph
    page.style.position = "relative"; page.style.zIndex = "61";   // (its background: render(), by u)
    page.style.transformOrigin = `${W / 2}px 0px`; page.style.willChange = "transform";
    // its layer is drawn once at its own size before the camera magnifies it (G.prime frames, nearly invisible), and the browser keeps that
    // drawing for the whole move: drawn at the 2.9x start instead, on a 200% laptop screen it was ~170 MB and the hand-over dropped frames to the bare page (owner 7 Nov video)
    G.prime = uD < 0.5 ? 2 : 0;   // only from the landing side: coming back from the planner it is already drawn at its own size
    // only its first screen is ever in view: cut the page to it, and hold the document's height with a spacer
    const full = page.offsetHeight; page.style.height = H + "px"; page.style.minHeight = "0"; page.style.overflow = "hidden";
    let sp = doc.getElementById("ld-spacer"); if (!sp) { sp = doc.createElement("div"); sp.id = "ld-spacer"; sp.setAttribute("aria-hidden", "true"); page.after(sp); }
    sp.style.height = Math.max(0, full - H) + "px";
    try { const PB = window.TerryProj && TerryProj.bat && TerryProj.bat(); PB && PB._debug && PB._debug.freeze(true); } catch (e) {}
    [...hidden, copy].filter(Boolean).forEach(e => { e.style.transition = "none"; e.style.opacity = "0"; });
    // the goal area's own parts have fade transitions (.3 to .4 s): off, or they would lag the scroll and flash in at full size
    if (copy) [...copy.children].forEach(c => { c.style.transition = "none"; c.style.opacity = "0"; });
    G.extras.forEach(e => { e.style.transition = "none"; e.style.animation = "none"; e.style.opacity = "0"; });   // its arrival animation (fill: both) would hold it at full opacity over ours; it has played already
    if (G.tl) G.tl.style.opacity = "0";
    near.forEach(e => { e.style.zIndex = "62"; e.style.transition = "none"; e.style.willChange = e.classList.contains("dock") ? "transform" : "transform, opacity"; });   // (will-change: opacity would flatten the dock's glass too)
    imgs.forEach(im => { im.style.transformOrigin = `${(ox - LL).toFixed(1)}px ${(oy - TL).toFixed(1)}px`; im.style.willChange = "transform"; });
    [...G.words, G.line].forEach(e => { e.style.transition = "none"; });
    // everything the move fades gets its own layer for the move (owner 7 Nov, 200% laptop: without one, each fade repainted the whole
    // screen under it, about 90 full-screen repaints a round trip, and the laptop's graphics showed unfinished tiles)
    G.promoted = [G.bg, G.ground, G.scrim, G.hs, G.sub, ...G.words, ...hidden, ...(copy ? [...copy.children] : []), ...G.extras].filter(Boolean);
    G.promoted.forEach(e => { e.style.willChange = "opacity"; }); if (G.line) G.line.style.willChange = "opacity, transform";
    root.style.visibility = ""; html.classList.add("ld-on");
  }
  const unpromote = () => { if (!G) return; (G.promoted || []).forEach(e => { e.style.willChange = ""; }); if (G.line) G.line.style.willChange = ""; G.promoted = []; };
  function disarm() {   // the planner is itself again: the last frame of the move is, pixel for pixel, the planner's first screen
    doc.querySelectorAll("*").forEach(e => { if (e.__ld) e.__ld = null; });
    const { page, hidden, copy, near } = G;
    ["opacity", "transform", "transformOrigin", "position", "zIndex", "background", "height", "minHeight", "overflow"].forEach(k => { page.style[k] = ""; });
    // its layer goes a moment after the move, not on its last frame (a full redraw there showed as a blank frame on a 200% screen)
    clearTimeout(disarm.t); disarm.t = setTimeout(() => { if (inside) page.style.willChange = ""; }, 300);
    const sp = doc.getElementById("ld-spacer"); if (sp) sp.remove();
    try { const PB = window.TerryProj && TerryProj.bat && TerryProj.bat(); PB && PB._debug && PB._debug.freeze(false); } catch (e) {}
    [...hidden, copy].filter(Boolean).forEach(e => { e.style.opacity = e.style.transition = ""; }); if (G.tl) G.tl.style.opacity = "";
    if (copy) [...copy.children].forEach(c => { c.style.opacity = ""; c.style.transition = ""; });
    G.extras.forEach(e => { e.style.opacity = ""; e.style.transition = ""; });
    near.forEach(e => { e.style.transform = e.style.transformOrigin = e.style.opacity = e.style.zIndex = e.style.transition = e.style.willChange = ""; e.style.removeProperty("--dk-o"); });
    root.style.visibility = "hidden"; html.classList.remove("ld-on");
    G.bL.style.transform = G.sgL.style.transform = "";
    unpromote();
  }
  // back at the landing (owner 23:13: its buttons stopped working): the planner goes back under the landing, untouched, so every click
  // lands on the landing again; the next scroll measures and arms it afresh
  function rest() {
    if (!G) return; const { page, hidden, copy, near } = G;
    unpromote();
    doc.querySelectorAll("*").forEach(e => { if (e.__ld) e.__ld = null; });
    ["opacity", "transform", "transformOrigin", "position", "zIndex", "background", "willChange", "height", "minHeight", "overflow"].forEach(k => { page.style[k] = ""; });
    const sp = doc.getElementById("ld-spacer"); if (sp) sp.remove();
    [...hidden, copy].filter(Boolean).forEach(e => { e.style.opacity = e.style.transition = ""; }); if (G.tl) G.tl.style.opacity = "";
    if (copy) [...copy.children].forEach(c => { c.style.opacity = ""; c.style.transition = ""; });
    G.extras.forEach(e => { e.style.opacity = ""; e.style.transition = ""; });
    near.forEach(e => { e.style.transform = e.style.transformOrigin = e.style.opacity = e.style.zIndex = e.style.transition = e.style.willChange = ""; e.style.removeProperty("--dk-o"); });
    G.bL.style.transform = G.sgL.style.transform = "";
    [...G.words, G.line].forEach(e => { e.style.opacity = ""; e.style.transform = ""; e.style.transition = ""; });
    tzLayer.style.visibility = ""; G = null; render.jan = undefined;
  }
  // the camera at u: one photograph zooming out, the planner coming in around it; transforms and opacities only
  // a style is written only when its value changes: every skipped write is a recalculation the browser does not have to do
  const S = (el, k, v) => { if (!el) return; const c = el.__ld || (el.__ld = {}); if (c[k] !== v) { c[k] = v; if (k[0] === "-") el.style.setProperty(k, v); else el.style[k] = v; } };
  function render(u) {
    const { page, W, H, heroH, k0, m, copy, near, nearR, ph, imgs, bg, ground, scrim, hs, sub, tz, words, line } = G;
    const a = C.a(u), zn = C.zn(u);
    // the camera's own pull-back; the far photograph is set at its final crop from u = 0.82 (where it is within 0.6% of it), so that
    // nothing under the planner's frosted glass is moving while the glass comes in
    const z = C.z(u), zf = u >= 0.82 ? 1 : z;
    const o1 = (1 - a).toFixed(3);
    words.forEach(e => S(e, "opacity", o1));
    S(line, "opacity", o1); S(line, "transform", a > 0.001 ? `translate3d(0,${(-30 * a).toFixed(1)}px,0)` : "");
    // one Terry: the landing's flies the whole way; the planner's takes his place the instant he arrives
    const swap = u >= 0.95;
    S(tz, "visibility", path && swap ? "hidden" : ""); S(tz, "opacity", "1");   // he never fades: he flies, to the planner or out of the frame
    S(G.tl, "opacity", !path || swap ? "1" : "0");
    if (swap !== !!G.awake) { G.awake = swap; try { const PB = window.TerryProj && TerryProj.bat && TerryProj.bat();
      if (PB && PB._debug) { if (swap && path && bat && bat._debug) { const a = bat._debug.st, b = PB._debug.st;
          const hm = TerryProj.home ? TerryProj.home() : null; if (hm) { b.x = hm.x; b.y = hm.y; }   // his own home, in his own layer's coordinates
          Object.assign(b, { yaw: a.yaw, pitch: a.pitch, roll: a.roll, rate: a.rate, amp: a.amp, phase: a.phase, glide: 0, hover: 1, fold: 0 }); }
        PB._debug.freeze(!swap); } } catch (e) {} }
    // the photograph: zoomed out about its fixed point; its frame closes from the window to the hero's band (same fade as the hero's)
    const sm = Math.pow(m, zf), tr = Math.abs(sm - 1) > 1e-4 ? `scale(${sm.toFixed(5)})` : "";
    imgs.forEach(im => S(im, "transform", tr));
    // the frame closes by its mask (a repaint), not its height (a layout every frame): the mask is the hero's own fade, sized to the band
    if (!LDX.includes("nomask")) { const mh = Math.round(lerp(H, heroH, zf)) + "px"; S(ph, "webkitMaskSize", "100% " + mh); S(ph, "maskSize", "100% " + mh); }
    S(scrim, "opacity", (1 - zf).toFixed(3)); S(hs, "opacity", zf.toFixed(3));
    // the ground stays the landing's dark until the camera is nearly home, so the photograph's soft edge never washes over the branch
    // the planner's ground and dusk, in the landing at their final size, come in slowly under the shrinking photo
    const gz = reduced ? zf : sstep(seg(u, 0.4, 0.86)); S(bg, "opacity", "1");   /* the dark stays solid under the ground as it comes in: two half-faded layers let the pale page show (owner 00:29) */ S(ground, "opacity", gz.toFixed(3));
    // the planner: scaled by the camera; from u = 0.8 (within 1% of its own size) it is set down at its own size
    const k = LITE ? 1 : Math.pow(k0, 1 - z), settled = u >= 0.8;
    const priming = G.prime > 0; if (priming) G.prime--;
    if (!LDX.includes("nopage")) S(page, "transform", !priming && !settled && k > 1.0005 ? `scale(${k.toFixed(5)})` : "");
    // the gradient is handed over early, never in one frame: from u = 0.9 (the planner's photograph is opaque by 0.89) the page paints its
    // own gradient, identical to the landing's ground under it, so the last frame and the first frame back each find it already drawn
    S(page, "background", u >= 0.9 ? "" : "transparent");
    S(page, "willChange", "transform");   // one layer, one drawing, from arm() to disarm(): no redraw mid-move. It stays cut to one screen until the very end
    S(page, "opacity", priming ? "0.001" : u <= 0 ? "0" : LITE ? sstep(seg(u, 0.45, 0.75)).toFixed(3) : "1");   // the lighter move: the planner fades up in place   // (1, not empty: the landing stylesheet hides the page while it is up; 0.001 while it is first drawn)
    // the nearest things (the side leaves, the Ping bar) come in from beyond the frame and are home by u = 0.88
    if (!LDX.includes("nonear")) near.forEach((e, i) => { const r = nearR[i], cx = r.left + r.width / 2, cy = r.top + r.height / 2, kn = LITE ? 1 : Math.pow(k0 * 1.25, 1 - zn);   // the lighter move: they fade in where they sit (a magnified layer is redrawn every frame)
      S(e, "transformOrigin", kn > 1.0005 ? "50% 50%" : "");
      S(e, "transform", kn > 1.0005 ? `translate3d(${((cx - W / 2) * (kn - 1)).toFixed(1)}px,${(cy * (kn - 1)).toFixed(1)}px,0) scale(${kn.toFixed(5)})` : "");
      // the lighter move: after the branch and the projector have faded up (0.45 to 0.75), the leaves, then the Ping bar (owner 7 Nov)
      const w = LITE ? (e.classList.contains("dock") ? [0.76, 0.95] : [0.66, 0.86]) : [0.1, 0.3];
      const ov = (reduced ? u : LITE ? sstep(seg(u, w[0], w[1])) : seg(u, w[0], w[1])).toFixed(3);   // the full zoom unchanged
      if (e.classList.contains("dock")) S(e, "--dk-o", ov); else S(e, "opacity", ov); });   // the dock's glass fades by its parts (an opacity on the dock would flatten it)
    // the hand-over, in order and before the end: the planner's photograph over the landing's (by then the same crop, standing still),
    // then its words (so the goal box's glass blurs a still sky), then its header over the landing's (which has glided onto it)
    const hp = G.hidden[0], hn = G.hidden[1], fl = G.hidden[2];
    // the planner's photograph comes in under its header; then its words, over it (the goal box's glass can only see the planner's
    // own photograph, never the landing's, so it waits for it)
    S(hp, "opacity", (reduced ? (u >= 1 ? 1 : 0) : sstep(seg(u, 0.82, 0.89))).toFixed(3));
    S(fl, "opacity", "0");   // the planner's own wash stays out of the move: the landing's copy of it (same place, same colours) stands in, and the two swap at the very end, unseen (two stacked washes would darken, then flash pale when one left)
    if (copy) { const o = (reduced ? u : seg(u, 0.89, 0.97)).toFixed(3); S(copy, "opacity", ""); [...copy.children].forEach(c => S(c, "opacity", o)); }
    { const o = (reduced ? u : seg(u, 0.89, 0.97)).toFixed(3); G.extras.forEach(e => S(e, "opacity", o)); }
    S(hn, "opacity", (reduced ? (u >= 1 ? 1 : 0) : sstep(seg(u, 0.8, 0.86))).toFixed(3));
    const hz = reduced ? 1 : eIO3(seg(u, 0.25, 0.8));
    S(G.bL, "transform", hz > 0.0005 ? `translate3d(${(G.dB * hz).toFixed(1)}px,0,0)` : ""); S(G.sgL, "transform", hz > 0.0005 ? `translate3d(${(G.dS * hz).toFixed(1)}px,0,0)` : "");
    S(sub, "opacity", (0.88 * (reduced ? u : seg(u, 0.6, 0.8))).toFixed(3));
    // the dot steps from today into January as the camera starts back
    const jan = u > 0.02;
    if (jan !== render.jan) { render.jan = jan; const mk = $$(".ld-year span"); now.style.left = ((jan ? 3 : 1) * 100 / 26) + "%"; mk[0].classList.toggle("here", !jan); mk[1].classList.toggle("here", jan); }
  }
  // the smoothing: the camera eases toward where the scroll has asked it to be
  function tick(t) {
    raf = 0;
    const tt = t || performance.now(), dt = last ? Math.min(0.05, Math.max(0.001, (tt - last) / 1000)) : 1 / 60, last0 = last;
    last = tt;
    // the camera eases toward where the scroll asked it to be; when the move finishes by itself (the scroll stopped part way) it glides,
    // about 1.4 s for the whole move, never a jump
    const kk = reduced ? 1 : 1 - Math.exp(-(last0 ? Math.min(0.25, (tt - last0) / 1000) : 1 / 60) * (gliding ? 5 : 14));
    const dtr = last0 ? Math.min(0.25, (tt - last0) / 1000) : 1 / 60;   // real time since the last frame: a slow computer takes as long, not longer
    const cap = gliding ? dtr * 0.75 : Math.max(0.03, dtr * 1.8);
    uD += clamp((uT - uD) * kk, -cap, cap);
    if (Math.abs(uT - uD) < 0.002) uD = uT;
    try { apply(); } catch (err) { console.error("landing", err); }
    if (uD !== uT) raf = requestAnimationFrame(tick);
    else { last = 0; gliding = false; }
  }
  function apply() {
    if (uD >= 1) {
      if (!inside) { inside = true; api.active = false; if (G) { try { disarm(); } catch (err) { console.error("landing disarm", err && err.stack); } } else { root.style.visibility = "hidden"; html.classList.remove("ld-on"); }   // arrived without a move (a jump): the landing still steps aside alive = false;
        if (!told) { told = true; setTimeout(() => doc.dispatchEvent(new CustomEvent("terry:landing", { detail: "in" })), 250); } }
      return;
    }
    if (inside || !G) { inside = false; api.active = true; html.classList.add("ld-on"); align(); prep(); arm(); if (!alive) { alive = true; spin(); } }
    render(uD);
    if (uD === 0 && uT === 0) rest();
  }
  // the move never rests half-done: when the input stops, it finishes to the end it was heading for (owner 22:21: stuck mid-way)
  let snapT = 0, lastDir = 1, gliding = false;
  function go(to, fromSnap) {
    if (O && O.active) return;
    const v = clamp(to, 0, 1); if (v !== uT) lastDir = v > uT ? 1 : -1;
    uT = v;
    clearTimeout(snapT);
    gliding = !!fromSnap;
    if (!fromSnap && uT > 0 && uT < 1) snapT = setTimeout(() => { if (uT > 0 && uT < 1) go(lastDir > 0 ? (uT > 0.12 ? 1 : 0) : (uT < 0.88 ? 0 : 1), true); }, 650);
    if (uT > 0) { closeSheets(false); plan.classList.remove("open"); cap.classList.remove("on"); }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  api.enter = () => go(1);
  api.seek = u => { uT = uD = clamp(u, 0, 1); apply(); if (G && G.prime && uD > 0 && uD < 1) { G.prime = 0; render(uD); } };   // a test jump draws the real frame, not the priming one
  api.u = () => uD; api.uT = () => uT;
  $(".ld-go").addEventListener("click", () => go(1));

  /* the input that drives it. Down: the camera pulls back until the planner is in place, then the page scrolls. Up at the very top of
     the planner: the camera goes back in to the landing. */
  const DIST = () => Math.max(900, innerHeight * 1.5);   // how much scrolling the whole move takes
  const busy = () => plan.classList.contains("open") || (O && O.active);
  const atTop = () => (scrollY || doc.documentElement.scrollTop || 0) <= 0;
  const owns = dy => !busy() && (uT < 1 ? true : (dy < 0 && atTop()));
  const onWheel = e => {
    if (e.ctrlKey || (e.target.closest && e.target.closest(".ld-sheet, .dock, .leaf, [data-scrolls]"))) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (uT >= 1 && dy > 0) { if (uD < 1 && !inside) e.preventDefault(); return; }   // the camera is still settling: the page does not scroll under it
    if (!owns(dy)) return;
    e.preventDefault(); go(uT + dy / DIST());
  };
  let ty0 = null;
  const onTs = e => { ty0 = e.touches[0].clientY; };
  const onTm = e => {
    if (ty0 === null) return; const y = e.touches[0].clientY, dy = ty0 - y; ty0 = y;
    if (!owns(dy) || (uT >= 1 && dy > 0) || (e.target.closest && e.target.closest(".ld-sheet"))) return;
    e.preventDefault(); go(uT + dy * 2.2 / DIST());
  };
  const STEP = { ArrowDown: 0.18, PageDown: 0.6, " ": 0.6, End: 1, ArrowUp: -0.18, PageUp: -0.6, Home: -1 };
  const onKey = e => {
    const K = e["key"];
    if (K === "Escape" && !inside) { if (plan.classList.contains("open")) closePlan(); else closeSheets(true); return; }
    const tag = (doc.activeElement && doc.activeElement.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (doc.activeElement && doc.activeElement.isContentEditable)) return;
    const step = STEP[K];
    if (step === undefined || (K === " " && /^(BUTTON|A)$/.test(tag))) return;
    const dy = step * (e.shiftKey && K === " " ? -1 : 1);
    if (!owns(dy) || (uT >= 1 && dy > 0) || (!inside && sheetOpen())) return;
    e.preventDefault(); go(uT + dy);
  };
  // anything else that scrolls the page (the scrollbar, a link, the tour) while the camera is still out finishes the move at once
  addEventListener("scroll", () => { if (!atTop() && uT < 1) { uT = uD = 1; apply(); } }, { passive: true });
  addEventListener("wheel", onWheel, { passive: false });
  addEventListener("touchstart", onTs, { passive: true }); addEventListener("touchmove", onTm, { passive: false });
  addEventListener("keydown", onKey, true);
  // a resize while the camera is out re-measures it
  addEventListener("resize", () => { if (!inside && G && uD > 0) { prep(); arm(); render(uD); } });
})();
