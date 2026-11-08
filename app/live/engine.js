/* Terry engine: the Boston 311 crew planner, running in the browser.
 *
 * A port of src/sim.py, src/optimize.py, terry/echo.py, terry/calendar.py and the guardrails in
 * terry/report.py + terry/hunt.py. The only modeling difference from the notebook: demand is rescaled
 * to the forecast with exact expected weights instead of random resampling (deterministic; validated
 * against the Python results in app/live/validate.mjs).
 *
 * Usage (page):   const E = TerryEngine.create(data)   // data = parsed data.json
 *                 E.simulate("BTDT", crews, seasonal, {mult, shock}) ... see API at the bottom.
 * Usage (worker): new Worker("engine.js") then postMessage({type:"init", data}) / {type:"optimize", ...}
 */
(function (root) {
  "use strict";

  const YEAR = 2025, N_DAYS = 365, HORIZON = N_DAYS + 400, END = N_DAYS - 1;
  const MONTH_OF_DAY = new Int8Array(N_DAYS), IS_WORKDAY = new Uint8Array(N_DAYS);
  for (let t = 0; t < N_DAYS; t++) {
    const d = new Date(Date.UTC(YEAR, 0, 1 + t));
    MONTH_OF_DAY[t] = d.getUTCMonth();
    const wd = d.getUTCDay();                       // 0 Sun .. 6 Sat
    IS_WORKDAY[t] = wd >= 1 && wd <= 5 ? 1 : 0;
  }
  const WORKDAYS_IN_MONTH = new Int16Array(12);
  for (let t = 0; t < N_DAYS; t++) if (IS_WORKDAY[t]) WORKDAYS_IN_MONTH[MONTH_OF_DAY[t]]++;
  const DEC_WORKDAYS = WORKDAYS_IN_MONTH[11];
  const SEASONAL_MONTHS = [3, 4, 5, 6, 7, 8, 9];   // Apr..Oct
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FLOORS = { passive: null, neutral: 0.90, aggressive: 0.95 };
  const PENALTY = 1e8, STRESS = 1.20;

  function create(DATA) {
    const D = DATA.depts;
    const NODES = DATA.nodes, WEIGHTS = DATA.weights;

    // ------------------------------------------------------------------ arrivals
    // Bucket a department's 2024 replay into per-day CSR arrays, weighted to a monthly target.
    const arrCache = new Map();
    function arrivals(dept, target) {          // target: 12 monthly counts
      const key = dept + "|" + target.map(v => v.toFixed(3)).join(",");
      if (arrCache.has(key)) return arrCache.get(key);
      const d = D[dept], [O, U, T, N] = d.arr;
      const scale = target.map((v, m) => (d.m2024[m] > 0 ? v / d.m2024[m] : 0));
      const counts = new Int32Array(N_DAYS + 1);
      for (let i = 0; i < O.length; i++) counts[O[i] + 1]++;
      for (let t = 0; t < N_DAYS; t++) counts[t + 1] += counts[t];
      const start = counts.slice(), pos = counts.slice(0, N_DAYS);
      const due = new Int32Array(O.length), w = new Float64Array(O.length), tg = new Uint8Array(O.length);
      let targetedN = 0, monthTotals = new Float64Array(12);
      for (let i = 0; i < O.length; i++) {
        const o = O[i], k = pos[o]++;
        due[k] = Math.min(o + U[i], HORIZON - 1);
        w[k] = N[i] * scale[MONTH_OF_DAY[o]];
        tg[k] = T[i];
        if (T[i]) targetedN += w[k];
        monthTotals[MONTH_OF_DAY[o]] += w[k];
      }
      const a = { dept, start, due, w, tg, targetedN, monthTotals, janTotal: monthTotals[0] };
      if (arrCache.size > 60) arrCache.clear();
      arrCache.set(key, a);
      return a;
    }
    function target(dept, mult = 1, shock = null) {   // shock: {month: 1..12, mult}
      const fc = D[dept].fc2025.map(v => v * mult);
      if (shock && shock.month) fc[shock.month - 1] *= shock.mult;
      return fc;
    }

    // ------------------------------------------------------------------ simulator
    const qT = new Float64Array(HORIZON), qN = new Float64Array(HORIZON);
    function simulate(dept, crews, seasonal, opts = {}) {
      const a = opts.arrivals || arrivals(dept, target(dept, opts.mult ?? 1, opts.shock || null));
      const d = D[dept], cap = d.cap, annual = d.annual;
      seasonal = seasonal || new Array(12).fill(0);
      const perWorkday = new Float64Array(12);
      for (let m = 0; m < 12; m++) perWorkday[m] = (crews[m] + seasonal[m]) * cap * 21 / WORKDAYS_IN_MONTH[m];
      // Optional day-level events: dayMult scales the requests opened that day, capMult scales the crews' output
      const dayMult = opts.dayMult || null, capMult = opts.capMult || null, wantDaily = !!opts.daily;
      const dArr = wantDaily ? new Float64Array(N_DAYS) : null, dClosed = wantDaily ? new Float64Array(N_DAYS) : null;
      const dBacklog = wantDaily ? new Float64Array(N_DAYS) : null, dPastDue = wantDaily ? new Float64Array(N_DAYS) : null;
      const dLate = wantDaily ? new Float64Array(N_DAYS) : null, dClosedT = wantDaily ? new Float64Array(N_DAYS) : null, dDue7 = wantDaily ? new Float64Array(N_DAYS) : null, dUrgent = wantDaily ? new Float64Array(N_DAYS) : null;
      qT.fill(0); qN.fill(0);
      let lo = HORIZON, queued = 0, targetedArr = 0;
      const mArr = new Float64Array(12);
      const mClosed = new Float64Array(12), mClosedT = new Float64Array(12), mOver = new Float64Array(12), mCliff = new Float64Array(12), mBacklog = new Float64Array(12);
      for (let t = 0; t < N_DAYS; t++) {
        const dm = dayMult ? dayMult[t] : 1;
        for (let k = a.start[t]; k < a.start[t + 1]; k++) {
          const u = a.due[k], w = a.w[k] * dm;
          if (a.tg[k]) { qT[u] += w; targetedArr += w; } else qN[u] += w;
          queued += w; mArr[MONTH_OF_DAY[t]] += w;
          if (dArr) { dArr[t] += w; if (u - t <= 14) dUrgent[t] += w; }
          if (u < lo) lo = u;
        }
        const mi = MONTH_OF_DAY[t];
        const snap = opts.snapshotDay === t ? { day: t, arrivals: 0, before: [], after: [], capacity: 0 } : null;
        if (snap) { for (let i = 0; i < HORIZON; i++) { const v = qT[i] + qN[i]; if (v > 1e-9) snap.before.push({ due: i, n: v, targeted: qT[i] }); } snap.capacity = IS_WORKDAY[t] ? perWorkday[mi] * (capMult ? capMult[t] : 1) : 0; }
        const closedBefore = dClosed ? mClosed[mi] : 0, lateBefore = dLate ? mOver[mi] : 0, closedTBefore = dClosedT ? mClosedT[mi] : 0;
        if (IS_WORKDAY[t]) {
          let c = perWorkday[mi] * (capMult ? capMult[t] : 1);
          let idx = lo;
          while (c > 1e-12 && idx < HORIZON) {
            const tot = qT[idx] + qN[idx];
            if (tot > 0) {
              const s = tot <= c ? tot : c;
              const fT = qT[idx] / tot, sT = s * fT;
              qT[idx] -= sT; qN[idx] -= s - sT;
              if (qT[idx] < 1e-12) qT[idx] = 0;
              if (qN[idx] < 1e-12) qN[idx] = 0;
              c -= s; queued -= s; mClosed[mi] += s; mClosedT[mi] += sT;
              if (idx < t) { mOver[mi] += sT; if (idx <= t - 30) mCliff[mi] += sT; }
            }
            if (qT[idx] + qN[idx] <= 0) idx++;
            else break;
          }
          lo = idx;
        }
        mBacklog[mi] = queued;
        if (snap) { for (let i = 0; i < HORIZON; i++) { const v = qT[i] + qN[i]; if (v > 1e-9) snap.after.push({ due: i, n: v, targeted: qT[i] }); } opts.onSnapshot && opts.onSnapshot(snap); }
        if (wantDaily) {
          dClosed[t] = mClosed[mi] - closedBefore; dClosedT[t] = mClosedT[mi] - closedTBefore; dLate[t] = mOver[mi] - lateBefore; dBacklog[t] = queued;
          let pd = 0, soon = 0; for (let i = lo; i < t; i++) pd += qT[i];
          for (let i = Math.max(lo, t); i <= Math.min(t + 14, HORIZON - 1); i++) soon += qT[i] + qN[i];
          dPastDue[t] = pd; dDue7[t] = pd + soon;   // open work due within two weeks (or already late)
        }
      }
      // still open on 31 Dec: past due counts as overdue (and cliff if 30+ days)
      let openLate = 0, openCliff = 0, backlogEnd = 0;
      for (let i = 0; i < HORIZON; i++) {
        backlogEnd += qT[i] + qN[i];
        if (i < END) openLate += qT[i];
        if (i <= END - 30) openCliff += qT[i];
      }
      mOver[11] += openLate; mCliff[11] += openCliff;

      const mc = annual / 12, start = d.start;
      const monthly = [];
      let crewCost = 0, overdueCost = 0, over = 0, cliff = 0;
      for (let m = 0; m < 12; m++) {
        const prev = m === 0 ? start : crews[m - 1];
        const hire = Math.max(crews[m] - prev, 0), release = Math.max(prev - crews[m], 0);
        const nextHire = m < 11 ? Math.max(crews[m + 1] - crews[m], 0) : 0;   // trained (paid) a month early
        const cc = crews[m] * mc + nextHire * mc + release * 0.25 * annual + seasonal[m] * 1.3 * mc;
        const oc = mOver[m] * 20 + mCliff[m] * 100;
        crewCost += cc; overdueCost += oc; over += mOver[m]; cliff += mCliff[m];
        monthly.push({ month: `${YEAR}-${String(m + 1).padStart(2, "0")}`, crews: crews[m], seasonal: seasonal[m], hire, release,
                       demand: mArr[m], closed: mClosed[m], backlog_eom: mBacklog[m], overdue: mOver[m], cliff: mCliff[m],
                       crew_cost: cc, overdue_cost: oc });
      }
      // Year-end backlog: crew cost to clear it + projected overdue fees in early 2026
      let capDec = 0;
      for (let t = 0; t < N_DAYS; t++) if (MONTH_OF_DAY[t] === 11 && IS_WORKDAY[t]) capDec += perWorkday[11];
      capDec = (capDec / DEC_WORKDAYS) * 5 / 7;
      const arrJan = a.janTotal / 31;
      const net = Math.max(capDec - arrJan, 0.05 * capDec, 1.0);
      let cum = 0, projLate = 0, projCliff = 0;
      for (let i = 0; i < HORIZON; i++) {
        cum += qT[i] + qN[i];
        const clear = END + cum / net;
        if (i >= END && clear > i) projLate += qT[i];
        if (i >= END - 30 && clear > i + 30) projCliff += qT[i];
      }
      const cpc = annual / (d.cap * 21 * 12);
      const backlogCost = backlogEnd * cpc + 20 * projLate + 100 * projCliff;
      const targetedTotal = dayMult ? targetedArr : a.targetedN;
      for (let m = 0; m < 12; m++) monthly[m].closed_targeted = mClosedT[m];
      const out = {
        dept, crews: crews.slice(), seasonal: seasonal.slice(), monthly,
        ontime_rate: 1 - over / Math.max(targetedTotal, 1), overdue: over, cliff, backlog_end: backlogEnd,
        proj_late: projLate, proj_cliff: projCliff, crew_cost: crewCost, overdue_cost: overdueCost,
        backlog_cost: backlogCost, total_cost: crewCost + overdueCost + backlogCost,
        requests: mArr.reduce((x, y) => x + y, 0),
      };
      if (wantDaily) out.daily = { arrivals: dArr, closed: dClosed, closed_targeted: dClosedT, backlog: dBacklog, past_due: dPastDue, late: dLate, due7: dDue7, urgent: dUrgent, cap_day: Array.from(perWorkday, v => v * 5 / 7) };
      return out;
    }
    const flat = dept => new Array(12).fill(D[dept].start);
    const zeros = () => new Array(12).fill(0);

    // ------------------------------------------------------------------ expected value over the planning nodes
    function expected(dept, crews, seasonal, base = 1, nodes = NODES, weights = WEIGHTS) {
      const rs = nodes.map(m => simulate(dept, crews, seasonal, { mult: base * m }));
      const keys = ["ontime_rate", "overdue", "cliff", "backlog_end", "proj_late", "crew_cost", "overdue_cost", "backlog_cost", "total_cost"];
      const out = {};
      for (const k of keys) out[k] = rs.reduce((s, r, i) => s + weights[i] * r[k], 0);
      out.worst_ontime = Math.min(...rs.map(r => r.ontime_rate));
      out.nodes = rs.map((r, i) => ({ mult: base * nodes[i], ontime_rate: r.ontime_rate, total_cost: r.total_cost }));
      return out;
    }

    // ------------------------------------------------------------------ optimizer (port of src/optimize.py)
    function optimize(dept, mode = "neutral", opts = {}) {
      const base = opts.mult ?? 1, shock = opts.shock || null;
      const nodes = opts.nodes || NODES, weights = opts.weights || WEIGHTS;
      const fc = target(dept, base, shock);
      const arrs = nodes.map(m => arrivals(dept, fc.map(v => v * m)));
      const stress = mode === "aggressive" ? arrivals(dept, fc.map(v => v * STRESS)) : null;
      const floor = opts.floor !== undefined ? opts.floor : FLOORS[mode];
      const ev = { dayMult: opts.dayMult || null, capMult: opts.capMult || null };
      const goal = opts.goal || null;                       // {months:[1..12], target, ratio}
      const iFc = nodes.reduce((b, m, i) => (Math.abs(m - 1) < Math.abs(nodes[b] - 1) ? i : b), 0);
      let evals = 0;
      const onProgress = opts.onProgress || null;
      function score(crews, seas) {
        evals++;
        if (onProgress && evals % 150 === 0) onProgress(evals);
        const rs = arrs.map(a => simulate(dept, crews, seas, { arrivals: a, ...ev }));
        let e = 0;
        for (let i = 0; i < rs.length; i++) e += weights[i] * (rs[i].crew_cost + rs[i].overdue_cost + rs[i].backlog_cost);
        if (floor !== null) e += PENALTY * Math.max(0, floor - Math.min(...rs.map(r => r.ontime_rate)));
        if (stress) e += PENALTY * Math.max(0, 0.90 - simulate(dept, crews, seas, { arrivals: stress, ...ev }).ontime_rate);
        if (goal) e += PENALTY * Math.max(0, goal.target - windowOntime(rs[iFc], goal.months, goal.ratio));
        return e;
      }
      const fixedMonths = opts.fixedMonths ?? 1;
      function search(crews, seas) {
        let best = score(crews, seas);
        for (let pass = 0; pass < 12; pass++) {
          let improved = false;
          const cands = [];
          for (let mi = fixedMonths; mi < 12; mi++)
            for (const step of [-2, -1, 1, 2])
              for (const block of [false, true]) {
                const c = crews.slice();
                if (block) for (let j = mi; j < 12; j++) c[j] += step; else c[mi] += step;
                cands.push([c, seas.slice()]);
              }
          if (dept === "PARK") {
            for (const mi of SEASONAL_MONTHS) {
              if (mi < fixedMonths) continue;
              for (const step of [-1, 1, 2]) { const s = seas.slice(); s[mi] += step; cands.push([crews.slice(), s]); }
            }
            for (let mi = Math.max(fixedMonths, 1); mi < 12; mi++) {
              const c = crews.slice(), s = seas.slice();
              for (let j = mi; j < 12; j++) c[j] -= 1;
              for (const m of SEASONAL_MONTHS) if (m >= Math.max(mi, fixedMonths)) s[m] += 1;
              cands.push([c, s]);
            }
          }
          for (const [c, s] of cands) {
            if (c.some(v => v < 0) || s.some(v => v < 0)) continue;
            const o = score(c, s);
            if (o < best - 1) { crews = c; seas = s; best = o; improved = true; }
          }
          if (!improved) break;
        }
        return { crews, seasonal: seas, obj: best };
      }
      const start = D[dept].start, cap = D[dept].cap;
      let starts;
      if (opts.fixedPlan) starts = [[opts.fixedPlan.crews.slice(), opts.fixedPlan.seasonal.slice()]];
      else {
        const hi = Math.max(...nodes);
        const matched = fc.map(v => Math.max(Math.ceil(v * hi / (cap * 21)), 1)); matched[0] = start;
        starts = [[flat(dept), zeros()], [matched, zeros()]];
        if (dept === "PARK") { const s = zeros(); for (const m of SEASONAL_MONTHS) s[m] = 5; starts.push([flat(dept), s]); }
        if (opts.warmStart) starts.unshift([opts.warmStart.crews.slice(), opts.warmStart.seasonal.slice()]);
      }
      let best = null;
      for (const [c, s] of starts) { const r = search(c, s); if (!best || r.obj < best.obj) best = r; }
      return { dept, mode, crews: best.crews, seasonal: best.seasonal, objective: best.obj, evals };
    }

    function breakPoint(dept, crews, seasonal, targetOntime = 0.90) {
      for (let pct = 0; pct <= 60; pct += 2)
        if (simulate(dept, crews, seasonal, { mult: 1 + pct / 100 }).ontime_rate < targetOntime) return pct;
      return null;
    }

    // ------------------------------------------------------------------ goals, events and Dusk
    // A crew change effective in month m (1..12) must be signed by the last day of month m-2: one month of
    // hiring and training (paid) in month m-1, working from month m. Releases need the same month of notice.
    function signBy(m) {
      if (m <= 1) return null;                                   // January's crews are fixed
      if (m === 2) return `${YEAR - 1}-12-31`;
      const last = new Date(Date.UTC(YEAR, m - 2, 0)).getUTCDate();
      return `${YEAR}-${String(m - 2).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    }
    // Dusk: the last day you can still sign a crew that is working by the first month of the goal window
    function dusk(firstMonth, nowDay = -1) {
      const date = signBy(firstMonth);
      if (!date) return { date: null, passed: true, effective_month: firstMonth, note: "January's crews are already set." };
      const day = Math.round((Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - Date.UTC(YEAR, 0, 1)) / 864e5);
      return { date, day, passed: nowDay > day, effective_month: firstMonth };
    }
    // Earliest month (1..12) a crew change can take effect if you decide on day t (0-based day of 2025)
    const earliestEffective = t => MONTH_OF_DAY[Math.min(Math.max(t, 0), N_DAYS - 1)] + 3;
    // On-time share of targeted requests closed in the goal months, with a neighborhood's 2024 lateness ratio
    function windowOntime(sim, months, ratio = 1) {
      let over = 0, closed = 0;
      for (const m of months) { over += sim.monthly[m - 1].overdue; closed += sim.monthly[m - 1].closed_targeted; }
      if (closed <= 0) return 1;
      return Math.max(0, Math.min(1, 1 - (over * ratio) / closed));
    }
    // How much later a neighborhood's requests ran than its department's in 2024 (same months when there is enough data)
    function hoodRatio(dept, hood, months) {
      if (!hood) return { ratio: 1, basis: "department" };
      const all = cell(dept, null, null, months), h = cell(dept, null, hood, months);
      let basis = "same months, 2024";
      let A = all, H = h;
      if (h.n < 300) { A = cell(dept, null, null, null); H = cell(dept, null, hood, null); basis = "full year 2024"; }
      if (H.n < 50 || A.late <= 0) return { ratio: 1, basis: "too few requests; department rate used", n: H.n };
      const r = (H.late / H.n) / (A.late / A.n);
      return { ratio: Math.max(0.3, Math.min(3, r)), basis, n: H.n, hood_late: H.late / H.n, dept_late: A.late / A.n };
    }
    // Is a predator a crew problem or a process problem? Look at the request type in its department's three best months of a
    // year (lowest late share, months with 100+ requests): when the department had crews to keep up. A type that still ran
    // late then is late for reasons more crews do not touch (due dates, contractors, inspections). rows: 2024 cells by default,
    // DATA.cells_2023 for the second year. Too few requests (under 50) in those months means Terry cannot tell.
    function typeFloor(dept, type, hood, rows) {
      const per = [];
      for (let m = 1; m <= 12; m++) { const c = cell(dept, null, null, [m], rows); if (c.n >= 100) per.push({ m, r: c.late / c.n }); }
      if (per.length < 3) return null;
      const B = per.sort((a, b) => a.r - b.r).slice(0, 3).map(x => x.m).sort((a, b) => a - b);
      let t = cell(dept, type, hood || null, B, rows), basis = hood ? "neighborhood" : "citywide";
      if (hood && t.n < 50) { t = cell(dept, type, null, B, rows); basis = "citywide"; }
      if (t.n < 50) return null;
      const dc = cell(dept, null, null, B, rows);
      return { months: B, type_ontime: 1 - t.late / t.n, dept_ontime: 1 - dc.late / dc.n, n: t.n, basis };
    }
    // Share of a department's 2024 requests in a neighborhood, by month (scales neighborhood-only events)
    function hoodShare(dept, hood) {
      const di = DL.indexOf(dept), ni = C.hoods.indexOf(hood), tot = new Float64Array(12), part = new Float64Array(12);
      for (const r of C.rows) if (r[0] === di) { tot[r[3] - 1] += r[4]; if (r[2] === ni) part[r[3] - 1] += r[4]; }
      return Array.from(tot, (v, i) => (v > 0 ? part[i] / v : 0));
    }
    // Build day-level multipliers from events: [{dept, start (day 0..364), days, mult, kind:"demand"|"capacity", hood?}]
    function eventArrays(dept, events) {
      let dayMult = null, capMult = null;
      for (const e of events || []) {
        if (e.dept && e.dept !== dept) continue;
        const arr = e.kind === "capacity" ? (capMult ||= new Float64Array(N_DAYS).fill(1)) : (dayMult ||= new Float64Array(N_DAYS).fill(1));
        const share = e.kind !== "capacity" && e.hood ? hoodShare(dept, e.hood) : null;
        const end = Math.min(N_DAYS, e.start + (e.days ?? N_DAYS));
        for (let t = Math.max(0, e.start); t < end; t++) {
          const sh = share ? share[MONTH_OF_DAY[t]] : 1;
          arr[t] *= 1 + sh * (e.mult - 1);
        }
      }
      return { dayMult, capMult };
    }
    const dayOf = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(YEAR, 0, 1)) / 864e5);
    const isoOf = t => new Date(Date.UTC(YEAR, 0, 1 + t)).toISOString().slice(0, 10);

    // ------------------------------------------------------------------ decision calendar (port of terry/calendar.py)
    function decisions(dept, crews, seasonal) {
      const d = D[dept], mc = d.annual / 12, out = [];
      let prev = d.start, prevS = 0;
      seasonal = seasonal || zeros();
      for (let i = 0; i < 12; i++) {
        const m = i + 1;
        if (crews[i] !== prev) {
          const hire = crews[i] > prev, n = Math.abs(crews[i] - prev);
          out.push({ decide_by: signBy(m),
                     effective: `${YEAR}-${String(m).padStart(2, "0")}`, department: dept, action: hire ? "hire" : "release", crews: n,
                     monthly_cost_usd: Math.round(hire ? n * mc : -n * mc), one_time_cost_usd: Math.round(hire ? n * mc : n * 0.25 * d.annual) });
        }
        if (seasonal[i] !== prevS) {
          const n = seasonal[i] - prevS;
          out.push({ decide_by: `${YEAR}-${String(m).padStart(2, "0")}-01`, effective: `${YEAR}-${String(m).padStart(2, "0")}`, department: dept,
                     action: "seasonal", crews: n, monthly_cost_usd: Math.round(n * mc * 1.3), one_time_cost_usd: 0 });
        }
        prev = crews[i]; prevS = seasonal[i];
      }
      return out;
    }
    function scheduleText(crews, seasonal) {
      const runs = v => { const r = []; let i = 0; while (i < 12) { let j = i; while (j + 1 < 12 && v[j + 1] === v[i]) j++; r.push([i, j, v[i]]); i = j + 1; } return r; };
      let txt = runs(crews).map(([a, b, c]) => `${MON[a]}${b > a ? "-" + MON[b] : ""} ${c}`).join(", ");
      if (seasonal && seasonal.some(Boolean))
        txt += " (seasonal: " + runs(seasonal).filter(r => r[2]).map(([a, b, c]) => `${MON[a]}${b > a ? "-" + MON[b] : ""} +${c}`).join(", ") + ")";
      return txt;
    }

    // ------------------------------------------------------------------ echolocation (port of terry/echo.py)
    const C = DATA.cells, DL = ["PWDx", "BTDT", "PARK", "ISD"];
    const silenceBy = Object.fromEntries(DATA.silence.map(s => [s.neighborhood, s]));
    const typesByDept = {};
    for (const r of C.rows) (typesByDept[DL[r[0]]] ||= new Set()).add(C.types[r[1]]);
    const TYPES = Object.fromEntries(Object.entries(typesByDept).map(([k, v]) => [k, [...v].sort()]));
    const HOODS = DATA.silence.map(s => s.neighborhood).sort();
    function cell(dept, type, hood, months, rows) {
      rows = rows || C.rows;
      const di = DL.indexOf(dept), ti = type ? C.types.indexOf(type) : -1, ni = hood ? C.hoods.indexOf(hood) : -1;
      const ms = months && months.length ? new Set(months) : null;
      let n = 0, late = 0, cliff = 0;
      if ((type && ti < 0) || (hood && ni < 0)) return { n, late, cliff };
      for (const r of rows) {
        if (r[0] !== di) continue;
        if (ti >= 0 && r[1] !== ti) continue;
        if (ni >= 0 && r[2] !== ni) continue;
        if (ms && !ms.has(r[3])) continue;
        n += r[4]; late += r[5]; cliff += r[6];
      }
      return { n, late, cliff };
    }
    const pctTxt = v => `${Math.round(v * 100)}%`;
    // The same test on 2023 (owner 21:48): the verdict stays the 2024 one the plan uses; the second year says
    // whether the predator held in both years, only in 2024, or only in 2023.
    const silence23By = Object.fromEntries((DATA.silence_2023 || []).map(s => [s.neighborhood, s]));
    const yearsOf = (a, b) => a == null ? "2024" : (a && b ? "both" : b ? "2024only" : a ? "2023only" : "neither");
    const YEARS_TXT = { crew: { both: "Late in 2023 and 2024", "2024only": "Late in 2024 only", "2023only": "Late in 2023, recovered in 2024", neither: "Not late in either year", "2024": "Tested on 2024" },
                        silence: { both: "Quiet in 2023 and 2024", "2024only": "Quiet in 2024 only", "2023only": "Quiet in 2023, not in 2024", neither: "Not quiet in either year", "2024": "Tested on 2024" } };
    function echo(h) { const r = echo1(h); if (r.verdict === "UNTESTABLE") return r;
      const t = echo23(h); r.y2023 = t; r.years = yearsOf(t ? t.confirmed : null, r.verdict === "CONFIRMED"); r.years_text = YEARS_TXT[h.kind === "silence" ? "silence" : "crew"][r.years];
      if (h.kind !== "silence") {   // a cell that ran late but was too small to count is "too few", never "not late"
        const s24 = r.reason === "small", s23 = !!(t && t.small), m24 = r.reason === "mild", m23 = !!(t && t.mild);
        if (r.years === "neither" && (s24 || s23)) r.years_text = s24 && s23 ? "Too few requests to count, both years" : s24 ? "Too few to count in 2024" : "Too few to count in 2023";
        else if (r.years === "neither" && (m24 || m23)) r.years_text = m24 && m23 ? "A little late, both years" : m24 ? "A little late in 2024" : "A little late in 2023";
        else if (r.years === "2024only" && s23) r.years_text = "Late in 2024; too few in 2023";
        else if (r.years === "2023only" && s24) r.years_text = "Late in 2023; too few in 2024";
      }
      if (t && t.detail) r.detail += " " + t.detail; return r; }
    function echo23(h) {
      if (h.kind === "silence") {
        const s = h.neighborhood && silence23By[h.neighborhood]; if (!s) return null;
        return { confirmed: s.silence_ratio < 0.85, silence_ratio: s.silence_ratio, requests: s.requests,
                 detail: `In 2023: ${s.silence_ratio.toFixed(2)}x.` };
      }
      if (!DATA.cells_2023) return null;
      const c = cell(h.department, h.request_type, h.neighborhood, h.months, DATA.cells_2023);
      if (c.n === 0) return { confirmed: false, n: 0, late: 0, cliff: 0, rate: null, detail: "No matching requests in 2023." };
      const cost = c.late * 20 + c.cliff * 100, rate = c.late / c.n, dr = DATA.dept_late_2023[h.department];
      const confirmed = (c.late >= 20 && rate > dr + 0.10) || (cost >= 5000 && rate >= dr + 0.02);
      return { confirmed, small: !confirmed && rate > dr + 0.10, mild: !confirmed && rate >= dr + 0.02 && rate <= dr + 0.10, n: c.n, late: c.late, cliff: c.cliff, rate, dept_rate: dr, cost_usd: cost,
               detail: `In 2023: ${c.n.toLocaleString("en-US")} requests, ${pctTxt(rate)} late vs ${pctTxt(dr)} for the department.` };
    }
    function echo1(h) {
      if (h.kind === "silence") {
        const s = h.neighborhood && silenceBy[h.neighborhood];
        if (!s) return { verdict: "UNTESTABLE", detail: "No neighborhood named, or not in the silence table." };
        return { verdict: s.silence_ratio < 0.85 ? "CONFIRMED" : "REJECTED", requests_2024: s.requests,
                 detail: `Residents in ${h.neighborhood} report at ${s.silence_ratio.toFixed(2)}x the city rate for the same problem types (quietest: ${s.quietest_type} at ${s.quietest_ratio.toFixed(2)}x).` };
      }
      if (h.kind === "shock") return { verdict: "UNTESTABLE", detail: "Weather and event spikes are tested in the simulator, not in history." };
      const c = cell(h.department, h.request_type, h.neighborhood, h.months);
      if (c.n === 0) return { verdict: "REJECTED", detail: "No 2024 requests match this cell. Check the type or neighborhood name." };
      const cost = c.late * 20 + c.cliff * 100, rate = c.late / c.n, deptRate = DATA.dept_late_2024[h.department];
      const confirmed = (c.late >= 20 && rate > deptRate + 0.10) || (cost >= 5000 && rate >= deptRate + 0.02);
      // why not confirmed: "small" = far later than the department but too few requests to count (under 20 late, under $5,000);
      // "mild" = only a little later than the department (under 10 points above, under $5,000); "not_late" = no later than it
      const reason = confirmed ? null : rate > deptRate + 0.10 ? "small" : rate >= deptRate + 0.02 ? "mild" : "not_late";
      const where = h.neighborhood ? " in " + h.neighborhood : " citywide";
      const when = h.months && h.months.length ? " in " + h.months.map(m => MON[m - 1]).join(", ") : "";
      return { verdict: confirmed ? "CONFIRMED" : "REJECTED", reason, requests_2024: c.n, overdue_2024: c.late, cliff_2024: c.cliff, cost_2024_usd: cost,
               detail: `${c.n.toLocaleString("en-US")} requests${where}${when} (2024); ${c.late.toLocaleString("en-US")} closed late (${pctTxt(rate)} vs ${pctTxt(deptRate)} for the department), ${c.cliff.toLocaleString("en-US")} past the 30-day cliff; cost at the brief's rates $${cost.toLocaleString("en-US")}.` };
    }

    // ------------------------------------------------------------------ evidence for the flip (port of terry/flip.py _evidence)
    function evidence(dept) {
      const depts = dept ? [dept] : DL, lines = [];
      for (const d of depts) {
        const di = DL.indexOf(d), byM = new Float64Array(12), lateM = new Float64Array(12);
        for (const r of C.rows) if (r[0] === di) { byM[r[3] - 1] += r[4]; lateM[r[3] - 1] += r[5]; }
        const tot = byM.reduce((a, b) => a + b, 0), late = lateM.reduce((a, b) => a + b, 0);
        const peak = [...byM.keys()].sort((a, b) => byM[b] - byM[a]).slice(0, 3).map(i => MON[i]);
        lines.push(`${d} ${D[d].name} 2024: ${tot.toLocaleString("en-US")} requests, ${pctTxt(1 - late / tot)} on time, busiest months ${peak.join(", ")}`);
      }
      const agg = new Map(), cellAgg = new Map();
      for (const r of C.rows) {
        if (dept && DL[r[0]] !== dept) continue;
        const k = DL[r[0]] + " / " + C.types[r[1]];
        const v = agg.get(k) || [0, 0]; v[0] += r[5]; v[1] += r[5] * 20 + r[6] * 100; agg.set(k, v);
        if (C.hoods[r[2]]) {
          const k2 = C.types[r[1]] + " in " + C.hoods[r[2]];
          const w = cellAgg.get(k2) || [0, 0]; w[0] += r[5]; w[1] += r[5] * 20 + r[6] * 100; cellAgg.set(k2, w);
        }
      }
      lines.push("\nCostliest late request types, full year 2024 (late count, cost at $20 + $100 past 30 days):");
      [...agg].sort((a, b) => b[1][1] - a[1][1]).slice(0, 10).forEach(([k, v]) => lines.push(`  ${k}: ${v[0].toLocaleString("en-US")} late, $${Math.round(v[1]).toLocaleString("en-US")}`));
      lines.push("\nCostliest type x neighborhood cells, full year 2024:");
      [...cellAgg].sort((a, b) => b[1][1] - a[1][1]).slice(0, 8).forEach(([k, v]) => lines.push(`  ${k}: ${v[0].toLocaleString("en-US")} late, $${Math.round(v[1]).toLocaleString("en-US")}`));
      lines.push("\nNeighborhoods whose residents report least for the same problems: " +
                 DATA.silence.slice().sort((a, b) => a.silence_ratio - b.silence_ratio).slice(0, 4).map(s => s.neighborhood).join(", "));
      return lines.join("\n");
    }

    // ------------------------------------------------------------------ number guardrail (port of terry/report.py)
    const NUM = /\$?\d[\d,]*\.?\d*\s*(?:%|[kKmM]\b)?/g;
    function parseNum(s) {
      s = s.trim(); let mult = 1;
      if (s.endsWith("%")) s = s.slice(0, -1);
      else if (/[kK]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
      else if (/[mM]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
      const v = parseFloat(s.replace(/[$,\s]/g, ""));
      return Number.isFinite(v) ? v * mult : null;
    }
    function numbersIn(obj, out = []) {
      if (typeof obj === "number") out.push(obj);
      else if (typeof obj === "string") for (const m of obj.matchAll(NUM)) { const v = parseNum(m[0]); if (v !== null) out.push(v); }
      else if (Array.isArray(obj)) obj.forEach(v => numbersIn(v, out));
      else if (obj && typeof obj === "object") Object.values(obj).forEach(v => numbersIn(v, out));
      return out;
    }
    function unverifiedNumbers(text, facts) {
      const pool = numbersIn(facts);
      for (const v of pool.slice()) if (v > 0 && Math.abs(v) <= 1.5) pool.push(v * 100);
      for (let y = 2020; y <= 2030; y++) pool.push(y);
      for (let i = 1; i <= 31; i++) pool.push(i);
      const bad = [];
      for (const m of String(text).matchAll(NUM)) {
        const v = parseNum(m[0]); if (v === null) continue;
        if (!pool.some(p => Math.abs(v - p) <= Math.max(0.6, 0.02 * Math.abs(p)))) bad.push(m[0].trim());
      }
      return bad;
    }

    // ------------------------------------------------------------------ BM25 retrieval over the request types (intake)
    const tok = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []);
    const docs = DATA.catalog.map(c => tok(`${c.type} ${c.desc} ${c.examples}`));
    const avgdl = docs.reduce((a, d) => a + d.length, 0) / docs.length;
    const df = new Map();
    docs.forEach(d => new Set(d).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
    const idf = w => { const n = df.get(w) || 0; return Math.max(0.01, Math.log((docs.length - n + 0.5) / (n + 0.5) + 1)); };
    const tf = docs.map(d => { const m = new Map(); d.forEach(w => m.set(w, (m.get(w) || 0) + 1)); return m; });
    function bm25(query) {
      const q = tok(query), k1 = 1.5, b = 0.75;
      return docs.map((d, i) => q.reduce((s, w) => { const f = tf[i].get(w) || 0; return f ? s + idf(w) * f * (k1 + 1) / (f + k1 * (1 - b + b * d.length / avgdl)) : s; }, 0));
    }
    // twelve monthly sums of the 2024 replay for a department, a request type and a neighbourhood (any may be left out)
    function monthly(q) {
      q = q || {}; const C2 = DATA.cells, DL2 = ["PWDx", "BTDT", "PARK", "ISD"], di = q.dept ? DL2.indexOf(q.dept) : -1;
      const ti = q.type ? C2.types.indexOf(q.type) : -1, hi = q.hood ? C2.hoods.indexOf(q.hood) : -1;
      const out = { requests: new Array(12).fill(0), overdue: new Array(12).fill(0), cliff: new Array(12).fill(0), n: 0 };
      if ((q.dept && di < 0) || (q.type && ti < 0) || (q.hood && hi < 0)) return out;
      for (const r of C2.rows) {
        if (di >= 0 && r[0] !== di) continue; if (ti >= 0 && r[1] !== ti) continue; if (hi >= 0 && r[2] !== hi) continue;
        out.requests[r[3] - 1] += r[4]; out.overdue[r[3] - 1] += r[5]; out.cliff[r[3] - 1] += r[6]; out.n += r[4];
      }
      return out;
    }

    function retrieve(message, rewrite, k = 12) {
      const ranks = [message, rewrite].filter(Boolean).map(q => { const s = bm25(q); const order = s.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]); const r = new Array(s.length); order.forEach(([, i], j) => r[i] = j); return r; });
      const fused = DATA.catalog.map((c, i) => ranks.reduce((s, r) => s + 1 / (60 + r[i]), 0) + 0.0005 * Math.log10(Math.max(c.count, 1)));
      return fused.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map(([v, i]) => ({ ...DATA.catalog[i], score: v }));
    }

    return { YEAR, MON, NODES, WEIGHTS, FLOORS, data: DATA, depts: D, TYPES, HOODS, arrivals, target, simulate, flat, zeros,
             expected, optimize, breakPoint, decisions, scheduleText, echo, cell, evidence, unverifiedNumbers, retrieve,
             monthly, signBy, dusk, earliestEffective, windowOntime, hoodRatio, typeFloor, hoodShare, eventArrays, dayOf, isoOf, MONTH_OF_DAY, N_DAYS };
  }

  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TerryEngine = api;

  // Web Worker mode: heavy optimizations off the main thread.
  if (typeof window === "undefined" && typeof self !== "undefined" && typeof importScripts === "function") {
    let E = null;
    self.onmessage = (ev) => {
      const m = ev.data;
      try {
        if (m.type === "init") { E = create(m.data); self.postMessage({ id: m.id, ok: true }); return; }
        if (m.type === "optimize") {
          const r = E.optimize(m.dept, m.mode, { ...m.opts, onProgress: n => self.postMessage({ id: m.id, progress: n }) });
          self.postMessage({ id: m.id, ok: true, result: r });
        }
      } catch (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); }
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
