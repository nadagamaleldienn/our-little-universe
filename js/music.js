// Music player + rain ambience. Nothing autoplays: the first thing you see is a
// "Tap to start the sound" button. Tracks play from YouTube (official IFrame Player API,
// loaded lazily on that first tap) or from plain audio files. Volumes are remembered in localStorage.
import { esc, icon } from './util.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem('olu:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('olu:' + k, JSON.stringify(v)); } catch { /* ignore */ } }
};
const MY_TRACKS_KEY = 'olu.myTracks';
const MY_RAIN_KEY = 'olu.rain';
const rawGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const rawSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const fmt = (s) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const LIST_RE = /^(PL|UU|LL|FL|RD|OL|OLAK5uy_)[A-Za-z0-9_-]{8,}$/;

// Accepts a video id, a playlist id, or any youtube / music.youtube / youtu.be link.
// Returns { id } for a video, { list } for a playlist, or null. A link with both v= and list= is treated as the video.
export function parseYouTube(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (ID_RE.test(s)) return { id: s };
  if (LIST_RE.test(s)) return { list: s };
  let u;
  try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const isYT = host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be';
  if (!isYT) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  let id = null;
  if (host === 'youtu.be') id = parts[0];
  else if (u.searchParams.get('v')) id = u.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1];
  if (id && ID_RE.test(id)) return { id };
  const list = u.searchParams.get('list');
  if (list && /^[A-Za-z0-9_-]{6,}$/.test(list)) return { list };
  return null;
}

let apiPromise = null;
function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch { /* ignore */ } resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { apiPromise = null; reject(new Error('YouTube API failed to load')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!window.YT?.Player) { apiPromise = null; reject(new Error('YouTube API timed out')); } }, 15000);
  });
  return apiPromise;
}

const EMPTY_TEXT = 'Paste a YouTube or YouTube Music link to add your first song';
const ERRORS = {
  2: "That link doesn't look like a valid YouTube video, try another one.",
  5: "YouTube can't play this video right now, try another link.",
  100: 'This video is unavailable (removed or private), try another link.',
  101: "This video can't be played outside YouTube, try another link.",
  150: "This video can't be played outside YouTube, try another link."
};

export function createMusic() {
  const audio = new Audio(); // for plain { src } tracks
  audio.preload = 'none';
  const rainAudio = new Audio();
  rainAudio.loop = true;
  rainAudio.preload = 'none';

  let baseTracks = [];
  let baseRain = null; // from playlist.json
  let list = []; // base + mine, each { title, artist, youtube|youtubePlaylist|src, mine?, mineIdx? }
  let idx = 0;
  let kind = null; // kind of the current track: 'video' | 'list' | 'file'
  let started = false;
  let rainOn = store.get('rainOn', false);
  let msg = '';
  let root = null;
  let loaded = false;
  let busy = false;
  let pendingFocus = null;
  let errRun = 0;

  let volMusic = store.get('vol:music', 0.6);
  let volRain = store.get('vol:rain', 0.4);

  let ytMusic = null;
  let ytRain = null;
  let ytMusicState = -1;
  let ytRainState = -1;
  let rainLoadedId = null;
  let startPromise = null;
  let pollTimer = null;

  const subs = new Set();
  const emit = () => subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  const q = (s) => root?.querySelector(s);

  // ---------- track list ----------
  const myTracks = () => { const v = rawGet(MY_TRACKS_KEY, []); return Array.isArray(v) ? v.filter((t) => t && (t.youtube || t.youtubePlaylist)) : []; };
  function rebuildList() {
    const mine = myTracks().map((t, i) => ({ ...t, mine: true, mineIdx: i }));
    list = [...baseTracks, ...mine];
    if (idx >= list.length) idx = 0;
  }
  function normalizeTrack(t) {
    if (!t || typeof t !== 'object') return null;
    const out = { title: String(t.title || ''), artist: String(t.artist || '') };
    if (t.youtubePlaylist) { const p = parseYouTube(t.youtubePlaylist); const l = p?.list || (/^[A-Za-z0-9_-]{6,}$/.test(String(t.youtubePlaylist)) ? String(t.youtubePlaylist) : null); if (!l) return null; out.youtubePlaylist = l; out.title ||= 'YouTube playlist'; }
    else if (t.youtube) { const p = parseYouTube(t.youtube); if (p?.id) out.youtube = p.id; else if (p?.list) out.youtubePlaylist = p.list; else return null; out.title ||= out.youtubePlaylist ? 'YouTube playlist' : 'YouTube track'; }
    else if (t.src) { out.src = String(t.src); out.title ||= 'Track'; }
    else return null;
    return out;
  }
  async function loadList() {
    try {
      const r = await fetch('audio/playlist.json', { cache: 'no-cache' });
      const j = await r.json();
      const arr = Array.isArray(j) ? j : Array.isArray(j?.tracks) ? j.tracks : [];
      baseTracks = arr.map(normalizeTrack).filter(Boolean);
      baseRain = (!Array.isArray(j) && j?.rain) || null;
    } catch { baseTracks = []; baseRain = null; }
    loaded = true;
    rebuildList();
    render();
  }

  // ---------- rain source ----------
  function rainSource() {
    const custom = rawGet(MY_RAIN_KEY, null);
    const pick = (o) => {
      if (!o) return null;
      if (o.youtube) { const p = parseYouTube(o.youtube); return p?.id ? { kind: 'yt', id: p.id } : null; }
      if (o.src) return { kind: 'file', src: String(o.src) };
      return null;
    };
    return pick(custom) || pick(baseRain);
  }
  const hasCustomRain = () => !!rawGet(MY_RAIN_KEY, null);

  // ---------- YouTube players ----------
  function makePlayer(el, events) {
    return new Promise((resolve, reject) => {
      const vars = { controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3 };
      if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
      const p = new window.YT.Player(el, {
        width: 200, height: 200, playerVars: vars,
        events: { ...events, onReady: () => resolve(p), onError: (e) => { events.onError?.(e); } }
      });
      setTimeout(() => reject(new Error('player timed out')), 15000);
    });
  }
  function ensurePlayers() {
    if (startPromise) return startPromise;
    startPromise = (async () => {
      try {
        await loadYouTubeApi();
        let host = document.getElementById('olu-yt');
        if (!host) {
          host = document.createElement('div');
          host.id = 'olu-yt';
          host.className = 'yt-hidden';
          host.setAttribute('aria-hidden', 'true');
          host.innerHTML = '<div id="olu-yt-music"></div><div id="olu-yt-rain"></div>';
          document.body.appendChild(host);
        }
        ytMusic = await makePlayer('olu-yt-music', { onStateChange: onMusicState, onError: onMusicError });
        ytRain = await makePlayer('olu-yt-rain', { onStateChange: onRainState, onError: onRainError });
        ytMusic.setVolume(Math.round(volMusic * 100));
        ytRain.setVolume(Math.round(volRain * 100));
      } catch (e) {
        console.error(e);
        startPromise = null;
        msg = "Couldn't reach YouTube. Check your connection and tap again.";
      }
    })();
    return startPromise;
  }

  const isPlaying = () => (kind === 'file' ? !audio.paused : kind ? ytMusicState === 1 || ytMusicState === 3 : false);
  const position = () => (kind === 'file' ? audio.currentTime : ytMusic?.getCurrentTime?.() || 0);
  const duration = () => (kind === 'file' ? audio.duration : ytMusic?.getDuration?.() || 0);

  function startPoll() { if (!pollTimer) pollTimer = setInterval(tick, 500); }
  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function tick() {
    if (!root) return;
    const d = duration();
    const p = position();
    const s = q('#seek');
    if (!s || document.activeElement === s) return;
    s.value = d ? (p / d) * 1000 : 0;
    const f = q('#fill'); if (f) f.style.width = (d ? (p / d) * 100 : 0) + '%';
    const tc = q('#tcur'); if (tc) tc.textContent = fmt(p);
    const td = q('#tdur'); if (td) td.textContent = fmt(d);
  }

  function onMusicState(e) {
    ytMusicState = e.data;
    const S = window.YT.PlayerState;
    if (e.data === S.PLAYING) { errRun = 0; startPoll(); learnTitle(); } else if (e.data !== S.BUFFERING) stopPoll();
    if (e.data === S.ENDED) { playTrack(idx + 1); return; }
    render();
    tick();
  }
  function onMusicError(e) {
    ytMusicState = -1;
    stopPoll();
    msg = ERRORS[e.data] || "Couldn't play that one, try another link.";
    errRun++;
    if (kind === 'list' && ytMusic.getPlaylist?.()?.length > 1 && errRun < 50) { try { ytMusic.nextVideo(); } catch { /* ignore */ } render(); return; }
    if (list.length > 1 && errRun < list.length) { render(); playTrack(idx + 1, true); return; }
    render();
  }
  function onRainState(e) {
    ytRainState = e.data;
    if (e.data === window.YT.PlayerState.ENDED && rainOn) { ytRain.seekTo(0, true); ytRain.playVideo(); } // loop
    render();
  }
  function onRainError(e) {
    rainOn = false;
    store.set('rainOn', false);
    msg = `Rain sound: ${ERRORS[e.data] || "couldn't be played."}`;
    render();
  }

  // ---------- playback ----------
  function stopAll() {
    try { audio.pause(); } catch { /* ignore */ }
    try { ytMusic?.stopVideo?.(); } catch { /* ignore */ }
    ytMusicState = -1;
    stopPoll();
  }

  async function playTrack(i, keepMsg) {
    if (!list.length) return;
    idx = ((i % list.length) + list.length) % list.length;
    if (!keepMsg) msg = '';
    const t = list[idx];
    stopAll();
    if (t.src) {
      kind = 'file';
      audio.src = t.src;
      audio.volume = volMusic;
      try { await audio.play(); } catch { msg = `Couldn't play "${t.title}". Check the file name in audio/playlist.json.`; }
    } else {
      await ensurePlayers();
      if (!ytMusic) { render(); return; }
      ytMusic.setVolume(Math.round(volMusic * 100));
      if (t.youtubePlaylist) { kind = 'list'; ytMusic.loadPlaylist({ list: t.youtubePlaylist, listType: 'playlist', index: 0 }); }
      else { kind = 'video'; ytMusic.loadVideoById(t.youtube); }
    }
    render();
  }

  function togglePlay() {
    if (!list.length) { msg = EMPTY_TEXT; render(); return Promise.resolve(); }
    if (!kind) return playTrack(idx);
    if (kind === 'file') { if (audio.paused) return audio.play().catch(() => { msg = "Couldn't play that file."; render(); }); audio.pause(); return Promise.resolve(); }
    if (isPlaying()) ytMusic.pauseVideo(); else ytMusic.playVideo();
    return Promise.resolve();
  }
  function next() {
    if (kind === 'list' && ytMusic.getPlaylist?.()) {
      const pl = ytMusic.getPlaylist();
      if (ytMusic.getPlaylistIndex() < pl.length - 1) return ytMusic.nextVideo();
    }
    return playTrack(idx + 1);
  }
  function prev() {
    if (kind === 'list' && ytMusic.getPlaylistIndex() > 0) return ytMusic.previousVideo();
    return playTrack(idx - 1);
  }

  audio.addEventListener('error', () => { if (audio.src && kind === 'file') { msg = `Couldn't find "${list[idx]?.title || 'that track'}". Check the file name in audio/playlist.json.`; render(); } });
  audio.addEventListener('ended', () => playTrack(idx + 1));
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('timeupdate', tick);
  rainAudio.addEventListener('error', () => { if (rainAudio.src) { rainOn = false; store.set('rainOn', false); msg = "Couldn't play the rain sound file."; render(); } });

  async function applyRain() {
    const src = rainSource();
    if (!started) return;
    if (!rainOn || !src) {
      try { rainAudio.pause(); } catch { /* ignore */ }
      try { ytRain?.pauseVideo?.(); } catch { /* ignore */ }
      render();
      return;
    }
    if (src.kind === 'file') {
      try { ytRain?.pauseVideo?.(); } catch { /* ignore */ }
      if (rainAudio.getAttribute('src') !== src.src) rainAudio.src = src.src;
      rainAudio.volume = volRain;
      try { await rainAudio.play(); } catch { rainOn = false; msg = "Couldn't play the rain sound file."; }
    } else {
      rainAudio.pause();
      await ensurePlayers();
      if (!ytRain) { rainOn = false; render(); return; }
      ytRain.setVolume(Math.round(volRain * 100));
      if (rainLoadedId === src.id) ytRain.playVideo();
      else { rainLoadedId = src.id; ytRain.loadVideoById(src.id); }
    }
    render();
  }
  async function setRain(on) {
    if (on && !rainSource()) { await focusRain(); return; }
    rainOn = on;
    store.set('rainOn', on);
    await applyRain();
    render();
  }

  async function start() {
    if (started) return;
    started = true;
    msg = '';
    render();
    await ensurePlayers();
    if (rainOn) applyRain();
    render();
  }
  async function focusRain() {
    await start();
    pendingFocus = 'rainUrl';
    render();
  }

  // ---------- add / remove ----------
  // YouTube's oembed endpoint sends no CORS headers, so browsers can't read it.
  // Instead, the real title is learned from the player the first time a track plays.
  async function oembed() { return null; }
  function learnTitle() {
    try {
      const cur = list[idx];
      const vd = ytMusic && ytMusic.getVideoData ? ytMusic.getVideoData() : null;
      if (!cur || !vd || !vd.title) return;
      if (cur.title !== 'YouTube track' && cur.title !== 'YouTube playlist') return;
      cur.title = vd.title;
      cur.artist = (vd.author || '').replace(/ - Topic$/, '');
      if (cur.mine) {
        const arr = myTracks();
        if (arr[cur.mineIdx]) { arr[cur.mineIdx].title = cur.title; arr[cur.mineIdx].artist = cur.artist; rawSet(MY_TRACKS_KEY, arr); }
      }
      render();
    } catch { /* ignore */ }
  }
  async function addSong(text) {
    const p = parseYouTube(text);
    if (!p) { msg = "That doesn't look like a YouTube or YouTube Music link."; render(); return; }
    busy = true; msg = ''; render();
    const url = p.id ? `https://www.youtube.com/watch?v=${p.id}` : `https://www.youtube.com/playlist?list=${p.list}`;
    const info = await oembed(url);
    const track = { title: info?.title || (p.id ? 'YouTube track' : 'YouTube playlist'), artist: (info?.author_name || '').replace(/ - Topic$/, '') };
    if (p.id) track.youtube = p.id; else track.youtubePlaylist = p.list;
    rawSet(MY_TRACKS_KEY, [...myTracks(), track]);
    busy = false;
    rebuildList();
    const input = q('#addUrl'); if (input) input.value = '';
    msg = p.id ? 'Added. Its title appears once it starts playing.' : 'Added the playlist.';
    render();
  }
  function removeMine(mineIdx) {
    const cur = list[idx];
    const arr = myTracks();
    const gone = arr[mineIdx];
    arr.splice(mineIdx, 1);
    rawSet(MY_TRACKS_KEY, arr);
    const wasCurrent = cur && cur.mine && cur.mineIdx === mineIdx;
    rebuildList();
    if (wasCurrent) { stopAll(); kind = null; idx = Math.min(idx, Math.max(list.length - 1, 0)); }
    else if (cur) { const n = list.findIndex((t) => t.mine === cur.mine && (t.mine ? t.youtube === cur.youtube && t.youtubePlaylist === cur.youtubePlaylist : t.src === cur.src && t.youtube === cur.youtube)); if (n >= 0) idx = n; }
    msg = gone ? `Removed "${gone.title}".` : '';
    render();
  }
  function setCustomRain(text, reset) {
    if (reset) { rawSet(MY_RAIN_KEY, null); rainLoadedId = null; msg = 'Rain sound reset.'; }
    else {
      const p = parseYouTube(text);
      if (!p?.id) { msg = p?.list ? 'For rain, paste a single video link, not a playlist.' : "That doesn't look like a YouTube link."; render(); return; }
      rawSet(MY_RAIN_KEY, { youtube: p.id });
      rainLoadedId = null;
      rainOn = true; store.set('rainOn', true);
      msg = 'Rain sound saved.';
    }
    const input = q('#rainUrl'); if (input) input.value = '';
    applyRain();
    render();
  }

  // ---------- UI ----------
  const curTitle = () => {
    const t = list[idx];
    if (!t) return '';
    if (kind === 'list') { const d = ytMusic?.getVideoData?.(); if (d?.title) return d.title; }
    return t.title;
  };
  const curArtist = () => {
    const t = list[idx];
    if (!t) return '';
    if (kind === 'list') { const d = ytMusic?.getVideoData?.(); if (d?.author) return d.author; }
    return t.artist || '';
  };

  function render() {
    emit();
    if (!root) return;
    if (!started) {
      root.innerHTML = `<div class="mp-start"><div class="mp-start-title">Tap to start the sound</div><p>Browsers wait for a tap before playing audio. Nothing plays until you say so.</p><button class="mp-start-btn" id="start">${icon('play')} Start</button></div>`;
      return;
    }
    // keep whatever is being typed across re-renders
    const keep = {};
    for (const id of ['addUrl', 'rainUrl']) { const el = q('#' + id); if (el) keep[id] = { v: el.value, f: document.activeElement === el, s: el.selectionStart }; }

    const t = list[idx];
    const d = duration();
    const p = position();
    const pct = d ? (p / d) * 100 : 0;
    const playing = isPlaying();
    const rs = rainSource();
    const empty = loaded && !list.length;
    const playSvg = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const pauseSvg = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    root.innerHTML = `<div class="mp-head"><h2>Rainy playlist</h2><span class="lab">Track ${list.length ? idx + 1 : 0} of ${list.length}</span></div>
      <div class="mp-now">
        <div class="mp-art" aria-hidden="true"><span class="mp-moon"></span><span class="mp-cloud1"></span><span class="mp-cloud2"></span></div>
        <div class="mp-meta"><div class="mp-title">${t ? esc(curTitle()) : loaded ? 'No songs yet' : 'Loading…'}</div><div class="mp-artist">${t ? esc(curArtist()) : ''}</div></div>
        ${playing ? '<span class="lab blink mp-playing">Playing</span>' : ''}
      </div>
      ${empty ? `<p class="mp-empty">${EMPTY_TEXT}</p>` : ''}
      <div class="mp-progress"><div class="mp-bar"><span class="mp-fill" id="fill" style="width:${pct}%"></span><input id="seek" type="range" min="0" max="1000" value="${d ? (p / d) * 1000 : 0}" aria-label="Seek"></div>
        <div class="lab mp-times"><span id="tcur">${fmt(p)}</span><span id="tdur">${fmt(d)}</span></div></div>
      <div class="mp-controls">
        <button class="mp-btn" id="prev" aria-label="Previous track"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M5 5h3v14H5zM20 5v14L9 12z"/></svg></button>
        <button class="mp-btn mp-play" id="play" aria-label="${playing ? 'Pause' : 'Play'}">${playing ? pauseSvg : playSvg}</button>
        <button class="mp-btn" id="next" aria-label="Next track"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16 5h3v14h-3zM4 5v14l11-7z"/></svg></button>
      </div>
      <div class="mp-list">${list.map((x, i) => `<div class="mp-rowwrap"><button class="mp-row${i === idx ? ' on' : ''}" data-track="${i}"><span class="lab">${i + 1}</span><span class="mp-row-t">${esc(x.title)}</span><span class="mp-row-a">${esc(x.artist || '')}</span></button>${x.mine ? `<button class="mp-x" data-remove="${x.mineIdx}" aria-label="Remove ${esc(x.title)}">&times;</button>` : ''}</div>`).join('')}</div>
      <div class="mp-box mp-add"><label class="lab" for="addUrl">Add a song</label>
        <div class="mp-add-row"><input id="addUrl" type="text" inputmode="url" autocomplete="off" placeholder="Paste a YouTube or YouTube Music link"><button class="mp-addbtn" id="addBtn"${busy ? ' disabled' : ''}>${busy ? 'Adding…' : 'Add'}</button></div></div>
      <div class="mp-sliders">
        <div class="mp-box mp-rain"><div class="mp-rain-top"><span>Soft rain on glass</span><button class="mp-toggle${rainOn && rs ? ' on' : ''}${rs ? '' : ' mp-toggle-add'}" id="rain" aria-pressed="${!!(rainOn && rs)}">${rs ? (rainOn ? 'On' : 'Off') : 'Add a rain sound'}</button></div>
          <label class="lab" for="vrain">Rain volume</label><input id="vrain" type="range" min="0" max="100" value="${Math.round(volRain * 100)}">
          <label class="lab" for="rainUrl">Rain sound</label>
          <div class="mp-add-row"><input id="rainUrl" type="text" inputmode="url" autocomplete="off" placeholder="Paste a YouTube link for rain"><button class="mp-addbtn" id="rainSet">Set</button>${hasCustomRain() ? '<button class="mp-addbtn mp-ghost" id="rainReset">Reset</button>' : ''}</div></div>
        <div class="mp-box"><label for="vmusic" class="mp-vl">Music volume</label><input id="vmusic" type="range" min="0" max="100" value="${Math.round(volMusic * 100)}"><div class="mp-hint">Volume is remembered on this device</div></div>
      </div>
      ${msg ? `<p class="note" role="status">${esc(msg)}</p>` : ''}
      <p class="mp-foot">Songs play through YouTube (it may show ads, and some videos block embedding). Added songs stay on this device.</p>`;

    for (const [id, k] of Object.entries(keep)) {
      const el = q('#' + id);
      if (!el) continue;
      el.value = k.v;
      if (k.f) { el.focus(); try { el.setSelectionRange(k.s, k.s); } catch { /* ignore */ } }
    }
    if (pendingFocus) { const el = q('#' + pendingFocus); pendingFocus = null; if (el) { el.focus(); el.scrollIntoView?.({ block: 'nearest' }); } }
  }

  function onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'start') start().then(() => { if (!list.length && loaded) render(); });
    else if (b.id === 'play') togglePlay();
    else if (b.dataset.remove != null) removeMine(Number(b.dataset.remove));
    else if (b.dataset.track != null) playTrack(Number(b.dataset.track));
    else if (b.id === 'prev') { if (kind || list.length) prev(); }
    else if (b.id === 'next') { if (kind || list.length) next(); }
    else if (b.id === 'rain') { if (rainSource()) setRain(!rainOn); else { pendingFocus = 'rainUrl'; render(); } }
    else if (b.id === 'addBtn') addSong(q('#addUrl')?.value);
    else if (b.id === 'rainSet') setCustomRain(q('#rainUrl')?.value);
    else if (b.id === 'rainReset') setCustomRain('', true);
  }
  function onInput(e) {
    const el = e.target;
    if (el.id === 'seek') {
      const d = duration();
      if (!d) return;
      const to = (el.value / 1000) * d;
      if (kind === 'file') audio.currentTime = to; else ytMusic?.seekTo?.(to, true);
      const f = q('#fill'); if (f) f.style.width = (el.value / 10) + '%';
    }
    if (el.id === 'vmusic') { volMusic = el.value / 100; audio.volume = volMusic; ytMusic?.setVolume?.(Math.round(volMusic * 100)); store.set('vol:music', volMusic); }
    if (el.id === 'vrain') { volRain = el.value / 100; rainAudio.volume = volRain; ytRain?.setVolume?.(Math.round(volRain * 100)); store.set('vol:rain', volRain); }
  }
  function onKey(e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'addUrl') { e.preventDefault(); addSong(e.target.value); }
    if (e.target.id === 'rainUrl') { e.preventDefault(); setCustomRain(e.target.value); }
  }

  audio.volume = volMusic;
  rainAudio.volume = volRain;
  loadList();
  return {
    state() {
      const t = list[idx];
      return { started, playing: isPlaying(), title: t ? curTitle() : '', artist: t ? curArtist() : '', index: idx, count: list.length, loaded, rainOn: !!(rainOn && rainSource()), rainSet: !!rainSource() };
    },
    onChange(cb) { subs.add(cb); return () => subs.delete(cb); },
    // The mini player calls these. A tap is always the trigger; nothing plays by itself.
    async toggle() {
      await start();
      await togglePlay();
    },
    async toggleRain() {
      if (!rainSource()) { await focusRain(); return; }
      await start();
      await setRain(!rainOn);
    },
    mount(el) {
      root = el;
      root.onclick = onClick;
      root.oninput = onInput;
      root.onkeydown = onKey;
      render();
    },
    unmount() { root = null; }
  };
}
