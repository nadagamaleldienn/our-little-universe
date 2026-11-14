// Mailbox: sealed and opened envelopes, lavender paper, and "leave it at <place>".
import { LOCATIONS, esc, locName, sealSvg } from '../util.js';

const SEALS = [['star', 'Star'], ['heart', 'Heart'], ['chip', 'Chip']];

export function mount(el, ctx) {
  const S = ctx.state;
  let list = [];
  let unsub = null;

  async function load() {
    try { list = await ctx.backend.letters.list(); } catch (e) { ctx.toast(e.message); }
    render();
  }
  const when = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  function env(l) {
    const mine = l.from === S.me.who;
    const opened = mine || !!l.readAt;
    const who = mine ? `You, to ${S.otherName}` : `From ${S.otherName}`;
    return `<button class="env-card ${opened ? 'opened' : 'sealed'}" data-id="${l.id}" aria-label="${opened ? 'Opened' : 'Sealed'} letter. ${esc(who)}, left at ${esc(locName(l.location))}, ${when(l.createdAt)}">
      <span class="env-art" aria-hidden="true"><svg viewBox="0 0 120 80"><rect x="4" y="12" width="112" height="64" rx="8" fill="#DCD2F7"/>${opened ? '<path d="M4 20l56 -16 56 16" fill="#B9A6EC"/>' : '<path d="M4 14l56 38 56 -38" fill="#B9A6EC"/>'}<path d="M4 76l44 -34M116 76l-44 -34" stroke="#8E7AD6" stroke-width="2" fill="none"/></svg>${opened ? '' : sealSvg(l.seal)}</span>
      <span class="env-meta"><strong>${esc(who)}</strong><span class="muted">${esc(locName(l.location))} · ${when(l.createdAt)}</span></span></button>`;
  }

  function render() {
    const inbox = list.filter((l) => l.to === S.me.who);
    const sent = list.filter((l) => l.from === S.me.who);
    el.innerHTML = `<div class="letters">
      <div class="row between"><h2>Mailbox</h2><button class="btn" id="compose">Write a letter</button></div>
      <h3>Left for you</h3>${inbox.length ? `<div class="env-grid">${inbox.map(env).join('')}</div>` : '<p class="muted">No letters yet. Maybe one is on its way.</p>'}
      <h3>Left by you</h3>${sent.length ? `<div class="env-grid">${sent.map(env).join('')}</div>` : '<p class="muted">Nothing left behind yet.</p>'}
    </div>`;
  }

  function paper(l) {
    const mine = l.from === S.me.who;
    const d = document.createElement('dialog');
    d.className = 'modal paper-modal';
    d.setAttribute('aria-label', 'Letter');
    d.innerHTML = `<article class="paper"><header><span class="muted-dark">${mine ? `To ${esc(S.otherName)}` : `From ${esc(S.otherName)}`} · left at ${esc(locName(l.location))} · ${when(l.createdAt)}</span>${sealSvg(l.seal)}</header>
      <p class="paper-text">${esc(l.text)}</p><form method="dialog" class="row end"><button class="btn">Fold it back up</button></form></article>`;
    d.addEventListener('close', () => d.remove());
    document.body.appendChild(d);
    d.showModal();
    // Reading is private: we only record it for the reader. Nobody is notified.
    if (!mine && !l.readAt) {
      ctx.backend.letters.markRead(l.id).then(() => { l.readAt = Date.now(); render(); }).catch(() => {});
    }
  }

  function compose() {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.setAttribute('aria-label', 'Write a letter');
    d.innerHTML = `<form class="compose" method="dialog">
      <h2>A letter for ${esc(S.otherName)}</h2>
      <label>Your words<textarea name="text" rows="7" maxlength="3000" required placeholder="Write something small and warm…"></textarea></label>
      <label>Leave it at<select name="loc">${LOCATIONS.map((l) => `<option value="${l.id}" ${l.id === S.location ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
      <fieldset><legend>Seal</legend><div class="seal-choice">${SEALS.map(([id, n], i) => `<label class="seal-opt"><input type="radio" name="seal" value="${id}" ${i === 0 ? 'checked' : ''}>${sealSvg(id)}<span>${n}</span></label>`).join('')}</div></fieldset>
      <div class="row end"><button type="button" class="btn ghost" data-cancel>Not now</button><button class="btn" value="send">Seal &amp; leave it</button></div></form>`;
    d.querySelector('[data-cancel]').onclick = () => d.close();
    d.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await ctx.backend.letters.send({ to: S.otherWho, location: f.get('loc'), text: String(f.get('text')).trim(), seal: f.get('seal') });
        ctx.toast(`Sealed and left at ${locName(f.get('loc'))}.`);
        d.close();
        load();
      } catch (err) { ctx.toast(err.message); }
    });
    d.addEventListener('close', () => d.remove());
    document.body.appendChild(d);
    d.showModal();
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('#compose')) return compose();
    const c = e.target.closest('.env-card');
    if (c) { const l = list.find((x) => x.id === c.dataset.id); if (l) paper(l); }
  });

  load().then(() => {
    const id = ctx.params?.open;
    const l = id && list.find((x) => x.id === id);
    if (l) paper(l);
  });
  unsub = ctx.backend.letters.onNew(() => load());
  return { update() {}, unmount() { unsub?.(); } };
}
