// Picks the backend. Supabase when config.js has both values, otherwise a local
// (localStorage + BroadcastChannel) demo backend. Both expose the same async interface:
//   auth      { mode, signIn(x), currentUser(), signOut() }
//   presence  { join(state), update(state), leave(), onPeers(cb), wave(), onWave(cb) }
//   lastSeen  { save({location, activity, visibility}), watch(cb) }   // cb(map keyed by 'her'|'him')
//   letters   { list(), send({to, location, text, seal}), markRead(id), onNew(cb) }
//   xo        { get(), move(i), reset({scores}), onChange(cb) }
//   plants    { list(), add({type, potColor}), water(id), sun(id), sing(id), remove(id), log(limit), onChange(cb) }
//   profile   { get(), set(patch), getOther(), deleteMine() }
import * as cfg from '../../config.js';

export async function createBackend() {
  const url = (cfg.SUPABASE_URL || '').trim();
  const key = (cfg.SUPABASE_ANON_KEY || '').trim();
  if (url && key) {
    const m = await import('./supabase.js');
    return m.createSupabaseBackend({ url, key });
  }
  const m = await import('./local.js');
  return m.createLocalBackend();
}
