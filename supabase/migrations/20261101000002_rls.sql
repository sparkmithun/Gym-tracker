-- Row Level Security: users can only touch their own rows.
-- Global exercises (owner_id is null) are readable by everyone signed in.

alter table public.profiles enable row level security;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

alter table public.exercises enable row level security;
create policy "read global or own exercises" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "insert own exercises" on public.exercises
  for insert to authenticated with check (owner_id = auth.uid());
create policy "update own exercises" on public.exercises
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own exercises" on public.exercises
  for delete to authenticated using (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['routine_folders', 'routines', 'routine_exercises', 'routine_sets',
    'workouts', 'workout_exercises', 'workout_sets', 'body_measurements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner full access" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Storage: avatars (public read) and workout photos (private). Files live under <user id>/...
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('workout-photos', 'workout-photos', false)
on conflict (id) do nothing;

create policy "users manage own files" on storage.objects for all to authenticated
  using (bucket_id in ('avatars', 'workout-photos') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('avatars', 'workout-photos') and (storage.foldername(name))[1] = auth.uid()::text);
