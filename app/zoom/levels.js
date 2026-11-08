/* Data for every zoom level of the timeline. Pure functions over the engine; no drawing here.
 *
 *   const Z = TerryLevels.create(E)          // E = TerryEngine.create(data)
 *   Z.plans                                    // {terry, january}: {PWDx: {crews[12], seasonal[12]}, ...}
 *   Z.city(plan)                               // zoom 0: four departments, need vs have by month, totals
 *   Z.dept(d, plan)                            // zoom 1: one department's year in detail
 *   Z.month(d, m, plan)                        // zoom 2: one month day by day, crews working vs idle
 *   Z.day(d, t, plan)                          // zoom 3: one day's queue, earliest due first
 *   Z.year(d, plan)                            // every day of 2025: arrivals, closed, backlog, past due, crews busy/idle/training (street scene)
 *   Z.demand(d)                                // why-zoom: how the forecast was made, step by step
 *   Z.decision(d, dec, plan)                   // why-zoom: a hiring bolt, its cost and what skipping it does
 *
 * Units: "crews needed" = requests / what one crew closes in a month (daily capacity x 21 working days), so need and
 * have are both in crews. Days are 0..364 for 2025. Months are 0..11 here (index), named in MONTHS.
 */
(function (root) {
  "use strict";
  const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
  const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const LONG_DUE = { PARK: true, ISD: true };    // most requests have long target dates: short is "behind, not late"

  function create(E) {
    const D = E.depts, N = 365;
    const perCrewMonth = d => D[d].cap * 21;
    const perCrewDay = d => D[d].cap;            // a crew closes this many requests on a working day
    const plans = {
      terry: Object.fromEntries(DEPTS.map(d => [d, { crews: E.data.plans[d].neutral.crews.slice(), seasonal: E.data.plans[d].neutral.seasonal.slice() }])),
      january: Object.fromEntries(DEPTS.map(d => [d, { crews: E.flat(d), seasonal: E.zeros() }])),
    };
    const cache = new Map();
    function sim(d, p, opts = {}) {
      const key = d + p.crews.join(",") + "|" + p.seasonal.join(",") + (opts.mult || 1);
      if (!opts.snapshotDay && cache.has(key)) return cache.get(key);
      const r = E.simulate(d, p.crews, p.seasonal, { daily: true, mult: opts.mult || 1, snapshotDay: opts.snapshotDay, onSnapshot: opts.onSnapshot });
      if (!opts.snapshotDay) { if (cache.size > 80) cache.clear(); cache.set(key, r); }
      return r;
    }
    // monthly requests arriving, and requests falling due, from the forecast replay
    const flows = {};
    function flow(d) {
      if (flows[d]) return flows[d];
      const a = E.arrivals(d, E.target(d)), arr = new Array(12).fill(0), due = new Array(12).fill(0);
      let dueLater = 0;
      for (let t = 0; t < N; t++) for (let k = a.start[t]; k < a.start[t + 1]; k++) {
        arr[E.MONTH_OF_DAY[t]] += a.w[k];
        const u = a.tg[k] ? a.due[k] : t;
        if (u < N) due[E.MONTH_OF_DAY[u]] += a.w[k]; else dueLater += a.w[k];
      }
      return (flows[d] = { arriving: arr, due, due_2026: dueLater });
    }
    const monthOntime = mo => (mo.closed_targeted > 0 ? Math.max(0, 1 - mo.overdue / mo.closed_targeted) : 1);

    // ---------------------------------------------------------------- zoom 1: a department's year
    function dept(d, p) {
      const r = sim(d, p), f = flow(d), pcm = perCrewMonth(d);
      const months = r.monthly.map((mo, m) => {
        const have = mo.crews + mo.seasonal, need = f.arriving[m] / pcm, needDue = f.due[m] / pcm;
        const ontime = monthOntime(mo);
        const state = ontime < 0.9 ? "late" : need > have + 0.01 ? (LONG_DUE[d] ? "behind_not_late" : "short") : "spare";
        return { month: m, name: MONTHS[m], have, crews: mo.crews, seasonal: mo.seasonal, need, need_due: needDue,
                 gap: have - need, requests: f.arriving[m], due: f.due[m], closed: mo.closed, backlog_end: mo.backlog_eom,
                 late: mo.overdue, ontime, state, payroll: mo.crew_cost, trust_cost: mo.overdue_cost, hire: mo.hire, release: mo.release };
      });
      const decisions = E.decisions(d, p.crews, p.seasonal).map(x => ({ ...x, month: +x.effective.slice(5) - 1,
        sign_day: x.decide_by.startsWith(String(E.YEAR - 1)) ? -1 : E.dayOf(x.decide_by) }));
      const training = decisions.filter(x => x.action === "hire" && x.month >= 1).map(x => ({ month: x.month - 1, crews: x.crews }));
      return { dept: d, name: NAMES[d], per_crew_month: pcm, per_crew_day: perCrewDay(d), long_due: !!LONG_DUE[d], due_2026: f.due_2026,
               months, decisions, training, ontime: r.ontime_rate, payroll: r.crew_cost, trust_cost: r.overdue_cost + r.backlog_cost,
               backlog_end: r.backlog_end, start_crews: D[d].start };
    }

    // ---------------------------------------------------------------- zoom 0: the city's year
    function city(plan) {
      const depts = DEPTS.map(d => dept(d, plan[d]));
      const months = MONTHS.map((name, m) => ({ month: m, name,
        need: depts.reduce((s, x) => s + x.months[m].need, 0), have: depts.reduce((s, x) => s + x.months[m].have, 0) }));
      const risk = [];
      for (const x of depts) for (const mo of x.months) if (mo.state === "late" || mo.state === "short") risk.push({ dept: x.dept, month: mo.month, state: mo.state });
      return { depts, months, risk, payroll: depts.reduce((s, x) => s + x.payroll, 0), trust_cost: depts.reduce((s, x) => s + x.trust_cost, 0) };
    }

    // ---------------------------------------------------------------- zoom 2: a month, day by day
    function month(d, m, p) {
      const r = sim(d, p), Dd = r.daily, pcd = perCrewDay(d), days = [];
      let idleCrewDays = 0, workdays = 0, spareDays = 0;
      for (let t = 0; t < N; t++) {
        if (E.MONTH_OF_DAY[t] !== m) continue;
        const date = E.isoOf(t), wd = new Date(date + "T12:00:00Z").getUTCDay(), working = wd >= 1 && wd <= 5;
        const capReq = working ? Dd.cap_day[m] * 7 / 5 : 0;   // requests the crews can close that working day
        const crewsOn = working ? p.crews[m] + p.seasonal[m] : 0;
        const perCrew = crewsOn ? capReq / crewsOn : pcd;
        const busy = working ? Math.min(crewsOn, Dd.closed[t] / perCrew) : 0;
        const idle = working ? Math.max(0, crewsOn - busy) : 0;
        if (working) { workdays++; idleCrewDays += idle; if (idle >= 1) spareDays++; }
        days.push({ day: t, date, weekday: wd, working, arrivals: Dd.arrivals[t], closed: Dd.closed[t], late_closed: Dd.late[t],
                    backlog: Dd.backlog[t], past_due: Dd.past_due[t], capacity: capReq, crews_on: crewsOn, crews_busy: busy, crews_idle: idle });
      }
      const mo = r.monthly[m];
      return { dept: d, name: NAMES[d], month: m, month_name: MONTHS[m], crews: p.crews[m], seasonal: p.seasonal[m], per_crew_day: pcd, days,
               requests: mo.demand, closed: mo.closed, late: mo.overdue, ontime: monthOntime(mo), backlog_end: mo.backlog_eom,
               idle_crew_days: idleCrewDays, idle_share: workdays ? idleCrewDays / (workdays * (p.crews[m] + p.seasonal[m])) : 0,
               days_with_a_spare_crew: spareDays, workdays };
    }

    // ---------------------------------------------------------------- the whole year day by day (drives the street scene)
    function year(d, p) {
      const r = sim(d, p), Dd = r.daily, pcd = perCrewDay(d), out = new Array(N);
      for (let t = 0; t < N; t++) {
        const m = E.MONTH_OF_DAY[t], wd = new Date(E.isoOf(t) + "T12:00:00Z").getUTCDay(), working = wd >= 1 && wd <= 5;
        const on = working ? p.crews[m] + p.seasonal[m] : 0, perCrew = on ? (Dd.cap_day[m] * 7 / 5) / on : pcd;
        const busy = working ? Math.min(on, Dd.closed[t] / perCrew) : 0;
        const pastDue = Dd.past_due[t];
        out[t] = { day: t, month: m, working, arrivals: Dd.arrivals[t], closed: Dd.closed[t], late_closed: Dd.late[t], backlog: Dd.backlog[t],
                   past_due: pastDue, crews: p.crews[m] + p.seasonal[m], training: 0, busy, idle: Math.max(0, on - busy) };
      }
      for (const x of E.decisions(d, p.crews, p.seasonal)) {        // crews in their paid training month
        const m = +x.effective.slice(5) - 1;
        if (x.action === "hire" && m >= 1) for (let t = 0; t < N; t++) if (E.MONTH_OF_DAY[t] === m - 1) out[t].training += x.crews;
      }
      return { dept: d, name: NAMES[d], per_crew_day: pcd, days: out, max_backlog: Math.max(...out.map(x => x.backlog)), max_arrivals: Math.max(...out.map(x => x.arrivals)) };
    }

    // ---------------------------------------------------------------- zoom 3: a day's queue
    function day(d, t, p) {
      let snap = null;
      const r = sim(d, p, { snapshotDay: t, onSnapshot: s => (snap = s) });
      const pcd = perCrewDay(d), wd = new Date(E.isoOf(t) + "T12:00:00Z").getUTCDay();
      // collapse the queue into due-date buckets relative to today: overdue, today, tomorrow, this week, later
      const bucket = due => (due < t ? "overdue" : due === t ? "today" : due <= t + 1 ? "tomorrow" : due <= t + 7 ? "this_week" : due <= t + 30 ? "this_month" : "later");
      const sum = list => { const o = { overdue: 0, today: 0, tomorrow: 0, this_week: 0, this_month: 0, later: 0 }; for (const q of list) o[bucket(q.due)] += q.n; return o; };
      const before = sum(snap.before), after = sum(snap.after);
      const closedBy = Object.fromEntries(Object.keys(before).map(k => [k, Math.max(0, before[k] - after[k])]));
      const crews = p.crews[E.MONTH_OF_DAY[t]] + p.seasonal[E.MONTH_OF_DAY[t]];
      return { dept: d, name: NAMES[d], day: t, date: E.isoOf(t), weekday: wd, working: wd >= 1 && wd <= 5, crews, per_crew_day: pcd,
               capacity: snap.capacity, arrivals: r.daily.arrivals[t], queue_before: before, queue_after: after, closed_by_due: closedBy,
               closed: r.daily.closed[t], late_closed: r.daily.late[t],
               crews_busy: snap.capacity ? Math.min(crews, r.daily.closed[t] / (snap.capacity / crews)) : 0,
               crews_idle: snap.capacity ? Math.max(0, crews - r.daily.closed[t] / (snap.capacity / crews)) : 0,
               order: "earliest due first" };
    }

    // ---------------------------------------------------------------- why-zoom: the demand forecast, step by step
    function demand(d) {
      const y23 = D[d].m2023, y24 = D[d].m2024;
      const avg = y23.map((v, i) => (v + y24[i]) / 2);
      const t23 = y23.reduce((a, b) => a + b, 0), t24 = y24.reduce((a, b) => a + b, 0), tav = avg.reduce((a, b) => a + b, 0);
      const factor = t24 / tav, fc = avg.map(v => v * factor);
      const bt = (E.data.backtest || []).filter(r => r.department === d).map(r => ({ method: r.method, error: r.mape }));
      return { dept: d, name: NAMES[d], y2023: y23, y2024: y24, average: avg, total_2023: t23, total_2024: t24, total_average: tav,
               factor, forecast: fc, forecast_engine: D[d].fc2025, per_crew_month: perCrewMonth(d), crews_needed: fc.map(v => v / perCrewMonth(d)),
               backtest: bt, chosen: "seasonal_avg", planning_range: [0.86, 1.14] };
    }

    // The forecast: its likely range and tested accuracy (forecast_2025.csv, forecast_backtest.csv)
    const METHOD_WORDS = { seasonal_avg: "a seasonal average of 2023 and 2024", seasonal_naive: "the same month last year", damped_growth: "a damped growth trend", holt_winters: "Holt-Winters smoothing" };
    let FC = null;
    function forecast() {
      if (FC) return FC;
      const fm = E.data.forecast_method || null, bt = E.data.backtest || [];
      const chosen = fm ? fm.chosen : "seasonal_avg", means = fm ? fm.mean_mape : {}, others = Object.keys(means).filter(k => k !== chosen);
      const depts = {};
      for (const d of Object.keys(D)) {
        const x = D[d], fc = x.fc2025, ok = Array.isArray(x.fc_low) && Array.isArray(x.fc_high) && x.fc_low.length === 12;
        const mine = bt.filter(r => r.department === d), ch = mine.find(r => r.method === chosen);
        depts[d] = { dept: d, name: NAMES[d], mape: typeof x.fc_mape === "number" ? x.fc_mape : ch ? ch.mape : null, forecast: fc.slice(),
                     low: ok ? x.fc_low.slice() : null, high: ok ? x.fc_high.slice() : null,
                     lo_ratio: ok ? fc.map((v, i) => (v > 0 ? x.fc_low[i] / v : 1)) : null, hi_ratio: ok ? fc.map((v, i) => (v > 0 ? x.fc_high[i] / v : 1)) : null,
                     beaten_by: ch ? mine.filter(r => r.method !== chosen && r.mape < ch.mape).map(r => ({ method: r.method, words: METHOD_WORDS[r.method] || r.method, mape: r.mape })) : [],
                     above_plus20: ok ? fc.filter((v, i) => v * 1.2 > x.fc_high[i]).length : null };
      }
      const ms = Object.values(depts).map(x => x.mape).filter(v => typeof v === "number");
      FC = { chosen, chosen_words: METHOD_WORDS[chosen] || chosen, others: others.map(k => ({ method: k, words: METHOD_WORDS[k] || k, mean_mape: means[k] })),
             chosen_mean_mape: means[chosen], tested_on: fm ? fm.tested_on : 2024, depts, mape_min: ms.length ? Math.min(...ms) : null, mape_max: ms.length ? Math.max(...ms) : null,
             above_plus20: Object.values(depts).reduce((a, x) => a + (x.above_plus20 || 0), 0), months_total: Object.keys(depts).length * 12, ready: Object.values(depts).every(x => x.low) };
      return FC;
    }

    // ---------------------------------------------------------------- why-zoom: one hiring decision
    function decision(d, dec, p) {
      const without = { crews: p.crews.slice(), seasonal: p.seasonal.slice() };
      const sign = dec.action === "release" ? -1 : 1;
      for (let i = dec.month; i < 12; i++) without.crews[i] -= sign * dec.crews;
      const a = E.expected(d, p.crews, p.seasonal), b = E.expected(d, without.crews, without.seasonal);
      return { dept: d, decision: dec, with: { payroll: a.crew_cost, trust_cost: a.overdue_cost + a.backlog_cost, ontime: a.ontime_rate, busy_year_ontime: a.worst_ontime },
               without: { payroll: b.crew_cost, trust_cost: b.overdue_cost + b.backlog_cost, ontime: b.ontime_rate, busy_year_ontime: b.worst_ontime },
               note: "Scored over a year 14% quieter, on forecast and 14% busier, like the planner." };
    }

    return { DEPTS, NAMES, MONTHS, plans, city, dept, month, day, year, demand, decision, flow, forecast };
  }
  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TerryLevels = api;
})(typeof window !== "undefined" ? window : globalThis);
