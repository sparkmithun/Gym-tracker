import { formatDistanceToNow } from 'date-fns';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { OptionsSheet } from '@/components/OptionsSheet';
import { PromptModal, type PromptRequest } from '@/components/PromptModal';
import { Button, Card, Chip, Row, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { exportCsv, updateProfile } from '@/features/profile/data';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth, useUserId } from '@/providers/AuthProvider';
import { lastSyncedAt, syncNow } from '@/sync/sync';
import { colors, space } from '@/theme';
import { formatDuration } from '@/utils/units';

const REST = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export default function Settings() {
  const userId = useUserId();
  const { profile, isGuest, email, signOut, deleteAccount } = useAuth();
  const [restSheet, setRestSheet] = useState(false);
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

      <T v="h3">Data</T>
      <Card style={{ gap: space.md }}>
        {isGuest || !isSupabaseConfigured ? (
          <T dim>Guest mode — data is stored only on this phone. Sign out and sign in with Google to back it up; your guest data comes with you.</T>
        ) : (
          <Row style={{ justifyContent: 'space-between' }}>
            <T dim style={{ flex: 1 }}>{synced ? `Synced ${formatDistanceToNow(new Date(synced))} ago` : 'Not synced yet'}</T>
            <Button title="Sync now" small variant="secondary" loading={syncing} onPress={doSync} />
          </Row>
        )}
        <Button title="Export workouts (CSV)" icon="download-outline" variant="secondary" loading={exporting} onPress={doExport} />
      </Card>

      <Button title="Sign out" variant="secondary" onPress={signOut} style={{ marginTop: space.lg }} />
      <Button title="Delete account" variant="ghost" onPress={confirmDelete} />
      <T v="tiny" muted style={{ textAlign: 'center' }}>Spark Lift 1.0.0</T>

      <OptionsSheet visible={restSheet} title="Default rest timer" onClose={() => setRestSheet(false)}
        options={REST.map((s) => ({ label: s ? formatDuration(s) : 'Off', onPress: () => set({ default_rest_seconds: s }) }))} />
      <PromptModal request={prompt} onClose={() => setPrompt(null)} />
    </ScrollView>
  );
}
