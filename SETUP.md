# Spark Lift — Setup & Run Guide

The app works in two modes:

| Mode | Needs | What works |
|---|---|---|
| **Guest** (no setup) | Node.js only | Everything except sign-in and cloud sync. Data stays on the phone. |
| **Full** | Supabase + Google Cloud (+ Apple for iOS) | Google/Apple sign-in, data synced to the cloud across devices |

A guest who later signs in keeps all their data: it is uploaded to the account automatically.

---

## 1. Run it right now (guest mode, Expo Go)

```bash
npm install
```

```bash
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS), then tap **Try without an account**.

> Google Sign-In does **not** work in Expo Go. For that you need a development build (step 4).

---

## 2. Supabase (cloud database)

1. Create a project at https://supabase.com (region: Mumbai `ap-south-1` is closest for India).
2. **SQL Editor** → run these files in order (copy-paste each one):
   1. `supabase/migrations/20261101000001_init.sql`
   2. `supabase/migrations/20261101000002_rls.sql`
   3. `supabase/seed.sql` — **required**: workouts reference these exercise IDs, so sync fails without them.

   Or with the CLI:
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   ```bash
   npx supabase db push --include-seed
   ```
3. **Project Settings → API**: copy the Project URL and the `anon` public key.
4. Copy `.env.example` to `.env.local` and paste them in.

## 3. Google Sign-In

In https://console.cloud.google.com → create a project → **APIs & Services**:

1. **OAuth consent screen** → External → add app name, your email, and the scopes `email`, `profile`, `openid`.
2. **Credentials → Create OAuth client ID**, three times:
   - **Web application** → copy the Client ID **and** secret. Put the Client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - **Android** → package `com.spark.lift` + SHA-1 fingerprint. Get the SHA-1 with `npx eas-cli@latest credentials` (Android → development keystore). After publishing on Play, also add the **Play App Signing** SHA-1 from Play Console.
   - **iOS** → bundle ID `com.spark.lift` → put the Client ID in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
3. Supabase → **Authentication → Sign In / Providers → Google** → enable, paste the **Web** client ID + secret, and add the Android + iOS client IDs to **Authorized Client IDs** (comma-separated).

## 4. Apple Sign-In (iOS only; required by App Store rule 4.8)

1. Apple Developer → Identifiers → `com.spark.lift` → enable **Sign in with Apple**.
2. Supabase → Providers → **Apple** → enable; add `com.spark.lift` as the client ID.

## 5. Development build (needed for Google Sign-In)

Builds run in Expo's cloud, so no Mac or Android Studio is needed:

```bash
npx eas-cli@latest login
```
```bash
npx eas-cli@latest init
```
```bash
npx eas-cli@latest build --profile development --platform android
```

Install the APK it links to on your phone, then run `npx expo start` and open the app. Use `--platform ios` for iPhone (needs an Apple Developer account).

> Put the same `EXPO_PUBLIC_*` values into EAS so cloud builds get them:
> `npx eas-cli@latest env:create` (or the expo.dev dashboard → Environment variables).

## 6. Release

```bash
npx eas-cli@latest build --profile production --platform all
```
```bash
npx eas-cli@latest submit --platform android
```
```bash
npx eas-cli@latest submit --platform ios
```

Store checklist: privacy policy URL, Play **Data safety** form, App Store **privacy labels**. In-app account deletion is already built (Settings → Delete account).

---

## Developer commands

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Expo config) |
| `npm test` | Unit tests (units, PRs, set editing, plates) |
| `npm run seed:build` | Regenerate exercise seed JSON + SQL after editing `scripts/exercise-list.mjs` |
| `npx supabase test db` | RLS tests (`supabase/tests`), needs local Supabase (`npx supabase start`, Docker) |

## Project layout

```
src/app/            screens (Expo Router — each file is a route)
src/components/     shared UI (buttons, cards, charts, sheets)
src/features/       exercises, routines, workout, stats, profile — data + components
src/db/             local SQLite: schema migrations, client, live queries
src/sync/           offline-first sync with Supabase (push dirty rows, pull by updated_at)
src/store/          zustand stores (active workout — persisted every change)
src/lib/            supabase client, Google/Apple auth
supabase/           Postgres migrations, RLS, seed, tests
scripts/            exercise library source + seed generator
```
