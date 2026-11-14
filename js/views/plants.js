// Plant spot (design/PlantSpot.dc.html). Growth stage comes from days since planting; the water meter
// decays with real hours. Plants droop when thirsty but never die. The plant drawings are the board's
// stacked-shape art (120x100 box per plant), mapped from the app's plant types.
import { PLANT_TYPES, POT_COLORS, esc, relTime } from '../util.js';

const STAGE_NAMES = ['Sprout', 'Growing', 'Blooming'];
const boardStage = (p) => {
  const d = (Date.now() - p.plantedAt) / 86400000;
  return d < 1 ? 0 : d < 7 ? 1 : 2; // sprout, growing, blooming (the app grows over real days)
};
const waterOf = (p) => Math.max(0.12, 1 - (Date.now() - p.wateredAt) / 3600000 / 48);
const BOARD_TYPE = { lavender: 'lavender', sunflower: 'sunflower', 'moon-cactus': 'cactus', fern: 'fern', 'violet-orchid': 'orchid', 'lemon-tree': 'lemon' };

const G1 = 'radial-gradient(circle at 35% 30%,#7FCB9A,#4E9A74)';
const G2 = 'linear-gradient(135deg,#5FA877,#3C7F5E)';
const BUT = 'radial-gradient(circle at 35% 30%,#FFE79A,#F6C945)';
const E = (l, t, w, h, css) => `<div style="position:absolute;left:${l}px;top:${t}px;width:${w}px;height:${h}px;${css}"></div>`;
const leaf = (cx, by, w, h, rot, g) => E(cx - w / 2, by - h, w, h, `border-radius:50% 50% 50% 50%/70% 70% 30% 30%;background:${g || G2};transform:rotate(${rot}deg);transform-origin:50% 100%;box-shadow:inset -3px -3px 6px rgba(20,60,40,.25)`);
const stem = (x, h, w) => E(x - (w || 5) / 2, 100 - h, w || 5, h, 'border-radius:3px;background:linear-gradient(90deg,#5FA877,#3C7F5E)');
const ball = (cx, cy, r, bg, extra) => E(cx - r, cy - r, 2 * r, 2 * r, `border-radius:50%;background:${bg};${extra || ''}`);

// type: lavender|sunflower|cactus|fern|orchid|lemon; stage: 0 sprout, 1 growing, 2 blooming
function art(type, stage) {
  let a = '';
  if (stage === 0) return stem(60, 24) + leaf(60, 80, 16, 24, -50, G1) + leaf(60, 80, 16, 24, 50, G1);
  if (type === 'lavender') {
    const xs = [50, 57, 63, 70];
    const hs = stage === 2 ? [66, 78, 78, 66] : [52, 60, 60, 52];
    a = leaf(60, 100, 12, 36, -35) + leaf(60, 100, 12, 36, 35) + leaf(60, 100, 12, 44, -12) + leaf(60, 100, 12, 44, 12);
    xs.forEach((x, i) => {
      a += stem(x, hs[i], 3);
      if (stage === 2) a += E(x - 5, 100 - hs[i] - 22, 10, 26, 'border-radius:50%;background:linear-gradient(180deg,#DCD2F7,#8E7AD6)') + ball(x, 100 - hs[i] - 4, 2.5, '#FFE79A');
    });
  } else if (type === 'sunflower') {
    const h = stage === 2 ? 70 : 56;
    a = stem(60, h, 6) + leaf(60, 100 - h * 0.45, 30, 24, -75) + leaf(60, 100 - h * 0.45, 30, 24, 75);
    if (stage === 2) {
      for (let i = 0; i < 10; i++) a += E(54, 100 - h - 27, 12, 22, `border-radius:50%;background:${BUT};transform:rotate(${i * 36}deg);transform-origin:50% 27px`);
      a += ball(60, 100 - h, 10, 'radial-gradient(circle,#8A5A2B,#5A3A22)');
    } else a += ball(60, 100 - h, 10, G1);
  } else if (type === 'cactus') {
    const big = stage === 2;
    a = E(big ? 38 : 44, big ? 46 : 60, big ? 44 : 32, big ? 54 : 40, 'border-radius:22px 22px 12px 12px;background:linear-gradient(90deg,#7FCB9A,#4E9A74 70%)')
      + ball(60, big ? 46 : 60, big ? 14 : 11, 'radial-gradient(circle at 35% 30%,#FFE79A,#E9A23B)', 'box-shadow:0 0 10px rgba(255,231,154,.6)');
    if (big) a += ball(60, 30, 6, '#FFFFFF', 'box-shadow:0 0 8px rgba(255,231,154,.9)');
  } else if (type === 'fern') {
    const h = stage === 2 ? 66 : 52;
    [-72, -48, -24, 0, 24, 48, 72].forEach((r, i) => { a += leaf(60, 100, 18, h - Math.abs(r) / 6, r, i % 2 ? G2 : G1); });
    if (stage === 2) a += ball(40, 52, 3, '#FFE79A') + ball(80, 48, 3, '#FFE79A') + ball(60, 28, 3, '#FFE79A');
  } else if (type === 'orchid') {
    a = leaf(60, 100, 26, 36, -60) + leaf(60, 100, 26, 36, 60) + stem(60, 64, 4);
    const fl = stage === 2 ? [[46, 40], [62, 30], [74, 48]] : [[60, 34]];
    fl.forEach((f) => { a += ball(f[0], f[1], stage === 2 ? 10 : 5, 'radial-gradient(circle at 35% 30%,#DCD2F7,#8E7AD6)', 'box-shadow:0 0 8px rgba(142,122,214,.7)'); if (stage === 2) a += ball(f[0], f[1], 3, '#FFE79A'); });
  } else {
    a = E(56, 56, 8, 44, 'border-radius:4px;background:linear-gradient(90deg,#8A5A2B,#5A3A22)');
    if (stage === 2) a += ball(44, 46, 20, G1) + ball(76, 46, 20, G1) + ball(60, 30, 22, G1) + ball(46, 54, 6, BUT) + ball(78, 52, 6, BUT) + ball(62, 36, 6, BUT);
    else a += ball(60, 44, 18, G1);
  }
  return a;
}

const VERB = { plant: 'planted the', water: 'watered the', sun: 'gave some sun to the', sing: 'sang to the', remove: 'said goodbye to the' };
const SUN_WINDOW_MS = 6 * 3600 * 1000;

export function mount(el, ctx) {
  const S = ctx.state;
  let plants = [];
  let log = [];
  let timer = 0;
  let adding = false;
  let add = { seed: PLANT_TYPES[0].id, pot: POT_COLORS[1].id, name: '' };
  let removing = null;
  const flash = { water: null, sing: null };
  const nameOf = (w) => (w === S.me.who ? S.me.name : S.otherName);

  function cardHtml(p) {
    const stage = boardStage(p);
    const w = waterOf(p);
    const pct = Math.round(w * 100);
    const thirsty = w < 0.4;
    const inSun = p.sunAt && Date.now() - p.sunAt < SUN_WINDOW_MS;
    const bt = BOARD_TYPE[p.type] || 'fern';
    const low = esc(p.label);
    return `<article class="pl-card${inSun ? ' sun' : ''}">
      <div class="pl-top"><div class="pl-tag"><div class="pl-name">${esc(p.label)}</div><div class="lab pl-by">planted by ${esc(nameOf(p.by))}</div></div>${inSun ? '<span class="lab pl-sunbadge">In the sun</span>' : ''}</div>
      <div class="pl-scene" role="img" aria-label="${low}, ${STAGE_NAMES[stage].toLowerCase()}${thirsty ? ', a little thirsty' : ''}">
        <div class="pl-plant${thirsty ? ' thirsty' : ''}${flash.water === p.id ? ' perk' : ''}">${art(bt, stage)}</div>
        <div class="pl-rim" style="background-color:${p.potColor}"></div><div class="pl-pot" style="background-color:${p.potColor}"></div><div class="pl-shelf"></div>
        ${thirsty ? '<div class="lab pl-zz" aria-hidden="true">z z</div>' : ''}
        ${flash.water === p.id ? '<div aria-hidden="true"><i class="p-drop" style="left:92px;top:20px;background:#8C93D9"></i><i class="p-drop" style="left:108px;top:14px;background:#B9A6EC;animation-delay:.35s"></i><i class="p-drop" style="left:124px;top:22px;background:#8C93D9;animation-delay:.7s"></i></div>' : ''}
        ${flash.sing === p.id ? '<div class="pl-notes" aria-hidden="true"><span class="p-note" style="left:150px;top:60px">♪</span><span class="p-note" style="left:172px;top:70px;animation-delay:.6s">♫</span><span class="p-note" style="left:36px;top:56px;animation-delay:1.2s">♪</span></div>' : ''}
      </div>
      <div class="pl-meter"><span class="lab pl-stage">${STAGE_NAMES[stage]}</span><div class="pl-bar" role="meter" aria-label="Water" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div style="width:${pct}%" class="${thirsty ? 'low' : ''}"></div></div><span class="lab pl-pct">${pct}%</span></div>
      <div class="pl-note">${thirsty ? 'A little thirsty, still sleepy' : `Watered ${relTime(p.wateredAt)}`}${p.sunAt ? ` · sun ${relTime(p.sunAt)}` : ''}</div>
      <div class="pl-acts">
        <button class="act" data-act="water" data-id="${p.id}" aria-label="Water ${low}"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="stroke:#8C93D9"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/></svg>Water</button>
        <button class="act" data-act="sun" data-id="${p.id}" aria-label="Give ${low} some sun"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="stroke:#F6C945"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>Sun</button>
        <button class="act" data-act="sing" data-id="${p.id}" aria-label="Sing to ${low}"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="stroke:#DCD2F7"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>Sing</button>
        <button class="act" data-act="remove" data-id="${p.id}" aria-label="Remove ${low}"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="stroke:#B9A6EC"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>Remove</button>
      </div></article>`;
  }

  function addHtml() {
    return `<div class="pl-overlay" data-close="1"><div class="pl-dialog" role="dialog" aria-modal="true" aria-label="Add a plant">
      <div class="pl-dh">Plant something new</div>
      <div><div class="lab pl-fl">Seed</div><div class="pl-seeds">${PLANT_TYPES.map((t) => `<button class="chip" data-seed="${t.id}" aria-pressed="${add.seed === t.id}"><span class="pl-mini"><span class="pl-mini-in">${art(BOARD_TYPE[t.id], 1)}</span></span>${esc(t.name)}</button>`).join('')}</div></div>
      <div><div class="lab pl-fl">Pot colour</div><div class="pl-pots">${POT_COLORS.map((c) => `<button class="pl-potbtn" data-pot="${c.id}" aria-label="${c.name} pot" aria-pressed="${add.pot === c.id}" style="background:${c.id}"></button>`).join('')}</div></div>
      <div class="pl-row2"><div><label for="pname" class="lab pl-fl">Name tag</label><input id="pname" class="fld" type="text" maxlength="24" value="${esc(add.name)}" placeholder="Optional"></div>
        <div><div class="lab pl-fl">Planted by</div><div class="chip static">${esc(S.me.name)}</div></div></div>
      <div class="pl-dn">${plants.length >= 12 ? 'That is a lot of plants. Maybe say goodbye to one first.' : 'It starts as a sprout and grows over real days.'}</div>
      <div class="pl-dbtns"><button class="btn ghost" data-close-btn="1">Cancel</button><button class="btn" data-plant="1">Plant it</button></div></div></div>`;
  }
  function confirmHtml() {
    const p = plants.find((x) => x.id === removing);
    return p ? `<div class="pl-overlay"><div class="pl-dialog small" role="alertdialog" aria-label="Remove plant">
      <div class="pl-dh">Move ${esc(p.label)} away?</div><div class="pl-dt">It will be removed from the spot for both of you. Plants never die on their own, so only do this if you are sure.</div>
      <div class="pl-dbtns"><button class="btn ghost" data-keep="1">Keep it here</button><button class="btn" data-remove="${p.id}">Remove it</button></div></div></div>` : '';
  }

  function render() {
    const fid = document.activeElement?.id || (document.activeElement?.dataset?.act ? `${document.activeElement.dataset.act}|${document.activeElement.dataset.id}` : '');
    const typing = document.activeElement?.id === 'pname';
    const caret = typing ? document.activeElement.selectionStart : 0;
    el.innerHTML = `<div class="plants-view"><div class="pl-main">
        <div class="pl-head"><div><h2>The plant spot</h2><div class="lab pl-count">${plants.length} on the shelves</div></div><button class="btn" id="openAdd">Add a plant</button></div>
        <div class="pl-grid">${plants.map(cardHtml).join('') || '<p class="muted">The shelf is empty. Add a plant to begin.</p>'}</div></div>
      <aside class="pl-side"><h3>Care log</h3><div class="pl-log">${log.length ? log.slice(0, 20).map((l) => `<div class="pl-li"><div>${esc(nameOf(l.by))} ${VERB[l.action] || l.action} ${esc(l.plantName.toLowerCase())}</div><div class="lab">${relTime(l.at)}</div></div>`).join('') : '<p class="muted">Nothing yet.</p>'}</div>
        <p class="pl-foot">Plants grow over real days, wilt slowly and never die. Either of you can care for any plant, and each care action can send a quiet notification if allowed.</p></aside></div>
      ${adding ? addHtml() : ''}${removing ? confirmHtml() : ''}`;
    if (fid) {
      const t = fid.includes('|') ? el.querySelector(`[data-act="${fid.split('|')[0]}"][data-id="${fid.split('|')[1]}"]`) : el.querySelector('#' + fid);
      t?.focus();
      if (typing && t) try { t.setSelectionRange(caret, caret); } catch { /* ignore */ }
    } else if (adding) el.querySelector('.pl-dialog button')?.focus();
  }

  async function reload() {
    plants = await ctx.backend.plants.list();
    log = await ctx.backend.plants.log(20);
    render();
  }
  const flashFor = (key, id, ms) => { flash[key] = id; render(); setTimeout(() => { if (flash[key] === id) { flash[key] = null; render(); } }, ms); };

  el.addEventListener('click', async (e) => {
    try {
      if (e.target.closest('#openAdd')) { adding = true; return render(); }
      if (e.target.closest('[data-close-btn]') || e.target.matches('.pl-overlay[data-close]')) { adding = false; return render(); }
      const sd = e.target.closest('[data-seed]');
      if (sd) { add.seed = sd.dataset.seed; return render(); }
      const pt = e.target.closest('[data-pot]');
      if (pt) { add.pot = pt.dataset.pot; return render(); }
      if (e.target.closest('[data-plant]')) {
        await ctx.backend.plants.add({ type: add.seed, potColor: add.pot, label: add.name });
        add.name = '';
        adding = false;
        ctx.toast('Planted.');
        return reload();
      }
      if (e.target.closest('[data-keep]')) { removing = null; return render(); }
      const rm = e.target.closest('[data-remove]');
      if (rm) { await ctx.backend.plants.remove(rm.dataset.remove); removing = null; return reload(); }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const { act, id } = b.dataset;
      if (act === 'remove') { removing = id; return render(); }
      await ctx.backend.plants[act](id);
      if (act === 'water') { ctx.toast('Glug glug. Watered.'); flashFor('water', id, 2200); }
      if (act === 'sun') ctx.toast('Sunbathing.');
      if (act === 'sing') { ctx.toast('La la la.'); flashFor('sing', id, 2600); }
      await reload();
    } catch (err) { ctx.toast(err.message); }
  });
  el.addEventListener('input', (e) => { if (e.target.id === 'pname') add.name = e.target.value; });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (adding || removing)) { adding = false; removing = null; render(); } });

  reload();
  const unsub = ctx.backend.plants.onChange((d) => { plants = d.plants; log = d.log.slice(0, 20); render(); });
  timer = setInterval(render, 60000); // refresh meters and relative times
  return { update: render, unmount() { unsub?.(); clearInterval(timer); } };
}
