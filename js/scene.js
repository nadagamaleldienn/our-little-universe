// The Cozy Corner stage, ported from design/Main.dc.html.
// The room is a fixed 1440x900 stage using the board's pixel coordinates; CSS transform: scale()
// fits it to the screen (see fitStage in util.js). Static furniture markup is copied verbatim from
// the board into js/scene-art.js; this file builds the weather-dependent parts, places the
// characters (renderCharacter from characters.js) and keeps the live behaviour: your spot, the other
// person's live spot with a glide, the together pose, the offline ghost and the wave.
import { renderCharacter } from './characters.js';
import { esc, fitStage } from './util.js';
import { WX, WALL, boardKey } from './weather.js';
import * as A from './scene-art.js';

export const STAGE_W = 1440;
export const STAGE_H = 900;

// Where a character's 128x176 box sits (top-left, stage px) for each activity (the board's `pos`).
export const SPOTS = {
  idle: { x: 1110, y: 516, pose: 'stand', item: null },
  desk: { x: 396, y: 440, pose: 'sit', item: 'laptop' },
  reading: { x: 780, y: 496, pose: 'sit', item: 'book' },
  gaming: { x: 1262, y: 500, pose: 'sit', item: 'controller' },
  music: { x: 150, y: 490, pose: 'sit', item: 'headphones' },
  window: { x: 150, y: 490, pose: 'sit', item: 'mug' },
  workbench: { x: 1250, y: 440, pose: 'sit', item: 'soldering' },
  plants: { x: 626, y: 236, pose: 'stand', item: 'watering' }
};
export const itemFor = (activity) => (SPOTS[activity] || SPOTS.idle).item || 'none';

const rg = (cx, cy, r, rgb, a) => `<div style="position:absolute;left:${cx - r}px;top:${cy - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:radial-gradient(circle,rgba(${rgb},${Math.min(a, 0.6).toFixed(3)}) 0%,rgba(${rgb},0) 70%)"></div>`;

// Weather-independent generators, built once.
const yf = (x) => 22 + 14 * Math.abs(Math.sin((x * Math.PI) / 180));
const FAIRY = (() => {
  let path = 'M0 ' + yf(0).toFixed(1);
  for (let x = 12; x <= 1440; x += 12) path += ` L${x} ${yf(x).toFixed(1)}`;
  let bulbs = '';
  for (let i = 0; i < 22; i++) {
    const x = 36 + i * 66;
    bulbs += `<div class="bulb" style="left:${x - 5}px;top:${(yf(x) + 2).toFixed(1)}px;animation-delay:-${((i * 0.4) % 3).toFixed(1)}s"></div>`;
  }
  return `<svg width="1440" height="60" viewBox="0 0 1440 60" aria-hidden="true" style="position:absolute;left:0;top:0"><path d="${path}" style="fill:none;stroke:#6B54B8;stroke-width:2;stroke-linecap:round"></path></svg>${bulbs}`;
})();

const BOOK_COLS = ['#F6C945', '#B9A6EC', '#7C63C9', '#FFE79A', '#E9A23B', '#DCD2F7', '#6B54B8', '#8C93D9'];
const LIBRARY = (() => {
  let shelves = '';
  for (let s = 0; s < 4; s++) {
    let books = '';
    for (let b = 0; b < 8; b++) {
      const k = s * 8 + b;
      const w = 12 + ((k * 5) % 10);
      const h = 64 + ((k * 11) % 40);
      books += `<div style="flex:none;box-sizing:border-box;border-radius:4px 4px 1px 1px;width:${w}px;height:${h}px;background:linear-gradient(90deg,rgba(255,255,255,.24),rgba(255,255,255,0) 40%,rgba(14,9,30,.18)),${BOOK_COLS[(k * 3) % 8]};box-shadow:0 2px 4px rgba(14,9,30,.3)"></div>`;
    }
    shelves += `<div style="height:122px;flex:none;display:flex;align-items:flex-end;gap:3px;border-bottom:8px solid #5B43A8;border-radius:0 0 4px 4px;padding:0 4px">${books}</div>`;
  }
  return `<div style="position:absolute;left:1030px;top:110px;width:196px;height:588px;box-sizing:border-box;padding:14px;border-radius:20px;background:linear-gradient(180deg,#4B3A86,#3D2C74);box-shadow:0 8px 24px rgba(14,9,30,.35),inset 0 2px 0 rgba(255,255,255,.14);display:flex;flex-direction:column;gap:14px">${shelves}</div>`;
})();
const DRAWERS = (() => {
  let out = '<div style="position:absolute;left:1244px;top:112px;width:186px;height:96px;border-radius:14px;background:linear-gradient(180deg,#4B3A86,#3D2C74);box-shadow:0 8px 24px rgba(14,9,30,.35),inset 0 2px 0 rgba(255,255,255,.14)">';
  for (let i = 0; i < 12; i++) {
    const c = i % 4;
    const r = Math.floor(i / 4);
    out += `<div style="position:absolute;left:${8 + c * 44}px;top:${8 + r * 28}px;width:40px;height:24px;border-radius:6px;background:linear-gradient(180deg,#7C63C9,#5B43A8);box-shadow:inset 0 2px 0 rgba(255,255,255,.22),0 2px 4px rgba(14,9,30,.35)"><span style="position:absolute;left:13px;top:13px;width:14px;height:4px;border-radius:2px;background:#F6C945;box-shadow:0 0 6px rgba(246,201,69,.5)"></span></div>`;
  }
  return out + '</div>';
})();
const HEART_COLS = ['#FFE79A', '#B9A6EC', '#F6C945', '#DCD2F7'];
const HEARTS = [[198, 492], [240, 500], [170, 506], [270, 490]].map((h, i) => `<svg class="fl" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="left:${h[0]}px;top:${h[1]}px;animation-delay:-${i}s"><path d="M12 21C5 15 2 11 2 7a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 4-3 8-10 14z" style="fill:${HEART_COLS[i]}"></path></svg>`).join('');

function windowHtml(k, wp) {
  const cloud = (l, t, w, h, r) => `<div style="position:absolute;left:${l}px;top:${t}px;width:${w}px;height:${h}px;border-radius:${r};background:${wp.cloud};opacity:.8;filter:blur(1px)"></div>`;
  let inner = '';
  if (k === 'rain') {
    inner += '<div style="position:absolute;left:370px;top:36px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(220,210,247,.28),rgba(220,210,247,0) 68%)"></div><div style="position:absolute;left:408px;top:56px;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle at 38% 34%,#F4F0FD,#CFC5F0);box-shadow:0 0 30px 8px rgba(220,210,247,.35)"></div>';
  }
  if (k === 'rain' || k === 'storm' || k === 'snow') {
    inner += cloud(20, 56, 150, 30, '15px') + cloud(46, 38, 56, 56, '50%') + cloud(96, 46, 46, 46, '50%') + cloud(270, 112, 190, 30, '15px') + cloud(300, 92, 60, 60, '50%') + cloud(350, 100, 50, 50, '50%');
  }
  if (k === 'sunrise') {
    inner += '<div class="sun" style="left:330px;top:190px"></div>';
    for (let i = 0; i < 4; i++) {
      const top = [40, 80, 60, 110][i];
      const delay = [0, 3, 6, 9][i];
      inner += `<svg class="bird" width="24" height="12" viewBox="0 0 24 12" aria-hidden="true" style="left:${40 + i * 110}px;top:${top}px;animation-duration:${13 + i}s;animation-delay:-${delay}s"><path d="M2 9 Q7 0 12 8 Q17 0 22 9" style="fill:none;stroke:#4B3A86;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"></path></svg>`;
    }
  }
  if (k === 'starry') {
    for (let i = 0; i < 18; i++) {
      const z = i % 4 === 0 ? 5 : 3;
      inner += `<div class="star" style="left:${(i * 53 + 7) % 90}%;top:${(i * 37) % 180}px;width:${z}px;height:${z}px;background:${i % 2 ? '#FFE79A' : '#DCD2F7'};animation-delay:-${((i * 0.3) % 3).toFixed(1)}s"></div>`;
    }
    inner += '<div style="position:absolute;left:390px;top:40px;width:50px;height:50px;border-radius:50%;box-shadow:inset -13px 5px 0 0 #FFF2B8;filter:drop-shadow(0 0 10px rgba(255,231,154,.6))"></div>';
  }
  if (k === 'snow') {
    for (let i = 0; i < 26; i++) {
      const z = i % 3 ? 5 : 8;
      inner += `<div class="flake" style="left:${(i * 37) % 97}%;width:${z}px;height:${z}px;animation-duration:${8 + ((i * 3) % 6)}s;animation-delay:-${((i * 0.9) % 8).toFixed(1)}s"></div>`;
    }
  }
  // skyline
  const bset = [[0, 70, 90], [66, 52, 130], [114, 78, 70], [188, 58, 150], [242, 92, 100], [330, 60, 120], [386, 106, 80]];
  bset.forEach((b) => { inner += `<div style="position:absolute;bottom:0;left:${b[0]}px;width:${b[1]}px;height:${b[2]}px;border-radius:10px 10px 0 0;background:${wp.bld};box-shadow:inset 0 2px 0 rgba(255,255,255,.08)"></div>`; });
  const lt = (s) => `<div style="position:absolute;width:7px;height:9px;border-radius:2px;background:#F6C945;box-shadow:0 0 8px rgba(246,201,69,.8);${s}"></div>`;
  bset.forEach((b, i) => {
    inner += lt(`left:${b[0] + 14}px;bottom:${b[2] - 26}px`);
    if (i % 2 === 0) inner += lt(`left:${b[0] + b[1] - 24}px;bottom:${b[2] - 52}px`);
    if (i % 3 === 1) inner += lt(`left:${b[0] + 24}px;bottom:${Math.max(16, b[2] - 82)}px`);
  });
  if (k === 'starry') {
    for (let i = 0; i < 7; i++) inner += `<div class="ff" style="left:${(i * 61 + 5) % 92}%;top:${250 + ((i * 29) % 110)}px;animation-duration:${5 + (i % 3)}s;animation-delay:-${(i * 0.7).toFixed(1)}s"></div>`;
  }
  if (k === 'rain' || k === 'storm') {
    for (let i = 0; i < 46; i++) {
      const x = (i * 37) % 100;
      const d = (0.9 + ((i * 7) % 10) / 10).toFixed(2);
      const t = ((i * 0.37) % 2).toFixed(2);
      inner += `<div class="drop" style="left:${x}%;animation-duration:${d}s;animation-delay:-${t}s"></div>`;
    }
  }
  inner += '<div style="position:absolute;left:0;top:0;width:492px;height:392px;background:linear-gradient(115deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,0) 34%,rgba(255,255,255,0) 62%,rgba(255,255,255,.06) 100%)"></div>';
  inner += `<div style="position:absolute;left:237px;top:0;width:18px;height:392px;background:${wp.frame};box-shadow:inset 3px 0 0 rgba(255,255,255,.14),inset -3px 0 0 rgba(14,9,30,.2)"></div>`;
  inner += `<div style="position:absolute;left:0;top:186px;width:492px;height:14px;border-radius:7px;background:${wp.frame};box-shadow:inset 0 3px 0 rgba(255,255,255,.14),inset 0 -3px 0 rgba(14,9,30,.2)"></div>`;
  if (k === 'snow') {
    [['left:0;top:0', 'circle at 0 0'], ['left:352px;top:0', 'circle at 100% 0'], ['left:0;top:252px', 'circle at 0 100%'], ['left:352px;top:252px', 'circle at 100% 100%']].forEach(([pos, g]) => {
      inner += `<div style="position:absolute;width:140px;height:140px;${pos};background:radial-gradient(${g},rgba(244,240,253,.6) 0%,rgba(244,240,253,.2) 40%,rgba(244,240,253,0) 70%)"></div>`;
    });
  }
  if (k === 'storm') inner += '<div class="bolt"></div>';
  return `<div class="sh" style="position:absolute;left:110px;top:100px;width:520px;height:420px;border-radius:30px;background:${wp.frame};box-shadow:0 8px 24px rgba(14,9,30,.35),inset 0 2px 0 rgba(255,255,255,.14)"></div>
  <div style="position:absolute;left:124px;top:114px;width:492px;height:392px;border-radius:18px;overflow:hidden;background:${wp.sky}">${inner}</div>`;
}

function artHtml(k, together, mail) {
  const wp = WX[k];
  const w = WALL[k];
  const gk = wp.gk;
  const wallpaper = `repeating-linear-gradient(90deg,rgba(${w[0]},${w[1]}) 0 22px,rgba(0,0,0,0) 22px 44px),radial-gradient(circle,rgba(${w[2]},${w[3]}) 0 1.6px,rgba(0,0,0,0) 2.4px) 0 0/88px 88px,radial-gradient(circle,rgba(185,166,236,.12) 0 3px,rgba(0,0,0,0) 3.6px) 44px 44px/88px 88px`;
  const mailSvg = A.MAILBOX_SVG.replace('{{flagS}}', mail ? 'transform:rotate(0deg)' : 'transform:rotate(80deg);transform-origin:60px 50px');
  const cat = `<div style="position:absolute;${together ? 'left:216px;top:552px;z-index:9' : 'left:392px;top:684px;z-index:4'};width:110px;height:76px">
    <div class="cat">${A.CAT_INNER}</div>
    <span class="zz" style="left:60px;top:0px;animation-delay:0s">z</span><span class="zz" style="left:72px;top:-10px;font-size:18px;animation-delay:-1.5s">z</span><span class="zz" style="left:86px;top:-22px;font-size:12px;animation-delay:-3s">z</span></div>`;
  return `
  <div style="position:absolute;left:0;top:0;width:1440px;height:700px;background:radial-gradient(ellipse at 45% 75%,${wp.halo} 0%,rgba(0,0,0,0) 62%)"></div>
  <div style="position:absolute;left:0;top:0;width:1440px;height:690px;background:${wallpaper}"></div>
  <div style="position:absolute;left:0;top:604px;width:1440px;height:88px;background:${w[4]}"></div>
  ${A.WAIN_STRIPES}
  <div style="position:absolute;left:0;top:598px;width:1440px;height:8px;border-radius:4px;background:${w[5]};box-shadow:0 3px 8px rgba(14,9,30,.3),inset 0 1px 0 rgba(255,255,255,.25)"></div>
  ${FAIRY}
  <div style="position:absolute;left:0;top:696px;width:1440px;height:204px;background:${wp.floor}"></div>
  ${A.FLOOR_TRIM}
  <div style="position:absolute;left:140px;top:706px;width:420px;height:150px;border-radius:30px;transform:skewX(-35deg);background:linear-gradient(90deg,${wp.spill},rgba(0,0,0,0))"></div>
  <div style="position:absolute;left:330px;top:690px;width:380px;height:130px;border-radius:50%;background:radial-gradient(ellipse,rgba(246,201,69,${Math.min(0.24 * gk, 0.5).toFixed(3)}),rgba(246,201,69,0) 70%)"></div>
  <div style="position:absolute;left:660px;top:700px;width:360px;height:130px;border-radius:50%;background:radial-gradient(ellipse,rgba(246,201,69,${Math.min(0.2 * gk, 0.45).toFixed(3)}),rgba(246,201,69,0) 70%)"></div>
  ${A.RUG}
  ${windowHtml(k, wp)}
  ${A.SILL}
  ${A.SEAT}
  ${together ? '' : A.CUSHION}
  ${A.NOTE}
  ${rg(620, 540, 150, '246,201,69', 0.26 * gk)}${rg(709, 372, 170, '246,201,69', 0.26 * gk)}${rg(1334, 490, 130, '185,166,236', 0.2)}${rg(1330, 350, 120, '246,201,69', 0.12 * gk)}
  ${A.DESK}
  ${A.NOOK}
  ${LIBRARY}
  ${DRAWERS}
  ${A.BENCH_REST}
  ${A.GAME}
  ${A.PLANTS}
  ${A.FLOOR_CUSHION}
  ${cat}
  ${together ? A.BLANKET + HEARTS : ''}
  <div role="img" aria-label="Letters mailbox${mail ? ', a sealed letter is waiting' : ''}" style="position:absolute;left:14px;top:404px;width:80px;height:118px;z-index:3">${mailSvg}<span style="position:absolute;left:2px;top:100px;font:700 10px 'Nunito',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B9A6EC">Letters</span></div>`;
}

export function createScene(host) {
  host.innerHTML = `<div class="stage-box"><div class="stage" role="group" aria-label="Cozy Corner, a room with a window seat, desk, reading nook, game corner and workbench">
    <div class="stage-art"></div><div class="stage-chars"></div><div class="stage-grain" aria-hidden="true"></div></div></div>`;
  const box = host.querySelector('.stage-box');
  const stage = host.querySelector('.stage');
  const artEl = host.querySelector('.stage-art');
  const charsEl = host.querySelector('.stage-chars');
  const fit = fitStage(box, stage, STAGE_W, STAGE_H, { fitHeight: true });
  const els = {};
  const sigs = {};
  let artKey = '';

  function place(key, spec) {
    let el = els[key];
    if (!el) {
      el = els[key] = document.createElement('div');
      el.className = `char ${key}`;
      el.hidden = true;
      charsEl.appendChild(el);
    }
    if (!spec) { el.hidden = true; return; }
    const spot = SPOTS[spec.spot] || SPOTS.idle;
    const isPair = spec.who === 'together';
    const sig = [spec.who, spot.pose, spot.item, spec.label].join('|');
    if (sigs[key] !== sig) {
      sigs[key] = sig;
      const svg = isPair
        ? renderCharacter({ who: 'together', pose: 'curl', item: 'none', scale: 0.8 })
        : renderCharacter({ who: spec.who, pose: spot.pose, item: spot.item || 'none', scale: 0.8 });
      el.innerHTML = `${svg}${spec.label ? `<span class="here-tag">${esc(spec.label)}</span>` : ''}<span class="heart" aria-hidden="true">♥</span>`;
    }
    const x = isPair ? 104 : spot.x + (spec.dx || 0);
    const y = isPair ? 470 : spot.y;
    const wasHidden = el.hidden;
    el.style.width = isPair ? '224px' : '128px';
    el.style.zIndex = isPair ? '7' : '5';
    if (wasHidden) el.style.transition = 'none';
    el.style.transform = `translate(${x}px,${y}px)`;
    el.classList.toggle('faded', !!spec.faded);
    el.hidden = false;
    if (wasHidden) { void el.offsetWidth; el.style.transition = ''; }
  }

  return {
    stage,
    box,
    fit,
    // p: { wx, mail, me: {who, spot}|null, other: {who, spot, name, faded, tag}|null }
    update(p) {
      const wxKey = boardKey(p.wx);
      const sameSpot = !!(p.me && p.other && p.me.spot === p.other.spot);
      const together = !!(sameSpot && !p.other.faded && p.me.spot === 'window');
      const mail = p.mail !== false;
      const key = `${wxKey}|${together ? 't' : ''}|${mail ? 'm' : ''}`;
      if (key !== artKey) {
        artKey = key;
        artEl.innerHTML = artHtml(wxKey, together, mail);
        stage.style.background = WX[wxKey].wall;
      }
      place('me', together ? null : p.me);
      // The other person: when you share a spot (and are not curled up together) they stand beside you.
      const other = p.other && !together
        ? { ...p.other, dx: sameSpot ? 104 : 0, label: p.other.faded ? `${p.other.name} · ${p.other.tag}` : `${p.other.name} is here too` }
        : null;
      place('other', other);
      place('together', together ? { who: 'together', spot: 'window', label: '' } : null);
      return { together };
    },
    // A small wave with a heart pop. who: 'me' | 'other'
    wave(who) {
      const el = !els.together?.hidden ? els.together : els[who];
      if (!el || el.hidden) return;
      el.classList.remove('waving');
      void el.offsetWidth;
      el.classList.add('waving');
      setTimeout(() => el.classList.remove('waving'), 1800);
    },
    destroy() { fit.destroy(); host.innerHTML = ''; }
  };
}
