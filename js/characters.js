// All character drawing lives here (the final storybook design, ported from design/Characters.dc.html).
// Contract: renderCharacter({ who: 'her'|'him'|'together', pose: 'stand'|'sit'|'curl', item, scale }) -> SVG string.
// item: none | book | laptop | controller | headphones | mug | watering | soldering (old names iron/can still work).
// The <svg> has a viewBox and scales to its container; gradients get a unique id prefix per call.
// Blink / breathing / wisp animations are the .dc-* classes defined in css/styles.css.

export const POSES = ['stand', 'sit', 'curl'];
export const ITEMS = ['none', 'book', 'laptop', 'controller', 'headphones', 'mug', 'watering', 'soldering'];
const ALIAS = { iron: 'soldering', can: 'watering' };
let counter = 0;

export function renderCharacter(props = {}) {
  const pr = { ...props, item: ALIAS[props.item] || props.item };
  const gid = 'k' + (++counter).toString(36) + Math.random().toString(36).slice(2, 5);
    const url = n => 'url(#' + gid + n + ')';
    const pick = (v, list, d) => (list.indexOf(v) >= 0 ? v : d);
    const who = pick(pr.who, ['her', 'him', 'together'], 'her');
    const pose = pick(pr.pose, ['stand', 'sit', 'curl'], 'sit');
    const item = pick(pr.item, ['none', 'book', 'laptop', 'controller', 'headphones', 'mug', 'watering', 'soldering'], 'none');
    let scale = parseFloat(pr.scale);
    if (!(scale > 0)) scale = 1;
    const vw = who === 'together' ? 280 : 160, vh = 220;

    /* ---------- tiny geometry helpers ---------- */
    const r1 = v => Math.round(v * 10) / 10;
    const E = (cx, cy, rx, ry) => 'M' + r1(cx - rx) + ' ' + r1(cy) + 'A' + r1(rx) + ' ' + r1(ry) + ' 0 1 0 ' + r1(cx + rx) + ' ' + r1(cy) + 'A' + r1(rx) + ' ' + r1(ry) + ' 0 1 0 ' + r1(cx - rx) + ' ' + r1(cy) + 'Z';
    const RR = (x, y, w, h, r) => 'M' + r1(x + r) + ' ' + r1(y) + 'H' + r1(x + w - r) + 'Q' + r1(x + w) + ' ' + r1(y) + ' ' + r1(x + w) + ' ' + r1(y + r) + 'V' + r1(y + h - r) + 'Q' + r1(x + w) + ' ' + r1(y + h) + ' ' + r1(x + w - r) + ' ' + r1(y + h) + 'H' + r1(x + r) + 'Q' + r1(x) + ' ' + r1(y + h) + ' ' + r1(x) + ' ' + r1(y + h - r) + 'V' + r1(y + r) + 'Q' + r1(x) + ' ' + r1(y) + ' ' + r1(x + r) + ' ' + r1(y) + 'Z';
    const ST = (c, w, o) => 'fill:none;stroke:' + c + ';stroke-width:' + w + ';stroke-linecap:round;stroke-linejoin:round' + (o != null ? ';opacity:' + o : '');
    const OP = o => 'opacity:' + o;
    const T = (x, y, a) => 'translate(' + r1(x) + ' ' + r1(y) + ')' + (a ? ' rotate(' + r1(a) + ')' : '');
    const J = (a, b) => (a ? a + ' ' + b : b);
    const sh = (L, d, f, s, t) => { L.push({ d: d, f: f || 'none', s: s || 'opacity:1', t: t || '' }); };
    const rot = (x, y, a) => { const q = a * Math.PI / 180, c = Math.cos(q), s = Math.sin(q); return [x * c - y * s, x * s + y * c]; };
    const pt = a => r1(a[0]) + ' ' + r1(a[1]);
    const norm = d => { const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
    const qp = (S, C, W, u) => [(1 - u) * (1 - u) * S[0] + 2 * (1 - u) * u * C[0] + u * u * W[0], (1 - u) * (1 - u) * S[1] + 2 * (1 - u) * u * C[1] + u * u * W[1]];

    /* ---------- palettes ---------- */
    const PAL = {
      her: { skin: url('skH'), skinS: '#B07650', skinD: '#8E5636', blush: url('blH'),
        hair: url('hrH'), hairM: '#6B3F24', hairD: '#45271A', hairL: '#A86F47',
        hood: url('hdH'), hoodM: '#B9A6EC', hoodS: '#8E7AD6', hoodD: '#7C63C9', hoodL: '#E6DEFB', rim: '#C9BAF2',
        str: '#F6C945', strT: '#E9A23B', pants: url('pnH'), pantsM: '#5B43A8', pantsS: '#3D2C74',
        shoe: '#F4F0FD', shoeS: '#B9A6EC', shoeA: '#F6C945', sock: '#FFE79A', sockS: '#E9A23B',
        iris: url('irH'), lash: '#2A1610', mouth: '#8A3A2E', glint: '#FFE79A',
        acc: '#F6C945', accS: '#E9A23B', accL: '#FFE79A',
        phB: '#3D2C74', phC: '#5B43A8', phK: '#FFE79A' },
      him: { skin: url('skM'), skinS: '#E0B396', skinD: '#C48E70', blush: url('blM'),
        hair: url('hrM'), hairM: '#5A3A22', hairD: '#33200F', hairL: '#8C6541',
        hood: url('hdM'), hoodM: '#F6C945', hoodS: '#E9A23B', hoodD: '#C98328', hoodL: '#FFF0B8', rim: '#FFDA6A',
        str: '#7C63C9', strT: '#5B43A8', pants: url('pnM'), pantsM: '#4A3A8C', pantsS: '#2B1F52',
        shoe: '#F4F0FD', shoeS: '#DCD2F7', shoeA: '#7C63C9', sock: '#DCD2F7', sockS: '#8E7AD6',
        iris: url('irM'), lash: '#22130B', mouth: '#8E4634', glint: '#C9966C',
        acc: '#8E7AD6', accS: '#5B43A8', accL: '#DCD2F7',
        phB: '#2B1F52', phC: '#7C63C9', phK: '#F4F0FD' }
    };

    /* ---------- head (local origin = face centre) ---------- */
    const HAIR_FRONT = {
      her: 'M-33 24C-37 4 -37 -16 -29 -29C-21 -41 -7 -45 4 -44C21 -43 35 -33 37 -16C38 -2 37 12 33 24C30 18 28 8 27 -2C25 -8 21 -12 16 -11C12 -15 8 -17 4 -13.5C0 -18 -6 -18.5 -10 -12.5C-14 -16.5 -20 -15 -23 -9C-26 -3 -27 8 -29 22Z',
      him: 'M-34 6C-37 -14 -31 -32 -15 -39C-9 -46 5 -47 12 -42C19 -46 29 -42 31 -34C37 -28 38 -14 34.5 -1C32 -7 30 -11 26 -13.5C22 -9 16 -9 13 -14.5C10 -9 4 -8 0 -13.5C-4 -7.5 -12 -7.5 -14.5 -12.5C-18 -8 -24 -8 -26.5 -10.5C-29 -6 -31.5 -1 -34 6Z'
    };
    const FACE = 'M-31 -4C-31 -26 -16 -32 0 -32C16 -32 31 -26 31 -4C31 14 18 28 0 29C-18 28 -31 14 -31 -4Z';

    const head = (L, FX, wk, P, t, o) => {
      const her = wk === 'her';
      const mir = J(t, 'scale(-1 1)');
      if (her) {
        sh(L, E(-9, -50, 15, 12.5), P.hair, '', t);
        sh(L, 'M-21 -52Q-12 -61 0 -54', '', ST(P.hairL, 1.8, 0.7), t);
        sh(L, 'M-20 -45Q-9 -40 3 -47', '', ST(P.hairD, 1.2, 0.55), t);
        sh(L, 'M-14 -60.5Q-5 -61 1 -55', '', ST(P.hairD, 1, 0.4), t);
        sh(L, 'M-23 -55Q-19 -62 -10 -62.5', '', ST('#FFE79A', 1.1, 0.4), t);
      }
      sh(L, her
        ? 'M-34 18C-41 -6 -38 -38 -6 -43C24 -46 42 -26 38 0C37 12 36 22 31 30C20 34 -22 34 -31 30C-34 26 -34 22 -34 18Z'
        : 'M-33 6C-37 -20 -22 -40 0 -41C23 -41 37 -22 34 6Z', P.hair, '', t);
      if (!her) {
        [t, mir].forEach(tt => {
          sh(L, E(-31, 4, 4.6, 6.4), P.skin, '', tt);
          sh(L, E(-31.4, 4.6, 2.2, 3.6), P.skinS, OP(0.7), tt);
        });
      }
      sh(L, FACE, P.skin, '', t);
      sh(L, 'M16 -27C27 -21 30 -8 28.4 4C26.4 16 16 26.4 1 28.6C13 23 22 13 24 1C25 -10 22 -20 16 -27Z', P.skinS, OP(0.42), t);
      sh(L, E(-15, -1, 7, 4), '#FFFFFF', OP(0.1), t);
      sh(L, HAIR_FRONT[wk], P.skinD, OP(0.3), J(t, 'translate(0 3.2)'));
      sh(L, E(-19, 13, 6.5, 4), P.blush, '', t);
      sh(L, E(19, 13, 6.5, 4), P.blush, '', t);
      sh(L, 'M-1.2 11Q0.3 12.8 1.8 11.2', '', ST(P.skinD, 1.3, 0.7), t);
      if (o.closed) {
        [-12.5, 12.5].forEach(ex => {
          const sg = ex < 0 ? -1 : 1;
          sh(L, 'M' + (ex - 5.5) + ' 4.5Q' + ex + ' 9 ' + (ex + 5.5) + ' 4.5', '', ST(P.lash, 2), t);
          sh(L, 'M' + (ex + sg * 5.5) + ' 4.5L' + (ex + sg * 7.3) + ' 3.1', '', ST(P.lash, 1.3), t);
        });
        sh(L, 'M-4 18Q0 21.2 4 18', '', ST(P.mouth, 1.6), t);
      } else if (her) {
        sh(L, 'M-4.8 17.2Q0 23 4.8 17.2Q0 18.8 -4.8 17.2Z', P.mouth, '', t);
        sh(L, 'M-2 20.3Q0 21.7 2 20.3Q0 19.7 -2 20.3Z', '#E0786C', OP(0.9), t);
      } else {
        sh(L, 'M-4.6 17.4Q0 21.6 4.6 17.4', '', ST(P.mouth, 1.7), t);
        sh(L, 'M5 16.6L5.8 17.6', '', ST(P.mouth, 1.1, 0.6), t);
      }
      sh(L, HAIR_FRONT[wk], P.hair, '', t);
      if (her) {
        sh(L, 'M-8 -40C-14 -30 -16 -22 -14 -13', '', ST(P.hairD, 1.1, 0.45), t);
        sh(L, 'M8 -41C13 -32 17 -22 16 -12', '', ST(P.hairD, 1.1, 0.45), t);
        sh(L, 'M22 -36C28 -26 30 -14 30 4', '', ST(P.hairD, 1, 0.35), t);
        sh(L, 'M-26 -26C-20 -36 -10 -40 0 -40', '', ST(P.hairL, 2.6, 0.55), t);
        sh(L, 'M4 -40.5Q10 -40.5 14 -38.5', '', ST(P.hairL, 1.8, 0.45), t);
        sh(L, 'M-30 6C-36 14 -33 24 -37 31', '', ST(P.hairM, 1.6, 0.95), t);
        sh(L, 'M-33.5 -10C-33 -24 -24 -38 -6 -43.5', '', ST('#FFE79A', 1.3, 0.45), t);
        sh(L, 'M36.5 -14C37.5 -2 36.5 10 33.5 22', '', ST('#DCD2F7', 1.1, 0.3), t);
      } else {
        sh(L, 'M-6 -42C-6 -50 2 -54 9 -50C4 -49 1 -46 0 -42Z', P.hair, '', t);
        sh(L, 'M28 -38C33 -42 38 -40 39 -36C35 -37 32 -36 30 -34Z', P.hair, '', t);
        sh(L, 'M-4 -42C-8 -32 -9 -22 -7 -13', '', ST(P.hairD, 1.1, 0.45), t);
        sh(L, 'M12 -41C16 -32 16 -22 14 -15', '', ST(P.hairD, 1.1, 0.45), t);
        sh(L, 'M24 -36C28 -28 29 -20 27 -14', '', ST(P.hairD, 1, 0.35), t);
        sh(L, 'M-25 -28C-19 -37 -9 -41 2 -41', '', ST(P.hairL, 2.4, 0.55), t);
        sh(L, 'M-34 -6C-34 -20 -27 -33 -14 -39.5', '', ST('#FFE79A', 1.3, 0.45), t);
        sh(L, 'M36.5 -26C38 -16 37 -8 34.5 -1', '', ST('#DCD2F7', 1.1, 0.3), t);
      }
      const bw = her ? 1.9 : 2.4, bo = her ? 0.75 : 0.85;
      const brow = her ? 'M-17.5 -7.6Q-13 -10.4 -8.2 -9.4' : 'M-18 -7.4Q-13 -10.6 -7.5 -9.2';
      sh(L, brow, '', ST(P.hairD, bw, bo), t);
      sh(L, brow, '', ST(P.hairD, bw, bo), mir);
      if (her) {
        sh(L, E(-7, -41, 8.5, 3.4), P.str, '', t);
        sh(L, 'M-13 -42Q-7 -44.2 -1 -42', '', ST('#FFE79A', 1, 0.8), t);
        sh(L, 'M-11 -39.5L-11 -42.5M-7 -38.6L-7 -42.8M-3 -39.5L-3 -42.5', '', ST(P.strT, 0.7, 0.6), t);
      }
      if (o.phones) {
        const band = 'M-35 -2C-40 -62 40 -62 35 -2';
        sh(L, band, '', ST(P.phB, 5.2), t);
        sh(L, 'M-31 -20C-30 -44 -2 -49 14 -47.5', '', ST(P.phC, 1.3, 0.8), t);
        [t, mir].forEach((tt, i) => {
          sh(L, RR(-42, -6, 12.6, 20, 6), P.phC, '', tt);
          sh(L, E(-31.6, 4, 2.4, 8.2), P.phK, '', tt);
          sh(L, 'M-39.5 -1.5Q-40 4 -39 9', '', ST('#FFFFFF', 1.4, i ? 0.12 : 0.3), tt);
        });
        sh(L, E(-38, 4, 1.1, 1.1), '#FFE79A', '', t);
        sh(FX, E(-47, -22, 3.2, 2.4), '#FFE79A', OP(0.85), t);
        sh(FX, 'M-44 -22.4L-44 -33Q-40.5 -31.6 -39.5 -28', '', ST('#FFE79A', 1.2, 0.85), t);
        sh(FX, E(-56, -34, 2.2, 1.7), '#DCD2F7', OP(0.7), t);
        sh(FX, 'M-53.9 -34.3L-53.9 -41', '', ST('#DCD2F7', 1, 0.7), t);
      }
    };

    const eye = (wk, P, ex) => {
      const L = [], sg = ex < 0 ? -1 : 1, her = wk === 'her';
      sh(L, E(ex, 4, 5.7, 7.1), P.lash);
      sh(L, E(ex, 4.7, 4.7, 6.1), P.iris);
      sh(L, E(ex, 8.2, 3, 1.7), P.glint, OP(her ? 0.3 : 0.28));
      sh(L, E(ex, 5.6, 2.3, 2.9), '#1A0E08', OP(0.82));
      sh(L, E(ex - 1.7, 1.6, 1.8, 2), '#FFFFFF');
      sh(L, E(ex + 1.9, 7.6, 0.85, 0.85), '#FFFFFF', OP(0.75));
      sh(L, 'M' + (ex - 6) + ' 0.8Q' + ex + ' -7.5 ' + (ex + 6) + ' 0.8' + (her ? 'L' + (ex + sg * 7.8) + ' -0.9' : ''), '', ST(P.lash, her ? 2.2 : 2.4));
      if (her) sh(L, 'M' + (ex + sg * 3) + ' 10.6Q' + (ex + sg * 5) + ' 9.8 ' + (ex + sg * 5.6) + ' 8', '', ST(P.lash, 0.9, 0.5));
      return L;
    };

    /* ---------- torso (local origin = neck base) ---------- */
    const torso = (L, P, t) => {
      sh(L, 'M-31 8C-37 -8 -24 -21 0 -21C24 -21 37 -8 31 8Z', P.hoodS, '', t);
      sh(L, 'M-22 6C-24 -6 -14 -13 0 -13C14 -13 24 -6 22 6Z', P.hoodD, OP(0.6), t);
      sh(L, 'M-7 -14L7 -14L8 8L-8 8Z', P.skinS, '', t);
      sh(L, E(0, -6, 9.5, 4.5), P.skinD, OP(0.45), t);
      sh(L, 'M-24 2C-32 4 -38 10 -38 22L-38 50C-38 56 -34 60 -28 60L28 60C34 60 38 56 38 50L38 22C38 10 32 4 24 2C14 8.5 -14 8.5 -24 2Z', P.hood, '', t);
      sh(L, 'M22 4C33 7 38 15 38 25L38 52C38 58 34 61.5 28 61.5L18 61.5C27 50 30 28 22 4Z', P.hoodS, OP(0.5), t);
      sh(L, 'M-10 30Q0 32.5 10 30', '', ST(P.hoodS, 1, 0.35), t);
      sh(L, 'M-16 34L16 34C19 41 21 47 22 51L-22 51C-21 47 -19 41 -16 34Z', P.hoodS, OP(0.32), t);
      sh(L, 'M-22 51C-21 47 -19 41 -16 34L16 34C19 41 21 47 22 51', '', ST(P.hoodD, 1, 0.4), t);
      sh(L, 'M-15 35.5L14 35.5', '', ST(P.hoodL, 0.8, 0.45), t);
      sh(L, 'M-38 51L38 51L38 53C38 58 34 61.5 28 61.5L-28 61.5C-34 61.5 -38 58 -38 53Z', P.hoodS, OP(0.55), t);
      sh(L, 'M-36 52.4L36 52.4', '', ST(P.hoodL, 0.8, 0.4), t);
      sh(L, 'M-25 4.5C-33 7.5 -37.5 14 -37.8 26L-37.8 44', '', ST(P.hoodL, 1.4, 0.7), t);
      const rimP = 'M-26 1C-21 13 -8 20 0 22C8 20 21 13 26 1';
      sh(L, rimP, '', ST(P.hoodD, 8, 0.5), J(t, 'translate(0 1.6)'));
      sh(L, rimP, '', ST(P.rim, 6), t);
      sh(L, 'M-24 0C-20 9 -10 15 -2 18', '', ST(P.hoodL, 1.2, 0.75), t);
      sh(L, E(-5, 20, 1.3, 1.3), P.hoodD, '', t);
      sh(L, E(5, 20, 1.3, 1.3), P.hoodD, '', t);
      sh(L, 'M-5 20Q-6.5 28 -7 35', '', ST(P.str, 1.6), t);
      sh(L, 'M5 20Q6.5 27 6 36', '', ST(P.str, 1.6), t);
      sh(L, RR(-8.3, 34, 2.6, 5, 1.2), P.strT, '', t);
      sh(L, RR(4.7, 35, 2.6, 5, 1.2), P.strT, '', t);
    };

    /* ---------- arm: sleeve + cuff over a peeking hand ---------- */
    const arm = (L, P, t, a, patch) => {
      const dir = norm(a.dir), Hc = a.Hc;
      const W = [Hc[0] - dir[0] * 8.2, Hc[1] - dir[1] * 8.2];
      const S = a.S, C = a.C || [(S[0] + W[0]) / 2, (S[1] + W[1]) / 2];
      const ang = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
      const d = 'M' + pt(S) + 'Q' + pt(C) + ' ' + pt(W);
      sh(L, d, '', ST(P.hoodS, 15), t);
      sh(L, d, '', ST(P.hoodM, 11), J(t, 'translate(-1.3 -1.2)'));
      const m = qp(S, C, W, 0.55);
      sh(L, E(0, 0, 3, 1), P.hoodS, OP(0.5), J(t, T(m[0], m[1], ang + 90)));
      sh(L, E(0, 0, 5, 4.5), P.skin, '', J(t, T(Hc[0], Hc[1], ang)));
      sh(L, 'M1.6 -1.5L4.4 -1.3M1.6 1.5L4.4 1.3', '', ST(P.skinD, 0.8, 0.6), J(t, T(Hc[0], Hc[1], ang)));
      const cx = W[0] + dir[0] * 4.4, cy = W[1] + dir[1] * 4.4;
      sh(L, E(0, 0, 3.6, 7.6), P.hoodS, '', J(t, T(cx, cy, ang)));
      sh(L, 'M-1 -5.6Q-1.8 0 -1 5.6', '', ST(P.hoodD, 0.8, 0.5), J(t, T(cx, cy, ang)));
      if (patch) {
        const q = qp(S, C, W, 0.28), pt2 = J(t, T(q[0], q[1], -8));
        sh(L, RR(-5, -4.5, 10, 9, 2), '#3D2C74', '', pt2);
        sh(L, RR(-4.2, -3.7, 8.4, 7.4, 1.5), '', ST('#FFE79A', 0.6, 0.85) + ';stroke-dasharray:1.2 1', pt2);
        sh(L, 'M-2 -1H-3.6M-2 1H-3.6M2 -1H3.6M2 1H3.6M0 -2V-3.2M0 2V3.2', '', ST('#F6C945', 0.6), pt2);
        sh(L, RR(-2, -2, 4, 4, 0.6), '#1E1638', '', pt2);
        sh(L, E(-1, -1, 0.5, 0.5), '#FFE79A', '', pt2);
      }
    };

    /* ---------- shoes & legs (absolute coords) ---------- */
    const shoe = (L, P, her, x, y) => {
      sh(L, E(x, y, 10.5, 6), P.shoe);
      if (her) {
        sh(L, E(x, y - 2.6, 6.2, 2.4), P.shoeS, OP(0.7));
        sh(L, 'M' + (x - 9.6) + ' ' + (y + 2) + 'Q' + x + ' ' + (y + 7.6) + ' ' + (x + 9.6) + ' ' + (y + 2), '', ST(P.shoeS, 1.6));
        sh(L, E(x, y + 2.2, 2.8, 2.3), P.shoeA);
        sh(L, E(x - 0.8, y + 1.4, 1, 0.8), '#FFFFFF', OP(0.7));
      } else {
        sh(L, E(x, y + 2, 6, 2.6), '#E9E2FA');
        sh(L, 'M' + (x - 9.6) + ' ' + (y + 2) + 'Q' + x + ' ' + (y + 7.6) + ' ' + (x + 9.6) + ' ' + (y + 2), '', ST(P.shoeA, 2.2));
        sh(L, 'M' + (x - 3.2) + ' ' + (y - 2.4) + 'L' + (x + 3.2) + ' ' + (y - 2.4) + 'M' + (x - 2.8) + ' ' + (y - 0.4) + 'L' + (x + 2.8) + ' ' + (y - 0.4), '', ST('#B9A6EC', 1));
      }
      sh(L, E(x - 4.5, y - 1.5, 2.8, 1.4), '#FFFFFF', OP(0.5));
    };
    const legsStand = (L, P, her, cx, hem) => {
      sh(L, E(cx, 205, 32, 5), url('sh'));
      const w = her ? 14 : 16;
      [-1, 1].forEach(s => {
        const x = cx + s * 10;
        sh(L, 'M' + x + ' ' + (hem - 8) + 'L' + (x + s * 0.6) + ' 194', '', ST(P.pantsS, w));
        sh(L, 'M' + (x - 1.3) + ' ' + (hem - 8) + 'L' + (x + s * 0.6 - 1.3) + ' 194', '', ST(P.pantsM, w - 4.5));
      });
      sh(L, 'M' + cx + ' ' + (hem - 2) + 'L' + cx + ' ' + (hem + 6), '', ST(P.pantsS, 1.6, 0.8));
      shoe(L, P, her, cx - 12, 201);
      shoe(L, P, her, cx + 12, 201);
    };
    const legsSit = (L, P, cx) => {
      const B = 206;
      sh(L, E(cx, 207, 54, 6.5), url('sh'));
      sh(L, 'M' + (cx - 46) + ' ' + (B - 9) + 'C' + (cx - 48) + ' ' + (B - 24) + ' ' + (cx - 30) + ' ' + (B - 31) + ' ' + cx + ' ' + (B - 26) + 'C' + (cx + 30) + ' ' + (B - 31) + ' ' + (cx + 48) + ' ' + (B - 24) + ' ' + (cx + 46) + ' ' + (B - 9) + 'C' + (cx + 44) + ' ' + (B - 1) + ' ' + (cx + 30) + ' ' + (B + 1) + ' ' + cx + ' ' + (B - 3) + 'C' + (cx - 30) + ' ' + (B + 1) + ' ' + (cx - 44) + ' ' + (B - 1) + ' ' + (cx - 46) + ' ' + (B - 9) + 'Z', P.pants);
      sh(L, E(cx - 34, B - 20, 9, 4), '#FFFFFF', OP(0.1));
      sh(L, E(cx + 34, B - 20, 9, 4), '#FFFFFF', OP(0.08));
      sh(L, 'M' + (cx - 38) + ' ' + (B - 12) + 'C' + (cx - 20) + ' ' + (B - 20) + ' ' + (cx + 12) + ' ' + (B - 18) + ' ' + (cx + 30) + ' ' + (B - 8), '', ST(P.pantsS, 1.6, 0.8));
      sh(L, 'M' + (cx + 36) + ' ' + (B - 14) + 'C' + (cx + 24) + ' ' + (B - 20) + ' ' + (cx + 10) + ' ' + (B - 20) + ' ' + (cx + 2) + ' ' + (B - 17), '', ST(P.pantsS, 1.2, 0.5));
      [[cx + 23, B - 6, -12], [cx - 25, B - 5, 14]].forEach(f => {
        const tt = T(f[0], f[1], f[2]);
        sh(L, E(0, 0, 8.4, 4.6), P.sock, '', tt);
        sh(L, 'M-3 -3.6Q-4.4 0 -3 3.6', '', ST(P.sockS, 1, 0.6), tt);
        sh(L, E(2.4, -1.4, 2.6, 1.2), '#FFFFFF', OP(0.45), tt);
      });
    };
    const legsCurl = (back, front, P, her, cx, Uy) => {
      const kY = Uy + 34;
      sh(back, E(cx, 206, 38, 6), url('sh'));
      sh(back, E(cx, 196, 30, 11), P.pantsS);
      [-1, 1].forEach(s => {
        const x = cx + s * 13;
        sh(front, 'M' + x + ' ' + (kY + 4) + 'L' + (x + s * 0.5) + ' 197', '', ST(P.pantsS, 20));
        sh(front, 'M' + (x - 1.5) + ' ' + (kY + 4) + 'L' + (x + s * 0.5 - 1.5) + ' 197', '', ST(P.pantsM, 15));
      });
      shoe(front, P, her, cx - 14, 202.5);
      shoe(front, P, her, cx + 14, 202.5);
      [-1, 1].forEach(s => {
        const x = cx + s * 13;
        sh(front, E(x, kY, 13.5, 12.5), P.pants);
        sh(front, E(x - 3.5, kY - 4.5, 5.5, 3), '#FFFFFF', OP(0.14));
      });
      sh(front, 'M' + cx + ' ' + (kY - 3) + 'L' + cx + ' ' + (kY + 10), '', ST(P.pantsS, 1.4, 0.7));
    };

    /* ---------- items (local origin = item centre) ---------- */
    const star = (cx, cy, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + r1(cx + Math.cos(a) * rr) + ' ' + r1(cy + Math.sin(a) * rr); } return d + 'Z'; };
    const heart = (x, y, k) => 'M' + x + ' ' + r1(y + 3 * k) + 'C' + r1(x - 5 * k) + ' ' + r1(y - k) + ' ' + r1(x - 3 * k) + ' ' + r1(y - 5 * k) + ' ' + x + ' ' + r1(y - 2 * k) + 'C' + r1(x + 3 * k) + ' ' + r1(y - 5 * k) + ' ' + r1(x + 5 * k) + ' ' + r1(y - k) + ' ' + x + ' ' + r1(y + 3 * k) + 'Z';
    const drawItem = (L, FX, it, P, t) => {
      if (it === 'book') {
        sh(L, 'M0 -12L-15 -10.5Q-16 -10.3 -16 -9L-16 10Q-16 11.3 -15 11.4L0 13Z', '#5B43A8', '', t);
        sh(L, 'M0 -12L15 -10.5Q16 -10.3 16 -9L16 10Q16 11.3 15 11.4L0 13Z', '#3D2C74', '', t);
        sh(L, 'M-14.5 -10.2Q-7 -12.6 0 -11.6Q7 -12.6 14.5 -10.2L14.5 -9Q7 -11.2 0 -10.4Q-7 -11.2 -14.5 -9Z', '#F4F0FD', '', t);
        sh(L, 'M0 -11.4L0 12.8', '', ST('#1E1638', 1, 0.5), t);
        sh(L, 'M-14 -7.5L-14 9.4M14 -7.5L14 9.4', '', ST('#F6C945', 0.7, 0.55), t);
        sh(L, 'M-7 -4.4A4.5 4.5 0 1 0 -7 4.4A3.6 3.6 0 1 1 -7 -4.4Z', '#F6C945', '', t);
        sh(L, star(-3, -5.5, 1.6), '#FFE79A', '', t);
        sh(L, star(7.5, 4, 1.2), '#B9A6EC', OP(0.7), t);
      } else if (it === 'laptop') {
        sh(L, E(0, -13, 24, 10), url('gw'), OP(0.6), t);
        sh(L, RR(-18, -14, 36, 24, 3), '#DCD2F7', '', t);
        sh(L, 'M4 -14L15 -14Q18 -14 18 -11L18 7Q18 10 15 10L-2 10Z', '#B9A6EC', OP(0.5), t);
        sh(L, 'M-16.5 -12.5L16.5 -12.5', '', ST('#FFFFFF', 0.8, 0.6), t);
        sh(L, star(-8, -5, 3.4), '#F6C945', '', t);
        sh(L, heart(7, 1, 0.9), '#8E7AD6', '', t);
        sh(L, RR(-3, 2, 5, 5, 0.8), '#3D2C74', '', t);
        sh(L, 'M-20 10L20 10Q21 13 18 14L-18 14Q-21 13 -20 10Z', '#B9A6EC', '', t);
        sh(L, 'M-19 10.6L19 10.6', '', ST('#F4F0FD', 0.8, 0.8), t);
      } else if (it === 'controller') {
        sh(L, 'M-14 -5C-8 -8 8 -8 14 -5C19 -3 21 8 18 11C15 14 11 11 8 7L-8 7C-11 11 -15 14 -18 11C-21 8 -19 -3 -14 -5Z', '#5B43A8', '', t);
        sh(L, 'M4 7L8 7C11 11 15 14 18 11C21 8 19 -3 14 -5C16 0 15 6 13 8Z', '#3D2C74', OP(0.7), t);
        sh(L, 'M-12 -5.5C-6 -7.5 6 -7.5 12 -5.5', '', ST('#B9A6EC', 1.2, 0.7), t);
        sh(L, 'M-11 -1H-9V-3H-7V-1H-5V1H-7V3H-9V1H-11Z', '#FFE79A', '', t);
        sh(L, E(8, -2.2, 1.5, 1.5), '#F6C945', '', t);
        sh(L, E(11, 0, 1.5, 1.5), '#DCD2F7', '', t);
        sh(L, E(8, 2.2, 1.5, 1.5), '#FFE79A', '', t);
        sh(L, E(5, 0, 1.5, 1.5), '#B9A6EC', '', t);
        sh(L, E(0, -3, 1.3, 0.8), '#FFE79A', '', t);
        sh(L, E(0, -3, 3.5, 2.4), url('gw'), OP(0.6), t);
      } else if (it === 'mug') {
        sh(FX, 'M-3 -11C-6 -15 0 -17 -3 -22', '', ST('#F4F0FD', 1.5, 0.55), t);
        sh(FX, 'M3 -12C0 -16 6 -18 3 -24', '', ST('#F4F0FD', 1.4, 0.45), t);
        sh(L, 'M7.5 -4C13.5 -4.5 13.5 5 7 5', '', ST('#F4F0FD', 2.6), t);
        sh(L, 'M-8 -9L8 -9L7.2 8Q7 12 3 12L-3 12Q-7 12 -7.2 8Z', '#F4F0FD', '', t);
        sh(L, 'M3 -9L8 -9L7.2 8Q7 12 3 12Z', '#DCD2F7', OP(0.75), t);
        sh(L, E(0, -9, 8, 2.2), '#E8E0FA', '', t);
        sh(L, E(0, -8.7, 6.8, 1.6), '#7A4A2E', '', t);
        sh(L, E(-2, -9, 2.4, 0.6), '#A8714A', OP(0.8), t);
        sh(L, heart(-0.5, 2, 1), P.acc, '', t);
      } else if (it === 'watering') {
        sh(FX, E(-25, -2, 1, 1.5), '#DCD2F7', OP(0.9), t);
        sh(FX, E(-27.5, 4, 0.9, 1.4), '#DCD2F7', OP(0.75), t);
        sh(FX, E(-23.5, 8, 0.8, 1.2), '#B9A6EC', OP(0.8), t);
        sh(L, 'M-8 2L-20 -8', '', ST(P.acc, 3.2), t);
        sh(L, E(0, 0, 2.2, 3.4), P.accS, '', J(t, T(-21.5, -9.5, -40)));
        sh(L, 'M-6 -7C-5 -15 6 -15 7 -7', '', ST(P.accS, 2.4), t);
        sh(L, 'M9 -4C15 -3 15 6 9 6', '', ST(P.accS, 2.4), t);
        sh(L, 'M-9 -7Q0 -10 9 -7L8.5 8Q0 11 -8.5 8Z', P.acc, '', t);
        sh(L, 'M3 -9Q7 -8.4 9 -7L8.5 8Q6 9.2 3 9.8Z', P.accS, OP(0.55), t);
        sh(L, 'M-9 -1Q0 1.5 9 -1', '', ST(P.accL, 1.4, 0.9), t);
        sh(L, 'M-6.5 -4L-6.5 5', '', ST('#FFFFFF', 1.6, 0.35), t);
      } else if (it === 'soldering') {
        sh(L, RR(-20, 0, 16, 10, 1.6), '#5B43A8', '', t);
        sh(L, RR(-20, 0, 16, 10, 1.6), '', ST('#3D2C74', 0.8), t);
        sh(L, 'M-18 2.5H-14V6H-10M-18 8H-12M-7 2.5V5', '', ST('#F6C945', 0.7), t);
        sh(L, RR(-14.5, 1.6, 4, 4, 0.5), '#1E1638', '', t);
        sh(L, E(-6.5, 7.5, 0.9, 0.9), '#FFE79A', '', t);
        sh(L, E(-17.5, 5.2, 0.8, 0.8), '#FFE79A', '', t);
        sh(L, E(-3.5, 5.8, 3.6, 3.6), url('gw'), '', t);
        sh(L, 'M8 -2L-1 4', '', ST('#DCD2F7', 1.6), t);
        sh(L, 'M-1 4L-3.5 5.8', '', ST('#FFE79A', 1.3), t);
        sh(L, 'M18 -12L8 -2', '', ST('#2B1F52', 4.4), t);
        sh(L, 'M15.5 -9.5L12 -6', '', ST('#E9A23B', 4.6), t);
        sh(L, 'M17 -12.5L10 -5.5', '', ST('#7C63C9', 1, 0.7), t);
        sh(FX, 'M-3 4C-7 -1 0 -4 -4 -10C-7 -14 -2 -17 -3 -22', '', ST('#F4F0FD', 1.3, 0.55), t);
      }
    };

    /* ---------- hands per pose / item (local to neck base) ---------- */
    const ITEM_HX = { book: 14.5, laptop: 17, controller: 15, mug: 9.5, watering: 11.5 };
    const holdY = (ps, it) => (ps === 'curl' ? 20 : it === 'laptop' ? 37 : 36);
    const isHeld = it => it !== 'none' && it !== 'headphones';
    const handsFor = (ps, it) => {
      const res = {};
      [-1, 1].forEach(s => {
        let Hc, dir, C;
        if (!isHeld(it)) {
          if (ps === 'stand') { Hc = [41 * s, 57]; dir = [0, 1]; C = [45 * s, 30]; }
          else if (ps === 'sit') { Hc = [39 * s, 65]; dir = [-0.25 * s, 1]; C = [48 * s, 34]; }
          else { Hc = [1.5 * s, 52]; dir = [-s, 0.1]; C = [53 * s, 50]; }
        } else if (it === 'soldering') {
          const iy = holdY(ps, it);
          if (s < 0) { Hc = [-21, iy + 6]; dir = [1, 0.05]; C = [-47, iy + (ps === 'curl' ? 4 : 10)]; }
          else { Hc = [13, iy - 8]; dir = [-0.6, 0.8]; C = [44, iy - 4]; }
        } else {
          const iy = holdY(ps, it);
          Hc = [ITEM_HX[it] * s, iy + 3]; dir = [-s, -0.15]; C = [47 * s, iy + (ps === 'curl' ? 4 : 10)];
        }
        res[s < 0 ? 'L' : 'R'] = { S: [29 * s, 10], C: C, Hc: Hc, dir: dir };
      });
      return res;
    };

    /* ---------- one full character ---------- */
    const buildChar = c => {
      const P = PAL[c.who], her = c.who === 'her';
      const o = { back: [], body: [], front: [], fx: [], eyes: null };
      const Ut = T(c.cx, c.Uy, c.rot || 0);
      const off = rot(0, -36, c.rot || 0);
      const Ht = T(c.cx + off[0], c.Uy + off[1], c.tilt || 0);
      const curl = c.pose === 'curl';
      if (c.legs) {
        if (c.pose === 'stand') legsStand(o.back, P, her, c.cx, c.Uy + 61);
        else if (c.pose === 'sit') legsSit(o.back, P, c.cx);
        else legsCurl(o.back, o.front, P, her, c.cx, c.Uy);
      }
      torso(o.body, P, Ut);
      head(o.body, o.fx, c.who, P, Ht, { closed: c.closed, phones: c.phones });
      if (c.arms) {
        const AL = curl ? o.front : o.body;
        const it = c.item;
        if (isHeld(it)) drawItem(AL, o.fx, it, P, J(Ut, T(0, holdY(c.pose, it))));
        const hs = handsFor(c.pose, it);
        if (c.handL) hs.L = c.handL;
        if (c.handR) hs.R = c.handR;
        arm(AL, P, Ut, hs.L, false);
        arm(AL, P, Ut, hs.R, !her);
      }
      if (!c.closed) o.eyes = { t: Ht, l: eye(c.who, P, -12.5), r: eye(c.who, P, 12.5) };
      return o;
    };

    /* ---------- blanket for the together-curl scene ---------- */
    const blanket = L => {
      const pts = [[16, 214], [21, 192], [33, 170], [54, 155], [82, 148], [104, 150], [126, 146], [146, 138], [164, 132], [184, 130], [206, 132], [226, 141], [244, 158], [257, 184], [264, 214]];
      const smp = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
        for (let k = 0; k < 8; k++) {
          const u = k / 8, u2 = u * u, u3 = u2 * u;
          const f = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3);
          smp.push([f(0), f(1)]);
        }
      }
      smp.push(pts[pts.length - 1]);
      const topY = x => {
        for (let j = 0; j < smp.length - 1; j++) {
          const a = smp[j], b = smp[j + 1];
          if (x >= a[0] && x <= b[0]) { const u = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u; }
        }
        return 214;
      };
      const botY = x => 212 + 1.6 * Math.sin(x / 11);
      const xs = [];
      for (let x = 16; x <= 264; x += 4) xs.push(x);
      const topPath = 'M' + smp.map(pt).join('L');
      let outline = topPath;
      for (let i = xs.length - 1; i >= 0; i--) outline += 'L' + r1(xs[i]) + ' ' + r1(Math.max(botY(xs[i]), topY(xs[i])));
      outline += 'Z';
      sh(L, E(140, 214, 126, 7), url('sh'));
      sh(L, outline, '#F6C945');
      const seq = [['#F6C945', 7], ['#FFF3D2', 2.2], ['#B3A0EA', 7], ['#FFF3D2', 2.2]];
      let a = 0, k = 0;
      while (a < 90) {
        const c = seq[k % 4][0], b = a + seq[k % 4][1];
        let up = '';
        const lo = [];
        xs.forEach((x, i) => {
          const ty = topY(x), by = Math.max(botY(x), ty);
          up += (i ? 'L' : 'M') + r1(x) + ' ' + r1(Math.min(ty + a, by));
          lo.push(r1(x) + ' ' + r1(Math.min(ty + b, by)));
        });
        if (c !== '#F6C945') sh(L, up + 'L' + lo.reverse().join('L') + 'Z', c);
        a = b; k++;
      }
      sh(L, outline, url('bS'));
      sh(L, outline, url('bL'));
      sh(L, 'M58 160Q70 186 62 210', '', ST('#2B1F52', 2.6, 0.14));
      sh(L, 'M148 144Q142 178 150 210', '', ST('#2B1F52', 3, 0.16));
      sh(L, 'M232 152Q224 182 234 210', '', ST('#2B1F52', 2.6, 0.14));
      sh(L, E(80, 178, 18, 8), '#FFFFFF', OP(0.12));
      sh(L, E(204, 172, 20, 9), '#FFFFFF', OP(0.12));
      sh(L, topPath, '', ST('#2B1F52', 2, 0.2), 'translate(0 2.6)');
      sh(L, topPath, '', ST('#FFF3D2', 3.2));
      return topY;
    };

    /* ---------- assemble ---------- */
    const out = { back: [], body: [], front: [], fx: [] };
    const none = { t: '', l: [], r: [] };
    let eA = none, eB = none;
    const merge = c => { out.back.push(...c.back); out.body.push(...c.body); out.front.push(...c.front); out.fx.push(...c.fx); };

    if (who !== 'together') {
      const her = who === 'her';
      const Uy = pose === 'stand' ? (her ? 102 : 98) : pose === 'sit' ? (her ? 130 : 126) : (her ? 126 : 122);
      const tilt = pose === 'stand' ? (her ? 4 : -3) : pose === 'sit' ? (her ? 6 : -4) : (her ? 8 : -6);
      const c = buildChar({ who: who, pose: pose, item: item, cx: 80, Uy: Uy, rot: 0, tilt: tilt, closed: false, phones: item === 'headphones', legs: true, arms: true });
      merge(c);
      eA = c.eyes || none;
    } else if (pose === 'curl') {
      const hm = buildChar({ who: 'him', pose: 'curl', item: 'none', cx: 176, Uy: 118, rot: 0, tilt: -6, closed: true, phones: false, legs: false, arms: false });
      const hr = buildChar({ who: 'her', pose: 'curl', item: 'none', cx: 106, Uy: 146, rot: 10, tilt: 14, closed: true, phones: item === 'headphones', legs: false, arms: false });
      out.back.push(...hm.back, ...hr.back);
      out.body.push(...hm.body, ...hr.body);
      const topY = blanket(out.front);
      const PH = PAL.her, PM = PAL.him;
      if (isHeld(item)) {
        const ix = 142, iy = 168;
        drawItem(out.front, out.fx, item, item === 'soldering' || item === 'laptop' || item === 'controller' ? PM : PH, T(ix, iy));
        let hL, hR;
        if (item === 'soldering') { hL = { Hc: [ix - 21, iy + 6], dir: [1, 0.05] }; hR = { Hc: [ix + 13, iy - 8], dir: [-0.6, 0.8] }; }
        else { const hx = ITEM_HX[item]; hL = { Hc: [ix - hx, iy + 3], dir: [1, -0.15] }; hR = { Hc: [ix + hx, iy + 3], dir: [-1, -0.15] }; }
        [[hL, PH], [hR, PM]].forEach(h => {
          const a = h[0], d = norm(a.dir);
          a.S = [a.Hc[0] - d[0] * 22, a.Hc[1] - d[1] * 22 + 2];
          a.C = [a.Hc[0] - d[0] * 15, a.Hc[1] - d[1] * 15 + 1];
          arm(out.front, h[1], '', a, false);
        });
      } else {
        [[88, PH], [214, PM]].forEach(h => {
          const x = h[0], y = topY(x), P = h[1];
          sh(out.front, E(x, y - 2.6, 7, 4.2), P.hoodS);
          sh(out.front, E(x - 0.6, y - 3.3, 5.8, 3), P.hoodM);
          sh(out.front, E(x, y + 1.8, 5.4, 3.4), P.skin);
          sh(out.front, 'M' + r1(x - 1.8) + ' ' + r1(y + 0.6) + 'L' + r1(x - 1.8) + ' ' + r1(y + 3.6) + 'M' + r1(x + 1.2) + ' ' + r1(y + 0.6) + 'L' + r1(x + 1.2) + ' ' + r1(y + 3.8), '', ST(P.skinD, 0.8, 0.6));
        });
      }
      shoe(out.front, PH, true, 84, 213);
      shoe(out.front, PH, true, 104, 214);
      shoe(out.front, PM, false, 190, 212);
      shoe(out.front, PM, false, 212, 212);
      out.fx.push(...hm.fx, ...hr.fx);
    } else {
      const stand = pose === 'stand';
      const herCx = stand ? 100 : 98, himCx = stand ? 180 : 184;
      const herUy = stand ? 102 : 132, himUy = stand ? 97 : 127;
      const holder = !isHeld(item) ? '' : (item === 'soldering' || item === 'laptop' || item === 'controller') ? 'him' : 'her';
      const meetX = (herCx + himCx) / 2, meetY = stand ? 150 : 192;
      const herHand = holder === 'her' ? null : { S: [29, 10], C: [46, stand ? 32 : 36], Hc: [meetX - 3 - herCx, meetY - herUy], dir: [0.35, 1] };
      const himHand = holder === 'him' ? null : { S: [-29, 10], C: [-46, stand ? 32 : 36], Hc: [meetX + 3 - himCx, meetY - himUy], dir: [-0.35, 1] };
      const hm = buildChar({ who: 'him', pose: pose, item: holder === 'him' ? item : 'none', cx: himCx, Uy: himUy, rot: 0, tilt: -4, closed: false, phones: false, legs: true, arms: true, handL: himHand });
      const hr = buildChar({ who: 'her', pose: pose, item: holder === 'her' ? item : 'none', cx: herCx, Uy: herUy, rot: 0, tilt: 9, closed: false, phones: item === 'headphones', legs: true, arms: true, handR: herHand });
      merge(hm);
      merge(hr);
      eA = hr.eyes || none;
      eB = hm.eyes || none;
    }

    const WHO = { her: 'Her character', him: 'His character', together: 'The couple together' };
    const POSE = { stand: 'standing', sit: 'sitting', curl: who === 'together' ? 'curled up under a striped blanket' : 'curled up with knees hugged' };
    const ITEM = { none: '', book: 'with a book', laptop: 'with a laptop', controller: 'holding a game controller', headphones: 'wearing headphones', mug: 'holding a warm mug', watering: 'with a watering can', soldering: 'with a soldering iron' };
    const label = WHO[who] + ', ' + POSE[pose] + (ITEM[item] ? ' ' + ITEM[item] : '');
  const defs = ['skH', 'skM', 'hrH', 'hrM', 'hdH', 'hdM', 'pnH', 'pnM', 'irH', 'irM', 'blH', 'blM', 'sh', 'gw', 'bS', 'bL'];
  void defs;
  const att = (s, withT) => `<path d="${s.d}" fill="${s.f}"${withT ? ` transform="${s.t}"` : ''} style="${s.s}"/>`;
  const list = (a, withT = true) => a.map((s) => att(s, withT)).join('');
  const eyeG = (e) => (e.l.length || e.r.length ? `<g transform="${e.t}"><g class="dc-blink">${list(e.l, false)}</g><g class="dc-blink">${list(e.r, false)}</g></g>` : '');
  const G = (id, type, attrs, stops) => `<${type}Gradient id="${gid}${id}" ${attrs}>${stops.map(([o, c, op]) => `<stop offset="${o}" style="stop-color:${c};stop-opacity:${op}"/>`).join('')}</${type}Gradient>`;
  const gradients = [
    G('skH', 'radial', 'cx="0.4" cy="0.34" r="0.78"', [[0, '#DEA77C', 1], [0.55, '#C98E62', 1], [1, '#AE7248', 1]]),
    G('skM', 'radial', 'cx="0.4" cy="0.34" r="0.78"', [[0, '#FFEDE0', 1], [0.55, '#F6DCC8', 1], [1, '#E4BDA1', 1]]),
    G('hrH', 'linear', 'x1="0.15" y1="0" x2="0.85" y2="1"', [[0, '#8E5835', 1], [0.5, '#6B3F24', 1], [1, '#46271A', 1]]),
    G('hrM', 'linear', 'x1="0.15" y1="0" x2="0.85" y2="1"', [[0, '#7C5434', 1], [0.5, '#5A3A22', 1], [1, '#382213', 1]]),
    G('hdH', 'linear', 'x1="0.1" y1="0" x2="0.9" y2="1"', [[0, '#D0C2F5', 1], [0.5, '#B9A6EC', 1], [1, '#9883DC', 1]]),
    G('hdM', 'linear', 'x1="0.1" y1="0" x2="0.9" y2="1"', [[0, '#FFDD74', 1], [0.5, '#F6C945', 1], [1, '#ECAD3F', 1]]),
    G('pnH', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, '#6B53BA', 1], [1, '#3D2C74', 1]]),
    G('pnM', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, '#56469E', 1], [1, '#2B1F52', 1]]),
    G('irH', 'radial', 'cx="0.5" cy="0.68" r="0.62"', [[0, '#FFD27A', 1], [0.45, '#E39A2A', 1], [1, '#874C12', 1]]),
    G('irM', 'radial', 'cx="0.5" cy="0.68" r="0.62"', [[0, '#9C6C49', 1], [0.5, '#5A3824', 1], [1, '#23140B', 1]]),
    G('blH', 'radial', 'cx="0.5" cy="0.5" r="0.5"', [[0, '#EE7766', 0.55], [1, '#EE7766', 0]]),
    G('blM', 'radial', 'cx="0.5" cy="0.5" r="0.5"', [[0, '#FF9478', 0.5], [1, '#FF9478', 0]]),
    G('sh', 'radial', 'cx="0.5" cy="0.5" r="0.5"', [[0, '#0E0820', 0.55], [0.6, '#0E0820', 0.25], [1, '#0E0820', 0]]),
    G('gw', 'radial', 'cx="0.5" cy="0.5" r="0.5"', [[0, '#FFE79A', 0.8], [1, '#FFE79A', 0]]),
    G('bS', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, '#1E1638', 0], [0.5, '#1E1638', 0.06], [1, '#1E1638', 0.42]]),
    G('bL', 'radial', 'cx="0.22" cy="0.12" r="0.75"', [[0, '#FFF8E0', 0.42], [1, '#FFF8E0', 0]])
  ].join('');

  const sizeAttr = props.scale > 0 ? ` width="${r1(vw * scale)}" height="${r1(vh * scale)}"` : '';
  return `<svg class="dc-chr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}"${sizeAttr} role="img" aria-label="${label}"><defs>${gradients}</defs>${list(out.back)}<g class="dc-br">${list(out.body)}${eyeG(eA)}${eyeG(eB)}</g>${list(out.front)}<g class="dc-wisp">${list(out.fx)}</g></svg>`;
}
