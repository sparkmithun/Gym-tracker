import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, View } from 'react-native';
import { Button, Card, Chip, Ionicons, Row, SectionTitle, T, styles } from '@/components/ui';
import { deleteGroup, getGroup, joinPublicGroup, leaderboard, leaveGroup, listContests, type Period } from '@/features/social/api';
import { ContestCard, LeaderboardList, PERIODS } from '@/features/social/components';
import { useRemote } from '@/hooks/useRemote';
import { useUserId } from '@/providers/AuthProvider';
import { syncNow } from '@/sync/sync';
import { colors, space } from '@/theme';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const [period, setPeriod] = useState<Period>('week');
  const [busy, setBusy] = useState(false);

  const group = useRemote(() => getGroup(id), [id]);
  const g = group.data;
  const member = !!g?.is_member;
  const board = useRemote(async () => {
    if (!member) return null;
    await syncNow(userId).catch(() => undefined);
    return leaderboard(period, id);
  }, [member, period, id, userId]);
  const contests = useRemote(() => (member ? listContests('active', id) : Promise.resolve([])), [member, id]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await group.reload();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (group.error && !g) {
    return <View style={[styles.screen, { padding: space.lg }]}><T color={colors.danger}>{group.error.message}</T></View>;
  }
  if (group.data === null) {
    return <View style={[styles.screen, { padding: space.lg }]}><T dim>This group no longer exists or is private.</T></View>;
  }
  if (!g) return <View style={styles.screen} />;

  const isOwner = g.owner_id === userId;
  const invite = () =>
    g.invite_code &&
    Share.share({ message: `Join my group "${g.name}" on Spark Lift! Open Compete → Groups → Join with code: ${g.invite_code}` });

  const leave = () =>
    Alert.alert(isOwner ? 'Delete group?' : 'Leave group?', isOwner ? 'The group and its contests are deleted for everyone.' : g.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isOwner ? 'Delete' : 'Leave',
        style: 'destructive',
        onPress: () => act(async () => {
          await (isOwner ? deleteGroup(g.id) : leaveGroup(userId, g.id));
          router.back();
        }),
      },
    ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={group.refreshing || board.refreshing}
          onRefresh={() => { group.refresh(); board.refresh(); contests.refresh(); }}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: g.name }} />
      <Card style={{ gap: space.sm }}>
        <Row>
          <Ionicons name={g.is_public ? 'globe-outline' : 'lock-closed'} size={16} color={colors.textDim} />
          <T v="small" dim>{g.is_public ? 'Public group' : 'Private group'} · {g.member_count} {g.member_count === 1 ? 'member' : 'members'}</T>
        </Row>
        {!!g.description && <T>{g.description}</T>}
        {member ? (
          <Row>
            {g.invite_code && <Button title={`Invite · ${g.invite_code}`} icon="share-outline" small variant="secondary" onPress={invite} style={{ flex: 1 }} />}
            <Button title={isOwner ? 'Delete' : 'Leave'} small variant="ghost" onPress={leave} loading={busy} />
          </Row>
        ) : (
          <Button title="Join group" icon="enter-outline" onPress={() => act(() => joinPublicGroup(userId, g.id))} loading={busy} />
        )}
      </Card>

      {member && (
        <>
          <SectionTitle title="Leaderboard" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {PERIODS.map((p) => <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />)}
          </ScrollView>
          {board.error && !board.data && <T color={colors.danger}>{board.error.message}</T>}
          {board.data ? <LeaderboardList rows={board.data} empty="No members yet." /> : !board.error && <T dim>Loading…</T>}

          <SectionTitle
            title="Group contests"
            action={<Button title="New" icon="add" small variant="ghost" onPress={() => router.push({ pathname: '/contest/new', params: { groupId: g.id, groupName: g.name } })} />}
          />
          {contests.data?.length === 0 && <T dim>No live contests. Start one for the group!</T>}
          <View style={{ gap: space.md }}>{contests.data?.map((c) => <ContestCard key={c.id} c={c} />)}</View>
        </>
      )}
    </ScrollView>
  );
}
