// Predator drawings for the Roost: duotone. A solid wash shape (var(--fill)) sits behind
// 1.8 px line art in var(--line); key parts are filled solid in the line colour so the drawing reads from across the room.
// Each symbol is 120 x 80. Use: <svg class="art rust"><use href="#p-car"/></svg>
(function(){ var d=document.createElement('div'); d.setAttribute('aria-hidden','true'); d.style.cssText='position:absolute;width:0;height:0;overflow:hidden'; d.innerHTML = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<defs>
  <!-- Terry escaping a predator: the owl below, Terry away up the flyway (owner 7 Nov); the mark for "How Terry plans to escape it" -->
  <symbol id="r2-escape" viewBox="0 0 120 80">
    <ellipse cx="60" cy="46" rx="56" ry="28" fill="var(--fill)"/>
    <path d="M40 44 C 54 26, 70 40, 86 24" fill="none" stroke="var(--esc-path)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3.5 4"/>
    <path d="M78 14 l-7 -2 M77 20 l-8 1 M80 9 l-5 -4" fill="none" stroke="var(--esc-path)" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    <g transform="translate(9 31) scale(1.55)">
      <path d="M6 8.5 7 4l3 2.6h4L17 4l1 4.5c1 1.4 1.4 3 1.4 4.8 0 4.3-3.3 7.2-7.4 7.2s-7.4-2.9-7.4-7.2c0-1.8.4-3.4 1.4-4.8z" fill="var(--esc-owl)" stroke="var(--esc-ink)" stroke-width="1.1" stroke-linejoin="round"/>
      <circle cx="9.4" cy="11" r="2.2" fill="var(--paper)"/><circle cx="14.6" cy="11" r="2.2" fill="var(--paper)"/>
      <circle cx="10.1" cy="10.4" r="1" fill="var(--esc-ink)"/><circle cx="15.3" cy="10.4" r="1" fill="var(--esc-ink)"/>
      <path d="M11.2 13.2 L12 14.6 L12.8 13.2 Z" fill="var(--esc-ink)"/>
      <path d="M8 21 l-.6 1.6 M10.5 21.3 l0 1.7 M13.5 21.3 l0 1.7 M16 21 l.6 1.6" stroke="var(--esc-ink)" stroke-width="1" stroke-linecap="round"/>
    </g>
    <g transform="translate(97 19) rotate(-14) scale(1.75)">
      <path d="M-3.5 -2.5 Q-9 -9 -16 -5 Q-13 -2.5 -12.5 1 Q-9.5 -1.2 -8.5 2 Q-6.2 -.5 -3.5 3 Z M3.5 -2.5 Q9 -9 16 -5 Q13 -2.5 12.5 1 Q9.5 -1.2 8.5 2 Q6.2 -.5 3.5 3 Z" fill="var(--esc-bat)"/>
      <ellipse cx="0" cy="0" rx="4.6" ry="5.8" fill="var(--esc-bat)"/><circle cx="0" cy="-6.2" r="4.4" fill="var(--esc-bat)"/>
      <path d="M-4 -8 L-2.6 -13.6 L-.9 -9.4 Z M4 -8 L2.6 -13.6 L.9 -9.4 Z" fill="var(--esc-bat)"/>
      <path d="M-3 -6 q1.2 -1.6 2.4 0 M.6 -6 q1.2 -1.6 2.4 0" fill="none" stroke="#FFF8EE" stroke-width=".95" stroke-linecap="round"/>
      <path d="M-.9 -3.4 l.5 1.1 l.5 -1.1 Z" fill="#FFF8EE"/>
    </g>
  </symbol>
  <!-- parked car with a pile of tickets: a parking backlog -->
  <symbol id="r2-p-car" viewBox="0 0 120 80">
    <ellipse cx="60" cy="46" rx="52" ry="26" fill="var(--fill)"/>
    <g fill="none" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 58h100"/>
      <path d="M22 58V46l10-14h36l14 14h12a4 4 0 0 1 4 4v8z" fill="var(--line)"/>
      <path d="M36 32l-6 12h26V32z" fill="var(--paper)" stroke="none" opacity=".9"/>
      <circle cx="36" cy="58" r="6.5" fill="var(--paper)"/><circle cx="84" cy="58" r="6.5" fill="var(--paper)"/>
      <rect x="80" y="12" width="24" height="15" rx="1.5" transform="rotate(-8 92 20)" fill="var(--paper)"/>
      <rect x="84" y="8" width="24" height="15" rx="1.5" transform="rotate(5 96 16)" fill="var(--paper)"/>
      <path d="M89 13h13M89 17h8"/>
    </g>
  </symbol>
  <!-- four hard hats, one missing: crew capacity -->
  <symbol id="r2-p-crew" viewBox="0 0 120 80">
    <ellipse cx="60" cy="48" rx="54" ry="22" fill="var(--fill)"/>
    <g fill="var(--line)" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 52a13 13 0 0 1 26 0z"/><path d="M36 52a13 13 0 0 1 26 0z"/><path d="M64 52a13 13 0 0 1 26 0z"/>
      <path d="M5 52h32M33 52h32M61 52h32" fill="none"/>
      <path d="M21 39v-5M49 39v-5M77 39v-5" fill="none"/>
      <path d="M94 52a13 13 0 0 1 24 0" fill="none" stroke-dasharray="3 3"/><path d="M91 52h30" fill="none" stroke-dasharray="3 3"/>
      <path d="M12 66h96" fill="none" opacity=".45"/>
    </g>
  </symbol>
  <!-- bars rising into a dotted unknown: a demand spike no one has measured -->
  <symbol id="r2-p-spike" viewBox="0 0 120 80">
    <ellipse cx="60" cy="48" rx="52" ry="24" fill="var(--fill)"/>
    <g fill="var(--line)" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 64h96" fill="none"/>
      <rect x="22" y="48" width="11" height="16"/><rect x="38" y="42" width="11" height="22"/><rect x="54" y="45" width="11" height="19"/><rect x="70" y="36" width="11" height="28"/>
      <rect x="86" y="12" width="11" height="52" fill="var(--paper)" stroke-dasharray="3 3"/>
      <text x="91.5" y="9" font-size="13" stroke="none" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-weight="600">?</text>
    </g>
  </symbol>
  <!-- a quiet house, shutters closed, an empty speech bubble: nobody is calling it in -->
  <symbol id="r2-p-quiet" viewBox="0 0 120 80">
    <ellipse cx="60" cy="50" rx="52" ry="24" fill="var(--fill)"/>
    <g fill="none" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 66h96"/>
      <path d="M28 66V38l26-20 26 20v28z" fill="var(--line)"/>
      <path d="M46 66V50h16v16z" fill="var(--paper)" stroke="none"/>
      <path d="M36 44h8v9h-8zM64 44h8v9h-8z" fill="var(--paper)" stroke="none"/>
      <path d="M84 24c0-7 6-12 14-12s14 5 14 12-6 12-14 12h-4l-7 6v-7c-2-3-3-7-3-11z" fill="var(--paper)" stroke-dasharray="3 3"/>
    </g>
  </symbol>
  <!-- a clock past the hour: delays -->
  <symbol id="r2-p-clock" viewBox="0 0 120 80">
    <ellipse cx="60" cy="44" rx="48" ry="30" fill="var(--fill)"/>
    <g fill="none" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="60" cy="42" r="27" fill="var(--paper)"/><circle cx="60" cy="42" r="2" fill="var(--line)"/>
      <path d="M60 42V21M60 42l15 11" stroke-width="2.4"/>
      <path d="M60 15v4M60 65v4M33 42h4M83 42h4"/>
      <path d="M92 20l7-7M99 20l-7-7" stroke-width="2.2"/>
    </g>
  </symbol>
  <!-- Terry in flight, side view -->
  <symbol id="r2-terry" viewBox="0 0 48 28" fill="currentColor">
    <path d="M24 14c-3-6-9-9-16-9 2 3 3 6 2 9-4-1-7 0-9 2 4 1 7 3 9 6 3-2 6-3 9-2l5 4 5-4c3-1 6 0 9 2 2-3 5-5 9-6-2-2-5-3-9-2-1-3 0-6 2-9-7 0-13 3-16 9z"/>
  </symbol>
  <!-- an owl on the wing, one predator in the sky -->
  <symbol id="r2-owl" viewBox="0 0 20 24" fill="currentColor">
    <path d="M4 4l2 3c-2 3-2 7-1 10 1 3 3 5 5 5s4-2 5-5c1-3 1-7-1-10l2-3-3 2a6 6 0 0 0-6 0z"/>
  </symbol>
</defs>
</svg>`; document.body.insertBefore(d, document.body.firstChild); })();
