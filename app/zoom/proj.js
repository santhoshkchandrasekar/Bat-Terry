/* The Terry page orchestrator (desktop, 1100px and wider).
 *
 *   hero photo + goal box  ->  branch  ->  projector screen on two cords  ->  Terrytory
 *
 * First visit: Terry flies in, says "Hi, I'm Terry." and hangs from the branch. Naming a goal rolls the screen up, Terry hangs from
 * its bar and listens (sonar, progress steps, predator cards one per ping), the Terrytory fills with the real flip and flyway, the
 * goal collapses to a pill and the screen unrolls on the department, where the plan plays out. Every step is skippable and
 * reduced motion shows end states. All numbers come from flyover.js (F.chat, F.flip, F.escape). Nothing here invents one.
 */
(function (root) {
  "use strict";
  const $ = s => document.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // three ready-made chases, three departments, three endings (owner 6 Nov): a storm, a walkout, a neighborhood's own problems.
  // goal is chased; then (when there is one) is pinged to Terry once the chase lands, so the event flies against that Roost.
  const EXAMPLES = [
    // owner 7 Nov: three goals that land on three different answers (checked in the engine): a citywide escape with crews in
    // several departments, an honest no (too soon for a new crew to train), and a goal the plan already meets with no hire at all
    { tag: "Citywide", icon: "bolt", label: "The whole city at 95% all year, then a windstorm", goal: "The whole city on time at least 95% all year", then: "A windstorm hits Boston on June 2" },
    { tag: "Too soon", icon: "clock", label: "Public Works at 95% in January", goal: "Public Works on time at least 95% in January" },
    { tag: "Already safe", icon: "check", label: "Parks at 98% in January", goal: "Parks on time at least 98% in January" } ];
  const ic = (n, cls, st) => root.TerryArt.ic(n, cls, st);

  let samplePromise = null;
  function getSample() { if (!samplePromise) samplePromise = (async () => { try { return root.terryHost && root.terryHost.use ? await root.terryHost.use("sample") : null; } catch (e) { return null; } })(); return samplePromise; }
  const seenGet = () => { try { return localStorage.getItem("terry.seen") === "1"; } catch (e) { return false; } };
  const seenSet = () => { try { localStorage.setItem("terry.seen", "1"); } catch (e) {} };
  const themeGet = () => { try { return localStorage.getItem("terry.theme") === "night" ? "night" : "day"; } catch (e) { return "day"; } };
  const themeSave = t => { try { localStorage.setItem("terry.theme", t); } catch (e) {} };

  const CSS = `
  symbol .d { fill: currentColor; fill-opacity: .16; } symbol .w { fill: var(--wheel, #fff); }
  .ico { fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
  .ico.dusk-i { color: var(--dusk); } .ico.owl { color: var(--pred); }
  .pillm { fill: var(--raised); stroke: var(--hire); stroke-width: 1.5px; }
  .flycap { fill: var(--work); fill-opacity: .92; }
  #ontime { position: absolute; z-index: 4; top: 54px; right: 16px; height: 30px; display: flex; align-items: center; padding: 0 12px; border-radius: 8px; background: var(--raised); font: 400 13px var(--ui); color: var(--ink2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  #ontime[hidden] { display: none; }
  #ontime b { font-weight: 600; } #ontime b.a { color: var(--ink3); } #ontime b.w { color: var(--hire); } #ontime b.s { color: var(--short); } #ontime .dt { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--hire); margin: 0 6px 0 5px; }
  #fab .sc-cell.r .sc-zones { width: 112px; }
  #fab .sc-zones .z em { font-size: 26px; min-width: 30px; }
  #fab .sc-zones { gap: 2px 10px; }
  #fab .sc-scrub { width: 52px; }
  #fab .sc-date { font-size: 12px; min-width: 0; white-space: nowrap; }
  #fab .sc-ctl { gap: 6px; }
  #fab .sc-speed { display: none; }
  #fab .sc-scrub { width: 44px; }
  #ontime .fn { font-size: 12px; color: var(--ink3); margin-top: 8px; }
  .hero.working .hero-copy { opacity: 0; pointer-events: none; transform: translateY(-6px); }
  #workhead { position: absolute; left: var(--pad); right: var(--pad); top: 92px; z-index: 6; color: #fff; opacity: 0; pointer-events: none; transition: opacity .45s var(--ease); text-align: center; }
  .hero.working #workhead, .hero.chasing #workhead { opacity: 1; }
  /* at the click only the headline and chips give way; the goal box stays, glows, then shrinks into the card Terry carries */
  .hero.chasing:not(.working) .hero-copy > :not(#goalform) { opacity: 0; pointer-events: none; transition: opacity .35s var(--ease); }
  /* the goal's words in the header wait until the card has left, so they never sit on the box or the card */
  #workhead .disp { opacity: 0; transform: translateY(6px); transition: opacity .5s var(--ease), transform .5s var(--ease); }
  .hero.carried #workhead .disp { opacity: 1; transform: none; }
  #workhead .eyebrow { color: rgba(255,255,255,.9); margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: .08em; }
  #workhead .eyebrow svg.i { width: 16px; height: 16px; }
  #workhead .disp { font-size: 36px; line-height: 1.12; max-width: 820px; margin: 0 auto; text-shadow: 0 2px 18px rgba(0,0,0,.4); text-wrap: balance; }
  #goalpill { animation: rise .45s var(--ease) both; }
  .sonar-ring { position: absolute; z-index: 3; pointer-events: none; border: 2px solid var(--pred); border-radius: 50%; transform: translate(-50%, -50%) scale(.1); opacity: 0; }
  #plspeed { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--sunken); gap: 2px; }
  #plspeed button { height: 28px; min-width: 38px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; color: var(--ink2); font: 500 13px var(--ui); cursor: pointer; }
  #plspeed button[aria-pressed="true"] { background: var(--raised); color: var(--ink); box-shadow: 0 1px 2px rgba(var(--shadow), .14), 0 0 0 1px var(--line); }
  .tt-head { margin-top: 0; }
  .goal.echoing { animation: edgepulse .95s ease-in-out 3; }
  @keyframes edgepulse { 0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,.65), 0 0 0 1px rgba(255,224,190,.6), 0 0 14px 2px rgba(255,214,170,.4); } 50% { box-shadow: inset 0 1px 0 rgba(255,255,255,.65), 0 0 0 3px rgba(255,232,200,.95), 0 0 44px 10px rgba(255,214,170,.6); } }
  .chasecard { position: absolute; z-index: 29; box-sizing: border-box; border-radius: 22px; overflow: hidden; display: flex; align-items: center; justify-content: center; color: #fff; pointer-events: none;
    background: linear-gradient(135deg, rgba(255,255,255,.3), rgba(255,255,255,.12)); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.4); box-shadow: 0 14px 30px -12px rgba(0,0,0,.5);
    transition: background .5s ease, border-radius .5s ease, border-color .5s ease; }
  .chasecard .cc-t { position: absolute; left: 20px; right: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: 400 18px var(--ui); transition: opacity .3s ease; }
  .chasecard .cc-i { width: 26px; height: 26px; color: var(--pred); opacity: 0; transition: opacity .4s ease; }
  .chasecard.sm { background: #fff; border-color: #fff; border-radius: 14px; } .chasecard.sm .cc-t { opacity: 0; } .chasecard.sm .cc-i { opacity: 1; }
  .chasecard.fail .cc-t { display: none; }
  .chasecard.fail { background: #fff; border-color: #fff; border-radius: 10px; } .chasecard.fail .cc-i { color: var(--short); }
  #introbub::after { display: none; }
  .tt-sub { margin-top: 6px; font: 500 14px/1.3 var(--ui); color: var(--ink2); }
  .tally .badge svg.i { width: 14px; height: 14px; }
  .sec .ln { flex: 1; height: 1px; background: var(--line); }
  .sec .cnt { font: 500 12px var(--ui); text-transform: none; letter-spacing: 0; color: var(--ink2); }
  .prog li .st svg { width: 13px; height: 13px; }
  .failcard.load .t p { color: var(--ink2); }
  .why-flip { display: inline-block; margin-top: 10px; padding: 4px 12px; border-radius: 14px; border: 1px solid var(--line2); background: transparent; color: var(--ink2); font: 600 12.5px var(--ui); cursor: pointer; }
  .why-flip:hover { color: var(--ink); border-color: var(--ink3); } .why-flip:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .failcard.load .t p::after { content: ""; display: inline-block; width: 1.2em; animation: dots 1.2s steps(4) infinite; }
  @keyframes dots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }
  .pc .strike { pointer-events: none; }
  .pc h3 { height: auto; min-height: 54px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .prog { height: 214px; } .tt-top.work .failcard { height: 214px; }
  #terrytory { transition: padding-top .6s var(--ease); } #terrytory.busy { padding-top: 90px; }
  html, body { overflow-anchor: none; }
  .tt-fadein { animation: rise .5s var(--ease) both; }
  .verdict .vt { flex: 1; }
  @media (prefers-reduced-motion: reduce) { .failcard.load .t p::after, #goalpill, .tt-fadein { animation: none; } #workhead, .hero-copy { transition: none; } }
  `;

  root.TerryProj = { getSample };
  function init() {
    const st = document.createElement("style"); st.id = "proj-css"; st.textContent = CSS; document.head.appendChild(st);
    const A = root.TerryArt, page = $("#page"), hero = $("#boston"), rig = $("#rig"), rigTop = $("#rigTop"), rigBot = $("#rigBot"), rigMove = $("#rigMove"), slatref = $("#slatref"), screen = $("#screen"), fab = $("#fab"), stage = $("#stage"),
      TT = $("#terrytory"), tlayer = $("#tlayer"), psvg = $("#pterry"), introbub = $("#introbub"), skipbtn = $("#skipbtn"), hit = $("#terryhit"),
      goalform = $("#goalform"), goalin = $("#goalin"), gobtn = $("#gobtn"), gchips = $("#goalchips"), gnote = $("#goalnote"), pill = $("#goalpill"), editgoal = $("#editgoal"),
      ctrls = $(".ctrls"), plantgl = $("#plantgl"), scCtl = $("#sc-ctl");
    for (const id of ["#hi", "#pbub", "#plantgl-old"]) { const n = $(id); if (n) n.remove(); }
    const Zm = () => root.__zoom;
    const rel = e => { const a = e.getBoundingClientRect(), b = page.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };
    const pad = () => Math.max(48, (page.clientWidth - 1220) / 2);

    // ------------------------------------------------------------ waiting, speed and skipping
    const SK = { on: false, ws: new Set() };
    const sp = () => (Zm() && Zm().planSpeed) || 1;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const wait = ms => new Promise(res => { if (SK.on || reduced()) return res(); const t = setTimeout(() => { SK.ws.delete(fn); res(); }, ms / sp()); const fn = () => { clearTimeout(t); res(); }; SK.ws.add(fn); });
    const skipNow = () => { SK.on = true; for (const f of [...SK.ws]) f(); SK.ws.clear(); if (Zm() && Zm().planRunning) Zm().skipPlan(); };
    // owner 7 Nov: the button shows the click landed (the chase may still need a moment to finish its sums), and resets when it hides
    // owner 11 Nov: in a chase the corner button is "Skip to the answer"; after an answer it offers the chase back for next time
    // owner 12 Nov: while Terry chases, the button always offers the other way to see it ("Skip to the answer" / "Watch Terry chase"),
    // back and forth as often as wanted; once the answer is on its way it reads "Getting the answer"; after the chase it offers the other
    // way for next time, and stays until the viewer scrolls or starts another chase
    skipbtn.addEventListener("click", e => {
      if (skipbtn.classList.contains("undo")) { e.stopImmediatePropagation(); const skipNext = skipbtn.classList.contains("nx-skip"); instantPref(skipNext); clearNext(); skipbtn.classList.add("said"); skipbtn.textContent = skipNext ? "Straight to the answer next time" : "The chase plays next time"; undoT = setTimeout(() => { skipbtn.hidden = true; }, 1800); return; }
      if (skipbtn.classList.contains("watch")) { e.stopImmediatePropagation(); unjump(); return; }
      if (skipbtn.classList.contains("skipping") || skipbtn.classList.contains("said")) { e.stopImmediatePropagation(); return; }
      if (running && !jumped && !prog.has("fly")) return;   // jump() sets the label: the answer is coming, the chase can be had back
      skipbtn.classList.add("skipping"); skipbtn.textContent = running && !prog.has("fly") ? "Getting the answer" : "Skipping"; skipbtn.setAttribute("aria-busy", "true");
    }, true);
    try { new MutationObserver(() => { if (skipbtn.hidden) { clearNext(); skipbtn.classList.remove("skipping", "undo", "said", "watch", "nx-skip"); skipbtn.textContent = "Skip"; skipbtn.removeAttribute("aria-busy"); } }).observe(skipbtn, { attributes: true, attributeFilter: ["hidden"] }); } catch (e) {}
    skipbtn.addEventListener("click", skipNow);
    // ------------------------------------------------------------ skip to the answer (owner 11 Nov)
    // A skipped chase drops the theatre but not the thinking: Terry still waits for the model's flip, and the section rail charges like a
    // battery through the real stages (goal, flip, predators, flyway, plan) while he does. The answer lands on the flyway, with one line in
    // the dock. A viewer who skips once gets answers straight away for the rest of the visit, and can ask for the chase back.
    let jumped = false, answered = false, undoT = 0, prog = new Set();
    const instantPref = v => { try { if (v === undefined) return sessionStorage.getItem("terry.instant") === "1"; if (v) sessionStorage.setItem("terry.instant", "1"); else sessionStorage.removeItem("terry.instant"); } catch (e) {} return false; };
    const RL = () => root.TerryRail;
    const pm = k => { prog.add(k); if (jumped && RL()) RL().mark(k); if (k === "fly" && jumped && !answered) btnBusy(); };
    function jump(auto) {
      if (jumped || !running || prog.has("fly")) return; jumped = true;   // a chase can start while his hello is still finishing: running is what counts
      if (!auto) instantPref(true);
      if (!SK.on) skipNow();
      btnWatch();
      if (RL()) RL().begin([...prog]);
      $("#live").textContent = "Skipping to the answer.";
    }
    // the chase back, from where it is: the theatre resumes (the model is not asked again), and the rest of the visit plays in full
    function unjump() {
      if (!jumped || answered || !running || prog.has("fly")) return;
      jumped = false; instantPref(false); SK.on = false; if (RL()) RL().cancel();
      btnSkip(); $("#live").textContent = "Watching Terry chase.";
    }
    function btnSkip() { clearNext(); skipbtn.classList.remove("skipping", "watch", "said"); skipbtn.removeAttribute("aria-busy"); skipbtn.textContent = "Skip to the answer"; skipbtn.hidden = false; }
    function btnWatch() { clearNext(); skipbtn.classList.remove("skipping", "said"); skipbtn.removeAttribute("aria-busy"); skipbtn.classList.add("watch"); skipbtn.textContent = "Watch Terry chase"; skipbtn.hidden = false; }
    function btnBusy() { skipbtn.classList.remove("watch", "undo", "nx-skip", "said"); skipbtn.classList.add("skipping"); skipbtn.textContent = "Getting the answer"; skipbtn.setAttribute("aria-busy", "true"); skipbtn.hidden = false; }
    // after a chase: the other way, for next time; it stays until the viewer scrolls (wheel, touch, keys) or starts another chase
    let nextOn = false;
    function offerNext(skipNext) {
      clearNext(); skipbtn.classList.remove("skipping", "said", "watch"); skipbtn.removeAttribute("aria-busy");
      skipbtn.classList.add("undo"); skipbtn.classList.toggle("nx-skip", !!skipNext); skipbtn.innerHTML = `${skipNext ? "Skip to the answer" : "Watch the chase"} <span class="nx">next time</span>`; skipbtn.hidden = false;   // owner 12 Nov: "next time" glows
      nextOn = true; setTimeout(() => { if (nextOn) { addEventListener("wheel", hideNext, { passive: true }); addEventListener("touchmove", hideNext, { passive: true }); addEventListener("keydown", hideNextKey); } }, 600);
    }
    function clearNext() { clearTimeout(undoT); if (!nextOn) return; nextOn = false; removeEventListener("wheel", hideNext); removeEventListener("touchmove", hideNext); removeEventListener("keydown", hideNextKey); skipbtn.classList.remove("undo", "nx-skip"); }
    function hideNext() { if (!nextOn) return; clearNext(); skipbtn.hidden = true; }
    function hideNextKey(e) { if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(e.key)) hideNext(); }
    skipbtn.addEventListener("click", () => { if (running) jump(false); });
    addEventListener("keydown", e => {   // Esc skips a chase too, as it does the intro (never while typing, never once the plan is playing)
      if (e.key !== "Escape" || !running || jumped || skipbtn.hidden || prog.has("fly")) return;
      const t = e.target; if (t && t.closest && t.closest("input, textarea, [contenteditable], .rbody, #dock")) return;
      skipbtn.click();
    });
    // the answer, where the eye should land: the flyway, whole and clear of the dock, plus one line from Terry
    function landAnswer() {
      const body = bodyOf(activeId()) || document, f = body.querySelector("section.flyp"), sec = f && (f.closest(".tt-fadein") || f);
      if (sec) { const dk = $("#dock"), room = (dk && dk.offsetHeight ? Math.min(innerHeight, dk.getBoundingClientRect().top) : innerHeight) - 16, r = rel(sec);
        scrollTo({ top: Math.max(0, r.y - Math.max(90, Math.min(140, (room - r.h) / 2))), behavior: reduced() ? "auto" : "smooth" }); }
      // the answer in one line, read off the page itself: the verdict, the decision (who to sign, by when) and the bill
      const G = root.TerryGuide, q = k => sec && sec.querySelector(k), t = n => (n && n.textContent || "").replace(/\s+/g, " ").trim(), dot = x => x.replace(/[.\s]+$/, "") + ".";
      const sign = sec ? [...sec.querySelectorAll("li.step")].find(li => /^sign/i.test(t(li.querySelector(".t")))) : null;
      const dd = sign && t(sign.querySelector(".d")).toLowerCase().replace(/(^|\s)([a-z])/g, (m, s1, c) => s1 + c.toUpperCase());
      const act = sign && t(sign.querySelector(".s")) ? `${t(sign.querySelector(".s")).replace(/[.\s]+$/, "")}${dd ? " by " + dd : ""}.` : "";
      const tot = q(".bill .tot"), bill = tot ? `${t(tot.querySelector(".k"))} ${t(tot.querySelector(".v"))}, ${t(q(".bill .for"))}.` : (t(q(".bill .for")) ? dot(t(q(".bill .for")).replace(/^for /, "For ")) : "");
      const line = [t(q(".verdict h2")) && dot(t(q(".verdict h2"))), act, bill].filter(Boolean).join(" ") || dot(t(f && f.querySelector(".fw-h .sub")));
      if (G && G.say && line) G.say(`Here is the answer. ${line}`, { q: "What is the answer?" });
      $("#live").textContent = line ? `The answer: ${line}` : "The answer is ready.";
      // the chase is one click away for next time
      offerNext(false);
    }
    // follow: the camera eases toward a moving target every frame (the card in Terry's feet) until stopped (owner 7 Nov)
    function follow(fn) { if (SK.on || reduced()) return () => {}; let on = true;
      let last = performance.now();
      (function f(now) { if (!on || SK.on) return; now = now || performance.now(); const dt = Math.min(.1, (now - last) / 1000); last = now;
        const t = Math.max(0, fn()); if (isFinite(t)) { const d = t - scrollY; if (Math.abs(d) > .5) scrollTo(0, scrollY + d * (1 - Math.exp(-dt * 9))); } requestAnimationFrame(f); })();
      return () => { on = false; }; }
    function glideY(fn, ms) { const y0 = scrollY; if (SK.on || reduced()) { scrollTo(0, Math.max(0, fn())); return Promise.resolve(); } return tween(ms || 800, u => scrollTo(0, Math.max(0, y0 + (fn() - y0) * u))); }
    const raf = () => new Promise(r => requestAnimationFrame(r));
    function tween(ms, fn) { return new Promise(res => { if (SK.on || reduced()) { fn(1); return res(); } const t0 = performance.now(), d = ms / sp(); (function f(now) { const u = Math.min(1, (now - t0) / d); fn(u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2); if (u < 1 && !SK.on) requestAnimationFrame(f); else { if (SK.on) fn(1); res(); } })(t0); }); }
    function countUp(node, to, fmt, ms) { if (SK.on || reduced()) { node.textContent = fmt(to); return; } node.textContent = fmt(0); tween(ms || 1100, u => { node.textContent = fmt(to * u); }); }

    // ------------------------------------------------------------ branch, cords, roller
    // the photographic projector: image geometry in image pixels (fabric rectangle, case bottom edge, slat), scaled to the page
    const GEO_DAY = { w: 1916, h: 821, fab: [413, 221, 1507, 736], cb: 192, slat: 752, slatB: 772, hang: [0.875, 104] }, GEO = { day: GEO_DAY, night: GEO_DAY };   // the night rig is the relit day image: one geometry
    const RSRC = { day: "assets/projector/screen-day.webp?v=4", night: "assets/projector/screen-night.webp?v=4" };   // v2: the branch cut out cleanly at its top (no fade, no straight crop)
    const curTheme = () => (document.documentElement.dataset.theme === "night" ? "night" : "day");
    let RG = { k: 1, rw: 1440, rh: 617, left: 0, ty: 0, tyFull: 0 };
    // the branch runs off both sides of the page: the picture is drawn a little wider than the page, so its two ragged corners (the
    // maple cluster at the top left, the trunk's stump at the top right) fall outside it and the branch crosses the page edge to edge
    const RIG_OVER = 1.24;
    function fitRig() {
      const t = curTheme(), g = GEO[t], W = page.clientWidth, MAXW = 1916;   // the cut-out's natural width: the rig is never zoomed past it
      // lower the rig a little (48 at 1440, 56 from 1600) as far as the pull ring still clears the Ping dock; short windows get less
      const baseTop = screen.offsetTop - (RG.drop || 0), kW = Math.min(W, MAXW) * RIG_OVER / g.w, want = W >= 1600 ? 56 : 48;
      const drop = Math.max(0, Math.min(want, Math.floor(innerHeight - 88 - baseTop - g.slatB * kW)));
      if (drop !== RG.drop) { screen.style.setProperty("--rigdrop", drop + "px"); RG.drop = drop; }
      const top0 = baseTop + drop, kFit = (innerHeight - 88 - top0) / g.slatB, rw = Math.min(W, MAXW) * RIG_OVER, k = rw / g.w, rh = g.h * k, f = g.fab;   // the tree always spans the page; never shrunk to fit a short window (the page scrolls instead), so no side gaps
      rig.classList.toggle("edge", W > rw + 2);   // side fades only where the page is wider than the photo
      RG = { k, rw, rh, left: (W - rw) / 2, ty: RG.ty || 0, tyFull: (g.slat - g.cb - 6) * k, g, drop };
      rig.style.left = RG.left + "px"; rig.style.width = rw + "px"; rig.style.height = rh + "px";
      rig.querySelectorAll("img").forEach(i => { if (i.getAttribute("src") !== RSRC[t]) i.src = RSRC[t]; });
      // only the screen column below the case rolls up; the leaves and trunk beside it stay in the top layer
      const cL = (f[0] - 45) * k, cR = (f[2] + 45) * k, cB = g.cb * k;
      rigTop.style.clipPath = `polygon(0 0, ${rw}px 0, ${rw}px ${rh}px, ${cR}px ${rh}px, ${cR}px ${cB}px, ${cL}px ${cB}px, ${cL}px ${rh}px, 0 ${rh}px)`;
      rigBot.style.clipPath = `inset(${cB}px ${rw - cR}px 0 ${cL}px)`;
      fab.style.left = f[0] * k + "px"; fab.style.top = f[1] * k + "px"; fab.style.width = (f[2] - f[0]) * k + "px"; fab.style.height = (f[3] - f[1]) * k + "px";
      slatref.style.left = rw / 2 + "px"; slatref.style.top = g.slatB * k + "px"; setTy(RG.ty);
    }
    function setTy(ty) { RG.ty = ty; rigMove.style.transform = `translateY(${-ty}px)`; screen.style.setProperty("--rig-h", (RG.rh - ty) + "px"); }

    // ------------------------------------------------------------ Terry: the 3D bat, with the SVG rig as fallback
    let bat = null, is3d = false, pos = { x: 0, y: 0 }, g2 = null;
    const NOBAT = { setBranch() {}, setHome() {}, setSpeed() {}, hangNow() {}, mode: () => "hover", busy: () => false, flip: async () => {}, echo: async () => {}, flap: async () => {} };
    const BAT_SCALE = 0.8;   // Terry is one size in flight, carry and hang (smaller than he was: company, not a distraction)
    function mkBat() {
      let gl = false; try { const c = document.createElement("canvas"); gl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) {}
      if (gl && root.THREE && root.TerryBat3D) { try { bat = root.TerryBat3D.create(tlayer, { home: { x: -160, y: 200 }, branch: { x: 0, y: 0 }, shadow: true, scale: BAT_SCALE / 1.15 }); is3d = true; } catch (e) { bat = null; } }
      if (!bat && root.TerryBat) {
        const NS = "http://www.w3.org/2000/svg", mk = () => document.createElementNS(NS, "g"); const bg = mk(), rg = mk(); psvg.appendChild(bg); psvg.appendChild(rg);
        try { bat = root.TerryBat.create(psvg, { layer: bg, ringLayer: rg, home: { x: -140, y: 200 }, branch: { x: 0, y: 0 } }); bat.setScale(0.6); if (bat.state) { bat.state.x = -140; bat.state.y = 200; } } catch (e) { bat = null; }
      }
      if (!bat) bat = NOBAT; else setBatTheme();
      if (is3d) bat = wrapBat(bat);
    }
    // the guide flies Terry on a viewport-fixed layer (#tlayer.tg-fixed) while the page scrolls; callers keep page coordinates
    let fixB = null, lastH = null, lastBr = null, gone = false, GM = "none", gS = null, flyOffP = null;
    const fixOff = () => { if (!fixB) return { x: 0, y: 0 }; const p = page.getBoundingClientRect(), t = tlayer.getBoundingClientRect(); return { x: fixB.x + p.left - t.left, y: fixB.y + p.top - t.top }; };
    function wrapBat(raw) {
      const w = Object.assign({}, raw);
      w.setHome = (x, y) => { lastH = { x, y }; const d = fixOff(); raw.setHome(x + d.x, y + d.y); };
      w.setBranch = (x, y) => { lastBr = { x, y }; const d = fixOff(); raw.setBranch(x + d.x, y + d.y); };
      w.anchor = n => { const a = raw.anchor(n); if (!a) return a; const d = fixOff(); return { x: a.x - d.x, y: a.y - d.y }; };
      w.retrack = () => { const d = fixOff(); if (lastH) raw.setHome(lastH.x + d.x, lastH.y + d.y); if (lastBr) raw.setBranch(lastBr.x + d.x, lastBr.y + d.y); };
      return w;
    }
    function fix(on) {
      if (!is3d || !bat.retrack) return;
      if (on && !fixB) {
        const p = page.getBoundingClientRect(), t = tlayer.getBoundingClientRect(); fixB = { x: t.left - p.left, y: t.top - p.top };
        tlayer.style.setProperty("--tg-l", p.left + "px"); tlayer.style.setProperty("--tg-w", p.width + "px"); tlayer.classList.add("tg-fixed"); tlayer.style.clipPath = ""; bat.retrack();
        requestAnimationFrame(function f() { if (!fixB) return; bat.retrack(); requestAnimationFrame(f); });
      } else if (!on && fixB) { fixB = null; tlayer.classList.remove("tg-fixed"); tlayer.style.removeProperty("--tg-l"); tlayer.style.removeProperty("--tg-w"); bat.retrack(); }
    }
    const setBatTheme = () => { if (bat && bat.setTheme) bat.setTheme(document.documentElement.dataset.theme === "night" ? "dark" : "light"); };
    const idle = async () => { for (let k = 0; k < 170 * (root.__terrySlow || 1) && bat.busy(); k++) await sleep(30); };   // let a landing or a take-off finish: moving the branch under a busy bat would teleport him
    const bounded = (pr, ms) => Promise.race([pr, sleep(ms * (root.__terrySlow || 1))]);   // a slow GPU must never hold up the page
    function moveTo(x, y, ms) {
      if (gone) return Promise.resolve();
      bat.setHome(x, y); pos = { x, y };
      if (is3d || !bat.state) return wait(ms || 1800);
      const s = bat.state, x0 = s.x, y0 = s.y; return tween(ms || 1800, u => { s.x = x0 + (x - x0) * u; s.y = y0 + (y - y0) * u - 60 * Math.sin(Math.PI * u); });
    }
    async function release(hx, hy) { if (gone) return; await idle(); if (bat.mode() === "hang") { bat.setHome(hx === undefined ? pos.x - 40 : hx, hy === undefined ? pos.y + 130 : hy); await bounded(bat.flip(), 5000); } }   // generous: a slow frame rate must not cut the take-off short
    async function hang(x, y, instant) {
      if (gone) return;
      if (SK.on) { pos = { x, y }; bat.setBranch(x, y); bat.hangNow(); return; }   // skipping: he is simply there, never waited for mid-flight
      await idle(); pos = { x, y };
      if (instant || reduced()) { bat.setBranch(x, y); bat.hangNow(); return; }
      if (bat.mode() === "hang") await release();
      bat.setBranch(x, y); await bounded(bat.flip(), 7000);
      if (bat.mode() !== "hang") { bat.setBranch(x, y); bat.hangNow(); }   // a slow GPU never leaves him mid-air
    }
    // Terry's home: hovering in flight just to the right of the goal box (or of the pill once the goal is set)
    const homePt = () => { const el = (!goalform.hidden && goalform.style.visibility !== "hidden") ? goalform : (addBtn && !addBtn.hidden ? addBtn : goalform), r = rel(el);
      // his wings reach about 300 px left of this point and 110 px right (wings up, the widest pose); he never covers the box or its Chase it button
      const pw = page.clientWidth - ((parseFloat(page.style.getPropertyValue("--ov-r")) || 0) > 0 ? 300 : 0), RL = 300 * BAT_SCALE, RR = 110 * BAT_SCALE, xr = r.x + r.w + 16 + RL;
      if (xr + RR <= pw - 8) return { x: xr, y: r.y + r.h / 2 - 66 };
      return { x: Math.max(r.x + RL, Math.min(pw - RR - 8, r.x + r.w + 24)), y: r.y + r.h + 110 }; };   // no room beside it: under the box, on its right
    // once Terry's plan is on the screen he perches on the right of the tree, hanging from the branch where it meets the trunk (about 87% of the rig width)
    const perched = () => hero.classList.contains("has-goal") && roosts().length > 0 && !introRunning;
    const branchPt = () => { const r = rel(rig), g = RG.g || GEO.day; return { x: r.x + g.hang[0] * r.w, y: r.y + g.hang[1] * RG.k }; };
    function placeHit() { if (perched()) { const b = branchPt(); hit.style.left = (b.x - 32) + "px"; hit.style.top = (b.y + 6) + "px"; return; } const p = homePt(), nv = $(".hero .nav"), nb = nv ? (() => { const r = rel(nv); return r.y + r.h + 4; })() : 0;
      /* the hit area never sits over the header's buttons (laptop widths put Terry's home under the theme switch) */
      const t = Math.max(p.y - 54, nb); hit.style.left = (p.x - 32) + "px"; hit.style.top = t + "px"; hit.style.height = Math.max(40, p.y + 54 - t) + "px"; }
    let tallUntilHome = null;   // the 3D layer's height to put back once Terry has left the Almanac
    async function toHome(instant) {
      if (gone) return;
      if (tallUntilHome !== null) { const h0 = tallUntilHome; tallUntilHome = null; setTimeout(() => { if (tallUntilHome === null && !ferrying) tlayer.style.height = h0; }, 2600); }
      if (perched()) { const b = branchPt(); placeHit(); await hang(b.x, b.y, instant); return; }
      const p = homePt(); placeHit(); await idle(); pos = p;
      if (bat.mode() === "hang") return release(p.x, p.y);
      return moveTo(p.x, p.y, instant || reduced() ? 0 : 1400);
    }
    hit.hidden = false; hit.addEventListener("click", () => { const b = document.querySelector(".ask-btn"); if (b) b.click(); });
    const barPt = () => { const r = rel(slatref); return { x: r.x + 120, y: r.y + 2 }; };

    function ping(x, y, w, hgt, ms) {
      if (SK.on || reduced()) return; w = Math.min(w, 760); hgt = Math.min(hgt, 170); const r = h("i", "sonar-ring"); r.style.left = x + "px"; r.style.top = y + "px"; r.style.width = w + "px"; r.style.height = hgt + "px"; page.appendChild(r);
      const a = r.animate([{ opacity: .7, transform: "translate(-50%,-50%) scale(.12)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(1)" }], { duration: (ms || 1500) / sp(), easing: "cubic-bezier(.2,.6,.3,1)" });
      a.finished.then(() => r.remove(), () => r.remove());
    }

    // ------------------------------------------------------------ theme
    function setTheme(t) {
      document.documentElement.dataset.theme = t; themeSave(t);
      document.querySelectorAll("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeSet === t)));
      bus("theme:changed", { theme: t }); fitRig(); setBatTheme(); placeHit(); if (!running && !introRunning && bat && bat.mode() !== "hang") { const p = homePt(); bat.setHome(p.x, p.y); pos = p; }
    }
    document.querySelectorAll("[data-theme-set]").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));

    // ------------------------------------------------------------ the screen: roll up and down
    let hangFollow = false;
    async function roll(up) {
      const to = up ? RG.tyFull : 0, P = root.Pull;
      if (P && typeof P.to === "function") {   // pull.js owns the screen height: the chase asks it, and only follows with the bat
        const quick = reduced() || SK.on; let go = !quick;
        const follow = () => { if (hangFollow && !gone) { const b = barPt(); bat.setBranch(b.x, b.y); pos = b; } if (go) requestAnimationFrame(follow); };
        follow();
        try { await P.to(up ? 0 : 1, quick ? 0 : (up ? 1100 : 1300)); } finally { go = false; }
        RG.ty = to; follow(); return;
      }
      if (reduced() || SK.on) { setTy(to); return; }
      const from = RG.ty; await tween(up ? 1100 : 1300, u => { setTy(from + (to - from) * u); if (hangFollow && !gone) { const b = barPt(); bat.setBranch(b.x, b.y); pos = b; } });
      setTy(to);
    }

    // ------------------------------------------------------------ the goal box
    const ringsShow = on => { if (on) tlayer.style.clipPath = ""; try { if (psvg && psvg.lastChild) psvg.lastChild.style.display = on ? "" : "none"; } catch (e) {} };   // the bat's own echo rings stay off the Terrytory text; ping() draws the sonar
    let F = null, ready = null, running = false, goalBusy = false, lastText = "", GOAL = null, X = null, FL = null, planX = null, GVspec = null;
    async function ensure() {
      if (ready) return ready;
      ready = (async () => { for (let k = 0; k < 300 && !(Zm() && Zm().ready); k++) await sleep(50); const sample = await getSample(), z = Zm(); const T = root.TerryLive.create(z.E, sample); F = root.TerryFlyover.create(z.E, T, sample); return F; })();
      return ready;
    }
    const PH0 = goalin.placeholder;
    function setChips(list) { const ask = !!(list.length && list[0].opt); gnote.classList.toggle("ask", ask); goalin.placeholder = ask ? "Type an answer, or pick one" : PH0; if (ask) gnote.appendChild(gchips); else if (gchips.parentNode === gnote) goalform.after(gchips); gchips.textContent = ""; gchips.dataset.ex = list.length && !list[0].opt ? "1" : "0"; for (const c of list) { const b = h("button", "gchip" + (c.opt ? " opt" : "") + (c.tag ? " ex" : ""), c.tag ? `<span class="gc-tag">${ic(c.icon || "search")}${esc(c.tag)}</span><span class="gc-l">${esc(c.label)}</span>` : (c.opt ? "" : ic("search")) + esc(c.label)); b.type = "button"; if (c.title) b.title = c.title; b.addEventListener("click", c.run); gchips.appendChild(b); } }
    let thenText = null;   // the event a ready-made chase pings once it lands
    const exChips = () => EXAMPLES.map(x => ({ label: x.label, tag: x.tag, icon: x.icon, title: x.then ? `Chases "${x.goal}", then pings: "${x.then}"` : `Chases "${x.goal}"`,
      run: () => { thenText = x.then || null; goalin.value = x.goal; submit(x.goal); } }));
    try { root.TerryBus && root.TerryBus.on("proj:idle", p => {
      if (!thenText) return; const t = thenText; thenText = null;
      if (!p || p.reason !== "chase") return;   // an aborted chase drops the event
      setTimeout(() => { try { if (root.TerryPing && root.TerryPing.submit) root.TerryPing.submit(t); } catch (e) {} }, 1400);
    }); } catch (e) {}
    function lockBox(on) { goalin.disabled = on; gobtn.disabled = on; }
    async function submit(text) {
      text = String(text === undefined ? goalin.value : text).trim(); if (!text || goalBusy || running) return;
      if (introRunning) skipNow();
      goalBusy = true; stickyChips = false; lockBox(true); gnote.textContent = ""; setChips([]); goalform.classList.add("taking");   // it pulses at once, so the wait for Terry's reply is never a dead pause
      try {
        await ensure(); lastText = text; const r = await F.chat(text);
        if (r.kind === "question") { gnote.textContent = r.text; setChips((r.options || []).map(o => ({ label: o, opt: true, run: () => { goalin.value = o; submit(o); } }))); }
        else if (r.kind === "ready") { gnote.textContent = ""; goalBusy = false; if (r.then) thenText = r.then; await runGoal(r.goal); }   // r.then: a what-if typed in the same sentence, played in Ping after the chase (owner 7 Nov)
        else { gnote.textContent = r.text || "Tell me a goal, like: every Transportation request on time in November."; setChips(exChips()); }
      } catch (e) { gnote.textContent = "Something went wrong. Try again."; setChips(exChips()); console.warn("goal failed", e && e.message); }
      finally { goalBusy = false; goalform.classList.remove("taking"); if (!running) { lockBox(false); goalin.focus({ preventScroll: true }); } }
    }
    goalform.addEventListener("submit", e => { e.preventDefault(); submit(); });
    // example chips appear on focus (or after a 300 ms hover) and stay while the field is empty
    // stickyChips (owner 7 Nov): when the box reopens for another goal the suggestions stay up until the viewer types or picks one,
    // whether or not the browser gave the field focus (they used to vanish 1.5 s after the pointer left a box that never got focus)
    let chipT = 0, chipOff = 0, stickyChips = false;
    const chipsOn = on => { if (!on && stickyChips && !goalin.value && !goalform.hidden) return; hero.classList.toggle("chipson", !!on && !goalin.value && gchips.dataset.ex === "1" && !!gchips.children.length); };
    goalin.addEventListener("focus", () => chipsOn(true)); goalin.addEventListener("input", () => { goalform.classList.toggle("hastext", !!goalin.value); if (goalin.value) stickyChips = false; chipsOn(true); });
    goalform.addEventListener("pointerenter", () => { clearTimeout(chipOff); chipT = setTimeout(() => chipsOn(true), 300); });
    goalform.addEventListener("pointerleave", () => { clearTimeout(chipT); chipOff = setTimeout(() => { if (document.activeElement !== goalin && !gchips.contains(document.activeElement)) chipsOn(false); }, 1500); });
    // the pointer can travel from the box down onto the suggestions without them closing under it
    gchips.addEventListener("pointerenter", () => { clearTimeout(chipOff); });
    gchips.addEventListener("pointerleave", () => { clearTimeout(chipOff); chipOff = setTimeout(() => { if (document.activeElement !== goalin && !gchips.contains(document.activeElement)) chipsOn(false); }, 1200); });
    goalform.addEventListener("pointerdown", () => chipsOn(true));
    hero.addEventListener("focusout", e => { const to = e.relatedTarget; if (!to || !to.closest || !to.closest("#goalform, #goalchips")) chipsOn(false); });
    goalin.addEventListener("keydown", e => { if (e.key === "Tab" && !e.shiftKey && hero.classList.contains("chipson") && gchips.firstElementChild) { e.preventDefault(); gchips.firstElementChild.focus(); } });
    gchips.addEventListener("keydown", e => { if (e.key !== "Tab") return; const k = [...gchips.children], i = k.indexOf(document.activeElement); if (!e.shiftKey && i === k.length - 1) { e.preventDefault(); gobtn.focus(); } else if (e.shiftKey && i === 0) { e.preventDefault(); goalin.focus(); } });
    // the chips sit after Chase it in the page, but are reached from the input: so Tab from Chase it skips them to whatever follows,
    // never back into the chips (that made a loop a keyboard user could not leave)
    gobtn.addEventListener("keydown", e => {
      if (e.key !== "Tab" || e.shiftKey || !(gobtn.compareDocumentPosition(gchips) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      const all = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(x => !gchips.contains(x) && x.getClientRects().length && getComputedStyle(x).visibility !== "hidden" && !x.closest("[aria-hidden=true], [inert], [hidden]"));
      const next = all.find(x => gchips.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (next) { e.preventDefault(); next.focus(); }
    });
    setChips(exChips());
    hero.insertAdjacentHTML("beforeend", `<div id="workhead" aria-hidden="true"><div class="eyebrow">${ic("sonar")}Terry is chasing it</div><div class="disp"></div></div>`);
    const workhead = $("#workhead");

    let addBtn = null;   // the "+" where the goal box was, built with the Roost code below
    // ------------------------------------------------------------ Roost: plates, the rail, several plans
    const P = () => root.TerryPlates, Bus = root.TerryBus, R = root.TerryRoost;
    const bus = (e, p) => { try { if (Bus) Bus.emit(e, p); } catch (err) { console.warn("bus", e, err && err.message); } };
    const roosts = () => (root.TerryState && root.TerryState.roosts) || [];
    const activeId = () => (root.TerryState && root.TerryState.activeRoost) || null;
    TT.innerHTML = `<div class="tt-head"><div><h2 class="disp"><span class="bw">Flip Side</span></h2><p class="tt-sub" id="ttsub"></p></div><div class="rail" id="rail" role="tablist" aria-label="Roosts"></div></div><div id="rbodies"></div>`;
    const rbodies = $("#rbodies"), rail = $("#rail"), ttsub = $("#ttsub");
    let live = null, building = false;
    const mkBody = () => { const b = h("div", "rbody"); rbodies.appendChild(b); return b; };
    const showBody = b => { for (const x of rbodies.children) x.hidden = x !== b; };
    const bodyOf = id => rbodies.querySelector(`.rbody[data-r="${id}"]`);
    const pad2 = n => String(n).padStart(2, "0");
    const deptName = d => { const E = Zm() && Zm().E; return d === "CITY" ? "Boston" : (E && E.depts[d] && E.depts[d].name) || d || "Boston"; };
    function shortGoal(r) {
      const g = r.goal || {}, ms = (g.months || []).slice().sort((a, b) => a - b), mo = !ms.length || ms.length === 12 ? "2025" : ms.length === 1 ? MON[ms[0] - 1].slice(0, 3) : `${MON[ms[0] - 1].slice(0, 3)} to ${MON[ms[ms.length - 1] - 1].slice(0, 3)}`;
      return `${deptName(g.scope)}, ${mo}, ${Math.round((g.target || 0) * 100)}%`;
    }
    // Echolocation follows the chase on show (owner 11 Nov): the goal, its department and months, and the places its predators named
    function echoGoal(g, fl) {
      const Qm = root.TerryQuiet; if (!Qm || !Qm.goal) return;
      if (!g) { Qm.goal(null); return; }
      const z = Zm(), i = z && z.info, dn = g.scope === "CITY" ? "The four departments" : (i && i[g.scope] && i[g.scope].name) || "This department";
      const preds = ((fl && fl.predators) || []).map(p => ({ hood: p.hypothesis && p.hypothesis.neighborhood, verdict: p.evidence && p.evidence.verdict, label: p.hypothesis && p.hypothesis.name })).filter(p => p.hood);
      try { Qm.goal({ scope: g.scope, months: g.months, hood: g.hood || null, deptName: dn, goalText: F && F.goalText ? F.goalText(g) : "", preds }); } catch (e) { console.warn("echo goal", e && e.message); }
    }
    function ttEmpty() { echoGoal(null); rbodies.textContent = ""; const b = mkBody(); b.classList.add("empty"); b.innerHTML = `<div class="plate tt-empty"><span class="disp">Nothing chased yet</span>Give Terry a goal. His predators and the flyway land here. Until then, this is the plan he starts from.</div>`; live = null; building = false; renderRail(); }
    function renderRail() {
      const rs = roosts(), act = building ? null : activeId(); { const r0 = building ? null : (rs.find(x => x.id === act) || (rs.length === 1 ? rs[0] : null)), g0 = building ? GOAL : r0 && r0.goal, gt = g0 && F && F.goalText ? String(F.goalText(g0)) : ""; ttsub.textContent = gt ? gt.replace(/\.?$/, ".") : ""; ttsub.hidden = !gt; }   // owner 11 Nov: the goal is the Flip Side's title
      rail.hidden = rs.length < 2; rail.textContent = "";
      const VW = { escaped: ["", "Escaped"], already: ["", "Already safe"], partial: ["w", "Partly"], unreachable: ["b", "No exit left"] };
      rs.forEach(r => { const v = VW[r.verdict] || VW.partial;
        const t = h("button", "tab", `<span class="rn">R${r.n}</span><span class="g">${esc(shortGoal(r))}</span><span class="dot ${v[0]}"></span><span class="vw">${v[1]}</span>`);
        t.type = "button"; t.setAttribute("role", "tab"); t.id = "tab-" + r.id; t.dataset.id = r.id; t.title = "Open this roost"; t.setAttribute("aria-selected", String(r.id === act)); t.tabIndex = r.id === act ? 0 : -1;
        // each tab can be closed (owner 21:48): the first click asks, a second within three seconds closes it
        const w = h("span", "tabw" + (r.id === act ? " on" : "")); w.dataset.id = r.id; w.appendChild(t);
        const x = h("button", "tx", ic("x")); x.type = "button"; x.dataset.id = r.id; x.setAttribute("aria-label", `Close Roost ${r.n}`); x.title = "Close this Roost"; w.appendChild(x); rail.appendChild(w); });
      if (!rail.querySelector('[tabindex="0"]') && rail.firstChild) rail.firstChild.tabIndex = 0;
      syncAdd();
    }
    rail.addEventListener("click", e => {
      const x = e.target.closest(".tx"); if (x) { if (building || running) return; const w = x.closest(".tabw");
        if (w.classList.contains("ask")) { closeRoostUI(x.dataset.id); return; }
        rail.querySelectorAll(".tabw.ask").forEach(o => o.classList.remove("ask")); w.classList.add("ask"); x.setAttribute("aria-label", "Click again to close"); x.title = "Click again to close";
        setTimeout(() => { w.classList.remove("ask"); x.setAttribute("aria-label", "Close this Roost"); x.title = "Close this Roost"; }, 3000); return; }
      const t = e.target.closest(".tab"); if (t && !building && !running) R.activate(t.dataset.id); });
    rail.addEventListener("keydown", e => {
      const tabs = [...rail.querySelectorAll(".tab")], i = tabs.indexOf(document.activeElement); if (i < 0 || !/Arrow(Left|Right)|Home|End/.test(e.key)) return; e.preventDefault();
      const j = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; tabs[j].focus(); if (!running) R.activate(tabs[j].dataset.id);
    });
    ttEmpty();
    const STEPS = ["Reading your goal", "Chasing it", "Listening for predators", "Testing against 2024 data", "Finding a flyway"];
    const skelCard = () => `<article class="pp skel" aria-hidden="true"><span class="art"></span><span class="sk" style="width:58%"></span><span class="sk" style="width:92%"></span><span class="sk" style="width:44%"></span><span class="lis">Listening...</span></article>`;
    function ttLoading(goal) {
      const old = rbodies.querySelector(".empty"); if (old) old.remove();
      live = mkBody(); showBody(live); building = true; renderRail();
      live.innerHTML = `<div class="tt-top" id="tttop"><div><div class="card prog"><div class="hd"><span>${ic("sonar")}Progress</span><span id="stepn">Step 1 of ${STEPS.length}</span></div><ol id="steps">${STEPS.map(s => `<li><span class="st"></span>${s}<span class="tm"></span></li>`).join("")}</ol></div></div>
        <div class="flipx"><section class="plate m fail load" id="failcard" aria-label="The flip"><button type="button" class="xb" aria-label="Close this plan">${ic("x")}</button><div class="rules" aria-hidden="true"></div>
          <div class="tag" aria-hidden="true"><span class="string"></span><span class="label">${esc(String(F.goalText(goal)).replace(/\.$/, ""))}</span><span class="cap">your goal, hung Terry's way</span></div>
          <div class="t"><p class="date">Terry, 31 December 2025</p><p class="disp say">Turning your goal upside down</p></div></section><aside class="ev" id="evcard" hidden></aside></div></div>
        <section class="pred"><header class="guide"><div class="gh"><h2 class="disp"><span class="bw">Predators</span></h2><span class="heard" id="heard"></span><span class="stamps" id="stamps" role="group" aria-label="Filter the predators by verdict"></span></div><p class="ptally" id="ptally" hidden></p></header>
        <div class="board"><div class="pgrid cards" id="pgrid">${skelCard().repeat(5)}</div></div></section><div id="flysec"></div>`;
      requestAnimationFrame(() => $("#tttop").classList.add("work"));
    }
    const stepEl = i => $("#steps").children[i];
    const t0s = [];
    function stepStart(i) { const li = stepEl(i); li.className = "act"; t0s[i] = performance.now(); $("#stepn").textContent = `Step ${i + 1} of ${STEPS.length}`; }
    function stepDone(i, note) { const li = stepEl(i); li.className = "done"; li.querySelector(".st").innerHTML = ic("check"); li.querySelector(".tm").textContent = note || ((performance.now() - (t0s[i] || performance.now())) / 1000).toFixed(1) + " s"; }
    function parsePred(p) {
      const d = p.evidence.detail || "", v = p.evidence.verdict; let num = "", unit = "", m;
      if ((m = d.match(/\((\d+)% vs (\d+)% for the department\)/))) { num = m[1] + "%"; unit = `late vs ${m[2]}% dept`; }
      else if ((m = d.match(/at ([\d.]+)x the city rate/))) { num = m[1] + "x"; unit = "the city report rate"; }
      else if (v === "UNTESTABLE") { num = "Untested"; unit = "no 2024 rows to test"; }
      else { num = p.evidence.requests_2024 ? p.evidence.requests_2024.toLocaleString("en-US") : "n/a"; unit = "requests in 2024"; }
      return { num, unit };
    }
    // the specimen drawing for a predator, by what it is
    function artFor(q) {
      const n = String(q.name || ""), k = q.kind;
      if (k === "silence" || /silence|quiet|reporting/i.test(n)) return "quiet";
      if (k === "shock" || /spike|surge|shock|storm|heat|freez|snow|wind|move-in/i.test(n)) return "spike";
      if (k === "capacity" || /capacity|crew|staff/i.test(n)) return "crew";
      if (/delay|slow|wait|late|close/i.test(n)) return "clock";
      if (k === "miss" || /backlog|queue|pile/i.test(n)) return "car";
      return "spike";
    }
    const RANK = { CONFIRMED: 0, UNTESTABLE: 1, REJECTED: 2 };
    function sortPreds(list) { const key = p => { const x = parseFloat(String(parsePred(p).num).replace(/,/g, "")); return isFinite(x) ? x : 0; }; return list.slice().sort((a, b) => (RANK[a.evidence.verdict] || 0) - (RANK[b.evidence.verdict] || 0) || key(b) - key(a)); }
    function predCard(p, i) {
      const v = p.evidence.verdict, { num, unit } = parsePred(p), q = p.hypothesis, dn = ((Zm().E && Zm().E.depts[q.department] && Zm().E.depts[q.department].name) || q.department || "").trim(), tag = [q.neighborhood, dn].filter(Boolean).join(", ") || String(q.request_type || "");
      const cls = v === "REJECTED" ? "no rej" : v === "UNTESTABLE" ? "maybe" : "ok", tone = v === "REJECTED" ? "slate" : v === "UNTESTABLE" ? "ochre" : "rust";
      const c = h("button", "pp in " + cls, `<span class="stw">${P().stamp(v)}</span><span class="art ${tone}" aria-hidden="true"><svg viewBox="0 0 120 80" width="100%" height="100%"><use href="#r2-p-${artFor(q)}"/></svg></span>
        <span class="where">${esc(tag)}</span><span class="nm" title="${esc(q.name)}">${esc(q.name)}</span>
        <span class="key"><span class="num"><span class="disp${num.length > 6 ? " t" : ""}">${esc(num)}</span></span><span class="u">${esc(unit)}</span></span>${p.evidence.years_text ? `<span class="yrs y-${p.evidence.years}" title="The same test on 2023 and on 2024">${esc(p.evidence.years_text)}</span>` : ""}<span class="ans" aria-live="off"></span>${ic("chev", "chev")}`);
      c.type = "button"; c.dataset.v = v; c.dataset.pl = pad2(i + 2); c.setAttribute("aria-expanded", "false"); c._p = p; return c;
    }
    function answerAll(body, Xr, goal, preds) {
      const ctx = { E: Zm().E, F, X: Xr, goal, flyPlate: pad2(preds.length + 2) }; body._goal = goal;
      body.querySelectorAll(".pp:not(.skel)").forEach(c => { const a = P().answer(c._p, ctx), el = c.querySelector(".ans"); if (!el || !a) return; el.dataset.k = a.kind; el.innerHTML = `${ic(a.icon, "ai t-" + a.tone)}<span><span class="lab">How Terry plans to escape it</span>${a.line}</span>`; el.classList.add("on"); });
      const tt = body.querySelector("#ptally"); if (tt) { const t = P().tallyText(preds, ctx); tt.innerHTML = t; tt.hidden = !t; }
    }
    function tally(list) {
      const n = { CONFIRMED: 0, UNTESTABLE: 0, REJECTED: 0 }; list.forEach(p => n[p.evidence.verdict]++);
      const T = { CONFIRMED: ["c", "check", "confirmed"], UNTESTABLE: ["u", "flask", "untestable"], REJECTED: ["r", "x", "rejected"] };
      $("#stamps").innerHTML = Object.keys(T).filter(k => n[k]).map(k => `<button type="button" class="stamp ${T[k][0]}" data-v="${k}" aria-pressed="false" title="Show only ${T[k][2]}, click again for all">${ic(T[k][1])}${n[k]} ${T[k][2]}</button>`).join("");
    }
    function setFilter(body, v) {
      const grid = body.querySelector(".pgrid"), st = body.querySelector(".stamps"); closeSheet(body);
      const cur = grid.dataset.f || "", next = cur === v ? "" : v; if (next) grid.dataset.f = next; else delete grid.dataset.f;
      st.querySelectorAll(".stamp").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === next)));
      let all = st.querySelector(".all"); if (next && !all) { all = h("button", "all", "Show all"); all.type = "button"; st.appendChild(all); } else if (!next && all) all.remove();
    }
    function closeSheet(body) { const sh = body.querySelector(".sheet"); if (!sh) return; sh._for.setAttribute("aria-expanded", "false"); sh.remove(); }
    function toggleSheet(body, card) {
      const grid = body.querySelector(".pgrid"), open = body.querySelector(".sheet"), was = open && open._for === card; closeSheet(body); if (was) return;
      card.setAttribute("aria-expanded", "true");
      const N = grid.querySelectorAll(".pp:not(.skel)").length;
      const tmp = h("div"); tmp.innerHTML = P().sheet(card._p, { E: Zm().E, F, X: body._X || X, goal: body._goal || GOAL, plate: card.dataset.pl, flyPlate: pad2(N + 2) }); const sh = tmp.firstElementChild; sh._for = card;
      { const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1, cs = [...grid.querySelectorAll(".pp:not(.skel)")], ix = cs.indexOf(card), at = cs[Math.min(cs.length - 1, (Math.floor(ix / cols) + 1) * cols - 1)] || card; at.after(sh); } P().wireSheet(sh);
      { const r = sh.getBoundingClientRect(), dk = document.querySelector("#dock"), dt = dk && dk.offsetHeight ? dk.getBoundingClientRect().top : innerHeight, lim = Math.min(innerHeight - 20, dt - 16);   // clear of the Ping dock (owner 7 Nov)
        if (r.bottom > lim) scrollBy({ top: Math.max(0, Math.min(r.bottom - lim, r.top - 120)), behavior: reduced() ? "auto" : "smooth" }); }
    }
    function failHtml(fl, goal) {
      return { t: `<p class="date">Terry, 31 December 2025</p><p class="sub fnd" aria-live="polite"><span>Finding how it fails</span></p>${fl.history ? "" : `<small>${esc(fl.history_line || "")}</small>`}`, big: "", pct: 0 };
    }
    // the evidence card pinned beside the note: the 2024 figure against the goal, from the flip's own history
    function evidenceHtml(fl, goal) {
      const hs = fl.history, tg = (goal && goal.target) || 0; if (!hs || !hs.n) return "";
      const hm = (fl.history_line || "").match(/^In (.+?), (\d+(?:\.\d+)?)% of (.+?)(?:'s|') /), per = hm ? hm[1] : "2024", pc0 = Math.round(hs.ontime * 100), clear = hs.ontime >= tg;
      const gap = Math.abs(Math.round(tg * hs.n - hs.ontime * hs.n)), who = hm ? hm[3] + " " : "", tp = Math.round(tg * 100);
      return `<div class="k"><span>Evidence</span><span class="yr">${esc(per)}</span></div>
        <div class="big${clear ? " ok" : ""} num"><span data-n="${pc0}">${pc0}</span><small>%</small></div>
        <div class="big-sub">of ${n0(hs.n)} ${esc(who)}requests closed on time</div>
        <div class="gauge" role="img" aria-label="${pc0} percent on time against a ${tp} percent goal"><span class="got" style="width:${Math.min(100, hs.ontime * 100)}%"></span><span class="gtick" style="left:${Math.min(100, tg * 100)}%"><i>goal ${tp}%</i></span></div>
        <div class="gauge-l"><span>0</span><span>100%</span></div>
        <div class="foot">${clear ? `Clear of the goal by <b class="num">${n0(gap)}</b> requests.` : `Short of the goal by <b class="num">${n0(gap)}</b> requests. That gap is what the predators below explain.`}</div>`;
    }
    // the card's second half, written once by F.failLine when the escape has resolved
    function failLineHtml(fc, FLr, Xr, goal) {
      const sub = fc && fc.querySelector(".sub"); if (!sub) return;
      const fl = F.failLine(FLr, Xr, goal);
      const facts = esc(fl.facts).replace(/(reaches )([\d.]+%)/, '$1<b class="w">$2</b>').replace(/(^|[^>\w.])(\d[\d.,]*%)/g, (m, a, b) => a + '<b class="num">' + b + "</b>");
      sub.classList.remove("fnd"); sub.classList.add("tl"); sub.innerHTML = `<span class="tline say">${fl.html}</span><span class="tfacts facts">${facts}</span>`; sub.classList.add("tt-fadein"); countData(sub);
      FLr.card = { line: fl.line, facts: fl.facts, case: fl.case, why: fl.why }; root.__flipNow = FLr.card;
      if (fl.why && fl.why.differs) { const wb = h("button", "why-flip", "Why does this differ from 2023 and 2024?"); wb.type = "button"; wb.addEventListener("click", () => { const P = root.TerryPing; if (P && P.submit) { root.__flipAsk = FLr.card; P.submit("Why does the flip differ from 2023 and 2024?"); } }); sub.appendChild(wb); }
      // the 2024 card beside a safe flip: last year's gap is history, not this plan's forecast (owner 21:05: the two read as a contradiction)
      if (fl.case === "safe") { const ev = $("#evcard"), ft = ev && ev.querySelector(".foot"), hs = FLr && FLr.history;
        if (ft && hs && hs.n && hs.ontime < goal.target) ft.innerHTML = `2024 fell short by <b class="num">${n0(Math.abs(Math.round(goal.target * hs.n - hs.ontime * hs.n)))}</b> requests. The 2025 plan clears the goal in the model, so the predators below are what went wrong last year, not a forecast.`; }
    }
    const n0 = v => Math.round(v).toLocaleString("en-US");
    function countData(root) {
      root.querySelectorAll("[data-n]").forEach(el => { const to = +el.dataset.n, f = el.classList.contains("fs") ? n0 : String; if (reduced()) { el.textContent = f(to); return; }
        el.textContent = f(0); const t0 = performance.now(), step = t => { const u = Math.min(1, (t - t0) / 600); el.textContent = f(Math.round(to * (1 - Math.pow(1 - u, 3)))); if (u < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
    }
    const money = n => (F && F.money ? F.money(Math.round(n)) : "$" + Math.round(n).toLocaleString("en-US"));
    const pct1 = v => (F && F.pct1 ? F.pct1(v) : (Math.round(v * 1000) / 10) + "%");
    const pctG = (v, t) => (F && F.pctVs ? F.pctVs(v, t) : pct1(v));   // never rounds a miss up to the goal (99.96% stays 99.96%, not 100.0%)
    const kfmt = v => { v = Math.abs(v); return v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v); };
    const SKYL = (() => { let s = 7; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; let x = 0, d = "";
      while (x < 1000) { const w = 9 + r() * 22, hh = 7 + r() * 18; d += `M${x.toFixed(1)} 60V${(60 - hh).toFixed(1)}h${w.toFixed(1)}V60z`; x += w + (r() < .3 ? 4 : 0); }
      d += "M590 60V10h22V60zM300 60V20h14l5-9 5 9h6V60zM770 60V26h30V60z";
      return `<svg class="skyl far" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60V38C110 24 210 44 330 32S560 20 700 36S900 28 1000 34V60z"/></svg><svg class="skyl near" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`; })();
    function layoutSteps(wrap) {
      const ol = wrap.querySelector(".steps"); if (!ol) return; const items = [...ol.children].filter(n => n.classList.contains("step")); ol.querySelectorAll(".lead").forEach(n => n.remove());
      if (matchMedia("(max-width: 820px)").matches) { ol.style.height = ""; items.forEach(n => { n.style.left = n.style.top = n.style.width = ""; }); return; }
      const W = ol.clientWidth; if (!W) return; const GAP = 16, lanes = [];
      items.sort((p, q) => +p.dataset.x - +q.dataset.x).forEach(n => {
        const x = +n.dataset.x / 100 * W, w = n.dataset.al === "r" ? 200 : 218; n.style.width = w + "px";
        let l = n.dataset.al === "l" ? x - 22 : n.dataset.al === "r" ? x + 22 - w : x - w / 2; l = Math.max(0, Math.min(W - w, l)); n.style.left = l + "px"; n._x = x;
        let k = 0; while ((lanes[k] || []).some(o => l < o.r + GAP && l + w > o.l - GAP)) k++; (lanes[k] = lanes[k] || []).push({ l, r: l + w, n }); n._k = k;
      });
      let top = 18, end = 0; lanes.forEach(L => { let hmax = 0; L.forEach(o => { o.n.style.top = top + "px"; hmax = Math.max(hmax, o.n.offsetHeight); }); top += hmax + 14; end = top; });
      ol.style.height = Math.max(end, 80) + "px";
      items.forEach(n => { const ld = document.createElement("i"); ld.className = "lead"; ld.style.left = n._x + "px"; ld.style.height = (parseFloat(n.style.top) - 2) + "px"; if (n.classList.contains("on")) ld.classList.add("on"); ld.dataset.ev = n.dataset.ev; ol.appendChild(ld); });
    }
    function flywaySection(Xr, N) {
      const E = Zm().E, sec = $("#flysec"), gl = Xr.goal || GOAL, gm = (gl && gl.months && gl.months.length ? gl.months : [1]).slice().sort((a, b) => a - b), pad = n => String(n).padStart(2, "0");
      const lastDom = m => new Date(Date.UTC(2025, m, 0)).getUTCDate(), wS = E.dayOf(`2025-${pad(gm[0])}-01`), wE = E.dayOf(`2025-${pad(gm[gm.length - 1])}-${pad(lastDom(gm[gm.length - 1]))}`);
      const pick = Xr.beats.escape.filter(b => ["decision", "train", "dusk", "safe"].includes(b.kind)).sort((a, b) => a.day - b.day);
      const seen = new Set(), nodesB = []; for (const b of pick) { if (seen.has(b.kind)) continue; seen.add(b.kind); nodesB.push(b); }
      const ICO = { decision: "hire", train: "train", dusk: "dusk", safe: "crew" }, LAB = { decision: "Sign the crew", train: "Train", dusk: "Last day to act", safe: "On the street" };
      const dPay = Xr.totals.escape.payroll - Xr.totals.stay.payroll, dAvoid = Xr.totals.stay.penalty - Xr.totals.escape.penalty, changed = Object.values(Xr.depts).some(d => d.changed);
      // an unreachable goal says how close the most crews Terry tests get, never shows them as the plan
      const MF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const lims = Xr.limits || [], lim = lims[0], limT = l => l.dusk_passed ? `${l.name}: a crew signed now starts after your window` : l.k ? `${l.name}: even ${l.k} more crews from ${MF[l.from - 1]}, the most Terry tests, reach ${pctG(l.best_window, (gl && gl.target) || 0)}` : `${l.name}: no crew plan gets there`;
      const V = { escaped: ["escaped", "The flyway clears your goal."], already: ["already", "The plan already clears your goal at forecast demand."],
                  partial: ["partial", `The flyway clears ${Object.keys(Xr.depts).length - lims.length} of ${Object.keys(Xr.depts).length} departments. ${lims.map(limT).join("; ")}.`],
                  unreachable: ["unreachable", lim && lim.dusk_passed ? "Dusk has passed: a crew signed now starts after your window." : lim && lim.k ? `No crew plan reaches ${Math.round(((gl && gl.target) || 0) * 100)}%: even ${lim.k} more crews from ${MF[lim.from - 1]} reach only ${pctG(lim.best_window, (gl && gl.target) || 0)}.` : "No crew plan gets there."] }[Xr.verdict] || ["partial", "The flyway helps, but not every department clears the goal."];
      // a city goal holds only when every department does, so the bars and the bill compare the weakest department with the goal
      const multi = Object.keys(Xr.depts).length > 1, wk = Xr.weakest;
      const stay = multi && wk ? wk.stay.window : Xr.totals.stay.window, fly = multi && wk ? wk.escape.window : Xr.totals.escape.window, tgt = (gl && gl.target) || 0, MN = root.TerryPlates.MON3;
      // events on a true dated axis
      let evs = [];
      if (changed) evs = nodesB.map(b => {
        const parts = b.text.split(" · "), body = (parts.length > 1 ? parts.slice(1).join(" ") : b.text).replace(/^Dusk\.\s*/, "").split(/(?<=\.)\s/)[0];
        if (b.kind === "train") { const mi = +E.isoOf(b.day).slice(5, 7), a0 = E.dayOf(`2025-${pad(mi)}-01`), a1 = E.dayOf(`2025-${pad(mi)}-${pad(lastDom(mi))}`); return { k: b.kind, a: a0, b: a1, date: `1 to ${lastDom(mi)} ${MN[mi - 1]}`, body }; }
        return { k: b.kind, a: b.day, b: b.day, date: parts.length > 1 ? parts[0] : "", body };
      });
      else evs = [{ k: "safe", a: wE, b: wE, date: MN[gm[gm.length - 1] - 1] + " " + lastDom(gm[gm.length - 1]), body: (Xr.beats.stay.find(b => b.kind === "note") || {}).text || "No new crews needed." }];
      // the axis: the first month start to the end of the window, laid between 6% and 94% so the marks never touch the edge
      const monStart = d => E.dayOf(`2025-${E.isoOf(d).slice(5, 7)}-01`);
      const dA = changed && evs.length ? monStart(Math.min(...evs.map(e => e.a))) : E.dayOf(`2025-${pad(Math.max(1, gm[0] - 3))}-01`), dB = Math.max(wE, ...evs.map(e => e.b)), R0 = Math.max(1, dB - dA);
      const px = d => 6 + 88 * Math.min(1, Math.max(0, (d - dA) / R0)), f1 = v => (Math.round(v * 10) / 10);
      const duskB = (Xr.beats.escape || []).concat(Xr.beats.stay || []).find(b => b.kind === "dusk"), dp = f1(Math.min(92, Math.max(10, duskB ? px(duskB.day) : px((dA + dB) / 2))));
      const cp = e => f1(px((e.a + e.b) / 2)), ep = evs.length ? cp(evs[evs.length - 1]) : 94;
      // the flight line: key points (x in percent, y in sky pixels), one curve from point to point
      const YK = { decision: 124, dusk: 106, safe: 96 }, pts = [[6, 136]]; evs.forEach(e => { if (YK[e.k]) pts.push([cp(e), YK[e.k]]); });
      if (!changed) pts.push([ep, 96]); pts.sort((p, q) => p[0] - q[0]);
      const yAt = x => { for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const u = (x - pts[i - 1][0]) / Math.max(.01, pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u; } return pts[pts.length - 1][1]; };
      const seg = a => a.slice(1).map((p, i) => { const q = a[i], m = (p[0] - q[0]) * 5; return `C${q[0] * 10 + m} ${q[1]} ${p[0] * 10 - m} ${p[1]} ${p[0] * 10} ${p[1]}`; }).join(" ");
      const di = changed ? pts.findIndex(p => Math.abs(p[0] - dp) < .2 && p[1] === 106) : -1, A1 = di > 0 ? pts.slice(0, di + 1) : pts, A2 = di > 0 && di < pts.length - 1 ? pts.slice(di) : null;
      const lineSvg = `<div class="lineclip"><svg class="line" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true"><path class="a${changed ? "" : " w"}" d="M${A1[0][0] * 10} ${A1[0][1]} ${seg(A1)}" vector-effect="non-scaling-stroke"/>${A2 ? `<path class="b" d="M${A2[0][0] * 10} ${A2[0][1]} ${seg(A2)}" vector-effect="non-scaling-stroke"/>` : ""}</svg></div>`;
      const topPx = y => `calc(${f1(y / 180 * 100)}% - `;
      const lastI = evs.length - 1, trainI = evs.findIndex(e => e.k === "train"), nOwl = Math.min(5, live ? live.querySelectorAll('.pp[data-v="CONFIRMED"]').length : 0);
      const OWL = [[-14, 58], [-10, 32], [-5.5, 52], [-18, 30], [-1.5, 36]];
      const owls = OWL.slice(0, nOwl).map(o => `<svg class="owl" data-ev="${lastI}" style="left:${f1(Math.max(dp + 4, ep + o[0]))}%;top:${o[1]}px" aria-hidden="true"><use href="#r2-owl"/></svg>`).join("");
      const tx = trainI >= 0 ? cp(evs[trainI]) : changed ? f1((dp + ep) / 2) : f1(ep - 6), terry = `<svg class="terry"${trainI >= 0 ? ` data-ev="${trainI}"` : ""} style="left:${tx}%;top:${topPx(yAt(tx))}50px)" aria-hidden="true"><use href="#r2-terry"/></svg>`;
      const marks = evs.filter(e => e.k !== "train").map(e => { const i = evs.indexOf(e), x = cp(e); return `<div class="mark ${e.k === "dusk" ? "dusk" : e.k === "safe" ? "fin" : ""}" data-ev="${i}" style="left:${x}%;top:${topPx(YK[e.k] || 100)}22px)">${ic(ICO[e.k])}</div>`; }).join("");
      let ticks = "", mlab = "";
      for (let m = 1; m <= 12; m++) {
        const s0 = E.dayOf(`2025-${pad(m)}-01`), s1 = m === 12 ? s0 + 31 : E.dayOf(`2025-${pad(m + 1)}-01`);
        if (s1 <= dA || s0 >= dB) continue; const l0 = Math.max(s0, dA), l1 = Math.min(s1, dB);
        if (s0 > dA) ticks += `<i style="left:${f1(px(s0))}%"></i>`; else ticks += `<i style="left:6%"></i>`;
        mlab += `<span style="left:${f1(px((l0 + l1) / 2))}%">${MN[m - 1]}</span>`;
      }
      const stepsHtml = evs.map((e, i) => {
        const lab = e.k === "safe" && !changed ? (Xr.verdict === "already" ? "No crew change needed." : "No crew plan gets there.") : LAB[e.k];
        const body = e.k === "safe" && !changed && Xr.verdict === "already" ? `The plan clears ${Math.round(tgt * 100)}% at forecast and at +60% demand.` : (e.body && (changed || Xr.verdict !== "already") ? e.body : "");
        return `<li class="step ${e.k}" data-ev="${i}" data-x="${cp(e)}" data-al="${e.k === "dusk" ? "l" : e.k === "safe" && changed ? "r" : "c"}"><div class="d">${esc(e.date)}</div><div class="t">${esc(lab)}</div>${body ? `<div class="s">${esc(body)}</div>` : ""}</li>`;
      }).join("");
      const hires = Object.values(Xr.depts).reduce((n, d) => n + ((d.escape && d.escape.added) || []).filter(a => a.action === "hire").reduce((t, a) => t + (a.crews || 0), 0), 0);
      const mA = +E.isoOf(dA).slice(5, 7), mB = +E.isoOf(dB).slice(5, 7), subT = `${MN[mA - 1]} to ${MN[mB - 1]} 2025${changed && hires ? `, ${hires === 1 ? "one crew" : hires + " crews"}` : ""}`;
      const skyLabel = `Terry's flight, ${evs.map(e => `${e.date}, ${e.k === "safe" && !changed ? "no crew change needed" : LAB[e.k].toLowerCase()}`).join("; ")}.`;
      const skyBg = `background-image: linear-gradient(90deg, var(--sky-dawn) 0, var(--sky-pale) ${f1(Math.max(1, dp - 24))}%, var(--sky-gold) ${dp}%, var(--sky-rose) ${f1(Math.min(100, dp + 9))}%, var(--sky-harbour) ${f1(Math.min(100, dp + 26))}%, var(--sky-night) ${f1(Math.min(100, dp + 44))}%)`;
      const mw = esc(monthWord(gl)), net = dAvoid >= dPay && dPay > 0 ? `Pays for itself: ${kfmt(dAvoid)} avoided against ${kfmt(dPay)}.` : dPay <= 0 ? "No new payroll." : `Net ${kfmt(dPay - dAvoid)} for ${pct1(fly)} on time in ${mw}.`;
      const track = (c, v) => `<i style="background:${c}" data-w="${Math.round(v * 1000) / 10}"></i>`;
      // the verdict card and the bill
      const SEAL = { escaped: ["Escaped", "ok", "check"], already: ["Already clear", "ok", "check"], partial: ["Partly", "maybe", "flask"], unreachable: ["No exit left", "bad", "x"] }[V[0]] || ["Partly", "maybe", "flask"];
      const tg0 = Math.round(tgt * 100), crewsT = hires === 1 ? "one signed crew" : hires + " signed crews";
      // why this start month: the latest start that also works, and what it costs more (from the search, not a rule of thumb)
      const whyT = Object.entries(Xr.depts).filter(([, x]) => x.changed && x.how && x.how.alt).map(([d, x]) => { const a = x.how.alt, who = multi ? `${deptName(d)}: ` : "";
        if (a.latest) return ` ${who}No later start Terry tests reaches the goal (up to ${a.k_max} more crews).`;
        if (!(a.extra_cost > 1)) return "";
        const mech = a.kind === "release_after" ? `, letting them go after ${MF[a.until - 1]},` : a.kind === "seasonal" ? " with seasonal crews" : x.how.kind === "release_after" ? ", kept to December," : "";
        return ` ${who}Starting in ${MF[a.m - 1]}${mech} instead also works, but ${a.k > x.how.k ? `needs ${a.k} crews and ` : ""}costs ${kfmt(a.extra_cost)} more over the year, counting late costs.`; }).join("");
      const shockT = Xr.shocks && Xr.shocks.length ? ` It flies through ${Xr.shocks.map(s => s.replace(/^A /, "a ")).join(" and ")}, which Terry heard among the predators.` : "";
      const nProc = Object.values(Xr.preds || {}).filter(o => o.kind === "process").length;
      const procT = nProc ? ` ${nProc === 1 ? "One predator looks like a process problem" : nProc + " predators look like process problems"} that crews alone are unlikely to fix; ${nProc === 1 ? "its card says" : "their cards say"} why.` : "";
      const how = (Xr.hot_pct ? `Tested on 2024 requests in a year <b>${Xr.hot_pct}% busier</b>, with the same crew model the chart uses.` : "Tested on 2024 requests, with the same crew model the chart uses.") + shockT + procT + (Xr.verdict === "escaped" && stay < tgt && hires ? ` The original plan falls under ${tg0}%${multi && wk ? ` in ${esc(wk.stay.name)}` : ""}; ${crewsT} ${hires === 1 ? "lifts" : "lift"} it over.${whyT}` : "");
      const trainEv = evs.find(e => e.k === "train"), trainM = trainEv ? +E.isoOf(trainEv.a).slice(5, 7) : mA, deptsN = Object.keys(Xr.depts), dn = deptsN.length === 1 ? deptName(deptsN[0]) : deptsN.length + " departments";
      // crews kept to December are paid to December: the bill names the months it pays for, not only the goal's window
      const keepAll = Object.values(Xr.depts).some(x => x.changed && x.how && x.how.kind === "keep"), relEnd = Math.max(0, ...Object.values(Xr.depts).map(x => (x.changed && x.how && x.how.until) || 0));
      const payEnd = keepAll ? 12 : relEnd || mB;
      const streetM = []; for (let m = trainM + 1; m <= payEnd; m++) streetM.push(MN[m - 1]);
      const streetT = streetM.length > 2 ? streetM[0] + " to " + streetM[streetM.length - 1] : streetM.join(" and "), payNote = trainEv ? `training in ${MN[trainM - 1]}${streetT ? ", on the street " + streetT : ""}` : `from ${MN[trainM - 1]}`;
      const netV = dPay - dAvoid, onT = mw === "the year" ? "over the year" : "in " + mw;
      const span = (a, b) => (a === b ? `${MN[a - 1]} 2025` : `${MN[a - 1]} to ${MN[b - 1]} 2025`);   // one month reads "Jan 2025", not "Jan to Jan" (owner 7 Nov)
      const billHtml = dPay > 0 ? `<div class="h"><b>Terry's bill</b>${esc(dn)}, ${span(trainM, payEnd)}</div>
          <div class="ln"><span>Payroll, ${hires === 1 ? "1 crew" : (hires || "new") + " crews"}<small>${esc(payNote)}</small></span><span class="dots"></span><span class="v pay num" id="cpay">+$0</span></div>
          <div class="ln"><span>Overdue cost avoided<small>requests that no longer run late</small></span><span class="dots"></span><span class="v sav num" id="cavoid">$0</span></div>
          <div class="tot"><span class="k">${netV < 0 ? "Saved" : "Net"}</span><span class="v num">${kfmt(netV)}</span></div><div class="for">for <b>${pct1(fly)}</b> on time ${onT}</div>`
        : `<div class="h"><b>Terry's bill</b>${esc(dn)}, ${span(mA, mB)}</div><div class="ln none"><span>${Xr.verdict === "already" || fly >= tgt ? "No crew added." : "No crew can start in time."}</span><span class="dots"></span><span class="v num">$0</span></div><span id="cpay" hidden></span><span id="cavoid" hidden></span>${Xr.verdict === "already" || fly >= tgt ? `<div class="for">for <b>${tg0}%</b> or better at forecast</div>` : `<div class="for">the plan stays at <b>${pct1(fly)}</b>, under your ${tg0}%</div>`}`;   // owner 7 Nov: an honest no never claims the goal
      const endHtml = `<div class="end verd" id="verdplate"><section class="verdict" aria-label="Verdict"><div class="sealbox"><div class="seal ${SEAL[1]}" role="img" aria-label="${SEAL[0]}">${ic(SEAL[2])}<span>${SEAL[0]}</span></div><div class="ribbon" aria-hidden="true"></div></div>
        <div class="vtx"><h2 class="disp">${esc(V[1])}</h2><p class="how">${how}</p></div>
        <div class="perches" style="--g:${Math.min(100, tgt * 100)}%" role="img" aria-label="Original plan ${pct1(stay)}, flyway ${pct1(fly)}, goal ${tg0} percent">
          <div class="perch orig"><span class="l">Original plan${multi && wk ? `<small>weakest: ${esc(wk.stay.name)}</small>` : ""}</span><span class="bar" data-goal="goal ${tg0}%"><i style="background:var(--planned)" data-w="${Math.round(stay * 1000) / 10}"></i></span><span class="v num">${pctG(stay, tgt)}</span></div>
          <div class="perch fly"><span class="l">Flyway${multi && wk ? `<small>weakest: ${esc(wk.escape.name)}</small>` : ""}</span><span class="bar"><i style="background:${fly >= tgt ? "var(--work)" : "var(--short)"}" data-w="${Math.round(fly * 1000) / 10}"></i></span><span class="v num">${pctG(fly, tgt)}</span></div></div>
        <nav class="vnext" aria-label="Next steps"><button type="button" data-n="ping">${ic("sonar")}<span>Ping Terry a what-if</span></button><button type="button" data-n="cmp">${ic("arrow")}<span>Compare with the original plan</span></button><button type="button" data-n="hear">${ic("search")}<span>Hear what Boston is saying</span></button></nav></section>
        <aside class="bill" aria-label="Terry's bill">${billHtml}</aside></div>`;
      sec.innerHTML = `<section class="flyp" aria-label="The Flyway"><header class="fw-h"><h2 class="disp"><span class="bw">Flyway</span></h2><span class="sub">${esc(subT)}</span>${changed ? `<button type="button" class="btn" data-a="orig"><i class="dot-og"></i>${ic("arrow", "", "transform:scaleX(-1)")}<span>Original plan</span></button>` : ""}</header>
        <div class="fw"><div class="sky" role="img" aria-label="${esc(skyLabel)}" style="${skyBg}"><div class="sunglow" style="left:${dp}%"></div><div class="stars" style="--from:${f1(Math.min(96, dp + 14))}%"></div><div class="sun" style="left:${dp}%"></div>${SKYL}${lineSvg}${owls}${terry}${marks}</div>
        <div class="months" aria-hidden="true">${ticks}${mlab}</div><ol class="steps">${stepsHtml}</ol></div></section>
        ${endHtml}`;
      const fwEl = sec.querySelector(".fw"); layoutSteps(fwEl); if (window.ResizeObserver) { const ro = new ResizeObserver(() => layoutSteps(fwEl)); ro.observe(fwEl); }
      sec.classList.add("tt-fadein");
      return { nodes: evs.map((e, i) => [...sec.querySelectorAll(`.flyp [data-ev="${i}"]`)]), tl: sec.querySelector(".flyp .lineclip"), dPay, dAvoid, sec, fw: fwEl };
    }
    async function playFlyway(fw) {
      const nodes = fw.nodes; if (fw.tl) { await raf(); fw.tl.classList.add("go"); }
      const on = g => { g.forEach(n => n.classList.add("on")); if (fw.fw) fw.fw.querySelectorAll(".lead").forEach(l => { if (g.some(n => n.dataset && n.dataset.ev === l.dataset.ev)) l.classList.add("on"); }); };
      if (SK.on || reduced()) nodes.forEach(on); else for (let i = 0; i < nodes.length; i++) { await wait(i ? 650 : 250); on(nodes[i]); }
      { const c1 = $("#cpay"), c2 = $("#cavoid"); if (c1 && !c1.hidden) countUp(c1, Math.max(0, fw.dPay), v => "+" + kfmt(v), 600); if (c2 && !c2.hidden) countUp(c2, Math.max(0, fw.dAvoid), v => (v < 1 ? "$0" : "\u2212" + kfmt(v)), 600); }
      fw.sec.querySelectorAll(".perch [data-w]").forEach(n => { n.style.width = n.dataset.w + "%"; });
      await wait(1200);
    }
    // a finished Roost keeps its own DOM; its ids move to data-id so the next chase can build a new one
    function sealBody(r) {
      if (!live) return; live.dataset.r = r.id; live.dataset.n = r.n; live._X = r.escape; live._r = r;
      live.querySelectorAll("[id]").forEach(e => { e.dataset.id = e.id; e.removeAttribute("id"); }); const f = live.querySelector(".fail"); if (f) f.classList.remove("load"); live = null; building = false; renderRail();
    }
    // clicks inside any Roost: predator plates, verdict stamps, the X, the confirm, the flyway button
    rbodies.addEventListener("click", e => {
      const body = e.target.closest(".rbody"); if (!body) return;
      const st = e.target.closest(".stamps .stamp"); if (st) { setFilter(body, st.dataset.v); return; }
      if (e.target.closest(".stamps .all")) { const f = body.querySelector(".pgrid").dataset.f; if (f) setFilter(body, f); return; }
      const xs = e.target.closest(".sheet .xb"); if (xs) { const c = body.querySelector(".sheet")._for; closeSheet(body); c.focus(); return; }
      const pp = e.target.closest(".pp:not(.skel)"); if (pp) { toggleSheet(body, pp); return; }
      const vn = e.target.closest(".vnext button"); if (vn) { const rr = R && R.get(body.dataset.r || activeId());
        if (vn.dataset.n === "ping") { try { root.TerryPing && root.TerryPing.focus(); } catch (er) {} }
        else if (vn.dataset.n === "hear") { try { root.TerryShell && root.TerryShell.open("right"); } catch (er) {} }
        else if (rr) { scrollTo({ top: Math.max(0, rel(screen).y - 20), behavior: reduced() ? "auto" : "smooth" }); R.openCompare({ roostId: rr.id, view: "stay" }, { roostId: rr.id, view: "flyway" }); }
        e.stopPropagation(); return; }
      const xb = e.target.closest(".fail .xb"); if (xb) { const f = body.querySelector(".fail"); if (running || !body.dataset.r) return;
        let c = f.querySelector(".cfm"); if (!c) { c = h("div", "cfm", `<span>Close Roost ${body.dataset.n} and its plan?</span><button type="button" class="go" data-a="close">Close it</button><button type="button" data-a="keep">Keep it</button>`); c.setAttribute("role", "group"); f.appendChild(c); }
        f.classList.add("asking"); c.querySelector(".go").focus(); return; }
      const a = e.target.closest(".cfm button"); if (a) { const f = body.querySelector(".fail"); if (a.dataset.a === "keep") { f.classList.remove("asking"); f.querySelector(".xb").focus(); } else closeRoostUI(body.dataset.r); return; }
      if (e.target.closest('.flyp [data-a="orig"]')) { const r = R.get(body.dataset.r); if (r) { R.setView(r.id, r.view === "stay" ? "flyway" : "stay"); const y = rel(screen).y - 20; scrollTo({ top: Math.max(0, y), behavior: reduced() ? "auto" : "smooth" }); } }
    });
    rbodies.addEventListener("keydown", e => {
      if (e.key !== "Escape") return; const body = e.target.closest(".rbody"); if (!body) return;
      const f = body.querySelector(".fail.asking"); if (f) { f.classList.remove("asking"); f.querySelector(".xb").focus(); e.stopPropagation(); return; }
      const sh = body.querySelector(".sheet"); if (sh) { const c = sh._for; closeSheet(body); c.focus(); e.stopPropagation(); }
    });

    // ------------------------------------------------------------ the chase: glow, shrink, carry, drop
    const CARRY_DY = 64, mix = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, w: a.w + (b.w - a.w) * u, h: a.h + (b.h - a.h) * u });
    const setRect = (c, q) => { c.style.left = q.x + "px"; c.style.top = q.y + "px"; c.style.width = q.w + "px"; c.style.height = q.h + "px"; };
    // carryCard: Terry carries the small card in his feet along a path. His hover eases toward home at rate 2 per second,
    // so the card follows the same easing and always sits at his feet, whatever the frame rate.
    async function carryCard(card, from, to, ms) {
      const feet = () => { if (bat.anchor) { const a = bat.anchor("feet"); if (a && isFinite(a.x) && isFinite(a.y)) return a; } return null; };
      const grip = (fx, fy) => setRect(card, { x: fx - 28, y: fy + 2, w: 56, h: 56 });   // the card's top edge sits at his claws
      if (SK.on || reduced()) { bat.setHome(to.x, to.y); pos = to; grip(to.x, to.y + CARRY_DY); return; }
      let sx = from.x, sy = from.y, last = performance.now(); const t0 = last, d = ms / sp();
      await new Promise(res => { (function f(now) {
        if (SK.on) return res();
        const u = Math.min(1, (now - t0) / d), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, dt = Math.min(.05, (now - last) / 1000); last = now;
        const tx = from.x + (to.x - from.x) * e, ty = from.y + (to.y - from.y) * e - 40 * Math.sin(Math.PI * u);
        bat.setHome(tx, ty); const k = 1 - Math.exp(-dt * 2); sx += (tx - sx) * k; sy += (ty - sy) * k;
        const a = feet(); if (a) grip(a.x, a.y); else grip(sx, sy + CARRY_DY);   // every frame, from his real claw point
        if (u < 1 || (Math.hypot(sx - to.x, sy - to.y) > 14 && now - t0 < d + 5000 * (root.__terrySlow || 1))) requestAnimationFrame(f); else res();
      })(t0); });
      pos = to;
    }
    // Chase it feeds the machine (owner 08:24): the card drops into the brass slot on the machine's top beside the lens, the board
    // flaps to "CHASING · <goal>", the beam flickers once, and the failure card prints out of the feed slot on the machine's lower edge
    // and unfolds into The Flip Side. Reduced motion: the card appears in the slot, the board flips, the failure card fades in.
    const slotsOf = () => { const A = root.TerryAlmanac, s = A && A.slots && A.slots(); if (!s || !s.top || !s.top.w) return null; const b = page.getBoundingClientRect();
      const o = q => ({ x: q.x - b.left, y: q.y - b.top, w: q.w, h: q.h }); return { top: o(s.top), feed: o(s.feed) }; };
    // the bottom edge of the machine, beside the feed slot (never in front of it: the failure card prints out there)
    const machinePt = () => { const A = root.TerryAlmanac && root.TerryAlmanac.el, S = slotsOf(); if (!A || !A.offsetHeight) return barPt(); const r = rel(A), fx = S ? S.feed.x : r.x + r.w / 2;
      const x = fx - 110 > r.x + 60 ? fx - 110 : (S ? S.feed.x + S.feed.w + 110 : r.x + r.w / 2); return { x, y: r.y + r.h - 3 }; };
    async function slotCard(card, goal) {
      const S = slotsOf(), A = root.TerryAlmanac; if (!S) return false;
      const lip = S.top.y + 3, cx = S.top.x + S.top.w / 2;   // the mouth of the slot
      const a = { x: parseFloat(card.style.left), y: parseFloat(card.style.top), w: 56, h: 56 }, over = { x: cx - 26, y: lip - 52, w: 52, h: 52 }, down = { x: cx - 26, y: lip + 2, w: 52, h: 52 };
      card.classList.add("slotting");
      await tween(380, u => setRect(card, mix(a, over, u * u)));
      await tween(420, u => { const q = mix(over, down, u * u); setRect(card, q); card.style.clipPath = `inset(0 0 ${Math.max(0, q.y + q.h - lip).toFixed(1)}px 0)`; });
      card.remove();
      if (A && A.chasing) { A.chasing(F.goalText(goal)); A.flicker && A.flicker(); }   // the board: READING · <goal>
      return true;
    }
    // the Almanac narrates the chase step by step (owner 08:46); it resumes its normal narration when the chart draws (goalView)
    const almStep = (st, num, unit) => { const A = root.TerryAlmanac; if (!A || !A.chaseStep) return; if (typeof st === "object") A.chaseStep(st.text, st.num, st.unit); else A.chaseStep(st, num, unit); };
    function lastYear(FLr, goal) {   // the failure card's facts: last year's on time against the goal (met, short, or no record)
      const h = FLr && FLr.history, tg = Math.round(goal.target * 100);
      if (!h || !h.n) return { text: `LAST YEAR \u00b7 no requests on record; goal ${tg}%`, num: "", unit: "" };
      const x = Math.round(h.ontime * 1000) / 10, met = h.ontime >= goal.target;
      return { text: `LAST YEAR \u00b7 ${x}% on time; goal ${tg}%${met ? ", met" : ", short"}`, num: String(Math.round(x)), unit: "ON TIME" };
    }
    // the failure card feeds out of the lower slot, then unfolds into The Flip Side's failure card
    async function printFail(showFail) {
      const S = slotsOf(), f = $("#failcard"), fr2 = f ? rel(f) : null; if (!S || !fr2) { showFail(); return; }
      const W = Math.min(116, S.feed.w - 16), mouth = S.feed.y + 5, x = S.feed.x + (S.feed.w - W) / 2;
      const card = h("div", "chasecard fail printing", `<svg class="i cc-i" aria-hidden="true"><use href="#i-light"/></svg>`); page.appendChild(card);
      const out = { x, y: mouth, w: W, h: 64 };
      await tween(620, u => setRect(card, { x, y: mouth, w: W, h: Math.max(1, 64 * (1 - Math.pow(1 - u, 2))) }));   // a short feed out, slowing as it clears the slot
      await wait(220);
      card.classList.remove("printing"); const gl = glideY(() => rel(f).y - 150, 1000);   // the camera goes with the print to the flip (owner 7 Nov)
      await tween(700, u => setRect(card, mix(out, fr2, u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2))); await gl;
      showFail(); await wait(200); card.remove();
    }
    // ferry: Terry fetches a card from a page point (the Ping dock) and carries it to a landing rectangle (a day column on the screen).
    // The same carry as the chase: release from the perch, fly down, grip at the claws every frame, a short fall, then home.
    // Returns false and does nothing when the projector is busy, motion is reduced, the rig is not 3D, or the point is off the page;
    // the caller then shows the landed ticket without a flight. getLand() is awaited after the pickup, so the screen can zoom meanwhile.
    let ferrying = false;
    async function ferry(card, from, getLand) {
      const St = root.TerryState || {};
      if (running || introRunning || ferrying || St.busy || !is3d || reduced() || (Zm() && Zm().planRunning) || !bat || bat === NOBAT) return false;
      if (!from || !isFinite(from.x) || !isFinite(from.y) || from.y < 0) return false;
      ferrying = true; const h0 = tlayer.style.height;
      try {
        const need = Math.ceil(from.y + 120); if (need > tlayer.offsetHeight) tlayer.style.height = need + "px";   // the 3D layer reaches the dock for the flight
        const above = { x: from.x, y: from.y - CARRY_DY };
        if (bat.mode() === "hang") await release(above.x, above.y); else await moveTo(above.x, above.y, 1200);
        await idle(); pos = above; bat.setHome(above.x, above.y);
        // he picks the card up at the dock: wait until his claws are over it (bounded, so a slow GPU never holds the page)
        const feet = () => (bat.anchor ? bat.anchor("feet") : null), t0 = performance.now(), cap = 3200 * (root.__terrySlow || 1);
        while (performance.now() - t0 < cap) { const a = feet(); if (!a || !isFinite(a.x) || Math.hypot(a.x - from.x, a.y + 30 - from.y) < 60) break; await wait(60); }
        const grip = () => { const a = bat.anchor ? bat.anchor("feet") : null; if (a && isFinite(a.x) && isFinite(a.y)) setRect(card, { x: a.x - 28, y: a.y + 2, w: 56, h: 56 }); };
        grip(); card.classList.add("sm");
        let land = null; try { land = await getLand(); } catch (e) { land = null; }
        if (!land) { card.remove(); toHome(); return false; }
        const to = { x: land.x + land.w / 2, y: land.y - 40 };
        await carryCard(card, above, to, 1600);
        // the fall: from the claws to the top of the landing rectangle, one squash, then the stub takes over
        const a = { x: parseFloat(card.style.left), y: parseFloat(card.style.top), w: 56, h: 56 }, down = { x: land.x + land.w / 2 - 28, y: land.y, w: 56, h: 56 };
        await tween(460, u => setRect(card, { x: a.x + (down.x - a.x) * u, y: a.y + (down.y - a.y) * u * u, w: 56, h: 56 }));
        if (!reduced()) { try { card.animate([{ transform: "scale(1.16,.8)" }, { transform: "scale(.97,1.05)" }, { transform: "none" }], { duration: 300, easing: "ease-out" }); } catch (e) {} await wait(260); }
        toHome(); return true;
      } catch (e) { console.warn("ferry", e && e.message); try { toHome(); } catch (x) {} return false; }
      finally { ferrying = false; setTimeout(() => { if (!ferrying) tlayer.style.height = h0; }, 2600); }
    }

    // chase: a roll up, b glow and echo, c shrink to a card, d carry it to the machine's slot, e the board flaps, the failure card prints out
    async function chase(goal) {
      fix(false);   // a tour that was still on (the viewer clicked Chase it at its last stop) hands Terry back to the page layer first (owner 7 Nov)
      const fast = () => SK.on || reduced(), fcEl = () => $("#failcard"), fc0 = fcEl(); if (fc0) { fc0.style.opacity = "0"; fc0.style.transition = "opacity .35s ease"; }
      const showFail = () => { const f = fcEl(); if (f) f.style.opacity = "1"; };
      goalin.value = F.goalText(goal);   // the glow shows the whole goal, never the last follow-up answer
      if (!fast() && bat.mode() === "hang") { const hp = homePt(); await release(hp.x, hp.y); }   // he leaves his perch to take the new goal
      const fr = rel(goalform), rolling = roll(true);
      if (!fast()) {
        if (scrollY > 40) glideY(() => 0, 500);
        goalform.classList.add("echoing", "taking"); bat.echo && bat.echo();
        for (let i = 0; i < 3 && !fast(); i++) { ping(fr.x + fr.w / 2, fr.y + fr.h / 2, 760, 170, 1500); await wait(380); }
        await wait(500);
      }
      goalform.classList.remove("echoing", "taking"); hero.classList.add("working");
      let card = null;
      if (!fast()) {
        card = h("div", "chasecard", `<span class="cc-t"></span><svg class="i cc-i" aria-hidden="true"><use href="#i-light"/></svg>`); card.firstChild.textContent = F.goalText(goal);
        setRect(card, fr); page.appendChild(card); goalform.style.visibility = "hidden"; await raf(); card.classList.add("sm");
        const sq = { x: fr.x + fr.w - 96, y: fr.y + (fr.h - 56) / 2, w: 56, h: 56 };
        await tween(750, u => setRect(card, mix(fr, sq, u)));
        await rolling; const above = { x: sq.x + 28, y: sq.y + 28 - CARRY_DY };
        bat.setHome(above.x, above.y); pos = above; await wait(1500);                 // he swoops in above the card and grabs it
        if (fast()) { card.remove(); card = null; }
      } else goalform.style.visibility = "hidden";
      await rolling; const b = barPt(), S0 = slotsOf(), alm = root.TerryAlmanac && root.TerryAlmanac.el;
      if (!card) hero.classList.add("carried");
      if (!S0) {   // no machine on the page (it builds once the Terrytory is there): drop at the bar and fade the failure card in
        if (card) card.remove(); hangFollow = false; await hang(b.x, b.y); showFail(); goalform.style.visibility = ""; goalform.hidden = false; return;
      }
      if (card) {
        const h0 = tlayer.style.height, need = Math.ceil(S0.feed.y + 140); if (need > tlayer.offsetHeight) tlayer.style.height = need + "px";   // the 3D layer reaches the machine for the flight
        // the camera rides with the card from the goal box down to the Almanac, never ahead of it (owner 7 Nov)
        const almY = () => { const r = alm ? rel(alm) : { y: S0.top.y, h: 200 }; return r.y + r.h / 2 - innerHeight * 0.5; };
        const stopCam = follow(() => card && card.isConnected ? Math.min(almY(), parseFloat(card.style.top) + 28 - innerHeight * 0.4) : almY());
        hero.classList.add("carried");
        const sl = slotsOf() || S0; await carryCard(card, pos, { x: sl.top.x + sl.top.w / 2, y: sl.top.y - 62 - CARRY_DY }, 1800);
        // he lets go over the slot and watches the card go in; then he drops away slowly, down beside the machine, and only at the
        // end turns over to hang from its bottom edge (owner 21:48: a drop, then a gradual hang, never a dive)
        hangFollow = false; const mp = machinePt();
        { const tl = tlayer.offsetHeight, need2 = Math.ceil(mp.y + 220); if (need2 > tl) tlayer.style.height = need2 + "px"; }   // he stays inside the 3D layer the whole way
        await slotCard(card, goal);
        if (!fast()) { const p0 = { x: pos.x, y: pos.y }, p1 = { x: mp.x, y: mp.y - 64 }; pos = p1;
          await tween(1700, e => { bat.setHome(p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e); });
          await wait(350); }
        await hang(mp.x, mp.y); stopCam();
        tallUntilHome = h0;   // the layer keeps its height while he hangs down there; it is put back when he flies home
      } else {
        // reduced motion or skip: the card sits in the slot, the board flips, the failure card fades in
        const sc = h("div", "chasecard sm slotted", `<span class="cc-t"></span><svg class="i cc-i" aria-hidden="true"><use href="#i-light"/></svg>`);
        const cx = S0.top.x + S0.top.w / 2, lip = S0.top.y + 3; setRect(sc, { x: cx - 26, y: lip - 26, w: 52, h: 52 }); sc.style.clipPath = "inset(0 0 26px 0)"; page.appendChild(sc);
        const A = root.TerryAlmanac; if (A && A.chasing) A.chasing(F.goalText(goal));
        setTimeout(() => sc.remove(), 1400);
        hangFollow = false; { const mp = machinePt(); await hang(mp.x, mp.y); }
      }
      goalform.style.visibility = ""; goalform.hidden = false;
    }

    // ------------------------------------------------------------ the flip: loading, then the Terrytory with the real numbers
    async function runGoal(goal) {
      running = true; bus("proj:busy", { reason: "chase" }); ringsShow(false); GOAL = goal; SK.on = false; X = FL = null; lockBox(true); GVspec = null;
      jumped = answered = false; prog = new Set(["goal"]); btnSkip();
      if (instantPref()) jump(true);   // skipped before in this visit: straight to the answer
      const G = root.TerryGuide; GM = G ? G.chaseMode() : "none"; gone = false; gS = null; flyOffP = null;
      const z = Zm(), text = F.goalText(goal); let failed = null;
      // owner 7 Nov (sync): he says what he is doing as he takes the card, not 16 s later
      if (GM === "full" && !SK.on && G && G.say) G.say(`Chasing your goal: ${text.replace(/\.$/, "")}. Watch me carry it down to the Almanac, the machine under the screen, and flip it to see how it could fail.${thenText ? ` After the chase I will play your what-if: ${thenText.replace(/\.$/, "")}.` : ""}`, { q: "What is happening in the chase?" });
      const flipP = F.flip(goal).then(r => (FL = r), e => (failed = e));
      const escP = flipP.then(() => (FL ? F.escape(goal, { predators: FL.predators }) : null)).then(r => (X = r), e => (failed = failed || e));
      workhead.querySelector(".disp").textContent = text; hero.classList.add("chasing"); $("#live").textContent = "Terry is chasing your goal.";   // the header fades in at the click (owner 21:48)
      endGoalView(true); ttLoading(goal); TT.classList.add("busy");
      await chase(goal);
      // the guided chase (owner 12:25): from here Terry flies on the viewport layer, the page dims around what he presents
      const guided = GM === "full" && !SK.on && !!G;   // the short (second) chase is plain: no dimming without words
      if (guided) { fix(true); gS = G.session("chase", { onSkip: skipAll, onInterrupt: backToBar }); }   // (no fold: his opening line is already in the dock)
      const glive = () => guided && gS && gS.live();
      const tell = (line, wait) => { if (GM !== "full" || !glive() || !G.say) return Promise.resolve(); const p = G.say(line, { q: "What is happening in the chase?" }); return wait ? p : Promise.resolve(); };
      const deptName = () => { const z = Zm(), i = z && z.info; return goal.scope === "CITY" ? "the city" : (i && i[goal.scope] && i[goal.scope].name) || "this department"; };
      const b = guided ? { ...pos } : barPt(); hangFollow = !guided; await wait(300);
      // 1 and 2: read the goal, flip it
      const secs = () => TT.querySelector("#steps");
      let flipPrinted = false;
      if (glive()) { { const so = document.querySelector(".bud-socket"); G.spot([root.TerryAlmanac && root.TerryAlmanac.el, so && so.parentElement].filter(Boolean)); }
        const tl = tell("The Almanac prints my plan line by line, and BUDGETerry, the battery beside it, shows what the plan costs.", true);
        await wait(700); almStep("FLIPPING \u00b7 How could this fail?"); flipPrinted = true;   // it prints as he says so (owner 7 Nov)
        await tl; await gS.wait(1400); }
      stepStart(0); await wait(500); stepDone(0); stepStart(1); ping(b.x, b.y + 4, 900, 520, 1600); if (!flipPrinted) almStep("FLIPPING \u00b7 How could this fail?");
      await Promise.all([flipP, wait(1400)]);
      if (failed || !FL) return abortGoal();
      almStep(lastYear(FL, goal)); await printFail(() => { const f = $("#failcard"); if (f) f.style.opacity = "1"; });
      if (glive()) {   // he lets go of the machine and hangs below the printed card
        const fcE = $("#failcard"); G.spot([fcE]); const gl = glideY(() => rel(fcE).y - 150, 900), r = rel(fcE); const hg = hang(r.x + r.w * .5, r.y + r.h + 2); await gl; const tl = tell("This is the flip: how your goal fails if nothing changes. Last year's record is on the card."); await hg; await tl; await gS.wait(1800);   // the card in view, then the words
      }
      const fh = failHtml(FL, goal), fc = $("#failcard"); fc.classList.remove("load"); fc.querySelector(".t").innerHTML = fh.t; fc.classList.add("tt-fadein"); pm("fail"); { const ev = $("#evcard"), eh = evidenceHtml(FL, goal); if (ev && eh) { ev.innerHTML = eh; ev.hidden = false; ev.classList.add("tt-fadein"); countData(ev); } }
      if (!guided && !SK.on) await wait(2800);   // owner 7 Nov: a later (plain) chase holds on the flip so it can be read, before the predators
      stepDone(1); void secs;
      // 3: listen. One predator card per ping
      const PR = sortPreds(FL.predators), N = PR.length, grid = $("#pgrid");
      while (grid.children.length < N) grid.insertAdjacentHTML("beforeend", skelCard()); while (grid.children.length > N) grid.lastElementChild.remove();
      if (!fixB) tlayer.style.clipPath = `inset(0 0 ${Math.max(0, 760 - (rel(TT).y + 118))}px 0)`;   // the echo rings stay above the Terrytory text
      if (GM === "full" && glive()) { const tp = $("#tttop"), pz = live.querySelector("section.pred:not(.qs)"); if (tp) { G.spot([tp, pz].filter(Boolean)); await glideY(() => rel(tp).y - 110, 800); }
        tell("Now I listen for predators: specific ways this goal could fail, a kind of request or a neighborhood that ran late. Each echo brings one back, and I check it against Boston's 2024 records."); }
      stepStart(2); const heard = [];
      $("#heard").textContent = `0 of ${N}`;
      for (let i = 0; i < N; i++) {
        const p = PR[i]; bat.echo && bat.echo(); const bb = guided ? pos : barPt(); ping(bb.x, bb.y + 4, 1200 + i * 60, 640 + i * 30, 1500); await wait(760);
        const card = predCard(p, i); grid.children[i].replaceWith(card); heard.push(p);
        { const r = card.getBoundingClientRect(), lim = innerHeight - 170, sec = card.closest("section"), cap = sec ? rel(sec).y - 110 : Infinity;   // never past where the summary will sit: no bounce back up
          if (r.bottom > lim) { const to = Math.min(cap, scrollY + Math.min(r.bottom - lim, r.top - 90)); if (to > scrollY + 2) glideY(() => to, 600); } }   // the camera keeps each new predator in view (owner 7 Nov) tally(heard); $("#heard").textContent = `${i + 1} of ${N}`; stepEl(2).querySelector(".tm").textContent = `${i + 1} of ${N} heard`;
      }
      tlayer.style.clipPath = "";
      if (!N) { $("#heard").textContent = "None survived the data"; grid.innerHTML = `<div class="pp-empty"><span class="art ochre" aria-hidden="true"><svg viewBox="0 0 120 80" width="100%" height="100%"><use href="#r2-p-quiet"/></svg></span><p class="disp">Terry heard nothing in the 2024 rows for this goal.</p><p class="ans on"><span><span class="lab">How Terry plans to escape it</span>Nothing to cover; the forecast plan stands.</span></p></div>`; } else { const mw0 = monthWord(goal); $("#heard").textContent = `${N} heard${mw0 ? ", " + mw0 : ""}`; }
      if (GM === "full" && glive()) {
        await gS.wait(900); const ps = live.querySelector("section.pred:not(.qs)");
        const cf = PR.filter(p => p.evidence && p.evidence.verdict === "CONFIRMED").length, rj = PR.filter(p => p.evidence && p.evidence.verdict === "REJECTED").length;
        const said = !N ? "I heard no predators for this goal in the 2024 records." : `These are the predators I heard: ${N} way${N === 1 ? "" : "s"} this goal could fail. ${cf ? `${cf} held up in the 2024 records (confirmed)` : "None held up in the 2024 records"}${rj ? `, ${rj} did not (rejected)` : ""}. The confirmed ones are what my flyway has to beat.`;
        if (ps) { G.spot([ps]); await glideY(() => rel(ps).y - 110, 900); }   // scroll and highlight together, then the words (owner 7 Nov)
        await G.present(gS, [ps], said); await gS.wait(2600); G.hush(); }
      pm("pred"); stepDone(2, `${N} heard`); stepStart(3); await wait(900); stepDone(3);
      // 5: the flyway
      stepStart(4); almStep("SEARCHING \u00b7 the cheapest way past the predators"); { const t0 = performance.now(); await Promise.all([escP.then(() => mark("escape:resolved", t0)), wait(900)]); }
      if (failed || !X) return abortGoal();
      stepDone(4); failLineHtml(fc, FL, X, GOAL); answerAll(live, X, GOAL, FL.predators); echoGoal(GOAL, FL); pm("echo");
      const rs = R && R.create(GOAL, { flip: FL, escape: X, goalText: F.goalText(GOAL) });
      if (rs) { live.dataset.r = rs.id; live.dataset.n = rs.n; live._X = X; R.log({ kind: "heard", roostId: rs.id, label: `Heard ${N} predator${N === 1 ? "" : "s"}`, restore: { roostId: rs.id } }); R.log({ kind: "flyway", roostId: rs.id, label: "Found the flyway", restore: { roostId: rs.id } }); }
      const fw = flywaySection(X, N); pm("fly"); await wait(250);
      if (GM === "full" && glive()) { const fs = $("#flysec"); if (fs) { G.spot([fs]); await glideY(() => rel(fs).y - 110, 800); } else G.unspot(); await playFlyway(fw); await gS.wait(700); await G.present(gS, [$("#flysec")], "This is how I\u2019d fly past them to reach your goal."); await gS.wait(3000); G.hush(); }
      else { if (!guided || !glive()) { const fs = $("#flysec"); if (fs) glideY(() => { const r = rel(fs), dk = document.querySelector("#dock"), room = (dk && dk.offsetHeight ? Math.min(innerHeight, dk.getBoundingClientRect().top) : innerHeight) - 16; return r.y - Math.max(90, (room - r.h) / 2); }, 800); } await playFlyway(fw); }   // the whole flyway in view, clear of the dock (owner 7 Nov; it used to show only its top half)
      if (jumped && !answered) { answered = true; pm("ledger"); const full = RL() && RL().end(); if (full) await Promise.race([full, sleep(1800)]); landAnswer(); }   // the gauge reads full, then the page goes to the answer   // the plan is filed with the Roost above: the answer is complete
      await wait(900);
      await finish();
    }
    // Skip (the caption's, the corner one, or Escape): Terry flies straight off to his perch, the rest plays fast without him
    function skipAll() {
      if (gS && gS.live()) { gS.skip(); return; }
      const G = root.TerryGuide; if (G) { G.unspot(); G.hush(); }
      if (gone) return; gone = true; skipNow();
      if (!is3d || reduced()) { fix(false); return; }
      flyOffP = (async () => {
        const raw = bat, b = branchPt();
        try {
          for (let k = 0; k < 40 && raw.busy(); k++) await sleep(30);
          if (raw.mode() === "hang") { raw.setHome(pos.x, pos.y - 150); await bounded(raw.flip(), 2200); }
          raw.setBranch(b.x, b.y); pos = b; await bounded(raw.flip(), 3600); if (raw.mode() !== "hang") { raw.setBranch(b.x, b.y); raw.hangNow(); }
        } catch (e) { console.warn("fly off", e && e.message); }
        fix(false); flyOffP = null;
      })();
    }
    // the viewer scrolled or clicked: he stops narrating and goes back to the projector's bar; the chase goes on at its pace
    function backToBar() { const G = root.TerryGuide; if (G) G.unspot(); if (gone) return; const bp = barPt(); hang(bp.x, bp.y).catch(() => {}); }
    skipbtn.addEventListener("click", () => { if (running && (gS || fixB)) skipAll(); });
    async function abortGoal() {
      hangFollow = false; if (gS) { gS.end(); gS = null; } if (flyOffP) await flyOffP; gone = false; fix(false); hero.classList.remove("working", "chasing", "carried"); TT.classList.remove("busy"); await roll(false); await toHome(); gnote.textContent = "I could not turn that goal over. Try it another way."; setChips(exChips());
      if (live) { live.remove(); live = null; } building = false;
      const keep = R && R.get(activeId());
      if (keep) { const bd = bodyOf(keep.id); if (bd) showBody(bd); hero.classList.add("has-goal"); goalform.hidden = true; gchips.hidden = true; gnote.hidden = true; addBtn.hidden = false; renderRail(); projectRoost(keep); } else ttEmpty();
      if (RL()) RL().cancel(); jumped = false;
      lockBox(false); running = false; ringsShow(true); skipbtn.hidden = true; SK.on = false; bus("proj:idle", { reason: "abort" });
    }
    // the projector waits on a plan (owner 08:35): the cloth's contents dim, the bat loader shows a caption (only after 250 ms, by a CSS
    // delay, so it lands even while the main thread works) and clears the moment the chart draws
    let pvOn = false, pvT = 0;
    function pvWait(caption) {
      const L = root.Screen && root.Screen.loader; if (!L || !fab) return; pvDone(); pvOn = true; stage.classList.add("pv-dim"); L.show(fab, 0, caption, "pv");
      clearTimeout(pvT); pvT = setTimeout(pvDone, 15000);   // never left on
    }
    function pvDone() { if (!pvOn) return; pvOn = false; clearTimeout(pvT); stage.classList.remove("pv-dim"); const L = root.Screen && root.Screen.loader; if (L) L.hide(); }
    async function finish() {
      // the progress card folds away, the goal collapses to a pill, the screen unrolls on the plan
      const top = $("#tttop");
      if (top) {   // the progress card has done its job: one line of trace stays on the plate, then the column folds away
        const tm = t0s.length ? ((performance.now() - Math.min(...t0s.filter(Boolean))) / 1000).toFixed(1) : "", pp = [...top.parentNode.querySelectorAll(".pp:not(.skel)")], cf = pp.filter(c => c.dataset.v === "CONFIRMED").length;
        if (pp.length) top.parentNode.dataset.trace = `${tm ? "Chased in " + tm + " s. " : ""}${pp.length} predators heard, ${cf} confirmed.`;   // read by the Echolocation group head as its title
        top.classList.remove("work"); const pg = top.querySelector(".prog"); if (pg) setTimeout(() => pg.closest(".tt-top") && (pg.textContent = ""), 520);
      }
      TT.classList.remove("busy");
      const rr = R && R.get(activeId()); if (rr) { sealBody(rr); Zm().setRoostLabel("Roost " + rr.n); }
      addBtn.hidden = false; syncAdd(); goalform.hidden = true; gchips.hidden = true; gnote.hidden = true; hero.classList.remove("working", "chasing", "carried"); hero.classList.add("has-goal");
      if (gS) { root.TerryGuide.unspot(); root.TerryGuide.hush(); }
      const screenLine = (() => { const G = root.TerryGuide, z = Zm(), i = z && z.info, g = GOAL || {}, dn = g.scope === "CITY" ? "the city" : (i && i[g.scope] && i[g.scope].name) || "this department";
        return GM === "full" && gS && gS.live() && G && G.say ? () => G.say(`Here is my plan for ${dn}, playing out on the screen. Each +N pill is a crew I add, and a hatched bar is behind, but not late.`, { q: "What is the screen showing?" }) : null; })();
      if (screenLine) { const G = root.TerryGuide; if (G && G.say) G.say("That is the plan. Let me roll the screen down and play it for you.", { q: "What is happening in the chase?" }); }   // the 20 s back to the screen are not silent (owner 7 Nov)
      if (fixB && !gone) { const bp = barPt(), gl = glideY(() => rel(screen).y + 30, 900); if (!(bat.mode() === "hang" && Math.hypot(pos.x - bp.x, pos.y - bp.y) < 6)) await hang(bp.x, bp.y); await gl; await idle(); fix(false); }
      if (!jumped) { await glideY(() => rel(screen).y + 30, 900); await wait(300); }
      pvWait("Visualizing the Flyway\u2026"); const pv0 = performance.now();   // the loader shows as the screen comes down, where the viewer is looking
      hangFollow = true; await Promise.all([roll(false), (async () => { await wait(300); hangFollow = false; const pp = homePt(); await release(pp.x, pp.y); })()]);
      hangFollow = false; if (!jumped) { skipbtn.classList.remove("skipping"); skipbtn.removeAttribute("aria-busy"); skipbtn.textContent = "Skip"; skipbtn.hidden = false; await glideY(() => rel(screen).y + 30, 500); }
      { const bp = branchPt(); await hang(bp.x, bp.y); }   // Terry flies to his perch (no jump cut), then perches at the right end of the branch, clear of the toolbar, before the plan plays
      { const left = 1300 - (performance.now() - pv0); if (left > 0 && !SK.on && !reduced()) await wait(left); }   // long enough to be seen
      if (screenLine) screenLine();   // the screen is down and the plan starts playing: now he says what it shows (owner 7 Nov)
      await goalView(); if (!answered && !jumped) offerNext(true); else if (!answered) skipbtn.hidden = true;
      // owner 7 Nov: once the plan has played, how to explore it (a plain scroll moves the page; Ctrl + scroll or a pinch zooms the screen)
      if (screenLine && gS && gS.live() && !SK.on) { const G = root.TerryGuide; if (G && G.say) G.say("The screen has three zoom levels: the whole city for the year, one department, then one month. Click a department or a month to go in, or pinch over the screen (Ctrl + scroll with a mouse). The minus button or Esc steps back out. Anything unclear? Just ask me here.", { q: "How do I explore the screen?" }); }
      await toHome(); if (flyOffP) await flyOffP; gone = false; if (gS) { gS.end(); gS = null; } fix(false);
      pm("ledger"); const late = jumped && !answered; jumped = false; if (late && RL()) RL().end();
      lockBox(false); running = false; ringsShow(true); SK.on = false; bus("proj:idle", { reason: "chase" });   // no "That is one flyway" note any more (owner 22:07)
      if (late) landAnswer(); answered = false;
      if (GM === "rm" && root.TerryGuide) root.TerryGuide.chaseRM();
    }


    // ------------------------------------------------------------ the plan on the screen
    function syncToggle() {
      const z = Zm(), changed = X && Object.values(X.depts).some(d => d.changed); plantgl.hidden = !(GVspec && changed);
      const cmp = !!(root.TerryState && root.TerryState.compare), cur = cmp ? "both" : (z.planFly === false ? "stay" : "flyway");
      plantgl.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.w === cur)));
      const fb = bodyOf(activeId()) || document; fb.querySelectorAll(".flyp .btn span").forEach(sp2 => { sp2.textContent = z.planFly === false ? "Back to the flyway" : "Original plan"; });
    }
    async function goalView() {
      const t0 = performance.now(), z = Zm(), bs = buildSpec(X, FL, GOAL); planX = bs.pX; GVspec = bs.spec; mark("goalView:spec", t0);
      const t1 = performance.now(); z.setFly(true); z.drawGoal(GVspec); showPlanCtl(true); syncToggle(); mark("goalView:draw", t1);
      pvDone(); const A = root.TerryAlmanac; if (A && A.chasing) A.chasing(null);
      await playPlan();
    }
    // timings for the owner's "slow after a flip" report (08:35): read window.__terryPerf in a test
    function mark(k, t0) { try { (root.__terryPerf = root.__terryPerf || []).push([k, Math.round(performance.now() - t0), Math.round(performance.now())]); } catch (e) {} }
    async function playPlan() {
      const z = Zm(); if (!GVspec) return;
      if (z.S.lvl === 2) return;
      await z.animateGoal({ planX });
      if (GVspec.depts.length === 1 && (z.S.lvl === 0 || (z.S.lvl === 1 && z.S.d !== GVspec.depts[0])) && !SK.on) { await wait(300); await z.goTo({ lvl: 1, d: GVspec.depts[0], m: z.tightest(GVspec.depts[0]) }); await z.settled(); await z.animateGoal({ planX }); }
      syncToggle();
    }
    function endGoalView(quiet) {
      const z = Zm(); if (!GVspec && quiet) return; GVspec = null; z.skipPlan(); z.drawGoal(null); showPlanCtl(false); plantgl.hidden = true; z.setFly(true);
      z.setPlanView(null, 0); if (z.S.lvl !== 0) z.goTo({ lvl: 0 });
    }
    // Stay the course | Flyway | Both, and the link back to Terry's original plan
    // Original plan | Flyway | Compare (the three cells live in index.html)
    const setView = view => { const id = activeId(); if (id && R) { if (!R.setView(id, view)) applyView(view); } else applyView(view); };   // setView returns false when the Roost already has that view: the cloth may still show Compare
    plantgl.addEventListener("click", async e => {
      const b = e.target.closest("button"); if (!b || !GVspec) return; const id = activeId(), r = id && R.get(id);
      if (b.dataset.w === "both") { if (r) R.openCompare({ roostId: r.id, view: "stay" }, { roostId: r.id, view: "flyway" }); return; }
      if (Zm().planRunning) Zm().skipPlan();
      if (root.TerryState && root.TerryState.compare) R.closeCompare();
      setView(b.dataset.w === "flyway" ? "flyway" : "stay");
    });
    // speed and replay for the plan, beside the toolbar's other controls
    const ontime = h("div"); ontime.id = "ontime"; ontime.hidden = true; stage.appendChild(ontime); let ontimeFor = null;
    function monthWord(g) { const m = (g && g.months) || []; if (m.length === 1) return MON[m[0] - 1]; if (m.length > 1 && m.length < 12) return `${MON[Math.min(...m) - 1]} to ${MON[Math.max(...m) - 1]}`; return "the year"; }
    function updOntime() {
      // the readout follows the ACTIVE Roost (its department, goal window and plan), never the last chase's leftovers
      const l = Zm().S.lvl, cmpS = root.TerryState && root.TerryState.compare, r = R && R.get(activeId()), Xr = r && r.escape, Gr = r && r.goal;
      if (running || !GVspec || !Xr || !Gr || l !== 1 || cmpS) { if (!ontime.hidden) ontime.hidden = true; ontimeFor = null; return; }   // no write when nothing changes: it ran a style pass every 300 ms
      const bar = $("#bar"); ontime.style.top = (bar.offsetTop + bar.offsetHeight + 8) + "px";
      const key = r.id + "|" + (Xr.totals.stay.window + "|" + Xr.totals.escape.window);
      if (ontimeFor === key) { ontime.hidden = false; return; }
      ontimeFor = key; const a = Xr.totals.stay.window, b = Xr.totals.escape.window, g = Gr.target, gp = Math.round(g * 100), mw = esc(monthWord(Gr)), P = v => (Math.round(v * 1000) / 10).toFixed(1) + "%";
      let t;
      if (Xr.verdict === "already") t = `On time in ${mw}: <b class="a">${P(a)}</b> now, already past ${gp}%`;
      else if (Xr.verdict === "unreachable") t = `On time in ${mw}: <b class="a">${P(a)}</b> now, <b class="s">${P(b)}</b> with the flyway, short of ${gp}%`;
      else t = `On time in ${mw}: <b class="a">${P(a)}</b> now, <b class="w">${P(b)}</b><i class="dt"></i> with the flyway`;
      ontime.innerHTML = `<span>${t}</span>`; ontime.hidden = false;
    }
    const plspeed = h("div"); plspeed.id = "plspeed"; plspeed.hidden = true; plspeed.setAttribute("role", "group"); plspeed.setAttribute("aria-label", "Plan animation speed");
    plspeed.innerHTML = [["0.5", "0.5x"], ["1", "1x"], ["2", "2x"]].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === "1"}">${l}</button>`).join("");
    const replay = h("button", "ib", ic("play")); replay.type = "button"; replay.id = "replaybtn"; replay.hidden = true; replay.title = "Replay the plan"; replay.setAttribute("aria-label", "Replay the plan");
    ctrls.appendChild(replay); ctrls.appendChild(plspeed);   // both stay hidden in the bar; replay is reached from the info popover
    const syncSpeed = v => { Zm().setPlanSpeed(v); plspeed.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === v))); };
    plspeed.addEventListener("click", e => { const b = e.target.closest("button"); if (b) syncSpeed(+b.dataset.v); });
    document.addEventListener("click", e => { const b = e.target.closest(".sc-speed button"); if (!b) return; const v = [0.5, 1, 2][+b.dataset.sp]; if (v) plspeed.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(+x.dataset.v === v))), Zm().setPlanSpeed(v); }, true);
    replay.addEventListener("click", async () => { if (!GVspec || running) return; const z = Zm(); if (z.S.lvl === 2) return; if (z.planRunning) z.skipPlan(); await z.animateGoal({ planX }); syncToggle(); });
    // ------------------------------------------------------------ the plan as a moment: spotlight and transport (item 5)
    const spot = h("div"); spot.id = "spot"; spot.setAttribute("aria-hidden", "true"); document.body.appendChild(spot);
    const tp = h("div"); tp.id = "transport"; tp.hidden = true; tp.setAttribute("role", "group"); tp.setAttribute("aria-label", "Plan playback");
    tp.innerHTML = `<button type="button" class="tp-b" data-a="pp" aria-label="Pause"></button><button type="button" class="tp-b" data-a="stop" aria-label="Stop and show the finished plan"></button>
      <div class="tp-s" role="group" aria-label="Beats">${[0, 1, 2, 3, 4, 5].map(i => `<button type="button" class="tp-d" data-i="${i}" aria-label="Beat ${i + 1}"></button>`).join("")}</div>
      <label class="tp-sp"><span class="sr">Speed</span><select aria-label="Playback speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option></select></label>
      <span class="tp-c" aria-live="polite"><i class="tp-p"></i><span id="tpcap"></span></span>`;
    fab.appendChild(tp);
    const ICO_PLAY = ic("play"), ICO_PAUSE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>', ICO_STOP = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    const tpPP = tp.querySelector('[data-a="pp"]'), tpDots = [...tp.querySelectorAll(".tp-d")], tpCap = tp.querySelector("#tpcap"), tpSel = tp.querySelector("select");
    tp.querySelector('[data-a="stop"]').innerHTML = ICO_STOP;
    const tpPaint = () => { const z = Zm(), paused = !!(z && z.planPaused); tpPP.innerHTML = paused ? ICO_PLAY : ICO_PAUSE; tpPP.setAttribute("aria-label", paused ? "Play" : "Pause"); const b = z ? z.planBeat : 0; tpDots.forEach((d, i) => { d.classList.toggle("on", i <= b); d.setAttribute("aria-current", i === b ? "step" : "false"); }); tp.style.setProperty("--tp-f", (b / 5 * 100) + "%"); };
    tpPaint();
    let spotOff = 0;
    Bus && Bus.on("plan:play", p => { clearTimeout(spotOff); if (p && p.reduced) { tp.hidden = true; return; } document.documentElement.classList.add("spot"); tp.hidden = false; tpPaint(); });
    Bus && Bus.on("plan:beat", p => { tpCap.textContent = p.caption || ""; tpPaint(); });
    Bus && Bus.on("plan:stop", () => { clearTimeout(spotOff); spotOff = setTimeout(() => { document.documentElement.classList.remove("spot"); tp.hidden = true; }, 260); });
    const stopToFinal = () => { if (GVspec) applyView("flyway"); else Zm().skipPlan(); };
    const toBeat = async i => { const z = Zm(); if (!GVspec || z.S.lvl === 2) return; i = Math.max(0, Math.min(5, i)); z.skipPlan(); await z.animateGoal({ planX, from: i }); };
    tp.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const z = Zm();
      if (b.dataset.a === "pp") { z.setPaused(!z.planPaused); tpPaint(); } else if (b.dataset.a === "stop") stopToFinal(); else if (b.dataset.i !== undefined) toBeat(+b.dataset.i); });
    tpSel.addEventListener("change", () => syncSpeed(+tpSel.value));
    document.addEventListener("keydown", e => {
      const z = Zm(); if (!z || !z.planRunning || !document.documentElement.classList.contains("spot")) return; if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "Escape") { e.preventDefault(); stopToFinal(); } else if (e.key === " " && !(e.target && e.target.closest && e.target.closest("button"))) { e.preventDefault(); z.setPaused(!z.planPaused); tpPaint(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); toBeat(z.planBeat + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); toBeat(z.planBeat - 1); }
    });
    function showPlanCtl() { plspeed.hidden = true; replay.hidden = true; }
    setInterval(updOntime, 300);
    editgoal.addEventListener("click", () => {
      if (running) return; endGoalView(); pill.hidden = true; goalform.hidden = false; gchips.hidden = false; gnote.hidden = false; hero.classList.remove("has-goal"); lockBox(false); goalin.value = lastText; gnote.textContent = ""; setChips(exChips()); ttEmpty();
      scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); goalin.focus({ preventScroll: true });
    });

    // ------------------------------------------------------------ the "+", closing, and the projector following the active Roost
    addBtn = h("button", "", `${ic("plus")}<span class="tt">Chase another goal</span>`); addBtn.id = "addroost"; addBtn.type = "button"; addBtn.hidden = true; addBtn.setAttribute("aria-label", "Chase another goal"); hero.appendChild(addBtn);
    function syncAdd() {
      if (!addBtn) return; const full = roosts().length >= R.LIMIT; addBtn.setAttribute("aria-disabled", String(full));
      const msg = full ? "Three roosts is Terry's limit. Close one to chase another." : "Chase another goal"; addBtn.querySelector(".tt").textContent = msg; addBtn.setAttribute("aria-label", msg);
    }
    function openAdd() {
      if (running || introRunning || addBtn.getAttribute("aria-disabled") === "true") return;
      const from = addBtn.getBoundingClientRect();
      addBtn.hidden = true; hero.classList.remove("has-goal"); goalform.hidden = false; gchips.hidden = false; gnote.hidden = false; goalform.style.visibility = "";
      goalform.classList.remove("unfurl"); flipBox(from, true);
      lockBox(false); goalin.value = ""; gnote.textContent = ""; setChips(exChips()); scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); goalin.focus({ preventScroll: true }); stickyChips = true; chipsOn(true); toHome();   // chipsOn: the suggestions show even if the field already had focus (owner 7 Nov)
    }
    // the "+" and the goal box are one shape: FLIP the box from the circle's rect (transform and opacity, about 380 ms), children fade in once it settles
    function flipBox(btnRect, opening) {
      if (reduced()) return Promise.resolve(); const to = goalform.getBoundingClientRect(); if (!to.width || !btnRect.width) return Promise.resolve();
      const sx = btnRect.width / to.width, sy = btnRect.height / to.height, dx = btnRect.left + btnRect.width / 2 - (to.left + to.width / 2), dy = btnRect.top + btnRect.height / 2 - (to.top + to.height / 2);
      const circ = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, ease = "cubic-bezier(.16, 1, .3, 1)", kids = [...goalform.children];
      const box = goalform.animate(opening ? [{ transform: circ, borderRadius: "40px" }, { transform: "none", borderRadius: "16px" }] : [{ transform: "none", borderRadius: "16px" }, { transform: circ, borderRadius: "40px" }], { duration: 380, easing: ease, fill: "both" });
      kids.forEach(k => k.animate(opening ? [{ opacity: 0 }, { opacity: 0, offset: .6 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: opening ? 380 : 140, easing: "ease-out", fill: "both" }));
      return box.finished.then(() => { box.cancel(); kids.forEach(k => k.getAnimations().forEach(an => an.cancel())); }, () => {});
    }
    async function closeAdd() {
      if (!roosts().length || running) return; const from = addBtn.getBoundingClientRect(); addBtn.hidden = false; const to = addBtn.getBoundingClientRect(); addBtn.hidden = true;
      if (!reduced() && !goalform.hidden && to.width) { const box = goalform.getBoundingClientRect(); const sx = to.width / box.width, sy = to.height / box.height, dx = to.left + to.width / 2 - (box.left + box.width / 2), dy = to.top + to.height / 2 - (box.top + box.height / 2);
        gchips.hidden = true; gnote.hidden = true; const an = goalform.animate([{ transform: "none", borderRadius: "16px" }, { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: "40px" }], { duration: 380, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "both" });
        [...goalform.children].forEach(k => k.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-out", fill: "both" })); try { await an.finished; } catch (e) {} an.cancel(); [...goalform.children].forEach(k => k.getAnimations().forEach(x => x.cancel())); }
      void from; goalform.hidden = true; gchips.hidden = true; gnote.hidden = true; hero.classList.add("has-goal"); addBtn.hidden = false; toHome(); addBtn.focus({ preventScroll: true });
    }
    addBtn.addEventListener("click", openAdd);
    goalin.addEventListener("keydown", e => { if (e.key === "Escape") closeAdd(); });
    async function closeRoostUI(id) { const t = rail.querySelector(`.tabw[data-id="${id}"]`); if (t && !reduced() && roosts().length > 1) { t.classList.add("gone"); await sleep(300); } R.close(id); }
    function buildSpec(Xr, FLr, goal) {
      const z = Zm(), ds = Object.keys(Xr.depts), pX = Object.assign({}, z.basePlan); for (const d of ds) pX[d] = Xr.depts[d].escape.plan;
      return { pX, spec: { goal, depts: ds, dusk: Xr.dusk && Xr.dusk.date && !Xr.dusk.passed ? { day: Xr.dusk.day, date: Xr.dusk.date } : null,
        owls: FLr.predators.filter(p => p.evidence.verdict !== "REJECTED").map(p => ({ dept: p.hypothesis.department && ds.includes(p.hypothesis.department) ? p.hypothesis.department : null, months: (p.place && p.place.months) || [], name: p.hypothesis.name })) } };
    }
    function switchBody(r) {
      const to = bodyOf(r.id); if (!to) return; const from = [...rbodies.children].find(x => !x.hidden && x !== to);
      if (!from || reduced()) { showBody(to); return; }
      from.classList.add("xit");
      setTimeout(() => { from.classList.remove("xit"); from.hidden = true; to.hidden = false; to.classList.add("xin"); setTimeout(() => to.classList.remove("xin"), 300); }, 220);
    }
    // re-project: the department view for the Roost's department with its plan applied, no replay of the chase
    async function projectRoost(r) {
      const z = Zm(); if (!z || running || !r.escape || !r.flip) return;
      GOAL = r.goal; X = r.escape; FL = r.flip; echoGoal(GOAL, FL); const b = buildSpec(X, FL, GOAL); GVspec = b.spec; planX = b.pX; ontimeFor = null;
      z.skipPlan(); z.setRoostLabel("Roost " + r.n); showPlanCtl(true); await z.settled();
      const ds = GVspec.depts, d1 = ds.length === 1 ? ds[0] : null;
      if (d1 && (z.S.lvl !== 1 || z.S.d !== d1)) await z.goTo({ lvl: 1, d: d1, m: z.tightest(d1) }); else if (!d1 && z.S.lvl !== 0) await z.goTo({ lvl: 0 });
      await z.settled(); await z.settleGoal(GVspec, r.view === "stay" ? z.basePlan : planX, Math.round(500 / sp()));
      syncToggle();
    }
    async function applyView(view) {
      if (!GVspec || running) return; const z = Zm(), fly = view !== "stay"; z.skipPlan(); z.setFly(fly); await z.setPlanView(fly ? planX : z.basePlan, Math.round(900 / sp())); syncToggle();
    }
    if (Bus) {
      Bus.on("roost:activated", p => { renderRail(); if (p.fromCreate) return; const r = R.get(p.id); if (!r) return;
        if (!p.restore && r.view !== "flyway") R.setView(r.id, "flyway", { quiet: true }); switchBody(r); projectRoost(r); });
      Bus.on("roost:closed", p => {
        const b = bodyOf(p.id); if (b) b.remove(); renderRail();
        if (!p.left) { endGoalView(); Zm().setRoostLabel(null); ttEmpty(); addBtn.hidden = true; hero.classList.remove("has-goal"); goalform.hidden = false; gchips.hidden = false; gnote.hidden = false; goalform.style.visibility = ""; lockBox(false); goalin.value = ""; setChips(exChips()); stickyChips = true; chipsOn(true); showPlanCtl(false); toHome(); scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); }
      });
      Bus.on("plan:view", p => { if (p.quiet || p.roostId !== activeId()) return; applyView(p.view); });
      Bus.on("action:restore", p => { const rs = p.entry && p.entry.restore; if (rs && rs.level !== undefined && Zm()) { const z = Zm(); z.goTo(rs.level ? { lvl: rs.level, d: rs.dept, m: rs.month } : { lvl: 0 }); } });
      Bus.on("ask:zoom", p => { const z = Zm(); if (z && p) z.goTo(p.level ? { lvl: p.level, d: p.dept, m: p.month } : { lvl: 0 }); });
      Bus.on("ask:highlight", p => { const z = Zm(); if (z && p && p.dept) z.highlight(p.dept, p.months || [], p.what); });
      Bus.on("leaf:pinned", () => setTimeout(() => { const z = Zm(); if (z) z.relayout(); }, 460));
      Bus.on("screen:pull", p => { if (p && p.maximized !== undefined) { const z = Zm(); if (z) z.relayout(); } });
    }

    // ------------------------------------------------------------ the first visit
    let introRunning = false;
    async function intro() {
      introRunning = true; running = false; SK.on = false; skipbtn.hidden = false;
      const w = page.getBoundingClientRect().width, hp = homePt(), hx = hp.x, hy = hp.y;
      moveTo(hx, hy, 2600); await wait(2300);
      if (!SK.on) { introbub.style.left = (hx + 120) + "px"; introbub.style.top = (hy - 36) + "px"; introbub.classList.add("on"); $("#live").textContent = "Hi, I'm Terry. I plan Boston's 311 crews."; bat.flap && bat.flap(); await wait(4800); }
      introbub.classList.remove("on"); await wait(300);
      if (!running) skipbtn.hidden = true; await toHome(SK.on); introRunning = false; seenSet(); if (!running) SK.on = false;   // a chase begun during the hello keeps its own skip state
    }
    async function start() {
      fitRig(); setTheme(themeGet()); mkBat(); setBatTheme(); placeHit();
      if (reduced()) { await toHome(true); seenSet(); return; }
      if (seenGet()) { await toHome(true); return; }
      // after the landing (owner 19:00) he has already been met: he flew in with the page, so no greeting bubble, he just goes home
      const L = root.TerryLanding; if (L && L.active) { await toHome(true); seenSet(); return; }   // home at once, unseen under the landing, so the hand-over finds him there
      await intro().catch(e => { console.warn("intro failed", e && e.message); introRunning = false; skipbtn.hidden = true; toHome(true); });
    }
    let rz = 0; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { fitRig(); placeHit(); if (!running && !introRunning && bat && bat.mode() === "hang" && perched()) { const b = branchPt(); bat.setBranch(b.x, b.y); pos = b; } else if (!running && !introRunning && bat && bat.mode() !== "hang") { const p = homePt(); bat.setHome(p.x, p.y); pos = p; } }, 40); });
    Object.defineProperty(root.TerryProj, "running", { get: () => running, configurable: true });
    Object.assign(root.TerryProj, { home: () => homePt(), chips: on => chipsOn(on), fly: () => F, reproject() { const r = R && R.get(activeId()); if (r) projectRoost(r); }, replay() { try { localStorage.removeItem("terry.seen"); } catch (e) {} location.reload(); }, skip: skipNow, bat: () => bat, runGoal: g => ensure().then(() => runGoal(g)), submit,
      // for ticket.js: Terry carries a card from the dock to the screen; page-relative geometry of any element; the page element the cards live in
      ferry, pageRect: rel, page, canFly: () => is3d && !running && !introRunning && !ferrying && !reduced() && !(Zm() && Zm().planRunning) && !((root.TerryState || {}).busy) });
    Object.defineProperty(root.TerryProj, "running", { get: () => running || goalBusy, configurable: true });   // a chase in progress, for tests and for Ping
    Object.defineProperty(root.TerryProj, "kit", { configurable: true, value: {
      page, rel, glideY, fix, is3d: () => is3d, busy: () => running || introRunning || ferrying || !!(Zm() && Zm().planRunning),
      fly: async (x, y, ms) => { if (gone) return; await idle(); if (bat.mode() === "hang") await release(x, y); await moveTo(x, y, ms); },
      flyHome: instant => toHome(instant), hangAt: (x, y) => hang(x, y), terryPos: () => ({ ...pos }), unskip: () => { if (!running) SK.on = false; },
      // where he really is (the last drawn frame), and a bounded wait until he gets there: a slow renderer lags his target
      terryAt: () => { const a = bat.anchor ? bat.anchor("body") : null; return a && isFinite(a.x) && isFinite(a.y) ? a : { ...pos }; },
      arrive: async (x, y, ms) => { const t0 = performance.now(), cap = (ms || 2500) * (root.__terrySlow || 1); while (performance.now() - t0 < cap) { const a = bat.anchor ? bat.anchor("body") : null; if (!a || !isFinite(a.x) || Math.hypot(a.x - x, a.y - y) < 36) return; await sleep(80); } },
      terryBox: () => { const p = page.getBoundingClientRect(), a = bat.anchor ? bat.anchor("body") : null, q = a && isFinite(a.x) ? a : pos; return { x: q.x - 152 + p.left, y: q.y - 44 + p.top, width: 188, height: 124 }; },
      carry: async (card, from, to, ms, st) => { const a = bat.anchor ? bat.anchor("feet") : null, end = a && isFinite(a.x) ? { x: a.x - 28, y: a.y + 2, w: 56, h: 56 } : { x: from.x - 28, y: from.y + CARRY_DY, w: 56, h: 56 };
        await tween(600, u => setRect(card, mix(st, end, u))); await carryCard(card, from, to, ms); },
    } });
    start().then(() => { const G = root.TerryGuide; if (G) G.afterIntro(); }, () => {});
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
})(typeof window !== "undefined" ? window : globalThis);
