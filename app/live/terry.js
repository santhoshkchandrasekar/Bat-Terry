/* Terry live: the GenAI layer over the browser engine, using the page's `sample` capability (the live model).
 *
 *   const T = TerryLive.create(E, sample)       // E = TerryEngine.create(data); sample = await terryHost.use("sample")
 *   await T.flip(goal, {signal, onStage})        -> {goal, target_department, inverted, predators[], dropped[], notes[]}
 *   await T.hunt(predator, mode, {signal, onTool}) -> {crews, seasonal, rationale, figures, trace[], decisions[]}
 *   await T.intake(message, {signal})            -> {rewrite, candidates[], choice}
 *   T.replay(dept)                               -> a saved run (when the live model is unavailable)
 *
 * Guardrails (same as the notebook): predator names must be the city's real request types and neighborhoods
 * (anything else is dropped and reported); numbers in Terry's sentence must come from the evidence; the hunt's
 * figures are recomputed by the engine for the plan the agent recommends.
 */
(function (root) {
  "use strict";
  const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
  const KINDS = ["miss", "silence", "shock", "capacity"];
  const pct = v => `${Math.round(v * 100)}%`;
  const money = v => Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3).toLocaleString("en-US")}k`;

  function create(E, sample) {
    const D = E.depts;
    const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
    const findIn = (list, s) => { if (!s) return null; const n = norm(s); return list.find(x => norm(x) === n) || null; };

    // ---------------------------------------------------------------- the flip
    const FLIP_RULES = `You are Terry, a planning assistant for Boston city departments. You think by inversion.
Given a manager's goal, you (1) rewrite it as a vivid first-person statement of failure dated 31 December 2025,
with one concrete detail from the evidence (a request type and a neighborhood), and (2) list the specific,
testable ways that failure would come about: the predators.

Rules for predators:
- 5 to 7 predators, most likely first. Stay inside the goal's department (for a city-wide goal, spread them across departments).
- Lead with the request types and type x neighborhood cells that carried the most 2024 late cost in the evidence.
  Then add hypotheses the evidence does not settle (a season, a neighborhood, a capacity squeeze), because the data
  will confirm or reject them and both outcomes are useful.
- Size matters: a request type citywide, or a type in one neighborhood over a 2-4 month season. Never one
  neighborhood in one month.
- Kinds: mostly "miss" (requests closed late) or "capacity" (crews short of demand in peak months);
  at most one "silence" (a neighborhood whose residents under-report) and at most one "shock" (weather or event spike).
- Use request_type and neighborhood names EXACTLY as they appear in the lists below, or null.
- Never invent numbers. Rejected predators are shown to the user, so be specific and falsifiable.

Scope rule for the failure statement: every figure in the evidence is a FULL-YEAR 2024 total. If you quote one, say it
is the 2024 figure (e.g. "just as in 2024, when 502 Sidewalk Repair requests in the South End went late"), and never
attach it to a single month or season.`;

    function readDept(goal) {
      let g = norm(goal);
      const hits = DEPTS.filter(d => g.includes(norm(D[d].name)) || g.includes(d.toLowerCase()));
      const alias = { PWDx: ["public works", "pothole", "trash", "streetlight", "street light", "sidewalk", "pwd "],
                      BTDT: ["transportation", "parking", "traffic", "btd "], PARK: ["parks", "park ", "tree"],
                      ISD: ["inspectional", "inspection", "housing", "rodent"] };
      g = " " + g + " ";
      if (hits.length === 1) return hits[0];
      const al = DEPTS.filter(d => alias[d].some(a => g.includes(a)));
      return al.length === 1 ? al[0] : null;
    }

    async function flip(goal, opts = {}) {
      const stage = opts.onStage || (() => {});
      let dept = readDept(goal);
      const types = dept ? E.TYPES[dept] : [...new Set(Object.values(E.TYPES).flat())].sort();
      const ev = E.evidence(dept);
      stage("flip");
      const prompt = `${FLIP_RULES}

Evidence:
${ev}

Departments: PWDx = Public Works, BTDT = Transportation, PARK = Parks & Recreation, ISD = Inspectional Services.
Allowed request types${dept ? " for " + dept : ""}: ${types.join("; ")}
Allowed neighborhoods: ${E.HOODS.join("; ")}

${opts.extraRules ? opts.extraRules + "\n\n" : ""}Goal: ${goal}

Reply with only JSON:
{"target_department": "PWDx"|"BTDT"|"PARK"|"ISD"|null, "inverted": string,
 "predators": [{"name": string, "department": "PWDx"|"BTDT"|"PARK"|"ISD", "request_type": string|null,
   "neighborhood": string|null, "months": [1-12...], "kind": "miss"|"capacity"|"silence"|"shock", "suspected_cause": string}]}`;
      let out = await sample.json(prompt, { signal: opts.signal, modelTier: "default" });
      if (!out || typeof out !== "object" || !Array.isArray(out.predators)) throw { code: "invalid_json", message: "Terry's answer had no predators." };
      if (!dept && DEPTS.includes(out.target_department)) dept = out.target_department;

      // guardrail: numbers in the failure statement must come from the evidence
      const notes = [];
      let inverted = String(out.inverted || "").trim();
      if (E.unverifiedNumbers(inverted, ev).length) {
        stage("fix");
        try {
          const fixed = await sample.json(`${prompt}\n\nYour previous failure statement was: "${inverted}"\nIt used numbers that are not in the evidence: ${E.unverifiedNumbers(inverted, ev).join(", ")}. Reply with only JSON {"inverted": string}, the same statement with those numbers removed or replaced by numbers from the evidence (as 2024 figures).`,
                                          { signal: opts.signal, modelTier: "quick" });
          if (fixed && fixed.inverted) inverted = String(fixed.inverted);
        } catch (e) { if (e && e.code === "cancelled") throw e; }
        if (E.unverifiedNumbers(inverted, ev).length) { inverted = inverted.replace(/\$?\d[\d,]*\.?\d*\s*%?/g, "many"); notes.push("Removed a figure Terry could not source."); }
      }

      // guardrail: real names only, the right department, sensible months
      const predators = [], dropped = [];
      for (const p of out.predators.slice(0, 8)) {
        const dep = DEPTS.includes(p.department) ? p.department : dept;
        if (!dep || (dept && dep !== dept)) { dropped.push({ name: p.name, why: "outside the goal's department" }); continue; }
        const rt = p.request_type ? findIn(E.TYPES[dep] || [], p.request_type) : null;
        if (p.request_type && !rt) { dropped.push({ name: p.name, why: `"${p.request_type}" is not one of ${D[dep].name}'s request types` }); continue; }
        const nb = p.neighborhood ? findIn(E.HOODS, p.neighborhood) : null;
        if (p.neighborhood && !nb) { dropped.push({ name: p.name, why: `"${p.neighborhood}" is not a Boston neighborhood in the data` }); continue; }
        const months = (Array.isArray(p.months) ? p.months : []).map(Number).filter(m => m >= 1 && m <= 12);
        const h = { name: String(p.name || "Unnamed predator"), department: dep, request_type: rt, neighborhood: nb, months,
                    kind: KINDS.includes(p.kind) ? p.kind : "miss", suspected_cause: String(p.suspected_cause || "") };
        predators.push({ hypothesis: h, evidence: E.echo(h) });
      }
      stage("done");
      return { goal, target_department: dept, inverted, predators, dropped, notes };
    }

    // ---------------------------------------------------------------- the hunt (agent with page tools)
    function planFor(dept, mode) { const p = E.data.plans[dept][mode]; return { crews: p.crews.slice(), seasonal: p.seasonal.slice() }; }
    function summary(r) {
      return { ontime_rate: +r.ontime_rate.toFixed(3), overdue: Math.round(r.overdue), backlog_end: Math.round(r.backlog_end),
               crew_cost: Math.round(r.crew_cost), overdue_cost: Math.round(r.overdue_cost), backlog_cost: Math.round(r.backlog_cost),
               total_cost: Math.round(r.total_cost), crews_by_month: r.crews, seasonal_by_month: r.seasonal, crew_schedule: E.scheduleText(r.crews, r.seasonal) };
    }
    function cleanPlan(dept, crews, seasonal) {
      let c = (Array.isArray(crews) ? crews : []).map(v => Math.max(0, Math.round(Number(v) || 0)));
      if (c.length !== 12) throw new Error("crews_by_month must have 12 values");
      c[0] = D[dept].start;
      let s = (Array.isArray(seasonal) ? seasonal : new Array(12).fill(0)).map(v => Math.max(0, Math.round(Number(v) || 0)));
      if (s.length !== 12) s = new Array(12).fill(0);
      if (dept !== "PARK") s = new Array(12).fill(0);
      [0, 1, 2, 10, 11].forEach(i => { s[i] = 0; });
      return [c, s];
    }
    function tools(dept, onTool) {
      const mark = (name, input, result) => { onTool && onTool({ tool: name, input, result }); return result; };
      const depSchema = { department: { type: "string", enum: DEPTS } };
      return [
        { name: "do_nothing", description: "Baseline: keep January 2025 crews all year. Returns on-time rate, overdue counts and costs for 2025 at forecast demand.",
          inputSchema: { type: "object", properties: depSchema, required: ["department"] },
          execute: (i) => mark("do_nothing", i, summary(E.simulate(String(i.department || dept), E.flat(String(i.department || dept)), null))) },
        { name: "optimize_plan", description: "Best 2025 crew plan for a department, planned against forecast error (demand x0.86/1.00/1.14). mode: passive (cheapest), neutral (>= 90% on time at every planning level), aggressive (>= 95%, and >= 90% at +20%). Returns the plan and its result at forecast demand.",
          inputSchema: { type: "object", properties: { ...depSchema, mode: { type: "string", enum: ["passive", "neutral", "aggressive"] } }, required: ["department"] },
          execute: (i) => { const d = String(i.department || dept), m = ["passive", "neutral", "aggressive"].includes(i.mode) ? i.mode : "neutral";
                            const p = planFor(d, m); return mark("optimize_plan", i, { mode: m, ...summary(E.simulate(d, p.crews, p.seasonal)) }); } },
        { name: "simulate_plan", description: "Simulate 2025 for a department with a given crew plan (12 monthly crew counts; January is fixed at the crews on hand). demand_mult scales the whole forecast (1.14 = 14% over). Returns on-time rate, overdue counts and costs.",
          inputSchema: { type: "object", properties: { ...depSchema, crews_by_month: { type: "array", items: { type: "integer" } },
                         seasonal_by_month: { type: "array", items: { type: "integer" } }, demand_mult: { type: "number" } }, required: ["department", "crews_by_month"] },
          execute: (i) => { const d = String(i.department || dept); const [c, s] = cleanPlan(d, i.crews_by_month, i.seasonal_by_month);
                            const m = Math.min(Math.max(Number(i.demand_mult) || 1, 0.5), 2);
                            return mark("simulate_plan", i, { demand_mult: m, ...summary(E.simulate(d, c, s, { mult: m })) }); } },
        { name: "break_point", description: "Smallest uniform demand increase (in %) at which a plan's on-time rate falls below 90%. Pass the plan's 12 monthly crew counts.",
          inputSchema: { type: "object", properties: { ...depSchema, crews_by_month: { type: "array", items: { type: "integer" } },
                         seasonal_by_month: { type: "array", items: { type: "integer" } } }, required: ["department", "crews_by_month"] },
          execute: (i) => { const d = String(i.department || dept); const [c, s] = cleanPlan(d, i.crews_by_month, i.seasonal_by_month);
                            if (!c.slice(1).some(Boolean)) throw new Error("pass the plan's crew counts, not zeros");
                            const bp = E.breakPoint(d, c, s); return mark("break_point", i, { break_pct: bp, note: bp === null ? "holds beyond +60%" : undefined }); } },
      ];
    }
    const HUNT_RULES = `You are Terry's hunting module. For the predator described, work out the crew plan that deals with it, using the tools.
Always, in this order, one tool at a time:
1. Call do_nothing for the department (baseline: January crews all year).
2. Call optimize_plan in the requested mode. That plan is already built to survive forecast error.
3. Call simulate_plan on that plan with demand_mult 1.14, to see how it holds if demand runs 14% hot.
4. Call break_point on that plan.
You may simulate one or two variants. Recommend the optimize_plan result unless a variant you simulated is cheaper AND holds at
least the same on-time rate at demand_mult 1.14.
Finally reply with only JSON: {"recommended_crews_by_month": [12 integers], "seasonal_by_month": [12 integers],
"why": "one plain sentence for the department manager on why this plan answers the predator, with no numbers"}`;

    async function hunt(pred, mode = "neutral", opts = {}) {
      const h = pred.hypothesis, dept = h.department, trace = [];
      const onTool = (s) => { trace.push(s); opts.onTool && opts.onTool(s); };
      const prompt = `${HUNT_RULES}

Predator: ${h.name}
Department: ${dept} (${D[dept].name})
Request type: ${h.request_type || "all"} | Neighborhood: ${h.neighborhood || "citywide"} | Months: ${h.months.length ? h.months.join(", ") : "all year"}
Evidence: ${pred.evidence.detail}
Mode: ${mode}`;
      const out = await sample.json(prompt, { signal: opts.signal, tools: tools(dept, onTool), modelTier: "default" });
      let crews, seasonal, agentPicked = true;
      try { [crews, seasonal] = cleanPlan(dept, out && out.recommended_crews_by_month, out && out.seasonal_by_month); }
      catch { const p = planFor(dept, mode); crews = p.crews; seasonal = p.seasonal; agentPicked = false; }
      // Figures are recomputed here for the plan the agent picked: exact by construction.
      const base = E.simulate(dept, E.flat(dept), null), plan = E.simulate(dept, crews, seasonal);
      const hot = E.simulate(dept, crews, seasonal, { mult: 1.14 }), bp = E.breakPoint(dept, crews, seasonal);
      const why = String(out && out.why || "").replace(/\$?\d[\d,]*\.?\d*\s*%?/g, "").trim();
      const figures = { baseline_cost: base.total_cost, baseline_ontime: base.ontime_rate, plan_cost: plan.total_cost,
                        plan_ontime: plan.ontime_rate, ontime_plus14: hot.ontime_rate, break_pct: bp };
      const rationale = [
        `Crews: ${E.scheduleText(crews, seasonal)}, from ${D[dept].start} on hand in January.`,
        `At forecast demand it costs ${money(plan.total_cost)} against ${money(base.total_cost)} if January's crews stay all year, and closes ${pct(plan.ontime_rate)} of requests on time against ${pct(base.ontime_rate)}.`,
        `If demand runs 14% over forecast it still closes ${pct(hot.ontime_rate)} on time; ` +
          (bp === null ? "it stays above 90% even at 60% over forecast." : `on-time falls below 90% once demand is ${bp}% over forecast.`),
      ];
      return { dept, mode, crews, seasonal, why, rationale, figures, trace, agentPicked, decisions: E.decisions(dept, crews, seasonal) };
    }

    // ---------------------------------------------------------------- the intake assistant
    async function intake(message, opts = {}) {
      const rw = await sample.json(`Rewrite a resident's 311 message as a short plain-English statement of the problem to fix.
Translate if it is not in English. Drop greetings, addresses, venting and irrelevant detail. Say what is wrong with what
(e.g. "streetlight not working", "car parked during street cleaning", "car not moved in weeks, may be abandoned").
Reply with only JSON {"problem": string (5-15 words), "problem_is_stated": boolean (false if it only names a thing,
asks a policy question, or could be private vs public in a way that changes who handles it)}.

Message: """${message}"""`, { signal: opts.signal, modelTier: "quick" });
      const problem = String(rw && rw.problem || "");
      const cands = E.retrieve(message, problem, 20);
      const list = cands.map(c => `- type: ${c.type} | department: ${c.dept} | queue: ${c.queue} | used ${c.count.toLocaleString("en-US")} times in 2023-24 | means: ${c.desc}`).join("\n");
      const ch = await sample.json(`You are the Boston 311 intake assistant. Pick the single best request type for the resident's message from
the candidates (the city's real routing targets, retrieved for this message). Copy type, department and queue exactly.
If the message could reasonably be two different candidates, or lacks a detail that changes the routing (whether a tree is
on a street or in a park; whether trash was missed or is improperly stored), set type to null and ask ONE short follow-up
question. A vague message that names only a thing (a tree, a sign, trash) without what is wrong needs a follow-up. When two
candidates both fit, prefer the common one unless the message is specific to the rare one. Praise or policy comments with
no problem to fix go to "General Comments For a Program or Policy" if it is a candidate.

Message: """${message}"""
Plain-English problem: ${problem} | Problem clearly stated: ${!!(rw && rw.problem_is_stated)}

Candidates:
${list}

Reply with only JSON {"type": string|null, "department": string|null, "queue": string|null, "confidence": number 0-1,
"follow_up": string|null, "reasoning": string (one sentence)}`, { signal: opts.signal, modelTier: "quick" });
      let choice = ch || {};
      const hit = choice.type ? cands.find(c => norm(c.type) === norm(choice.type)) : null;
      if (choice.type && !hit) choice = { ...choice, type: null, department: null, queue: null, follow_up: choice.follow_up || "Could you say a little more about the problem?" };
      else if (hit) choice = { ...choice, type: hit.type, department: hit.dept, queue: hit.queue, queue_share: hit.queue_share };
      return { rewrite: problem, problem_is_stated: !!(rw && rw.problem_is_stated), candidates: cands, choice };
    }

    // ---------------------------------------------------------------- replay (no live model)
    function replay(dept) {
      const r = E.data.showcase.find(x => x.dept === dept);
      if (!r) return null;
      return { goal: r.goal, target_department: dept, inverted: r.inverted, replay: true,
               predators: r.predators.map(p => ({ hypothesis: p.hypothesis, evidence: E.echo(p.hypothesis) })), dropped: [], notes: [] };
    }

    return { flip, hunt, intake, replay, readDept, money, pct };
  }

  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TerryLive = api;
})(typeof window !== "undefined" ? window : globalThis);
