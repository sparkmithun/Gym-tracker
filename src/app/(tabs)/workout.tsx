import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { OptionsSheet, type SheetOption } from '@/components/OptionsSheet';
import { PromptModal, type PromptRequest } from '@/components/PromptModal';
import { Button, Card, EmptyState, IconButton, Ionicons, Row, SectionTitle, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import type { FolderRow } from '@/db/types';
import {
  createFolder,
  deleteFolder,
  deleteRoutine,
  duplicateRoutine,
  listRoutines,
  moveRoutine,
  renameFolder,
  type RoutineSummary,
} from '@/features/routines/data';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { useUserId } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

type Sheet = { title: string; options: SheetOption[] } | null;

export default function WorkoutTab() {
  const userId = useUserId();
  const start = useStartWorkout();
  const { data } = useLiveQuery(() => listRoutines(userId), [userId]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [prompt, setPrompt] = useState<PromptRequest>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const promptText = (title: string, initial: string, onSubmit: (v: string) => void) => setPrompt({ title, initial, onSubmit });

  const routineMenu = (r: RoutineSummary, folders: FolderRow[]) =>
    setSheet({
      title: r.name,
      options: [
        { label: 'Edit routine', icon: 'create-outline', onPress: () => router.push(`/routine/${r.id}`) },
        { label: 'Duplicate', icon: 'copy-outline', onPress: () => duplicateRoutine(userId, r.id) },
        {
          label: 'Move to folder',
          icon: 'folder-outline',
          onPress: () =>
            setSheet({
              title: 'Move to',
              options: [
                { label: 'My Routines (no folder)', onPress: () => moveRoutine(r.id, null) },
                ...folders.map((f) => ({ label: f.name, onPress: () => moveRoutine(r.id, f.id) })),
              ],
            }),
        },
        {
          label: 'Delete routine',
          icon: 'trash-outline',
          destructive: true,
          onPress: () =>
            Alert.alert('Delete routine?', r.name, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteRoutine(r.id) },
            ]),
        },
      ],
    });

  const folderMenu = (f: FolderRow) =>
    setSheet({
      title: f.name,
      options: [
        { label: 'New routine in folder', icon: 'add', onPress: () => router.push(`/routine/new?folder=${f.id}`) },
        { label: 'Rename folder', icon: 'create-outline', onPress: () => promptText('Rename folder', f.name, (v) => renameFolder(f.id, v)) },
        { label: 'Delete folder (keeps routines)', icon: 'trash-outline', destructive: true, onPress: () => deleteFolder(f.id) },
      ],
    });

  const folders = data?.folders ?? [];
  const routines = data?.routines ?? [];
  const groups: { folder: FolderRow | null; items: RoutineSummary[] }[] = [
    ...folders.map((f) => ({ folder: f, items: routines.filter((r) => r.folder_id === f.id) })),
    { folder: null, items: routines.filter((r) => !r.folder_id || !folders.some((f) => f.id === r.folder_id)) },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <T v="h3">Quick Start</T>
      <Button title="Start Empty Workout" icon="add" onPress={() => start()} />

      <SectionTitle title="Routines" />
      <Row>
        <Button title="New Routine" icon="clipboard-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/routine/new')} />
        <Button title="Explore" icon="compass-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/programs')} />
      </Row>
      <Button title="New Folder" icon="folder-open-outline" variant="ghost" small
        onPress={() => promptText('New folder', 'New Folder', (v) => createFolder(userId, v))} />

      {routines.length === 0 && folders.length === 0 && (
        <EmptyState icon="clipboard-outline" title="No routines yet" body="Create a routine to plan your workouts, or add a starter program." />
      )}

      {groups.map(({ folder, items }) => {
        if (!folder && items.length === 0) return null;
        const key = folder?.id ?? 'none';
        const isCollapsed = collapsed[key];
        return (
          <View key={key} style={{ gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                onPress={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}>
                <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={16} color={colors.textDim} />
                <T v="small" dim style={{ fontWeight: '700' }}>{folder?.name ?? 'My Routines'} ({items.length})</T>
              </Pressable>
              {folder && <IconButton name="ellipsis-horizontal" label={`${folder.name} options`} onPress={() => folderMenu(folder)} />}
            </Row>
            {!isCollapsed && items.map((r) => (
              <Card key={r.id} style={{ gap: space.sm }} onPress={() => router.push(`/routine/${r.id}`)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="h3" style={{ flex: 1 }}>{r.name}</T>
                  <IconButton name="ellipsis-horizontal" label={`${r.name} options`} onPress={() => routineMenu(r, folders)} />
                </Row>
                <T v="small" dim numberOfLines={2}>{r.exercise_names.join(', ') || 'No exercises'}</T>
                <Button title="Start Routine" small onPress={() => start(r.id)} />
              </Card>
            ))}
          </View>
        );
      })}
      <OptionsSheet visible={!!sheet} title={sheet?.title} options={sheet?.options ?? []} onClose={() => setSheet(null)} />
      <PromptModal request={prompt} onClose={() => setPrompt(null)} />
    </ScrollView>
  );
}
