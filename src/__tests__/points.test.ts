/// <reference types="jest" />
import { bestStreak, currentStreak, dailyScores, nextStreakBonus, summarize, workoutPoints } from '@/features/social/points';

describe('workoutPoints', () => {
  it('scores sets, volume, time and distance', () => {
    // 10 base + 2*15 sets + 6000/500 volume + 60min/5 + 0 km
    expect(workoutPoints({ sets: 15, volumeKg: 6000, durationS: 3600, distanceM: 0 })).toBe(10 + 30 + 12 + 12);
  });

  it('caps each part', () => {
    expect(workoutPoints({ sets: 100, volumeKg: 1e6, durationS: 1e6, distanceM: 1e6 })).toBe(10 + 80 + 50 + 24 + 20);
  });

  it('gives nothing without a completed working set', () => {
    expect(workoutPoints({ sets: 0, volumeKg: 0, durationS: 3600, distanceM: 0 })).toBe(0);
  });
});

describe('daily scores and streaks', () => {
  const w = (day: string, points = 50) => ({ day, points });

  it('adds +5 per consecutive day, capped at +30', () => {
    const days = dailyScores(['2026-11-01', '2026-11-02', '2026-11-03'].map((d) => w(d)));
    expect(days.map((d) => d.points)).toEqual([50, 55, 60]);
    const long = dailyScores(Array.from({ length: 10 }, (_, i) => w(`2026-10-${String(i + 1).padStart(2, '0')}`)));
    expect(long[9].points).toBe(80);
  });

  it('caps a day at 200 before the bonus and merges same-day workouts', () => {
    const days = dailyScores([w('2026-11-01', 150), w('2026-11-01', 150)]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ workouts: 2, base: 200, points: 200 });
  });

  it('resets the streak after a missed day', () => {
    const days = dailyScores(['2026-11-01', '2026-11-02', '2026-11-04'].map((d) => w(d)));
    expect(days.map((d) => d.streakDay)).toEqual([1, 2, 1]);
    expect(bestStreak(days)).toBe(2);
  });

  it('keeps the streak alive until a full day is missed', () => {
    const days = dailyScores(['2026-11-01', '2026-11-02'].map((d) => w(d)));
    expect(currentStreak(days, '2026-11-02')).toBe(2);
    expect(currentStreak(days, '2026-11-03')).toBe(2);
    expect(currentStreak(days, '2026-11-04')).toBe(0);
  });

  it('crosses month boundaries', () => {
    const days = dailyScores(['2026-10-31', '2026-11-01'].map((d) => w(d)));
    expect(days[1].streakDay).toBe(2);
  });

  it('summarizes today, week and month', () => {
    const days = dailyScores([w('2026-10-30'), w('2026-11-01'), w('2026-11-02')]);
    const s = summarize(days, new Date(2026, 10, 2, 12)); // Monday 2 Nov
    expect(s.today).toBe(55);
    expect(s.week).toBe(55);
    expect(s.month).toBe(50 + 55);
    expect(s.total).toBe(50 + 50 + 55);
    expect(s.streak).toBe(2);
    expect(s.trainedToday).toBe(true);
    expect(nextStreakBonus(s.streak)).toBe(10);
  });
});
