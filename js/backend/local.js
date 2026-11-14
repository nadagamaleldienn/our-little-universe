// Local demo backend: data lives in localStorage, changes are announced over a
// BroadcastChannel so two tabs (tab 1 as Her, tab 2 as Him) behave like two devices.
// The "who am I" choice lives in sessionStorage, so each tab can be a different person.
import { defaultSettings, mergeDeep, ID, PLANT_TYPES } from '../util.js';
import { freshGame, applyMove } from './xo-logic.js';

const NS = 'olu:';
const rd = (k, d) => { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const wr = (k, v) => localStorage.setItem(NS + k, JSON.stringify(v));
const getWho = () => sessionStorage.getItem(NS + 'who');
const otherOf = (w) => (w === 'her' ? 'him' : 'her');
const STALE_MS = 60000;

export function createLocalBackend() {
  const tabId = ID();
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('olu-universe') : null;
  const subs = {};
  const sub = (topic, cb) => { (subs[topic] ??= new Set()).add(cb); return () => subs[topic].delete(cb); };
  const fire = (topic, data) => subs[topic]?.forEach((cb) => { try { cb(data); } catch (e) { console.error(e); } });
  const publish = (topic) => { fire(topic); bc?.postMessage({ t: 'change', topic }); };

  // ---------- presence ----------
  const peers = new Map(); // tabId -> {state, seen}
  let myState = null;
  let hb = 0;
  let prune = 0;
  const announce = () => myState && bc?.postMessage({ t: 'presence', id: tabId, state: myState });
  const emitPeers = () => {
    const me = getWho();
    fire('peers', [...peers.values()].filter((p) => p.state.who !== me).map((p) => p.state));
  };
  const startPrune = () => {
    if (prune) return;
    prune = setInterval(() => {
      let changed = false;
      for (const [id, p] of peers) if (Date.now() - p.seen > STALE_MS) { peers.delete(id); changed = true; }
      if (changed) emitPeers();
    }, 5000);
  };
  if (bc) {
    bc.onmessage = (e) => {
      const m = e.data;
      if (m.t === 'change') fire(m.topic);
      else if (m.t === 'presence') { peers.set(m.id, { state: m.state, seen: Date.now() }); emitPeers(); }
      else if (m.t === 'leave') { peers.delete(m.id); emitPeers(); }
      else if (m.t === 'hello') announce();
      else if (m.t === 'wave' && m.who !== getWho()) fire('wave', m);
    };
  }
  window.addEventListener('beforeunload', () => { if (myState) bc?.postMessage({ t: 'leave', id: tabId }); });

  const presence = {
    async join(state) {
      myState = state;
      announce();
      clearInterval(hb);
      hb = setInterval(announce, 30000); // heartbeat
      startPrune();
    },
    async update(state) { myState = { ...myState, ...state }; announce(); },
    async leave() { clearInterval(hb); if (myState) bc?.postMessage({ t: 'leave', id: tabId }); myState = null; },
    onPeers(cb) { const u = sub('peers', cb); startPrune(); bc?.postMessage({ t: 'hello' }); return u; },
    async wave() { bc?.postMessage({ t: 'wave', who: getWho() }); },
    onWave(cb) { return sub('wave', cb); }
  };

  // ---------- profile ----------
  const defName = (w) => (w === 'her' ? 'Her' : 'Him');
  function ensureProfile(who) {
    if (!rd('profile:' + who, null)) wr('profile:' + who, { character: who, display_name: defName(who), settings: defaultSettings() });
  }
  const profile = {
    async get() {
      const w = getWho();
      const p = rd('profile:' + w, null) || { character: w, display_name: defName(w), settings: defaultSettings() };
      return { ...p, settings: mergeDeep(defaultSettings(), p.settings || {}) };
    },
    async set(patch) {
      const w = getWho();
      const cur = await this.get();
      const next = { ...cur, display_name: patch.display_name ?? cur.display_name, settings: mergeDeep(cur.settings, patch.settings || {}) };
      wr('profile:' + w, next);
      publish('profile');
      return next;
    },
    async getOther() { return rd('profile:' + otherOf(getWho()), null); },
    async deleteMine() {
      const w = getWho();
      localStorage.removeItem(NS + 'profile:' + w);
      localStorage.removeItem(NS + 'notifs:' + w);
      const ls = rd('lastSeen', {}); delete ls[w]; wr('lastSeen', ls);
      wr('letters', rd('letters', []).filter((l) => l.from !== w));
      wr('plants', rd('plants', []).filter((p) => p.by !== w));
      for (const t of ['lastSeen', 'letters', 'plants']) publish(t);
    }
  };

  // ---------- auth ----------
  const auth = {
    mode: 'local',
    async signIn(who) {
      if (who !== 'her' && who !== 'him') throw new Error('Pick Her or Him.');
      sessionStorage.setItem(NS + 'who', who);
      ensureProfile(who);
      return { id: who, who, email: null };
    },
    async currentUser() { const w = getWho(); return w ? { id: w, who: w, email: null } : null; },
    async signOut() { await presence.leave(); sessionStorage.removeItem(NS + 'who'); }
  };

  // ---------- last seen ----------
  const lastSeen = {
    async save({ location, activity, visibility }) {
      const w = getWho();
      const m = rd('lastSeen', {});
      m[w] = { who: w, location, activity, visibility, at: Date.now() };
      wr('lastSeen', m);
      publish('lastSeen');
    },
    watch(cb) { cb(rd('lastSeen', {})); return sub('lastSeen', () => cb(rd('lastSeen', {}))); }
  };

  // ---------- letters ----------
  const letters = {
    async list() { return [...rd('letters', [])].sort((a, b) => b.createdAt - a.createdAt); },
    async send({ to, location, text, seal }) {
      const l = { id: ID(), from: getWho(), to, location, text, seal, createdAt: Date.now(), readAt: null };
      wr('letters', [...rd('letters', []), l]);
      publish('letters');
      return l;
    },
    // readAt is stored for the reader's own bookkeeping; the UI never shows it to the sender.
    async markRead(id) {
      wr('letters', rd('letters', []).map((l) => (l.id === id && !l.readAt ? { ...l, readAt: Date.now() } : l)));
    },
    onNew(cb) {
      const known = new Set(rd('letters', []).map((l) => l.id));
      return sub('letters', () => {
        for (const l of rd('letters', [])) if (!known.has(l.id)) { known.add(l.id); if (l.to === getWho()) cb(l); }
      });
    }
  };

  // ---------- xo ----------
  const mark = () => (getWho() === 'her' ? 'X' : 'O');
  const xo = {
    async get() { let g = rd('xo', null); if (!g) { g = freshGame(); wr('xo', g); } return g; },
    async move(i) {
      const g = rd('xo', null) || freshGame();
      const n = applyMove(g, i, mark());
      if (!n) throw new Error("That move isn't available right now.");
      wr('xo', n); publish('xo');
      return n;
    },
    async reset({ scores = false } = {}) {
      const g = rd('xo', null) || freshGame();
      const n = freshGame(scores ? null : g.scores);
      wr('xo', n); publish('xo');
      return n;
    },
    onChange(cb) { return sub('xo', () => cb(rd('xo', freshGame()))); }
  };

  // ---------- plants ----------
  const P = () => rd('plants', []);
  const L = () => rd('plantLog', []);
  function logIt(plant, action) {
    const l = L();
    l.unshift({ id: ID(), plantId: plant.id, plantName: plant.label, by: getWho(), action, at: Date.now() });
    wr('plantLog', l.slice(0, 100));
  }
  async function care(id, field, action) {
    const ps = P();
    const p = ps.find((x) => x.id === id);
    if (!p) return;
    p[field] = Date.now();
    wr('plants', ps); logIt(p, action); publish('plants');
  }
  const plants = {
    async list() { return P(); },
    async add({ type, potColor }) {
      const t = PLANT_TYPES.find((x) => x.id === type) || PLANT_TYPES[0];
      const p = { id: ID(), type: t.id, label: t.name, potColor, by: getWho(), plantedAt: Date.now(), wateredAt: Date.now(), sunAt: null, sungAt: null };
      wr('plants', [...P(), p]); logIt(p, 'plant'); publish('plants');
      return p;
    },
    water: (id) => care(id, 'wateredAt', 'water'),
    sun: (id) => care(id, 'sunAt', 'sun'),
    sing: (id) => care(id, 'sungAt', 'sing'),
    async remove(id) {
      const p = P().find((x) => x.id === id);
      if (!p) return;
      wr('plants', P().filter((x) => x.id !== id)); logIt(p, 'remove'); publish('plants');
    },
    async log(limit = 30) { return L().slice(0, limit); },
    onChange(cb) { return sub('plants', () => cb({ plants: P(), log: L() })); }
  };

  return { mode: 'local', auth, presence, lastSeen, letters, xo, plants, profile };
}
