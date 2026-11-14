// Supabase backend. Same interface as local.js (see index.js).
// The anon key is public by design; Row Level Security in supabase/schema.sql is the protection.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { defaultSettings, mergeDeep, PLANT_TYPES, defaultName } from '../util.js';
import { freshGame, applyMove } from './xo-logic.js';

const iso = () => new Date().toISOString();
const ms = (t) => (t ? new Date(t).getTime() : null);
const fail = (error) => { if (error) throw new Error(error.message || String(error)); };

export function createSupabaseBackend({ url, key }) {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let cached = null; // { id, email, who, row }

  async function meRow(force = false) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { cached = null; return null; }
    if (!cached || cached.id !== session.user.id || force) {
      const { data } = await sb.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
      cached = { id: session.user.id, email: session.user.email, who: data?.character || null, row: data || null };
    }
    return cached;
  }
  const need = async () => { const m = await meRow(); if (!m) throw new Error('Not signed in.'); return m; };
  const needWho = async () => { const m = await need(); if (!m.who) throw new Error('Pick who you are first.'); return m; };

  function watchTables(tables, handler) {
    const ch = sb.channel('tbl-' + tables.join('-') + '-' + Math.random().toString(36).slice(2));
    for (const t of tables) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) => handler(t, p));
    ch.subscribe();
    return () => sb.removeChannel(ch);
  }

  // ---------- auth ----------
  const auth = {
    mode: 'supabase',
    async signIn(email, password) {
      if (password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error('That email and password did not match. Use the magic link once, then set a password in Settings.');
        return 'signed-in';
      }
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } });
      fail(error);
      return 'link-sent';
    },
    async setPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      fail(error);
    },
    async currentUser() { const m = await meRow(true); return m ? { id: m.id, email: m.email, who: m.who } : null; },
    async signOut() { cached = null; await sb.auth.signOut(); }
  };

  // ---------- presence (Realtime Presence on the private channel "universe") ----------
  let ch = null;
  let myState = null;
  const peerCbs = new Set();
  const waveCbs = new Set();
  async function ensure() {
    if (ch) return ch;
    const m = await need();
    ch = sb.channel('universe', { config: { private: true, presence: { key: m.id }, broadcast: { self: false } } });
    const emit = () => {
      const list = Object.values(ch.presenceState()).flat().filter((p) => p.who && p.userId !== m.id);
      peerCbs.forEach((cb) => cb(list));
    };
    ch.on('presence', { event: 'sync' }, emit).on('presence', { event: 'join' }, emit).on('presence', { event: 'leave' }, emit);
    ch.on('broadcast', { event: 'wave' }, ({ payload }) => waveCbs.forEach((cb) => cb(payload)));
    await new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(); }));
    return ch;
  }
  const presence = {
    async join(state) { myState = state; const c = await ensure(); await c.track(state); },
    async update(state) { myState = { ...myState, ...state }; if (ch) await ch.track(myState); },
    async leave() { if (ch) await ch.untrack(); myState = null; },
    onPeers(cb) { peerCbs.add(cb); ensure().catch(console.error); return () => peerCbs.delete(cb); },
    async wave() { const c = await ensure(); const m = await need(); await c.send({ type: 'broadcast', event: 'wave', payload: { who: m.who } }); },
    onWave(cb) { waveCbs.add(cb); ensure().catch(console.error); return () => waveCbs.delete(cb); }
  };

  // ---------- profile ----------
  const toProfile = (row) => row
    ? { character: row.character, display_name: row.display_name, settings: mergeDeep(defaultSettings(), row.settings || {}) }
    : { character: null, display_name: '', settings: defaultSettings() };
  const profile = {
    async get() { const m = await meRow(true); return toProfile(m?.row); },
    async set(patch) {
      const m = await need();
      const cur = toProfile(m.row);
      const character = patch.character ?? m.who;
      if (!character) throw new Error('Pick who you are first.');
      const row = {
        user_id: m.id,
        character,
        display_name: patch.display_name ?? (cur.display_name || defaultName(character)),
        settings: mergeDeep(cur.settings, patch.settings || {}),
        updated_at: iso()
      };
      const { error } = await sb.from('profiles').upsert(row);
      if (error) throw new Error(error.code === '23505' ? 'That character is already taken.' : error.message);
      return toProfile((await meRow(true)).row);
    },
    async getOther() {
      const m = await need();
      const { data } = await sb.from('profiles').select('character,display_name').neq('user_id', m.id).limit(1).maybeSingle();
      return data || null;
    },
    async deleteMine() {
      const m = await needWho();
      await sb.from('last_seen').delete().eq('user_id', m.id);
      await sb.from('letters').delete().eq('sender', m.id);
      await sb.from('plants').delete().eq('by_char', m.who);
      const { error } = await sb.from('profiles').delete().eq('user_id', m.id);
      fail(error);
      cached = null;
    }
  };

  // ---------- last seen ----------
  const lastSeen = {
    async save({ location, activity, visibility }) {
      const m = await needWho();
      const { error } = await sb.from('last_seen').upsert({ user_id: m.id, character: m.who, location, activity, visibility, updated_at: iso() });
      fail(error);
    },
    watch(cb) {
      const load = async () => {
        const { data } = await sb.from('last_seen').select('*');
        const map = {};
        for (const r of data || []) map[r.character] = { who: r.character, location: r.location, activity: r.activity, visibility: r.visibility, at: ms(r.updated_at) };
        cb(map);
      };
      load();
      return watchTables(['last_seen'], load);
    }
  };

  // ---------- letters ----------
  const toLetter = (r) => ({ id: r.id, from: r.from_char, to: r.to_char, location: r.location, text: r.body, seal: r.seal, createdAt: ms(r.created_at), readAt: ms(r.read_at) });
  const letters = {
    async list() {
      const { data, error } = await sb.from('letters').select('*').order('created_at', { ascending: false });
      fail(error);
      return (data || []).map(toLetter);
    },
    async send({ to, location, text, seal }) {
      const m = await needWho();
      const { data, error } = await sb.from('letters').insert({ sender: m.id, from_char: m.who, to_char: to, location, body: text, seal }).select().single();
      fail(error);
      return toLetter(data);
    },
    // read_at is only for the reader's own bookkeeping; the UI never shows it to the sender.
    async markRead(id) {
      const m = await needWho();
      await sb.from('letters').update({ read_at: iso() }).eq('id', id).eq('to_char', m.who).is('read_at', null);
    },
    onNew(cb) {
      return watchTables(['letters'], async (_t, p) => {
        if (p.eventType !== 'INSERT') return;
        const m = await meRow();
        const l = toLetter(p.new);
        if (m && l.to === m.who) cb(l);
      });
    }
  };

  // ---------- xo ----------
  const toGame = (r) => ({ board: r.board, turn: r.turn, winner: r.winner, line: r.line, scores: r.scores, rev: r.rev, updatedAt: ms(r.updated_at) });
  async function getGame() {
    const { data } = await sb.from('xo_game').select('*').eq('id', 1).maybeSingle();
    if (data) return toGame(data);
    const g = freshGame();
    await sb.from('xo_game').upsert({ id: 1, board: g.board, turn: g.turn, winner: null, line: null, scores: g.scores, rev: 0 });
    const { data: d2 } = await sb.from('xo_game').select('*').eq('id', 1).single();
    return toGame(d2);
  }
  async function saveGame(old, n) {
    // Optimistic concurrency: only succeeds if nobody moved since we read the row.
    const { data, error } = await sb.from('xo_game')
      .update({ board: n.board, turn: n.turn, winner: n.winner, line: n.line, scores: n.scores, rev: old.rev + 1, updated_at: iso() })
      .eq('id', 1).eq('rev', old.rev).select().maybeSingle();
    fail(error);
    if (!data) throw new Error('The board changed. Take another look.');
    return toGame(data);
  }
  const xo = {
    get: getGame,
    async move(i) {
      const m = await needWho();
      const g = await getGame();
      const n = applyMove(g, i, m.who === 'her' ? 'X' : 'O');
      if (!n) throw new Error("That move isn't available right now.");
      return saveGame(g, n);
    },
    async reset({ scores = false } = {}) {
      const g = await getGame();
      return saveGame(g, freshGame(scores ? null : g.scores));
    },
    onChange(cb) { return watchTables(['xo_game'], async () => cb(await getGame())); }
  };

  // ---------- plants ----------
  const toPlant = (r) => ({ id: r.id, type: r.type, label: r.label, potColor: r.pot_color, by: r.by_char, plantedAt: ms(r.planted_at), wateredAt: ms(r.watered_at), sunAt: ms(r.sun_at), sungAt: ms(r.sung_at) });
  const toLog = (r) => ({ id: r.id, plantId: r.plant_id, plantName: r.plant_name, by: r.by_char, action: r.action, at: ms(r.at) });
  async function logIt(m, p, action) { await sb.from('plant_log').insert({ plant_id: p.id, plant_name: p.label, by_char: m.who, action }); }
  async function listPlants() {
    const { data, error } = await sb.from('plants').select('*').order('planted_at');
    fail(error);
    return (data || []).map(toPlant);
  }
  async function logList(limit = 30) {
    const { data } = await sb.from('plant_log').select('*').order('at', { ascending: false }).limit(limit);
    return (data || []).map(toLog);
  }
  async function care(id, col, action) {
    const m = await needWho();
    const { data, error } = await sb.from('plants').update({ [col]: iso() }).eq('id', id).select().maybeSingle();
    fail(error);
    if (data) await logIt(m, toPlant(data), action);
  }
  const plants = {
    list: listPlants,
    async add({ type, potColor, label }) {
      const m = await needWho();
      const t = PLANT_TYPES.find((x) => x.id === type) || PLANT_TYPES[0];
      const { data, error } = await sb.from('plants').insert({ type: t.id, label: (label || '').trim().slice(0, 24) || t.name, pot_color: potColor, by_char: m.who, watered_at: iso() }).select().single();
      fail(error);
      await logIt(m, toPlant(data), 'plant');
      return toPlant(data);
    },
    water: (id) => care(id, 'watered_at', 'water'),
    sun: (id) => care(id, 'sun_at', 'sun'),
    sing: (id) => care(id, 'sung_at', 'sing'),
    async remove(id) {
      const m = await needWho();
      const { data } = await sb.from('plants').select('*').eq('id', id).maybeSingle();
      if (data) await logIt(m, toPlant(data), 'remove');
      const { error } = await sb.from('plants').delete().eq('id', id);
      fail(error);
    },
    log: logList,
    onChange(cb) { return watchTables(['plants', 'plant_log'], async () => cb({ plants: await listPlants(), log: await logList() })); }
  };

  return { mode: 'supabase', auth, presence, lastSeen, letters, xo, plants, profile };
}
