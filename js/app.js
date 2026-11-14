// Our Little Universe: app shell. Boot, sign-in, view router, presence HUD,
// notifications bell, sound and settings panels.
import { createBackend } from './backend/index.js';
import { ACTIVITIES, defaultSettings, mergeDeep, esc, relTime, locName, icon, toast, confirmDialog, $ } from './util.js';
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
const VIS = { live: 'Live', lastSeenOnly: 'Last stop only', offline: 'Appearing offline' };
const HEARTBEAT_MS = 30000;

const S = {
  me: null, other: null, otherWho: null, otherName: 'Them', userId: null,
  peers: [], seen: {}, location: 'cozy', activity: null,
  otherStatus: { kind: 'none' }, notifs: [], chipOpen: false
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
      ? `<p>Who are you?</p><div class="row center"><button class="btn" data-who="her">I'm Her</button><button class="btn" data-who="him">I'm Him</button></div>
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
  root.innerHTML = `<main class="login card center"><h1>Who are you in this world?</h1><div class="row center"><button class="btn" data-c="her">Her</button><button class="btn" data-c="him">Him</button></div><p class="note" role="status">${esc(note)}</p></main>`;
  root.onclick = async (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    try { await backend.profile.set({ character: b.dataset.c, display_name: b.dataset.c === 'her' ? 'Her' : 'Him' }); begin(await backend.auth.currentUser()); } catch (err) { showCharacterPicker(err.message); }
  };
}

async function begin(user) {
  const prof = await backend.profile.get();
  if (!prof.character) return showCharacterPicker();
  S.userId = user.id;
  S.me = { who: prof.character, name: prof.display_name || (prof.character === 'her' ? 'Her' : 'Him'), settings: mergeDeep(defaultSettings(), prof.settings) };
  S.otherWho = S.me.who === 'her' ? 'him' : 'her';
  await refreshOther();
  applyWeatherTheme(S.me.settings.weather);
  try { S.notifs = JSON.parse(localStorage.getItem(`olu:notifs:${S.me.who}`) || '[]'); } catch { S.notifs = []; }
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
  backend.letters.onNew((l) => pushNotif('letter', `A letter was left at ${locName(l.location)}`));
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

  setInterval(() => { syncMe(); renderHud(); }, HEARTBEAT_MS);
  window.addEventListener('pagehide', () => { if (joined) backend.presence.leave(); });
  window.addEventListener('hashchange', route);
  route();
  syncMe();
}

async function refreshOther() {
  const o = await backend.profile.getOther().catch(() => null);
  S.other = o;
  S.otherName = o?.display_name || (S.otherWho === 'her' ? 'Her' : 'Him');
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
  root.innerHTML = `<div class="app">
    <header class="top">
      <h1><span class="logo" aria-hidden="true">✦</span> Our Little Universe</h1>
      <div class="top-actions">
        <button class="icon-btn" id="btnSound" aria-label="Sound and music" aria-expanded="false" aria-controls="soundPanel">${icon('note')}</button>
        <button class="icon-btn" id="btnBell" aria-label="Notifications" aria-expanded="false" aria-controls="bellPanel">${icon('bell')}<span class="badge" hidden></span></button>
        <button class="icon-btn" id="btnSettings" aria-label="Settings and privacy">${icon('gear')}</button>
      </div>
    </header>
    <div class="panel card" id="soundPanel" hidden></div>
    <div class="panel card" id="bellPanel" hidden></div>
    <section class="hud" id="hud" aria-label="Who is here"></section>
    <main id="view" tabindex="-1"></main>
    <nav class="tabs" aria-label="Views">${Object.entries(VIEWS).map(([id, v]) => `<button data-view="${id}">${icon(v.icon)}<span>${v.label}</span></button>`).join('')}</nav>
  </div>`;
  music.mount($('#soundPanel'));
  root.onclick = onShellClick;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanels(); });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.panel, #btnSound, #btnBell')) closePanels();
    if (S.chipOpen && !e.target.closest('.chip-wrap')) { S.chipOpen = false; renderHud(); }
  });
  renderAll();
}

function onShellClick(e) {
  const nav = e.target.closest('[data-view]');
  if (nav) return go(nav.dataset.view);
  if (e.target.closest('#btnSound')) return togglePanel('soundPanel', 'btnSound');
  if (e.target.closest('#btnBell')) return togglePanel('bellPanel', 'btnBell');
  if (e.target.closest('#btnSettings')) return openSettings();
  const hud = e.target.closest('#hud');
  if (hud) hudClick(e);
  const n = e.target.closest('[data-notif]');
  if (n) {
    const it = S.notifs.find((x) => x.id === n.dataset.notif);
    if (it) { it.read = true; saveNotifs(); }
    closePanels();
    go({ letter: 'letters', xo: 'xo', plant: 'plants', here: 'home' }[it?.type] || 'home');
  }
  if (e.target.closest('#markAll')) { S.notifs.forEach((x) => (x.read = true)); saveNotifs(); }
}

function togglePanel(id, btnId) {
  const p = $('#' + id);
  const open = p.hidden;
  closePanels();
  p.hidden = !open;
  $('#' + btnId).setAttribute('aria-expanded', String(open));
}
function closePanels() {
  for (const [p, b] of [['soundPanel', 'btnSound'], ['bellPanel', 'btnBell']]) {
    const el = $('#' + p);
    if (el) { el.hidden = true; $('#' + b)?.setAttribute('aria-expanded', 'false'); }
  }
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
  viewApi = VIEWS[name].mod.mount(fresh, ctx);
  document.querySelectorAll('.tabs [data-view]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.view === name));
  ctx.params = {};
}

function renderAll() {
  if (!S.me) return;
  renderHud();
  renderBell();
  viewApi?.update?.();
}

// ---------------------------------------------------------------- HUD
function otherLine() {
  const st = S.otherStatus;
  const act = ACTIVITIES[st.act]?.label;
  if (st.kind === 'live') return { cls: 'live', text: `Here now · ${locName(st.loc)}${act ? ' · ' + act : ''}` };
  if (st.kind === 'last') return { cls: 'last', text: `Last here ${relTime(st.at)}${st.loc ? ' · ' + locName(st.loc) : ''}` };
  if (st.kind === 'hidden') return { cls: 'hidden', text: 'Somewhere in the world' };
  return { cls: 'hidden', text: 'Has not visited yet' };
}

function renderHud() {
  const hud = $('#hud');
  if (!hud) return;
  const o = otherLine();
  const { visibility, hideActivity } = S.me.settings;
  hud.innerHTML = `<div class="card hud-card"><span class="dot ${o.cls}" aria-hidden="true"></span><div><div class="hud-name">${esc(S.otherName)}</div><div class="hud-line" role="status">${esc(o.text)}</div></div></div>
    <div class="chip-wrap"><button class="card chip" id="chipBtn" aria-haspopup="menu" aria-expanded="${S.chipOpen}"><span class="dot ${visibility === 'live' ? 'live' : visibility === 'offline' ? 'hidden' : 'last'}" aria-hidden="true"></span><span>You · ${VIS[visibility]}${hideActivity ? ' · activity hidden' : ''}</span></button>
      ${S.chipOpen ? `<div class="menu card" role="menu" aria-label="Your status">
        ${Object.keys(VIS).map((id) => `<button role="menuitemradio" aria-checked="${visibility === id}" data-vis="${id}">${id === 'live' ? 'Live' : id === 'lastSeenOnly' ? 'Last stop only' : 'Appear offline'}</button>`).join('')}
        <button role="menuitemcheckbox" aria-checked="${hideActivity}" data-hide="1">Hide what I'm doing</button></div>` : ''}</div>`;
}

function hudClick(e) {
  if (e.target.closest('#chipBtn')) { S.chipOpen = !S.chipOpen; renderHud(); $('#chipBtn')?.focus(); return; }
  const v = e.target.closest('[data-vis]');
  if (v) { S.chipOpen = false; saveSettings({ settings: { visibility: v.dataset.vis } }); setTimeout(() => $('#chipBtn')?.focus(), 0); }
  if (e.target.closest('[data-hide]')) { S.chipOpen = false; saveSettings({ settings: { hideActivity: !S.me.settings.hideActivity } }); setTimeout(() => $('#chipBtn')?.focus(), 0); }
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
function renderBell() {
  const p = $('#bellPanel');
  if (!p) return;
  const unread = S.notifs.filter((n) => !n.read).length;
  const b = $('#btnBell .badge');
  b.hidden = !unread;
  b.textContent = unread;
  $('#btnBell').setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
  p.innerHTML = `<div class="row between"><h2>Notifications</h2><button class="link" id="markAll" ${unread ? '' : 'disabled'}>Mark all read</button></div>
    ${S.notifs.length ? `<ul class="plain notif-list">${S.notifs.map((n) => `<li><button class="notif ${n.read ? '' : 'unread'}" data-notif="${n.id}">${esc(n.text)}<span class="muted"> · ${relTime(n.at)}</span></button></li>`).join('')}</ul>` : '<p class="muted">All quiet.</p>'}
    <p class="note">Nothing here tells anyone when you read something.</p>`;
}

// ---------------------------------------------------------------- settings
function openSettings() {
  const s = S.me.settings;
  const notSupported = !('Notification' in window);
  const d = document.createElement('dialog');
  d.className = 'modal settings';
  d.setAttribute('aria-label', 'Settings and privacy');
  d.innerHTML = `<form method="dialog" class="stack">
    <h2>Settings &amp; privacy</h2>
    <p class="pretend">This is a pretend world. No real locations, ever.</p>
    <label>Display name<input id="sName" maxlength="24" value="${esc(S.me.name)}"></label>
    <fieldset><legend>Who can see I'm around</legend>
      ${Object.keys(VIS).map((id) => `<label class="check"><input type="radio" name="vis" value="${id}" ${s.visibility === id ? 'checked' : ''}> ${id === 'live' ? 'Live: they see me here now' : id === 'lastSeenOnly' ? 'Last stop only: no live presence' : 'Appear offline: nothing is shared'}</label>`).join('')}
      <label class="check"><input type="checkbox" id="sHide" ${s.hideActivity ? 'checked' : ''}> Hide what I'm doing (share only where I am)</label></fieldset>
    <fieldset><legend>Notifications</legend>
      ${[['letters', 'New letters'], ['xo', 'My move in XO'], ['here', 'They are here now'], ['plants', 'Plant watered']].map(([k, l]) => `<label class="check"><input type="checkbox" data-n="${k}" ${s.notify[k] !== false ? 'checked' : ''}> ${l}</label>`).join('')}
      ${notSupported ? '<p class="note">Browser notifications are not available here.</p>' : `<button type="button" class="btn ghost" id="sBrowser">${s.notify.browser ? 'Turn off browser notifications' : 'Turn on browser notifications'}</button>`}</fieldset>
    <fieldset><legend>Quiet hours</legend>
      <label class="check"><input type="checkbox" id="qOn" ${s.quiet.enabled ? 'checked' : ''}> Quiet hours</label>
      <div class="row"><label>From<input type="time" id="qStart" value="${s.quiet.start}"></label><label>To<input type="time" id="qEnd" value="${s.quiet.end}"></label></div></fieldset>
    <div class="row wrap"><button type="button" class="btn ghost" id="sOut">Sign out</button><button type="button" class="btn danger" id="sDel">Delete my data</button><button class="btn" value="close">Done</button></div>
  </form>`;
  const q = (sel) => d.querySelector(sel);
  d.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'vis') saveSettings({ settings: { visibility: t.value } });
    else if (t.id === 'sHide') saveSettings({ settings: { hideActivity: t.checked } });
    else if (t.dataset.n) saveSettings({ settings: { notify: { [t.dataset.n]: t.checked } } });
    else if (t.id === 'qOn' || t.id === 'qStart' || t.id === 'qEnd') saveSettings({ settings: { quiet: { enabled: q('#qOn').checked, start: q('#qStart').value || '22:00', end: q('#qEnd').value || '08:00' } } });
    else if (t.id === 'sName') saveSettings({ display_name: t.value.trim() || S.me.name });
  });
  // Browser notifications are off by default and only ask for permission after this click.
  q('#sBrowser')?.addEventListener('click', async (e) => {
    if (S.me.settings.notify.browser) { saveSettings({ settings: { notify: { browser: false } } }); e.target.textContent = 'Turn on browser notifications'; return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') { saveSettings({ settings: { notify: { browser: true } } }); e.target.textContent = 'Turn off browser notifications'; } else toast("No permission was given. That's okay, the bell still works.");
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
