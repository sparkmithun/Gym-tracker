-- Social: points, daily streaks, leaderboards, groups and contests.
--
-- Points are derived from synced workouts, never stored, so they can't drift and editing or
-- deleting a workout updates every leaderboard. The formula matches src/features/social/points.ts;
-- keep the two in step.
--
--   per workout (needs >= 1 completed working set):
--     10 + 2 per working set (max 40 sets) + 1 per 500 kg volume (max 50)
--        + 1 per 5 min (max 24) + 1 per km (max 20)
--   per day:  min(sum of workouts, 200) + 5 x (streak day - 1), bonus capped at +30
--   streak:   consecutive days with a workout, alive until a full day is missed
--
-- Days are the user's local calendar days (profiles.timezone).

alter table public.profiles add column timezone text not null default 'UTC';

-- Unknown zones fall back to UTC instead of rejecting the profile sync.
create or replace function public.clean_timezone() returns trigger
language plpgsql as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception when others then
  new.timezone = 'UTC';
  return new;
end $$;
create trigger profiles_timezone before insert or update of timezone on public.profiles
  for each row execute function public.clean_timezone();

-- Not exposed through the API: these views read every user's workouts.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create view private.workout_scores as
select w.id, w.user_id,
       (w.started_at at time zone p.timezone)::date as day,
       coalesce(s.sets, 0) as sets,
       coalesce(s.volume_kg, 0) as volume_kg,
       greatest(extract(epoch from w.ended_at - w.started_at), 0)::int as duration_s,
       10 + 2 * least(coalesce(s.sets, 0), 40)
          + least(floor(coalesce(s.volume_kg, 0) / 500), 50)
          + least(floor(greatest(extract(epoch from w.ended_at - w.started_at), 0) / 300), 24)
          + least(floor(coalesce(s.distance_m, 0) / 1000), 20) as points
  from public.workouts w
  join public.profiles p on p.id = w.user_id
  left join lateral (
    select count(*) as sets,
           sum(coalesce(ws.weight_kg, 0) * coalesce(ws.reps, 0)) as volume_kg,
           sum(coalesce(ws.distance_m, 0)) as distance_m
      from public.workout_exercises we
      join public.workout_sets ws on ws.workout_exercise_id = we.id
     where we.workout_id = w.id and we.deleted_at is null and ws.deleted_at is null
       and ws.completed and ws.set_type <> 'warmup'
  ) s on true
 where w.deleted_at is null and w.ended_at is not null;

-- One row per user per active day. Consecutive days form an "island" (gaps and islands).
create view private.daily_scores as
with days as (
  select user_id, day, count(*) as workouts, sum(volume_kg) as volume_kg, sum(duration_s) as duration_s,
         least(sum(points), 200) as base_points
    from private.workout_scores
   where sets > 0
   group by user_id, day
), islands as (
  select *, day - (row_number() over (partition by user_id order by day))::int as island from days
), numbered as (
  select *, row_number() over (partition by user_id, island order by day) as streak_day from islands
)
select user_id, day, workouts, volume_kg, duration_s, streak_day,
       base_points + 5 * least(streak_day - 1, 6) as points
  from numbered;

-- Current streak: the latest island, if it reaches today or yesterday in the user's zone.
create view private.current_streaks as
select distinct on (d.user_id) d.user_id,
       case when d.day >= (now() at time zone p.timezone)::date - 1 then d.streak_day else 0 end::int as streak
  from private.daily_scores d
  join public.profiles p on p.id = d.user_id
 order by d.user_id, d.day desc;

-- ---- groups ------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 40),
  description text check (length(description) <= 280),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  is_public boolean not null default true,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create trigger groups_touch before insert or update on public.groups
  for each row execute function public.touch_updated_at();

create or replace function public.add_group_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger groups_add_owner after insert on public.groups
  for each row execute function public.add_group_owner();

-- Security definer so RLS policies can use it without recursing into group_members' own policy.
create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid())
$$;

alter table public.groups enable row level security;
create policy "see public groups and own groups" on public.groups
  for select to authenticated using (is_public or public.is_group_member(id));
create policy "create own groups" on public.groups
  for insert to authenticated with check (owner_id = auth.uid());
create policy "owner edits group" on public.groups
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes group" on public.groups
  for delete to authenticated using (owner_id = auth.uid());

alter table public.group_members enable row level security;
create policy "members see each other" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "join public groups" on public.group_members
  for insert to authenticated with check (
    user_id = auth.uid() and role = 'member'
    and exists (select 1 from public.groups g where g.id = group_id and g.is_public));
create policy "leave, or owner removes" on public.group_members
  for delete to authenticated using (
    (user_id = auth.uid() and role <> 'owner')
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid() and user_id <> auth.uid()));

-- ---- contests ----------------------------------------------------------------

create type public.contest_metric as enum ('points', 'workouts', 'volume', 'duration');

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 60),
  description text check (length(description) <= 500),
  metric public.contest_metric not null default 'points',
  starts_on date not null,
  ends_on date not null,
  group_id uuid references public.groups on delete cascade,
  created_by uuid default auth.uid() references auth.users on delete set null,
  is_public boolean not null default true,
  official_key text unique, -- set only for the app's own weekly / monthly contests
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 92)
);
create index contests_dates_idx on public.contests (ends_on, starts_on);

create table public.contest_entries (
  contest_id uuid not null references public.contests on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (contest_id, user_id)
);
create index contest_entries_user_idx on public.contest_entries (user_id);

create trigger contests_touch before insert or update on public.contests
  for each row execute function public.touch_updated_at();

create or replace function public.add_contest_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.contest_entries (contest_id, user_id) values (new.id, new.created_by);
  end if;
  return new;
end $$;
create trigger contests_add_creator after insert on public.contests
  for each row execute function public.add_contest_creator();

create or replace function public.is_contest_entrant(p_contest uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contest_entries where contest_id = p_contest and user_id = auth.uid())
$$;

-- Who can see a contest: public ones, group ones for members, and anything you created or joined.
create or replace function public.can_see_contest(p_id uuid, p_group uuid, p_public boolean, p_creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_group is not null then public.is_group_member(p_group) else p_public end
      or p_creator = auth.uid()
      or public.is_contest_entrant(p_id)
$$;

alter table public.contests enable row level security;
create policy "see visible contests" on public.contests
  for select to authenticated using (public.can_see_contest(id, group_id, is_public, created_by));
create policy "create contests" on public.contests
  for insert to authenticated with check (
    created_by = auth.uid() and official_key is null
    and (group_id is null or public.is_group_member(group_id)));
create policy "creator edits contest" on public.contests
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid() and official_key is null);
create policy "creator deletes contest" on public.contests
  for delete to authenticated using (created_by = auth.uid());

-- Joining goes through join_contest() (it checks visibility and dates); leaving is a plain delete.
alter table public.contest_entries enable row level security;
create policy "entrants see each other" on public.contest_entries
  for select to authenticated using (user_id = auth.uid() or public.is_contest_entrant(contest_id));
create policy "leave contests" on public.contest_entries
  for delete to authenticated using (user_id = auth.uid());

-- ---- RPCs --------------------------------------------------------------------

create or replace function private.my_today() returns date
language sql stable security definer set search_path = '' as $$
  select coalesce((select (now() at time zone p.timezone)::date from public.profiles p where p.id = auth.uid()), current_date)
$$;

-- p_period: 'day' | 'week' | 'month' | 'all'. Global boards hide private profiles (except you);
-- group boards show every member. Returns the top p_limit plus your own row.
create or replace function public.leaderboard(p_period text default 'week', p_group uuid default null, p_limit int default 100)
returns table (rank bigint, user_id uuid, username text, display_name text, avatar_url text,
               points bigint, workouts bigint, streak int, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  today date := private.my_today();
  since date;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_group is not null and not public.is_group_member(p_group) then
    raise exception 'You are not a member of this group';
  end if;
  since := case p_period
    when 'day' then today
    when 'week' then date_trunc('week', today)::date
    when 'month' then date_trunc('month', today)::date
    else '-infinity'::date end;

  return query
  with players as (
    select p.id, p.username, p.display_name, p.avatar_url
      from public.profiles p
     where p.username is not null
       and case when p_group is null then (not p.is_private or p.id = me)
                else exists (select 1 from public.group_members gm where gm.group_id = p_group and gm.user_id = p.id) end
  ), totals as (
    select pl.id, pl.username, pl.display_name, pl.avatar_url,
           coalesce(sum(d.points), 0)::bigint as pts, coalesce(sum(d.workouts), 0)::bigint as wk
      from players pl
      left join private.daily_scores d on d.user_id = pl.id and d.day >= since and d.day <= today
     group by pl.id, pl.username, pl.display_name, pl.avatar_url
  ), ranked as (
    select rank() over (order by t.pts desc, t.wk desc) as rnk, t.*
      from totals t
     where t.pts > 0 or t.id = me or p_group is not null
  )
  select r.rnk, r.id, r.username, r.display_name, r.avatar_url, r.pts, r.wk,
         coalesce(cs.streak, 0), r.id = me
    from ranked r
    left join private.current_streaks cs on cs.user_id = r.id
   where r.rnk <= p_limit or r.id = me
   order by r.rnk, r.username;
end $$;

create or replace function public.list_groups(p_search text default null, p_mine boolean default false, p_id uuid default null)
returns table (id uuid, name text, description text, is_public boolean, owner_id uuid,
               member_count bigint, is_member boolean, invite_code text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.description, g.is_public, g.owner_id,
         (select count(*) from public.group_members m where m.group_id = g.id),
         public.is_group_member(g.id),
         case when public.is_group_member(g.id) then g.invite_code end
    from public.groups g
   where auth.uid() is not null
     and (g.is_public or public.is_group_member(g.id))
     and (not p_mine or public.is_group_member(g.id))
     and (p_id is null or g.id = p_id)
     and (p_search is null or g.name ilike '%' || p_search || '%')
   order by (select count(*) from public.group_members m where m.group_id = g.id) desc, g.name
   limit 100
$$;

create or replace function public.join_group(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select g.id into gid from public.groups g where g.invite_code = upper(trim(p_code));
  if gid is null then raise exception 'No group has that invite code'; end if;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;

-- The app's own contests: a points challenge every month and a workout-count challenge every week.
create or replace function private.ensure_official_contests() returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := private.my_today();
  m date := date_trunc('month', today)::date;
  w date := date_trunc('week', today)::date;
begin
  insert into public.contests (title, description, metric, starts_on, ends_on, created_by, official_key)
  values
    (to_char(m, 'FMMonth') || ' Points Challenge',
     'Earn the most points this month. Every workout counts, and streaks add a bonus.',
     'points', m, (m + interval '1 month - 1 day')::date, null, 'points-' || to_char(m, 'YYYY-MM')),
    ('Weekly Warrior',
     'Most workouts from Monday to Sunday wins.',
     'workouts', w, w + 6, null, 'workouts-' || to_char(w, 'IYYY-IW'))
  on conflict (official_key) do nothing;
end $$;

-- p_filter: 'active' | 'upcoming' | 'ended' | 'mine'. p_id fetches one contest.
create or replace function public.list_contests(p_filter text default 'active', p_group uuid default null, p_id uuid default null)
returns table (id uuid, title text, description text, metric public.contest_metric, starts_on date, ends_on date,
               group_id uuid, group_name text, is_official boolean, is_owner boolean, is_public boolean,
               participants bigint, joined boolean, invite_code text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare today date := private.my_today();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform private.ensure_official_contests();
  return query
  select c.id, c.title, c.description, c.metric, c.starts_on, c.ends_on, c.group_id, g.name,
         c.official_key is not null, c.created_by = auth.uid(), c.is_public,
         (select count(*) from public.contest_entries e where e.contest_id = c.id),
         public.is_contest_entrant(c.id),
         case when public.is_contest_entrant(c.id) or c.created_by = auth.uid() then c.invite_code end
    from public.contests c
    left join public.groups g on g.id = c.group_id
   where public.can_see_contest(c.id, c.group_id, c.is_public, c.created_by)
     and (p_id is null or c.id = p_id)
     and (p_group is null or c.group_id = p_group)
     and (p_id is not null or case p_filter
           when 'upcoming' then c.starts_on > today
           when 'ended' then c.ends_on < today
           when 'mine' then public.is_contest_entrant(c.id)
           else c.starts_on <= today and c.ends_on >= today end)
   order by case when p_filter = 'ended' then c.ends_on end desc, c.ends_on, c.title
   limit 100;
end $$;

-- Join by id (a contest you can see) or by invite code (private contests).
create or replace function public.join_contest(p_id uuid default null, p_code text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.contests;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into c from public.contests x
   where (p_id is not null and x.id = p_id) or (p_code is not null and x.invite_code = upper(trim(p_code)));
  if not found then raise exception 'Contest not found'; end if;
  if c.group_id is not null and not public.is_group_member(c.group_id) then
    raise exception 'Join the group first to enter its contests';
  end if;
  if p_code is null and not public.can_see_contest(c.id, c.group_id, c.is_public, c.created_by) then raise exception 'Contest not found'; end if;
  if c.ends_on < private.my_today() then raise exception 'This contest has ended'; end if;
  insert into public.contest_entries (contest_id, user_id) values (c.id, auth.uid()) on conflict do nothing;
  return c.id;
end $$;

-- Standings: each entrant's total for the contest metric over its dates.
-- value is points, workouts, kg or seconds depending on the metric.
create or replace function public.contest_leaderboard(p_contest uuid)
returns table (rank bigint, user_id uuid, username text, display_name text, avatar_url text, value numeric, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.contests;
begin
  select * into c from public.contests x where x.id = p_contest;
  if not found or not public.can_see_contest(c.id, c.group_id, c.is_public, c.created_by) then raise exception 'Contest not found'; end if;
  return query
  with totals as (
    select p.id, p.username, p.display_name, p.avatar_url,
           coalesce(sum(case c.metric
             when 'points' then d.points
             when 'workouts' then d.workouts
             when 'volume' then d.volume_kg
             else d.duration_s end), 0)::numeric as val
      from public.contest_entries e
      join public.profiles p on p.id = e.user_id
      left join private.daily_scores d on d.user_id = e.user_id and d.day between c.starts_on and c.ends_on
     where e.contest_id = c.id
     group by p.id, p.username, p.display_name, p.avatar_url
  )
  select rank() over (order by t.val desc), t.id, t.username, t.display_name, t.avatar_url, t.val, t.id = auth.uid()
    from totals t
   order by 1, t.username;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.leaderboard(text, uuid, int)', 'public.list_groups(text, boolean, uuid)', 'public.join_group(text)',
    'public.list_contests(text, uuid, uuid)', 'public.join_contest(uuid, text)', 'public.contest_leaderboard(uuid)',
    'public.is_group_member(uuid)', 'public.is_contest_entrant(uuid)', 'public.can_see_contest(uuid, uuid, boolean, uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
