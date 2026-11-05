import { formatDistanceToNow } from 'date-fns';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import { OptionsSheet } from '@/components/OptionsSheet';
import { PromptModal, type PromptRequest } from '@/components/PromptModal';
import { Button, Card, Chip, Row, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { connectHealth, disconnectHealth, healthName, importHealth, isHealthEnabled } from '@/features/activity/health';
import { exportCsv, updateProfile } from '@/features/profile/data';
import { signInWithApple, signInWithGoogle } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth, useUserId } from '@/providers/AuthProvider';
import { lastSyncedAt, syncNow } from '@/sync/sync';
import { colors, space } from '@/theme';
import { formatDuration } from '@/utils/units';

const REST = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const STEP_GOALS = [4000, 6000, 8000, 10000, 12000, 15000, 20000];

export default function Settings() {
  const userId = useUserId();
  const { profile, isGuest, email, signOut, deleteAccount } = useAuth();
  const [restSheet, setRestSheet] = useState(false);
  const [stepSheet, setStepSheet] = useState(false);
  const { data: health, refresh: refreshHealth } = useLiveQuery(async () => ({ enabled: await isHealthEnabled() }), []);
  const [prompt, setPrompt] = useState<PromptRequest>(null);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { data: synced, refresh } = useLiveQuery(() => lastSyncedAt(), []);

  if (!profile) return null;
  const set = (patch: Parameters<typeof updateProfile>[1]) => updateProfile(userId, patch);

  const doSync = async () => {
    setSyncing(true);
    try {
      await syncNow(userId);
      refresh();
    } catch (e) {
      Alert.alert('Sync failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const csv = await exportCsv(userId);
      const file = new File(Paths.cache, `spark-lift-export-${new Date().toISOString().slice(0, 10)}.csv`);
      if (file.exists) file.delete();
      file.create();
      file.write(csv);
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export workouts' });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  // Signing in straight from guest mode (not via Sign out, which wipes the phone) keeps the guest data.
  const guestSignIn = (fn: () => Promise<unknown>) =>
    fn().catch((e) => Alert.alert('Sign-in failed', e instanceof Error ? e.message : String(e)));

  const confirmDelete = () =>
    Alert.alert(
      'Delete account?',
      isGuest
        ? 'All workouts, routines and measurements on this device will be erased.'
        : 'Your account and ALL synced data (workouts, routines, measurements, photos) will be permanently deleted from our servers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => deleteAccount().catch((e) => Alert.alert('Could not delete', e instanceof Error ? e.message : String(e))),
        },
      ],
    );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <T v="h3">Profile</T>
      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T>{profile.display_name}</T>
            <T v="small" dim>@{profile.username}{email ? ` · ${email}` : ''}</T>
          </View>
          <Button title="Edit" small variant="secondary"
            onPress={() => setPrompt({ title: 'Display name', initial: profile.display_name ?? '', onSubmit: (v) => set({ display_name: v }) })} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T dim style={{ flex: 1 }} numberOfLines={2}>{profile.bio || 'No bio'}</T>
          <Button title="Bio" small variant="secondary"
            onPress={() => setPrompt({ title: 'Bio', initial: profile.bio ?? '', onSubmit: (v) => set({ bio: v }) })} />
        </Row>
        {!isGuest && (
          <Row style={{ justifyContent: 'space-between' }}>
            <T>Private profile</T>
            <Switch value={profile.is_private} onValueChange={(v) => set({ is_private: v })} trackColor={{ true: colors.primary }} />
          </Row>
        )}
      </Card>

      <T v="h3">Units</T>
      <Card style={{ gap: space.md }}>
        <Row>
          <T style={{ flex: 1 }}>Weight</T>
          <Chip label="kg" active={profile.unit_weight === 'kg'} onPress={() => set({ unit_weight: 'kg' })} />
          <Chip label="lbs" active={profile.unit_weight === 'lbs'} onPress={() => set({ unit_weight: 'lbs' })} />
        </Row>
        <Row>
          <T style={{ flex: 1 }}>Distance</T>
          <Chip label="km" active={profile.unit_distance === 'km'} onPress={() => set({ unit_distance: 'km' })} />
          <Chip label="mi" active={profile.unit_distance === 'mi'} onPress={() => set({ unit_distance: 'mi' })} />
        </Row>
      </Card>

      <T v="h3">Workouts</T>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Default rest timer</T>
          <Button title={profile.default_rest_seconds ? formatDuration(profile.default_rest_seconds) : 'Off'} small variant="secondary" onPress={() => setRestSheet(true)} />
        </Row>
      </Card>

      <T v="h3">Activity & calories</T>
      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Daily step goal</T>
          <Button title={profile.step_goal.toLocaleString()} small variant="secondary" onPress={() => setStepSheet(true)} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Daily calorie goal</T>
          <Button
            title={`${profile.calorie_goal} kcal`}
            small
            variant="secondary"
            onPress={() =>
              setPrompt({
                title: 'Calorie goal (kcal per day)',
                initial: String(profile.calorie_goal),
                onSubmit: (v) => {
                  const n = Math.round(Number(v));
                  if (n >= 800 && n <= 10000) set({ calorie_goal: n });
                  else Alert.alert('Enter a number between 800 and 10000');
                },
              })
            }
          />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T>{healthName}</T>
            <T v="small" dim>{health?.enabled ? 'Steps import automatically' : 'Not connected'}</T>
          </View>
          <Button
            title={health?.enabled ? 'Disconnect' : 'Connect'}
            small
            variant="secondary"
            onPress={async () => {
              if (health?.enabled) await disconnectHealth();
              else if (!(await connectHealth().catch(() => false))) {
                Alert.alert(`${healthName} unavailable`, `Needs the installed app (not Expo Go)${Platform.OS === 'android' ? ' and Health Connect from the Play Store' : ''}, plus permission to read Steps.`);
              } else await importHealth(userId).catch(() => undefined);
              refreshHealth();
            }}
          />
        </Row>
        <T v="tiny" muted>Calories burned use your latest weight from Measurements (70 kg if none).</T>
      </Card>

      <T v="h3">Data</T>
      <Card style={{ gap: space.md }}>
        {isGuest && isSupabaseConfigured ? (
          <>
            <T dim>Guest mode — data is stored only on this phone. Sign in to back it up and compete on leaderboards; your guest workouts come with you.</T>
            <Button title="Sign in with Google" icon="logo-google" onPress={() => guestSignIn(signInWithGoogle)} />
            {Platform.OS === 'ios' && <Button title="Sign in with Apple" icon="logo-apple" variant="secondary" onPress={() => guestSignIn(signInWithApple)} />}
          </>
        ) : isGuest || !isSupabaseConfigured ? (
          <T dim>Guest mode — data is stored only on this phone.</T>
        ) : (
          <Row style={{ justifyContent: 'space-between' }}>
            <T dim style={{ flex: 1 }}>{synced ? `Synced ${formatDistanceToNow(new Date(synced))} ago` : 'Not synced yet'}</T>
            <Button title="Sync now" small variant="secondary" loading={syncing} onPress={doSync} />
          </Row>
        )}
        <Button title="Export workouts (CSV)" icon="download-outline" variant="secondary" loading={exporting} onPress={doExport} />
      </Card>

      <Button
        title="Sign out"
        variant="secondary"
        style={{ marginTop: space.lg }}
        onPress={() =>
          isGuest
            ? Alert.alert('Leave guest mode?', 'Guest data lives only on this phone and will be erased. Use "Sign in with Google" above to keep it.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Erase and sign out', style: 'destructive', onPress: signOut },
              ])
            : signOut()
        }
      />
      <Button title="Delete account" variant="ghost" onPress={confirmDelete} />
      <T v="tiny" muted style={{ textAlign: 'center' }}>Spark Lift 1.0.0</T>

      <OptionsSheet visible={stepSheet} title="Daily step goal" onClose={() => setStepSheet(false)}
        options={STEP_GOALS.map((n) => ({ label: n.toLocaleString(), onPress: () => set({ step_goal: n }) }))} />
      <OptionsSheet visible={restSheet} title="Default rest timer" onClose={() => setRestSheet(false)}
        options={REST.map((s) => ({ label: s ? formatDuration(s) : 'Off', onPress: () => set({ default_rest_seconds: s }) }))} />
      <PromptModal request={prompt} onClose={() => setPrompt(null)} />
    </ScrollView>
  );
}
