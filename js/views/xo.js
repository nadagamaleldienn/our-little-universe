// Tic-tac-toe drawn as a PCB with glowing LED pieces. Her = X, Him = O.
import { esc } from '../util.js';

export function mount(el, ctx) {
  const S = ctx.state;
  let g = null;
  const myMark = () => (S.me.who === 'her' ? 'X' : 'O');
  const nameOf = (m) => (m === 'X' ? (S.me.who === 'her' ? S.me.name : S.otherName) : (S.me.who === 'him' ? S.me.name : S.otherName));

  function status() {
    if (g.winner === 'draw') return 'A draw. Everyone gets a cozy point.';
    if (g.winner) return g.winner === myMark() ? 'You win! 🎉' : `${nameOf(g.winner)} wins this round.`;
    return g.turn === myMark() ? 'Your move.' : `Waiting for ${nameOf(g.turn)}…`;
  }

  function render() {
    if (!g) return;
    const act = document.activeElement?.dataset?.i;
    const mine = g.turn === myMark() && !g.winner;
    el.innerHTML = `<div class="xo">
      <div class="card xo-head">
        <div class="score" aria-label="Score"><span class="s-x">${esc(nameOf('X'))} (X) <b>${g.scores.X}</b></span><span class="s-d">Draws <b>${g.scores.draw}</b></span><span class="s-o">${esc(nameOf('O'))} (O) <b>${g.scores.O}</b></span></div>
        <p class="xo-status" role="status" aria-live="polite">${esc(status())}</p>
      </div>
      <div class="pcb" role="group" aria-label="Tic-tac-toe circuit board">${g.board.map((m, i) => {
        const win = g.line?.includes(i);
        const label = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}: ${m ? `${nameOf(m)}'s ${m}` : 'empty'}${win ? ', winning line' : ''}`;
        return `<button class="cell ${m ? 'on' : ''} ${win ? 'win' : ''}" data-i="${i}" aria-label="${esc(label)}" ${!mine || m ? 'aria-disabled="true"' : ''}>${m ? `<span class="led ${m === 'X' ? 'x' : 'o'}" aria-hidden="true"></span>` : '<span class="via" aria-hidden="true"></span>'}</button>`;
      }).join('')}</div>
      <div class="row"><button class="btn" id="again" ${g.winner ? '' : 'hidden'}>Play again</button><button class="btn ghost" id="clear">Reset score</button></div>
    </div>`;
    if (act != null) el.querySelector(`[data-i="${act}"]`)?.focus();
  }

  el.addEventListener('click', async (e) => {
    try {
      const c = e.target.closest('.cell');
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
