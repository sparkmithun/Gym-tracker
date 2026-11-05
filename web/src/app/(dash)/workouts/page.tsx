import Link from 'next/link';
import { Card, Empty } from '@/components/ui';
import { getProfile, listWorkouts } from '@/lib/data';
import { formatDuration } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export default async function Workouts() {
  const supabase = await createClient();
  const profile = (await getProfile(supabase))!;
  const workouts = await listWorkouts(supabase, profile, { limit: 100 });
  const kg = profile.unit_weight === 'lbs' ? 2.20462 : 1;

  return (
    <Card>
      <h1 className="mb-4 text-xl font-extrabold">Workouts</h1>
      {workouts.length === 0 ? (
        <Empty>No workouts synced yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Workout</th>
                <th className="py-2 pr-4 text-right">Time</th>
                <th className="py-2 pr-4 text-right">Sets</th>
                <th className="py-2 pr-4 text-right">Volume</th>
                <th className="py-2 text-right">kcal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workouts.map((w) => (
                <tr key={w.id} className="hover:bg-surface-alt">
                  <td className="whitespace-nowrap py-3 pr-4 text-dim">
                    {new Date(w.startedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: profile.timezone })}
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={`/workouts/${w.id}`} className="font-semibold text-primary hover:underline">{w.title}</Link>
                    <p className="text-xs text-muted">
                      {w.exercises.map((e) => e.name).slice(0, 3).join(', ')}
                      {w.exercises.length > 3 ? '…' : ''}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatDuration(w.durationS)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{w.sets}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">{Math.round(w.volumeKg * kg).toLocaleString()} {profile.unit_weight}</td>
                  <td className="py-3 text-right tabular-nums">{w.kcal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
