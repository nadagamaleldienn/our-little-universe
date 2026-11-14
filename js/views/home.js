// Home view: the Cozy Corner (design/Main.dc.html). The scene is a scaled 1440x900 stage; the HUD
// (bell, weather selector, zone buttons, presence card, mini player) sits on the stage at the
// board's coordinates. On a phone-width screen the stage shrinks to a picture and the HUD moves
// below it as a normal flowing layout.
import { createScene, SPOTS } from '../scene.js';
import { WEATHERS } from '../weather.js';
import { ACTIVITIES, locName, esc, relTime } from '../util.js';
import { renderCharacter } from '../characters.js';

// [id, label, activity it sets]. "Snuggle spot" is the window seat: together appears when you both sit there.
const ZONES = [
  ['window', 'Window', 'window'],
  ['snuggle', 'Snuggle spot', 'window'],
  ['desk', 'Desk', 'desk'],
  ['reading', 'Reading nook', 'reading'],
  ['music', 'Library & records', 'music'],
  ['gaming', 'Game corner', 'gaming'],
  ['workbench', 'Workbench', 'workbench'],
  ['plants', 'Plant spot', 'plants']
];

const COPY = {
  desk: ['Working at the desk', 'Laptop open, coffee getting cold, the duck is listening'],
  reading: ['Curled up in the reading nook', 'Blanket on, lost somewhere in chapter twelve'],
  gaming: ['Playing in the game corner', 'Just one more level'],
  music: ['Listening to the rainy playlist', 'Headphones on, watching the weather'],
  window: ['Sitting by the window', 'Doing absolutely nothing, happily'],
  plants: ['Watering the plants', 'Checking the soil sensor, topping up the thirsty ones'],
  workbench: ['Designing a board at the workbench', 'Iron warming up, a wisp of smoke, one more trace to route'],
  idle: ['Wandering around the room', 'Nothing in particular, and that is fine']
};
const VIS = { live: 'Live', lastSeenOnly: 'Last stop only', offline: 'Offline' };

const avatar = (who, extra = '') => `<span class="pc-ava ${who}${extra}" aria-hidden="true"><span class="pc-ava-in">${renderCharacter({ who, pose: 'stand', item: 'none', scale: 0.5 })}</span></span>`;

export function mount(el, ctx) {
  const S = ctx.state;
  const music = ctx.music;
  let bellOpen = false;
  let menuOpen = false;
  let together = false;

  el.innerHTML = `<div class="home">
    <div class="scene-host"></div>
    <div class="home-flow"></div>
  </div>`;
  const home = el.querySelector('.home');
  const sceneHost = el.querySelector('.scene-host');
  const flow = el.querySelector('.home-flow');
  const scene = createScene(sceneHost);

  const hud = document.createElement('div');
  hud.className = 'hud-layer';
  hud.innerHTML = `
    <button class="h-bell" id="bellBtn" aria-label="Notifications" aria-expanded="false" aria-controls="bellList">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class="h-ico"><path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/></svg>
      <span class="h-badge" hidden></span>
    </button>
    <div class="h-bell-list" id="bellList" role="list" aria-label="Notifications" hidden></div>
    <div class="h-wx" role="group" aria-label="Weather">${Object.entries(WEATHERS).map(([id, w]) => `<button data-weather="${id}" aria-pressed="false">${w.label}</button>`).join('')}</div>
    <button class="h-chip" id="sceneChip" type="button" hidden></button>
    ${ZONES.map(([id, label]) => `<button class="zone" data-zone="${id}" aria-pressed="false" data-id="${id}">${esc(label)}</button>`).join('')}
    <div class="zone-chips" role="group" aria-label="Pick a spot">${ZONES.filter(([id]) => id !== 'snuggle').map(([id, label]) => `<button class="pill" data-zone="${id}" aria-pressed="false">${esc(label)}</button>`).join('')}</div>
    <div class="h-me">
      <button class="h-wave" id="wave" hidden aria-label="Wave hello">Wave <span aria-hidden="true">👋</span></button>
      <div class="h-vis"><button class="h-visbtn" id="visBtn" aria-haspopup="menu" aria-expanded="false"><span class="dot"></span><span class="h-vis-t"></span></button><div class="h-menu" role="menu" aria-label="Your status" hidden></div></div>
      <button class="h-gear" id="gearBtn" aria-label="Settings and privacy"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class="h-ico"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/></svg></button>
    </div>
    <div class="pc" id="presence"></div>
    <div class="mini" id="mini">
      <button class="mini-play" id="miniPlay" aria-label="Play"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
      <button class="mini-text" id="miniText" aria-label="Open the music player"><span class="mini-title"></span><span class="mini-sub"></span></button>
      <button class="mini-rain" id="miniRain" aria-pressed="false"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="h-ico"><path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 17.6 9 3.5 3.5 0 0 1 17 16H7z"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/></svg><span class="mini-rain-t"></span></button>
    </div>`;
  const q = (s) => hud.querySelector(s);
  let chipLoc = null;

  // ---- layout: HUD lives on the stage when there is room, below it on a phone ----
  let compact = null;
  function layout() {
    const c = home.clientWidth < 760;
    if (c === compact) return;
    compact = c;
    home.classList.toggle('compact', c);
    (c ? flow : scene.stage).appendChild(hud);
    scene.fit.refresh();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
  ro?.observe(home);
  layout();

  // ---- events ----
  const zoneSpot = (id) => ZONES.find((z) => z[0] === id)?.[2];
  hud.addEventListener('click', (e) => {
    const w = e.target.closest('.h-wx [data-weather]');
    if (w) return ctx.setWeather(w.dataset.weather);
    const z = e.target.closest('[data-zone]');
    if (z) {
      const act = zoneSpot(z.dataset.zone);
      if (!act) return;
      if (act === 'plants') { if (S.activity !== 'plants' || S.location !== 'cozy') ctx.setActivity('plants'); ctx.go('plants'); return; }
      return ctx.setActivity(act);
    }
    if (e.target.closest('#sceneChip')) return chipLoc && ctx.travel(chipLoc);
    if (e.target.closest('#wave')) return ctx.wave();
    if (e.target.closest('#bellBtn')) { bellOpen = !bellOpen; menuOpen = false; return renderBell(); }
    const n = e.target.closest('[data-notif]');
    if (n) { bellOpen = false; return ctx.openNotif(n.dataset.notif); }
    if (e.target.closest('#markAll')) return ctx.markAllRead();
    if (e.target.closest('#allNotifs')) { bellOpen = false; renderBell(); return ctx.openBellPanel(); }
    if (e.target.closest('#visBtn')) { menuOpen = !menuOpen; bellOpen = false; renderBell(); return renderMenu(); }
    const v = e.target.closest('[data-vis]');
    if (v) { menuOpen = false; renderMenu(); ctx.saveSettings({ settings: { visibility: v.dataset.vis } }); return; }
    if (e.target.closest('[data-hide]')) { menuOpen = false; renderMenu(); ctx.saveSettings({ settings: { hideActivity: !S.me.settings.hideActivity } }); return; }
    if (e.target.closest('#gearBtn')) return ctx.openSettings();
    if (e.target.closest('#pcNote')) return ctx.go('letters', { compose: true });
    if (e.target.closest('#miniPlay')) return music.toggle();
    if (e.target.closest('#miniRain')) return music.toggleRain();
    if (e.target.closest('#miniText')) return ctx.toggleSound();
  });
  const onDoc = (e) => {
    if (!e.composedPath().some((n) => n.matches?.('.h-bell, .h-bell-list, .h-vis'))) {
      if (bellOpen || menuOpen) { bellOpen = false; menuOpen = false; renderBell(); renderMenu(); }
    }
  };
  const onKey = (e) => { if (e.key === 'Escape' && (bellOpen || menuOpen)) { bellOpen = false; menuOpen = false; renderBell(); renderMenu(); q('#bellBtn').focus(); } };
  document.addEventListener('click', onDoc);
  document.addEventListener('keydown', onKey);

  // ---- renderers ----
  function renderBell() {
    const unread = S.notifs.filter((n) => !n.read).length;
    const badge = q('.h-badge');
    badge.hidden = !unread;
    badge.textContent = unread;
    const btn = q('#bellBtn');
    btn.setAttribute('aria-expanded', String(bellOpen));
    btn.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    const list = q('#bellList');
    list.hidden = !bellOpen;
    if (!bellOpen) return;
    const items = S.notifs.slice(0, 5);
    list.innerHTML = (items.length
      ? items.map((n, i) => `<button role="listitem" class="h-notif${i < items.length - 1 ? ' sep' : ''}" data-notif="${n.id}"><span class="h-notif-dot${n.read ? ' read' : ''}"></span><span class="h-notif-t${n.read ? '' : ' unread'}">${esc(n.text)}</span></button>`).join('')
      : '<p class="h-notif-empty">All quiet.</p>')
      + `<div class="h-notif-foot"><button class="link" id="markAll" ${unread ? '' : 'disabled'}>Mark all read</button><button class="link" id="allNotifs">All notifications</button></div>`;
  }
  function renderMenu() {
    const s = S.me.settings;
    const vb = q('#visBtn');
    vb.setAttribute('aria-expanded', String(menuOpen));
    const dot = vb.querySelector('.dot');
    dot.className = `dot ${s.visibility === 'live' ? 'live' : s.visibility === 'offline' ? 'hidden' : 'last'}`;
    vb.querySelector('.h-vis-t').textContent = `You · ${VIS[s.visibility]}${s.hideActivity ? ' · place only' : ''}`;
    const m = q('.h-menu');
    m.hidden = !menuOpen;
    if (!menuOpen) return;
    m.innerHTML = Object.entries({ live: 'Live', lastSeenOnly: 'Last stop only', offline: 'Appear offline' }).map(([id, l]) => `<button role="menuitemradio" aria-checked="${s.visibility === id}" data-vis="${id}">${l}</button>`).join('')
      + `<button role="menuitemcheckbox" aria-checked="${!!s.hideActivity}" data-hide="1">Hide what I'm doing</button>`;
  }
  function renderPlayer() {
    const st = music.state();
    q('.mini-title').textContent = st.title || (st.loaded ? 'No tracks yet' : 'Rainy playlist');
    q('.mini-sub').textContent = st.count ? `Rainy playlist · track ${st.index + 1} of ${st.count}` : 'Add songs to audio/playlist.json';
    const play = q('#miniPlay');
    play.setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
    play.innerHTML = st.playing
      ? '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const r = q('#miniRain');
    r.setAttribute('aria-pressed', String(!!st.rainOn));
    q('.mini-rain-t').textContent = st.rainOn ? 'Rain on' : 'Rain off';
  }
  const offMusic = music.onChange(renderPlayer);

  function renderPresence(isTogether) {
    const st = S.otherStatus;
    const oWho = S.otherWho;
    const me = S.me;
    const live = st.kind === 'live';
    const last = st.kind === 'last';
    const here = (live || last) && st.loc === 'cozy';
    const actKey = ACTIVITIES[st.act] ? st.act : 'idle';
    let name = S.otherName;
    let avas = avatar(oWho);
    let status;
    let dot = live ? 'live' : 'hollow';
    let title = '';
    let detail = '';
    if (isTogether) {
      const [a, b] = me.who === 'her' ? [me.name, S.otherName] : [S.otherName, me.name];
      name = `${a} & ${b}`;
      avas = avatar('her') + avatar('him', ' pair');
      status = 'Together · Cozy Corner';
      dot = 'live';
      detail = 'Curled up by the window';
    } else if (live) {
      status = here ? 'Here now' : `Here now · ${locName(st.loc)}`;
      title = here ? COPY[actKey][0] : `Visiting ${locName(st.loc)}`;
      detail = here ? COPY[actKey][1] : (ACTIVITIES[st.act] ? ACTIVITIES[st.act].label : 'Out exploring the little world');
    } else if (last) {
      status = `Last here ${relTime(st.at)}${st.loc && st.loc !== 'cozy' ? ' · ' + locName(st.loc) : ''}`;
      const c = st.loc === 'cozy' || !st.loc ? COPY[actKey] : [`Was at ${locName(st.loc)}`, 'Left a little footprint'];
      title = 'Last seen: ' + c[0].charAt(0).toLowerCase() + c[0].slice(1);
      detail = c[1];
    } else if (st.kind === 'hidden') {
      status = 'Somewhere in the world';
      detail = 'Being away is always okay';
    } else {
      status = 'Has not visited yet';
      detail = 'The room is waiting';
    }
    q('#presence').innerHTML = `<div class="pc-avas">${avas}</div>
      <div class="pc-body"><span class="pc-name">${esc(name)}</span>
        <div class="pc-status"><span class="${dot === 'live' ? 'pc-live' : 'pc-hollow'}"></span><span class="pc-st ${dot === 'live' ? 'on' : ''}" role="status">${esc(status)}</span></div>
        ${title ? `<div class="pc-title">${esc(title)}</div>` : ''}<div class="pc-detail">${esc(detail)}</div></div>
      <button class="pc-note" id="pcNote" aria-label="Leave a note in the Cozy Corner"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="h-ico"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg></button>`;
  }

  let lastPresence = '';
  function update() {
    const st = S.otherStatus;
    const mySpot = SPOTS[S.activity] ? S.activity : 'idle';
    const me = S.location === 'cozy' ? { who: S.me.who, spot: mySpot } : null;
    const hereLive = st.kind === 'live' && st.loc === 'cozy';
    const hereGhost = st.kind === 'last' && st.loc === 'cozy';
    const other = hereLive || hereGhost
      ? { who: S.otherWho, spot: SPOTS[st.act] ? st.act : 'idle', name: S.otherName, faded: hereGhost, tag: hereGhost ? `last here ${relTime(st.at)}` : '' }
      : null;
    const wx = S.me.settings.weather;
    const mail = S.hasMail !== false;
    const r = scene.update({ wx, mail, me, other });
    together = r.together;
    // chip: the other person is elsewhere, or you are
    let chip = null;
    if (st.kind === 'live' && st.loc !== 'cozy') {
      chip = { text: `${S.otherName} is at ${locName(st.loc)}${ACTIVITIES[st.act] ? ' · ' + ACTIVITIES[st.act].label : ''}`, loc: st.loc };
    } else if (S.location !== 'cozy') {
      chip = { text: `You're at ${locName(S.location)}. Walk back to Cozy Corner`, loc: 'cozy' };
    }
    const c = q('#sceneChip');
    c.hidden = !chip;
    if (chip) { c.textContent = chip.text; c.setAttribute('aria-label', `${chip.text}. Travel there.`); }
    chipLoc = chip ? chip.loc : null;

    hud.querySelectorAll('[data-weather]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.weather === wx)));
    hud.querySelectorAll('[data-zone]').forEach((b) => {
      const act = zoneSpot(b.dataset.zone);
      const on = S.location === 'cozy' && S.activity === act;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('active', on);
    });
    q('#wave').hidden = st.kind !== 'live';
    const key = JSON.stringify([st, S.otherName, S.me.name, together, Math.floor(Date.now() / 60000)]);
    if (key !== lastPresence) { lastPresence = key; renderPresence(together); }
    renderBell();
    renderMenu();
    renderPlayer();
  }
  update();

  return {
    update,
    wave: (who) => scene.wave(who),
    unmount() {
      offMusic();
      ro?.disconnect();
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
      scene.destroy();
    }
  };
}
