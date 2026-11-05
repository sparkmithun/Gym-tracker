import { addDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

// Points and daily streaks. The same formula runs on the server for leaderboards
// (supabase/migrations/20261102000001_social.sql, private.workout_scores / daily_scores);
// keep the two in step.

export const POINTS = {
  base: 10,
  perSet: 2,
  maxSets: 40,
  volumeStepKg: 500,
  maxVolume: 50,
  minutesStep: 5,
  maxMinutes: 24,
  maxKm: 20,
  dailyCap: 200,
  streakBonus: 5,
  maxStreakSteps: 6,
} as const;

export type WorkoutScoreInput = { sets: number; volumeKg: number; durationS: number; distanceM: number };

/** Points one finished workout earns. A workout with no completed working set earns nothing. */
export function workoutPoints({ sets, volumeKg, durationS, distanceM }: WorkoutScoreInput): number {
  if (sets <= 0) return 0;
  return (
    POINTS.base +
    POINTS.perSet * Math.min(sets, POINTS.maxSets) +
    Math.min(Math.floor(volumeKg / POINTS.volumeStepKg), POINTS.maxVolume) +
    Math.min(Math.floor(Math.max(durationS, 0) / (POINTS.minutesStep * 60)), POINTS.maxMinutes) +
    Math.min(Math.floor(distanceM / 1000), POINTS.maxKm)
  );
}

export type DayScore = { day: string; workouts: number; base: number; streakDay: number; points: number };

/** Turns per-workout points keyed by local day (yyyy-MM-dd) into daily scores with the streak bonus. */
export function dailyScores(workouts: { day: string; points: number }[]): DayScore[] {
  const byDay = new Map<string, { workouts: number; sum: number }>();
  for (const w of workouts) {
    if (w.points <= 0) continue;
    const d = byDay.get(w.day) ?? { workouts: 0, sum: 0 };
    d.workouts++;
    d.sum += w.points;
    byDay.set(w.day, d);
  }
  const days = [...byDay.keys()].sort();
  const out: DayScore[] = [];
  let streakDay = 0;
  days.forEach((day, i) => {
    streakDay = i > 0 && nextDay(days[i - 1]) === day ? streakDay + 1 : 1;
    const { workouts: n, sum } = byDay.get(day)!;
    const base = Math.min(sum, POINTS.dailyCap);
    out.push({ day, workouts: n, base, streakDay, points: base + POINTS.streakBonus * Math.min(streakDay - 1, POINTS.maxStreakSteps) });
  });
  return out;
}

/** Days in a row with a workout. Still alive today if you trained yesterday. */
export function currentStreak(days: DayScore[], today: string): number {
  const last = days[days.length - 1];
  if (!last) return 0;
  return last.day === today || nextDay(last.day) === today ? last.streakDay : 0;
}

export function bestStreak(days: DayScore[]): number {
  return days.reduce((m, d) => Math.max(m, d.streakDay), 0);
}

/** Bonus the next consecutive day would add, for "train tomorrow for +N" nudges. */
export function nextStreakBonus(streak: number): number {
  return POINTS.streakBonus * Math.min(streak, POINTS.maxStreakSteps);
}

export type PointsSummary = { today: number; week: number; month: number; total: number; streak: number; best: number; trainedToday: boolean };

export function summarize(days: DayScore[], now = new Date()): PointsSummary {
  const today = localDay(now);
  const week = localDay(startOfWeek(now, { weekStartsOn: 1 }));
  const month = localDay(startOfMonth(now));
  const sum = (from: string) => days.filter((d) => d.day >= from && d.day <= today).reduce((a, d) => a + d.points, 0);
  return {
    today: sum(today),
    week: sum(week),
    month: sum(month),
    total: sum('0000-00-00'),
    streak: currentStreak(days, today),
    best: bestStreak(days),
    trainedToday: days.some((d) => d.day === today),
  };
}

export const localDay = (d: Date) => format(d, 'yyyy-MM-dd');
const nextDay = (day: string) => localDay(addDays(parseISO(day), 1));
