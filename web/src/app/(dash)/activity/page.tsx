import { Bars } from '@/components/charts';
import { Card, CardTitle, Empty } from '@/components/ui';
import { sportOf } from '@/lib/calories';
import { getProfile, loadActivity } from '@/lib/data';
import { dayIn, formatDuration, shortDay } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABEL: Record<string, string> = { breakfast: '🍳 Breakfast', lunch: '🍛 Lunch', dinner: '🍲 Dinner', snack: '🍎 Snacks' };

export default async function ActivityPage() {
  const supabase = await createClient();
  const profile = (await getProfile(supabase))!;
  const a = await loadActivity(supabase, profile, 30);
  const tz = profile.timezone;
  const dist = (m: number) => (profile.unit_distance === 'mi' ? `${(m / 1609.34).toFixed(1)} mi` : `${(m / 1000).toFixed(1)} km`);
  const days = [...a.stats].reverse();
  const foodDays = days.slice(0, 7).filter((d) => a.food.some((f) => dayIn(tz, new Date(f.eaten_at)) === d.day));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle aside="last 30 days">Distance walked</CardTitle>
        <Bars data={a.stats.map((s) => ({ label: shortDay(s.day), km: Math.round(s.distanceM / 100) / 10 }))} dataKey="km" name="Distance" unit=" km" height={180} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Daily log</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3">Day</th>
                  <th className="py-2 pr-3 text-right">Steps</th>
                  <th className="py-2 pr-3 text-right">Distance</th>
                  <th className="py-2 pr-3 text-right">Eaten</th>
                  <th className="py-2 text-right">Burned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {days.map((d) => (
                  <tr key={d.day}>
                    <td className="py-2 pr-3 text-dim">{shortDay(d.day)}</td>
                    <td className={`py-2 pr-3 text-right ${d.steps >= profile.step_goal ? 'text-success' : ''}`}>{d.steps ? d.steps.toLocaleString() : '–'}</td>
                    <td className="py-2 pr-3 text-right">{d.distanceM ? dist(d.distanceM) : '–'}</td>
                    <td className="py-2 pr-3 text-right">{d.eaten || '–'}</td>
                    <td className="py-2 text-right">{d.burned || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle aside="last 30 days">Sports</CardTitle>
            {a.sports.length === 0 ? (
              <Empty>No sports sessions yet. Log one from the Activity tab in the app.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {a.sports.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-2xl">{sportOf(x.sport).emoji}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{sportOf(x.sport).name}</span>
                      <span className="block text-sm text-dim">
                        {new Date(x.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz })} · {formatDuration(x.duration_s)} · {x.intensity}
                        {x.distance_m ? ` · ${dist(Number(x.distance_m))}` : ''}
                      </span>
                      {x.notes && <span className="block text-sm text-muted">{x.notes}</span>}
                    </span>
                    <span className="text-sm text-dim tabular-nums">{x.calories_kcal} kcal</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle aside="last 7 days">Food log</CardTitle>
            {foodDays.length === 0 && <Empty>No food logged this week.</Empty>}
            <div className="flex flex-col gap-5">
              {foodDays.map((d) => {
                const items = a.food.filter((f) => dayIn(tz, new Date(f.eaten_at)) === d.day);
                const protein = items.reduce((s, f) => s + Number(f.protein_g ?? 0), 0);
                return (
                  <div key={d.day}>
                    <p className="mb-1 flex justify-between text-sm font-semibold">
                      <span>{shortDay(d.day)}</span>
                      <span className="text-dim">{d.eaten.toLocaleString()} kcal{protein ? ` · ${Math.round(protein)} g protein` : ''}</span>
                    </p>
                    {MEALS.filter((m) => items.some((f) => f.meal === m)).map((m) => (
                      <div key={m} className="mt-1">
                        <p className="text-xs text-muted">{MEAL_LABEL[m]}</p>
                        {items.filter((f) => f.meal === m).map((f) => (
                          <p key={f.id} className="flex justify-between text-sm">
                            <span className="truncate pr-2">{f.name}</span>
                            <span className="text-dim tabular-nums">{f.calories_kcal}</span>
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
