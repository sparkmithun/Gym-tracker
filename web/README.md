# Spark Lift — web dashboard

Read-only dashboard for data synced from the Spark Lift app: workouts, steps, sports, food, calories, points and leaderboards.
Next.js 16 (App Router) + Supabase (Google sign-in, Row Level Security).

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm run dev                  # http://localhost:3000
```

Setup of Google sign-in and deployment to Vercel: see `../SETUP.md` §3.4 and §7.

| Path | What |
|---|---|
| `src/proxy.ts` | Refreshes the session cookie; sends signed-out visitors to `/login` |
| `src/lib/supabase/` | Server and browser Supabase clients |
| `src/lib/data.ts` | All queries (run as the signed-in user) |
| `src/lib/calories.ts`, `points.ts` | Same formulas as the app — keep in step with `../src/features/activity/calories.ts` |
| `src/app/(dash)/` | Overview, Workouts, Activity & food, Compete |
