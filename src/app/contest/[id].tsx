import { format, parseISO } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, View } from 'react-native';
import { Button, Card, Row, SectionTitle, Stat, T, styles } from '@/components/ui';
import { contestLeaderboard, deleteContest, getContest, joinContest, leaveContest } from '@/features/social/api';
import { contestStatus, LeaderboardList, METRIC_LABEL, useMetricFormat } from '@/features/social/components';
import { useRemote } from '@/hooks/useRemote';
import { useUserId } from '@/providers/AuthProvider';
import { syncNow } from '@/sync/sync';
import { colors, space } from '@/theme';

const METRIC_HELP = {
  points: 'Most points wins — sets, volume, time and daily streaks all count.',
  workouts: 'Most finished workouts wins.',
  volume: 'Most total weight lifted (weight × reps) wins.',
  duration: 'Most time spent training wins.',
} as const;

export default function ContestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const fmt = useMetricFormat();
  const [busy, setBusy] = useState(false);

  const contest = useRemote(() => getContest(id), [id]);
  const board = useRemote(async () => {
    await syncNow(userId).catch(() => undefined);
    return contestLeaderboard(id);
  }, [id, userId]);
  const c = contest.data;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([contest.reload(), board.reload()]);
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (contest.error && !c) {
    return <View style={[styles.screen, { padding: space.lg }]}><T color={colors.danger}>{contest.error.message}</T></View>;
  }
  if (contest.data === null) {
    return <View style={[styles.screen, { padding: space.lg }]}><T dim>This contest no longer exists or is private.</T></View>;
  }
  if (!c) return <View style={styles.screen} />;

  const status = contestStatus(c);
  const ended = status.label === 'Ended';
  const me = board.data?.find((r) => r.is_me);
  const leader = board.data?.[0];

  const invite = () =>
    c.invite_code && Share.share({ message: `Join my contest "${c.title}" on Spark Lift! Open Compete → Contests → Join with code: ${c.invite_code}` });

  const leave = () =>
    Alert.alert(c.is_owner ? 'Delete contest?' : 'Leave contest?', c.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: c.is_owner ? 'Delete' : 'Leave',
        style: 'destructive',
        onPress: () =>
          c.is_owner
            ? act(async () => {
                await deleteContest(c.id);
                router.back();
              })
            : act(() => leaveContest(userId, c.id)),
      },
    ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={contest.refreshing || board.refreshing} onRefresh={() => { contest.refresh(); board.refresh(); }} tintColor={colors.primary} />}
    >
      <Stack.Screen options={{ title: c.is_official ? '⭐ Contest' : 'Contest' }} />
      <Card style={{ gap: space.sm }}>
        <T v="h2">{c.title}</T>
        <T v="small" dim>
          {format(parseISO(c.starts_on), 'EEE d MMM')} – {format(parseISO(c.ends_on), 'EEE d MMM yyyy')}
          {c.group_name ? ` · ${c.group_name}` : ''}
        </T>
        <T v="small" color={status.color}>{status.label}</T>
        {!!c.description && <T>{c.description}</T>}
        <T v="small" dim>🎯 {METRIC_HELP[c.metric]}</T>
        <Row>
          <Stat label="Players" value={String(c.participants)} />
          <Stat label="Your rank" value={me && c.joined ? `#${me.rank}` : '–'} />
          <Stat label={`Your ${METRIC_LABEL[c.metric].toLowerCase()}`} value={me && c.joined ? fmt(c.metric, me.value) : '–'} />
        </Row>
        {c.joined ? (
          <Row>
            {c.invite_code && <Button title={`Invite · ${c.invite_code}`} icon="share-outline" small variant="secondary" onPress={invite} style={{ flex: 1 }} />}
            {(!ended || c.is_owner) && <Button title={c.is_owner ? 'Delete' : 'Leave'} small variant="ghost" onPress={leave} loading={busy} />}
          </Row>
        ) : ended ? null : (
          <Button title="Join contest" icon="flag" onPress={() => act(() => joinContest(c.id))} loading={busy} />
        )}
      </Card>

      {ended && leader && leader.value > 0 && (
        <Card style={{ alignItems: 'center', gap: space.xs, borderColor: colors.gold }}>
          <T v="h1">🏆</T>
          <T v="h3">{leader.display_name || leader.username} won!</T>
          <T dim>{fmt(c.metric, leader.value)}</T>
        </Card>
      )}

      <SectionTitle title="Standings" />
      {board.error && !board.data && <T color={colors.danger}>{board.error.message}</T>}
      {board.data ? (
        <LeaderboardList rows={board.data} metric={c.metric} empty="No players yet — be the first to join!" />
      ) : (
        !board.error && <T dim>Loading…</T>
      )}
      <T v="tiny" muted style={{ textAlign: 'center' }}>Workouts count on the day they started, in each player&apos;s own time zone.</T>
    </ScrollView>
  );
}
