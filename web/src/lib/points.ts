import { addDay, monthStart, weekStart } from './dates';

// Summarises the server's daily scores (public.my_daily_scores) like the app's points card.
export type ScoreDay = { day: string; workouts: number; points: number; streak_day: number };

export function summarizePoints(days: ScoreDay[], today: string) {
  const sum = (from: string) => days.filter((d) => d.day >= from && d.day <= today).reduce((a, d) => a + Number(d.points), 0);
  const last = days[days.length - 1];
  const alive = last && (last.day === today || last.day === addDay(today, -1));
  return {
    today: sum(today),
    week: sum(weekStart(today)),
    month: sum(monthStart(today)),
    total: sum('0000-00-00'),
    streak: alive ? Number(last.streak_day) : 0,
    best: days.reduce((m, d) => Math.max(m, Number(d.streak_day)), 0),
  };
}
