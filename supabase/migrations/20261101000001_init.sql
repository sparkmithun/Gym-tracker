-- Core schema. All weights in kg, distances in metres, durations in seconds.
-- Every user-owned row has a client-generated UUID, updated_at (server clock) and deleted_at (soft delete)
-- so the offline sync engine can push/pull incrementally.

create type public.exercise_type as enum (
  'weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_bodyweight',
  'duration', 'distance_duration', 'weight_distance');
create type public.set_type as enum ('normal', 'warmup', 'drop', 'failure');
create type public.visibility as enum ('private', 'followers', 'public');

-- updated_at always comes from the server clock (insert and update) so pull cursors are reliable.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  avatar_url text,
  bio text,
  unit_weight text not null default 'kg' check (unit_weight in ('kg', 'lbs')),
  unit_distance text not null default 'km' check (unit_distance in ('km', 'mi')),
  default_rest_seconds int not null default 90 check (default_rest_seconds between 0 and 900),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade, -- null = global library
  name text not null check (length(name) between 1 and 80),
  type public.exercise_type not null default 'weight_reps',
  equipment text,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  instructions text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index exercises_owner_idx on public.exercises (owner_id, updated_at);

create table public.routine_folders (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  folder_id uuid references public.routine_folders on delete set null,
  name text not null,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.routine_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_id uuid not null references public.routines on delete cascade,
  exercise_id uuid not null references public.exercises,
  sort_order int not null,
  superset_group int,
  rest_seconds int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.routine_sets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises on delete cascade,
  sort_order int not null,
  set_type public.set_type not null default 'normal',
  target_weight_kg numeric(7, 2),
  target_reps int,
  target_duration_s int,
  target_distance_m numeric(9, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_id uuid references public.routines on delete set null,
  title text not null,
  notes text,
  started_at timestamptz not null,
  ended_at timestamptz,
  photo_url text,
  visibility public.visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

create table public.workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  exercise_id uuid not null references public.exercises,
  sort_order int not null,
  superset_group int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workout_exercises_user_ex_idx on public.workout_exercises (user_id, exercise_id);

create table public.workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises on delete cascade,
  sort_order int not null,
  set_type public.set_type not null default 'normal',
  weight_kg numeric(7, 2),
  reps int,
  duration_s int,
  distance_m numeric(9, 2),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric(5, 2),
  body_fat_pct numeric(4, 1),
  neck_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  waist_cm numeric(5, 1),
  hips_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Pull cursors: (user_id, updated_at) on every synced table.
do $$
declare t text;
begin
  foreach t in array array['routine_folders', 'routines', 'routine_exercises', 'routine_sets',
    'workouts', 'workout_exercises', 'workout_sets', 'body_measurements'] loop
    execute format('create index %1$s_sync_idx on public.%1$s (user_id, updated_at)', t);
  end loop;
  foreach t in array array['profiles', 'exercises', 'routine_folders', 'routines', 'routine_exercises',
    'routine_sets', 'workouts', 'workout_exercises', 'workout_sets', 'body_measurements'] loop
    execute format('create trigger %1$s_touch before insert or update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Create a profile row automatically when a user signs up (Google / Apple).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Account deletion (required by App Store & Play Store). Cascades to every user table.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from storage.objects where owner = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
