/* Ping navigation: does a message ask to be taken somewhere on the page, and where? (owner 20:05)
   Pure text rules, no model: "go to the predators", "show me the flyway", "open the Roost". Checked before the router, so a
   navigation request never reaches the model. A data question that only mentions a place ("where are the predators worst?")
   is not navigation unless it uses a plain movement verb ("go to", "take me to", "scroll", "jump", "open", "navigate").
   Browser: window.TerryNav.navTarget(text) -> key | null. Node: require("./nav.js").navTarget (the notebook's 6.6 evaluates it). */
(function (root) {
  "use strict";
  const NAV = [   // checked in order: the most specific first ("the predators in the flip side" is the predators)
    { key: "pred", re: /predator/i }, { key: "fly", re: /fly\s?way/i }, { key: "fail", re: /flip\s?side|\bflip\b|fail(ure)?\s*card/i },
    { key: "echo", re: /echolocation|quiet place|voices|isn.?t hearing|not hearing/i }, { key: "ledger", re: /ledger|crew plan|2025 plan|\bthe plan\b/i },
    { key: "machine", re: /almanac|budgeterry|battery|machine/i }, { key: "projector", re: /projector|\bscreen\b|\bchart\b/i },
    { key: "roost", re: /\broost/i }, { key: "terrytory", re: /terrytory|territory/i }, { key: "goal", re: /goal box|chase box|chase it/i },
  ];
  const MOVE = /\b(go(es)? (back )?to|take me( back)? to|bring me( back)? to|scroll( down| up)?( to)?|jump( back)? to|navigate to|head to|move to|open( up)?)\b/i;
  const SOFT = /\b(show me|bring up|where('?s| is| are)|let me see|find)\b/i;
  const ASKS = /\b(why|how (many|much|long|often)|what if|worst|most|least|cheapest|cost|late|which|when)\b/i;   // a data question, not a trip
  function navTarget(text) {
    const t = String(text || "").trim(); if (!t || t.length > 140) return null;
    if (!MOVE.test(t) && !(SOFT.test(t) && !ASKS.test(t))) return null;
    const n = NAV.find(x => x.re.test(t)); return n ? n.key : null;
  }
  // ------------------------------------------------------------ commands: Ping works the page (owner 20:30)
  // parseCommand(text) -> { cmd, ... } | null. Pure: it names what was asked; the page decides what exists (ping.js runs it, and asks
  // the viewer to choose when a part is missing or several things fit).
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const MON_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const monthOf = w => MONTHS.indexOf(String(w || "").slice(0, 3).toLowerCase());
  const DEPTS = [["PWDx", /public works|\bpwd\b|\bworks\b/i], ["BTDT", /transportation|\bbtd\b|transport|traffic|parking/i], ["PARK", /\bparks?\b(?! enforcement)/i], ["ISD", /inspectional|\bisd\b|inspection/i]];
  const deptOf = t => { const m = DEPTS.find(([, re]) => re.test(t)); return m ? m[0] : null; };
  const PLANS = [["do_nothing", /do[\s-]?nothing/i], ["passive", /\bpassive\b/i], ["neutral", /\bneutral\b|recommended/i], ["aggressive", /\baggressive\b/i]];
  const plansIn = t => PLANS.map(([k, re]) => ({ k, i: t.search(re) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i).map(x => x.k);
  function dateIn(t) {
    let m = new RegExp(`\\b${MON_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, "i").exec(t);
    if (m) return { month: monthOf(m[1]), day: +m[2], year: m[3] ? +m[3] : null };
    m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RE}\\b(?:,?\\s*(\\d{4}))?`, "i").exec(t);
    if (m) return { month: monthOf(m[2]), day: +m[1], year: m[3] ? +m[3] : null };
    m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
    if (m) return { month: +m[1] - 1, day: +m[2], year: m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null };
    return null;
  }
  const monthIn = t => { const m = new RegExp(`\\b${MON_RE}\\b`, "i").exec(t); return m ? monthOf(m[1]) : null; };
  const ACT = /\b(choose|pick|select|show( me)?|go to|take me to|open|set|jump to|move( the day)? to|zoom( in)?( to| into)?|switch( to)?|use|turn|make it|play|see|view|display|put)\b/i;
  function parseCommand(text) {
    const t = String(text || "").trim(); if (!t || t.length > 160) return null;
    if (/\?\s*$/.test(t) && !/^\s*(can|could|will|would) you\b/i.test(t)) return null;   // a question about the data goes to the router
    const acts = ACT.test(t);
    // day and night
    if (/\b(night|dark)( mode| theme)?\b/i.test(t) && (acts || /^\s*(night|dark)( mode)?\s*$/i.test(t)) && !/\b(day|light)\b.*\b(night|dark)\b/i.test(t)) return { cmd: "theme", theme: "night" };
    if (/\b(day|light)( mode| theme)\b|\b(switch|turn|go|make it|change)\b.{0,12}\b(day|light)\b\s*$/i.test(t)) return { cmd: "theme", theme: "day" };
    // compare plans (roosts and alerts are compare too, but ping.js keeps its own parser for those)
    if (/\bcompare\b|\bvs\.?\b|\bversus\b/i.test(t) && !/\broost|\balert|stay the course|original plan|before and after/i.test(t)) {
      const ps = plansIn(t); if (ps.length >= 2) return { cmd: "compare", a: ps[0], b: ps[1] }; if (ps.length === 1) return { cmd: "compare", a: null, b: ps[0] };
      if (/\bplans?\b/i.test(t) || /^\s*compare\s*$/i.test(t)) return { cmd: "compare", a: null, b: null };
    }
    // a plan
    { const ps = plansIn(t); if (ps.length === 1 && acts && /\bplan\b|\bshow\b|\bswitch\b|\buse\b|\bselect\b|\bpick\b|\bchoose\b/i.test(t)) return { cmd: "plan", plan: ps[0] }; }
    // a day
    const dt = dateIn(t);
    if (dt && dt.month >= 0 && dt.month < 12 && (acts || t.length <= 30)) return { cmd: "day", month: dt.month, day: dt.day, year: dt.year, dept: deptOf(t) };
    // play a month
    if (/\bplay\b/i.test(t)) return { cmd: "play", month: monthIn(t), dept: deptOf(t) };
    // zoom out, or to a department (and month)
    if (/\bzoom(ed)? out\b|\bback to (boston|the city|all)\b|\b(whole|all the) (city|departments)\b|\ball four\b/i.test(t)) return { cmd: "zoom", lvl: 0 };
    { const dp = deptOf(t), mo = monthIn(t); if (dp && acts && !/\bwhy\b|\bhow\b/i.test(t)) return { cmd: "zoom", lvl: mo == null ? 1 : 2, dept: dp, month: mo }; }
    return null;
  }
  const dayOfYear = (m, d) => { const L = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; if (m < 0 || m > 11 || d < 1 || d > L[m]) return -1; let n = d - 1; for (let i = 0; i < m; i++) n += L[i]; return n; };
  const api = { navTarget, NAV, parseCommand, dayOfYear, DEPTS: DEPTS.map(x => x[0]), PLANS: PLANS.map(x => x[0]) };
  if (typeof module === "object" && module.exports) module.exports = api; else root.TerryNav = api;
})(typeof window !== "undefined" ? window : this);
