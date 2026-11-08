/* The ticket: a routed resident report lands on the screen (redesign/INTAKE_SPEC.md section 5).
 *
 *   await TerryTicket.land(entry, from) -> { landed, flew, pick: {d, m, i, day} }
 *     entry = the intake result's choice plus the text ({text, choice: {type, plain, dept, queue, queueName}, mode})
 *     from  = the viewport point the ticket leaves from (the dock's field), or null for no flight
 *   TerryTicket.clear()   removes the ticket from the screen;  TerryTicket.current() -> the entry on screen, or null
 *
 * The screen opens if it is rolled up, scrolls into view, drops to the month (the month showing, else the month "+" would open),
 * and the ticket is dropped by Terry (TerryProj.ferry) on the day column of the feed's replay day. The stub on the column reads the
 * real day from Z.month: arrivals, crews on duty, what they close, and whether the request waits. Nothing in the plan changes.
 * The street scene gets its envelope (scene.incoming). The stub lives inside #stage so it follows the chart (pull, maximize) and is
 * repositioned on every draw; it hides at other levels and shows again when its month returns.
 */
(function (root) {
  "use strict";
  const doc = document, Sh = () => root.TerryShell, Zm = () => root.__zoom, Pj = () => root.TerryProj;
  const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const TAG = { PWDx: "PUBLIC WORKS", BTDT: "TRANSPORTATION", PARK: "PARKS", ISD: "INSPECTIONAL" };
  const ACC = { PWDx: "var(--behind)", BTDT: "var(--hire)", PARK: "var(--work)", ISD: "var(--pred)" };
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const tween = (ms, fn) => new Promise(res => { if (reduced() || ms <= 0) { fn(1); return res(); } const t0 = performance.now(); (function f(now) { const u = Math.min(1, (now - t0) / ms); fn(u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2); if (u < 1) requestAnimationFrame(f); else res(); })(t0); });
  const setRect = (c, q) => { c.style.left = q.x + "px"; c.style.top = q.y + "px"; c.style.width = q.w + "px"; c.style.height = q.h + "px"; };
  const dom = day => +String(day.date).slice(8);

  let cur = null, gen = 0;   // { entry, pick, stub, band }; gen: a newer ticket supersedes one still in the air

  // where it lands: the month showing, else the month "+" would open (the active Roost's first window month, else the tightest month);
  // the day of month follows the feed's replay clock so the leaf and the screen agree (DECISIONS.md, reversible)
  function pickDay(dept) {
    const z = Zm(), S = z.S; let m = null;
    if (S.lvl === 2 && S.m != null) m = S.m;
    else { const gv = z.goalSpec, ms = gv && gv.goal && gv.goal.months; m = ms && ms.length && (gv.depts || []).includes(dept) ? Math.min(...ms) - 1 : z.tightest(dept); }
    if (!(m >= 0 && m <= 11)) m = z.tightest(dept);
    // the feed's replay day when the feed has played a day in this month; else the 15th, or the next working day after it
    const MD = z.dayInfo(dept, m), days = MD.days, Tt = root.TerryTerritory, rd = Tt && Tt.replayDay ? Tt.replayDay() : -1;
    let i = rd >= 0 ? days.findIndex(x => x.day === rd) : -1;
    if (i < 0) { i = Math.min(14, days.length - 1); while (i < days.length - 1 && !days[i].working) i++; }
    return { d: dept, m, i, day: days[i], MD };
  }
  function dayLine(p) {
    const day = p.day, date = `${WD[day.weekday]} ${dom(day)} ${MON3[p.m]}`;
    if (!day.working) { const nx = p.MD.days.slice(p.i + 1).find(x => x.working); return `${date}: no crews on duty; ${nx ? `${MON3[p.m]} ${dom(nx)} has ${nx.crews_on} crews.` : "the next working day picks it up."}`; }
    const waits = day.backlog > day.capacity;
    return `${date}: ${fmt(day.arrivals)} arrived, ${day.crews_on} crews close ${fmt(day.capacity)}. ${waits ? `Yours waits in a queue of ${fmt(day.backlog)}.` : "A crew reaches it the same day."}`;
  }
  const dateShort = p => `${WD[p.day.weekday]} ${dom(p.day)} ${MON3[p.m]}`;

  // ---------------------------------------------------------------- the stub on the column
  function stubHtml(entry, p) {
    const c = entry.choice, short = c.plain !== c.type;
    return `<button type="button" class="tk-x" aria-label="Clear the ticket">${root.TerryArt ? root.TerryArt.ic("x") : "x"}</button>
      <p class="tk-h">${root.TerryIcons ? `<span class="tk-ic" style="color:${ACC[c.dept]};align-self:center;display:inline-flex">${root.TerryIcons.dept(c.dept)}</span>` : `<i style="background:${ACC[c.dept]}"></i>`}<b>${TAG[c.dept]}</b><span class="tk-t"${short ? ` title="${esc(c.type)}"` : ""}>${esc(c.plain)}</span></p>
      <p class="tk-d">${esc(dayLine(p))}</p>${entry.place ? `
      <p class="tk-w">${esc(entry.place.short)}: ${esc(entry.place.waits)}.</p>` : ""}`;
  }
  function place() {
    if (!cur) return; const z = Zm(), st = z && z.stage, r = z && z.dayRect ? z.dayRect(cur.pick.i) : null;
    const S = z && z.S, here = r && S.lvl === 2 && S.d === cur.pick.d && S.m === cur.pick.m;
    cur.stub.hidden = !here; cur.band.hidden = !here; if (!here || !st) return;
    if (cur.stub.parentNode !== st) { st.appendChild(cur.band); st.appendChild(cur.stub); }
    setRect(cur.band, { x: r.x, y: r.y, w: r.w, h: r.h });
    // above the bars: in the header row, in the gap between the breadcrumbs and the controls, as near the column as it fits,
    // with a leader down to the column; beside the column at the top of the plot only when the header has no room
    // the header's containers are wider than what they show, so the gap is measured on their visible children
    const sr = st.getBoundingClientRect(), loc = e => { if (!e || !e.offsetParent) return null; const ks = [...e.children].map(k => k.getBoundingClientRect()).filter(b => b.width > 0 && b.height > 0); if (!ks.length) return null; return { l: Math.min(...ks.map(b => b.left)) - sr.left, r: Math.max(...ks.map(b => b.right)) - sr.left }; };
    const cr = loc(st.querySelector("#crumbs")), ct = loc(st.querySelector(".ctrls")), lo = Math.max(r.plotLeft - 8, cr ? cr.r + 16 : 0), hi = Math.min(st.clientWidth - 8, ct ? ct.l - 16 : st.clientWidth - 8);
    cur.stub.style.maxWidth = ""; let w = cur.stub.offsetWidth || 240; const hh = cur.stub.offsetHeight || 52, cx = r.x + r.w / 2;
    let x, y, side = "c";
    // the header row when the stub fits between the top of the cloth and the axis numbers, so the axis stays readable;
    // else under the legend; beside the column only when neither has room
    const fabR = st.parentElement ? st.parentElement.getBoundingClientRect() : sr, fabTop = fabR.top - sr.top, room = fabR.bottom - sr.top, axisTop = r.y - 2;
    const head = hi - lo >= 200 && (() => { cur.stub.style.maxWidth = Math.min(300, hi - lo) + "px"; return axisTop - cur.stub.offsetHeight >= fabTop + 4; })();
    if (!head) cur.stub.style.maxWidth = "";
    w = cur.stub.offsetWidth || w; const h2 = cur.stub.offsetHeight || hh, below = r.y + r.h + 26;
    if (head) { x = Math.max(lo, Math.min(hi - w, cx - w / 2)); y = axisTop - h2; }
    else if (below + h2 <= room) { x = Math.max(r.plotLeft - 8, Math.min(r.plotRight - w, cx - w / 2)); y = below; }
    else { const gap = 10; x = r.x + r.w + gap; side = "r"; if (x + w > r.plotRight) { x = r.x - gap - w; side = "l"; } if (x < r.plotLeft) { x = Math.max(0, Math.min(r.plotLeft, cx - w / 2)); side = "c"; } y = Math.max(0, r.y + 18); }
    cur.stub.dataset.side = side; cur.stub.style.left = x + "px"; cur.stub.style.top = y + "px";
  }
  function makeStub(entry, p) {
    clear();
    const stub = el("div", "tk-stub"), band = el("i", "tk-band"); stub.setAttribute("role", "status"); stub.innerHTML = stubHtml(entry, p);
    stub.querySelector(".tk-x").addEventListener("click", clear);
    cur = { entry, pick: p, stub, band }; place(); return cur;
  }
  function clear() { if (!cur) return; cur.stub.remove(); cur.band.remove(); cur = null; }
  const pageRect = e => { const P = Pj(); if (P && P.pageRect) return P.pageRect(e); const a = e.getBoundingClientRect(), b = doc.querySelector("#page").getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };

  function scrollToScreen() {
    const sc = doc.querySelector("#screen"), fab = doc.querySelector("#fab"); if (!sc || !fab) return;
    const f = fab.getBoundingClientRect(), dockTop = innerHeight - 70;
    if (f.top >= 64 && f.bottom <= dockTop) return;
    const top = Math.max(0, sc.getBoundingClientRect().top + scrollY - 40);
    scrollTo({ top, behavior: reduced() ? "instant" : "smooth" });
  }

  // ---------------------------------------------------------------- the landing
  async function land(entry, from) {
    const z = Zm(), S = Sh(), h = S && S.h; if (!z || !z.ready || !h || !entry || !entry.choice) return { landed: false };
    const p = pickDay(entry.choice.dept), my = ++gen, stale = () => my !== gen;
    const busy = z.planRunning || (Pj() && Pj().running) || (S.State() || {}).busy;
    if (busy) return { landed: false, pick: p };
    if (root.Pull && typeof root.Pull.h === "number" && root.Pull.h < 0.5 && !root.Pull.maximized) { try { await root.Pull.to(1, reduced() ? 0 : 500); } catch (e) {} }
    scrollToScreen();
    const zoomP = (async () => { await h.settled(); const st = h.state(); if (st.lvl !== 2 || st.d !== p.d || st.m !== p.m) await h.goTo({ lvl: 2, d: p.d, m: p.m }); await h.settled();
      // the whole screen agrees on the day: the transport's playhead, the street and its crew counts move to the landing day
      try { if (z.scene && z.scene.setDay && Math.floor(z.scene.getDay()) !== p.day.day) z.scene.setDay(p.day.day); } catch (e) {} })();
    let flew = false; const P = Pj();
    if (from && P && P.canFly && P.canFly() && P.page) {
      const pr = P.page.getBoundingClientRect(), fp = { x: from.x - pr.left, y: from.y - pr.top };
      const card = el("div", "chasecard sm tk-card", `<svg class="i cc-i" aria-hidden="true" style="color:${ACC[entry.choice.dept]}"><use href="#i-inbox"/></svg>`);
      setRect(card, { x: fp.x - 28, y: fp.y - 28, w: 56, h: 56 }); P.page.appendChild(card);
      try {
        flew = await P.ferry(card, fp, async () => { await zoomP; if (stale()) return null; const r = z.dayRect(p.i); if (!r) return null; const s = pageRect(z.stage); return { x: s.x + r.x, y: s.y + r.y, w: r.w, h: r.h }; });
        if (flew && !stale()) {
          // the card becomes the stub: the stub is laid out hidden, the card grows into its rectangle, then the stub shows
          const c = makeStub(entry, p); c.stub.style.visibility = "hidden";
          const sr = pageRect(c.stub), a = { x: parseFloat(card.style.left), y: parseFloat(card.style.top), w: 56, h: 56 };
          card.classList.add("to-stub"); await tween(420, u => setRect(card, { x: a.x + (sr.x - a.x) * u, y: a.y + (sr.y - a.y) * u, w: a.w + (sr.w - a.w) * u, h: a.h + (sr.h - a.h) * u }));
          c.stub.style.visibility = ""; c.stub.classList.add("in"); place();
        }
      } catch (e) { console.warn("ticket flight", e && e.message); flew = false; }
      card.remove();
    }
    await zoomP;
    if (stale()) return { landed: false, superseded: true, pick: p };
    if (!cur || cur.entry !== entry) { const c = makeStub(entry, p); c.stub.classList.add("in", "fade"); }
    try { if (z.scene && z.scene.incoming) z.scene.incoming(p.d); } catch (e) {}
    try { S.emit("ticket:landed", { entry, pick: { d: p.d, m: p.m, i: p.i, date: p.day.date } }); } catch (e) {}
    return { landed: true, flew, pick: p };
  }

  function start() {
    const S = Sh(); if (!S) { console.warn("ticket.js needs shell.js first"); return; }
    try { S.on("screen:draw", place); S.on("screen:level", place); addEventListener("resize", () => setTimeout(place, 200)); } catch (e) { console.warn("ticket", e && e.message); }
  }
  root.TerryTicket = { land, clear, current: () => (cur ? cur.entry : null), pickDay: d => pickDay(d), dayLine, dateShort, place };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => setTimeout(start, 0)); else setTimeout(start, 0);
})(typeof window !== "undefined" ? window : globalThis);
