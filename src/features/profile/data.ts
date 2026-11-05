import { db } from '@/db/client';
import type { MeasurementRow, Profile } from '@/db/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { afterWrite } from '@/sync/sync';
import { nowIso, uuid } from '@/utils/uuid';

export type ProfilePatch = Partial<Pick<Profile, 'username' | 'display_name' | 'bio' | 'unit_weight' | 'unit_distance' | 'default_rest_seconds' | 'is_private' | 'avatar_url' | 'timezone' | 'step_goal' | 'calorie_goal'>>;

export async function updateProfile(userId: string, patch: ProfilePatch) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const values = entries.map(([k, v]) => (k === 'is_private' ? (v ? 1 : 0) : v)) as (string | number | null)[];
  await db.runAsync(
    `INSERT INTO profiles (id) VALUES (?) ON CONFLICT(id) DO NOTHING`, userId,
  );
  await db.runAsync(
    `UPDATE profiles SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ?, dirty = 1 WHERE id = ?`,
    ...values, nowIso(), userId,
  );
  afterWrite();
}

export type UsernameCheck = 'ok' | 'taken' | 'invalid' | 'offline';

export async function checkUsername(userId: string, username: string, isGuest: boolean): Promise<UsernameCheck> {
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return 'invalid';
  if (isGuest || !isSupabaseConfigured) return 'ok';
  const { data, error } = await supabase.from('profiles').select('id').eq('username', username).neq('id', userId).limit(1);
  if (error) return 'offline';
  return data.length ? 'taken' : 'ok';
}

/** Fetch the server profile right after sign-in (before the first full sync finishes). */
export async function fetchServerProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!data) return null;
  await db.runAsync(
    `INSERT INTO profiles (id, username, display_name, avatar_url, bio, unit_weight, unit_distance, default_rest_seconds, is_private, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name,
       avatar_url = excluded.avatar_url, bio = excluded.bio, unit_weight = excluded.unit_weight,
       unit_distance = excluded.unit_distance, default_rest_seconds = excluded.default_rest_seconds,
       is_private = excluded.is_private, updated_at = excluded.updated_at
     WHERE profiles.dirty = 0`,
    data.id, data.username, data.display_name, data.avatar_url, data.bio, data.unit_weight, data.unit_distance,
    data.default_rest_seconds, data.is_private ? 1 : 0, data.updated_at,
  );
  afterWrite();
  return data as Profile;
}

// ---- body measurements --------------------------------------------------------

export async function listMeasurements(userId: string): Promise<MeasurementRow[]> {
  return db.getAllAsync<MeasurementRow>(
    `SELECT id, measured_at, weight_kg, body_fat_pct, neck_cm, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm
       FROM body_measurements WHERE user_id = ? AND deleted_at IS NULL ORDER BY measured_at DESC`,
    userId,
  );
}

export type MeasurementInput = Omit<MeasurementRow, 'id'>;

export async function addMeasurement(userId: string, m: MeasurementInput) {
  await db.runAsync(
    `INSERT INTO body_measurements (id, user_id, measured_at, weight_kg, body_fat_pct, neck_cm, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    uuid(), userId, m.measured_at, m.weight_kg, m.body_fat_pct, m.neck_cm, m.chest_cm, m.waist_cm, m.hips_cm, m.arm_cm, m.thigh_cm, nowIso(),
  );
  afterWrite();
}

export async function deleteMeasurement(id: string) {
  await db.runAsync('UPDATE body_measurements SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', nowIso(), nowIso(), id);
  afterWrite();
}

// ---- CSV export -----------------------------------------------------------------

export async function exportCsv(userId: string): Promise<string> {
  const rows = await db.getAllAsync<Record<string, string | number | null>>(
    `SELECT w.title AS workout, w.started_at, w.ended_at, e.name AS exercise, we.sort_order + 1 AS exercise_order,
            s.sort_order + 1 AS set_order, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.rpe,
            w.notes AS workout_notes, we.notes AS exercise_notes
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id AND we.deleted_at IS NULL
       JOIN exercises e ON e.id = we.exercise_id
       JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL AND s.completed = 1
      WHERE w.user_id = ? AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL
      ORDER BY w.started_at, we.sort_order, s.sort_order`,
    userId,
  );
  const header = ['workout', 'started_at', 'ended_at', 'exercise', 'exercise_order', 'set_order', 'set_type', 'weight_kg', 'reps', 'duration_s', 'distance_m', 'rpe', 'workout_notes', 'exercise_notes'];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n');
}
