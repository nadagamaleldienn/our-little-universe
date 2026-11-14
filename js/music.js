// Music player + rain ambience. Nothing autoplays: the first thing you see is a
// "Tap to start the sound" button. Volumes are remembered in localStorage.
import { esc, icon } from './util.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem('olu:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('olu:' + k, JSON.stringify(v)); } catch { /* ignore */ } }
};
const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

export function createMusic() {
  const music = new Audio();
  music.preload = 'none';
  const rain = new Audio('audio/rain.mp3');
  rain.loop = true;
  rain.preload = 'none';
  let list = [];
  let idx = 0;
  let started = false;
  let rainOn = store.get('rainOn', false);
  let msg = '';
  let root = null;
  let loaded = false;
  music.volume = store.get('vol:music', 0.6);
  rain.volume = store.get('vol:rain', 0.4);

  const subs = new Set();
  const emit = () => subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  const q = (s) => root?.querySelector(s);

  async function loadList() {
    try {
      const r = await fetch('audio/playlist.json', { cache: 'no-cache' });
      list = await r.json();
      if (!Array.isArray(list)) list = [];
    } catch { list = []; }
    loaded = true;
    render();
  }

  const missing = (what) => {
    msg = `Couldn't find ${what} yet. Drop the file into the audio folder (see the README), and it will appear here.`;
    render();
  };

  async function playTrack(i) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    msg = '';
    music.src = list[idx].src;
    try { await music.play(); } catch { missing(`"${list[idx].title}"`); }
    render();
  }

  music.addEventListener('error', () => { if (music.src) missing(`"${list[idx]?.title || 'that track'}"`); });
  music.addEventListener('ended', () => playTrack(idx + 1));
  music.addEventListener('play', render);
  music.addEventListener('pause', render);
  music.addEventListener('timeupdate', () => {
    const s = q('#seek');
    if (s && music.duration) { s.value = (music.currentTime / music.duration) * 1000; q('#tcur').textContent = fmt(music.currentTime); const f = q('#fill'); if (f) f.style.width = (music.currentTime / music.duration) * 100 + '%'; q('#tdur').textContent = fmt(music.duration); }
  });
  rain.addEventListener('error', () => { rainOn = false; store.set('rainOn', false); missing('the rain sound (audio/rain.mp3)'); });

  async function setRain(on) {
    rainOn = on;
    store.set('rainOn', on);
    if (on && started) { try { await rain.play(); } catch { rainOn = false; missing('the rain sound (audio/rain.mp3)'); } } else rain.pause();
    render();
  }

  function render() {
    emit();
    if (!root) return;
    if (!started) {
      root.innerHTML = `<div class="mp-start"><div class="mp-start-title">Tap to start the sound</div><p>Browsers wait for a tap before playing audio. Nothing plays until you say so.</p><button class="mp-start-btn" id="start">${icon('play')} Start</button></div>`;
      return;
    }
    const t = list[idx];
    const pct = music.duration ? (music.currentTime / music.duration) * 100 : 0;
    const playing = !music.paused;
    root.innerHTML = `<div class="mp-head"><h2>Rainy playlist</h2><span class="lab">Track ${list.length ? idx + 1 : 0} of ${list.length}</span></div>
      <div class="mp-now">
        <div class="mp-art" aria-hidden="true"><span class="mp-moon"></span><span class="mp-cloud1"></span><span class="mp-cloud2"></span></div>
        <div class="mp-meta"><div class="mp-title">${t ? esc(t.title) : loaded ? 'No tracks yet' : 'Loading…'}</div><div class="mp-artist">${t ? esc(t.artist || '') : 'Add songs to audio/playlist.json'}</div></div>
        ${playing ? '<span class="lab blink mp-playing">Playing</span>' : ''}
      </div>
      <div class="mp-progress"><div class="mp-bar"><span class="mp-fill" id="fill" style="width:${pct}%"></span><input id="seek" type="range" min="0" max="1000" value="${music.duration ? (music.currentTime / music.duration) * 1000 : 0}" aria-label="Seek"></div>
        <div class="lab mp-times"><span id="tcur">${fmt(music.currentTime)}</span><span id="tdur">${fmt(music.duration)}</span></div></div>
      <div class="mp-controls">
        <button class="mp-btn" id="prev" aria-label="Previous track"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M5 5h3v14H5zM20 5v14L9 12z"/></svg></button>
        <button class="mp-btn mp-play" id="play" aria-label="${playing ? 'Pause' : 'Play'}">${playing ? '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' : '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}</button>
        <button class="mp-btn" id="next" aria-label="Next track"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16 5h3v14h-3zM4 5v14l11-7z"/></svg></button>
      </div>
      <div class="mp-list">${list.map((x, i) => `<button class="mp-row${i === idx ? ' on' : ''}" data-track="${i}"><span class="lab">${i + 1}</span><span class="mp-row-t">${esc(x.title)}</span><span class="mp-row-a">${esc(x.artist || '')}</span></button>`).join('')}</div>
      <div class="mp-sliders">
        <div class="mp-box mp-rain"><div class="mp-rain-top"><span>Soft rain on glass</span><button class="mp-toggle${rainOn ? ' on' : ''}" id="rain" aria-pressed="${rainOn}">${rainOn ? 'On' : 'Off'}</button></div>
          <label class="lab" for="vrain">Rain volume</label><input id="vrain" type="range" min="0" max="100" value="${Math.round(rain.volume * 100)}"></div>
        <div class="mp-box"><label for="vmusic" class="mp-vl">Music volume</label><input id="vmusic" type="range" min="0" max="100" value="${Math.round(music.volume * 100)}"><div class="mp-hint">Volume is remembered on this device</div></div>
      </div>
      ${msg ? `<p class="note" role="status">${esc(msg)}</p>` : ''}
      <p class="mp-foot">Tracks come from playlist.json: add a file, add a line, no redesign.</p>`;
  }

  function onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'start') {
      started = true;
      if (rainOn) setRain(true);
      render();
      if (!loaded) loadList();
    } else if (b.id === 'play') {
      if (!list.length) { msg = 'The playlist is empty. See the README to add tracks.'; render(); return; }
      if (!music.src) playTrack(idx);
      else if (music.paused) music.play().catch(() => missing(`"${list[idx]?.title}"`));
      else music.pause();
    } else if (b.dataset.track != null) playTrack(Number(b.dataset.track));
    else if (b.id === 'prev') playTrack(idx - 1);
    else if (b.id === 'next') playTrack(idx + 1);
    else if (b.id === 'rain') setRain(!rainOn);
  }
  function onInput(e) {
    const el = e.target;
    if (el.id === 'seek' && music.duration) music.currentTime = (el.value / 1000) * music.duration;
    if (el.id === 'vmusic') { music.volume = el.value / 100; store.set('vol:music', music.volume); }
    if (el.id === 'vrain') { rain.volume = el.value / 100; store.set('vol:rain', rain.volume); }
  }

  // Used by the mini player on the Cozy Corner. Nothing here plays by itself: a tap is always the trigger.
  async function start() {
    if (started) return;
    started = true;
    if (rainOn) setRain(true);
    render();
  }
  loadList();
  return {
    state() { const t = list[idx]; return { started, playing: !music.paused, title: t?.title || '', artist: t?.artist || '', index: idx, count: list.length, loaded, rainOn }; },
    onChange(cb) { subs.add(cb); return () => subs.delete(cb); },
    async toggle() {
      await start();
      if (!list.length) { msg = 'The playlist is empty. See the README to add tracks.'; render(); return; }
      if (!music.src) await playTrack(idx);
      else if (music.paused) { try { await music.play(); } catch { missing(`"${list[idx]?.title}"`); } } else music.pause();
      render();
    },
    async toggleRain() { await start(); await setRain(!rainOn); },
    mount(el) {
      root = el;
      root.onclick = onClick;
      root.oninput = onInput;
      render();
    },
    unmount() { root = null; }
  };
}
