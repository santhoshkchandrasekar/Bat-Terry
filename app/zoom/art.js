/* Shared artwork for the Terry page: the duotone icon set, leaf symbols, predator scenes and the organic branch.
 * Everything is inline SVG so it follows the theme tokens.
 *
 *   TerryArt.sprite()            -> markup for the symbol sprite (inject once)
 *   TerryArt.ic(name, cls, st)   -> an inline icon that uses a symbol
 *   TerryArt.scene(kind, req)    -> inner markup for a 232 x 84 predator scene
 *   TerryArt.branch(W, night)    -> { svg, under(x), cy(x), tip }  the limb across a page W px wide (svg is 110 px tall)
 */
(function (root) {
  "use strict";
  const ICONS = {
    pothole: '<path d="M2 8.5h20M2 19.5h20"/><ellipse class="d" cx="12" cy="14" rx="6" ry="2.4"/><path d="M12 8.5v3M6.5 8.5l1.6 2.8M17.5 8.5l-1.6 2.8"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7"/><path class="d" d="M6 7l.9 12.5a1 1 0 001 .9h8.2a1 1 0 001-.9L18 7z"/><path d="M10 11v5.5M14 11v5.5"/>',
    car: '<path class="d" d="M3 16.5v-4l2.3-4.2A2 2 0 017 7.3h10a2 2 0 011.7 1l2.3 4.2v4z"/><path d="M3 12.5h18"/><circle class="w" cx="7.5" cy="17" r="1.9"/><circle class="w" cx="16.5" cy="17" r="1.9"/>',
    tow: '<path class="d" d="M2.5 17v-3.6l2-3.6a2 2 0 011.7-1h8.3a2 2 0 011.7 1l1.8 3.6V17z"/><path d="M2.5 13.4h16"/><circle class="w" cx="6.5" cy="17.4" r="1.8"/><circle class="w" cx="14.5" cy="17.4" r="1.8"/><path d="M13 7.3L18.5 3.5l2.2 1.6M20.7 5.1V10a1.4 1.4 0 11-2.8 0"/>',
    light: '<rect class="d" x="8" y="2.5" width="8" height="19" rx="3"/><circle cx="12" cy="7" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="17" r="1.4"/>',
    branch: '<path d="M3 19L19 6"/><path d="M9.3 14.3L8 10M13 11.3l.6-4.3M16.5 8.4L21 9.2"/><path class="d" d="M4.5 20.5c3.2.2 6-1 7-3.2-3.2-.2-6 1-7 3.2z"/>',
    leaf: '<path class="d" d="M12 20.5c-4.5-.5-7-4-6.5-9.5 4.5-.3 9 1.5 6.5 9.5z"/><path d="M12 20.5C12 14 14 9 19.5 4c.5 6-1.5 10-7.5 16.5"/>',
    pile: '<path class="d" d="M2.5 20.5c1.4-5.4 5-8 9.5-8s8.1 2.6 9.5 8z"/><path d="M12 12.5c-3.5-.6-5-3.6-4.6-7.2 3.6.2 6 2.2 4.6 7.2z"/>',
    house: '<path class="d" d="M4 11l8-7 8 7v9H4z"/><path d="M9 14.5l2.2 2.2 4.3-4.4"/>',
    rodent: '<path class="d" d="M3.5 16c0-3.2 2.6-5.8 6-5.8h3c1.7 0 3.1.8 4 2l3 1.4-2.6 1.1c-.6 1.4-1.9 2.5-3.9 2.5H6.2c-1.6 0-2.7-.5-2.7-1.2z"/><circle cx="11.5" cy="8.3" r="1.9"/><circle cx="17" cy="13.2" r=".6" fill="currentColor"/><path d="M3.5 16C2 17.2 2 19 4.2 19.6"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.8 4.8L12 6.6l2.2-1.8M9.8 19.2L12 17.4l2.2 1.8"/>',
    sun: '<circle class="d" cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    moon: '<path class="d" d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
    dusk: '<path class="d" d="M6.5 16a5.5 5.5 0 0111 0z"/><path d="M2.5 16h19M5 20h14M12 5.5V8M4.6 8.6l1.7 1.7M19.4 8.6l-1.7 1.7"/>',   // the sun half down on the horizon (owner 00:43: Day is Dusk)
    truck: '<path class="d" d="M2.5 6.5h11v10h-11z"/><path d="M13.5 9.5h4l3 3.2v3.8h-7"/><circle class="w" cx="7" cy="17.5" r="2"/><circle class="w" cx="17" cy="17.5" r="2"/>',
    crew: '<circle cx="9" cy="8" r="3"/><path class="d" d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6z"/><circle cx="17" cy="9" r="2.3"/><path d="M17.2 14c2.4.1 4.3 1.9 4.3 4.5"/>',
    hire: '<circle cx="9" cy="8" r="3.2"/><path class="d" d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6z"/><path d="M19 6.5v6M16 9.5h6"/>',
    dusk: '<path d="M3 17h18M7.5 20.5h9"/><path class="d" d="M7 17a5 5 0 0110 0"/><path d="M12 6.5v2.2M5 10.2l1.5 1.5M19 10.2l-1.5 1.5"/>',
    owl: '<path class="d" d="M6.5 4.5l3 2h5l3-2V13a5.5 5.5 0 01-11 0z"/><circle class="w" cx="9.7" cy="10" r="1.9"/><circle class="w" cx="14.3" cy="10" r="1.9"/><path d="M11 12.8l1 1.5 1-1.5z"/><path d="M9.6 19.2l-.6 2M14.4 19.2l.6 2"/>',
    sonar: '<circle class="d" cx="12" cy="5.5" r="2"/><path d="M6.5 11a7.8 7.8 0 0011 0M4 14.5a11.5 11.5 0 0016 0M8.8 18a4 4 0 006.4 0"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chev: '<path d="M6 9.5l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    swap: '<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',
    flask: '<path class="d" d="M9.5 3.5h5M10.5 3.5v6L5 19a1.5 1.5 0 001.3 2.2h11.4A1.5 1.5 0 0019 19l-5.5-9.5v-6"/><path d="M8 15h8"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path class="d" d="M8 5.5v13l11-6.5z"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M9.5 4.5v15"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.7v.1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    train: '<path class="d" d="M2 9.5L12 5l10 4.5-10 4.5z"/><path d="M6 12v4.5c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8V12"/>',
    silence: '<path class="d" d="M4 5h16v11h-8.5L7 20v-4H4z"/><path d="M8.5 10.5h7"/>',
    dollar: '<path d="M12 3v18M16.5 7.5c-.6-1.4-2.2-2.2-4.5-2.2-2.5 0-4 1.1-4 2.8s1.4 2.4 4 3 4.2 1.2 4.2 3-1.7 2.9-4.2 2.9c-2.4 0-4-.9-4.6-2.3"/>',
    spark: '<path class="d" d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    pin: '<path class="d" d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.3"/>',
    chat: '<path class="d" d="M4 5h16v11h-8.5L7 20v-4H4z"/><path d="M8.5 9.5h7M8.5 12.5h4"/>',
    inbox: '<path class="d" d="M3.5 13l2.4-7.2A1.5 1.5 0 017.300 4.800h9.400a1.500 1.500 0 011.400 1l2.400 7.200v5a1.500 1.500 0 01-1.500 1.500h-15A1.500 1.500 0 013.500 18z"/><path d="M3.500 13h5l1 2.500h5l1-2.500h5"/>',
    bolt: '<path class="d" d="M13 3L5 13.500h5.500L9.500 21 19 9.500h-5.500z"/>',
    bat: '<path fill="currentColor" stroke="none" d="M12 6.2l1.5 2.2C15 7.2 17.2 6.4 21.3 6.6c-1 1.5-1.2 3-.8 4.6-1.4-.3-2.6.2-3.4 1.4-.9-.9-1.8-1.3-2.9-1.3L12 14.3l-1.9-2.8c-1.1 0-2 .4-2.9 1.3-.8-1.2-2-1.7-3.4-1.4.4-1.6.2-3.1-.8-4.6 4.1-.2 6.3.6 7.8 1.8z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const sprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("")}
<symbol id="maple" viewBox="-12 -12 24 24"><path d="M0-11l2.2 4.8 3.6-1.5-.8 5 4.6-1.3-2 4.2 3.2 1.8-6 2.8.6 2.4-4.8-.7V12H-.6v-2.5l-4.8.7.6-2.4-6-2.8 3.2-1.8-2-4.2 4.6 1.3-.8-5 3.6 1.5z"/><path d="M0 12V-6M0 2L-5 -2M0 2l5-4M0-2L-3-6M0-2l3-4" stroke="rgba(0,0,0,.28)" stroke-width=".7" fill="none"/></symbol>
<symbol id="oak" viewBox="-12 -12 24 24"><path d="M0 11C-3 10-5 7.5-4.5 5-7 4-8 1-6.5-.5-8-2.5-6-5-3.5-5-3-8 0-11 0-11s3 3 3.5 6c2.5 0 4.5 2.5 3 4.5C7.5 1 6.5 4 4.5 5 5 7.5 3 10 0 11z"/><path d="M0 11V-8M0 6l-3-3M0 6l3-3M0 1l-3-2M0 1l3-2" stroke="rgba(0,0,0,.28)" stroke-width=".7" fill="none"/></symbol>
</defs></svg>`;
  const ic = (n, cls, st) => `<svg class="i ${cls || ""}" style="${st || ""}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;

  // ---------------------------------------------------------------- predator scenes (232 x 84, duotone, theme tokens)
  const INK = 'stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const car = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 22v-9l7-10c1-1.4 2.4-2 4-2h22c1.6 0 3 .7 4 2l8 10v9z" fill="var(--raised)" ${INK}/><path d="M9 11l5-6.5h17l5 6.5z" fill="var(--pred-wash)" ${INK}/><circle cx="12" cy="23" r="5" fill="var(--ink)"/><circle cx="12" cy="23" r="1.8" fill="var(--raised)"/><circle cx="38" cy="23" r="5" fill="var(--ink)"/><circle cx="38" cy="23" r="1.8" fill="var(--raised)"/></g>`;
  const ground = `<rect width="232" height="84" fill="var(--pred-wash)"/><rect y="64" width="232" height="20" fill="var(--line2)" opacity=".5"/><path d="M0 64h232" ${INK} opacity=".5"/>`;
  const big = (name, x, y, s) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 24 24" style="overflow:visible;color:var(--pred)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="art-i"><use href="#i-${name}"/></svg>`;
  const SCENES = {
    parking: `${ground}<rect x="0" y="60" width="232" height="6" fill="var(--raised)"/>${car(70, 36, 1.35)}<path d="M168 62V20" ${INK} stroke-width="2.4"/><rect x="154" y="6" width="28" height="22" rx="4" fill="var(--pred)" stroke="var(--ink)" stroke-width="1.6"/><text x="168" y="23" text-anchor="middle" font-family="Instrument Sans,sans-serif" font-weight="700" font-size="17" fill="#fff">P</text><rect x="22" y="22" width="30" height="22" rx="2" fill="var(--raised)" ${INK} transform="rotate(-6 37 33)"/><path d="M28 30h18M28 36h12" ${INK} opacity=".6" transform="rotate(-6 37 33)"/>`,
    abandoned: `${ground}<g transform="rotate(-4 116 50)">${car(66, 34, 1.5)}</g><rect x="76" y="64" width="14" height="6" fill="var(--ink)" opacity=".7"/><path d="M162 30l12-8M168 42l14-4" ${INK} opacity=".35"/><use href="#maple" x="-12" y="-12" width="24" height="24" transform="translate(116 28) rotate(25) scale(.9)" fill="#C2401A"/><use href="#maple" x="-12" y="-12" width="24" height="24" transform="translate(172 66) rotate(-30) scale(.7)" fill="#D9A428"/><path d="M40 70l24-6M30 62l18-3" ${INK} opacity=".45"/>`,
    silence: `<rect width="232" height="84" fill="var(--pred-wash)"/><path d="M0 68h232" ${INK} opacity=".5"/><g ${INK} fill="var(--raised)"><rect x="26" y="34" width="52" height="34"/><rect x="82" y="22" width="52" height="46"/><rect x="138" y="34" width="52" height="34"/></g><g fill="var(--pred)" opacity=".55"><rect x="34" y="42" width="8" height="10"/><rect x="62" y="42" width="8" height="10"/><rect x="90" y="30" width="8" height="10"/><rect x="118" y="30" width="8" height="10"/><rect x="90" y="48" width="8" height="10"/><rect x="146" y="42" width="8" height="10"/><rect x="174" y="42" width="8" height="10"/></g><path d="M196 8h26a4 4 0 014 4v14a4 4 0 01-4 4h-14l-8 7v-7h-4a4 4 0 01-4-4V12a4 4 0 014-4z" fill="var(--raised)" ${INK}/><path d="M202 19h20" ${INK} opacity=".7"/>`,
    storm: `<rect width="232" height="84" fill="var(--pred-wash)"/><path d="M0 68h232" ${INK} opacity=".5"/><rect y="68" width="232" height="16" fill="var(--raised)" opacity=".8"/><path d="M60 40a16 16 0 0116-16 20 20 0 0138 4 14 14 0 11-2 28H66a12 12 0 01-6-16z" fill="var(--raised)" ${INK} transform="translate(30 -6)"/>${[[78, 52], [98, 60], [118, 50], [138, 62], [158, 54], [108, 70], [130, 72]].map(([x, y]) => `<g transform="translate(${x} ${y})" ${INK} stroke-width="1.3"><path d="M-3 0h6M0-3v6M-2.1-2.1l4.2 4.2M2.1-2.1l-4.2 4.2"/></g>`).join("")}`
  };
  const ICON_FOR = [[/pothole|street light|sign|road|sidewalk/i, "pothole"], [/trash|rubbish|recycl|dumping|barrel/i, "trash"], [/tow/i, "tow"], [/signal|traffic|light/i, "light"], [/tree|branch/i, "branch"], [/leaf|leaves/i, "leaf"], [/snow|ice/i, "snow"], [/rodent|rat/i, "rodent"], [/inspect|housing|building|sanitary/i, "house"], [/pile|yard/i, "pile"]];
  // line scenes by the predator's type (not its department): stacked tickets, crews with one empty place, a bar rising past a line, a clock
  const LN = 'fill="none" stroke="var(--ink2)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"', BASE = '<path d="M16 68h200" stroke="var(--line2)" stroke-width="1.2" stroke-linecap="round" fill="none"/>';
  const TYPES = {
    backlog: `${BASE}<g ${LN}><rect x="84" y="50" width="64" height="16" rx="3" fill="var(--raised)"/><rect x="78" y="36" width="64" height="16" rx="3" fill="var(--raised)"/><rect x="90" y="20" width="64" height="16" rx="3" fill="var(--raised)" transform="rotate(-4 122 28)"/><path d="M98 28h26M98 24h12M86 44h22M92 58h30"/></g>`,
    capacity: `${BASE}<g ${LN}>${[62, 96, 130].map(x => `<circle cx="${x}" cy="30" r="7"/><path d="M${x - 12} 66c0-9 5-16 12-16s12 7 12 16z" fill="var(--raised)"/>`).join("")}<circle cx="164" cy="30" r="7" stroke-dasharray="3 3.2"/><path d="M152 66c0-9 5-16 12-16s12 7 12 16z" stroke-dasharray="3 3.2"/></g>`,
    spike: `${BASE}<path d="M16 40h200" stroke="var(--ink3)" stroke-width="1.2" stroke-dasharray="4 4" fill="none"/><g ${LN}>${[10, 14, 12, 18, 30, 52].map((h, i) => `<rect x="${60 + i * 20}" y="${68 - h}" width="12" height="${h}" rx="1.5" fill="var(--raised)"/>`).join("")}</g>`,
    delay: `${BASE}<g ${LN}><circle cx="116" cy="38" r="23" fill="var(--raised)"/><path d="M116 22v17l11 7"/><path d="M116 11v4M116 61v4M93 38h-4M143 38h4"/></g>`,
  };
  function scene(kind, req, name) {
    const r = String(req || ""), n = String(name || "");
    if (kind === "silence" || /silence/i.test(n)) return SCENES.silence;
    if (name) {
      if (/spike|surge|shock/i.test(n) || kind === "shock") return TYPES.spike;
      if (/capacity|crew|staff/i.test(n) || kind === "capacity") return TYPES.capacity;
      if (/delay|slow|wait/i.test(n)) return TYPES.delay;
      if (/backlog|queue/i.test(n) || kind === "miss") return TYPES.backlog;
    }
    if (kind === "shock" && !/parking|vehicle/i.test(r)) return SCENES.storm;
    if (/parking/i.test(r)) return SCENES.parking;
    if (/abandon|vehicle/i.test(r)) return SCENES.abandoned;
    if (kind === "shock") return SCENES.storm;
    const ico = (ICON_FOR.find(p => p[0].test(r)) || [0, "pile"])[1];
    return `${ground}${big(ico, 88, 8, 56)}<path d="M28 58h30M172 58h34" ${INK} opacity=".35"/>`;
  }

  // ---------------------------------------------------------------- the branch (port of the approved organic limb)
  function branch(W, night) {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const k = W / 1440, X = x => x * k;
    const f1 = v => v.toFixed(1);
    function limb(pts, w0, w1, jit) {
      jit = jit === undefined ? 1.2 : jit; const n = pts.length, top = [], bot = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), w = (w0 + (w1 - w0) * Math.pow(t, 0.8)) / 2, a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        const j1 = (rnd() - 0.5) * jit * (w / 10 + 0.3), j2 = (rnd() - 0.5) * jit * (w / 10 + 0.3);
        top.push([pts[i][0] + nx * (w + j1), pts[i][1] + ny * (w + j1)]); bot.push([pts[i][0] - nx * (w + j2), pts[i][1] - ny * (w + j2)]);
      }
      const f = p => p.map(q => f1(q[0]) + " " + f1(q[1]));
      return { d: "M" + f(top).join(" L") + " L" + f(bot.slice().reverse()).join(" L") + "Z", top, bot };
    }
    const curve = (x0, x1, fy, step) => { const p = []; for (let x = x0; x <= x1; x += step || 14) p.push([x, fy(x)]); return p; };
    const path2 = pts => pts.map((p, i) => (i ? "L" : "M") + f1(p[0]) + " " + f1(p[1])).join("");
    const cy = x => 52 - 14 * Math.sin(x / W * Math.PI * 0.9) + 4 * Math.sin(x / 170) + (x > 0.8 * W ? (x - 0.8 * W) * 0.05 : 0);
    const x0 = -60, x1 = W - 45, main = curve(x0, x1, cy, 14), M = limb(main, 46, 3);
    const twigsSrc = [[300, -1, 150, -58, 9], [640, 1, 120, -40, 6], [930, 1, 170, -62, 8], [1180, 1, 120, 30, 5], [1300, 1, 90, -34, 4]];
    const T = twigsSrc.map(([x, d, len, rise, w]) => { x = X(x); const y = cy(x), p = []; for (let i = 0; i <= 10; i++) { const t = i / 10; p.push([x + d * len * t, y + rise * Math.sin(t * Math.PI / 2) + (i ? (rnd() - 0.5) * 2 : 0)]); } return { p, w, end: p[10] }; });
    const tw = T.map(t => limb(t.p, t.w, 1.5, 0.6).d);
    const pal = night
      ? { hi: "#5A4A42", mid: "#2E2622", lo: "#12100E", grain: "#0B0A0E", knot: "#08070A", rim: "#B3A394", twig: "#2E2622", shadow: 0.6, leaves: ["#7E2E18", "#93561C", "#8C6E22", "#5E1E14", "#743818", "#4D5424"] }
      : { hi: "#8A6A4E", mid: "#5E4734", lo: "#2E2219", grain: "#21180F", knot: "#1E150D", rim: "#C9A47E", twig: "#4A3828", shadow: 0.35, leaves: ["#C2401A", "#E0801F", "#D9A428", "#9E2E1B", "#B8541A", "#7F8A2C"] };
    let grain = ""; for (let q = -3; q <= 3; q++) { if (!q) continue; const pts = curve(x0, 0.83 * W + q * 20, x => cy(x) + q * (23 - x / W * 20) / 4 + (rnd() - 0.5) * 1.5, 30); grain += `<path d="${path2(pts)}" stroke="${pal.grain}" stroke-width="${1 + Math.abs(q) % 2 * 0.4}" fill="none" opacity=".5" stroke-dasharray="${f1(60 + rnd() * 120)} ${f1(10 + rnd() * 30)}"/>`; }
    const wAt = x => (46 + (3 - 46) * Math.pow((x + 60) / (W + 15), 0.8)) / 2;
    const rim = curve(x0, W - 80, x => cy(x) - wAt(x) + 1.5, 20);
    const knots = [[X(470), cy(X(470)) + 3], [X(1040), cy(X(1040)) + 1]].map(([x, y]) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="7" ry="4" fill="${pal.knot}"/><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="11" ry="6.5" fill="none" stroke="${pal.grain}" stroke-width="1.2" opacity=".7"/>`).join("");
    let li = 0; const LEAF = pal.leaves;
    const leaf = (x, y, r, s) => `<path d="M${f1(x)} ${f1(y)}l${f1(Math.cos(r) * 7)} ${f1(Math.sin(r) * 7)}" stroke="${pal.twig}" stroke-width="1.2"/><use href="#${li % 3 ? "maple" : "oak"}" transform="translate(${f1(x + Math.cos(r) * 14)} ${f1(y + Math.sin(r) * 14)}) rotate(${(r * 57 + 90).toFixed(0)}) scale(${(s / 24).toFixed(3)})" x="-12" y="-12" width="24" height="24" fill="${LEAF[li++ % LEAF.length]}"/>`;
    let leaves = "";
    T.forEach(t => { const [x, y] = t.end;[-2.2, -1.4, -0.6, 0.3].forEach(r => { if (rnd() < 0.85) leaves += leaf(x, y, r + (rnd() - 0.5) * 0.4, 18 + rnd() * 8); }); });
    [[200, -1.9], [560, -1.2], [760, -2.1], [860, 1.2], [1100, -1.6], [1350, -1]].forEach(([x, r]) => { x = X(x); leaves += leaf(x, cy(x) - 6, r, 18 + rnd() * 6); });
    // underside of the limb, for the cords and for Terry's grip
    const under = x => { let best = main[0], bi = 0; for (let i = 0; i < main.length; i++) if (Math.abs(main[i][0] - x) < Math.abs(best[0] - x)) { best = main[i]; bi = i; } return M.bot[bi][1]; };
    const svg = `<svg class="branch-svg" width="${W}" height="110" viewBox="0 0 ${W} 110" aria-hidden="true" style="overflow:visible">
 <defs><linearGradient id="bk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.hi}"/><stop offset=".35" stop-color="${pal.mid}"/><stop offset="1" stop-color="${pal.lo}"/></linearGradient>
 <filter id="bsh" x="-5%" y="-50%" width="110%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="${pal.shadow}"/></filter></defs>
 <g filter="url(#bsh)"><path d="${M.d}" fill="url(#bk2)"/>${tw.map(d => `<path d="${d}" fill="url(#bk2)"/>`).join("")}</g>
 ${grain}${knots}<path d="${path2(rim)}" stroke="${pal.rim}" stroke-width="1.3" fill="none" opacity=".55"/>${leaves}</svg>`;
    return { svg, under, cy, tip: { x: x1, y: cy(x1) } };
  }

  root.TerryArt = { ICONS, sprite, ic, scene, branch };
  // the departments' icons, the same symbols the projector draws at city level (app.js DICON): one helper for every module
  const DEPT_ICON = { PWDx: "truck", BTDT: "light", PARK: "leaf", ISD: "house" };
  // dept(code, cls, style): sized to the text (1.15em) unless a style is given; coloured by currentColor; decorative (aria-hidden); "" for an unknown code
  // (one helper: ledger rows, ticket stubs, the Almanac's icon tile, BUDGETerry's hover detail)
  const DEPT_STYLE = "width:1.15em;height:1.15em;vertical-align:-.22em";
  root.TerryIcons = { DEPT: DEPT_ICON, SYM: DEPT_ICON, dept: (d, cls, st) => (DEPT_ICON[d] ? ic(DEPT_ICON[d], "dicon dept-ic " + (cls || ""), st || DEPT_STYLE) : "") };
})(typeof window !== "undefined" ? window : globalThis);
