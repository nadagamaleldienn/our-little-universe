// Home view: the Cozy Corner scene, weather picker, wave button and quick spot chips.
import { createScene, SPOTS } from '../scene.js';
import { createWeather, WEATHERS } from '../weather.js';
import { ACTIVITIES, locName, esc, relTime } from '../util.js';

export function mount(el, ctx) {
  const S = ctx.state;
  el.innerHTML = `<div class="home">
    <div class="scene-wrap"></div>
    <div class="home-bar">
      <div class="weather-bar" role="group" aria-label="Weather">${Object.entries(WEATHERS).map(([id, w]) => `<button class="pill" data-weather="${id}" aria-pressed="false"><span aria-hidden="true">${w.glyph}</span> ${w.label}</button>`).join('')}</div>
      <button class="btn wave-btn" id="wave" hidden aria-label="Wave hello">Wave <span aria-hidden="true">👋</span></button>
    </div>
    <div class="chips" role="group" aria-label="Pick a spot">${Object.entries(ACTIVITIES).map(([id, a]) => `<button class="pill" data-zone="${id}" aria-pressed="false">${esc(a.name)}</button>`).join('')}</div>
    <p class="hint">Tap a spot in the room and your character walks over. Tap it again to stop. This is a pretend world.</p>
  </div>`;
  const scene = createScene(el.querySelector('.scene-wrap'), { onZone: (id) => ctx.setActivity(id), onChip: (loc) => ctx.travel(loc) });
  const weather = createWeather(scene.fxHost);

  el.addEventListener('click', (e) => {
    const w = e.target.closest('[data-weather]');
    if (w) return ctx.setWeather(w.dataset.weather);
    const z = e.target.closest('.chips [data-zone]');
    if (z) return ctx.setActivity(z.dataset.zone);
    if (e.target.closest('#wave')) ctx.wave();
  });

  function update() {
    const st = S.otherStatus;
    const mySpot = SPOTS[S.activity] ? S.activity : 'idle';
    const me = S.location === 'cozy' ? { who: S.me.who, spot: mySpot, name: S.me.name } : null;
    const hereLive = st.kind === 'live' && st.loc === 'cozy';
    const hereGhost = st.kind === 'last' && st.loc === 'cozy';
    const other = hereLive || hereGhost
      ? { who: S.otherWho, spot: SPOTS[st.act] ? st.act : 'idle', name: S.otherName, faded: hereGhost, tag: hereGhost ? `last here ${relTime(st.at)}` : '' }
      : null;
    let chip = null;
    if (st.kind === 'live' && st.loc !== 'cozy') {
      chip = { text: `${S.otherName} is at ${locName(st.loc)}${ACTIVITIES[st.act] ? ' · ' + ACTIVITIES[st.act].label : ''}`, loc: st.loc };
    } else if (S.location !== 'cozy') {
      chip = { text: `You're at ${locName(S.location)}. Walk back to Cozy Corner`, loc: 'cozy' };
    }
    scene.update({ me, other, chip });
    weather.set(S.me.settings.weather);
    el.querySelectorAll('[data-weather]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.weather === S.me.settings.weather)));
    el.querySelectorAll('.chips [data-zone]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === S.activity && S.location === 'cozy')));
    el.querySelector('#wave').hidden = st.kind !== 'live';
  }
  update();
  return {
    update,
    wave: (who) => scene.wave(who),
    unmount() { weather.destroy(); scene.destroy(); }
  };
}
