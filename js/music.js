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
    if (s && music.duration) { s.value = (music.currentTime / music.duration) * 1000; q('#tcur').textContent = fmt(music.currentTime); q('#tdur').textContent = fmt(music.duration); }
  });
  rain.addEventListener('error', () => { rainOn = false; store.set('rainOn', false); missing('the rain sound (audio/rain.mp3)'); });

  async function setRain(on) {
    rainOn = on;
    store.set('rainOn', on);
    if (on && started) { try { await rain.play(); } catch { rainOn = false; missing('the rain sound (audio/rain.mp3)'); } } else rain.pause();
    render();
  }

  function render() {
    if (!root) return;
    if (!started) {
      root.innerHTML = `<h2>Sound</h2><p class="muted">Nothing plays until you say so.</p><button class="btn" id="start">Tap to start the sound</button>`;
      return;
    }
    const t = list[idx];
    root.innerHTML = `<h2>Sound</h2>
      <div class="np"><div class="np-title">${t ? esc(t.title) : loaded ? 'No tracks yet' : 'Loading…'}</div><div class="muted">${t ? esc(t.artist || '') : 'Add songs to audio/playlist.json'}</div></div>
      <div class="player-row">
        <button class="icon-btn" id="prev" aria-label="Previous track">${icon('prev')}</button>
        <button class="icon-btn big" id="play" aria-label="${music.paused ? 'Play' : 'Pause'}">${icon(music.paused ? 'play' : 'pause')}</button>
        <button class="icon-btn" id="next" aria-label="Next track">${icon('next')}</button>
      </div>
      <div class="seek-row"><span id="tcur" class="muted">${fmt(music.currentTime)}</span><input id="seek" type="range" min="0" max="1000" value="${music.duration ? (music.currentTime / music.duration) * 1000 : 0}" aria-label="Seek"><span id="tdur" class="muted">${fmt(music.duration)}</span></div>
      <label class="slider"><span>Music volume</span><input id="vmusic" type="range" min="0" max="100" value="${Math.round(music.volume * 100)}"></label>
      <hr>
      <div class="row"><button class="btn ${rainOn ? '' : 'ghost'}" id="rain" aria-pressed="${rainOn}">Rain ambience: ${rainOn ? 'on' : 'off'}</button></div>
      <label class="slider"><span>Rain volume</span><input id="vrain" type="range" min="0" max="100" value="${Math.round(rain.volume * 100)}"></label>
      ${msg ? `<p class="note" role="status">${esc(msg)}</p>` : ''}`;
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
    } else if (b.id === 'prev') playTrack(idx - 1);
    else if (b.id === 'next') playTrack(idx + 1);
    else if (b.id === 'rain') setRain(!rainOn);
  }
  function onInput(e) {
    const el = e.target;
    if (el.id === 'seek' && music.duration) music.currentTime = (el.value / 1000) * music.duration;
    if (el.id === 'vmusic') { music.volume = el.value / 100; store.set('vol:music', music.volume); }
    if (el.id === 'vrain') { rain.volume = el.value / 100; store.set('vol:rain', rain.volume); }
  }

  return {
    mount(el) {
      root = el;
      root.onclick = onClick;
      root.oninput = onInput;
      render();
    },
    unmount() { root = null; }
  };
}
