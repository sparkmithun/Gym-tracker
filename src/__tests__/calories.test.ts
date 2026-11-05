/// <reference types="jest" />
import { calorieDay, sportCalories, sportOf, stepCalories, workoutCalories } from '@/features/activity/calories';

describe('calories burned', () => {
  it('uses MET x kg x hours', () => {
    expect(workoutCalories(3600, 70)).toBe(350); // 5.0 x 70 x 1
    expect(sportCalories('football', 'moderate', 1800, 80)).toBe(280); // 7.0 x 80 x 0.5
  });

  it('scales steps with body weight', () => {
    expect(stepCalories(10000, 70)).toBe(400);
    expect(stepCalories(10000, 105)).toBe(600);
  });

  it('falls back to "other" for unknown sports', () => {
    expect(sportOf('quidditch').key).toBe('other');
  });

  it('adds exercise back to the remaining budget', () => {
    const d = calorieDay({ eaten: 1800, workoutKcal: 300, sportKcal: 200, stepKcal: 250, goal: 2000 });
    expect(d.burned).toBe(750);
    expect(d.remaining).toBe(2000 - 1800 + 750);
  });
});
