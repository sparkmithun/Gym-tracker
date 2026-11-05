// The dashboard runs on a server in UTC; days are bucketed in the user's own time zone
// (profiles.timezone, reported by the phone) so they match the app.

/** yyyy-MM-dd of `date` in `timeZone`. */
export function dayIn(timeZone: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Adds whole days to a yyyy-MM-dd string. */
export function addDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDay(day, -((dow + 6) % 7));
}

export const monthStart = (day: string) => `${day.slice(0, 8)}01`;

/** The last `n` days ending on `today`, oldest first. */
export const lastDays = (today: string, n: number) => Array.from({ length: n }, (_, i) => addDay(today, i - n + 1));

export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
