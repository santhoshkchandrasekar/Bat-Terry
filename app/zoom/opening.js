/* The opening, first visit only. Owner's vision (redesign/OPENING_SPEC.md) with the director's treatment:
   cold open on a blank projector, Terry drops in and hovers, house lights down to his eyes, the name,
   the pull ("battery" slides out and falls), a beat, the white Terry leaves the mark (the logo), the line,
   house lights up and the brand settles into the header.
   The whole film is a pure function of time t (render(t)), so frames can be shot at exact instants.
   Flags: ?opening=1 forces it, ?opening=0 turns it off, ?opslow=N plays it N times slower, ?ophold=1 holds at t=0.
   Test hooks: window.TerryOpening = { active, seek(t), play(), skip(), T }. Seen key: localStorage "terry.opening". */
(function () {
  "use strict";
  const KEY = "terry.opening";
  const Q = location.search;
  const forced = /[?&]opening=1\b/.test(Q), off = /[?&]opening=0\b/.test(Q);
  const seen = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  const mark = () => { try { localStorage.setItem(KEY, "seen"); } catch (e) {} };
  const api = window.TerryOpening = { active: false, T: 8.1 };
  if (off || (!forced && navigator.webdriver && seen())) return;   // every visit and every reload plays it (owner 17:06); automated checks that marked it seen skip it
  const webgl = (() => { try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } })();
  if (!webgl) { mark(); return; }
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slow = Math.max(1, +((Q.match(/[?&]opslow=([\d.]+)/) || [])[1] || 1));
  mark();

  /* math */
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const sstep = u => u * u * (3 - 2 * u);
  const eOut3 = u => 1 - Math.pow(1 - u, 3), eOut5 = u => 1 - Math.pow(1 - u, 5);
  const eIO3 = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const eIn2 = u => u * u;
  const frac = x => x - Math.floor(x);

  /* timeline (seconds) */
  const B = {
    enter: 0.6, hover: 1.6, ignite: 1.6, down0: 1.82, down1: 2.22,
    name0: 2.22, name1: 3.0,
    pull0: 3.0, hang: 3.65, dip: 3.75, drawer0: 4.15, drawer1: 4.95, drop: 4.95, letgo: 5.2, gone: 6.0,
    beat: 6.4, swoop0: 6.95, apex: 7.5, swoop1: 7.97,
    press1: 7.62, press2: 7.95, slot0: 8.2, slot1: 8.2,
    shake0: 7.62, crew1: 10.0, hold: 10.05, up0: 12.05, glide1: 12.95, lit0: 12.7, up1: 13.5, end: 13.6,
  };
  api.beats = B;

  /* the logo: #i-bat, and Terry's pose that matches it (found by fitting his rendered silhouette to the path) */
  const LOGO = "M12 6.2l1.5 2.2C15 7.2 17.2 6.4 21.3 6.6c-1 1.5-1.2 3-.8 4.6-1.4-.3-2.6.2-3.4 1.4-.9-.9-1.8-1.3-2.9-1.3L12 14.3l-1.9-2.8c-1.1 0-2 .4-2.9 1.3-.8-1.2-2-1.7-3.4-1.4.4-1.6.2-3.1-.8-4.6 4.1-.2 6.3.6 7.8 1.8z";
  const MARK = { pitch: -80, phase: 0.12, unitK: 16.84, cx: 12.046, cy: 9.386 };   // one logo unit = 16.84 rig units; body centre at (12.05, 9.39) in the 24-unit box

  /* DOM: built at parse time so the projector is the very first frame */
  const root = document.createElement("div"); root.id = "opening";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Opening: Bat-Terry");
  const DUST = 26;
  root.innerHTML =
    `<div class="op-l op-world"><div class="op-l op-room"><div class="op-cloth"><i class="op-bulb"></i><i class="op-vign"></i><div class="op-dust">${"<i></i>".repeat(DUST)}</div></div><div class="op-roller"></div></div></div>` +
    `<div class="op-l op-dark"></div><div class="op-l op-terry"></div>` +
    `<div class="op-l op-eyes" aria-hidden="true"><span class="op-eye"><b class="h"></b><b class="c"></b></span><span class="op-eye"><b class="h"></b><b class="c"></b></span></div>` +
    `<div class="op-l op-stage" aria-hidden="true"><i class="op-flash"></i>` +
    `<svg class="op-logo" viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="op-cl"><rect x="-4" y="-4" width="16.2" height="32"/></clipPath><clipPath id="op-cr"><rect x="11.8" y="-4" width="16.2" height="32"/></clipPath></defs><g class="wl" clip-path="url(#op-cl)"><path d="${LOGO}"/></g><g class="wr" clip-path="url(#op-cr)"><path d="${LOGO}"/></g></svg>` +
    `<span class="op-nm">Bat-Terry</span><span class="op-bt">battery</span><span class="op-bt op-cr">'s 311 crews</span>` +
    `<span class="op-sub"><span>The </span><span class="slot">battery</span><span> that keeps Boston</span><span class="ins"><span>'s 311 crews</span></span><span> moving.</span></span></div>` +
    `<i class="op-dv"></i><p class="op-sr">Bat-Terry. The battery that keeps Boston's 311 crews moving.</p>` +
    `<button type="button" class="op-skip">Skip</button>` +
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="op-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter></svg>`;
  const $ = s => root.querySelector(s);
  const el = {
    world: $(".op-world"), dark: $(".op-dark"), terry: $(".op-terry"), eyes: $(".op-eyes"), eye: [...root.querySelectorAll(".op-eye")],
    nm: $(".op-nm"), bt: $(".op-bt"), cr: $(".op-cr"), dv: $(".op-dv"), ins: $(".op-sub .ins"), insTx: $(".op-sub .ins span"), sub: $(".op-sub"), slot: $(".op-sub .slot"), logo: $(".op-logo"), wl: $(".op-logo .wl"), wr: $(".op-logo .wr"), flash: $(".op-flash"),
    skip: $(".op-skip"), dust: [...root.querySelectorAll(".op-dust i")], cloth: $(".op-cloth"), cm: root.querySelector("feColorMatrix"),
  };
  const CITY = !/[?&]opscene=projector\b/.test(Q);
  if (CITY) {
    const pick = sel => { const i = document.querySelector(sel); return i && getComputedStyle(i).display !== "none" ? (i.currentSrc || i.src) : null; };
    // the landing's own photograph for the theme it will open in (the opening runs before the page exists, so read the theme here)
    let night = false; try { night = localStorage.getItem("terry.theme") === "night"; } catch (e) {}
    const src = night ? "assets/boston-night.webp" : "assets/boston-dusk.webp"; void pick;
    root.classList.add("op-city"); $(".op-room").style.backgroundImage = `linear-gradient(180deg, rgba(8,6,5,.28), rgba(8,6,5,.55)), url("${src}")`;
  }
  (document.body || document.documentElement).appendChild(root);
  document.documentElement.classList.add("op-run");
  api.active = true;
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}

  /* ending: natural or skipped */
  let ended = false, raf = 0, bat = null, dbg = null, t0 = null, paused = /[?&]ophold=1\b/.test(Q), lastT = -1;   // ?ophold=1: wait at t=0 for seek() or play() (review shots)
  function cleanup() {
    cancelAnimationFrame(raf);
    removeEventListener("keydown", onKey, true); removeEventListener("resize", onResize);
    try { bat && bat.destroy(); } catch (e) {}
    root.remove();
    document.documentElement.classList.remove("op-run", "op-land", "op-lit", "op-warm", "op-bats");
    api.active = false;
    document.dispatchEvent(new CustomEvent("terry:opening", { detail: "done" }));
  }
  function finish(skipped) {
    if (ended) return; ended = true;
    window.scrollTo(0, 0);
    document.documentElement.classList.add("op-land");
    if (!skipped) { cleanup(); return; }
    root.classList.add("op-out");
    setTimeout(cleanup, 320);
  }
  api.skip = () => finish(true);
  const onKey = e => { if (ended || e.metaKey || e.ctrlKey || /^(Shift|Alt|Control|Meta)$/.test(e.key)) return; e.preventDefault(); finish(true); };
  addEventListener("keydown", onKey, true);
  root.addEventListener("pointerdown", e => { e.preventDefault(); finish(true); });
  root.addEventListener("click", e => { e.preventDefault(); finish(true); });

  /* the wordmark's face: Caveat Brush, set a little larger than the old serif so the two read the same size */
  const NAME_K = 27 / 22, BAT_CY = 10.25 / 24;     // BAT_CY: the bat glyph's body centre, as a share of its 24-unit box
  function nameMetrics(px) {
    const c = document.createElement("canvas").getContext("2d"); c.font = `400 ${px}px "Caveat Brush"`;
    const m = c.measureText("B"), a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
    if (!a) return { base: px * 0.83, cap: px * 0.66 };    // no font metrics: Caveat Brush's own
    return { base: (px - (a + d)) / 2 + a, cap: m.actualBoundingBoxAscent };   // line-height 1: the content box is centred in the line
  }
  /* layout (recomputed on resize) */
  let G = null;
  const range = document.createRange();
  function textRect(node, a, b) { range.setStart(node, a); range.setEnd(node, b); return range.getBoundingClientRect(); }
  function layout() {
    const W = innerWidth, H = innerHeight;
    const F = clamp(Math.min(W * 0.068, H * 0.12), 54, 138), S = F / 22;
    const f = Math.min(F * 0.3, (W * 0.84) / 24.6);
    const sN = F * NAME_K; el.nm.style.fontSize = sN + "px"; el.bt.style.fontSize = f + "px"; el.cr.style.fontSize = f + "px"; el.sub.style.fontSize = f + "px"; el.ins.style.width = "";
    el.nm.style.transform = el.bt.style.transform = el.sub.style.transform = "none"; el.nm.style.letterSpacing = "normal";
    const nmR = el.nm.getBoundingClientRect(), btR = el.bt.getBoundingClientRect(), subR = el.sub.getBoundingClientRect();
    const nmTxt = el.nm.firstChild, terryR = textRect(nmTxt, 4, 9);
    // where the glyphs sit inside our boxes (unscaled): the glide lands the glyphs on the header's glyphs, not box on box
    const inkOf = e => { range.selectNodeContents(e); return range.getBoundingClientRect(); };
    const nI = inkOf(el.nm), sI = inkOf(el.sub);
    const ink = { n: { dx: nI.left - nmR.left, dy: nI.top - nmR.top, w: nI.width }, s: { dx: sI.left - subR.left, dy: sI.top - subR.top, w: sI.width } };
    const slotR = el.slot.getBoundingClientRect(), insR = el.ins.getBoundingClientRect(), crR = el.cr.getBoundingClientRect();
    const cx = W / 2, nameY = H * 0.5;
    // the name is set in Caveat Brush, NAME_K times the scale unit F (as in the header: 27px against the 22px the lockup was drawn for).
    // Its B is centred on nameY; yT and yB are where the old 600 Newsreader box would sit with its cap top and its baseline
    // on the new ones, so everything placed above or below the name keeps its distance from the letters themselves.
    const fm = nameMetrics(sN), nmY = nameY - (fm.base - fm.cap / 2);
    const nm = { x: cx - nmR.width / 2, y: nmY, w: nmR.width, h: sN, fs: sN, yT: nmY + fm.base - fm.cap - F * 0.055, yB: nmY + fm.base - F * 0.735 };
    const terryCx = nm.x + (terryR.left - nmR.left) + terryR.width / 2;
    const logo = { s: 26 * S, x: nm.x - 3 * S - 26 * S, y: nameY - 26 * S * BAT_CY };   // the bat's body on the middle of the B
    const bt = { w: btR.width, h: btR.height, x: terryCx - btR.width / 2 };
    // the line is laid out around where the word lands: straight under Terry, well below the name
    // the line is centred under the name; the word pops out under Terry and has to travel to its own place in it
    const sub = { x: cx - subR.width / 2, y: nm.yB + F * 1.5, w: subR.width, h: subR.height };
    const slot = { x: sub.x + (slotR.left - subR.left), y: sub.y + (slotR.top - subR.top), w: slotR.width, h: slotR.height };
    bt.clip = nm.yB + F * 0.86;                      // the name's lower edge: above it the word is hidden (behind the name)
    bt.y0 = bt.clip - bt.h;                         // tucked behind the name
    bt.yOut = bt.clip + F * 0.06;                   // slid out of the drawer
    bt.yRest = slot.y;                              // where it lands, level: its own place in the line
    // the line is centred at full length; until the crews arrive "moving." sits right after "Boston", and slides right to let them in
    const cr = { w: insR.width, cw: crR.width, h: crR.height, x0: terryCx - crR.width / 2, x: sub.x + (insR.left - subR.left), y: sub.y + (insR.top - subR.top) };
    const ncx = cx, tcx = terryCx;
    const u = logo.s / 24, kMark = (u / MARK.unitK);
    const markAt = { x: logo.x + MARK.cx * u, y: logo.y + MARK.cy * u };
    const eyesHome = { x: ncx, y: nm.yT - F * 0.62 };
    G = { cr, ink, W, H, F, S, f, cx, ncx, nameY, nm, terryCx: tcx, logo, sub, slot, bt, u, kMark, markAt, eyesHome, hoverY: H * 0.33, span: Math.min(W * 0.58, H * 1.0) };
    // the first Terry is big: about 58% of the width across the wings (his span is about 340 rig units)
    G.kBig = G.span / 340;
    G.e22 = null;                                   // eye positions at the end of the house lights (computed lazily)
  }
  const onResize = () => { layout(); HR = null; dvSet = false; lastT = -1; if (paused) render(curT); };
  addEventListener("resize", onResize);

  /* Terry */
  function makeTerry() {
    if (bat || reduced || !window.TerryBat3D || !window.THREE) return;
    try {
      bat = window.TerryBat3D.create(el.terry, { scale: 1, shadow: false, noDrop: true, theme: "light", home: { x: innerWidth / 2, y: innerHeight * 0.33 } });
      dbg = bat._debug; dbg.freeze(true);
      const st = dbg.st; st.nextBlink = st.nextTwitch = st.nextLook = st.nextTilt = 1e9;
    } catch (e) { bat = null; dbg = null; }
  }
  const BASE = 1.15;
  // wing phase, closed form: the beat slows from quick to slow after he drops in; the downbeat lands on the house lights
  const R0 = 5.4, R1 = 1.55, TAU = 0.34;
  const phRaw = t => { const s = Math.max(0, t - B.enter); return R1 * s + (R0 - R1) * TAU * (1 - Math.exp(-s / TAU)); };
  const PH0 = -phRaw(B.down0 - 0.02);
  function pose(o) {
    const st = dbg.st;
    Object.assign(st, { z: 0, roll: 0, sway: 0, pin: 0, fold: 0, mode: "fly", amp: 1, glide: 0, half: 0, tilt: 0, mouth: 0, earTw: 0, blink: 0, headYaw: 0, headPitch: 0, look: 0, lookTo: 0, grip: 0, busy: false, hover: 1 }, o);
    dbg.step(0, 1);
  }
  const eyeMat = () => dbg && dbg.B.eyes[0].m.material;
  function eyesProj() {
    const cam = dbg.camera, out = [];
    for (const ey of dbg.B.eyes) {
      const v = new THREE.Vector3(); ey.m.getWorldPosition(v); v.project(cam);
      out.push({ x: (v.x + 1) / 2 * G.W, y: (1 - v.y) / 2 * G.H });
    }
    return out.sort((a, b) => a.x - b.x);
  }
  // act one pose at time t (dark Terry on the screen)
  function actOne(t) {
    const k = G.kBig;
    const u = seg(t, B.enter, B.hover + 0.25);
    const y = lerp(-G.H * 0.42, G.hoverY, eOut5(u)) + (t > B.hover ? Math.sin((t - B.hover) * 2.4) * 4 * (G.H / 900) : 0);
    const rate = R1 + (R0 - R1) * Math.exp(-Math.max(0, t - B.enter) / TAU);
    pose({ x: G.cx, y, yaw: 0, pitch: lerp(-24, -9, eOut3(u)), sc: k / BASE, rate, phase: frac(phRaw(t) + PH0), t });
  }
  // the white Terry: one clean arc up from the bottom, passing just left of "Bat"; at the apex he is the logo
  function swoopAt(t) {
    const A = G.markAt, k = G.kMark;
    let d = t - B.apex; const hold = 0.017;          // two frames of stillness at the apex
    d = Math.sign(d) * Math.max(0, Math.abs(d) - hold);
    const pre = B.apex - hold - B.swoop0, post = B.swoop1 - B.apex - hold;
    const s = d < 0 ? -Math.pow(-d / pre, 1.25) : Math.pow(d / post, 1.25);    // -1 .. 1, slow at the apex
    const yBot = G.H + G.kBig * 150, yTop = -k * 260;
    const y = s < 0 ? A.y + (yBot - A.y) * -s : A.y - (A.y - yTop) * s;
    const bulge = G.W * 0.13;
    const x = A.x - bulge * s * s;
    const sc = s < 0 ? lerp(1, 2.4, -s) : lerp(1, 0.7, s);
    return { x, y, s, sc, d };
  }
  function actMark(t) {
    const p = swoopAt(t), p2 = swoopAt(t + 1 / 120);
    const vx = p2.x - p.x, vy = p2.y - p.y, sp = Math.hypot(vx, vy);
    const sway = sp > 0.01 ? -Math.atan2(vx, -vy) * 180 / Math.PI : 0;
    const rate = 3.1;
    const flat = sstep(clamp(1 - Math.abs(t - B.apex) / 0.16, 0, 1));
    pose({ x: p.x, y: p.y, yaw: 0, pitch: MARK.pitch, sway, hover: 0, sc: G.kMark * p.sc / BASE, rate: rate * (1 - flat), phase: frac(MARK.phase + rate * p.d), t });
    return p;
  }
  // the white look: cream, shaded by his own light, flattening to a pure silhouette at the apex
  function setWhite(flat) {
    const C = [0.984, 0.953, 0.886], base = lerp(0.5, 1, flat), gain = lerp(4.2, 0, flat), ak = lerp(1.15, 2.2, flat);
    const row = c => `${(c * gain * 0.3).toFixed(4)} ${(c * gain * 0.59).toFixed(4)} ${(c * gain * 0.11).toFixed(4)} 0 ${(c * base).toFixed(4)}`;
    el.cm.setAttribute("values", `${row(C[0])}  ${row(C[1])}  ${row(C[2])}  0 0 0 ${ak.toFixed(3)} 0`);
  }

  /* dust in the projector light (deterministic) */
  const rnd = (() => { let s = 91; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const dustSeed = el.dust.map(() => ({ x: rnd(), y: rnd(), r: 0.6 + rnd() * 1.6, sp: 0.4 + rnd() * 0.8, ph: rnd() * 6.28, a: 0.25 + rnd() * 0.5 }));

  /* set helpers */
  const tf = (e, x, y, s = 1, r = 0) => { e.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)${s !== 1 ? ` scale(${s.toFixed(4)})` : ""}${r ? ` rotate(${r.toFixed(2)}deg)` : ""}`; };
  const op = (e, v) => { e.style.opacity = v <= 0.001 ? "0" : v >= 0.999 ? "1" : v.toFixed(3); };
  function headerRects() {
    // the landing is up: the lockup lands on its brand (logo and name); the line hands over to the landing's own headline
    const L = window.TerryLanding, lb = L && L.active && document.querySelector("#landing .ld-brand");
    if (lb) {
      const i = lb.querySelector("svg.i"), n = lb.querySelector(".nm"); if (!i || !n) return null;
      const rn = n.getBoundingClientRect(); if (!rn.width) return null;
      range.selectNodeContents(n);
      return { landing: true, bw: 0, nI: range.getBoundingClientRect(), i: i.getBoundingClientRect(), n: rn, nFs: parseFloat(getComputedStyle(n).fontSize), sOp: 0 };
    }
    const b = document.querySelector(".hero .brand");
    if (!b) return null;
    const i = b.querySelector("svg.i"), n = b.querySelector(".nm"), s = b.querySelector(".sub");
    if (!i || !n || !s) return null;
    const ri = i.getBoundingClientRect(), rn = n.getBoundingClientRect(), rs = s.getBoundingClientRect(), cs = getComputedStyle(s);
    if (!rn.width) return null;
    const inkOf = e => { range.selectNodeContents(e); return range.getBoundingClientRect(); };
    return { bw: parseFloat(cs.borderLeftWidth) || 0, bc: cs.borderLeftColor, nI: inkOf(n), sI: inkOf(s), i: ri, n: rn, nFs: parseFloat(getComputedStyle(n).fontSize), s: rs, sFs: parseFloat(cs.fontSize), sPad: parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), sOp: parseFloat(cs.opacity) || 1 };
  }
  const mixCol = u => { const a = [251, 243, 226]; return `rgb(${a.map(c => Math.round(lerp(c, 255, u))).join(",")})`; };

  /* the film: everything as a function of t */
  let curT = 0, HR = null, dvSet = false;
  function render(t) {
    curT = t; if (!G) layout();
    const { W, H, F } = G;

    // world: the projector, a slow push-in for the act, the dust drifting in the light
    // the slow push-in for the act; in the city it eases back out as the lights come up, so the picture lands exactly where the landing's is
    const push = 1 + 0.04 * eIO3(seg(t, B.enter, B.down1)) * (CITY ? 1 - eIO3(seg(t, B.beat, B.lit0)) : 1);
    el.world.style.transform = `scale(${push.toFixed(4)})`;
    const lightsDown = eIO3(seg(t, B.down0, B.down1));
    const lightsUp = eIO3(seg(t, B.lit0, B.up1));
    op(el.world, CITY ? (t < B.lit0 ? 1 : 1 - lightsUp) : t < B.down1 + 0.05 ? 1 : 0);
    if (t < B.down1 + 0.05) {
      const cw = el.cloth.clientWidth || W, ch = el.cloth.clientHeight || H;
      dustSeed.forEach((d, i) => {
        const x = (d.x * 0.8 + 0.1) * cw + Math.sin(t * 0.35 * d.sp + d.ph) * 14;
        const y = frac(d.y - t * 0.012 * d.sp) * ch;
        const dx = x / cw - 0.5, dy = y / ch - 0.44, inLight = Math.max(0, 1 - Math.hypot(dx * 1.2, dy * 1.5) * 2.1);
        const tw = 0.6 + 0.4 * Math.sin(t * 1.3 * d.sp + d.ph * 3);
        tf(el.dust[i], x, y, d.r); op(el.dust[i], d.a * inLight * tw * 0.9);
      });
    }
    // house lights: down to black, then up to the page (the page shows through as the dark lifts)
    const DK = CITY ? 0.87 : 1;   // with the city behind, the dark stops short of black (about an eighth of the skyline shows)
    op(el.dark, t < B.lit0 ? DK * lightsDown : DK * (1 - lightsUp));
    root.style.background = t < B.lit0 ? "" : `rgba(11,9,8,${(1 - lightsUp).toFixed(3)})`;
    { const dE = document.documentElement;   // owner 11 Nov: the glide must not share its frames with the page's first paint
      dE.classList.toggle("op-lit", t >= B.up0 - 0.85);     // the page paints again during the still hold, under the opaque film
      dE.classList.toggle("op-warm", t >= B.up0 - 0.45);    // the page's 3D bats draw one frame there (shaders compile in the dark)
      dE.classList.toggle("op-bats", t >= B.glide1); }      // and draw every frame once the lockup has landed (the room is still ~90% dark)

    // Terry, act one
    const actOneOn = bat && t >= B.enter - 0.05 && t <= B.down1 + 0.02;
    const markOn = bat && t >= B.swoop0 && t <= B.swoop1 + 0.02;
    if (actOneOn) {
      actOne(t);
      const ig = sstep(seg(t, B.ignite, B.down0 + 0.1));
      const m = eyeMat(); if (m) { m.emissive && m.emissive.setRGB(1, 0.78, 0.45); m.emissiveIntensity = ig * 1.4; }
      el.terry.style.filter = `brightness(${(1 - lightsDown).toFixed(3)})` + (CITY ? ` drop-shadow(0 0 1.5px rgba(255,214,160,${(0.85 * (1 - lightsDown)).toFixed(3)})) drop-shadow(0 0 14px rgba(255,170,90,${(0.45 * (1 - lightsDown)).toFixed(3)}))` : "");
      el.terry.style.transform = "none";
      op(el.terry, 1 - lightsDown);
    } else if (markOn) {
      if (eyeMat()) eyeMat().emissiveIntensity = 0;
      const p = actMark(t);
      const flat = Math.pow(sstep(clamp(1 - Math.abs(t - B.apex) / 0.16, 0, 1)), 1.4);
      setWhite(flat);
      el.terry.style.filter = "url(#op-white)";
      // the press: a measured squash and stretch (0.96, 1.08) about his body brings his outline onto the glyph (best fit to #i-bat)
      el.terry.style.transformOrigin = `${G.markAt.x.toFixed(1)}px ${G.markAt.y.toFixed(1)}px`;
      el.terry.style.transform = flat > 0.001 ? `scale(${(1 - 0.04 * flat).toFixed(4)},${(1 + 0.08 * flat).toFixed(4)})` : "none";
      op(el.terry, 1);
    } else op(el.terry, 0);

    // the eyes
    const E = eyesAt(t);
    if (E) {
      el.eyes.style.transform = `translate3d(${E.x.toFixed(2)}px,${E.y.toFixed(2)}px,0) rotate(${E.r.toFixed(2)}deg)`;
      el.eyes.style.filter = E.blur > 0.05 ? `blur(${E.blur.toFixed(2)}px)` : "none";
      op(el.eyes, E.o);
      el.eye.forEach((e, i) => { const s = i ? 1 : -1; e.style.transform = `translate3d(${(s * E.gap / 2).toFixed(2)}px,0,0) rotate(${(-s * 14).toFixed(1)}deg)`; const sz = E.size + "px"; e.style.width = e.style.height = sz; e.style.marginLeft = e.style.marginTop = (-E.size / 2) + "px"; });
    } else op(el.eyes, 0);

    typeAt(t);
    if (t >= B.up1) document.documentElement.classList.add("op-land");
    lastT = t;
  }

  // eye pair: centre, gap, size, rotation, opacity, blur
  function eyesAt(t) {
    if (t < B.ignite) return null;
    const ig = sstep(seg(t, B.ignite, B.down0 + 0.12));
    if (t <= B.down1) {
      if (!dbg) return { x: G.cx, y: G.hoverY - G.kBig * 6, gap: G.kBig * 22, size: G.kBig * 4.6, r: 0, o: ig, blur: 0 };
      const P = eyesProj();
      return { x: (P[0].x + P[1].x) / 2, y: (P[0].y + P[1].y) / 2, gap: Math.hypot(P[1].x - P[0].x, P[1].y - P[0].y), size: G.kBig * 4.6, r: 0, o: ig, blur: 0 };
    }
    if (!G.e22) {
      if (dbg) { actOne(B.down1); const P = eyesProj(); G.e22 = { x: (P[0].x + P[1].x) / 2, y: (P[0].y + P[1].y) / 2, gap: Math.hypot(P[1].x - P[0].x, P[1].y - P[0].y) }; if (curT !== B.down1) actOne(clamp(curT, B.enter, B.down1)); }
      else G.e22 = { x: G.cx, y: G.hoverY - G.kBig * 6, gap: G.kBig * 22 };
    }
    const e0 = G.e22, F = G.F;
    // after the lights: the eyes settle a little smaller and higher, above the name (the camera eases back)
    const settle = eIO3(seg(t, B.down1, B.name1));
    const home = G.eyesHome, gapH = F * 0.36, sizeH = F * 0.1;
    let x = lerp(e0.x, home.x, settle), y = lerp(e0.y, home.y, settle), gap = lerp(e0.gap, gapH, settle), size = lerp(G.kBig * 4.6, sizeH, settle);
    y += Math.sin((t - B.down1) * 2.2) * F * 0.02 * (1 - seg(t, B.pull0, B.hang));
    let r = 0, o = 1, blur = 0;
    // the pull: drift down around the word and hang under "Terry", turning upside down on the way
    const hangX = G.bt.x + G.bt.w * HANG_U, hangY = G.nm.yB + F * 1.2;
    if (t >= B.pull0) {
      const u = eIO3(seg(t, B.pull0, B.hang));
      // around the end of the word, never across it
      const cX = G.nm.x + G.nm.w + F * 1.0, cY = G.nm.yB + F * 0.55, v = 1 - u;
      x = v * v * x + 2 * v * u * cX + u * u * hangX; y = v * v * y + 2 * v * u * cY + u * u * hangY; r = 180 * eIO3(seg(t, B.pull0 + 0.04, B.hang));
    }
    if (t >= B.hang) { x = hangX; y = hangY + dipAt(t); }
    if (t >= B.drawer0) { const P = gripAt(Math.min(t, B.letgo)); x = P.x; y = P.y + F * 0.34; }   // hanging off the "ery", riding the word down
    if (t >= B.letgo) {
      // loses his grip and tumbles off the bottom of the frame
      const s = t - B.letgo, g = 2.0 * G.H;
      const P = gripAt(B.letgo), yLet = P.y + F * 0.34;
      y = yLet + 0.5 * g * s * s + 60 * s; x = P.x + 90 * s * (F / 120);
      r = 180 + 520 * s * s + 120 * s;
      blur = clamp(s * 9, 0, 3.2);
      o = 1 - seg(t, B.gone - 0.12, B.gone);
    }
    if (t >= B.gone) return null;
    return { x, y, gap, size, r, o, blur };
  }
  // the word dips under his weight like a spring (damped), then lets go
  const dipAt = t => { if (t < B.hang) return 0; const s = t - B.hang, a = G.F * 0.07; return a * (1 - Math.exp(-s * 9) * Math.cos(s * 26)) * (1 - eIO3(seg(t, B.drawer0, B.drawer0 + 0.18))); };
  const drawerAt = t => eIO3(seg(t, B.drawer0, B.drawer1));
  // gravity, then one small bounce (a quarter of the impact speed), then it lies still on its baseline
  const fallDone = () => B.drop + Math.sqrt(2 * (G.bt.yRest - G.bt.yOut) / (2.2 * G.H));
  const fallAt = t => {
    if (t < B.drop) return 0;
    const g = 2.2 * G.H, d = G.bt.yRest - G.bt.yOut, t1 = fallDone(), s = t - B.drop;
    if (t <= t1) return 0.5 * g * s * s;
    const v = 0.25 * g * (t1 - B.drop), s2 = t - t1, tb = 2 * v / g;
    return s2 < tb ? d - (v * s2 - 0.5 * g * s2 * s2) : d;
  };
  const landed = () => { const t1 = fallDone(); return t1 + 2 * 0.25 * (t1 - B.drop); };
  const tiltAt = t => 0;
  // the battery word. Terry hangs off its right end ("ery"): as it slides out of the name his weight tips it, right end down. It drops
  // that way, lands on its right corner, kicks up and rocks over (left end down a little, then back), and slides slowly to rest in
  // its own place in the line. The word turns about its middle (origin 50% 55%), so its corners are worked out from the turn.
  const HANG_U = 0.8, TIP = 26, TOSS = 2.0;           // where he grips (share of the width), the tip in degrees, seconds from impact to rest
  const rad = d => d * Math.PI / 180;
  const midOf = (x, y) => ({ x: x + G.bt.w / 2, y: y + G.bt.h * 0.55 });
  const tipAt = t => TIP * eIO3(seg(t, B.drawer0 + 0.25, B.drawer1));
  // the point he grips, in the page, for the word at middle m turned r degrees
  const gripOf = (m, r) => { const lx = G.bt.w * (HANG_U - 0.5), ly = G.bt.h * 0.45, a = rad(r); return { x: m.x + lx * Math.cos(a) - ly * Math.sin(a), y: m.y + lx * Math.sin(a) + ly * Math.cos(a) }; };
  // the middle's height when the lowest corner touches the floor (the word's own baseline in the line)
  const restMid = r => { const a = rad(Math.abs(r)); return G.bt.yRest + G.bt.h - (G.bt.w / 2) * Math.sin(a) - G.bt.h * 0.45 * Math.cos(a); };
  function wordAt(t) {
    const { bt } = G;
    if (t < B.drop) { const y = bt.y0 + drawerAt(t) * (bt.yOut - bt.y0) + (t >= B.hang ? dipAt(t) * 0.55 : 0); return { m: midOf(bt.x, y), r: tipAt(t) }; }
    return tossAt(t);
  }
  const gripAt = t => { const w = wordAt(t); return gripOf(w.m, w.r); };
  let T1 = null;
  function tossAt(t) {
    const { H, bt, slot } = G, g = 1.25 * H, s = t - B.drop;
    const m0 = midOf(bt.x, bt.yOut), endX = slot.x + bt.w / 2;
    const rFall = q => TIP + 6 * Math.min(1, q / 0.4);                   // tips a little further on the way down
    const vx = (endX - m0.x) * 0.12;                                      // a slight drift toward its place while it falls
    if (!T1 || T1.g !== G) { let q = 0; while (q < 3 && m0.y + 0.5 * g * q * q < restMid(rFall(q))) q += 0.002; T1 = { g: G, q, vI: g * q, x: m0.x + vx * q, r: rFall(q) }; }
    if (s <= T1.q) return { m: { x: m0.x + vx * s, y: m0.y + 0.5 * g * s * s }, r: rFall(s) };
    // the right corner strikes: it kicks up a little and rocks over, then the rocking dies away
    const q = s - T1.q, e = 0.3, v1 = e * T1.vI, h1 = 2 * v1 / g, v2 = e * v1, h2 = 2 * v2 / g;
    const hop = q < h1 ? v1 * q - 0.5 * g * q * q : q < h1 + h2 ? v2 * (q - h1) - 0.5 * g * (q - h1) * (q - h1) : 0;
    const r = T1.r * Math.exp(-2.6 * q) * Math.cos(2 * Math.PI * 0.9 * q);
    const p = clamp(q / TOSS, 0, 1), xp = 1 - Math.pow(1 - p, 3);
    return { m: { x: lerp(T1.x, endX, xp), y: restMid(r) - Math.max(0, hop) }, r };
  }
  const tiltOld = t => { if (t < B.drop) return 0; const t1 = fallDone(), t2 = landed(); return t <= t1 ? -4 * eOut3(seg(t, B.drop, t1)) : -4 * (1 - eIO3(seg(t, t1, t2))); };

  // the name's ring after the stamp: four jolts, a damped wobble each, a little harder each time, each with a small downward thump
  const JOLTS = [0, 0.33, 0.65, 0.96], JAMP = [0.55, 0.7, 0.85, 1];
  function shakeAt(t) {
    let dx = 0, dy = 0; const A = G.F * 0.026;
    JOLTS.forEach((j, k) => { const q = t - (B.shake0 + j); if (q < 0 || q > 0.6) return; const d = Math.exp(-q * 13) * A * JAMP[k];
      dx += d * Math.sin(q * 2 * Math.PI * 8.5); dy += d * 0.4 * Math.sin(q * 2 * Math.PI * 8.5 + 1.3) + A * JAMP[k] * 0.35 * Math.exp(-q * 22) * (q < 0.02 ? q / 0.02 : 1); });
    return { dx, dy };
  }
  // how far the crews hang out from under the name: a notch after each of the first three jolts (a quick, critically damped give)
  const NOTCH = [0.3, 0.58, 0.82];
  function crewHold(t) {
    let e = 0, r = 0;
    NOTCH.forEach((n, k) => { const q = t - (B.shake0 + JOLTS[k] + 0.03); if (q <= 0) return; const sp = 1 - Math.exp(-q * 20) * (1 + q * 20); e += (n - (k ? NOTCH[k - 1] : 0)) * sp; });
    r = 4 * e;   // the left end holds a moment longer than the right: it hangs a little tipped
    return { e, r };
  }
  // the fall, from the last jolt: free fall with a small kick, the turn growing; it lands on its low corner, hops once, rocks, settles
  let CF = null;
  function crewFall(t) {
    const t0 = B.shake0 + JOLTS[3] + 0.03; if (t < t0) return null;
    const C = G.cr, F = G.F, g = 1.2 * G.H, CW = C.cw, CH = C.h, s = t - t0;
    const yHang = G.bt.clip + F * 0.05, m0 = { x: C.x0 + CW / 2, y: yHang + CH * 0.55 }, mE = { x: C.x + CW / 2 };
    const restM = r => { const a = Math.abs(r) * Math.PI / 180; return C.y + CH - (CW / 2) * Math.sin(a) - CH * 0.45 * Math.cos(a); };
    const v0 = Math.sqrt(g * F * 0.08), rF = q => 4 * NOTCH[2] + 22 * q + 10 * q * q;   // starts at the hang's tip, the loose end leading
    if (!CF || CF.g !== G) { let q = 0; while (q < 3 && m0.y + v0 * q + 0.5 * g * q * q < restM(rF(q))) q += 0.002; CF = { g: G, q, vI: v0 + g * q, r: rF(q), x: 0 }; }
    const tI = CF.q, open = eIO3(clamp((s + 0.1) / (tI * 0.95 + 0.1), 0, 1));
    if (s <= tI) { const xp = eIO3(clamp(s / tI, 0, 1)); return { m: { x: lerp(m0.x, mE.x, xp), y: m0.y + v0 * s + 0.5 * g * s * s }, r: rF(s), open }; }
    const q = s - tI, e = 0.24, v1 = e * CF.vI, h1 = 2 * v1 / g;
    const hop = q < h1 ? v1 * q - 0.5 * g * q * q : 0;
    const r = CF.r * Math.exp(-4.5 * q) * Math.cos(2 * Math.PI * 1.05 * q);
    const xp = eIO3(clamp(s / tI, 0, 1));
    return { m: { x: lerp(m0.x, mE.x, xp), y: restM(r) - Math.max(0, hop) }, r, open: 1, done: q > 1.0 };
  }

  // the type: name, battery, logo and flash, tagline; and the glide to the header
  function typeAt(t) {
    const { F, nm, bt, logo, sub, slot } = G;
    // the name: fades up below the eyes, small and tight, easing to hero size
    const nu = seg(t, B.name0, B.name1), ne = eOut3(nu);
    let nScale = lerp(0.86, 1, ne), nOp = sstep(seg(t, B.name0, B.name0 + 0.5));
    const tight = lerp(-0.035, 0, ne);
    el.nm.style.letterSpacing = Math.abs(tight) < 0.0005 ? "normal" : tight.toFixed(4) + "em";
    const nmW = nm.w + tight * nm.fs * 8;              // nine glyphs, eight gaps
    const dip = t >= B.hang ? dipAt(t) * 0.55 : 0;
    let nx = G.ncx - nmW * nScale / 2, ny = nm.y + (1 - nScale) * nm.h / 2 + (1 - ne) * F * 0.08 + dip, ns = nScale;
    // the battery word: tucked behind the name, slides out like a drawer, drops with gravity and a slight tilt
    let bx = bt.x, by = bt.y0 + dip, bs = 1, br = 0, bo = t >= B.drawer0 ? 1 : 0, clipTop = 0;
    if (t >= B.drawer0) {
      by = bt.y0 + drawerAt(t) * (bt.yOut - bt.y0) + dip;
      clipTop = Math.max(0, (bt.clip + dip) - by);   // hidden while it is still behind the name
      br = tipAt(t);
      if (t >= B.drop) { const k = tossAt(t); bx = k.m.x - bt.w / 2; by = k.m.y - bt.h * 0.55; clipTop = 0; br = k.r; }
    }
    // the slot: once the line has stamped, the fallen word slides up into it, changing into the line's face
    let slotOp = 0;
    if (t >= B.slot0) {
      // it already lies in its place: once the words around it have stamped, it simply becomes part of the line
      bx = slot.x; by = slot.y; br = 0; bo = 0; slotOp = 1;
    }
    el.slot.style.opacity = slotOp.toFixed(3);
    // the line: two soft presses
    const p1 = seg(t, B.press1, B.press1 + 0.2), p2 = seg(t, B.press2, B.press2 + 0.24);
    let sOp = t < B.press1 ? 0 : t < B.press2 ? 0.55 * eOut3(p1) : lerp(0.55, 1, eOut3(p2));
    let sS = t < B.press2 ? lerp(1.06, 1, eOut3(p1)) : lerp(1.025, 1, eOut3(p2));
    const shadowK = t < B.press1 ? 0 : Math.max(1 - p1, t >= B.press2 ? 1 - p2 : 0);
    let subX = sub.x + sub.w * (1 - sS) / 2, subY = sub.y + sub.h * (1 - sS) / 2, subS = sS;
    el.sub.style.textShadow = shadowK > 0.02 ? `0 ${(G.f * 0.06 * shadowK).toFixed(1)}px ${(G.f * 0.12).toFixed(1)}px rgba(0,0,0,${(0.55 * shadowK).toFixed(2)})` : "none";
    // the mark: the logo is stamped at the apex, with a soft flash
    const lOn = t >= B.apex - 0.012;
    let lOp = lOn ? eOut3(seg(t, B.apex - 0.012, B.apex + 0.05)) : 0, lS = lOn ? lerp(1.035, 1, eOut3(seg(t, B.apex, B.apex + 0.2))) : 1;
    let lx = logo.x - logo.s * (lS - 1) / 2, ly = logo.y - logo.s * (lS - 1) / 2;
    const fl = t >= B.apex - 0.01 ? Math.exp(-Math.max(0, t - B.apex) / 0.12) * sstep(seg(t, B.apex - 0.01, B.apex + 0.01)) : 0;
    const fs = logo.s * 3.2;
    el.flash.style.width = el.flash.style.height = fs + "px"; tf(el.flash, logo.x + logo.s / 2 - fs / 2, logo.y + logo.s / 2 - fs / 2); op(el.flash, fl * 0.9);
    el.logo.style.width = el.logo.style.height = logo.s + "px";

    // the shake shakes them loose. The stamp leaves the name ringing: four jolts, each a little harder. Every jolt knocks
    // "'s 311 crews" a notch further out from under Terry (it rides the name's shake while it is still held), and the last one
    // knocks it free: it drops under gravity, turning slowly as the loose end leads, lands on its low corner, rocks and settles
    // into the line while "moving." slides right to make room.
    const SH = shakeAt(t); nx += SH.dx; ny += SH.dy;
    const C = G.cr, CW = C.cw, CH = C.h, hold = crewHold(t);
    let cx = C.x0 + SH.dx * 0.9, cy = lerp(bt.clip - CH, bt.clip + F * 0.05, hold.e) + SH.dy, crR = hold.r + SH.dx / F * 14, crO = hold.e > 0.001 ? 1 : 0, open = 0;
    const FA = crewFall(t);
    if (FA) { cx = FA.m.x - CW / 2; cy = FA.m.y - CH * 0.55; crR = FA.r; crO = FA.done ? 0 : 1; open = FA.open; }
    const crClip = crO ? Math.max(0, bt.clip + SH.dy - cy) : 0, landed = !!(FA && FA.done);
    el.ins.style.width = t >= B.crew1 || landed ? "" : (C.w * open).toFixed(2) + "px";
    el.insTx.style.opacity = landed || t >= B.crew1 ? "1" : "0";
    tf(el.cr, cx, cy, 1, crR); op(el.cr, crO);
    el.cr.style.clipPath = crClip > 0.5 ? `inset(${crClip.toFixed(1)}px 0 0 0)` : "none";

    // house lights up: logo, name and line glide to the header (the battery word is already part of the line)
    let col = 0, flap = 0, dvO = 0;
    if (t >= B.up0) {
      const R = HR || (HR = headerRects()), u = eIO3(seg(t, B.up0, B.glide1)), uL = u, uN = u, uS = u;   // one move: the lockup travels as one piece
      col = eIO3(seg(t, B.lit0, B.up1));
      // a few wing beats, easing out as it settles
      const fu = seg(t, B.up0, B.glide1); flap = 30 * Math.pow(1 - fu, 1.6) * Math.sin(Math.PI * 2 * 3 * eOut3(fu));
      if (R && R.n.height > R.nFs * 1.4) { const k = 1 - u; nOp *= k; lOp *= k; sOp *= k; }   // the header wraps (narrow screen): fade instead of gliding
      else if (R) {
        // name: our box is F tall (line-height 1); the header's is nFs tall
        const K = G.ink, tsN = R.nI.width / K.n.w; nx = lerp(nx, R.nI.left - K.n.dx * tsN, uN); ny = lerp(ny, R.nI.top - K.n.dy * tsN, uN); ns = lerp(1, tsN, uN);
        const tsL = R.i.width / logo.s; lx = lerp(logo.x, R.i.left, uL); ly = lerp(logo.y, R.i.top, uL); lS = lerp(1, tsL, uL);
        if (R.landing) sOp *= 1 - eIO3(seg(t, B.up0, B.up0 + (B.glide1 - B.up0) * 0.7));   // the line fades where it is: the landing's headline takes over
        else { const tsS = R.sI.width / K.s.w; subX = lerp(sub.x, R.sI.left - K.s.dx * tsS, uS); subY = lerp(sub.y, R.sI.top - K.s.dy * tsS, uS); subS = lerp(1, tsS, uS);
        sOp = lerp(1, R.sOp, col); }
        if (R.bw > 0) { if (!dvSet) { dvSet = true; const d = el.dv.style; d.left = R.s.left + "px"; d.top = R.s.top + "px"; d.width = R.bw + "px"; d.height = R.s.height + "px"; d.background = R.bc; } dvO = u * col; }
      }
    }
    if (t >= B.up1) { nOp = 0; lOp = 0; sOp = 0; dvO = 0; }
    op(el.dv, dvO);   // the page's own header shows in this same frame: hand over, never draw both
    const c = mixCol(col);
    el.nm.style.color = c; el.sub.style.color = c; el.logo.style.fill = c;
    tf(el.nm, nx, ny, ns); op(el.nm, nOp);
    tf(el.logo, lx, ly, lS); op(el.logo, lOp);
    const fa = Math.abs(flap) < 0.01 ? null : flap.toFixed(2);
    if (fa) { el.wl.setAttribute("transform", `rotate(${fa} 12 8.6)`); el.wr.setAttribute("transform", `rotate(${-fa} 12 8.6)`); } else { el.wl.removeAttribute("transform"); el.wr.removeAttribute("transform"); }
    tf(el.sub, subX, subY, subS); op(el.sub, sOp);
    tf(el.bt, bx, by, bs, br); op(el.bt, bo);
    el.bt.style.clipPath = clipTop > 0.5 ? `inset(${(clipTop / bs).toFixed(1)}px 0 0 0)` : "none";
  }

  /* reduced motion: about two seconds of fades, no flight */
  function renderReduced(t) {
    if (!G) layout();
    const { F, nm, logo, sub } = G;
    el.world.style.opacity = "0"; el.terry.style.opacity = "0"; op(el.dark, 1);
    const eo = sstep(seg(t, 0, 0.45)) * (1 - sstep(seg(t, 1.1, 1.5)));
    el.eyes.style.transform = `translate3d(${G.ncx}px,${G.eyesHome.y}px,0)`; el.eyes.style.filter = "none"; op(el.eyes, eo);
    el.eye.forEach((e, i) => { const s = i ? 1 : -1, sz = F * 0.1; e.style.transform = `translate3d(${(s * F * 0.18).toFixed(2)}px,0,0) rotate(${-s * 14}deg)`; e.style.width = e.style.height = sz + "px"; e.style.marginLeft = e.style.marginTop = (-sz / 2) + "px"; });
    tf(el.nm, nm.x, nm.y); op(el.nm, sstep(seg(t, 0.3, 0.75)));
    el.logo.style.width = el.logo.style.height = logo.s + "px"; tf(el.logo, logo.x, logo.y); op(el.logo, sstep(seg(t, 0.55, 0.95)));
    tf(el.sub, sub.x, sub.y); op(el.sub, sstep(seg(t, 0.75, 1.15))); el.slot.style.opacity = "1";
    op(el.bt, 0); op(el.flash, 0);
    const up = sstep(seg(t, 1.5, 2.0));
    op(el.dark, 1 - up); root.style.background = `rgba(11,9,8,${(1 - up).toFixed(3)})`;
    document.documentElement.classList.toggle("op-lit", t >= 1.45); document.documentElement.classList.toggle("op-warm", t >= 1.45); document.documentElement.classList.toggle("op-bats", t >= 1.45);
    [el.nm, el.logo, el.sub].forEach(e => { e.style.opacity = (parseFloat(e.style.opacity) * (1 - up)).toFixed(3); });
  }
  const TR = 2.05;

  /* clock: a single stalled frame advances the film by at most twice the machine's usual frame time (never under 50 ms), so a
     busy moment slows Terry for a beat instead of making him jump ahead; a steadily slow machine still plays at real speed */
  let filmMs = 0, prevNow = null, typ = 16.7;
  function tick(now) {
    if (ended) return;
    raf = requestAnimationFrame(tick);
    if (paused) { prevNow = null; return; }
    if (t0 == null) { t0 = now; filmMs = 0; prevNow = now; }
    if (prevNow != null) { const d = now - prevNow; filmMs += Math.min(d, Math.max(50, 2 * typ)); typ += (Math.min(d, 250) - typ) * 0.1; }
    prevNow = now;
    const t = filmMs / 1000 / slow;
    if (reduced) { renderReduced(t); if (t >= TR) finish(false); return; }
    render(t);
    if (t >= B.end) finish(false);
  }
  api.seek = t => { paused = true; if (!G) layout(); if (reduced) renderReduced(t); else render(t); return t; };
  api.play = () => { paused = false; t0 = null; prevNow = null; };
  api.now = () => curT;

  async function start() {
    window.scrollTo(0, 0);
    makeTerry();
    if (!reduced && !bat) { finish(false); return; }       // no WebGL after all: straight to the page
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`400 100px "Caveat Brush"`), document.fonts.load(`400 40px "Instrument Sans"`)]).then(() => document.fonts.ready),
        new Promise(r => setTimeout(r, 1500)),
      ]);
    } catch (e) {}
    // hold the first frame (the dark, blank projector) until the page underneath has done its heavy start-up, at most 1.2 s,
    // so the flight does not share the machine with it
    await quiet(1200);
    if (ended) return;
    layout(); render(0);
    raf = requestAnimationFrame(tick);
  }
  function quiet(capMs) {
    return new Promise(res => {
      const stop = performance.now() + capMs, ric = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 50 }), 60));
      let calm = 0;
      const step = d => { calm = d.timeRemaining() > 30 ? calm + 1 : 0; if (calm >= 3 || performance.now() >= stop || ended) res(); else ric(step, { timeout: 150 }); };
      ric(step, { timeout: 150 });
    });
  }
  // the projector is up from the first frame; the clock starts once the page's scripts and the brand faces are in
  layout(); if (!reduced) render(0); else renderReduced(0);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
