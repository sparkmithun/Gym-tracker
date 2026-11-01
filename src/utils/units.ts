export type WeightUnit = 'kg' | 'lbs';
export type DistanceUnit = 'km' | 'mi';

const LB_PER_KG = 2.20462262;
const MI_PER_KM = 0.621371192;

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** kg (storage) -> display unit */
export const toDisplayWeight = (kg: number, unit: WeightUnit) =>
  unit === 'kg' ? round(kg, 2) : round(kg * LB_PER_KG, 1);

/** display unit -> kg (storage) */
export const fromDisplayWeight = (value: number, unit: WeightUnit) =>
  unit === 'kg' ? value : value / LB_PER_KG;

/** metres (storage) -> km or mi */
export const toDisplayDistance = (m: number, unit: DistanceUnit) =>
  unit === 'km' ? round(m / 1000, 2) : round((m / 1000) * MI_PER_KM, 2);

/** km or mi -> metres (storage) */
export const fromDisplayDistance = (value: number, unit: DistanceUnit) =>
  unit === 'km' ? value * 1000 : (value / MI_PER_KM) * 1000;

/** Parse user input like "22.5" or "22,5"; returns undefined for blank/invalid. */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Parse "90", "1:30" or "1:02:03" into seconds. */
export function parseDuration(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "1h 12m" style, for summaries. */
export function formatDurationShort(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = toDisplayWeight(kg, unit);
  return `${Math.round(v).toLocaleString()} ${unit}`;
}
