/* Terry's vocabulary reads apart from ordinary words (FEEDBACK_NOV4_1808 item 10): one treatment for every term in running text,
 * the page's serif in italic with a fine dotted underline, and a one-line definition on hover or keyboard focus (also the accessible description).
 *
 *   TerryTerms.term(text) -> HTML    escape a plain string and wrap its terms (for code that writes HTML)
 *   TerryTerms.apply(node)           wrap the terms in a rendered node's text
 * The page's running text is watched (The Flip Side, Echolocation, the ledger, the projector callout, Ping's answers, the leaves) and
 * wrapped as it is written. Never inside buttons, links, headings, nav or form labels, which already carry the name.
 */
(function (root) {
  "use strict";
  const doc = document;
  // the glossary's words, cut to one line each (kb_glossary.md has the long form)
  const DEFS = {
    "the-flip-side": ["The Flip Side", "The plan section: your goal flipped, its predators, the flyway."],
    "chase-it": ["Chase it", "Give Terry a goal; he flips it and hunts its predators."],
    predator: ["Predator", "A specific way your goal could fail, tested on 2024 data."],
    flyway: ["Flyway", "Terry's cheapest crew plan that gets past the predators."],
    echolocation: ["Echolocation", "Testing an idea against real records; also the neighborhood equity map."],
    roost: ["Roost", "A plan Terry brought back. He keeps up to three."],
    terrytory: ["Terrytory", "The resident side: reports, the message stream and alerts."],
    dusk: ["Dusk", "The last day to sign a crew that still helps in time."],
    ping: ["Ping", "Ask Terry anything from the dock at the bottom of the page."],
    flip: ["The flip", "Your goal turned upside down: the year it went wrong."],
    budgeterry: ["BUDGETerry", "The year's crew budget, drained month by month."],
  };
  const RE = /\b(BUDGETerry|The Flip Side|Chase it|[Pp]redators?|[Ff]lyways?|[Ee]cholocation|Roosts?|[Tt]errytory|Dusk|Ping(?= Terry\b|\b)|[Tt]he flip\b(?! side))/g;
  const termOf = w => { const t = w.toLowerCase(); if (t === "the flip side") return "the-flip-side"; if (t === "chase it") return "chase-it"; if (t.startsWith("predator")) return "predator"; if (t.startsWith("flyway")) return "flyway";
    if (t.startsWith("roost")) return "roost"; if (t === "the flip") return "flip"; if (t === "budgeterry") return "budgeterry"; return DEFS[t] ? t : null; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SKIP = "button, a, h1, h2, h3, h4, h5, h6, nav, label, input, textarea, select, th, svg, .tw, .sr, .stamp, .tab, .eyebrow, #twpop, #twdefs, .qey, .tk-c1, .tk-c2, .dk-you, .t-you, .dk-src, .ldg-key";
  const HOSTS = "#terrytory, #ontime, .dk-text, .t-text, .leaf .lf-scroll, .lf-sub";
  let defsEl = null, pop = null;

  function ensure() {
    if (defsEl || !doc.body) return;
    defsEl = doc.createElement("div"); defsEl.id = "twdefs"; defsEl.hidden = true;
    defsEl.innerHTML = Object.entries(DEFS).map(([k, v]) => `<span id="twd-${k}">${esc(v[1])}</span>`).join(""); doc.body.appendChild(defsEl);
    pop = doc.createElement("div"); pop.id = "twpop"; pop.setAttribute("role", "tooltip"); pop.hidden = true; doc.body.appendChild(pop);
    const show = t => { const k = t.dataset.tw, d = DEFS[k]; if (!d) return; pop.innerHTML = `<b>${esc(d[0])}</b> ${esc(d[1])}`; pop.hidden = false;
      const r = t.getBoundingClientRect(), w = Math.min(300, innerWidth - 24); pop.style.maxWidth = w + "px";
      const pw = pop.offsetWidth, ph = pop.offsetHeight; const x = Math.max(12, Math.min(innerWidth - pw - 12, r.left + r.width / 2 - pw / 2)); let y = r.top - ph - 8; if (y < 8) y = r.bottom + 8;
      pop.style.left = x + "px"; pop.style.top = y + "px"; };
    const hide = () => { pop.hidden = true; };
    doc.addEventListener("pointerover", e => { const t = e.target.closest && e.target.closest(".tw"); if (t) show(t); });
    doc.addEventListener("pointerout", e => { const t = e.target.closest && e.target.closest(".tw"); if (t && !t.contains(e.relatedTarget)) hide(); });
    doc.addEventListener("focusin", e => { const t = e.target.closest && e.target.closest(".tw"); if (t) show(t); else hide(); });
    doc.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
    addEventListener("scroll", hide, { passive: true });
  }
  const span = (w, k) => `<span class="tw" data-tw="${k}" tabindex="0" aria-describedby="twd-${k}">${esc(w)}</span>`;
  function term(text) { RE.lastIndex = 0; return esc(text).replace(RE, w => { const k = termOf(w); return k ? span(w, k) : w; }); }
  function wrapText(tn) {
    const s = tn.nodeValue; RE.lastIndex = 0; if (!s || !RE.test(s)) return; RE.lastIndex = 0;
    const p = tn.parentElement; if (!p || p.closest(SKIP)) return; const hid = !!p.closest("[aria-hidden='true']");
    const frag = doc.createDocumentFragment(); let last = 0, m;
    while ((m = RE.exec(s))) { const k = termOf(m[0]); if (!k) continue; if (m.index > last) frag.appendChild(doc.createTextNode(s.slice(last, m.index)));
      const sp = doc.createElement("span"); sp.className = "tw"; sp.dataset.tw = k; if (!hid) { sp.tabIndex = 0; sp.setAttribute("aria-describedby", "twd-" + k); }   /* inside a part hidden from assistive tech (the projector): hover only */ sp.textContent = m[0]; frag.appendChild(sp); last = m.index + m[0].length; }
    if (!last) return; if (last < s.length) frag.appendChild(doc.createTextNode(s.slice(last))); tn.replaceWith(frag);
  }
  function apply(node) {
    if (!node) return; ensure();
    if (node.nodeType === 3) { if (node.parentElement && node.parentElement.closest(HOSTS)) wrapText(node); return; }
    if (node.nodeType !== 1 || (node.closest && node.closest(SKIP))) return;
    const w = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: t => (t.parentElement && !t.parentElement.closest(SKIP) && t.parentElement.closest(HOSTS) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(wrapText);
  }
  // watch the page, act only on running-text areas; batch the work once per frame
  let queue = new Set(), raf = 0;
  const flush = () => { raf = 0; const q = [...queue]; queue = new Set(); q.forEach(n => { if (n.isConnected) apply(n); }); };
  function start() {
    ensure();
    const mo = new MutationObserver(ms => { for (const m of ms) { if (m.target.closest && m.target.closest("#chart, #scene, svg, #twpop")) continue; m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) queue.add(n); }); } if (queue.size && !raf) raf = requestAnimationFrame(flush); });
    mo.observe(doc.body, { childList: true, subtree: true });
    apply(doc.body);
  }
  root.TerryTerms = { term, apply, DEFS };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
