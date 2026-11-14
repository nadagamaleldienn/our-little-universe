// Our Little Universe: app shell. Boot, sign-in, view router, presence HUD,
// notifications bell, sound and settings panels.
import { createBackend } from './backend/index.js';
import { ACTIVITIES, LOCATIONS, DEFAULT_NAMES, defaultName, cleanName, defaultSettings, mergeDeep, esc, relTime, locName, icon, toast, confirmDialog, $ } from './util.js';
import { itemFor } from './scene.js';
import { createMusic } from './music.js';
import { applyWeatherTheme } from './weather.js';
import * as home from './views/home.js';
import * as mapView from './views/map.js';
import * as letters from './views/letters.js';
import * as xoView from './views/xo.js';
import * as plants from './views/plants.js';

const VIEWS = {
  home: { mod: home, label: 'Home', icon: 'home' },
  map: { mod: mapView, label: 'Map', icon: 'map' },
  letters: { mod: letters, label: 'Letters', icon: 'mail' },
  xo: { mod: xoView, label: 'XO', icon: 'xo' },
  plants: { mod: plants, label: 'Plants', icon: 'leaf' }
};
const HEARTBEAT_MS = 30000;

const S = {
  me: null, other: null, otherWho: null, otherName: 'Them', userId: null,
  peers: [], seen: {}, location: 'cozy', activity: null,
  otherStatus: { kind: 'none' }, notifs: [], hasMail: false
};
let backend = null;
let root = null;
let viewApi = null;
let joined = false;
let seenOnce = false;
let peersOnce = false;
let prevTurn = null;
let knownLog = null;
const music = createMusic();

const ctx = {
  state: S,
  params: {},
  toast,
  confirm: confirmDialog,
  go,
  travel,
  setActivity,
  setWeather,
  wave,
  music,
  saveSettings,
  openSettings,
  openNotif,
  markAllRead,
  openBellPanel: () => openPanel('bellPanel', 'btnBell'),
  toggleSound: () => togglePanel('soundPanel', 'btnSound'),
  refreshMail,
  get backend() { return backend; }
};

// ---------------------------------------------------------------- boot
async function boot() {
  root = $('#app');
  try { backend = await createBackend(); } catch (e) {
    root.innerHTML = `<div class="card center"><h1>Something went sideways</h1><p>${esc(e.message)}</p><p class="muted">Check config.js, or clear both values to use local mode.</p></div>`;
    return;
  }
  let user = null;
  try { user = await backend.auth.currentUser(); } catch (e) { console.error(e); }
  if (!user) return showLogin();
  await begin(user);
}

function showLogin(note = '') {
  const local = backend.auth.mode === 'local';
  root.innerHTML = `<main class="login card center">
    <h1>Our Little Universe</h1>
    <p class="muted">A pretend world for two. No real places, ever.</p>
    ${local
      ? `<p>Who are you?</p><div class="row center"><button class="btn" data-who="her">I'm ${esc(DEFAULT_NAMES.her)}</button><button class="btn" data-who="him">I'm ${esc(DEFAULT_NAMES.him)}</button></div>
         <p class="note">Local demo mode: data stays in this browser. Open a second tab and pick the other person to see the two of you together.</p>`
      : `<form id="mail"><label>Your email<input type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label><button class="btn">Send me a magic link</button></form>`}
    <p class="note" role="status">${esc(note)}</p></main>`;
  root.onclick = async (e) => {
    const b = e.target.closest('[data-who]');
    if (!b) return;
    await backend.auth.signIn(b.dataset.who);
    begin(await backend.auth.currentUser());
  };
  const form = $('#mail', root);
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    try { await backend.auth.signIn(new FormData(form).get('email')); showLogin('Check your email for the link, then come back.'); } catch (err) { showLogin(err.message); }
  };
}

function showCharacterPicker(note = '') {
  root.innerHTML = `<main class="login card center"><h1>Who are you in this world?</h1><div class="row center"><button class="btn" data-c="her">${esc(DEFAULT_NAMES.her)}</button><button class="btn" data-c="him">${esc(DEFAULT_NAMES.him)}</button></div><p class="note" role="status">${esc(note)}</p></main>`;
  root.onclick = async (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    try { await backend.profile.set({ character: b.dataset.c, display_name: defaultName(b.dataset.c) }); begin(await backend.auth.currentUser()); } catch (err) { showCharacterPicker(err.message); }
  };
}

async function begin(user) {
  const prof = await backend.profile.get();
  if (!prof.character) return showCharacterPicker();
  S.userId = user.id;
  S.me = { who: prof.character, name: cleanName(prof.character, prof.display_name), settings: mergeDeep(defaultSettings(), prof.settings) };
  S.otherWho = S.me.who === 'her' ? 'him' : 'her';
  await refreshOther();
  refreshMail();
  applyWeatherTheme(S.me.settings.weather);
  try { S.notifs = JSON.parse(localStorage.getItem(`olu:notifs:${S.me.who}`) || '[]'); } catch { S.notifs = []; }
  // Notifications saved before the names were set read "Her ..." / "Him ...": show the real names.
  S.notifs.forEach((n) => { n.text = String(n.text).replace(/^Her\b/, DEFAULT_NAMES.her).replace(/^Him\b/, DEFAULT_NAMES.him); });
  buildShell();

  backend.presence.onPeers((list) => {
    S.peers = list;
    const wasLive = S.otherStatus.kind === 'live';
    computeOther();
    if (peersOnce && !wasLive && S.otherStatus.kind === 'live') pushNotif('here', `${S.otherName} is here now`);
    peersOnce = true;
    renderAll();
  });
  backend.presence.onWave(() => { viewApi?.wave?.('other'); toast(`${S.otherName} waved at you`); });
  backend.lastSeen.watch((map) => {
    S.seen = map;
    if (!seenOnce) {
      seenOnce = true;
      const mine = map[S.me.who];
      if (mine && mine.location) { S.location = mine.location; S.activity = mine.activity || null; }
      syncMe();
    }
    computeOther();
    renderAll();
  });
  backend.letters.onNew((l) => { refreshMail(); pushNotif('letter', `A letter was left at ${locName(l.location)}`); });
  backend.xo.get().then((g) => { prevTurn = g.turn; });
  backend.xo.onChange((g) => {
    const mark = S.me.who === 'her' ? 'X' : 'O';
    if (prevTurn !== null && prevTurn !== mark && g.turn === mark && !g.winner) pushNotif('xo', `Your move in XO`);
    prevTurn = g.turn;
  });
  backend.plants.log(50).then((l) => { knownLog = new Set(l.map((x) => x.id)); });
  backend.plants.onChange(({ log }) => {
    if (!knownLog) return;
    for (const l of log) {
      if (knownLog.has(l.id)) continue;
      knownLog.add(l.id);
      if (l.by !== S.me.who && l.action === 'water') pushNotif('plant', `${S.otherName} watered ${l.plantName}`);
    }
  });

  setInterval(() => { syncMe(); viewApi?.update?.(); }, HEARTBEAT_MS);
  window.addEventListener('pagehide', () => { if (joined) backend.presence.leave(); });
  window.addEventListener('hashchange', route);
  route();
  syncMe();
}

async function refreshOther() {
  const o = await backend.profile.getOther().catch(() => null);
  S.other = o;
  S.otherName = cleanName(S.otherWho, o?.display_name);
}

// ---------------------------------------------------------------- presence + status
function computeOther() {
  const live = S.peers.find((p) => p.who === S.otherWho);
  const seen = S.seen[S.otherWho];
  if (live) S.otherStatus = { kind: 'live', loc: live.location, act: live.activity, item: live.item };
  else if (seen && seen.visibility === 'offline') S.otherStatus = { kind: 'hidden' };
  else if (seen && seen.location) S.otherStatus = { kind: 'last', loc: seen.location, act: seen.activity, at: seen.at };
  else if (seen) S.otherStatus = { kind: 'last', loc: null, act: null, at: seen.at };
  else S.otherStatus = { kind: 'none' };
}

// Broadcast where I am. Respects visibility and "hide what I'm doing".
async function syncMe() {
  if (!S.me) return;
  const { visibility, hideActivity } = S.me.settings;
  const hidden = visibility === 'offline';
  const activity = hideActivity ? null : S.activity;
  try {
    await backend.lastSeen.save({ location: hidden ? null : S.location, activity: hidden ? null : activity, visibility });
    if (visibility === 'live') {
      const payload = {
        userId: S.userId, who: S.me.who, location: S.location, activity,
        item: activity ? itemFor(activity) : 'none', weather: S.me.settings.weather, updatedAt: Date.now()
      };
      if (!joined) { joined = true; await backend.presence.join(payload); } else await backend.presence.update(payload);
    } else if (joined) { joined = false; await backend.presence.leave(); }
  } catch (e) { console.error(e); }
}

function setActivity(id) {
  S.location = 'cozy';
  S.activity = S.activity === id ? null : id;
  if (S.activity) toast(`You're ${ACTIVITIES[S.activity].label}`);
  syncMe();
  renderAll();
}
function travel(loc) {
  S.location = loc;
  S.activity = null;
  toast(`You're at ${locName(loc)}`);
  syncMe();
  renderAll();
}
async function wave() {
  viewApi?.wave?.('me');
  try { await backend.presence.wave(); } catch (e) { console.error(e); }
}
async function setWeather(w) {
  S.me.settings.weather = w;
  applyWeatherTheme(w);
  await backend.profile.set({ settings: { weather: w } });
  syncMe();
  renderAll();
}
async function saveSettings(patch) {
  if (patch.settings) S.me.settings = mergeDeep(S.me.settings, patch.settings);
  if (patch.display_name != null) S.me.name = patch.display_name;
  try { await backend.profile.set(patch); } catch (e) { toast(e.message); }
  applyWeatherTheme(S.me.settings.weather);
  syncMe();
  renderAll();
}

// ---------------------------------------------------------------- shell
function buildShell() {
  root.onclick = null;
  root.innerHTML = `<div class="app" data-view="home">
    <header class="top">
      <h1><span class="logo" aria-hidden="true">✦</span> Our Little Universe</h1>
      <div class="top-actions">
        <button class="icon-btn" id="btnSound" aria-label="Sound and music" aria-expanded="false" aria-controls="soundPanel">${icon('note')}</button>
        <button class="icon-btn" id="btnBell" aria-label="Notifications" aria-expanded="false" aria-controls="bellPanel">${icon('bell')}<span class="badge" hidden></span></button>
        <button class="icon-btn" id="btnSettings" aria-label="Settings and privacy">${icon('gear')}</button>
      </div>
    </header>
    <div class="panel card sound-panel" id="soundPanel" hidden></div>
    <div class="panel card bell-panel" id="bellPanel" hidden aria-label="Gentle notifications"></div>
    <main id="view" tabindex="-1"></main>
    <nav class="tabs" aria-label="Views">${Object.entries(VIEWS).map(([id, v]) => `<button data-view="${id}">${icon(v.icon)}<span>${v.label}</span></button>`).join('')}</nav>
  </div>`;
  music.mount($('#soundPanel'));
  root.onclick = onShellClick;
  root.onchange = onShellChange;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanels(); });
  document.addEventListener('click', (e) => {
    // composedPath() is taken at dispatch time, so it still works when the click re-rendered its own target.
    const inside = e.composedPath().some((n) => n.matches?.('.panel, #btnSound, #btnBell, #allNotifs, .mini, .h-bell'));
    if (!inside) closePanels();
  });
  renderAll();
}

function onShellClick(e) {
  const nav = e.target.closest('[data-view]');
  if (nav && nav.closest('.tabs')) return go(nav.dataset.view);
  if (e.target.closest('#btnSound')) return togglePanel('soundPanel', 'btnSound');
  if (e.target.closest('#btnBell')) return togglePanel('bellPanel', 'btnBell');
  if (e.target.closest('#btnSettings')) return openSettings();
  const n = e.target.closest('[data-notif]');
  if (n && n.closest('#bellPanel')) return openNotif(n.dataset.notif);
  if (e.target.closest('#bellPanel #markAll')) return markAllRead();
  if (e.target.closest('#sBrowser')) return toggleBrowserPush();
}

function openNotif(id) {
  const it = S.notifs.find((x) => x.id === id);
  if (it) { it.read = true; saveNotifs(); }
  closePanels();
  go({ letter: 'letters', xo: 'xo', plant: 'plants', here: 'home' }[it?.type] || 'home');
}
function markAllRead() { S.notifs.forEach((x) => (x.read = true)); saveNotifs(); }

function togglePanel(id, btnId) {
  const p = $('#' + id);
  const open = p.hidden;
  closePanels();
  p.hidden = !open;
  $('#' + btnId)?.setAttribute('aria-expanded', String(open));
  if (open && id === 'bellPanel') renderBell();
}
function openPanel(id, btnId) {
  closePanels();
  $('#' + id).hidden = false;
  $('#' + btnId)?.setAttribute('aria-expanded', 'true');
  renderBell();
}
function closePanels() {
  for (const [p, b] of [['soundPanel', 'btnSound'], ['bellPanel', 'btnBell']]) {
    const el = $('#' + p);
    if (el) { el.hidden = true; $('#' + b)?.setAttribute('aria-expanded', 'false'); }
  }
}

async function refreshMail() {
  try {
    const list = await backend.letters.list();
    S.hasMail = list.some((l) => l.to === S.me.who && !l.readAt);
  } catch { S.hasMail = false; }
  viewApi?.update?.();
}

// ---------------------------------------------------------------- router
function go(name, params) {
  ctx.params = params || {};
  if (location.hash === '#/' + name) route(); else location.hash = '#/' + name;
}
function route() {
  let name = location.hash.replace(/^#\//, '') || 'home';
  if (!VIEWS[name]) name = 'home';
  const params = ctx.params;
  viewApi?.unmount?.();
  const el = $('#view');
  const fresh = el.cloneNode(false); // drops listeners the previous view attached
  el.replaceWith(fresh);
  ctx.params = params;
  $('.app')?.setAttribute('data-view', name);
  viewApi = VIEWS[name].mod.mount(fresh, ctx);
  document.querySelectorAll('.tabs [data-view]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.view === name));
  ctx.params = {};
}

function renderAll() {
  if (!S.me) return;
  renderBell();
  viewApi?.update?.();
}

// ---------------------------------------------------------------- notifications
function inQuiet() {
  const q = S.me.settings.quiet;
  if (!q?.enabled) return false;
  const n = new Date();
  const m = n.getHours() * 60 + n.getMinutes();
  const [sh, sm] = q.start.split(':').map(Number);
  const [eh, em] = q.end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? m >= s && m < e : m >= s || m < e;
}
function saveNotifs() {
  S.notifs = S.notifs.slice(0, 50);
  try { localStorage.setItem(`olu:notifs:${S.me.who}`, JSON.stringify(S.notifs)); } catch { /* ignore */ }
  renderBell();
  viewApi?.update?.();
}
function pushNotif(kind, text) {
  const pref = S.me.settings.notify;
  const key = { letter: 'letters', xo: 'xo', here: 'here', plant: 'plants' }[kind];
  if (pref[key] === false) return;
  S.notifs.unshift({ id: Math.random().toString(36).slice(2), type: kind, text, at: Date.now(), read: false });
  saveNotifs();
  if (inQuiet()) return; // quiet hours: still listed in the bell, but no toast or browser popup
  toast(text);
  if (pref.browser && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification('Our Little Universe', { body: text }); } catch { /* ignore */ }
  }
}
const NOTIF_ICON = {
  letter: '<rect x="3" y="5" width="18" height="14"/><path d="M3 5l9 8 9-8"/>',
  xo: '<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  here: '<path d="M7 3h10v8H7zM5 11h14v3H5zM9 14v7M15 14v7"/>',
  plant: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7"/>'
};
const sw = (attr, on, label) => `<label class="sw"><input type="checkbox" ${attr} ${on ? 'checked' : ''}><span class="trk"><span class="knob"></span></span><span>${label}</span></label>`;

function renderBell() {
  const p = $('#bellPanel');
  if (!p) return;
  const unread = S.notifs.filter((n) => !n.read).length;
  const b = $('#btnBell .badge');
  b.hidden = !unread;
  b.textContent = unread;
  $('#btnBell').setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
  if (p.hidden) return; // drawn when opened
  const s = S.me.settings;
  const q = s.quiet;
  const ae = document.activeElement;
  const focus = ae && p.contains(ae) ? (ae.id ? '#' + ae.id : ae.dataset.n ? `[data-n="${ae.dataset.n}"]` : ae.dataset.notif ? `[data-notif="${ae.dataset.notif}"]` : '') : '';
  const latest = S.notifs[0];
  const notSupported = !('Notification' in window);
  p.innerHTML = `<div class="np-head"><h2>Gentle notifications</h2><button class="btn sm" id="markAll" ${unread ? '' : 'disabled'}>Mark all read</button></div>
    <div class="np-room" aria-hidden="true"><span class="np-win"></span><span class="np-sill"></span><span class="np-rug"></span><span class="lab np-cap">Cozy Corner · preview</span>${latest ? `<span class="np-toast"><span class="np-led"></span>${esc(latest.text)}</span>` : ''}</div>
    <div><div class="lab">Recent · ${unread} unread</div>
      <div class="np-list">${S.notifs.length ? S.notifs.slice(0, 8).map((n) => `<button class="np-it${n.read ? '' : ' unread'}" data-notif="${n.id}" aria-label="${esc(n.text)}, ${relTime(n.at)}${n.read ? '' : ', unread'}"><span class="np-ico"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">${NOTIF_ICON[n.type] || NOTIF_ICON.here}</svg></span><span class="np-t">${esc(n.text)}</span><span class="lab np-time">${relTime(n.at)}</span>${n.read ? '' : '<span class="np-dot"></span>'}</button>`).join('') : '<p class="muted">All quiet.</p>'}</div></div>
    <div><div class="lab">Notify me about</div><div class="np-sw">
      ${sw('data-n="letters"', s.notify.letters !== false, 'Letters')}${sw('data-n="xo"', s.notify.xo !== false, 'Game moves')}${sw('data-n="here"', s.notify.here !== false, `When ${esc(S.otherName)} arrives`)}${sw('data-n="plants"', s.notify.plants !== false, 'Plants watered')}</div></div>
    <div class="np-row">
      <div><div class="lab">Quiet hours</div>${sw('id="qOn"', q.enabled, 'Quiet hours')}
        <div class="np-times"><label for="qStart">From</label><input id="qStart" class="tm" type="time" value="${q.start}"><label for="qEnd">to</label><input id="qEnd" class="tm" type="time" value="${q.end}"></div></div>
      <div><div class="lab">Delivery</div>
        <label class="rd"><input type="radio" name="delivery" value="world" ${s.notify.browser ? '' : 'checked'}><span>In-world only</span></label>
        <label class="rd"><input type="radio" name="delivery" value="push" ${s.notify.browser ? 'checked' : ''} ${notSupported ? 'disabled' : ''}><span>Browser notifications</span></label></div>
    </div>
    <p class="np-off">Off by default. Nothing tells ${esc(S.otherName)} when you read something.</p>
    <p class="note">Browser notifications need your permission, and are only asked after a tap. Quiet hours keep the bell quiet too.</p>`;
  if (focus) p.querySelector(focus)?.focus();
}

async function enableBrowserPush() {
  if (!('Notification' in window)) return toast('Browser notifications are not available here.');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') saveSettings({ settings: { notify: { browser: true } } });
  else { toast("No permission was given. That's okay, the bell still works."); renderBell(); }
}
function toggleBrowserPush() { return S.me.settings.notify.browser ? saveSettings({ settings: { notify: { browser: false } } }) : enableBrowserPush(); }

function onShellChange(e) {
  const t = e.target;
  if (!t.closest('#bellPanel')) return;
  if (t.dataset.n) saveSettings({ settings: { notify: { [t.dataset.n]: t.checked } } });
  else if (t.id === 'qOn' || t.id === 'qStart' || t.id === 'qEnd') {
    const p = $('#bellPanel');
    saveSettings({ settings: { quiet: { enabled: p.querySelector('#qOn').checked, start: p.querySelector('#qStart').value || '22:00', end: p.querySelector('#qEnd').value || '08:00' } } });
  } else if (t.name === 'delivery') {
    if (t.value === 'push') enableBrowserPush(); else saveSettings({ settings: { notify: { browser: false } } });
  }
}

// ---------------------------------------------------------------- settings (design/Privacy.dc.html)
function previewText() {
  const s = S.me.settings;
  const act = ACTIVITIES[S.activity]?.label;
  const place = locName(S.location);
  if (s.visibility === 'live') return [`${S.me.name} · Here now · ${place}`, s.hideActivity ? `${S.otherName} sees the place only, not what you are doing.` : `${S.otherName} sees what you are doing: ${act || 'nothing in particular'}.`];
  if (s.visibility === 'lastSeenOnly') return [`${S.me.name} · Last stop only`, s.hideActivity ? `Place only: ${place}.` : `${place}${act ? ', ' + act : ''}.`];
  return [`${S.me.name} · Somewhere in the world`, 'Appearing offline: no live presence and no last stop are saved.'];
}

function openSettings() {
  const s = S.me.settings;
  const d = document.createElement('dialog');
  d.className = 'modal settings pv';
  d.setAttribute('aria-label', 'Settings and privacy');
  const modes = [['live', 'Show where I am, live'], ['lastSeenOnly', 'Only show my last stop'], ['offline', 'Appear offline']];
  d.innerHTML = `<form method="dialog" class="pv-form">
    <h2>How I appear</h2>
    <label class="lbl" for="sName">Display name</label>
    <input id="sName" class="fld" maxlength="24" value="${esc(S.me.name)}" placeholder="${esc(defaultName(S.me.who))}">
    <fieldset class="pv-modes"><legend class="lbl">Who can see what</legend>
      ${modes.map(([id, l]) => `<label class="opt${s.visibility === id ? ' on' : ''}"><input type="radio" name="vis" value="${id}" ${s.visibility === id ? 'checked' : ''}>${l}</label>`).join('')}
    </fieldset>
    <label class="opt pv-sw"><span>Hide what I'm doing, show the place only</span><input class="swi" type="checkbox" id="sHide" ${s.hideActivity ? 'checked' : ''}></label>
    <p class="pv-box">This is a pretend world. No real locations, no tracking, no read receipts. Being away is always okay.</p>
    <section class="pv-note"><h3>Leave a note</h3>
      <label class="lbl" for="noteLoc">Where to pin it</label>
      <select id="noteLoc" class="fld">${LOCATIONS.map((l) => `<option value="${l.id}" ${l.id === S.location ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
      <label class="lbl" for="noteText">Your note</label>
      <textarea id="noteText" class="fld" rows="2" maxlength="300"></textarea>
      <div class="row"><button type="button" class="btn" id="pinNote">Pin note</button><span class="pv-pinned" id="pinned" role="status"></span></div></section>
    <div class="pv-preview"><div class="lbl">How ${esc(S.otherName)} will see you</div><div class="pv-pm" id="pvMain"></div><div class="pv-ps" id="pvSub"></div></div>
    <p class="note">Notification choices live in the bell. This is where you decide how much to share.</p>
    <div class="row wrap pv-actions"><button type="button" class="btn ghost" id="sOut">Sign out</button><button type="button" class="btn danger" id="sDel">Delete my data</button><button class="btn" value="close">Done</button></div>
  </form>`;
  const q = (sel) => d.querySelector(sel);
  const paint = () => {
    const [m, sub] = previewText();
    q('#pvMain').textContent = m;
    q('#pvSub').textContent = sub;
    d.querySelectorAll('.pv-modes .opt').forEach((o) => o.classList.toggle('on', o.querySelector('input').checked));
  };
  paint();
  d.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.name === 'vis') { await saveSettings({ settings: { visibility: t.value } }); paint(); }
    else if (t.id === 'sHide') { await saveSettings({ settings: { hideActivity: t.checked } }); paint(); }
    else if (t.id === 'sName') { await saveSettings({ display_name: t.value.trim() || defaultName(S.me.who) }); t.value = S.me.name; paint(); }
  });
  q('#pinNote').addEventListener('click', async () => {
    const text = q('#noteText').value.trim();
    const loc = q('#noteLoc').value;
    if (!text) return toast('Write a few words first');
    try {
      await backend.letters.send({ to: S.otherWho, location: loc, text, seal: 'star' });
      q('#noteText').value = '';
      q('#pinned').textContent = `Pinned at ${locName(loc)} ✦`;
    } catch (err) { toast(err.message); }
  });
  q('#sOut').addEventListener('click', async () => { await backend.auth.signOut(); location.reload(); });
  q('#sDel').addEventListener('click', async () => {
    if (!(await confirmDialog('Delete your profile, last-seen status, letters you wrote and plants you planted? This cannot be undone.', { ok: 'Delete my data' }))) return;
    try { await backend.profile.deleteMine(); await backend.auth.signOut(); location.reload(); } catch (err) { toast(err.message); }
  });
  d.addEventListener('close', () => d.remove());
  document.body.appendChild(d);
  d.showModal();
}


boot();
