# Implementation Guide — Gym Workout Tracker

Companion to `PLAN.md`. Work through the phases in order. Each phase ends with
**Done when** criteria; don't start the next phase until they pass.

Legend: `[ ]` todo · `[x]` done

---

## Build status (2026-11-01)

Phases 0–8 and most of Phase 9 are **coded** and pass typecheck, lint, unit tests and Android/iOS bundling.
What is left needs your accounts or a device: see **`SETUP.md`**.

| Phase | Status |
|---|---|
| 0 Scaffold | ✅ Expo SDK 58, Expo Router (`src/app`), EAS config. ⏳ Accounts (Expo, Supabase, Google Cloud, Apple) |
| 1 Backend | ✅ SQL migrations, RLS, storage buckets, `delete_my_account()`, 115-exercise seed, pgTAP RLS test. ⏳ Run against your Supabase project |
| 2 Auth | ✅ Google + Apple native sign-in → Supabase, onboarding (username/units), guest mode. ⏳ OAuth client IDs |
| 3 Library | ✅ Search, muscle/equipment filters, recent, custom exercises, detail (summary/history/charts/records) |
| 4 Routines | ✅ CRUD, folders, duplicate, move, starter programs (PPL, Upper/Lower, Full Body) |
| 5 Logging | ✅ Live logger, previous values, set types, RPE, supersets, rest timer + notification, crash-safe persistence, finish + PRs, "update routine?" |
| 6 History | ✅ History list, detail, edit, delete, repeat workout, charts, records |
| 7 Sync | ✅ Custom outbox sync (Option B) |
| 8 Polish | ✅ Settings, CSV export, delete account. ⏳ Sentry, store assets, privacy policy, Maestro E2E |
| 9 v1.1 | ✅ Dashboard, streak, muscle distribution, calendar, measurements, plate calculator. ⏳ Body heatmap SVG, warm-up calculator |
| 10 v2 | ✅ Compete: points, daily streaks, leaderboards, groups, contests (2026-11-02). ⏳ Feed/likes/comments, push, Health, watch, Pro |

**Deviations from the plan below (simpler, same result):**
- Local DB uses `expo-sqlite` with plain SQL instead of Drizzle — fewer build steps; schema in `src/db/migrations.ts`.
- Charts are hand-built with `react-native-svg` instead of victory-native/Skia — one less native dependency.
- Styling uses a small theme + StyleSheet instead of NativeWind/Tamagui.
- Personal records are **computed** from history instead of stored in a `personal_records` table, so editing or deleting old workouts can never leave records stale.
- Sync uses the custom outbox (Option B), not PowerSync. Server `updated_at` is set by a trigger on insert *and* update so pull cursors don't depend on phone clocks.
- Session tokens are stored with `expo-sqlite/kv-store` (SecureStore has a ~2 KB value limit that Supabase sessions can exceed).
- Guest mode added so the app can be tried before any account setup.

---

## Phase 0 — Accounts & Project Scaffold

### 0.1 Accounts
- [ ] GitHub repo `gym-tracker`
- [ ] Expo account (expo.dev) → `npm i -g eas-cli` → `eas login`
- [ ] Supabase project (choose region closest to users, e.g. `ap-south-1` Mumbai)
- [ ] Google Cloud project → OAuth consent screen (External)
- [ ] Apple Developer + Google Play Console (can wait until Phase 8, but Apple is needed for Sign in with Apple testing)
- [ ] Sentry project (React Native)

### 0.2 Scaffold
```bash
npx create-expo-app@latest gym-tracker --template tabs
cd gym-tracker
npx expo install expo-dev-client expo-router expo-sqlite expo-secure-store \
  expo-notifications expo-haptics expo-apple-authentication expo-image \
  expo-image-picker expo-file-system expo-sharing \
  react-native-reanimated react-native-gesture-handler react-native-safe-area-context
npm i @supabase/supabase-js @react-native-google-signin/google-signin \
  zustand @tanstack/react-query drizzle-orm date-fns zod \
  @shopify/flash-list react-native-draggable-flatlist victory-native @shopify/react-native-skia \
  @sentry/react-native nativewind
npm i -D drizzle-kit typescript @types/react jest @testing-library/react-native supabase
```

### 0.3 Folder structure
```
app/                      # Expo Router screens
  (auth)/sign-in.tsx
  (tabs)/_layout.tsx  home.tsx  workout.tsx  profile.tsx
  workout/active.tsx  workout/[id].tsx
  routine/[id].tsx
  exercise/library.tsx  exercise/[id].tsx
  settings/index.tsx
src/
  lib/supabase.ts         # client w/ SecureStore session storage
  lib/auth.ts             # google/apple sign-in helpers
  db/schema.ts            # Drizzle schema (local SQLite)
  db/client.ts
  db/migrations/
  sync/                   # outbox + pull logic (or PowerSync config)
  features/
    exercises/  routines/  workout/  history/  stats/  profile/
      components/ hooks/ queries.ts types.ts
  store/activeWorkout.ts  # Zustand
  utils/units.ts  utils/oneRepMax.ts  utils/uuid.ts
  theme/
supabase/
  migrations/             # SQL migrations (supabase CLI)
  seed/exercises.sql
  functions/              # edge functions
```

### 0.4 Config
- [ ] `app.config.ts`: `bundleIdentifier` / `package` (e.g. `com.spark.lift`), plugins: `expo-router`, `@react-native-google-signin/google-signin`, `expo-apple-authentication`, `expo-sqlite`, `@sentry/react-native`
- [ ] `.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (add `.env` to `.gitignore`)
- [ ] `eas build:configure` → profiles `development`, `preview`, `production`
- [ ] `eas build --profile development --platform android` → install the dev client on your phone
- [ ] ESLint + Prettier, TS `strict: true`
- [ ] GitHub Action: typecheck + lint + jest on PR

**Done when:** dev build runs on a real Android phone (and iOS simulator/device), showing 3 tabs.

---

## Phase 1 — Supabase Backend

### 1.1 Migration `0001_init.sql`
```sql
create extension if not exists "pgcrypto";

-- enums
create type exercise_type as enum (
  'weight_reps','bodyweight_reps','weighted_bodyweight','assisted_bodyweight',
  'duration','distance_duration','weight_distance');
create type set_type as enum ('normal','warmup','drop','failure');
create type record_type as enum ('max_weight','est_1rm','max_volume_set','max_reps','max_duration','max_distance');
create type visibility as enum ('private','followers','public');

-- shared columns helper
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  avatar_url text,
  bio text,
  unit_weight text not null default 'kg' check (unit_weight in ('kg','lbs')),
  unit_distance text not null default 'km' check (unit_distance in ('km','mi')),
  default_rest_seconds int not null default 90,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade,      -- null = global library
  name text not null,
  type exercise_type not null default 'weight_reps',
  equipment text,               -- barbell, dumbbell, machine, cable, bodyweight, kettlebell, band, other
  primary_muscle text not null, -- chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, abs, forearms, traps, lats, cardio, full_body
  secondary_muscles text[] not null default '{}',
  instructions text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on exercises (owner_id);

create table routine_folders (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table routines (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  folder_id uuid references routine_folders on delete set null,
  name text not null,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table routine_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_id uuid not null references routines on delete cascade,
  exercise_id uuid not null references exercises,
  sort_order int not null,
  superset_group int,
  rest_seconds int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table routine_sets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_exercise_id uuid not null references routine_exercises on delete cascade,
  sort_order int not null,
  set_type set_type not null default 'normal',
  target_weight_kg numeric(7,2),
  target_reps int,
  target_duration_s int,
  target_distance_m numeric(9,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table workouts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_id uuid references routines on delete set null,
  title text not null,
  notes text,
  started_at timestamptz not null,
  ended_at timestamptz,
  photo_url text,
  visibility visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on workouts (user_id, started_at desc);

create table workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  workout_id uuid not null references workouts on delete cascade,
  exercise_id uuid not null references exercises,
  sort_order int not null,
  superset_group int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on workout_exercises (user_id, exercise_id);

create table workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  workout_exercise_id uuid not null references workout_exercises on delete cascade,
  sort_order int not null,
  set_type set_type not null default 'normal',
  weight_kg numeric(7,2),
  reps int,
  duration_s int,
  distance_m numeric(9,2),
  rpe numeric(3,1) check (rpe between 1 and 10),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  exercise_id uuid not null references exercises,
  record_type record_type not null,
  value numeric not null,
  workout_set_id uuid references workout_sets on delete set null,
  achieved_at timestamptz not null,
  unique (user_id, exercise_id, record_type)
);

create table body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric(5,2), body_fat_pct numeric(4,1),
  neck_cm numeric(5,1), chest_cm numeric(5,1), waist_cm numeric(5,1),
  hips_cm numeric(5,1), arm_cm numeric(5,1), thigh_cm numeric(5,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['profiles','exercises','routine_folders','routines','routine_exercises',
    'routine_sets','workouts','workout_exercises','workout_sets','body_measurements'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s
                    for each row execute function set_updated_at()', t);
  end loop; end $$;

-- auto-create profile on sign-up
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```

### 1.2 Migration `0002_rls.sql`
```sql
alter table profiles enable row level security;
create policy "read profiles" on profiles for select using (true);
create policy "own profile" on profiles for update using (auth.uid() = id);

alter table exercises enable row level security;
create policy "read global or own" on exercises for select
  using (owner_id is null or owner_id = auth.uid());
create policy "write own" on exercises for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- every per-user table: owner-only full access
do $$ declare t text; begin
  foreach t in array array['routine_folders','routines','routine_exercises','routine_sets',
    'workouts','workout_exercises','workout_sets','personal_records','body_measurements'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "owner all" on %I for all
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop; end $$;
-- Phase 10 adds "followers can read public workouts" policies.
```

### 1.3 Storage
- [ ] Buckets `avatars` (public read) and `workout-photos` (private, signed URLs)
- [ ] Policy: users write only to `<bucket>/<auth.uid()>/*`

### 1.4 Seed exercises
- [ ] Script `scripts/import-exercises.ts`: download free-exercise-db JSON → map muscles/equipment to our enums → write `supabase/seed/exercises.sql` (owner_id null)
- [ ] Upload images to Storage `exercise-media/` (or keep the source URLs if the license allows)

### 1.5 Tooling
```bash
npx supabase init
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase gen types typescript --linked > src/types/database.ts
```

**Done when:** tables + RLS exist; with the anon key and a test user JWT you can read the global exercises but not another user's rows (write a SQL test in `supabase/tests/rls.sql`).

---

## Phase 2 — Authentication (Google + Apple)

### 2.1 Google Cloud
- [ ] Create OAuth client IDs: **Web** (used by Supabase + `webClientId`), **Android** (package name + SHA-1 from `eas credentials`; add the Play App Signing SHA-1 later), **iOS** (bundle id)
- [ ] Supabase → Auth → Providers → Google: paste the Web client ID/secret; add the Android and iOS client IDs to "Authorized Client IDs"; enable "Skip nonce check" only if needed for iOS

### 2.2 Apple
- [ ] Enable "Sign in with Apple" capability on the App ID; Supabase → Apple provider (bundle ID as client ID for native)

### 2.3 Code
`src/lib/supabase.ts`
```ts
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const storage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
);
```
`src/lib/auth.ts`
```ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signIn();
  const idToken = res.data?.idToken;
  if (!idToken) throw new Error('No Google ID token');
  return supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
}

export async function signInWithApple() {
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                      AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!cred.identityToken) throw new Error('No Apple identity token');
  return supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
}
```
- [ ] `AuthProvider` context: listens to `supabase.auth.onAuthStateChange`, exposes `session`
- [ ] Root `_layout.tsx`: redirect to `(auth)/sign-in` when there is no session
- [ ] Sign-in screen: logo, "Continue with Google", "Continue with Apple" (iOS only)
- [ ] Onboarding (first login): pick username (unique check), units, body weight (optional)
- [ ] Sign out (also `GoogleSignin.signOut()`)

**Done when:** sign in → profile row auto-created → app restart keeps you signed in → sign out works, on both platforms.

---

## Phase 3 — Local DB & Exercise Library

### 3.1 Local SQLite (Drizzle)
- [ ] `src/db/schema.ts` mirrors the Supabase tables (same UUIDs and columns) plus `_dirty` (0/1) and `_synced_at` columns
- [ ] Run migrations on app start (`useMigrations`)
- [ ] First launch: pull global exercises into SQLite (≈1 MB) and cache them

### 3.2 Library UI
- [ ] `exercise/library.tsx`: FlashList, search box (debounced, case-insensitive), filter chips: muscle, equipment; "Recent" section first
- [ ] Multi-select mode (used by "Add exercises" in routines/workouts) → returns the selected IDs
- [ ] `exercise/[id].tsx`: tabs **Summary** (image, muscles, instructions) · **History** (past sets grouped by workout) · **Charts** · **Records**
- [ ] Create custom exercise form (name, type, equipment, primary + secondary muscles); zod validation

**Done when:** search returns results in < 100 ms with 800 exercises; a custom exercise appears in search and syncs to Supabase.

---

## Phase 4 — Routines

- [ ] Workout tab: "Start Empty Workout" button, folders (collapsible), routine cards (name + exercise list preview), "⋯" menu: edit, duplicate, delete, move to folder
- [ ] `routine/[id].tsx` editor: title, notes, add exercises (library picker), per exercise: sets list (type, target weight/reps), rest time, superset link, drag to reorder, swipe to delete
- [ ] Starter programs (P1): bundled JSON → "Add to my routines"

**Done when:** create/edit/reorder/delete routines offline; changes appear on a second device after sync.

---

## Phase 5 — Live Workout Logging (core)

### 5.1 State — `src/store/activeWorkout.ts`
```ts
type ActiveSet = { id: string; type: SetType; weightKg?: number; reps?: number;
  durationS?: number; distanceM?: number; rpe?: number; completed: boolean };
type ActiveExercise = { id: string; exerciseId: string; supersetGroup?: number;
  restSeconds: number; notes?: string; sets: ActiveSet[] };
type ActiveWorkout = { id: string; routineId?: string; title: string;
  startedAt: string; notes?: string; exercises: ActiveExercise[] };

// actions: start(fromRoutine?), addExercises, removeExercise, reorder, replaceExercise,
// addSet, updateSet, toggleComplete, removeSet, setSupersetGroup, finish(), discard()
// middleware: persist to SQLite table `active_workout` (JSON blob) on every change (debounce 300 ms)
```

### 5.2 Screen `workout/active.tsx`
- [ ] Header: elapsed timer, volume, sets done, "Finish" button
- [ ] Exercise card: name (tap → detail), notes, "⋯" (replace, superset, rest time, remove)
- [ ] Set row: `SET | PREVIOUS | KG | REPS | ✓`; columns change with exercise type
  - PREVIOUS = same set index from the last completed workout with this exercise (one SQLite query per exercise, cached)
  - Tap the set number → choose type (W/D/F)
  - Numeric keypad with a custom accessory (+/- buttons, next field)
  - ✓ → haptic, row turns green, starts the rest timer
  - Swipe left → delete set
- [ ] "+ Add Set" copies the previous set's values
- [ ] Minimised bar on other tabs while a workout is active ("Workout in progress · 32:10")

### 5.3 Rest timer
- [ ] Bottom sheet: countdown ring, −15s / +15s, skip
- [ ] Store `endsAt` timestamp (not a JS interval) → UI derives remaining time → survives backgrounding
- [ ] Schedule an `expo-notifications` local notification at `endsAt`; cancel it on skip/adjust
- [ ] Ongoing notification (Android) / Live Activity (iOS, P1)

### 5.4 Finish flow
- [ ] Validation: warn if any sets are not completed (option to discard them)
- [ ] Save screen: title (default = routine name or "Morning Workout"), notes, photo, visibility
- [ ] Write workout + exercises + sets to SQLite in one transaction → mark dirty → sync
- [ ] Compute PRs locally (`utils/oneRepMax.ts`: Epley `w * (1 + reps/30)`, skip warm-ups) → show "🏆 3 new PRs" summary
- [ ] P1: "Update routine with new values?"

### 5.5 Recovery
- [ ] On app start, if `active_workout` exists → "Resume workout?" (resume / discard)

**Done when:** log a 6-exercise, 20-set workout in airplane mode; kill the app mid-workout → resume with nothing lost; the rest-timer notification fires with the app in the background; the workout syncs after you reconnect.

---

## Phase 6 — History, PRs, Charts

- [ ] Profile tab: header (avatar, name, total workouts), workout history list (title, date, duration, volume, PR count, exercise summary)
- [ ] `workout/[id].tsx` detail; edit mode reuses the active-workout components
- [ ] Edit/delete → recompute PRs for the affected exercises
- [ ] Exercise charts (victory-native): est. 1RM, heaviest weight, best set volume, session volume; range 1M/3M/1Y/All
- [ ] Records tab: best values with date and link to the workout
- [ ] Unit tests for `oneRepMax`, PR detection, volume calculation, unit conversion

**Done when:** charts match hand-calculated values for the test fixtures; PRs update after editing a past workout.

---

## Phase 7 — Sync Engine

Option A (recommended for speed): **PowerSync** + Supabase connector → define sync rules `select * from <table> where user_id = token_parameters.user_id`.

Option B (no extra service): custom outbox
- [ ] **Push:** select rows `where _dirty = 1` → `supabase.from(t).upsert(rows)` in parent→child order (workouts → workout_exercises → workout_sets) → clear `_dirty`
- [ ] **Pull:** per table, `select * where updated_at > last_pulled_at` (include soft-deleted rows) → upsert locally unless the local row is dirty and newer
- [ ] Triggers: app foreground, network regained (`@react-native-community/netinfo`), after finishing a workout, every 5 min while open
- [ ] Sync status indicator in settings ("Last synced 2 min ago")
- [ ] Integration tests: two simulated clients editing → expected LWW result

**Done when:** a new install on a second phone, after login, shows the full history within seconds.

---

## Phase 8 — Polish & Store Release (v1.0)

- [ ] Settings: units, default rest timer, sounds/vibration, theme (dark default), sync status, sign out
- [ ] Export data (CSV of all sets) via Edge Function or on-device → `expo-sharing`
- [ ] Delete account: Edge Function using the service role → deletes `auth.users` row (cascades) + storage files. **Required by Apple and Google**
- [ ] Privacy policy + terms page (hosted), Play Data Safety form, App Store privacy labels
- [ ] Sentry wired in + source maps via EAS
- [ ] App icon, splash, store screenshots (our own design)
- [ ] Accessibility: dynamic font sizes, 44 pt hit targets, screen-reader labels
- [ ] Maestro E2E: sign-in (mocked), create routine, log workout, view history
- [ ] `eas build --profile production` → `eas submit` → Play internal testing + TestFlight → production

**Done when:** approved on both stores.

---

## Phase 9 — v1.1

- [ ] Dashboard: workouts per week (bar chart), volume, duration, streak
- [ ] Muscle distribution: sets per muscle (last 7/30 days) + front/back body heatmap SVG (our own artwork)
- [ ] Calendar view
- [ ] Body measurements + body-weight chart
- [ ] Plate calculator (bar weight setting, available plates)
- [ ] RPE input, warm-up calculator
- [ ] Routine folders, starter programs

## Phase 10 — v2

### 10.1 Compete (done)
Migration `supabase/migrations/20261102000001_social.sql`; app code in `src/features/social/` and the **Compete** tab.

- **Points** are derived from synced workouts (views in a `private` schema the API can't read), never stored.
  Same formula client-side (`points.ts`, unit-tested) for offline/guest use and server-side for leaderboards:
  10 per workout (needs ≥ 1 completed working set) + 2/set (≤ 40) + 1 per 500 kg (≤ 50) + 1 per 5 min (≤ 24) + 1 per km (≤ 20);
  a day is capped at 200, then **+5 per consecutive day** (≤ +30).
- **Daily streak**: consecutive local days with a workout; alive until a full day is missed. `profiles.timezone` (sent by the app) defines "a day".
- **Leaderboards**: `leaderboard(period, group)` — today / week / month / all-time, global (private profiles hidden) or per group. Top 100 + your own row.
- **Groups**: public (discoverable) or private (invite code). Owner can't leave, only delete. `list_groups`, `join_group(code)`; joining a public group is a plain insert under RLS.
- **Contests**: metric = points / workouts / volume / duration, 1–93 days, public, private (code) or group-only.
  The app auto-creates an official **monthly Points Challenge** and **Weekly Warrior** on first listing. `list_contests`, `join_contest`, `contest_leaderboard`.
- Verified against Postgres (PGlite) with stub auth: scores, ranking, private-profile hiding, RLS on joins/leaves, invite codes, official contests.
- Scale note: views compute on read. Fine for thousands of users; beyond that, materialise `daily_scores` (refresh on workout write).

### 10.2 Activity, calories & web dashboard (done, 2026-11-05)
Migration `20261105000001_activity.sql`; app code in `src/features/activity/` and the **Activity** tab; web in `web/`.

- **Steps (auto)**: `react-native-health-connect` (Android) and `@kingstinct/react-native-healthkit` (iOS), loaded lazily so
  Expo Go still runs. Daily steps + distance for the last 14 days import on launch, on foreground and every 30 min into
  `daily_activity` (id derived from user + day so two phones merge). Health Connect requires `minSdkVersion 26`.
- **Sports**: 21 sports with MET values for light / moderate / hard; the kcal estimate is stored with the session.
- **Calories**: burned = gym (MET 5) + sports + steps (0.04 kcal/step at 70 kg), scaled by the latest body weight.
  Food log with meals, macros and one-tap "recent foods". Remaining = goal − eaten + burned. Goals in Settings.
- **Web dashboard**: Next.js 16 (App Router, Cache Components, `proxy.ts`), Supabase SSR auth with Google, read-only.
  Pages: Overview (tiles + steps / calories / workouts charts), Workouts (+ detail), Activity & food, Compete.
  Reads run as the user under RLS; own points come from `my_daily_scores()`.
- Not yet: sports/steps don't earn points or count toward streaks; food database search / barcode scanning.

### 10.3 Later
- [ ] Social: `follows`, `workout_likes`, `workout_comments` tables + RLS (`visibility='public'` or the viewer follows the owner and `visibility='followers'`)
- [ ] Home feed query (paginated, cursor on `ended_at`), likes, comments, user search
- [ ] Push notifications (Expo Push + Edge Function triggers)
- [ ] Health Connect / Apple HealthKit sync
- [ ] Wear OS / watchOS companion
- [ ] Pro subscription via RevenueCat

---

## Conventions

- TypeScript strict; no `any` in `src/`.
- All IDs are UUID v4 generated on the client (`expo-crypto` `randomUUID`).
- Weight stored in kg and distance in metres; convert only in the UI (`utils/units.ts`).
- Timestamps in UTC ISO; display in local time.
- Each feature folder exposes hooks (`useRoutines`, `useWorkoutHistory`), and screens never call Supabase directly.
- Conventional commits; PRs need green CI.

## Immediate Next Steps

1. Create Expo, Supabase and Google Cloud accounts (Phase 0.1).
2. Approve the stack in `PLAN.md` §3 (decision: Supabase vs Firebase, PowerSync vs custom sync).
3. Start Phase 0.2 scaffold.
