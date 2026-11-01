import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, EmptyState, IconButton, Ionicons, Row, Stat, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { totalWorkouts } from '@/features/stats/data';
import { listWorkouts } from '@/features/workout/data';
import { WorkoutCard } from '@/features/workout/components/WorkoutCard';
import { useAuth, useUserId } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

const PAGE = 20;

export default function ProfileTab() {
  const userId = useUserId();
  const { profile, isGuest } = useAuth();
  const [limit, setLimit] = useState(PAGE);
  const { data } = useLiveQuery(
    async () => ({ workouts: await listWorkouts(userId, limit), total: await totalWorkouts(userId) }),
    [userId, limit],
  );

  return (
    <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={data?.workouts ?? []}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => <WorkoutCard w={item} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => data && data.workouts.length >= limit && setLimit((l) => l + PAGE)}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Row gap={space.lg}>
              {profile?.avatar_url ? (
                <Image source={profile.avatar_url} style={{ width: 72, height: 72, borderRadius: 36 }} />
              ) : (
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={36} color={colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <T v="h2">{profile?.display_name ?? profile?.username}</T>
                <T dim>@{profile?.username}{isGuest ? ' · guest' : ''}</T>
              </View>
              <IconButton name="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
            </Row>
            {profile?.bio ? <T dim>{profile.bio}</T> : null}
            <Row>
              <Stat label="Workouts" value={String(data?.total ?? 0)} />
            </Row>
            <Row>
              <Button title="Calendar" icon="calendar-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push('/calendar')} />
              <Button title="Measures" icon="body-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push('/measurements')} />
              <Button title="Exercises" icon="list-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push('/exercise/library')} />
            </Row>
            <T v="h3" style={{ marginTop: space.md }}>History</T>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListEmptyComponent={data ? <EmptyState icon="time-outline" title="No workouts logged" body="Your finished workouts show up here." /> : undefined}
      />
  );
}
