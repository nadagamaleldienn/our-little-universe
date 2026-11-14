// Shared constants and tiny helpers. No DOM work at import time.

export const LOCATIONS = [
  { id: 'cozy', name: 'Cozy Corner', x: 17, y: 66, blurb: 'Rain on the window, a cat on the seat, a lamp that never goes out.' },
  { id: 'library', name: 'Lantern Library', x: 36, y: 28, blurb: 'Tall shelves, paper lanterns, and a ladder that goes a little too high.' },
  { id: 'cafe', name: 'Rainy Station Café', x: 68, y: 58, blurb: 'A tiny platform café. The trains only ever arrive when you are happy.' },
  { id: 'hill', name: 'Starlight Hill', x: 62, y: 16, blurb: 'The best place to lie in the grass and count pretend constellations.' },
  { id: 'lake', name: 'Lilac Lake', x: 38, y: 78, blurb: 'Still water, lilac reeds, and a rowing boat nobody owns.' },
  { id: 'garden', name: 'Firefly Garden', x: 86, y: 80, blurb: 'Evenings last longer here, and the fireflies keep secrets.' }
];

export const ACTIVITIES = {
  desk: { label: 'at the desk', name: 'Desk' },
  reading: { label: 'reading', name: 'Reading nook' },
  gaming: { label: 'gaming', name: 'Game corner' },
  music: { label: 'listening to music', name: 'Record player' },
  window: { label: 'watching from the window', name: 'Window seat' },
  workbench: { label: 'tinkering at the workbench', name: 'Workbench' },
  plants: { label: 'tending the plants', name: 'Plant shelf' }
};

export const PLANT_TYPES = [
  { id: 'lavender', name: 'Lavender' },
  { id: 'sunflower', name: 'Sunflower' },
  { id: 'moon-cactus', name: 'Moon cactus' },
  { id: 'fern', name: 'Fern' },
  { id: 'violet-orchid', name: 'Violet orchid' },
  { id: 'lemon-tree', name: 'Lemon tree' }
];

export const POT_COLORS = [
  { id: '#F6C945', name: 'Butter' },
  { id: '#B9A6EC', name: 'Lilac' },
  { id: '#7C63C9', name: 'Violet' },
  { id: '#8C93D9', name: 'Rain blue' },
  { id: '#F4F0FD', name: 'Cloud' }
];

export const WEATHER_IDS = ['rain', 'sunrise', 'snow', 'night', 'storm'];

export function defaultSettings() {
  return {
    visibility: 'live', // live | lastSeenOnly | offline
    hideActivity: false,
    weather: 'rain',
    notify: { letters: true, xo: true, here: true, plants: true, browser: false },
    quiet: { enabled: false, start: '22:00', end: '08:00' }
  };
}

export function mergeDeep(base, patch) {
  if (patch == null) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && base[k] !== null) {
      out[k] = mergeDeep(base[k], v);
    } else out[k] = v;
  }
  return out;
}

export const ID = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const locName = (id) => LOCATIONS.find((l) => l.id === id)?.name || 'somewhere cozy';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function relTime(ts) {
  if (!ts) return 'a while ago';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

const ICONS = {
  bell: '<path d="M6 17h12l-1.5-2.2V10a4.5 4.5 0 0 0-9 0v4.8zM10 19a2 2 0 0 0 4 0"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="16" r="2.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  home: '<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z"/>',
  map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  xo: '<path d="M4 4l7 7M11 4l-7 7"/><circle cx="16.5" cy="16.5" r="4"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  prev: '<path d="M7 5v14M19 5l-9 7 9 7z"/>',
  next: '<path d="M17 5v14M5 5l9 7-9 7z"/>'
};
export function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

export function sealSvg(kind) {
  const shapes = {
    star: '<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.8l6-.7z" fill="#FFE79A"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" fill="#FFE79A"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="2" fill="#FFE79A"/><path d="M9.5 4v3M14.5 4v3M9.5 17v3M14.5 17v3M4 9.5h3M4 14.5h3M17 9.5h3M17 14.5h3" stroke="#FFE79A" stroke-width="1.6" stroke-linecap="round"/><rect x="10" y="10" width="4" height="4" rx=".8" fill="#5B43A8"/>'
  };
  return `<svg class="seal-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#5B43A8" stroke="#8E7AD6"/>${shapes[kind] || shapes.star}</svg>`;
}

let toastTimer = 0;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
}

export function confirmDialog(message, { ok = 'Yes', cancel = 'Cancel', danger = true } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'modal small';
    d.setAttribute('aria-label', 'Please confirm');
    d.innerHTML = `<form method="dialog"><p>${esc(message)}</p><div class="row end"><button value="no" class="btn ghost">${esc(cancel)}</button><button value="yes" class="btn ${danger ? 'danger' : ''}">${esc(ok)}</button></div></form>`;
    d.addEventListener('close', () => {
      resolve(d.returnValue === 'yes');
      d.remove();
    });
    document.body.appendChild(d);
    d.showModal();
  });
}
