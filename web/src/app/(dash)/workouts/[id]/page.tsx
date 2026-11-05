import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, Tile } from '@/components/ui';
import { getProfile, getWorkout } from '@/lib/data';
import { formatDuration } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

const SET_LABEL: Record<string, string> = { warmup: 'W', drop: 'D', failure: 'F' };

export default async function WorkoutDetail({ params }: PageProps<'/workouts/[id]'>) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = (await getProfile(supabase))!;
  const w = await getWorkout(supabase, profile, id);
  if (!w) notFound();
  const kg = profile.unit_weight === 'lbs' ? 2.20462 : 1;
  const wt = (v: number) => `${Math.round(v * kg * 10) / 10} ${profile.unit_weight}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/workouts" className="text-sm text-primary hover:underline">← Workouts</Link>
        <h1 className="mt-2 text-2xl font-extrabold">{w.title}</h1>
        <p className="text-dim">
          {new Date(w.startedAt).toLocaleString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: profile.timezone,
          })}
        </p>
        {w.notes && <p className="mt-2">{w.notes}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Duration" value={formatDuration(w.durationS)} />
        <Tile label="Volume" value={Math.round(w.volumeKg * kg).toLocaleString()} sub={profile.unit_weight} />
        <Tile label="Working sets" value={w.sets} />
        <Tile label="Calories" value={w.kcal} sub="estimated kcal" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {w.exercises.map((e, i) => (
          <Card key={i}>
            <h2 className="mb-3 font-bold">{e.name}</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {e.sets.map((s, j) => (
                  <tr key={j} className={s.completed ? '' : 'text-muted line-through'}>
                    <td className="w-10 py-1.5 font-semibold text-dim">{SET_LABEL[s.set_type] ?? j + 1}</td>
                    <td className="py-1.5 tabular-nums">
                      {[
                        s.weight_kg != null ? wt(Number(s.weight_kg)) : null,
                        s.reps != null ? `${s.reps} reps` : null,
                        s.duration_s != null ? formatDuration(s.duration_s) : null,
                        s.distance_m != null ? `${Math.round(Number(s.distance_m)) / 1000} km` : null,
                      ]
                        .filter(Boolean)
                        .join(' × ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
