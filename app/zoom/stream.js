/* Residents to crews: a stream of resident-style test messages (the 311 data has no residents' own words), routed by the intake assistant, landing on the streets,
 * and what today's mix means for the plan.
 *
 *   const S = TerryStream.create(E, T, sample)          // T = TerryLive.create(E, sample) (terry.js) for intake
 *   S.batch(day, n, tilt)       -> n messages for that day, mixed like that day's forecast; tilt {BTDT: 1.6} makes one department busier
 *   await S.route(msg)          -> {text, dept, type, queue, follow_up, mode:"live"|"saved"|"rules", truth}
 *   S.warn(day, routed, plan)   -> {shares:{d: {seen, expected, surge}}, alerts:[{dept, surge, week, month_ontime_plan, month_ontime_week, month_ontime_month, text}]}
 *
 * The share test: if today's total matches the forecast, a department's count is its usual share of it. A department
 * running above its usual share is treated as that much busier than forecast, and the simulator says what that does to
 * its month if it lasts a week or a month. Counts below 4 messages are too few to call.
 */
(function (root) {
  "use strict";
  const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
  const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function create(E, T, sample) {
    const msgs = E.data.stream || [];
    let seed = 2025;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // forecast arrivals per department per day (the share a "normal" day has)
    const daily = {};
    for (const d of DEPTS) { const r = E.simulate(d, E.data.plans[d].neutral.crews, E.data.plans[d].neutral.seasonal, { daily: true }); daily[d] = r.daily.arrivals; }
    const expectedShare = t => { const tot = DEPTS.reduce((s, d) => s + daily[d][t], 0) || 1; return Object.fromEntries(DEPTS.map(d => [d, daily[d][t] / tot])); };

    function batch(t, n = 20, tilt = {}) {
      const sh = expectedShare(t), w = Object.fromEntries(DEPTS.map(d => [d, sh[d] * (tilt[d] || 1)]));
      const tw = DEPTS.reduce((s, d) => s + w[d], 0), out = [];
      const byD = Object.fromEntries(DEPTS.map(d => [d, msgs.filter(m => m.dept === d)]));
      for (let i = 0; i < n; i++) {
        let u = rnd() * tw, d = DEPTS[0];
        for (const k of DEPTS) { if ((u -= w[k]) <= 0) { d = k; break; } }
        const pool = byD[d]; if (pool.length) out.push(pool[Math.floor(rnd() * pool.length)]);
      }
      return out;
    }

    async function route(m, opts = {}) {
      if (sample && T) {
        try {
          const r = await T.intake(m.text, opts);
          const c = r.choice || {};
          return { text: m.text, dept: DEPTS.includes(c.department) ? c.department : null, type: c.type || null, queue: c.queue || null,
                   follow_up: c.follow_up || null, mode: "live", truth: m.dept };
        } catch (e) { if (e && e.code === "cancelled") throw e; if (e && e.code === "not_granted") sample = null; }
      }
      // no live model: replay the intake assistant's saved answer for this message (from the notebook's held-out evaluation)
      if (m.saved) return { text: m.text, dept: m.saved.asked ? null : m.saved.dept || null, type: m.saved.type, queue: null,
                            follow_up: m.saved.asked ? "Asked a follow-up question" : null, mode: "saved", truth: m.dept };
      const top = E.retrieve(m.text, "", 1)[0];
      return { text: m.text, dept: top && DEPTS.includes(top.dept) ? top.dept : null, type: top ? top.type : null, queue: top ? top.queue : null,
               follow_up: null, mode: "rules", truth: m.dept };
    }

    function surgeMult(t, days, surge) { const a = new Float64Array(365).fill(1); for (let k = t; k < Math.min(365, t + days); k++) a[k] = 1 + surge; return a; }
    function warn(t, routed, plan) {
      const sh = expectedShare(t), n = routed.filter(r => r.dept).length || 1;
      const shares = {}, alerts = [];
      for (const d of DEPTS) {
        const seen = routed.filter(r => r.dept === d).length, exp = sh[d] * n;
        const surge = exp > 0 ? seen / exp - 1 : 0;
        shares[d] = { seen, expected: Math.round(exp * 10) / 10, surge: Math.round(surge * 100) / 100 };
        // too few to call: need at least 6 messages and a jump that would be unlikely by chance (Poisson z of 2 or more)
        if (seen < 6 || surge < 0.1 || (seen - exp) / Math.sqrt(Math.max(exp, 1)) < 2) continue;
        const p = plan[d], m = E.MONTH_OF_DAY[t];
        const mk = days => surgeMult(t, days, surge);
        const ot = r => { const mo = r.monthly[m]; return mo.closed_targeted > 0 ? Math.max(0, 1 - mo.overdue / mo.closed_targeted) : 1; };
        const base = ot(E.simulate(d, p.crews, p.seasonal, {})), wk = ot(E.simulate(d, p.crews, p.seasonal, { dayMult: mk(7) })), mo = ot(E.simulate(d, p.crews, p.seasonal, { dayMult: mk(30) }));
        const pct = v => `${Math.round(v * 100)}%`;
        alerts.push({ dept: d, surge: shares[d].surge, month: MONTHS[m], month_ontime_plan: base, month_ontime_week: wk, month_ontime_month: mo,
          text: `Today's messages put ${NAMES[d]} ${pct(surge)} above its usual share. If that lasts a week, ${MONTHS[m]} closes ${pct(wk)} on time (plan: ${pct(base)}); if it lasts a month, ${pct(mo)}.` });
      }
      return { day: t, total: routed.length, shares, alerts };
    }
    return { batch, route, warn, surgeMult, expectedShare, live: () => !!sample };
  }
  const api = { create, surgeMult: (t, days, surge) => { const a = new Float64Array(365).fill(1); for (let k = t; k < Math.min(365, t + days); k++) a[k] = 1 + surge; return a; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TerryStream = api;
})(typeof window !== "undefined" ? window : globalThis);
