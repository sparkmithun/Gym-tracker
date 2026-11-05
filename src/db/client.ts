import { openDatabaseSync } from 'expo-sqlite';
import seed from '@/features/exercises/seed.json';
import { MIGRATIONS } from './migrations';

export const db = openDatabaseSync('sparklift.db');

/** Tables holding the signed-in user's data (cleared on sign-out). */
export const USER_TABLES = [
  'workout_sets', 'workout_exercises', 'workouts',
  'routine_sets', 'routine_exercises', 'routines', 'routine_folders',
  'body_measurements', 'daily_activity', 'sport_sessions', 'food_entries', 'profiles',
] as const;

let ready: Promise<void> | null = null;

/** Runs migrations and seeds the global exercise library. Safe to call repeatedly. */
export function initDb(): Promise<void> {
  ready ??= (async () => {
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let version = row?.user_version ?? 0;
    for (; version < MIGRATIONS.length; version++) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(MIGRATIONS[version]);
      });
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    }
    await seedGlobalExercises();
  })();
  return ready;
}

async function seedGlobalExercises() {
  const seededCount = await kvGet('seed_count');
  if (seededCount === String(seed.length)) return;
  await db.withTransactionAsync(async () => {
    for (const e of seed) {
      await db.runAsync(
        `INSERT INTO exercises (id, owner_id, name, type, equipment, primary_muscle, secondary_muscles, updated_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, equipment=excluded.equipment,
           primary_muscle=excluded.primary_muscle, secondary_muscles=excluded.secondary_muscles`,
        e.id, e.name, e.type, e.equipment, e.primary_muscle, JSON.stringify(e.secondary_muscles), '1970-01-01T00:00:00Z',
      );
    }
  });
  await kvSet('seed_count', String(seed.length));
}

export async function kvGet(key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return r?.value ?? null;
}

export async function kvSet(key: string, value: string | null): Promise<void> {
  if (value === null) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  else await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

/** Wipes everything belonging to the current user (sign-out / account deletion). */
export async function clearUserData(): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of USER_TABLES) await db.runAsync(`DELETE FROM ${t}`);
    await db.runAsync('DELETE FROM exercises WHERE owner_id IS NOT NULL');
    await db.runAsync("DELETE FROM kv WHERE key NOT IN ('seed_count')");
  });
}
