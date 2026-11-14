// The Cozy Corner scene: wallpaper is CSS (see .scene in styles.css), furniture and the
// window are inline SVG (viewBox 1000x640), characters are positioned overlays so they can
// glide between spots with a CSS transform transition.
import { renderCharacter } from './characters.js';
import { ACTIVITIES, esc } from './util.js';

// Where a character stands (x = centre, y = feet) for each activity.
export const SPOTS = {
  idle: { x: 520, y: 632, pose: 'stand', item: null },
  desk: { x: 170, y: 452, pose: 'sit', item: 'laptop' },
  reading: { x: 725, y: 455, pose: 'sit', item: 'book' },
  gaming: { x: 235, y: 622, pose: 'sit', item: 'controller' },
  music: { x: 598, y: 462, pose: 'stand', item: 'headphones' },
  window: { x: 420, y: 342, pose: 'sit', item: 'mug' },
  workbench: { x: 370, y: 630, pose: 'stand', item: 'soldering' },
  plants: { x: 905, y: 630, pose: 'stand', item: 'watering' }
};
export const itemFor = (activity) => (SPOTS[activity] || SPOTS.idle).item || 'none';

const ZONES = {
  desk: [[15, 300, 290, 160]],
  window: [[330, 50, 250, 300]],
  reading: [[640, 60, 190, 400]],
  music: [[560, 380, 80, 80]],
  plants: [[835, 80, 160, 140], [825, 470, 170, 130]],
  gaming: [[15, 465, 290, 170]],
  workbench: [[415, 440, 295, 180]]
};

function shelfBooks(x0, y, w, seed) {
  const cols = ['#B9A6EC', '#F6C945', '#7C63C9', '#8C93D9', '#E9A23B', '#DCD2F7', '#5B43A8'];
  let x = x0;
  let i = seed;
  let out = '';
  while (x < x0 + w - 10) {
    const bw = 8 + ((i * 7) % 7);
    const bh = 28 + ((i * 11) % 16);
    out += `<rect x="${x}" y="${y - bh}" width="${bw}" height="${bh}" rx="2" fill="${cols[i % cols.length]}"/>`;
    x += bw + 1;
    i++;
  }
  return out;
}

function pot(x, y, c = '#F6C945') {
  return `<path d="M${x - 14} ${y}h28l-4 20h-20z" fill="${c}"/><rect x="${x - 16}" y="${y - 4}" width="32" height="6" rx="3" fill="${c}"/>`;
}

function zoneG(id) {
  const rects = ZONES[id];
  const [x, y] = rects[0];
  const label = ACTIVITIES[id].name;
  const lw = label.length * 7.4 + 18;
  return `<g class="zone" data-zone="${id}" role="button" tabindex="0" aria-label="Go to: ${esc(label)}">
    ${rects.map(([a, b, w, h]) => `<rect class="zr" x="${a}" y="${b}" width="${w}" height="${h}" rx="18"/>`).join('')}
    <g class="zl" transform="translate(${x + 8} ${y + 8})"><rect width="${lw}" height="26" rx="13"/><text x="${lw / 2}" y="17.5" text-anchor="middle">${esc(label)}</text></g></g>`;
}

function sceneSvg() {
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky-top)"/><stop offset="1" style="stop-color:var(--sky-bot)"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#FFE79A" stop-opacity=".9"/><stop offset="1" stop-color="#FFE79A" stop-opacity="0"/></radialGradient>
    <clipPath id="glass"><rect x="356" y="76" width="188" height="170" rx="6"/></clipPath>
  </defs>

  <!-- WINDOW -->
  <g class="window">
    <rect x="340" y="60" width="220" height="200" rx="14" fill="#DCD2F7" stroke="#8E7AD6" stroke-width="3"/>
    <rect x="356" y="76" width="188" height="170" rx="6" fill="url(#sky)"/>
    <g clip-path="url(#glass)">
      <g class="w-stars"><circle cx="390" cy="104" r="1.8" fill="#FFE79A"/><circle cx="430" cy="130" r="1.3" fill="#fff"/><circle cx="470" cy="96" r="1.8" fill="#FFE79A"/><circle cx="520" cy="140" r="1.4" fill="#fff"/><circle cx="500" cy="170" r="1.2" fill="#fff"/><circle cx="376" cy="160" r="1.4" fill="#fff"/></g>
      <circle class="w-moon" cx="500" cy="112" r="16" fill="#FFE79A"/>
      <circle class="w-sun" cx="450" cy="222" r="34" fill="url(#glow)"/><circle class="w-sun" cx="450" cy="226" r="18" fill="#FFE79A"/>
      <g class="w-clouds"><ellipse cx="410" cy="116" rx="40" ry="14" fill="#8C93D9" opacity=".8"/><ellipse cx="480" cy="140" rx="46" ry="15" fill="#4A4F9C" opacity=".9"/><ellipse cx="530" cy="106" rx="30" ry="11" fill="#8C93D9" opacity=".7"/></g>
      <path d="M356 246V212q30-26 60-8t60-14 68 4V246z" fill="#2B1F52" opacity=".55"/>
      <g class="w-lights"><circle cx="396" cy="226" r="2" fill="#FFE79A"/><circle cx="436" cy="232" r="2" fill="#FFE79A"/><circle cx="506" cy="224" r="2" fill="#FFE79A"/></g>
      <g class="w-birds"><path class="bird b1" d="M400 120q6-8 12 0q6-8 12 0" fill="none" stroke="#2B1F52" stroke-width="2.2" stroke-linecap="round"/><path class="bird b2" d="M470 100q5-7 10 0q5-7 10 0" fill="none" stroke="#2B1F52" stroke-width="2" stroke-linecap="round"/></g>
      <g class="w-rain"><path class="drip d1" d="M380 80v40M420 90v30M462 78v44M505 86v36" stroke="#8C93D9" stroke-width="2" stroke-linecap="round" opacity=".7"/><path class="drip d2" d="M400 150v36M440 140v40M484 150v32M526 136v44" stroke="#8C93D9" stroke-width="2" stroke-linecap="round" opacity=".7"/></g>
      <g class="w-snow"><circle class="flk f1" cx="390" cy="100" r="3" fill="#F4F0FD"/><circle class="flk f2" cx="440" cy="120" r="2.5" fill="#F4F0FD"/><circle class="flk f3" cx="490" cy="90" r="3" fill="#F4F0FD"/><circle class="flk f4" cx="525" cy="130" r="2.4" fill="#F4F0FD"/></g>
    </g>
    <path d="M450 76v170M356 160h188" stroke="#DCD2F7" stroke-width="5"/>
    <path d="M326 60q26 40 22 150-18-6-30 0 4-100-2-150zM574 60q-26 40-22 150 18-6 30 0-4-100 2-150z" fill="#7C63C9" opacity=".9"/>
    <rect x="330" y="258" width="240" height="22" rx="8" fill="#B9A6EC"/>
  </g>
  <!-- window seat + cat -->
  <rect x="332" y="282" width="236" height="40" rx="14" fill="#7C63C9"/>
  <rect x="340" y="318" width="220" height="34" rx="6" fill="#4B3A86"/>
  <g class="cat" transform="translate(520 290)">
    <g class="cat-body"><ellipse cx="0" cy="0" rx="38" ry="19" fill="#E9A23B"/><path d="M-20 -14q4 8 0 18M0 -18q4 10 0 20M20 -14q4 8 0 16" stroke="#C47F22" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="-30" cy="-6" r="13" fill="#E9A23B"/><path d="M-40 -16l-2-12 10 6zM-26 -17l4-11 6 9z" fill="#E9A23B"/><path d="M-36 -5q3 3 6 0M-27 -5q3 3 6 0" stroke="#2B1F52" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M36 4q18 2 6 14-22 4-50 0" fill="none" stroke="#E9A23B" stroke-width="9" stroke-linecap="round"/></g>
    <g class="zzz" fill="#DCD2F7" font-family="Fraunces,serif" font-weight="600"><text class="z1" x="-48" y="-30" font-size="14">z</text><text class="z2" x="-58" y="-44" font-size="18">z</text><text class="z3" x="-70" y="-60" font-size="22">z</text></g>
  </g>

  <!-- DESK -->
  <g>
    <rect x="22" y="352" width="282" height="14" rx="6" fill="#8B5E34"/><rect x="34" y="366" width="12" height="76" fill="#6D4626"/><rect x="278" y="366" width="12" height="76" fill="#6D4626"/>
    <rect x="130" y="378" width="82" height="14" rx="6" fill="#5B43A8"/><rect x="126" y="392" width="10" height="48" fill="#4B3A86"/><rect x="206" y="392" width="10" height="48" fill="#4B3A86"/>
    <path d="M52 352l8-44h66l8 44z" fill="#B9A6EC"/><rect x="60" y="312" width="60" height="34" rx="4" fill="#2B1F52"/><path d="M68 322h30M68 330h44M68 338h20" stroke="#F6C945" stroke-width="2.5" stroke-linecap="round"/>
    <g><rect x="206" y="330" width="22" height="22" rx="5" fill="#F4F0FD"/><path d="M228 336q12 2 0 12" fill="none" stroke="#F4F0FD" stroke-width="3"/><path class="steam" d="M214 324q-4-6 0-12M221 324q-4-6 0-12" stroke="#DCD2F7" fill="none" stroke-width="2" stroke-linecap="round"/></g>
    <g><ellipse cx="262" cy="344" rx="16" ry="9" fill="#F6C945"/><circle cx="274" cy="330" r="9" fill="#F6C945"/><path d="M281 330l8 2-8 3z" fill="#E9A23B"/><circle cx="276" cy="328" r="1.6" fill="#2B1F52"/></g>
  </g>

  <!-- LIBRARY SHELF -->
  <g>
    <rect x="642" y="64" width="150" height="190" rx="8" fill="#5B43A8" stroke="#3D2C74" stroke-width="3"/>
    <rect x="650" y="72" width="134" height="174" rx="4" fill="#2B1F52"/>
    <g>${shelfBooks(654, 112, 126, 1)}${shelfBooks(654, 168, 126, 4)}${shelfBooks(654, 228, 126, 7)}</g>
    <rect x="650" y="112" width="134" height="5" fill="#8E7AD6"/><rect x="650" y="168" width="134" height="5" fill="#8E7AD6"/><rect x="650" y="228" width="134" height="5" fill="#8E7AD6"/>
    <g transform="translate(766 62)"><rect x="-8" y="-18" width="16" height="18" rx="4" fill="#FFE79A"/><path d="M-6 -18h12" stroke="#E9A23B" stroke-width="3"/><circle cy="-9" r="14" fill="url(#glow)"/></g>
  </g>
  <!-- READING NOOK -->
  <g>
    <ellipse cx="722" cy="452" rx="130" ry="16" fill="#3D2C74"/>
    <rect x="660" y="340" width="112" height="100" rx="34" fill="#7C63C9"/><rect x="650" y="390" width="132" height="52" rx="16" fill="#8E7AD6"/>
    <rect x="644" y="376" width="26" height="66" rx="12" fill="#7C63C9"/><rect x="762" y="376" width="26" height="66" rx="12" fill="#7C63C9"/>
    <path d="M762 372q22 14 18 52l-26-6z" fill="#F6C945"/><path d="M766 384l14 4M764 398l16 4M762 410l16 4" stroke="#E9A23B" stroke-width="3"/>
    <path d="M818 232V450" stroke="#B9A6EC" stroke-width="5"/><rect x="800" y="446" width="36" height="8" rx="4" fill="#B9A6EC"/>
    <path d="M800 232l8-30h20l8 30z" fill="#FFE79A"/><ellipse class="lamp-glow" cx="818" cy="236" rx="60" ry="46" fill="url(#glow)"/>
  </g>
  <!-- RECORD PLAYER -->
  <g>
    <rect x="574" y="398" width="70" height="8" rx="3" fill="#8B5E34"/><rect x="580" y="406" width="6" height="40" fill="#6D4626"/><rect x="632" y="406" width="6" height="40" fill="#6D4626"/>
    <rect x="578" y="378" width="62" height="20" rx="5" fill="#4B3A86"/>
    <g class="disc"><ellipse cx="604" cy="376" rx="24" ry="6" fill="#1E1638"/><ellipse cx="604" cy="376" rx="6" ry="1.8" fill="#F6C945"/></g>
    <path d="M630 372l-12 4" stroke="#DCD2F7" stroke-width="2.4" stroke-linecap="round"/>
  </g>

  <!-- PLANT SHELF -->
  <g>
    <rect x="840" y="146" width="140" height="8" rx="3" fill="#8B5E34"/><rect x="840" y="206" width="140" height="8" rx="3" fill="#8B5E34"/>
    ${pot(868, 142, '#F6C945')}<path d="M868 138q-12-26-4-40M868 138q10-24 4-44" stroke="#7BAA6A" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${pot(930, 142, '#B9A6EC')}<circle cx="930" cy="110" r="18" fill="#6FA36B"/><circle cx="922" cy="104" r="4" fill="#F6C945"/>
    ${pot(956, 202, '#8C93D9')}<path d="M956 198q-20-20-30-6M956 198q20-20 30-6" stroke="#5E9A5A" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M860 90q-8 30-2 54M880 90q6 24 0 44" stroke="#7BAA6A" stroke-width="3" fill="none"/>
    <rect x="836" y="540" width="140" height="8" rx="3" fill="#8B5E34"/><rect x="846" y="548" width="8" height="30" fill="#6D4626"/><rect x="958" y="548" width="8" height="30" fill="#6D4626"/>
    ${pot(870, 536, '#F6C945')}<path d="M870 532q-18-30-4-52M870 532q16-26 8-50M870 532q-2-30 0-56" stroke="#6FA36B" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${pot(930, 536, '#7C63C9')}<ellipse cx="930" cy="510" rx="16" ry="20" fill="#7BAA6A"/><circle cx="930" cy="486" r="8" fill="#E9A23B"/>
    <ellipse cx="906" cy="580" rx="76" ry="10" fill="#3D2C74" opacity=".7"/>
  </g>

  <!-- GAME CORNER -->
  <g>
    <rect x="26" y="548" width="126" height="12" rx="4" fill="#4B3A86"/><rect x="36" y="560" width="8" height="44" fill="#3D2C74"/><rect x="134" y="560" width="8" height="44" fill="#3D2C74"/>
    <rect x="38" y="486" width="104" height="62" rx="8" fill="#1E1638" stroke="#7C63C9" stroke-width="3"/>
    <g fill="#F6C945"><rect x="62" y="500" width="6" height="6"/><rect x="74" y="500" width="6" height="6"/><rect x="56" y="506" width="30" height="6"/><rect x="62" y="512" width="6" height="6"/><rect x="74" y="512" width="6" height="6"/></g>
    <g fill="#B9A6EC"><rect x="104" y="522" width="6" height="6"/><rect x="116" y="522" width="6" height="6"/><rect x="104" y="528" width="18" height="6"/></g>
    <ellipse cx="232" cy="600" rx="68" ry="34" fill="#5B43A8"/><ellipse cx="232" cy="590" rx="58" ry="26" fill="#7C63C9"/>
  </g>

  <!-- WORKBENCH -->
  <g>
    <rect x="424" y="522" width="280" height="14" rx="6" fill="#8B5E34"/><rect x="438" y="536" width="12" height="70" fill="#6D4626"/><rect x="676" y="536" width="12" height="70" fill="#6D4626"/>
    <rect x="440" y="500" width="84" height="22" rx="3" fill="#F4F0FD"/><g fill="#8C93D9"><rect x="446" y="506" width="72" height="2"/><rect x="446" y="512" width="72" height="2"/></g><path d="M446 503h72M446 517h72" stroke="#B9A6EC" stroke-width="2" stroke-dasharray="2 4"/>
    <rect x="534" y="506" width="62" height="16" rx="3" fill="#5B43A8"/><path d="M540 514h22l6-5h20M540 519h40" stroke="#E9A23B" stroke-width="1.8" fill="none"/><circle cx="542" cy="510" r="1.8" fill="#FFE79A"/><circle cx="590" cy="518" r="1.8" fill="#FFE79A"/>
    <rect x="606" y="456" width="90" height="66" rx="8" fill="#4B3A86"/><rect x="614" y="464" width="74" height="38" rx="4" fill="#1E1638"/><path d="M618 483q8-16 16 0t16 0 16 0 16 0" fill="none" stroke="#FFE79A" stroke-width="2.4"/><circle cx="624" cy="512" r="4" fill="#F6C945"/><circle cx="640" cy="512" r="4" fill="#B9A6EC"/>
    <path d="M598 522l-3-18 6-2" stroke="#F4F0FD" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="601" cy="500" r="3" fill="#E9A23B"/>
  </g>

  ${Object.keys(ZONES).map(zoneG).join('')}`;
}

export function createScene(host, { onZone, onChip } = {}) {
  host.innerHTML = `<div class="scene"><svg class="scene-svg" viewBox="0 0 1000 640" role="group" aria-label="Cozy Corner. Pick a spot in the room.">${sceneSvg()}</svg><div class="chars"></div><button class="scene-chip" type="button" hidden></button><div class="fx-host"></div></div>`;
  const sceneEl = host.querySelector('.scene');
  const svg = host.querySelector('.scene-svg');
  const charsEl = host.querySelector('.chars');
  const chip = host.querySelector('.scene-chip');
  const els = {};
  const sigs = {};
  let chipLoc = null;

  const pick = (e) => {
    const g = e.target.closest('.zone');
    if (g) onZone?.(g.dataset.zone);
  };
  svg.addEventListener('click', pick);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); }
  });
  chip.addEventListener('click', () => chipLoc && onChip?.(chipLoc));

  function place(key, spec) {
    let el = els[key];
    if (!el) {
      el = els[key] = document.createElement('div');
      el.className = `char ${key}`;
      el.hidden = true;
      charsEl.appendChild(el);
    }
    if (!spec) { el.hidden = true; return; }
    const spot = SPOTS[spec.spot] || SPOTS.idle;
    const pose = spec.who === 'together' ? 'together' : spot.pose;
    const sig = [spec.who, pose, spot.item, spec.name, spec.faded, spec.tag].join('|');
    if (sigs[key] !== sig) {
      sigs[key] = sig;
      el.innerHTML = `${renderCharacter({ who: spec.who, pose: spot.pose, item: spot.item })}<span class="tag">${esc(spec.name)}</span>${spec.tag ? `<span class="ghost-note">${esc(spec.tag)}</span>` : ''}<span class="heart" aria-hidden="true">♥</span>`;
    }
    el.dataset.pose = pose;
    el.classList.toggle('faded', !!spec.faded);
    // Transform-based placement (units: 1cqw = 1% of scene width; the scene keeps a 1000x640 ratio).
    el.style.setProperty('--x', spot.x / 10);
    el.style.setProperty('--y', (640 - spot.y) / 10);
    el.hidden = false;
  }

  return {
    fxHost: host.querySelector('.fx-host'),
    // p: { me, other, chip: {text, loc}|null }
    update(p) {
      const together = p.me && p.other && !p.other.faded && p.me.spot === p.other.spot;
      place('me', together ? null : p.me);
      place('other', together ? null : p.other);
      place('together', together ? { who: 'together', spot: p.me.spot, name: `${p.me.name} & ${p.other.name}` } : null);
      svg.querySelectorAll('.zone').forEach((z) => z.classList.toggle('active', !!p.me && z.dataset.zone === p.me.spot));
      if (p.chip) {
        chip.hidden = false;
        chip.textContent = p.chip.text;
        chip.setAttribute('aria-label', `${p.chip.text}. Travel there.`);
        chipLoc = p.chip.loc;
      } else { chip.hidden = true; chipLoc = null; }
    },
    // A small wave with a heart pop. who: 'me' | 'other'
    wave(who) {
      const el = !els.together?.hidden ? els.together : els[who];
      if (!el || el.hidden) return;
      el.classList.remove('waving');
      void el.offsetWidth;
      el.classList.add('waving');
      setTimeout(() => el.classList.remove('waving'), 1800);
    },
    destroy() { sceneEl.remove(); }
  };
}
