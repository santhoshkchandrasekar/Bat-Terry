/* The 2025 crew plan (FEEDBACK_NOV4_1808 item 12; plan switch and comparison, owner 08:17 to 08:19): the brief's table of crews by
 * department for each month, with hires and releases, for each of the notebook's four plans.
 * Data: plan2025.js (build_ledger.py, notebook section 4): the top level is the recommended plan, `plans` holds all four.
 * Index tabs on the page's top edge switch the plan (a tablist; Neutral, the recommended plan, by default). Row totals, the plan line and
 * the +20% figures follow the selected plan; BUDGETerry follows it through the bus ("ledger:plan"); the projector stays on the
 * recommended plan. "Compare with" picks a second plan B: cells keep A's count and stamp B's count beneath only where B differs, row
 * ends show both ("58% to 91%"), and the line under the table states the trade-off. Differences are announced to screen readers.
 * Before any chase it fills The Flip Side's empty state; from the first chase it folds away and lands at the bottom of the page, after
 * Echolocation, with the active Roost's flyway changes marked (on the recommended plan), and a one-line link stays at the top of The Flip
 * Side. When every Roost is closed it goes back. Hovering a cell lights that department and month on the projector. The CSV download
 * uses the page's downloads capability and hides when it is not available.
 */
(function (root) {
  "use strict";
  const doc = document, D = () => root.TerryPlan2025, Bus = () => root.TerryBus;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MINUS = "−", esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const money = v => (v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000) + "k"), pct = v => (Math.round(v * 1000) / 10).toFixed(1) + "%";
  const pct0 = v => Math.round(v * 100) + "%", sgn = v => (v >= 0 ? "+" : MINUS), dmoney = v => sgn(v) + money(Math.abs(v));
  let sec = null, secHead = null, link = null, where = null, hoverT = 0, dl = null, sel = null, cmp = null;

  // ==== the plans
  const keys = () => { const P = D(); return (P && P.order) || ["neutral"]; };
  const rec = () => { const P = D(); return (P && (P.recommended || P.plan)) || "neutral"; };
  const lab = k => { const P = D(); return (P && P.labels && P.labels[k]) || k; };
  const planOf = k => { const P = D(); if (!P) return null; return (P.plans && P.plans[k]) || (k === rec() ? { depts: P.depts, city: P.city } : null); };
  const crewsAt = (x, m) => x.crews[m] + (x.seasonal[m] || 0);

  function flyway() {   // the active Roost's crews where its flyway differs from the original plan: {dept: {m: crews}}
    const S = root.TerryState || {}, r = (S.roosts || []).find(x => x.id === S.activeRoost), out = {};
    if (!r || !r.escape || !r.escape.depts) return { r: null, ch: out };
    for (const [d, x] of Object.entries(r.escape.depts)) { const a = x.stay && x.stay.plan, b = x.escape && x.escape.plan; if (!a || !b) continue;
      for (let m = 0; m < 12; m++) { const ca = a.crews[m] + (a.seasonal[m] || 0), cb = b.crews[m] + (b.seasonal[m] || 0); if (ca !== cb) (out[d] = out[d] || {})[m] = cb; } }
    return { r, ch: out };
  }
  const names = a => (a.length > 2 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a.join(" and "));
  // the plan line: what the selected plan costs, how often it is on time, and what +20% demand does to it
  function line(k) {
    const P = D(), A = planOf(k), c = A.city, hold = A.depts.filter(x => x.ontime_hot20 >= .9), fall = A.depts.filter(x => x.ontime_hot20 < .9);
    const who = `${lab(k)} plan${k === rec() ? " (recommended)" : ""}`;
    const hot = !fall.length ? "it holds at +20% demand" : !hold.length ? `at +20% demand it falls to ${pct(c.ontime_hot20)}` : `at +20% demand ${names(hold.map(x => x.name))} ${hold.length > 1 ? "hold" : "holds"}; ${fall.map(x => `${x.name} falls to ${pct0(x.ontime_hot20)}`).join(", ")}`;
    const ins = P.insure;
    // the brief singles out Transportation (50% on time in 2024): say where this plan puts it, from the real 2024 record
    const EZ = root.__zoom && root.__zoom.E, bt = A.depts.find(x => x.dept === "BTDT"), c24 = EZ && EZ.cell ? EZ.cell("BTDT", null, null, null) : null;
    const btdt = bt && c24 && c24.n ? ` Transportation, ${Math.round(100 * (1 - c24.late / c24.n))}% on time in 2024, is <b>${pct(bt.ontime)}</b> in this plan.` : "";
    // the other side of the brief's +/-20%: a quiet year barely lowers the bill, because payroll does not shrink with demand
    const cold = c.cost_cold20 != null ? ` If demand runs 20% low it is ${pct(c.ontime_cold20)} on time and ${c.cost_cold20 >= c.cost * 0.95 ? "still " : ""}costs <b>${money(c.cost_cold20)}</b>, ${money(c.payroll)} of it payroll${c.ontime_cold20 >= 0.99 ? " for crews who sit partly idle" : ""}.` : "";
    if (k === rec() && fall.length && ins && ins.ontime_hot20) {
      // name the trade-off instead of only the shortfall: the notebook's aggressive plan is the insurance against +20% demand
      const lifted = fall.map(x => `${x.name} ${pct0(ins.ontime_hot20[x.dept])}`).join(", ");
      return `${who}: <b>${money(c.cost)}</b>, <b>${pct(c.ontime)}</b> on time.${btdt} If demand runs 20% hot, ${names(fall.map(x => x.name))} fall behind; the aggressive plan insures against that for <b>${money(ins.extra_payroll)}</b> more payroll (${lifted} on time).${cold}`;
    }
    return `${who}: <b>${money(c.cost)}</b>, <b>${pct(c.ontime)}</b> on time; ${hot}.${btdt}${cold}`;
  }
  // the trade-off between A and B, in one sentence
  function trade(a, b) {
    const A = planOf(a).city, B = planOf(b).city, dc = B.cost - A.cost, don = B.ontime - A.ontime, dh = B.ontime_hot20 - A.ontime_hot20;
    const la = lab(a), lb = lab(b), pts = v => `${Math.abs(Math.round(v * 1000) / 10).toFixed(1)} points`;
    const facts = `on time <b>${pct(A.ontime)} to ${pct(B.ontime)}</b>, and at +20% demand <b>${pct0(A.ontime_hot20)} to ${pct0(B.ontime_hot20)}</b>`;
    let gist;
    if (dc >= 0 && (don > 0.0005 || dh > 0.0005)) gist = `${lb} costs <b>${money(dc)}</b> more than ${la} and buys ${dh > don ? pts(dh) + " on time if demand runs 20% hot" : pts(don) + " on time"}`;
    else if (dc < 0 && (don < -0.0005 || dh < -0.0005)) gist = `${lb} saves <b>${money(-dc)}</b> against ${la} and gives up ${dh < don ? pts(dh) + " on time if demand runs 20% hot" : pts(don) + " on time"}`;
    else if (dc >= 0) gist = `${lb} costs <b>${money(dc)}</b> more than ${la}, in late and backlog costs, and does no better`;
    else gist = `${lb} costs <b>${money(-dc)}</b> less than ${la} and does no worse`;
    return `${gist}: ${facts}.`;
  }
  // the screen reader sentence for a comparison
  function said(a, b) {
    const A = planOf(a), B = planOf(b); let n = 0;
    A.depts.forEach((x, i) => { for (let m = 0; m < 12; m++) if (crewsAt(x, m) !== crewsAt(B.depts[i], m)) n++; });
    return `Comparing ${lab(a)} with ${lab(b)}. ${n ? `${n} of 48 months differ; each differing cell reads ${lab(b)}'s crews after ${lab(a)}'s.` : "Every month has the same crews."} ` + trade(a, b).replace(/<[^>]+>/g, "");
  }

  // ==== the page
  function tabs() {
    const k0 = sel || rec();
    return `<div class="ldg-tabs" role="tablist" aria-label="Plan">${keys().map(k => `<button type="button" role="tab" id="ldg-tab-${k}" class="ldg-tab${k === rec() ? " rec" : ""}" data-plan="${k}" aria-selected="${k === k0}" aria-controls="ldg-panel" tabindex="${k === k0 ? 0 : -1}"><span class="lt-n">${esc(lab(k))}</span>${k === rec() ? `<span class="lt-r">Recommended</span>` : ""}</button>`).join("")}</div>`;
  }
  function picker(a) {
    return `<label class="ldg-cmp"><span>Compare with</span><select class="ldg-sel"><option value="">No second plan</option>${keys().filter(k => k !== a).map(k => `<option value="${k}"${k === cmp ? " selected" : ""}>${esc(lab(k))}${k === rec() ? " (recommended)" : ""}</option>`).join("")}</select></label>`;
  }
  function render() {
    const P = D(); if (!P || !sec) return;
    const a = sel || rec(), b = cmp && cmp !== a && planOf(cmp) ? cmp : null, A = planOf(a), Bp = b ? planOf(b) : null;
    const F = where === "bottom" && a === rec() && !b ? flyway() : { r: null, ch: {} };
    const focusIn = sec.contains(doc.activeElement) ? (doc.activeElement.matches("[role=tab]") ? "tab" : doc.activeElement.matches(".ldg-sel") ? "sel" : null) : null;
    const lb = b ? esc(lab(b)) : "";
    const bStamp = (v, sr) => `<i class="ldg-bv"><span class="sr">${lb}: </span>${v}${sr ? `<span class="sr">${sr}</span>` : ""}</i>`;
    // the record beside the model (owner 21:48): the real on-time rate in 2023 and 2024, with the crews Boston had
    const EZ = root.__zoom && root.__zoom.E, H23 = EZ && EZ.data && EZ.data.hist_2023;
    // the table can draw before the engine is up (the tour shows it first): draw the record as soon as the engine is there
    if (!(EZ && EZ.cell && H23)) { clearTimeout(render._wait); render._n = (render._n || 0) + 1; if (render._n < 240) render._wait = setTimeout(render, 500); } else render._n = 0;
    const rec1 = d => { const ds = d ? [d] : ["PWDx", "BTDT", "PARK", "ISD"]; let n3 = 0, l3 = 0, n4 = 0, l4 = 0;
      for (const k of ds) { if (H23 && H23[k]) for (const c of H23[k]) { n3 += c[0]; l3 += c[1]; } if (EZ && EZ.cell) { const c = EZ.cell(k, null, null, null); n4 += c.n; l4 += c.late; } }
      const f = (n, l) => (n ? Math.round(100 * (1 - l / n)) + "%" : "\u2026");   // an ellipsis while the engine loads, never "n/a"
      return `<td class="ldg-n ldg-rec" title="Real on time: ${f(n3, l3)} in 2023, ${f(n4, l4)} in 2024">${f(n3, l3)}<span class="ldg-sl"> / </span>${f(n4, l4)}</td>`; };
    const head = `<tr><th scope="col" class="ldg-d"><span class="sr">Department</span></th>${MON.map((m, i) => `<th scope="col" title="${MONF[i]}"><abbr title="${MONF[i]}">${m}</abbr></th>`).join("")}<th scope="col" class="ldg-n">Cost</th><th scope="col" class="ldg-n">On time</th><th scope="col" class="ldg-n">At +20%</th><th scope="col" class="ldg-n ldg-rec" title="The real on-time rate, 2023 and 2024">Record <span class="ldg-yrs">23 / 24</span></th></tr>`;
    const body = A.depts.map((x, di) => { const y = Bp ? Bp.depts[di] : null;
      const cells = x.crews.map((c, m) => {
        const s = x.seasonal[m] || 0, h = x.hire[m], r = x.release[m], fly = F.ch[x.dept] && F.ch[x.dept][m] != null ? F.ch[x.dept][m] : null;
        const bv = y && crewsAt(y, m) !== crewsAt(x, m) ? crewsAt(y, m) : null;
        const marks = (h ? `<i class="ldg-h">+${h}</i>` : "") + (r ? `<i class="ldg-r">${MINUS}${r}</i>` : "") + (s ? `<i class="ldg-s">+${s}s</i>` : "") +
          (fly != null ? `<i class="ldg-f"><span class="ldg-dot" aria-hidden="true"></span><span class="sr">Roost ${F.r.n} flyway: </span>${fly}<span class="sr"> crews</span></i>` : "") + (bv != null ? bStamp(bv, " crews") : "");
        const t = `${x.name}, ${MONF[m]}: ${c} crews${s ? ` and ${s} seasonal` : ""}${h ? `, ${h} hired` : ""}${r ? `, ${r} released` : ""}${fly != null ? `; Roost ${F.r.n}'s flyway has ${fly}` : ""}${bv != null ? `; ${lab(b)} has ${bv}` : ""}`;
        return `<td data-m="${m}" tabindex="-1" class="${[fly != null ? "fly" : "", bv != null ? "diff" : ""].join(" ").trim()}" title="${esc(t)}"><b>${c + s}</b>${marks}</td>`; }).join("");
      const ends = y ? `<td class="ldg-n">${money(x.cost)}${Math.abs(y.cost - x.cost) >= 500 ? bStamp(dmoney(y.cost - x.cost)) : ""}</td>` +
        `<td class="ldg-n">${y.ontime !== x.ontime ? `${pct(x.ontime)}<i class="ldg-to"> to </i>${bStamp(pct(y.ontime))}` : pct(x.ontime)}</td>` +
        `<td class="ldg-n">${pct0(y.ontime_hot20) !== pct0(x.ontime_hot20) ? `${pct0(x.ontime_hot20)}<i class="ldg-to"> to </i>${bStamp(pct0(y.ontime_hot20))}` : pct0(x.ontime_hot20)}</td>`
        : `<td class="ldg-n">${money(x.cost)}</td><td class="ldg-n">${pct(x.ontime)}</td><td class="ldg-n">${pct0(x.ontime_hot20)}</td>`;
      return `<tr data-d="${x.dept}"><th scope="row" class="ldg-d"${x.dept === "PARK" ? ' title="Parks & Recreation"' : ""}>${root.TerryIcons ? root.TerryIcons.dept(x.dept, "ldg-ic") : ""}${esc(x.name)}</th>${cells}${ends}${rec1(x.dept)}</tr>`; }).join("");
    // the totals, behind a ruled double line: the city's crews each month, cost, on time (weighted by demand) and at +20%
    const tot = (pl, m) => pl.depts.reduce((s, x) => s + crewsAt(x, m), 0), cA = A.city, cB = Bp && Bp.city;
    const foot = `<tr class="ldg-tot"><th scope="row" class="ldg-d">City</th>${MON.map((_, m) => { const ta = tot(A, m), tb = Bp ? tot(Bp, m) : ta;
      return `<td><b>${ta}</b>${tb !== ta ? bStamp(tb, " crews") : ""}</td>`; }).join("")}` +
      `<td class="ldg-n">${money(cA.cost)}${cB && Math.abs(cB.cost - cA.cost) >= 500 ? bStamp(dmoney(cB.cost - cA.cost)) : ""}</td>` +
      `<td class="ldg-n">${cB && cB.ontime !== cA.ontime ? `${pct(cA.ontime)}<i class="ldg-to"> to </i>${bStamp(pct(cB.ontime))}` : pct(cA.ontime)}</td>` +
      `<td class="ldg-n">${cB && pct0(cB.ontime_hot20) !== pct0(cA.ontime_hot20) ? `${pct0(cA.ontime_hot20)}<i class="ldg-to"> to </i>${bStamp(pct0(cB.ontime_hot20))}` : pct0(cA.ontime_hot20)}</td>${rec1(null)}</tr>`;
    const has = k => A.depts.some(x => x[k].some(v => v > 0));
    const tw = t => root.TerryTerms && root.TerryTerms.term ? root.TerryTerms.term(t) : esc(t);   // Terry's words read apart (terms.js skips .ldg-key, so wrap here)
    const flyNote = F.r && Object.keys(F.ch).length ? `<span class="ldg-key ldg-key-f"><span class="ldg-dot" aria-hidden="true"></span><span class="ldg-fn">${tw(`Roost ${F.r.n}'s flyway`)}</span></span>` : "";
    const S = root.TerryState || {}, fo = !!(root.TerryRoost && root.TerryRoost.foldOf && root.TerryRoost.foldOf(where === "bottom" ? S.activeRoost : null).ledger);
    const sum = root.TerryFold ? root.TerryFold.sumLedger() : "", chev = root.TerryArt && root.TerryArt.ic ? root.TerryArt.ic("chev", "fold-i") : "";
    const sub = `Crews by department, month by month, in the notebook's ${esc(lab(a))} plan${a === rec() ? " (recommended)" : ""}. On time is the crew model, averaged over demand 14% under to 14% over forecast; At +20% is a year 20% busier; Record is what really happened, 2023 / 2024.`;
    sec.classList.toggle("is-folded", fo); sec.classList.toggle("ldg-vs", !!b);
    sec.innerHTML = `${tabs()}<header class="ldg-hd"><div class="fold-row"><button type="button" class="fold-chev" data-fold="ledger" aria-expanded="${!fo}" aria-label="${fo ? "Open" : "Fold"} The 2025 crew plan">${chev}</button><h2 class="disp" id="ledger-h">The 2025 crew plan</h2>${sum ? `<button type="button" class="fold-sum" data-fold-sum="ledger" tabindex="${fo ? 0 : -1}" title="Show it on the screen">${esc(sum)}</button>` : ""}</div><p class="ldg-sub">${sub}</p></header>
      <div class="ldg-panel" id="ldg-panel" role="tabpanel" aria-labelledby="ldg-tab-${a}">
      <div class="ldg-bar">${picker(a)}${b ? `<span class="ldg-key ldg-key-b"><i class="ldg-bv">${lb}</i>stamped only where it differs from ${esc(lab(a))}</span>` : ""}</div>
      <div class="ldg-wrap"><table class="ldg-t" aria-labelledby="ledger-h"><caption class="sr">${esc(lab(a))} plan${b ? `, compared with ${lb}` : ""}</caption><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
      <div class="ldg-foot"><p class="ldg-line">${b ? trade(a, b) : line(a)}</p><span class="ldg-keys">${has("hire") ? `<span class="ldg-key"><i class="ldg-h">+2</i>hired</span>` : ""}${has("release") ? `<span class="ldg-key"><i class="ldg-r">${MINUS}1</i>released</span>` : ""}${has("seasonal") ? `<span class="ldg-key"><i class="ldg-s">+4s</i>Parks seasonal</span>` : ""}${flyNote}</span>
      <button type="button" class="ldg-csv" hidden>Download CSV</button></div></div>
      <p class="sr ldg-live" aria-live="polite"></p>`;
    const btn = sec.querySelector(".ldg-csv"); btn.addEventListener("click", csv); canDownload().then(ok => { btn.hidden = !ok; });
    if (focusIn === "tab") { const t = sec.querySelector(`#ldg-tab-${a}`); if (t) t.focus(); } else if (focusIn === "sel") { const s = sec.querySelector(".ldg-sel"); if (s) s.focus(); }
  }
  function announce(txt) { const l = sec && sec.querySelector(".ldg-live"); if (l) setTimeout(() => { l.textContent = txt; }, 60); }
  function choose(k, how) {
    if (!planOf(k)) return; const was = sel || rec(); sel = k; if (cmp === k) cmp = null;
    if (k === was && how !== "force") return;
    render(); emit();
    const c = planOf(k).city; announce(cmp ? said(k, cmp) : `${lab(k)} plan: ${money(c.cost)}, ${pct(c.ontime)} on time, ${pct0(c.ontime_hot20)} at +20% demand.`);
  }
  function compareWith(k) {
    cmp = k && planOf(k) && k !== (sel || rec()) ? k : null; render(); emit();
    announce(cmp ? said(sel || rec(), cmp) : `No second plan. ${lab(sel || rec())} plan only.`);
  }
  function emit() { const B = Bus(); if (B) B.emit("ledger:plan", { plan: sel || rec(), compare: cmp, recommended: rec() }); }

  async function canDownload() { try { if (dl === null) dl = root.terryHost && root.terryHost.use ? (await root.terryHost.use("downloads")) || false : false; } catch (e) { dl = false; } return !!dl; }
  async function csv() {
    const k = sel || rec(), A = planOf(k), rows = [["plan", "department", "month", "crews", "seasonal", "hired", "released"]];
    A.depts.forEach(x => x.crews.forEach((c, m) => rows.push([lab(k), x.name, `2025-${String(m + 1).padStart(2, "0")}`, c, x.seasonal[m] || 0, x.hire[m], x.release[m]])));
    rows.push([]); A.depts.forEach(x => rows.push([lab(k), x.name, "year", "", "", "cost " + Math.round(x.cost), "on time " + pct(x.ontime)]));
    try { if (await canDownload()) await dl.save({ filename: `bat-terry-2025-crew-plan-${k.replace(/_/g, "-")}.csv`, data: rows.map(r => r.join(",")).join("\n") + "\n" }); } catch (e) { console.warn("csv", e && e.message); }
  }
  // the projector shows the hovered department and month (through the bus, like Ping's highlights)
  function hover(td) {
    clearTimeout(hoverT); hoverT = setTimeout(() => {
      const B = Bus(); if (!B) return;
      const hi = doc.querySelector("#askHi"); if (!td) { if (hi) hi.textContent = ""; return; }
      const d = td.parentNode.dataset.d, m = +td.dataset.m, z = root.__zoom, lv = z && z.S ? z.S.lvl : 0;
      if (!d) return;
      if (lv === 2 || (lv === 1 && z.S.d !== d)) return;   // the screen shows another department or a single month: leave it as it is
      const p = { dept: d, months: [m], what: "bar", handled: false, from: "ledger" }; B.emit("ask:highlight", p);
      const h = root.TerryShell && root.TerryShell.h; if (!p.handled && h && h.highlight) { try { h.highlight(d, m, "bar"); } catch (e) {} }
    }, 90);
  }
  function build() {
    if (sec || !D()) return !!sec;
    sec = doc.createElement("section"); sec.className = "ledger"; sec.id = "ledger"; sec.setAttribute("aria-labelledby", "ledger-h");
    sec.addEventListener("pointerover", e => { const td = e.target.closest("td[data-m]"); if (td) hover(td); });
    sec.addEventListener("pointerleave", () => hover(null));
    sec.addEventListener("click", e => { const t = e.target.closest("[role=tab]"); if (t) choose(t.dataset.plan); });
    sec.addEventListener("change", e => { if (e.target.matches(".ldg-sel")) compareWith(e.target.value); });
    sec.addEventListener("keydown", e => {   // the tablist: arrows move and select, Home and End jump
      const t = e.target.closest("[role=tab]"); if (!t) return; const ks = keys(), i = ks.indexOf(t.dataset.plan);
      const j = e.key === "ArrowRight" ? (i + 1) % ks.length : e.key === "ArrowLeft" ? (i + ks.length - 1) % ks.length : e.key === "Home" ? 0 : e.key === "End" ? ks.length - 1 : -1;
      if (j < 0) return; e.preventDefault(); choose(ks[j]); const n = sec.querySelector(`#ldg-tab-${ks[j]}`); if (n) n.focus();
    });
    // its own section, like The Flip Side and Echolocation (owner 6 Nov): a heading of its own, so the ledger never reads as part of the map
    secHead = doc.createElement("header"); secHead.className = "guide ldg-section";
    secHead.innerHTML = `<div class="gh"><h2 class="disp" id="ldg-sec-h">The Ledger</h2><span class="heard">4 plans, 2025</span></div>`;
    link = doc.createElement("a"); link.className = "ledger-link"; link.href = "#ledger"; link.hidden = true; link.textContent = "The 2025 crew plan, with this flyway's changes";   // owner 21:48: flyway, not Roost
    link.addEventListener("click", e => { e.preventDefault(); sec.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); });
    return true;
  }
  // fold away, move, land: like the Chase it card (instant under reduced motion)
  async function move(to) {
    if (!build()) return; const tt = doc.querySelector("#terrytory"); if (!tt) return;
    if (to === "empty" && !tt.querySelector(".rbody.empty")) return;
    const target = tt;   // always the foot of the page, under Echolocation (owner 11 Nov); "where" still says whether a chase has happened
    if (where === to && sec.parentNode === target) { render(); return; }
    if (sec.isConnected && !reduced()) { sec.classList.add("ldg-fold"); await new Promise(r => setTimeout(r, 380)); }
    where = to; render(); target.appendChild(secHead); target.appendChild(sec); sec.classList.remove("ldg-fold");
    if (!reduced()) { sec.classList.remove("ldg-land"); void sec.offsetWidth; sec.classList.add("ldg-land"); }
    const head = tt.querySelector(".tt-head"); if (head && link.parentNode !== head) head.appendChild(link);   // in the section header, on the right (owner 21:48)
    link.hidden = to !== "bottom";
  }
  function place() { const n = ((root.TerryState || {}).roosts || []).length; move(n ? "bottom" : "empty"); }
  function start() {
    let k = 0; const iv = setInterval(() => { if (doc.querySelector("#terrytory .rbody.empty") || ++k > 160) { clearInterval(iv); place(); } }, 250);
    const B = Bus(); if (!B) return;
    B.on("roost:created", place); B.on("roost:activated", () => { if (where === "bottom") render(); }); B.on("plan:view", () => { if (where === "bottom") render(); });
    B.on("roost:closed", p => { if (!p.left) setTimeout(place, 60); });
  }
  root.TerryLedger = {
    place, render,
    get where() { return where; },
    get plan() { return sel || rec(); }, get compare() { return cmp; }, get recommended() { return rec(); },
    plans() { return keys().slice(); }, planOf, label: lab,
    select(k) { choose(k, "force"); }, compareWith,
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
