/* TerryAlmanac: the projector's translator, drawn as a split-flap board directly under the screen.
 *
 * It retells whatever the projector shows right now in at most 3 beats (icon, month or date, one number, one short line).
 * It listens on TerryBus (screen:level, screen:draw, plan:view, plan:stop, roost:activated, compare:open, compare:close) and
 * reads __zoom (levels, plan, goal view) and TerryState. It never edits the projector; clicking a beat calls __zoom.goTo.
 * Every number comes from TerryLevels or the Roost scenarios; the lines are templates, so it works offline.
 *
 * Motion: the view settles 300 ms after the last change, then only changed tiles flap (top half falls over the bottom),
 * staggered, about 450 ms in all. Reduced motion: a soft crossfade. Nothing moves otherwise.
 *
 * API for the tour and Ping:  window.TerryAlmanac = { el, beats, view, focus(i), refresh(), ready }
 *   and the bus event "almanac:settled" { beats, view } after each change.
 */
(function (root) {
  "use strict";
  const Bus = root.TerryBus; if (!Bus) return;
  const doc = root.document;
  const ROWS = 3, NW = 5, NN = 5;                       // rows on the board, date tiles (3 letters, 2 digits), number tiles (room for "+130K"); a unit tile follows
  const MS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const SHORT = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const pct = v => (v >= 0.995 && v < 1 ? "99.5" : (Math.floor(v * 1000) / 10).toFixed(1).replace(/\.0$/, "")) + "%";
  const crews = n => `${n} crew${n === 1 ? "" : "s"}`;
  const isoDate = iso => { const [, m, d] = iso.split("-").map(Number); return { m: m - 1, d }; };
  const dayLabel = iso => { const x = isoDate(iso); return `${x.d} ${MON[x.m]}${iso.startsWith("2025") ? "" : " " + iso.slice(0, 4)}`; };
  const MINUS = "\u2212";
  const numTile = n => (Math.abs(n) >= 10000 ? Math.round(n / 1000) + "K" : String(Math.round(n)));
  const tileDate = iso => { const x = isoDate(iso); return `${MS[x.m]} ${x.d}`; };
  const reduced = () => Bus.reduced();
  const Z_ = () => root.__zoom;

  // ==== icons (duotone, 24 grid)
  const IC = {
    crew: '<circle cx="12" cy="7.5" r="3.6" fill="var(--a-soft)" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 20c.6-4.3 3.5-6.6 7.2-6.6s6.6 2.3 7.2 6.6" fill="var(--a-soft)" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    hatch: '<rect x="5" y="4" width="14" height="16" rx="1.5" fill="var(--a-paper)" stroke="var(--a-behind)" stroke-width="1.6"/><path d="M5.5 10.5l5-5.5M5.5 16l10-11M7.5 19.5l11-12M13 19.5l5.5-6" stroke="var(--a-behind)" stroke-width="1.6"/>',
    train: '<rect x="5" y="4" width="14" height="16" rx="1.5" fill="var(--a-paper)" stroke="var(--a-hire)" stroke-width="1.6"/><path d="M5.5 10.5l5-5.5M5.5 16l10-11M7.5 19.5l11-12M13 19.5l5.5-6" stroke="var(--a-hire)" stroke-width="1.6"/>',
    owl: '<path d="M6 8.5 7 4l3 2.6h4L17 4l1 4.5c1 1.4 1.4 3 1.4 4.8 0 4.3-3.3 7.2-7.4 7.2s-7.4-2.9-7.4-7.2c0-1.8.4-3.4 1.4-4.8z" fill="var(--a-pred)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="9.4" cy="11" r="2.1" fill="var(--a-paper)"/><circle cx="14.6" cy="11" r="2.1" fill="var(--a-paper)"/><circle cx="9.4" cy="11" r=".9" fill="currentColor"/><circle cx="14.6" cy="11" r=".9" fill="currentColor"/><path d="M11.2 13.4 12 15l.8-1.6z" fill="var(--a-sun)"/>',
    sun: '<path d="M5 15a7 7 0 0 1 14 0z" fill="var(--a-sun)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 15h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 3.5v2.2M5.6 6.6l1.5 1.5M18.4 6.6l-1.5 1.5M12 17.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>',
    pill: '<rect x="2.8" y="6.5" width="18.4" height="11" rx="5.5" fill="var(--a-paper)" stroke="var(--a-hire)" stroke-width="1.7"/><path d="M8 12h3.6M9.8 10.2v3.6" stroke="var(--a-hire)" stroke-width="1.7" stroke-linecap="round"/><path d="M13.6 9.5h2.3v5" stroke="var(--a-hire)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    storm: '<path d="M7 15.5h10.2a3.8 3.8 0 0 0 .4-7.6A5.4 5.4 0 0 0 7.2 8.6 3.5 3.5 0 0 0 7 15.5z" fill="var(--a-soft)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12.6 13.2 10 17.6h2.6l-1.2 3.8 3.6-5h-2.6l1.4-3.2z" fill="var(--a-short)" stroke="var(--a-short)" stroke-width=".8" stroke-linejoin="round"/>',
    ticket: '<path d="M4 6.5h16v3.2a2.3 2.3 0 0 0 0 4.6v3.2H4v-3.2a2.3 2.3 0 0 0 0-4.6z" fill="var(--a-paper)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14.5 7v10" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.6 1.6"/><path d="M7.2 10.4h4.6M7.2 13.6h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    range: '<path d="M3 14c3-1 5-6 9-6s6 4 9 3v6c-3 1-5-3-9-3s-6 2-9 3z" fill="var(--a-soft)"/><path d="M3 16.5c3-1 5-5 9-5s6 3 9 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    scale: '<path d="M12 4v15M6 19h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 8h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 8 2 13a2.6 2.6 0 0 0 4.4 0z" fill="var(--a-soft)" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="m20 8-2.2 5a2.6 2.6 0 0 0 4.4 0z" fill="var(--a-pill)" stroke="var(--a-hire)" stroke-width="1.2" stroke-linejoin="round"/>',
  };
  const svgOf = k => (k && /^dept:/.test(k) && root.TerryIcons ? root.TerryIcons.dept(k.slice(5), "", "width:22px;height:22px") : k && IC[k] ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IC[k]}</svg>` : "");
  // owner 05:17 and 05:18: a beat about a single department shows its icon in the free icon tile; never inside sentences

  // ==== the legend, decoded once a session
  const MARKS = [
    { k: "hatch", icon: "hatch", test: () => !!doc.querySelector("#legend .lg-grace"), text: "Hatched bars: behind, but nothing late yet." },
    { k: "hire", icon: "pill", test: () => !!doc.querySelector('#legend use[href="#i-hire"]'), text: "The +N pills: crews the plan adds that month." },
    { k: "train", icon: "train", test: () => !!doc.querySelector("#legend .lg-train"), text: "Blue hatch: new crews in their paid training month." },
    { k: "owl", icon: "owl", test: () => { const g = Z_() && Z_().goalSpec; return !!(g && g.owls && g.owls.length && Z_().S.lvl < 2); }, text: "Owls mark predators: the months that can break the goal." },
    { k: "dusk", icon: "sun", test: () => { const g = Z_() && Z_().goalSpec; return !!(g && g.dusk && Z_().S.lvl === 1); }, text: "The Dusk sun: the last day to sign crews and still be on time." },
    { k: "band", icon: "range", test: () => !!doc.querySelector("#legend .lg-band"), text: "The shaded band: where demand will likely land." },
  ];
  const seen = () => ((root.TerryState && root.TerryState.almanac && root.TerryState.almanac.seen) || []);
  function markSeen(k) {   // TerryState is a snapshot replaced on change; this adds one key the way roost.js does
    const st = root.TerryState || {}, al = st.almanac || {};
    root.TerryState = Object.assign({}, st, { almanac: Object.assign({}, al, { seen: seen().concat([k]) }) });
  }

  // ==== beats, from the engine's numbers
  const whenTiles = w => { const [a, b] = String(w || "").toUpperCase().split(" "); return (a || "").slice(0, 3).padEnd(3, " ") + (b || "").slice(0, 2).padStart(2, " "); };
  const beat = (icon, when, num, text, to, tag, tc) => ({ icon, when: (when || "").toUpperCase(), tiles: whenTiles(when), num: String(num == null ? "" : num).replace(/^-/, MINUS).slice(0, NN), text, to: to || null, tag: tag || "", tc: tc || "" });
  const U = (bt, unit) => { if (bt) bt.unit = unit || ""; return bt; };   // the unit tile after the number (owner 08:45)
  const needC = mo => Math.ceil(mo.need - 0.01);
  let pv = null;   // the view a fold hover is previewing, until it restores or a view is committed
  function activeRoost() { const st = root.TerryState || {}; return (st.roosts || []).find(r => r.id === st.activeRoost) || null; }
  function viewInfo() {
    const z = Z_(), st = root.TerryState || {}, S = z.S, r = activeRoost(), cmp = st.compare;
    const rv = r && pv && pv.roostId === r.id ? pv.view : r && r.view;   // a hover preview (plan:view, preview: true) narrates the previewed view
    const fly = !!(r && rv === "flyway" && z.goalSpec && z.basePlan), stay = !!(r && rv === "stay");
    let label = S.lvl === 0 ? "Boston 2025" : SHORT[S.d] + (S.lvl === 1 ? ", 2025" : S.lvl === 2 ? ", " + MON[S.m] : "");
    if (S.lvl === 3) label = SHORT[S.d] + ", one day";
    if (cmp) label = cmp.a && cmp.b ? names2(cmp.a, cmp.b).join(" vs ") : "Compare"; else if (fly) label += " · Flyway"; else if (stay) label += " · Original plan";
    return { lvl: S.lvl, d: S.d, m: S.m, fly, stay, cmp, roost: r, label };
  }

  function cityBeats(v) {
    const z = Z_(), Z = z.Z, C = Z.city(z.plan), out = [];
    // the peak: the department whose demand swings most
    let pk = null;
    for (const x of C.depts) {
      const ns = x.months.map(needC), hi = Math.max(...ns), lo = Math.min(...ns), m = ns.indexOf(hi), sw = hi / Math.max(1, lo);
      if (!pk || sw > pk.sw) pk = { d: x.dept, name: x.name, hi, lo, m, sw, lom: ns.indexOf(lo) };
    }
    const season = ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter"][pk.m];
    const swing = pk.sw >= 1.9 ? `demand doubles to ${pk.hi} crews by ${MON[pk.m]}` : `need climbs from ${pk.lo} to ${pk.hi} crews by ${MON[pk.m]}`;
    const peakB = U(beat("dept:" + pk.d, MS[pk.m], pk.hi, `${season} belongs to ${SHORT[pk.d]}: ${swing}.`, { lvl: 1, d: pk.d, m: pk.m }), "CREWS");
    // the risk: worst short month, else behind, else all covered
    let worst = null, behind = null;
    const others = C.depts.filter(x => x.dept !== pk.d).some(x => x.months.some(mo => mo.state !== "spare" && needC(mo) > Math.round(mo.have)));
    for (const x of C.depts) for (const mo of x.months) {
      if (others && x.dept === pk.d) continue;   // the peak row already speaks for that department
      const gap = needC(mo) - Math.round(mo.have);
      if ((mo.state === "short" || mo.state === "late") && gap > 0 && (!worst || gap > worst.gap)) worst = { d: x.dept, m: mo.month, gap, late: mo.late };
      if (mo.state === "behind_not_late" && (!behind || gap > behind.gap)) behind = { d: x.dept, m: mo.month, gap };
    }
    let riskB;
    if (worst && behind && worst.gap <= 1 && behind.gap > 2) worst = null;   // a one crew dip matters less than a long stretch behind
    if (worst) riskB = U(beat("dept:" + worst.d, MS[worst.m], "-" + worst.gap, `${SHORT[worst.d]} runs ${crews(worst.gap)} short in ${MON[worst.m]}; some go late.`, { lvl: 1, d: worst.d, m: worst.m }), "CREWS");
    else if (behind) riskB = U(beat("dept:" + behind.d, MS[behind.m], "-" + Math.max(1, behind.gap), `${SHORT[behind.d]} is ${crews(Math.max(1, behind.gap))} short in ${MON[behind.m]}; nothing goes late.`, { lvl: 1, d: behind.d, m: behind.m }), "CREWS");
    else riskB = U(beat("crew", "", "0", "Every month is covered; no department runs a crew short.", { lvl: 0 }), "CREWS");
    // the hires: how many crews the plan signs, and the first date
    const hs = []; for (const x of C.depts) for (const h of x.decisions) if (h.action === "hire") hs.push(Object.assign({ d: x.dept }, h));
    hs.sort((a, b) => a.decide_by.localeCompare(b.decide_by));
    const tot = hs.reduce((s, h) => s + h.crews, 0);
    const hireB = tot ? U(beat("pill", tileDate(hs[0].decide_by), "+" + tot, `The plan signs ${crews(tot)} in all; the first by ${dayLabel(hs[0].decide_by)}.`, { lvl: 1, d: hs[0].d, m: hs[0].month }), "CREWS")
      : U(beat("pill", "", "0", "No hiring this year: the January crews carry it.", { lvl: 0 }), "CREWS");
    if (v.fly) { const f = flyBeat(); if (f) out.push(f); }
    if (v.roost && z.goalSpec && z.goalSpec.owls && z.goalSpec.owls.length) out.push(owlBeat());
    out.push(peakB, riskB, hireB);
    return out;
  }
  function flyBeat(dOnly) {   // what the flyway changes against the Original plan
    const z = Z_(), g = z.goalSpec; if (!g || !z.basePlan) return null;
    let best = null;
    for (const d of (dOnly ? [dOnly] : g.depts || [])) {
      const a = z.basePlan[d], b = z.plan[d]; if (!a || !b) continue;
      for (let m = 0; m < 12; m++) { const dd = (b.crews[m] + b.seasonal[m]) - (a.crews[m] + a.seasonal[m]); if (dd > 0 && (!best || m < best.m)) best = { d, m, dd }; }
    }
    if (!best) return null;
    return U(beat("pill", MS[best.m], "+" + best.dd, `The flyway adds ${crews(best.dd)} to ${SHORT[best.d]} from ${MON[best.m]}.`, { lvl: 1, d: best.d, m: best.m }, "Flyway"), "CREWS");
  }
  function owlBeat(d) {
    const g = Z_().goalSpec, o = g.owls.find(x => !d || !x.dept || x.dept === d) || g.owls[0];
    const ms = o.months.slice().sort((a, b) => a - b), m0 = ms[0] - 1, dd = o.dept || d || (g.depts && g.depts[0]);
    const list = ms.length > 2 ? `${MON[ms[0] - 1]} to ${MON[ms[ms.length - 1] - 1]}` : ms.map(x => MON[x - 1]).join(" and ");
    return U(beat("owl", MS[m0], ms.length, `Predator for ${ms.length} month${ms.length === 1 ? "" : "s"}, ${list}: ${o.name}.`, dd ? { lvl: 1, d: dd, m: m0 } : { lvl: 0 }), "MONTHS");
  }

  function deptBeats(v) {
    const z = Z_(), d = v.d, I = z.Z.dept(d, z.plan[d]), out = [], ns = I.months.map(needC);
    const hi = Math.max(...ns), mp = ns.indexOf(hi);
    let mq = 0; for (let m = 0; m <= mp; m++) if (ns[m] < ns[mq]) mq = m;
    const peakB = U(beat("crew", MS[mp], hi, mq < mp ? `Demand builds from ${MON[mq]} to its peak in ${MON[mp]}: ${hi} crews needed.` : `Demand peaks in ${MON[mp]}: ${hi} crews needed.`, { lvl: 2, d, m: mp }), "CREWS");
    const hs = I.decisions.filter(x => x.action === "hire").sort((a, b) => b.crews - a.crews || a.decide_by.localeCompare(b.decide_by));
    const h = hs[0];
    const decB = h ? U(beat("pill", tileDate(h.decide_by), "+" + h.crews, `Sign ${crews(h.crews)} by ${dayLabel(h.decide_by)}; they start in ${MON[h.month]}.`, { lvl: 2, d, m: Math.max(0, h.month - 1) }), "CREWS")
      : U(beat("pill", "", I.start_crews, `No hiring: the ${I.start_crews} January crews carry the year.`, { lvl: 1, d }), "CREWS");
    let w = null;
    for (const mo of I.months) { const gap = ns[mo.month] - Math.round(mo.have); if (mo.state !== "spare" && gap > 0 && (!w || (mo.state !== "behind_not_late") > (w.mo.state !== "behind_not_late") || gap > w.gap)) w = { mo, gap }; }
    let riskB;
    if (w && w.mo.state !== "behind_not_late") riskB = U(beat("storm", MS[w.mo.month], "-" + w.gap, `${MON[w.mo.month]} runs ${crews(w.gap)} short; ${fmt(w.mo.late)} request${Math.round(w.mo.late) === 1 ? "" : "s"} close late.`, { lvl: 2, d, m: w.mo.month }), "CREWS");
    else if (w) riskB = U(beat("hatch", MS[w.mo.month], "-" + w.gap, `${crews(w.gap)} short in ${MON[w.mo.month]}; nothing goes late.`, { lvl: 2, d, m: w.mo.month }), "CREWS");
    else { const lm = 11, spare = Math.round(I.months[lm].have) - ns[lm]; riskB = U(beat("crew", MS[lm], spare > 0 ? "+" + spare : "0", `After ${MON[mp]} demand eases; ${spare > 0 ? crews(spare) + " spare" : "the roster matches"} by December.`, { lvl: 2, d, m: lm }), "CREWS"); }
    const g = z.goalSpec, mine = g && (g.depts || []).includes(d);
    if (mine) {
      if (v.fly) { const f = flyBeat(d); if (f) out.push(f); }
      if (g.dusk && g.dusk.date) out.push(beat("sun", tileDate(g.dusk.date), "", `Dusk, ${dayLabel(g.dusk.date)}: the last day to sign and be on time.`, { lvl: 1, d, m: isoDate(g.dusk.date).m }));
      if (g.owls && g.owls.length) out.push(owlBeat(d));
    }
    out.push(riskB, decB, peakB);
    return out;
  }

  function monthBeats(v) {
    const z = Z_(), d = v.d, m = v.m, MD = z.dayInfo(d, m), I = z.Z.dept(d, z.plan[d]), out = [], days = MD.days;
    let pk = days[0]; for (const x of days) if (x.arrivals > pk.arrivals) pk = x;
    const pd = isoDate(pk.date);
    out.push(U(beat("ticket", `${MS[m]} ${pd.d}`, numTile(pk.arrivals), `${WD[pk.weekday]} the ${ord(pd.d)} is busiest: ${fmt(pk.arrivals)} requests arrive.`, { lvl: 2, d, m }), "REQS"));
    let bk = days[0]; for (const x of days) if (x.backlog > bk.backlog) bk = x;
    const after = days.filter(x => x.day > bk.day), clear = after.find(x => x.backlog <= bk.backlog * 0.6), bd = isoDate(bk.date);
    out.push(beat(MD.late > 0.5 ? "storm" : "hatch", `${MS[m]} ${bd.d}`, numTile(bk.backlog),
      clear ? `The backlog peaks at ${fmt(bk.backlog)} on the ${ord(bd.d)} and eases by the ${ord(isoDate(clear.date).d)}.` : `The backlog peaks at ${fmt(bk.backlog)} on the ${ord(bd.d)} and carries into ${MON[(m + 1) % 12]}.`, { lvl: 2, d, m }));
    const tr = I.training.find(x => x.month === m);
    if (tr) out.push(U(beat("train", MS[m], tr.crews, `${crews(tr.crews)} train this month and start work in ${MON[(m + 1) % 12]}.`, { lvl: 2, d, m }), "CREWS"));
    else if (MD.late > 0.5) out.push(U(beat("storm", MS[m], pct(MD.ontime), `${fmt(MD.late)} requests close late; ${pct(MD.ontime)} are on time.`, { lvl: 2, d, m }), "ON TIME"));
    else if (MD.days_with_a_spare_crew > 0) out.push(U(beat("crew", MS[m], MD.days_with_a_spare_crew, `A crew stands spare on ${MD.days_with_a_spare_crew} of ${MD.workdays} working days.`, { lvl: 2, d, m }), "DAYS"));
    else out.push(U(beat("crew", MS[m], MD.crews + MD.seasonal, `All ${MD.crews + MD.seasonal} crews work every working day; none stand spare.`, { lvl: 2, d, m }), "CREWS"));
    return out;
  }
  const ord = n => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");

  function dayBeats(v) {   // level 3, once the projector draws it: a plain reading of the street
    const z = Z_(), S = z.S, t = S.t != null ? S.t : S.day; if (t == null || !z.Z.day) return monthBeats(v);
    const D = z.Z.day(v.d, t, z.plan[v.d]), x = isoDate(D.date), q = D.queue_after, wait = Object.values(q).reduce((a, b) => a + b, 0);
    const out = [U(beat("crew", `${MS[x.m]} ${x.d}`, D.crews, `${WD[D.weekday]} ${x.d} ${MON[x.m]}: ${crews(D.crews)} out, ${fmt(wait)} requests waiting.`, { lvl: 2, d: v.d, m: x.m }), "CREWS")];
    if (q.overdue > 0.5) out.push(U(beat("storm", "", fmt(q.overdue), `${fmt(q.overdue)} requests are already past due.`, null), "REQS"));
    out.push(U(beat("ticket", "", fmt(D.arrivals), `${fmt(D.arrivals)} new requests arrive and ${fmt(D.closed)} close.`, null), "REQS"));
    return out;
  }

  // Compare (owner 08:29): a plain comparison in the plans' names, read from the first-named plan's side. Number tiles carry the
  // difference with its sign and unit; the tag names the plan the row favours, in that plan's colour.
  const shortName = l => String(l || "").replace(/^Roost\s*\d+\s*[\u00b7.:]\s*/i, "").trim() || String(l || "");
  function names2(a, b) { let na = shortName(a.label), nb = shortName(b.label); if (na === nb) { na = String(a.label).replace(/\s*\u00b7\s*/, " "); nb = String(b.label).replace(/\s*\u00b7\s*/, " "); } return [na, nb]; }
  const the = (n, cap) => (/^original/i.test(n) ? (cap ? "The " : "the ") + n : n);
  const winTxt = w => { const ms = (w && w.months) || []; if (!ms.length) return "the goal window"; const a = MON[ms[0] - 1], b = MON[ms[ms.length - 1] - 1]; return ms.length === 1 ? a : `${a} to ${b}`; };
  function compareBeats(v) {
    const { a, b } = v.cmp, out = [], d = b.dept || a.dept, [na, nb] = names2(a, b);
    const pa = a.windowOntime, pb = b.windowOntime, dpt = (pa - pb) * 100, win = winTxt(a.window || b.window);
    const mark = (bt, x, n) => { if (bt && x) { bt.tag = n; bt.tc = x.view === "stay" ? "o" : "f"; } return bt; };
    if (Math.abs(dpt) >= 0.05) out.push(mark(U(beat("ticket", "", (dpt > 0 ? "+" : "-") + Math.round(Math.abs(dpt)), `${the(na, 1)}: ${pct(pa)} on time in ${win}; ${the(nb)}: ${pct(pb)}.`, { lvl: 1, d }), "PTS"), dpt > 0 ? a : b, dpt > 0 ? na : nb));
    let fm = -1, dd = 0;
    for (let m = 0; m < 12; m++) { const x = (a.plan.crews[m] + a.plan.seasonal[m]) - (b.plan.crews[m] + b.plan.seasonal[m]); if (x !== 0) { fm = m; dd = x; break; } }
    const dp = (a.totals.payroll || 0) - (b.totals.payroll || 0), ad = Math.abs(dp);
    const tiles = ad >= 1e6 ? (ad / 1e6).toFixed(1) + "M" : Math.round(ad / 1e3) + "K", words = ad >= 1e6 ? "$" + (ad / 1e6).toFixed(1) + " million" : "$" + Math.round(ad / 1e3) + "k";
    const crewTxt = fm >= 0 ? `${the(na, 1)} ${dd > 0 ? "adds" : "runs"} ${crews(Math.abs(dd))}${dd > 0 ? "" : " fewer"} from ${MON[fm]}` : "";
    if (ad >= 1000) out.push(mark(U(beat("scale", fm >= 0 ? MS[fm] : "", (dp > 0 ? "+" : "-") + tiles, `${crewTxt ? crewTxt + "; that" : the(na, 1)} costs ${words} ${dp > 0 ? "more" : "less"} in payroll.`, fm >= 0 ? { lvl: 1, d, m: fm } : { lvl: 1, d }), "USD"), dp > 0 ? b : a, dp > 0 ? nb : na));
    else if (fm >= 0) out.push(U(beat("crew", MS[fm], (dd > 0 ? "+" : "") + dd, `${crewTxt}.`, { lvl: 1, d, m: fm }), "CREWS"));
    // the verdict, whichever way the data falls
    const onW = Math.abs(dpt) < 0.05 ? null : dpt > 0 ? na : nb, cheap = ad < 1000 ? null : dp > 0 ? nb : na;
    let ver;
    if (!onW && !cheap) ver = `${the(na, 1)} and ${the(nb)} match month for month.`;
    else if (onW && onW === cheap) ver = `${the(onW, 1)} wins on time and is cheaper.`;
    else if (onW && cheap) ver = `${the(onW, 1)} wins on time; ${the(cheap)} is cheaper.`;
    else if (onW) ver = `${the(onW, 1)} wins on time at the same payroll.`;
    else ver = `Same on time in ${win}; ${the(cheap)} is cheaper.`;
    const vb = beat("scale", "", "", ver, { lvl: 1, d }), fav = onW || cheap; if (fav) mark(vb, fav === na ? a : b, fav);
    out.push(vb);
    return out;
  }

  function compose() {
    const v = viewInfo(); let bs;
    if (v.cmp) bs = compareBeats(v);
    else if (v.lvl === 0) bs = cityBeats(v);
    else if (v.lvl === 1) bs = deptBeats(v);
    else if (v.lvl === 2) bs = monthBeats(v);
    else bs = dayBeats(v);
    bs = bs.filter(Boolean).slice(0, ROWS);
    const nm = MARKS.find(k => !seen().includes(k.k) && k.test());   // one legend line per settle, in the last row
    if (nm) { markSeen(nm.k); const row = beat(nm.icon, "", "", nm.text, null); row.key = nm.k; if (bs.length >= ROWS) bs[ROWS - 1] = row; else bs.push(row); }
    return { v, bs };
  }

  // ==== the board and its flaps
  let el = null, rowsEl = [], live = null, headView = null, cur = [], curView = null, sig = "";
  const span = (cls, html) => { const s = doc.createElement("span"); s.className = cls; if (html != null) s.innerHTML = html; return s; };
  function cell(kind) {
    const c = span("fc " + kind), t = span("h t"), b = span("h b");
    t.appendChild(span("v")); b.appendChild(span("v")); c.append(t, b); c._v = ""; return c;
  }
  // terms (flyway, Dusk, predators) take the shared treatment; inside a row button they are hover only, so no nested tab stops
  const termHtml = s => (root.TerryTerms ? root.TerryTerms.term(s).replace(/ tabindex="0" aria-describedby="[^"]*"/g, "") : esc(s));
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const setFace = (half, html) => { half.firstChild.innerHTML = html; };
  // flip one cell from its current face to html: the top half of the old face falls over, the new bottom lands
  function flip(c, html, delay, anim) {
    if (c._v === html) return 0;
    const old = c._v; c._v = html;
    const [T, Bh] = c.children;
    if (c._run) { c._run.forEach(x => { try { x.a.cancel(); x.n.remove(); } catch (e) {} }); c._run = null; }
    if (!anim) { setFace(T, html); setFace(Bh, html); return 0; }
    const wide = c.classList.contains("bl"), P = wide ? 900 : 260, D1 = 140, D2 = 160;
    const fall = span("h t f"), land = span("h b k");
    fall.appendChild(span("v", old)); land.appendChild(span("v", html));
    fall.appendChild(span("sh")); land.appendChild(span("sh"));
    setFace(T, html);                    // behind the falling flap the new top is already there
    c.append(fall, land);
    const a1 = fall.animate([{ transform: `perspective(${P}px) rotateX(0deg)` }, { transform: `perspective(${P}px) rotateX(-90deg)` }], { duration: D1, delay, easing: "cubic-bezier(.55,0,.9,.5)", fill: "both" });
    const s1 = fall.lastChild.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: D1, delay, easing: "ease-in", fill: "both" });
    const a2 = land.animate([{ transform: `perspective(${P}px) rotateX(90deg)` }, { transform: `perspective(${P}px) rotateX(0deg)` }], { duration: D2, delay: delay + D1, easing: "cubic-bezier(.2,.7,.35,1.25)", fill: "both" });
    const s2 = land.lastChild.animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: D2, delay: delay + D1, easing: "ease-out", fill: "both" });
    c._run = [{ a: a1, n: fall }, { a: a2, n: land }, { a: s1, n: fall }, { a: s2, n: land }];
    a2.finished.then(() => { setFace(Bh, html); fall.remove(); land.remove(); c._run = null; }).catch(() => {});
    return delay + D1 + D2;
  }

  function build() {
    if (el || !doc.getElementById("terrytory")) return !!el;
    el = doc.createElement("section"); el.id = "almanac"; el.className = "alm"; el.setAttribute("aria-labelledby", "alm-h");
    el.innerHTML = `<i class="alm-beam" aria-hidden="true"></i><span class="alm-lens" aria-hidden="true"><i class="ln-barrel"></i><i class="ln-glass"></i></span><span class="alm-slot" aria-hidden="true"><i></i></span><span class="alm-feed" aria-hidden="true"><i></i></span><div class="alm-house"><div class="alm-head"><h2 id="alm-h" class="alm-name">Almanac</h2><span class="alm-view" aria-hidden="true"></span><span class="alm-hint" aria-hidden="true">Pick a line to show it on the screen</span></div><div class="alm-cols" aria-hidden="true"><span class="c-when">When</span><span class="c-num">How many</span><span class="c-what">What happens</span></div><ol class="alm-rows"></ol></div><p class="sr alm-live" aria-live="polite"></p>`;
    const ol = el.querySelector(".alm-rows"); headView = el.querySelector(".alm-view"); live = el.querySelector(".alm-live");
    for (let i = 0; i < ROWS; i++) {
      const li = doc.createElement("li"), b = doc.createElement("button"); b.type = "button"; b.className = "alm-row"; b.disabled = true; b.tabIndex = -1;
      const ic = cell("bl ic"), when = [], num = [];
      const w = span("alm-when"); for (let k = 0; k < NW; k++) { const c = cell("ch"); when.push(c); w.appendChild(c); }
      const n = span("alm-num"); for (let k = 0; k < NN; k++) { const c = cell("ch nm"); num.push(c); n.appendChild(c); }
      const un = cell("bl un"), line = cell("bl ln");
      b.append(ic, w, n, un, line); li.appendChild(b); ol.appendChild(li);
      b.addEventListener("click", () => { const bt = cur[i]; if (!bt || !bt.to || !Z_()) return; try { Z_().goTo(bt.to); } catch (e) {} });
      rowsEl.push({ b, ic, when, num, un, line });
    }
    const T = doc.getElementById("terrytory"); T.parentNode.insertBefore(el, T);
    fit(); root.addEventListener("resize", fit);
    if (doc.fonts) { doc.fonts.ready.then(() => fit()); doc.fonts.addEventListener && doc.fonts.addEventListener("loadingdone", () => fit()); }   // the condensed face can land after the first fit: refit the lines then
    if (root.ResizeObserver) { let q = 0; const ro = new ResizeObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(fit); }); [doc.getElementById("fab"), el.parentNode, doc.getElementById("rig")].forEach(n => n && ro.observe(n)); }
    if (T && root.MutationObserver) { let was = T.classList.contains("watching"); new MutationObserver(() => { const now = T.classList.contains("watching"); if (now !== was) { was = now; fit(); } }).observe(T, { attributes: true, attributeFilter: ["class"] }); }
    // any change of a row's words, from any path (a flap, a preview, a compare), refits the lines once things settle
    if (root.MutationObserver) { let tq = 0; const lo = new MutationObserver(() => { clearTimeout(tq); tq = setTimeout(fitLines, 60); }); rowsEl.forEach(R => lo.observe(R.line, { childList: true, subtree: true, characterData: true })); }
    Bus.emit("almanac:built", { el });
    return true;
  }
  // The board is the projector machine: it takes the roller's width (the cloth plus the two end caps, 90 of the photo's 1094 cloth
  // pixels) and sits centred under the cloth, tracking the rig's fit. Measured from layout offsets, so a rolled up screen (a transform)
  // never moves it. Above the housing: the lens, BUDGETerry (budgeterry.js tells how much room it needs) and the beam to the cloth.
  const ROLLER = 1 + 90 / 1094, SLAT = 36 / 1094;
  let geo = null;
  function fit() {
    if (!el) return;
    const f = doc.getElementById("fab"), rig = doc.getElementById("rig"), p = el.parentNode; if (!f || !p || !rig) return;
    const rr = rig.getBoundingClientRect(), pr = p.getBoundingClientRect(), fw = f.offsetWidth; if (fw < 200) return;
    const fl = rr.left + f.offsetLeft, fb = rr.top + f.offsetTop + f.offsetHeight, cx = fl + fw / 2;
    const w = Math.min(Math.max(560, fw * ROLLER), pr.width - 32);
    el.style.width = Math.round(w) + "px"; el.style.marginLeft = Math.round(cx - w / 2 - pr.left) + "px";
    // watch on screen (The Flip Side folded under the cloth): the machine packs tighter so the cloth, the board and the three lines fit one screen
    const watch = !!doc.querySelector("#terrytory.watching"); el.classList.toggle("watch", watch);
    const B = root.TerryBudgeterry, room = B && B.fit ? B.fit(el, w, watch ? 0.6 : 1) : 0, lensH = 40;
    // sit under the bottom roller with room for what rests on top of the housing
    el.style.marginTop = "0px"; const top0 = el.getBoundingClientRect().top, want = fb + fw * SLAT + Math.max(room, lensH) + (watch ? 4 : (parseFloat(getComputedStyle(el).getPropertyValue("--alm-gap")) || 10));
    el.style.marginTop = Math.round(Math.max(-90, want - top0)) + "px";
    const beamH = Math.max(0, want - fb - 34 + 6);   // from the lens's glass (34 px above the housing) to the cloth's foot, feathered into the roller; never over the chart
    geo = { w, beamH, fw };
    el.style.setProperty("--beam-h", Math.round(beamH) + "px"); // the beam widens from the lens; at the battery's top it must still clear the plus cap and the cable
    const half = room && B && B.clear > 30 ? Math.min(fw * 0.31, 18 + (B.clear - 18) * beamH / Math.max(12, B.top - 34)) : fw * 0.31;
    el.style.setProperty("--beam-w", Math.round(half * 2) + "px");
    fitLines();
  }
  // a sentence never truncates: when it does not fit on one line the blade sets it in two smaller lines
  // a second, layout-independent test: the text's own width in its computed font against the room it has (scrollWidth can read a
  // half-height flap before it lands, and then a too-long line kept its ellipsis)
  let mctx = null;
  function overflows(tx) {
    const w = tx.clientWidth; if (!w) return false;
    try { mctx = mctx || doc.createElement("canvas").getContext("2d"); const cs = getComputedStyle(tx); mctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const ls = parseFloat(cs.letterSpacing) || 0, t = tx.textContent || ""; return mctx.measureText(t).width + ls * t.length > w - 2; } catch (e) { return false; }
  }
  function fitLines() {
    const cols = el && el.querySelector(".alm-cols"), R0 = rowsEl[0];
    if (cols && R0 && R0.b.offsetWidth) { const x0 = R0.b.getBoundingClientRect().left, c = cols.children, L = n => Math.round(n.getBoundingClientRect().left - x0) + "px";
      c[0].style.left = L(R0.when[0]); c[1].style.left = L(R0.num[0]); c[2].style.left = L(R0.line); }
    el.classList.remove("tight");   // measure at the full size: measuring under "tight" and then dropping it let a line grow past its blade
    rowsEl.forEach(R => { const c = R.line, tx = c.querySelector(".h.t .tx"); if (!tx) { c.classList.remove("two", "three"); return; }
      c.classList.remove("two", "three"); if (tx.scrollWidth > tx.clientWidth + 1 || overflows(tx)) c.classList.add("two");
      // a narrow board (a 1024 to 1200 px window): two lines may still not hold it, so it sets in three smaller ones
      if (c.classList.contains("two") && tx.scrollHeight > tx.clientHeight + 1) c.classList.add("three"); });
    el.classList.toggle("tight", rowsEl.some(R => R.line.classList.contains("two")));   // one size for the three strips
  }
  // the beam fades with the screen: closed or rolling up (Chase it) dims it, open brings it back; the enlarged window hides it
  let beamOn = 1, beamT = 0;
  function beam(h, maxed) { if (!el) return; beamOn = maxed ? 0 : Math.max(0, Math.min(1, (h - 0.35) / 0.6)); el.style.setProperty("--beam", beamOn.toFixed(3)); el.classList.toggle("maxed", !!maxed); }
  Bus.on("screen:pull", p => { if (!p) return; const P = root.Pull; const read = () => beam(P ? P.h : p.h == null ? 1 : p.h, P ? P.maximized : p.maximized); requestAnimationFrame(read); clearTimeout(beamT); beamT = setTimeout(read, 260); });   // read the settled height a frame later, and once more after it lands

  const chars = (s, n, right) => { s = String(s || ""); const a = s.split(""); while (a.length < n) right ? a.unshift(" ") : a.push(" "); return a.slice(0, n).map(ch => (ch === " " ? "" : esc(ch))); };
  function render(v, bs, anim) {
    const fade = !anim && reduced() && sig;   // reduced motion: a soft crossfade instead of flaps
    let t = 0;
    rowsEl.forEach((R, i) => {
      const bt = bs[i] || null, base = i * 35;
      R.b.disabled = !bt || !bt.to; R.b.tabIndex = bt && bt.to ? 0 : -1;
      R.b.classList.toggle("key", !!(bt && bt.key)); R.b.classList.toggle("empty", !bt);
      R.b.setAttribute("aria-label", bt ? (bt.when ? bt.when.toLowerCase() + ", " : "") + (bt.num !== "" && bt.unit ? bt.num + " " + bt.unit.toLowerCase().replace("reqs", "requests").replace("pts", "points") + ": " : "") + bt.text + (bt.to ? " Show it on the screen." : "") : "");
      if (bt && bt.to) R.b.title = "Show it on the screen"; else R.b.removeAttribute("title");
      t = Math.max(t, flip(R.ic, bt ? `<i class="ii ii-${bt.icon}">${svgOf(bt.icon)}</i>` : "", base, anim));
      chars(bt ? bt.tiles : "", NW).forEach((h, k) => { t = Math.max(t, flip(R.when[k], h, base + 15 + k * 12, anim)); });
      chars(bt ? bt.num : "", NN, true).forEach((h, k) => { t = Math.max(t, flip(R.num[k], h, base + 55 + k * 12, anim)); });
      const tag = bt && bt.tag ? `<em class="tag t-${bt.tc || (bt.tag === "B" ? "b" : "f")}">${esc(bt.tag)}</em>` : "";
      t = Math.max(t, flip(R.un, bt && bt.num !== "" && bt.unit ? `<span class="ut">${esc(bt.unit)}</span>` : "", base + 80, anim));
      t = Math.max(t, flip(R.line, bt ? `${bt.key ? '<em class="kplate">Key</em>' : ""}<span class="tx">${termHtml(bt.text)}</span>${tag}` : "", base + 90, anim));
    });
    if (fade) el.querySelector(".alm-rows").animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
    headView.textContent = v.label; fitLines();
    return t;
  }

  let tmr = 0, wantPlan = false, first = true, held = false, chaseHold = null;
  // Chase it feeds the machine (owner 08:24): the board flaps to "CHASING · <goal>" when the card drops into the slot, and holds until
  // the chase ends (proj:idle); the beam flickers once (none under reduced motion)
  function chasing(goal) {
    if (!build()) return 0;
    if (goal == null) { if (chaseHold == null) return 0; chaseHold = null; el.classList.remove("chasing"); sig = ""; poke(); return 0; }
    let g = String(goal).replace(/\s+/g, " ").trim(); if (g.length > 64) g = g.slice(0, 62).replace(/\s+\S*$/, "") + "\u2026";
    chaseHold = g; clearTimeout(tmr); el.classList.add("chasing");
    cur = [beat("ticket", "", "", `READING \u00b7 ${g}`, null)]; sig = "chasing";
    const t = render({ label: "Chasing" }, cur, !reduced());
    requestAnimationFrame(fitLines); setTimeout(fitLines, (t || 0) + 40);
    live.textContent = `Almanac: chasing ${g}.`;
    return t;
  }
  // the next step of the chase: a new row flaps in under the others (three at most, the oldest leaves)
  function chaseStep(text, num, unit) {
    if (chaseHold == null || !el) return 0;
    const icon = /^FLIPPING/.test(text) ? "owl" : /^LAST YEAR/.test(text) ? "storm" : /^SEARCHING/.test(text) ? "pill" : "ticket";
    cur = cur.concat([U(beat(icon, "", num == null ? "" : num, text, null), unit)]).slice(-ROWS);
    const t = render({ label: "Chasing" }, cur, !reduced());
    requestAnimationFrame(fitLines); setTimeout(fitLines, (t || 0) + 40);
    live.textContent = `Almanac: ${text.replace(/ \u00b7 /, ", ").toLowerCase()}.`;
    return t;
  }
  function flicker() {
    if (!el || reduced()) return; const b = el.querySelector(".alm-beam"), g = el.querySelector(".ln-glass"), o = +getComputedStyle(b).opacity || 0;
    try { b.animate([{ opacity: o }, { opacity: .34 }, { opacity: .04 }, { opacity: .26 }, { opacity: o }], { duration: 520, easing: "linear" });
      g.animate([{ filter: "none" }, { filter: "brightness(1.8)" }, { filter: "none" }, { filter: "brightness(1.5)" }, { filter: "none" }], { duration: 520 }); } catch (e) {}
  }
  Bus.on("proj:idle", () => chasing(null));
  function poke() { clearTimeout(tmr); tmr = setTimeout(settle, 300); }
  function settle() {
    if (chaseHold != null) return;   // Chase it holds the board on "CHASING" until the projector is idle again
    const z = Z_();
    if (!build()) { tmr = setTimeout(settle, 400); return; }
    if (!z || !z.ready || !z.Z || !z.plan) { if (first && !held) { held = true; render({ label: "Boston 2025" }, [beat("crew", "", "", "Counting crews.", null)], false); } tmr = setTimeout(settle, 400); return; }
    if (z.planRunning) { wantPlan = true; return; }
    let res; try { res = compose(); } catch (e) { Bus.emit("error", { module: "almanac", e }); return; }
    const s = JSON.stringify([res.v.label, res.bs]);
    if (s === sig) return;
    const anim = !reduced() && !first; sig = s; cur = res.bs; curView = res.v.label; first = false;
    fit(); const tt = render(res.v, res.bs, anim);
    requestAnimationFrame(fitLines); setTimeout(fitLines, (tt || 0) + 40);   // measure again once the row has laid out and the flaps have landed (a first fit could read the blade before its width settled)
    live.textContent = `Almanac, ${res.v.label}. ` + res.bs.map(b => b.text).join(" ");
    Bus.emit("almanac:settled", { beats: api.beats, view: curView }); setTimeout(fitLines, 120); setTimeout(fitLines, 700);
  }
  Bus.on("plan:view", p => { if (!p) return; const r = activeRoost(); pv = p.preview && !(r && r.id === p.roostId && r.view === p.view) ? { roostId: p.roostId, view: p.view } : null; });
  Bus.on("roost:activated", () => { pv = null; });
  // the hire arc (app.js): light the matching row in step as each pill lands, and the Dusk row as Dusk draws; no flap
  const litT = new Map();
  function light(i) { const R = rowsEl[i]; if (!R) return; R.b.classList.add("arc-lit"); clearTimeout(litT.get(i)); litT.set(i, setTimeout(() => R.b.classList.remove("arc-lit"), 650)); }
  function unlightAll() { litT.forEach(t => clearTimeout(t)); litT.clear(); rowsEl.forEach(R => R.b.classList.remove("arc-lit")); }
  Bus.on("arc:play", unlightAll); Bus.on("arc:stop", () => setTimeout(unlightAll, 650));
  Bus.on("arc:beat", p => {
    if (!p || !cur) return;
    if (p.kind === "dusk") { cur.forEach((bt, i) => { if (bt && bt.icon === "sun") light(i); }); return; }
    const rows = cur.map((bt, i) => (bt && bt.icon === "pill" && bt.to && (bt.to.d == null || bt.to.d === p.dept) ? i : -1)).filter(i => i >= 0); if (!rows.length) return;
    const near = rows.filter(i => cur[i].to.m != null && Math.abs(cur[i].to.m - p.month) <= 1);
    (near.length ? near : rows).forEach(light);
  });
  ["screen:level", "screen:draw", "plan:view", "roost:activated", "roost:closed", "compare:open", "compare:close"].forEach(e => Bus.on(e, poke));
  Bus.on("plan:stop", () => { if (wantPlan) { wantPlan = false; poke(); } else poke(); });
  Bus.on("theme:changed", () => setTimeout(fit, 60));

  const api = {
    get el() { return el; },
    get beats() { return cur.map(b => ({ icon: b.icon, when: b.when, num: b.num, unit: b.unit || "", text: b.text, to: b.to, tag: b.tag, tc: b.tc || "", key: b.key || null })); },
    get view() { return curView; },
    get ready() { return !!sig && !first; },
    get geo() { return geo; },
    fit,
    focus(i) {   // scroll the board under the screen into view and focus a beat (default the first)
      if (!el) return false; el.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
      const R = rowsEl[i | 0] || rowsEl[0]; if (R && !R.b.disabled) R.b.focus({ preventScroll: true }); return true;
    },
    refresh() { sig = ""; poke(); },
    chasing, chaseStep, flicker,
    get isChasing() { return chaseHold != null; },
    slots() { if (!el) return null; const r = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }; return { top: r(el.querySelector(".alm-slot")), feed: r(el.querySelector(".alm-feed")) }; },
    _preview(bs) { if (!build()) return 0; cur = bs.map(x => U(beat(x.icon, x.when, x.num, x.text, x.to, x.tag, x.tc), x.unit)); return render({ label: curView || "" }, cur, !reduced()); },   // test hook: flap these beats now
  };
  root.TerryAlmanac = api;
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", poke); else poke();
})(typeof window !== "undefined" ? window : globalThis);
