/* Comparison, projector half: ghost bars for B, a delta strip, A and B tiles, the rail on the fabric and the "What differs" plate in the Roost.
 * Driven by TerryBus compare:open and compare:close. All numbers come from the scenarios TerryRoost.scenario built from the model's own runs. */
(function (root) {
  "use strict";
  const Bus = root.TerryBus, R = root.TerryRoost, PL = root.TerryPlates;
  if (!Bus || !R) return;
  const NS = "http://www.w3.org/2000/svg", MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = s => document.querySelector(s), z = () => root.__zoom, cm = () => root.TerryState && root.TerryState.compare;
  const ic = (n, c, st) => root.TerryArt.ic(n, c, st), pct = v => (v * 100).toFixed(1) + "%", sgn = v => (v > 0.05 ? "+" : v < -0.05 ? "−" : "") + Math.abs(v).toFixed(1);
  let ov = null, token = 0;

  // named like the Almanac's compare rows (owner 08:29): the plan that wins on time, by name, never a bare letter
  const winName = (A, B) => { const a = shortLabel(A.label), b = shortLabel(B.label); return a === b ? [A.label, B.label] : [a, b]; };
  const winnerLine = (A, B) => { const d = (B.windowOntime - A.windowOntime) * 100, [a, b] = winName(A, B); return Math.abs(d) < 0.05 ? "Same in window" : d > 0 ? `${b} +${d.toFixed(1)} pts` : `${a} +${(-d).toFixed(1)} pts`; };
  const winnerTip = (A, B) => { const d = (B.windowOntime - A.windowOntime) * 100, [a, b] = winName(A, B); return Math.abs(d) < 0.05 ? "Same result in the window" : d > 0 ? `${b} wins by ${d.toFixed(1)} points in the window` : `${a} wins by ${(-d).toFixed(1)} points in the window`; };
  const shortLabel = l => String(l).replace(/^Roost\s*\d+\s*[\u00b7.:-]\s*/i, "").replace(/\s+plan$/i, "") || String(l);   // "Roost 1 · Original plan" -> "Original"
  const sameDept = (A, B) => A.dept === B.dept && A.depts.length === 1 && B.depts.length === 1;
  const fullPlan = (zz, s) => { const p = Object.assign({}, zz.basePlan); p[s.dept] = s.plan; return p; };

  async function open(p) {
    const A = p.a, B = p.b, zz = z(), my = ++token; if (!zz || !A || !B) return;
    document.body.classList.add("cmp-on");
    // the screen shows A at the department level; B is drawn over it
    if (sameDept(A, B)) {
      await zz.settled(); if (zz.S.lvl !== 1 || zz.S.d !== A.dept) { await zz.goTo({ lvl: 1, d: A.dept, m: zz.tightest(A.dept) }); await zz.settled(); }
      if (my !== token) return; await zz.settleGoal(zz.goalSpec, fullPlan(zz, A), 400);
    } else { await zz.settled(); if (zz.S.lvl !== 0) { await zz.goTo({ lvl: 0 }); await zz.settled(); } }
    if (my !== token) return; await zz.relayout(260); if (my !== token) return; draw(); plate(A, B); syncToggle();
  }
  function syncToggle() { document.querySelectorAll("#plantgl button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.w === (cm() ? "both" : (z().planFly === false ? "stay" : "flyway"))))); }
  function draw() {
    const c = cm(), zz = z(), stage = $("#stage"); if (!c || !zz || !zz.G) return; const A = c.a, B = c.b;
    if (!ov) { ov = document.createElement("div"); ov.id = "cmpov"; stage.appendChild(ov); } ov.textContent = "";
    const G = zz.G, same = sameDept(A, B), lvl1 = zz.S.lvl === 1 && zz.S.d === A.dept;
    const barB = $("#bar") ? $("#bar").offsetTop + $("#bar").offsetHeight + 4 : 52;
    ov.insertAdjacentHTML("beforeend", `<div class="crail" style="top:${barB}px" role="group" aria-label="Comparison"><span class="ab" title="${esc(A.label)}"><i>A</i><b>${esc(shortLabel(A.label))}</b></span><button type="button" data-a="swap" aria-label="Swap A and B" title="Swap A and B">${ic("swap")}</button><span class="ab" title="${esc(B.label)}"><i class="b">B</i><b>${esc(shortLabel(B.label))}</b></span><button type="button" data-a="close" aria-label="Close comparison" title="Close comparison">${ic("x")}</button><span class="note" title="${esc(winnerTip(A, B))}" aria-label="${esc(winnerTip(A, B))}">${winnerLine(A, B)}</span></div>`);
    if (same && lvl1) {
      const s = zz.scale1(A.dept), base = G.z1.base, I = zz.info[A.dept], svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "gh"); svg.setAttribute("width", G.x1 + 10); svg.setAttribute("height", base + 120);
      for (let m = 0; m < 12; m++) {
        const haveA = I.months[m].have, dB = (B.plan.crews[m] + B.plan.seasonal[m]) - (A.plan.crews[m] + A.plan.seasonal[m]), hB = Math.max(0, (haveA + dB) * s);
        const r = document.createElementNS(NS, "rect"); r.setAttribute("x", zz.colX(m) + G.bo + 4); r.setAttribute("y", base - hB - 4); r.setAttribute("width", G.bw); r.setAttribute("height", Math.max(1, hB));
        r.setAttribute("fill", "none"); r.setAttribute("stroke", "#14171C"); r.setAttribute("stroke-width", "2"); r.setAttribute("rx", "1"); svg.appendChild(r);
      }
      ov.appendChild(svg);
      const y = base + 26, strip = document.createElement("div"); strip.className = "dstrip"; strip.style.left = zz.colX(0) + "px"; strip.style.top = y + "px"; strip.setAttribute("role", "list"); strip.setAttribute("aria-label", "B minus A, on time by month");
      for (let m = 0; m < 12; m++) {
        const d = (B.ontime[m] - A.ontime[m]) * 100, sp = document.createElement("span"); sp.style.width = G.mw + "px"; sp.textContent = Math.abs(d) < 0.05 ? "" : sgn(d); sp.className = (d > 0.05 ? "up" : d < -0.05 ? "dn" : "") + (A.window.months.includes(m + 1) ? " w" : "");
        sp.title = `${MON3[m]}: A ${pct(A.ontime[m])} · B ${pct(B.ontime[m])} · ${sgn(d)}`; sp.setAttribute("role", "listitem"); strip.appendChild(sp);
      }
      ov.appendChild(strip); 
    }
  }
  function plate(A, B) {
    const body = document.querySelector(".rbody:not([hidden])"); if (!body) return; const old = body.querySelector("#diffplate"); if (old) old.remove();
    const v = body.querySelector('[data-id="verdplate"]'); if (!v) return; v.classList.add("cmpoff"); v.insertAdjacentHTML("afterend", PL.diffPlate(A, B, "11"));
  }
  function close() {
    token++; document.body.classList.remove("cmp-on"); if (ov) { ov.remove(); ov = null; } if (z() && z().relayout) z().relayout(200);
    document.querySelectorAll("#diffplate").forEach(n => n.remove()); document.querySelectorAll(".verd.cmpoff").forEach(n => n.classList.remove("cmpoff"));
    if (root.TerryProj && root.TerryProj.reproject) root.TerryProj.reproject(); syncToggle();
  }
  Bus.on("compare:open", open); Bus.on("compare:close", close);
  Bus.on("screen:draw", () => { if (cm()) draw(); }); Bus.on("screen:level", () => { if (cm()) draw(); });
  document.addEventListener("click", e => {
    const b = e.target.closest("#cmpov .crail button"); if (!b) return; const c = cm(); if (!c) return;
    if (b.dataset.a === "close") R.closeCompare(); else R.openCompare(c.b, c.a, { quiet: true });
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && cm() && !e.defaultPrevented) R.closeCompare(); });
  root.TerryCompare = { get active() { return !!cm(); } };
})(window);
