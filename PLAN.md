# Gym Workout Tracker — Product & Technical Plan

> Working name: **Spark Lift** (placeholder — rename freely)
> Platforms: Android + iOS (single codebase)
> Status: Planning — execution follows `IMPLEMENTATION.md`

---

## 1. Vision

A fast, offline-capable strength-training logger that makes logging a set take
one or two taps. It keeps every user's data in one cloud database, linked to a
Google account. The feature set is based on what lifters expect from today's
leading trackers (Hevy, Strong, etc.). The UI, branding and code are our own.

### Goals
- Log a full workout with the phone in one hand between sets.
- Never lose data: works without signal in the gym and syncs later.
- One account across devices (Google Sign-In; Apple Sign-In on iOS).
- Useful progress insights: PRs, volume, muscle balance, consistency.

### Non-goals (v1)
- Nutrition / calorie tracking
- AI coaching / auto-generated programs (possible in v3)
- Web app (possible later; the backend will support it)

---

## 2. Feature Inventory (genre reference: Hevy-style tracker)

Priority: **P0** = MVP, **P1** = v1.1, **P2** = later.

### 2.1 Account & Profile
| Feature | Pri |
|---|---|
| Google Sign-In (Android + iOS) | P0 |
| Sign in with Apple (**required by App Store rule 4.8** when offering Google login on iOS) | P0 |
| Profile: name, username, avatar, bio | P0 |
| Units: kg/lbs, km/mi, cm/in | P0 |
| Body weight, height, birth year, sex (optional, for stats) | P1 |
| Delete account + export data (GDPR / Play Store rule) | P0 |
| Private / public profile toggle | P1 |

### 2.2 Exercise Library
| Feature | Pri |
|---|---|
| ~400+ seeded exercises (name, primary/secondary muscles, equipment, type) | P0 |
| Search + filter by muscle group and equipment | P0 |
| Exercise detail: instructions, image/animation, history, PR, charts | P0 |
| Custom exercises (user-created) | P0 |
| Exercise types: weight+reps, bodyweight reps, weighted bodyweight, assisted bodyweight, duration, distance+duration, weight+distance | P0 |

### 2.3 Routines (Workout Templates)
| Feature | Pri |
|---|---|
| Create/edit routines with ordered exercises, target sets/reps/weight | P0 |
| Folders to group routines (e.g. "PPL", "Upper/Lower") | P1 |
| Duplicate / reorder routines | P0 |
| Pre-built starter programs (PPL, Full Body 3x, 5x5-style) | P1 |
| Share routine via link; copy others' routines | P2 |

### 2.4 Live Workout Logging (core experience)
| Feature | Pri |
|---|---|
| Start empty workout or from routine | P0 |
| Per set: weight, reps, ✓ complete; previous-session values shown inline | P0 |
| Set types: normal, warm-up, drop set, failure | P0 |
| RPE / RIR per set (optional) | P1 |
| Supersets (group exercises) | P0 |
| Rest timer: auto-start on set complete, per-exercise default, +/-15s, vibration/sound | P0 |
| Rest timer works with app backgrounded (local notification) | P0 |
| Elapsed workout duration, running volume & set count | P0 |
| Exercise notes + workout notes | P0 |
| Reorder / replace / remove exercises mid-workout | P0 |
| Plate calculator | P1 |
| Warm-up set calculator | P2 |
| Live Activity (iOS) / ongoing notification (Android) | P1 |
| Crash-safe: in-progress workout persisted locally every change | P0 |
| Finish screen: title, photo, notes, summary, PRs hit | P0 |
| Discard / resume unfinished workout | P0 |
| "Update routine with these values?" on finish | P1 |

### 2.5 History & Progress
| Feature | Pri |
|---|---|
| Workout history list (newest first) and detail | P0 |
| Edit / delete past workouts | P0 |
| Calendar view with workout days | P1 |
| Personal records: heaviest weight, best est. 1RM (Epley), best set volume, most reps | P0 |
| Per-exercise charts: est. 1RM, heaviest weight, volume over time | P0 |
| Dashboard: workouts/week, total volume, duration, streak | P1 |
| Muscle-group distribution (sets per muscle per week) + body heatmap | P1 |
| Body measurements & body-weight log with chart | P1 |
| Progress photos | P2 |
| Monthly/yearly report | P2 |
| Export CSV | P1 |

### 2.6 Social (phase 2)
| Feature | Pri |
|---|---|
| Follow / unfollow users | P2 |
| Feed of followed users' finished workouts | P2 |
| Like + comment on workouts | P2 |
| Notifications (new follower, like, comment) | P2 |
| Search users | P2 |

### 2.7 Integrations (later)
| Feature | Pri |
|---|---|
| Apple Health / Health Connect (Android) write workouts & body weight | P2 |
| Wear OS / Apple Watch companion | P2 |
| Monetisation: free tier + "Pro" (unlimited routines, advanced charts) via RevenueCat | P2 |

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile framework | **React Native + Expo (SDK latest) + TypeScript** | One codebase for Android & iOS, EAS cloud builds (no Mac needed for iOS builds), OTA updates |
| Navigation | **Expo Router** (file-based) | Standard for Expo, deep links free |
| UI | **Tamagui** or **NativeWind** (Tailwind) + `react-native-reanimated`, `react-native-gesture-handler` | Fast styling, smooth swipe-to-delete / drag-reorder |
| Lists | `@shopify/flash-list`, `react-native-draggable-flatlist` | Big exercise lists, reorderable sets |
| Charts | `victory-native` (Skia) | Performant charts |
| Local state | **Zustand** (active workout) + **TanStack Query** (server data) | Simple, persisted |
| Local DB / offline | **expo-sqlite** + **Drizzle ORM** | Offline-first storage of workouts, library |
| Sync | **PowerSync** (Supabase connector) — *or* custom outbox queue in v1 | Proven offline↔Postgres sync |
| Backend / DB | **Supabase** (managed Postgres, Auth, Storage, Edge Functions, Realtime) | Centralised relational data, Row Level Security, generous free tier, SQL for stats |
| Auth | Supabase Auth with **Google** (`@react-native-google-signin/google-signin` → `signInWithIdToken`) + **Apple** (`expo-apple-authentication`) | Native sign-in sheets, no browser redirect |
| File storage | Supabase Storage (avatars, workout photos) | Same RLS policies |
| Notifications | `expo-notifications` (rest timer local; push for social later) | |
| Monitoring | **Sentry** (`@sentry/react-native`), PostHog (analytics, optional) | |
| Payments (later) | RevenueCat | Handles both stores |
| CI/CD | GitHub + **EAS Build / EAS Submit / EAS Update** | |
| Testing | Jest + React Native Testing Library; Maestro for E2E | |

**Why Supabase over Firebase:** workout data is relational (user → workout →
exercises → sets). Stats like "best e1RM per exercise per week" are simple SQL
queries in Postgres but awkward in Firestore. RLS gives per-user security in
the database itself. Firebase is still a fine fallback if you prefer it.

**Exercise seed data:** [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(public domain, ~800 exercises with images) and/or the [wger](https://wger.de) API
(CC-BY-SA, attribution needed). Do **not** copy Hevy's exercise media.

---

## 4. Architecture

```
┌────────────────────── Mobile app (Expo / RN) ──────────────────────┐
│  UI (Expo Router screens)                                          │
│    │                                                               │
│  Zustand store ──► active workout (persisted to SQLite each change)│
│  TanStack Query ─► reads local SQLite (source of truth on device)  │
│    │                                                               │
│  Local SQLite (Drizzle) ◄──► Sync engine (PowerSync / outbox)      │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ HTTPS (JWT)
┌──────────────────────────────────▼─────────────────────────────────┐
│ Supabase                                                           │
│  Auth (Google, Apple) → JWT                                        │
│  Postgres + RLS (profiles, exercises, routines, workouts, sets…)   │
│  Storage (avatars/, workout-photos/)                               │
│  Edge Functions (PR recompute, account deletion, CSV export)       │
└────────────────────────────────────────────────────────────────────┘
```

Key rules:
- **Client-generated UUIDs** for every row → offline creation without conflicts.
- **Local-first:** UI always reads/writes SQLite; sync runs in the background.
- **Conflicts:** last-write-wins on `updated_at` per row (a user rarely edits
  the same workout on two devices at once).
- **Soft delete** (`deleted_at`) so deletes sync correctly.

---

## 5. Data Model (summary)

| Table | Key columns |
|---|---|
| `profiles` | id (=auth.uid), username, display_name, avatar_url, unit_weight, unit_distance, is_private, created_at |
| `exercises` | id, owner_id (null = global), name, type, equipment, primary_muscle, secondary_muscles[], instructions, image_url |
| `routine_folders` | id, user_id, name, sort_order |
| `routines` | id, user_id, folder_id, name, notes, sort_order |
| `routine_exercises` | id, routine_id, exercise_id, sort_order, superset_group, rest_seconds, notes |
| `routine_sets` | id, routine_exercise_id, sort_order, set_type, target_weight, target_reps, target_duration, target_distance |
| `workouts` | id, user_id, routine_id, title, notes, started_at, ended_at, photo_url, visibility |
| `workout_exercises` | id, workout_id, exercise_id, sort_order, superset_group, notes |
| `workout_sets` | id, workout_exercise_id, sort_order, set_type, weight_kg, reps, duration_s, distance_m, rpe, completed |
| `personal_records` | id, user_id, exercise_id, record_type, value, workout_set_id, achieved_at |
| `body_measurements` | id, user_id, measured_at, weight_kg, body_fat_pct, chest_cm, waist_cm, … |
| `follows` (P2) | follower_id, followee_id |
| `workout_likes` / `workout_comments` (P2) | workout_id, user_id, body |

All weights are stored in **kg** and distances in **metres**. Unit conversion
happens only in the UI.
All user tables: `created_at`, `updated_at`, `deleted_at`.

Full SQL lives in `IMPLEMENTATION.md` §Phase 1.

---

## 6. Screens (navigation map)

```
(auth)/sign-in
(tabs)/
  home        – feed (P2) or dashboard summary + "Start workout"
  workout     – routines list, folders, start empty, explore programs
  profile     – stats, history, calendar, measurements, settings
workout/active        – live logging (modal, persists across tabs)
workout/[id]          – workout detail / edit
routine/[id]/edit
exercise/library      – search/filter picker (multi-select)
exercise/[id]         – detail, history, charts, PRs
settings/*            – units, rest timer defaults, account, export, delete
```

---

## 7. Milestones

| Phase | Scope | Outcome |
|---|---|---|
| 0 | Accounts, project scaffold, CI | Empty app builds for both stores |
| 1 | Supabase schema, RLS, seed exercises | Backend ready |
| 2 | Google + Apple auth, profile, onboarding | Users can sign in |
| 3 | Exercise library + custom exercises | Browse/search exercises |
| 4 | Routines CRUD | Plan workouts |
| 5 | Live workout logging + rest timer | **Core MVP** |
| 6 | History, PRs, charts | Progress tracking |
| 7 | Offline sync hardening | Reliable in the gym |
| 8 | Polish, settings, export, delete account, store release | **v1.0 on Play Store + App Store** |
| 9 | Stats dashboard, measurements, calendar, plate calc | v1.1 |
| 10 | Social, Health integrations, watch, Pro tier | v2 |

Detailed tasks and acceptance criteria are in **`IMPLEMENTATION.md`**.

---

## 8. Costs & Accounts Needed

| Item | Cost |
|---|---|
| Google Play Developer account | $25 one-time |
| Apple Developer Program | $99 / year |
| Supabase | Free tier → Pro $25/mo when needed |
| Expo EAS | Free tier (limited builds) → $19/mo optional |
| Google Cloud project (OAuth client IDs) | Free |
| Sentry | Free tier |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Google Sign-In needs native modules (not Expo Go) | Use EAS **development builds** from day 1 |
| iOS rejection without Apple Sign-In | Ship Apple Sign-In together with Google |
| Data loss mid-workout (app killed) | Persist active workout to SQLite on every change |
| Sync conflicts | UUIDs + LWW + soft deletes; integration tests |
| Rest timer killed in background | Schedule local notification for timer end, not JS timer |
| Copyright/trademark | Original UI, name, icons; open-licensed exercise data only |
