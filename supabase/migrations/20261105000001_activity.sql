-- Activity: daily steps/distance imported from Health Connect / Apple Health, sports sessions,
-- a food log and personal goals. Synced by the app's outbox like every other user table.
-- Calories burned are computed (src/features/activity/calories.ts, web/src/lib/calories.ts),
-- except for sports sessions, which store the estimate made when they were logged.

alter table public.profiles
  add column step_goal int not null default 8000 check (step_goal between 0 and 100000),
  add column calorie_goal int not null default 2000 check (calorie_goal between 0 and 10000);

create table public.daily_activity (
  id uuid primary key, -- derived from (user_id, day), so every device writes the same row
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  steps int not null default 0 check (steps between 0 and 200000),
  distance_m numeric(9, 1) not null default 0 check (distance_m >= 0),
  source text not null default 'manual' check (source in ('health_connect', 'apple_health', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, day)
);

create table public.sport_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  sport text not null check (sport ~ '^[a-z_]{2,30}$'),
  started_at timestamptz not null,
  duration_s int not null check (duration_s between 60 and 86400),
  intensity text not null default 'moderate' check (intensity in ('light', 'moderate', 'vigorous')),
  distance_m numeric(9, 1) check (distance_m >= 0),
  calories_kcal int not null default 0 check (calories_kcal between 0 and 10000),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index sport_sessions_user_started_idx on public.sport_sessions (user_id, started_at desc);

create table public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  eaten_at timestamptz not null,
  meal text not null default 'snack' check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null check (length(name) between 1 and 80),
  calories_kcal int not null check (calories_kcal between 0 and 10000),
  protein_g numeric(6, 1) check (protein_g >= 0),
  carbs_g numeric(6, 1) check (carbs_g >= 0),
  fat_g numeric(6, 1) check (fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index food_entries_user_eaten_idx on public.food_entries (user_id, eaten_at desc);

do $$
declare t text;
begin
  foreach t in array array['daily_activity', 'sport_sessions', 'food_entries'] loop
    execute format('create index %1$s_sync_idx on public.%1$s (user_id, updated_at)', t);
    execute format('create trigger %1$s_touch before insert or update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner full access" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Your own daily points and streak days, for the web dashboard (the phone computes them locally).
create or replace function public.my_daily_scores(p_since date default '-infinity')
returns table (day date, workouts bigint, points numeric, streak_day bigint)
language sql stable security definer set search_path = '' as $$
  select d.day, d.workouts, d.points, d.streak_day
    from private.daily_scores d
   where d.user_id = auth.uid() and d.day >= p_since
   order by d.day
$$;
revoke all on function public.my_daily_scores(date) from public, anon;
grant execute on function public.my_daily_scores(date) to authenticated;
