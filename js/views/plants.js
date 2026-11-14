// Plant spot. Growth stage comes from days since planting; the water meter decays with real
// hours. Plants droop when thirsty but never die.
import { PLANT_TYPES, POT_COLORS, esc, relTime } from '../util.js';

const STAGES = ['Seed', 'Sprout', 'Young', 'Growing', 'Blooming'];
const stageOf = (p) => {
  const d = (Date.now() - p.plantedAt) / 86400000;
  return d < 1 ? 0 : d < 3 ? 1 : d < 7 ? 2 : d < 14 ? 3 : 4;
};
const waterOf = (p) => Math.max(0.12, 1 - (Date.now() - p.wateredAt) / 3600000 / 48);
const G = '#6FA36B';

// Each returns SVG with the origin at the soil, growing upward (about 90 units at full size).
const ART = {
  lavender: (b) => `<path d="M0 0Q-10-40-20-84M0 0Q0-44 0-88M0 0Q10-40 20-84" stroke="${G}" stroke-width="3.5" fill="none" stroke-linecap="round"/>${[[-20, -84], [0, -88], [20, -84], [-15, -66], [15, -66], [0, -70]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${b ? 5 : 3}" ry="${b ? 11 : 6}" fill="${b ? '#B9A6EC' : G}"/>`).join('')}`,
  sunflower: (b) => `<path d="M0 0V-76" stroke="${G}" stroke-width="5"/><ellipse cx="-14" cy="-30" rx="14" ry="6" fill="${G}" transform="rotate(-25 -14 -30)"/><ellipse cx="14" cy="-46" rx="14" ry="6" fill="${G}" transform="rotate(25 14 -46)"/>${b ? [0, 45, 90, 135].map((a) => `<ellipse cx="0" cy="-82" rx="6" ry="18" fill="#F6C945" transform="rotate(${a} 0 -82)"/>`).join('') + '<circle cx="0" cy="-82" r="10" fill="#5A3A22"/>' : `<circle cx="0" cy="-78" r="8" fill="${G}"/>`}`,
  'moon-cactus': (b) => `<ellipse cx="0" cy="-18" rx="19" ry="20" fill="#7BAA6A"/><path d="M-8-30v24M8-30v24" stroke="#5E9A5A" stroke-width="2"/><circle cx="0" cy="-42" r="${b ? 13 : 8}" fill="${b ? '#E9A23B' : '#7BAA6A'}"/>`,
  fern: (b) => `<g stroke="#5E9A5A" stroke-width="4" fill="none" stroke-linecap="round">${[-50, -25, 0, 25, 50].map((a, i) => `<path d="M0 0Q${a * 0.4} -${40 + (i % 2) * 18} ${a} -${62 + (i % 2) * 16}" />${b ? `<path d="M${a * 0.5} -${34 + (i % 2) * 12}l${a > 0 ? 9 : -9} -5" stroke-width="3"/>` : ''}`).join('')}</g>`,
  'violet-orchid': (b) => `<ellipse cx="-16" cy="-10" rx="18" ry="7" fill="${G}" transform="rotate(-15 -16 -10)"/><ellipse cx="16" cy="-10" rx="18" ry="7" fill="${G}" transform="rotate(15 16 -10)"/><path d="M0 0Q4-50 24-76" stroke="#5E9A5A" stroke-width="3" fill="none"/>${b ? [[24, -76], [10, -62], [-2, -44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#8E7AD6"/><circle cx="${x}" cy="${y}" r="3.2" fill="#FFE79A"/>`).join('') : '<circle cx="24" cy="-76" r="4" fill="#8E7AD6"/>'}`,
  'lemon-tree': (b) => `<rect x="-4" y="-46" width="8" height="46" rx="3" fill="#8B5E34"/><circle cx="0" cy="-60" r="26" fill="${G}"/><circle cx="-16" cy="-48" r="14" fill="#5E9A5A"/><circle cx="16" cy="-50" r="14" fill="#5E9A5A"/>${b ? [[-10, -66], [12, -58], [0, -44], [-20, -50]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" fill="#F6C945"/>`).join('') : ''}`
};

function plantSvg(p, stage, droop) {
  const s = [0, 0.4, 0.62, 0.82, 1][stage];
  const art = stage === 0
    ? '<path d="M50 104q10-9 20 0z" fill="#5A3A22"/><circle cx="60" cy="100" r="2.6" fill="#B9A6EC"/>'
    : `<g transform="translate(60 106) scale(${s})">${(ART[p.type] || ART.fern)(stage >= 3)}</g>`;
  return `<svg viewBox="0 0 120 150" role="img" aria-label="${esc(p.label)}, ${STAGES[stage].toLowerCase()}${droop ? ', thirsty' : ''}">
    <ellipse cx="60" cy="146" rx="40" ry="4" fill="#1E1638" opacity=".4"/>
    <g class="art" style="transform-origin:60px 106px">${art}</g>
    <path d="M34 108h52l-7 32a6 6 0 0 1-6 5H47a6 6 0 0 1-6-5z" fill="${p.potColor}"/><rect x="30" y="102" width="60" height="10" rx="4" fill="${p.potColor}" stroke="#1E1638" stroke-opacity=".25"/>
  </svg>`;
}

const VERB = { plant: 'planted', water: 'watered', sun: 'put in the sun', sing: 'sang to', remove: 'said goodbye to' };

export function mount(el, ctx) {
  const S = ctx.state;
  let plants = [];
  let log = [];
  let timer = 0;
  const nameOf = (w) => (w === S.me.who ? 'You' : S.otherName);

  function render() {
    const f = document.activeElement?.dataset;
    const key = f?.act ? `[data-act="${f.act}"][data-id="${f.id}"]` : null;
    const open = el.querySelector('details')?.open;
    el.innerHTML = `<div class="plants">
      <h2>Plant spot</h2>
      <div class="plant-grid">${plants.map((p) => {
        const st = stageOf(p);
        const w = waterOf(p);
        const droop = w < 0.4;
        return `<article class="card plant ${droop ? 'droop' : ''}">
          <div class="plant-art">${plantSvg(p, st, droop)}</div>
          <div class="tag-card">${esc(p.label)} · planted by ${esc(nameOf(p.by) === 'You' ? S.me.name : S.otherName)}</div>
          <p class="muted">${STAGES[st]}${droop ? ' · a little thirsty' : ''}</p>
          <div class="meter" role="meter" aria-label="Water" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(w * 100)}"><span style="width:${Math.round(w * 100)}%"></span></div>
          <p class="muted small">Watered ${relTime(p.wateredAt)}${p.sunAt ? ` · sun ${relTime(p.sunAt)}` : ''}</p>
          <div class="row wrap">
            <button class="btn sm" data-act="water" data-id="${p.id}" aria-label="Water ${esc(p.label)}">Water</button>
            <button class="btn sm ghost" data-act="sun" data-id="${p.id}" aria-label="Give ${esc(p.label)} some sun">Sun</button>
            <button class="btn sm ghost" data-act="sing" data-id="${p.id}" aria-label="Sing to ${esc(p.label)}">Sing</button>
            <button class="btn sm ghost danger-text" data-act="remove" data-id="${p.id}" aria-label="Remove ${esc(p.label)}">Remove</button>
          </div></article>`;
      }).join('') || '<p class="muted">The shelf is empty. Plant something below.</p>'}</div>
      <details class="card add" ${open ? 'open' : ''}><summary>Plant something new</summary>
        <form id="addForm">
          <fieldset><legend>Seed</legend><div class="opts">${PLANT_TYPES.map((t, i) => `<label class="pill-opt"><input type="radio" name="type" value="${t.id}" ${i === 0 ? 'checked' : ''}><span>${esc(t.name)}</span></label>`).join('')}</div></fieldset>
          <fieldset><legend>Pot</legend><div class="opts">${POT_COLORS.map((c, i) => `<label class="pot-opt"><input type="radio" name="pot" value="${c.id}" ${i === 0 ? 'checked' : ''} aria-label="${c.name} pot"><span style="background:${c.id}"></span></label>`).join('')}</div></fieldset>
          <button class="btn">Plant it</button></form></details>
      <section class="card"><h3>Care log</h3>${log.length ? `<ul class="plain">${log.slice(0, 20).map((l) => `<li>${esc(nameOf(l.by))} ${VERB[l.action] || l.action} ${esc(l.plantName)} <span class="muted">· ${relTime(l.at)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing yet.</p>'}</section>
    </div>`;
    if (key) el.querySelector(key)?.focus();
  }

  async function reload() {
    plants = await ctx.backend.plants.list();
    log = await ctx.backend.plants.log(20);
    render();
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, id } = b.dataset;
    try {
      if (act === 'remove') {
        const p = plants.find((x) => x.id === id);
        if (!(await ctx.confirm(`Remove ${p?.label || 'this plant'} from the shelf?`, { ok: 'Remove' }))) return;
      }
      await ctx.backend.plants[act](id);
      if (act === 'water') ctx.toast('Glug glug. Watered.');
      if (act === 'sun') ctx.toast('Sunbathing.');
      if (act === 'sing') ctx.toast('La la la.');
      await reload();
    } catch (err) { ctx.toast(err.message); }
  });
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await ctx.backend.plants.add({ type: f.get('type'), potColor: f.get('pot') });
      ctx.toast('Planted.');
      await reload();
    } catch (err) { ctx.toast(err.message); }
  });

  reload();
  const unsub = ctx.backend.plants.onChange((d) => { plants = d.plants; log = d.log.slice(0, 20); render(); });
  timer = setInterval(render, 60000); // refresh meters and relative times
  return { update: render, unmount() { unsub?.(); clearInterval(timer); } };
}
