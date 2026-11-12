/* TerryRoost: the Roost model (up to three plans), the Echolocation log, scenarios for comparison.
 * The only writer of TerryState.roosts, activeRoost, compare and log. Other modules call these methods and listen on TerryBus.
 *
 *   create(goal, {flip, escape, goalText})  -> roost | null (at the limit)
 *   activate(id)   close(id)   setView(id, "stay"|"flyway")
 *   scenario({roostId, view, label, x})     -> { label, roostId, dept, depts, plan:{crews[12],seasonal[12]}, events, window:{months,hood}, ontime[12], windowOntime, totals:{payroll,penalty} }
 *   openCompare(a, b)  closeCompare()       a and b are scenario specs
 *   log(entry)  restore(entry)
 *   setFold(id|null, {fail, pred, fly, ledger})  foldOf(id|null)   fold state per Roost (null: before any chase)
 */
(function (root) {
  "use strict";
  const Bus = root.TerryBus;
  if (!Bus) { console.warn("roost.js needs bus.js first"); return; }
  const LIMIT = 3;
  let nextN = 1, nextLog = 1;
  const S = () => root.TerryState;
  function put(patch) { root.TerryState = Object.assign({}, root.TerryState, patch); return root.TerryState; }
  const find = id => S().roosts.find(r => r.id === id) || null;
  const ontimeOf = m => (m.closed_targeted > 0 ? Math.max(0, 1 - m.overdue / m.closed_targeted) : 1);

  function log(entry) {
    const e = Object.assign({ id: nextLog++, t: Date.now(), kind: "note", roostId: S().activeRoost, label: "", restore: {} }, entry || {});
    put({ log: S().log.concat([e]) });
    Bus.emit("action:logged", { entry: e });
    return e;
  }
  function create(goal, extra) {
    extra = extra || {};
    if (S().roosts.length >= LIMIT) return null;
    const esc = extra.escape || null, depts = esc ? Object.keys(esc.depts) : (goal && goal.scope && goal.scope !== "CITY" ? [goal.scope] : []);
    const roost = { id: "r" + (nextN), n: nextN++, goal, goalText: extra.goalText || "", dept: depts[0] || null, depts, flip: extra.flip || null, escape: esc,
      verdict: esc ? esc.verdict : null, createdAt: Date.now(), view: "flyway", events: [], fold: {} };
    put({ roosts: S().roosts.concat([roost]), activeRoost: roost.id });
    Bus.emit("roost:created", { roost });
    log({ kind: "chase", roostId: roost.id, label: "Chased a goal", restore: { roostId: roost.id } });
    Bus.emit("roost:activated", { id: roost.id, fromCreate: true });
    return roost;
  }
  function activate(id, o) {
    const r = find(id); if (!r) return false;
    if (S().compare) closeCompare(true);
    if (S().activeRoost !== id) put({ activeRoost: id });
    Bus.emit("roost:activated", Object.assign({ id }, o || {}));
    return true;
  }
  function close(id) {
    const list = S().roosts, i = list.findIndex(r => r.id === id); if (i < 0) return false;
    const r = list[i], rest = list.filter(x => x.id !== id);
    if (S().compare) closeCompare(true);
    put({ roosts: rest });
    Bus.emit("roost:closed", { id, n: r.n, left: rest.length });
    log({ kind: "close", roostId: null, label: "Closed Roost " + r.n, restore: {} });
    if (S().activeRoost === id) {
      const nx = rest[i] || rest[i - 1] || null;
      put({ activeRoost: nx ? nx.id : null });
      if (nx) Bus.emit("roost:activated", { id: nx.id, afterClose: true });
    }
    return true;
  }
  function setView(id, view, o) {
    const r = find(id); if (!r || r.view === view) return false;
    r.view = view; put({ roosts: S().roosts.slice() });
    Bus.emit("plan:view", { roostId: id, view, quiet: !!(o && o.quiet) });
    if (!(o && o.quiet)) log({ kind: "view", roostId: id, label: view === "flyway" ? "Showed the flyway" : "Showed the original plan", restore: { roostId: id, view } });
    return true;
  }
  // a scenario is one side of a comparison, built from the numbers the model already simulated for the Roost
  function scenario(spec) {
    spec = spec || {}; const r = find(spec.roostId || S().activeRoost), x = spec.x || (r && r.escape); if (!x) return null;
    const view = spec.view || (r && r.view) || "flyway", k = view === "stay" ? "stay" : "escape", ds = Object.keys(x.depts), dept = spec.dept || ds[0], D = x.depts[dept];
    let sim = D[k].sim; const plan = D[k].plan, g = x.goal; let wOn = x.totals[k].window;
    const evA = spec.events && spec.events.length && root.__zoom && root.__zoom.E && root.__zoom.E.eventArrays ? root.__zoom.E.eventArrays(dept, spec.events) : null;
    if ((spec.dayMult || evA) && root.__zoom && root.__zoom.E) {   // the same plan under a surge: re-run the simulator for this department
      sim = root.__zoom.E.simulate(dept, plan.crews, plan.seasonal, { dayMult: spec.dayMult || evA.dayMult, capMult: evA ? evA.capMult : undefined }); let over = 0, closed = 0; const rt = D.ratio ? D.ratio.ratio : 1;
      for (const m of g.months) { over += sim.monthly[m - 1].overdue * rt; closed += sim.monthly[m - 1].closed_targeted; } wOn = closed ? Math.max(0, 1 - over / closed) : 1;
    }
    return { label: spec.label || (r ? `Roost ${r.n} · ${view === "stay" ? "Original plan" : "Flyway"}` : "Scenario"), roostId: r ? r.id : null, view, dept, depts: ds,
      plan: { crews: plan.crews.slice(), seasonal: plan.seasonal.slice() }, events: spec.events || [], window: { months: g.months.slice(), hood: g.hood || null },
      ontime: sim.monthly.map(ontimeOf), windowOntime: wOn, totals: { payroll: x.totals[k].payroll, penalty: x.totals[k].penalty }, target: g.target, verdict: x.verdict };
  }
  function openCompare(a, b, o) {
    const A = a && a.plan ? a : scenario(a), B = b && b.plan ? b : scenario(b); if (!A || !B) return false;
    put({ compare: { a: A, b: B } });
    if (!(o && o.quiet)) log({ kind: "compare", label: "Opened a comparison", restore: { compare: { a: { roostId: A.roostId, view: A.view }, b: { roostId: B.roostId, view: B.view } } } });
    Bus.emit("compare:open", { a: A, b: B });
    return true;
  }
  function closeCompare(quiet) {
    if (!S().compare) return false;
    put({ compare: null });
    if (!quiet) log({ kind: "compare", label: "Closed a comparison", restore: {} });
    Bus.emit("compare:close", {});
    return true;
  }
  function restore(entry) {
    if (!entry) return;
    const rs = entry.restore || {};
    if (rs.compare) { openCompare({ roostId: rs.compare.a.roostId, view: rs.compare.a.view }, { roostId: rs.compare.b.roostId, view: rs.compare.b.view }); }
    else { if (rs.roostId && find(rs.roostId)) { if (S().activeRoost !== rs.roostId) activate(rs.roostId, { restore: true }); if (rs.view) setView(rs.roostId, rs.view, { quiet: true }); } }
    Bus.emit("action:restore", { entry });
  }
  // which Flip Side sections are folded, per Roost; id null is the page before any chase (only the ledger sits there)
  function foldOf(id) { const r = id ? find(id) : null; return Object.assign({}, r ? r.fold : (S().fold0 || {})); }
  function setFold(id, patch) {
    const r = id ? find(id) : null; if (id && !r) return false;
    const next = Object.assign(foldOf(id), patch || {});
    if (r) { r.fold = next; put({ roosts: S().roosts.slice() }); } else put({ fold0: next });
    Bus.emit("roost:fold", { id: r ? r.id : null, fold: next });
    return true;
  }
  // keep the snapshot in step with events other modules own
  Bus.on("theme:changed", p => put({ theme: p.theme }));
  Bus.on("proj:busy", () => put({ busy: true }));
  Bus.on("proj:idle", () => put({ busy: false }));
  Bus.on("screen:level", p => put({ screen: Object.assign({}, S().screen, { level: p.level, dept: p.dept === undefined ? null : p.dept, month: p.month === undefined ? null : p.month }) }));
  Bus.on("screen:pull", p => put({ screen: Object.assign({}, S().screen, { h: p.h, maximized: !!p.maximized }) }));
  root.TerryRoost = { LIMIT, create, activate, close, setView, scenario, openCompare, closeCompare, log, restore, setFold, foldOf, get: find, get count() { return S().roosts.length; } };
})(typeof window !== "undefined" ? window : globalThis);
/* TerryFold: fold The Flip Side's sections (the flip, Predators, Flyway, and the ledger while it sits there) to one summary line each.
 * Every summary is computed from the Roost's own numbers. Hovering or focusing a folded line previews it on the projector through the bus
 * (ask:highlight, plan:view); clicking the line commits that view; the chevron unfolds. With everything folded the projector, the board
 * under it and the summary lines share one screen ("watch on screen"). State lives in TerryState through TerryRoost.setFold. */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const Bus = () => root.TerryBus, R = () => root.TerryRoost, Z = () => root.__zoom, P = () => root.TerryPlates;
  const KEYS = ["fail", "pred", "fly", "ledger"], NAME = { fail: "The Flip", pred: "Predators", fly: "The Flyway", echo: "Echolocation", ledger: "The 2025 crew plan" };
  // Echolocation is one section for every Roost (owner 11 Nov: a sub-section of The Flip Side): its fold is held here, not per Roost
  let echoFold = false; const echoEl = () => doc.querySelector("#terrytory section.qs");
  const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pc0 = v => Math.round(v * 100) + "%", pc1 = v => (Math.round(v * 1000) / 10).toFixed(1) + "%";
  const chev = () => (root.TerryArt && root.TerryArt.ic ? root.TerryArt.ic("chev", "fold-i") : "");
  const St = () => root.TerryState || {};
  const roostOf = body => body && body.dataset.r ? R().get(body.dataset.r) : null;

  // :: summary lines, from the numbers
  function monthsWord(ms) {
    const a = (ms || []).slice().sort((x, y) => x - y);
    if (!a.length || a.length === 12) return "in 2024";
    if (a.length === 1) return "last " + MONF[a[0] - 1];
    return a[a.length - 1] - a[0] === a.length - 1 ? `in ${MON3[a[0] - 1]} to ${MON3[a[a.length - 1] - 1]} 2024` : "in " + a.map(m => MON3[m - 1]).join(", ") + " 2024";
  }
  function sumFail(r) {
    const g = r.goal || {}, h = r.flip && r.flip.history, X = r.escape, tg = Math.round((g.target || 0) * 100) + "%";
    if (X && X.hot_pct > 0) return `Breaks at +${X.hot_pct}% demand: ${pc1(X.totals.stay.window)}. Goal ${tg}.`;   // the same three cases as the card's failure line
    if (X && X.safe_at_forecast && X.verdict === "already") return `Holds ${tg} even at +60% demand.`;
    if (h && h.n) return `${pc0(h.ontime)} ${monthsWord(g.months)}. Goal ${tg}.`;
    return X ? `Goal ${tg}. The forecast plan reaches ${pc1(X.totals.stay.window)}.` : `Goal ${tg}.`;
  }
  function sumPred(r) {
    const preds = (r.flip && r.flip.predators) || [], c = preds.filter(p => p.evidence && p.evidence.verdict === "CONFIRMED").length;
    if (!preds.length) return "Nothing heard in the 2024 rows.";
    let lead = ""; try { const z = Z(), t = P().tallyText(preds, { E: z.E, F: null, X: r.escape, goal: r.goal }); lead = String(t).replace(/<[^>]+>/g, "").split(/(?<=\.)\s/)[0] || ""; } catch (e) {}
    return `${preds.length} heard, ${c} confirmed.${lead ? " " + lead : ""}`;
  }
  function hiresOf(X) { let n = 0; const ms = {}; for (const [d, D] of Object.entries((X && X.depts) || {})) for (const a of (D.escape && D.escape.added) || []) if (a.action === "hire") { n += a.crews; (ms[d] = ms[d] || []).push(a.month - 1); } return { n, ms }; }
  function dayLabel(day) { const z = Z(); if (!z || !z.E || !z.E.isoOf || day == null) return ""; const iso = z.E.isoOf(day); return `${+iso.slice(8, 10)} ${MON3[+iso.slice(5, 7) - 1]}`; }
  // a share beside a goal it misses keeps enough decimals that it never reads as the goal (99.96%, not 100.0%)
  const pcG = (v, t) => { const r1 = Math.round(v * 1000) / 10; return v < t && r1 >= t * 100 ? (Math.floor(v * 10000) / 100).toFixed(2) + "%" : r1.toFixed(1) + "%"; };
  function sumFly(r) {
    const X = r.escape; if (!X) return "";
    const wk = Object.keys(X.depts || {}).length > 1 && X.weakest, st = wk ? wk.stay.window : X.totals.stay.window, fl = wk ? wk.escape.window : X.totals.escape.window, tg = (r.goal && r.goal.target) || 0, h = hiresOf(X).n;   // city goals: the weakest department
    const bs = (X.beats && X.beats.escape) || [], dusk = bs.find(b => b.kind === "dusk") || bs.find(b => b.kind === "decision"), by = dusk ? dayLabel(dusk.day) : "";
    if (X.verdict === "unreachable" || fl < tg) return h ? `Sign ${h} crew${h > 1 ? "s" : ""}${by ? " by " + by : ""}. ${pc1(st)} to ${pc1(fl)}, under ${pc0(tg)}.` : (() => { const l = (X.limits || []).find(x => x.k); return l ? `No crew plan reaches ${pc0(tg)}. Even +${l.k} crews: ${pcG(l.best_window, tg)}.` : `No crew plan reaches ${pc0(tg)} in time.`; })();
    if (!h) return `No new crews. ${pc1(st)} on time.`;
    return `Sign ${h} crew${h > 1 ? "s" : ""}${by ? " by " + by : ""}. ${pc1(st)} to ${pc1(fl)}.`;
  }
  function sumLedger() {
    const P2 = root.TerryPlan2025; if (!P2 || !P2.city) return "";
    const c = P2.city, money = v => (v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000) + "k");
    const hires = P2.depts.reduce((s, x) => s + x.hire.reduce((a, v) => a + v, 0), 0);
    return `${hires} hire${hires === 1 ? "" : "s"}, ${money(c.cost)}, ${pc1(c.ontime)} on time.`;
  }

  // :: the parts of a Roost body
  function parts(body) {
    return { fail: body.querySelector(".tt-top"), pred: body.querySelector("section.pred"), fly: body.querySelector("section.flyp"), ledger: body.querySelector("section.ledger") };
  }
  const ctlBtn = (k, open) => `<button type="button" class="fold-chev" data-fold="${k}" aria-expanded="${open}" aria-label="${open ? "Fold" : "Open"} ${esc(NAME[k])}">${chev()}</button>`;
  const sumBtn = (k, txt) => `<button type="button" class="fold-sum" data-fold-sum="${k}" title="Show it on the screen">${esc(txt)}</button>`;
  // put the chevron at the head of each section and the summary line right after its heading (once per section)
  function dress(body) {
    const r = roostOf(body); if (!r || !r.escape || body.querySelector("#tttop")) return;   // a Roost still being chased is left alone
    const p = parts(body), f = R().foldOf(r.id);
    if (p.fail && !body.querySelector(".fold-hd")) {
      const hd = doc.createElement("div"); hd.className = "fold-hd"; hd.dataset.k = "fail";
      hd.innerHTML = `${ctlBtn("fail", true)}<h3 class="fold-t"><span class="bw">Flip</span></h3>${sumBtn("fail", sumFail(r))}`; p.fail.before(hd);
    }
    const head = { pred: p.pred && p.pred.querySelector(".gh"), fly: p.fly && p.fly.querySelector(".fw-h") };
    for (const k of ["pred", "fly"]) { const hh = head[k]; if (!hh || hh.querySelector(".fold-chev")) continue;
      hh.insertAdjacentHTML("afterbegin", ctlBtn(k, true)); const h2 = hh.querySelector("h2"); if (h2) h2.insertAdjacentHTML("afterend", sumBtn(k, k === "pred" ? sumPred(r) : sumFly(r))); }
    for (const k of ["fail", "pred", "fly"]) set(body, k, !!f[k], true);
  }
  // the flyway folds with its ending (the verdict and Terry's bill), so the whole #flysec block is the target
  function target(body, k) { const p = parts(body); return k === "fly" ? (p.fly && p.fly.parentNode !== body ? p.fly.parentNode : p.fly) : p[k]; }
  function ledgerEl() { return doc.querySelector("#ledger"); }
  function ledgerOwner() { const L = root.TerryLedger; return L && L.where === "bottom" ? St().activeRoost : null; }
  // the shared shape of a fold: the section shrinks to its heading line (240 ms or less, exponential ease out), then the rest hides
  const busy = new WeakMap();
  async function animate(el, fold) {
    if (!el || reduced() || !el.isConnected || el.offsetParent === null) { el && el.classList.toggle("is-folded", fold); return; }
    const t = (busy.get(el) || 0) + 1; busy.set(el, t);
    const from = el.getBoundingClientRect().height; el.classList.toggle("is-folded", fold); const to = el.getBoundingClientRect().height;
    el.classList.remove("is-folded");   // the content stays visible while the box moves; the class lands at the end
    el.style.overflow = "clip"; el.style.height = from + "px"; void el.offsetHeight;
    el.style.transition = "height 220ms cubic-bezier(.16,1,.3,1)"; el.style.height = to + "px";
    await new Promise(res => setTimeout(res, 230));
    if (busy.get(el) !== t) return;
    el.style.transition = ""; el.style.height = ""; el.style.overflow = ""; el.classList.toggle("is-folded", fold);
  }
  function syncCtl(scope, k, fold) {
    scope.querySelectorAll(`[data-fold="${k}"]`).forEach(b => { b.setAttribute("aria-expanded", String(!fold)); b.setAttribute("aria-label", `${fold ? "Open" : "Fold"} ${NAME[k]}`); });
    scope.querySelectorAll(`[data-fold-sum="${k}"]`).forEach(b => { b.tabIndex = fold ? 0 : -1; });
  }
  function set(body, k, fold, instant) {
    const el = target(body, k); if (!el) return;
    const hd = k === "fail" ? body.querySelector(".fold-hd") : null; if (hd) hd.classList.toggle("is-folded", fold);
    syncCtl(hd || el, k, fold);
    if (instant) el.classList.toggle("is-folded", fold); else animate(el, fold);
  }
  function setLedger(fold, instant) {
    const el = ledgerEl(); if (!el) return; syncCtl(el, "ledger", fold);
    if (instant) el.classList.toggle("is-folded", fold); else animate(el, fold);
  }
  const activeBody = () => [...doc.querySelectorAll("#rbodies > .rbody")].find(b => !b.hidden) || null;
  function toggle(k, fold, body) {
    if (k === "echo") { const el = echoEl(); if (!el) return null; if (fold == null) fold = !echoFold; echoFold = fold; syncCtl(el, "echo", fold); animate(el, fold); return fold; }
    if (k === "ledger") { const id = ledgerOwner(); if (fold == null) fold = !R().foldOf(id).ledger; R().setFold(id, { ledger: fold }); setLedger(fold); return fold; }
    body = body || activeBody(); const r = roostOf(body); if (!r) return null;
    if (fold == null) fold = !R().foldOf(r.id)[k]; R().setFold(r.id, { [k]: fold }); set(body, k, fold); return fold;
  }
  // the keys that are on the page right now, for Fold all / Open all
  function present() {
    const b = activeBody(), r = roostOf(b), out = [];
    if (r && !b.querySelector("#tttop")) for (const k of ["fail", "pred", "fly"]) if (target(b, k)) out.push(k);
    const Ec = echoEl(); if (Ec && Ec.offsetParent !== null) out.push("echo");
    const L = ledgerEl(); if (L && L.isConnected && (L.closest("#terrytory .rbody") ? !L.closest(".rbody").hidden : true)) out.push("ledger");
    return out;
  }
  function all(fold) {
    // the page stays where the viewer is (owner 00:51: Fold all must not jump to the projector): the Flip Side's header is held at the
    // same place on screen while the sections fold or open under it
    const H = doc.querySelector("#terrytory .tt-head"), y0 = H ? H.getBoundingClientRect().top : null;
    const b = activeBody(); present().forEach(k => toggle(k, fold, b));
    syncAll();
    if (H && y0 !== null) { const hold = () => { const d = H.getBoundingClientRect().top - y0; if (Math.abs(d) > 1) root.scrollTo({ top: Math.max(0, scrollY + d), behavior: "auto" }); };
      hold(); requestAnimationFrame(hold); setTimeout(hold, reduced() ? 0 : 420); }
  }
  // watch on screen: the projector sits at the top of the viewport, with the folded lines under it
  function watch() {
    const sc = doc.querySelector("#bar") || doc.querySelector("#screen"); if (!sc) return;   // the cloth's top bar sits at the top of the viewport
    const go = smooth => root.scrollTo({ top: Math.max(0, sc.getBoundingClientRect().top + scrollY - 12), behavior: smooth ? "smooth" : "auto" });
    go(!reduced());
    // one correction, once: if something else moved the page during the glide, snap the cloth back to the top
    setTimeout(() => { const t = sc.getBoundingClientRect().top; if (t < 0 || t > 40) go(false); }, 900);
  }
  function syncAll() {
    const ks = present(), ids = ledgerOwner(), b = activeBody(), r = roostOf(b), f = r ? R().foldOf(r.id) : {}, fl = R().foldOf(ids);
    const folded = k => (k === "ledger" ? !!fl.ledger : k === "echo" ? echoFold : !!f[k]);
    const TT = doc.querySelector("#terrytory"), rk = ks.filter(k => k !== "ledger" && k !== "echo");
    if (TT) TT.classList.toggle("watching", rk.length > 0 && rk.every(folded));   // watch on screen: everything folded, the lines sit in one strip
    const box = doc.querySelector("#terrytory .fold-all"); if (!box) return;
    box.hidden = !ks.length;
    box.querySelector('[data-all="fold"]').disabled = ks.every(folded);
    box.querySelector('[data-all="open"]').disabled = !ks.some(folded);
  }
  function ensureAll() {
    const head = doc.querySelector("#terrytory .tt-head"); if (!head || head.querySelector(".fold-all")) return;
    const box = doc.createElement("div"); box.className = "fold-all"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Fold the sections");
    box.innerHTML = `<button type="button" data-all="fold">Fold all</button><button type="button" data-all="open">Open all</button>`;
    const rail = head.querySelector(".rail"); if (rail) rail.before(box); else head.appendChild(box);
  }

  // :: preview on the projector, commit on click
  let previewing = null;
  function clearHi() { const hi = doc.querySelector("#askHi"); if (hi) hi.textContent = ""; }
  function hi(dept, months, what) {
    const B = Bus(); if (!B || !dept || !months.length) return;
    const z = Z(), lv = z && z.S ? z.S.lvl : 0; if (lv === 2 || (lv === 1 && z.S.d !== dept)) return;
    B.emit("ask:highlight", { dept, months, what, handled: false, from: "fold" });
  }
  function predMonths(r) {
    const g = r.goal || {}, gm = g.months && g.months.length ? g.months : null, set = new Set();
    for (const p of (r.flip && r.flip.predators) || []) if (p.evidence && p.evidence.verdict === "CONFIRMED") for (const m of (p.place && p.place.months) || gm || []) set.add(m);
    if (!set.size && gm) gm.forEach(m => set.add(m));
    return [...set].sort((a, b) => a - b).map(m => m - 1);
  }
  const deptOf = r => r.dept || (r.depts && r.depts[0]) || null;
  function preview(k) {
    if (previewing === k) return; unpreview(); previewing = k;
    const r = R().get(St().activeRoost);
    if (k === "ledger") { const P2 = root.TerryPlan2025, z = Z(); if (!P2) return; const d = z && z.S && z.S.lvl === 1 ? z.S.d : (P2.depts.slice().sort((a, b) => b.hire.reduce((s, v) => s + v, 0) - a.hire.reduce((s, v) => s + v, 0))[0] || {}).dept;
      const x = P2.depts.find(y => y.dept === d); if (x) hi(d, x.hire.map((v, m) => (v ? m : -1)).filter(m => m >= 0), "bolt"); return; }
    if (!r) return;
    if (k === "fly") {
      if (r.view === "stay" && !St().compare) { Bus().emit("plan:view", { roostId: r.id, view: "flyway", preview: true }); previewing = "fly:swap"; }
      const hm = hiresOf(r.escape).ms, d = deptOf(r); if (hm[d]) setTimeout(() => hi(d, hm[d], "bolt"), previewing === "fly:swap" ? 950 : 0);
      return;
    }
    hi(deptOf(r), predMonths(r), "bar");
  }
  function unpreview() {
    if (!previewing) return; const was = previewing; previewing = null; clearHi();
    if (was === "fly:swap") { const r = R().get(St().activeRoost); if (r && r.view === "stay") Bus().emit("plan:view", { roostId: r.id, view: "stay", preview: true }); }
  }
  async function commit(k) {
    const r = R().get(St().activeRoost), z = Z(); previewing = null;
    if (k === "ledger") { if (z && z.S.lvl !== 0) { await z.goTo({ lvl: 0 }); await z.settled(); } preview("ledger"); previewing = null; return; }
    if (!r || !z) return;
    if (k === "fly") { if (r.view !== "flyway") R().setView(r.id, "flyway"); const hm = hiresOf(r.escape).ms, d = deptOf(r); if (hm[d]) setTimeout(() => hi(d, hm[d], "bolt"), 950); return; }
    const d = deptOf(r); if (d && (z.S.lvl !== 1 || z.S.d !== d)) { await z.goTo({ lvl: 1, d, m: z.tightest ? z.tightest(d) : 0 }); await z.settled(); }
    hi(d, predMonths(r), "bar");
  }

  // :: wiring
  function refresh() { ensureAll(); doc.querySelectorAll("#rbodies > .rbody[data-r]").forEach(dress); const L = ledgerEl(); if (L) setLedger(!!R().foldOf(ledgerOwner()).ledger, true); syncAll(); }
  function start() {
    const TT = doc.querySelector("#terrytory"); if (!TT) return;
    TT.addEventListener("click", e => {
      const a = e.target.closest("[data-all]"); if (a) { all(a.dataset.all === "fold"); return; }
      const c = e.target.closest("[data-fold]"); if (c) { const k = c.dataset.fold, f = toggle(k, null, c.closest(".rbody[data-r]") || undefined); const was = TT.classList.contains("watching"); syncAll();
        if (f && !was && TT.classList.contains("watching")) setTimeout(watch, reduced() ? 0 : 260);
        // focus follows the control: it stays on the chevron, which keeps its place in the heading
        if (f != null) c.focus(); return; }
      const s = e.target.closest("[data-fold-sum]"); if (s) { commit(s.dataset.foldSum); }
    });
    const on = e => { const s = e.target.closest && e.target.closest("[data-fold-sum]"); if (s && s.closest(".is-folded")) preview(s.dataset.foldSum); };
    const off = e => { const s = e.target.closest && e.target.closest("[data-fold-sum]"); if (s && !(e.relatedTarget && s.contains(e.relatedTarget))) unpreview(); };
    TT.addEventListener("pointerover", on); TT.addEventListener("focusin", on); TT.addEventListener("pointerout", off); TT.addEventListener("focusout", off);
    // the ledger lives at the page foot after a chase: same controls there
    doc.addEventListener("click", e => { if (TT.contains(e.target)) return; const c = e.target.closest("#ledger [data-fold]"); if (c) { toggle("ledger"); syncAll(); c.focus(); return; } const s = e.target.closest("#ledger [data-fold-sum]"); if (s) commit("ledger"); });
    doc.addEventListener("pointerover", e => { if (!TT.contains(e.target)) { const s = e.target.closest && e.target.closest("#ledger.is-folded [data-fold-sum]"); if (s) preview("ledger"); } });
    doc.addEventListener("pointerout", e => { if (!TT.contains(e.target)) { const s = e.target.closest && e.target.closest("#ledger [data-fold-sum]"); if (s) unpreview(); } });
    const B = Bus(); if (!B) return;
    ["roost:created", "roost:activated", "roost:closed", "proj:idle"].forEach(ev => B.on(ev, () => setTimeout(refresh, 60)));
    refresh();
  }
  root.TerryFold = { refresh, all, toggle, watch, sumFail, sumPred, sumFly, sumLedger, KEYS };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => setTimeout(start, 0)); else setTimeout(start, 0);
})(typeof window !== "undefined" ? window : globalThis);
