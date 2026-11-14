// Weather modes. The room recolours through CSS custom properties keyed on
// :root[data-weather="..."] (see css/styles.css); the window sky art is also CSS-driven.
// This module owns the data-weather attribute and the particle overlay canvas.

export const WEATHERS = {
  rain: { label: 'Rain', glyph: '🌧' },
  sunrise: { label: 'Sunrise', glyph: '🌅' },
  snow: { label: 'Snow', glyph: '❄' },
  night: { label: 'Starry night', glyph: '✨' },
  storm: { label: 'Storm', glyph: '⛈' }
};

export function applyWeatherTheme(name) {
  document.documentElement.dataset.weather = WEATHERS[name] ? name : 'rain';
}

export function createWeather(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'fx';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let mode = 'rain';
  let parts = [];
  let raf = 0;
  let flashTimer = 0;
  let w = 0;
  let h = 0;

  function resize() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce.matches) draw();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(host);

  const rnd = (a, b) => a + Math.random() * (b - a);
  function seed() {
    const n = { rain: 90, storm: 170, snow: 80, night: 36, sunrise: 28 }[mode] || 50;
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      v: mode === 'storm' ? rnd(14, 22) : mode === 'rain' ? rnd(9, 15) : rnd(0.4, 1.4),
      r: rnd(1, 3), p: Math.random() * 6.28
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    if (mode === 'rain' || mode === 'storm') {
      ctx.strokeStyle = mode === 'storm' ? 'rgba(140,147,217,.55)' : 'rgba(140,147,217,.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const p of parts) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.v * 0.25, p.y + p.v * 1.6);
      }
      ctx.stroke();
    } else if (mode === 'snow') {
      ctx.fillStyle = 'rgba(244,240,253,.85)';
      for (const p of parts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
      }
    } else {
      // night = fireflies / twinkles, sunrise = golden dust motes
      const tw = Date.now() / 700;
      for (const p of parts) {
        const a = 0.25 + 0.5 * Math.abs(Math.sin(tw + p.p));
        ctx.fillStyle = mode === 'night' ? `rgba(255,231,154,${a})` : `rgba(255,231,154,${a * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (mode === 'night' ? 1 : 1.4), 0, 6.283);
        ctx.fill();
      }
    }
  }

  function step() {
    for (const p of parts) {
      if (mode === 'rain' || mode === 'storm') {
        p.y += p.v;
        p.x -= p.v * 0.25;
        if (p.y > h) { p.y = -10; p.x = Math.random() * (w + 40); }
      } else if (mode === 'snow') {
        p.y += p.v;
        p.x += Math.sin(p.p + p.y / 40) * 0.5;
        if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
      } else {
        p.y -= p.v * 0.3;
        p.x += Math.sin(p.p + p.y / 50) * 0.3;
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      }
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  function lightning() {
    clearTimeout(flashTimer);
    if (mode !== 'storm' || reduce.matches) return;
    flashTimer = setTimeout(() => {
      host.classList.add('flash');
      setTimeout(() => host.classList.remove('flash'), 160);
      lightning();
    }, rnd(4500, 10000));
  }

  return {
    set(name) {
      if (!WEATHERS[name]) name = 'rain';
      applyWeatherTheme(name);
      if (mode === name && parts.length) return;
      mode = name;
      resize();
      seed();
      cancelAnimationFrame(raf);
      raf = 0;
      if (reduce.matches) draw();
      else raf = requestAnimationFrame(step);
      lightning();
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(flashTimer);
      ro?.disconnect();
      canvas.remove();
    }
  };
}
