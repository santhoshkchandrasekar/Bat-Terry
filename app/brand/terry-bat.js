/* Terry the bat: an animated SVG rig.
 *
 *   const bat = TerryBat.create(svg, { stage: {home, branch}, ringLayer, onEcho })
 *   bat.flap()   power flaps in place (or drop from the branch and hover)
 *   bat.fly()    one figure-eight loop around the stage, then back home
 *   bat.flip()   swing up and flip to hang from the branch, or let go and flip back into flight
 *   bat.echo()   three calls; rings go out, bounce off the target and come back
 *   bat.setSpeed(x)  1 = real time, 0.25 = slow motion
 *
 * The wing is a skeleton (upper arm, forearm, thumb, four fingers) with a membrane stretched over it, so every
 * motion comes from joint angles: the same rig flaps, folds, banks and wraps up to roost. Black, not scary:
 * a short muzzle, round soft ears, glossy eyes with highlights, no teeth.
 */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const D2R = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cosI = u => (1 - Math.cos(Math.PI * u)) / 2;
  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const f1 = v => (Math.round(v * 10) / 10).toString();
  function mk(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

  // ---- skeleton (right wing, local units; the left wing is its mirror image)
  const ARM = 34, FORE = 60, DIG = [58, 84, 74, 62];
  const SH = { x: 18, y: -8 }, ANKLE = { x: 11, y: 47 }, FEET_Y = 52;
  // One wingbeat, front view. a1: upper arm angle (deg, 0 = straight out, negative = up); a2: forearm relative to arm;
  // s: how far the fingers fan open; span: foreshortening as the wing sweeps forward and back.
  const KEYS = [
    { t: 0.00, a1: -58, a2: 4, s: 0.50, span: 0.80 },   // top of the stroke
    { t: 0.24, a1: -12, a2: 4, s: 1.00, span: 1.00 },   // downstroke, fully spread
    { t: 0.46, a1: 30, a2: 8, s: 0.88, span: 0.94 },    // bottom
    { t: 0.72, a1: 6, a2: 62, s: 0.28, span: 0.64 },    // upstroke, wrist and fingers folded in
    { t: 1.00, a1: -58, a2: 4, s: 0.50, span: 0.80 },
  ];
  const REST = { a1: 64, a2: -150, s: 0.22, span: 1.12 };   // folded and wrapped around the body
  function flapPose(t) {
    t -= Math.floor(t);
    let i = 0; while (t > KEYS[i + 1].t) i++;
    const k0 = KEYS[i], k1 = KEYS[i + 1], u = cosI((t - k0.t) / (k1.t - k0.t));
    return { a1: lerp(k0.a1, k1.a1, u), a2: lerp(k0.a2, k1.a2, u), s: lerp(k0.s, k1.s, u), span: lerp(k0.span, k1.span, u) };
  }
  const mix = (p, q, u) => ({ a1: lerp(p.a1, q.a1, u), a2: lerp(p.a2, q.a2, u), s: lerp(p.s, q.s, u), span: lerp(p.span, q.span, u) });
  function wingPts(p, fold, lift) {
    const a1 = (p.a1 + lift) * D2R, a2 = (p.a1 + lift + p.a2) * D2R;
    const S = { ...SH };
    const E = { x: S.x + ARM * Math.cos(a1), y: S.y + ARM * Math.sin(a1) };
    const W = { x: E.x + FORE * Math.cos(a2), y: E.y + FORE * Math.sin(a2) };
    const offs = [-4, 6 + 12 * p.s, 17 + 34 * p.s, 28 + 58 * p.s].map(o => (o + fold * 168) * D2R);
    const D = offs.map((o, i) => ({ x: W.x + DIG[i] * Math.cos(a2 + o), y: W.y + DIG[i] * Math.sin(a2 + o) }));
    const T = { x: W.x + 9 * Math.cos(a2 - 0.9), y: W.y + 9 * Math.sin(a2 - 0.9) };
    const sq = q => ({ x: S.x + (q.x - S.x) * p.span, y: q.y });
    return { S, E: sq(E), W: sq(W), D: D.map(sq), T: sq(T), F: { ...ANKLE } };
  }
  function membrane(P) {
    const { S, E, W, D, F } = P;
    const scallop = (a, b, k) => ({ x: lerp((a.x + b.x) / 2, W.x, k), y: lerp((a.y + b.y) / 2, W.y, k) });
    let d = `M${f1(S.x)},${f1(S.y)} Q${f1(E.x)},${f1(E.y - 5)} ${f1(W.x)},${f1(W.y)} L${f1(D[0].x)},${f1(D[0].y)}`;
    for (let i = 0; i < 3; i++) { const q = scallop(D[i], D[i + 1], 0.3); d += ` Q${f1(q.x)},${f1(q.y)} ${f1(D[i + 1].x)},${f1(D[i + 1].y)}`; }
    const q5 = { x: lerp((D[3].x + F.x) / 2, S.x, 0.3), y: lerp((D[3].y + F.y) / 2, S.y, 0.3) };
    return d + ` Q${f1(q5.x)},${f1(q5.y)} ${f1(F.x)},${f1(F.y)} L8,34 L${f1(S.x - 4)},${f1(S.y + 6)} Z`;
  }
  const bonesArm = P => `M${f1(P.S.x)},${f1(P.S.y)} L${f1(P.E.x)},${f1(P.E.y)} L${f1(P.W.x)},${f1(P.W.y)}`;
  const bonesHand = P => P.D.map(q => `M${f1(P.W.x)},${f1(P.W.y)} L${f1(q.x)},${f1(q.y)}`).join(" ") + ` M${f1(P.W.x)},${f1(P.W.y)} L${f1(P.T.x)},${f1(P.T.y)}`;
  const leading = P => `M${f1(P.S.x)},${f1(P.S.y)} Q${f1(P.E.x)},${f1(P.E.y - 5)} ${f1(P.W.x)},${f1(P.W.y)} L${f1(P.D[0].x)},${f1(P.D[0].y)}`;

  // ---- drawing
  function build(parent, uid) {
    const defs = mk("defs", {}, parent);
    const fur = mk("filter", { id: `fur-${uid}`, x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    mk("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9", numOctaves: "2", seed: "7", result: "n" }, fur);
    mk("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: "3.2", xChannelSelector: "R", yChannelSelector: "G" }, fur);
    const body = mk("radialGradient", { id: `body-${uid}`, cx: "50%", cy: "38%", r: "65%" }, defs);
    mk("stop", { offset: "0", "stop-color": "#2d2729" }, body);
    mk("stop", { offset: "0.55", "stop-color": "#171315" }, body);
    mk("stop", { offset: "1", "stop-color": "#0a0809" }, body);
    const memb = mk("linearGradient", { id: `memb-${uid}`, x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
    mk("stop", { offset: "0", "stop-color": "#1d181a" }, memb);
    mk("stop", { offset: "1", "stop-color": "#0d0b0c" }, memb);

    const g = mk("g", { class: "terry-bat" }, parent);
    const wingL = mk("g", { transform: "scale(-1,1)" }, g), wingR = mk("g", {}, g);
    const wing = w => ({
      mem: mk("path", { fill: `url(#memb-${uid})`, "fill-opacity": "0.94", stroke: "#060505", "stroke-width": "0.6", "stroke-linejoin": "round" }, w),
      rim: mk("path", { fill: "none", stroke: "var(--bat-rim, #8fa3c7)", "stroke-width": "1", "stroke-opacity": "0.45", "stroke-linecap": "round" }, w),
      arm: mk("path", { fill: "none", stroke: "#3a3235", "stroke-width": "2.6", "stroke-linecap": "round", "stroke-linejoin": "round" }, w),
      hand: mk("path", { fill: "none", stroke: "#352e31", "stroke-width": "1.25", "stroke-linecap": "round", "stroke-opacity": "0.9" }, w),
      claw: mk("circle", { r: "1.6", fill: "#2a2325" }, w),
    });
    const L = wing(wingL), R = wing(wingR);

    // tail membrane, feet
    mk("path", { d: "M-12,42 Q0,66 12,42 Q0,50 -12,42 Z", fill: `url(#memb-${uid})`, stroke: "#060505", "stroke-width": "0.6" }, g);
    const feet = mk("g", {}, g);
    for (const sx of [-1, 1]) {
      const fg = mk("g", { transform: `translate(${sx * 10},${FEET_Y - 4})` }, feet);
      mk("path", { d: "M-3,-2 Q0,-6 3,-2 L3,2 Q0,4 -3,2 Z", fill: "#161214" }, fg);
      for (let k = -2; k <= 2; k++) mk("path", { d: `M${k * 1.3},2 q${k * 0.3},3 ${k * 0.2 - 1.2},4.6`, fill: "none", stroke: "#2a2326", "stroke-width": "1", "stroke-linecap": "round" }, fg);
    }

    // body and head silhouette, with a fur edge
    const torsoD = "M0,-26 C20,-26 27,-12 26,6 C25,28 17,48 0,48 C-17,48 -25,28 -26,6 C-27,-12 -20,-26 0,-26 Z";
    const headD = "M0,-58 C16,-58 23,-47 22,-36 C21,-25 12,-17 0,-16 C-12,-17 -21,-25 -22,-36 C-23,-47 -16,-58 0,-58 Z";
    const rimG = mk("g", { fill: "none", stroke: "var(--bat-rim, #8fa3c7)", "stroke-width": "2.2", "stroke-opacity": "0.42" }, g);
    mk("path", { d: torsoD }, rimG);
    const headRim = mk("path", { d: headD }, rimG);
    const torso = mk("g", {}, g);
    mk("path", { d: torsoD, fill: `url(#body-${uid})`, filter: `url(#fur-${uid})` }, torso);
    mk("ellipse", { cx: "0", cy: "8", rx: "12", ry: "18", fill: "#3a3033", "fill-opacity": "0.35" }, torso);
    const r = rng(311), furG = mk("g", { stroke: "#463b3e", "stroke-width": "0.7", "stroke-linecap": "round", "stroke-opacity": "0.45" }, torso);
    let fd = "";
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r());
      const x = Math.cos(a) * rr * 18, y = 10 + Math.sin(a) * rr * 30, len = 3 + r() * 3;
      fd += `M${f1(x)},${f1(y)} l${f1((r() - 0.5) * 2 + x * 0.06)},${f1(len)} `;
    }
    mk("path", { d: fd }, furG);

    const head = mk("g", {}, g);
    const ears = mk("g", {}, head);
    const ear = side => {
      const eg = mk("g", {}, ears);
      const s = side;
      mk("path", { d: `M${7 * s},-50 C${8 * s},-66 ${16 * s},-80 ${25 * s},-82 C${31 * s},-70 ${28 * s},-54 ${19 * s},-43 Z`, fill: "#141012", stroke: "var(--bat-rim, #8fa3c7)", "stroke-width": "0.9", "stroke-opacity": "0.4" }, eg);
      mk("path", { d: `M${11 * s},-50 C${12 * s},-62 ${18 * s},-73 ${23.5 * s},-75 C${25.5 * s},-66 ${23 * s},-56 ${18 * s},-47.5 Z`, fill: "#4a3a3e", "fill-opacity": "0.55" }, eg);
      return eg;
    };
    const earL = ear(-1), earR = ear(1);
    mk("path", { d: headD, fill: `url(#body-${uid})`, filter: `url(#fur-${uid})` }, head);
    mk("path", { d: "M-14,-24 C-8,-14 8,-14 14,-24 L14,-16 L-14,-16 Z", fill: "#1a1517", filter: `url(#fur-${uid})` }, head);   // ruff where head meets body
    mk("ellipse", { cx: "0", cy: "-27.5", rx: "9.5", ry: "7", fill: "#2b2326" }, head);       // muzzle
    const eye = side => {
      const eg = mk("g", {}, head);
      mk("ellipse", { cx: `${8.6 * side}`, cy: "-40", rx: "3.7", ry: "3.9", fill: "#050405" }, eg);
      mk("circle", { cx: `${8.6 * side + 1.2}`, cy: "-41.3", r: "1.25", fill: "#fff", "fill-opacity": "0.92" }, eg);
      mk("circle", { cx: `${8.6 * side - 1.1}`, cy: "-38.6", r: "0.55", fill: "#fff", "fill-opacity": "0.6" }, eg);
      return eg;
    };
    const eyeL = eye(-1), eyeR = eye(1);
    mk("path", { d: "M-3.2,-31.5 Q0,-34.4 3.2,-31.5 Q2.2,-28.6 0,-28.2 Q-2.2,-28.6 -3.2,-31.5 Z", fill: "#0a0809" }, head);   // nose
    mk("circle", { cx: "-1.2", cy: "-30.6", r: "0.55", fill: "#3a2f32" }, head);
    mk("circle", { cx: "1.2", cy: "-30.6", r: "0.55", fill: "#3a2f32" }, head);
    const mouthOpen = mk("ellipse", { cx: "0", cy: "-23.6", rx: "3.2", ry: "0", fill: "#4a2a31" }, head);
    mk("path", { d: "M-3.8,-24.6 Q0,-22.6 3.8,-24.6", fill: "none", stroke: "#0a0809", "stroke-width": "0.9", "stroke-linecap": "round" }, head);
    return { g, L, R, wingL, wingR, head, earL, earR, eyeL, eyeR, mouthOpen, torso, rimG, headRim };
  }

  // ---- the animated bat
  function create(svg, opts = {}) {
    const uid = Math.random().toString(36).slice(2, 7);
    const layer = opts.layer || svg;
    const rings = opts.ringLayer || layer;
    const R = build(layer, uid);
    const home = { ...(opts.home || { x: 330, y: 290 }) };
    const branch = { ...(opts.branch || { x: 660, y: 112 }) };
    const target = opts.target || null;            // {x, y, el} something to echolocate
    const st = {
      x: home.x, y: home.y, rot: 0, sc: 1, anchor: 0,  // anchor 0 = body center, 1 = feet
      foldL: 0, foldR: 0, liftL: 0, liftR: 0, flapT: 0, rate: 2.4, bob: 1,
      mode: "hover", busy: false, mouth: 0, earTw: 0, earTwSide: 1, blink: 0, headTilt: 0, sway: 0,
      speed: 1, t: 0, nextBlink: 2.5, nextTwitch: 1.5, nextGroom: 6,
    };
    const tweens = [];
    let last = null, raf = 0;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    function tween(dur, fn) {           // seconds of bat time
      return new Promise(res => tweens.push({ t: 0, dur, fn, res }));
    }
    function anchorXY() { return st.anchor ? { x: 0, y: FEET_Y } : { x: 0, y: 0 }; }
    function toWorld(lx, ly) {
      const a = anchorXY(), c = Math.cos(st.rot * D2R), s = Math.sin(st.rot * D2R);
      const x1 = (lx - a.x) * st.sc, y1 = (ly - a.y) * st.sc;
      return { x: st.x + x1 * c - y1 * s, y: st.y + x1 * s + y1 * c };
    }

    function render() {
      const a = anchorXY();
      const bobY = st.mode === "hang" ? 0 : -3 * Math.sin(st.flapT * Math.PI * 2) * st.bob;
      R.g.setAttribute("transform", `translate(${f1(st.x)},${f1(st.y + bobY)}) rotate(${f1(st.rot + st.sway)}) scale(${st.sc.toFixed(3)}) translate(${-a.x},${-a.y})`);
      const fp = flapPose(st.flapT);
      for (const [W, fold, lift] of [[R.L, st.foldL, st.liftL], [R.R, st.foldR, st.liftR]]) {
        const p = wingPts(mix(fp, REST, fold), fold, lift);
        W.mem.setAttribute("d", membrane(p));
        W.rim.setAttribute("d", leading(p));
        W.arm.setAttribute("d", bonesArm(p));
        W.hand.setAttribute("d", bonesHand(p));
        W.claw.setAttribute("cx", f1(p.T.x)); W.claw.setAttribute("cy", f1(p.T.y));
        const bo = (1 - 0.8 * fold).toFixed(2);              // wrapped wings hide their finger bones
        W.hand.setAttribute("stroke-opacity", (0.9 * bo).toFixed(2)); W.arm.setAttribute("stroke-opacity", bo);
      }
      // wrapped wings sit in front of the body (the face stays on top); open wings sit behind it
      const front = Math.max(st.foldL, st.foldR) > 0.6;
      if (front !== R.front) {
        R.front = front;
        if (front) { R.g.insertBefore(R.wingL, R.head); R.g.insertBefore(R.wingR, R.head); }
        else { R.g.insertBefore(R.wingR, R.g.firstChild); R.g.insertBefore(R.wingL, R.g.firstChild); }
      }
      R.head.setAttribute("transform", `translate(0,${f1(st.headTilt * 0)}) rotate(${f1(st.headTilt)} 0 -28)`);
      R.headRim.setAttribute("transform", `rotate(${f1(st.headTilt)} 0 -28)`);
      R.mouthOpen.setAttribute("ry", f1(2.8 * st.mouth));
      const tw = st.earTw * 9;
      R.earL.setAttribute("transform", `rotate(${f1(-(st.earTwSide < 0 ? tw : tw * 0.3))} -12 -48)`);
      R.earR.setAttribute("transform", `rotate(${f1(st.earTwSide > 0 ? tw : tw * 0.3)} 12 -48)`);
      const bl = 1 - 0.9 * st.blink;
      R.eyeL.setAttribute("transform", `translate(0,-40) scale(1,${bl.toFixed(2)}) translate(0,40)`);
      R.eyeR.setAttribute("transform", `translate(0,-40) scale(1,${bl.toFixed(2)}) translate(0,40)`);
      const breathe = st.mode === "hang" ? 1 + 0.018 * Math.sin(st.t * 2.4) : 1;
      R.torso.setAttribute("transform", `scale(${breathe.toFixed(3)},1)`);
    }

    function idle(dt) {
      st.t += dt;
      st.flapT += dt * st.rate;
      if (st.mode === "hover" && !st.busy) st.x = lerp(st.x, home.x, 1 - Math.exp(-dt * 2)), st.y = lerp(st.y, home.y + 6 * Math.sin(st.t * 1.3), 1 - Math.exp(-dt * 2));
      if (st.mode === "hang" && !st.busy) st.sway = 3 * Math.sin(st.t * 1.1) * (reduced ? 0 : 1);
      // blinks, ear twitches, a little grooming while roosting: what makes it feel alive
      if (st.t > st.nextBlink) { st.nextBlink = st.t + 2.5 + Math.random() * 3.5; blink(); }
      if (st.t > st.nextTwitch) { st.nextTwitch = st.t + 1.8 + Math.random() * 3; twitch(Math.random() < 0.5 ? -1 : 1, 0.6); }
      if (st.mode === "hang" && !st.busy && st.t > st.nextGroom) { st.nextGroom = st.t + 7 + Math.random() * 6; groom(); }
    }
    function blink() { tween(0.16, u => { st.blink = Math.sin(Math.PI * u); }); }
    function twitch(side, amt = 1) { st.earTwSide = side; tween(0.28, u => { st.earTw = amt * Math.sin(Math.PI * u); }); }
    async function groom() {      // stretch one wing open and wrap it back
      const side = Math.random() < 0.5 ? "foldL" : "foldR";
      await tween(0.7, u => { st[side] = 1 - 0.55 * Math.sin(Math.PI * u); });
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (last === null) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000) * st.speed; last = now;
      idle(dt);
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]; tw.t += dt;
        const u = clamp(tw.t / tw.dur, 0, 1);
        tw.fn(u, dt);
        if (u >= 1) { tweens.splice(i, 1); tw.res(); }
      }
      render();
    }

    async function run(fn) {
      if (st.busy) return false;
      st.busy = true;
      try { await fn(); } finally { st.busy = false; }
      opts.onState && opts.onState(st.mode);
      return true;
    }

    // ---- actions
    function flap() {
      return run(async () => {
        if (st.mode === "hang") { await letGo(); return; }
        const r0 = st.rate, y0 = st.y;
        await tween(1.4, u => { st.rate = lerp(r0, 4.2, Math.sin(Math.PI * u)); st.y = y0 - 30 * Math.sin(Math.PI * u); st.bob = 1 + Math.sin(Math.PI * u); });
        st.rate = 2.4; st.bob = 1;
      });
    }

    function fly() {
      return run(async () => {
        if (st.mode === "hang") await letGo();
        st.mode = "fly";
        const cx = opts.flyCenter ? opts.flyCenter.x : 450, cy = opts.flyCenter ? opts.flyCenter.y : 250;
        const ax = opts.flyRadius ? opts.flyRadius.x : 270, ay = opts.flyRadius ? opts.flyRadius.y : 90;
        const P = tau => ({ x: cx + ax * Math.sin(tau), y: cy + ay * Math.sin(2 * tau) });
        const x0 = st.x, y0 = st.y, p0 = P(0);
        await tween(0.6, u => { const e = easeIO(u); st.x = lerp(x0, p0.x, e); st.y = lerp(y0, p0.y, e); st.rate = lerp(2.4, 3.2, u); });
        const T = 6.5;
        await tween(T, (u, dt) => {
          const tau = u * Math.PI * 2, p = P(tau), dx = ax * Math.cos(tau) * (2 * Math.PI / T);
          st.x = p.x; st.y = p.y;
          st.rot = lerp(st.rot, clamp(dx * 0.045, -16, 16), 1 - Math.exp(-dt * 6));
          st.sc = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(tau));          // farther away on the far side of the loop
          st.headTilt = -st.rot * 0.5;
          // glide for a moment at the ends of the loop, like a real bat between beats
          const glide = Math.pow(Math.max(0, Math.cos(2 * tau)), 8);
          st.rate = lerp(3.2, 0.6, glide);
        });
        const x1 = st.x, y1 = st.y;
        await tween(0.8, u => { const e = easeIO(u); st.x = lerp(x1, home.x, e); st.y = lerp(y1, home.y, e); st.rot = lerp(st.rot, 0, e); st.sc = lerp(st.sc, 1, e); st.headTilt = lerp(st.headTilt, 0, e); st.rate = lerp(st.rate, 2.4, u); });
        st.mode = "hover";
      });
    }

    async function grab() {
      // Fly up under the branch, then a half cartwheel: one wing kicks up, the body rolls over, the feet catch.
      const x0 = st.x, y0 = st.y, below = { x: branch.x, y: branch.y + 120 * st.sc };
      await tween(0.8, u => { const e = easeIO(u); st.x = lerp(x0, below.x, e); st.y = lerp(y0, below.y, e); st.rate = lerp(st.rate, 3.4, u); });
      const yEnd = branch.y + FEET_Y * st.sc;   // body center when the feet are on the branch, upside down
      await tween(0.75, u => {
        const e = easeIO(u);
        st.rot = 180 * e;
        st.y = lerp(below.y, yEnd, easeOut(u)) - 14 * Math.sin(Math.PI * u);
        st.liftR = -38 * Math.sin(Math.PI * u);                         // the outside wing sweeps up and over
        st.foldL = clamp(u * 1.6, 0, 1);                                 // the inside wing tucks first
        st.foldR = clamp((u - 0.45) * 1.9, 0, 1);
        st.rate = lerp(3.4, 0, u);
        st.bob = 1 - u;
      });
      st.liftR = 0; st.foldL = st.foldR = 1; st.rate = 0;
      st.anchor = 1; st.x = branch.x; st.y = branch.y; st.rot = 180;
      st.mode = "hang";
      await tween(1.3, u => { st.sway = 14 * Math.exp(-3.2 * u * 1.3) * Math.sin(u * 1.3 * 9); });    // swings, settles
      st.sway = 0;
    }
    async function letGo() {
      // Drop, fall a body length while rolling back upright, open the wings and catch the air.
      st.anchor = 0; st.x = branch.x; st.y = branch.y + FEET_Y * st.sc; st.rot = 180 + st.sway; st.sway = 0;
      const y0 = st.y;
      await tween(0.8, u => {
        st.rot = lerp(180, 360, easeIO(u));
        st.y = y0 + 110 * st.sc * u * u;
        st.foldL = clamp(1 - u * 1.5, 0, 1); st.foldR = clamp(1 - (u - 0.15) * 1.6, 0, 1);
        st.rate = lerp(0, 3.6, clamp((u - 0.3) * 1.6, 0, 1));
        st.bob = u;
      });
      st.rot = 0; st.foldL = st.foldR = 0; st.mode = "hover"; st.bob = 1;
      const x1 = st.x, y1 = st.y;
      await tween(0.9, u => { const e = easeIO(u); st.x = lerp(x1, home.x, e); st.y = lerp(y1, home.y, e); st.rate = lerp(3.6, 2.4, u); });
    }
    function flip() { return run(async () => { if (st.mode === "hang") await letGo(); else await grab(); }); }

    let echoing = false;
    async function echo() {
      if (echoing) return; echoing = true;
      try {
        for (let k = 0; k < 3; k++) {
          tween(0.22, u => { st.mouth = Math.sin(Math.PI * u); });
          twitch(k % 2 ? -1 : 1, 0.5);
          pulse(k === 2);
          await tween(0.38, () => {});
        }
        await tween(1.2, () => {});
      } finally { echoing = false; }
    }
    function pulse(last) {
      const o = toWorld(0, -24);
      const ring = mk("circle", { cx: f1(o.x), cy: f1(o.y), r: "6", fill: "none", stroke: "var(--sonar, #7fe0d0)", "stroke-width": "2" }, rings);
      const dist = target ? Math.hypot(target.x - o.x, target.y - o.y) : 0;
      let hit = false;
      const maxR = 420;
      tween(1.5, u => {
        const r = 6 + (maxR - 6) * u;
        ring.setAttribute("r", f1(r));
        ring.setAttribute("stroke-opacity", (0.85 * (1 - u)).toFixed(3));
        ring.setAttribute("stroke-width", f1(2.2 - 1.6 * u));
        if (target && !hit && r >= dist) { hit = true; bounce(o, dist, last); }
        if (u >= 1) ring.remove();
      });
    }
    function bounce(o, dist, last) {
      const back = mk("circle", { cx: f1(target.x), cy: f1(target.y), r: "2", fill: "none", stroke: "var(--echo, #ffd36a)", "stroke-width": "1.6" }, rings);
      target.el && target.el.classList.add("pinged");
      const dur = 1.5 * (dist / 414);
      tween(Math.max(0.2, dur), u => {
        back.setAttribute("r", f1(2 + dist * u));
        back.setAttribute("stroke-opacity", (0.75 * (1 - 0.6 * u)).toFixed(3));
        if (u >= 1) {
          back.remove();
          twitch(target.x < o.x ? -1 : 1, 1.2);
          st.headTilt = clamp((target.x - o.x) * 0.02, -12, 12);
          tween(0.9, v => { if (v >= 1) st.headTilt = 0; });
          if (last && opts.onEcho) opts.onEcho({ distance_px: dist });
          setTimeout(() => target.el && target.el.classList.remove("pinged"), 500);
        }
      });
    }

    function setSpeed(x) { st.speed = x; }
    function setHome(x, y) { home.x = x; home.y = y; }
    function setBranch(x, y) { branch.x = x; branch.y = y; }
    function setScale(k) { st.sc = k; }
    function hangNow() { st.mode = "hang"; st.anchor = 1; st.x = branch.x; st.y = branch.y; st.rot = 180; st.foldL = st.foldR = 1; st.rate = 0; st.bob = 0; }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { cancelAnimationFrame(raf); raf = 0; last = null; }
    render(); start();
    return { flap, fly, flip, echo, setSpeed, setHome, setBranch, setScale, hangNow, start, stop, state: st, toWorld, mode: () => st.mode, busy: () => st.busy };
  }

  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TerryBat = api;
})(typeof window !== "undefined" ? window : globalThis);
