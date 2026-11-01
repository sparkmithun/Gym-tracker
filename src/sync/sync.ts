import NetInfo from '@react-native-community/netinfo';
import { db, kvGet, kvSet } from '@/db/client';
import { notifyChange } from '@/db/live';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// Offline-first sync with Supabase.
//  push: rows with dirty = 1 are upserted (parents before children), then marked clean.
//  pull: rows with server updated_at > last cursor are applied locally, unless the local row is dirty
//        (a pending local edit wins and is pushed next time — last write wins).
// Deletes are soft (deleted_at) so they travel like any other update.

type TableSpec = {
  name: string;
  owner: 'id' | 'owner_id' | 'user_id';
  booleans?: string[];
  json?: string[];
};

const TABLES: TableSpec[] = [
  { name: 'profiles', owner: 'id', booleans: ['is_private'] },
  { name: 'exercises', owner: 'owner_id', json: ['secondary_muscles'] },
  { name: 'routine_folders', owner: 'user_id' },
  { name: 'routines', owner: 'user_id' },
  { name: 'routine_exercises', owner: 'user_id' },
  { name: 'routine_sets', owner: 'user_id' },
  { name: 'workouts', owner: 'user_id' },
  { name: 'workout_exercises', owner: 'user_id' },
  { name: 'workout_sets', owner: 'user_id', booleans: ['completed'] },
  { name: 'body_measurements', owner: 'user_id' },
];

const LOCAL_ONLY = new Set(['dirty']);
const PAGE = 1000;

const columnsCache = new Map<string, string[]>();
async function localColumns(table: string): Promise<string[]> {
  let cols = columnsCache.get(table);
  if (!cols) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    cols = info.map((c) => c.name);
    columnsCache.set(table, cols);
  }
  return cols;
}

type Row = Record<string, unknown>;

function toServer(spec: TableSpec, row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (LOCAL_ONLY.has(k)) continue;
    if (spec.booleans?.includes(k)) out[k] = !!v;
    else if (spec.json?.includes(k)) out[k] = typeof v === 'string' ? JSON.parse(v) : v;
    else out[k] = v;
  }
  return out;
}

function toLocal(spec: TableSpec, row: Row, cols: string[]): Row {
  const out: Row = {};
  for (const c of cols) {
    if (LOCAL_ONLY.has(c) || !(c in row)) continue;
    const v = row[c];
    if (spec.booleans?.includes(c)) out[c] = v ? 1 : 0;
    else if (spec.json?.includes(c)) out[c] = JSON.stringify(v ?? []);
    else out[c] = v ?? null;
  }
  return out;
}

async function pushTable(spec: TableSpec, userId: string) {
  const where = spec.owner === 'id' ? 'id = ?' : `${spec.owner} = ?`;
  const rows = await db.getAllAsync<Row>(`SELECT * FROM ${spec.name} WHERE dirty = 1 AND ${where}`, userId);
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from(spec.name).upsert(batch.map((r) => toServer(spec, r)), { onConflict: 'id' });
    if (error) throw new Error(`push ${spec.name}: ${error.message}`);
    for (const r of batch) {
      // Only clear the flag if the row wasn't edited again while we were pushing.
      await db.runAsync(`UPDATE ${spec.name} SET dirty = 0 WHERE id = ? AND updated_at = ?`, r.id as string, r.updated_at as string);
    }
  }
}

async function pullTable(spec: TableSpec, userId: string): Promise<number> {
  const cursorKey = `pull:${spec.name}`;
  let cursor = (await kvGet(cursorKey)) ?? '1970-01-01T00:00:00Z';
  const cols = await localColumns(spec.name);
  let applied = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(spec.name)
      .select('*')
      .eq(spec.owner, userId)
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PAGE);
    if (error) throw new Error(`pull ${spec.name}: ${error.message}`);
    if (!data?.length) break;
    await db.withTransactionAsync(async () => {
      for (const serverRow of data as Row[]) {
        const row = toLocal(spec, serverRow, cols);
        const keys = Object.keys(row);
        const updates = keys.filter((k) => k !== 'id').map((k) => `${k} = excluded.${k}`).join(', ');
        await db.runAsync(
          `INSERT INTO ${spec.name} (${keys.join(', ')}, dirty) VALUES (${keys.map(() => '?').join(', ')}, 0)
           ON CONFLICT(id) DO UPDATE SET ${updates} WHERE ${spec.name}.dirty = 0`,
          ...(keys.map((k) => row[k]) as (string | number | null)[]),
        );
      }
    });
    applied += data.length;
    cursor = String((data[data.length - 1] as Row).updated_at);
    await kvSet(cursorKey, cursor);
    if (data.length < PAGE) break;
  }
  return applied;
}

let running: Promise<void> | null = null;

/** Push then pull every table. Concurrent calls share one run. */
export function syncNow(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return Promise.resolve();
  running ??= (async () => {
    try {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) return;
      for (const spec of TABLES) await pushTable(spec, userId);
      let pulled = 0;
      for (const spec of TABLES) pulled += await pullTable(spec, userId);
      await kvSet('last_synced_at', new Date().toISOString());
      if (pulled > 0) notifyChange();
    } finally {
      running = null;
    }
  })();
  return running;
}

// ---- background scheduling -------------------------------------------------

let syncUser: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Called by the SyncManager with the signed-in user (null for guests / signed out). */
export function setSyncUser(userId: string | null) {
  syncUser = userId;
}

/** Debounced sync after local writes. */
export function scheduleSync(delayMs = 2000) {
  if (!syncUser) return;
  if (timer) clearTimeout(timer);
  const user = syncUser;
  timer = setTimeout(() => {
    timer = null;
    syncNow(user).catch((e) => console.warn('[sync]', e));
  }, delayMs);
}

/** Every local write goes through here: refresh UI + queue a sync. */
export function afterWrite() {
  notifyChange();
  scheduleSync();
}

export async function lastSyncedAt(): Promise<string | null> {
  return kvGet('last_synced_at');
}

/** A guest who signs in keeps their workouts: re-own every row and mark it for upload. */
export async function adoptGuestData(guestId: string, userId: string) {
  await db.withTransactionAsync(async () => {
    for (const t of TABLES) {
      if (t.owner === 'id') continue;
      await db.runAsync(`UPDATE ${t.name} SET ${t.owner} = ?, dirty = 1 WHERE ${t.owner} = ?`, userId, guestId);
    }
    // The account's own profile (created server-side on sign-up) wins over the guest one.
    await db.runAsync('DELETE FROM profiles WHERE id = ?', guestId);
  });
}
