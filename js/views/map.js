// World map: a fictional place, never real locations. Shows both characters (live or faded
// last-seen) and envelope markers where letters were left.
import { LOCATIONS, ACTIVITIES, esc, locName, relTime } from '../util.js';
import { renderCharacter } from '../characters.js';

const BG = `<svg class="map-bg" viewBox="0 0 100 62.5" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 40q18-12 34-4t30-6 36 6v26.5H0z" fill="#3D2C74"/><path d="M0 50q24-10 46-2t54-6v20.5H0z" fill="#2B1F52"/>
  <ellipse cx="38" cy="49" rx="13" ry="6" fill="#7C63C9" opacity=".55"/><ellipse cx="36" cy="48" rx="7" ry="2.6" fill="#B9A6EC" opacity=".4"/>
  <path d="M17 41C24 28 30 22 36 18S52 14 62 10M17 41C34 38 52 40 68 36M68 36C76 44 82 50 86 50M36 18C50 22 60 30 68 36M17 41C26 52 32 50 38 49" stroke="#FFE79A" stroke-width=".5" stroke-dasharray="1.2 1.4" fill="none" opacity=".7"/>
  <g fill="#FFE79A" opacity=".8"><circle cx="8" cy="8" r=".5"/><circle cx="22" cy="5" r=".4"/><circle cx="48" cy="7" r=".5"/><circle cx="78" cy="9" r=".4"/><circle cx="92" cy="14" r=".5"/><circle cx="14" cy="18" r=".35"/></g>
  <g fill="#5B43A8"><path d="M58 17l4-8 4 8z"/><path d="M63 17l3-6 3 6z"/></g></svg>`;

export function mount(el, ctx) {
  const S = ctx.state;
  let letters = [];
  let sel = S.location;
  let unsub = null;

  async function load() {
    try { letters = await ctx.backend.letters.list(); } catch { letters = []; }
    render();
  }

  const mini = (who, label, cls) => `<span class="mk ${cls}" title="${esc(label)}">${renderCharacter({ who, pose: 'stand' })}</span>`;
  function markers(id) {
    const out = [];
    const st = S.otherStatus;
    const meHere = S.location === id;
    const otherHere = (st.kind === 'live' || st.kind === 'last') && st.loc === id;
    if (meHere && otherHere && st.kind === 'live') out.push(mini('together', `${S.me.name} and ${S.otherName}`, 'both'));
    else {
      if (meHere) out.push(mini(S.me.who, 'You', 'me'));
      if (otherHere) out.push(mini(S.otherWho, st.kind === 'live' ? `${S.otherName}, here now` : `${S.otherName}, last here ${relTime(st.at)}`, st.kind === 'live' ? 'live' : 'ghost'));
    }
    const here = letters.filter((l) => l.location === id);
    if (here.length) {
      const waiting = here.some((l) => l.to === S.me.who && !l.readAt);
      out.push(`<span class="mk env ${waiting ? 'waiting' : ''}" title="${here.length} letter${here.length > 1 ? 's' : ''} left here" aria-hidden="true">✉</span>`);
    }
    return out.join('');
  }

  function info() {
    const loc = LOCATIONS.find((l) => l.id === sel);
    const st = S.otherStatus;
    const here = letters.filter((l) => l.location === sel);
    const otherLine = (st.kind === 'live' || st.kind === 'last') && st.loc === sel
      ? `<p>${esc(S.otherName)} ${st.kind === 'live' ? `is here now${ACTIVITIES[st.act] ? ' · ' + ACTIVITIES[st.act].label : ''}` : `was last here ${relTime(st.at)}`}.</p>` : '';
    return `<h2>${esc(loc.name)}</h2><p class="muted">${esc(loc.blurb)}</p>${otherLine}
      <button class="btn" data-travel="${loc.id}" ${S.location === sel ? 'disabled' : ''}>${S.location === sel ? "You're here" : 'Travel here'}</button>
      ${here.length ? `<h3>Letters left here</h3><ul class="plain">${here.map((l) => `<li><span class="muted">${l.from === S.me.who ? 'Left by you' : l.to === S.me.who ? `Waiting for you from ${esc(S.otherName)}` : ''}</span> <button class="link" data-open="${l.id}">${l.from === S.me.who || l.readAt ? 'Read it again' : 'Open it'}</button></li>`).join('')}</ul>` : ''}`;
  }

  function render() {
    el.innerHTML = `<div class="map-view">
      <div class="map" role="group" aria-label="Map of the pretend world">${BG}
        ${LOCATIONS.map((l) => `<button class="loc ${sel === l.id ? 'sel' : ''}" style="left:${l.x}%;top:${l.y}%" data-loc="${l.id}" aria-label="${esc(l.name)}" aria-pressed="${sel === l.id}"><span class="pin"></span><span class="loc-name">${esc(l.name)}</span><span class="mks">${markers(l.id)}</span></button>`).join('')}
      </div>
      <aside class="card map-info" aria-live="polite">${info()}</aside>
    </div>`;
  }

  el.addEventListener('click', (e) => {
    const l = e.target.closest('[data-loc]');
    if (l) { sel = l.dataset.loc; render(); el.querySelector(`[data-loc="${sel}"]`)?.focus(); return; }
    const t = e.target.closest('[data-travel]');
    if (t) { ctx.travel(t.dataset.travel); return; }
    const o = e.target.closest('[data-open]');
    if (o) ctx.go('letters', { open: o.dataset.open });
  });

  load();
  unsub = ctx.backend.letters.onNew(() => load());
  return { update: render, unmount() { unsub?.(); } };
}
