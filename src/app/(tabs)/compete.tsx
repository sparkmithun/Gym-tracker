import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { PromptModal, type PromptRequest } from '@/components/PromptModal';
import { Button, Card, Chip, EmptyState, Input, Ionicons, Row, SectionTitle, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import {
  joinContestByCode,
  joinGroupByCode,
  leaderboard,
  listContests,
  listGroups,
  type ContestFilter,
  type Group,
  type Period,
} from '@/features/social/api';
import { ContestCard, LeaderboardList, PERIODS, PointsCard } from '@/features/social/components';
import { myPoints } from '@/features/social/local';
import { useRemote } from '@/hooks/useRemote';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth, useUserId } from '@/providers/AuthProvider';
import { syncNow } from '@/sync/sync';
import { colors, space } from '@/theme';

type Section = 'board' | 'groups' | 'contests';

const errorText = (e: Error) => (/fetch|network/i.test(e.message) ? 'You seem to be offline. Pull down to retry.' : e.message);

export default function Compete() {
  const userId = useUserId();
  const { isGuest } = useAuth();
  const [section, setSection] = useState<Section>('board');
  const { data: mine } = useLiveQuery(() => myPoints(userId), [userId]);
  const online = isSupabaseConfigured && !isGuest;

  // Your weekly rank for the header; pushes your latest workouts first so it's up to date.
  const { data: weekBoard } = useRemote(async () => {
    if (!online) return null;
    await syncNow(userId).catch(() => undefined);
    return leaderboard('week');
  }, [online, userId]);
  const myRank = weekBoard?.find((r) => r.is_me && r.value > 0)?.rank ?? null;

  const header = (
    <>
      <PointsCard s={mine?.summary} rank={myRank} />
      {online && (
        <Row>
          <Chip label="🏆 Leaderboard" active={section === 'board'} onPress={() => setSection('board')} />
          <Chip label="👥 Groups" active={section === 'groups'} onPress={() => setSection('groups')} />
          <Chip label="🎯 Contests" active={section === 'contests'} onPress={() => setSection('contests')} />
        </Row>
      )}
    </>
  );

  if (!online) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        <PointsRules />
        <EmptyState
          icon="trophy-outline"
          title="Compete with friends"
          body={
            isSupabaseConfigured
              ? 'Leaderboards, groups and contests need an account. Sign in from Settings — your guest workouts and points come with you.'
              : 'Leaderboards, groups and contests need the cloud database. Set up Supabase (see SETUP.md) and sign in.'
          }
          action={isSupabaseConfigured ? <Button title="Open Settings" small variant="secondary" onPress={() => router.push('/settings')} /> : undefined}
        />
      </ScrollView>
    );
  }

  if (section === 'groups') return <GroupsSection header={header} userId={userId} />;
  if (section === 'contests') return <ContestsSection header={header} />;
  return <BoardSection header={header} userId={userId} />;
}

function BoardSection({ header, userId }: { header: ReactNode; userId: string }) {
  const [period, setPeriod] = useState<Period>('week');
  const { data, error, refreshing, refresh } = useRemote(async () => {
    await syncNow(userId).catch(() => undefined);
    return leaderboard(period);
  }, [period, userId]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {header}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {PERIODS.map((p) => <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />)}
      </ScrollView>
      {error && !data && <T color={colors.danger}>{errorText(error)}</T>}
      {data ? (
        <LeaderboardList rows={data} empty="Nobody has scored yet. Log a workout to take first place!" />
      ) : (
        !error && <T dim>Loading leaderboard…</T>
      )}
      <T v="tiny" muted style={{ textAlign: 'center' }}>Private profiles are hidden from the global board but still count in groups.</T>
      <PointsRules />
    </ScrollView>
  );
}

function GroupRow({ g }: { g: Group }) {
  return (
    <Card onPress={() => router.push(`/group/${g.id}`)} style={{ gap: 2 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3" style={{ flex: 1 }} numberOfLines={1}>{g.name}</T>
        {!g.is_public && <Ionicons name="lock-closed" size={16} color={colors.textMuted} />}
        {g.is_member && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
      </Row>
      {!!g.description && <T v="small" dim numberOfLines={2}>{g.description}</T>}
      <T v="small" muted>{g.member_count} {g.member_count === 1 ? 'member' : 'members'}</T>
    </Card>
  );
}

function GroupsSection({ header, userId }: { header: ReactNode; userId: string }) {
  const [search, setSearch] = useState('');
  const [prompt, setPrompt] = useState<PromptRequest>(null);
  const mine = useRemote(() => listGroups({ mine: true }), [userId]);
  const discover = useRemote(() => listGroups({ search }), [search]);
  const refreshing = mine.refreshing || discover.refreshing;
  const others = (discover.data ?? []).filter((g) => !g.is_member);

  const joinByCode = () =>
    setPrompt({
      title: 'Invite code',
      confirm: 'Join',
      onSubmit: (code) =>
        joinGroupByCode(code)
          .then((id) => router.push(`/group/${id}`))
          .catch((e: Error) => Alert.alert('Could not join', e.message)),
    });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { mine.refresh(); discover.refresh(); }} tintColor={colors.primary} />}
    >
      {header}
      <Row>
        <Button title="Create group" icon="add" small onPress={() => router.push('/group/new')} style={{ flex: 1 }} />
        <Button title="Join with code" icon="key-outline" small variant="secondary" onPress={joinByCode} style={{ flex: 1 }} />
      </Row>

      <SectionTitle title="My groups" />
      {mine.error && !mine.data && <T color={colors.danger}>{errorText(mine.error)}</T>}
      {mine.data?.length === 0 && <T dim>You haven&apos;t joined a group yet. Create one for your gym or friends, or join one below.</T>}
      <View style={{ gap: space.md }}>{mine.data?.map((g) => <GroupRow key={g.id} g={g} />)}</View>

      <SectionTitle title="Discover" />
      <Input placeholder="Search public groups" value={search} onChangeText={setSearch} autoCorrect={false} />
      {discover.data && others.length === 0 && <T dim>{search ? 'No groups match.' : 'No other public groups yet.'}</T>}
      <View style={{ gap: space.md }}>{others.map((g) => <GroupRow key={g.id} g={g} />)}</View>

      <PromptModal request={prompt} onClose={() => setPrompt(null)} />
    </ScrollView>
  );
}

const FILTERS: { key: ContestFilter; label: string }[] = [
  { key: 'active', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'mine', label: 'Joined' },
  { key: 'ended', label: 'Ended' },
];

function ContestsSection({ header }: { header: ReactNode }) {
  const [filter, setFilter] = useState<ContestFilter>('active');
  const [prompt, setPrompt] = useState<PromptRequest>(null);
  const { data, error, refreshing, refresh } = useRemote(() => listContests(filter), [filter]);

  const joinByCode = () =>
    setPrompt({
      title: 'Contest code',
      confirm: 'Join',
      onSubmit: (code) =>
        joinContestByCode(code)
          .then((id) => router.push(`/contest/${id}`))
          .catch((e: Error) => Alert.alert('Could not join', e.message)),
    });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {header}
      <Row>
        <Button title="Create contest" icon="add" small onPress={() => router.push('/contest/new')} style={{ flex: 1 }} />
        <Button title="Join with code" icon="key-outline" small variant="secondary" onPress={joinByCode} style={{ flex: 1 }} />
      </Row>
      <Row>
        {FILTERS.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </Row>
      {error && !data && <T color={colors.danger}>{errorText(error)}</T>}
      {data?.length === 0 && (
        <T dim>{filter === 'mine' ? "You haven't joined any contests yet." : filter === 'ended' ? 'No finished contests yet.' : 'No contests here yet. Create one and invite friends!'}</T>
      )}
      <View style={{ gap: space.md }}>{data?.map((c) => <ContestCard key={c.id} c={c} />)}</View>
      <PromptModal request={prompt} onClose={() => setPrompt(null)} />
    </ScrollView>
  );
}

function PointsRules() {
  return (
    <Card style={{ gap: space.xs }}>
      <T v="h3">How points work</T>
      <T v="small" dim>• 10 per finished workout (needs at least one completed set)</T>
      <T v="small" dim>• +2 per working set · +1 per 500 kg lifted · +1 per 5 min · +1 per km</T>
      <T v="small" dim>• 🔥 Streak bonus: +5 per day in a row, up to +30 a day</T>
      <T v="small" dim>• Up to 200 points a day before the streak bonus; warm-up sets don&apos;t count</T>
    </Card>
  );
}
