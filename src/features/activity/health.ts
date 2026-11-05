import { addDays, startOfDay } from 'date-fns';
import { Platform } from 'react-native';
import { kvGet, kvSet } from '@/db/client';
import { dayKey, saveDailyActivity, type DailyActivity } from './data';

// Daily steps and walking distance from Android Health Connect / Apple Health.
// Both are native modules that aren't in Expo Go, so they're loaded lazily and the rest
// of the app keeps working without them.

type HealthConnect = typeof import('react-native-health-connect');
type HealthKit = typeof import('@kingstinct/react-native-healthkit');

const ENABLED_KEY = 'health_enabled';
const LAST_IMPORT_KEY = 'health_last_import';

export const healthName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

function load<T>(name: 'hc' | 'hk'): T | null {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- lazy on purpose (see above) */
    return (name === 'hc' ? require('react-native-health-connect') : require('@kingstinct/react-native-healthkit')) as T;
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    return null;
  }
}

export type HealthStatus = 'available' | 'needs-install' | 'needs-update' | 'unsupported';

export async function healthStatus(): Promise<HealthStatus> {
  if (Platform.OS === 'android') {
    const hc = load<HealthConnect>('hc');
    if (!hc) return 'unsupported';
    try {
      const s = await hc.getSdkStatus();
      if (s === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      if (s === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update';
      return 'needs-install';
    } catch {
      return 'unsupported';
    }
  }
  if (Platform.OS === 'ios') {
    const hk = load<HealthKit>('hk');
    if (!hk) return 'unsupported';
    try {
      return hk.isHealthDataAvailable() ? 'available' : 'unsupported';
    } catch {
      return 'unsupported';
    }
  }
  return 'unsupported';
}

/** Asks for read access to steps and distance. Returns true if steps were granted. */
export async function connectHealth(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const hc = load<HealthConnect>('hc');
    if (!hc || !(await hc.initialize())) return false;
    const granted = await hc.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
    ]);
    const ok = granted.some((p) => p.recordType === 'Steps');
    await kvSet(ENABLED_KEY, ok ? '1' : null);
    return ok;
  }
  if (Platform.OS === 'ios') {
    const hk = load<HealthKit>('hk');
    if (!hk) return false;
    // iOS never says whether read access was granted; a denied user simply gets zero steps.
    await hk.requestAuthorization({ toRead: ['HKQuantityTypeIdentifierStepCount', 'HKQuantityTypeIdentifierDistanceWalkingRunning'] });
    await kvSet(ENABLED_KEY, '1');
    return true;
  }
  return false;
}

export async function disconnectHealth() {
  await kvSet(ENABLED_KEY, null);
}

export async function isHealthEnabled(): Promise<boolean> {
  return (await kvGet(ENABLED_KEY)) === '1';
}

export async function lastHealthImport(): Promise<string | null> {
  return kvGet(LAST_IMPORT_KEY);
}

async function readAndroid(from: Date, to: Date): Promise<DailyActivity[]> {
  const hc = load<HealthConnect>('hc');
  if (!hc || !(await hc.initialize())) return [];
  const range = { operator: 'between' as const, startTime: from.toISOString(), endTime: to.toISOString() };
  const slicer = { period: 'DAYS' as const, length: 1 };
  const [steps, distance] = await Promise.all([
    hc.aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: range, timeRangeSlicer: slicer }),
    hc.aggregateGroupByPeriod({ recordType: 'Distance', timeRangeFilter: range, timeRangeSlicer: slicer }).catch(() => []),
  ]);
  const metres = new Map(distance.map((d) => [dayKey(new Date(d.startTime)), d.result.DISTANCE?.inMeters ?? 0]));
  return steps.map((d) => {
    const day = dayKey(new Date(d.startTime));
    return { day, steps: d.result.COUNT_TOTAL ?? 0, distance_m: metres.get(day) ?? 0, source: 'health_connect' };
  });
}

async function readIos(from: Date, to: Date): Promise<DailyActivity[]> {
  const hk = load<HealthKit>('hk');
  if (!hk) return [];
  const opts = { filter: { date: { startDate: from, endDate: to } } };
  const [steps, distance] = await Promise.all([
    hk.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], from, { day: 1 }, { ...opts, unit: 'count' }),
    hk.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierDistanceWalkingRunning', ['cumulativeSum'], from, { day: 1 }, { ...opts, unit: 'm' }),
  ]);
  const metres = new Map(distance.map((d) => [d.startDate ? dayKey(d.startDate) : '', d.sumQuantity?.quantity ?? 0]));
  return steps
    .filter((d) => d.startDate)
    .map((d) => {
      const day = dayKey(d.startDate!);
      return { day, steps: d.sumQuantity?.quantity ?? 0, distance_m: metres.get(day) ?? 0, source: 'apple_health' };
    });
}

let running: Promise<number> | null = null;

/** Imports the last `days` days (today included). Returns how many days changed. Concurrent calls share one run. */
export function importHealth(userId: string, days = 14): Promise<number> {
  running ??= (async () => {
    try {
      if (!(await isHealthEnabled())) return 0;
      const to = new Date();
      const from = startOfDay(addDays(to, -(days - 1)));
      const rows = Platform.OS === 'ios' ? await readIos(from, to) : Platform.OS === 'android' ? await readAndroid(from, to) : [];
      const changed = await saveDailyActivity(userId, rows.filter((r) => r.steps > 0 || r.distance_m > 0));
      await kvSet(LAST_IMPORT_KEY, new Date().toISOString());
      return changed;
    } finally {
      running = null;
    }
  })();
  return running;
}
