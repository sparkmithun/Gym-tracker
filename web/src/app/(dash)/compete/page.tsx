import Link from 'next/link';
import { Card, CardTitle, Empty, Tile } from '@/components/ui';
import { getProfile, leaderboard, loadActivity } from '@/lib/data';
import { shortDay } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];
const MEDALS = ['🥇', '🥈', '🥉'];
const METRIC: Record<string, string> = { points: 'points', workouts: 'workouts', volume: 'volume', duration: 'time trained' };

type Group = { id: string; name: string; member_count: number; is_public: boolean };
type Contest = { id: string; title: string; metric: string; starts_on: string; ends_on: string; participants: number; is_official: boolean };

export default async function Compete({ searchParams }: PageProps<'/compete'>) {
  const { period: p } = await searchParams;
  const period = typeof p === 'string' && PERIODS.some((x) => x.key === p) ? p : 'week';
  const supabase = await createClient();
  const profile = (await getProfile(supabase))!;
  const [board, a, groups, contests] = await Promise.all([
    leaderboard(supabase, period).catch(() => []),
    loadActivity(supabase, profile, 1),
    supabase.rpc('list_groups', { p_mine: true }),
    supabase.rpc('list_contests', { p_filter: 'mine' }),
  ]);
  const myGroups = (groups.data ?? []) as Group[];
  const myContests = (contests.data ?? []) as Contest[];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Today" value={a.points.today} sub="points" accent="var(--gold)" />
        <Tile label="This week" value={a.points.week.toLocaleString()} sub="points" />
        <Tile label="This month" value={a.points.month.toLocaleString()} sub="points" />
        <Tile label="Day streak" value={`🔥 ${a.points.streak}`} sub={`best ${a.points.best} days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Global leaderboard</CardTitle>
          <div className="mb-4 flex flex-wrap gap-2">
            {PERIODS.map((x) => (
              <Link
                key={x.key}
                href={`/compete?period=${x.key}`}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${x.key === period ? 'border-primary bg-primary text-white' : 'border-border text-dim hover:text-text'}`}
              >
                {x.label}
              </Link>
            ))}
          </div>
          {board.length === 0 ? (
            <Empty>Nobody has scored yet in this period.</Empty>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {board.map((r) => (
                <li key={r.user_id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${r.is_me ? 'border border-primary bg-primary-dim' : 'bg-surface-alt'}`}>
                  <span className="w-8 text-center text-lg font-bold">{r.rank <= 3 && r.points > 0 ? MEDALS[r.rank - 1] : r.rank}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.display_name || r.username}{r.is_me ? ' (you)' : ''}</span>
                    <span className="block text-xs text-dim">@{r.username}{r.streak ? ` · 🔥 ${r.streak}` : ''} · {r.workouts} workouts</span>
                  </span>
                  <span className="font-bold tabular-nums">{r.points.toLocaleString()} pts</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>My groups</CardTitle>
            {myGroups.length === 0 ? (
              <Empty>Join or create groups in the app.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {myGroups.map((g) => (
                  <li key={g.id} className="flex justify-between py-2 text-sm">
                    <span className="font-semibold">{g.is_public ? '' : '🔒 '}{g.name}</span>
                    <span className="text-dim">{Number(g.member_count)} members</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>My contests</CardTitle>
            {myContests.length === 0 ? (
              <Empty>Join contests in the app.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {myContests.map((c) => (
                  <li key={c.id} className="py-2 text-sm">
                    <p className="font-semibold">{c.is_official ? '⭐ ' : ''}{c.title}</p>
                    <p className="text-dim">
                      {shortDay(c.starts_on)} – {shortDay(c.ends_on)} · most {METRIC[c.metric] ?? c.metric} · {Number(c.participants)} players
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
