// XO by the window (design/XOGame.dc.html): tic-tac-toe on a small PCB with glowing LED pieces.
// X is the "her" character (lilac LED), O is the "him" character (butter LED). Same backend as before.
import { esc } from '../util.js';
import { renderCharacter } from '../characters.js';

const CONF = ['#FFE79A', '#F6C945', '#B9A6EC', '#8E7AD6', '#DCD2F7', '#E9A23B'];
const CELL_NAMES = ['top left', 'top middle', 'top right', 'middle left', 'center', 'middle right', 'bottom left', 'bottom middle', 'bottom right'];

export function mount(el, ctx) {
  const S = ctx.state;
  let g = null;
  const myMark = () => (S.me.who === 'her' ? 'X' : 'O');
  const nameOf = (m) => (m === 'X' ? (S.me.who === 'her' ? S.me.name : S.otherName) : (S.me.who === 'him' ? S.me.name : S.otherName));

  function status() {
    if (g.winner === 'draw') return 'A draw, a cozy one';
    if (g.winner) return g.winner === myMark() ? 'You win!' : `${nameOf(g.winner)} wins!`;
    return g.turn === myMark() ? `Your move, ${S.me.name}` : `Waiting on ${nameOf(g.turn)}`;
  }

  function player(mark, who) {
    const over = !!g.winner;
    const turn = !over && g.turn === mark;
    const label = g.turn === myMark() ? 'Your turn' : 'Their turn';
    return `<div class="xo-player${turn ? ' turn' : ''}"><span class="xo-ava" aria-hidden="true">${renderCharacter({ who, pose: 'stand', item: 'none', scale: 0.3 })}</span>
      <div><div class="xo-pn">${esc(nameOf(mark))} · ${mark}</div>${turn ? `<div class="lab glow">${label}</div>` : ''}</div></div>`;
  }

  function render() {
    if (!g) return;
    const act = document.activeElement?.dataset?.i;
    const mine = g.turn === myMark() && !g.winner;
    const filled = g.board.filter(Boolean).length;
    const won = g.winner && g.winner !== 'draw';
    el.innerHTML = `<div class="xo-view"><div class="xo-card">
      <div class="xo-head"><h2>XO by the window</h2><span class="lab">Move ${Math.min(filled + 1, 9)} of 9</span></div>
      <div class="xo-players">${player('X', 'her')}${player('O', 'him')}</div>
      <div class="xo-status" role="status" aria-live="polite">${esc(status())}</div>
      <div class="xo-boardwrap"><div class="xo-board" role="group" aria-label="Tic-tac-toe circuit board">
        <i class="ln v1"></i><i class="ln v2"></i><i class="ln h1"></i><i class="ln h2"></i>
        <div class="xo-grid">${g.board.map((m, i) => {
          const win = g.line?.includes(i);
          const label = `${CELL_NAMES[i]}, ${m ? `${nameOf(m)}'s ${m}` : 'empty'}${win ? ', winning line' : ''}`;
          return `<button class="xo-cell${win ? ' win' : ''}" data-i="${i}" aria-label="${esc(label)}" ${!mine || m ? 'aria-disabled="true"' : ''}>${m === 'X' ? '<i class="pc-x glow a"></i><i class="pc-x glow b"></i>' : m === 'O' ? '<i class="pc-o glow"></i>' : ''}</button>`;
        }).join('')}</div></div>
        <div class="xo-caps lab"><span>U1 · XO-3x3</span><span>X lilac LED · O butter LED</span><span>Rev A</span></div></div>
      <div class="xo-score">${esc(nameOf('X'))} ${g.scores.X} · ${esc(nameOf('O'))} ${g.scores.O}${g.scores.draw ? ` · draws ${g.scores.draw}` : ''}</div>
      <div class="xo-btns"><button class="btn" id="again" ${g.winner ? '' : 'hidden'}>Play again</button><button class="btn violet" id="clear">Reset score</button></div>
      <p class="xo-foot">Moves sync through the same backend as presence. Async play works, and each move notifies the other.</p>
      ${won ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="left:${(i * 37) % 100}%;width:${7 + (i % 3) * 4}px;height:${7 + (i % 3) * 4}px;border-radius:${i % 2 ? '50%' : '3px'};background:${CONF[i % 6]};animation-duration:${(2.4 + (i % 5) * 0.4).toFixed(1)}s;animation-delay:-${((i * 7) % 20) / 10}s"></i>`).join('')}</div>` : ''}
    </div></div>`;
    if (act != null) el.querySelector(`[data-i="${act}"]`)?.focus();
  }

  el.addEventListener('click', async (e) => {
    try {
      const c = e.target.closest('.xo-cell');
      if (c) {
        if (c.getAttribute('aria-disabled') === 'true') return ctx.toast(g.winner ? 'This round is over. Play again?' : g.board[c.dataset.i] ? 'That spot is taken.' : `It's ${nameOf(g.turn)}'s turn.`);
        g = await ctx.backend.xo.move(Number(c.dataset.i));
        render();
      } else if (e.target.closest('#again')) { g = await ctx.backend.xo.reset(); render(); }
      else if (e.target.closest('#clear')) {
        if (await ctx.confirm('Reset the score and start a fresh board?', { ok: 'Reset' })) { g = await ctx.backend.xo.reset({ scores: true }); render(); }
      }
    } catch (err) { ctx.toast(err.message); }
  });

  ctx.backend.xo.get().then((x) => { g = x; render(); });
  const unsub = ctx.backend.xo.onChange((x) => { g = x; render(); });
  return { update: render, unmount() { unsub?.(); } };
}
