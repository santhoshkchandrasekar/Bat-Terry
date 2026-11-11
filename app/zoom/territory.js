/* Terrytory: the right leaf. Three real, interactive sections (spec I3, H):
 *   Intake          residents' messages answered by the intake assistant (saved answers from data.json, same as stream.js)
 *   Resident stream the stream of messages, tallied by department, with the surge test against each department's usual share
 *   Alerts          pasted warnings and what-ifs run through flyover.js (F.ping), with the event applied to the screen
 * Emits stream:alert; logs every action through TerryRoost.log (via TerryShell.logAction).
 *
 *   TerryTerritory.runAlert(text) -> {kind:"ping"|"question"|"note", alert?, r}   (also used by the Ping dock)
 *   TerryTerritory.alerts()       -> the alert rows now in the leaf
 */
(function (root) {
  "use strict";
  const doc = document, Sh = () => root.TerryShell;
  const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const ACC = { PWDx: "var(--behind)", BTDT: "var(--hire)", PARK: "var(--work)", ISD: "var(--pred)" };
  const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const ALERT_EX = "Winter storm warning: 12 to 18 inches expected November 22";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // a leaf never prints an ellipsis: keep whole sentences, or cut at a word and close it with a period
  const clip = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); if (t.length <= n) return t; const s = t.slice(0, n), i = Math.max(s.lastIndexOf(". "), s.lastIndexOf("? "), s.lastIndexOf("! ")); if (i > n * .45) return s.slice(0, i + 1); return s.slice(0, s.lastIndexOf(" ")).replace(/[,;:\-]+$/, "") + "."; };
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const reduced = () => Sh().reduced();
  const H = () => Sh().h;

  let leaf = null, alerts = [], unread = 0, nextId = 1, stopStream = true, streaming = false;
  const log = (label, kind, extra) => Sh().logAction(Object.assign({ kind: kind || "territory", label }, extra || {}));
  const hasSurface = () => { const S = Sh().State(); return !S.busy; };

  // ---------------------------------------------------------------- alerts (shared with the Ping dock)
  async function runAlert(text, opts) {
    opts = opts || {};
    const h = H(), c = await Sh().ensure(), F = c.F; text = String(text || "").trim();
    if (!F) return { kind: "note", r: { text: "Alerts need the flyover module." } };
    const ms = MONTHS.map((m, i) => (text.toLowerCase().includes(m) ? i + 1 : 0)).filter(Boolean);
    // with a Roost open, the alert is judged against that Roost's goal and its predators (a storm or a walkout flies against the plan
    // you chased); with none, against the city in the month the alert names, as before
    const St = root.TerryState || {}, ro = (St.roosts || []).find(x => x.id === St.activeRoost);
    F.clearPings();
    if (ro && ro.goal && ro.goal.scope) F.setGoal(ro.goal, ro.flip && ro.flip.predators ? ro.flip.predators : undefined);
    else F.setGoal({ scope: "CITY", hood: null, months: ms.length ? ms.slice(0, 1) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], target: 0.9 });
    // the keyword rules need the word snow; the model does not
    const send = !F.live() && !/snow|blizzard/i.test(text) && /winter storm|ice storm|nor.?easter|inches/i.test(text) ? text + " (snow)" : text;
    const r = await F.ping(send);
    if (r.kind === "question") return { kind: "question", r, live: F.live() };
    if (r.kind !== "ping") return { kind: "note", r, live: F.live() };
    const lines = (r.lines || []).slice(1);
    const a = { id: nextId++, text, label: r.label, source: r.source, lines: lines.slice(0, 3), tail: lines[3] || "", events: r.events || [], live: F.live(), at: Date.now(), kind: "paste" };
    alerts.unshift(a);
    await showOnScreen(a, !!opts.quiet);
    Sh().emit("stream:alert", { alert: a });
    log(opts.log || "Pasted an alert", "alert");
    if (!(leaf && leaf.state !== "rest")) { unread++; leaf && leaf.setBadge(unread); }
    return { kind: "ping", alert: a, r, live: F.live() };
  }
  async function showOnScreen(a, quiet) {
    const h = H(); if (!h || !a.events.length || (quiet && !hasSurface())) return;
    try {
      if (hasSurface()) { await h.streets(true); if (h.state().lvl !== 0) { await h.goTo({ lvl: 0 }); await h.settled(); } }
      h.bands(a.events, a.label); h.scene.setEvents(a.events);
      const e0 = a.events.reduce((x, y) => (y.start < x.start ? y : x)); h.scene.pause(); h.scene.setActive(e0.dept); h.scene.setDay(e0.start + Math.min(2, (e0.days || 2) - 1));
    } catch (e) { console.warn("show alert", e && e.message); }
  }
  async function clearAlert(a) {
    const c = await Sh().ensure(), h = H();
    alerts = alerts.filter(x => x !== a);
    if (!alerts.length || alerts.every(x => x.kind === "surge")) { try { c.F && c.F.clearPings(); h.bands([]); h.scene.setEvents([]); } catch (e) {} }
    log("Cleared an alert", "alert");
  }
  function compareAlert(a) {
    const S = Sh().State(), rid = S.activeRoost == null ? null : S.activeRoost;
    Sh().emitCompare({ label: "Before the alert", roostId: rid, events: [] }, { label: "After the alert", roostId: rid, events: a.events });
  }

  // ---------------------------------------------------------------- UI: "What Boston is telling Terry" (one feature, no tabs)
  const HOODS = ["Allston", "Back Bay", "Beacon Hill", "Brighton", "Charlestown", "Dorchester", "Downtown", "East Boston", "Fenway", "Hyde Park", "Jamaica Plain", "Kenmore", "Longwood", "Mattapan", "Mission Hill", "North End", "Roslindale", "Roxbury", "South Boston", "South End", "West End", "West Roxbury", "Chinatown"];
  const HOOD_RE = new RegExp("\\b(" + HOODS.slice().sort((x, y) => y.length - x.length).join("|") + ")\\b", "i");
  const SHORT = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional" };
  const TAG_NAME = { PWDx: "PUBLIC WORKS", BTDT: "TRANSPORTATION", PARK: "PARKS", ISD: "INSPECTIONAL" };
  const ic = n => root.TerryArt ? root.TerryArt.ic(n) : "";
  const hoodOf = t => { const m = HOOD_RE.exec(t || ""); return m ? HOODS.find(x => x.toLowerCase() === m[1].toLowerCase()) : ""; };
  const clock = (k, n) => { const m = Math.round(7 * 60 + k * (720 / Math.max(1, n))); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const dayText = d => new Date(Date.UTC(2025, 0, 1 + d)).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const sceneDay = () => { const h = H(); return Math.max(0, Math.min(364, Math.floor(h && h.scene && h.scene.getDay ? h.scene.getDay() : 0))); };
  // ---------------------------------------------------------------- which day the replay plays, and how many messages a day like it gets
  // At month zoom the replay follows the projector's day. Elsewhere (city, year) it takes a mid-month working day in the month the
  // projector or the active Roost is about: the Roost's first goal month, else the projector department's busiest month.
  const Zm = () => root.__zoom || null;
  const yc = { plan: null, days: {} };
  function yearDays() {
    const z = Zm(); if (!z || !z.Z || !z.plan) return null;
    if (yc.plan !== z.plan) { yc.plan = z.plan; yc.days = {}; }
    for (const d of DEPTS) if (!yc.days[d]) { try { yc.days[d] = z.Z.year(d, z.plan[d]).days; } catch (e) { return null; } }
    return yc.days;
  }
  const atMonth = () => { const z = Zm(); return !!(z && z.S && z.S.lvl >= 2); };
  function focusMonth() {
    const S = Sh().State && Sh().State(), r = S && S.roosts && S.roosts.find(x => x.id === S.activeRoost), ms = (r && r.escape && r.escape.goal && r.escape.goal.months) || [];
    if (ms.length) return Math.min(...ms) - 1;
    const z = Zm(), Y = yearDays(); if (!Y) return 0;
    const ds = z && z.S && DEPTS.includes(z.S.d) ? [z.S.d] : DEPTS, tot = new Array(12).fill(0);
    for (const d of ds) for (const x of Y[d]) tot[x.month] += x.arrivals || 0;
    return tot.indexOf(Math.max(...tot));
  }
  function typicalDay(m) {   // the working day nearest the 15th of month m
    const Y = yearDays(), mid = Math.round((Date.UTC(2025, m, 15) - Date.UTC(2025, 0, 1)) / 864e5);
    if (!Y) return mid; const ws = Y[DEPTS[0]].filter(x => x.month === m && x.working);
    return ws.length ? ws.reduce((b, x) => (Math.abs(x.day - mid) < Math.abs(b.day - mid) ? x : b)).day : mid;
  }
  // the reader's pick wins away from month zoom; at month zoom the projector's day is the pick (the two always agree)
  let pick = null, picking = false;
  const replayDayNow = () => (atMonth() && !picking ? sceneDay() : pick != null ? pick : typicalDay(focusMonth()));
  const monthOf = t => new Date(Date.UTC(2025, 0, 1 + t)).getUTCMonth();
  const dayOfDate = (m, dd) => Math.round((Date.UTC(2025, m, dd) - Date.UTC(2025, 0, 1)) / 864e5);
  const longDay = t => new Date(Date.UTC(2025, 0, 1 + t)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  function working(t) { const Y = yearDays(); if (Y && Y[DEPTS[0]][t]) return !!Y[DEPTS[0]][t].working; const w = new Date(Date.UTC(2025, 0, 1 + t)).getUTCDay(); return w > 0 && w < 6; }
  function stepWorking(t, dir) { for (let x = t + dir; x >= 0 && x <= 364; x += dir) if (working(x)) return x; return t; }
  // pick a day: the replay takes it, and a projector at month zoom moves to it (its month first, when the day is in another month)
  async function setPick(t) {
    t = Math.max(0, Math.min(364, t | 0)); pick = t; lastReplay = null; picking = true; renderDay(true);
    if (ui.live) ui.live.textContent = "Replay day " + longDay(t);
    try {
      const z = Zm(); if (z && atMonth() && !projBusy() && z.scene) {
        if (z.S.m !== monthOf(t)) { await z.goTo({ lvl: 2, d: z.S.d, m: monthOf(t) }); await z.settled(); }
        if (pick === t && atMonth()) { z.scene.pause(); z.scene.setDay(t + 0.5); }
      }
    } catch (e) { console.warn("pick day", e && e.message); }
    finally { if (pick === t) picking = false; renderDay(); }
  }
  // a chase or a plan play owns the projector; the replay then lists the messages without moving it
  const projBusy = () => { const z = Zm(), S = Sh().State && Sh().State(); return !!((S && S.busy) || (z && (z.planRunning || z.busy))); };
  // forecast arrivals that day across the four departments (Z.year), with the busy-day tilt applied to that department
  function dayArrivals(t, tilt) { const Y = yearDays(); if (!Y) return 0; return Math.round(DEPTS.reduce((s, d) => s + (Y[d][t] ? Y[d][t].arrivals : 0) * ((tilt && tilt[d]) || 1), 0)); }
  function sampleText(t, n, tilt) {
    const N = dayArrivals(t, tilt); if (!N) return "";
    return tilt && tilt.BTDT ? `${n} of about ${N.toLocaleString("en-US")} messages, a busy Transportation day` : `${n} of about ${N.toLocaleString("en-US")} messages that day`;
  }
  let lastReplay = null;   // the replay whose messages the feed lists: its day stays on the label until a new replay starts or the feed is cleared
  function setDayUI(lab, t) {
    ui.lab.textContent = lab + ": "; ui.date.textContent = dayText(t); ui.date.setAttribute("aria-label", `${lab} day: ${longDay(t)}. Choose a day`);
    ui.prev.disabled = streaming || stepWorking(t, -1) === t; ui.next.disabled = streaming || stepWorking(t, 1) === t; ui.date.disabled = streaming;
  }
  function renderDay(force) {
    if (!ui.day || (streaming && !force)) return;
    if (atMonth() && !picking) { pick = sceneDay(); if (lastReplay && lastReplay.day !== pick) lastReplay = null; }   // the picker and the projector always agree
    if (lastReplay && ui.feed && ui.feed.children.length && !ui.feed.querySelector(".tf-empty")) { setDayUI("Replayed", lastReplay.day); if (ui.sample) ui.sample.textContent = sampleText(lastReplay.day, lastReplay.n, lastReplay.tilt); return; }
    lastReplay = null; const t = replayDayNow();
    setDayUI("Replay", t); if (ui.sample) ui.sample.textContent = sampleText(t, 20);
  }
  // ---------------------------------------------------------------- the calendar: 2025, one month at a time, weekends muted
  const WD = ["S", "M", "T", "W", "T", "F", "S"], MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  let calM = 0;
  function openCal() {
    if (streaming) return; const t = replayDayNow(); calM = monthOf(t); renderCal(t); ui.cal.hidden = false; ui.date.setAttribute("aria-expanded", "true");
    const b = ui.cal.querySelector('[tabindex="0"][data-t]'); b && b.focus();
    setTimeout(() => doc.addEventListener("pointerdown", outside, true), 0);
  }
  function closeCal(back) { if (ui.cal.hidden) return; ui.cal.hidden = true; ui.date.setAttribute("aria-expanded", "false"); doc.removeEventListener("pointerdown", outside, true); if (back) ui.date.focus(); }
  const outside = e => { if (!ui.cal.contains(e.target) && e.target !== ui.date) closeCal(false); };
  function renderCal(focusT) {
    const sel = replayDayNow(), first = dayOfDate(calM, 1), n = new Date(Date.UTC(2025, calM + 1, 0)).getUTCDate(), lead = new Date(Date.UTC(2025, calM, 1)).getUTCDay();
    if (focusT == null || monthOf(focusT) !== calM) focusT = monthOf(sel) === calM ? sel : first;
    let cells = "";
    for (let i = 0; i < lead; i++) cells += "<span></span>";
    for (let k = 0; k < n; k++) {
      const t = first + k, we = !working(t);
      cells += `<button type="button" data-t="${t}" class="${we ? "we" : ""}" tabindex="${t === focusT ? 0 : -1}" aria-pressed="${t === sel}" aria-label="${esc(longDay(t))}${we ? ", no crews scheduled" : ""}">${k + 1}</button>`;
    }
    ui.cal.innerHTML = `<div class="tc-h"><button type="button" class="tc-nav tc-p" aria-label="Previous month"${calM ? "" : " disabled"}>${ic("chev")}</button><span class="tc-m" id="tc-m" aria-live="polite">${MON[calM]} 2025</span><button type="button" class="tc-nav tc-n" aria-label="Next month"${calM < 11 ? "" : " disabled"}>${ic("chev")}</button></div>
      <div class="tc-w" aria-hidden="true">${WD.map(w => `<span>${w}</span>`).join("")}</div><div class="tc-g" role="group" aria-labelledby="tc-m">${cells}</div>`;
    ui.cal.querySelector(".tc-p").addEventListener("click", () => { if (calM > 0) { calM -= 1; renderCal(); ui.cal.querySelector(".tc-p").focus(); } });
    ui.cal.querySelector(".tc-n").addEventListener("click", () => { if (calM < 11) { calM++; renderCal(); ui.cal.querySelector(".tc-n").focus(); } });
  }
  function calKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCal(true); return; }
    const b = e.target.closest && e.target.closest("[data-t]"); if (!b) return;
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -30, PageDown: 30 }[e.key];
    if (mv == null) return; e.preventDefault();
    const t = Math.max(0, Math.min(364, +b.dataset.t + mv)); if (monthOf(t) !== calM) { calM = monthOf(t); renderCal(t); } else { b.tabIndex = -1; }
    const nb = ui.cal.querySelector(`[data-t="${t}"]`); if (nb) { nb.tabIndex = 0; nb.focus(); }
  }
  // envelopes on the projector: one per routed message, only while the projector shows that day's month with the street visible
  const envQ = []; let envT = 0;
  let onScreen = false;   // this replay brought the projector to its day: each envelope switches the street to its own crew
  function sceneFor(d, t) {
    const z = Zm(), sc = z && z.scene; if (!sc || !atMonth() || Math.floor(sc.getDay()) !== t) return null;
    if (onScreen && !projBusy() && z.showStreet) z.showStreet(d);
    return sc.shows && sc.shows(d) ? sc : null;
  }
  function queueEnvelope(d, t) { if (!d) return; envQ.push({ d, t }); if (!envT) drainEnvelopes(); }
  function drainEnvelopes() {
    envT = 0; const x = envQ.shift(); if (!x) return;
    try { const sc = sceneFor(x.d, x.t); if (sc) sc.incoming(x.d, "", { keep: !onScreen, quiet: reduced() }); } catch (e) { console.warn("envelope", e && e.message); }
    if (envQ.length) envT = setTimeout(drainEnvelopes, Math.round(600 / speed)); else envT = setTimeout(() => { envT = 0; }, Math.round(600 / speed));
  }
  let ui = {}, speed = 1, surges = [], tallyN = {}, answerCardEl = null, dayRouted = [], dayT = -1, played = -1;
  const mkBtn = (txt, cls, fn) => { const b = el("button", cls || "tt-btn", esc(txt)); b.type = "button"; if (fn) b.addEventListener("click", fn); return b; };

  function feedItem(r, k, n, fresh) {
    const li = el("article", "tf-item" + (fresh ? " in" : "") + (r.yours ? " yours" : "")), hood = hoodOf(r.text);
    // a dispatch log: the time in its own column, the message as written, then where it came from and who gets it
    const to = r.follow_up ? { t: "ASKED BACK" } : r.dept ? { t: TAG_NAME[r.dept], c: ACC[r.dept], pre: "to " } : { t: "NO CREW YET" };
    // the reader's own report: "you" in the time column, the day it landed on, and "by words" when no model read it
    const when = r.yours ? (r.pick && root.TerryTicket ? esc(root.TerryTicket.dateShort(r.pick)) + " &middot; " : "") + (r.asked ? "asked back &middot; " : "") : (hood ? esc(hood) + " &middot; " : "");
    const tail = r.yours && r.mode === "rules" ? " <span class=\"tf-by\">&middot; by words</span>" : "";
    li.innerHTML = `<time class="tf-time">${r.yours ? "you" : clock(k, n)}</time><div class="tf-main"><p class="tf-t" tabindex="0" role="button" aria-expanded="false">${esc(r.text)}</p><p class="tf-m">${when}${to.pre || ""}${to.c ? `<i style="background:${to.c}"></i>` : ""}<b>${to.t}</b>${tail}</p></div>${root.TerryPlates ? root.TerryPlates.rule(k + 3, 256, { cls: "tf-r" }) : ""}`;
    const p = li.querySelector(".tf-t"), tog = () => { const o = li.classList.toggle("open"); p.setAttribute("aria-expanded", String(o)); };
    p.addEventListener("click", tog); p.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } });
    return li;
  }
  function renderTally() { for (const d of DEPTS) ui.tEls[d].textContent = tallyN[d] || 0; }
  function setPlayUI(on) { ui.play.innerHTML = ic(on ? "pause" : "play"); ui.play.setAttribute("aria-label", on ? "Pause" : "Play"); }
  function renderBanner() {
    ui.banner.textContent = "";
    for (const a of surges) {
      const c = el("div", "tf-ban"), pct = v => Math.round(v * 100) + "%", nm = NAMES[a.dept];
      c.innerHTML = `<p class="l1">${esc(nm)} is ${pct(a.surge)} above normal today.</p><p class="l2">If it lasts a week, ${esc(a.month)} closes ${pct(a.month_ontime_week)} on time (plan: ${pct(a.month_ontime_plan)}).</p>`;
      const row = el("div", "tf-ban-a"); row.append(mkBtn("Dismiss", "tf-ghost", () => { surges = surges.filter(x => x !== a); renderBanner(); }), mkBtn("Show the impact", "tf-ghost", () => showImpact(a)));
      c.appendChild(row); ui.banner.appendChild(c);
    }
  }
  // the surge is applied from the scene day; when that day is outside the Roost's goal window it starts on the window's first day so the plan feels it
  function surgeStart(r, t) { const E = root.__zoom && root.__zoom.E, ms = r.escape && r.escape.goal && r.escape.goal.months || []; if (!E || !ms.length || ms.includes(E.MONTH_OF_DAY[t] + 1)) return t; return E.dayOf(`2025-${String(Math.min(...ms)).padStart(2, "0")}-01`); }
  function showImpact(a) {
    const S = Sh().State(), rid = S.activeRoost, R = root.TerryRoost, r = rid && R && R.get(rid), h = H();
    if (r && r.escape && r.escape.depts[a.dept] && root.TerryStream) {
      const A = R.scenario({ roostId: rid, label: "Today's plan", dept: a.dept }), t0 = surgeStart(r, a.scene.t), mult = root.TerryStream.surgeMult(t0, 7, a.surge);
      const B = R.scenario({ roostId: rid, label: "If the surge lasts a week", dayMult: mult, dept: a.dept, view: A && A.view }); if (A && B && R.openCompare(A, B)) { log("Showed the surge impact", "stream"); return; }
    }
    const p = { level: 1, dept: a.dept, month: null, handled: false }; Sh().emit("ask:zoom", p);
    if (!p.handled && h) { try { h.goTo({ lvl: 1, d: a.dept }); } catch (e) {} }
    log(`Zoomed to ${NAMES[a.dept]}`, "stream");
  }
  function surgeAlerts(w, t) {
    for (const a of w.alerts) {
      a.scene = { t, surge: a.surge, dept: a.dept }; surges = surges.filter(x => x.dept !== a.dept); surges.unshift(a);
      const al = { id: nextId++, kind: "surge", text: a.text, label: `${NAMES[a.dept]} is ${Math.round(a.surge * 100)}% above normal today`, source: "", lines: [a.text], tail: "", events: [], at: Date.now(), dept: a.dept, scene: a.scene };
      Sh().emit("stream:alert", { alert: al }); log(`Surge: ${NAMES[a.dept]} ${Math.round(a.surge * 100)}% above normal`, "stream");
      if (!(leaf && leaf.state !== "rest")) { unread++; leaf && leaf.setBadge(unread); }
    }
    renderBanner();
  }
  const HINT = "Pick a day, then Play.";
  async function toProjector(day, tilt) {
    const z = Zm(); if (!z || !z.scene) return false;
    if (projBusy()) { ui.hint.textContent = "Envelopes show when the screen is free."; return false; }
    try {
      const m = monthOf(day), d = z.S.lvl >= 1 && DEPTS.includes(z.S.d) ? z.S.d : tilt.BTDT ? "BTDT" : "PWDx";
      if (!(z.S.lvl === 2 && z.S.m === m)) { await z.goTo({ lvl: 2, d, m }); await z.settled(); }
      if (!atMonth() || projBusy()) return false;
      z.scene.pause(); z.scene.setDay(day + 0.5); return true;
    } catch (e) { console.warn("replay projector", e && e.message); return false; }
  }
  // while the first message is on its way: a flapping bat and a few short lines, so the wait reads as work, not a stall
  const WAIT = ["Opening the city's 311 inbox for the day", "Reading the first resident message", "Working out what they are asking for", "Picking the request type and the crew"];
  const WAITBAT = "M12 7.4c-.5-.9-1.4-1.4-2-1.5l.3 1.6C8.3 6.8 5 5.5 2 6c1.6.9 2.5 2.4 2.6 4.2 1-.7 2.3-.8 3.3-.1.4-1.1 1.3-1.7 2.3-1.7.3 1.6 1 2.9 1.8 3.8.8-.9 1.5-2.2 1.8-3.8 1 0 1.9.6 2.3 1.7 1-.7 2.3-.6 3.3.1.1-1.8 1-3.3 2.6-4.2-3-.5-6.3.8-8.3 1.5l.3-1.6c-.6.1-1.5.6-2 1.5z";
  let waitT = 0;
  function startWait() {
    stopWait(); const w = el("div", "tf-wait", `<span class="tf-batw" aria-hidden="true"><svg class="tf-bat" viewBox="0 0 24 24"><path d="${WAITBAT}"/></svg></span><span class="tf-wt"></span>`);
    const t = w.querySelector(".tf-wt"); let k = 0; t.textContent = WAIT[0] + "...";
    ui.feed.appendChild(w);
    waitT = setInterval(() => { k = (k + 1) % WAIT.length; t.classList.remove("in"); void t.offsetWidth; t.textContent = WAIT[k] + "..."; t.classList.add("in"); }, 1700);
  }
  function stopWait() { clearInterval(waitT); waitT = 0; const w = ui && ui.feed && ui.feed.querySelector(".tf-wait"); if (w) w.remove(); }
  async function playStream(tilt) {
    if (streaming) { stopStream = true; return; }
    streaming = true; stopStream = false; setPlayUI(true);
    tallyN = {}; renderTally(); ui.feed.textContent = ""; ui.banner.textContent = ""; surges = []; startWait();
    try {
      const c = await Sh().ensure(), S = c.S; if (!S) { stopWait(); ui.feed.innerHTML = '<p class="tf-empty">Terry did not hear that. Try again.</p>'; return; }
      const day = replayDayNow(), msgs = S.batch(day, tilt.BTDT ? 30 : 20, tilt), routed = [], n = msgs.length; setDayUI("Replay", day);
      onScreen = await toProjector(day, tilt); ui.sample.textContent = sampleText(day, n, tilt); lastReplay = { day, n, tilt }; dayRouted = []; dayT = day; played = day;
      log(tilt.BTDT ? "Replayed a busy Transportation day" : "Played a day of messages", "stream");
      const promises = new Array(n); let nxt = 0;
      const worker = async () => { while (nxt < n && !stopStream) { const i = nxt++; promises[i] = S.route(msgs[i]).catch(() => ({ text: msgs[i].text, dept: null, mode: "rules", follow_up: null })); await promises[i]; } };
      const pool = [worker(), worker(), worker()];
      for (let i = 0; i < n && !stopStream; i++) {
        while (!promises[i] && !stopStream) await sleep(30);
        const r = await promises[i]; if (stopStream) break; routed.push(r); dayRouted.push(r); stopWait();
        ui.feed.insertBefore(feedItem(r, i, n, !reduced()), ui.feed.firstChild);
        if (r.dept && !r.follow_up) { tallyN[r.dept] = (tallyN[r.dept] || 0) + 1; renderTally(); queueEnvelope(r.dept, day); }
        await sleep(Math.round(2400 / speed));
      }
      await Promise.all(pool).catch(() => {});
      if (!stopStream && routed.length) {
        const w = S.warn(day, routed, H().plan()), done = el("p", "tf-done", `<time class="tf-time">17:52</time><span>Day done. ${n} routed${w.alerts.length ? "." : ", every department within its usual share."}</span>`);
        ui.feed.insertBefore(done, ui.feed.firstChild); surgeAlerts(w, day);
      }
    } catch (e) { stopWait(); ui.feed.innerHTML = '<p class="tf-empty">Terry did not hear that. Try again.</p>'; console.warn("stream", e && e.message); }
    finally { stopWait(); streaming = false; onScreen = false; setPlayUI(false); envQ.length = 0; ui.hint.textContent = HINT; if (!ui.feed.children.length) ui.feed.innerHTML = '<p class="tf-empty">Press play to watch Terry route each message.</p>'; renderDay(); }
  }
  function showAnswerCard(text) {
    if (answerCardEl) answerCardEl.remove(); const c = el("div", "tf-ans"); c.innerHTML = `<p>${esc(text)}</p>`; c.appendChild(mkBtn("Clear", "tf-ghost", () => { c.remove(); answerCardEl = null; })); answerCardEl = c; ui.banner.parentNode.insertBefore(c, ui.banner);
    if (leaf) leaf.pin(true);
  }

  function build() {
    leaf = Sh().leaf("right"); if (!leaf) return;
    const r0 = el("div", "tf");
    r0.innerHTML = `      <div class="tf-ctl"><button type="button" class="tf-play" aria-label="Play"></button><div class="tf-seg" role="group" aria-label="Speed"><button type="button" data-s="1" aria-pressed="true">1x</button><button type="button" data-s="3" aria-pressed="false">3x</button></div></div>
      <div class="tf-pick"><span class="tf-day"><span class="tf-lab">Replay: </span><button type="button" class="tf-arr tf-prev" aria-label="Previous working day">${ic("chev")}</button><button type="button" class="tf-date" aria-haspopup="dialog" aria-expanded="false">${dayText(0)}</button><button type="button" class="tf-arr tf-next" aria-label="Next working day">${ic("chev")}</button></span>
        <div class="tf-cal" role="dialog" aria-label="Choose a day in 2025" hidden></div><span class="tf-vh" aria-live="polite"></span></div>
      <p class="tf-sample"></p>
      <p class="tf-hint">${HINT}</p>
      <button type="button" class="tf-ghost tf-replay">Try a busy Transportation day</button>
      <div class="tf-tally" aria-label="Messages routed so far">${DEPTS.map(d => `<span><i style="background:${ACC[d]}"></i>${SHORT[d]} <b data-d="${d}">0</b></span>`).join("")}</div>
      <div class="tf-ban-w" aria-live="polite"></div>
      <div class="tf-feed lf-scroll" aria-live="polite"><p class="tf-empty">Press play to watch Terry route each message.</p></div>
      <p class="tf-real">Test messages written for the city's real request types, replayed on a 2025 day.</p>
      <p class="tf-real tf-score">Right type on 82% of 200 unseen test messages, 89% after the fix they pointed to.</p>`;
    const q = s => r0.querySelector(s);
    ui = { play: q(".tf-play"), busyBtn: q(".tf-replay"), day: q(".tf-day"), lab: q(".tf-lab"), date: q(".tf-date"), prev: q(".tf-prev"), next: q(".tf-next"), cal: q(".tf-cal"), live: q(".tf-vh"), hint: q(".tf-hint"), sample: q(".tf-sample"), feed: q(".tf-feed"), banner: q(".tf-ban-w"), tEls: Object.fromEntries(DEPTS.map(d => [d, q(`b[data-d="${d}"]`)])) };
    ui.prev.addEventListener("click", () => setPick(stepWorking(replayDayNow(), -1)));
    ui.next.addEventListener("click", () => setPick(stepWorking(replayDayNow(), 1)));
    ui.date.addEventListener("click", () => (ui.cal.hidden ? openCal() : closeCal(true)));
    ui.cal.addEventListener("keydown", calKey);
    ui.cal.addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; closeCal(true); setPick(+b.dataset.t); });
    ui.play.innerHTML = ic("play"); ui.play.addEventListener("click", () => playStream({})); ui.busyBtn.addEventListener("click", () => { if (!streaming) playStream({ BTDT: 3.5 }); });
    r0.querySelectorAll(".tf-seg button").forEach(b => b.addEventListener("click", () => { speed = +b.dataset.s; r0.querySelectorAll(".tf-seg button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); }));
    const hh = leaf.el.querySelector(".lf-body h2"), hs = leaf.el.querySelector(".lf-body .lf-sub"); const ht = leaf.el.querySelector(".lf-body h2 .lf-t") || hh, hi = leaf.el.querySelector(".lf-body .lf-info");
    if (ht) ht.textContent = "What Boston says"; if (hs) { hs.textContent = ""; hs.hidden = true; }
    if (hi) hi.dataset.tip = "Resident messages, routed to a crew as they arrive: test messages written for the city's real request types (the 311 data holds no residents' own words), replayed on a 2025 day. On 200 test messages he had never seen he picked the right type for 82%; after the Spanish fix those misses pointed to, 89%.";
    leaf.body.textContent = ""; leaf.body.appendChild(r0);
    leaf.cfg.onOpen = () => { unread = 0; leaf.setBadge(0); };
    leaf.el.addEventListener("keydown", e => { if (e.key === "Escape" && streaming) stopStream = true; });
    Sh().on("roost:activated", () => { renderBanner(); renderDay(); });
    Sh().on("screen:level", () => renderDay()); Sh().on("screen:day", () => renderDay()); renderDay();
    // the projector's day moves under its own playback and scrubber; follow it while the leaf is open
    setInterval(() => { if (leaf && leaf.state !== "rest" && !doc.hidden) renderDay(); }, 800);
  }
  // a resident message typed into Ping is routed here and answered in the dock
  async function routeMessage(text) { const c = await Sh().ensure(); return c.S.route({ text, dept: null }); }
  // the reader's own routed report joins the feed (marked theirs), the tally, and today's share test
  async function record(entry) {
    if (!ui.feed || !entry) return; const c = entry.choice || null;
    const r = { text: entry.text, dept: c ? c.dept : null, type: c ? c.type : null, queue: c ? c.queue : null, follow_up: null, mode: entry.mode, yours: true, pick: entry.pick || null, asked: !!entry.asked, truth: null };
    const day = sceneDay(); if (dayT !== day && !streaming) { dayRouted = []; dayT = day; }
    dayRouted.push(r);
    const empty = ui.feed.querySelector(".tf-empty"); if (empty) empty.remove();
    ui.feed.insertBefore(feedItem(r, 0, 1, !reduced()), ui.feed.firstChild);
    if (r.dept) { tallyN[r.dept] = (tallyN[r.dept] || 0) + 1; renderTally(); }
    if (!(leaf && leaf.state !== "rest")) { unread++; leaf && leaf.setBadge(unread); }
    try {
      const x = await Sh().ensure(), S = x.S, h = H();
      if (S && h && r.dept) { const w = S.warn(dayT, dayRouted, h.plan()), fresh = w.alerts.filter(a => !surges.some(y => y.dept === a.dept)); if (fresh.length) surgeAlerts({ alerts: fresh }, dayT); }
    } catch (e) { console.warn("share test", e && e.message); }
    return r;
  }

  const api = { runAlert, alerts: () => alerts.slice(), surges: () => surges.slice(), clearAll: async () => { for (const a of alerts.slice()) await clearAlert(a); }, compareAlert, surgeStart, showAnswer: showAnswerCard, routeMessage, record, replayDay: () => played, selectTab: () => {} };
  root.TerryTerritory = api;
  function start() {
    const S = Sh(); if (!S) { console.warn("territory.js needs shell.js first"); return; }
    try { leaf = S.leaf("right"); if (!leaf) { setTimeout(start, 30); return; } S.onReady(() => { try { build(); } catch (e) { console.warn("territory build", e && e.message); } }); } catch (e) { console.warn("territory", e && e.message); }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => setTimeout(start, 0)); else setTimeout(start, 0);
})(typeof window !== "undefined" ? window : globalThis);
