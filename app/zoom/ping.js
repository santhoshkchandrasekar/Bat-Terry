/* Ping Terry: the dock fixed at the bottom of the viewport (spec G). It replaces the Ask Terry drawer: the DOM half of askui.js is gone,
 * ask.js keeps the agent (A.ask) and territory.js keeps the alert and stream work (runAlert, playStream).
 *
 *   TerryAskUI.mount(host, handlers)   the same entry app.js already calls; handlers feed the shell (TerryShell.setHandlers)
 *   TerryPing.submit(text)             run a ping from code
 *
 * The answer lives inside the dock (the blade gets taller, never a second box) and never covers the projector: if the fabric would sit
 * behind the dock the page scrolls it clear. Page actions go out as ask:highlight and ask:zoom; if nobody handles them (payload.handled
 * stays false) the dock performs them itself through the handlers.
 */
(function (root) {
  "use strict";
  const doc = document, Sh = () => root.TerryShell, T = () => root.TerryTerritory;
  const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const GOALS = ["Every Transportation request on time in November", "Public Works on time at least 90% in August", "Parks on time at least 80% in the summer"];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const PLACE = "Ping Terry: a question, a what-if, or a resident report";
  // the placeholder teaches both uses by example: a planner's question, a resident's report, a what-if, a report in Spanish
  const PLACES = ["Ping Terry: Why does Transportation hire in February?", "Ping Terry: There is a huge pothole on Centre St by the T stop", "Ping Terry: What if it snows in January?", "Ping Terry: Hay un bache enorme en la calle Centre"];
  let placeI = 0, placeT = 0;
  const placeNow = () => PLACES[placeI % PLACES.length];
  function rotatePlace() { clearTimeout(placeT); if (!D || !input) return; if (working || D.el.dataset.mode !== "rest" || input.value || doc.activeElement === input) { placeT = setTimeout(rotatePlace, 2500); return; } placeI++; input.placeholder = placeNow(); placeT = setTimeout(rotatePlace, 5000); }
  const TAGN = { PWDx: "PUBLIC WORKS", BTDT: "TRANSPORTATION", PARK: "PARKS", ISD: "INSPECTIONAL" }, ACC = { PWDx: "var(--behind)", BTDT: "var(--hire)", PARK: "var(--work)", ISD: "var(--pred)" };
  const cap = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, t.lastIndexOf(" ", n) > n / 2 ? t.lastIndexOf(" ", n) : n) + "..." : t; };
  const TOOLTXT = { neighborhood_profile: () => "reading the neighborhoods", city_overview: () => "looking across the city", department_year: i => `checking ${nm(i && i.dept)}'s year`, month_detail: i => `checking ${nm(i && i.dept)} in ${i && i.month || "that month"}`,
    explain_demand: i => `redoing ${i && i.month || "the month"}'s forecast`, explain_decision: i => `weighing the ${nm(i && i.dept)} hire`, what_if_crews: i => `trying other crew counts for ${nm(i && i.dept)}` };
  const nm = d => NAMES[d] || "the city";

  let threadEl = null, scrollEl = null, stEl = null, onBtn = null, dragIn = false, flying = false, acting = false, tabAt = 0;
  let D = null, input, form, go, chipsEl, ans, youEl, textEl, tkEl, actsEl, working = false, ctl = null, lastAnswer = null, cleared = true, emptyT = 0, pending = null, stopWhy = null, turnSeq = 0;   // turnSeq: each turn's number; a finished older turn (a ticket still flying) never touches a newer one   // stopWhy: "you" (Stop) or "guide" (the guide took the dock)

  const isWhatIf = t => /^\s*(what if|suppose|imagine)\b/i.test(t);
  const isQuestion = t => /\?\s*$/.test(t) || /^\s*(why|how|what|were|was|is|are|does|do|did|which|where|who|when|can|could|should|tell|show|explain)\b/i.test(t);
  const isAlert = t => isWhatIf(t) || (!isQuestion(t) && /(warning|advisory|alert|watch|storm|blizzard|snow|forecast|expected|heat|freeze|cold|wind|flood|surge|spike|quit|strike|outage|move-in)/i.test(t));

  // ---------------------------------------------------------------- dock DOM
  // the chat's height is the viewer's (owner 6 Nov): drag the grip on the panel's top edge, or focus it and use the arrow keys;
  // a double click or Home goes back to the default. Kept for the visit.
  function grip(top) {
    if (!top || top.querySelector(".dk-grip")) return;
    const g = el("button", "dk-grip"); g.type = "button"; g.title = "Drag to resize the chat"; g.setAttribute("aria-label", "Resize the chat: drag it, or use the up and down arrow keys");
    top.insertBefore(g, top.firstChild);
    const MIN = 110, max = () => Math.max(MIN, Math.round(innerHeight * 0.72)), cur = () => (scrollEl ? scrollEl.getBoundingClientRect().height : 260);
    const set = h => { if (h == null) { D.el.style.removeProperty("--dk-h"); try { sessionStorage.removeItem("terry.dockh"); } catch (e) {} return; }
      h = Math.round(Math.min(max(), Math.max(MIN, h))); D.el.style.setProperty("--dk-h", h + "px"); try { sessionStorage.setItem("terry.dockh", String(h)); } catch (e) {} };
    try { const h0 = +sessionStorage.getItem("terry.dockh"); if (h0 > 0) set(h0); } catch (e) {}
    let d = null;
    g.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button !== 0) return; e.preventDefault(); g.setPointerCapture(e.pointerId); d = { id: e.pointerId, y: e.clientY, h: cur() }; D.el.classList.add("dk-sizing"); });
    g.addEventListener("pointermove", e => { if (!d || e.pointerId !== d.id) return; set(d.h + (d.y - e.clientY)); });
    const end = e => { if (!d || e.pointerId !== d.id) return; d = null; D.el.classList.remove("dk-sizing"); try { g.releasePointerCapture(e.pointerId); } catch (x) {} };
    g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
    g.addEventListener("dblclick", () => set(null));
    g.addEventListener("keydown", e => {
      const k = e.key;
      if (k === "ArrowUp") { e.preventDefault(); set(cur() + 40); } else if (k === "ArrowDown") { e.preventDefault(); set(cur() - 40); } else if (k === "Home") { e.preventDefault(); set(null); }
    });
  }
  function build() {
    const S = Sh(); if (!S || !S.dock) return false; D = S.dock; if (D.built) return true;
    D.body.innerHTML = `<div class="dk">
      <div class="dk-top"><div class="dk-top-in"><div class="dk-head"><span class="dk-st" data-st="checking" tabindex="0" role="status"><i aria-hidden="true"></i><span class="dk-st-t">Checking...</span><span class="dk-st-tip" role="tooltip"></span></span><button type="button" class="dk-on" hidden>Turn on live answers</button></div><div class="dk-scroll" tabindex="-1"><ol class="dk-thread" aria-label="Earlier in this chat"></ol><div class="dk-ans"><span class="dk-you"></span><div class="dk-text" aria-live="polite" tabindex="0"></div><div class="dk-tk" aria-live="polite"></div><div class="dk-acts"></div></div></div>
      <div class="dk-chips" role="group" aria-label="Ping Terry suggestions"></div></div></div>
      <form class="dk-row" role="search" autocomplete="off">
        <input class="dk-in" type="text" maxlength="400" placeholder="${esc(placeNow())}" aria-label="${esc(PLACE)}" autocomplete="off" spellcheck="false">
        <kbd class="dk-key" aria-hidden="true">/</kbd>
        <button type="submit" class="dk-go" aria-label="Ping" title="Ping">${'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/></svg>'}</button>
        <i class="dk-wave"></i></form></div>`;
    // idle Terry: hanging upside down from a brass perch inside the avatar (the flying bat shows while he is busy; shell.css)
    const tb = D.el.querySelector(".dk-terry");
    if (tb && !tb.querySelector(".dk-hang")) tb.insertAdjacentHTML("beforeend", '<svg class="dk-hang" viewBox="0 0 24 24" aria-hidden="true"><path class="pr" d="M7 2.6h10" fill="none" stroke-width="1.5" stroke-linecap="round"/><path d="M10.9 2.9v2.2M13.1 2.9v2.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path fill="currentColor" d="M12 4.6c-2.7 0-4.9 3.4-5.3 7.4-.2 1.9.1 3.5.8 4.6 1-.6 2-.7 2.8-.2l1.7-.8 1.7.8c.8-.5 1.8-.4 2.8.2.7-1.1 1-2.7.8-4.6-.4-4-2.6-7.4-5.3-7.4z"/><path fill="currentColor" d="M12 15.7c-1.4 0-2.4.9-2.4 2.1 0 .8.3 1.4.8 1.8l-.4 2 1.4-1.2h1.2l1.4 1.2-.4-2c.5-.4.8-1 .8-1.8 0-1.2-1-2.1-2.4-2.1z"/><path d="M12 6.6v8.4" fill="none" stroke="var(--terry)" stroke-width=".7" stroke-linecap="round"/></svg>');
    const q = s => D.body.querySelector(s);
    threadEl = q(".dk-thread"); scrollEl = q(".dk-scroll"); stEl = q(".dk-st"); onBtn = q(".dk-on");
    grip(q(".dk-top-in"));
    onBtn.addEventListener("click", turnOn); probeLive();
    input = q(".dk-in"); form = q(".dk-row"); go = q(".dk-go"); chipsEl = q(".dk-chips"); ans = q(".dk-ans"); youEl = q(".dk-you"); textEl = q(".dk-text"); tkEl = q(".dk-tk"); actsEl = q(".dk-acts");
    placeT = setTimeout(rotatePlace, 5000);
    form.addEventListener("submit", e => { e.preventDefault(); if (working) { stop("you"); return; } submit(); });   // while Terry works the button is Stop
    D.el.addEventListener("focusin", () => { if (D.el.dataset.mode === "rest" && !working) setMode(hasChat() ? "answer" : "chips"); });
    D.el.addEventListener("focusout", e => {
      if (D.el.contains(e.relatedTarget)) return;
      if (D.el.dataset.mode === "chips") { setMode("rest"); return; }
      const tabbed = tabAt && Date.now() - tabAt < 300; tabAt = 0;
      if ((e.relatedTarget || tabbed) && D.el.dataset.mode === "answer" && !holdOpen()) fold();   // Tab out of the dock (into the page or past its end) folds it; a focus lost to a redraw does not
    });
    D.el.addEventListener("pointerdown", e => { dragIn = true; if (D.el.dataset.mode === "rest" && !working && hasChat() && e.target !== input) setMode("answer"); });
    doc.addEventListener("pointerup", () => { setTimeout(() => { dragIn = false; }, 0); }, true);
    // a click or tap outside folds the thread back to the resting bar (as Escape does); the chat stays for the next focus
    doc.addEventListener("pointerdown", e => {
      if (!D || D.el.dataset.mode === "rest" || dragIn) return;
      const t = e.target; if (!t || D.el.contains(t)) return;
      if (t.closest && t.closest(".tw, #twpop, #twdefs, .tk-card, .tk-stub, .dock-handle, [role='dialog']")) return;   // a term definition, the ticket Ping is flying
      if (holdOpen()) return;
      fold();
    }, true);
    D.el.addEventListener("keydown", e => { if (e.key === "Tab") tabAt = Date.now(); if (e.key !== "Escape") return; e.stopPropagation(); fold(); });   // Escape folds the chat away; it stays until New chat
    // owner 11 Nov: an answer is read, then the viewer moves on. Their own scrolling (wheel, touch, scroll keys; never the page scrolling
    // itself for a tour) folds the thread back to the bar after a short distance, so an open answer never sits over the page. A tap reopens it.
    { let run = 0, lastAt = 0;
      const away = (e, d) => {
        if (!D || D.el.dataset.mode !== "answer" || holdOpen() || dragIn) return;
        const t = e.target; if (t && t.nodeType === 1 && D.el.contains(t)) return;   // scrolling the thread itself
        if (D.el.contains(doc.activeElement)) return;                                   // typing a follow-up
        const now = Date.now(); if (now - lastAt > 1200) run = 0; lastAt = now;
        run += Math.abs(d); if (run > 220) { run = 0; fold(); }
      };
      addEventListener("wheel", e => away(e, e.deltaMode ? e.deltaY * 30 : e.deltaY), { passive: true, capture: true });
      let ty = null; addEventListener("touchstart", e => { ty = e.touches[0] ? e.touches[0].clientY : null; }, { passive: true, capture: true });
      addEventListener("touchmove", e => { const y = e.touches[0] ? e.touches[0].clientY : null; if (y !== null && ty !== null) { away(e, y - ty); ty = y; } }, { passive: true, capture: true });
      addEventListener("keydown", e => { if (/^(PageDown|PageUp|ArrowDown|ArrowUp|Home|End| )$/.test(e.key) && !(e.target && /^(input|textarea|select)$/i.test(e.target.tagName))) away(e, 400); }, true);
    }
    doc.addEventListener("keydown", e => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target; if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
      e.preventDefault(); input.focus();
    });
    D.built = true; return true;
  }
  // the fold: the thread slides back to the resting bar (the CSS transition; instant under reduced motion), the chat is kept
  function fold() { if (!D || D.el.dataset.mode === "rest") return; if (D.el.contains(doc.activeElement)) doc.activeElement.blur(); setMode("rest"); }
  const holdOpen = () => working || flying || acting;   // Ping is still driving the page (an answer coming, a ticket in the air, actions playing)
  function setMode(m) {
    if (!D) return; const was = D.el.dataset.mode; if (was === m) return; D.el.dataset.mode = m; if (m !== "rest") D.el.dataset.last = m;
    if (m === "chips") renderChips();
    if (m !== "rest") clearFabric(m === "answer" ? 60 + Math.min(260, scrollEl.offsetHeight || ans.offsetHeight || 130) : 104);
    if (m === "answer") toBottom(true);
    if (m === "answer") D.el.setAttribute("aria-label", "Ping Terry, answer"); else D.el.setAttribute("aria-label", "Ping Terry");
  }
  // the dock never sits over the projector: if the fabric would be behind the grown dock, the page scrolls it clear (spec G)
  function clearFabric(dockH) {
    if ((root.TerryGuide && root.TerryGuide.active) || (root.TerryProj && root.TerryProj.running)) return;   // a guide or a chase owns the scroll (owner 12:36, 7 Nov)
    const f = Sh().fabricRect(), top = innerHeight - 6 - dockH, need = f.bottom - (top - 8);
    if (need > 1) { const y = Math.min(need, Math.max(0, doc.documentElement.scrollHeight - innerHeight - scrollY)); if (y > 0) scrollBy({ top: y, behavior: Sh().reduced() ? "instant" : "smooth" }); }
  }

  // ---------------------------------------------------------------- chips (context-aware, 4 at most)
  function chipList() {
    const S = Sh().State(), roosts = S.roosts || [], act = roosts.find(r => r.id === S.activeRoost) || roosts[0], out = [];
    // owner 7 Nov: Spanish in plain sight; a real report in Spanish goes through the same intake as anything typed
    const ES = { label: "Repórtalo en español", run: () => submit("Hay un bache enorme en la calle Centre, cerca de la parada del T") };
    if (!roosts.length) return GOALS.map(g => ({ label: g, run: () => chaseGoal(g) })).concat([ES]);
    const d = act && act.dept || "BTDT";
    out.push({ label: `Why does ${nm(d)} hire in February?`, run: () => submit(`Why does ${nm(d)} hire in February?`) });
    out.push({ label: "What if it snows in January?", run: () => submit("What if it snows in January?") });
    if (roosts.length > 1) out.push({ label: `Compare Roost ${roosts[0].n} with Roost ${roosts[1].n}`, run: () => submit(`Compare Roost ${roosts[0].n} with Roost ${roosts[1].n}`) });
    out.push({ label: "Try a resident report", run: routeSample });
    out.push(ES);
    out.push({ label: "Original plan vs flyway", run: () => submit("Compare the original plan and the flyway") });
    if (T() && T().alerts().some(a => a.events && a.events.length)) out.push({ label: "Before and after the alert", run: () => submit("Before and after the alert") });
    return out.slice(0, 5);
  }
  // a real held-out message goes through the same path as anything typed: it is a report, so it becomes a ticket
  function routeSample() {
    const E = Sh().h && Sh().h.E, m = (E && E.data && E.data.stream || []).filter(x => x.text.length < 240); if (!m.length) return;
    const msg = m[Math.floor(Math.random() * m.length)]; input.value = msg.text; submit();
  }
  function renderChips() {
    chipsEl.textContent = "";
    for (const c of chipList()) { const b = el("button", "dk-chip", esc(c.label)); b.type = "button"; b.title = c.label; b.addEventListener("click", c.run); chipsEl.appendChild(b); }
  }
  function chaseGoal(g) {
    const f = doc.querySelector("#goalform"), i = doc.querySelector("#goalin"); if (!f || !i) return;
    i.value = g; setMode("rest"); input.blur(); scrollTo({ top: 0, behavior: Sh().reduced() ? "instant" : "smooth" });
    try { f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); } catch (e) { console.warn("chase", e && e.message); }
  }

  // ---------------------------------------------------------------- typed compare requests
  function parseCompare(t) {
    const S = Sh().State(), roosts = S.roosts || [], act = roosts.find(r => r.id === S.activeRoost) || roosts[0];
    let m = /compare\s+(?:the\s+)?roosts?\s*#?(\d)\s*(?:and|with|to|vs\.?|versus|against|&)\s*(?:the\s+)?(?:roost\s*)?#?(\d)/i.exec(t);
    if (m) {
      const a = roosts.find(r => r.n === +m[1]), b = roosts.find(r => r.n === +m[2]);
      if (!a || !b || a === b) return { say: roosts.length ? `Terry has ${roosts.length === 1 ? "one roost" : roosts.length + " roosts"} so far. Pick two that exist.` : "There is nothing to compare yet. Chase a goal first." };
      return { a: { label: `Roost ${a.n} · ${a.view === "stay" ? "Original plan" : "Flyway"}`, roostId: a.id, view: a.view || "flyway" }, b: { label: `Roost ${b.n} · ${b.view === "stay" ? "Original plan" : "Flyway"}`, roostId: b.id, view: b.view || "flyway" } };
    }
    if (/\b(stay( the course)?|original( plan)?)\b.{0,16}\b(vs\.?|versus|or|and|with|against)\b.{0,12}\bflyway\b|\bflyway\b.{0,16}\b(vs\.?|versus|or|and|with|against)\b.{0,16}\b(stay|original)\b/i.test(t) || /compare\s+stay the course/i.test(t)) {
      if (!act) return { say: "There is nothing to compare yet. Chase a goal first." };
      return { a: { label: `Roost ${act.n} · Original plan`, roostId: act.id, view: "stay" }, b: { label: `Roost ${act.n} · Flyway`, roostId: act.id, view: "flyway" } };
    }
    if (/before and after|compare.*\b(before|after)\b.*alert|compare.*alert/i.test(t)) {
      const al = T() && T().alerts().find(a => a.events && a.events.length); if (!al) return { say: "Paste an alert first, then I can compare the plan before and after it." };
      if (!act) return { say: "Chase a goal first, then I can compare the plan before and after the alert." };
      return { a: { label: "Before the alert", roostId: act.id, events: [] }, b: { label: "After the alert", roostId: act.id, events: al.events } };
    }
    return null;
  }

  // ---------------------------------------------------------------- the answer
  function setBusy(on) {
    working = on; D.el.dataset.busy = on ? "1" : "0"; go.classList.toggle("spin", on); go.classList.toggle("stop", on); go.disabled = false; input.disabled = on;
    go.setAttribute("aria-label", on ? "Stop" : "Ping"); go.title = on ? "Stop" : "Ping";
    input.placeholder = on ? "Listening..." : D.el.dataset.kind === "ask" ? "Add a detail, or pick one" : placeNow();
    // the field takes the keyboard back only if nothing else has it: an answer must not pull focus out of the goal box or any other field
    if (!on) { const a = doc.activeElement; if (!a || a === doc.body || a === go || D.el.contains(a)) input.focus({ preventScroll: true }); }
  }
  // ---------------------------------------------------------------- the chat: earlier turns stay above the live one, in order, until New chat
  const hasChat = () => !cleared || !!(threadEl && threadEl.children.length);
  function fitGuide() { if (!scrollEl || !D) return; if (D.el.dataset.kind !== "guide") { scrollEl.style.maxHeight = ""; return; } const a = ans && ans.offsetHeight; if (a) scrollEl.style.maxHeight = Math.min(innerHeight * 0.5, a + 18) + "px"; }
  function toBottom(instant) { if (!scrollEl) return; fitGuide(); requestAnimationFrame(() => { fitGuide(); try { scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: instant || Sh().reduced() ? "instant" : "smooth" }); } catch (e) { scrollEl.scrollTop = scrollEl.scrollHeight; } }); }
  // the live turn is copied into the thread as plain, inert content (no ids, no action buttons) before the next one is drawn
  function freeze() {
    if (cleared || (!youEl.textContent && D.el.dataset.kind !== "guide")) return;
    const li = el("li", "dk-turn"), kind = D.el.dataset.kind || "answer"; li.dataset.kind = kind;
    if (youEl.textContent) { const you = el("p", "t-you"); you.textContent = youEl.textContent; li.appendChild(you); }
    if ((kind === "ticket" || kind === "ask") && tkEl.innerHTML) { const t = tkEl.cloneNode(true); t.className = tkEl.className.replace(/\bdk-tk\b/, "t-tk").replace(/\bwait\b/, ""); t.removeAttribute("aria-live"); t.querySelectorAll(".tk-opts").forEach(x => x.remove()); li.appendChild(t); }
    if (textEl.textContent.trim()) { const t = textEl.cloneNode(true); t.className = "t-text"; t.removeAttribute("aria-live"); t.removeAttribute("tabindex"); t.querySelectorAll("button").forEach(b => b.remove()); li.appendChild(t); }
    const from = actsEl.querySelector(".dk-from"); if (from) { const f = from.cloneNode(true); f.className = "t-from"; f.removeAttribute("style"); li.appendChild(f); }
    threadEl.appendChild(li);
    while (threadEl.children.length > 12) threadEl.firstElementChild.remove();   // the page keeps the last 12 turns on screen; Terry remembers the last 6
  }
  function wipeLive() { D.el.dataset.kind = ""; youEl.textContent = ""; textEl.textContent = ""; tkEl.textContent = ""; tkEl.className = "dk-tk"; actsEl.textContent = ""; }
  function beginTurn() { freeze(); wipeLive(); }
  async function newChat() {
    wipeLive(); threadEl.textContent = ""; clear();
    try { const c = await Sh().ensure(); c && c.A && c.A.reset && c.A.reset(); } catch (e) {}
    input.focus({ preventScroll: true });
  }
  function actBtn(label, fn) { const b = el("button", "", esc(label)); b.type = "button"; b.addEventListener("click", fn); return b; }
  // "Lead-in. 1) First. 2) Second." -> {lead, items}: the numbers must run 1, 2, 3 in order, and two at least; otherwise null
  function listParts(t) {
    const re = /(^|[\s:;])(\d{1,2})[.)]\s+(?=\S)/g, hits = []; let m, want = 1;
    while ((m = re.exec(t))) { if (+m[2] === want) { hits.push({ at: m.index + m[1].length, body: m.index + m[0].length }); want++; } }
    if (hits.length < 2) return null;
    const items = hits.map((h, i) => t.slice(h.body, i + 1 < hits.length ? hits[i + 1].at : t.length).trim()).filter(Boolean);
    return items.length >= 2 ? { lead: t.slice(0, hits[0].at).trim(), items } : null;
  }
  function showAnswer(q, o) {
    cleared = false; lastAnswer = o; youEl.textContent = q; youEl.title = q; D.el.dataset.kind = "answer"; tkEl.textContent = ""; pending = null;
    textEl.textContent = ""; textEl.scrollTop = 0;
    const lp = o.emergency ? null : listParts(String(o.text || ""));
    if (lp) {   // numbered points read as a list under their lead-in (text only, never markup from the model)
      if (lp.lead) { const p = el("span", "dk-lead"); p.textContent = lp.lead; textEl.appendChild(p); }
      const ol = el("ol", "dk-list"); for (const it of lp.items) { const li = el("li"); li.textContent = it; ol.appendChild(li); } textEl.appendChild(ol);
    } else { const p = el(o.emergency ? "strong" : "span", o.emergency ? "sos" : ""); p.textContent = o.text; textEl.appendChild(p); }
    if (o.warn) textEl.appendChild(el("span", "warn", esc(o.warn)));
    if (o.meta) textEl.appendChild(el("span", "meta", esc(o.meta)));
    if (o.options && o.options.length) { const w = el("span", "meta"); for (const x of o.options) { const b = el("button", "try", esc(x)); b.type = "button"; b.addEventListener("click", () => o.pick(x)); w.appendChild(b); } textEl.appendChild(w); }
    if (o.retry) { const b = el("button", "try", "Try again"); b.type = "button"; b.addEventListener("click", o.retry); textEl.appendChild(b); }
    actsEl.textContent = "";
    if (o.sources && o.sources.length) { const w = el("span", "dk-from"); w.appendChild(doc.createTextNode("From: ")); for (const x of o.sources) { const c = el("span", "dk-src", esc(x.label)); c.title = x.id; w.appendChild(c); } actsEl.appendChild(w); }
    // one follow-on per kind of answer: show it (on the map or the screen), compare an alert, or try a question Terry can answer
    if (o.actions && o.actions.length) actsEl.appendChild(actBtn(o.actions.every(a => a.type === "map") ? "Show on the map" : "Show on the screen", () => runActions(o.actions, true)));
    if (o.alert && o.alert.events && o.alert.events.length) actsEl.appendChild(actBtn("Compare before and after", () => T().compareAlert(o.alert)));
    if (o.suggest) for (const x of o.suggest) actsEl.appendChild(actBtn(x, () => submit(x)));
    actsEl.appendChild(newBtn());
    setMode("answer"); toBottom();
  }
  function newBtn() { const b = actBtn("New chat", newChat); b.className = "dk-new"; b.title = "Start over: clears this chat and what Terry remembers of it"; return b; }
  // Stop (owner 7 Nov, the live model can take up to 45 s): cancels the request; submit() then says it stopped and offers the question again
  function stop(why) { if (!working || !ctl) return; stopWhy = why || "you"; try { ctl.abort(); } catch (e) {} }
  function clear() {
    cleared = true; lastAnswer = null; pending = null; D.el.dataset.kind = ""; if (ctl) { try { ctl.abort(); } catch (e) {} }
    if (input.placeholder === "Add a detail, or pick one") input.placeholder = placeNow();
    setMode(doc.activeElement && D.el.contains(doc.activeElement) ? "chips" : "rest");
    Sh().emit("ask:highlight", { dept: null, months: [], clear: true });
    const hi = doc.querySelector("#askHi"); if (hi) hi.textContent = "";
  }

  // page actions: the bus first (the projector's owner performs them), the dock itself when nobody answers
  async function runActions(list, replay) {
    const h = Sh().h; if (!h) return;
    acting = true; try { await runActions0(list, replay, h); } finally { acting = false; }
  }
  async function runActions0(list, replay, h) {
    for (const a of list || []) {
      if (cleared && !replay) break;
      try {
        await h.settled(); const st = h.state();
        if (a.type === "zoom") {
          const p = { level: a.level, dept: a.dept || null, month: a.month == null ? null : a.month, handled: false }; Sh().emit("ask:zoom", p);
          if (!p.handled) await h.goTo(a.level === 0 ? { lvl: 0 } : { lvl: a.level, d: a.dept, m: a.month === null || a.month === undefined ? undefined : a.month });
        } else if (a.type === "highlight") {
          const p = { dept: a.dept, months: [a.month], what: a.what, handled: false }; Sh().emit("ask:highlight", p);
          if (!p.handled) h.highlight(a.dept, a.month, a.what);
        } else if (a.type === "map") {   // the equity map (quiet.js) opens its card and lights the neighborhoods
          const p = { map: a.neighborhoods || [], handled: false }; Sh().emit("ask:highlight", p);
          if (!p.handled && root.TerryQuiet) { root.TerryQuiet.open(true); root.TerryQuiet.highlight(p.map); }
        } else if (a.type === "why") { if (st.lvl !== 1 || st.d !== a.dept) { await h.goTo({ lvl: 1, d: a.dept, m: a.month }); await h.settled(); } h.openWhy(a.dept, a.month); }
        else if (a.type === "play") { await h.streets(true); await h.settled(); h.scene.setActive(a.dept); h.scene.seekMonth(a.month); h.scene.play(); }
      } catch (e) { console.warn("ping action failed", a, e && e.message); }
      await sleep(Sh().reduced() ? 100 : 800);
    }
  }

  async function submit(text) {
    if (!D) return; text = String(text === undefined ? input.value : text).trim();
    if (working) return;
    if (!text) {
      form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); input.placeholder = "Say something first."; clearTimeout(emptyT);
      emptyT = setTimeout(() => { if (!working) input.placeholder = placeNow(); }, 2000); return;
    }
    input.value = ""; beginTurn();
    // an emergency is never a ticket and never waits for the model: call 911, plainly and first
    { const A0 = root.TerryAsk; if (A0 && A0.isEmergency && A0.isEmergency(text)) { showAnswer(text, { text: A0.EMERGENCY_TEXT, emergency: true, meta: A0.EMERGENCY_MORE }); Sh().logAction({ kind: "ping", label: "Emergency: told to call 911" }); return; } }
    if (!Sh().h) { showAnswer(text, { text: "Terry is still waking up. Try again in a moment.", retry: () => submit(text) }); return; }
    // "why does the flip differ": answered from the card's own numbers (owner 21:14); works offline
    if (/why .*(flip|card).*(differ|2023|2024|last year|cannot fail|can.?t fail)|why does (this|the flip) differ/i.test(text)) {
      const S0 = Sh().State(), rr = S0 && (S0.roosts || []).find(r => r.id === S0.activeRoost), cd = root.__flipAsk || (rr && rr.flip && rr.flip.card) || root.__flipNow; root.__flipAsk = null;
      if (cd && cd.why) { Sh().logAction({ kind: "ping", label: "Pinged: " + text }); showAnswer(text, { text: whyFlip(cd.why), sources: [{ id: "glossary-record-versus-model", label: "Glossary, Record versus model" }, { id: "page-state", label: "This page, right now" }] }); return; }
    }
    // commands: pick a day, zoom, switch or compare plans, day and night, play a month (owner 20:30); a missing part becomes a choice
    { const N = root.TerryNav, c = N && N.parseCommand ? N.parseCommand(text) : null;
      if (c) { const done = await runCommand(text, c); if (done) return; } }
    // navigation: "go to the predators", "show me the flyway" -> Terry takes you there and lights it (owner 20:05)
    { const G = root.TerryGuide, k = G && G.navTarget ? G.navTarget(text) : null;
      if (k) {
        Sh().logAction({ kind: "ping", label: "Pinged: " + text });
        const r = await G.go(k);
        const later = { pred: "The predators", fly: "The flyway", fail: "The flip" }[k];
        showAnswer(text, { text: r.ok ? `Here ${/s$/.test(r.name) && !/^the (projector|ledger)/.test(r.name) ? "are" : "is"} ${r.name}. I've lit it up for a few seconds.` : later && r.why === "missing" ? `${later} appear${k === "pred" ? "" : "s"} once you chase a goal. Give me one in the box at the top and I'll show you.` : "I can't take you there right now; try again in a moment." });
        return;
      } }
    const cmp = parseCompare(text);
    if (cmp) {
      if (cmp.say) { showAnswer(text, { text: cmp.say }); return; }
      Sh().logAction({ kind: "ping", label: "Pinged: " + text });
      const ok = Sh().emitCompare(cmp.a, cmp.b);
      showAnswer(text, { text: `Comparing ${cmp.a.label} with ${cmp.b.label}.`, meta: ok ? "A is drawn solid on the screen, B as outlines." : "" }); return;
    }
    const my = ++turnSeq;
    setBusy(true); ctl = new AbortController(); cleared = false; youEl.textContent = text; youEl.title = text; textEl.innerHTML = '<span class="dk-wait">Listening...</span>'; setMode("answer"); toBottom();
    try {
      const c = await Sh().ensure();
      const rt = c.A && c.A.route ? c.A.route(text).route : null;
      // after a follow-up, a typed line is the missing detail unless it is plainly a question, a what-if, a comparison or an alert
      const detail = pending && !(rt && rt !== "resident" && rt !== "out_of_scope") && !isQuestion(text);
      if (rt === "resident" || detail) await doReport(text, c); else if (rt ? rt === "alert" : isAlert(text)) await doAlert(text, c); else await doAsk(text, c);
    } catch (e) {
      if (!(e && e.code === "cancelled")) { console.warn("ping failed", e && e.message); showAnswer(text, { text: "Terry did not hear that. Try again.", retry: () => submit(text) }); }
      else if (stopWhy === "you" && my === turnSeq) showAnswer(text, { text: "Stopped. Ask again whenever you like.", retry: () => submit(text) });
    } finally { if (my === turnSeq) { stopWhy = null; setBusy(false); } }
  }
  function whyFlip(w) {
    const P = v => (v == null ? "" : Math.round(v * 100) + "%"), P1 = v => (Math.round(v * 1000) / 10).toFixed(1).replace(/\.0$/, "") + "%", tg = Math.round(w.target * 100) + "%";
    const yrs = w.record_2023 != null ? `${P(w.record_2023)} in 2023 and ${P(w.record_2024)} in 2024` : `${P(w.record_2024)} in 2024`;
    const mixed = w.record_2023 != null && (w.record_2023 >= w.target) !== (w.record_2024 >= w.target);
    const mix = mixed ? ` The two years disagree, so the record alone is not a pattern: ${w.record_2024 >= w.target ? "2024 made it and 2023 did not" : "2023 made it and 2024 did not"}. I lean on 2024, the nearer year, and on the model for the plan itself.` : "";
    if (w.record_2024 != null && w.record_2024 < w.target) {
      return `${w.dept} closed ${yrs} on time in ${w.window}, with the crews Boston actually had. The card's 2025 result is my simulator running this plan's crews under the brief's rules, and it reaches ${P1(w.model_forecast)}. ` +
        `The two differ because the plan's crews are not last year's, and the brief's capacities are planning assumptions, not measurements.` +
        (w.gentle ? ` The model is also gentler than real life on ${w.dept}: its due dates are long, so few requests go late on paper.` : "") +
        ` So read the card as the plan's best case on paper, and the record as how real work can fall short of ${tg}.` + mix;
    }
    return `${w.dept} made ${yrs} on time in ${w.window}, over ${tg}, but my simulator says this plan as forecast reaches only ${P1(w.model_forecast)}. ` +
      `That gap is mostly the model: it follows the brief's planning capacities, not measured ones${w.harsh ? `, and it is harsher than real life on ${w.dept}` : ""}. ` +
      `The flyway's crews reach ${P1(w.model_flyway)} in the model, so the card's warning is about the model's margin, not a sign last year's ${w.dept} would slip.` + mix;
  }
  // ---------------------------------------------------------------- commands (owner 20:30): Ping works the page
  const DNAME = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const MONN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const glow = key => { const G = root.TerryGuide; if (G && G.go) return G.go(key).catch(() => null); return Promise.resolve(null); };
  const choose = (text, say, opts, run) => showAnswer(text, { text: say, options: opts.map(o => o.label), pick: lab => { const o = opts.find(x => x.label === lab); if (o) { beginTurn(); run(o); } } });
  const deptOpts = () => Object.keys(DNAME).map(k => ({ label: DNAME[k], dept: k }));
  async function runCommand(text, c) {
    const z = root.__zoom, L = root.TerryLedger; if (!z || !z.ready) return false;
    Sh().logAction({ kind: "ping", label: "Pinged: " + text });
    const curDept = () => (z.S && z.S.lvl >= 1 ? z.S.d : null);
    if (c.cmd === "theme") {
      const b = doc.querySelector(`[data-theme-set="${c.theme}"]`); if (b) b.click();
      showAnswer(text, { text: c.theme === "night" ? "Lights down: Night." : "Lights up: Day." }); return true;
    }
    if (c.cmd === "zoom") {
      if (c.lvl === 0) { await z.goTo({ lvl: 0 }); await glow("projector"); showAnswer(text, { text: "Back to all four departments." }); return true; }
      await z.goTo(c.lvl === 2 ? { lvl: 2, d: c.dept, m: c.month } : { lvl: 1, d: c.dept }); await glow("projector");
      showAnswer(text, { text: c.lvl === 2 ? `${DNAME[c.dept]}, ${MONN[c.month]}, day by day.` : `${DNAME[c.dept]}, the whole year.` }); return true;
    }
    if (c.cmd === "day" || c.cmd === "play") {
      if (c.cmd === "day") {
        if (c.year && c.year !== 2025) { showAnswer(text, { text: `I plan 2025, so the days I can show are in 2025. Want ${MONN[c.month]} ${c.day}, 2025?`, options: [`${MONN[c.month]} ${c.day}, 2025`], pick: x => submit("choose " + x) }); return true; }
        const N = root.TerryNav, di = N.dayOfYear(c.month, c.day); if (di < 0) { showAnswer(text, { text: `${MONN[c.month]} has no day ${c.day}.` }); return true; }
      }
      const mo = c.month == null ? (z.S && z.S.lvl === 2 ? z.S.m : null) : c.month;
      if (mo == null) { choose(text, "Which month should I play?", MONN.map((m, i) => ({ label: m, m: i })), o => runCommand(`${text}: ${o.label}`, Object.assign({}, c, { month: o.m }))); return true; }
      const dp = c.dept || curDept();
      if (!dp) { choose(text, c.cmd === "day" ? `Which department's ${MONN[mo]} ${c.day} should I show?` : `Whose ${MONN[mo]} should I play?`, deptOpts(), o => runCommand(`${text}: ${o.label}`, Object.assign({}, c, { dept: o.dept, month: mo }))); return true; }
      await z.goTo({ lvl: 2, d: dp, m: mo }); await new Promise(r => setTimeout(r, 450));
      const sc = z.scene;
      if (c.cmd === "day") {
        const di = root.TerryNav.dayOfYear(mo, c.day); if (sc) { try { sc.pause(); sc.setDay(di + 0.5); } catch (e) {} }
        await glow("projector"); const wd = new Date(2025, mo, c.day).toLocaleDateString("en-US", { weekday: "long" });
        showAnswer(text, { text: `${wd}, ${MONN[mo]} ${c.day}, 2025, for ${DNAME[dp]}. The day line is on it; hover the bars for that day's numbers.${/saturday|sunday/i.test(wd) ? " It's a weekend, so the crews are off." : ""}` }); return true;
      }
      if (sc) { try { sc.setDay(root.TerryNav.dayOfYear(mo, 1)); sc.play(); } catch (e) {} }
      await glow("projector"); showAnswer(text, { text: `Playing ${MONN[mo]} for ${DNAME[dp]}: the street shows who is working, idle or in training each day.` }); return true;
    }
    if (c.cmd === "plan" || c.cmd === "compare") {
      if (!L || !L.plans) return false;
      const keys = L.plans(), lab = k => (L.label ? L.label(k) : k), now = L.plan;
      if (c.cmd === "plan") { if (!keys.includes(c.plan)) return false; L.select(c.plan); await glow("ledger"); showAnswer(text, { text: `The ${lab(c.plan)} plan is on the ledger now.` }); return true; }
      const pair = async (a, b) => { if (a !== L.plan) L.select(a); L.compareWith(b); await glow("ledger"); showAnswer(text, { text: `Comparing ${lab(a)} with ${lab(b)} on the ledger: each row shows where they differ.` }); };
      if (c.a && c.b && keys.includes(c.a) && keys.includes(c.b) && c.a !== c.b) { await pair(c.a, c.b); return true; }
      if (c.b && keys.includes(c.b) && c.b !== now) { await pair(now, c.b); return true; }
      // several fit: list them and let the viewer choose (plans on the ledger, and Roosts when there are two or more)
      const opts = keys.filter(k => k !== now).map(k => ({ label: `${lab(now)} with ${lab(k)}`, a: now, b: k }));
      const St = Sh().State(), rs = (St && St.roosts) || [];
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) opts.push({ label: `Roost ${rs[i].n} with Roost ${rs[j].n}`, roost: [rs[i].n, rs[j].n] });
      choose(text, opts.length > 1 ? "Which do you want to compare?" : "Compare these?", opts, o => { if (o.roost) submit(`compare roost ${o.roost[0]} with roost ${o.roost[1]}`); else pair(o.a, o.b); });
      return true;
    }
    return false;
  }
  async function doAsk(q, c) {
    if (!c.A) throw new Error("ask module missing");
    let streamEl = null;
    const onText = t => { if (cleared) return; if (!streamEl) { textEl.textContent = ""; streamEl = el("span", "dk-stream"); textEl.appendChild(streamEl); } streamEl.textContent = t; textEl.scrollTop = textEl.scrollHeight; };
    const r = await c.A.ask(q, { signal: ctl.signal, onText, onTool: t => { const f = TOOLTXT[t.tool]; input.placeholder = "Listening... " + (f ? f(t.input) : "checking the numbers"); } });
    if (r.fallback || r.mode === "live") probeLive();   // a refused or a first granted call changes the indicator
    Sh().logAction({ kind: "ping", label: "Pinged: " + q, restore: {} });
    const oos = r.route === "out_of_scope" && r.mode === "rules", act = (Sh().State().roosts || []).find(x => x.id === Sh().State().activeRoost);
    const o = { text: r.answer, suggest: oos ? [act ? "What is the most dangerous predator in this roost?" : "What is a flyway?", `Why does ${nm(act && act.dept || "BTDT")} hire in February?`] : null, actions: r.actions || [], meta: r.fallback ? (r.fallback === "rate_limited" ? "Today's live answers are used up, so this is a quick answer." : FAILED) : oos || r.route === "chat" || r.mode === "live" || (r.trace || []).some(t => t.tool === "session_state") ? "" : (r.trace || []).some(t => t.tool === "neighborhood_profile") ? "Worked out from 2024 requests by neighborhood." : "Worked out from the plan's numbers.", sources: r.source_chips || [], warn: r.checked === false ? "A number could not be verified and was removed." : "" };
    showAnswer(q, o); nudgeLive(r); Sh().emit("ask:answered", { q, r });
    await runActions(o.actions);
  }
  async function doAlert(q, c) {
    const res = await T().runAlert(q, { log: "Pinged: " + q });
    if (res.kind === "question") { showAnswer(q, { text: res.r.text, options: res.r.options || [], pick: o => submit(`${q} ${o}`), meta: "" }); return; }
    if (res.kind === "note") { showAnswer(q, { text: res.r.text, meta: "Try asking about a month, a department, or paste a weather alert." }); return; }
    const a = res.alert, first = a.lines.slice(0, 3).join(" ");
    showAnswer(q, { text: `${a.label}. ${first}${a.tail ? " " + a.tail : ""}`, alert: a, meta: res.live ? "" : "Sized from the plan's numbers and past events like it." });
    Sh().emit("ask:answered", { q, r: res.r });
  }

  // ---------------------------------------------------------------- a resident report: the intake runs, then the ticket flies (ticket.js) and lands in the record (territory.js)
  const fieldPoint = () => { const r = input.getBoundingClientRect(); return { x: r.left + Math.min(80, r.width / 3), y: r.top + r.height / 2 }; };
  async function doReport(q, c, pick) {
    const I = c.I; if (!I) throw new Error("intake module missing");
    const was = pending; pending = null; pick = pick || (was && was.pick) || null; const asked = !!(was && was.q);
    const text = was && was.q && !pick ? `${was.q} ${q}` : (was && was.q ? was.q : q);
    const steps = { read: "Reading it...", retrieve: "Looking up request types...", choose: "Looking up request types..." };
    input.placeholder = I.live() ? steps.read : steps.retrieve;
    const place = (was && was.place) || null;
    const r = await I.route(text, { signal: ctl.signal, pick, place, onStep: st => { input.placeholder = steps[st] || steps.read; } });
    if (r.emergency) { const A0 = root.TerryAsk; showAnswer(q, { text: r.note, emergency: true, meta: A0 && A0.EMERGENCY_MORE }); return; }
    if (r.note) { showAnswer(q, { text: r.note }); if (r.text) { try { T() && T().record && T().record({ text: r.text, choice: null, mode: r.mode, asked }); } catch (e) {} } return; }
    if (r.ask) { showAsk(q, r, text); return; }
    const T2 = root.TerryTicket, p = T2 && T2.pickDay ? T2.pickDay(r.choice.dept) : null, entry = { text, choice: r.choice, mode: r.mode, lang: r.lang, flagged: r.flagged, asked, place: r.place || null };
    showTicket(q, entry, p, "landing"); Sh().logAction({ kind: "ping", label: "Reported: " + cap(text, 60) });
    const from = fieldPoint(); setBusy(false);
    let res = { landed: false, pick: p };
    flying = true; try { if (T2) res = await T2.land(entry, from); } catch (e) { console.warn("ticket", e && e.message); } finally { flying = false; }
    // only the latest thing in the dock is redrawn: an answer or a newer report that arrived during the flight stays
    entry.pick = res.pick || p; if (lastAnswer && lastAnswer.ticket === entry) showTicket(q, entry, entry.pick, res.landed ? "landed" : "held");
    try { T() && T().record && T().record(entry); } catch (e) { console.warn("record", e && e.message); }
    Sh().emit("intake:routed", { entry });
    try { c.A && c.A.note && c.A.note(q, `Your report became a ticket: ${r.choice.plain}, ${NAMES[r.choice.dept]}${entry.place ? ", " + entry.place.short : ""}.`); } catch (e) {}
    Sh().emit("ask:answered", { q, r: { answer: `${r.choice.plain}, ${NAMES[r.choice.dept]}`, route: "resident", choice: r.choice } });
  }
  // the ticket row: a punched paper strip, never prose, so an answer and a report cannot be confused
  function ticketHtml(entry, p, state) {
    const c = entry.choice, T2 = root.TerryTicket, short = c.plain !== c.type;
    const day = p && T2 ? T2.dateShort(p) : "";   // the date only: the day's load is read on the screen
    return `<i class="tk-rule" style="background:${ACC[c.dept]}"></i>
      <span class="tk-c1"><b>${TAGN[c.dept]}</b><span>${esc(c.queueName)}</span></span>
      <span class="tk-c2"${short ? ` title="${esc(c.type)}"` : ""}><b>${esc(c.plain)}</b>${short ? `<span>${esc(c.type)}</span>` : ""}</span>
      <span class="tk-c3">${esc(day)}${entry.place ? `<span>${esc(entry.place.short)}</span>` : ""}</span>`;
  }
  function showTicket(q, entry, p, state) {
    cleared = false; lastAnswer = { ticket: entry }; youEl.textContent = q; youEl.title = q; D.el.dataset.kind = "ticket"; pending = null;
    tkEl.className = "dk-tk" + (state === "landing" ? " wait" : ""); tkEl.innerHTML = ticketHtml(entry, p, state);
    textEl.textContent = ""; if (entry.mode === "rules") textEl.appendChild(el("span", "meta", "Matched by keywords. With the model on, Terry reads the whole message."));
    actsEl.textContent = "";
    if (state !== "landing") actsEl.appendChild(actBtn("Show on the screen", async () => { try { const T2 = root.TerryTicket; if (T2) await T2.land(entry, null); } catch (e) {} }));
    actsEl.appendChild(newBtn());
    setMode("answer"); toBottom();
  }
  // the follow-up: the same strip, blank and dashed, Terry's question on it and the candidates as choices
  function showAsk(q, r, text) {
    cleared = false; lastAnswer = { ask: r.ask }; youEl.textContent = q; youEl.title = q; D.el.dataset.kind = "ask"; pending = { q: text };
    tkEl.className = "dk-tk ask"; tkEl.innerHTML = `<span class="tk-ask"><b>${esc(r.ask.question)}</b></span><span class="tk-opts" role="group" aria-label="Pick one"></span>`;
    const opts = tkEl.querySelector(".tk-opts");
    for (const o of r.ask.options) { const b = el("button", "dk-chip", esc(o.plain)); b.type = "button"; b.title = o.type; b.addEventListener("click", () => pickChoice(o, text)); opts.appendChild(b); }
    textEl.textContent = ""; actsEl.textContent = ""; actsEl.appendChild(newBtn());
    input.placeholder = "Add a detail, or pick one"; setMode("answer"); toBottom();
  }
  async function pickChoice(o, text) {
    if (working) return; beginTurn(); const my = ++turnSeq; setBusy(true); ctl = new AbortController(); cleared = false;
    try { const c = await Sh().ensure(); pending = { q: text, pick: o.type, place: o.place || null }; await doReport(o.plain, c, o.type); }
    catch (e) { if (!(e && e.code === "cancelled")) { console.warn("pick failed", e && e.message); showAnswer(o.plain, { text: "Terry did not hear that. Try again." }); }
      else if (stopWhy === "you" && my === turnSeq) showAnswer(o.plain, { text: "Stopped. Ask again whenever you like." }); }
    finally { if (my === turnSeq) { stopWhy = null; setBusy(false); } }
  }

  // ---------------------------------------------------------------- live or offline: a quiet indicator, and a way to turn live answers on
  const FAILED = (root.TerryAsk && root.TerryAsk.FAILED) || "Couldn't reach the live model, so this is a quick answer.";
  let permNs, permState = null, hasSample = false;
  const permsP = () => permNs !== undefined ? Promise.resolve(permNs) : (async () => { try { permNs = root.terryHost && root.terryHost.use ? await root.terryHost.use("permissions") : null; } catch (e) { permNs = null; } return permNs; })();
  // reads only: permissions.state never prompts. Never requests on load.
  async function probeLive() {
    const P = await permsP(); let st = null; try { st = P ? await P.state("sample") : null; } catch (e) { st = null; }
    let s = null; try { s = root.TerryProj && root.TerryProj.getSample ? await root.TerryProj.getSample() : root.terryHost && root.terryHost.use ? await root.terryHost.use("sample") : null; } catch (e) { s = null; }
    hasSample = !!s; permState = st || (s ? "granted" : "unavailable"); renderStatus();
  }
  async function liveA() { try { const c = await Sh().ensure(); return c && c.A; } catch (e) { return null; } }
  async function renderStatus() {
    if (!stEl) return; const A0 = root.TerryAsk, A = Sh().h ? await liveA() : null;
    const x = A0 && A0.liveStatus ? A0.liveStatus(permState, hasSample, A && A.lastLive ? A.lastLive() : null) : { live: false, reason: "unavailable", label: "Offline: quick answers", tip: "", action: null };
    stEl.dataset.st = x.live ? "live" : x.reason; stEl.querySelector(".dk-st-t").textContent = x.label; stEl.querySelector(".dk-st-tip").textContent = x.tip;
    stEl.setAttribute("aria-label", `${x.label}. ${x.tip}`); if (D) D.el.dataset.live = x.live ? "1" : "0";
    onBtn.hidden = !x.action; onBtn.dataset.action = x.action || ""; onBtn.textContent = x.button || "Turn on live answers";
  }
  // the first question answered offline, while live answers can be turned on: one quiet line under it, once per page load
  let nudged = false;
  function nudgeLive(r) {
    if (nudged) return; nudged = true;
    if (!r || r.mode === "live" || !(permState === "prompt" || permState === "denied") || !hasSample || !onBtn || onBtn.hidden || !onBtn.dataset.action) return;
    const w = el("span", "meta dk-nudge"), b = el("button", "", "Turn on live answers"); b.type = "button";
    b.style.cssText = "background:none;border:0;padding:0;margin:0;font:inherit;color:var(--lf-text);text-decoration:underline;text-underline-offset:2px;cursor:pointer";
    b.addEventListener("click", turnOn);
    w.append("Quick answer. ", b, " for Terry's full reasoning.");
    const said = [...textEl.querySelectorAll(":scope > .meta")].find(x => x.textContent === FAILED); if (said) said.remove();   // one quiet line, not two saying "quick answer"
    textEl.appendChild(w);
  }
  // from a click only: one dialog at most (request), or the platform's Permissions panel when the viewer said no before (manage)
  async function turnOn() {
    const P = await permsP(), act = onBtn.dataset.action; if (!P) return;
    onBtn.disabled = true;
    try {
      if (act === "manage") { try { await P.manage(); } catch (e) { stEl.querySelector(".dk-st-tip").textContent = "Open this page's Permissions menu and switch live answers on."; } }
      else await P.request(["sample"]);
      let s = null; try { s = root.terryHost && root.terryHost.use ? await root.terryHost.use("sample") : null; } catch (e) { s = null; }
      let st = null; try { st = await P.state("sample"); } catch (e) { st = null; }
      if (s && st === "granted") { const A = await liveA(); if (A && A.setSample) A.setSample(s); try { const c = await Sh().ensure(); c.sample = s; } catch (e) {} }
    } finally { onBtn.disabled = false; await probeLive(); }
  }

  // ---------------------------------------------------------------- mounting
  function mount(host, h) {
    try {
      if (host) host.hidden = true;                       // the nav's Ask Terry slot is retired; the dock replaces it
      build(); Sh().setHandlers(h);
      return { submit, open: () => input && input.focus(), close: clear, get input() { return input; }, button: go };
    } catch (e) { console.warn("ping mount", e && e.message); return {}; }
  }
  // the guide speaks through Ping (owner 12:36): a Terry turn marked "Guide", typed in, kept in the thread and in Terry's memory, so the
  // viewer can reply at once. o.ask: with live answers on, the model explains (it remembers its own answer); otherwise the text is typed
  // and noted as what Terry said about o.q. o.next: a Next button (reduced motion). Resolves when the line is in.
  async function guide(text, o) {
    o = o || {}; if (!D && !build()) return false;
    const dk = Sh().dock; if (dk && dk.el) dk.el.removeAttribute("data-hidden");
    if (working && ctl) { stopWhy = "guide"; textEl.textContent = "I stopped this to show you something. Ask it again whenever you like."; try { ctl.abort(); } catch (e) {} }
    beginTurn(); wipeLive(); cleared = false; lastAnswer = null; pending = null; D.el.dataset.kind = "guide";
    textEl.appendChild(el("span", "dk-glab", "Terry")); const sp = el("span", "dk-stream"); textEl.appendChild(sp);
    setMode("answer"); toBottom(true);
    let said = null, c = null;
    // the line types at once; the model is only waited for when it is to explain (owner 7 Nov: no empty pause between highlights)
    if (o.ask && D.el.dataset.live === "1") { try { c = await Sh().ensure(); } catch (e) { c = null; } }
    if (o.ask && c && c.A && D.el.dataset.live === "1") {
      try { const r = await c.A.ask(o.ask, { onText: t => { sp.textContent = t; fitGuide(); } }); if (r && r.mode === "live" && r.answer) { said = r.answer; sp.textContent = said; } } catch (e) { said = null; }
    }
    if (!said) {
      said = String(text || "");
      if (Sh().reduced()) sp.textContent = said;
      else await new Promise(res => { const t0 = performance.now(), cps = 70; (function f(now) { const n = Math.min(said.length, Math.ceil((now - t0) / 1000 * cps)); sp.textContent = said.slice(0, n); fitGuide(); if (n < said.length && D.el.dataset.kind === "guide") requestAnimationFrame(f); else { sp.textContent = said; res(); } })(t0); });
      const q = o.q || "What is this part of the page?", ln = said; if (c && c.A && c.A.note) c.A.note(q, ln); else Promise.resolve().then(() => Sh().ensure()).then(x => { if (x && x.A && x.A.note) x.A.note(q, ln); }, () => {});
    }
    actsEl.textContent = ""; if (o.next) { const b = actBtn("Next", o.next); b.className = "dk-next"; actsEl.appendChild(b); }
    toBottom(); return true;
  }
  root.TerryAskUI = { mount }; root.TerryPing = { mount, submit, clear, guide, fold: () => fold(), focus: () => { if (!D && !build()) return false; Sh().dock && Sh().dock.el.removeAttribute("data-hidden"); const hd = doc.querySelector(".dock-handle"); if (hd) hd.hidden = true; input.focus({ preventScroll: true }); return true; } };

  // the Roost never starts under the resting dock: when its heading would fall in the dock's band at scroll 0, the Roost moves just below
  // the fold (a margin held in --dk-clear, measured without itself so it never feeds back). Debounced, so a pull settles first.
  let clrT = 0;
  function clearRoost() {
    clearTimeout(clrT); clrT = setTimeout(() => {
      try {
        const t = doc.querySelector("#terrytory"), hd = t && (t.querySelector(".tt-head") || t.firstElementChild); if (!t) return;
        if (doc.documentElement.classList.contains("mx-open")) return;
        const ex = parseFloat(t.style.getPropertyValue("--dk-clear")) || 0, top = t.getBoundingClientRect().top + scrollY - ex;
        const headH = Math.max(90, hd ? hd.getBoundingClientRect().height + 16 : 90), band = innerHeight - 88;
        const need = top < innerHeight && top + headH > band ? Math.ceil(innerHeight + 12 - top) : 0;
        if (Math.abs(need - ex) > 1) t.style.setProperty("--dk-clear", need + "px");
      } catch (e) {}
    }, 220);
  }

  function start() {
    if (!Sh()) { console.warn("ping.js needs shell.js first"); return; }
    build();
    clearRoost(); addEventListener("resize", clearRoost);
    if (root.ResizeObserver) try { new ResizeObserver(clearRoost).observe(doc.body); } catch (e) {}
    Sh().on("stream:alert", () => { if (D && D.el.dataset.mode === "chips") renderChips(); });
    Sh().on("roost:created", () => { if (D && D.el.dataset.mode === "chips") renderChips(); });
    Sh().on("compare:close", () => {});
    // safety net: if app.js did not hand over its handlers (load order), build them from __zoom
    let tries = 0; const iv = setInterval(() => {
      if (Sh().h || ++tries > 80) return clearInterval(iv);
      const z = root.__zoom; if (!z || !z.ready) return; clearInterval(iv);
      setTimeout(() => { if (Sh().h) return; mount(doc.querySelector("#ask-slot"), { getSample: root.TerryProj && root.TerryProj.getSample, E: z.E, Z: z.Z, plan: () => z.plan, DEPTS: ["PWDx", "BTDT", "PARK", "ISD"], scene: z.scene,
        reduced: Sh().reduced, goTo: z.goTo, streets: z.setStreets, settled: z.settled, state: () => z.S, openWhy: (d, m) => z.openWhy({ type: "demand", d, m }), highlight: z.highlight, bands: () => {} }); }, 600);
    }, 400);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => setTimeout(start, 0)); else setTimeout(start, 0);
})(typeof window !== "undefined" ? window : globalThis);
