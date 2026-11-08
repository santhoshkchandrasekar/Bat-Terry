/* TerrySession: what is on the page right now, as a small plain snapshot for Ping Terry (ask.js session_state tool and prompt summary).
 * Read only. It reads TerryState (roost.js), the plates' own answers (plates.js), the last intake ticket and the open surge (bus events).
 *
 *   TerrySession.snapshot()  -> { active_roost, other_roosts, screen, compare, last_ticket, open_surge }
 *   TerrySession.summary()   -> a few plain lines for the prompt, with a Screen part: exactly what is drawn now (marks, A and B, legend, Almanac, BUDGETerry, ledger)
 * Figures are rounded the way the page prints them, so an answer that repeats them passes the number guardrail.
 */
(function (root) {
  "use strict";
  const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const LEVEL = ["the city, all four departments", "a department's year", "a department's month, day by day"];
  const VERD = { escaped: "Escaped: the flyway clears the goal", already: "Already clear: the plan clears the goal without changes", partial: "Partly: the flyway helps but does not clear every department", unreachable: "No exit left: Dusk has passed, or no crew plan reaches the goal (see cannot_reach)" };
  const p1 = v => (Math.round(v * 1000) / 10).toFixed(1) + "%", usd = v => "$" + Math.round(v || 0).toLocaleString("en-US");
  const strip = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  const dateOf = iso => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${MON[+m[2] - 1]}${m[1] !== "2025" ? " " + m[1] : ""}` : null; };
  let lastTicket = null;
  const win = g => { const m = ((g && g.months) || []).slice().sort((a, b) => a - b); if (!m.length || m.length === 12) return "the year"; if (m.length === 1) return MON[m[0] - 1]; return `${MON[m[0] - 1]} to ${MON[m[m.length - 1] - 1]}`; };

  const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function predators(r) {
    const fl = r.flip, list = (fl && fl.predators) || [], P = root.TerryPlates, z = root.__zoom, F = root.TerryProj && root.TerryProj.fly ? root.TerryProj.fly() : null;
    return list.map(p => {
      const h = p.hypothesis || {}, ev = p.evidence || {}, o = { name: h.name, verdict: ev.verdict, where: [h.neighborhood, NAMES[h.department] || h.department].filter(Boolean).join(", "), cost_2024: usd(ev.cost_2024_usd) , cost_usd: Math.round(ev.cost_2024_usd || 0) };
      if (ev.years) { o.years = ev.years_text; if (ev.y2023) o.test_2023 = ev.y2023.silence_ratio != null ? ev.y2023.silence_ratio.toFixed(2) + "x the city report rate" : ev.y2023.n ? `${Math.round(ev.y2023.rate * 100)}% late vs ${Math.round(ev.y2023.dept_rate * 100)}% for the department` : "no matching requests"; }
      if (ev.requests_2024) { o.requests_2024 = ev.requests_2024; o.late_share = Math.round((ev.overdue_2024 || 0) / ev.requests_2024 * 100) + "%"; }
      const m = String(ev.detail || "").match(/\((\d+)% vs (\d+)% for the department\)/); if (m) { o.late_share = m[1] + "%"; o.department_late_share = m[2] + "%"; }
      try { const a = P && z && z.E ? P.answer(p, { E: z.E, F, X: r.escape, goal: r.goal }) : null; if (a) o.how_terry_answers = strip(a.line); } catch (e) {}
      const q = r.escape && r.escape.preds && r.escape.preds[h.name];   // crews or process: the type in its department's best months
      if (q) { o.fix = q.kind === "process" ? (q.dept_wide ? "department-wide: even the whole department stayed under the goal in its best months, so the record cannot show crews alone get there" : "a process fix: it ran late even in the department's best months") : q.kind === "crews" ? "crews: it kept up when the department did" : "unclear: too few requests to tell";
        if (q.floor_2024) o.best_months_2024 = `${Math.round(q.floor_2024.type_ontime * 100)}% on time in ${q.floor_2024.months.map(m => MON3[m - 1]).join(", ")} (department ${Math.round(q.floor_2024.dept_ontime * 100)}%)`;
        if (q.floor_2023) o.best_months_2023 = `${Math.round(q.floor_2023.type_ontime * 100)}% on time in ${q.floor_2023.months.map(m => MON3[m - 1]).join(", ")}`; }
      return o;
    });
  }
  function roostOut(r, full) {
    const g = r.goal || {}, X = r.escape, o = { roost: `Roost ${r.n}`, department: NAMES[r.dept] || (r.depts && r.depts.length > 1 ? "several departments" : "the city"), goal: String(r.goalText || "").replace(/\.$/, ""), window: win(g), target: Math.round((g.target || 0) * 100) + "%", verdict: VERD[r.verdict] || r.verdict || "" };
    if (!full) return o;
    o.view = r.view === "stay" ? "Original plan" : "Flyway";
    if (X && X.totals) { o.on_time_in_window_original_plan = p1(X.totals.stay.window); o.on_time_in_window_flyway = p1(X.totals.escape.window);
      if (X.weakest && Object.keys(X.depts || {}).length > 1) o.weakest_department = `${X.weakest.stay.name}: ${p1(X.weakest.stay.window)} with the original plan, ${X.weakest.escape.name} ${p1(X.weakest.escape.window)} with the flyway (a city goal needs every department to hold)`; o.payroll_added = usd(X.totals.escape.payroll - X.totals.stay.payroll); o.overdue_cost_avoided = usd(Math.max(0, X.totals.stay.penalty - X.totals.escape.penalty)); }
    // the failure card (the flip): the goal, last year's on-time in the window, what the forecast plan reaches, where it breaks
    const h = r.flip && r.flip.history;
    o.failure = { goal: o.target + " on time in " + o.window, last_year_on_time: h && h.n ? Math.round(h.ontime * 100) + "%" : null, last_year_requests: h && h.n ? h.n : null,
      forecast_plan_on_time: X && X.totals ? p1(X.totals.stay.window) : null, breaks_at: X && X.hot_pct > 0 ? `+${X.hot_pct}% demand` : null,
      holds_at_busier_year: !!(X && X.safe_at_forecast && X.verdict === "already"), flip_line: r.flip && r.flip.inverted ? strip(r.flip.inverted) : null,
      record_2023_on_time: r.flip && r.flip.history2023 ? Math.round(r.flip.history2023.ontime * 100) + "%" : null,
      card_headline: r.flip && r.flip.card ? r.flip.card.line : null, card_small_print: r.flip && r.flip.card ? r.flip.card.facts : null,
      record_and_model_differ: !!(r.flip && r.flip.card && r.flip.card.why && r.flip.card.why.differs) };
    // the flyway: its dated decisions (who, how many crews, from which month, signed by when)
    const dec = []; for (const [d, D] of Object.entries((X && X.depts) || {})) for (const a of (D.escape && D.escape.added) || []) dec.push({ department: NAMES[d] || d, action: a.action, crews: Math.abs(a.crews), starts: MON[a.month - 1], sign_by: dateOf(a.sign_by) });
    o.flyway = X ? { decisions: dec, payroll_added: o.payroll_added || null, overdue_cost_avoided: o.overdue_cost_avoided || null, on_time_original_plan: o.on_time_in_window_original_plan || null, on_time_flyway: o.on_time_in_window_flyway || null } : null;
    if (o.flyway) {   // why this start month (the search's runner-up), the storms it flies through, and how close an unreachable goal gets
      const why = []; for (const [d, D] of Object.entries(X.depts || {})) { const a = D.changed && D.how && D.how.alt; if (!a) continue;
        why.push(a.latest ? `${NAMES[d] || d}: starting any later misses the goal` : `${NAMES[d] || d}: starting in ${MON[a.m - 1]} instead also works with ${a.k} crew${a.k > 1 ? "s" : ""} but costs ${usd(a.extra_cost)} more`); }
      if (why.length) o.flyway.why_this_start = why.join("; ");
      if (X.shocks && X.shocks.length) o.flyway.flies_through = X.shocks.join("; ");
      if (X.limits && X.limits.length) o.flyway.cannot_reach = X.limits.map(l => l.dusk_passed ? `${l.name}: a crew signed now starts after the window` : l.k ? `${l.name}: even ${l.k} more crews from ${MON[l.from - 1]} reach ${(l.best_window * 100).toFixed(2)}%` : `${l.name}: no crew plan gets there`).join("; ");
    }
    const ps = predators(r), conf = ps.filter(p => p.verdict === "CONFIRMED");
    o.predators = ps.map(p => { const q = Object.assign({}, p); delete q.cost_usd; return q; });
    o.predator_counts = { confirmed: conf.length, rejected: ps.filter(p => p.verdict === "REJECTED").length, untestable: ps.filter(p => p.verdict === "UNTESTABLE").length };
    // the most dangerous one: the confirmed predator with the largest modeled 2024 cost (late share breaks a tie)
    const rank = conf.slice().sort((a, b) => (b.cost_usd - a.cost_usd) || (parseFloat(b.late_share || 0) - parseFloat(a.late_share || 0)));
    o.most_dangerous_predator = rank[0] ? rank[0].name : null; o.most_dangerous_rule = "the confirmed predator with the largest modeled 2024 cost";
    return o;
  }
  // ---- what is DRAWN right now, from the same state the renderers read (app.js marks and goal overlay, compare.js, the legend, the Almanac, BUDGETerry, the ledger)
  const m3 = i => MON[i].slice(0, 3), listM = a => a.map(m3).join(", ");
  const kindOf = mo => (mo.state === "spare" || (mo.state === "late" && mo.have >= mo.need - 0.01) ? "spare" : mo.state === "behind_not_late" ? "grace" : "short");   // app.js kindOf
  const planName = l => String(l || "").replace(/^Roost\s*\d+\s*[·.:-]\s*/i, "") || String(l || "");                                      // "Roost 1 · Flyway" -> "Flyway"
  const shortName = l => planName(l).replace(/\s+plan$/i, "") || String(l || "");                                                             // compare.js shortLabel
  const sgn1 = v => (v > 0.05 ? "+" : v < -0.05 ? "-" : "") + Math.abs(v).toFixed(1);
  const legendNow = () => { try { const lg = root.document && root.document.querySelector("#legend"); if (!lg) return null; if (lg.hidden || lg.style.display === "none") return [];
    return Array.from(lg.children).filter(n => !n.classList.contains("r")).map(n => n.textContent.replace(/\s+/g, " ").trim()).filter(Boolean); } catch (e) { return null; } };
  function owlMonths(GV, d) {   // app.js owlSpots: an owl sits only on the goal window and the two lead-in months before it
    const out = []; if (!GV || !GV.owls) return out; const gm = GV.goal && GV.goal.months && GV.goal.months.length ? GV.goal.months : null, lo = gm ? Math.min(...gm) - 2 : 1, hi = gm ? Math.max(...gm) : 12, seen = new Set();
    for (const ow of GV.owls) { if (ow.dept && ow.dept !== d) continue; for (const m of ow.months || []) { if (seen.has(m) || (gm && (m < lo || m > hi))) continue; seen.add(m); out.push({ m: m - 1, name: ow.name }); } }
    return out.sort((a, b) => a.m - b.m);
  }
  function drawn(sc, lvl, cmp, mode) {
    const z = root.__zoom, info = z && z.info, S = (z && z.S) || {}, GV = z && z.goalSpec, d = lvl ? S.d || sc.dept : null, mk = {};
    if (!info) return null;
    let band = false; try { band = !!(z.Z && z.Z.forecast && z.Z.forecast().ready); } catch (e) {}
    const goalRow = dd => !!(GV && (GV.depts || []).includes(dd));
    const C = cmp ? root.TerryState.compare : null, A = C && C.a, B = C && C.b;
    const same = !!(A && B && A.dept === B.dept && (A.depts || []).length === 1 && (B.depts || []).length === 1), ghost = same && lvl === 1 && d === A.dept;
    if (C) {
      const dlt = (B.windowOntime - A.windowOntime) * 100, a = shortName(A.label), b = shortName(B.label), w = win({ months: (A.window && A.window.months) || [] });
      const head = Math.abs(dlt) < 0.05 ? "Same in window" : dlt > 0 ? `${b} +${dlt.toFixed(1)} pts` : `${a} +${(-dlt).toFixed(1)} pts`;
      mk.plans = `A is ${planName(A.label)}, B is ${planName(B.label)}`;
      mk.header = `the header "${head}" is ${Math.abs(dlt) < 0.05 ? "a tie" : dlt > 0 ? "B's on-time lead over A" : "A's on-time lead over B"} in the goal window (${w}): A ${p1(A.windowOntime)}, B ${p1(B.windowOntime)}`;
      if (ghost) {
        mk.solid = `the solid filled bars are A, the ${planName(A.label)}: its crews planned each month`;
        mk.outlines = `the black outlines are B, the ${planName(B.label)}: its crews planned each month, drawn over A`;
        const nums = []; for (let m = 0; m < 12; m++) { const v = (B.ontime[m] - A.ontime[m]) * 100; if (Math.abs(v) >= 0.05 && A.window.months.includes(m + 1)) nums.push(`${m3(m)} ${sgn1(v)}`); }
        mk.numbers = `the numbers under the months are B minus A on-time points that month: green where B is ahead, red where B is behind, blank where equal; the violet-washed ones are the goal window${nums.length ? ` (${nums.join(", ")})` : ""}`;
      } else mk.outlines_none = same ? `B is drawn as black outlines only on ${NAMES[A.dept] || A.dept}'s year` : "the plans are in different departments, so the chart shows the city and only the header compares them";
    }
    const lineTxt = "the black line with dots is the forecast: crews needed each month";
    if (lvl === 2) {
      mk.subject = `${NAMES[d] || d}, ${MON[S.m != null ? S.m : sc.month]} 2025, day by day`;
      mk.bands = "top band: forecast requests (up) and closed (down) each day; middle band: the waiting pile, past due part in red; lower band: crews as blocks, solid when working, hollow when idle; red squares are requests closed late; shaded days are weekends";
      return mk;
    }
    const ds = lvl === 0 ? (z.DEPTS || Object.keys(info)) : [d], short = [], grace = [], train = [], owls = [], pills = [];
    for (const dd of ds) { const I = info[dd]; if (!I) continue; const nm = NAMES[dd] || dd, pre = lvl === 0 ? nm + " " : "";
      const sh = [], gr = []; I.months.forEach((mo, m) => { const k = kindOf(mo); if (k === "short") sh.push(m); else if (k === "grace") gr.push(m); });
      if (sh.length) short.push(pre + listM(sh)); if (gr.length) grace.push(pre + listM(gr));
      if (lvl === 1 && (I.training || []).length) train.push(listM(I.training.map(t => t.month)));
      if (goalRow(dd)) { const ow = owlMonths(GV, dd); if (ow.length) { const by = {}; ow.forEach(o => { (by[o.name] = by[o.name] || []).push(o.m); }); owls.push(...Object.entries(by).map(([n, ms]) => `${n}: ${listM(lvl === 0 ? [ms[0]] : ms)}`)); } }
      const hs = lvl === 1 ? (z.hires ? z.hires(dd) : []) : (goalRow(dd) && z.newHires && z.planFly !== false ? z.newHires(dd) : []);
      hs.forEach(h => pills.push(`${pre}+${h.crews} ${m3(h.month)}`)); }
    const plan = C ? `A's plan` : mode;
    mk.subject = lvl === 0 ? `the city, one row per department (each row its own scale), ${plan}` : `${NAMES[d] || d}'s 2025 year, month by month, ${plan}`;
    if (!mk.solid) mk.bars = `the blue bars are crews planned each month${C ? " (A's plan)" : ""}; a pale cap is spare crews`;
    mk.line = lineTxt; if (band) mk.band = "the shaded band around the line is the likely range of crews needed";
    mk.red = short.length ? `red is short: fewer crews than needed (${short.join("; ")})` : null;
    mk.hatched = grace.length ? `hatched ochre is behind but not late (${grace.join("; ")})` : null;
    if (train.length) mk.training = `hatched blue on top of a bar is a crew in paid training (${train.join("; ")})`;
    if (owls.length) mk.owls = `the owls mark predator months (${owls.join("; ")})${lvl === 0 ? ", one owl per predator at its first month, its other months washed violet" : ""}`;
    if (lvl === 1 && goalRow(d) && GV.dusk && GV.dusk.day >= 0) mk.dusk = `the dashed Dusk tick is ${dateOf(GV.dusk.date) || "the last day to act"}, the last day to act`;
    if (pills.length) mk.pills = `+N pills are hires: N crews who start working that month (${pills.join("; ")})`;
    return mk;
  }
  function boards() {
    const out = {};
    try { const al = root.TerryAlmanac, bs = al && al.beats; if (bs && bs.length) out.almanac = bs.map(b => [b.when, b.num, strip(b.text)].filter(Boolean).join(" ")); } catch (e) {}
    try { const BT = root.TerryBudgeterry, st = BT && BT.state, M = root.TerryBudget && root.TerryBudget.money;
      if (st && st.states && M) out.budgeterry = st.states.map(x => { const s = x.st, dd = st.dim && s.depts ? s.depts.find(y => y.dept === st.dim) : null, r = dd || s;
        return `${x.tag ? x.tag + ": " : ""}${dd ? (NAMES[dd.dept] || dd.dept) + " " : ""}${r.left >= 0 ? `${Math.round(r.frac * 100)}%, ${M(r.left)} left` : `${M(-r.left).replace("−", "")} over`} ${st.t >= 12 ? "after the whole year" : `through ${MON[Math.max(0, Math.ceil(st.t) - 1)]}`}`; }); } catch (e) {}
    try { const L = root.TerryLedger; if (L && L.plan) out.ledger = { plan: L.label ? L.label(L.plan) : L.plan, compare: L.compare ? (L.label ? L.label(L.compare) : L.compare) : null }; } catch (e) {}
    return out;
  }
  function snapshot() {
    const S = root.TerryState || {}, rs = S.roosts || [], act = rs.find(r => r.id === S.activeRoost) || null, sc = S.screen || {};
    const cmp = S.compare ? { a: S.compare.a && S.compare.a.label, b: S.compare.b && S.compare.b.label } : null;
    const mode = cmp ? "Compare" : act ? (act.view === "stay" ? "Original plan" : "Flyway") : "Terry's 2025 plan";
    const lvl = Math.max(0, Math.min(2, sc.level || 0));
    const screen = { level: LEVEL[lvl], department: sc.dept ? NAMES[sc.dept] || sc.dept : null, month: sc.month != null && lvl === 2 ? MON[sc.month] : null, mode, maximized: !!sc.maximized };
    try { const dr = drawn(sc, lvl, cmp, mode); if (dr) screen.drawn = dr; } catch (e) {}
    const lg = legendNow(); if (lg) screen.legend = lg;
    Object.assign(screen, boards());
    let surge = null; try { const T = root.TerryTerritory, s0 = T && T.surges ? T.surges()[0] : null; if (s0) surge = { department: NAMES[s0.dept] || s0.dept, above_normal: Math.round(s0.surge * 100) + "%" }; } catch (e) {}
    return { active_roost: act ? roostOut(act, true) : null, other_roosts: rs.filter(r => r !== act).map(r => roostOut(r, false)), roost_count: rs.length, screen, compare: cmp, last_ticket: lastTicket, open_surge: surge };
  }
  function summary() {
    const s = snapshot(), a = s.active_roost, bits = [];
    bits.push(a ? `Active: ${a.roost}, ${a.goal} (${a.view}; ${a.predator_counts.confirmed} confirmed predators${a.most_dangerous_predator ? `, most dangerous: ${a.most_dangerous_predator}` : ""}).` : "No Roost yet: nothing has been chased.");
    if (s.other_roosts.length) bits.push(`Other Roosts: ${s.other_roosts.map(r => `${r.roost} (${r.department}, ${r.window})`).join("; ")}.`);
    bits.push(`The projector shows ${s.screen.level}${s.screen.department ? `, ${s.screen.department}` : ""}${s.screen.month ? `, ${s.screen.month}` : ""}, ${s.screen.mode}.`);
    const scr = screenLine(s.screen); if (scr) bits.push(scr);
    if (s.last_ticket) bits.push(`Last resident ticket: ${s.last_ticket.type}, ${s.last_ticket.department}.`);
    if (s.open_surge) bits.push(`Open surge: ${s.open_surge.department}.`);
    return bits.join(" ");
  }
  // the Screen part of the summary: what is drawn, the legend, the Almanac rows, BUDGETerry and the ledger, a few short clauses
  function screenLine(sc) {
    const d = sc.drawn, out = [];
    if (d) { const o = ["subject", "plans", "header", "solid", "outlines", "outlines_none", "numbers", "bars", "line", "band", "red", "hatched", "training", "owls", "dusk", "pills", "bands"].map(k => d[k]).filter(Boolean);
      if (o.length) out.push(`Screen (exactly what is drawn now): ${o.join("; ")}.`); }
    if (sc.legend && sc.legend.length) out.push(`Legend shows: ${sc.legend.join(", ")}.`);
    if (sc.almanac && sc.almanac.length) out.push(`Almanac board: ${sc.almanac.join(" | ")}.`);
    if (sc.budgeterry && sc.budgeterry.length) out.push(`BUDGETerry reads ${sc.budgeterry.join(" | ")}.`);
    if (sc.ledger) out.push(`Ledger: ${sc.ledger.plan}${sc.ledger.compare ? ` compared with ${sc.ledger.compare}` : ""}.`);
    return out.join(" ");
  }
  function start() {
    const B = root.TerryBus; if (!B) return;
    B.on("intake:routed", p => { const e = p && p.entry, c = e && e.choice; if (!c) return; const T2 = root.TerryTicket, d = e.pick && T2 && T2.dateShort ? T2.dateShort(e.pick) : null;
      lastTicket = { type: c.plain, department: NAMES[c.dept] || c.dept, queue: c.queueName || c.queue || "", day: d, neighborhood: e.place ? e.place.short || e.place.neighborhood : null }; });
  }
  root.TerrySession = { snapshot, summary, screenLine };
  start();
})(typeof window !== "undefined" ? window : globalThis);
