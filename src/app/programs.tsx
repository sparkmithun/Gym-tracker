import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Button, Card, T, styles } from '@/components/ui';
import { createFolder, saveRoutine } from '@/features/routines/data';
import { programToDrafts, STARTER_PROGRAMS } from '@/features/routines/starterPrograms';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { space } from '@/theme';

export default function Programs() {
  const userId = useUserId();
  const u = useUnits();
  const [busy, setBusy] = useState<string | null>(null);

  const add = async (p: (typeof STARTER_PROGRAMS)[number]) => {
    setBusy(p.name);
    try {
      const folderId = await createFolder(userId, p.name);
      for (const r of programToDrafts(p, folderId, u.restDefault)) await saveRoutine(userId, r);
      Alert.alert('Added', `"${p.name}" is now in your routines.`);
      router.back();
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <T dim>Ready-made splits. Adding one copies its routines into a new folder you can edit freely.</T>
      {STARTER_PROGRAMS.map((p) => (
        <Card key={p.name} style={{ gap: space.sm }}>
          <T v="h3">{p.name}</T>
          <T v="small" dim>{p.description}</T>
          {p.routines.map((r) => (
            <T key={r.name} v="small">• {r.name}: {r.items.map((i) => i[0]).join(', ')}</T>
          ))}
          <Button title="Add to my routines" small loading={busy === p.name} disabled={!!busy} onPress={() => add(p)} />
        </Card>
      ))}
    </ScrollView>
  );
}
