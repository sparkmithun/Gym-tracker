import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Card, Ionicons, Row, Stat, T } from '@/components/ui';
import { useUnits } from '@/hooks/useUnits';
import { colors, space } from '@/theme';
import { formatDurationShort } from '@/utils/units';
import type { Contest, LeaderRow, Metric, Period } from './api';
import { localDay, nextStreakBonus, type PointsSummary } from './points';

export function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  if (url) return <Image source={url} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
      <T v={size > 40 ? 'h2' : 'h3'} color={colors.primary}>{(name[0] ?? '?').toUpperCase()}</T>
    </View>
  );
}

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

export const METRIC_LABEL: Record<Metric, string> = { points: 'Points', workouts: 'Workouts', volume: 'Volume', duration: 'Time trained' };

export function useMetricFormat() {
  const u = useUnits();
  return (metric: Metric, value: number) => {
    switch (metric) {
      case 'points': return `${Math.round(value).toLocaleString()} pts`;
      case 'workouts': return `${value} ${value === 1 ? 'workout' : 'workouts'}`;
      case 'volume': return u.volume(value);
      case 'duration': return formatDurationShort(value);
    }
  };
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardList({ rows, metric = 'points', empty }: { rows: LeaderRow[]; metric?: Metric; empty: string }) {
  const fmt = useMetricFormat();
  if (!rows.length) return <T dim style={{ textAlign: 'center', padding: space.lg }}>{empty}</T>;
  return (
    <View style={{ gap: space.xs }}>
      {rows.map((r, i) => {
        // Your own row can come after the top 100; show a gap before it.
        const gap = i > 0 && r.rank - rows[i - 1].rank > 1 && r.is_me;
        const name = r.display_name || r.username;
        return (
          <View key={r.user_id}>
            {gap && <T muted style={{ textAlign: 'center' }}>⋯</T>}
            <Row
              gap={space.md}
              style={{
                padding: space.md,
                borderRadius: 12,
                backgroundColor: r.is_me ? colors.primaryDim : colors.surface,
                borderWidth: r.is_me ? 1 : 0,
                borderColor: colors.primary,
              }}
            >
              <View style={{ width: 32, alignItems: 'center' }}>
                {r.rank <= 3 && (r.value > 0 || r.is_me) ? <T v="h2">{MEDALS[r.rank - 1]}</T> : <T v="h3" dim>{r.rank}</T>}
              </View>
              <Avatar url={r.avatar_url} name={name} />
              <View style={{ flex: 1 }}>
                <T v="h3" numberOfLines={1}>{name}{r.is_me ? ' (you)' : ''}</T>
                <T v="small" dim numberOfLines={1}>
                  @{r.username}
                  {r.streak ? ` · 🔥 ${r.streak}` : ''}
                  {r.workouts !== undefined && metric === 'points' ? ` · ${r.workouts} ${r.workouts === 1 ? 'workout' : 'workouts'}` : ''}
                </T>
              </View>
              <T v="h3" color={r.rank === 1 && r.value > 0 ? colors.gold : colors.text}>{fmt(metric, r.value)}</T>
            </Row>
          </View>
        );
      })}
    </View>
  );
}

/** Your points and streak. `rank` is this week's global rank when known. */
export function PointsCard({ s, rank, onPress }: { s: PointsSummary | undefined; rank?: number | null; onPress?: () => void }) {
  const streak = s?.streak ?? 0;
  const nudge = !s
    ? ''
    : s.trainedToday
      ? `Trained today ✓ — come back tomorrow for +${nextStreakBonus(streak)} streak bonus`
      : streak > 0
        ? `Train today to keep your ${streak}-day streak (+${nextStreakBonus(streak)} bonus)`
        : 'Log a workout today to start a streak';
  return (
    <Card onPress={onPress} style={{ gap: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3">Points & streak</T>
        {rank ? <T v="small" color={colors.gold}>#{rank} this week</T> : onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </Row>
      <Row>
        <Stat label="Day streak" value={`🔥 ${streak}`} />
        <Stat label="Today" value={`${s?.today ?? 0} pts`} />
        <Stat label="This week" value={`${s?.week ?? 0} pts`} />
      </Row>
      <Row>
        <Stat label="This month" value={`${s?.month ?? 0} pts`} />
        <Stat label="All-time" value={`${(s?.total ?? 0).toLocaleString()} pts`} />
        <Stat label="Best streak" value={`${s?.best ?? 0} days`} />
      </Row>
      {!!nudge && <T v="small" dim>{nudge}</T>}
    </Card>
  );
}

export function contestStatus(c: Contest, now = new Date()): { label: string; color: string } {
  const today = localDay(now);
  if (c.starts_on > today) {
    const d = differenceInCalendarDays(parseISO(c.starts_on), now);
    return { label: d === 1 ? 'Starts tomorrow' : `Starts in ${d} days`, color: colors.warning };
  }
  if (c.ends_on < today) return { label: 'Ended', color: colors.textMuted };
  const left = differenceInCalendarDays(parseISO(c.ends_on), now);
  return { label: left === 0 ? 'Last day!' : `${left + 1} days left`, color: colors.success };
}

export function ContestCard({ c }: { c: Contest }) {
  const status = contestStatus(c);
  return (
    <Card onPress={() => router.push(`/contest/${c.id}`)} style={{ gap: space.xs }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3" style={{ flex: 1 }} numberOfLines={1}>{c.is_official ? '⭐ ' : ''}{c.title}</T>
        {c.joined && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
      </Row>
      <T v="small" dim>
        {METRIC_LABEL[c.metric]} · {format(parseISO(c.starts_on), 'd MMM')} – {format(parseISO(c.ends_on), 'd MMM')}
        {c.group_name ? ` · ${c.group_name}` : ''}
      </T>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="small" color={status.color}>{status.label}</T>
        <T v="small" muted>{c.participants} {c.participants === 1 ? 'player' : 'players'}</T>
      </Row>
    </Card>
  );
}
