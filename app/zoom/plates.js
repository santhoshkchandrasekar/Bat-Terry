/* Survey plates: the pieces the Roost is printed with. Hand-ruled lines, stamps, the predator evidence sheet and the compare plate.
 * Everything here is computed from numbers already on the client (E.monthly, the flip and the escape run). Nothing is invented. */
(function (root) {
  "use strict";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ic = (n, cls, st) => root.TerryArt.ic(n, cls, st);
  const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MON1 = "JFMAMJJASOND".split("");
  const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const n0 = v => Math.round(v).toLocaleString("en-US"), pc = v => Math.round(v * 100) + "%";
  const usd = v => "$" + Math.round(v).toLocaleString("en-US");
  let uid = 0;

  // a seeded 1.2px line with a little vertical wobble, like a ruled pen line; stable per seed
  function rule(seed, w, o) {
    o = o || {}; let s = (seed || 7) * 9301 + 49297; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const W = w || 600, step = 24, pts = []; for (let x = 0; x <= W; x += step) pts.push([x, 1.5 + (r() - .5) * .8]); pts.push([W, 1.5 + (r() - .5) * .8]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(0) + " " + p[1].toFixed(2)).join(" ");
    return `<svg class="hrule${o.cls ? " " + o.cls : ""}" width="${W}" height="3" viewBox="0 0 ${W} 3" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${o.color || "var(--line2)"}" stroke-width="${o.sw || 1.2}" stroke-linecap="round"/></svg>`;
  }
  // a pen underline that tapers: 2px at the left, 0.8px at the right
  function penRule(color) {
    const id = "pr" + (++uid);
    return `<svg class="pen" width="100%" height="6" viewBox="0 0 400 6" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2.4 C120 1.6 260 3.4 400 2.2 L400 3 C260 4 120 2.6 0 3.8 Z" fill="${color || "var(--short)"}"/></svg>`;
  }
  const VERD = { CONFIRMED: ["c", "check", "Confirmed"], UNTESTABLE: ["u", "flask", "Untestable"], REJECTED: ["r", "x", "Rejected"],
    escaped: ["ok", "check", "Escaped"], already: ["ok", "check", "Already safe"], partial: ["w", "flask", "Partly"], unreachable: ["bad", "x", "No exit left"] };
  function stamp(key, tag, extra) {
    const v = VERD[key] || VERD.partial, el = tag || "span";
    return `<${el} class="stamp ${v[0]}"${extra || ""}>${ic(v[1])}${v[2]}</${el}>`;
  }


  // ------------------------------------------------------------ how Terry answers each predator (one source for the card line and the sheet block)
  // ctx: {E, F, X, goal, plate?}. Returns null when the department is outside the escape run, else {kind, icon, tone, line, detail[], covered, absorbed}.
  const ANS = new WeakMap();
  function answer(p, ctx) {
    if (ANS.has(p) && ANS.get(p).X === ctx.X) return ANS.get(p).r;
    const r = answer0(p, ctx); ANS.set(p, { X: ctx.X, r }); return r;
  }
  function answer0(p, ctx) {
    const E = ctx.E, F = ctx.F, X = ctx.X, goal = ctx.goal || {}, hy = p.hypothesis, ev = p.evidence, v = ev.verdict, dept = hy.department;
    const D = X && X.depts && X.depts[dept], dname = (E.depts[dept] && E.depts[dept].name) || dept || "the department";
    const months = (p.place && p.place.months && p.place.months.length ? p.place.months : goal.months) || [], tgt = goal.target || 0;
    const B = (t, tone) => `<b class="t-${tone}">${t}</b>`, P1 = x => (Math.round(x * 1000) / 10).toFixed(1);
    const ont = (sim, m) => { const q = sim.monthly[m - 1]; return q && q.closed_targeted > 0 ? Math.max(0, 1 - q.overdue / q.closed_targeted) : 1; };
    const worst = sim => months.reduce((a, m) => { const o = ont(sim, m); return !a || o < a.o ? { m, o } : a; }, null);
    const mon = m => MON3[m - 1], monF = m => MONF[m - 1];
    const dl = E.data && E.data.dept_late_2024 && E.data.dept_late_2024[dept];
    const out = (kind, icon, tone, line, detail, extra) => Object.assign({ kind, icon, tone, line, detail, covered: false, absorbed: false }, extra || {});
    if (v === "REJECTED" && hy.kind === "silence") return out("notthreat", "x", "ink3", `Not a threat: ${esc(hy.neighborhood || "this neighborhood")} reports close to the city rate.`, [`${esc(hy.neighborhood || "This neighborhood")} reports at about the city rate, so it did not cause the failure. No action.`]);
    if (v === "REJECTED" && ev.requests_2024 && ev.reason === "mild") {
      const a = Math.round(ev.overdue_2024 / ev.requests_2024 * 100), b = dl != null ? Math.round(dl * 100) : null;
      return out("notthreat", "x", "ink3", `Only a little later than the department: ${B(a + "%", "ink3")} late${b != null ? ` against ${b}%` : ""}.`,
        [`It ran ${a}% late${b != null ? ` against ${b}% for the department` : ""} on ${n0(ev.requests_2024)} requests, ${usd(ev.cost_2024_usd || 0)} at the brief's rates. Terry confirms a predator when it runs more than 10 points later than its department with at least 20 late requests, or at least 2 points later with $5,000 or more of late cost. This one is neither, so it does not explain the failure.`]);
    }
    if (v === "REJECTED" && ev.requests_2024 && ev.reason === "small") {
      const a = Math.round(ev.overdue_2024 / ev.requests_2024 * 100), b = dl != null ? Math.round(dl * 100) : null, n = ev.requests_2024, l = ev.overdue_2024;
      return out("notthreat", "x", "ink3", `Too small to threaten the goal: ${B(n0(n), "ink3")} request${n === 1 ? "" : "s"} in 2024, ${n0(l)} late.`,
        [`It did run ${a}% late${b != null ? ` against ${b}% for the department` : ""}, but on ${n0(n)} request${n === 1 ? "" : "s"} (${n0(l)} late, ${usd(ev.cost_2024_usd || 0)} at the brief's rates) it cannot move the department's on-time rate. Terry confirms a cell this far above its department once it has at least 20 late requests, or $5,000 of late cost. No action for the plan; worth a look by the team that handles it.`]);
    }
    if (v === "REJECTED" && ev.requests_2024) {
      const a = Math.round(ev.overdue_2024 / ev.requests_2024 * 100), b = dl != null ? Math.round(dl * 100) : null;
      return out("notthreat", "x", "ink3", `Not a threat in 2024: ${B(a + "%", "ink3")} late${b != null ? `, department ${b}%` : ""}.`, [`This type runs at ${a}% late${b != null ? ` against ${b}% for the department` : ""}, so it did not cause the failure. No action.`]);
    }
    if (hy.kind === "silence" && v === "CONFIRMED") {
      const m = String(ev.detail || "").match(/report at ([\d.]+)x the city rate.*?quietest: (.+?) at ([\d.]+)x/), hood = esc(hy.neighborhood || "This neighborhood");
      return out("outside", "silence", "ink2", `Not a crew problem. ${hood} reports at ${B((m ? m[1] : "?") + "x", "ink2")}; outreach, not crews.`,
        [m ? `Residents in ${hood} report at ${m[1]}x the city rate for the same problems (quietest: ${esc(m[2])} at ${m[3]}x). More crews will not change that. The step outside this plan is outreach in ${hood}; the model does not size it.` : esc(ev.detail || "")]);
    }
    if (hy.kind === "shock") {
      const kind = F && F.kindOf ? F.kindOf(`${hy.name || ""} ${hy.description || ""}`) : null, an = kind && F.analogues ? F.analogues[kind] : null, icon = kind === "heat_wave" ? "sun" : "snow";
      const eff = an ? an.effects.filter(e => e.dept === dept) : [];
      if (!an || !eff.length || !D || !months.length) return out("shock", "flask", "ink3", "No past event to size it against.", ["No past event in the data is close enough to size this against, so Terry leaves it untested."]);
      const word = { heat_wave: "heat wave", move_in: "move-in weekend" }[kind] || "storm", start = E.dayOf(`2025-${String(Math.min(...months)).padStart(2, "0")}-01`);
      // a storm the flyway flew through is judged on the flyway's own run (same events, same demand year); one outside the
      // window it plans for is tested on its own, at forecast demand, and the card says so
      const flown = (X.events || []).some(e => e.predator === hy.name && e.dept === dept);
      const evs = eff.map(e => ({ dept, start, days: e.days, mult: e.mult, kind: "demand" }));
      const w = flown ? worst(D.escape.sim) : worst(F.runDept(dept, D.escape.plan, evs, 1, false)), keep = flown ? worst(D.stay.sim) : worst(F.runDept(dept, D.stay.plan, evs, 1, false)), ok = w.o >= tgt;
      const lab = esc(an.label), how = flown ? ` The flyway is built to fly through it${X.hot_pct ? `, tested in a year ${X.hot_pct}% busier` : ""}.` : " It lands outside the months this flyway plans for, so Terry tested it on its own, at forecast demand.";
      return out("shock", icon, ok ? "work" : "short", ok ? `Absorbs a ${word} like ${lab}: ${B(P1(w.o) + "%", "work")} on time in ${mon(w.m)}.` : `A ${word} like ${lab} breaks it: ${B(P1(w.o) + "%", "short")} on time in ${mon(w.m)}.`,
        [`Sized like ${lab}: ${an.effects.map(e => `${esc((E.depts[e.dept] || {}).name || e.dept)} x${e.mult} for ${e.days} days`).join(", ")}. With the flyway, ${monF(w.m)} closes ${P1(w.o)}% on time; keeping the original plan, ${P1(keep.o)}%.${how} The event is from the data, the outcome is the simulator's.`], { absorbed: ok });
    }
    if (v === "CONFIRMED" && D && months.length) {
      // two questions, answered from the run and from the record: does the flyway give the department the crews in this
      // predator's months; and, in the department's best months of 2024, did this type itself close on time at the goal's rate
      const o = X.preds && X.preds[hy.name], w = (o && o.dept_flyway) || worst(D.escape.sim), ok = w.o >= tgt - 0.0005, tg = Math.round(tgt * 100);
      const hire = (D.escape.added || []).find(h => h.action === "hire"), P0 = x => Math.round(x * 100);
      const PG = x => (x < tgt && Math.round(x * 1000) / 10 >= tgt * 100 ? (Math.floor(x * 10000) / 100).toFixed(2) : P1(x));   // a miss never rounds up to the goal
      const monL = ms => { const a = ms.map(m => MON3[m - 1]); return a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0]; };
      const first = hire ? `The flyway signs ${hire.crews} ${esc(dname)} crew${hire.crews > 1 ? "s" : ""} from 1 ${monF(hire.month)}; in ${monF(w.m)} the department then has the crews to close ${PG(w.o)}% on time in the crew model.`
        : ok ? `${esc(dname)} already has the crews for ${monF(w.m)}: ${PG(w.o)}% on time in the crew model, with no change.` : `No crew plan lifts ${esc(dname)} to ${tg}% in ${monF(w.m)}: ${PG(w.o)}% in the crew model.`;
      const f24 = o && o.floor_2024, f23 = o && o.floor_2023;
      const y23 = f23 ? ` In 2023's best months (${monL(f23.months)}) it closed ${P0(f23.type_ontime)}%${(f23.type_ontime >= tgt) !== (f24.type_ontime >= tgt) ? ", so the two years disagree; read this one as a warning" : ""}.` : "";
      const poss = /s$/.test(dname) ? "'" : "'s", basisT = f24 && f24.basis === "citywide" && hy.neighborhood ? ` (citywide; too few in ${esc(hy.neighborhood)} alone)` : "";
      if (o && o.kind === "process" && o.dept_wide)
        return out("process", "flask", "behind", `Not this predator alone: ${esc(dname)} reached only ${B(P0(f24.dept_ontime) + "%", "behind")} even in its best months.`,
          [`${esc(dname)}${poss} three best months of 2024 were ${monL(f24.months)}, at ${P0(f24.dept_ontime)}% on time for the whole department; this predator's ${n0(f24.n)} requests then closed ${P0(f24.type_ontime)}%${basisT}.${y23}`,
           `The 2024 record never shows ${esc(dname)} at your ${tg}%, so it cannot show that crews alone get there. The crew model says they would; the record suggests the lateness runs through the whole department, in how its work is handled as well as in crew count. Read the flyway as the crew side of the answer. ${first}`], { covered: false, process: true });
      if (o && o.kind === "process")
        return out("process", "flask", "behind", `Crews alone are unlikely to fix it: ${B(P0(f24.type_ontime) + "%", "behind")} on time even in ${esc(dname)}${poss} best months.`,
          [`In 2024, ${esc(dname)} ran best in ${monL(f24.months)} (${P0(f24.dept_ontime)}% on time for the department). This predator's ${n0(f24.n)} requests closed only ${P0(f24.type_ontime)}% on time then${basisT}.${y23}`,
           `When the department kept up best, this still stayed under your ${tg}%, so more crews are unlikely to lift it there on their own. The likely cause is in how this work is handled (due dates, contractors, inspections), which the crew model does not change. ${first}`], { covered: false, process: true });
      const keepUp = o && o.kind === "crews" ? ` When ${esc(dname)} keeps up, so does this: ${P0(f24.type_ontime)}% of its ${n0(f24.n)} requests on time in the department's best months of 2024 (${monL(f24.months)})${basisT}.${y23}` : o && o.kind === "unknown" ? " Too few of its requests fell in the department's best months to tell whether crews alone fix it." : "";
      return out("covered", ok ? "check" : "clock", ok ? "work" : "behind", ok ? `Flyway covers it: ${esc(dname)} ${B(PG(w.o) + "%", "work")} on time in ${mon(w.m)}.` : `Flyway falls short here: ${B(PG(w.o) + "%", "behind")} on time in ${mon(w.m)}.`,
        [first + keepUp + (ok ? "" : ` That is under the ${tg}% goal; the flyway below says why.`)], { covered: ok && (!o || o.kind !== "unknown"), unknown: !!(o && o.kind === "unknown") });
    }
    if (!D && v === "CONFIRMED") return null;
    return out("notthreat", "flask", "ink3", "Nothing in 2024 to test. Terry keeps it on the list.", ["There are no 2024 requests of this type to test, so Terry keeps it on the list."]);
  }
  // one plain line, no jargon: how many crew problems more crews fix, how many need outreach, how many storms the plan survives
  function tallyText(preds, ctx) {
    let cell = 0, cov = 0, pr = 0, unk = 0, out = 0, shk = 0, abs = 0; const kinds = new Set();
    preds.forEach(p => { const a = answer(p, ctx); if (!a) return; if (a.kind === "covered") { cell++; if (a.covered) cov++; else if (a.unknown) unk++; } else if (a.kind === "process") { cell++; pr++; } else if (a.kind === "outside") out++; else if (a.kind === "shock" && a.icon !== "flask") { shk++; kinds.add(a.icon); if (a.absorbed) abs++; } });
    if (!cell && !out) return "";
    // one plain sentence: how many the flyway's crews fix, how many need a change in how the work is handled
    // every confirmed crew predator lands in exactly one part: fixed by crews, needs a process fix, too few requests to judge, or short
    const sh = cell - cov - pr - unk, N = k => `<b>${k}</b>`, need = k => (k === 1 ? "needs" : "need");
    const parts = [];
    if (cov) parts.push(cov === cell ? (cell === 1 ? "More crews fix it" : cell === 2 ? "More crews fix both" : `More crews fix all ${N(cell)}`) : `More crews fix ${N(cov)} of ${N(cell)}`);
    if (pr) parts.push(pr === cell ? (cell === 1 ? "It needs a process fix, not more crews" : cell === 2 ? "Both need a process fix, not more crews" : `All ${N(cell)} need a process fix, not more crews`) : `${N(pr)}${cov ? "" : ` of ${N(cell)}`} ${need(pr)} a process fix`);
    if (unk) parts.push(`${N(unk)} ${unk === 1 ? "has" : "have"} too few requests to judge`);
    if (sh > 0) parts.push(`${N(sh)} ${sh === 1 ? "stays" : "stay"} short of the goal`);
    const lead = !cell ? "More crews are not the fix here." : parts.join("; ") + ".";
    const proc = "";
    const word = kinds.size === 1 && kinds.has("sun") ? (shk === 1 ? "heat wave" : "heat waves") : kinds.size === 1 && kinds.has("snow") ? (shk === 1 ? "storm" : "storms") : (shk === 1 ? "spike" : "spikes");
    return `${lead}${proc}${out ? ` <b>${out}</b> ${out === 1 ? "needs" : "need"} outreach instead.` : ""}${shk ? ` Survives <b>${abs}</b> of <b>${shk}</b> ${word}.` : ""}`;
  }

  // ------------------------------------------------------------ the predator evidence sheet
  function sheet(p, ctx) {
    const E = ctx.E, X = ctx.X, hy = p.hypothesis, ev = p.evidence, pl = p.place || {}, v = ev.verdict, dept = hy.department;
    const M = E.monthly({ dept, type: hy.request_type, hood: hy.neighborhood }), B = E.monthly({ dept });
    const sum = a => a.reduce((s, x) => s + x, 0), req = sum(M.requests), over = sum(M.overdue), cliff = sum(M.cliff);
    const breq = sum(B.requests), bover = sum(B.overdue), bshare = breq ? bover / breq : 0, share = req ? over / req : 0;
    const dname = (E.depts[dept] && E.depts[dept].name) || dept || "the department", where = hy.neighborhood ? ` in ${esc(hy.neighborhood)}` : "";
    const win = new Set(pl.months || []), lead = new Set(); if (pl.lead_in && win.size) { const f = Math.min(...win); [f - 2, f - 1].forEach(m => { if (m >= 1 && !win.has(m)) lead.add(m); }); }
    const plate = ctx.plate + "a";
    let c1, c2, c3;
    const empty = !req;
    // 1. late share by month
    const W = 380, H = 170, x0 = 46, x1 = W - 6, top = 10, bot = 144, bw = (x1 - x0) / 12, y = f => bot - (bot - top) * Math.min(1, f);
    if (empty) {
      c1 = `<h4>Late share by month, 2024</h4><svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="No 2024 requests of this type"><rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bot - top}" fill="none" stroke="var(--line2)" stroke-dasharray="3 4"/>${[0, 50, 100].map(g => `<text x="${x0 - 6}" y="${y(g / 100) + 3}" text-anchor="end" class="ax">${g}%</text>`).join("")}</svg>`;
      c2 = `<h4>Where the time goes</h4><p class="note">No 2024 requests of this type${where}. Terry cannot test it; he keeps it on the list.</p>`;
    } else {
      let bars = "", band = "";
      for (let m = 0; m < 12; m++) {
        const bx = x0 + bw * m, f = M.requests[m] ? M.overdue[m] / M.requests[m] : 0, mo = m + 1;
        if (win.has(mo)) band += `<rect x="${bx}" y="${top - 4}" width="${bw}" height="${bot - top + 4}" class="${v === "CONFIRMED" ? "bandc" : "band"}"/>`; else if (lead.has(mo)) band += `<rect x="${bx}" y="${top - 4}" width="${bw}" height="${bot - top + 4}" class="bandl"/>`;
        const bf = B.requests[m] ? B.overdue[m] / B.requests[m] : 0;
        bars += `<g class="bar" tabindex="0" data-tip="${esc(`${MON3[m]} 2024 · ${pc(f)} late · ${n0(M.overdue[m])} of ${n0(M.requests[m])} · department ${pc(bf)}`)}"><rect class="hot" x="${bx}" y="${top - 4}" width="${bw}" height="${bot - top + 4}" fill="transparent"/><rect x="${bx + 4}" y="${y(f)}" width="${Math.max(1, bw - 8)}" height="${Math.max(0, bot - y(f))}" fill="var(--pred)" rx="1"/></g>`;
      }
      let step = ""; for (let m = 0; m < 12; m++) { const bf = B.requests[m] ? B.overdue[m] / B.requests[m] : 0; step += (m ? "L" : "M") + (x0 + bw * m).toFixed(1) + " " + y(bf).toFixed(1) + " L" + (x0 + bw * (m + 1)).toFixed(1) + " " + y(bf).toFixed(1) + " "; }
      const grid = [0, .5, 1].map(g => `<line x1="${x0}" x2="${x1}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${x0 - 6}" y="${y(g) + 3}" text-anchor="end" class="ax">${g * 100}%</text>`).join("");
      c1 = `<h4>Late share by month, 2024</h4><div class="chw"><svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Late share by month in 2024, ${esc(hy.name)}, against the department">${band}${grid}${bars}<path d="${step}" fill="none" stroke="var(--ink3)" stroke-width="1.4" stroke-dasharray="2 3"/>${MON1.map((l, m) => `<text x="${x0 + bw * (m + .5)}" y="${H - 10}" text-anchor="middle" class="ax">${l}</text>`).join("")}</svg><div class="tip" hidden></div></div>`;
      // 2. where the time goes
      const ont = Math.max(0, req - over), od = Math.max(0, over - cliff), segs = [[ont, "var(--work)", "On time"], [od, "var(--behind)", "Overdue under 30 days"], [cliff, "var(--short)", "Past the 30-day cliff"]];
      if (v === "REJECTED") {
        c2 = `<h4>Why Terry turned it down</h4><div class="vs"><div><span>This type${where}</span><div class="tr"><i style="width:${Math.min(100, share * 100)}%;background:var(--ink3)"></i></div><b>${pc(share)} late</b></div><div><span>${esc(dname)}</span><div class="tr"><i style="width:${Math.min(100, bshare * 100)}%;background:var(--ink)"></i></div><b>${pc(bshare)} late</b></div></div><p class="note">${share <= bshare ? "It runs no later than the department does, so it is not the predator." : "The gap is too small to explain a failure."}</p>`;
      } else {
        c2 = `<h4>Where the time goes</h4><div class="stack" role="img" aria-label="${segs.map(s => s[2] + " " + n0(s[0])).join(", ")}">${segs.map(s => `<i style="flex:${Math.max(s[0], 0)};background:${s[1]}"></i>`).join("")}</div><div class="sn">${[["On time", ont], ["Overdue", od], ["Past the cliff", cliff]].map(s => `<div><b>${n0(s[1])}</b>${s[0]}</div>`).join("")}</div><p class="note">Past the cliff means more than 30 days overdue; those requests carry most of the modeled cost.</p>`;
      }
    }
    // 3. the numbers
    const heard = (pl.months && pl.months.length) ? pl.months.map(m => MON3[m - 1]).join(", ") : "the goal window";
    const rows = [["Requests in 2024", n0(empty ? 0 : req)], ["Late share", empty ? "n/a" : pc(share)], ["Department", pc(bshare)], ["Modeled cost", usd(ev.cost_2024_usd || 0)], ["Heard in", heard]];
    // the same test on 2023 (owner 21:48): the second year, and whether the predator held in both
    const y3 = ev.y2023; if (y3) { rows.splice(3, 0, ["In 2023", y3.silence_ratio != null ? y3.silence_ratio.toFixed(2) + "x the city" : y3.n ? `${pc(y3.rate)} late, dept ${pc(y3.dept_rate)}` : "no requests"]); }
    if (ev.years_text) rows.splice(y3 ? 4 : 3, 0, ["Years", ev.years_text]);
    const an = X ? answer(p, ctx) : null, hire = an ? `<span class="escart" aria-hidden="true"><svg viewBox="0 0 120 80" width="100%" height="100%"><use href="#r2-escape"/></svg></span><div class="esc-t"><h4 class="sh4h">How Terry plans to escape it</h4>${an.line ? `<p class="ans-short">${an.line}</p>` : ""}<p class="note ans">${an.detail.join(" ")}</p></div>` : "";   // owner 7 Nov: the short answer in bold, then the full one
    c3 = `<h4>The numbers</h4><div class="kv">${rows.map(r => `<span>${r[0]}</span><b>${esc(r[1])}</b>`).join("")}</div>`;
    return `<section class="sheet" role="region" aria-label="Evidence for ${esc(hy.name)}">
      <button type="button" class="xb" aria-label="Close">${ic("x")}</button><div class="sh1">${c1}</div><div class="sh2">${c2}</div><div class="sh3">${c3}</div>${hire ? `<div class="sh4${an && an.detail.join(" ").length > 360 ? " long" : ""}">${hire}</div>` : ""}
      ${ev.detail ? `<div class="cap">${esc(ev.detail)}</div>` : ""}</section>`;
  }
  function wireSheet(el) {
    const tip = el.querySelector(".tip"), w = el.querySelector(".chw"); if (!tip || !w) return;
    const show = g => { tip.textContent = g.dataset.tip; tip.hidden = false; const a = g.getBoundingClientRect(), b = w.getBoundingClientRect(); tip.style.left = Math.min(b.width - 210, Math.max(0, a.left - b.left - 80)) + "px"; tip.style.top = "-6px"; };
    el.querySelectorAll(".bar").forEach(g => { g.addEventListener("pointerenter", () => show(g)); g.addEventListener("focus", () => show(g)); g.addEventListener("pointerleave", () => { tip.hidden = true; }); g.addEventListener("blur", () => { tip.hidden = true; }); });
  }

  // ------------------------------------------------------------ the compare plate: only what differs
  function diffPlate(A, B, plate) {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b), cr = (s, i) => s.plan.crews[i] + s.plan.seasonal[i];
    const diffMonths = []; for (let i = 0; i < 12; i++) if (cr(A, i) !== cr(B, i)) diffMonths.push(i);
    const mini = (s) => `<span class="mc">${MON1.map((l, i) => `<i class="${diffMonths.includes(i) ? "on" : ""}" title="${MON3[i]}: ${cr(s, i)} crews">${cr(s, i)}</i>`).join("")}</span>`;
    const hires = s => { const out = []; for (let i = 1; i < 12; i++) { const d = s.plan.crews[i] - s.plan.crews[i - 1]; if (d) out.push(`${d > 0 ? "+" : ""}${d} in ${MON3[i]}`); } return out.join(", ") || "none"; };
    const rowsD = [], same = [];
    const row = (k, a, b, diff) => (diff ? rowsD.push([k, a, b]) : same.push(k));
    row("Crews by month", mini(A), mini(B), diffMonths.length > 0);
    const ha = hires(A), hb = hires(B); row("Hires", esc(ha), esc(hb), ha !== hb);
    row("Payroll", usd(A.totals.payroll), usd(B.totals.payroll), Math.round(A.totals.payroll) !== Math.round(B.totals.payroll));
    row("Overdue cost avoided", usd(Math.max(0, B.totals.penalty - A.totals.penalty) === 0 ? 0 : A.totals.penalty), usd(B.totals.penalty), Math.round(A.totals.penalty) !== Math.round(B.totals.penalty));
    if (rowsD.length && rowsD[rowsD.length - 1][0] === "Overdue cost avoided") rowsD[rowsD.length - 1] = ["Overdue cost still owed", usd(A.totals.penalty), usd(B.totals.penalty)];
    const pa = (A.windowOntime * 100).toFixed(1) + "%", pb = (B.windowOntime * 100).toFixed(1) + "%"; row("On time in the window", pa, pb, pa !== pb);
    const va = VERD[A.verdict] || VERD.partial, vb = VERD[B.verdict] || VERD.partial; row("Verdict", `<span class="stamp ${va[0]}">${va[2]}</span>`, `<span class="stamp ${vb[0]}">${vb[2]}</span>`, A.verdict !== B.verdict || A.view !== B.view);
    const sameTxt = same.length ? `Same in both: ${same.map(s => s.toLowerCase()).join(", ")}${eq(A.window, B.window) ? ", the goal" : ""}.` : (eq(A.window, B.window) ? "Same in both: the goal." : "");
    const cell = (v, i) => `<td class="${i ? "b" : "a"}">${v}</td>`;
    return `<section class="plate m diff" id="diffplate"><h3 class="ptitle">What differs</h3>
      <table><thead><tr><th scope="col"></th><th scope="col"><i class="ab">A</i>${esc(A.label)}</th><th scope="col"><i class="ab b">B</i>${esc(B.label)}</th></tr></thead><tbody>${rowsD.map(r => `<tr><td>${r[0]}</td>${cell(r[1], 0)}${cell(r[2], 1)}</tr>`).join("") || `<tr><td colspan="3">Nothing differs between these two.</td></tr>`}${sameTxt ? `<tr class="same"><td colspan="3">${esc(sameTxt)}</td></tr>` : ""}</tbody></table></section>`;
  }
  root.TerryPlates = { answer, tallyText, rule, penRule, stamp, sheet, wireSheet, diffPlate, VERD, MON3, MONF, n0, usd, pc };
})(window);
