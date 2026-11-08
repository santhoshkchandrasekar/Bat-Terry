/* A small-screen notice, in Terry's voice. The page is built for a laptop or desktop window, 1024 px and wider: the projector, the
   ledger and the map need the room. Under 980 px Terry says so once and offers to send the link on for later: the phone's own share
   sheet where there is one, or a ready email to yourself. Nothing is collected or sent by the page itself. */
(function () {
  "use strict";
  const MQ = "(max-width: 979px)";
  let seen = false; try { seen = sessionStorage.getItem("terry.narrow") === "1"; } catch (e) {}
  const url = () => location.href.split("#")[0];
  function show(force) {   // force: the window was just made narrow, so it shows even if closed earlier in this tab (owner 7 Nov)
    if ((seen && !force) || document.getElementById("narrow-note") || !matchMedia(MQ).matches) return;
    const d = document.createElement("div");
    d.id = "narrow-note"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "narrow-h");
    const share = !!navigator.share;
    const mail = `mailto:?subject=${encodeURIComponent("Bat-Terry: open on a laptop")}&body=${encodeURIComponent("Boston's 311 crew planner, Bat-Terry. Best on a laptop or desktop:\n" + url())}`;
    // owner 7 Nov: a little Terry squints at a tiny screen, flips and hangs head-down from its stand so his weight pulls it down and bigger, then sits beside it to watch
    d.innerHTML = `<div class="nn-card"><div class="nn-top"><p class="nn-k">Terry</p><svg class="nn-bat" viewBox="0 0 160 70" aria-hidden="true">
        <g class="nb-scr"><rect class="nb-frame" x="113" y="6" width="24" height="17" rx="2.5"/><rect class="nb-glass" x="115" y="8" width="20" height="13" rx="1.2"/>
          <g class="nb-bars"><rect x="118" y="14.5" width="2.6" height="5" rx=".6"/><rect x="122.2" y="12.5" width="2.6" height="7" rx=".6"/><rect x="126.4" y="10.5" width="2.6" height="9" rx=".6"/><rect x="130.6" y="13.5" width="2.6" height="6" rx=".6"/></g>
          <path class="nb-line" d="M117.5 13.5 L121.5 11.5 L125.5 10 L129.5 11 L133.5 9"/><rect class="nb-stand" x="123.5" y="23" width="3" height="3"/><rect class="nb-stand" x="120.5" y="25" width="9" height="1.6" rx=".8"/></g>
        <g class="nb-fly"><g class="nb-turn">
          <g class="nb-wings"><path class="nb-wing nb-wl" d="M-3.5 -2.5 Q-9 -9 -16 -5 Q-13 -2.5 -12.5 1 Q-9.5 -1.2 -8.5 2 Q-6.2 -.5 -3.5 3 Z"/>
          <path class="nb-wing nb-wr" d="M3.5 -2.5 Q9 -9 16 -5 Q13 -2.5 12.5 1 Q9.5 -1.2 8.5 2 Q6.2 -.5 3.5 3 Z"/></g>
          <path class="nb-feet" d="M-1.8 4.6 V7.8 M1.8 4.6 V7.8"/>
          <ellipse class="nb-body" cx="0" cy="0" rx="4.6" ry="5.8"/><circle class="nb-body" cx="0" cy="-6.2" r="4.4"/>
          <path class="nb-body" d="M-4 -8 L-2.6 -13.6 L-.9 -9.4 Z M4 -8 L2.6 -13.6 L.9 -9.4 Z"/>
          <g class="nb-eyes nb-open"><circle cx="-1.7" cy="-6.6" r="1.55" fill="#FFF8EE"/><circle cx="1.7" cy="-6.6" r="1.55" fill="#FFF8EE"/><circle cx="-1.4" cy="-6.4" r=".75" fill="#221B1E"/><circle cx="2" cy="-6.4" r=".75" fill="#221B1E"/></g>
          <g class="nb-eyes nb-squint"><path d="M-3 -6.6 h2.4 M.6 -6.6 h2.4"/></g>
          <g class="nb-eyes nb-happy"><path d="M-3 -6 q1.2 -1.6 2.4 0 M.6 -6 q1.2 -1.6 2.4 0"/></g>
          <path class="nb-fang" d="M-.9 -3.4 l.5 1.1 l.5 -1.1 Z"/>
        </g></g>
      </svg></div><h2 id="narrow-h">This one needs a bigger screen</h2>
      <p>Hi, I'm Terry. My projector, my ledger and my map of Boston need a laptop or a desktop to fit. Want me to send you the link, so you can open it there later?</p>
      <div class="nn-acts">${share ? `<button type="button" class="nn-go nn-share">Send me the link</button>` : `<a class="nn-go" href="${mail}">Email me the link</a>`}
      <button type="button" class="nn-alt">Look around anyway</button></div></div>`;
    const st = document.createElement("style");
    st.textContent = `#narrow-note{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(var(--shadow,27,25,22),.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#narrow-note .nn-card{max-width:380px;width:100%;padding:24px 22px 20px;border-radius:8px;background:var(--paper,#FFFDF9);color:var(--ink,#1B1916);box-shadow:0 18px 50px rgba(0,0,0,.3)}
#narrow-note .nn-k{margin:0 0 6px;font:600 11px/1 var(--ui,system-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3,#6B655D)}
#narrow-note h2{margin:0 0 10px;font:400 26px/1.15 var(--display,Georgia,serif)}
#narrow-note p{margin:0 0 18px;font:15px/1.5 var(--ui,system-ui);color:var(--ink2,#4A453F)}
#narrow-note .nn-acts{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
#narrow-note .nn-go{display:inline-flex;align-items:center;height:40px;padding:0 18px;border:0;border-radius:20px;background:var(--ink,#1B1916);color:var(--paper,#FFFDF9);font:600 14px var(--ui,system-ui);cursor:pointer;text-decoration:none}
#narrow-note .nn-alt{height:40px;padding:0 6px;border:0;background:none;color:var(--ink2,#4A453F);font:500 14px var(--ui,system-ui);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
#narrow-note .nn-go:focus-visible,#narrow-note .nn-alt:focus-visible{outline:2px solid var(--focus,#2B5A86);outline-offset:3px}
#narrow-note .nn-top{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin:-8px 0 2px}
#narrow-note .nn-top .nn-k{margin-bottom:12px}
#narrow-note .nn-bat{width:160px;height:70px;flex:none;overflow:visible}
#narrow-note .nb-frame{fill:#2B2328}#narrow-note .nb-glass{fill:#F3E9DA}#narrow-note .nb-stand{fill:#2B2328}
#narrow-note .nb-bars rect{fill:#6E7F95}#narrow-note .nb-line{fill:none;stroke:#C9773E;stroke-width:.9;stroke-linecap:round;stroke-linejoin:round}
#narrow-note .nb-body,#narrow-note .nb-wing{fill:#221B1E}#narrow-note .nb-fang{fill:#FFF8EE}
#narrow-note .nb-feet{fill:none;stroke:#221B1E;stroke-width:1.2;stroke-linecap:round}
#narrow-note .nb-squint path,#narrow-note .nb-happy path{fill:none;stroke:#FFF8EE;stroke-width:.95;stroke-linecap:round}
#narrow-note .nb-scr{transform-box:view-box;transform-origin:125px 6px;animation:nbScr 8s ease-in-out infinite}
#narrow-note .nb-bars rect{transform-box:fill-box;transform-origin:50% 100%;animation:nbBars 8s ease-in-out infinite}
#narrow-note .nb-bars rect:nth-child(2){animation-delay:.12s}#narrow-note .nb-bars rect:nth-child(3){animation-delay:.24s}#narrow-note .nb-bars rect:nth-child(4){animation-delay:.36s}
#narrow-note .nb-fly{animation:nbFly 8s ease-in-out infinite}
#narrow-note .nb-turn{animation:nbTurn 8s ease-in-out infinite}
#narrow-note .nb-wings{transform-origin:0px 0px;animation:nbFold 8s ease-in-out infinite}
#narrow-note .nb-wing{transform-origin:0px 0px;animation:nbFlap .32s ease-in-out infinite alternate}
#narrow-note .nb-eyes{animation:8s step-end infinite}
#narrow-note .nb-open{animation-name:nbOpen}#narrow-note .nb-squint{animation-name:nbSquint}#narrow-note .nb-happy{animation-name:nbHappy}
@keyframes nbFlap{from{transform:scaleY(1)}to{transform:scaleY(.3)}}
@keyframes nbFly{
  0%{transform:translate(-14px,32px);opacity:0}4%{opacity:1}
  18%{transform:translate(98px,30px)}26%{transform:translate(100px,31px)}33%{transform:translate(99px,30px)}
  42%{transform:translate(125px,44px)}48%,52%{transform:translate(125px,36px)}
  66%,74%{transform:translate(125px,56px)}
  82%{transform:translate(84px,44px)}93%{transform:translate(84px,43px);opacity:1}100%{transform:translate(84px,44px);opacity:0}}
@keyframes nbTurn{0%,42%{transform:rotate(0deg) scale(1.15)}48%,74%{transform:rotate(180deg) scale(1.15)}82%,100%{transform:rotate(0deg) scale(1.15)}}
@keyframes nbFold{0%,45%{transform:scaleX(1)}50%,72%{transform:scaleX(.42)}78%,100%{transform:scaleX(1)}}
@keyframes nbScr{0%,52%{transform:scale(1);opacity:1}66%,93%{transform:scale(2);opacity:1}100%{transform:scale(2);opacity:0}}
@keyframes nbBars{0%,64%{transform:scaleY(.25)}76%,95%{transform:scaleY(1)}100%{transform:scaleY(.25)}}
@keyframes nbOpen{0%{opacity:1}24%{opacity:0}42%{opacity:1}70%{opacity:0}}
@keyframes nbSquint{0%{opacity:0}24%{opacity:1}42%{opacity:0}}
@keyframes nbHappy{0%{opacity:0}70%{opacity:1}100%{opacity:1}}
@media (prefers-reduced-motion:reduce){#narrow-note .nb-fly,#narrow-note .nb-turn,#narrow-note .nb-wings,#narrow-note .nb-wing,#narrow-note .nb-scr,#narrow-note .nb-bars rect,#narrow-note .nb-eyes{animation:none}
  #narrow-note .nb-fly{transform:translate(84px,44px)}#narrow-note .nb-turn{transform:scale(1.15)}#narrow-note .nb-scr{transform:scale(2)}#narrow-note .nb-open,#narrow-note .nb-squint{opacity:0}#narrow-note .nb-happy{opacity:1}}`;
    d.prepend(st);
    document.body.appendChild(d);
    const go = d.querySelector(".nn-go"), alt = d.querySelector(".nn-alt");
    const close = () => { seen = true; try { sessionStorage.setItem("terry.narrow", "1"); } catch (e) {} d.remove(); };
    const sh = d.querySelector(".nn-share");
    if (sh) sh.addEventListener("click", async () => { try { await navigator.share({ title: "Bat-Terry", text: "Boston's 311 crew planner. Open it on a laptop or desktop.", url: url() }); close(); } catch (e) { /* closed the sheet: stay */ } });
    else go.addEventListener("click", () => setTimeout(close, 300));
    alt.addEventListener("click", close);
    const foc = [go, alt];
    d.addEventListener("keydown", e => {
      const k = e.key;
      if (k === "Escape") close();
      if (k === "Tab") { e.preventDefault(); const i = foc.indexOf(document.activeElement); foc[(i + (e.shiftKey ? foc.length - 1 : 1)) % foc.length].focus(); }
    });
    setTimeout(() => go.focus(), 30);
  }
  function hideIfWide() { const d = document.getElementById("narrow-note"); if (d && !matchMedia(MQ).matches) d.remove(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => show()); else show();
  try { matchMedia(MQ).addEventListener("change", e => { hideIfWide(); show(!!(e && e.matches)); }); } catch (e) {}
})();
