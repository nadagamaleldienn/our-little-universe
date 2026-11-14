// World map (design/WorldMap.dc.html): a scaled 1060x900 illustrated stage with pins, markers and
// envelopes, plus a normal flowing side panel ("In the world", notes, meet up).
import { LOCATIONS, ACTIVITIES, esc, relTime, fitStage } from '../util.js';
import { renderCharacter } from '../characters.js';

const MW = 1060;
const MH = 900;

const STARS = Array.from({ length: 30 }, (_, i) => `<div class="tw" style="left:${((i * 163) % 1030) + 12}px;top:${((i * 71) % 480) + 90}px;animation-delay:-${((i * 0.45) % 3).toFixed(2)}s"><i style="left:4px;top:0;width:4px;height:12px"></i><i style="left:0;top:4px;width:12px;height:4px"></i></div>`).join('');
const PATHS = '<svg width="1060" height="900" viewBox="0 0 1060 900" aria-hidden="true" class="m-paths"><path d="M200 600 L170 300"/><path d="M200 600 L460 470"/><path d="M460 470 L780 560"/><path d="M460 470 L700 200"/><path d="M460 470 L450 760"/><path d="M200 600 L450 760"/><path d="M170 300 L700 200"/></svg>';
const BANDS = '<div class="m-band" style="top:360px;background:#251B45"></div><div class="m-band" style="top:540px;background:#2B1F52"></div><div class="m-band" style="top:720px;background:#33266A"></div>';
const ISLANDS = LOCATIONS.map((l) => `<div class="m-body" style="left:${l.mx - 80}px;top:${l.my + 26}px"></div><div class="m-top" style="left:${l.mx - 110}px;top:${l.my}px"></div>`).join('');
const ENV = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="m-envsvg"><rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/></svg>';

export function mount(el, ctx) {
  const S = ctx.state;
  let letters = [];
  let sel = S.location;
  let unsub = null;
  let fit = null;

  async function load() {
    try { letters = await ctx.backend.letters.list(); } catch { letters = []; }
    render();
  }
  const nameOf = (who) => (who === S.me.who ? S.me.name : S.otherName);
  const locOf = (id) => LOCATIONS.find((l) => l.id === id);
  const ava = (who, scale, w, h, l, t) => `<span class="m-ava-in" style="left:${l}px;top:${t}px;width:${w}px;height:${h}px">${renderCharacter({ who, pose: 'stand', item: 'none', scale })}</span>`;

  function markers(l) {
    const st = S.otherStatus;
    const meHere = S.location === l.id;
    const otherHere = (st.kind === 'live' || st.kind === 'last') && st.loc === l.id;
    const live = st.kind === 'live';
    let out = '';
    if (meHere && otherHere && live) {
      out += `<div class="m-mk m-live together" style="left:${l.mx - 72}px;top:${l.my - 122}px;width:124px;height:84px" role="img" aria-label="${esc(S.me.name)} and ${esc(S.otherName)} together at ${esc(l.name)}">${ava('together', 0.35, 98, 77, 6, 0)}</div>
        <div class="m-tag on" style="left:${l.mx + 62}px;top:${l.my - 100}px">Together · ${esc(l.name)}</div>`;
      return out;
    }
    const both = meHere && otherHere;
    let x = both ? l.mx - 80 : l.mx - 34;
    const gy = l.my - 104;
    const labels = [];
    if (meHere) {
      out += `<div class="m-mk m-live" style="left:${x}px;top:${gy}px" role="img" aria-label="${esc(S.me.name)}, you are here">${ava(S.me.who, 0.35, 56, 77, 10, 6)}</div>`;
      labels.push(`<div class="m-tag on">Here now · you</div>`);
      x += 84;
    }
    if (otherHere) {
      out += `<div class="m-mk ${live ? 'm-live' : 'm-ghost'}" style="left:${x}px;top:${gy}px" role="img" aria-label="${esc(S.otherName)}, ${live ? 'here now' : 'last here ' + relTime(st.at)}">${ava(S.otherWho, 0.35, 56, 77, 10, 6)}</div>`;
      labels.push(live ? `<div class="m-tag on">${esc(S.otherName)} · here now</div>` : `<div class="m-tag"><span class="m-hollow"></span>${esc(S.otherName)} · last here ${relTime(st.at)}</div>`);
      x += 84;
    }
    if (labels.length) out += `<div class="m-tags" style="left:${x + 2}px;top:${gy + 16}px">${labels.join('')}</div>`;
    return out;
  }

  function stage() {
    const withLetters = LOCATIONS.filter((l) => letters.some((x) => x.location === l.id));
    const here = locOf(sel);
    const note = letters.find((x) => x.location === sel && (x.from === S.me.who || (x.to === S.me.who && x.readAt)));
    const noteHtml = note ? `<div class="m-note" style="left:${Math.min(here.mx + 48, MW - 272)}px;top:${here.my + 36}px"><div class="lab">Note from ${esc(nameOf(note.from)).toUpperCase()}</div><div class="m-note-t">${esc(note.text.length > 80 ? note.text.slice(0, 78) + '…' : note.text)}</div></div>` : '';
    return `${BANDS}${STARS}<div class="m-title">The Little World</div>${ISLANDS}${PATHS}
      ${LOCATIONS.map((l) => `<button class="m-pin${sel === l.id ? ' sel' : ''}${S.location === l.id ? ' here' : ''}" data-loc="${l.id}" aria-pressed="${sel === l.id}" style="left:${l.mx - (l.id === 'hill' ? 70 : 80)}px;top:${l.my + 118}px"><span class="m-sq"></span>${esc(l.name)}</button>`).join('')}
      ${withLetters.map((l) => `<div class="m-env${letters.some((x) => x.location === l.id && x.to === S.me.who && !x.readAt) ? ' waiting' : ''}" style="left:${l.mx + 60}px;top:${l.my - 10}px" role="img" aria-label="A letter is left at ${esc(l.name)}">${ENV}</div>`).join('')}
      ${noteHtml}${LOCATIONS.map(markers).join('')}`;
  }

  function personCard(who) {
    const isMe = who === S.me.who;
    const st = S.otherStatus;
    const together = S.otherStatus.kind === 'live' && st.loc === S.location;
    let status;
    let live = false;
    if (isMe) {
      const v = S.me.settings.visibility;
      if (v === 'offline') status = 'Appearing offline';
      else if (v === 'lastSeenOnly') status = `Last stop only · ${locOf(S.location)?.name || 'somewhere cozy'}`;
      else { live = true; status = `${together ? 'Together' : 'Here now'} · ${locOf(S.location)?.name || 'somewhere cozy'}`; }
    } else if (st.kind === 'live') { live = true; status = `${together ? 'Together' : 'Here now'} · ${locOf(st.loc)?.name || 'somewhere cozy'}`; }
    else if (st.kind === 'last') status = `Last here ${relTime(st.at)}${st.loc ? ' · ' + (locOf(st.loc)?.name || '') : ''}`;
    else if (st.kind === 'hidden') status = 'Somewhere in the world';
    else status = 'Has not visited yet';
    return `<div class="m-card person"><div class="m-pava${live ? ' live' : ''}"><span style="position:absolute;left:4px;top:-4px;width:35px;height:48px">${renderCharacter({ who, pose: 'stand', item: 'none', scale: 0.22 })}</span></div>
      <div class="m-pinfo"><div class="m-pname">${esc(nameOf(who))}${isMe ? ' <span class="lab">you</span>' : ''}</div><div class="m-pstatus${live ? ' on' : ''}"><span class="${live ? 'm-livedot' : 'm-hollow'}"></span>${esc(status)}</div></div></div>`;
  }

  function side() {
    const loc = locOf(sel);
    const st = S.otherStatus;
    const here = letters.filter((l) => l.location === sel);
    const inbox = letters.filter((l) => l.to === S.me.who);
    const otherLine = (st.kind === 'live' || st.kind === 'last') && st.loc === sel
      ? `<p>${esc(S.otherName)} ${st.kind === 'live' ? `is here now${ACTIVITIES[st.act] ? ' · ' + ACTIVITIES[st.act].label : ''}` : `was last here ${relTime(st.at)}`}.</p>` : '';
    return `<h2 class="m-h">In the world</h2>
      <div class="m-people">${personCard('her')}${personCard('him')}</div>
      <section class="m-card place" aria-live="polite"><div class="m-ph">${esc(loc.name)}</div><p class="m-blurb">${esc(loc.blurb)}</p>${otherLine}
        <button class="btn" data-travel="${loc.id}" ${S.location === sel ? 'disabled' : ''}>${S.location === sel ? "You're here" : 'Travel here'}</button>
        ${here.length ? `<ul class="plain m-here">${here.map((l) => `<li><span>${l.from === S.me.who ? 'Left by you' : l.to === S.me.who ? `Waiting for you from ${esc(S.otherName)}` : ''}</span> <button class="link" data-open="${l.id}">${l.from === S.me.who || l.readAt ? 'Read it again' : 'Open it'}</button></li>`).join('')}</ul>` : ''}</section>
      <div><h3 class="m-h3">Notes left for you</h3>
        <div class="m-notes">${inbox.length ? inbox.slice(0, 5).map((l) => `<button class="m-nt${l.readAt ? ' opened' : ''}" data-open="${l.id}"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/></svg><span><span class="lab">${esc(locOf(l.location)?.name || 'Somewhere')} · ${l.readAt ? 'Opened' : 'Unopened'}</span><span class="m-nt-t">${l.readAt ? esc(l.text.length > 60 ? l.text.slice(0, 58) + '…' : l.text) : 'From ' + esc(S.otherName)}</span></span></button>`).join('') : '<p class="muted">No notes yet.</p>'}</div></div>
      <div class="m-meet"><div class="m-h3">Meet up</div><p>When you are both at the same place, you can wave, sit together, or share a song.</p></div>`;
  }

  function render() {
    const f = document.activeElement?.dataset?.loc;
    if (!fit) {
      el.innerHTML = `<div class="map-view"><div class="map-col"><div class="stage-box map-box"><div class="stage map-stage" role="group" aria-label="Map of the pretend world"></div></div>
        <div class="m-locs" role="group" aria-label="Pick a place"></div></div><aside class="map-side"></aside></div>`;
      fit = fitStage(el.querySelector('.map-box'), el.querySelector('.map-stage'), MW, MH);
    }
    el.querySelector('.map-stage').innerHTML = stage();
    el.querySelector('.m-locs').innerHTML = LOCATIONS.map((l) => `<button class="pill${sel === l.id ? ' on' : ''}" data-loc="${l.id}" aria-pressed="${sel === l.id}">${esc(l.name)}</button>`).join('');
    el.querySelector('.map-side').innerHTML = side();
    if (f) el.querySelector(`[data-loc="${f}"]`)?.focus();
  }

  el.addEventListener('click', (e) => {
    const l = e.target.closest('[data-loc]');
    if (l) { sel = l.dataset.loc; render(); return; }
    const t = e.target.closest('[data-travel]');
    if (t) { ctx.travel(t.dataset.travel); return; }
    const o = e.target.closest('[data-open]');
    if (o) ctx.go('letters', { open: o.dataset.open });
  });

  load();
  unsub = ctx.backend.letters.onNew(() => load());
  return { update: render, unmount() { unsub?.(); fit?.destroy(); } };
}
