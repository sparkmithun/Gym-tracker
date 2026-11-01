-- Run with: npx supabase test db   (requires the local Supabase stack: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- two users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

insert into public.workouts (id, user_id, title, started_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'A workout', now());

-- act as user B
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is((select count(*) from public.workouts)::int, 0, 'B cannot see A''s workouts');
select ok((select count(*) from public.exercises where owner_id is null) > 0, 'B can read global exercises');
select throws_ok(
  $$insert into public.workouts (id, user_id, title, started_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'spoof', now())$$,
  '42501', null, 'B cannot insert rows for A');
select lives_ok(
  $$insert into public.workouts (id, user_id, title, started_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'mine', now())$$,
  'B can insert own workout');

select * from finish();
rollback;
