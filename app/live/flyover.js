/* Flyover: the 2025 crew plan as a year you can watch, question and attack.
 *
 *   const F = TerryFlyover.create(E, T, sample)   // sample may be null (no live model: rule-based parsing)
 *   F.year(events)                 -> the neutral plan for all four departments, with daily series, cash and penalty costs
 *   await F.chat(message)          -> {kind:"question"|"ready"|"ping"|"note", text, options?, goal?}
 *   await F.flip(goal)             -> {inverted, history_line, predators[] (placed on the timeline), dropped[], replay}
 *   await F.escape(goal)           -> {verdict, dusk, depts{stay, escape}, totals, beats{stay, escape}, why}
 *   await F.ping(message)          -> {event, label, source, stay, respond, prepare, beats, verdict} or a follow-up question
 *
 * Every figure Terry shows is computed here by the engine; the model only parses what you type and words one sentence
 * with no numbers. Event sizes come from real spikes in the data (src/09_event_analogues.py), never from the model.
 */
(function (root) {
  "use strict";
  const DEPTS = ["PWDx", "BTDT", "PARK", "ISD"];
  const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const SEASONS = { winter: [1, 2, 12], spring: [3, 4, 5], summer: [6, 7, 8], fall: [9, 10, 11], autumn: [9, 10, 11] };
  const pct = v => `${Math.round(v * 100)}%`;
  const pct1 = v => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
  const pctVs = (v, target) => { const r = Math.round(v * 1000) / 1000; return v < target && r >= target ? `${(Math.floor(v * 10000) / 100).toFixed(2)}%` : pct1(v); };
  const money = v => { const a = Math.abs(v); return a >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(v / 1e3).toLocaleString("en-US")}k` : `$${Math.round(v)}`; };
  const int = v => Math.round(v).toLocaleString("en-US");
  const NUMS = /\$?\d[\d,]*\.?\d*\s*%?/g;

  function create(E, T, sample, cfg = {}) {
    const D = E.depts, MON = E.MON;
        const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
    const dname = d => (d === "CITY" ? "the city" : D[d].name), poss = n => n + (/s$/.test(n) ? "'" : "'s");
    const ANALOG = Object.fromEntries((E.data.analogues || []).map(a => [a.kind, a]));
    const plan = d => { const p = E.data.plans[d].neutral; return { crews: p.crews.slice(), seasonal: p.seasonal.slice() }; };
    const MONF = MONTH_NAMES.map(m => m[0].toUpperCase() + m.slice(1));
    const monthsText = ms => {
      if (!ms.length || ms.length === 12) return "2025";
      const s = [...ms].sort((a, b) => a - b), contiguous = s.every((m, i) => !i || m === s[i - 1] + 1);
      if (s.length === 1) return `${MONF[s[0] - 1]} 2025`;
      return contiguous ? `${MONF[s[0] - 1]} to ${MONF[s[s.length - 1] - 1]} 2025` : s.map(m => MONF[m - 1]).join(", ") + " 2025";
    };
    const startsText = m => (m <= 12 ? MONF[m - 1] : `${MONF[m - 13]} 2026`);

    // ---------------------------------------------------------------- the year (Flyover's resting state)
    function runDept(d, p, events, mult = 1, daily = true) {
      const ev = E.eventArrays(d, events);
      return E.simulate(d, p.crews, p.seasonal, { mult, daily, dayMult: ev.dayMult, capMult: ev.capMult });
    }
    function monthRows(r) {
      return r.monthly.map(m => ({ crews: m.crews, seasonal: m.seasonal, demand: m.demand, payroll: m.crew_cost, penalty: m.overdue_cost,
                                    ontime: m.closed_targeted > 0 ? Math.max(0, 1 - m.overdue / m.closed_targeted) : 1, backlog: m.backlog_eom }));
    }
    function year(events = [], plans = null) {
      const depts = {};
      let payroll = 0, penalty = 0;
      for (const d of DEPTS) {
        const p = plans && plans[d] ? plans[d] : plan(d), r = runDept(d, p, events);
        depts[d] = { name: D[d].name, plan: p, months: monthRows(r), daily: r.daily, ontime: r.ontime_rate,
                     payroll: r.crew_cost, penalty: r.overdue_cost + r.backlog_cost, decisions: E.decisions(d, p.crews, p.seasonal) };
        payroll += r.crew_cost; penalty += r.overdue_cost + r.backlog_cost;
      }
      return { depts, payroll, penalty, total: payroll + penalty };
    }

    // ---------------------------------------------------------------- reading a goal
    function findHood(text) {
      const t = " " + norm(text) + " ";
      let best = null;
      for (const h of E.HOODS) {
        const parts = h.split("/").map(x => norm(x)).filter(Boolean);
        for (const p of parts) if (p && t.includes(" " + p + " ") && (!best || p.length > best[1])) best = [h, p.length];
      }
      return best ? best[0] : null;
    }
    function findMonths(text) {
      const t = norm(text), out = new Set();
      const mi = w => { const i = MONTH_NAMES.findIndex(m => w === m || w === m.slice(0, 3) || (w.length >= 3 && m.startsWith(w))); return i < 0 ? null : i + 1; };
      // a range: "February to April", "between Feb and Apr", "Feb through Apr", "Feb-Apr" (all the months in between)
      const MW = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";
      const rg = t.match(new RegExp(`\\b${MW}\\s+(?:to|through|thru|until|till|and)\\s+${MW}\\b`)) || String(text).toLowerCase().match(new RegExp(`\\b${MW}\\s*[-\u2013]\\s*${MW}\\b`));
      if (rg) { const a = mi(rg[1]), b = mi(rg[2]); if (a && b) { for (let m = a; m !== b; m = m % 12 + 1) out.add(m); out.add(b); return [...out].sort((x, y) => x - y); } }
      const q = t.match(/\bq([1-4])\b|\b(first|second|third|fourth) quarter\b/);
      if (q) { const n = q[1] ? +q[1] : ["first", "second", "third", "fourth"].indexOf(q[2]) + 1; return [3 * n - 2, 3 * n - 1, 3 * n]; }
      MONTH_NAMES.forEach((m, i) => { if (new RegExp(`\\b(${m}|${m.slice(0, 3)})\\b`).test(t)) out.add(i + 1); });
      for (const [k, v] of Object.entries(SEASONS)) if (new RegExp(`\\b${k}\\b`).test(t)) v.forEach(m => out.add(m));
      if (!out.size && /\b(year|2025|annual|all year|whole year)\b/.test(t)) for (let m = 1; m <= 12; m++) out.add(m);
      return [...out].sort((a, b) => a - b);
    }
    function findTarget(text) {
      const m = String(text).match(/(\d{1,3}(?:\.\d)?)\s*(?:%|percent\b|per cent\b)/i);
      // an on-time goal under 40% is not a service goal ("cut costs by 10%"): leave it unset so Terry asks
      if (m) { const v = Number(m[1]) / 100; return v < 0.4 ? null : Math.min(1, v); }
      if (/\b(all|every|each|100)\b/.test(norm(text)) && /\bon time\b/.test(norm(text))) return 1;
      if (/\b(all|every)\b/.test(norm(text)) && /\b(close|closed|closes|closing|resolve|resolved|cleared|handled)\b/.test(norm(text))) return 1;   // "close all requests" (owner 7 Nov)
      return null;
    }
    function findScope(text) {
      const d = T.readDept(text);
      if (d) return d;
      const t = norm(text);
      if (/\b(city|citywide|city wide|whole city|all departments|every department|four departments|boston s|boston|every request|all requests)\b/.test(t)) return "CITY";
      return null;
    }
    const state = { draft: {}, asked: 0, goal: null, events: [], lastPing: null, predators: null };

    async function parseWithModel(message, mode) {
      const hist = state.goal ? `Current goal: ${goalText(state.goal)}` : `Goal so far: ${JSON.stringify(state.draft)}`;
      const prompt = `You read messages for Terry, a planning assistant for four Boston 311 departments: PWDx Public Works (potholes,
trash, streetlights, sidewalks, snow), BTDT Transportation (parking enforcement, signals, signs), PARK Parks & Recreation (trees,
parks), ISD Inspectional Services (housing, buildings, rodents, health). The plan year is 2025.
${hist}
Neighborhoods: ${E.HOODS.join("; ")}

Classify the message. "goal": the user states or refines a service goal (what should close on time, where, when, how high).
"ping": a what-if event (weather, spike, crews quitting, a hiring freeze, anything that could happen). "other": anything else.
For a goal, fill only what the message (or the goal so far) says; use null when not stated. department "CITY" means all four.
For a ping, map the event to the closest kind: snowstorm, windstorm (wind, rain, trees down), deep_freeze (extreme cold, no heat,
frozen pipes), move_in (student move-in or move-out, moving day), heat_wave, demand_surge (any other jump in requests),
crew_loss (crews quit, sick, strike: capacity lost), hiring_freeze (no new hires), or unsupported (cannot affect 311 crews, or is
not something the simulator can represent). Dates: ISO in 2025 if stated, else null. Never invent a size: percent only if the
user gave one.

Message: """${message}"""

Reply with only JSON: {"intent": "goal"|"ping"|"other",
 "goal": {"department": "PWDx"|"BTDT"|"PARK"|"ISD"|"CITY"|null, "neighborhood": string|null, "months": [1-12...], "target_pct": number|null},
 "ping": {"kind": string, "start_date": string|null, "days": number|null, "departments": [string...], "neighborhood": string|null,
          "user_pct": number|null},
 "reply": "one short sentence in Terry's voice, no numbers"}`;
      return sample.json(prompt, { modelTier: "quick", cache: false });
    }

    function mergeGoal(parsed, message) {
      const g = state.draft;
      const scope = findScope(message), hood = findHood(message), months = findMonths(message), target = findTarget(message);
      const pg = parsed && parsed.goal || {};
      const pd = [...DEPTS, "CITY"].includes(pg.department) ? pg.department : null;
      g.scope = scope || pd || g.scope || null;
      const ph = pg.neighborhood ? E.HOODS.find(h => norm(h) === norm(pg.neighborhood)) || findHood(pg.neighborhood) : null;
      if (hood || ph) g.hood = hood || ph;
      const pm = Array.isArray(pg.months) ? pg.months.map(Number).filter(m => m >= 1 && m <= 12) : [];
      if (months.length) g.months = months; else if (pm.length) g.months = [...new Set(pm)].sort((a, b) => a - b);
      const pt = Number(pg.target_pct);
      if (target !== null) g.target = target; else if (pt >= 40 && pt <= 100) g.target = pt / 100;
      g.text = g.text ? g.text + " " + message : message;
    }
    function history2024(scope, months, hood) {
      const ds = scope === "CITY" ? DEPTS : [scope];
      let n = 0, late = 0;
      for (const d of ds) { const c = E.cell(d, null, hood || null, months.length === 12 ? null : months); n += c.n; late += c.late; }
      return n ? { n, late, ontime: 1 - late / n } : null;
    }
    // the 2023 record for the same window (department x month only: no neighborhood split for 2023)
    function history2023(scope, months, hood) {
      const H = E.data.hist_2023; if (!H || hood) return null;
      const ds = scope === "CITY" ? DEPTS : [scope]; let n = 0, late = 0;
      for (const d of ds) for (const m of (months && months.length ? months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) { const c = H[d] && H[d][m - 1]; if (c) { n += c[0]; late += c[1]; } }
      return n ? { n, late, ontime: 1 - late / n } : null;
    }
    function nextQuestion() {
      const g = state.draft;
      if (!g.scope) return { text: "Which department is this for? Or the whole city?", options: ["Public Works", "Transportation", "Parks", "Inspectional Services", "The whole city"] };
      if (!g.months || !g.months.length) return { text: "When should it hold? A month, a season, or all of 2025?", options: ["November", "Summer", "All of 2025"] };
      const h = history2024(g.scope, g.months, g.hood);
      const where = g.hood ? ` in ${g.hood}` : "";
      if (g.target === undefined || g.target === null) {
        const opts = ["90%", "95%"];
        return { text: `How high should on-time go? In ${monthsText(g.months).replace(" 2025", "")} 2024, ${h ? pct(h.ontime) : "an unknown share"} of ${poss(dname(g.scope))} requests${where} closed on time.`, options: opts };
      }
      if (g.target >= 0.985 && !g.targetConfirmed) {
        const best = bestMonth2024();
        return { text: `No department kept 100% in 2024 (best: ${best.dept.replace(/ & .*/, "")}, ${best.month}, ${pct(best.ontime)}). Aim for 95%, or keep 100%?`,
                 options: ["95%", "Keep 100%"], suggest: 0.95, insist: true };
      }
      return null;
    }
    function bestMonth2024() {
      let best = { ontime: 0 };
      for (const d of DEPTS) for (let m = 1; m <= 12; m++) { const c = E.cell(d, null, null, [m]); if (c.n > 500 && 1 - c.late / c.n > best.ontime) best = { dept: D[d].name, month: MONF[m - 1], ontime: 1 - c.late / c.n }; }
      return best;
    }
    function goalText(g) {
      const where = g.hood ? ` in ${g.hood}` : "";
      if (g.scope === "CITY") return `Every department closes at least ${pct(g.target)} of its requests${where} on time in ${monthsText(g.months)}.`;
      if (g.target >= 0.995) return `Every ${D[g.scope].name} request${where} closes on time in ${monthsText(g.months)}.`;
      return `At least ${pct(g.target)} of ${D[g.scope].name} requests${where} close on time in ${monthsText(g.months)}.`;
    }

    // owner 7 Nov: one sentence can hold a goal and a what-if ("30% of crews quit Public Works by March and close all requests in
    // December"). The goal part is chased; the what-if part is kept, with its own month, and handed back as `then` so the page plays
    // it in Ping once the chase is done. Returns null when the sentence is only one of the two.
    function splitCompound(msg) {
      const parts = String(msg).split(/\s*(?:[;,]|\band then\b|\bthen\b|\band\b|\bbut\b|\bwhile\b|\bafter\b)\s+/i).map(x => x.trim()).filter(Boolean);
      if (parts.length < 2) return null;
      const ev = parts.filter(c => kindOf(c)), gl = parts.filter(c => !kindOf(c));
      if (!ev.length || !gl.length) return null;
      let goal = gl.join(" "), then = ev.join(" and ");
      const gn = norm(goal);
      if (!(findMonths(goal).length || findTarget(goal) !== null) || !(findTarget(goal) !== null || /\b(on time|close|closed|closes|resolve|resolved|requests?|tickets?|cases?)\b/.test(gn))) return null;
      // a department named only in the what-if part still owns the goal ("all requests" alone would read as the whole city)
      const gd = T.readDept(goal), ed = T.readDept(then), sc = gd || ed || findScope(goal) || findScope(msg);
      if (!gd && sc) goal += sc === "CITY" ? " for the whole city" : ` for ${D[sc].name}`;
      if (!dateIn(then)) { const ms = findMonths(then); if (ms.length) then = then.replace(new RegExp(`\\b(?:by|in|from|starting|during)?\\s*(${MONTH_NAMES.join("|")}|${MONTH_NAMES.map(x => x.slice(0, 3)).join("|")})\\b`, "i"), ` on ${MONF[ms[0] - 1]} 1`).replace(/\s+/g, " ").trim(); }
      if (sc && sc !== "CITY" && !(T.readDept && T.readDept(then))) then += ` in ${D[sc].name}`;
      return { goal, then };
    }
    async function chat(message) {
      message = String(message || "").trim();
      if (!message) return { kind: "note", text: "Tell me a goal, like: every Transportation request in Dorchester on time in November." };
      { const sp = splitCompound(message); if (sp) { state.then = sp.then; message = sp.goal; } else if (findScope(message) && !state.asked) state.then = null; }
      let parsed = null;
      if (sample) { try { parsed = await parseWithModel(message); } catch (e) { if (e && e.code === "not_granted") sample = null; parsed = null; } }
      const looksPing = /^\s*(what if|what happens if|suppose|imagine|if )/i.test(message) || /\b(storm|snow|blizzard|heat|freeze|quit|strike|sick|move.?in|surge|spike)\b/i.test(message);
      const intent = parsed && parsed.intent ? parsed.intent : (state.goal && looksPing ? "ping" : "goal");
      if (intent === "ping" && state.goal) return ping(message, parsed);
      if (intent === "ping" && !state.goal) return { kind: "note", text: "Set a goal first, then ping me with anything that could go wrong." };
      // goal: a short answer like "95%" or "November" fills a blank in the draft
      if (state.goal && !findScope(message) && !findMonths(message).length && findTarget(message) === null && !findHood(message) && intent !== "goal")
        return { kind: "note", text: parsed && parsed.reply ? String(parsed.reply).replace(NUMS, "").trim() : "I plan crews. Give me a goal or a what-if." };
      if (state.goal) {
        const fresh = findScope(message) || (parsed && parsed.goal && parsed.goal.department);
        state.draft = fresh ? {} : { ...state.goal, targetConfirmed: false };
        state.goal = null; state.asked = 0;
      }
      const nt = norm(message);
      if (!findScope(message) && /\b(water|sewer|bwsc|police|fire|ems|schools?|library|libraries|mbta|311 call center)\b/.test(nt))
        return { kind: "note", text: "Terry plans crews for four departments: Public Works, Transportation, Parks and Inspectional Services. Pick one of those, or the whole city." };
      if (/\b(cost|costs|budget|spend|spending|cheaper|save|savings)\b/.test(nt) && !/\bon time\b/.test(nt) && findTarget(message) === null)
        return { kind: "note", text: "Terry plans on-time goals, and prices each one. Try: at least 90% of Transportation requests on time in November." };
      const yr = String(message).match(/\b(20\d\d)\b/);
      if (yr && yr[1] !== "2025") state.draft.yearNote = `The plan year is 2025, so Terry reads ${yr[1]} as 2025.`;
      if (state.lastSuggest && (/\bkeep\b/i.test(message) || (findTarget(message) ?? 0) >= 0.985)) state.draft.targetConfirmed = true;
      // nothing Terry can read, and nothing drafted yet: show what a goal looks like rather than asking about a department
      const blank = !Object.keys(state.draft).some(k => state.draft[k] != null && k !== "text" && k !== "yearNote");
      if (blank && !findScope(message) && !findMonths(message).length && findTarget(message) === null && !findHood(message) && !(parsed && parsed.intent === "goal"))
        return { kind: "note", text: "Tell me a goal, like: every Transportation request in Dorchester on time in November." };
      mergeGoal(parsed, message);
      const q = state.asked < 4 ? nextQuestion() : null;
      if (q) { state.asked++; state.lastSuggest = q.suggest || null; if (state.draft.yearNote) { q.text = state.draft.yearNote + " " + q.text; delete state.draft.yearNote; } return { kind: "question", ...q }; }
      const g = state.draft;
      if (!g.scope) g.scope = "CITY";
      if (!g.months || !g.months.length) g.months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      if (g.target == null) g.target = 0.90;
      state.goal = { scope: g.scope, hood: g.hood || null, months: g.months, target: g.target }; state.predators = null;
      state.draft = {}; state.asked = 0; state.lastSuggest = null;
      const then = state.then || null; state.then = null;
      return { kind: "ready", goal: state.goal, text: goalText(state.goal), then };
    }
    // preds: the predators heard for this goal (a restored Roost passes its own), so later what-ifs fly the same storms
    function setGoal(goal, preds) { state.goal = { ...goal }; state.draft = {}; state.asked = 0; state.predators = preds || null; return goalText(state.goal); }

    // ---------------------------------------------------------------- the failure line: one writer, three cases, every figure from the data
    function failLine(fl, X, goal) {
      const h = fl && fl.history, tg = Math.round(goal.target * 100), city = goal.scope === "CITY", dept = dname(goal.scope);
      const mt = monthsText(goal.months), win = mt === "2025" ? "2025" : mt.replace(/ 2025$/, ""), Win = win === "2025" ? "The year" : win[0].toUpperCase() + win.slice(1);
      const inWin = win === "2025" ? "in 2025" : "in " + win;
      const b = (v, bad) => `<b${bad ? ' class="fs"' : ""}>${v}</b>`;
      // a city goal is "every department": its measure is the weakest department, not the city's blend (audit, owner 21:16)
      const worst = k => { if (!city || !X || !X.depts) return null; let w = null; for (const d of DEPTS) { const x = X.depts[d] && X.depts[d][k]; if (x && (w === null || x.window < w.v)) w = { d, v: x.window }; } return w; };
      const wsS = worst("stay"), wsE = worst("escape");
      const wS = X ? (wsS ? wsS.v : X.totals.stay.window) : null, wE = X ? (wsE ? wsE.v : X.totals.escape.window) : null;
      const who = city && wsS ? dname(wsS.d) : dept;
      const stayW = X ? pct1(wS) : "", escW = X ? pct1(wE) : "";
      // the two years of record, in words: when they disagree the card says so (2024, the nearer year, leads) (owner 21:29)
      const y23 = fl && fl.history2023, made24 = h ? h.ontime >= goal.target : null, made23 = y23 ? y23.ontime >= goal.target : null;
      const recWords = () => made24 === null ? "" : made23 === null || made23 === made24 ? (made24 ? (y23 ? "Both years made it" : "2024 made it") : (y23 ? "Both years missed it" : "2024 missed it"))
        : made24 ? "2024 made it, though 2023 missed it" : "2024 missed it, though 2023 made it";
      const above = (v, t) => (t >= 100 ? "at 100%" : "above " + t + "%");
      const h23 = fl && fl.history2023, p24 = h ? `${h23 ? `2023: ${pct(h23.ontime)}, ` : ""}2024: ${pct(h.ontime)} on time. ` : "";
      const late = h ? Math.max(0, h.n - Math.round(h.ontime * h.n)) : 0;
      const hot = X && X.hot_pct > 0 ? X.hot_pct : null;
      let c = "missed", line, facts, html;
      if (X && hot) {
        c = "hot";
        line = `It is 31 December 2025. ${Win} ran ${hot}% busier than forecast and I let ${who} slip to ${stayW}, under my ${tg}%.`;
        html = `It is 31 December 2025. ${Win} ran ${b(hot + "%")} busier than forecast and I let ${esc(who)} slip to ${b(stayW, 1)}, under my ${b(tg + "%")}.`;
        facts = `${p24}At forecast the plan clears ${tg}%; it breaks only if demand runs ${hot}% over. With the flyway's crews it ${wE >= goal.target ? "holds " + escW + " there, which clears the goal" : "reaches only " + escW + " there, still under " + tg + "%"}.`;
      } else if (X && X.safe_at_forecast && X.verdict === "already") {
        c = "safe";
        const who2 = city ? "every department" : dept;
        const inModel = (h && h.ontime < goal.target) || goal.scope === "ISD" || goal.scope === "PARK" ? " in the model" : "";   // the record says otherwise, or the model is gentle here
        line = `It is 31 December 2025 and I could not find a way to fail${inModel}: even with 60% more requests than forecast, ${who2} stays ${above(0, tg)} ${inWin}.`;
        html = `It is 31 December 2025 and I could not find a way to fail${inModel}: even with ${b("60%")} more requests than forecast, ${esc(who2)} stays ${tg >= 100 ? "at " + b("100%") : "above " + b(tg + "%")} ${inWin}.`;
        const missed24 = h && h.ontime < goal.target, gentle = goal.scope === "ISD" || goal.scope === "PARK";
        facts = missed24
          ? `${p24}${recWords()}. ${made23 !== null && made23 !== made24 ? "In the model" : "In the model, though"}, this plan clears ${tg}% at forecast and at every demand rise up to +60%.${gentle ? ` The model is gentler on ${dept} than 2024 was (its long due dates), so read this as the plan's best case.` : ""}`
          : `${p24}The plan clears ${tg}% at forecast and at every demand rise up to +60%. No crew change needed.`;
      } else if (X && wS < goal.target) {
        // the plan as forecast misses: the headline is the model's 2025 result, never 2024's counts (audit, owner 21:16)
        c = "short";
        const rec = h ? (made24 ? `${recWords()}; this plan as forecast does not. ` : `${recWords()} too. `.replace(", though 2023 made it too.", " too, though 2023 made it.")) : "";
        line = `It is 31 December 2025. With the plan as forecast I left ${who} at ${stayW} on time ${inWin}, under my ${tg}%.`;
        html = `It is 31 December 2025. With the plan as forecast I left ${esc(who)} at ${b(stayW, 1)} on time ${inWin}, under my ${b(tg + "%")}.`;
        facts = `${p24}${rec}The flyway reaches ${escW}${wE < goal.target ? "; no crew plan gets there." : ", which clears the goal."}`;
      } else if (X) {
        // the plan clears the goal at forecast and no stress was found that breaks it within the tested range
        c = "holds";
        line = `It is 31 December 2025 and the plan held ${city ? "every department" : dept} at ${stayW} or better on time ${inWin}, above my ${tg}%.`.replace(" or better", city ? " or better" : "");
        html = `It is 31 December 2025 and the plan held ${esc(city ? "every department" : dept)} at ${b(stayW)}${city ? " or better" : ""} on time ${inWin}, above my ${b(tg + "%")}.`;
        facts = `${p24}${h && h.ontime < goal.target ? `${recWords()}; the plan's crews close the gap in the model. ` : ""}The flyway reaches ${escW}.`;
      } else if (h && h.ontime < goal.target) {
        // no plan result to show (the escape did not run): say only what the record says, dated 2024
        c = "record";
        const y24 = inWin.replace("2025", "2024");
        line = `In 2024 ${dept} closed ${int(late)} of ${int(h.n)} requests late ${y24}, short of ${tg}%.`;
        html = `In 2024 ${esc(dept)} closed ${b(int(late), 1)} of ${b(int(h.n))} requests late ${y24}, short of ${b(tg + "%")}.`;
        facts = p24.trim();
      } else {
        c = "record";
        line = h ? `In 2024 ${dept} closed ${pct(h.ontime)} on time ${inWin.replace("2025", "2024")}, over ${tg}%.` : `Your goal: ${tg}% on time ${inWin}.`;
        html = h ? `In 2024 ${esc(dept)} closed ${b(pct(h.ontime))} on time ${inWin.replace("2025", "2024")}, over ${b(tg + "%")}.` : `Your goal: ${b(tg + "%")} on time ${inWin}.`;
        facts = p24.trim();
      }
      // what Ping needs to explain a card whose record and model point different ways (owner 21:14)
      const gentle = goal.scope === "ISD" || goal.scope === "PARK", rec = h ? h.ontime : null;
      const differs = !!(X && rec !== null && ((c === "safe" || c === "holds") ? rec < goal.target : c === "short" ? rec >= goal.target : false));
      return { line, html, facts, case: c, why: { differs, dept: who, target: goal.target, record_2024: rec, record_2023: h23 ? h23.ontime : null, model_forecast: wS, model_flyway: wE, gentle, harsh: goal.scope === "PWDx" || goal.scope === "BTDT", window: inWin.replace(/^in /, "") } };
    }
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

    // ---------------------------------------------------------------- the flip, scoped to the goal's window
    async function flip(goal = state.goal, opts = {}) {
      const where = goal.hood ? ` in ${goal.hood}` : "";
      const h = history2024(goal.scope, goal.months, goal.hood);
      const history_line = h ? `In ${monthsText(goal.months).replace("2025", "2024")}, ${pct(h.ontime)} of ${poss(dname(goal.scope))} ${int(h.n)} requests${where} closed on time.` : "";
      const extra = `Scope: the goal covers ${monthsText(goal.months)}${where}. Write the failure statement about that window${where ? " and neighborhood" : ""}.
Predators must threaten that window: their months should overlap it or fall in the 1-2 months before it (backlog builds up first).
${goal.hood ? `Prefer predators in ${goal.hood} or citywide types that are heavy there.` : ""}`;
      let res = null, replay = false;
      if (sample) {
        try { res = await T.flip(goalText(goal).replace("At least", "I make sure at least"), { ...opts, extraRules: extra, onStage: opts.onStage }); }
        catch (e) { if (e && e.code === "cancelled") throw e; res = null; }
      }
      if (!res) {
        replay = true;
        const ds = goal.scope === "CITY" ? DEPTS : [goal.scope];
        const preds = [];
        for (const d of ds) { const r = T.replay(d); if (r) preds.push(...r.predators.slice(0, goal.scope === "CITY" ? 2 : 6)); }
        const actual = h ? pct(h.ontime) : "too few";
        res = { inverted: failLine({ history: h ? { ontime: h.ontime, n: h.n } : null }, null, goal).line,
                predators: preds, dropped: [], notes: ["Saved predators (the live model is off): the failure line is written from the data."] };
      }
      const placed = res.predators.map(p => {
        const ms = p.hypothesis.months && p.hypothesis.months.length ? p.hypothesis.months : goal.months;
        const inWindow = ms.some(m => goal.months.includes(m)), leadIn = ms.some(m => goal.months.some(g => g - m >= 1 && g - m <= 2));
        return { ...p, place: { months: ms, in_window: inWindow, lead_in: leadIn && !inWindow, falls: p.evidence.verdict === "REJECTED" } };
      });
      const h23 = history2023(goal.scope, goal.months, goal.hood);
      return { inverted: res.inverted, history_line, history: h ? { ontime: h.ontime, n: h.n } : null, history2023: h23 ? { ontime: h23.ontime, n: h23.n } : null, predators: placed, dropped: res.dropped || [], notes: res.notes || [], replay };
    }

    // ---------------------------------------------------------------- the escape
    function windowOf(d, sim, goal) { return E.windowOntime(sim, goal.months, E.hoodRatio(d, goal.hood, goal.months).ratio); }
    function windowBreak(d, p, goal, events) {         // demand increase (whole year) at which the window misses the target
      for (let pct = 0; pct <= 60; pct += 2) if (windowOf(d, runDept(d, p, events, 1 + pct / 100, false), goal) < goal.target) return pct;
      return null;
    }
    // The escape is the cheapest single, explainable move that clears the goal: k more crews from month m (kept to December,
    // or released after the window), or k seasonal Parks crews in the window. Cheapest by total cost in the year being run.
    function escapeSearch(d, p0, goal, scen, firstChange, firstSeasonal) {
      const last = Math.max(...goal.months), lastEnd = 12;
      const winOf = p => Math.min(...scen.map(c => windowOf(d, runDept(d, p, c.events, c.mult, false), goal)));
      const ok = p => winOf(p) >= goal.target;
      // cost in the goal's own test year whenever there is one, so an event can only narrow the choice, never make a cheaper move win
      const cS = scen.find(c => c.tag === "hot") || scen[0], cost = p => runDept(d, p, cS.events, cS.mult, false).total_cost;
      const kMax = Math.max(6, Math.ceil(D[d].start * 0.8));
      let best = null; const feas = [];
      const consider = (p, how) => { if (!ok(p)) return false; const c = cost(p); feas.push({ how, cost: c }); if (!best || c < best.cost - 1) best = { plan: p, cost: c, how }; return true; };
      for (let m = firstChange; m <= last; m++) {
        for (let k = 1; k <= kMax; k++) {
          const keep = { crews: p0.crews.map((v, i) => (i >= m - 1 ? v + k : v)), seasonal: p0.seasonal.slice() };
          const hit = consider(keep, { kind: "keep", m, k });
          if (last < lastEnd) consider({ crews: p0.crews.map((v, i) => (i >= m - 1 && i <= last - 1 ? v + k : v)), seasonal: p0.seasonal.slice() }, { kind: "release_after", m, k, until: last });
          if (hit) break;
        }
      }
      if (d === "PARK") {
        const ms = goal.months.filter(m => m >= Math.max(4, firstSeasonal) && m <= 10);
        if (ms.length) for (let k = 1; k <= 8; k++) {
          const sp = { crews: p0.crews.slice(), seasonal: p0.seasonal.map((v, i) => (ms.includes(i + 1) ? v + k : v)) };
          if (consider(sp, { kind: "seasonal", k, months: ms })) break;
        }
      }
      if (best) {
        // the runner-up: the latest start month that also reaches the goal (with its cheapest crew count), and what it costs more
        const later = feas.filter(c => c.how.m && c.how.m > (best.how.m || 0));
        if (later.length) { const lm = Math.max(...later.map(c => c.how.m)), alt = later.filter(c => c.how.m === lm).sort((a, b) => a.cost - b.cost)[0];
          best.how = { ...best.how, alt: { m: alt.how.m, k: alt.how.k, kind: alt.how.kind, until: alt.how.until || null, extra_cost: alt.cost - best.cost } }; }
        else if (best.how.m) best.how = { ...best.how, alt: { latest: true, k_max: kMax } };
        return { ...best, reached: true };
      }
      // nothing clears the target: report the strongest move available (the most crews from the first possible month)
      if (firstChange <= last) {
        const p = { crews: p0.crews.map((v, i) => (i >= firstChange - 1 ? v + kMax : v)), seasonal: p0.seasonal.slice() };
        return { plan: p, cost: cost(p), how: { kind: "keep", m: firstChange, k: kMax }, reached: false, best_window: winOf(p) };
      }
      return null;
    }
    // A weather or event predator (snowstorm, heat wave, move-in...) that a real past event can size, landing in the goal's
    // window or the two months before it, becomes an event the flyway must fly through. Same sizing as Ping's what-ifs.
    function shockEvents(goal, preds, ds) {
      const out = [];
      for (const p of preds || []) {
        const hy = p.hypothesis || {}; if (hy.kind !== "shock") continue;
        const kind = kindOf(`${hy.name || ""} ${hy.description || ""}`), a = kind && ANALOG[kind]; if (!a) continue;
        const ms = (p.place && p.place.months && p.place.months.length ? p.place.months : goal.months).filter(m => goal.months.some(g => g - m >= 0 && g - m <= 2));
        if (!ms.length) continue;
        const m0 = Math.min(...ms), start = E.dayOf(`2025-${String(m0).padStart(2, "0")}-01`);
        const word = { move_in: "move-in surge", deep_freeze: "deep freeze", heat_wave: "heat wave" }[kind] || kind;
        const label = `A ${word} like ${a.label}`;
        for (const e of a.effects) if (ds.includes(e.dept)) out.push({ dept: e.dept, start, days: e.days, mult: e.mult, kind: "demand", label, predator: hy.name || label });
      }
      return out;
    }
    async function escape(goal = state.goal, opts = {}) {
      const ds = goal.scope === "CITY" ? DEPTS : [goal.scope];
      const preds = opts.predators !== undefined ? (state.predators = opts.predators) : state.predators;
      const shocks = shockEvents(goal, preds, ds), userEv = opts.events || state.events;
      const events = userEv.concat(shocks), nowDay = opts.nowDay ?? -1;
      const firstChange = nowDay < 0 ? 2 : E.earliestEffective(nowDay);       // first month (1..12) a new crew can work
      const dusk = E.dusk(Math.min(...goal.months), nowDay);
      // Is the plan already safe at forecast? Then the predator only bites in a hot year: run that year.
      // The hot year belongs to the goal, not to a what-if: it is found without the viewer's pinged events (storms the predators
      // name are part of the goal and stay in). Found with them, a storm would shrink the test year and the flyway with it.
      let mult = 1, hotNote = null;
      const baseEv = shocks;
      const safe = ds.every(d => windowOf(d, runDept(d, plan(d), baseEv, 1, false), goal) >= goal.target);
      if (safe && !opts.mult) {
        const bps = ds.map(d => windowBreak(d, plan(d), goal, baseEv)).filter(v => v !== null);
        if (bps.length) {
          // the first hot year where the window clearly misses (3 points under target): visible, not a cliff edge
          let k = Math.max(0, Math.min(...bps) - 2);
          const miss = kk => ds.some(d => windowOf(d, runDept(d, plan(d), baseEv, 1 + kk / 100, false), goal) <= goal.target - 0.03);
          while (k < 60 && !miss(k)) k++;
          hotNote = k; mult = 1 + k / 100;
        }
      }
      if (opts.mult) mult = opts.mult;
      // With a pinged event (a storm, a walkout) and a busier test year, the plan must pass both tests: the busier year without the
      // event (so an event never makes the flyway smaller) and the event at forecast (so the two are never stacked). Each department
      // shows the harder of the two.
      const scenFor = d => {
        if (!(userEv.length && mult > 1 && !opts.mult)) return [{ events, mult, tag: mult > 1 ? "hot" : "forecast" }];
        const a = { events: baseEv, mult, tag: "hot" }, b = { events, mult: 1, tag: "event" }, p0 = plan(d);
        return windowOf(d, runDept(d, p0, b.events, 1, false), goal) < windowOf(d, runDept(d, p0, a.events, a.mult, false), goal) ? [b, a] : [a, b];
      };
      const out = { goal, nowDay, firstChange, dusk, mult, hot_pct: hotNote, safe_at_forecast: safe, depts: {}, events, shocks: [...new Set(shocks.map(e => e.label))],
                    two_tests: !!(userEv.length && mult > 1 && !opts.mult) };
      for (const d of ds) {
        const p0 = plan(d), ratio = E.hoodRatio(d, goal.hood, goal.months), sc = scenFor(d), S0 = sc[0];
        const stay = runDept(d, p0, S0.events, S0.mult);
        const ev = E.eventArrays(d, events);
        let p1 = p0, reachable = true, how = null;
        const stayW = windowOf(d, stay, goal);
        if (stayW < goal.target) {
          const firstSeasonal = nowDay < 0 ? 1 : E.MONTH_OF_DAY[Math.min(nowDay, 364)] + 2;
          const r = escapeSearch(d, p0, goal, sc, firstChange, firstSeasonal);
          if (r && r.reached) { p1 = r.plan; how = r.how; }
          else { reachable = false; if (r) how = { ...r.how, tried: true, best_window: r.best_window }; }
        }
        void ev;
        const esc = runDept(d, p1, S0.events, S0.mult);
        const escW = Math.min(...sc.map(c => windowOf(d, c === S0 ? esc : runDept(d, p1, c.events, c.mult, false), goal)));
        if (escW < goal.target) reachable = false;   // strict, as the search is: a 99.96% flyway never counts as clearing 100%
        const before = E.decisions(d, p0.crews, p0.seasonal).map(x => x.effective + x.action + x.crews);
        const added = diffDecisions(d, p0, p1);
        out.depts[d] = { ratio, how, test: S0.tag, stay: { plan: p0, sim: stay, window: stayW }, escape: { plan: p1, sim: esc, window: escW, added }, reachable, changed: p1 !== p0 && JSON.stringify(p1) !== JSON.stringify(p0) };
        void before;
      }
      const sum = k => ds.reduce((s, d) => s + out.depts[d][k].sim.crew_cost, 0), pen = k => ds.reduce((s, d) => s + out.depts[d][k].sim.overdue_cost + out.depts[d][k].sim.backlog_cost, 0);
      const agg = k => { let over = 0, closed = 0; for (const d of ds) { const r = out.depts[d][k].sim, rt = out.depts[d].ratio.ratio; for (const m of goal.months) { over += r.monthly[m - 1].overdue * rt; closed += r.monthly[m - 1].closed_targeted; } } return closed ? Math.max(0, 1 - over / closed) : 1; };
      out.totals = { stay: { payroll: sum("stay"), penalty: pen("stay"), window: agg("stay") }, escape: { payroll: sum("escape"), penalty: pen("escape"), window: agg("escape") } };
      // a city goal holds only when every department holds: the weakest department's window is the one to set beside the goal
      const wk = k => ds.reduce((a, d) => (!a || out.depts[d][k].window < a.window ? { dept: d, name: D[d].name, window: out.depts[d][k].window } : a), null);
      out.weakest = { stay: wk("stay"), escape: wk("escape") };
      const anyChange = ds.some(d => out.depts[d].changed), allReach = ds.every(d => out.depts[d].reachable);
      // a city goal holds only when every department holds (the goal reads "every department closes at least ..."), not the city average
      out.verdict = ds.every(d => out.depts[d].stay.window >= goal.target) ? "already" : allReach ? "escaped" : anyChange ? "partial" : "unreachable";
      out.limits = ds.filter(d => !out.depts[d].reachable).map(d => { const h = out.depts[d].how; return { dept: d, name: D[d].name, dusk_passed: firstChange > Math.max(...goal.months), k: h && h.tried ? h.k : null, from: h && h.tried ? h.m : null, best_window: h && h.tried ? h.best_window : null }; });
      out.preds = predatorOutlook(out, goal, preds);
      out.beats = beats(out);
      out.why = await whyLine(out, opts);
      return out;
    }
    // Each confirmed crew predator, judged two ways. The crew side: does the flyway give its department the crews in the
    // predator's months? The process side: in the department's best months (when crews kept up), did this type close on
    // time at the goal's rate? If not, more crews alone will not lift it; it needs a change in how the work is handled.
    function predatorOutlook(x, goal, preds) {
      const res = {}, ontM = (sim, m) => { const q = sim.monthly[m - 1]; return q && q.closed_targeted > 0 ? Math.max(0, 1 - q.overdue / q.closed_targeted) : 1; };
      for (const p of preds || []) {
        const hy = p.hypothesis || {}, ev = p.evidence || {}, d = hy.department;
        if (ev.verdict !== "CONFIRMED" || hy.kind === "silence" || hy.kind === "shock" || !hy.request_type || !x.depts[d]) continue;
        const inW = ((p.place && p.place.months) || []).filter(m => goal.months.includes(m)), ms = inW.length ? inW : goal.months;
        const worst = sim => ms.reduce((a, m) => { const o = ontM(sim, m); return !a || o < a.o ? { m, o } : a; }, null);
        const f24 = E.typeFloor(d, hy.request_type, hy.neighborhood || null), f23 = E.data.cells_2023 ? E.typeFloor(d, hy.request_type, hy.neighborhood || null, E.data.cells_2023) : null;
        const kind = !f24 ? "unknown" : f24.type_ontime >= goal.target ? "crews" : "process";
        const fly = worst(x.depts[d].escape.sim), stay = worst(x.depts[d].stay.sim);
        // dept_wide: the department itself never reached the goal even in its best months, so the record shows no month where crews
        // kept up well enough to prove the goal reachable; the lateness is department-wide, not this predator's alone
        res[hy.name] = { dept: d, months: ms, kind, dept_wide: !!(f24 && kind === "process" && f24.dept_ontime < goal.target), floor_2024: f24, floor_2023: f23, dept_flyway: fly, dept_stay: stay, crews_enough: fly.o >= goal.target,
                         covered: kind === "crews" && fly.o >= goal.target };
      }
      return res;
    }
    function diffDecisions(d, p0, p1) {
      const out = [];
      for (let i = 1; i < 12; i++) {
        const dc = p1.crews[i] - p0.crews[i], dPrev = p1.crews[i - 1] - p0.crews[i - 1];
        if (dc !== dPrev) {
          const n = dc - dPrev;
          out.push({ dept: d, month: i + 1, crews: n, action: n > 0 ? "hire" : "release", sign_by: E.signBy(i + 1) });
        }
        const ds = p1.seasonal[i] - p0.seasonal[i], dsp = i ? p1.seasonal[i - 1] - p0.seasonal[i - 1] : 0;
        if (ds !== dsp) out.push({ dept: d, month: i + 1, crews: ds - dsp, action: "seasonal", sign_by: `2025-${String(i + 1).padStart(2, "0")}-01` });
      }
      return out;
    }
    const fmtDate = iso => { if (!iso) return ""; const [y, m, dd] = iso.split("-").map(Number); return `${dd} ${MON[m - 1]}${y !== 2025 ? " " + y : ""}`; };
    function beats(x) {
      const g = x.goal, ds = Object.keys(x.depts), first = Math.min(...g.months), last = Math.max(...g.months);
      const midDay = E.dayOf(`2025-${String(first).padStart(2, "0")}-15`), endDay = E.dayOf(`2025-${String(last).padStart(2, "0")}-${new Date(Date.UTC(2025, last, 0)).getUTCDate()}`);
      const startDay = E.dayOf(`2025-${String(first).padStart(2, "0")}-01`);
      const scale = d => (g.hood ? E.hoodShare(d, g.hood)[first - 1] * x.depts[d].ratio.ratio : 1);
      const at = (k, t) => ds.reduce((s, d) => { let v = 0; for (let i = startDay; i <= t; i++) v += x.depts[d][k].sim.daily.late[i]; return s + v * scale(d); }, 0);
      const bk = (k, t) => ds.reduce((s, d) => s + x.depts[d][k].sim.daily.backlog[t] * (g.hood ? E.hoodShare(d, g.hood)[first - 1] : 1), 0);
      const whereTxt = g.hood ? ` in ${g.hood}` : "";
      const win = monthsText(g.months), tgt = pct(g.target);
      const stay = [], esc = [];
      const seenEv = new Set();
      for (const e of (x.events || state.events).filter(e => { const k2 = e.label + "|" + e.start; if (seenEv.has(k2)) return false; seenEv.add(k2); return true; })) stay.push({ day: e.start, text: `${fmtDate(E.isoOf(e.start))} \u00b7 ${e.label} hits.`, kind: "event" }), esc.push({ day: e.start, text: `${fmtDate(E.isoOf(e.start))} \u00b7 ${e.label} hits.`, kind: "event" });
      if (x.hot_pct !== null && x.hot_pct !== undefined)
        stay.push({ day: 0, kind: "note", text: `At forecast demand the plan already clears ${tgt}. This is the year demand runs ${x.hot_pct}% hot, where the predator catches it.` });
      if (x.dusk.date && !x.dusk.passed) {
        const dd = { day: Math.max(0, x.dusk.day), kind: "dusk", text: `${fmtDate(x.dusk.date)} \u00b7 Dusk. The last day to sign a crew who is working by ${MONF[first - 1]}.` };
        stay.push({ ...dd }); esc.push({ ...dd });
      }
      const hires = ds.flatMap(d => x.depts[d].escape.added);
      if (hires.length) {
        for (const h of hires.filter(h => h.action !== "seasonal")) {
          const dayS = h.sign_by ? E.dayOf(h.sign_by) : 0;
          esc.push({ day: Math.max(0, dayS), kind: h.sign_by === x.dusk.date ? "dusk" : "decision",
                     text: h.action === "hire" ? `${fmtDate(h.sign_by)} \u00b7 Sign ${h.crews} new ${D[h.dept].name} crew${h.crews > 1 ? "s" : ""}${h.sign_by === x.dusk.date ? ". This is Dusk, the last day it works" : ""}. Working from ${MONF[h.month - 1]}.`
                                                : `${fmtDate(h.sign_by)} \u00b7 Give ${-h.crews} ${D[h.dept].name} crew${h.crews < -1 ? "s" : ""} notice once ${MONF[h.month - 2]} is covered. Gone from ${MONF[h.month - 1]}.` });
          if (h.action === "hire") esc.push({ day: Math.max(0, E.dayOf(`2025-${String(Math.max(1, h.month - 1)).padStart(2, "0")}-02`)), kind: "train", text: `${MONF[h.month - 2] || "January"} \u00b7 They train, paid, not closing requests yet.` });
        }
        for (const h of hires.filter(h => h.action === "seasonal"))
          esc.push({ day: E.dayOf(h.sign_by), kind: "decision", text: `${fmtDate(h.sign_by)} \u00b7 ${h.crews > 0 ? `Add ${h.crews} seasonal Parks crew${h.crews > 1 ? "s" : ""}` : `End ${-h.crews} seasonal contract${h.crews < -1 ? "s" : ""}`}, no training needed.` });
      } else if (x.verdict === "unreachable") {
        const lim = (x.limits || [])[0];
        esc.push({ day: Math.max(0, x.nowDay), kind: "note", text: x.firstChange > last ? `A crew signed now works from ${startsText(x.firstChange)}. That is after ${win}: Dusk has passed and there is no exit left.`
          : lim && lim.k ? `No crew plan reaches ${tgt} here. Even ${lim.k} more ${lim.name} crews from ${MONF[lim.from - 1]}, the most Terry tests, reach ${pctVs(lim.best_window, g.target)}.` : `No crew plan reaches ${tgt} here.` });
      }
      const midTxt = k => { const l = at(k, midDay); return `${fmtDate(E.isoOf(midDay))} \u00b7 ${l < 0.5 ? "Nothing closed late yet" : `${int(l)} request${Math.round(l) === 1 ? "" : "s"} closed late so far`}${whereTxt}; about ${int(bk(k, midDay))} open.`; };
      stay.push({ day: midDay, kind: "mid", text: midTxt("stay") });
      esc.push({ day: midDay, kind: "mid", text: midTxt("escape") });
      const sw = x.totals.stay.window, ew = x.totals.escape.window;
      stay.push({ day: endDay, kind: sw >= g.target ? "safe" : "caught", text: `${fmtDate(E.isoOf(endDay))} \u00b7 ${pctVs(sw, g.target)} on time in ${win}. ${sw >= g.target ? "Clear." : "The predator has you."}` });
      const dPay = x.totals.escape.payroll - x.totals.stay.payroll, dPen = x.totals.escape.penalty - x.totals.stay.penalty;
      esc.push({ day: endDay, kind: ew >= g.target ? "safe" : "caught",
                 text: `${fmtDate(E.isoOf(endDay))} \u00b7 ${pctVs(ew, g.target)} on time in ${win}. ${ew >= g.target ? "Escaped" : "Still short"}${dPay > 1 ? `, for ${money(dPay)} more in payroll and ${money(-dPen)} less in overdue costs` : ""}.` });
      const byDay = (a, b) => a.day - b.day;
      return { stay: stay.sort(byDay), escape: esc.sort(byDay) };
    }
    async function whyLine(x, opts) {
      if (!sample) return "";
      const facts = Object.entries(x.depts).map(([d, v]) => `${D[d].name}: plan ${E.scheduleText(v.stay.plan.crews, v.stay.plan.seasonal)}; escape ${E.scheduleText(v.escape.plan.crews, v.escape.plan.seasonal)}`).join("\n");
      try {
        const r = await sample.json(`You are Terry, a bat who plans Boston's 311 crews. In one plain sentence for a city manager, with NO numbers or dates,
say how the escape plan below beats the failure (or, if nothing changed or nothing works, say why honestly). Mention that new crews need a month of
training when that matters.
Goal: ${goalText(x.goal)} Verdict: ${x.verdict}.
${facts}
Reply with only JSON {"why": string}`, { signal: opts.signal, modelTier: "quick" });
        return String(r && r.why || "").replace(NUMS, "").replace(/\s+/g, " ").trim();
      } catch (e) { return ""; }
    }

    // ---------------------------------------------------------------- Ping: what-ifs, sized by real history
    function dateIn(text) {
      const t = norm(text);
      const m = t.match(new RegExp(`\\b(${MONTH_NAMES.join("|")}|${MONTH_NAMES.map(x => x.slice(0, 3)).join("|")})\\s+(\\d{1,2})`)) ||
                t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAMES.join("|")}|${MONTH_NAMES.map(x => x.slice(0, 3)).join("|")})`));
      if (!m) { const mo = findMonths(text); return mo.length === 1 ? `2025-${String(mo[0]).padStart(2, "0")}-01` : null; }
      const [mon, day] = isNaN(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
      const mi = MONTH_NAMES.findIndex(x => x.startsWith(mon.slice(0, 3))) + 1;
      return `2025-${String(mi).padStart(2, "0")}-${String(Math.min(28, Number(day))).padStart(2, "0")}`;
    }
    function kindOf(text) {
      const t = norm(text);
      if (/\b(snow|blizzard|nor ?easter|plow|winter storm|ice storm|inches)/.test(t)) return "snowstorm";
      if (/\b(wind|hurricane|tropical|trees? down|downpour|flood)/.test(t)) return "windstorm";
      if (/\b(freeze|frozen|cold snap|arctic|no heat)/.test(t)) return "deep_freeze";
      if (/\b(move ?in|move ?out|moving day|students arrive)/.test(t)) return "move_in";
      if (/\b(heat|hot spell|heatwave)/.test(t)) return "heat_wave";
      if (/\b(quit|resign|sick|strike|out sick|lose|leave|layoff|walk ?out)/.test(t)) return "crew_loss";
      if (/\b(freeze on hiring|hiring freeze|can t hire|cannot hire|no hiring)/.test(t)) return "hiring_freeze";
      if (/\b(surge|spike|jump|double|doubles|more requests|busier)/.test(t)) return "demand_surge";
      return null;
    }
    async function ping(message, parsed = null) {
      if (!state.goal) return { kind: "note", text: "Set a goal first." };
      if (!parsed && sample) { try { parsed = await parseWithModel(message); } catch (e) { parsed = null; } }
      const pp = parsed && parsed.ping || {};
      const kind = kindOf(message) || pp.kind || "unsupported";
      const iso = dateIn(message) || (pp.start_date && /^2025-\d\d-\d\d$/.test(pp.start_date) ? pp.start_date : null);
      const userPct = (() => { const m = String(message).match(/(\d{1,3})\s*%/); return m ? Number(m[1]) : (Number(pp.user_pct) > 0 ? Number(pp.user_pct) : null); })();
      const deptsAsked = [...new Set([T.readDept(message), ...(Array.isArray(pp.departments) ? pp.departments : [])].filter(d => DEPTS.includes(d)))];
      const hood = findHood(message) || (pp.neighborhood ? findHood(pp.neighborhood) : null);
      if (kind === "unsupported") return { kind: "note", text: "That isn't something 311 crews or their requests would feel, so I can't fly it. Try weather, a spike in requests, crews quitting, or a hiring freeze." };
      if (!iso) return { kind: "question", text: "When does it hit? Give me a date in 2025.", options: ["November 22", "February 1", "July 15"] };
      const start = E.dayOf(iso);
      let events = [], label, source;
      if (ANALOG[kind]) {
        const a = ANALOG[kind];
        events = a.effects.filter(e => !deptsAsked.length || deptsAsked.includes(e.dept)).map(e => ({ dept: e.dept, start, days: e.days, mult: e.mult, kind: "demand", hood }));
        if (!events.length) events = a.effects.map(e => ({ dept: e.dept, start, days: e.days, mult: e.mult, kind: "demand", hood }));
        label = `A ${{ move_in: "move-in surge", deep_freeze: "deep freeze", heat_wave: "heat wave" }[kind] || kind} the size of ${a.label}${hood ? ` in ${hood}` : ""}`;
        source = `Sized like ${a.label}: ` + a.effects.map(e => `${D[e.dept].name} \u00d7${e.mult} for ${e.days} days (${int(e.extra)} extra requests, ${e.window})`).join("; ") + ".";
      } else if (kind === "crew_loss") {
        if (!userPct) return { kind: "question", text: "How many crews are lost, as a share? And which department?", options: ["10% of Transportation", "20% of Public Works"] };
        const ds = deptsAsked.length ? deptsAsked : (state.goal.scope === "CITY" ? DEPTS : [state.goal.scope]);
        const days = Number(pp.days) > 0 ? Number(pp.days) : null;
        events = ds.map(d => ({ dept: d, start, days, mult: 1 - Math.min(userPct, 90) / 100, kind: "capacity" }));
        label = `${userPct}% of ${ds.map(d => D[d].name).join(" and ")} crews lost${days ? ` for ${days} days` : " for the rest of the year"}`;
        source = "Your number: the data has no record of crews leaving.";
      } else if (kind === "hiring_freeze") {
        const days = Number(pp.days) > 0 ? Number(pp.days) : 90;
        state.freeze = { start, end: start + days };
        label = `A hiring freeze from ${fmtDate(iso)} for ${days} days`; source = "Your assumption: no new crews can be signed during the freeze.";
      } else {
        if (!userPct) return { kind: "question", text: "How big a jump? The largest one-week spike in the data was Public Works at \u00d71.73 on move-in weekend.", options: ["20% for two weeks", "50% for a week"] };
        const ds = deptsAsked.length ? deptsAsked : (state.goal.scope === "CITY" ? DEPTS : [state.goal.scope]);
        const days = Number(pp.days) > 0 ? Number(pp.days) : 14;
        events = ds.map(d => ({ dept: d, start, days, mult: 1 + userPct / 100, kind: "demand", hood }));
        label = `Requests up ${userPct}% for ${days} days`; source = "Your number, not from the data.";
      }
      events.forEach(e => (e.label = label));
      state.events = state.events.concat(events);
      // Three ways to meet it: keep the plan; respond from the day it hits (hiring lag applies); or have prepared from January
      const freezeDay = state.freeze ? state.freeze.end : -1;
      // the same year the Roost's flyway is tested in (a busier one when the plan is safe at forecast), so the card and the chart agree
      const stayRun = await escape(state.goal, { events: state.events, nowDay: 365 });
      const respond = await escape(state.goal, { events: state.events, nowDay: Math.max(start, freezeDay) });
      const prepare = await escape(state.goal, { events: state.events, nowDay: Math.max(-1, freezeDay) }), base = stayRun;
      const lines = [];
      const r = respond.totals.escape, p = prepare.totals.escape, s = stayRun.totals.stay;
      lines.push(`${label}. ${source}`);
      lines.push(`Keep the plan: ${pctVs(s.window, state.goal.target)} on time in ${monthsText(state.goal.months)}, ${money(s.penalty)} in overdue costs` +
                 (base.two_tests ? ` (the harder of the flyway's two tests: a year ${base.hot_pct}% busier, or forecast with this event).` : ".") +
                 (s.window < 0.05 ? " Once the backlog is older than the due dates, every request the crews close is already late; the model works oldest first." : ""));
      if (respond.verdict === "unreachable" || JSON.stringify(respond.totals.escape) === JSON.stringify(respond.totals.stay))
        lines.push(`React when it hits: a crew signed on ${fmtDate(iso)} works from ${startsText(E.earliestEffective(start))}, so there's nothing to add in time.`);
      else lines.push(`React when it hits: ${pctVs(r.window, state.goal.target)} on time, ${money(r.payroll - s.payroll)} more payroll.`);
      lines.push(`Prepared from January: ${pctVs(p.window, state.goal.target)} on time, ${money(p.payroll - s.payroll)} more payroll, ${money(s.penalty - p.penalty)} less in overdue costs.`);
      const verdict = s.window >= state.goal.target ? "absorbed" : p.window >= state.goal.target ? (r.window >= state.goal.target ? "react" : "prepare") : "accept";
      lines.push(verdict === "absorbed" ? "Your plan absorbs it: no change needed." : verdict === "react" ? "You can still escape after it hits." : verdict === "prepare" ? "Only a plan made before Dusk escapes this one." : `Nothing reaches ${pct(state.goal.target)} with this event: the cheapest move is to accept the late requests.`);
      state.lastPing = { label, events };
      return { kind: "ping", text: lines.join(" "), lines, label, source, events, stay: stayRun, respond, prepare, verdict };
    }
    function clearPings() { state.events = []; state.freeze = null; state.lastPing = null; }

    return { year, chat, setGoal, goalText, flip, failLine, escape, ping, clearPings, state, runDept, kindOf, analogues: ANALOG, monthsText, money, pct, pct1, pctVs, fmtDate, live: () => !!sample };
  }

  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TerryFlyover = api;
})(typeof window !== "undefined" ? window : globalThis);
