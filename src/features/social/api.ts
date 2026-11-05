import { addDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/utils/uuid';
import { localDay } from './points';

// Leaderboards, groups and contests live only on the server (they're about other people),
// so these call Supabase directly instead of going through the local database.

export type Period = 'day' | 'week' | 'month' | 'all';
export type Metric = 'points' | 'workouts' | 'volume' | 'duration';

export type LeaderRow = {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  value: number;
  workouts?: number;
  streak?: number;
  is_me: boolean;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  owner_id: string;
  member_count: number;
  is_member: boolean;
  invite_code: string | null;
};

export type Contest = {
  id: string;
  title: string;
  description: string | null;
  metric: Metric;
  starts_on: string;
  ends_on: string;
  group_id: string | null;
  group_name: string | null;
  is_official: boolean;
  is_owner: boolean;
  is_public: boolean;
  participants: number;
  joined: boolean;
  invite_code: string | null;
};

export type ContestFilter = 'active' | 'upcoming' | 'ended' | 'mine';

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// bigint / numeric columns arrive as strings or numbers depending on size — normalise.
const num = (v: unknown) => Number(v ?? 0);

// ---- leaderboards -----------------------------------------------------------

type BoardRow = Omit<LeaderRow, 'value'> & { points: number };

export async function leaderboard(period: Period, groupId?: string): Promise<LeaderRow[]> {
  const rows = await rpc<BoardRow[]>('leaderboard', { p_period: period, p_group: groupId ?? null });
  return rows.map((r) => ({ ...r, rank: num(r.rank), value: num(r.points), workouts: num(r.workouts), streak: num(r.streak) }));
}

export async function contestLeaderboard(contestId: string): Promise<LeaderRow[]> {
  const rows = await rpc<LeaderRow[]>('contest_leaderboard', { p_contest: contestId });
  return rows.map((r) => ({ ...r, rank: num(r.rank), value: num(r.value) }));
}

// ---- groups -----------------------------------------------------------------

const toGroup = (g: Group): Group => ({ ...g, member_count: num(g.member_count) });

export async function listGroups(opts: { search?: string; mine?: boolean } = {}): Promise<Group[]> {
  const rows = await rpc<Group[]>('list_groups', { p_search: opts.search?.trim() || null, p_mine: !!opts.mine });
  return rows.map(toGroup);
}

export async function getGroup(id: string): Promise<Group | null> {
  const rows = await rpc<Group[]>('list_groups', { p_id: id });
  return rows[0] ? toGroup(rows[0]) : null;
}

/** Returns the new group's id. */
export async function createGroup(userId: string, g: { name: string; description: string; isPublic: boolean }): Promise<string> {
  const id = uuid();
  const { error } = await supabase.from('groups').insert({
    id, owner_id: userId, name: g.name.trim(), description: g.description.trim() || null, is_public: g.isPublic,
  });
  check(error);
  return id;
}

export async function joinPublicGroup(userId: string, groupId: string) {
  const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: userId });
  check(error);
}

/** Returns the group's id. */
export async function joinGroupByCode(code: string): Promise<string> {
  return rpc<string>('join_group', { p_code: code });
}

export async function leaveGroup(userId: string, groupId: string) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  check(error);
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  check(error);
}

// ---- contests ---------------------------------------------------------------

const toContest = (c: Contest): Contest => ({ ...c, participants: num(c.participants) });

export async function listContests(filter: ContestFilter, groupId?: string): Promise<Contest[]> {
  const rows = await rpc<Contest[]>('list_contests', { p_filter: filter, p_group: groupId ?? null });
  return rows.map(toContest);
}

export async function getContest(id: string): Promise<Contest | null> {
  const rows = await rpc<Contest[]>('list_contests', { p_id: id });
  return rows[0] ? toContest(rows[0]) : null;
}

export type NewContest = {
  title: string;
  description: string;
  metric: Metric;
  startsIn: number; // days from today
  days: number;
  isPublic: boolean;
  groupId?: string;
};

/** Returns the new contest's id. You're entered automatically. */
export async function createContest(userId: string, c: NewContest): Promise<string> {
  const id = uuid();
  const start = addDays(new Date(), c.startsIn);
  const { error } = await supabase.from('contests').insert({
    id,
    created_by: userId,
    title: c.title.trim(),
    description: c.description.trim() || null,
    metric: c.metric,
    starts_on: localDay(start),
    ends_on: localDay(addDays(start, c.days - 1)),
    is_public: c.isPublic,
    group_id: c.groupId ?? null,
  });
  check(error);
  return id;
}

export async function joinContest(contestId: string) {
  await rpc<string>('join_contest', { p_id: contestId });
}

/** Returns the contest's id. */
export async function joinContestByCode(code: string): Promise<string> {
  return rpc<string>('join_contest', { p_code: code });
}

export async function leaveContest(userId: string, contestId: string) {
  const { error } = await supabase.from('contest_entries').delete().eq('contest_id', contestId).eq('user_id', userId);
  check(error);
}

export async function deleteContest(contestId: string) {
  const { error } = await supabase.from('contests').delete().eq('id', contestId);
  check(error);
}
