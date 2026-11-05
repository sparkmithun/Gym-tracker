import Link from 'next/link';
import { Bars, CaloriesBars } from '@/components/charts';
import { Card, CardTitle, Empty, Progress, Tile } from '@/components/ui';
import { sportOf } from '@/lib/calories';
import { getProfile, leaderboard, loadActivity } from '@/lib/data';
import { formatDuration, shortDay, weekStart } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export default async function Overview() {
  const supabase = await createClient();
  const profile = (await getProfile(supabase))!;
  const [a, board] = await Promise.all([loadActivity(supabase, profile, 56), leaderboard(supabase, 'week').catch(() => [])]);
  const today = a.stats[a.stats.length - 1];
  const remaining = profile.calorie_goal - today.eaten + today.burned;
  const me = board.find((r) => r.is_me && r.points > 0);
  const last30 = a.stats.slice(-30);
  const last14 = a.stats.slice(-14);

  // Workouts per week (Monday start), last 8 weeks.
  const weeks = new Map<string, number>();
  for (const s of a.stats) weeks.set(weekStart(s.day), (weeks.get(weekStart(s.day)) ?? 0) + s.workouts);
  const weekBars = [...weeks.entries()].slice(-8).map(([w, n]) => ({ label: shortDay(w), workouts: n }));

  const recent = [
    ...a.workouts.map((w) => ({ at: w.startedAt, href: `/workouts/${w.id}`, emoji: '🏋️', title: w.title, sub: `${formatDuration(w.durationS)} · ${w.sets} sets · ${Math.round(w.volumeKg).toLocaleString()} kg`, kcal: w.kcal })),
    ...a.sports.map((x) => ({ at: x.started_at, href: '/activity', emoji: sportOf(x.sport).emoji, title: sportOf(x.sport).name, sub: `${formatDuration(x.duration_s)} · ${x.intensity}`, kcal: x.calories_kcal })),
  ]
    .sort((p, q) => q.at.localeCompare(p.at))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label="Steps today"
          value={today.steps.toLocaleString()}
          sub={<><span>of {profile.step_goal.toLocaleString()} goal</span><Progress value={today.steps} max={profile.step_goal} color={today.steps >= profile.step_goal ? 'var(--success)' : undefined} /></>}
        />
        <Tile
          label={remaining < 0 ? 'Calories over' : 'Calories left'}
          value={Math.abs(remaining).toLocaleString()}
          accent={remaining < 0 ? 'var(--danger)' : undefined}
          sub={`${today.eaten.toLocaleString()} eaten · ${today.burned.toLocaleString()} burned`}
        />
        <Tile label="Day streak" value={`🔥 ${a.points.streak}`} sub={`Best ${a.points.best} days`} />
        <Tile label="Points this week" value={a.points.week.toLocaleString()} sub={me ? `#${me.rank} on the global board` : `${a.points.today} today`} accent="var(--gold)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle aside="last 30 days">Steps</CardTitle>
          <Bars data={last30.map((s) => ({ label: shortDay(s.day), steps: s.steps }))} dataKey="steps" name="Steps" goal={profile.step_goal} />
        </Card>
        <Card>
          <CardTitle aside={`goal ${profile.calorie_goal.toLocaleString()} kcal/day`}>Calories</CardTitle>
          <CaloriesBars data={last14.map((s) => ({ label: shortDay(s.day), eaten: s.eaten, burned: s.burned }))} />
        </Card>
        <Card>
          <CardTitle aside="last 8 weeks">Workouts per week</CardTitle>
          <Bars data={weekBars} dataKey="workouts" name="Workouts" />
        </Card>
        <Card>
          <CardTitle aside={<Link href="/workouts" className="text-primary hover:underline">All workouts</Link>}>Recent activity</CardTitle>
          {recent.length === 0 ? (
            <Empty>Nothing synced yet. Log a workout or sport in the app and it appears here.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recent.map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.title}</span>
                      <span className="block text-sm text-dim">{new Date(r.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: profile.timezone })} · {r.sub}</span>
                    </span>
                    <span className="text-sm text-dim tabular-nums">{r.kcal} kcal</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-center text-xs text-muted">Synced from the Spark Lift app · calories burned are estimates for {Math.round(a.weight)} kg</p>
    </div>
  );
}
