// Letters (design/Letters.dc.html): the letter tray, an open sheet of paper and the composer,
// laid out as three panels on a wide screen and stacked on a phone.
import { LOCATIONS, esc, locName } from '../util.js';

const SEALS = [['star', 'butter', 'Butter wax seal', 'Butter wax'], ['heart', 'violet', 'Violet wax seal', 'Violet wax'], ['chip', 'chip', 'Chip-shaped seal', 'Chip seal']];
const STAR = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7 7 .6-5.3 4.8 1.6 7.1L12 17.8 5.7 21.5l1.6-7.1L2 9.6 9 9z"/></svg>';
const sealCls = (k) => (SEALS.find((s) => s[0] === k) || SEALS[0])[1];
const seal = (k) => `<span class="seal ${sealCls(k)}" aria-hidden="true">${STAR}</span>`;

export function mount(el, ctx) {
  const S = ctx.state;
  const params = { ...(ctx.params || {}) };
  let list = [];
  let sel = null;
  let draft = '';
  let place = S.location || 'cozy';
  let sealKind = 'star';
  let unsub = null;

  const when = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const nameOf = (who) => (who === S.me.who ? S.me.name : S.otherName);
  const isOpen = (l) => l.from === S.me.who || !!l.readAt;
  const sorted = () => list.slice().sort((a, b) => b.createdAt - a.createdAt);
  const mine = (l) => l.from === S.me.who;
  const fromLabel = (l) => (mine(l) ? `To ${S.otherName}` : `From ${S.otherName}`);

  el.innerHTML = `<div class="letters-view">
    <div class="lv-head"><h2>Letters</h2><span class="lab">Leave one · find one · nothing is live</span></div>
    <div class="lv-cols">
      <section class="lv-tray" aria-label="The letter tray">
        <div class="lv-trayhead"><span class="lv-box" aria-hidden="true"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="e"></i></span><div><div class="lv-t">The letter tray</div><div class="lab" id="trayCount"></div></div></div>
        <div class="lv-list" id="trayList"></div>
      </section>
      <section class="lv-paperwrap" aria-label="Open letter"><div class="lab lv-lab">Open letter</div><div class="lv-paper" id="paper"></div></section>
      <section class="lv-composer" aria-label="Write a letter"><div class="lab lv-lab">Write a letter</div>
        <form class="lv-form" id="compose">
          <div><div class="lab lv-fl">To</div><div class="lv-to">${esc(S.otherName)}</div></div>
          <div><label for="place" class="lab lv-fl">Leave it at</label><select id="place" class="fld">${LOCATIONS.map((l) => `<option value="${l.id}" ${l.id === place ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
          <div><label for="draft" class="lab lv-fl">Your letter</label><textarea id="draft" class="fld lv-draft" maxlength="3000" placeholder="A few gentle words"></textarea></div>
          <div><div class="lab lv-fl">Seal</div><div class="lv-seals">${SEALS.map(([id, c, label]) => `<button type="button" class="sw-seal" data-seal="${id}" aria-pressed="${id === sealKind}" aria-label="${label}"><span class="seal ${c}" aria-hidden="true">${STAR}</span></button>`).join('')}</div><div class="lab lv-sealname" id="sealName"></div></div>
          <button class="btn lv-send">Seal &amp; leave it</button>
        </form>
      </section>
    </div>
    <p class="lv-foot">Letters wait at the place you leave them. ${esc(S.otherName)} gets a gentle notification if they allowed it, and nobody is told when a letter is read.</p>
  </div>`;
  const q = (s) => el.querySelector(s);
  q('#draft').value = draft;

  function renderTray() {
    const all = sorted();
    const inbox = all.filter((l) => l.to === S.me.who);
    // Sent letters first (as on the board), then what was left for you.
    const ordered = all.filter(mine).concat(inbox);
    q('#trayCount').textContent = `${inbox.filter((l) => !l.readAt).length} sealed · ${ordered.length} total`;
    q('#trayList').innerHTML = ordered.length ? ordered.map((l) => {
      const open = isOpen(l);
      const aria = `${fromLabel(l)}, left at ${locName(l.location)}, ${when(l.createdAt)}, ${open ? 'opened' : 'sealed'}`;
      return `<button class="lv-env${sel === l.id ? ' picked' : ''}${open ? ' open' : ''}" data-id="${l.id}" aria-label="${esc(aria)}" aria-pressed="${sel === l.id}">
        <span class="lv-ico">${open ? '<span class="lv-openenv"></span>' : seal(l.seal)}</span>
        <span class="lv-meta"><span class="lab lv-from">${esc(fromLabel(l))}</span><span class="lv-place">${esc(locName(l.location))}</span><span class="lv-date">${when(l.createdAt)}</span></span></button>`;
    }).join('') : '<p class="muted lv-empty">No letters yet. Maybe one is on its way.</p>';
  }

  function renderPaper() {
    const l = list.find((x) => x.id === sel);
    q('#paper').innerHTML = l ? `<div class="lv-ph"><div><div class="lab lv-pf">${esc(fromLabel(l))}</div><div class="lv-pp">${esc(locName(l.location))}</div><div class="lv-pd">${when(l.createdAt)}</div></div>
        <div class="lv-stamp" aria-hidden="true"><i></i><i></i><span class="lab">Rev A</span><span class="lab">Delivered</span></div></div>
      <div class="lv-body">${esc(l.text)}</div><div class="lv-sign">— ${esc(nameOf(l.from))}</div>`
      : `<div class="lv-ph"><div><div class="lab lv-pf">No letter open</div><div class="lv-pp">Pick an envelope</div></div></div><div class="lv-body">Choose a sealed envelope from the tray to open it here.</div>`;
  }

  async function choose(id) {
    sel = id;
    const l = list.find((x) => x.id === id);
    if (l && l.to === S.me.who && !l.readAt) {
      // Reading is private: it is recorded for the reader only. Nobody is notified.
      l.readAt = Date.now();
      ctx.backend.letters.markRead(id).then(() => ctx.refreshMail?.()).catch(() => {});
    }
    renderTray();
    renderPaper();
  }

  async function load(pick) {
    try { list = await ctx.backend.letters.list(); } catch (e) { ctx.toast(e.message); }
    if (pick) sel = pick;
    else if (!list.some((x) => x.id === sel)) {
      const first = sorted().find((l) => l.to === S.me.who && !l.readAt) || sorted()[0];
      sel = first ? first.id : null;
    }
    renderTray();
    renderPaper();
  }

  el.addEventListener('click', (e) => {
    const c = e.target.closest('.lv-env');
    if (c) return choose(c.dataset.id);
    const s = e.target.closest('[data-seal]');
    if (s) {
      sealKind = s.dataset.seal;
      el.querySelectorAll('[data-seal]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.seal === sealKind)));
      q('#sealName').textContent = SEALS.find((x) => x[0] === sealKind)[3];
    }
  });
  q('#sealName').textContent = SEALS[0][3];
  q('#draft').addEventListener('input', (e) => { draft = e.target.value; });
  q('#place').addEventListener('change', (e) => { place = e.target.value; });
  q('#compose').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return ctx.toast('Write a few words first');
    try {
      const before = new Set(list.map((x) => x.id));
      await ctx.backend.letters.send({ to: S.otherWho, location: place, text, seal: sealKind });
      draft = '';
      q('#draft').value = '';
      ctx.toast(`Your letter is waiting at ${locName(place)}`);
      await load();
      const fresh = sorted().find((l) => !before.has(l.id) && mine(l));
      if (fresh) choose(fresh.id);
    } catch (err) { ctx.toast(err.message); }
  });

  load(params.open).then(() => { if (params.compose) q('#draft')?.focus(); });
  unsub = ctx.backend.letters.onNew(() => load());
  return { update() {}, unmount() { unsub?.(); } };
}
