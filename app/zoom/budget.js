/* TerryBudget: the numbers behind BUDGETerry, the year's crew budget drained month by month. Pure; no drawing here.
 *
 *   const B = TerryBudget.create(Z, plan2025?)     // Z = TerryLevels.create(E); plan2025 defaults to window.TerryPlan2025
 *   B.full, B.depts                              // the recommended plan's 2025 spend (notebook section 4), and each department's part
 *   B.state(plan, t, ref?)                       // spend through t months (0..12, fractional) for a full plan {PWDx: {crews, seasonal}, ...};
 *                                                // ref: another notebook plan's ledger ({city, depts}) sets the full charge (the ledger's plan switch)
 *   B.flyway(base, fly, depts)                   // what a flyway changes for the whole year: crews payroll and late costs, by department
 *   B.money(v), B.figure(st)                     // "$9.7M", "$160k"; "62% · $9.7M left"
 *   B.spentBy(st)                                // "Spent by December: $15.2M of $15.6M"
 *
 * Full charge = the recommended plan's expected 2025 spend (payroll plus expected overdue and backlog costs), split into the four
 * departments' shares. It drains with each month's payroll and that month's overdue costs ($20 late, $100 past 30 days, from the
 * engine's simulator) for the plan in view. What stays at December is the reserve the expected cost holds for busier years.
 */
(function (root) {
  "use strict";
  const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
  const NAMES = { PWDx: "Public Works", BTDT: "Transportation", PARK: "Parks", ISD: "Inspectional Services" };
  function loadPlan() {
    if (root.TerryPlan2025) return root.TerryPlan2025;
    try { const fs = require("fs"), path = require("path"), t = fs.readFileSync(path.join(__dirname, "plan2025.js"), "utf8"); return JSON.parse(t.slice(t.indexOf("=") + 1).trim().replace(/;\s*$/, "")); } catch (e) { return null; }
  }
  const money = v => { const a = Math.abs(v), s = v < 0 ? "−" : ""; return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : `${s}$${Math.round(a / 1e3)}k`; };
  const pctOf = f => Math.round(f * 100);

  function create(Z, p25) {
    p25 = p25 || loadPlan(); if (!Z || !p25) return null;
    const full = p25.city.cost, cap = {}, share = {};
    for (const x of p25.depts) { cap[x.dept] = x.cost; share[x.dept] = x.cost / full; }
    const monthsOf = (d, p) => Z.dept(d, p).months.map(m => ({ pay: m.payroll, late: m.trust_cost }));
    const through = (ms, t) => { let pay = 0, late = 0; for (let m = 0; m < 12; m++) { const w = Math.max(0, Math.min(1, t - m)); if (!w) break; pay += ms[m].pay * w; late += ms[m].late * w; } return { pay, late }; };
    function state(plan, t, ref) {
      t = Math.max(0, Math.min(12, t == null ? 12 : t));
      const F = ref && ref.city ? ref.city.cost : full, C = {}; DEPTS.forEach(d => { const x = ref && ref.depts && ref.depts.find(y => y.dept === d); C[d] = x ? x.cost : cap[d]; });
      const depts = DEPTS.map(d => { const s = through(monthsOf(d, plan[d]), t), spent = s.pay + s.late;
        return { dept: d, name: NAMES[d], cap: C[d], share: C[d] / F, pay: s.pay, late: s.late, spent, left: C[d] - spent, frac: (C[d] - spent) / C[d] }; });
      const spent = depts.reduce((a, x) => a + x.spent, 0), late = depts.reduce((a, x) => a + x.late, 0);
      return { full: F, t, depts, spent, late, left: F - spent, frac: (F - spent) / F };
    }
    function flyway(base, fly, depts, t) {
      const ds = (depts && depts.length ? depts : DEPTS).filter(d => base[d] && fly[d]);
      const by = ds.map(d => { const a = through(monthsOf(d, base[d]), t == null ? 12 : t), b = through(monthsOf(d, fly[d]), t == null ? 12 : t);
        return { dept: d, name: NAMES[d], crews: b.pay - a.pay, late: b.late - a.late }; }).filter(x => Math.abs(x.crews) >= 500 || Math.abs(x.late) >= 500);
      return { depts: by, crews: by.reduce((s, x) => s + x.crews, 0), late: by.reduce((s, x) => s + x.late, 0) };
    }
    // a plan's own budget against the recommended plan: each department's charge moves by what the plan spends more (or less) over
    // the year than the base plan (payroll and late costs), so a Flyway's battery carries its extra crews (owner 08:29)
    function refFor(plan, base) {
      const depts = DEPTS.map(d => { const a = through(monthsOf(d, plan[d]), 12), b = through(monthsOf(d, base[d]), 12); return { dept: d, cost: cap[d] + (a.pay + a.late) - (b.pay + b.late) }; });
      return { city: { cost: depts.reduce((s, x) => s + x.cost, 0) }, depts };
    }
    const figure = st => (st.left >= 0 ? `${pctOf(st.frac)}% · ${money(st.left)} left` : `${money(-st.left).replace("−", "")} over`);
    const spentBy = st => `Spent by December: ${money(st.spent)} of ${money(st.full)}`;   // a played plan held at December
    return { full, cap, share, depts: DEPTS, names: NAMES, insure: p25.insure ? p25.insure.extra_payroll : 0, state, flyway, refFor, money, figure, spentBy, pct: pctOf };
  }
  const api = { create, money, DEPTS, NAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TerryBudget = api;
})(typeof window !== "undefined" ? window : globalThis);
